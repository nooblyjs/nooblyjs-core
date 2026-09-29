/**
 * @fileoverview Unit tests for WorkflowExecutionContainer: recording and
 * updating runs, step history, pagination and querying, summaries and
 * stats, deletion (including combined older_than + status filters),
 * rename, export/import and the per-workflow history cap.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const WorkflowExecutionContainer = require('../../../src/workflow/containers/WorkflowExecutionContainer');

const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60000).toISOString();

describe('WorkflowExecutionContainer', () => {
  let container;

  beforeEach(() => {
    container = new WorkflowExecutionContainer({ maxExecutionsPerWorkflow: 5 });
    container.record('wf', { executionId: 'e1', status: 'completed', startedAt: iso(30), duration: 100 });
    container.record('wf', { executionId: 'e2', status: 'error', startedAt: iso(20) });
    container.record('wf', { executionId: 'e3', status: 'running', startedAt: iso(10), scheduleId: 's1' });
    container.record('other', { executionId: 'o1', status: 'completed', startedAt: iso(5), duration: 300 });
  });

  it('validates records', () => {
    expect(() => container.record('', {})).toThrow('Workflow name');
    expect(() => container.record('wf', null)).toThrow('Execution data');
    expect(() => container.record('wf', {})).toThrow('Execution ID is required');
  });

  it('normalises records and merges updates into existing runs', () => {
    const e1 = container.getExecution('wf', 'e1');
    expect(e1).toEqual(expect.objectContaining({ id: 'e1', workflowId: 'wf', trigger: 'manual', outcome: 'success' }));
    container.record('wf', { executionId: 'e1', endedAt: iso(29) });
    expect(container.getExecution('wf', 'e1').completedAt).toEqual(expect.any(String));
    expect(container.update('e3', { status: 'cancelled' }).outcome).toBe('cancelled');
    expect(container.update('nope', {})).toBeNull();
    expect(container.getExecution('wf', 'nope')).toBeNull();
  });

  it('records step executions', () => {
    const run = container.recordStep('wf', 'e3', { stepName: 'a', status: 'completed' });
    expect(run.stepExecutions).toEqual([expect.objectContaining({ stepName: 'a', status: 'completed', duration: 0 })]);
    expect(() => container.recordStep('none', 'e3', {})).toThrow("No executions found for workflow 'none'");
    expect(() => container.recordStep('wf', 'missing', {})).toThrow("Execution 'missing' not found");
  });

  it('paginates, filters and sorts executions', () => {
    const page = container.getExecutions('wf', { limit: 2, offset: 0 });
    expect(page.executions.map((e) => e.executionId)).toEqual(['e3', 'e2']);
    expect(page.total).toBe(3);
    const asc = container.getExecutions('wf', { sortOrder: 'asc', status: 'completed' });
    expect(asc.executions.map((e) => e.executionId)).toEqual(['e1']);
    expect(container.getExecutions('none').total).toBe(0);
  });

  it('queries across workflows by outcome, status, schedule and time', () => {
    expect(container.query().total).toBe(4);
    expect(container.query({ workflowName: ['wf', 'other'], status: 'success' }).executions.map((e) => e.executionId)).toEqual(['o1', 'e1']);
    expect(container.query({ status: 'running' }).total).toBe(1);
    expect(container.query({ status: 'error' }).total).toBe(1);
    expect(container.query({ scheduleId: 's1' }).total).toBe(1);
    expect(container.query({ from: iso(15), to: iso(1) }).total).toBe(2);
    expect(container.query({ limit: 0, offset: 1 }).executions).toHaveLength(3);
  });

  it('summarises and reports stats', () => {
    expect(container.summarize()).toEqual(expect.objectContaining({
      total: 4, succeeded: 2, failed: 1, running: 1, averageDuration: 200, successRate: 67
    }));
    expect(container.getStats('wf')).toEqual(expect.objectContaining({ total: 3, completed: 1, running: 1, error: 1, averageDuration: 100 }));
    expect(container.getStats('none')).toEqual(expect.objectContaining({ total: 0, lastExecution: null }));
    expect(container.summarize({ workflowName: 'none' }).successRate).toBe(0);
  });

  it('combines older_than and status when deleting', () => {
    // Only e2 is an error run, and it is newer than the cut-off, so nothing
    // may be deleted (previously every error run was).
    expect(container.deleteExecutions('wf', { older_than: iso(25), status: 'error' })).toBe(0);
    expect(container.deleteExecutions('wf', { older_than: iso(25), status: 'completed' })).toBe(1);
    expect(container.deleteExecutions('wf', { status: 'error' })).toBe(1);
    expect(container.deleteExecutions('wf', {})).toBe(0);
    expect(container.deleteExecutions('none', { status: 'error' })).toBe(0);
    expect(container.count('wf')).toBe(1);
  });

  it('deletes by id and before a cut-off, keeping running runs', () => {
    expect(container.findById('o1').workflowName).toBe('other');
    expect(container.findById('nope')).toBeNull();
    expect(container.deleteById('o1')).toBe(true);
    expect(container.deleteById('o1')).toBe(false);
    expect(container.deleteBefore(new Date().toISOString())).toBe(2);
    expect(container.count('wf')).toBe(1);
    expect(container.deleteBefore(new Date().toISOString(), 'none')).toBe(0);
  });

  it('renames, exports, imports and clears', () => {
    container.rename('wf', 'renamed');
    container.rename('missing', 'x');
    expect(container.count('renamed')).toBe(3);
    expect(container.getAllExecutions({ limit: 2 })).toHaveLength(2);

    const exported = container.export();
    expect(Object.keys(exported).sort()).toEqual(['other', 'renamed']);
    expect(container.export('renamed').renamed).toHaveLength(3);

    const copy = new WorkflowExecutionContainer({ maxExecutionsPerWorkflow: 2 });
    copy.import({ ...exported, bad: 'not an array', partial: [{ executionId: 'p' }, { nope: 1 }] });
    expect(copy.count('renamed')).toBe(2);
    expect(copy.count('partial')).toBe(1);
    expect(() => copy.import(null)).toThrow('Import data must be a valid object');

    container.clear('other');
    expect(container.count('other')).toBe(0);
    container.clearAll();
    expect(container.getAllExecutions()).toEqual([]);
  });

  it('caps history per workflow', () => {
    for (let i = 0; i < 10; i++) container.record('capped', { executionId: `c${i}` });
    expect(container.count('capped')).toBe(5);
    expect(container.getExecution('capped', 'c9')).not.toBeNull();
  });
});
