/**
 * @fileoverview Workflow Execution Container
 * Stores and manages workflow execution records with full execution history.
 * Provides storage, retrieval, filtering, and cleanup functionality for executions.
 *
 * @author Digital Technologies Core Team
 * @version 1.0.0
 */

'use strict';

/**
 * WorkflowExecutionContainer - Manages workflow execution records
 * Stores execution history with detailed metadata, status tracking, timing data,
 * input/output data, and error information for complete execution traceability.
 */
class WorkflowExecutionContainer {
  /**
   * Creates a new WorkflowExecutionContainer instance.
   * @param {Object} options - Configuration options
   * @param {number} options.maxExecutionsPerWorkflow - Max executions to keep per workflow (default: 1000)
   */
  constructor(options = {}) {
    /** @private {Map<string, Array<Object>>} Map of workflow names to execution arrays */
    this.executions = new Map();

    /** @private {number} Maximum executions to retain per workflow */
    this.maxExecutionsPerWorkflow = options.maxExecutionsPerWorkflow || 1000;
  }

  /**
   * Records a new workflow execution.
   * @param {string} workflowName - Name of the workflow
   * @param {Object} executionData - Execution record data
   * @param {string} executionData.executionId - Unique execution identifier
   * @param {*} executionData.inputData - Input data for the workflow
   * @param {*} executionData.outputData - Output data from the workflow
   * @param {string} executionData.status - Execution status (completed, running, error)
   * @param {number} executionData.startedAt - Start timestamp
   * @param {number} executionData.endedAt - End timestamp
   * @param {number} executionData.duration - Total duration in milliseconds
   * @param {string} executionData.error - Error message if failed
   * @param {Array} executionData.stepExecutions - Individual step execution records
   * @return {Object} The recorded execution
   */
  record(workflowName, executionData) {
    if (!workflowName || typeof workflowName !== 'string') {
      throw new Error('Workflow name must be a non-empty string');
    }

    if (!executionData || typeof executionData !== 'object') {
      throw new Error('Execution data must be a valid object');
    }

    if (!executionData.executionId) {
      throw new Error('Execution ID is required');
    }

    // Ensure executions array exists for this workflow
    if (!this.executions.has(workflowName)) {
      this.executions.set(workflowName, []);
    }

    // Create complete execution record
    const execution = {
      executionId: executionData.executionId,
      workflowName,
      inputData: executionData.inputData || null,
      outputData: executionData.outputData || null,
      status: executionData.status || 'unknown',
      startedAt: executionData.startedAt || new Date().toISOString(),
      endedAt: executionData.endedAt || null,
      duration: executionData.duration || 0,
      error: executionData.error || null,
      stepExecutions: executionData.stepExecutions || [],
      createdAt: new Date().toISOString()
    };

    // Add to executions
    const workflowExecutions = this.executions.get(workflowName);
    workflowExecutions.unshift(execution); // Add to front for chronological order

    // Enforce max executions limit
    if (workflowExecutions.length > this.maxExecutionsPerWorkflow) {
      workflowExecutions.splice(this.maxExecutionsPerWorkflow);
    }

    return execution;
  }

  /**
   * Records a step execution within a workflow execution.
   * @param {string} workflowName - Workflow name
   * @param {string} executionId - Workflow execution ID
   * @param {Object} stepData - Step execution data
   * @return {Object} Updated execution
   */
  recordStep(workflowName, executionId, stepData) {
    const executions = this.executions.get(workflowName);
    if (!executions) {
      throw new Error(`No executions found for workflow '${workflowName}'`);
    }

    const execution = executions.find(e => e.executionId === executionId);
    if (!execution) {
      throw new Error(`Execution '${executionId}' not found`);
    }

    if (!execution.stepExecutions) {
      execution.stepExecutions = [];
    }

    const stepExecution = {
      stepName: stepData.stepName || '',
      stepPath: stepData.stepPath || '',
      inputData: stepData.inputData || null,
      outputData: stepData.outputData || null,
      status: stepData.status || 'unknown',
      startedAt: stepData.startedAt || new Date().toISOString(),
      endedAt: stepData.endedAt || null,
      duration: stepData.duration || 0,
      error: stepData.error || null
    };

    execution.stepExecutions.push(stepExecution);
    return execution;
  }

