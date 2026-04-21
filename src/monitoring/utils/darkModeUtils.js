/**
 * @fileoverview Dark Mode Utilities
 * Theme management and dark mode support for UI dashboards
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Theme Manager for coordinating dark/light mode across application.
 * @class
 */
class ThemeManager {
  /**
   * Create a new theme manager.
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.storageKey='app-theme'] - localStorage key for theme
   * @param {string} [options.defaultTheme='light'] - Default theme (light|dark|auto)
   */
  constructor(options = {}) {
    this.storageKey = options.storageKey || 'app-theme';
    this.defaultTheme = options.defaultTheme || 'auto';
    this.currentTheme = null;
    this.listeners = new Set();
    this.darkModeQuery = null;
    this._initializeTheme();
  }

  /**
   * Initialize theme based on system preference or saved preference.
   * @private
   */
  _initializeTheme() {
    // Try to load saved preference
    const saved = this._getSavedTheme();
    if (saved && (saved === 'light' || saved === 'dark')) {
      this.currentTheme = saved;
    } else {
      // Use default or system preference
      if (this.defaultTheme === 'auto') {
        this.currentTheme = this._getSystemTheme();
      } else {
        this.currentTheme = this.defaultTheme;
      }
    }

    // Set up system theme watcher for auto mode
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.darkModeQuery.addListener(() => {
        if (this._getSavedTheme() === 'auto') {
          this._notifyListeners();
        }
      });
    }
  }

  /**
   * Get system color scheme preference.
   * @private
   * @return {string} 'dark' or 'light'
   */
  _getSystemTheme() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  /**
   * Get saved theme preference from localStorage.
   * @private
   * @return {string|null} Saved theme or null
   */
  _getSavedTheme() {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(this.storageKey);
  }

  /**
   * Save theme preference to localStorage.
   * @private
   * @param {string} theme - Theme to save ('light', 'dark', or 'auto')
   */
  _saveTheme(theme) {
    if (typeof localStorage !== 'undefined') {
      if (theme === 'auto') {
        localStorage.removeItem(this.storageKey);
      } else {
        localStorage.setItem(this.storageKey, theme);
      }
    }
  }

  /**
   * Notify all listeners of theme change.
   * @private
   */
  _notifyListeners() {
    this.listeners.forEach(listener => {
      listener({ theme: this.getTheme(), isDark: this.isDark() });
    });
  }

  /**
   * Set the current theme.
   * @param {string} theme - Theme to set ('light' or 'dark')
   */
  setTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      this.currentTheme = theme;
      this._saveTheme(theme);
      this._notifyListeners();

      // Update DOM
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.classList.toggle('dark-mode', theme === 'dark');
      }
    }
  }

  /**
   * Toggle between light and dark theme.
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  /**
   * Get current theme.
   * @return {string} Current theme ('light' or 'dark')
   */
  getTheme() {
    if (this.currentTheme === 'auto') {
      return this._getSystemTheme();
    }
    return this.currentTheme;
  }

  /**
   * Check if dark mode is currently active.
   * @return {boolean} True if dark mode is active
   */
  isDark() {
    return this.getTheme() === 'dark';
  }

  /**
   * Check if light mode is currently active.
   * @return {boolean} True if light mode is active
   */
  isLight() {
    return this.getTheme() === 'light';
  }

  /**
   * Subscribe to theme changes.
   * @param {Function} listener - Callback function to call on theme change
   * @return {Function} Unsubscribe function
   */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get theme-aware CSS variables.
   * @return {Object} CSS variable definitions
   */
  getCSSVariables() {
    const isDark = this.isDark();
    return {
      '--color-bg': isDark ? '#1a1a1a' : '#ffffff',
      '--color-bg-secondary': isDark ? '#2d2d2d' : '#f5f5f5',
      '--color-bg-tertiary': isDark ? '#3a3a3a' : '#eeeeee',
      '--color-text': isDark ? '#e0e0e0' : '#333333',
      '--color-text-secondary': isDark ? '#a0a0a0' : '#666666',
      '--color-text-tertiary': isDark ? '#808080' : '#999999',
      '--color-border': isDark ? '#444444' : '#cccccc',
      '--color-border-light': isDark ? '#333333' : '#dddddd',
      '--color-accent': isDark ? '#4a9eff' : '#0066cc',
      '--color-success': isDark ? '#4caf50' : '#28a745',
      '--color-warning': isDark ? '#ff9800' : '#ffc107',
      '--color-danger': isDark ? '#f44336' : '#dc3545',
      '--color-info': isDark ? '#2196f3' : '#17a2b8',
      '--shadow': isDark ? '0 2px 8px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.1)'
    };
  }

  /**
   * Apply theme to document.
   */
  applyTheme() {
    if (typeof document === 'undefined') {
      return;
    }

    const theme = this.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark-mode', theme === 'dark');

    // Apply CSS variables
    const variables = this.getCSSVariables();
    Object.entries(variables).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }

  /**
   * Get saved user preference.
   * @return {string} Saved preference ('light', 'dark', or null if not set)
   */
  getSavedPreference() {
    return this._getSavedTheme();
  }

  /**
   * Export theme configuration.
   * @return {Object} Theme configuration state
   */
  export() {
    return {
      currentTheme: this.currentTheme,
      savedPreference: this._getSavedTheme(),
      isDark: this.isDark(),
      systemPreference: this._getSystemTheme(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Reset theme to default.
   */
  reset() {
    this._saveTheme('auto');
    this.currentTheme = this.defaultTheme;
    this._notifyListeners();
  }
}

module.exports = ThemeManager;
