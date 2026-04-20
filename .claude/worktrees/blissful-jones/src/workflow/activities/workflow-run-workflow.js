/**
 * @fileoverview Workflow activity that launches another workflow
 * This activity enables workflows and schedulers to trigger other workflows,
 * allowing for workflow composition and orchestration.
 *
 * Can be called from:
 * - Workflow steps (via workflow.runWorkflow with this activity as a step)
 * - Scheduler tasks (via scheduler.start with this activity file path)
 *
 * @author Digital Technologies Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const path = require('node:path');
const serviceRegistry = require(path.resolve(__dirname, '../../../index'));

/**
 * Launches a workflow from within another workflow or scheduler.
 *
 * This activity acts as a bridge between the workflow/scheduler services,
 * allowing you to compose complex workflows by having one workflow
 * trigger the execution of another workflow.
 *
 * Input data structure:
 * {
 *   workflowName: string,           // Required: Name of the workflow to execute
 *   workflowData: object,           // Optional: Initial data to pass to the workflow
 *   waitForCompletion: boolean,     // Optional: Whether to wait for workflow completion (default: true)
 *   timeout: number                 // Optional: Timeout in milliseconds for workflow execution
 * }
 *
 * Output data structure:
 * {
 *   success: boolean,               // Whether the workflow executed successfully
 *   workflowName: string,           // Name of the executed workflow
 *   finalData: object,              // Final data after all workflow steps
 *   stepsExecuted: number,          // Number of steps that were executed
 *   executionTime: number,          // Total execution time in milliseconds
 *   error: string | null            // Error message if execution failed
 * }
 *
 * @async
 * @param {Object} data - Input data containing workflow name and optional data
 * @param {string} data.workflowName - Name of the workflow to execute
 * @param {Object} [data.workflowData] - Optional data to pass to the workflow
 * @param {boolean} [data.waitForCompletion] - Whether to wait for completion (default: true)
 * @param {number} [data.timeout] - Optional timeout in milliseconds
 * @return {Promise<Object>} Result object with execution status and final data
 * @throws {Error} When workflow name is not provided or workflow execution fails
 *
 * @example
 * // From within a workflow (in a step definition):
 * // Step 1: Validate input
 * async function run(data) {
 *   return { validated: true, orderId: data.orderId };
 * }
 *
 * // Step 2: Launch sub-workflow
 * // Define workflow with: ['validate.js', 'workflow-run-workflow.js']
 * // When executing step 2, it receives:
 * // {
 * //   orderId: 123,
 * //   steps: [{ stepNumber: 1, stepName: 'validate', data: { validated: true } }],
 * //   workflowName: 'process-order',
 * //   workflowData: { orderId: 123 }
 * // }
 *
 * @example
 * // From a scheduler (as a scheduled activity):
 * const scheduler = serviceRegistry.scheduling();
 * await scheduler.start(
 *   'workflow-run-workflow.js',
 *   {
 *     workflowName: 'daily-batch-processing',
 *     workflowData: { batchDate: new Date().toISOString() }
 *   },
 *   (status, data) => {
 *     if (status === 'completed') {
 *       console.log('Batch workflow completed:', data);
 *     }
 *   }
 * );
 */
async function run(data) {
  const startTime = Date.now();

  // Get the workflow service from the registry
  const workflow = serviceRegistry.workflow();
  const logger = serviceRegistry.logger();

  try {
    // Validate required input
    if (!data || !data.workflowName || typeof data.workflowName !== 'string') {
      throw new Error('Invalid input: workflowName is required and must be a string');
    }

    const workflowName = data.workflowName;
    const workflowData = data.workflowData || {};
    const timeout = data.timeout || 0;

    logger?.info(`[WorkflowRunWorkflow] Launching workflow: ${workflowName}`, {
      workflowName,
      hasWorkflowData: Object.keys(workflowData).length > 0,
      timeout
    });

    // Track workflow execution status
    let executionStatus = {
      status: null,
      finalData: null,
      stepsExecuted: 0,
      error: null
    };

    // Execute the workflow and collect final data
    await workflow.runWorkflow(
      workflowName,
      workflowData,
      (status) => {
        // Status callback receives updates during workflow execution
        if (status.status === 'workflow_complete') {
          executionStatus.status = 'completed';
          executionStatus.finalData = status.finalData;
          executionStatus.stepsExecuted = status.finalData?.steps?.length || 0;

          logger?.info(`[WorkflowRunWorkflow] Workflow completed: ${workflowName}`, {
            workflowName,
            stepsExecuted: executionStatus.stepsExecuted
          });
        } else if (status.status === 'step_error') {
          logger?.warn(`[WorkflowRunWorkflow] Workflow step error: ${workflowName}`, {
            workflowName,
            stepNumber: status.stepNumber,
            error: status.error?.message
          });
        }
      }
    );

    // Calculate execution time
    const executionTime = Date.now() - startTime;

    // Return success result
    const result = {
      success: true,
      workflowName,
      finalData: executionStatus.finalData,
      stepsExecuted: executionStatus.stepsExecuted,
      executionTime,
      error: null
    };

    logger?.info(`[WorkflowRunWorkflow] Activity completed successfully`, {
      workflowName,
      executionTime,
      stepsExecuted: executionStatus.stepsExecuted
    });

    return result;
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger?.error(`[WorkflowRunWorkflow] Activity failed`, {
      workflowName: data?.workflowName,
      executionTime,
      error: error.message
    });

    // Return error result
    return {
      success: false,
      workflowName: data?.workflowName || 'unknown',
      finalData: null,
      stepsExecuted: 0,
      executionTime,
      error: error.message
    };
  }
}

module.exports = {
  run
};
