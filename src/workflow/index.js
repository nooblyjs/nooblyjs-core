/**
 * @fileoverview Workflow Service
 * Service for defining and executing multi-step workflows with worker thread support.
 * Provides sequential step execution with error handling and event emission.
 *
 * @author Noobly JS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const path = require('node:path');
const WorkflowApi = require('./providers/workflowApi');
const WorkflowAnalytics = require('./modules/analytics');
const WorkflowDefinitionContainer = require('./containers/WorkflowDefinitionContainer');
const WorkflowExecutionContainer = require('./containers/WorkflowExecutionContainer');
const Routes = require('./routes');
const Views = require('./views');

/** @type {WorkflowAnalytics} */
let analyticsInstance = null;

/**
 * WorkflowService class for managing and executing workflows.
 * Uses the working service to execute individual steps via worker threads.
 */
class WorkflowService {
  /**
   * Creates a new WorkflowService instance.
   * @param {EventEmitter} eventEmitter - Global event emitter for workflow events
   * @param {Object} workingService - Working service instance for executing tasks
   */
  constructor(eventEmitter, workingService) {
    /** @private {Map<string, Array<string>>} Map of workflow names to step file paths (deprecated - use definitionContainer) */
    this.workflows = new Map();

    /** @private {WorkflowDefinitionContainer} Container for workflow definitions */
    this.definitionContainer = new WorkflowDefinitionContainer();

    /** @private {WorkflowExecutionContainer} Container for workflow executions */
    this.executionContainer = new WorkflowExecutionContainer({ maxExecutionsPerWorkflow: 1000 });

    /** @private {EventEmitter} Global event emitter */
    this.eventEmitter_ = eventEmitter;

    /** @private {Object} Working service for task execution */
    this.workingService_ = workingService;

    // Settings configuration
    this.settings = {};
    this.settings.description = "Configuration settings for the workflow service";
    this.settings.list = [
      { setting: 'maxSteps', type: 'number', values: null },
      { setting: 'timeoutPerStep', type: 'number', values: null },
      { setting: 'parallelExecution', type: 'boolean', values: null }
    ];
    this.settings.maxSteps = 50;
    this.settings.timeoutPerStep = 60000;
    this.settings.parallelExecution = false;
  }

  /**
   * Defines a new workflow with specified steps.
   * @param {string} workflowName - Unique name for the workflow
   * @param {Array<string>} steps - Array of file paths to step implementations
   * @param {Object} metadata - Optional metadata for the workflow
   * @throws {Error} When workflowName is invalid or steps array is empty
   */
  async defineWorkflow(workflowName, steps, metadata = {}) {
    if (!workflowName || typeof workflowName !== 'string') {
      throw new Error('Workflow name must be a non-empty string');
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('Steps must be a non-empty array of file paths');
    }

    // Store in both legacy map and new container for backwards compatibility
    this.workflows.set(workflowName, steps);
    const definition = this.definitionContainer.define(workflowName, steps, metadata);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('workflow:defined', { workflowName, steps, definition });
    }

