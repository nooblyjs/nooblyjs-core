/**
 * @fileoverview Settings service scripts module for nooblyjs-core.
 * Serves the client-side settings console library so consuming applications can
 * mount a fully featured settings panel into any container element.
 *
 * @author NooblyJS
 * @version 1.0.0
 * @since 1.0.0
 * @module SettingsScripts
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Registers the settings client library endpoint with the Express application.
 *
 * The library is served from two paths so consumers can use either convention
 * already present in the framework:
 *   - `/services/settings/scripts`            (explicit endpoint, as filing does)
 *   - `/services/settings/scripts/js/index.js` (static path, mounted in views)
 *
 * @function
 * @param {Object} options - Configuration options for the scripts setup
 * @param {express.Application} options.express-app - The Express application instance
 * @param {Object} eventEmitter - Event emitter for inter-service communication
 * @param {Object} settings - The settings service provider instance
 * @return {void}
 *
 * @example
 * // Include in a consuming application:
 * // <script src="/services/settings/scripts"></script>
 * //
 * // const panel = new SettingsUIManager({ containerId: 'settingsPanel' });
 * // panel.initialize();
 */
module.exports = (options, eventEmitter, settings) => {
  if (!options['express-app']) return;

  const app = options['express-app'];

  /**
   * GET /services/settings/scripts
   * Serves the client-side settings console library as JavaScript.
   *
   * @param {express.Request} req - Express request object
   * @param {express.Response} res - Express response object
   * @return {void}
   */
  app.get('/services/settings/scripts', (req, res) => {
    try {
      const libraryPath = path.join(__dirname, './js/index.js');
      const libraryCode = fs.readFileSync(libraryPath, 'utf8');

      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      res.status(200).send(libraryCode);
    } catch (error) {
      eventEmitter.emit('api-settings-scripts-error', error.message);
      res.status(500).json({ error: 'Failed to load settings library' });
    }
  });

  // Raise an event advising that the script library has loaded
  eventEmitter.emit('settings:loading scripts', {
    folder: path.join(__dirname),
  });
};
