/**
 * @fileoverview UI Utilities for Dashboard Components
 * Responsive layout, visualization, and component utilities
 *
 * @author Noobly JS Core Team
 * @version 1.0.0
 * @since 1.0.0
 */

'use strict';

/**
 * Dashboard configuration and layout manager.
 * @class
 */
class DashboardConfig {
  /**
   * Create a new dashboard configuration.
   * @param {Object} [options={}] - Configuration options
   * @param {string} [options.title] - Dashboard title
   * @param {string} [options.layout] - Layout type (grid|flex|masonry)
   * @param {number} [options.columnCount] - Column count for responsive layout
   * @param {Object} [options.theme] - Theme configuration
   */
  constructor(options = {}) {
    this.title = options.title || 'Monitoring Dashboard';
    this.layout = options.layout || 'grid';
    this.columnCount = options.columnCount || 3;
    this.theme = options.theme || {};
    this.widgets = [];
    this.layout_config = {
      gap: 16,
      padding: 20,
      breakpoints: {
        mobile: 480,
        tablet: 768,
        desktop: 1024,
        wide: 1440
      }
    };
    this.responsiveColumns = {
      mobile: 1,
      tablet: 2,
      desktop: 3,
      wide: 4
    };
    this.customizations = new Map();
  }

  /**
   * Add a widget to the dashboard.
   * @param {Object} widget - Widget configuration
   * @param {string} widget.id - Widget ID
   * @param {string} widget.title - Widget title
   * @param {string} widget.type - Widget type (chart|table|metric|card)
   * @param {number} [widget.width] - Width in columns (1-4)
   * @param {number} [widget.height] - Height in pixels
   * @param {Object} [widget.config] - Widget-specific configuration
   * @return {Object} Added widget
   */
  addWidget(widget) {
    const defaultWidget = {
      id: widget.id,
      title: widget.title,
      type: widget.type,
      width: widget.width || 1,
      height: widget.height || 300,
      config: widget.config || {},
      position: this.widgets.length,
      visible: true,
      addedAt: new Date().toISOString()
    };

    this.widgets.push(defaultWidget);
    return defaultWidget;
  }

