/**
 * @fileoverview Noobly JS Core workflow Client Library
 * A client-side JavaScript library for interacting with the Noobly JS Core workflow service.
 * This library provides a simple, intuitive API for workflow operations from web applications.
 * Includes both remote (server-side) and local (client-side) workflow implementations.
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.15
 *
 * @example
 * // Include the library in your HTML
 * <script src="/services/workflow/scripts"></script>
 *
 * // Create a local workflow instance (client-side only)
 * const localworkflow = new digitalTechnologiesworkflow();
 *
 * // Create a remote workflow instance (server-side)
 * const remoteworkflow = new digitalTechnologiesworkflow({ instanceName: 'default' });
 *
 * // Store data in workflow
 * localworkflow.put('user:123', { name: 'John', age: 30 });
 * remoteworkflow.put('user:456', { name: 'Jane', age: 25 });
 *
 * // Retrieve data from workflow
 * localworkflow.get('user:123').then(data => {
 *   console.log(data); // { name: 'John', age: 30 }
 * });
 *
 * // Delete data from workflow
 * localworkflow.delete('user:123');
 *
 * // Check if key exists
 * localworkflow.exists('user:123').then(exists => {
 *   console.log(exists); // true or false
 * });
 */

(function(global) {
  'use strict';


})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
