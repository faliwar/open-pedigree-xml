import { translate } from 'pedigree/i18n';

var PAD = 9;
var FONT_SIZE = 16;          // not 19/20px: the SVG export uses those sizes to find names for privacy
var WRAP = 38;               // characters per line before wrapping

// Wraps each paragraph at word boundaries
var wrapText = function(text) {
  var lines = [];
  String(text || '').split('\n').forEach(function(par) {
    var line = '';
    par.split(/\s+/).forEach(function(word) {
      if (!word) return;
      if (line && (line + ' ' + word).length > WRAP) {
        lines.push(line);
        line = word;
      } else {
        line = line ? line + ' ' + word : word;
      }
    });
    lines.push(line);
  });
  return lines.join('\n');
};

/**
 * Free-text notes placed on the chart. They are part of the drawing (move and zoom with it and
 * appear in SVG/PDF exports), can be dragged, and open a small editor when clicked.
 * The text and positions live in PedigreeInfo (saved with the pedigree, undoable).
 *
 * @class AnnotationLayer
 */
var AnnotationLayer = Class.create({

  initialize: function() {
    var _this = this;
    this._sets = [];
    this._editor = null;
    document.observe('pedigree:info:changed', function() { _this.render(); });
  },

  _readOnly: function() {
    return typeof editor !== 'undefined' && editor.isReadOnlyMode && editor.isReadOnlyMode();
  },

  clear: function() {
    this._sets.forEach(function(s) {
      try { s.remove(); } catch (e) {}
    });
    this._sets = [];
  },

  render: function() {
    this.clear();
    if (typeof editor === 'undefined' || !editor.getPaper || !editor.getPaper() || !editor.getPedigreeInfo) return;
    var _this = this;
    editor.getPedigreeInfo().get().annotations.forEach(function(a) {
      _this._sets.push(_this._draw(a));
    });
  },

  /** Keeps the notes above people and lines after the chart is redrawn */
  bringToFront: function() {
    this._sets.forEach(function(s) {
      try { s.toFront(); } catch (e) {}
    });
  },

  _draw: function(a) {
    var paper = editor.getPaper();
    var text = paper.text(a.x + PAD, a.y + PAD, wrapText(a.text)).attr({
      'font-size': FONT_SIZE,
      'font-family': 'Arial, Helvetica, sans-serif',
      'fill': '#1E293B',
      'text-anchor': 'start'
    });
    // Raphael centres multi-line text on y: move it so the first line starts at the top
    var box = text.getBBox();
    text.attr({ y: text.attr('y') + (a.y + PAD - box.y) });
    box = text.getBBox();
    var rect = paper.rect(a.x, a.y, box.width + PAD * 2, box.height + PAD * 2, 6).attr({
      'fill': '#FFFBEB',
      'fill-opacity': 0.95,
      'stroke': '#D6B656',
      'stroke-width': 1.2
    });
    text.toFront();
    var set = paper.set(rect, text);
    set.forEach(function(el) {
      el.node.setAttribute('data-opx-annotation', a.id);
      el.node.setAttribute('data-no-translate', '1');
    });
    if (!this._readOnly()) {
      this._makeInteractive(set, rect, a);
    }
    return set;
  },

  _makeInteractive: function(set, rect, a) {
    var _this = this;
    var zoom = 1;
    var moved = 0;
    var lastDx = 0, lastDy = 0;
    set.attr({ cursor: 'move' });
    set.hover(function() { rect.attr({ stroke: '#0284C7', 'stroke-width': 2 }); },
      function() { rect.attr({ stroke: '#D6B656', 'stroke-width': 1.2 }); });
    set.drag(function(dx, dy) {
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      var cx = dx / zoom, cy = dy / zoom;
      set.translate(cx - lastDx, cy - lastDy);
      lastDx = cx;
      lastDy = cy;
    }, function() {
      var ws = editor.getWorkspace();
      zoom = (ws && ws.zoomCoefficient > 0) ? ws.zoomCoefficient : 1;
      moved = 0;
      lastDx = lastDy = 0;
    }, function() {
      if (moved < 4) {
        set.translate(-lastDx, -lastDy);
        _this.openEditor(a.id);
        return;
      }
      _this._move(a.id, lastDx, lastDy);
    });
  },

  _move: function(id, dx, dy) {
    var info = editor.getPedigreeInfo();
    var list = info.get().annotations.map(function(a) {
      if (a.id === id) {
        a.x = Math.round(a.x + dx);
        a.y = Math.round(a.y + dy);
      }
      return a;
    });
    info.update({ annotations: list }, translate('Moved a note on the chart'));
  },

  // -------------------------------------------------------------------------------------------
  // Editor

  /** Adds a note in the middle of the visible chart and opens it for typing */
  addNote: function() {
    var ws = editor.getWorkspace();
    var pos = ws.divToCanvas(ws.getWidth() / 2 - 120, ws.getHeight() / 3);
    this.openEditor(null, { x: Math.round(pos.x), y: Math.round(pos.y) });
  },

  closeEditor: function() {
    if (this._editor) {
      this._editor.remove();
      this._editor = null;
    }
  },

  /**
   * @param {String|null} id note to edit, or null for a new note at `position`
   */
  openEditor: function(id, position) {
    var _this = this;
    this.closeEditor();
    var info = editor.getPedigreeInfo();
    var note = id ? info.getAnnotation(id) : { id: null, x: position.x, y: position.y, text: '' };
    if (!note) return;

    var box = new Element('div', { 'class': 'annotation-editor', 'role': 'dialog', 'aria-label': translate('Note on the chart') });
    box.insert(new Element('div', { 'class': 'annotation-editor-title' }).update(translate(id ? 'Edit note' : 'New note')));
    var textarea = new Element('textarea', { 'class': 'annotation-editor-text', 'rows': 4, 'placeholder': translate('Text shown on the chart') });
    textarea.value = note.text;
    box.insert(textarea);
    box.insert(new Element('div', { 'class': 'annotation-editor-hint' }).update(translate('Drag the note to move it. Ctrl+Enter saves.')));

    var buttons = new Element('div', { 'class': 'annotation-editor-buttons' });
    var save = function() {
      var text = textarea.value.trim();
      var list = info.get().annotations;
      if (!id) {
        if (!text) return _this.closeEditor();
        list.push({ id: info.newAnnotationId(), x: note.x, y: note.y, text: text });
        info.update({ annotations: list }, translate('Added a note on the chart'));
      } else if (!text) {
        info.update({ annotations: list.filter(function(a) { return a.id !== id; }) }, translate('Removed a note from the chart'));
      } else {
        list.forEach(function(a) { if (a.id === id) a.text = text; });
        info.update({ annotations: list }, translate('Edited a note on the chart'));
      }
      _this.closeEditor();
    };
    var mk = function(label, cls, handler) {
      var b = new Element('button', { 'type': 'button', 'class': 'annotation-editor-btn ' + (cls || '') }).update(translate(label));
      b.observe('click', handler);
      buttons.insert(b);
      return b;
    };
    if (id) {
      mk('Delete', 'is-danger', function() {
        info.update({ annotations: info.get().annotations.filter(function(a) { return a.id !== id; }) }, translate('Removed a note from the chart'));
        _this.closeEditor();
      });
    }
    mk('Cancel', '', function() { _this.closeEditor(); });
    mk('Save', 'is-primary', save);
    box.insert(buttons);

    box.observe('keydown', function(e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.stop();
        _this.closeEditor();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.stop();
        save();
      }
    });
    // keep clicks inside from reaching the chart
    box.observe('mousedown', function(e) { e.stopPropagation(); });

    var workArea = $('work-area');
    workArea.insert(box);
    var ws = editor.getWorkspace();
    var p = ws.canvasToDiv(note.x, note.y);
    var maxLeft = workArea.offsetWidth - box.offsetWidth - 10;
    var maxTop = workArea.offsetHeight - box.offsetHeight - 10;
    box.setStyle({
      left: Math.max(10, Math.min(maxLeft, p.x)) + 'px',
      top: Math.max(10, Math.min(maxTop, p.y + 4)) + 'px'
    });
    this._editor = box;
    textarea.focus();
  }
});

export default AnnotationLayer;
