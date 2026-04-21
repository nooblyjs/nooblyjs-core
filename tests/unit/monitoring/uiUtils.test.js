/**
 * @fileoverview Tests for UI Utilities
 */

'use strict';

const {
  DashboardConfig,
  VisualizationHelper,
  ResponsiveHelper
} = require('../../../src/monitoring/utils/uiUtils');

describe('DashboardConfig', () => {
  let dashboard;

  beforeEach(() => {
    dashboard = new DashboardConfig();
  });

  describe('initialization', () => {
    it('should create with default configuration', () => {
      expect(dashboard.title).toBe('Monitoring Dashboard');
      expect(dashboard.layout).toBe('grid');
      expect(dashboard.columnCount).toBe(3);
      expect(dashboard.widgets).toEqual([]);
    });

    it('should accept custom options', () => {
      const config = new DashboardConfig({
        title: 'Custom Dashboard',
        layout: 'flex',
        columnCount: 4
      });

      expect(config.title).toBe('Custom Dashboard');
      expect(config.layout).toBe('flex');
      expect(config.columnCount).toBe(4);
    });

    it('should initialize with responsive column configuration', () => {
      expect(dashboard.responsiveColumns.mobile).toBe(1);
      expect(dashboard.responsiveColumns.tablet).toBe(2);
      expect(dashboard.responsiveColumns.desktop).toBe(3);
      expect(dashboard.responsiveColumns.wide).toBe(4);
    });

    it('should initialize with layout configuration', () => {
      expect(dashboard.layout_config.gap).toBe(16);
      expect(dashboard.layout_config.padding).toBe(20);
      expect(dashboard.layout_config.breakpoints.mobile).toBe(480);
      expect(dashboard.layout_config.breakpoints.tablet).toBe(768);
    });
  });

  describe('widget management', () => {
    it('should add a widget to dashboard', () => {
      const widget = dashboard.addWidget({
        id: 'widget-1',
        title: 'CPU Usage',
        type: 'chart'
      });

      expect(widget.id).toBe('widget-1');
      expect(widget.title).toBe('CPU Usage');
      expect(widget.type).toBe('chart');
      expect(widget.visible).toBe(true);
      expect(widget.position).toBe(0);
      expect(dashboard.widgets.length).toBe(1);
    });

    it('should set default widget properties', () => {
      const widget = dashboard.addWidget({
        id: 'widget-1',
        title: 'Memory',
        type: 'metric'
      });

      expect(widget.width).toBe(1);
      expect(widget.height).toBe(300);
      expect(widget.config).toEqual({});
      expect(widget.addedAt).toBeDefined();
    });

    it('should add widget with custom dimensions', () => {
      const widget = dashboard.addWidget({
        id: 'widget-1',
        title: 'Network',
        type: 'chart',
        width: 2,
        height: 400
      });

      expect(widget.width).toBe(2);
      expect(widget.height).toBe(400);
    });

    it('should add widget with configuration', () => {
      const config = { color: '#ff0000', unit: 'MB' };
      const widget = dashboard.addWidget({
        id: 'widget-1',
        title: 'Disk',
        type: 'chart',
        config
      });

      expect(widget.config).toEqual(config);
    });

    it('should maintain widget position order', () => {
      dashboard.addWidget({ id: 'w1', title: 'W1', type: 'chart' });
      dashboard.addWidget({ id: 'w2', title: 'W2', type: 'chart' });
      dashboard.addWidget({ id: 'w3', title: 'W3', type: 'chart' });

      expect(dashboard.widgets[0].position).toBe(0);
      expect(dashboard.widgets[1].position).toBe(1);
      expect(dashboard.widgets[2].position).toBe(2);
    });

    it('should remove a widget', () => {
      dashboard.addWidget({ id: 'widget-1', title: 'W1', type: 'chart' });
      dashboard.addWidget({ id: 'widget-2', title: 'W2', type: 'chart' });

      const removed = dashboard.removeWidget('widget-1');

      expect(removed).toBe(true);
      expect(dashboard.widgets.length).toBe(1);
      expect(dashboard.widgets[0].id).toBe('widget-2');
    });

    it('should return false when removing non-existent widget', () => {
      const removed = dashboard.removeWidget('non-existent');

      expect(removed).toBe(false);
    });

    it('should update widget configuration', () => {
      dashboard.addWidget({ id: 'widget-1', title: 'Original', type: 'chart' });

      const updated = dashboard.updateWidget('widget-1', {
        title: 'Updated',
        visible: false
      });

      expect(updated.title).toBe('Updated');
      expect(updated.visible).toBe(false);
      expect(updated.id).toBe('widget-1');
    });

    it('should return null when updating non-existent widget', () => {
      const updated = dashboard.updateWidget('non-existent', { title: 'New' });

      expect(updated).toBeNull();
    });
  });

  describe('responsive columns', () => {
    it('should return mobile columns for small viewport', () => {
      const cols = dashboard.getResponsiveColumns(400);

      expect(cols).toBe(1);
    });

    it('should return mobile columns at mobile breakpoint', () => {
      const cols = dashboard.getResponsiveColumns(480);

      expect(cols).toBe(1);
    });

    it('should return tablet columns at tablet breakpoint', () => {
      const cols = dashboard.getResponsiveColumns(768);

      expect(cols).toBe(2);
    });

    it('should return desktop columns at desktop breakpoint', () => {
      const cols = dashboard.getResponsiveColumns(1024);

      expect(cols).toBe(3);
    });

    it('should return wide columns for large viewport', () => {
      const cols = dashboard.getResponsiveColumns(1440);

      expect(cols).toBe(4);
    });

    it('should return wide columns above wide breakpoint', () => {
      const cols = dashboard.getResponsiveColumns(2000);

      expect(cols).toBe(4);
    });
  });

  describe('responsive breakpoint', () => {
    it('should identify mobile breakpoint', () => {
      const bp = dashboard.getResponsiveBreakpoint(400);

      expect(bp).toBe('mobile');
    });

    it('should identify tablet breakpoint', () => {
      const bp = dashboard.getResponsiveBreakpoint(768);

      expect(bp).toBe('tablet');
    });

    it('should identify desktop breakpoint', () => {
      const bp = dashboard.getResponsiveBreakpoint(1024);

      expect(bp).toBe('desktop');
    });

    it('should identify wide breakpoint', () => {
      const bp = dashboard.getResponsiveBreakpoint(1440);

      expect(bp).toBe('wide');
    });
  });

  describe('customizations', () => {
    it('should save customization', () => {
      const config = {
        title: 'Custom Layout',
        widgets: [{ id: 'w1', title: 'Widget 1' }]
      };

      dashboard.saveCustomization('layout-1', config);
      const saved = dashboard.customizations.get('layout-1');

      expect(saved).toBeDefined();
      expect(saved.title).toBe('Custom Layout');
      expect(saved.savedAt).toBeDefined();
    });

    it('should load customization', () => {
      const config = { title: 'Custom Layout' };
      dashboard.saveCustomization('layout-1', config);

      const loaded = dashboard.loadCustomization('layout-1');

      expect(loaded).toBeDefined();
      expect(loaded.title).toBe('Custom Layout');
    });

    it('should return null for non-existent customization', () => {
      const loaded = dashboard.loadCustomization('non-existent');

      expect(loaded).toBeNull();
    });

    it('should update customization', () => {
      dashboard.saveCustomization('layout-1', { title: 'First' });
      dashboard.saveCustomization('layout-1', { title: 'Updated' });

      const loaded = dashboard.loadCustomization('layout-1');

      expect(loaded.title).toBe('Updated');
    });
  });

  describe('export and import', () => {
    it('should export dashboard configuration', () => {
      dashboard.addWidget({ id: 'w1', title: 'Widget 1', type: 'chart' });
      dashboard.saveCustomization('custom-1', { title: 'Custom' });

      const exported = dashboard.export();

      expect(exported.title).toBe('Monitoring Dashboard');
      expect(exported.layout).toBe('grid');
      expect(exported.widgets.length).toBe(1);
      expect(exported.customizations.length).toBe(1);
      expect(exported.exportedAt).toBeDefined();
    });

    it('should import dashboard configuration', () => {
      const config = {
        title: 'Imported Dashboard',
        layout: 'flex',
        columnCount: 4,
        widgets: [{ id: 'w1', title: 'Widget 1', type: 'chart' }],
        customizations: [{ name: 'custom-1', config: { title: 'Custom' } }]
      };

      dashboard.import(config);

      expect(dashboard.title).toBe('Imported Dashboard');
      expect(dashboard.layout).toBe('flex');
      expect(dashboard.columnCount).toBe(4);
      expect(dashboard.widgets.length).toBe(1);
      expect(dashboard.customizations.size).toBe(1);
    });

    it('should import partial configuration', () => {
      dashboard.title = 'Original Title';
      const config = { layout: 'flex', columnCount: 2 };

      dashboard.import(config);

      expect(dashboard.title).toBe('Original Title');
      expect(dashboard.layout).toBe('flex');
      expect(dashboard.columnCount).toBe(2);
    });
  });

  describe('reset', () => {
    it('should reset to default state', () => {
      dashboard.addWidget({ id: 'w1', title: 'Widget 1', type: 'chart' });
      dashboard.saveCustomization('custom-1', { title: 'Custom' });
      dashboard.columnCount = 5;

      dashboard.reset();

      expect(dashboard.widgets.length).toBe(0);
      expect(dashboard.customizations.size).toBe(0);
      expect(dashboard.columnCount).toBe(3);
      expect(dashboard.layout).toBe('grid');
    });
  });
});

