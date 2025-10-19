/**
 * @fileoverview Worker runner for executing individual workflow steps
 * in separate worker threads with error handling and result communication.
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const { parentPort, workerData } = require('worker_threads');

/**
 * Settings for workflow worker runner
 */
const settings = {};
settings.description = "Configuration settings for the Workflow Worker Runner";
settings.list = [
  {setting: "executionTimeout", type: "number", values: [300000]},
  {setting: "maxRetries", type: "number", values: [3]},
  {setting: "memoryLimit", type: "number", values: [512]}
];
settings.executionTimeout = workerData?.executionTimeout || settings.list[0].values[0];
settings.maxRetries = workerData?.maxRetries || settings.list[1].values[0];
settings.memoryLimit = workerData?.memoryLimit || settings.list[2].values[0];

/**
 * Executes a workflow step in a worker thread.
 * Loads and runs the specified step module with provided data.
 * @return {Promise<void>} A promise that resolves when the step execution is complete.
 */
async function runStep() {
  const { stepPath, data } = workerData;
  try {
    // Dynamically require the step file and execute its default export
    const stepModule = require(stepPath);
    const result = await stepModule(data);
    parentPort.postMessage({ type: 'result', data: result });
  } catch (error) {
    parentPort.postMessage({ type: 'error', error: error.message });
  }
}

/**
 * Get all settings
 */
async function getSettings(){
  return settings;
}

/**
 * Save/update settings
 */
async function saveSettings(newSettings){
  for (let i = 0; i < settings.list.length; i++){
    if (newSettings[settings.list[i].setting] != null){
      settings[settings.list[i].setting] = newSettings[settings.list[i].setting];
      console.log(settings.list[i].setting + ' changed to: ' + newSettings[settings.list[i].setting]);
    }
  }
}

runStep();