  /**
   * Retrieves all executions for a workflow.
   * @param {string} workflowName - Workflow name
   * @param {Object} options - Filter/sort options
   * @param {string} options.status - Filter by status
   * @param {number} options.limit - Limit number of results
   * @param {number} options.offset - Offset for pagination
   * @param {string} options.sortBy - Sort field (default: startedAt)
   * @param {string} options.sortOrder - Sort order (asc/desc, default: desc)
   * @return {Array<Object>} Array of executions
   */
  getExecutions(workflowName, options = {}) {
    const executions = this.executions.get(workflowName) || [];

    let filtered = executions.slice();

    // Filter by status
    if (options.status) {
      filtered = filtered.filter(e => e.status === options.status);
    }

    // Sort
    const sortBy = options.sortBy || 'startedAt';
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal < bVal) return -sortOrder;
      if (aVal > bVal) return sortOrder;
      return 0;
    });

    // Pagination
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      executions: paginated,
      total: filtered.length,
      offset,
      limit
    };
  }

  /**
   * Retrieves a single execution by ID.
   * @param {string} workflowName - Workflow name
   * @param {string} executionId - Execution ID
   * @return {Object|null} The execution or null if not found
   */
  getExecution(workflowName, executionId) {
    const executions = this.executions.get(workflowName) || [];
    return executions.find(e => e.executionId === executionId) || null;
  }

  /**
   * Gets execution statistics for a workflow.
   * @param {string} workflowName - Workflow name
   * @return {Object} Statistics object
   */
  getStats(workflowName) {
    const executions = this.executions.get(workflowName) || [];

    if (executions.length === 0) {
      return {
        total: 0,
        completed: 0,
        running: 0,
        error: 0,
        averageDuration: 0,
        lastExecution: null
      };
    }

    const stats = {
      total: executions.length,
      completed: 0,
      running: 0,
      error: 0,
      averageDuration: 0,
      lastExecution: executions[0].startedAt
    };

    let totalDuration = 0;
    let durationCount = 0;

    executions.forEach(exec => {
      if (exec.status === 'completed') {
        stats.completed++;
        if (exec.duration) {
          totalDuration += exec.duration;
          durationCount++;
        }
      } else if (exec.status === 'running') {
        stats.running++;
      } else if (exec.status === 'error') {
        stats.error++;
      }
    });

    stats.averageDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

    return stats;
  }

  /**
   * Deletes executions for a workflow.
   * @param {string} workflowName - Workflow name
   * @param {Object} options - Deletion criteria
   * @param {string} options.older_than - ISO timestamp, delete older than this
   * @param {string} options.status - Delete only this status
   * @return {number} Number of deleted executions
   */
  deleteExecutions(workflowName, options = {}) {
    const executions = this.executions.get(workflowName);
    if (!executions) {
      return 0;
    }

    const beforeLength = executions.length;
    let toDelete = [];

    if (options.older_than) {
      const threshold = new Date(options.older_than).getTime();
      toDelete = executions.filter(e => new Date(e.startedAt).getTime() < threshold);
    }

    if (options.status) {
      toDelete = toDelete.length > 0
        ? toDelete.filter(e => e.status === options.status)
        : executions.filter(e => e.status === options.status);
    }

    // Remove deleted executions
    const toDeleteIds = new Set(toDelete.map(e => e.executionId));
    const filtered = executions.filter(e => !toDeleteIds.has(e.executionId));

    this.executions.set(workflowName, filtered);

    return beforeLength - filtered.length;
  }

  /**
   * Gets all executions across all workflows.
   * @param {Object} options - Filter options
   * @return {Array<Object>} All executions
   */
  getAllExecutions(options = {}) {
    let all = [];
    this.executions.forEach((executions, workflowName) => {
      all = all.concat(executions.map(exec => ({
        ...exec,
        workflowName
      })));
    });

    // Sort by startedAt descending
    all.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

    // Apply limit
    if (options.limit) {
      all = all.slice(0, options.limit);
    }

    return all;
  }

  /**
   * Returns count of executions for a workflow.
   * @param {string} workflowName - Workflow name
   * @return {number} Number of executions
   */
  count(workflowName) {
    return (this.executions.get(workflowName) || []).length;
  }

  /**
   * Clears all executions for a workflow.
   * @param {string} workflowName - Workflow name
   */
  clear(workflowName) {
    this.executions.delete(workflowName);
  }

  /**
   * Clears all executions across all workflows.
   */
  clearAll() {
    this.executions.clear();
  }

  /**
   * Exports executions to JSON-compatible format.
   * @param {string} workflowName - Workflow name (optional)
   * @return {Object} Executions as plain object
   */
  export(workflowName) {
    if (workflowName) {
      return {
        [workflowName]: this.executions.get(workflowName) || []
      };
    }

    const exported = {};
    this.executions.forEach((executions, name) => {
      exported[name] = executions;
    });
    return exported;
  }

  /**
   * Imports executions from JSON-compatible format.
   * @param {Object} data - Executions to import
   */
  import(data) {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Import data must be a valid object');
    }

    Object.entries(data).forEach(([workflowName, executions]) => {
      if (Array.isArray(executions)) {
        this.executions.set(workflowName, executions);
      }
    });
  }
}

module.exports = WorkflowExecutionContainer;
