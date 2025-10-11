/**
 * @fileoverview Workflow Service
 * Service for defining and executing multi-step workflows with worker thread support.
 * Provides sequential step execution with error handling and event emission.
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const path = require('path');
const WorkflowApi = require('./providers/workflowApi');
const WorkflowAnalytics = require('./modules/analytics');
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
    /** @private {Map<string, Array<string>>} Map of workflow names to step file paths */
    this.workflows = new Map();

    /** @private {EventEmitter} Global event emitter */
    this.eventEmitter_ = eventEmitter;

    /** @private {Object} Working service for task execution */
    this.workingService_ = workingService;
  }

  /**
   * Defines a new workflow with specified steps.
   * @param {string} workflowName - Unique name for the workflow
   * @param {Array<string>} steps - Array of file paths to step implementations
   * @throws {Error} When workflowName is invalid or steps array is empty
   */
  async defineWorkflow(workflowName, steps) {
    if (!workflowName || typeof workflowName !== 'string') {
      throw new Error('Workflow name must be a non-empty string');
    }

    if (!Array.isArray(steps) || steps.length === 0) {
      throw new Error('Steps must be a non-empty array of file paths');
    }

    this.workflows.set(workflowName, steps);

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('workflow:defined', { workflowName, steps });
    }
  }

  /**
   * Executes a defined workflow with the provided data.
   * Each step receives the output of the previous step as input.
   * Uses the working service to execute each step in a worker thread.
   * @param {string} workflowName - Name of the workflow to execute
   * @param {Object} data - Initial data object to pass to first step
   * @param {function} statusCallback - Callback function for workflow progress updates
   * @throws {Error} When workflow is not found or step execution fails
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

    let currentData = data;

    // Generate unique workflow execution ID for analytics
    const workflowId = `${workflowName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (this.eventEmitter_) {
      this.eventEmitter_.emit('workflow:start', {
        workflowName,
        workflowId,
        initialData: data,
      });
    }

    for (let i = 0; i < steps.length; i++) {
      const stepPath = steps[i];
      const stepName = `Step ${i + 1}: ${path.basename(stepPath)}`;

      statusCallback({
        status: 'step_start',
        stepName,
        stepPath,
        data: currentData,
      });
      if (this.eventEmitter_)
        this.eventEmitter_.emit('workflow:step:start', {
          workflowName,
          stepName,
          stepPath,
          data: currentData,
        });

      try {
        // Use the working service to execute the step
        currentData = await new Promise(async (resolve, reject) => {
          try {
            await this.workingService_.start(stepPath, currentData, (status, result) => {
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

        statusCallback({
          status: 'step_end',
          stepName,
          stepPath,
          data: currentData,
        });
        if (this.eventEmitter_)
          this.eventEmitter_.emit('workflow:step:end', {
            workflowName,
            stepName,
            stepPath,
            data: currentData,
          });
      } catch (error) {
        statusCallback({
          status: 'step_error',
          stepName,
          stepPath,
          error: error.message,
        });
        if (this.eventEmitter_) {
          this.eventEmitter_.emit('workflow:step:error', {
            workflowName,
            stepName,
            stepPath,
            error: error.message,
          });
          // Emit workflow:error for analytics tracking
          this.eventEmitter_.emit('workflow:error', {
            workflowName,
            workflowId,
            error: error.message,
          });
        }
        throw error; // Re-throw to stop workflow execution on error
      }
    }

    statusCallback({
      status: 'workflow_complete',
      workflowName,
      finalData: currentData,
    });
    if (this.eventEmitter_)
      this.eventEmitter_.emit('workflow:complete', {
        workflowName,
        workflowId,
        finalData: currentData,
      });
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

  return workflow;
}

module.exports = createWorkflowService;
