/**
 * @fileoverview Workflow Execution Container
 * Stores and manages workflow execution records with full execution history.
 * Provides storage, retrieval, filtering, and cleanup functionality for executions.
 *
 * Everything is held in memory. A consuming application that wants history to
 * survive a restart persists it itself - see {@link WorkflowExecutionContainer#export}
 * / {@link WorkflowExecutionContainer#import} and the `workflow:state:changed`
 * event raised by the workflow service.
 *
 * @author NooblyJS Core Team
 * @version 1.1.0
 */

'use strict';

const { classifyExecution } = require('../modules/executionSummary');

/** @const {!Array<string>} Outcome buckets accepted by status filters. */
const OUTCOME_BUCKETS = ['success', 'failed', 'running', 'other'];

/**
 * Converts an ISO string, Date or epoch-ms value into epoch milliseconds.
 * @param {*} value The candidate value.
 * @return {number} Epoch ms, or NaN when the value is not a date.
 * @private
 */
function toMs(value) {
  if (value === undefined || value === null || value === '') return NaN;
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

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
    /** @private {Map<string, Array<Object>>} Map of workflow names to execution arrays (newest first) */
    this.executions = new Map();

    /** @private {number} Maximum executions to retain per workflow */
    this.maxExecutionsPerWorkflow = options.maxExecutionsPerWorkflow || 1000;
  }

  /**
   * Builds a complete execution record from caller-supplied data.
   * @param {string} workflowName - Workflow name
   * @param {Object} executionData - Execution record data
   * @param {?Object} previous - The record being replaced, if any
   * @return {Object} The normalised record
   * @private
   */
  normalise_(workflowName, executionData, previous) {
    const base = previous || {};
    const merged = { ...base, ...executionData };
    const execution = {
      ...merged,
      id: merged.executionId,
      executionId: merged.executionId,
      workflowId: workflowName,
      workflowName,
      inputData: merged.inputData || null,
      outputData: merged.outputData || null,
      status: merged.status || 'unknown',
      startedAt: merged.startedAt || new Date().toISOString(),
      endedAt: merged.endedAt || null,
      duration: merged.duration || 0,
      error: merged.error || null,
      stepExecutions: merged.stepExecutions || [],
      trigger: merged.trigger || 'manual',
      scheduleId: merged.scheduleId || null,
      createdAt: base.createdAt || new Date().toISOString()
    };
    execution.completedAt = execution.endedAt;
    const bucket = classifyExecution(execution);
    execution.outcome = merged.status === 'cancelled' ? 'cancelled'
      : (bucket === 'other' ? 'unknown' : bucket);
    return execution;
  }

  /**
   * Records a new workflow execution. Recording an execution id that already
   * exists replaces that record, so a "running" placeholder written when a run
   * starts is upgraded in place by its final record.
   *
   * @param {string} workflowName - Name of the workflow
   * @param {Object} executionData - Execution record data
   * @param {string} executionData.executionId - Unique execution identifier
   * @param {*} executionData.inputData - Input data for the workflow
   * @param {*} executionData.outputData - Output data from the workflow
   * @param {string} executionData.status - Execution status (completed, running, error, cancelled)
   * @param {string} executionData.startedAt - Start timestamp
   * @param {string} executionData.endedAt - End timestamp
   * @param {number} executionData.duration - Total duration in milliseconds
   * @param {string} executionData.error - Error message if failed
   * @param {Array} executionData.stepExecutions - Individual step execution records
   * @param {string} [executionData.trigger] - What started the run (manual, api, schedule)
   * @param {string} [executionData.scheduleId] - Schedule that started the run
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

    const workflowExecutions = this.executions.get(workflowName);
    const index = workflowExecutions.findIndex(e => e.executionId === executionData.executionId);

    if (index !== -1) {
      const execution = this.normalise_(workflowName, executionData, workflowExecutions[index]);
      workflowExecutions[index] = execution;
      return execution;
    }

    const execution = this.normalise_(workflowName, executionData, null);
    workflowExecutions.unshift(execution); // Add to front for chronological order

    // Enforce max executions limit
    if (workflowExecutions.length > this.maxExecutionsPerWorkflow) {
      workflowExecutions.splice(this.maxExecutionsPerWorkflow);
    }

    return execution;
  }

  /**
   * Merges fields into an existing execution record.
   * @param {string} executionId - Execution ID
   * @param {Object} patch - Fields to merge
   * @return {?Object} The updated execution, or null if not found
   */
  update(executionId, patch) {
    const found = this.locate_(executionId);
    if (!found) return null;
    return this.record(found.workflowName, { ...found.execution, ...patch, executionId });
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
   * @return {Object} `{ executions, total, offset, limit }`
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
   * Finds an execution by id without knowing its workflow.
   * @param {string} executionId - Execution ID
   * @return {?{workflowName: string, execution: Object, index: number}}
   * @private
   */
  locate_(executionId) {
    for (const [workflowName, executions] of this.executions.entries()) {
      const index = executions.findIndex(e => e.executionId === executionId);
      if (index !== -1) return { workflowName, execution: executions[index], index };
    }
    return null;
  }

  /**
   * Retrieves a single execution by ID from any workflow.
   * @param {string} executionId - Execution ID
   * @return {Object|null} The execution or null if not found
   */
  findById(executionId) {
    const found = this.locate_(executionId);
    return found ? found.execution : null;
  }

  /**
   * Deletes a single execution by ID from any workflow.
   * @param {string} executionId - Execution ID
   * @return {boolean} True if a record was removed
   */
  deleteById(executionId) {
    const found = this.locate_(executionId);
    if (!found) return false;
    this.executions.get(found.workflowName).splice(found.index, 1);
    return true;
  }

  /**
   * Queries executions across every workflow (or one), newest first.
   *
   * @param {Object} [options] - Query options
   * @param {string|Array<string>} [options.workflowName] - Restrict to one or more workflows
   * @param {string} [options.status] - An outcome bucket (success, failed, running, other)
   *   or a raw status value (completed, error, running, cancelled)
   * @param {string|number} [options.from] - Only runs started at or after this time
   * @param {string|number} [options.to] - Only runs started at or before this time
   * @param {string} [options.scheduleId] - Only runs started by this schedule
   * @param {number} [options.limit=100] - Page size (0 = no limit)
   * @param {number} [options.offset=0] - Page offset
   * @return {{executions: Array<Object>, total: number, limit: number, offset: number}}
   */
  query(options = {}) {
    const names = options.workflowName
      ? (Array.isArray(options.workflowName) ? options.workflowName : [options.workflowName])
      : Array.from(this.executions.keys());

    const fromMs = toMs(options.from);
    const toMsValue = toMs(options.to);
    const status = options.status ? String(options.status).toLowerCase() : null;

    let all = [];
    for (const name of names) {
      const list = this.executions.get(name);
      if (list) all = all.concat(list);
    }

    all = all.filter((e) => {
      if (status) {
        if (OUTCOME_BUCKETS.includes(status)) {
          if (classifyExecution(e) !== status) return false;
        } else if (String(e.status).toLowerCase() !== status) {
          return false;
        }
      }
      if (options.scheduleId && e.scheduleId !== options.scheduleId) return false;
      const started = toMs(e.startedAt);
      if (!Number.isNaN(fromMs) && started < fromMs) return false;
      if (!Number.isNaN(toMsValue) && started > toMsValue) return false;
      return true;
    });

    all.sort((a, b) => toMs(b.startedAt) - toMs(a.startedAt));

    const offset = options.offset > 0 ? options.offset : 0;
    const limit = options.limit === 0 ? 0 : (options.limit > 0 ? options.limit : 100);
    const page = limit === 0 ? all.slice(offset) : all.slice(offset, offset + limit);

    return { executions: page, total: all.length, limit, offset };
  }

  /**
   * Aggregates outcome statistics over the executions matching a query.
   *
   * @param {Object} [options] - Same filters as {@link query} (paging is ignored)
   * @return {{total: number, succeeded: number, failed: number, running: number,
   *   other: number, averageDuration: number, successRate: number,
   *   lastExecution: ?string}}
   */
  summarize(options = {}) {
    const { executions } = this.query({ ...options, status: undefined, limit: 0, offset: 0 });
    const counts = { success: 0, failed: 0, running: 0, other: 0 };
    let durationSum = 0;
    let durationCount = 0;

    for (const e of executions) {
      const bucket = classifyExecution(e);
      counts[bucket] += 1;
      if (bucket === 'success' && e.duration) {
        durationSum += e.duration;
        durationCount += 1;
      }
    }

    const total = executions.length;
    const finished = counts.success + counts.failed;
    return {
      total,
      succeeded: counts.success,
      failed: counts.failed,
      running: counts.running,
      other: counts.other,
      averageDuration: durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
      // Runs still in flight have no verdict yet, so they don't dilute the rate.
      successRate: finished > 0 ? Math.round((counts.success / finished) * 100) : 0,
      lastExecution: executions.length ? executions[0].startedAt : null
    };
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
    // Filters combine (AND); with no filter nothing is deleted.
    let toDelete = [];

    if (options.older_than || options.status) {
      toDelete = executions;
      if (options.older_than) {
        const threshold = new Date(options.older_than).getTime();
        toDelete = toDelete.filter(e => new Date(e.startedAt).getTime() < threshold);
      }
      if (options.status) {
        toDelete = toDelete.filter(e => e.status === options.status);
      }
    }

    // Remove deleted executions
    const toDeleteIds = new Set(toDelete.map(e => e.executionId));
    const filtered = executions.filter(e => !toDeleteIds.has(e.executionId));

    this.executions.set(workflowName, filtered);

    return beforeLength - filtered.length;
  }

  /**
   * Removes finished executions started before a cut-off, across every
   * workflow (or one). Runs still in flight are always kept.
   *
   * @param {?(string|number)} before - Cut-off time; null/undefined clears everything
   * @param {string} [workflowName] - Restrict to one workflow
   * @return {number} Number of deleted executions
   */
  deleteBefore(before, workflowName) {
    const cutoff = toMs(before);
    const names = workflowName ? [workflowName] : Array.from(this.executions.keys());
    let deleted = 0;

    for (const name of names) {
      const list = this.executions.get(name);
      if (!list) continue;
      const kept = list.filter((e) => {
        if (classifyExecution(e) === 'running') return true;
        return !Number.isNaN(cutoff) && toMs(e.startedAt) >= cutoff;
      });
      deleted += list.length - kept.length;
      this.executions.set(name, kept);
    }

    return deleted;
  }

  /**
   * Moves a workflow's history to a new workflow name.
   * @param {string} oldName - Current workflow name
   * @param {string} newName - New workflow name
   */
  rename(oldName, newName) {
    const list = this.executions.get(oldName);
    if (!list) return;
    this.executions.delete(oldName);
    const moved = list.map(e => ({ ...e, workflowName: newName, workflowId: newName }));
    this.executions.set(newName, moved.concat(this.executions.get(newName) || []));
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
   * Imports executions from JSON-compatible format. Imported records are
   * normalised so history written by older versions gains the fields the
   * list views rely on.
   * @param {Object} data - Executions to import, keyed by workflow name
   */
  import(data) {
    if (typeof data !== 'object' || data === null) {
      throw new Error('Import data must be a valid object');
    }

    Object.entries(data).forEach(([workflowName, executions]) => {
      if (Array.isArray(executions)) {
        const normalised = executions
          .filter(e => e && e.executionId)
          .map(e => this.normalise_(workflowName, e, { createdAt: e.createdAt }))
          .sort((a, b) => toMs(b.startedAt) - toMs(a.startedAt))
          .slice(0, this.maxExecutionsPerWorkflow);
        this.executions.set(workflowName, normalised);
      }
    });
  }
}

module.exports = WorkflowExecutionContainer;