describe('VisualizationHelper', () => {
  let helper;

  beforeEach(() => {
    helper = new VisualizationHelper();
  });

  describe('initialization', () => {
    it('should create visualization helper', () => {
      expect(helper).toBeDefined();
      expect(helper.charts).toBeDefined();
      expect(helper.colorPalette).toBeDefined();
    });

    it('should have color palette', () => {
      expect(helper.colorPalette.success).toBe('#4caf50');
      expect(helper.colorPalette.warning).toBe('#ff9800');
      expect(helper.colorPalette.danger).toBe('#f44336');
      expect(helper.colorPalette.primary).toBe('#0066cc');
    });
  });

  describe('bar chart generation', () => {
    it('should generate bar chart SVG', () => {
      const data = [
        { label: 'Jan', value: 100 },
        { label: 'Feb', value: 150 },
        { label: 'Mar', value: 120 }
      ];

      const svg = helper.generateBarChart(data);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('<rect');
      expect(svg).toContain('<text');
    });

    it('should include title in chart', () => {
      const data = [{ label: 'Jan', value: 100 }];
      const svg = helper.generateBarChart(data, { title: 'Monthly Data' });

      expect(svg).toContain('Monthly Data');
    });

    it('should use custom dimensions', () => {
      const data = [{ label: 'Jan', value: 100 }];
      const svg = helper.generateBarChart(data, {
        width: 600,
        height: 400
      });

      expect(svg).toContain('width="600"');
      expect(svg).toContain('height="400"');
    });

    it('should use custom colors', () => {
      const data = [
        { label: 'Jan', value: 100, color: '#ff0000' },
        { label: 'Feb', value: 150, color: '#00ff00' }
      ];

      const svg = helper.generateBarChart(data);

      expect(svg).toContain('#ff0000');
      expect(svg).toContain('#00ff00');
    });

    it('should use default color when not specified', () => {
      const data = [{ label: 'Jan', value: 100 }];
      const svg = helper.generateBarChart(data);

      expect(svg).toContain('#0066cc');
    });

    it('should handle empty data', () => {
      const svg = helper.generateBarChart([]);

      expect(svg).toBe('<svg></svg>');
    });

    it('should handle empty data array as null', () => {
      const svg = helper.generateBarChart(null);

      expect(svg).toBe('<svg></svg>');
    });

    it('should scale bars proportionally', () => {
      const data = [
        { label: 'Low', value: 10 },
        { label: 'High', value: 100 }
      ];

      const svg = helper.generateBarChart(data);

      expect(svg).toContain('10');
      expect(svg).toContain('100');
    });
  });

  describe('line chart generation', () => {
    it('should generate line chart SVG', () => {
      const data = [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 15 }
      ];

      const svg = helper.generateLineChart(data);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('<path');
      expect(svg).toContain('<circle');
    });

    it('should include title in line chart', () => {
      const data = [
        { x: 1, y: 10 },
        { x: 2, y: 20 }
      ];
      const svg = helper.generateLineChart(data, { title: 'Trend Data' });

      expect(svg).toContain('Trend Data');
    });

    it('should use custom dimensions', () => {
      const data = [
        { x: 1, y: 10 },
        { x: 2, y: 20 }
      ];
      const svg = helper.generateLineChart(data, {
        width: 600,
        height: 400
      });

      expect(svg).toContain('width="600"');
      expect(svg).toContain('height="400"');
    });

    it('should plot multiple points', () => {
      const data = [
        { x: 1, y: 10 },
        { x: 2, y: 20 },
        { x: 3, y: 15 },
        { x: 4, y: 25 }
      ];

      const svg = helper.generateLineChart(data);

      const circleMatches = svg.match(/<circle/g);
      expect(circleMatches.length).toBe(4);
    });

    it('should handle edge case with single point', () => {
      const svg = helper.generateLineChart([{ x: 1, y: 10 }]);

      expect(svg).toBe('<svg></svg>');
    });

    it('should handle null data', () => {
      const svg = helper.generateLineChart(null);

      expect(svg).toBe('<svg></svg>');
    });

    it('should scale values to viewport', () => {
      const data = [
        { x: 1, y: 0 },
        { x: 2, y: 100 }
      ];

      const svg = helper.generateLineChart(data);

      expect(svg).toContain('<path');
      expect(svg).toContain('</svg>');
    });
  });

  describe('metric card generation', () => {
    it('should generate metric card HTML', () => {
      const metric = {
        label: 'CPU Usage',
        value: 45,
        unit: '%'
      };

      const html = helper.generateMetricCard(metric);

      expect(html).toContain('CPU Usage');
      expect(html).toContain('45');
      expect(html).toContain('%');
      expect(html).toContain('<div');
    });

    it('should apply success color', () => {
      const metric = {
        label: 'Status',
        value: 'OK',
        status: 'success'
      };

      const html = helper.generateMetricCard(metric);

      expect(html).toContain('#4caf50');
    });

    it('should apply warning color', () => {
      const metric = {
        label: 'Status',
        value: 'WARNING',
        status: 'warning'
      };

      const html = helper.generateMetricCard(metric);

      expect(html).toContain('#ff9800');
    });

    it('should apply danger color', () => {
      const metric = {
        label: 'Status',
        value: 'ERROR',
        status: 'danger'
      };

      const html = helper.generateMetricCard(metric);

      expect(html).toContain('#f44336');
    });

    it('should use default color when status not specified', () => {
      const metric = {
        label: 'Metric',
        value: 100
      };

      const html = helper.generateMetricCard(metric);

      expect(html).toContain('#2196f3');
    });

    it('should omit unit when not specified', () => {
      const metric = {
        label: 'Count',
        value: 42
      };

      const html = helper.generateMetricCard(metric);

      expect(html).toContain('42');
      expect(html).not.toContain('undefined');
    });
  });

  describe('color management', () => {
    it('should get color for value below success threshold', () => {
      const color = helper.getColorForValue(30, { success: 50 });

      expect(color).toBe('#4caf50');
    });

    it('should get color for value at success threshold', () => {
      const color = helper.getColorForValue(50, { success: 50 });

      expect(color).toBe('#4caf50');
    });

    it('should get color for value between thresholds', () => {
      const color = helper.getColorForValue(75, {
        success: 50,
        warning: 80
      });

      expect(color).toBe('#ff9800');
    });

    it('should get danger color above warning threshold', () => {
      const color = helper.getColorForValue(90, {
        success: 50,
        warning: 80
      });

      expect(color).toBe('#f44336');
    });

    it('should return danger for no matching threshold', () => {
      const color = helper.getColorForValue(100, {});

      expect(color).toBe('#f44336');
    });
  });

  describe('color palette customization', () => {
    it('should set custom color palette', () => {
      const palette = {
        success: '#00ff00',
        danger: '#ff0000'
      };

      helper.setColorPalette(palette);

      expect(helper.colorPalette.success).toBe('#00ff00');
      expect(helper.colorPalette.danger).toBe('#ff0000');
    });

    it('should preserve unmodified palette colors', () => {
      const originalWarning = helper.colorPalette.warning;
      helper.setColorPalette({ success: '#00ff00' });

      expect(helper.colorPalette.warning).toBe(originalWarning);
    });
  });
});

