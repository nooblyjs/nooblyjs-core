/**
 * @fileoverview UIService Index - Main entry point
 * Loads the UIService class for browser applications
 * Ensures UIService is available globally for all applications
 * @version 1.0.0
 */

'use strict';

// Load the main UIService module
// The file is served as a static asset at /services/uiservice/js/
// This index.js acts as the main entry point and ensures uiservice.js is loaded

(function loadUIService() {
  // If UIService is already available globally, we're done
  if (typeof window !== 'undefined' && window.UIService) {
    return;
  }

  // Otherwise, load the uiservice.js file
  const script = document.createElement('script');
  script.src = '/services/uiservice/js/uiservice.js';
  script.onload = function() {
    // Dispatch event to notify that UIService is loaded
    const event = new Event('UIServiceLoaded');
    document.dispatchEvent(event);
  };
  script.onerror = function() {
    console.error('Failed to load UIService from /services/uiservice/js/uiservice.js');
  };
  document.head.appendChild(script);
})();
