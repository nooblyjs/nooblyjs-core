/**
 * @fileoverview Unit tests for the workflow service's legacy REST API.
 *
 * Mounts the memory workflow service on a bare Express application with a
 * working-service double, and exercises define/start, stats and analytics,
 * settings, definitions CRUD and execution history. Also guards route order:
 * /executions/:name/stats and /executions/:name/execution/:id must not be
 * captured by the greedy /executions/:name(*) list route.
 *
 * @author NooblyJS Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const express = require('express');
const request = require('supertest');
const EventEmitter = require('events');

const createWorkflowService = require('../../../src/workflow');

/** Waits until a predicate holds, polling on the event loop. */
async function until(predicate) {
  for (let i = 0; i < 200; i++) {
    if (await predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('Condition not met');
}

describe('Workflow routes', () => {
  // Workflow analytics is a module-level singleton bound to the first emitter
  // it sees, so every test shares one emitter.
  const eventEmitter = new EventEmitter();
  let app;
  let workflow;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const working = {
      start: jest.fn((stepPath, data, callback) => {
        setImmediate(() => callback(stepPath.includes('fail') ? 'error' : 'completed', { ran: stepPath }));
      })
    };
    workflow = createWorkflowService('memory', {
      'express-app': app,
      autoStartScheduler: false,
      dependencies: { working }
    }, eventEmitter);
  });

  afterEach(() => {
    workflow.shutdown();
  });

  /** Defines a workflow and runs it to completion through the API. */
  async function defineAndRun(name, steps = ['a.js', 'b.js']) {
    await request(app).post('/services/workflow/api/defineworkflow').send({ name, steps }).expect(200);
    const started = await request(app).post('/services/workflow/api/start').send({ name, data: { x: 1 } }).expect(200);
    await until(async () => {
      const res = await request(app).get(`/services/workflow/api/executions/${name}`);
      return res.body.executions?.[0] && res.body.executions[0].status !== 'running';
    });
    return started.body.workflowId.executionId;
  }

  it('reports status', async () => {
    const res = await request(app).get('/services/workflow/api/status').expect(200);
    expect(res.body).toBe('workflow api running');
  });

  it('requires a workflow name to define or start', async () => {
    await request(app).post('/services/workflow/api/defineworkflow').send({ steps: ['a.js'] }).expect(400);
    await request(app).post('/services/workflow/api/start').send({}).expect(400);
  });

  it('runs a workflow and reports execution history, detail and stats', async () => {
    const executionId = await defineAndRun('wf1');

    const list = await request(app).get('/services/workflow/api/executions/wf1?limit=10').expect(200);
    expect(list.body.workflowName).toBe('wf1');
    expect(list.body.executions).toHaveLength(1);

    const stats = await request(app).get('/services/workflow/api/executions/wf1/stats').expect(200);
    expect(stats.body).toEqual(expect.objectContaining({ workflowName: 'wf1', total: 1, completed: 1 }));

    const detail = await request(app).get(`/services/workflow/api/executions/wf1/execution/${executionId}`).expect(200);
    expect(detail.body.executionId).toBe(executionId);
    await request(app).get('/services/workflow/api/executions/wf1/execution/nope').expect(404);

    const deleted = await request(app).delete('/services/workflow/api/executions/wf1?status=completed').expect(200);
    expect(deleted.body.deleted).toBe(1);
  });

  it('serves stats and analytics', async () => {
    await defineAndRun('wf2');
    await until(async () => (await request(app).get('/services/workflow/api/analytics/wf2')).status === 200);
    const stats = await request(app).get('/services/workflow/api/stats').expect(200);
    expect(stats.body.total).toBeGreaterThanOrEqual(1);
    const all = await request(app).get('/services/workflow/api/analytics').expect(200);
    expect(all.body.workflows.map((w) => w.workflowName)).toContain('wf2');
    const one = await request(app).get('/services/workflow/api/analytics/wf2').expect(200);
    expect(one.body.runCount).toBe(1);
    await request(app).get('/services/workflow/api/analytics/unknown').expect(404);
  });

  it('manages definitions', async () => {
    await request(app).post('/services/workflow/api/defineworkflow').send({ name: 'd1', steps: ['a.js'] }).expect(200);
    const list = await request(app).get('/services/workflow/api/definitions').expect(200);
    expect(list.body.count).toBe(1);

    const one = await request(app).get('/services/workflow/api/definitions/d1').expect(200);
    expect(one.body.steps).toEqual(['a.js']);
    await request(app).get('/services/workflow/api/definitions/missing').expect(404);

    const updated = await request(app)
      .put('/services/workflow/api/definitions/d1')
      .send({ steps: ['b.js'], metadata: { owner: 'ops' } })
      .expect(200);
    expect(updated.body.steps).toEqual(['b.js']);
    await request(app).put('/services/workflow/api/definitions/missing').send({}).expect(404);

    await request(app).delete('/services/workflow/api/definitions/d1').expect(200);
    await request(app).delete('/services/workflow/api/definitions/d1').expect(404);
  });

  it('gets and saves settings', async () => {
    const res = await request(app).get('/services/workflow/api/settings').expect(200);
    expect(res.body.list).toEqual(expect.any(Array));
    await request(app).post('/services/workflow/api/settings').send({}).expect(200);
    jest.spyOn(workflow, 'getSettings').mockRejectedValue(new Error('x'));
    await request(app).get('/services/workflow/api/settings').expect(500);
  });

  it('hides provider failures', async () => {
    jest.spyOn(workflow, 'defineWorkflow').mockRejectedValue(new Error('internal detail'));
    jest.spyOn(workflow, 'runWorkflow').mockRejectedValue(new Error('internal detail'));
    const res = await request(app).post('/services/workflow/api/defineworkflow').send({ name: 'x', steps: ['a.js'] });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.text).not.toContain('internal detail');
    const run = await request(app).post('/services/workflow/api/start').send({ name: 'x' });
    expect(run.status).toBeGreaterThanOrEqual(400);
    expect(run.text).not.toContain('internal detail');
  });
});
