/**
 * @fileoverview Monitoring Service Views Configuration
 * Registers the monitoring service UI dashboard
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

const path = require('node:path');

/**
 * Configure views for the monitoring service.
 * Serves the monitoring dashboard UI.
 *
 * @param {Object} options - Configuration options
 * @param {Object} options['express-app'] - Express application instance
 * @param {EventEmitter} eventEmitter - Event emitter
 * @param {Object} logger - Logger instance
 * @return {void}
 */
module.exports = (options, eventEmitter, logger) => {
  if (!options['express-app']) {
    logger?.warn('[MonitoringViews] Express app not provided, skipping view setup');
    return;
  }

  const app = options['express-app'];

  // Serve monitoring dashboard at /services/monitoring/
  app.get('/services/monitoring', (req, res) => {
    try {
      res.sendFile(path.join(__dirname, 'index.html'));
    } catch (error) {
      logger?.error('[MonitoringViews] Failed to serve monitoring dashboard', {
        error: error.message
      });
      res.status(500).json({ error: 'Failed to load monitoring dashboard' });
    }
  });

  logger?.info('[MonitoringViews] Monitoring service views configured');
};