    return definition;
  }

  /**
   * Executes a defined workflow with the provided data.
   * Each step receives the original input data plus all previous step outputs
   * in an accumulated format with a 'steps' array containing step metadata.
   *
   * Data structure passed to each step:
   * {
   *   ...originalInputData,  // All original keys preserved
   *   steps: [               // Array of previous step results
   *     {
   *       stepNumber: 1,
   *       stepName: "step_file_name",
   *       stepPath: "/full/path/to/step.js",
   *       data: { ...stepOutput }
   *     }
   *   ]
   * }
   *
   * @param {string} workflowName - Name of the workflow to execute
   * @param {Object} data - Initial data object to pass to first step
   * @param {function} statusCallback - Callback function for workflow progress updates
   *   Receives objects with status: 'step_start', 'step_end', 'step_error', 'workflow_complete'
   *   Each callback includes stepNumber and accumulated data
   * @throws {Error} When workflow is not found or step execution fails
   *
   * @example
   * await workflow.runWorkflow('order_processing',
   *   { orderId: 123, amount: 50 },
   *   (status) => {
   *     if (status.status === 'workflow_complete') {
   *       console.log('Final data:', status.finalData);
   *       console.log('Steps executed:', status.finalData.steps.length);
   *     }
   *   }
   * );
   */
  async runWorkflow(workflowName, data, statusCallback = () => {}) {
    const steps = this.workflows.get(workflowName);
    if (!steps) {
      const error = new Error(`Workflow '${workflowName}' not found.`);
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('workflow:error', {
          workflowName,
          error: error.message,
        });
      }
      throw error;
    }

    if (!this.workingService_) {
      const error = new Error('Working service not available');
      if (this.eventEmitter_) {
        this.eventEmitter_.emit('workflow:error', {
          workflowName,
          error: error.message,
        });
      }
      throw error;
    }

    // Ensure statusCallback is a function
    if (typeof statusCallback !== 'function') {
      statusCallback = () => {};
    }

    // Preserve original input data and initialize steps accumulator
    const originalData = data || {};
    const accumulatedSteps = [];

    // Generate unique workflow execution ID for analytics
    const workflowId = `${workflowName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const executionStartTime = Date.now();
    const stepExecutions = [];

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('workflow:start', {
        workflowName,
        workflowId,
        initialData: data,
      });
    }

    try {
      for (let i = 0; i < steps.length; i++) {
        const stepPath = steps[i];
        const stepNumber = i + 1;
        const stepFileName = path.basename(stepPath, '.js');
        const stepName = `Step ${stepNumber}: ${path.basename(stepPath)}`;
        const stepStartTime = Date.now();

        // Build current accumulated data structure
        const currentAccumulatedData = {
          ...originalData,
          steps: [...accumulatedSteps]
        };

        statusCallback({
          status: 'step_start',
          stepName,
          stepPath,
          stepNumber,
          data: currentAccumulatedData,
        });
        if (this.eventEmitter_)
          this.eventEmitter_.emit('workflow:step:start', {
            workflowName,
            stepName,
            stepPath,
            stepNumber,
            data: currentAccumulatedData,
          });

        try {
          // Use the working service to execute the step
          const stepOutput = await new Promise(async (resolve, reject) => {
            try {
              await this.workingService_.start(stepPath, currentAccumulatedData, (status, result) => {
                if (status === 'completed') {
                  resolve(result);
                } else if (status === 'error') {
                  reject(new Error(result));
                }
              });
            } catch (err) {
              reject(err);
            }
          });

          // Ensure step output is an object (handle primitives)
          const safeStepOutput = (typeof stepOutput === 'object' && stepOutput !== null)
            ? stepOutput
            : { value: stepOutput };

          // Add to accumulated steps
          accumulatedSteps.push({
            stepNumber,
            stepName: stepFileName,
            stepPath,
            data: safeStepOutput
          });

          const stepDuration = Date.now() - stepStartTime;
          stepExecutions.push({
            stepName,
            stepPath,
            inputData: currentAccumulatedData,
            outputData: safeStepOutput,
            status: 'completed',
            startedAt: new Date(stepStartTime).toISOString(),
            endedAt: new Date().toISOString(),
            duration: stepDuration,
            error: null
          });

          const newAccumulatedData = {
            ...originalData,
            steps: [...accumulatedSteps]
          };

          statusCallback({
            status: 'step_end',
            stepName,
            stepPath,
            stepNumber,
            data: newAccumulatedData,
            stepOutput: safeStepOutput,
          });
          if (this.eventEmitter_)
            this.eventEmitter_.emit('workflow:step:end', {
              workflowName,
              stepName,
              stepPath,
              stepNumber,
              data: newAccumulatedData,
              stepOutput: safeStepOutput,
            });
        } catch (error) {
          const stepDuration = Date.now() - stepStartTime;

          const partialAccumulatedData = {
            ...originalData,
            steps: [...accumulatedSteps]
          };

          stepExecutions.push({
            stepName,
            stepPath,
            inputData: currentAccumulatedData,
            outputData: null,
            status: 'error',
            startedAt: new Date(stepStartTime).toISOString(),
            endedAt: new Date().toISOString(),
            duration: stepDuration,
            error: error.message
          });

          statusCallback({
            status: 'step_error',
            stepName,
            stepPath,
            stepNumber,
            error: error.message,
            partialData: partialAccumulatedData,
          });
          if (this.eventEmitter_) {
            this.eventEmitter_.emit('workflow:step:error', {
              workflowName,
              stepName,
              stepPath,
              stepNumber,
              error: error.message,
              partialData: partialAccumulatedData,
            });
            // Emit workflow:error for analytics tracking
            this.eventEmitter_.emit('workflow:error', {
              workflowName,
              workflowId,
              error: error.message,
              partialData: partialAccumulatedData,
            });
          }
          throw error; // Re-throw to stop workflow execution on error
        }
      }

      // Build final accumulated data
      const finalAccumulatedData = {
        ...originalData,
        steps: [...accumulatedSteps]
      };

      // Record successful execution
      const totalDuration = Date.now() - executionStartTime;
      this.executionContainer.record(workflowName, {
        executionId: workflowId,
        inputData: originalData,
        outputData: finalAccumulatedData,
        status: 'completed',
        startedAt: new Date(executionStartTime).toISOString(),
        endedAt: new Date().toISOString(),
        duration: totalDuration,
        error: null,
        stepExecutions
      });

      statusCallback({
        status: 'workflow_complete',
        workflowName,
        finalData: finalAccumulatedData,
        steps: accumulatedSteps,
      });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:complete', {
          workflowName,
          workflowId,
          finalData: finalAccumulatedData,
          steps: accumulatedSteps,
        });
    } catch (error) {
      // Build partial accumulated data (may have some successful steps before the error)
      const partialAccumulatedData = {
        ...originalData,
        steps: [...accumulatedSteps]
      };

      // Record failed execution
      const totalDuration = Date.now() - executionStartTime;
      this.executionContainer.record(workflowName, {
        executionId: workflowId,
        inputData: originalData,
        outputData: partialAccumulatedData,
        status: 'error',
        startedAt: new Date(executionStartTime).toISOString(),
        endedAt: new Date().toISOString(),
        duration: totalDuration,
        error: error.message,
        stepExecutions
      });

      throw error;
    }
  }

  /**
   * Get all settings for the workflow service.
   * @return {Promise<Object>} A promise that resolves to the settings object.
   */
  async getSettings() {
    return this.settings;
  }

  /**
   * Save settings for the workflow service.
   * @param {Object} settings The settings to save.
   * @return {Promise<void>} A promise that resolves when settings are saved.
   */
  async saveSettings(settings) {
    for (let i = 0; i < this.settings.list.length; i++) {
      if (settings[this.settings.list[i].setting] != null) {
        this.settings[this.settings.list[i].setting] = settings[this.settings.list[i].setting];
        this.logger?.info(`[${this.constructor.name}] Setting changed: ${this.settings.list[i].setting}`, {
          setting: this.settings.list[i].setting,
          newValue: settings[this.settings.list[i].setting]
        });
      }
    }
  }
}

/**
 * Creates a workflow service instance with the specified configuration and dependency injection.
 * Automatically configures routes and views for the workflow service.
 * @param {string} type - The workflow provider type ('memory', 'api')
 * @param {Object} options - Provider-specific configuration options
 * @param {Object} options.dependencies - Injected service dependencies
 * @param {Object} options.dependencies.logging - Logging service instance
 * @param {Object} options.dependencies.queueing - Queueing service instance
 * @param {Object} options.dependencies.scheduling - Scheduling service instance
 * @param {Object} options.dependencies.measuring - Measuring service instance
 * @param {Object} options.dependencies.working - Working service instance for task execution
 * @param {EventEmitter} eventEmitter - Global event emitter for inter-service communication
 * @return {WorkflowService|WorkflowApi} Workflow service instance
 * @throws {Error} When required dependencies (especially working service) are missing
 * @example
 * const workflowService = createWorkflowService('memory', {
 *   dependencies: { logging, queueing, scheduling, measuring, working }
 * }, eventEmitter);
 *
 * // Define a workflow with multiple steps
 * await workflowService.defineWorkflow('order_processing', [
 *   '/path/to/steps/validate_order.js',
 *   '/path/to/steps/charge_payment.js',
 *   '/path/to/steps/send_confirmation.js'
 * ]);
 *
 * // Execute the workflow
 * await workflowService.runWorkflow('order_processing', { orderId: 123 }, (status) => {
 *   console.log('Workflow status:', status);
 * });
 */
function createWorkflowService(type, options, eventEmitter) {
  const { dependencies = {}, ...providerOptions } = options;
  const logger = dependencies.logging;
  const queueing = dependencies.queueing;
  const scheduling = dependencies.scheduling;
  const measuring = dependencies.measuring;
  const working = dependencies.working;

  // Create analytics instance if it doesn't exist
  if (!analyticsInstance) {
    analyticsInstance = new WorkflowAnalytics(eventEmitter);
  }

  let workflow;

  switch (type) {
    case 'api':
      workflow = new WorkflowApi(providerOptions, eventEmitter);
      break;
    case 'memory':
    default:
      workflow = new WorkflowService(eventEmitter, working);
      break;
  }

  // Inject dependencies into workflow service
  if (logger) {
    workflow.logger = logger;
    workflow.log = (level, message, meta = {}) => {
      if (typeof logger[level] === 'function') {
        logger[level](`[WORKFLOW:${type.toUpperCase()}] ${message}`, meta);
      }
    };

    // Log workflow service initialization
    workflow.log('info', 'Workflow service initialized', {
      provider: type,
      hasLogging: true,
      hasQueueing: !!queueing,
      hasScheduling: !!scheduling,
      hasMeasuring: !!measuring,
      hasWorking: !!working
    });
  }

  // Inject queueing dependency for async workflow execution
  if (queueing) {
    workflow.queueing = queueing;
  }

  // Inject scheduling dependency for timed workflows
  if (scheduling) {
    workflow.scheduling = scheduling;
  }

  // Inject measuring dependency for performance metrics
  if (measuring) {
    workflow.measuring = measuring;
  }

  // Inject working service for task execution
  if (working) {
    workflow.workingService_ = working;
  }

  // Store all dependencies for potential use by workflow steps
  workflow.dependencies = dependencies;

  // Initialize routes and views for the workflow service
  Routes(options, eventEmitter, workflow, analyticsInstance);
  Views(options, eventEmitter, workflow);

  // Expose settings methods (only for memory provider, API provider has its own implementation)
  if (type !== 'api' && workflow.getSettings && workflow.saveSettings) {
    // Save provider methods before overwriting
    const providerGetSettings = workflow.getSettings.bind(workflow);
    const providerSaveSettings = workflow.saveSettings.bind(workflow);
    const service = workflow;
    service.getSettings = providerGetSettings;
    service.saveSettings = providerSaveSettings;
  }

  return workflow;
}

module.exports = createWorkflowService;
