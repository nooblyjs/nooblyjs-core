/**
 * @fileoverview NooblyJS Core - Structuring
 * This enabler looks for a expected structure that will accelerate some development
 */
'use strict';

const appBase = require('./appBase.js');

/**
 * This base class will create the boiler plate code for a view class
 */
class appViewBase extends appBase {

  constructor(type, options, eventEmitter) {
    super(type, options, eventEmitter);

    // Normalise out base url
    this.baseUrl = options.baseUrl
    if (!options.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl + '/';
    }

  };
}
module.exports = appViewBase;