describe('ResponsiveHelper', () => {
  let helper;

  beforeEach(() => {
    helper = new ResponsiveHelper();
  });

  describe('initialization', () => {
    it('should create responsive helper', () => {
      expect(helper).toBeDefined();
      expect(helper.breakpoints).toBeDefined();
    });

    it('should have standard breakpoints', () => {
      expect(helper.breakpoints.xs).toBe(0);
      expect(helper.breakpoints.sm).toBe(480);
      expect(helper.breakpoints.md).toBe(768);
      expect(helper.breakpoints.lg).toBe(1024);
      expect(helper.breakpoints.xl).toBe(1440);
    });
  });

  describe('media queries', () => {
    it('should generate media query for breakpoint', () => {
      const query = helper.getMediaQuery('sm');

      expect(query).toBe('@media (min-width: 480px)');
    });

    it('should generate media query for all breakpoints', () => {
      const smQuery = helper.getMediaQuery('sm');
      const mdQuery = helper.getMediaQuery('md');
      const lgQuery = helper.getMediaQuery('lg');

      expect(smQuery).toContain('@media');
      expect(mdQuery).toContain('@media');
      expect(lgQuery).toContain('@media');
    });

    it('should return empty string for unknown breakpoint', () => {
      const query = helper.getMediaQuery('unknown');

      expect(query).toBe('');
    });
  });

  describe('responsive grid generation', () => {
    it('should generate responsive grid CSS', () => {
      const css = helper.generateResponsiveGrid(3);

      expect(css).toContain('.dashboard-grid');
      expect(css).toContain('display: grid');
      expect(css).toContain('@media');
    });

    it('should include mobile grid rules', () => {
      const css = helper.generateResponsiveGrid(3);

      expect(css).toContain('grid-template-columns: 1fr');
    });

    it('should include tablet grid rules', () => {
      const css = helper.generateResponsiveGrid(3);

      expect(css).toContain('grid-template-columns: repeat(2, 1fr)');
    });

    it('should include desktop grid rules', () => {
      const css = helper.generateResponsiveGrid(3);

      expect(css).toContain('grid-template-columns: repeat(3, 1fr)');
    });

    it('should cap columns at 3 for tablet breakpoint', () => {
      const css = helper.generateResponsiveGrid(5);

      expect(css).toContain('repeat(3, 1fr)');
      expect(css).toContain('repeat(5, 1fr)');
    });

    it('should use specified column count for large screens', () => {
      const css = helper.generateResponsiveGrid(4);

      expect(css).toContain('repeat(4, 1fr)');
    });
  });

  describe('mobile-first CSS generation', () => {
    it('should generate mobile-first CSS', () => {
      const styles = { 'font-size': '12px' };
      const breakpointStyles = {
        md: { 'font-size': '14px' }
      };

      const css = helper.generateMobileFirstCSS(styles, breakpointStyles);

      expect(css).toContain('selector');
      expect(css).toContain('font-size: 12px');
      expect(css).toContain('@media');
    });

    it('should include breakpoint overrides', () => {
      const styles = { color: 'black' };
      const breakpointStyles = {
        sm: { color: 'white' },
        md: { color: 'blue' }
      };

      const css = helper.generateMobileFirstCSS(styles, breakpointStyles);

      expect(css).toContain('@media (min-width: 480px)');
      expect(css).toContain('@media (min-width: 768px)');
    });

    it('should handle empty breakpoint styles', () => {
      const styles = { padding: '10px' };

      const css = helper.generateMobileFirstCSS(styles, {});

      expect(css).toContain('padding: 10px');
    });
  });

  describe('viewport detection', () => {
    it('should identify mobile viewport', () => {
      const isMobile = helper.isMobile(500);

      expect(isMobile).toBe(true);
    });

    it('should identify non-mobile viewport', () => {
      const isMobile = helper.isMobile(1000);

      expect(isMobile).toBe(false);
    });

    it('should identify tablet viewport', () => {
      const isTablet = helper.isTablet(900);

      expect(isTablet).toBe(true);
    });

    it('should return false for mobile on tablet check', () => {
      const isTablet = helper.isTablet(500);

      expect(isTablet).toBe(false);
    });

    it('should return false for desktop on tablet check', () => {
      const isTablet = helper.isTablet(1200);

      expect(isTablet).toBe(false);
    });

    it('should identify desktop viewport', () => {
      const isDesktop = helper.isDesktop(1200);

      expect(isDesktop).toBe(true);
    });

    it('should return false for mobile on desktop check', () => {
      const isDesktop = helper.isDesktop(500);

      expect(isDesktop).toBe(false);
    });

    it('should return false for tablet on desktop check', () => {
      const isDesktop = helper.isDesktop(900);

      expect(isDesktop).toBe(false);
    });
  });

  describe('viewport boundary conditions', () => {
    it('should handle viewport at mobile breakpoint', () => {
      const isMobile = helper.isMobile(768);

      expect(isMobile).toBe(false);
    });

    it('should handle viewport at tablet breakpoint', () => {
      const isTablet = helper.isTablet(768);

      expect(isTablet).toBe(true);
    });

    it('should handle viewport at desktop breakpoint', () => {
      const isDesktop = helper.isDesktop(1024);

      expect(isDesktop).toBe(true);
    });

    it('should handle very small viewport', () => {
      const isMobile = helper.isMobile(320);

      expect(isMobile).toBe(true);
    });

    it('should handle very large viewport', () => {
      const isDesktop = helper.isDesktop(2000);

      expect(isDesktop).toBe(true);
    });
  });
});
