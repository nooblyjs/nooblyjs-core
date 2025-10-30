/**
 * @fileoverview NooblyJS Core - Structuring
 * This enabler looks for a expected structure that will accelerate some development
 */
'use strict';

const appBase = require('./appBase.js');

/**
 * This base class will create the boiler plate code for a view class
 */
class appDataBase extends appBase {

  constructor(type, options, eventEmitter) {
    super(type, options, eventEmitter);
  };
}
module.exports = appDataBase;