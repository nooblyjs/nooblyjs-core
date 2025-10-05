/**
 * @fileoverview Load test for dataservice service performance.
 * 
 * This load test measures the performance of data serving operations including
 * container creation, data addition, and search operations across different
 * dataservice providers (memory, file, SimpleDB). Tests help evaluate data
 * handling performance and scalability.
 * 
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.0
 */

'use strict';

const createDataServiceService = require('../../../src/dataservice');
const EventEmitter = require('events');

/**
 * Executes load test for dataservice service performance.
 * 
 * Runs a series of data operations including container creation, data addition,
 * and search operations to measure performance characteristics under load.
 * 
 * @async
 * @function runDataServiceLoadTest
 * @param {number} iterations - Number of data operations to perform
 * @param {string} [dataserviceType='memory'] - Type of dataservice provider to test
 * @param {Object} [options={}] - Configuration options for the dataservice provider
 * @returns {Promise<Object>} Test results including service, type, iterations, and duration
 */
async function runDataServiceLoadTest(
  iterations,
  dataserviceType = 'memory',
  options = {},
) {
  const eventEmitter = new EventEmitter();
  const dataservice = createDataServiceService(
    dataserviceType,
    options,
    eventEmitter,
  );
  const containerName = 'loadTestContainer';

  const startTime = Date.now();
  console.log(
    `Starting DataService Load Test (${dataserviceType} dataservice) for ${iterations} iterations...`,
  );

  try {
    await dataservice.createContainer(containerName);
  } catch (e) {
    // Container might already exist in file-based or simpledb
  }

  for (let i = 0; i < iterations; i++) {
    const data = { id: i, value: `data-${i}-${Math.random()}` };
    const key = await dataservice.add(containerName, data);
    await dataservice.find(containerName, `data-${i}`);
    // await dataservice.remove(containerName, key); // Optional: if you want to test removal load
    if (i % 1000 === 0) {
      // console.log(`DataService iteration ${i}`);
    }
  }

  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(
    `DataService Load Test Completed: ${iterations} operations in ${duration} ms.`,
  );
  return { service: 'dataservice', type: dataserviceType, iterations, duration };
}

module.exports = runDataServiceLoadTest;
