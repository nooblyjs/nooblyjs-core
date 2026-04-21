/**
 * @fileoverview Tests for Dark Mode Utilities
 */

'use strict';

const ThemeManager = require('../../../src/monitoring/utils/darkModeUtils');

describe('ThemeManager', () => {
  let manager;
  let mockLocalStorage;
  let mockMatchMedia;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      data: {},
      getItem: jest.fn((key) => mockLocalStorage.data[key] || null),
      setItem: jest.fn((key, value) => {
        mockLocalStorage.data[key] = value;
      }),
      removeItem: jest.fn((key) => {
        delete mockLocalStorage.data[key];
      }),
      clear: jest.fn(() => {
        mockLocalStorage.data = {};
      })
    };

    // Mock matchMedia
    mockMatchMedia = jest.fn((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      addListener: jest.fn()
    }));

    // Set up global mocks
    global.localStorage = mockLocalStorage;
    global.window = { matchMedia: mockMatchMedia };
    global.document = { documentElement: { setAttribute: jest.fn(), classList: { toggle: jest.fn() }, style: { setProperty: jest.fn() } } };

    manager = new ThemeManager({ defaultTheme: 'light' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create theme manager', () => {
      expect(manager).toBeDefined();
      expect(typeof manager.setTheme).toBe('function');
    });

    it('should use default theme on init', () => {
      const m = new ThemeManager({ defaultTheme: 'dark' });
      expect(m.currentTheme).toBe('dark');
    });

    it('should load saved preference from storage', () => {
      mockLocalStorage.setItem('app-theme', 'dark');
      const m = new ThemeManager({ defaultTheme: 'light' });
      expect(m.currentTheme).toBe('dark');
    });

    it('should detect system preference in auto mode', () => {
      mockMatchMedia.mockReturnValue({ matches: true, addListener: jest.fn() });
      const m = new ThemeManager({ defaultTheme: 'auto' });
      expect(m._getSystemTheme()).toBe('dark');
    });
  });

  describe('setTheme', () => {
    it('should set light theme', () => {
      manager.setTheme('light');
      expect(manager.currentTheme).toBe('light');
    });

    it('should set dark theme', () => {
      manager.setTheme('dark');
      expect(manager.currentTheme).toBe('dark');
    });

    it('should save preference to storage', () => {
      manager.setTheme('dark');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('app-theme', 'dark');
    });

    it('should update DOM attribute', () => {
      manager.setTheme('dark');
      expect(global.document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should toggle dark-mode class', () => {
      manager.setTheme('dark');
      expect(global.document.documentElement.classList.toggle).toHaveBeenCalled();
    });

    it('should notify listeners on theme change', () => {
      const listener = jest.fn();
      manager.onChange(listener);

      manager.setTheme('dark');

      expect(listener).toHaveBeenCalledWith({
        theme: 'dark',
        isDark: true
      });
    });
  });

  describe('toggleTheme', () => {
    it('should switch from light to dark', () => {
      manager.setTheme('light');
      manager.toggleTheme();
      expect(manager.currentTheme).toBe('dark');
    });

    it('should switch from dark to light', () => {
      manager.setTheme('dark');
      manager.toggleTheme();
      expect(manager.currentTheme).toBe('light');
    });

    it('should notify listeners on toggle', () => {
      const listener = jest.fn();
      manager.onChange(listener);

      manager.toggleTheme();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getTheme', () => {
    it('should return current theme', () => {
      manager.setTheme('dark');
      expect(manager.getTheme()).toBe('dark');
    });

    it('should resolve auto theme to system preference', () => {
      manager.currentTheme = 'auto';
      mockMatchMedia.mockReturnValue({ matches: true, addListener: jest.fn() });
      expect(manager.getTheme()).toBe('dark');
    });
  });

  describe('isDark', () => {
    it('should return true for dark theme', () => {
      manager.setTheme('dark');
      expect(manager.isDark()).toBe(true);
    });

    it('should return false for light theme', () => {
      manager.setTheme('light');
      expect(manager.isDark()).toBe(false);
    });
  });

  describe('isLight', () => {
    it('should return true for light theme', () => {
      manager.setTheme('light');
      expect(manager.isLight()).toBe(true);
    });

    it('should return false for dark theme', () => {
      manager.setTheme('dark');
      expect(manager.isLight()).toBe(false);
    });
  });

  describe('onChange', () => {
    it('should subscribe to theme changes', () => {
      const listener = jest.fn();
      manager.onChange(listener);

      manager.setTheme('dark');

      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = jest.fn();
      const unsubscribe = manager.onChange(listener);

      unsubscribe();
      manager.setTheme('dark');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      manager.onChange(listener1);
      manager.onChange(listener2);

      manager.setTheme('dark');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('getCSSVariables', () => {
    it('should return CSS variables for light theme', () => {
      manager.setTheme('light');
      const vars = manager.getCSSVariables();

      expect(vars['--color-bg']).toBe('#ffffff');
      expect(vars['--color-text']).toBe('#333333');
      expect(vars['--color-accent']).toBe('#0066cc');
    });

    it('should return CSS variables for dark theme', () => {
      manager.setTheme('dark');
      const vars = manager.getCSSVariables();

      expect(vars['--color-bg']).toBe('#1a1a1a');
      expect(vars['--color-text']).toBe('#e0e0e0');
      expect(vars['--color-accent']).toBe('#4a9eff');
    });

    it('should include all color variables', () => {
      const vars = manager.getCSSVariables();

      expect(vars['--color-bg']).toBeDefined();
      expect(vars['--color-text']).toBeDefined();
      expect(vars['--color-border']).toBeDefined();
      expect(vars['--color-success']).toBeDefined();
      expect(vars['--color-warning']).toBeDefined();
      expect(vars['--color-danger']).toBeDefined();
      expect(vars['--color-info']).toBeDefined();
      expect(vars['--shadow']).toBeDefined();
    });
  });

  describe('applyTheme', () => {
    it('should set DOM attribute', () => {
      manager.setTheme('dark');
      manager.applyTheme();

      expect(global.document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should apply CSS variables to DOM', () => {
      manager.applyTheme();

      expect(global.document.documentElement.style.setProperty).toHaveBeenCalled();
    });

    it('should apply multiple CSS variables', () => {
      manager.applyTheme();

      const callCount = global.document.documentElement.style.setProperty.mock.calls.length;
      expect(callCount).toBeGreaterThan(5);
    });
  });

  describe('getSavedPreference', () => {
    it('should return saved preference', () => {
      mockLocalStorage.setItem('app-theme', 'dark');
      const m = new ThemeManager();

      expect(m.getSavedPreference()).toBe('dark');
    });

    it('should return null if no preference saved', () => {
      expect(manager.getSavedPreference()).toBeNull();
    });
  });

  describe('export', () => {
    it('should export theme state', () => {
      manager.setTheme('dark');
      const exported = manager.export();

      expect(exported.currentTheme).toBe('dark');
      expect(exported.isDark).toBe(true);
      expect(exported.timestamp).toBeDefined();
    });

    it('should include system preference in export', () => {
      const exported = manager.export();

      expect(exported.systemPreference).toBeDefined();
      expect(['light', 'dark']).toContain(exported.systemPreference);
    });
  });

  describe('reset', () => {
    it('should reset to default theme', () => {
      manager.setTheme('dark');
      manager.reset();

      expect(manager.currentTheme).toBe('light');
    });

    it('should clear saved preference', () => {
      manager.setTheme('dark');
      manager.reset();

      expect(mockLocalStorage.removeItem).toHaveBeenCalled();
    });

    it('should notify listeners on reset', () => {
      const listener = jest.fn();
      manager.onChange(listener);

      manager.reset();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle invalid theme values', () => {
      manager.setTheme('invalid');
      expect(manager.currentTheme).not.toBe('invalid');
    });

    it('should handle no localStorage', () => {
      global.localStorage = undefined;
      const m = new ThemeManager();
      expect(() => m.setTheme('dark')).not.toThrow();
    });

    it('should handle no window.matchMedia', () => {
      global.window = {};
      expect(() => {
        new ThemeManager({ defaultTheme: 'auto' });
      }).not.toThrow();
    });

    it('should handle no document', () => {
      global.document = undefined;
      const m = new ThemeManager();
      expect(() => m.applyTheme()).not.toThrow();
    });

    it('should handle custom storage key', () => {
      const m = new ThemeManager({ storageKey: 'custom-theme' });
      m.setTheme('dark');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('custom-theme', 'dark');
    });
  });
});
