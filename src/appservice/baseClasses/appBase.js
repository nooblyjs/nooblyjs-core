/**
 * @fileoverview NooblyJS Core - Appservice Base Class
 * This enabler looks for a expected structure that will accelerate some development
 */
'use strict';

class appBase {

  constructor(type, options, eventEmitter)   {
      this.app = options['express-app'];
      this.options = options;
      this.eventEmitter = eventEmitter;
  };
}
module.exports = appBase;