  /**
   * Remove a widget from the dashboard.
   * @param {string} widgetId - Widget ID to remove
   * @return {boolean} True if removed, false if not found
   */
  removeWidget(widgetId) {
    const index = this.widgets.findIndex(w => w.id === widgetId);
    if (index >= 0) {
      this.widgets.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Update widget configuration.
   * @param {string} widgetId - Widget ID
   * @param {Object} updates - Configuration updates
   * @return {Object|null} Updated widget or null if not found
   */
  updateWidget(widgetId, updates) {
    const widget = this.widgets.find(w => w.id === widgetId);
    if (widget) {
      Object.assign(widget, updates);
      return widget;
    }
    return null;
  }

  /**
   * Get responsive column count for viewport width.
   * @param {number} viewportWidth - Viewport width in pixels
   * @return {number} Recommended column count
   */
  getResponsiveColumns(viewportWidth) {
    if (viewportWidth < this.layout_config.breakpoints.mobile) {
      return this.responsiveColumns.mobile;
    }
    if (viewportWidth < this.layout_config.breakpoints.tablet) {
      return this.responsiveColumns.mobile;
    }
    if (viewportWidth < this.layout_config.breakpoints.desktop) {
      return this.responsiveColumns.tablet;
    }
    if (viewportWidth < this.layout_config.breakpoints.wide) {
      return this.responsiveColumns.desktop;
    }
    return this.responsiveColumns.wide;
  }

  /**
   * Get responsive breakpoint for viewport width.
   * @param {number} viewportWidth - Viewport width in pixels
   * @return {string} Breakpoint name (mobile|tablet|desktop|wide)
   */
  getResponsiveBreakpoint(viewportWidth) {
    if (viewportWidth < this.layout_config.breakpoints.tablet) {
      return 'mobile';
    }
    if (viewportWidth < this.layout_config.breakpoints.desktop) {
      return 'tablet';
    }
    if (viewportWidth < this.layout_config.breakpoints.wide) {
      return 'desktop';
    }
    return 'wide';
  }

  /**
   * Save dashboard customization.
   * @param {string} name - Customization name
   * @param {Object} config - Custom configuration
   */
  saveCustomization(name, config) {
    this.customizations.set(name, {
      ...config,
      savedAt: new Date().toISOString()
    });
  }

  /**
   * Load dashboard customization.
   * @param {string} name - Customization name
   * @return {Object|null} Customization or null if not found
   */
  loadCustomization(name) {
    return this.customizations.get(name) || null;
  }

  /**
   * Export dashboard configuration.
   * @return {Object} Exportable configuration
   */
  export() {
    return {
      title: this.title,
      layout: this.layout,
      columnCount: this.columnCount,
      widgets: this.widgets.map(w => ({ ...w })),
      customizations: Array.from(this.customizations.entries()).map(([name, config]) => ({
        name,
        config
      })),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import dashboard configuration.
   * @param {Object} config - Configuration to import
   */
  import(config) {
    if (config.title) this.title = config.title;
    if (config.layout) this.layout = config.layout;
    if (config.columnCount) this.columnCount = config.columnCount;
    if (config.widgets) {
      this.widgets = config.widgets.map(w => ({ ...w }));
    }
    if (config.customizations) {
      config.customizations.forEach(item => {
        this.customizations.set(item.name, item.config);
      });
    }
  }

  /**
   * Reset to default configuration.
   */
  reset() {
    this.widgets = [];
    this.customizations.clear();
    this.columnCount = 3;
    this.layout = 'grid';
  }
}

/**
 * Chart and visualization utility for metrics.
 * @class
 */
class VisualizationHelper {
  /**
   * Create a new visualization helper.
   */
  constructor() {
    this.charts = new Map();
    this.colorPalette = {
      success: '#4caf50',
      warning: '#ff9800',
      danger: '#f44336',
      info: '#2196f3',
      primary: '#0066cc',
      secondary: '#666666',
      accent: '#4a9eff'
    };
  }

  /**
   * Generate SVG bar chart.
   * @param {Array<Object>} data - Chart data points
   * @param {Object} [options={}] - Chart options
   * @param {number} [options.width=400] - Chart width
   * @param {number} [options.height=300] - Chart height
   * @param {string} [options.title] - Chart title
   * @return {string} SVG markup
   */
  generateBarChart(data, options = {}) {
    const {
      width = 400,
      height = 300,
      title = ''
    } = options;

    if (!data || data.length === 0) {
      return '<svg></svg>';
    }

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const maxValue = Math.max(...data.map(d => d.value));
    const barWidth = chartWidth / data.length * 0.8;
    const barSpacing = chartWidth / data.length;

    let svg = `<svg width="${width}" height="${height}" style="border: 1px solid #ddd;">`;

    if (title) {
      svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="14" font-weight="bold">${title}</text>`;
    }

    // Draw bars
    data.forEach((item, index) => {
      const x = padding + index * barSpacing + (barSpacing - barWidth) / 2;
      const barHeight = (item.value / maxValue) * chartHeight;
      const y = padding + chartHeight - barHeight;
      const color = item.color || this.colorPalette.primary;

      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" />`;
      svg += `<text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" font-size="12">${item.value}</text>`;
      svg += `<text x="${x + barWidth / 2}" y="${height - 10}" text-anchor="middle" font-size="11">${item.label}</text>`;
    });

    // Draw axes
    svg += `<line x1="${padding}" y1="${padding + chartHeight}" x2="${width - padding}" y2="${padding + chartHeight}" stroke="#333" stroke-width="2" />`;
    svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + chartHeight}" stroke="#333" stroke-width="2" />`;

    svg += '</svg>';
    return svg;
  }

  /**
   * Generate SVG line chart.
   * @param {Array<Object>} data - Data points with x, y values
   * @param {Object} [options={}] - Chart options
   * @param {number} [options.width=400] - Chart width
   * @param {number} [options.height=300] - Chart height
   * @param {string} [options.title] - Chart title
   * @return {string} SVG markup
   */
  generateLineChart(data, options = {}) {
    const {
      width = 400,
      height = 300,
      title = ''
    } = options;

    if (!data || data.length < 2) {
      return '<svg></svg>';
    }

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const maxValue = Math.max(...data.map(d => d.y));
    const minValue = Math.min(...data.map(d => d.y));
    const range = maxValue - minValue || 1;

    let svg = `<svg width="${width}" height="${height}" style="border: 1px solid #ddd;">`;

    if (title) {
      svg += `<text x="${width / 2}" y="25" text-anchor="middle" font-size="14" font-weight="bold">${title}</text>`;
    }

    // Draw line
    let pathData = 'M';
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((point.y - minValue) / range) * chartHeight;
      pathData += ` ${x},${y}`;
    });

    svg += `<path d="${pathData}" fill="none" stroke="${this.colorPalette.primary}" stroke-width="2" />`;

    // Draw points
    data.forEach((point, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((point.y - minValue) / range) * chartHeight;
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="${this.colorPalette.primary}" />`;
    });

    // Draw axes
    svg += `<line x1="${padding}" y1="${padding + chartHeight}" x2="${width - padding}" y2="${padding + chartHeight}" stroke="#333" stroke-width="2" />`;
    svg += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${padding + chartHeight}" stroke="#333" stroke-width="2" />`;

    svg += '</svg>';
    return svg;
  }

  /**
   * Generate metric card HTML.
   * @param {Object} metric - Metric data
   * @param {string} metric.label - Metric label
   * @param {number} metric.value - Metric value
   * @param {string} [metric.unit] - Value unit
   * @param {string} [metric.status] - Status (success|warning|danger)
   * @return {string} HTML markup
   */
  generateMetricCard(metric) {
    const statusColor = {
      success: '#4caf50',
      warning: '#ff9800',
      danger: '#f44336'
    };

    const color = statusColor[metric.status] || '#2196f3';

    return `
      <div style="border: 1px solid #ddd; padding: 16px; border-radius: 4px; background: #f9f9f9;">
        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${metric.label}</div>
        <div style="font-size: 28px; font-weight: bold; color: ${color};">
          ${metric.value}
          ${metric.unit ? `<span style="font-size: 14px; margin-left: 4px;">${metric.unit}</span>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Get color for value based on thresholds.
   * @param {number} value - Value to check
   * @param {Object} thresholds - Threshold configuration
   * @param {number} [thresholds.success] - Success threshold
   * @param {number} [thresholds.warning] - Warning threshold
   * @return {string} Color code
   */
  getColorForValue(value, thresholds = {}) {
    if (thresholds.success !== undefined && value <= thresholds.success) {
      return this.colorPalette.success;
    }
    if (thresholds.warning !== undefined && value <= thresholds.warning) {
      return this.colorPalette.warning;
    }
    return this.colorPalette.danger;
  }

  /**
   * Register a custom color palette.
   * @param {Object} palette - Color palette
   */
  setColorPalette(palette) {
    this.colorPalette = { ...this.colorPalette, ...palette };
  }
}

/**
 * Mobile-responsive utilities.
 * @class
 */
class ResponsiveHelper {
  /**
   * Create responsive helper.
   */
  constructor() {
    this.breakpoints = {
      xs: 0,
      sm: 480,
      md: 768,
      lg: 1024,
      xl: 1440
    };
  }

  /**
   * Get CSS media query for breakpoint.
   * @param {string} breakpoint - Breakpoint name
   * @return {string} CSS media query
   */
  getMediaQuery(breakpoint) {
    const width = this.breakpoints[breakpoint];
    if (width === undefined) return '';
    return `@media (min-width: ${width}px)`;
  }

  /**
   * Generate responsive CSS grid.
   * @param {number} columns - Desktop column count
   * @return {string} CSS rules
   */
  generateResponsiveGrid(columns = 3) {
    return `
      .dashboard-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        padding: 20px;
      }

      @media (min-width: ${this.breakpoints.sm}px) {
        .dashboard-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (min-width: ${this.breakpoints.md}px) {
        .dashboard-grid {
          grid-template-columns: repeat(${Math.min(columns, 3)}, 1fr);
        }
      }

      @media (min-width: ${this.breakpoints.lg}px) {
        .dashboard-grid {
          grid-template-columns: repeat(${columns}, 1fr);
        }
      }
    `;
  }

  /**
   * Generate mobile-first CSS.
   * @param {Object} styles - Mobile styles
   * @param {Object} breakpointStyles - Styles per breakpoint
   * @return {string} CSS rules
   */
  generateMobileFirstCSS(styles, breakpointStyles = {}) {
    let css = '';

    // Mobile styles
    css += 'selector { ';
    Object.entries(styles).forEach(([prop, value]) => {
      css += `${prop}: ${value}; `;
    });
    css += '} ';

    // Breakpoint overrides
    Object.entries(breakpointStyles).forEach(([bp, bpStyles]) => {
      css += this.getMediaQuery(bp) + ' { selector { ';
      Object.entries(bpStyles).forEach(([prop, value]) => {
        css += `${prop}: ${value}; `;
      });
      css += '} } ';
    });

    return css;
  }

  /**
   * Check if viewport is mobile.
   * @param {number} viewportWidth - Viewport width
   * @return {boolean} True if mobile
   */
  isMobile(viewportWidth) {
    return viewportWidth < this.breakpoints.md;
  }

  /**
   * Check if viewport is tablet.
   * @param {number} viewportWidth - Viewport width
   * @return {boolean} True if tablet
   */
  isTablet(viewportWidth) {
    return viewportWidth >= this.breakpoints.md && viewportWidth < this.breakpoints.lg;
  }

  /**
   * Check if viewport is desktop.
   * @param {number} viewportWidth - Viewport width
   * @return {boolean} True if desktop
   */
  isDesktop(viewportWidth) {
    return viewportWidth >= this.breakpoints.lg;
  }
}

module.exports = {
  DashboardConfig,
  VisualizationHelper,
  ResponsiveHelper
};
