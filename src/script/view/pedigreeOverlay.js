import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';
import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { getLanguage, translate } from 'pedigree/i18n';
import { makeInbreeding, formatCoefficient, coupleIsConsanguineous } from 'pedigree/model/kinship';
import { moveTextFast } from 'pedigree/view/graphicHelpers';

/**
 * PedigreeOverlay draws non-interactive annotations on top of the pedigree canvas:
 *  - standard nomenclature (generation Roman numerals and per-person "II-3" numbers);
 *  - cascade testing highlights (rings around the index person and at-risk relatives);
 *  - search highlights (rings around the people found, others faded).
 *
 * Every element it draws is tagged with a `data-opx-overlay` attribute so exports can
 * keep or drop it, and ignores pointer events so it never gets in the way of editing
 * (except the click band over donor / surrogate lines, used to delete them).
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
    this._showInbreeding = true;
    try {
      var saved = JSON.parse(localStorage.getItem('openpedigree_overlay_v1') || '{}');
      this._showNumbering = !!saved.showNumbering;
      this._showInbreeding = saved.showInbreeding !== false; // on by default
    } catch (e) {}
  },

  _saveSettings: function() {
    try {
      localStorage.setItem('openpedigree_overlay_v1', JSON.stringify({ showNumbering: this._showNumbering, showInbreeding: this._showInbreeding }));
    } catch (e) {}
  },

  isInbreedingVisible: function() {
    return this._showInbreeding;
  },

  /** Wright's F written above the line of each consanguineous couple */
  setInbreedingVisible: function(visible) {
    this._showInbreeding = !!visible;
    this._saveSettings();
    this.redraw();
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
   * Node ids were renumbered (a node was removed): the rings follow their people.
   * @param {Function} map old id -> new id, or null when that person no longer exists
   */
  remapCascadeIds: function(map) {
    if (!this._cascade) return;
    var colorById = {};
    var old = this._cascade.colorById;
    Object.keys(old).forEach(function(id) {
      var mapped = map(id);
      if (mapped !== null) colorById[mapped] = old[id];
    });
    this._cascade.colorById = colorById;
    var index = map(this._cascade.indexId);
    if (index === null) {
      this.clearCascadeHighlight();
    } else {
      this._cascade.indexId = index;
    }
  },

  /**
   * Called after the graph structure changed. A cascade highlight is computed again by the
   * cascade dialog (the relatives may have changed), which also follows renumbered people.
   */
  onGraphChanged: function(changeSet) {
    if (this._cascade && editor.getCascadeTestingDialog) {
      editor.getCascadeTestingDialog().onGraphChanged();
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
      if (!node || !node.getX || editor.getGraph().isHiddenBranch(id)) return;
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
      this._drawStandardMarks();
      if (this._search) {
        this._drawSearch();
      }
      if (this._cascade) {
        this._drawCascade();
      }
      if (this._showNumbering) {
        this._drawNumbering();
      } else {
        this._dropNumbers();
      }
      if (this._showInbreeding) {
        this._drawInbreeding();
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
      this._dropNumbers();
      return;
    }

    // Generation numerals share one column left of the leftmost person of the whole chart
    var globalMinX = Math.min.apply(null, numbering.tiers.map(function(t) { return t.minX; }));
    var numeralX = globalMinX - radius * 2.6;

    // The numbers are kept between redraws and only moved: creating a text makes the browser
    // measure it, and there is one per person, redrawn after every change to the pedigree
    var pool = this._numberPool || (this._numberPool = {});
    var used = {};
    var place = function(key, x, y, content, attrs) {
      var el = pool[key];
      if (el && (el.removed || !el.node || !el.node.parentNode || el.attrs.text !== content)) {
        try { el.remove(); } catch (e) {}
        el = null;
      }
      if (el) {
        moveTextFast(el, x, y);
        el.toFront();
      } else {
        el = paper.text(x, y, content).attr(attrs);
        el.node.setAttribute('data-opx-overlay', 'numbering');
        el.node.style.pointerEvents = 'none';
        pool[key] = el;
      }
      used[key] = true;
    };

    numbering.tiers.forEach(function(tier, t) {
      place('tier' + t, numeralX, tier.y, tier.roman, {
        'font-size': 28,
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-weight': 'bold',
        'fill': '#475569',
        'text-anchor': 'middle'
      });

      tier.persons.forEach(function(p) {
        place('person' + p.id, p.x - radius - 3, p.y - radius - 7, String(numbering.byId[p.id].index), {
          'font-size': 18,
          'font-family': 'Arial, Helvetica, sans-serif',
          'font-weight': 'bold',
          'fill': '#334155',
          'text-anchor': 'end'
        });
      });
    });
    this._dropNumbers(used);
  },

  // Removes the pooled numbers that are not in "used" (all of them when it is not given)
  _dropNumbers: function(used) {
    var pool = this._numberPool || {};
    Object.keys(pool).forEach(function(key) {
      if (!used || !used[key]) {
        try { pool[key].remove(); } catch (e) {}
        delete pool[key];
      }
    });
  },

  // "F = 1/16" above the junction of each consanguineous couple whose common ancestors are drawn
  _drawInbreeding: function() {
    var paper = editor.getPaper();
    var graph = editor.getGraph();
    var calc = makeInbreeding(graph);
    var lang = getLanguage();
    var _this = this;
    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      var consanguineous = false;
      try {
        consanguineous = graph.isRelationship(id) && coupleIsConsanguineous(graph, id);
      } catch (e) {}
      if (!consanguineous) continue;
      var partners = [];
      try { partners = graph.DG.GG.getParents(id); } catch (e) {}
      if (partners.length !== 2) continue;
      var f = calc.kinship(partners[0], partners[1]);
      var node = editor.getNode(id);
      if (!(f > 0) || !node || !node.getX) continue;
      // a stated degree of relationship takes the line right above the couple
      var lift = (node.getRelationDegree && node.getRelationDegree()) ? 42 : 22;
      _this._boxedText(node.getX(), node.getY() - lift, 'F = ' + formatCoefficient(f, lang).replace(/ \(.*\)$/, ''), 'inbreeding', { 'font-style': 'italic' });
    }
  },

  // Text on a white background, so that it stays readable over lines
  _boxedText: function(x, y, content, kind, attrs) {
    var paper = editor.getPaper();
    var text = paper.text(x, y, content).attr(Object.assign({
      'font-size': 16,
      'font-family': 'Arial, Helvetica, sans-serif',
      'fill': '#1F2937',
      'text-anchor': 'middle'
    }, attrs || {}));
    var box = text.getBBox();
    var bg = paper.rect(box.x - 4, box.y - 1, box.width + 8, box.height + 2, 3).attr({ 'fill': '#FFFFFF', 'fill-opacity': 0.9, 'stroke': 'none' });
    text.toFront();
    this._tag(bg, kind);
    this._tag(text, kind);
  },

  /**
   * Standard marks that are part of the pedigree itself (Bennett et al. 2008, 2022), always drawn:
   *   "?" above a person whose family history is not available or not known
   *   "D" (gamete donor) or "S" (surrogate, gestational carrier) inside the symbol
   *   the stated degree of relationship (e.g. "third cousins") above a relationship line
   */
  // "+12" on a dashed outline at the lower right of a collapsed person; unlike the other marks it
  // reacts to clicks (it shows the branch again)
  _drawCollapsedBadge: function(node, count) {
    var paper = editor.getPaper();
    var radius = PedigreeEditorParameters.attributes.radius || 40;
    // below the partner handle and line, to the right of the text under the symbol
    var x = node.getX() + radius + 16;
    var y = node.getY() + radius + 4;
    var text = paper.text(x, y, '+' + count).attr({
      'font-size': 17, 'font-family': 'Arial, Helvetica, sans-serif', 'font-weight': 'bold', 'fill': '#1D4ED8'
    });
    var box = text.getBBox();
    var bg = paper.rect(box.x - 6, box.y - 3, box.width + 12, box.height + 6, 9).attr({
      'fill': '#EFF6FF', 'stroke': '#1D4ED8', 'stroke-width': 1.5, 'stroke-dasharray': '- '
    });
    text.toFront();
    var id = node.getID();
    var title = translate('Hidden branch: click to show it');
    [bg, text].forEach(function(el) {
      el.node.setAttribute('data-opx-overlay', 'collapsed-badge');
      el.node.setAttribute('data-opx-export', 'omit');
      el.node.style.cursor = 'pointer';
      el.attr('title', title);
      el.click(function() {
        document.fire('pedigree:node:setproperty', { 'nodeID': id, 'properties': { 'setCollapsed': false } });
      });
    });
    this._elements.push(bg);
    this._elements.push(text);
  },

  _drawStandardMarks: function() {
    var graph = editor.getGraph();
    var radius = PedigreeEditorParameters.attributes.radius || 40;
    var background = editor.getWorkspace && editor.getWorkspace().background;
    var byArtKey = {};   // donors and surrogates, by the key their children point at
    var linked = [];     // people with a line of descent from a donor or surrogate
    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      var node = editor.getNode(id);
      if (!node || !node.getX || graph.isHiddenBranch(id)) continue;
      // a collapsed person: how many people are hidden behind them; click to show them again
      if (node.getCollapsed && node.getCollapsed()) {
        var hiddenCount = graph.getBranchSize(id);
        // (nothing hidden when, seen from the current consultand, nobody is behind this person)
        if (hiddenCount > 0) {
          this._drawCollapsedBadge(node, hiddenCount);
        }
      }
      if (node.getArtKey) {
        if (node.getArtKey() !== null && node.getArtRole()) byArtKey[node.getArtKey()] = node;
        if (node.getArtLinks().length) linked.push(node);
      }
      if (node.getRelationDegree) {
        if (node.getRelationDegree()) {
          this._boxedText(node.getX(), node.getY() - 22, node.getRelationDegree(), 'standard');
        }
        continue;
      }
      if (!node.getArtRole || (node.isVirtual && node.isVirtual())) continue;
      if (node.getHistoryUnknown()) {
        // beside the line of descent when the person has parents drawn
        var hasParents = false;
        try { hasParents = graph.getParentRelationship(id) !== null; } catch (e) {}
        this._tag(editor.getPaper().text(node.getX() + (hasParents ? 16 : 0), node.getY() - radius - 16, '?').attr({
          'font-size': 22, 'font-family': 'Arial, Helvetica, sans-serif', 'font-weight': 'bold', 'fill': '#1F2937'
        }), 'standard');
      }
      if (node.getArtRole()) {
        this._boxedText(node.getX(), node.getY(), node.getArtRole() === 'donor' ? 'D' : 'S', 'standard', { 'font-size': 26, 'font-weight': 'bold' });
      }
    }

    // Line of descent from each donor / surrogate to the child, solid and with no relationship
    // line (Bennett et al. 2008, fig. 3): from under their symbol to the top of the child's
    var _this = this;
    linked.forEach(function(child) {
      child.getArtLinks().forEach(function(key) {
        var donor = byArtKey[key];
        if (!donor) return;
        var line = editor.getPaper().path(_this._pathWithBumps(donor.getX(), donor.getY() + radius, child.getX(), child.getY() - radius))
          .attr(PedigreeEditorParameters.attributes.partnershipLines);
        if (background) line.insertAfter(background);
        _this._tag(line, 'standard');
        _this._addArtLinkHandle(line, child.getID(), key);
      });
    });
  },

  /**
   * Path of a straight line from (x1,y1) to (x2,y2) that hops over every pedigree line it crosses
   * with the same small "bump" the relationship and sibship lines use, so that a crossing is never
   * read as a junction. The bump is drawn along the line, bulging towards the top of the chart.
   */
  _pathWithBumps: function(x1, y1, x2, y2) {
    var path = 'M ' + x1 + ' ' + y1;
    var length = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    var lineSet = editor.getView() && editor.getView()._lineSet;
    if (length > 0 && lineSet && lineSet.getCrossings) {
      var dx = (x2 - x1) / length, dy = (y2 - y1) / length;   // along the line
      var nx = dy, ny = -dx;                                  // across it...
      if (ny > 0 || (ny == 0 && nx < 0)) {                    // ...on the upper side
        nx = -nx;
        ny = -ny;
      }
      var along = function(p) { return (p.x - x1) * dx + (p.y - y1) * dy; };
      var at = function(p, a, b) {
        return (p.x + a * dx + b * nx).toFixed(1) + ' ' + (p.y + a * dy + b * ny).toFixed(1);
      };
      var crossings = lineSet.getCrossings(x1, y1, x2, y2).sort(function(p, q) { return along(p) - along(q); });
      var last = -Infinity;
      for (var i = 0; i < crossings.length; i++) {
        var p = crossings[i];
        var t = along(p);
        // not at the ends (where the line meets a symbol) and not on top of the previous bump
        if (t < 14 || t > length - 14 || t - last < 24) {
          continue;
        }
        last = t;
        path += ' L ' + at(p, -10, 0);
        path += ' C ' + at(p, -7, -1) + ' ' + at(p, -7, 7) + ' ' + at(p, 0, 7);
        path += ' C ' + at(p, 7, 7) + ' ' + at(p, 7, -1) + ' ' + at(p, 10, 0);
      }
    }
    return path + ' L ' + x2 + ' ' + y2;
  },

  /**
   * Wide invisible band over a donor / surrogate line of descent: highlights the line on hover
   * and, on click, offers to delete it. Screen only (never exported).
   */
  _addArtLinkHandle: function(line, childID, key) {
    var hit = line.clone().attr({ 'stroke': '#000000', 'stroke-opacity': 0, 'stroke-width': 16, 'stroke-dasharray': '' });
    hit.insertAfter(line);
    this._elements.push(hit);
    if (!hit.node) return;
    hit.node.setAttribute('data-opx-overlay', 'handle');
    hit.node.setAttribute('data-opx-export', 'omit');
    hit.node.style.cursor = 'pointer';
    hit.attr('title', translate('Click to delete this donor / surrogate line'));
    var normal = { 'stroke': line.attr('stroke'), 'stroke-width': line.attr('stroke-width') };
    hit.hover(function() {
      line.attr({ 'stroke': '#DC2626', 'stroke-width': Math.max(3, (normal['stroke-width'] || 1) + 2) });
    }, function() {
      line.attr(normal);
    });
    hit.click(function() {
      line.attr(normal);
      if (confirm(translate('Delete this donor / surrogate line of descent?'))) {
        document.fire('pedigree:person:removeartlink', { 'personID': childID, 'key': key });
      }
    });
  },

  _drawCascade: function() {
    var paper = editor.getPaper();
    var radius = PedigreeEditorParameters.attributes.radius || 40;
    var background = editor.getWorkspace && editor.getWorkspace().background;
    var _this = this;

    var drawRing = function(id, color, isIndex) {
      var node = editor.getNode(id);
      if (!node || !node.getX || editor.getGraph().isHiddenBranch(id)) {
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
