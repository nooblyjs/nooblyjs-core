/**
 * @fileoverview NooblyJS Core - Appservice App Route Base Class
 * This base class creates all the underlying code needed to set up routes
 */
'use strict';

const appBase = require('./appBase.js');

/**
 * This base class will create the boiler plate code for a view class
 */
class appRouteBase extends appBase {

  constructor(type, options, eventEmitter) {
    super(type, options, eventEmitter);

    // Normalise out base url
    this.baseUrl = options.baseUrl
    if (!options.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl + '/';
    }

  };
}
module.exports = appRouteBase;