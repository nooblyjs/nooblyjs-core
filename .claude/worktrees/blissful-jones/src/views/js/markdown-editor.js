/**
 * MarkdownEditor — A self-contained Notion-like block editor for markdown.
 *
 * Usage:
 *   const editor = new MarkdownEditor('mycontentdiv');
 *   editor.load('# Hello\n\nSome **bold** text');
 *   const md = editor.content();
 *
 * All CSS is injected automatically and scoped under `.we-root` to avoid
 * conflicts with the host application.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MarkdownEditor = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ===================================================================
   *  CSS — injected once into <head>, scoped under .we-root
   * =================================================================*/
  const HLJS_INJECTED_KEY = '__markdownEditorHljsInjected';
  let hljsReady = false;
  let hljsCallbacks = [];

  function injectHighlightJS() {
    if (document[HLJS_INJECTED_KEY]) return;
    document[HLJS_INJECTED_KEY] = true;

    // Theme CSS — atom-one-dark matches our dark code container
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css';
    document.head.appendChild(link);

    // Override hljs background to match our container
    const patch = document.createElement('style');
    patch.textContent = `.we-root .editor-code-body code.hljs { background: transparent; padding: 0; }
.we-root .preview-code code.hljs { background: transparent; padding: 0; }`;
    document.head.appendChild(patch);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js';
    script.onload = function () {
      hljsReady = true;
      hljsCallbacks.forEach(fn => fn());
      hljsCallbacks = [];
    };
    document.head.appendChild(script);
  }

  function whenHljsReady(fn) {
    if (hljsReady) fn();
    else hljsCallbacks.push(fn);
  }

  /* ------- Mermaid.js CDN Loader ------- */
  const MERMAID_INJECTED_KEY = '__markdownEditorMermaidInjected';
  let mermaidReady = false;
  let mermaidCallbacks = [];

  function injectMermaidJS() {
    if (document[MERMAID_INJECTED_KEY]) return;
    document[MERMAID_INJECTED_KEY] = true;

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = function () {
      window.mermaid.initialize({ startOnLoad: false, theme: 'default' });
      mermaidReady = true;
      mermaidCallbacks.forEach(fn => fn());
      mermaidCallbacks = [];
    };
    document.head.appendChild(script);
  }

  function whenMermaidReady(fn) {
    if (mermaidReady) fn();
    else mermaidCallbacks.push(fn);
  }

  /* ------- Swagger UI CDN Loader ------- */
  const SWAGGER_INJECTED_KEY = '__markdownEditorSwaggerInjected';
  let swaggerReady = false;
  let swaggerCallbacks = [];

  function injectSwaggerUI() {
    if (document[SWAGGER_INJECTED_KEY]) return;
    document[SWAGGER_INJECTED_KEY] = true;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css';
    document.head.appendChild(link);

    // Scope swagger styles to avoid conflicts
    const patch = document.createElement('style');
    patch.textContent = `.we-root .editor-swagger-ui-wrapper .swagger-ui { font-size: 14px; }
.we-root .editor-swagger-ui-wrapper .swagger-ui .wrapper { padding: 0; }
.we-root .editor-swagger-ui-wrapper .swagger-ui .info { margin: 10px 0; }`;
    document.head.appendChild(patch);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.onload = function () {
      swaggerReady = true;
      swaggerCallbacks.forEach(fn => fn());
      swaggerCallbacks = [];
    };
    document.head.appendChild(script);
  }

  function whenSwaggerReady(fn) {
    if (swaggerReady) fn();
    else swaggerCallbacks.push(fn);
  }

  const CSS_INJECTED_KEY = '__markdownEditorCssInjected';

  function injectCSS() {
    if (document[CSS_INJECTED_KEY]) return;
    document[CSS_INJECTED_KEY] = true;

    const style = document.createElement('style');
    style.setAttribute('data-markdown-editor', '');
    style.textContent = `
/* ---- MarkdownEditor scoped styles ---- */
.we-root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: #333;
  line-height: 1.6;
  position: relative;
}

.we-root *,
.we-root *::before,
.we-root *::after {
  box-sizing: border-box;
}

/* Editor hints */
.we-root .we-hints {
  margin-bottom: 20px;
  padding: 12px 15px;
  background: #e3f2fd;
  border-left: 4px solid #667eea;
  border-radius: 4px;
  color: #1565c0;
  font-size: 0.95em;
  line-height: 1.5;
}

.we-root .we-hints p {
  margin: 0;
}

.we-root .we-hints kbd {
  display: inline-block;
  padding: 2px 6px;
  background: white;
  border: 1px solid #667eea;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.85em;
  color: #333;
}

/* Blocks */
.we-root .editor-block {
  margin-bottom: 0;
  position: relative;
  padding: 2px 10px 2px 10px;
  border-radius: 4px;
  transition: background 0.2s;
}

.we-root .editor-block:hover {
  background: rgba(102, 126, 234, 0.02);
}

.we-root .editor-block.selected {
  background: rgba(102, 126, 234, 0.05);
  border-radius: 4px;
}

.we-root .editor-block [contenteditable]:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(76, 94, 190, 0.35);
  border-radius: 3px;
}

/* Paragraph */
.we-root .editor-paragraph {
  font-size: 1em;
  line-height: 1.6;
  color: #333;
  margin: 0;
  padding: 5px 0;
  min-height: 1.5em;
  position: relative;
  outline: none;
}

.we-root .editor-paragraph.empty::before {
  content: attr(data-placeholder);
  position: absolute;
  color: #999;
  pointer-events: none;
}

/* Header */
.we-root .editor-header {
  font-weight: 700;
  margin: 0.5em 0;
  padding: 5px 0;
  color: #333;
  outline: none;
  position: relative;
}

.we-root .editor-header.empty::before {
  content: attr(data-placeholder);
  position: absolute;
  color: #999;
  pointer-events: none;
}

.we-root .editor-block[data-type="header"] h1 { font-size: 2.5em; }
.we-root .editor-block[data-type="header"] h2 { font-size: 1.8em; }
.we-root .editor-block[data-type="header"] h3 { font-size: 1.3em; }
.we-root .editor-block[data-type="header"] h4 { font-size: 1.2em; }
.we-root .editor-block[data-type="header"] h5 { font-size: 1.1em; }
.we-root .editor-block[data-type="header"] h6 { font-size: 1em; }

/* Quote */
.we-root .editor-quote {
  border-left: 4px solid #667eea;
  padding: 10px 0 10px 20px;
  font-style: italic;
  color: #666;
  margin: 10px 0;
  outline: none;
  position: relative;
}

.we-root .editor-quote.empty::before {
  content: attr(data-placeholder);
  position: absolute;
  color: #999;
  pointer-events: none;
  left: 20px;
}

/* Code Block Container */
.we-root .editor-code-container {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin: 10px 0;
  overflow: hidden;
  background: #1e1e2e;
}

/* Code header bar */
.we-root .editor-code-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #181825;
  border-bottom: 1px solid #313244;
}

.we-root .editor-code-lang-badge {
  padding: 2px 10px;
  background: #313244;
  color: #cdd6f4;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.we-root .editor-code-lang-select {
  padding: 4px 8px;
  background: #313244;
  color: #cdd6f4;
  border: 1px solid #45475a;
  border-radius: 4px;
  font-size: 0.8em;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}

.we-root .editor-code-lang-select:focus {
  border-color: #89b4fa;
}

.we-root .editor-code-save-btn {
  margin-left: auto;
  padding: 4px 14px;
  background: #89b4fa;
  color: #1e1e2e;
  border: none;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.we-root .editor-code-save-btn:hover {
  background: #74c7ec;
}

/* Collapsed state: hide controls, show badge */
.we-root .editor-code-container.collapsed .editor-code-lang-select,
.we-root .editor-code-container.collapsed .editor-code-save-btn {
  display: none;
}

.we-root .editor-code-container.collapsed .editor-code-lang-badge {
  display: inline-block;
}

/* Editing state: hide badge, show controls */
.we-root .editor-code-container.editing .editor-code-lang-badge {
  display: none;
}

.we-root .editor-code-container.editing .editor-code-lang-select,
.we-root .editor-code-container.editing .editor-code-save-btn {
  display: inline-block;
}

/* Code display area (collapsed - with line numbers) */
.we-root .editor-code-display {
  display: flex;
  overflow-x: auto;
  max-height: 500px;
  overflow-y: auto;
}

.we-root .editor-code-container.editing .editor-code-display {
  display: none;
}

.we-root .editor-code-lines {
  flex-shrink: 0;
  padding: 12px 0;
  background: #181825;
  text-align: right;
  user-select: none;
  border-right: 1px solid #313244;
  min-width: 40px;
}

.we-root .editor-code-line-num {
  display: block;
  padding: 0 10px;
  color: #585b70;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.82em;
  line-height: 1.65;
}

.we-root .editor-code-body {
  flex: 1;
  padding: 12px 15px;
  color: #cdd6f4;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85em;
  line-height: 1.65;
  white-space: pre;
  margin: 0;
  overflow: visible;
}

.we-root .editor-code-body code {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  white-space: inherit;
  display: block;
}

/* Code textarea (editing mode) */
.we-root .editor-code-textarea {
  display: none;
  width: 100%;
  min-height: 150px;
  padding: 12px 15px;
  background: #1e1e2e;
  color: #cdd6f4;
  border: none;
  border-top: 1px solid #313244;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85em;
  line-height: 1.65;
  resize: vertical;
  outline: none;
  tab-size: 2;
}

.we-root .editor-code-container.editing .editor-code-textarea {
  display: block;
}

.we-root .editor-code-textarea:focus {
  box-shadow: inset 0 0 0 2px rgba(137, 180, 250, 0.3);
}

.we-root .editor-code-textarea::placeholder {
  color: #585b70;
}

/* Keep the old classes for preview mode */
.we-root .editor-code {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 15px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
  overflow-x: auto;
  margin: 10px 0;
  position: relative;
}

.we-root .editor-code-content {
  outline: none;
  background: transparent;
  color: #333;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.9em;
  width: 100%;
  min-height: 60px;
  white-space: pre-wrap;
  word-wrap: break-word;
  position: relative;
}

.we-root .editor-code-content.empty::before {
  content: attr(data-placeholder);
  position: absolute;
  color: #999;
  pointer-events: none;
  top: 0;
  left: 0;
}

/* Delimiter */
.we-root .editor-delimiter {
  margin: 30px 0;
  height: 1px;
  background: #e0e0e0;
}

/* List */
.we-root .editor-list {
  margin: 10px 0;
  padding-left: 30px;
}

.we-root ul.editor-list {
  list-style-type: disc;
}

.we-root ol.editor-list {
  list-style-type: decimal;
}

.we-root .editor-list-item {
  margin-bottom: 8px;
  outline: none;
  padding: 2px 0;
}

.we-root .editor-list-item[contenteditable]:empty::before {
  content: attr(data-placeholder);
  color: #999;
  pointer-events: none;
}

/* Checklist */
.we-root .editor-checklist {
  margin: 10px 0;
}

.we-root .editor-checklist-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
  padding: 5px 0;
}

.we-root .editor-checkbox {
  margin-top: 5px;
  cursor: pointer;
  flex-shrink: 0;
}

.we-root .editor-checklist-text {
  flex: 1;
  outline: none;
  padding: 2px 0;
  min-height: 1.5em;
  word-wrap: break-word;
}

.we-root .editor-checklist-text[contenteditable]:empty::before {
  content: attr(data-placeholder);
  color: #999;
  pointer-events: none;
}

.we-root .editor-checklist-item input:checked + .editor-checklist-text {
  text-decoration: line-through;
  color: #999;
}

/* Block Controls */
.we-root .block-controls {
  position: absolute;
  left: -82px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 2px;
  padding-right: 10px;
  opacity: 0;
  transition: opacity 0.15s;
}

.we-root .editor-block[data-type="image"] .block-controls,
.we-root .editor-block[data-type="code"] .block-controls,
.we-root .editor-block[data-type="table"] .block-controls {
  left: -108px;
}

.we-root .editor-block:hover .block-controls {
  opacity: 1;
}

.we-root .block-drag-handle,
.we-root .block-add-btn,
.we-root .block-edit-btn,
.we-root .block-delete-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: #f0f0f0;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #666;
  flex-shrink: 0;
}

.we-root .block-drag-handle:hover { background: #667eea; color: white; cursor: grab; }
.we-root .block-drag-handle:active { cursor: grabbing; }
.we-root .block-add-btn:hover { background: #667eea; color: white; }
.we-root .block-edit-btn:hover { background: #667eea; color: white; }
.we-root .block-delete-btn:hover { background: #dc3545; color: white; }

/* Block Add Menu */
.we-block-add-menu {
  position: fixed;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  z-index: 100000;
  min-width: 160px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px 0;
}
.we-block-add-menu::-webkit-scrollbar { width: 6px; }
.we-block-add-menu::-webkit-scrollbar-track { background: transparent; }
.we-block-add-menu::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 3px; }
.we-block-add-menu::-webkit-scrollbar-thumb:hover { background: #ccc; }

.we-block-add-menu.hidden {
  display: none;
}

.we-block-add-menu .block-add-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border: none;
  background: white;
  width: 100%;
  text-align: left;
  font-size: 0.9em;
  font-family: inherit;
}

.we-block-add-menu .block-add-menu-item:hover {
  background: #f5f5f5;
}

.we-block-add-menu .block-add-menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 0.9em;
  font-weight: 600;
  color: #667eea;
  flex-shrink: 0;
}

.we-block-add-menu .block-add-menu-title {
  font-weight: 500;
  color: #333;
  font-size: 0.85em;
}

.we-block-add-menu .block-add-menu-arrow {
  font-size: 1.2em;
  color: #999;
  margin-left: auto;
  flex-shrink: 0;
}

.we-block-add-menu .block-add-panel.hidden {
  display: none;
}

/* Drag & Drop */
.we-root .editor-block.dragging { opacity: 0.5; }

.we-root .editor-block.drag-over-above::before {
  content: '';
  display: block;
  height: 2px;
  background: #667eea;
  border-radius: 2px;
  margin-bottom: 10px;
}

.we-root .editor-block.drag-over-below::after {
  content: '';
  display: block;
  height: 2px;
  background: #667eea;
  border-radius: 2px;
  margin-top: 10px;
}

/* Slash Command Menu */
.we-slash-menu {
  position: fixed;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  z-index: 100001;
  min-width: 280px;
  max-height: min(400px, 60vh);
  overflow-y: auto;
}

.we-slash-menu.hidden {
  display: none;
}

.we-slash-menu .slash-command-list {
  padding: 8px 0;
}

.we-slash-menu .slash-command-list.hidden {
  display: none;
}

.we-slash-menu .slash-command-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.2s;
  border: none;
  background: white;
  width: 100%;
  text-align: left;
  font-family: inherit;
}

.we-slash-menu .slash-command-item:hover {
  background: #f5f5f5;
}

.we-slash-menu .slash-command-item.active {
  background: #e8eef7;
  border-left: 3px solid #667eea;
  padding-left: 9px;
}

.we-slash-menu .slash-command-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: #f0f0f0;
  border-radius: 6px;
  font-size: 1.2em;
  font-weight: 600;
  color: #667eea;
  flex-shrink: 0;
}

.we-slash-menu .slash-command-text {
  flex: 1;
  min-width: 0;
}

.we-slash-menu .slash-command-title {
  font-weight: 600;
  color: #333;
  font-size: 0.95em;
  margin-bottom: 2px;
}

.we-slash-menu .slash-command-desc {
  color: #999;
  font-size: 0.85em;
  line-height: 1.3;
}

.we-slash-menu .slash-command-arrow {
  font-size: 1.2em;
  color: #999;
  margin-left: auto;
  flex-shrink: 0;
}

.we-slash-menu .slash-back-item .slash-command-icon {
  font-size: 1.4em;
}

.we-slash-menu::-webkit-scrollbar { width: 6px; }
.we-slash-menu::-webkit-scrollbar-track { background: transparent; }
.we-slash-menu::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 3px; }
.we-slash-menu::-webkit-scrollbar-thumb:hover { background: #ccc; }

/* Image Block */
.we-root .editor-image-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin: 10px 0;
  overflow: hidden;
}

.we-root .editor-image-container.collapsed .editor-image-controls { display: none; }
.we-root .editor-image-container.collapsed .editor-image-preview { border-bottom: none; }
.we-root .editor-image-container.editing .editor-image-edit-btn { display: none; }

.we-root .editor-image-preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 250px;
  background: #f9f9f9;
  border-bottom: 1px solid #e0e0e0;
  padding: 20px;
}

.we-root .editor-image {
  max-width: 100%;
  max-height: 400px;
  height: auto;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.we-root .editor-image-placeholder {
  height: 100%;
  min-height: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);
  border: 2px dashed #d0d0d0;
  border-radius: 4px;
  color: #999;
  font-size: 0.95em;
  width: 100%;
}

.we-root .editor-image-error {
  height: 100%;
  min-height: 250px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff5f5;
  border: 2px dashed #ffcccc;
  border-radius: 4px;
  color: #d9534f;
  font-size: 0.95em;
  width: 100%;
}

.we-root .editor-image-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px;
}

.we-root .editor-image-src,
.we-root .editor-image-alt {
  padding: 10px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: white;
}

.we-root .editor-image-src:focus,
.we-root .editor-image-alt:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
}

.we-root .editor-image-apply-btn {
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  align-self: flex-end;
}

.we-root .editor-image-apply-btn:hover { background: #5a6fd6; }
.we-root .editor-image-apply-btn:active { transform: scale(0.97); }
.we-root .editor-image-apply-btn.applied { background: #48bb78; }

/* Link Block */
.we-root .editor-link-container {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin: 10px 0;
  overflow: hidden;
}

.we-root .editor-link-container.collapsed .editor-link-controls { display: none; }
.we-root .editor-link-container.editing .editor-link-preview { display: none; }

.we-root .editor-link-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: #f8fafc;
  text-decoration: none;
  color: inherit;
  transition: background 0.15s;
  cursor: default;
}

.we-root .editor-link-preview:hover { background: #f1f5f9; }

.we-root .editor-link-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #667eea;
  color: white;
  border-radius: 6px;
  font-size: 1.1em;
}

.we-root .editor-link-info { flex: 1; min-width: 0; }

.we-root .editor-link-title {
  font-weight: 600;
  font-size: 0.95em;
  color: #1a202c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.we-root .editor-link-url {
  font-size: 0.82em;
  color: #667eea;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.we-root .editor-link-placeholder {
  padding: 20px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);
  border: 2px dashed #d0d0d0;
  border-radius: 4px;
  color: #999;
  font-size: 0.95em;
  margin: 12px;
}

.we-root .editor-link-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px;
}

.we-root .editor-link-url-input,
.we-root .editor-link-text-input {
  padding: 10px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: white;
}

.we-root .editor-link-url-input:focus,
.we-root .editor-link-text-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
}

.we-root .editor-link-apply-btn {
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
  align-self: flex-end;
}

.we-root .editor-link-apply-btn:hover { background: #5a6fd6; }
.we-root .editor-link-apply-btn:active { transform: scale(0.97); }

/* Summary Block */
.we-root .editor-summary-container {
  border-left: 4px solid #667eea;
  background: #f0f4ff;
  border-radius: 0 6px 6px 0;
  margin: 10px 0;
  overflow: hidden;
}
.we-root .editor-summary-container.collapsed .editor-summary-controls { display: none; }
.we-root .editor-summary-container.editing .editor-summary-display { display: none; }
.we-root .editor-summary-label {
  display: inline-block;
  padding: 3px 10px;
  background: #667eea;
  color: white;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 0 0 4px 0;
}
.we-root .editor-summary-display { padding: 14px 18px; padding-top: 0; color: #333; line-height: 1.6; font-size: 0.95em; }
.we-root .editor-summary-display p { margin: 8px 0; }
.we-root .editor-summary-controls { padding: 12px 15px; }
.we-root .editor-summary-textarea {
  width: 100%;
  min-height: 100px;
  padding: 10px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  outline: none;
  resize: vertical;
  line-height: 1.5;
  box-sizing: border-box;
}
.we-root .editor-summary-textarea:focus { border-color: #667eea; box-shadow: 0 0 0 2px rgba(102,126,234,0.15); }
.we-root .editor-summary-save-btn {
  margin-top: 8px;
  padding: 6px 18px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.85em;
  cursor: pointer;
  float: right;
}
.we-root .editor-summary-save-btn:hover { background: #5a6fd6; }

/* Mermaid Block */
.we-root .editor-mermaid-container {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin: 10px 0;
  overflow: hidden;
}
.we-root .editor-mermaid-container.collapsed .editor-mermaid-controls { display: none; }
.we-root .editor-mermaid-container.editing .editor-mermaid-display { display: none; }
.we-root .editor-mermaid-badge {
  display: inline-block;
  padding: 3px 10px;
  background: #ff6d00;
  color: white;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 0 0 4px 0;
}
.we-root .editor-mermaid-display {
  padding: 20px;
  padding-top: 8px;
  background: #fafafa;
  min-height: 80px;
  display: flex;
  flex-direction: column;
}
.we-root .editor-mermaid-display svg { max-width: 100%; }
.we-root .editor-mermaid-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 0.9em;
  min-height: 60px;
}
.we-root .editor-mermaid-controls { padding: 12px 15px; background: #fafafa; border-top: 1px solid #e0e0e0; }
.we-root .editor-mermaid-textarea {
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 0.85em;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  outline: none;
  resize: vertical;
  line-height: 1.5;
  box-sizing: border-box;
}
.we-root .editor-mermaid-textarea:focus { border-color: #ff6d00; box-shadow: 0 0 0 2px rgba(255,109,0,0.15); }
.we-root .editor-mermaid-save-btn {
  margin-top: 8px;
  padding: 6px 18px;
  background: #ff6d00;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.85em;
  cursor: pointer;
  float: right;
}
.we-root .editor-mermaid-save-btn:hover { background: #e66000; }

/* Swagger Block */
.we-root .editor-swagger-container {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin: 10px 0;
  overflow: hidden;
}
.we-root .editor-swagger-container.collapsed .editor-swagger-controls { display: none; }
.we-root .editor-swagger-container.editing .editor-swagger-display { display: none; }
.we-root .editor-swagger-badge {
  display: inline-block;
  padding: 3px 10px;
  background: #49cc90;
  color: white;
  font-size: 0.75em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 0 0 4px 0;
}
.we-root .editor-swagger-display {
  padding: 16px 18px;
  padding-top: 8px;
  background: #f8fdf9;
}
.we-root .editor-swagger-title { font-weight: 600; font-size: 0.95em; color: #1a202c; }
.we-root .editor-swagger-url { font-size: 0.82em; color: #49cc90; margin-top: 2px; word-break: break-all; }
.we-root .editor-swagger-placeholder {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 0.9em;
}
.we-root .editor-swagger-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px;
}
.we-root .editor-swagger-input {
  padding: 10px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: inherit;
  outline: none;
  background: white;
}
.we-root .editor-swagger-input:focus { border-color: #49cc90; box-shadow: 0 0 0 2px rgba(73,204,144,0.15); }
.we-root .editor-swagger-apply-btn {
  padding: 8px 20px;
  background: #49cc90;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.9em;
  cursor: pointer;
  align-self: flex-end;
}
.we-root .editor-swagger-apply-btn:hover { background: #3dba80; }

/* Columns Block */
.we-root .editor-columns-container { border: 1px solid #e0e0e0; border-radius: 6px; margin: 10px 0; overflow: hidden; }
.we-root .editor-columns-container.collapsed .editor-columns-controls { display: none; }
.we-root .editor-columns-container.editing .editor-columns-display { display: none; }
.we-root .editor-columns-badge { display: inline-block; padding: 3px 10px; background: #667eea; color: white; font-size: 0.75em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 4px; margin-bottom: 10px; }
.we-root .editor-columns-display { padding: 16px; }
.we-root .editor-columns-grid { display: grid; gap: 12px; min-height: 40px; }
.we-root .editor-columns-grid.layout-container { grid-template-columns: 1fr 1fr; }
.we-root .editor-columns-grid.layout-two-col-3-1 { grid-template-columns: 3fr 1fr; }
.we-root .editor-columns-grid.layout-two-col-1-3 { grid-template-columns: 1fr 3fr; }
.we-root .editor-columns-grid.layout-three-column { grid-template-columns: 1fr 1fr 1fr; }
.we-root .editor-columns-section { background: #f8f9fa; border: 1px solid #e8e8e8; border-radius: 4px; padding: 12px; min-height: 40px; font-size: 0.92em; line-height: 1.5; color: #333; }
.we-root .editor-columns-section p { margin: 0 0 8px 0; }
.we-root .editor-columns-section p:last-child { margin-bottom: 0; }
.we-root .editor-columns-placeholder { color: #aaa; font-style: italic; font-size: 0.9em; }
.we-root .editor-columns-controls { padding: 16px; background: #fafafa; }
.we-root .editor-columns-layout-picker { display: flex; gap: 8px; margin-bottom: 14px; }
.we-root .editor-columns-layout-btn { display: inline-flex; align-items: center; gap: 2px; width: 48px; height: 32px; padding: 4px; background: #f0f0f0; border: 2px solid #ddd; border-radius: 4px; cursor: pointer; justify-content: center; }
.we-root .editor-columns-layout-btn.active { border-color: #667eea; background: #eef0ff; }
.we-root .editor-columns-layout-btn:hover { border-color: #667eea; }
.we-root .editor-columns-layout-btn .col-bar { height: 20px; background: #667eea; border-radius: 2px; opacity: 0.7; }
.we-root .editor-columns-layout-btn.active .col-bar { opacity: 1; }
.we-root .editor-columns-controls label { display: block; font-size: 0.82em; font-weight: 600; color: #555; margin-bottom: 3px; margin-top: 10px; }
.we-root .editor-columns-controls label:first-of-type { margin-top: 0; }
.we-root .editor-columns-textarea { width: 100%; min-height: 80px; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95em; font-family: inherit; resize: vertical; }
.we-root .editor-columns-middle-group { display: none; }
.we-root .editor-columns-middle-group.visible { display: block; }
.we-root .editor-columns-save-btn { margin-top: 12px; padding: 8px 18px; background: #667eea; color: white; border: none; border-radius: 4px; font-weight: 600; font-size: 0.9em; cursor: pointer; }
.we-root .editor-columns-save-btn:hover { background: #5a6fd6; }

/* Hero Banner */
.we-root .editor-hero-banner-container { border: 1px solid #e0e0e0; border-radius: 6px; margin: 10px 0; overflow: hidden; }
.we-root .editor-hero-banner-container.collapsed .editor-hero-banner-controls { display: none; }
.we-root .editor-hero-banner-container.editing .editor-hero-banner-display { display: none; }
.we-root .editor-hero-banner-display { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 28px; display: flex; align-items: center; gap: 24px; min-height: 120px; }
.we-root .editor-hero-banner-display.align-left { flex-direction: row-reverse; }
.we-root .editor-hero-banner-display.align-right { flex-direction: row; }
.we-root .editor-hero-banner-text { flex: 1; }
.we-root .editor-hero-banner-title { font-size: 1.8em; font-weight: 700; margin-bottom: 6px; }
.we-root .editor-hero-banner-subtitle { font-size: 1.1em; opacity: 0.9; }
.we-root .editor-hero-banner-image { max-width: 180px; max-height: 120px; border-radius: 6px; object-fit: cover; }
.we-root .editor-hero-banner-placeholder { color: rgba(255,255,255,0.7); font-style: italic; }
.we-root .editor-hero-banner-controls { padding: 16px; background: #fafafa; }
.we-root .editor-hero-banner-controls label { display: block; font-size: 0.82em; font-weight: 600; color: #555; margin-bottom: 3px; margin-top: 10px; }
.we-root .editor-hero-banner-controls label:first-child { margin-top: 0; }
.we-root .editor-hero-banner-input { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95em; font-family: inherit; }
.we-root .editor-hero-banner-select { padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95em; font-family: inherit; }
.we-root .editor-hero-banner-save-btn { margin-top: 12px; padding: 8px 18px; background: #667eea; color: white; border: none; border-radius: 4px; font-weight: 600; font-size: 0.9em; cursor: pointer; }
.we-root .editor-hero-banner-save-btn:hover { background: #5a6fd6; }

/* Cards */
.we-root .editor-cards-container { border: 1px solid #e0e0e0; border-radius: 6px; margin: 10px 0; overflow: hidden; }
.we-root .editor-cards-container.collapsed .editor-cards-controls { display: none; }
.we-root .editor-cards-container.editing .editor-cards-display { display: none; }
.we-root .editor-cards-display { padding: 16px; }
.we-root .editor-cards-grid { display: grid; gap: 14px; }
.we-root .editor-cards-card { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 16px; }
.we-root .editor-cards-card-heading { font-size: 1.05em; font-weight: 600; color: #333; margin-bottom: 6px; }
.we-root .editor-cards-card-desc { font-size: 0.9em; color: #666; line-height: 1.5; }
.we-root .editor-cards-badge { display: inline-block; padding: 3px 10px; background: #667eea; color: white; font-size: 0.75em; font-weight: 700; text-transform: uppercase; border-radius: 4px; margin-bottom: 10px; }
.we-root .editor-cards-controls { padding: 16px; background: #fafafa; }
.we-root .editor-cards-controls label { display: block; font-size: 0.82em; font-weight: 600; color: #555; margin-bottom: 3px; margin-top: 10px; }
.we-root .editor-cards-controls label:first-child { margin-top: 0; }
.we-root .editor-cards-input { width: 80px; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95em; font-family: inherit; }
.we-root .editor-cards-card-edit { border: 1px solid #ddd; border-radius: 6px; padding: 12px; margin-bottom: 10px; background: white; }
.we-root .editor-cards-card-edit input,
.we-root .editor-cards-card-edit textarea { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95em; font-family: inherit; margin-bottom: 6px; }
.we-root .editor-cards-card-edit textarea { min-height: 60px; resize: vertical; }
.we-root .editor-cards-actions { display: flex; gap: 8px; margin-top: 12px; }
.we-root .editor-cards-action-btn { padding: 6px 14px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85em; cursor: pointer; }
.we-root .editor-cards-action-btn:hover { background: #e0e0e0; }
.we-root .editor-cards-save-btn { padding: 8px 18px; background: #667eea; color: white; border: none; border-radius: 4px; font-weight: 600; font-size: 0.9em; cursor: pointer; }
.we-root .editor-cards-save-btn:hover { background: #5a6fd6; }

/* Site Header Block */
.we-root .editor-site-header-container { border: 1px solid #e0e0e0; border-radius: 6px; margin: 10px 0; overflow: hidden; }
.we-root .editor-site-header-container.collapsed .editor-site-header-controls { display: none; }
.we-root .editor-site-header-container.editing .editor-site-header-display { display: none; }
.we-root .editor-site-header-display { display: flex; align-items: center; gap: 14px; padding: 14px 20px; background: #1a1a2e; color: white; }
.we-root .editor-site-header-icon { width: 32px; height: 32px; object-fit: contain; border-radius: 4px; }
.we-root .editor-site-header-title { font-weight: 700; font-size: 1.1em; flex-shrink: 0; }
.we-root .editor-site-header-links { display: flex; gap: 16px; margin-left: auto; flex-wrap: wrap; }
.we-root .editor-site-header-links a { color: rgba(255,255,255,0.85); text-decoration: none; font-size: 0.9em; }
.we-root .editor-site-header-links a:hover { color: white; }
.we-root .editor-site-header-badge { display: inline-block; padding: 3px 10px; background: #1a1a2e; color: white; font-size: 0.75em; font-weight: 700; text-transform: uppercase; border-radius: 4px; margin-bottom: 10px; }
.we-root .editor-site-header-controls { padding: 16px; background: #fafafa; }
.we-root .editor-site-header-controls label { display: block; font-size: 0.82em; font-weight: 600; color: #555; margin-bottom: 3px; margin-top: 10px; }
.we-root .editor-site-header-controls label:first-child { margin-top: 0; }
.we-root .editor-site-header-input { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95em; font-family: inherit; }
.we-root .editor-site-header-save-btn { margin-top: 12px; padding: 8px 18px; background: #667eea; color: white; border: none; border-radius: 4px; font-weight: 600; font-size: 0.9em; cursor: pointer; }
.we-root .editor-site-header-save-btn:hover { background: #5a6fd6; }

/* Site Footer Block */
.we-root .editor-site-footer-container { border: 1px solid #e0e0e0; border-radius: 6px; margin: 10px 0; overflow: hidden; }
.we-root .editor-site-footer-container.collapsed .editor-site-footer-controls { display: none; }
.we-root .editor-site-footer-container.editing .editor-site-footer-display { display: none; }
.we-root .editor-site-footer-display { display: flex; align-items: center; gap: 14px; padding: 18px 20px; background: #2d2d44; color: white; flex-wrap: wrap; }
.we-root .editor-site-footer-icon { width: 28px; height: 28px; object-fit: contain; border-radius: 4px; }
.we-root .editor-site-footer-text { flex: 1; min-width: 120px; }
.we-root .editor-site-footer-title { font-weight: 700; font-size: 1em; }
.we-root .editor-site-footer-subtitle { font-size: 0.82em; opacity: 0.7; margin-top: 2px; }
.we-root .editor-site-footer-links { display: flex; gap: 16px; flex-wrap: wrap; }
.we-root .editor-site-footer-links a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 0.85em; }
.we-root .editor-site-footer-links a:hover { color: white; }
.we-root .editor-site-footer-badge { display: inline-block; padding: 3px 10px; background: #2d2d44; color: white; font-size: 0.75em; font-weight: 700; text-transform: uppercase; border-radius: 4px; margin-bottom: 10px; }
.we-root .editor-site-footer-controls { padding: 16px; background: #fafafa; }
.we-root .editor-site-footer-controls label { display: block; font-size: 0.82em; font-weight: 600; color: #555; margin-bottom: 3px; margin-top: 10px; }
.we-root .editor-site-footer-controls label:first-child { margin-top: 0; }
.we-root .editor-site-footer-input { width: 100%; padding: 8px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95em; font-family: inherit; }
.we-root .editor-site-footer-save-btn { margin-top: 12px; padding: 8px 18px; background: #667eea; color: white; border: none; border-radius: 4px; font-weight: 600; font-size: 0.9em; cursor: pointer; }
.we-root .editor-site-footer-save-btn:hover { background: #5a6fd6; }

/* Preview */
.we-root .we-preview { padding: 20px 0; }
.we-root .we-preview.hidden { display: none; }

.we-root .preview-paragraph { font-size: 1em; line-height: 1.6; color: #333; margin: 15px 0; }
.we-root .preview-header { font-weight: 700; margin: 15px 0; color: #333; }
.we-root .preview-header h1 { font-size: 2.5em; }
.we-root .preview-header h2 { font-size: 1.8em; }
.we-root .preview-header h3 { font-size: 1.3em; }
.we-root .preview-header h4 { font-size: 1.2em; }
.we-root .preview-header h5 { font-size: 1.1em; }
.we-root .preview-header h6 { font-size: 1em; }
.we-root .preview-list { margin: 15px 0; padding-left: 30px; }
.we-root .preview-list li { margin-bottom: 8px; }
.we-root .preview-quote { border-left: 4px solid #667eea; padding-left: 20px; font-style: italic; color: #666; margin: 15px 0; }
.we-root .preview-code { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; padding: 15px; font-family: 'Monaco','Menlo','Ubuntu Mono',monospace; font-size: 0.9em; overflow-x: auto; margin: 15px 0; }
.we-root .preview-code code { color: #333; }
.we-root .preview-checklist { margin: 15px 0; }
.we-root .preview-checklist-item { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; padding: 5px 0; }
.we-root .preview-checklist-item input { margin-top: 5px; cursor: default; flex-shrink: 0; }
.we-root .preview-checklist-item input:checked + span { text-decoration: line-through; color: #999; }
.we-root .preview-delimiter { margin: 30px 0; border: none; border-top: 1px solid #e0e0e0; height: 0; }
.we-root .preview-image-figure { margin: 20px 0; text-align: center; }
.we-root .preview-image { max-width: 100%; height: auto; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.we-root .preview-image-figure figcaption { margin-top: 10px; color: #999; font-size: 0.9em; font-style: italic; }

/* Table Block */
.we-root .editor-table-container {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin: 10px 0;
  overflow: hidden;
}

.we-root .editor-table-container.collapsed .editor-table-controls { display: none; }
.we-root .editor-table-container.editing .editor-table-display { display: none; }

.we-root .editor-table-display { overflow-x: auto; }

.we-root .editor-table-display table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92em;
}

.we-root .editor-table-display th {
  background: #f0f2f5;
  padding: 10px 14px;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #d0d0d0;
  border-right: 1px solid #e0e0e0;
  white-space: nowrap;
}

.we-root .editor-table-display th:last-child { border-right: none; }

.we-root .editor-table-display td {
  padding: 9px 14px;
  border-bottom: 1px solid #e8e8e8;
  border-right: 1px solid #e8e8e8;
  color: #444;
}

.we-root .editor-table-display td:last-child { border-right: none; }
.we-root .editor-table-display tr:last-child td { border-bottom: none; }
.we-root .editor-table-display tr:hover td { background: #fafbfc; }

/* Editing state */
.we-root .editor-table-controls {
  padding: 15px;
}

.we-root .editor-table-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  overflow: hidden;
}

.we-root .editor-table-row {
  display: flex;
}

.we-root .editor-table-row + .editor-table-row { border-top: 1px solid #e0e0e0; }

.we-root .editor-table-cell-input {
  flex: 1;
  min-width: 80px;
  padding: 8px 10px;
  border: none;
  border-right: 1px solid #e0e0e0;
  font-size: 0.9em;
  font-family: inherit;
  outline: none;
  background: white;
}

.we-root .editor-table-cell-input:last-child { border-right: none; }
.we-root .editor-table-cell-input:focus { box-shadow: inset 0 0 0 2px rgba(102,126,234,0.3); z-index: 1; position: relative; }

.we-root .editor-table-row.header-row .editor-table-cell-input {
  font-weight: 600;
  background: #f5f7fa;
}

.we-root .editor-table-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.we-root .editor-table-action-btn {
  padding: 5px 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  font-size: 0.82em;
  cursor: pointer;
  color: #555;
  font-family: inherit;
  transition: all 0.15s;
}

.we-root .editor-table-action-btn:hover { background: #f0f0f0; border-color: #bbb; }

.we-root .editor-table-save-btn {
  padding: 6px 18px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.85em;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  margin-left: auto;
  transition: background 0.2s;
}

.we-root .editor-table-save-btn:hover { background: #5a6fd6; }

/* Preview table */
.we-root .preview-table { margin: 15px 0; overflow-x: auto; }
.we-root .preview-table table { width: 100%; border-collapse: collapse; font-size: 0.92em; }
.we-root .preview-table th { background: #f0f2f5; padding: 10px 14px; text-align: left; font-weight: 600; border-bottom: 2px solid #d0d0d0; border-right: 1px solid #e0e0e0; }
.we-root .preview-table th:last-child { border-right: none; }
.we-root .preview-table td { padding: 9px 14px; border-bottom: 1px solid #e8e8e8; border-right: 1px solid #e8e8e8; }
.we-root .preview-table td:last-child { border-right: none; }
.we-root .preview-table tr:last-child td { border-bottom: none; }
`;
    document.head.appendChild(style);
  }

  /* ===================================================================
   *  Slash-menu HTML template (created once per instance, appended to body)
   * =================================================================*/
  function createSlashMenuHTML() {
    const el = document.createElement('div');
    el.className = 'we-slash-menu hidden';
    el.innerHTML = `
      <div class="slash-command-list" data-panel="main">
        <div class="slash-command-item" data-action="open-headings">
          <div class="slash-command-icon">H</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Heading</div>
            <div class="slash-command-desc">Section heading</div>
          </div>
          <div class="slash-command-arrow">\u203A</div>
        </div>
        <div class="slash-command-item" data-action="open-emphasis">
          <div class="slash-command-icon">B</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Emphasis</div>
            <div class="slash-command-desc">Bold, italic, underline</div>
          </div>
          <div class="slash-command-arrow">\u203A</div>
        </div>
        <div class="slash-command-item" data-type="paragraph">
          <div class="slash-command-icon">\u00B6</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Paragraph</div>
            <div class="slash-command-desc">Start with plain text</div>
          </div>
        </div>
        <div class="slash-command-item" data-action="open-lists">
          <div class="slash-command-icon">\u2261</div>
          <div class="slash-command-text">
            <div class="slash-command-title">List</div>
            <div class="slash-command-desc">Bulleted or numbered list</div>
          </div>
          <div class="slash-command-arrow">\u203A</div>
        </div>
        <div class="slash-command-item" data-action="open-code-advanced">
          <div class="slash-command-icon">&lt;&gt;</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Code</div>
            <div class="slash-command-desc">Code, Mermaid, Swagger</div>
          </div>
          <div class="slash-command-arrow">\u203A</div>
        </div>
        <div class="slash-command-item" data-type="quote">
          <div class="slash-command-icon">\u275D</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Quote</div>
            <div class="slash-command-desc">Highlight a quote</div>
          </div>
        </div>
        <div class="slash-command-item" data-type="checklist">
          <div class="slash-command-icon">\u2611</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Checklist</div>
            <div class="slash-command-desc">Task list with checkboxes</div>
          </div>
        </div>
        <div class="slash-command-item" data-type="delimiter">
          <div class="slash-command-icon">\u2014</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Divider</div>
            <div class="slash-command-desc">Horizontal line separator</div>
          </div>
        </div>
        <div class="slash-command-item" data-type="image">
          <div class="slash-command-icon">\uD83D\uDDBC</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Image</div>
            <div class="slash-command-desc">Embed an image</div>
          </div>
        </div>
        <div class="slash-command-item" data-type="table">
          <div class="slash-command-icon">\u25A6</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Table</div>
            <div class="slash-command-desc">Insert a data table</div>
          </div>
        </div>
        <div class="slash-command-item" data-type="link">
          <div class="slash-command-icon">\uD83D\uDD17</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Link</div>
            <div class="slash-command-desc">Add a bookmark link</div>
          </div>
        </div>
        <div class="slash-command-item" data-action="open-layout">
          <div class="slash-command-icon">\u2B1A</div>
          <div class="slash-command-text">
            <div class="slash-command-title">Layout</div>
            <div class="slash-command-desc">Columns, cards, header, footer</div>
          </div>
          <div class="slash-command-arrow">\u203A</div>
        </div>
      </div>
      <!-- Headings panel -->
      <div class="slash-command-list hidden" data-panel="headings">
        <div class="slash-command-item slash-back-item" data-action="back">
          <div class="slash-command-icon">\u2039</div>
          <div class="slash-command-text"><div class="slash-command-title">Back</div></div>
        </div>
        <div class="slash-command-item" data-type="header-1"><div class="slash-command-icon">H1</div><div class="slash-command-text"><div class="slash-command-title">Heading 1</div><div class="slash-command-desc">Page title</div></div></div>
        <div class="slash-command-item" data-type="header-2"><div class="slash-command-icon">H2</div><div class="slash-command-text"><div class="slash-command-title">Heading 2</div><div class="slash-command-desc">Section heading</div></div></div>
        <div class="slash-command-item" data-type="header-3"><div class="slash-command-icon">H3</div><div class="slash-command-text"><div class="slash-command-title">Heading 3</div><div class="slash-command-desc">Subsection heading</div></div></div>
        <div class="slash-command-item" data-type="header-4"><div class="slash-command-icon">H4</div><div class="slash-command-text"><div class="slash-command-title">Heading 4</div><div class="slash-command-desc">Small heading</div></div></div>
        <div class="slash-command-item" data-type="header-5"><div class="slash-command-icon">H5</div><div class="slash-command-text"><div class="slash-command-title">Heading 5</div><div class="slash-command-desc">Minor heading</div></div></div>
        <div class="slash-command-item" data-type="header-6"><div class="slash-command-icon">H6</div><div class="slash-command-text"><div class="slash-command-title">Heading 6</div><div class="slash-command-desc">Smallest heading</div></div></div>
      </div>
      <!-- Emphasis panel -->
      <div class="slash-command-list hidden" data-panel="emphasis">
        <div class="slash-command-item slash-back-item" data-action="back">
          <div class="slash-command-icon">\u2039</div>
          <div class="slash-command-text"><div class="slash-command-title">Back</div></div>
        </div>
        <div class="slash-command-item" data-format="bold"><div class="slash-command-icon"><strong>B</strong></div><div class="slash-command-text"><div class="slash-command-title">Bold</div><div class="slash-command-desc">Strong emphasis</div></div></div>
        <div class="slash-command-item" data-format="italic"><div class="slash-command-icon"><em>I</em></div><div class="slash-command-text"><div class="slash-command-title">Italic</div><div class="slash-command-desc">Subtle emphasis</div></div></div>
        <div class="slash-command-item" data-format="underline"><div class="slash-command-icon" style="text-decoration:underline;">U</div><div class="slash-command-text"><div class="slash-command-title">Underline</div><div class="slash-command-desc">Underline text</div></div></div>
      </div>
      <!-- Lists panel -->
      <div class="slash-command-list hidden" data-panel="lists">
        <div class="slash-command-item slash-back-item" data-action="back">
          <div class="slash-command-icon">\u2039</div>
          <div class="slash-command-text"><div class="slash-command-title">Back</div></div>
        </div>
        <div class="slash-command-item" data-type="list-unordered"><div class="slash-command-icon">\u2022</div><div class="slash-command-text"><div class="slash-command-title">Bulleted List</div><div class="slash-command-desc">Unordered list with bullets</div></div></div>
        <div class="slash-command-item" data-type="list-ordered"><div class="slash-command-icon">1.</div><div class="slash-command-text"><div class="slash-command-title">Numbered List</div><div class="slash-command-desc">Ordered list with numbers</div></div></div>
      </div>
      <!-- Code Advanced panel -->
      <div class="slash-command-list hidden" data-panel="code-advanced">
        <div class="slash-command-item slash-back-item" data-action="back">
          <div class="slash-command-icon">\u2039</div>
          <div class="slash-command-text"><div class="slash-command-title">Back</div></div>
        </div>
        <div class="slash-command-item" data-type="code"><div class="slash-command-icon">&lt;&gt;</div><div class="slash-command-text"><div class="slash-command-title">Code</div><div class="slash-command-desc">Code snippet with syntax highlighting</div></div></div>
        <div class="slash-command-item" data-type="mermaid"><div class="slash-command-icon">\u2B21</div><div class="slash-command-text"><div class="slash-command-title">Mermaid Diagram</div><div class="slash-command-desc">Flowcharts, sequences, etc.</div></div></div>
        <div class="slash-command-item" data-type="swagger"><div class="slash-command-icon">\u2B13</div><div class="slash-command-text"><div class="slash-command-title">Swagger / API</div><div class="slash-command-desc">OpenAPI documentation</div></div></div>
      </div>
      <!-- Layout panel -->
      <div class="slash-command-list hidden" data-panel="layout">
        <div class="slash-command-item slash-back-item" data-action="back">
          <div class="slash-command-icon">\u2039</div>
          <div class="slash-command-text"><div class="slash-command-title">Back</div></div>
        </div>
        <div class="slash-command-item" data-type="columns"><div class="slash-command-icon">\u2225</div><div class="slash-command-text"><div class="slash-command-title">Columns</div><div class="slash-command-desc">Multi-column layout</div></div></div>
        <div class="slash-command-item" data-type="cards"><div class="slash-command-icon">\u25A3</div><div class="slash-command-text"><div class="slash-command-title">Cards</div><div class="slash-command-desc">Grid of content cards</div></div></div>
        <div class="slash-command-item" data-type="summary"><div class="slash-command-icon">\uD83D\uDCCB</div><div class="slash-command-text"><div class="slash-command-title">Summary</div><div class="slash-command-desc">Highlighted callout box</div></div></div>
        <div class="slash-command-item" data-type="site-header"><div class="slash-command-icon">\u2302</div><div class="slash-command-text"><div class="slash-command-title">Header</div><div class="slash-command-desc">Site navigation header</div></div></div>
        <div class="slash-command-item" data-type="site-footer"><div class="slash-command-icon">\u2584</div><div class="slash-command-text"><div class="slash-command-title">Footer</div><div class="slash-command-desc">Site footer with links</div></div></div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function createBlockAddMenuHTML() {
    const menu = document.createElement('div');
    menu.className = 'we-block-add-menu hidden';
    menu.innerHTML = `
      <div class="block-add-panel" data-panel="main">
        <div class="block-add-menu-item" data-action="open-headings"><div class="block-add-menu-icon">H</div><div class="block-add-menu-title">Heading</div><div class="block-add-menu-arrow">\u203A</div></div>
        <div class="block-add-menu-item" data-action="open-emphasis"><div class="block-add-menu-icon"><strong>B</strong></div><div class="block-add-menu-title">Emphasis</div><div class="block-add-menu-arrow">\u203A</div></div>
        <div class="block-add-menu-item" data-type="paragraph"><div class="block-add-menu-icon">\u00B6</div><div class="block-add-menu-title">Paragraph</div></div>
        <div class="block-add-menu-item" data-action="open-lists"><div class="block-add-menu-icon">\u2261</div><div class="block-add-menu-title">List</div><div class="block-add-menu-arrow">\u203A</div></div>
        <div class="block-add-menu-item" data-action="open-code-advanced"><div class="block-add-menu-icon">&lt;&gt;</div><div class="block-add-menu-title">Code</div><div class="block-add-menu-arrow">\u203A</div></div>
        <div class="block-add-menu-item" data-type="quote"><div class="block-add-menu-icon">\u275D</div><div class="block-add-menu-title">Quote</div></div>
        <div class="block-add-menu-item" data-type="checklist"><div class="block-add-menu-icon">\u2611</div><div class="block-add-menu-title">Checklist</div></div>
        <div class="block-add-menu-item" data-type="delimiter"><div class="block-add-menu-icon">\u2014</div><div class="block-add-menu-title">Divider</div></div>
        <div class="block-add-menu-item" data-type="image"><div class="block-add-menu-icon">\uD83D\uDDBC</div><div class="block-add-menu-title">Image</div></div>
        <div class="block-add-menu-item" data-type="table"><div class="block-add-menu-icon">\u25A6</div><div class="block-add-menu-title">Table</div></div>
        <div class="block-add-menu-item" data-type="link"><div class="block-add-menu-icon">\uD83D\uDD17</div><div class="block-add-menu-title">Link</div></div>
        <div class="block-add-menu-item" data-action="open-layout"><div class="block-add-menu-icon">\u2B1A</div><div class="block-add-menu-title">Layout</div><div class="block-add-menu-arrow">\u203A</div></div>
      </div>
      <div class="block-add-panel hidden" data-panel="headings">
        <div class="block-add-menu-item" data-action="back"><div class="block-add-menu-icon">\u2039</div><div class="block-add-menu-title">Back</div></div>
        <div class="block-add-menu-item" data-type="header-1"><div class="block-add-menu-icon">H1</div><div class="block-add-menu-title">Heading 1</div></div>
        <div class="block-add-menu-item" data-type="header-2"><div class="block-add-menu-icon">H2</div><div class="block-add-menu-title">Heading 2</div></div>
        <div class="block-add-menu-item" data-type="header-3"><div class="block-add-menu-icon">H3</div><div class="block-add-menu-title">Heading 3</div></div>
        <div class="block-add-menu-item" data-type="header-4"><div class="block-add-menu-icon">H4</div><div class="block-add-menu-title">Heading 4</div></div>
        <div class="block-add-menu-item" data-type="header-5"><div class="block-add-menu-icon">H5</div><div class="block-add-menu-title">Heading 5</div></div>
        <div class="block-add-menu-item" data-type="header-6"><div class="block-add-menu-icon">H6</div><div class="block-add-menu-title">Heading 6</div></div>
      </div>
      <div class="block-add-panel hidden" data-panel="emphasis">
        <div class="block-add-menu-item" data-action="back"><div class="block-add-menu-icon">\u2039</div><div class="block-add-menu-title">Back</div></div>
        <div class="block-add-menu-item" data-format="bold"><div class="block-add-menu-icon"><strong>B</strong></div><div class="block-add-menu-title">Bold</div></div>
        <div class="block-add-menu-item" data-format="italic"><div class="block-add-menu-icon"><em>I</em></div><div class="block-add-menu-title">Italic</div></div>
        <div class="block-add-menu-item" data-format="underline"><div class="block-add-menu-icon" style="text-decoration:underline;">U</div><div class="block-add-menu-title">Underline</div></div>
      </div>
      <div class="block-add-panel hidden" data-panel="lists">
        <div class="block-add-menu-item" data-action="back"><div class="block-add-menu-icon">\u2039</div><div class="block-add-menu-title">Back</div></div>
        <div class="block-add-menu-item" data-type="list-unordered"><div class="block-add-menu-icon">\u2022</div><div class="block-add-menu-title">Bulleted List</div></div>
        <div class="block-add-menu-item" data-type="list-ordered"><div class="block-add-menu-icon">1.</div><div class="block-add-menu-title">Numbered List</div></div>
      </div>
      <div class="block-add-panel hidden" data-panel="code-advanced">
        <div class="block-add-menu-item" data-action="back"><div class="block-add-menu-icon">\u2039</div><div class="block-add-menu-title">Back</div></div>
        <div class="block-add-menu-item" data-type="code"><div class="block-add-menu-icon">&lt;&gt;</div><div class="block-add-menu-title">Code</div></div>
        <div class="block-add-menu-item" data-type="mermaid"><div class="block-add-menu-icon">\u2B21</div><div class="block-add-menu-title">Mermaid Diagram</div></div>
        <div class="block-add-menu-item" data-type="swagger"><div class="block-add-menu-icon">\u2B13</div><div class="block-add-menu-title">Swagger / API</div></div>
      </div>
      <div class="block-add-panel hidden" data-panel="layout">
        <div class="block-add-menu-item" data-action="back"><div class="block-add-menu-icon">\u2039</div><div class="block-add-menu-title">Back</div></div>
        <div class="block-add-menu-item" data-type="columns"><div class="block-add-menu-icon">\u2225</div><div class="block-add-menu-title">Columns</div></div>
        <div class="block-add-menu-item" data-type="cards"><div class="block-add-menu-icon">\u25A3</div><div class="block-add-menu-title">Cards</div></div>
        <div class="block-add-menu-item" data-type="summary"><div class="block-add-menu-icon">\uD83D\uDCCB</div><div class="block-add-menu-title">Summary</div></div>
        <div class="block-add-menu-item" data-type="site-header"><div class="block-add-menu-icon">\u2302</div><div class="block-add-menu-title">Header</div></div>
        <div class="block-add-menu-item" data-type="site-footer"><div class="block-add-menu-icon">\u2584</div><div class="block-add-menu-title">Footer</div></div>
      </div>
    `;
    document.body.appendChild(menu);
    return menu;
  }

  /* ===================================================================
   *  MarkdownEditor class
   * =================================================================*/
  class MarkdownEditor {
    /**
     * Create a new MarkdownEditor instance.
     * @param {string} containerId - The id of the container element
     * @param {object} [options] - Optional settings
     * @param {function} [options.onChange] - Callback when content changes
     * @param {function} [options.resolveImageSrc] - Custom image src resolver
     */
    constructor(containerId, options) {
      injectCSS();
      injectHighlightJS();
      injectMermaidJS();

      this._options = options || {};
      this._container = document.getElementById(containerId);
      if (!this._container) {
        throw new Error(`MarkdownEditor: element with id "${containerId}" not found`);
      }

      this._abortController = new AbortController();
      this._blocks = [];
      this._data = { blocks: [], version: '1.0' };
      this._currentBlockIndex = -1;
      this._dragSourceIndex = null;
      this._isPreviewMode = false;
      this._onChange = this._options.onChange || (() => {});
      this._resolveImageSrcFn = this._options.resolveImageSrc || null;

      // Slash menu state
      this._slashMenuOpen = false;
      this._slashMenuSelectedIndex = 0;
      this._slashCurrentPanel = 'main';
      this._savedSelection = null;

      // Build DOM
      this._container.classList.add('we-root');
      this._container.innerHTML = '';

      // Hints bar
      this._hints = document.createElement('div');
      this._hints.className = 'we-hints';
      this._hints.innerHTML = '<p>\uD83D\uDCA1 <strong>Tip:</strong> Type <kbd>/</kbd> to see block options. <kbd>Ctrl+B</kbd> Bold, <kbd>Ctrl+I</kbd> Italic, <kbd>Ctrl+U</kbd> Underline.</p>';
      this._container.appendChild(this._hints);

      // Editor area (holds blocks)
      this._holder = document.createElement('div');
      this._holder.className = 'we-editor-area';
      this._container.appendChild(this._holder);

      // Preview area
      this._previewPane = document.createElement('div');
      this._previewPane.className = 'we-preview hidden';
      this._container.appendChild(this._previewPane);

      // Menus (appended to body for fixed positioning)
      this._slashMenu = createSlashMenuHTML();
      this._blockAddMenu = createBlockAddMenuHTML();

      // Initial render
      this._render();
      this._attachEventListeners();
      this._setupPlaceholders();
      this._initSlashCommands();
    }

    /* ---------------------------------------------------------------
     *  Public API
     * -------------------------------------------------------------*/

    /**
     * Load markdown content into the editor.
     * @param {string} markdown
     */
    load(markdown) {
      this._fromMarkdown(markdown || '');
    }

    /**
     * Retrieve the current editor content as a markdown string.
     * @returns {string}
     */
    content() {
      return this._toMarkdown();
    }

    /**
     * Get structured block data (for advanced use).
     * @returns {Promise<object>}
     */
    save() {
      return Promise.resolve({
        blocks: this._blocks.map(b => ({ type: b.type, data: b.data })),
        version: '1.0'
      });
    }

    /**
     * Toggle preview mode.
     */
    togglePreview() {
      this._isPreviewMode = !this._isPreviewMode;
      if (this._isPreviewMode) {
        this._previewPane.innerHTML = this._blocks.map(b => this._renderBlockPreview(b)).join('');
        this._holder.style.display = 'none';
        this._hints.style.display = 'none';
        this._previewPane.classList.remove('hidden');
        // Highlight code in preview
        whenHljsReady(() => {
          this._previewPane.querySelectorAll('pre code[class*="language-"]').forEach(el => {
            window.hljs.highlightElement(el);
          });
        });
      } else {
        this._holder.style.display = '';
        this._hints.style.display = '';
        this._previewPane.classList.add('hidden');
        this._previewPane.innerHTML = '';
      }
    }

    /**
     * Destroy the editor and clean up event listeners / DOM nodes.
     */
    destroy() {
      this._abortController.abort();
      this._container.innerHTML = '';
      this._container.classList.remove('we-root');
      this._blocks = [];
      if (this._slashMenu && this._slashMenu.parentNode) {
        this._slashMenu.parentNode.removeChild(this._slashMenu);
      }
      if (this._blockAddMenu && this._blockAddMenu.parentNode) {
        this._blockAddMenu.parentNode.removeChild(this._blockAddMenu);
      }
    }

    /* ---------------------------------------------------------------
     *  Internal — Rendering
     * -------------------------------------------------------------*/

    _render() {
      this._holder.innerHTML = '';
      this._blocks = [];

      if (this._data.blocks && this._data.blocks.length > 0) {
        this._data.blocks.forEach((blockData, index) => {
          this._createBlockElement(blockData, index);
        });
      }

      if (this._blocks.length === 0) {
        this._createBlockElement({ type: 'paragraph', data: { text: '' } }, 0);
      }

      this._highlightAllCode();
      this._renderAllMermaid();
      this._renderAllSwagger();
    }

    _createBlockElement(blockData, index) {
      const blockEl = document.createElement('div');
      blockEl.className = 'editor-block';
      blockEl.dataset.type = blockData.type;
      blockEl.dataset.index = index;

      this._renderBlockContent(blockEl, blockData.type, blockData.data);
      this._holder.appendChild(blockEl);
      this._blocks.push({
        index,
        type: blockData.type,
        data: blockData.data,
        element: blockEl,
        contentElement: blockEl.querySelector('[contenteditable], textarea, code, input, span')
      });
    }

    _renderBlockContent(blockEl, type, data) {
      let content = '';

      switch (type) {
        case 'header': {
          const level = data?.level || 2;
          content = `<h${level} class="editor-header" contenteditable="true" data-placeholder="Heading...">${data?.text || ''}</h${level}>`;
          break;
        }
        case 'paragraph':
          content = `<p class="editor-paragraph" contenteditable="true" data-placeholder="Type text...">${data?.text || ''}</p>`;
          break;

        case 'list': {
          const items = data?.items || [];
          const listType = data?.style === 'ordered' ? 'ol' : 'ul';
          content = `<${listType} class="editor-list">`;
          items.forEach((item, i) => {
            content += `<li class="editor-list-item" contenteditable="true" data-index="${i}">${item}</li>`;
          });
          content += `</${listType}>`;
          break;
        }
        case 'code': {
          const code = data?.code || '';
          const lang = data?.language || 'plain';
          const codeLines = code ? code.split('\n') : [''];
          const lineNums = codeLines.map((_, i) => `<span class="editor-code-line-num">${i + 1}</span>`).join('');
          const hasCode = code.trim().length > 0;
          const state = hasCode ? 'collapsed' : 'editing';
          const langOptions = this._getLanguageOptions(lang);
          content = `
            <div class="editor-code-container ${state}">
              <div class="editor-code-header">
                <span class="editor-code-lang-badge">${this._escapeHtml(lang)}</span>
                <select class="editor-code-lang-select" data-role="code-lang">${langOptions}</select>
                <button type="button" class="editor-code-save-btn" data-role="code-save">Save</button>
              </div>
              <div class="editor-code-display">
                <div class="editor-code-lines">${lineNums}</div>
                <pre class="editor-code-body"><code class="language-${this._escapeHtml(lang)}">${this._escapeHtml(code) || '\n'}</code></pre>
              </div>
              <textarea class="editor-code-textarea" data-role="code-textarea" placeholder="Paste or type your code here..." spellcheck="false">${this._escapeHtml(code)}</textarea>
            </div>
          `;
          break;
        }

        case 'quote':
          content = `<blockquote class="editor-quote" contenteditable="true" data-placeholder="Quote...">${data?.text || ''}</blockquote>`;
          break;

        case 'checklist': {
          const checkItems = data?.items || [];
          content = '<div class="editor-checklist">';
          checkItems.forEach((item, i) => {
            const checked = item.checked ? 'checked' : '';
            const text = typeof item === 'string' ? item : item.text;
            content += `<div class="editor-checklist-item">
              <input type="checkbox" class="editor-checkbox" data-index="${i}" ${checked}>
              <span class="editor-checklist-text" contenteditable="true" data-index="${i}">${text}</span>
            </div>`;
          });
          content += '</div>';
          break;
        }
        case 'delimiter':
          content = '<div class="editor-delimiter"></div>';
          break;

        case 'image': {
          const src = data?.src || '';
          const alt = data?.alt || '';
          const resolvedSrc = this._resolveImageSrc(src);
          const isCollapsed = src ? 'collapsed' : 'editing';
          content = `
            <div class="editor-image-container ${isCollapsed}">
              <div class="editor-image-preview">
                ${src ? `<img src="${this._escapeHtml(resolvedSrc)}" alt="${this._escapeHtml(alt)}" class="editor-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                          <div class="editor-image-error" style="display: none;">Image failed to load: ${this._escapeHtml(src)}</div>` : '<div class="editor-image-placeholder">No image set</div>'}
              </div>
              <div class="editor-image-controls">
                <input type="text" class="editor-image-src" placeholder="Image path (e.g., images/photo.png)" value="${this._escapeHtml(src)}" data-role="image-src">
                <input type="text" class="editor-image-alt" placeholder="Alt text (for accessibility)" value="${this._escapeHtml(alt)}" data-role="image-alt">
                <button type="button" class="editor-image-apply-btn" data-role="image-apply">Apply</button>
              </div>
            </div>
          `;
          break;
        }

        case 'link': {
          const url = data?.url || '';
          const text = data?.text || '';
          const isCollapsed = url ? 'collapsed' : 'editing';
          const displayText = text || url || 'Untitled link';
          content = `
            <div class="editor-link-container ${isCollapsed}">
              <div class="editor-link-preview">
                <div class="editor-link-icon">\uD83D\uDD17</div>
                <div class="editor-link-info">
                  <div class="editor-link-title">${this._escapeHtml(displayText)}</div>
                  ${url ? `<div class="editor-link-url">${this._escapeHtml(url)}</div>` : ''}
                </div>
              </div>
              <div class="editor-link-controls">
                <input type="text" class="editor-link-url-input" placeholder="URL (e.g., https://example.com)" value="${this._escapeHtml(url)}" data-role="link-url">
                <input type="text" class="editor-link-text-input" placeholder="Display text (optional)" value="${this._escapeHtml(text)}" data-role="link-text">
                <button type="button" class="editor-link-apply-btn" data-role="link-apply">Apply</button>
              </div>
            </div>
          `;
          break;
        }

        case 'table': {
          const headers = data?.headers || ['Column 1', 'Column 2'];
          const rows = data?.rows || [['', '']];
          const hasData = headers.some(h => h && h !== 'Column 1' && h !== 'Column 2') || rows.some(r => r.some(c => c));
          const state = hasData ? 'collapsed' : 'editing';

          // Collapsed display table
          const thHtml = headers.map(h => `<th>${this._escapeHtml(h)}</th>`).join('');
          const trHtml = rows.map(row => {
            const tds = headers.map((_, ci) => `<td>${this._escapeHtml(row[ci] || '')}</td>`).join('');
            return `<tr>${tds}</tr>`;
          }).join('');
          const displayTable = `<div class="editor-table-display"><table><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table></div>`;

          // Editing grid
          const headerInputs = headers.map((h, ci) =>
            `<input type="text" class="editor-table-cell-input" value="${this._escapeHtml(h)}" data-role="table-header-input" data-col="${ci}" placeholder="Header">`
          ).join('');
          const rowInputs = rows.map((row, ri) => {
            const cells = headers.map((_, ci) =>
              `<input type="text" class="editor-table-cell-input" value="${this._escapeHtml(row[ci] || '')}" data-role="table-cell-input" data-row="${ri}" data-col="${ci}" placeholder="Cell">`
            ).join('');
            return `<div class="editor-table-row" data-row="${ri}">${cells}</div>`;
          }).join('');

          content = `
            <div class="editor-table-container ${state}">
              ${displayTable}
              <div class="editor-table-controls">
                <div class="editor-table-grid">
                  <div class="editor-table-row header-row">${headerInputs}</div>
                  ${rowInputs}
                </div>
                <div class="editor-table-actions">
                  <button type="button" class="editor-table-action-btn" data-role="table-add-row">+ Row</button>
                  <button type="button" class="editor-table-action-btn" data-role="table-remove-row">- Row</button>
                  <button type="button" class="editor-table-action-btn" data-role="table-add-col">+ Column</button>
                  <button type="button" class="editor-table-action-btn" data-role="table-remove-col">- Column</button>
                  <button type="button" class="editor-table-save-btn" data-role="table-save">Save</button>
                </div>
              </div>
            </div>
          `;
          break;
        }

        case 'summary': {
          const summaryText = data?.text || '';
          const summaryState = summaryText ? 'collapsed' : 'editing';
          const summaryHtml = summaryText ? this._markdownToHtml(summaryText) : '<p style="color:#999;">Empty summary</p>';
          content = `
            <div class="editor-summary-container ${summaryState}">
              <div class="editor-summary-display">
                <div class="editor-summary-label">Summary</div>
                <div class="editor-summary-content">${summaryHtml}</div>
              </div>
              <div class="editor-summary-controls">
                <div class="editor-summary-label" style="margin-bottom:8px;">Summary</div>
                <textarea class="editor-summary-textarea" data-role="summary-textarea" placeholder="Write summary content (markdown supported)...">${this._escapeHtml(summaryText)}</textarea>
                <button type="button" class="editor-summary-save-btn" data-role="summary-save">Save</button>
                <div style="clear:both;"></div>
              </div>
            </div>
          `;
          break;
        }

        case 'mermaid': {
          const mermaidCode = data?.code || '';
          const mermaidState = mermaidCode ? 'collapsed' : 'editing';
          content = `
            <div class="editor-mermaid-container ${mermaidState}">
              <div class="editor-mermaid-display">
                <div class="editor-mermaid-badge">Mermaid</div>
                <div class="editor-mermaid-preview" ${mermaidCode ? '' : 'style="display:none;"'}></div>
                <div class="editor-mermaid-placeholder" ${mermaidCode ? 'style="display:none;"' : ''}>No diagram defined</div>
              </div>
              <div class="editor-mermaid-controls">
                <div class="editor-mermaid-badge" style="margin-bottom:8px;">Mermaid</div>
                <textarea class="editor-mermaid-textarea" data-role="mermaid-textarea" placeholder="graph TD\n  A[Start] --> B[End]">${this._escapeHtml(mermaidCode)}</textarea>
                <button type="button" class="editor-mermaid-save-btn" data-role="mermaid-save">Save</button>
                <div style="clear:both;"></div>
              </div>
            </div>
          `;
          break;
        }

        case 'swagger': {
          const swaggerUrl = data?.url || '';
          const swaggerTitle = data?.title || '';
          const swaggerState = swaggerUrl ? 'collapsed' : 'editing';
          const displayTitle = swaggerTitle || 'API Documentation';
          const swaggerId = 'swagger-ui-' + Math.random().toString(36).substr(2, 9);
          content = `
            <div class="editor-swagger-container ${swaggerState}">
              <div class="editor-swagger-display">
                <div class="editor-swagger-badge">Swagger / OpenAPI</div>
                <div style="padding: 14px 18px;">
                  <div class="editor-swagger-title">${this._escapeHtml(displayTitle)}</div>
                  ${swaggerUrl ? `<div class="editor-swagger-url">${this._escapeHtml(swaggerUrl)}</div>` : ''}
                </div>
                <div class="editor-swagger-ui-wrapper" id="${swaggerId}"></div>
                <div class="editor-swagger-placeholder" ${swaggerUrl ? 'style="display:none;"' : ''}>No API URL configured</div>
              </div>
              <div class="editor-swagger-controls">
                <input type="text" class="editor-swagger-input" placeholder="Swagger/OpenAPI URL (e.g., https://petstore.swagger.io/v2/swagger.json)" value="${this._escapeHtml(swaggerUrl)}" data-role="swagger-url">
                <input type="text" class="editor-swagger-input" placeholder="Title (optional)" value="${this._escapeHtml(swaggerTitle)}" data-role="swagger-title">
                <button type="button" class="editor-swagger-apply-btn" data-role="swagger-apply">Apply</button>
              </div>
            </div>
          `;
          break;
        }

        case 'hero-banner': {
          const hbTitle = data?.title || '';
          const hbSubtitle = data?.subtitle || '';
          const hbImage = data?.image || '';
          const hbAlign = data?.imageAlign || 'right';
          const hbState = hbTitle ? 'collapsed' : 'editing';
          const hbImgHtml = hbImage ? `<img class="editor-hero-banner-image" src="${this._escapeHtml(this._resolveImageSrc(hbImage))}" alt="Hero image">` : '';
          content = `
            <div class="editor-hero-banner-container ${hbState}">
              <div class="editor-hero-banner-display align-${hbAlign}">
                <div class="editor-hero-banner-text">
                  <div class="editor-hero-banner-title">${this._escapeHtml(hbTitle) || '<span class="editor-hero-banner-placeholder">Hero Title</span>'}</div>
                  <div class="editor-hero-banner-subtitle">${this._escapeHtml(hbSubtitle)}</div>
                </div>
                ${hbImgHtml}
              </div>
              <div class="editor-hero-banner-controls">
                <label>Title</label>
                <input type="text" class="editor-hero-banner-input" data-role="hero-banner-title" value="${this._escapeHtml(hbTitle)}" placeholder="Hero title">
                <label>Subtitle</label>
                <input type="text" class="editor-hero-banner-input" data-role="hero-banner-subtitle" value="${this._escapeHtml(hbSubtitle)}" placeholder="Subtitle text">
                <label>Image</label>
                <input type="text" class="editor-hero-banner-input" data-role="hero-banner-image" value="${this._escapeHtml(hbImage)}" placeholder="images/hero.png">
                <label>Image Align</label>
                <select class="editor-hero-banner-select" data-role="hero-banner-align">
                  <option value="right" ${hbAlign === 'right' ? 'selected' : ''}>Right</option>
                  <option value="left" ${hbAlign === 'left' ? 'selected' : ''}>Left</option>
                </select>
                <br>
                <button type="button" class="editor-hero-banner-save-btn" data-role="hero-banner-save">Save</button>
              </div>
            </div>
          `;
          break;
        }

        case 'cards': {
          const cardsAcross = data?.across || 3;
          const cardsItems = data?.cards || [{ heading: '', description: '' }];
          const hasCards = cardsItems.some(c => c.heading || c.description);
          const cardsState = hasCards ? 'collapsed' : 'editing';
          const cardsGridHtml = cardsItems.map(c => `
            <div class="editor-cards-card">
              <div class="editor-cards-card-heading">${this._escapeHtml(c.heading) || 'Untitled'}</div>
              <div class="editor-cards-card-desc">${this._escapeHtml(c.description)}</div>
            </div>
          `).join('');
          const cardsEditHtml = cardsItems.map((c, ci) => `
            <div class="editor-cards-card-edit" data-card-index="${ci}">
              <input type="text" data-role="cards-heading" data-card="${ci}" value="${this._escapeHtml(c.heading)}" placeholder="Card heading">
              <textarea data-role="cards-desc" data-card="${ci}" placeholder="Card description">${this._escapeHtml(c.description)}</textarea>
            </div>
          `).join('');
          content = `
            <div class="editor-cards-container ${cardsState}">
              <div class="editor-cards-display">
                <div class="editor-cards-badge">Cards</div>
                <div class="editor-cards-grid" style="grid-template-columns: repeat(${cardsAcross}, 1fr);">
                  ${cardsGridHtml}
                </div>
              </div>
              <div class="editor-cards-controls">
                <div class="editor-cards-badge">Cards</div>
                <label>Cards per row</label>
                <input type="number" class="editor-cards-input" data-role="cards-across" value="${cardsAcross}" min="1" max="6">
                <div class="editor-cards-edit-list">
                  ${cardsEditHtml}
                </div>
                <div class="editor-cards-actions">
                  <button type="button" class="editor-cards-action-btn" data-role="cards-add-card">+ Card</button>
                  <button type="button" class="editor-cards-action-btn" data-role="cards-remove-card">- Card</button>
                  <button type="button" class="editor-cards-save-btn" data-role="cards-save">Save</button>
                </div>
              </div>
            </div>
          `;
          break;
        }

        case 'site-header': {
          const shIcon = data?.icon || '';
          const shTitle = data?.title || '';
          const shLinks = data?.links || '';
          const shState = shTitle ? 'collapsed' : 'editing';
          const shIconHtml = shIcon ? `<img class="editor-site-header-icon" src="${this._escapeHtml(this._resolveImageSrc(shIcon))}" alt="Icon">` : '';
          const shLinksHtml = (shLinks.match(/\[([^\]]*)\]\(([^)]*)\)/g) || []).map(m => {
            const parts = m.match(/\[([^\]]*)\]\(([^)]*)\)/);
            return `<a href="${this._escapeHtml(parts[2])}">${this._escapeHtml(parts[1])}</a>`;
          }).join('');
          content = `
            <div class="editor-site-header-container ${shState}">
              <div class="editor-site-header-display">
                ${shIconHtml}
                <div class="editor-site-header-title">${this._escapeHtml(shTitle) || 'Site Header'}</div>
                <div class="editor-site-header-links">${shLinksHtml}</div>
              </div>
              <div class="editor-site-header-controls">
                <div class="editor-site-header-badge">Header</div>
                <label>Icon</label>
                <input type="text" class="editor-site-header-input" data-role="site-header-icon" value="${this._escapeHtml(shIcon)}" placeholder="images/logo.png">
                <label>Title</label>
                <input type="text" class="editor-site-header-input" data-role="site-header-title" value="${this._escapeHtml(shTitle)}" placeholder="Site name">
                <label>Links (markdown format: [Text](url) [Text2](url2))</label>
                <input type="text" class="editor-site-header-input" data-role="site-header-links" value="${this._escapeHtml(shLinks)}" placeholder="[Home](/) [About](/about)">
                <button type="button" class="editor-site-header-save-btn" data-role="site-header-save">Save</button>
              </div>
            </div>
          `;
          break;
        }

        case 'site-footer': {
          const sfIcon = data?.icon || '';
          const sfTitle = data?.title || '';
          const sfSubtitle = data?.subtitle || '';
          const sfLinks = data?.links || '';
          const sfState = sfTitle ? 'collapsed' : 'editing';
          const sfIconHtml = sfIcon ? `<img class="editor-site-footer-icon" src="${this._escapeHtml(this._resolveImageSrc(sfIcon))}" alt="Icon">` : '';
          const sfLinksHtml = (sfLinks.match(/\[([^\]]*)\]\(([^)]*)\)/g) || []).map(m => {
            const parts = m.match(/\[([^\]]*)\]\(([^)]*)\)/);
            return `<a href="${this._escapeHtml(parts[2])}">${this._escapeHtml(parts[1])}</a>`;
          }).join('');
          content = `
            <div class="editor-site-footer-container ${sfState}">
              <div class="editor-site-footer-display">
                ${sfIconHtml}
                <div class="editor-site-footer-text">
                  <div class="editor-site-footer-title">${this._escapeHtml(sfTitle) || 'Site Footer'}</div>
                  <div class="editor-site-footer-subtitle">${this._escapeHtml(sfSubtitle)}</div>
                </div>
                <div class="editor-site-footer-links">${sfLinksHtml}</div>
              </div>
              <div class="editor-site-footer-controls">
                <div class="editor-site-footer-badge">Footer</div>
                <label>Icon</label>
                <input type="text" class="editor-site-footer-input" data-role="site-footer-icon" value="${this._escapeHtml(sfIcon)}" placeholder="images/logo.png">
                <label>Title</label>
                <input type="text" class="editor-site-footer-input" data-role="site-footer-title" value="${this._escapeHtml(sfTitle)}" placeholder="Site name">
                <label>Subtitle</label>
                <input type="text" class="editor-site-footer-input" data-role="site-footer-subtitle" value="${this._escapeHtml(sfSubtitle)}" placeholder="Built with love">
                <label>Links (markdown format: [Text](url) [Text2](url2))</label>
                <input type="text" class="editor-site-footer-input" data-role="site-footer-links" value="${this._escapeHtml(sfLinks)}" placeholder="[Privacy](/privacy) [Terms](/terms)">
                <button type="button" class="editor-site-footer-save-btn" data-role="site-footer-save">Save</button>
              </div>
            </div>
          `;
          break;
        }

        case 'columns': {
          const colLayout = data?.layout || 'container';
          const colLeft = data?.left || '';
          const colMiddle = data?.middle || '';
          const colRight = data?.right || '';
          const colState = (colLeft || colRight || colMiddle) ? 'collapsed' : 'editing';
          const isThreeCol = colLayout === 'three-column';

          const layoutBtns = [
            { key: 'container', bars: '<span class="col-bar" style="flex:1"></span><span class="col-bar" style="flex:1"></span>' },
            { key: 'two-col-3-1', bars: '<span class="col-bar" style="flex:3"></span><span class="col-bar" style="flex:1"></span>' },
            { key: 'two-col-1-3', bars: '<span class="col-bar" style="flex:1"></span><span class="col-bar" style="flex:3"></span>' },
            { key: 'three-column', bars: '<span class="col-bar" style="flex:1"></span><span class="col-bar" style="flex:1"></span><span class="col-bar" style="flex:1"></span>' }
          ].map(l => `<button type="button" class="editor-columns-layout-btn${l.key === colLayout ? ' active' : ''}" data-role="columns-layout" data-layout="${l.key}">${l.bars}</button>`).join('');

          const leftHtml = colLeft ? this._markdownToHtml(colLeft) : '<span class="editor-columns-placeholder">Left column</span>';
          const rightHtml = colRight ? this._markdownToHtml(colRight) : '<span class="editor-columns-placeholder">Right column</span>';
          const middleHtml = colMiddle ? this._markdownToHtml(colMiddle) : '<span class="editor-columns-placeholder">Middle column</span>';
          const middleSection = isThreeCol ? `<div class="editor-columns-section">${middleHtml}</div>` : '';

          content = `
            <div class="editor-columns-container ${colState}">
              <div class="editor-columns-display">
                <div class="editor-columns-grid layout-${colLayout}">
                  <div class="editor-columns-section">${leftHtml}</div>
                  ${middleSection}
                  <div class="editor-columns-section">${rightHtml}</div>
                </div>
              </div>
              <div class="editor-columns-controls">
                <div class="editor-columns-badge">Columns</div>
                <div class="editor-columns-layout-picker">${layoutBtns}</div>
                <label>Left</label>
                <textarea class="editor-columns-textarea" data-role="columns-left" placeholder="Markdown content for left column">${this._escapeHtml(colLeft)}</textarea>
                <div class="editor-columns-middle-group${isThreeCol ? ' visible' : ''}">
                  <label>Middle</label>
                  <textarea class="editor-columns-textarea" data-role="columns-middle" placeholder="Markdown content for middle column">${this._escapeHtml(colMiddle)}</textarea>
                </div>
                <label>Right</label>
                <textarea class="editor-columns-textarea" data-role="columns-right" placeholder="Markdown content for right column">${this._escapeHtml(colRight)}</textarea>
                <button type="button" class="editor-columns-save-btn" data-role="columns-save">Save</button>
              </div>
            </div>
          `;
          break;
        }

        default:
          content = `<p class="editor-paragraph" contenteditable="true">${this._escapeHtml(data?.text || '')}</p>`;
      }

      const editableBlocks = ['image', 'code', 'table', 'link', 'summary', 'mermaid', 'swagger', 'hero-banner', 'cards', 'site-header', 'site-footer', 'columns'];
      const editBtn = editableBlocks.includes(type) ? `<button class="block-edit-btn" title="Edit block" data-role="${type}-edit">\u270E</button>` : '';
      const controls = `
        <div class="block-controls">
          <button class="block-drag-handle" title="Drag to reorder" draggable="false">\u2807</button>
          <button class="block-add-btn" title="Add block below">+</button>
          ${editBtn}
          <button class="block-delete-btn" title="Delete block">\u2715</button>
        </div>
      `;

      blockEl.innerHTML = controls + content;
    }

    _renderBlockPreview(block) {
      const html = (text) => text || '';

      switch (block.type) {
        case 'paragraph':
          return `<p class="preview-paragraph">${html(block.data.text)}</p>`;
        case 'header': {
          const level = block.data.level || 2;
          return `<h${level} class="preview-header">${html(block.data.text)}</h${level}>`;
        }
        case 'list': {
          const listTag = block.data.style === 'ordered' ? 'ol' : 'ul';
          const listItems = (block.data.items || []).map(item => `<li>${html(item)}</li>`).join('');
          return `<${listTag} class="preview-list">${listItems}</${listTag}>`;
        }
        case 'code': {
          const lang = block.data.language || 'plain';
          const langBadge = lang !== 'plain' ? `<span style="display:inline-block;padding:2px 8px;background:#313244;color:#cdd6f4;border-radius:4px;font-size:0.75em;font-weight:600;text-transform:uppercase;margin-bottom:8px;">${this._escapeHtml(lang)}</span>` : '';
          return `<div>${langBadge}<pre class="preview-code"><code class="language-${this._escapeHtml(lang)}">${this._escapeHtml(block.data.code || '')}</code></pre></div>`;
        }
        case 'quote':
          return `<blockquote class="preview-quote">${html(block.data.text)}</blockquote>`;
        case 'checklist': {
          const items = (block.data.items || []).map(item => {
            const checked = item.checked ? 'checked disabled' : 'disabled';
            const text = typeof item === 'string' ? item : item.text;
            return `<div class="preview-checklist-item"><input type="checkbox" ${checked}><span>${html(text)}</span></div>`;
          }).join('');
          return `<div class="preview-checklist">${items}</div>`;
        }
        case 'delimiter':
          return '<hr class="preview-delimiter">';
        case 'image': {
          const imgSrc = this._resolveImageSrc(block.data.src || '');
          const imgAlt = block.data.alt || '';
          return `<figure class="preview-image-figure"><img src="${this._escapeHtml(imgSrc)}" alt="${this._escapeHtml(imgAlt)}" class="preview-image"><figcaption>${this._escapeHtml(imgAlt)}</figcaption></figure>`;
        }
        case 'link': {
          const linkUrl = block.data.url || '#';
          const linkText = block.data.text || block.data.url || 'Untitled link';
          return `<div style="margin:8px 0"><a href="${this._escapeHtml(linkUrl)}" target="_blank" rel="noopener noreferrer" style="color:#667eea;font-weight:500;text-decoration:underline;">${this._escapeHtml(linkText)}</a></div>`;
        }
        case 'summary': {
          const summaryHtml = block.data.text ? this._markdownToHtml(block.data.text) : '';
          return `<div style="border-left:4px solid #667eea;background:#f0f4ff;border-radius:0 6px 6px 0;padding:14px 18px;margin:12px 0;"><strong style="color:#667eea;text-transform:uppercase;font-size:0.8em;letter-spacing:0.05em;">Summary</strong>${summaryHtml}</div>`;
        }
        case 'mermaid': {
          const mermaidId = 'preview-mermaid-' + Math.random().toString(36).substr(2, 9);
          return `<div class="editor-mermaid-display" style="border:1px solid #e0e0e0;border-radius:6px;padding:20px;margin:10px 0;"><div class="editor-mermaid-badge" style="display:inline-block;padding:3px 10px;background:#ff6d00;color:white;font-size:0.75em;font-weight:700;text-transform:uppercase;border-radius:0 0 4px 0;margin-bottom:10px;">Mermaid</div><div class="mermaid" id="${mermaidId}">${this._escapeHtml(block.data.code || '')}</div></div>`;
        }
        case 'swagger': {
          const sUrl = block.data.url || '';
          const sTitle = block.data.title || 'API Documentation';
          return `<div style="border:1px solid #e0e0e0;border-radius:6px;padding:16px 18px;margin:10px 0;background:#f8fdf9;"><span style="display:inline-block;padding:3px 10px;background:#49cc90;color:white;font-size:0.75em;font-weight:700;text-transform:uppercase;border-radius:4px;margin-bottom:8px;">Swagger</span><div style="font-weight:600;">${this._escapeHtml(sTitle)}</div>${sUrl ? `<div style="font-size:0.82em;color:#49cc90;margin-top:4px;">${this._escapeHtml(sUrl)}</div>` : ''}</div>`;
        }
        case 'hero-banner': {
          const phbTitle = block.data.title || '';
          const phbSubtitle = block.data.subtitle || '';
          const phbImage = block.data.image || '';
          const phbAlign = block.data.imageAlign || 'right';
          const phbImgHtml = phbImage ? `<img src="${this._escapeHtml(this._resolveImageSrc(phbImage))}" alt="Hero" style="max-width:180px;max-height:120px;border-radius:6px;object-fit:cover;">` : '';
          return `<div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:32px 28px;border-radius:6px;margin:10px 0;display:flex;align-items:center;gap:24px;${phbAlign === 'left' ? 'flex-direction:row-reverse;' : ''}"><div style="flex:1;"><div style="font-size:1.8em;font-weight:700;">${this._escapeHtml(phbTitle)}</div><div style="font-size:1.1em;opacity:0.9;">${this._escapeHtml(phbSubtitle)}</div></div>${phbImgHtml}</div>`;
        }
        case 'cards': {
          const pcAcross = block.data.across || 3;
          const pcCards = block.data.cards || [];
          const pcHtml = pcCards.map(c => `<div style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:6px;padding:16px;"><div style="font-weight:600;margin-bottom:6px;">${this._escapeHtml(c.heading || '')}</div><div style="font-size:0.9em;color:#666;">${this._escapeHtml(c.description || '')}</div></div>`).join('');
          return `<div style="display:grid;grid-template-columns:repeat(${pcAcross},1fr);gap:14px;margin:10px 0;">${pcHtml}</div>`;
        }
        case 'site-header': {
          const pshIcon = block.data.icon || '';
          const pshTitle = block.data.title || '';
          const pshLinks = block.data.links || '';
          const pshIconHtml = pshIcon ? `<img src="${this._escapeHtml(this._resolveImageSrc(pshIcon))}" alt="Icon" style="width:32px;height:32px;object-fit:contain;border-radius:4px;">` : '';
          const pshLinksHtml = (pshLinks.match(/\[([^\]]*)\]\(([^)]*)\)/g) || []).map(m => { const p = m.match(/\[([^\]]*)\]\(([^)]*)\)/); return `<a href="${this._escapeHtml(p[2])}" style="color:rgba(255,255,255,0.85);text-decoration:none;font-size:0.9em;">${this._escapeHtml(p[1])}</a>`; }).join(' ');
          return `<div style="display:flex;align-items:center;gap:14px;padding:14px 20px;background:#1a1a2e;color:white;border-radius:6px;margin:10px 0;">${pshIconHtml}<div style="font-weight:700;font-size:1.1em;">${this._escapeHtml(pshTitle)}</div><div style="margin-left:auto;display:flex;gap:16px;">${pshLinksHtml}</div></div>`;
        }
        case 'site-footer': {
          const psfIcon = block.data.icon || '';
          const psfTitle = block.data.title || '';
          const psfSubtitle = block.data.subtitle || '';
          const psfLinks = block.data.links || '';
          const psfIconHtml = psfIcon ? `<img src="${this._escapeHtml(this._resolveImageSrc(psfIcon))}" alt="Icon" style="width:28px;height:28px;object-fit:contain;border-radius:4px;">` : '';
          const psfLinksHtml = (psfLinks.match(/\[([^\]]*)\]\(([^)]*)\)/g) || []).map(m => { const p = m.match(/\[([^\]]*)\]\(([^)]*)\)/); return `<a href="${this._escapeHtml(p[2])}" style="color:rgba(255,255,255,0.7);text-decoration:none;font-size:0.85em;">${this._escapeHtml(p[1])}</a>`; }).join(' ');
          return `<div style="display:flex;align-items:center;gap:14px;padding:18px 20px;background:#2d2d44;color:white;border-radius:6px;margin:10px 0;flex-wrap:wrap;">${psfIconHtml}<div style="flex:1;min-width:120px;"><div style="font-weight:700;">${this._escapeHtml(psfTitle)}</div><div style="font-size:0.82em;opacity:0.7;">${this._escapeHtml(psfSubtitle)}</div></div><div style="display:flex;gap:16px;flex-wrap:wrap;">${psfLinksHtml}</div></div>`;
        }
        case 'columns': {
          const pcLayout = block.data.layout || 'container';
          const pcLeft = block.data.left || '';
          const pcMiddle = block.data.middle || '';
          const pcRight = block.data.right || '';
          const gridCols = { 'container': '1fr 1fr', 'two-col-3-1': '3fr 1fr', 'two-col-1-3': '1fr 3fr', 'three-column': '1fr 1fr 1fr' }[pcLayout] || '1fr 1fr';
          const leftContent = pcLeft ? this._markdownToHtml(pcLeft) : '<em style="color:#aaa;">Empty</em>';
          const rightContent = pcRight ? this._markdownToHtml(pcRight) : '<em style="color:#aaa;">Empty</em>';
          const middleContent = pcMiddle ? this._markdownToHtml(pcMiddle) : '<em style="color:#aaa;">Empty</em>';
          const middleSec = pcLayout === 'three-column' ? `<div style="background:#f8f9fa;border:1px solid #e8e8e8;border-radius:4px;padding:12px;font-size:0.92em;line-height:1.5;">${middleContent}</div>` : '';
          return `<div style="margin:10px 0;"><div style="display:grid;grid-template-columns:${gridCols};gap:12px;">\
<div style="background:#f8f9fa;border:1px solid #e8e8e8;border-radius:4px;padding:12px;font-size:0.92em;line-height:1.5;">${leftContent}</div>\
${middleSec}\
<div style="background:#f8f9fa;border:1px solid #e8e8e8;border-radius:4px;padding:12px;font-size:0.92em;line-height:1.5;">${rightContent}</div>\
</div></div>`;
        }
        case 'table': {
          const headers = block.data.headers || [];
          const rows = block.data.rows || [];
          const thHtml = headers.map(h => `<th>${this._escapeHtml(h)}</th>`).join('');
          const trHtml = rows.map(row => {
            const tds = headers.map((_, ci) => `<td>${this._escapeHtml(row[ci] || '')}</td>`).join('');
            return `<tr>${tds}</tr>`;
          }).join('');
          return `<div class="preview-table"><table><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table></div>`;
        }
        default:
          return `<p>${html(block.data.text || '')}</p>`;
      }
    }

    /* ---------------------------------------------------------------
     *  Internal — Event Listeners
     * -------------------------------------------------------------*/

    _attachEventListeners() {
      const opts = { signal: this._abortController.signal };

      this._holder.addEventListener('click', (e) => this._handleBlockClick(e), opts);
      this._holder.addEventListener('keydown', (e) => this._handleKeyDown(e), opts);
      this._holder.addEventListener('input', (e) => this._handleInput(e), opts);
      this._holder.addEventListener('change', (e) => this._handleChange(e), opts);

      // Drag and drop
      this._holder.addEventListener('dragstart', (e) => this._handleDragStart(e), opts);
      this._holder.addEventListener('dragover', (e) => this._handleDragOver(e), opts);
      this._holder.addEventListener('dragleave', (e) => this._handleDragLeave(e), opts);
      this._holder.addEventListener('drop', (e) => this._handleDrop(e), opts);
      this._holder.addEventListener('dragend', (e) => this._handleDragEnd(e), opts);

      this._holder.addEventListener('mousedown', (e) => this._handleControlsMouseDown(e), opts);
      this._holder.addEventListener('click', (e) => this._handleBlockAddClick(e), opts);

      // Close menus on outside click
      document.addEventListener('click', (e) => {
        if (!this._blockAddMenu.contains(e.target) && !e.target.closest('.block-add-btn')) {
          this._closeBlockAddMenu();
        }
        if (this._slashMenuOpen && !this._slashMenu.contains(e.target) && !e.target.closest('[contenteditable]')) {
          this._closeSlashMenu();
        }
      }, opts);
    }

    _handleBlockClick(e) {
      if (e.target.dataset.role === 'image-edit') {
        e.preventDefault();
        e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-image-container');
          if (container) {
            container.classList.remove('collapsed');
            container.classList.add('editing');
            const srcInput = container.querySelector('.editor-image-src');
            if (srcInput) srcInput.focus();
          }
        }
        return;
      }

      if (e.target.dataset.role === 'image-apply') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const srcInput = blockEl.querySelector('.editor-image-src');
            const altInput = blockEl.querySelector('.editor-image-alt');
            block.data.src = srcInput.value;
            block.data.alt = altInput.value;
            this._updateImagePreview(blockEl, srcInput.value, altInput.value);
            const container = blockEl.querySelector('.editor-image-container');
            if (srcInput.value && container) {
              container.classList.remove('editing');
              container.classList.add('collapsed');
            }
            this._onChange();
          }
        }
        return;
      }

      // Link block: Edit button
      if (e.target.dataset.role === 'link-edit') {
        e.preventDefault();
        e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-link-container');
          if (container) {
            container.classList.remove('collapsed');
            container.classList.add('editing');
            const urlInput = container.querySelector('.editor-link-url-input');
            if (urlInput) urlInput.focus();
          }
        }
        return;
      }

      // Link block: Apply button
      if (e.target.dataset.role === 'link-apply') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const urlInput = blockEl.querySelector('.editor-link-url-input');
            const textInput = blockEl.querySelector('.editor-link-text-input');
            block.data.url = urlInput.value;
            block.data.text = textInput.value;
            // Update the preview
            const titleEl = blockEl.querySelector('.editor-link-title');
            const urlEl = blockEl.querySelector('.editor-link-url');
            if (titleEl) titleEl.textContent = textInput.value || urlInput.value || 'Untitled link';
            if (urlEl) urlEl.textContent = urlInput.value;
            else if (urlInput.value) {
              const infoEl = blockEl.querySelector('.editor-link-info');
              if (infoEl) infoEl.insertAdjacentHTML('beforeend', `<div class="editor-link-url">${this._escapeHtml(urlInput.value)}</div>`);
            }
            const container = blockEl.querySelector('.editor-link-container');
            if (urlInput.value && container) {
              container.classList.remove('editing');
              container.classList.add('collapsed');
            }
            this._onChange();
          }
        }
        return;
      }

      // Summary block: Edit button
      if (e.target.dataset.role === 'summary-edit') {
        e.preventDefault(); e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-summary-container');
          if (container) { container.classList.remove('collapsed'); container.classList.add('editing'); const ta = container.querySelector('.editor-summary-textarea'); if (ta) ta.focus(); }
        }
        return;
      }

      // Summary block: Save button
      if (e.target.dataset.role === 'summary-save') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const textarea = blockEl.querySelector('.editor-summary-textarea');
            block.data.text = textarea.value;
            const displayEl = blockEl.querySelector('.editor-summary-content');
            if (displayEl) displayEl.innerHTML = textarea.value ? this._markdownToHtml(textarea.value) : '<p style="color:#999;">Empty summary</p>';
            const container = blockEl.querySelector('.editor-summary-container');
            if (container) { container.classList.remove('editing'); container.classList.add('collapsed'); }
            this._onChange();
          }
        }
        return;
      }

      // Mermaid block: Edit button
      if (e.target.dataset.role === 'mermaid-edit') {
        e.preventDefault(); e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-mermaid-container');
          if (container) { container.classList.remove('collapsed'); container.classList.add('editing'); const ta = container.querySelector('.editor-mermaid-textarea'); if (ta) ta.focus(); }
        }
        return;
      }

      // Mermaid block: Save button
      if (e.target.dataset.role === 'mermaid-save') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const textarea = blockEl.querySelector('.editor-mermaid-textarea');
            block.data.code = textarea.value;
            const container = blockEl.querySelector('.editor-mermaid-container');
            if (container) { container.classList.remove('editing'); container.classList.add('collapsed'); }
            this._renderMermaidPreview(blockEl, textarea.value);
            this._onChange();
          }
        }
        return;
      }

      // Swagger block: Edit button
      if (e.target.dataset.role === 'swagger-edit') {
        e.preventDefault(); e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-swagger-container');
          if (container) { container.classList.remove('collapsed'); container.classList.add('editing'); const inp = container.querySelector('[data-role="swagger-url"]'); if (inp) inp.focus(); }
        }
        return;
      }

      // Swagger block: Apply button
      if (e.target.dataset.role === 'swagger-apply') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const urlInput = blockEl.querySelector('[data-role="swagger-url"]');
            const titleInput = blockEl.querySelector('[data-role="swagger-title"]');
            block.data.url = urlInput.value;
            block.data.title = titleInput.value;
            const titleEl = blockEl.querySelector('.editor-swagger-title');
            const urlEl = blockEl.querySelector('.editor-swagger-url');
            if (titleEl) titleEl.textContent = titleInput.value || 'API Documentation';
            if (urlEl) urlEl.textContent = urlInput.value;
            else if (urlInput.value) {
              const infoDiv = blockEl.querySelector('.editor-swagger-display > div:nth-child(2)');
              if (infoDiv) infoDiv.insertAdjacentHTML('beforeend', `<div class="editor-swagger-url">${this._escapeHtml(urlInput.value)}</div>`);
            }
            const container = blockEl.querySelector('.editor-swagger-container');
            if (urlInput.value && container) { container.classList.remove('editing'); container.classList.add('collapsed'); }
            this._renderSwaggerPreview(blockEl, urlInput.value);
            this._onChange();
          }
        }
        return;
      }

      // Hero Banner: Edit button
      if (e.target.dataset.role === 'hero-banner-edit') {
        e.preventDefault(); e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-hero-banner-container');
          if (container) { container.classList.remove('collapsed'); container.classList.add('editing'); const inp = container.querySelector('[data-role="hero-banner-title"]'); if (inp) inp.focus(); }
        }
        return;
      }

      // Hero Banner: Save button
      if (e.target.dataset.role === 'hero-banner-save') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const titleInput = blockEl.querySelector('[data-role="hero-banner-title"]');
            const subtitleInput = blockEl.querySelector('[data-role="hero-banner-subtitle"]');
            const imageInput = blockEl.querySelector('[data-role="hero-banner-image"]');
            const alignSelect = blockEl.querySelector('[data-role="hero-banner-align"]');
            block.data.title = titleInput.value;
            block.data.subtitle = subtitleInput.value;
            block.data.image = imageInput.value;
            block.data.imageAlign = alignSelect.value;
            // Update display
            const display = blockEl.querySelector('.editor-hero-banner-display');
            if (display) {
              display.className = 'editor-hero-banner-display align-' + alignSelect.value;
              const titleEl = display.querySelector('.editor-hero-banner-title');
              const subtitleEl = display.querySelector('.editor-hero-banner-subtitle');
              if (titleEl) titleEl.textContent = titleInput.value || 'Hero Title';
              if (subtitleEl) subtitleEl.textContent = subtitleInput.value;
              const existingImg = display.querySelector('.editor-hero-banner-image');
              if (imageInput.value) {
                if (existingImg) { existingImg.src = this._resolveImageSrc(imageInput.value); }
                else { display.insertAdjacentHTML('beforeend', `<img class="editor-hero-banner-image" src="${this._escapeHtml(this._resolveImageSrc(imageInput.value))}" alt="Hero image">`); }
              } else if (existingImg) { existingImg.remove(); }
            }
            const container = blockEl.querySelector('.editor-hero-banner-container');
            if (container) { container.classList.remove('editing'); container.classList.add('collapsed'); }
            this._onChange();
          }
        }
        return;
      }

      // Cards: Edit button
      if (e.target.dataset.role === 'cards-edit') {
        e.preventDefault(); e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-cards-container');
          if (container) { container.classList.remove('collapsed'); container.classList.add('editing'); }
        }
        return;
      }

      // Cards: Save button
      if (e.target.dataset.role === 'cards-save') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const acrossInput = blockEl.querySelector('[data-role="cards-across"]');
            block.data.across = parseInt(acrossInput.value) || 3;
            const cardEdits = blockEl.querySelectorAll('.editor-cards-card-edit');
            block.data.cards = Array.from(cardEdits).map(ce => ({
              heading: ce.querySelector('[data-role="cards-heading"]').value,
              description: ce.querySelector('[data-role="cards-desc"]').value
            }));
            // Re-render display
            const grid = blockEl.querySelector('.editor-cards-grid');
            if (grid) {
              grid.style.gridTemplateColumns = `repeat(${block.data.across}, 1fr)`;
              grid.innerHTML = block.data.cards.map(c => `
                <div class="editor-cards-card">
                  <div class="editor-cards-card-heading">${this._escapeHtml(c.heading) || 'Untitled'}</div>
                  <div class="editor-cards-card-desc">${this._escapeHtml(c.description)}</div>
                </div>
              `).join('');
            }
            const container = blockEl.querySelector('.editor-cards-container');
            if (container) { container.classList.remove('editing'); container.classList.add('collapsed'); }
            this._onChange();
          }
        }
        return;
      }

      // Cards: Add card
      if (e.target.dataset.role === 'cards-add-card') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const editList = blockEl.querySelector('.editor-cards-edit-list');
          const cardCount = editList.querySelectorAll('.editor-cards-card-edit').length;
          const cardEl = document.createElement('div');
          cardEl.className = 'editor-cards-card-edit';
          cardEl.dataset.cardIndex = cardCount;
          cardEl.innerHTML = `<input type="text" data-role="cards-heading" data-card="${cardCount}" value="" placeholder="Card heading"><textarea data-role="cards-desc" data-card="${cardCount}" placeholder="Card description"></textarea>`;
          editList.appendChild(cardEl);
        }
        return;
      }

      // Cards: Remove card
      if (e.target.dataset.role === 'cards-remove-card') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const editList = blockEl.querySelector('.editor-cards-edit-list');
          const cards = editList.querySelectorAll('.editor-cards-card-edit');
          if (cards.length > 1) cards[cards.length - 1].remove();
        }
        return;
      }

      // Site Header: Edit button
      if (e.target.dataset.role === 'site-header-edit') {
        e.preventDefault(); e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-site-header-container');
          if (container) { container.classList.remove('collapsed'); container.classList.add('editing'); const inp = container.querySelector('[data-role="site-header-title"]'); if (inp) inp.focus(); }
        }
        return;
      }

      // Site Header: Save button
      if (e.target.dataset.role === 'site-header-save') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const iconInput = blockEl.querySelector('[data-role="site-header-icon"]');
            const titleInput = blockEl.querySelector('[data-role="site-header-title"]');
            const linksInput = blockEl.querySelector('[data-role="site-header-links"]');
            block.data.icon = iconInput.value;
            block.data.title = titleInput.value;
            block.data.links = linksInput.value;
            // Update display
            const display = blockEl.querySelector('.editor-site-header-display');
            if (display) {
              const titleEl = display.querySelector('.editor-site-header-title');
              if (titleEl) titleEl.textContent = titleInput.value || 'Site Header';
              const existingIcon = display.querySelector('.editor-site-header-icon');
              if (iconInput.value) {
                if (existingIcon) existingIcon.src = this._resolveImageSrc(iconInput.value);
                else display.insertAdjacentHTML('afterbegin', `<img class="editor-site-header-icon" src="${this._escapeHtml(this._resolveImageSrc(iconInput.value))}" alt="Icon">`);
              } else if (existingIcon) existingIcon.remove();
              const linksEl = display.querySelector('.editor-site-header-links');
              if (linksEl) {
                linksEl.innerHTML = (linksInput.value.match(/\[([^\]]*)\]\(([^)]*)\)/g) || []).map(m => { const p = m.match(/\[([^\]]*)\]\(([^)]*)\)/); return `<a href="${this._escapeHtml(p[2])}">${this._escapeHtml(p[1])}</a>`; }).join('');
              }
            }
            const container = blockEl.querySelector('.editor-site-header-container');
            if (container) { container.classList.remove('editing'); container.classList.add('collapsed'); }
            this._onChange();
          }
        }
        return;
      }

      // Site Footer: Edit button
      if (e.target.dataset.role === 'site-footer-edit') {
        e.preventDefault(); e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-site-footer-container');
          if (container) { container.classList.remove('collapsed'); container.classList.add('editing'); const inp = container.querySelector('[data-role="site-footer-title"]'); if (inp) inp.focus(); }
        }
        return;
      }

      // Site Footer: Save button
      if (e.target.dataset.role === 'site-footer-save') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const iconInput = blockEl.querySelector('[data-role="site-footer-icon"]');
            const titleInput = blockEl.querySelector('[data-role="site-footer-title"]');
            const subtitleInput = blockEl.querySelector('[data-role="site-footer-subtitle"]');
            const linksInput = blockEl.querySelector('[data-role="site-footer-links"]');
            block.data.icon = iconInput.value;
            block.data.title = titleInput.value;
            block.data.subtitle = subtitleInput.value;
            block.data.links = linksInput.value;
            // Update display
            const display = blockEl.querySelector('.editor-site-footer-display');
            if (display) {
              const titleEl = display.querySelector('.editor-site-footer-title');
              const subtitleEl = display.querySelector('.editor-site-footer-subtitle');
              if (titleEl) titleEl.textContent = titleInput.value || 'Site Footer';
              if (subtitleEl) subtitleEl.textContent = subtitleInput.value;
              const existingIcon = display.querySelector('.editor-site-footer-icon');
              if (iconInput.value) {
                if (existingIcon) existingIcon.src = this._resolveImageSrc(iconInput.value);
                else display.insertAdjacentHTML('afterbegin', `<img class="editor-site-footer-icon" src="${this._escapeHtml(this._resolveImageSrc(iconInput.value))}" alt="Icon">`);
              } else if (existingIcon) existingIcon.remove();
              const linksEl = display.querySelector('.editor-site-footer-links');
              if (linksEl) {
                linksEl.innerHTML = (linksInput.value.match(/\[([^\]]*)\]\(([^)]*)\)/g) || []).map(m => { const p = m.match(/\[([^\]]*)\]\(([^)]*)\)/); return `<a href="${this._escapeHtml(p[2])}">${this._escapeHtml(p[1])}</a>`; }).join('');
              }
            }
            const container = blockEl.querySelector('.editor-site-footer-container');
            if (container) { container.classList.remove('editing'); container.classList.add('collapsed'); }
            this._onChange();
          }
        }
        return;
      }

      // Columns: Edit button
      if (e.target.dataset.role === 'columns-edit') {
        e.preventDefault(); e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-columns-container');
          if (container) { container.classList.remove('collapsed'); container.classList.add('editing'); const ta = container.querySelector('[data-role="columns-left"]'); if (ta) ta.focus(); }
        }
        return;
      }

      // Columns: Save button
      if (e.target.dataset.role === 'columns-save') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const leftTA = blockEl.querySelector('[data-role="columns-left"]');
            const middleTA = blockEl.querySelector('[data-role="columns-middle"]');
            const rightTA = blockEl.querySelector('[data-role="columns-right"]');
            block.data.left = leftTA ? leftTA.value : '';
            block.data.middle = middleTA ? middleTA.value : '';
            block.data.right = rightTA ? rightTA.value : '';
            // Re-render display
            this._renderBlockContent(blockEl, 'columns', block.data);
            const container = blockEl.querySelector('.editor-columns-container');
            if (container) { container.classList.remove('editing'); container.classList.add('collapsed'); }
            this._onChange();
          }
        }
        return;
      }

      // Columns: Layout picker
      if (e.target.dataset.role === 'columns-layout' || (e.target.closest('[data-role="columns-layout"]'))) {
        e.preventDefault();
        const btn = e.target.dataset.role === 'columns-layout' ? e.target : e.target.closest('[data-role="columns-layout"]');
        const blockEl = btn.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const newLayout = btn.dataset.layout;
            block.data.layout = newLayout;
            // Update active state on layout buttons
            const allBtns = blockEl.querySelectorAll('.editor-columns-layout-btn');
            allBtns.forEach(b => b.classList.toggle('active', b.dataset.layout === newLayout));
            // Show/hide middle textarea
            const middleGroup = blockEl.querySelector('.editor-columns-middle-group');
            if (middleGroup) {
              if (newLayout === 'three-column') middleGroup.classList.add('visible');
              else middleGroup.classList.remove('visible');
            }
          }
        }
        return;
      }

      // Code block: Edit button (from block controls)
      if (e.target.dataset.role === 'code-edit') {
        e.preventDefault();
        e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-code-container');
          if (container) {
            container.classList.remove('collapsed');
            container.classList.add('editing');
            const textarea = container.querySelector('.editor-code-textarea');
            if (textarea) textarea.focus();
          }
        }
        return;
      }

      // Code block: Save button
      if (e.target.dataset.role === 'code-save') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            const textarea = blockEl.querySelector('.editor-code-textarea');
            const langSelect = blockEl.querySelector('.editor-code-lang-select');
            block.data.code = textarea.value;
            block.data.language = langSelect.value;

            // Update the display view
            const codeEl = blockEl.querySelector('.editor-code-body code');
            const linesEl = blockEl.querySelector('.editor-code-lines');
            const badge = blockEl.querySelector('.editor-code-lang-badge');
            const codeLines = textarea.value ? textarea.value.split('\n') : [''];
            if (codeEl) {
              codeEl.textContent = textarea.value || '\n';
              // Update language class for hljs
              codeEl.className = 'language-' + langSelect.value;
            }
            if (linesEl) linesEl.innerHTML = codeLines.map((_, i) => `<span class="editor-code-line-num">${i + 1}</span>`).join('');
            if (badge) badge.textContent = langSelect.value;

            // Collapse and re-highlight
            const container = blockEl.querySelector('.editor-code-container');
            if (container) {
              container.classList.remove('editing');
              container.classList.add('collapsed');
            }
            this._highlightCode(blockEl);
            this._onChange();
          }
        }
        return;
      }

      // Table block: Edit button
      if (e.target.dataset.role === 'table-edit') {
        e.preventDefault();
        e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const container = blockEl.querySelector('.editor-table-container');
          if (container) {
            container.classList.remove('collapsed');
            container.classList.add('editing');
            const firstInput = container.querySelector('.editor-table-cell-input');
            if (firstInput) firstInput.focus();
          }
        }
        return;
      }

      // Table block: Save button
      if (e.target.dataset.role === 'table-save') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            this._saveTableFromGrid(blockEl, block);
          }
        }
        return;
      }

      // Table block: Add row
      if (e.target.dataset.role === 'table-add-row') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const grid = blockEl.querySelector('.editor-table-grid');
          const colCount = grid.querySelector('.header-row').querySelectorAll('input').length;
          const rowCount = grid.querySelectorAll('.editor-table-row:not(.header-row)').length;
          const row = document.createElement('div');
          row.className = 'editor-table-row';
          row.dataset.row = rowCount;
          for (let ci = 0; ci < colCount; ci++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'editor-table-cell-input';
            input.dataset.role = 'table-cell-input';
            input.dataset.row = rowCount;
            input.dataset.col = ci;
            input.placeholder = 'Cell';
            row.appendChild(input);
          }
          grid.appendChild(row);
        }
        return;
      }

      // Table block: Remove row
      if (e.target.dataset.role === 'table-remove-row') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const grid = blockEl.querySelector('.editor-table-grid');
          const dataRows = grid.querySelectorAll('.editor-table-row:not(.header-row)');
          if (dataRows.length > 1) {
            dataRows[dataRows.length - 1].remove();
          }
        }
        return;
      }

      // Table block: Add column
      if (e.target.dataset.role === 'table-add-col') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const grid = blockEl.querySelector('.editor-table-grid');
          const allRows = grid.querySelectorAll('.editor-table-row');
          allRows.forEach((row, ri) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'editor-table-cell-input';
            input.placeholder = ri === 0 ? 'Header' : 'Cell';
            input.dataset.role = ri === 0 ? 'table-header-input' : 'table-cell-input';
            input.dataset.col = row.querySelectorAll('input').length;
            if (ri > 0) input.dataset.row = ri - 1;
            row.appendChild(input);
          });
        }
        return;
      }

      // Table block: Remove column
      if (e.target.dataset.role === 'table-remove-col') {
        e.preventDefault();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const grid = blockEl.querySelector('.editor-table-grid');
          const allRows = grid.querySelectorAll('.editor-table-row');
          const colCount = allRows[0].querySelectorAll('input').length;
          if (colCount > 1) {
            allRows.forEach(row => {
              const inputs = row.querySelectorAll('input');
              inputs[inputs.length - 1].remove();
            });
          }
        }
        return;
      }

      const blockEl = e.target.closest('.editor-block');
      if (blockEl) {
        const index = parseInt(blockEl.dataset.index);
        this._currentBlockIndex = index;
        this._selectBlock(blockEl);
      }
    }

    _selectBlock(blockEl) {
      this._holder.querySelectorAll('.editor-block').forEach(b => b.classList.remove('selected'));
      blockEl.classList.add('selected');
    }

    _handleKeyDown(e) {
      const blockEl = e.target.closest('.editor-block');
      if (!blockEl) return;

      const blockIndex = parseInt(blockEl.dataset.index);
      const blockType = blockEl.dataset.type;
      const target = e.target;

      // Code textarea: allow all default key behavior, only handle Tab for indentation
      if (target.dataset.role === 'code-textarea') {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = target.selectionStart;
          const end = target.selectionEnd;
          target.value = target.value.substring(0, start) + '  ' + target.value.substring(end);
          target.selectionStart = target.selectionEnd = start + 2;
          target.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      // Inline formatting shortcuts
      if ((e.ctrlKey || e.metaKey) && target.isContentEditable) {
        if (e.key === 'b') { e.preventDefault(); document.execCommand('bold', false, null); target.dispatchEvent(new Event('input', { bubbles: true })); return; }
        if (e.key === 'i') { e.preventDefault(); document.execCommand('italic', false, null); target.dispatchEvent(new Event('input', { bubbles: true })); return; }
        if (e.key === 'u') { e.preventDefault(); document.execCommand('underline', false, null); target.dispatchEvent(new Event('input', { bubbles: true })); return; }
      }

      // Slash command
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && target.isContentEditable) {
        if (target.textContent.trim() === '' || this._getCaretPosition(target) === 0) {
          e.preventDefault();
          this._showSlashMenu(e, blockIndex);
          return;
        }
      }

      // List item handling
      if (blockType === 'list' && target.classList.contains('editor-list-item')) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const itemIndex = parseInt(target.dataset.index);
          const newItem = document.createElement('li');
          newItem.className = 'editor-list-item';
          newItem.contentEditable = 'true';
          newItem.dataset.index = itemIndex + 1;
          newItem.textContent = '';
          const items = blockEl.querySelectorAll('.editor-list-item');
          items.forEach((item, i) => { if (i > itemIndex) item.dataset.index = parseInt(item.dataset.index) + 1; });
          target.parentNode.insertBefore(newItem, target.nextSibling);
          newItem.focus();
          return;
        }
        if (e.key === 'Backspace') {
          const isEmpty = !target.textContent.trim();
          const isAtStart = this._getCaretPosition(target) === 0;
          const items = blockEl.querySelectorAll('.editor-list-item');
          if (isEmpty && items.length > 1 && isAtStart) {
            e.preventDefault();
            target.remove();
            blockEl.querySelectorAll('.editor-list-item').forEach((item, i) => { item.dataset.index = i; });
            this._handleInput({ target: blockEl });
            return;
          }
        }
        return;
      }

      // Don't intercept keys on input/textarea/select inside block editors (link, image, table, code)
      const tagName = target.tagName;
      if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return;

      // Enter — new block
      if (e.key === 'Enter' && !e.shiftKey) {
        if (blockType === 'code' || blockType === 'table') return;
        if (blockType === 'checklist' && target.classList.contains('editor-checkbox')) return;
        e.preventDefault();
        const newIndex = blockIndex + 1;
        this._insertBlock('paragraph', { text: '' }, newIndex);
        setTimeout(() => {
          const newBlock = this._blocks.find(b => b.index === newIndex);
          if (newBlock && newBlock.contentElement) newBlock.contentElement.focus();
        }, 0);
        return;
      }

      // Backspace
      if (e.key === 'Backspace') {
        const isEmpty = !target.textContent.trim();
        const isAtStart = this._getCaretPosition(target) === 0;
        if (isEmpty && this._blocks.length > 1) { e.preventDefault(); this._deleteBlock(blockIndex); return; }
        if (isAtStart && blockIndex > 0 && blockType === 'paragraph') { e.preventDefault(); this._mergeWithPrevious(blockIndex); return; }
      }

      // Tab
      if (e.key === 'Tab') {
        e.preventDefault();
        const direction = e.shiftKey ? -1 : 1;
        const nextIndex = blockIndex + direction;
        if (nextIndex >= 0 && nextIndex < this._blocks.length) {
          const nb = this._blocks[nextIndex];
          if (nb.contentElement) nb.contentElement.focus();
        }
        return;
      }

      // Delete empty
      if (e.key === 'Delete' && blockType === 'paragraph') {
        if (!target.textContent.trim() && this._blocks.length > 1) { e.preventDefault(); this._deleteBlock(blockIndex); return; }
      }
    }

    _handleInput(e) {
      const blockEl = e.target.closest('.editor-block');
      if (!blockEl) return;

      const blockIndex = parseInt(blockEl.dataset.index);
      const block = this._blocks[blockIndex];
      if (!block) return;

      const blockType = blockEl.dataset.type;
      const target = e.target;

      switch (blockType) {
        case 'paragraph':
          block.data.text = target.innerHTML;
          {
            const imgMatch = target.textContent.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (imgMatch) {
              block.type = 'image';
              block.data = { alt: imgMatch[1], src: imgMatch[2] };
              blockEl.dataset.type = 'image';
              this._renderBlockContent(blockEl, 'image', block.data);
              block.contentElement = blockEl.querySelector('input, [contenteditable]');
            }
            const linkMatch = target.textContent.trim().match(/^\[([^\]]*)\]\(([^)]+)\)$/);
            if (linkMatch) {
              block.type = 'link';
              block.data = { text: linkMatch[1], url: linkMatch[2] };
              blockEl.dataset.type = 'link';
              this._renderBlockContent(blockEl, 'link', block.data);
              block.contentElement = blockEl.querySelector('input, [contenteditable]');
            }
          }
          break;
        case 'header':
        case 'quote':
          block.data.text = target.innerHTML;
          break;
        case 'code':
          if (target.dataset.role === 'code-textarea') {
            block.data.code = target.value;
          } else if (target.dataset.role === 'code-lang') {
            block.data.language = target.value;
          }
          break;
        case 'list': {
          const items = Array.from(blockEl.querySelectorAll('.editor-list-item')).map(li => li.textContent);
          block.data.items = items;
          break;
        }
        case 'checklist':
          if (target.classList.contains('editor-checklist-text')) {
            const items = Array.from(blockEl.querySelectorAll('.editor-checklist-item')).map(item => {
              const checkbox = item.querySelector('input');
              const text = item.querySelector('.editor-checklist-text').textContent;
              return { text, checked: checkbox.checked };
            });
            block.data.items = items;
          }
          break;
        case 'image':
          if (target.dataset.role === 'image-src' || target.dataset.role === 'image-alt') {
            const srcInput = blockEl.querySelector('.editor-image-src');
            const altInput = blockEl.querySelector('.editor-image-alt');
            block.data.src = srcInput.value;
            block.data.alt = altInput.value;
            const img = blockEl.querySelector('.editor-image');
            const placeholder = blockEl.querySelector('.editor-image-placeholder');
            const error = blockEl.querySelector('.editor-image-error');
            if (srcInput.value) {
              if (img) { img.style.display = 'block'; img.src = this._resolveImageSrc(srcInput.value); img.alt = altInput.value; }
              if (placeholder) placeholder.style.display = 'none';
              if (error) error.style.display = 'none';
            } else {
              if (img) img.style.display = 'none';
              if (error) error.style.display = 'none';
              if (placeholder) placeholder.style.display = 'flex';
            }
          }
          break;
        case 'link':
          if (target.dataset.role === 'link-url' || target.dataset.role === 'link-text') {
            const urlInput = blockEl.querySelector('.editor-link-url-input');
            const textInput = blockEl.querySelector('.editor-link-text-input');
            block.data.url = urlInput.value;
            block.data.text = textInput.value;
          }
          break;
        case 'summary':
          if (target.dataset.role === 'summary-textarea') block.data.text = target.value;
          break;
        case 'mermaid':
          if (target.dataset.role === 'mermaid-textarea') block.data.code = target.value;
          break;
        case 'swagger':
          if (target.dataset.role === 'swagger-url') block.data.url = target.value;
          if (target.dataset.role === 'swagger-title') block.data.title = target.value;
          break;
        case 'hero-banner':
          if (target.dataset.role === 'hero-banner-title') block.data.title = target.value;
          if (target.dataset.role === 'hero-banner-subtitle') block.data.subtitle = target.value;
          if (target.dataset.role === 'hero-banner-image') block.data.image = target.value;
          if (target.dataset.role === 'hero-banner-align') block.data.imageAlign = target.value;
          break;
        case 'cards':
          if (target.dataset.role === 'cards-across') block.data.across = parseInt(target.value) || 3;
          if (target.dataset.role === 'cards-heading') {
            const ci = parseInt(target.dataset.card);
            if (block.data.cards[ci]) block.data.cards[ci].heading = target.value;
          }
          if (target.dataset.role === 'cards-desc') {
            const ci = parseInt(target.dataset.card);
            if (block.data.cards[ci]) block.data.cards[ci].description = target.value;
          }
          break;
        case 'site-header':
          if (target.dataset.role === 'site-header-icon') block.data.icon = target.value;
          if (target.dataset.role === 'site-header-title') block.data.title = target.value;
          if (target.dataset.role === 'site-header-links') block.data.links = target.value;
          break;
        case 'site-footer':
          if (target.dataset.role === 'site-footer-icon') block.data.icon = target.value;
          if (target.dataset.role === 'site-footer-title') block.data.title = target.value;
          if (target.dataset.role === 'site-footer-subtitle') block.data.subtitle = target.value;
          if (target.dataset.role === 'site-footer-links') block.data.links = target.value;
          break;
        case 'columns':
          if (target.dataset.role === 'columns-left') block.data.left = target.value;
          if (target.dataset.role === 'columns-middle') block.data.middle = target.value;
          if (target.dataset.role === 'columns-right') block.data.right = target.value;
          break;
      }

      this._onChange();
    }

    _handleChange(e) {
      if (e.target.classList.contains('editor-checkbox')) {
        const blockEl = e.target.closest('.editor-block');
        const blockIndex = parseInt(blockEl.dataset.index);
        const block = this._blocks[blockIndex];
        const items = Array.from(blockEl.querySelectorAll('.editor-checklist-item')).map(item => {
          const checkbox = item.querySelector('input');
          const text = item.querySelector('.editor-checklist-text').textContent;
          return { text, checked: checkbox.checked };
        });
        block.data.items = items;
        this._onChange();
      }
      // Language select change
      if (e.target.dataset.role === 'code-lang') {
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          const block = this._blocks[blockIndex];
          if (block) {
            block.data.language = e.target.value;
            this._onChange();
          }
        }
      }
    }

    /* ---------------------------------------------------------------
     *  Internal — Block operations
     * -------------------------------------------------------------*/

    _insertBlock(type, data, index) {
      if (index === null || index === undefined) index = this._blocks.length;

      this._blocks.slice(index).forEach(block => {
        block.index++;
        block.element.dataset.index = block.index;
      });

      const newBlock = { index, type, data };
      const blockEl = document.createElement('div');
      blockEl.className = 'editor-block';
      blockEl.dataset.type = type;
      blockEl.dataset.index = index;
      this._renderBlockContent(blockEl, type, data);

      if (index < this._blocks.length) {
        this._blocks[index].element.parentNode.insertBefore(blockEl, this._blocks[index].element);
      } else {
        this._holder.appendChild(blockEl);
      }

      newBlock.element = blockEl;
      newBlock.contentElement = blockEl.querySelector('[contenteditable], textarea, code, input, span');
      this._blocks.splice(index, 0, newBlock);
      this._data.blocks.splice(index, 0, { type, data });
      this._onChange();
    }

    _deleteBlock(index) {
      if (this._blocks.length <= 1) return;
      const block = this._blocks[index];
      if (block && block.element) block.element.remove();
      this._blocks.splice(index, 1);
      this._data.blocks.splice(index, 1);
      this._blocks.slice(index).forEach((b, i) => { b.index = index + i; b.element.dataset.index = b.index; });
      const focusIndex = Math.min(index, this._blocks.length - 1);
      const focusBlock = this._blocks[focusIndex];
      if (focusBlock && focusBlock.contentElement) focusBlock.contentElement.focus();
      this._onChange();
    }

    _convertBlock(fromIndex, toType, preserveText) {
      const fromBlock = this._blocks[fromIndex];
      if (!fromBlock) return;

      let newData = this._getDefaultData(toType);
      if (preserveText && fromBlock.data.text) {
        if (toType === 'list') newData = { items: [fromBlock.data.text], style: 'unordered' };
        else if (toType === 'code') newData = { code: fromBlock.data.text, language: 'plain' };
        else if (toType === 'header') newData = { text: fromBlock.data.text, level: 2 };
        else if (toType === 'table') newData = { headers: ['Column 1', 'Column 2'], rows: [[fromBlock.data.text, '']] };
        else if (toType === 'hero-banner') newData = { title: fromBlock.data.text, subtitle: '', image: '', imageAlign: 'right' };
        else if (toType === 'cards') newData = { across: 3, cards: [{ heading: fromBlock.data.text, description: '' }] };
        else if (toType === 'site-header') newData = { icon: '', title: fromBlock.data.text, links: '' };
        else if (toType === 'site-footer') newData = { icon: '', title: fromBlock.data.text, subtitle: '', links: '' };
        else if (toType === 'columns') newData = { layout: 'container', left: fromBlock.data.text || '', middle: '', right: '' };
        else newData = { text: fromBlock.data.text };
      }

      fromBlock.element.remove();
      fromBlock.type = toType;
      fromBlock.data = newData;

      const blockEl = document.createElement('div');
      blockEl.className = 'editor-block';
      blockEl.dataset.type = toType;
      blockEl.dataset.index = fromIndex;
      this._renderBlockContent(blockEl, toType, newData);

      if (fromIndex < this._blocks.length - 1) {
        this._blocks[fromIndex + 1].element.parentNode.insertBefore(blockEl, this._blocks[fromIndex + 1].element);
      } else {
        this._holder.appendChild(blockEl);
      }

      fromBlock.element = blockEl;
      fromBlock.contentElement = blockEl.querySelector('[contenteditable], textarea, code, input, span');
      this._data.blocks[fromIndex] = { type: toType, data: newData };
      this._onChange();
    }

    _mergeWithPrevious(index) {
      if (index === 0) return;
      const currentBlock = this._blocks[index];
      const previousBlock = this._blocks[index - 1];
      if (previousBlock.type === 'paragraph' && currentBlock.type === 'paragraph') {
        previousBlock.data.text = (previousBlock.data.text || '') + currentBlock.data.text;
        previousBlock.contentElement.textContent = previousBlock.data.text;
        this._deleteBlock(index);
        if (previousBlock.contentElement) previousBlock.contentElement.focus();
      }
    }

    _getDefaultData(type) {
      switch (type) {
        case 'header': return { text: '', level: 2 };
        case 'list': return { items: [''], style: 'unordered' };
        case 'code': return { code: '', language: 'plain' };
        case 'checklist': return { items: [{ text: '', checked: false }] };
        case 'quote': return { text: '' };
        case 'image': return { src: '', alt: '' };
        case 'link': return { url: '', text: '' };
        case 'summary': return { text: '' };
        case 'mermaid': return { code: '' };
        case 'swagger': return { url: '', title: '' };
        case 'hero-banner': return { title: '', subtitle: '', image: '', imageAlign: 'right' };
        case 'cards': return { across: 3, cards: [{ heading: '', description: '' }] };
        case 'site-header': return { icon: '', title: '', links: '' };
        case 'site-footer': return { icon: '', title: '', subtitle: '', links: '' };
        case 'columns': return { layout: 'container', left: '', middle: '', right: '' };
        case 'table': return { headers: ['Column 1', 'Column 2'], rows: [['', '']] };
        case 'paragraph': default: return { text: '' };
      }
    }

    /* ---------------------------------------------------------------
     *  Internal — Drag & Drop
     * -------------------------------------------------------------*/

    _handleControlsMouseDown(e) {
      if (e.target.classList.contains('block-drag-handle')) {
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) { blockEl.draggable = true; blockEl.style.cursor = 'grabbing'; }
      }
    }

    _handleDragStart(e) {
      const blockEl = e.target.closest('.editor-block');
      if (blockEl && blockEl.draggable) {
        this._dragSourceIndex = parseInt(blockEl.dataset.index);
        blockEl.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', blockEl.innerHTML);
      }
    }

    _handleDragOver(e) {
      if (this._dragSourceIndex === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const blockEl = e.target.closest('.editor-block');
      if (blockEl && blockEl !== this._blocks[this._dragSourceIndex].element) {
        const rect = blockEl.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        this._blocks.forEach(b => b.element.classList.remove('drag-over-above', 'drag-over-below'));
        if (e.clientY < midpoint) blockEl.classList.add('drag-over-above');
        else blockEl.classList.add('drag-over-below');
      }
    }

    _handleDragLeave(e) {
      const blockEl = e.target.closest('.editor-block');
      if (blockEl) blockEl.classList.remove('drag-over-above', 'drag-over-below');
    }

    _handleDrop(e) {
      e.preventDefault();
      if (this._dragSourceIndex === null) return;
      const blockEl = e.target.closest('.editor-block');
      if (blockEl) {
        const targetIndex = parseInt(blockEl.dataset.index);
        const rect = blockEl.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        let newIndex = targetIndex;
        if (e.clientY >= midpoint && targetIndex < this._blocks.length - 1) newIndex = targetIndex + 1;
        if (newIndex !== this._dragSourceIndex) this._moveBlock(this._dragSourceIndex, newIndex);
      }
      this._dragSourceIndex = null;
    }

    _handleDragEnd() {
      this._blocks.forEach(block => {
        block.element.draggable = false;
        block.element.classList.remove('dragging', 'drag-over-above', 'drag-over-below');
        block.element.style.cursor = 'auto';
      });
      this._dragSourceIndex = null;
    }

    _moveBlock(fromIndex, toIndex) {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= this._blocks.length || toIndex > this._blocks.length) return;
      const [movedBlock] = this._blocks.splice(fromIndex, 1);
      this._blocks.splice(toIndex, 0, movedBlock);
      const [movedData] = this._data.blocks.splice(fromIndex, 1);
      this._data.blocks.splice(toIndex, 0, movedData);
      const blockElements = this._blocks.map(b => b.element);
      this._holder.innerHTML = '';
      blockElements.forEach((el, i) => {
        el.dataset.index = i;
        const block = this._blocks.find(b => b.element === el);
        if (block) block.index = i;
        this._holder.appendChild(el);
      });
      this._onChange();
    }

    /* ---------------------------------------------------------------
     *  Internal — Block Add Menu
     * -------------------------------------------------------------*/

    _showBlockAddMenu(button, blockIndex) {
      const rect = button.getBoundingClientRect();
      // Reset panels first so we can measure correct height
      this._blockAddMenu.querySelectorAll('.block-add-panel').forEach(p => p.classList.add('hidden'));
      this._blockAddMenu.querySelector('.block-add-panel[data-panel="main"]').classList.remove('hidden');
      this._blockAddMenu.classList.remove('hidden');
      this._blockAddMenu.dataset.blockIndex = blockIndex;

      // Measure the menu and decide direction
      const menuRect = this._blockAddMenu.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 10;
      const spaceAbove = rect.top - 10;

      let top;
      if (spaceBelow >= menuRect.height || spaceBelow >= spaceAbove) {
        // Place below
        top = rect.bottom + 5;
      } else {
        // Place above
        top = rect.top - menuRect.height - 5;
      }

      let left = rect.left;
      if (left + menuRect.width > window.innerWidth) left = window.innerWidth - menuRect.width - 10;

      this._blockAddMenu.style.top = Math.max(5, top) + 'px';
      this._blockAddMenu.style.left = Math.max(5, left) + 'px';
    }

    _closeBlockAddMenu() {
      this._blockAddMenu.classList.add('hidden');
    }

    _switchBlockAddPanel(panelName) {
      this._blockAddMenu.querySelectorAll('.block-add-panel').forEach(p => p.classList.add('hidden'));
      const panel = this._blockAddMenu.querySelector(`.block-add-panel[data-panel="${panelName}"]`);
      if (panel) panel.classList.remove('hidden');
    }

    _handleBlockAddClick(e) {
      if (e.target.classList.contains('block-add-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) {
          const blockIndex = parseInt(blockEl.dataset.index);
          this._showBlockAddMenu(e.target, blockIndex);

          this._blockAddMenu.querySelectorAll('.block-add-menu-item').forEach(item => {
            item.onclick = (evt) => {
              evt.stopPropagation();
              if (item.dataset.action === 'open-headings') { this._switchBlockAddPanel('headings'); return; }
              if (item.dataset.action === 'open-emphasis') { this._switchBlockAddPanel('emphasis'); return; }
              if (item.dataset.action === 'open-lists') { this._switchBlockAddPanel('lists'); return; }
              if (item.dataset.action === 'open-code-advanced') { this._switchBlockAddPanel('code-advanced'); return; }
              if (item.dataset.action === 'open-layout') { this._switchBlockAddPanel('layout'); return; }
              if (item.dataset.format) { this._applyInlineFormat(item.dataset.format); this._closeBlockAddMenu(); return; }
              if (item.dataset.action === 'back') { this._switchBlockAddPanel('main'); return; }

              let type = item.dataset.type;
              if (!type) return;
              let data;
              const headerMatch = type.match(/^header-(\d)$/);
              if (headerMatch) { type = 'header'; data = { text: '', level: parseInt(headerMatch[1]) }; }
              else if (type === 'list-ordered') { type = 'list'; data = { items: [''], style: 'ordered' }; }
              else if (type === 'list-unordered') { type = 'list'; data = { items: [''], style: 'unordered' }; }
              else { data = this._getDefaultData(type); }

              const newIndex = blockIndex + 1;
              this._insertBlock(type, data, newIndex);
              this._closeBlockAddMenu();
              setTimeout(() => {
                const newBlock = this._blocks.find(b => b.index === newIndex);
                if (newBlock && newBlock.contentElement) newBlock.contentElement.focus();
              }, 0);
            };
          });
        }
      }

      if (e.target.classList.contains('block-delete-btn')) {
        e.preventDefault();
        e.stopPropagation();
        const blockEl = e.target.closest('.editor-block');
        if (blockEl) this._deleteBlock(parseInt(blockEl.dataset.index));
      }
    }

    /* ---------------------------------------------------------------
     *  Internal — Slash Commands
     * -------------------------------------------------------------*/

    _initSlashCommands() {
      const opts = { signal: this._abortController.signal };
      const slashMenu = this._slashMenu;

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (!this._slashMenuOpen) return;

        const items = this._getSlashActiveItems();
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this._slashMenuSelectedIndex = (this._slashMenuSelectedIndex + 1) % items.length;
          this._updateSlashMenuSelection(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this._slashMenuSelectedIndex = (this._slashMenuSelectedIndex - 1 + items.length) % items.length;
          this._updateSlashMenuSelection(items);
        } else if (e.key === 'Enter' || e.key === 'ArrowRight') {
          e.preventDefault();
          const selected = items[this._slashMenuSelectedIndex];
          if (selected && selected.dataset.action === 'open-headings') this._switchSlashPanel('headings');
          else if (selected && selected.dataset.action === 'open-emphasis') this._switchSlashPanel('emphasis');
          else if (selected && selected.dataset.action === 'open-lists') this._switchSlashPanel('lists');
          else if (selected && selected.dataset.action === 'open-code-advanced') this._switchSlashPanel('code-advanced');
          else if (selected && selected.dataset.action === 'open-layout') this._switchSlashPanel('layout');
          else if (selected && selected.dataset.format) { this._applyInlineFormat(selected.dataset.format); this._closeSlashMenu(); }
          else if (selected && selected.dataset.type) this._selectSlashCommand(selected.dataset.type);
        } else if (e.key === 'ArrowLeft' || (e.key === 'Escape' && this._slashCurrentPanel !== 'main')) {
          e.preventDefault();
          this._switchSlashPanel('main');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this._closeSlashMenu();
        }
      }, opts);

      // Click handling
      slashMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.slash-command-item');
        if (!item) return;
        if (item.dataset.action === 'open-headings') this._switchSlashPanel('headings');
        else if (item.dataset.action === 'open-emphasis') this._switchSlashPanel('emphasis');
        else if (item.dataset.action === 'open-lists') this._switchSlashPanel('lists');
        else if (item.dataset.action === 'open-code-advanced') this._switchSlashPanel('code-advanced');
        else if (item.dataset.action === 'open-layout') this._switchSlashPanel('layout');
        else if (item.dataset.action === 'back') this._switchSlashPanel('main');
        else if (item.dataset.format) { this._applyInlineFormat(item.dataset.format); this._closeSlashMenu(); }
        else if (item.dataset.type) this._selectSlashCommand(item.dataset.type);
      }, opts);

      // Mouse hover
      slashMenu.addEventListener('mouseenter', (e) => {
        const panel = slashMenu.querySelector(`.slash-command-list[data-panel="${this._slashCurrentPanel}"]`);
        if (!panel) return;
        const item = e.target.closest('.slash-command-item');
        if (item && panel.contains(item)) {
          const items = this._getSlashActiveItems();
          this._slashMenuSelectedIndex = Array.from(items).indexOf(item);
          this._updateSlashMenuSelection(items);
        }
      }, { capture: true, ...opts });
    }

    _getSlashActiveItems() {
      const panel = this._slashMenu.querySelector(`.slash-command-list[data-panel="${this._slashCurrentPanel}"]`);
      return panel ? panel.querySelectorAll(':scope > .slash-command-item') : [];
    }

    _switchSlashPanel(panelName) {
      this._slashMenu.querySelectorAll('.slash-command-list').forEach(p => p.classList.add('hidden'));
      const panel = this._slashMenu.querySelector(`.slash-command-list[data-panel="${panelName}"]`);
      if (panel) panel.classList.remove('hidden');
      this._slashCurrentPanel = panelName;
      this._slashMenuSelectedIndex = 0;
      this._updateSlashMenuSelection(this._getSlashActiveItems());
    }

    _updateSlashMenuSelection(items) {
      items.forEach((item, index) => {
        if (index === this._slashMenuSelectedIndex) item.classList.add('active');
        else item.classList.remove('active');
      });
    }

    _showSlashMenu(e, blockIndex) {
      this._saveSelection();
      this._slashMenuOpen = true;
      this._slashMenuSelectedIndex = 0;
      this._slashCurrentPanel = 'main';

      this._slashMenu.querySelectorAll('.slash-command-list').forEach(p => p.classList.add('hidden'));
      this._slashMenu.querySelector('.slash-command-list[data-panel="main"]').classList.remove('hidden');
      this._slashMenu.classList.remove('hidden');

      const blockEl = this._holder.querySelector(`.editor-block[data-index="${blockIndex}"]`);
      if (blockEl) {
        const rect = blockEl.getBoundingClientRect();
        const menuRect = this._slashMenu.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 10;
        const spaceAbove = rect.top - 10;

        let top;
        if (spaceBelow >= menuRect.height || spaceBelow >= spaceAbove) {
          top = rect.bottom + 5;
        } else {
          top = rect.top - menuRect.height - 5;
        }

        let left = rect.left;
        if (left + menuRect.width > window.innerWidth) left = window.innerWidth - menuRect.width - 10;

        this._slashMenu.style.top = Math.max(5, top) + 'px';
        this._slashMenu.style.left = Math.max(5, left) + 'px';
      }
      this._updateSlashMenuSelection(this._slashMenu.querySelectorAll('.slash-command-list[data-panel="main"] > .slash-command-item'));
    }

    _closeSlashMenu() {
      this._slashMenu.classList.add('hidden');
      this._slashMenuOpen = false;
    }

    _selectSlashCommand(blockType) {
      let headerLevel = null;
      const headerMatch = blockType.match(/^header-(\d)$/);
      if (headerMatch) { headerLevel = parseInt(headerMatch[1]); blockType = 'header'; }

      let listStyle = null;
      if (blockType === 'list-ordered') { listStyle = 'ordered'; blockType = 'list'; }
      else if (blockType === 'list-unordered') { listStyle = 'unordered'; blockType = 'list'; }

      const selectedBlock = this._holder.querySelector('.editor-block.selected');
      let blockIndex = -1;
      if (selectedBlock) blockIndex = parseInt(selectedBlock.dataset.index);
      else {
        const contentEditables = this._holder.querySelectorAll('[contenteditable]');
        for (let el of contentEditables) {
          const be = el.closest('.editor-block');
          if (be) { blockIndex = parseInt(be.dataset.index); break; }
        }
      }

      this._closeSlashMenu();
      if (blockIndex < 0 || !this._blocks[blockIndex]) return;

      const currentBlock = this._blocks[blockIndex];
      const blockEl = currentBlock.element;
      const contentEl = blockEl.querySelector('[contenteditable], code, input, span');
      const text = contentEl ? contentEl.textContent : '';
      const cleanText = text.trim();

      if (blockType === currentBlock.type && !headerLevel && !listStyle) {
        currentBlock.data.text = cleanText;
        if (contentEl) contentEl.textContent = cleanText;
      } else {
        this._convertBlock(blockIndex, blockType, cleanText !== '');
        const convertedBlock = this._blocks[blockIndex];
        if (blockType === 'header' && headerLevel) {
          convertedBlock.data.level = headerLevel;
          convertedBlock.data.text = cleanText;
          this._renderBlockContent(convertedBlock.element, 'header', convertedBlock.data);
        } else if (blockType === 'list') {
          convertedBlock.data.items = cleanText ? [cleanText] : [];
          if (listStyle) {
            convertedBlock.data.style = listStyle;
            this._renderBlockContent(convertedBlock.element, 'list', convertedBlock.data);
          }
        } else if (blockType === 'code') {
          convertedBlock.data.code = cleanText;
          if (!convertedBlock.data.language) convertedBlock.data.language = 'plain';
          this._renderBlockContent(convertedBlock.element, 'code', convertedBlock.data);
        } else if (blockType === 'checklist') {
          convertedBlock.data.items = cleanText ? [{ text: cleanText, checked: false }] : [];
        } else if (blockType === 'table') {
          convertedBlock.data = { headers: ['Column 1', 'Column 2'], rows: [[cleanText || '', '']] };
          this._renderBlockContent(convertedBlock.element, 'table', convertedBlock.data);
        } else if (blockType === 'link') {
          convertedBlock.data = { url: cleanText || '', text: '' };
          this._renderBlockContent(convertedBlock.element, 'link', convertedBlock.data);
        } else if (blockType === 'summary') {
          convertedBlock.data = { text: cleanText || '' };
          this._renderBlockContent(convertedBlock.element, 'summary', convertedBlock.data);
        } else if (blockType === 'mermaid') {
          convertedBlock.data = { code: cleanText || '' };
          this._renderBlockContent(convertedBlock.element, 'mermaid', convertedBlock.data);
        } else if (blockType === 'swagger') {
          convertedBlock.data = { url: cleanText || '', title: '' };
          this._renderBlockContent(convertedBlock.element, 'swagger', convertedBlock.data);
        } else if (blockType === 'columns') {
          convertedBlock.data = { layout: 'container', left: cleanText || '', middle: '', right: '' };
          this._renderBlockContent(convertedBlock.element, 'columns', convertedBlock.data);
        } else {
          convertedBlock.data.text = cleanText;
        }

        setTimeout(() => {
          const newContentEl = convertedBlock.element.querySelector('[contenteditable], textarea, code, input, span');
          if (newContentEl) newContentEl.focus();
        }, 0);
      }
    }

    /* ---------------------------------------------------------------
     *  Internal — Inline formatting & selection
     * -------------------------------------------------------------*/

    _saveSelection() {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) this._savedSelection = sel.getRangeAt(0).cloneRange();
    }

    _restoreSelection() {
      if (this._savedSelection) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this._savedSelection);
        this._savedSelection = null;
      }
    }

    _applyInlineFormat(format) {
      this._restoreSelection();
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
      const target = el?.closest('[contenteditable="true"]');
      if (!target) return;
      target.focus();
      sel.removeAllRanges();
      sel.addRange(range);
      switch (format) {
        case 'bold': document.execCommand('bold', false, null); break;
        case 'italic': document.execCommand('italic', false, null); break;
        case 'underline': document.execCommand('underline', false, null); break;
      }
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }

    /* ---------------------------------------------------------------
     *  Internal — Placeholders
     * -------------------------------------------------------------*/

    _setupPlaceholders() {
      const opts = { capture: true, signal: this._abortController.signal };

      this._holder.addEventListener('focus', (e) => {
        const el = e.target;
        if (el.contentEditable === 'true' && !el.textContent.trim()) el.classList.add('empty');
      }, opts);

      this._holder.addEventListener('blur', (e) => {
        const el = e.target;
        if (el.contentEditable === 'true') {
          if (el.textContent.trim()) el.classList.remove('empty');
          else el.classList.add('empty');
        }
      }, opts);

      this._holder.addEventListener('input', (e) => {
        const el = e.target;
        if (el.contentEditable === 'true') {
          if (el.textContent.trim()) el.classList.remove('empty');
          else el.classList.add('empty');
        }
      }, opts);
    }

    /* ---------------------------------------------------------------
     *  Internal — Utilities
     * -------------------------------------------------------------*/

    _getCaretPosition(element) {
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return 0;
      const range = selection.getRangeAt(0);
      const preRange = range.cloneRange();
      preRange.selectNodeContents(element);
      preRange.setEnd(range.endContainer, range.endOffset);
      return preRange.toString().length;
    }

    _escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    _highlightCode(blockEl) {
      if (!blockEl) return;
      const codeEl = blockEl.querySelector('.editor-code-body code');
      if (!codeEl) return;
      whenHljsReady(() => {
        // hljs modifies the element in place; remove previous highlight data
        codeEl.removeAttribute('data-highlighted');
        codeEl.classList.forEach(c => { if (c.startsWith('hljs')) codeEl.classList.remove(c); });
        window.hljs.highlightElement(codeEl);
      });
    }

    _highlightAllCode() {
      this._holder.querySelectorAll('.editor-block[data-type="code"]').forEach(el => this._highlightCode(el));
    }

    _renderMermaidPreview(blockEl, code) {
      if (!blockEl) return;
      const previewEl = blockEl.querySelector('.editor-mermaid-preview');
      const placeholderEl = blockEl.querySelector('.editor-mermaid-placeholder');
      if (!code) {
        if (previewEl) previewEl.style.display = 'none';
        if (placeholderEl) placeholderEl.style.display = '';
        return;
      }
      if (previewEl) previewEl.style.display = '';
      if (placeholderEl) placeholderEl.style.display = 'none';
      if (!previewEl) return;
      injectMermaidJS();
      whenMermaidReady(() => {
        const id = 'mermaid-' + Math.random().toString(36).substr(2, 9);
        try {
          window.mermaid.render(id, code).then(({ svg }) => {
            previewEl.innerHTML = svg;
          }).catch(() => {
            previewEl.innerHTML = '<div style="color:#d9534f;font-size:0.85em;padding:8px;">Invalid mermaid syntax</div>';
          });
        } catch (err) {
          previewEl.innerHTML = '<div style="color:#d9534f;font-size:0.85em;padding:8px;">Invalid mermaid syntax</div>';
        }
      });
    }

    _renderAllMermaid() {
      this._holder.querySelectorAll('.editor-block[data-type="mermaid"]').forEach(el => {
        const idx = parseInt(el.dataset.index);
        const block = this._blocks[idx];
        if (block && block.data.code) this._renderMermaidPreview(el, block.data.code);
      });
    }

    _renderSwaggerPreview(blockEl, url) {
      if (!blockEl) return;
      const wrapperEl = blockEl.querySelector('.editor-swagger-ui-wrapper');
      const placeholderEl = blockEl.querySelector('.editor-swagger-placeholder');
      if (!url) {
        if (wrapperEl) { wrapperEl.innerHTML = ''; wrapperEl.style.display = 'none'; }
        if (placeholderEl) placeholderEl.style.display = '';
        return;
      }
      if (placeholderEl) placeholderEl.style.display = 'none';
      if (!wrapperEl) return;
      wrapperEl.style.display = '';
      injectSwaggerUI();
      whenSwaggerReady(() => {
        try {
          window.SwaggerUIBundle({
            url: url,
            dom_id: '#' + wrapperEl.id,
            presets: [
              window.SwaggerUIBundle.presets.apis,
              window.SwaggerUIBundle.SwaggerUIStandalonePreset
            ],
            layout: 'BaseLayout'
          });
        } catch (err) {
          wrapperEl.innerHTML = '<div style="color:#d9534f;font-size:0.85em;padding:12px;">Failed to load Swagger UI</div>';
        }
      });
    }

    _renderAllSwagger() {
      this._holder.querySelectorAll('.editor-block[data-type="swagger"]').forEach(el => {
        const idx = parseInt(el.dataset.index);
        const block = this._blocks[idx];
        if (block && block.data.url) this._renderSwaggerPreview(el, block.data.url);
      });
    }

    _saveTableFromGrid(blockEl, block) {
      const grid = blockEl.querySelector('.editor-table-grid');
      if (!grid) return;

      // Read headers
      const headerInputs = grid.querySelector('.header-row').querySelectorAll('input');
      const headers = Array.from(headerInputs).map(inp => inp.value);

      // Read rows
      const dataRows = grid.querySelectorAll('.editor-table-row:not(.header-row)');
      const rows = Array.from(dataRows).map(row => {
        return Array.from(row.querySelectorAll('input')).map(inp => inp.value);
      });

      block.data.headers = headers;
      block.data.rows = rows;

      // Rebuild the collapsed display table
      const display = blockEl.querySelector('.editor-table-display');
      if (display) {
        const thHtml = headers.map(h => `<th>${this._escapeHtml(h)}</th>`).join('');
        const trHtml = rows.map(row => {
          const tds = headers.map((_, ci) => `<td>${this._escapeHtml(row[ci] || '')}</td>`).join('');
          return `<tr>${tds}</tr>`;
        }).join('');
        display.innerHTML = `<table><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table>`;
      }

      // Collapse
      const container = blockEl.querySelector('.editor-table-container');
      if (container) {
        container.classList.remove('editing');
        container.classList.add('collapsed');
      }
      this._onChange();
    }

    _getLanguageOptions(selected) {
      const languages = [
        'plain', 'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp',
        'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r',
        'html', 'css', 'scss', 'sql', 'graphql',
        'bash', 'powershell', 'dockerfile',
        'json', 'yaml', 'xml', 'toml', 'ini',
        'markdown', 'latex',
        'lua', 'perl', 'haskell', 'elixir', 'clojure', 'dart', 'zig'
      ];
      return languages.map(lang =>
        `<option value="${lang}"${lang === selected ? ' selected' : ''}>${lang}</option>`
      ).join('');
    }

    _markdownToHtml(text) {
      if (!text) return '';
      let escaped = this._escapeHtml(text);
      escaped = escaped.replace(/\*\*([^\*]+)\*\*/g, '<b>$1</b>');
      escaped = escaped.replace(/\*([^\*]+)\*/g, '<i>$1</i>');
      escaped = escaped.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>');
      return escaped;
    }

    _htmlToMarkdown(html) {
      if (!html) return '';
      let text = html;
      text = text.replace(/<br\s*\/?>/gi, '');
      text = text.replace(/<(b|strong)>(.*?)<\/(b|strong)>/gi, '**$2**');
      text = text.replace(/<(i|em)>(.*?)<\/(i|em)>/gi, '*$2*');
      text = text.replace(/<u>/gi, '\x00U_OPEN\x00');
      text = text.replace(/<\/u>/gi, '\x00U_CLOSE\x00');
      text = text.replace(/<[^>]+>/g, '');
      text = text.replace(/\x00U_OPEN\x00/g, '<u>');
      text = text.replace(/\x00U_CLOSE\x00/g, '</u>');
      const el = document.createElement('textarea');
      el.innerHTML = text;
      return el.value;
    }

    _resolveImageSrc(src) {
      if (this._resolveImageSrcFn) return this._resolveImageSrcFn(src);
      if (!src) return '';
      if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/') || src.startsWith('data:')) return src;
      return '/content/' + src;
    }

    _updateImagePreview(blockEl, src, alt) {
      const img = blockEl.querySelector('.editor-image');
      const placeholder = blockEl.querySelector('.editor-image-placeholder');
      const error = blockEl.querySelector('.editor-image-error');
      if (src) {
        if (!img) {
          const preview = blockEl.querySelector('.editor-image-preview');
          if (preview) {
            preview.innerHTML = `<img src="${this._escapeHtml(this._resolveImageSrc(src))}" alt="${this._escapeHtml(alt)}" class="editor-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="editor-image-error" style="display: none;">Image failed to load: ${this._escapeHtml(src)}</div>`;
          }
        } else {
          img.style.display = 'block';
          img.src = this._resolveImageSrc(src);
          img.alt = alt;
        }
        if (placeholder) placeholder.style.display = 'none';
        if (error) error.style.display = 'none';
      } else {
        if (img) img.style.display = 'none';
        if (error) error.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
      }
    }

    /* ---------------------------------------------------------------
     *  Internal — Markdown serialization / parsing
     * -------------------------------------------------------------*/

    _toMarkdown() {
      return this._blocks.map(block => {
        switch (block.type) {
          case 'header': {
            const level = block.data.level || 2;
            return '#'.repeat(level) + ' ' + this._htmlToMarkdown(block.data.text || '');
          }
          case 'paragraph':
            return this._htmlToMarkdown(block.data.text || '');
          case 'list': {
            const items = block.data.items || [];
            if (block.data.style === 'ordered') return items.map((item, i) => `${i + 1}. ${this._htmlToMarkdown(item)}`).join('\n');
            return items.map(item => `- ${this._htmlToMarkdown(item)}`).join('\n');
          }
          case 'code': {
            const lang = block.data.language && block.data.language !== 'plain' ? block.data.language : '';
            return '```' + lang + '\n' + (block.data.code || '') + '\n```';
          }
          case 'quote':
            return this._htmlToMarkdown(block.data.text || '').split('\n').map(line => `> ${line}`).join('\n');
          case 'checklist': {
            const items = block.data.items || [];
            return items.map(item => {
              const text = typeof item === 'string' ? item : item.text;
              const checked = item.checked ? 'x' : ' ';
              return `- [${checked}] ${this._htmlToMarkdown(text)}`;
            }).join('\n');
          }
          case 'delimiter':
            return '---';
          case 'image':
            return `![${block.data.alt || ''}](${block.data.src || ''})`;
          case 'link':
            return `[${block.data.text || block.data.url || ''}](${block.data.url || ''})`;
          case 'summary':
            return '```summary\n' + (block.data.text || '') + '\n```';
          case 'mermaid':
            return '```mermaid\n' + (block.data.code || '') + '\n```';
          case 'swagger': {
            const parts = [];
            if (block.data.url) parts.push('url: ' + block.data.url);
            if (block.data.title) parts.push('title: ' + block.data.title);
            return '```swagger\n' + parts.join('\n') + '\n```';
          }
          case 'columns': {
            const colLayout = block.data.layout || 'container';
            const colSections = [];
            if (block.data.left !== undefined) {
              colSections.push('left:\n' + (block.data.left || '').split('\n').map(l => '  ' + l).join('\n'));
            }
            if (colLayout === 'three-column' && block.data.middle !== undefined) {
              colSections.push('middle:\n' + (block.data.middle || '').split('\n').map(l => '  ' + l).join('\n'));
            }
            if (block.data.right !== undefined) {
              colSections.push('right:\n' + (block.data.right || '').split('\n').map(l => '  ' + l).join('\n'));
            }
            return '```' + colLayout + '\n' + colSections.join('\n') + '\n```';
          }
          case 'hero-banner': {
            const hbParts = [];
            if (block.data.title) hbParts.push('title: ' + block.data.title);
            if (block.data.subtitle) hbParts.push('subtitle: ' + block.data.subtitle);
            if (block.data.image) hbParts.push('hero-image: ' + block.data.image);
            if (block.data.imageAlign && block.data.imageAlign !== 'right') hbParts.push('hero-image-align: ' + block.data.imageAlign);
            return '```hero-banner\n' + hbParts.join('\n') + '\n```';
          }
          case 'cards': {
            const cParts = [];
            cParts.push('across: ' + (block.data.across || 3));
            (block.data.cards || []).forEach(c => {
              cParts.push('- ### ' + (c.heading || ''));
              cParts.push('  ' + (c.description || ''));
            });
            return '```cards\n' + cParts.join('\n') + '\n```';
          }
          case 'site-header': {
            const shParts = [];
            if (block.data.icon) shParts.push('icon: ' + block.data.icon);
            if (block.data.title) shParts.push('title: ' + block.data.title);
            if (block.data.links) shParts.push('links: ' + block.data.links);
            return '```header\n' + shParts.join('\n') + '\n```';
          }
          case 'site-footer': {
            const sfParts = [];
            if (block.data.icon) sfParts.push('icon: ' + block.data.icon);
            if (block.data.title) sfParts.push('title: ' + block.data.title);
            if (block.data.subtitle) sfParts.push('subtitle: ' + block.data.subtitle);
            if (block.data.links) sfParts.push('links: ' + block.data.links);
            return '```footer\n' + sfParts.join('\n') + '\n```';
          }
          case 'table': {
            const headers = block.data.headers || [];
            const rows = block.data.rows || [];
            const headerLine = '| ' + headers.join(' | ') + ' |';
            const separatorLine = '| ' + headers.map(() => '---').join(' | ') + ' |';
            const bodyLines = rows.map(row =>
              '| ' + headers.map((_, ci) => row[ci] || '').join(' | ') + ' |'
            );
            return [headerLine, separatorLine, ...bodyLines].join('\n');
          }
          default:
            return block.data.text || '';
        }
      }).join('\n\n');
    }

    _fromMarkdown(md) {
      const blocks = [];
      const lines = md.replace(/\r\n?/g, '\n').split('\n');
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        if (line.trim() === '') { i++; continue; }

        if (/^---+$/.test(line.trim())) { blocks.push({ type: 'delimiter', data: {} }); i++; continue; }

        const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headerMatch) { blocks.push({ type: 'header', data: { text: this._markdownToHtml(headerMatch[2]), level: headerMatch[1].length } }); i++; continue; }

        if (line.trim().startsWith('```')) {
          const langMatch = line.trim().match(/^```([\w-]*)$/);
          const language = (langMatch && langMatch[1]) ? langMatch[1] : 'plain';
          const fenceLines = [];
          i++;
          while (i < lines.length && !lines[i].trim().startsWith('```')) { fenceLines.push(lines[i]); i++; }
          i++; // skip closing ```

          if (language === 'summary') {
            blocks.push({ type: 'summary', data: { text: fenceLines.join('\n') } });
          } else if (language === 'mermaid') {
            blocks.push({ type: 'mermaid', data: { code: fenceLines.join('\n') } });
          } else if (language === 'swagger') {
            // Parse key: value properties
            const props = {};
            fenceLines.forEach(l => {
              const m = l.match(/^(\w+):\s*(.+)$/);
              if (m) props[m[1].toLowerCase()] = m[2].trim();
            });
            blocks.push({ type: 'swagger', data: { url: props.url || '', title: props.title || '' } });
          } else if (language === 'hero-banner') {
            const hbProps = {};
            fenceLines.forEach(l => {
              const m = l.match(/^([\w-]+):\s*(.+)$/);
              if (m) hbProps[m[1].toLowerCase()] = m[2].trim();
            });
            blocks.push({ type: 'hero-banner', data: { title: hbProps['title'] || '', subtitle: hbProps['subtitle'] || '', image: hbProps['hero-image'] || '', imageAlign: hbProps['hero-image-align'] || 'right' } });
          } else if (language === 'cards') {
            let across = 3;
            const cards = [];
            let currentCard = null;
            fenceLines.forEach(l => {
              const acrossMatch = l.match(/^across:\s*(\d+)/);
              if (acrossMatch) { across = parseInt(acrossMatch[1]); return; }
              const cardMatch = l.match(/^-\s*###\s*(.*)$/);
              if (cardMatch) {
                if (currentCard) cards.push(currentCard);
                currentCard = { heading: cardMatch[1].trim(), description: '' };
                return;
              }
              if (currentCard && l.trim()) {
                currentCard.description = (currentCard.description ? currentCard.description + '\n' : '') + l.trim();
              }
            });
            if (currentCard) cards.push(currentCard);
            if (cards.length === 0) cards.push({ heading: '', description: '' });
            blocks.push({ type: 'cards', data: { across, cards } });
          } else if (language === 'header') {
            const hdProps = {};
            fenceLines.forEach(l => {
              const m = l.match(/^(\w+):\s*(.+)$/);
              if (m) hdProps[m[1].toLowerCase()] = m[2].trim();
            });
            blocks.push({ type: 'site-header', data: { icon: hdProps['icon'] || '', title: hdProps['title'] || '', links: hdProps['links'] || '' } });
          } else if (language === 'footer') {
            const ftProps = {};
            fenceLines.forEach(l => {
              const m = l.match(/^(\w+):\s*(.+)$/);
              if (m) ftProps[m[1].toLowerCase()] = m[2].trim();
            });
            blocks.push({ type: 'site-footer', data: { icon: ftProps['icon'] || '', title: ftProps['title'] || '', subtitle: ftProps['subtitle'] || '', links: ftProps['links'] || '' } });
          } else if (language === 'container' || language === 'two-col-3-1' || language === 'two-col-1-3' || language === 'three-column') {
            const colData = { layout: language, left: '', middle: '', right: '' };
            let currentSection = null;
            fenceLines.forEach(l => {
              const secMatch = l.match(/^(left|middle|right):$/);
              if (secMatch) { currentSection = secMatch[1]; return; }
              if (currentSection) {
                const content = l.startsWith('  ') ? l.substring(2) : l;
                colData[currentSection] = colData[currentSection] ? colData[currentSection] + '\n' + content : content;
              }
            });
            blocks.push({ type: 'columns', data: colData });
          } else {
            blocks.push({ type: 'code', data: { code: fenceLines.join('\n'), language } });
          }
          continue;
        }

        const checkMatch = line.match(/^- \[([ xX])\] (.*)$/);
        if (checkMatch) {
          const items = [];
          while (i < lines.length) {
            const m = lines[i].match(/^- \[([ xX])\] (.*)$/);
            if (!m) break;
            items.push({ text: this._markdownToHtml(m[2]), checked: m[1] !== ' ' });
            i++;
          }
          blocks.push({ type: 'checklist', data: { items } });
          continue;
        }

        const ulMatch = line.match(/^[-*]\s+(.*)$/);
        if (ulMatch) {
          const items = [];
          while (i < lines.length) {
            const m = lines[i].match(/^[-*]\s+(.*)$/);
            if (!m) break;
            items.push(this._markdownToHtml(m[1]));
            i++;
          }
          blocks.push({ type: 'list', data: { items, style: 'unordered' } });
          continue;
        }

        const olMatch = line.match(/^\d+\.\s+(.*)$/);
        if (olMatch) {
          const items = [];
          while (i < lines.length) {
            const m = lines[i].match(/^\d+\.\s+(.*)$/);
            if (!m) break;
            items.push(this._markdownToHtml(m[1]));
            i++;
          }
          blocks.push({ type: 'list', data: { items, style: 'ordered' } });
          continue;
        }

        if (line.startsWith('> ')) {
          const quoteLines = [];
          while (i < lines.length && lines[i].startsWith('> ')) { quoteLines.push(lines[i].slice(2)); i++; }
          blocks.push({ type: 'quote', data: { text: this._markdownToHtml(quoteLines.join('\n')) } });
          continue;
        }

        const imageMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (imageMatch) { blocks.push({ type: 'image', data: { alt: imageMatch[1], src: imageMatch[2] } }); i++; continue; }

        // Standalone link on its own line: [text](url)
        const linkMatch = line.trim().match(/^\[([^\]]*)\]\(([^)]+)\)$/);
        if (linkMatch) { blocks.push({ type: 'link', data: { text: linkMatch[1], url: linkMatch[2] } }); i++; continue; }

        // Table (GFM: | header | header | then |---|---| then | cell | cell |)
        // Also handles tables with blank lines between rows and multiline cell content
        if (line.trim().startsWith('|')) {
          // Look ahead for separator row, skipping blank lines
          let sepIdx = i + 1;
          while (sepIdx < lines.length && lines[sepIdx].trim() === '') sepIdx++;
          if (sepIdx < lines.length && /^\|[\s\-:|]+\|$/.test(lines[sepIdx].trim())) {
            const headerCells = line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
            const colCount = headerCells.length;
            i = sepIdx + 1; // skip past separator

            const tRows = [];
            // Skip blank lines after separator
            while (i < lines.length && lines[i].trim() === '') i++;

            while (i < lines.length) {
              const rowLine = lines[i].trim();
              if (rowLine === '') { i++; continue; } // skip blank lines between rows
              if (!rowLine.startsWith('|')) break; // not a table row anymore

              // Accumulate the full row: collect lines until we have a line ending with |
              // and the pipe count matches the expected column structure
              let accumulated = lines[i];
              i++;
              // Keep accumulating if the row doesn't end with | yet,
              // or if it ends with | but doesn't have enough pipes for all columns
              while (i < lines.length) {
                const accTrimmed = accumulated.trim();
                const pipeCount = (accTrimmed.match(/\|/g) || []).length;
                // A complete row starts and ends with | and has colCount+1 pipes
                if (accTrimmed.endsWith('|') && pipeCount >= colCount + 1) break;
                accumulated += '\n' + lines[i];
                i++;
              }
              const cells = accumulated.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
              tRows.push(cells);
            }
            blocks.push({ type: 'table', data: { headers: headerCells, rows: tRows } });
            continue;
          }
        }

        blocks.push({ type: 'paragraph', data: { text: this._markdownToHtml(line) } });
        i++;
      }

      if (blocks.length === 0) blocks.push({ type: 'paragraph', data: { text: '' } });

      this._data = { blocks, version: '1.0' };
      this._render();
    }
  }

  return MarkdownEditor;
}));
