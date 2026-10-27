import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';
import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { translate } from 'pedigree/i18n';

/**
 * PedigreeOverlay draws non-interactive annotations on top of the pedigree canvas:
 *  - standard nomenclature (generation Roman numerals and per-person "II-3" numbers);
 *  - cascade testing highlights (rings around the index person and at-risk relatives);
 *  - search highlights (rings around the people found, others faded).
 *
 * Every element it draws is tagged with a `data-opx-overlay` attribute so exports can
 * keep or drop it, and ignores pointer events so it never gets in the way of editing.
 * The overlay redraws itself after each change applied to the view.
 *
 * @class PedigreeOverlay
 */
var PedigreeOverlay = Class.create({

  initialize: function() {
    this._elements = [];
    this._showNumbering = false;
    this._cascade = null;          // { indexId, colorById: {id: color} }
    this._search = null;           // { ids, dimOthers, summary }
    this._searchLegend = null;
    this._redrawTimer = null;
    this._legend = null;
    this._loadSettings();
  },

  _loadSettings: function() {
    try {
      var saved = JSON.parse(localStorage.getItem('openpedigree_overlay_v1') || '{}');
      this._showNumbering = !!saved.showNumbering;
    } catch (e) {}
  },

  _saveSettings: function() {
    try {
      localStorage.setItem('openpedigree_overlay_v1', JSON.stringify({ showNumbering: this._showNumbering }));
    } catch (e) {}
  },

  isNumberingVisible: function() {
    return this._showNumbering;
  },

  setNumberingVisible: function(visible) {
    this._showNumbering = !!visible;
    this._saveSettings();
    this.redraw();
  },

  /**
   * Highlights the cascade on the chart.
   * @param {Number} indexId
   * @param {Object} colorById map nodeId -> stroke colour for each highlighted relative
   * @param {Array} legendItems [{color, label}] shown in the floating legend
   */
  setCascadeHighlight: function(indexId, colorById, legendItems) {
    this._cascade = { indexId: indexId, colorById: colorById || {}, legendItems: legendItems || [] };
    this._showLegend();
    this.redraw();
  },

  clearCascadeHighlight: function() {
    this._cascade = null;
    this._hideLegend();
    this.redraw();
  },

  hasCascadeHighlight: function() {
    return !!this._cascade;
  },

  /**
   * Highlights the people found by a search: a ring around each one and, optionally, the
   * other people faded. `summary` is the text of the floating legend.
   */
  setSearchHighlight: function(ids, options) {
    options = options || {};
    this._search = { ids: (ids || []).slice(), dimOthers: options.dimOthers !== false, summary: options.summary || '' };
    this._showSearchLegend();
    this.redraw();
  },

  clearSearchHighlight: function() {
    if (!this._search) return;
    this._search = null;
    this._hideSearchLegend();
    this.redraw();
  },

  hasSearchHighlight: function() {
    return !!this._search;
  },

  /**
   * Called after the graph structure changed. Node ids are renumbered when a node is
   * removed, so an existing cascade highlight would point at the wrong people: drop it.
   */
  onGraphChanged: function(changeSet) {
    if (this._cascade && changeSet && changeSet.removed && changeSet.removed.length > 0) {
      this.clearCascadeHighlight();
      return;
    }
    this.scheduleRedraw();
  },

  scheduleRedraw: function() {
    var _this = this;
    if (this._redrawTimer) {
      clearTimeout(this._redrawTimer);
    }
    this._redrawTimer = setTimeout(function() {
      _this._redrawTimer = null;
      _this.redraw();
    }, 30);
  },

  clear: function() {
    this._elements.forEach(function(el) {
      try { el.remove(); } catch (e) {}
    });
    this._elements = [];
    this._undim();
  },

  _undim: function() {
    var dimmed = document.querySelectorAll('#canvas [data-opx-dim]');
    for (var i = 0; i < dimmed.length; i++) {
      dimmed[i].removeAttribute('data-opx-dim');
    }
  },

  // Fades everyone not found by the search (the CSS rule only applies on screen, not in exports)
  _dimOthers: function(found) {
    var graph = editor.getGraph();
    var dim = function(el) {
      if (!el) return;
      if (el.forEach && !el.node) {
        el.forEach(dim);
      } else if (el.node) {
        el.node.setAttribute('data-opx-dim', '1');
      }
    };
    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      if (found[id] || !graph.isPerson(id)) continue;
      var node = editor.getNode(id);
      var g = node && node.getGraphics && node.getGraphics();
      if (!g) continue;
      try {
        dim(g.getShapes());
        g.getLabels && dim(g.getLabels());
        g.getCarrierGraphics && dim(g.getCarrierGraphics());
        g.getEvaluationGraphics && dim(g.getEvaluationGraphics());
        g._idLabel && dim(g._idLabel);
      } catch (e) {}
    }
  },

  _drawSearch: function() {
    var paper = editor.getPaper();
    var radius = PedigreeEditorParameters.attributes.radius || 40;
    var background = editor.getWorkspace && editor.getWorkspace().background;
    var found = {};
    var _this = this;
    this._search.ids.forEach(function(id) {
      found[id] = true;
      var node = editor.getNode(id);
      if (!node || !node.getX) return;
      var ring = paper.circle(node.getX(), node.getY(), radius * 1.48).attr({
        'stroke': '#0284C7',
        'stroke-width': 5,
        'fill': '#38BDF8',
        'fill-opacity': 0.16
      });
      if (background) ring.insertAfter(background);
      _this._tag(ring, 'search');
    });
    if (this._search.dimOthers && this._search.ids.length) {
      this._dimOthers(found);
    }
  },

  _tag: function(el, kind) {
    if (el && el.node) {
      el.node.setAttribute('data-opx-overlay', kind);
      el.node.style.pointerEvents = 'none';
    }
    this._elements.push(el);
    return el;
  },

  redraw: function() {
    this.clear();
    if (typeof editor === 'undefined' || !editor || !editor.getPaper || !editor.getPaper()) {
      return;
    }
    try {
      if (this._search) {
        this._drawSearch();
      }
      if (this._cascade) {
        this._drawCascade();
      }
      if (this._showNumbering) {
        this._drawNumbering();
      }
    } catch (e) {
      console.warn('Overlay redraw failed:', e);
    }
  },

  _drawNumbering: function() {
    var paper = editor.getPaper();
    var radius = PedigreeEditorParameters.attributes.radius || 40;
    var numbering = computeStandardNumbering(editor);
    if (!numbering.tiers.length) {
      return;
    }

    // Generation numerals share one column left of the leftmost person of the whole chart
    var globalMinX = Math.min.apply(null, numbering.tiers.map(function(t) { return t.minX; }));
    var numeralX = globalMinX - radius * 2.6;

    var _this = this;
    numbering.tiers.forEach(function(tier) {
      _this._tag(paper.text(numeralX, tier.y, tier.roman).attr({
        'font-size': 28,
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-weight': 'bold',
        'fill': '#475569',
        'text-anchor': 'middle'
      }), 'numbering');

      tier.persons.forEach(function(p) {
        var label = numbering.byId[p.id].index;
        _this._tag(paper.text(p.x - radius - 3, p.y - radius - 7, String(label)).attr({
          'font-size': 18,
          'font-family': 'Arial, Helvetica, sans-serif',
          'font-weight': 'bold',
          'fill': '#334155',
          'text-anchor': 'end'
        }), 'numbering');
      });
    });
  },

  _drawCascade: function() {
    var paper = editor.getPaper();
    var radius = PedigreeEditorParameters.attributes.radius || 40;
    var background = editor.getWorkspace && editor.getWorkspace().background;
    var _this = this;

    var drawRing = function(id, color, isIndex) {
      var node = editor.getNode(id);
      if (!node || !node.getX) {
        return;
      }
      var r = radius * (isIndex ? 1.55 : 1.42);
      var ring = paper.circle(node.getX(), node.getY(), r).attr({
        'stroke': color,
        'stroke-width': isIndex ? 6 : 4,
        'stroke-dasharray': isIndex ? '' : '- ',
        'fill': color,
        'fill-opacity': 0.10
      });
      if (background) {
        ring.insertAfter(background);
      }
      _this._tag(ring, 'cascade');
    };

    for (var id in this._cascade.colorById) {
      if (this._cascade.colorById.hasOwnProperty(id) && String(id) !== String(this._cascade.indexId)) {
        drawRing(parseInt(id, 10), this._cascade.colorById[id], false);
      }
    }
    drawRing(this._cascade.indexId, '#7C3AED', true);
  },

  _showLegend: function() {
    this._hideLegend();
    var workArea = $('work-area');
    if (!workArea || !this._cascade) {
      return;
    }
    var _this = this;
    var legend = new Element('div', { 'class': 'cascade-chart-legend', 'role': 'status' });
    legend.insert(new Element('span', { 'class': 'cascade-chart-legend-title' }).update(translate('Cascade testing')));
    var items = [{ color: '#7C3AED', label: translate('Index') }].concat(this._cascade.legendItems);
    items.forEach(function(item) {
      var entry = new Element('span', { 'class': 'cascade-chart-legend-item' });
      entry.insert(new Element('span', { 'class': 'cascade-chart-legend-swatch' }).setStyle({ borderColor: item.color }));
      entry.insert(new Element('span').update(item.label.escapeHTML()));
      legend.insert(entry);
    });
    var openBtn = new Element('button', { 'type': 'button', 'class': 'cascade-chart-legend-btn' }).update(translate('List'));
    openBtn.observe('click', function() {
      editor.getCascadeTestingDialog && editor.getCascadeTestingDialog().show();
    });
    var closeBtn = new Element('button', { 'type': 'button', 'class': 'cascade-chart-legend-btn', 'title': translate('Clear highlight'), 'aria-label': translate('Clear highlight') }).update('&times;');
    closeBtn.observe('click', function() {
      _this.clearCascadeHighlight();
    });
    legend.insert(openBtn);
    legend.insert(closeBtn);
    this._legendStack().insert(legend);
    this._legend = legend;
  },

  _hideLegend: function() {
    if (this._legend) {
      this._legend.remove();
      this._legend = null;
    }
  },

  // Floating legends (search, cascade) stack at the bottom centre of the chart
  _legendStack: function() {
    var stack = $('overlay-legend-stack');
    if (!stack) {
      stack = new Element('div', { 'id': 'overlay-legend-stack', 'class': 'overlay-legend-stack' });
      $('work-area').insert(stack);
    }
    return stack;
  },

  _showSearchLegend: function() {
    var workArea = $('work-area');
    if (!workArea || !this._search) return;
    var _this = this;
    if (!this._searchLegend) {
      var legend = new Element('div', { 'class': 'cascade-chart-legend search-chart-legend', 'role': 'status' });
      legend.insert(new Element('span', { 'class': 'cascade-chart-legend-swatch' }).setStyle({ borderColor: '#0284C7' }));
      legend.insert(new Element('span', { 'class': 'search-chart-legend-text' }));
      var editBtn = new Element('button', { 'type': 'button', 'class': 'cascade-chart-legend-btn' }).update(translate('Edit search'));
      editBtn.observe('click', function() {
        editor.getSearchPanel && editor.getSearchPanel().show();
      });
      var closeBtn = new Element('button', { 'type': 'button', 'class': 'cascade-chart-legend-btn', 'title': translate('Clear highlight'), 'aria-label': translate('Clear highlight') }).update('&times;');
      closeBtn.observe('click', function() {
        if (editor.getSearchPanel) {
          editor.getSearchPanel().clear();
        } else {
          _this.clearSearchHighlight();
        }
      });
      legend.insert(editBtn).insert(closeBtn);
      this._legendStack().insert({ top: legend });
      this._searchLegend = legend;
    }
    this._searchLegend.down('.search-chart-legend-text').update(this._search.summary.escapeHTML());
  },

  _hideSearchLegend: function() {
    if (this._searchLegend) {
      this._searchLegend.remove();
      this._searchLegend = null;
    }
  },

  /** Shows or hides the search legend (hidden while the search panel is open) */
  setSearchLegendVisible: function(visible) {
    if (this._searchLegend) {
      this._searchLegend.setStyle({ display: visible ? '' : 'none' });
    }
  }
});

export default PedigreeOverlay;
