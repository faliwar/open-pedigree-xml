import { Query, collectValues, personAge, disordersOf } from 'pedigree/model/pedigreeQuery';
import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { ANCESTRY_OPTIONS } from 'pedigree/model/clinicalData';
import { translate } from 'pedigree/i18n';

var IS_OPS = [['is', 'is'], ['isnot', 'is not']];
var HAS_OPS = [['has', 'has'], ['hasnot', 'does not have']];

/**
 * Filter types: label, operators, and how the value is entered.
 *   value: 'text' | 'number' | 'select' | 'person' | null; options() lists [value, label]
 *   value2: optional second input shown for some operators
 */
var FIELDS = [
  ['clinical', { label: 'Clinical status', ops: IS_OPS, value: 'select', options: function() {
    return [['affected', 'Affected'], ['carrier', 'Carrier'], ['presymptomatic', 'Pre-symptomatic'], ['evaluated', 'Documented evaluation']];
  } }],
  ['condition', { label: 'Condition', ops: HAS_OPS, value: 'select', options: function(v) {
    return [['', 'Any condition']].concat(v.disorders.map(function(d) { return [d, disorderName(d), true]; }));
  } }],
  ['agediag', { label: 'Age at diagnosis', ops: [['lte', 'at most'], ['gte', 'at least']], value: 'number',
    value2: 'select', options2: function(v) {
      return [['', 'any condition']].concat(v.disorders.map(function(d) { return [d, disorderName(d), true]; }));
    } }],
  ['test', { label: 'Genetic test', ops: [['positive', 'positive'], ['negative', 'negative'], ['vus', 'VUS'],
    ['pending', 'unknown / pending'], ['declined', 'declined'], ['any', 'any result'], ['none', 'not tested']],
  value: 'select', options: function(v) {
    return [['', 'any gene']].concat(v.genes.map(function(g) { return [g, g, true]; }));
  } }],
  ['sex', { label: 'Sex', ops: IS_OPS, value: 'select', options: function() {
    return [['M', 'Male'], ['F', 'Female'], ['U', 'Unknown']];
  } }],
  ['age', { label: 'Age', ops: [['gte', 'at least'], ['lte', 'at most'], ['between', 'between'], ['unknown', 'unknown']],
    value: 'number', value2: 'number' }],
  ['life', { label: 'Life status', ops: IS_OPS, value: 'select', options: function() {
    return [['alive', 'Alive'], ['deceased', 'Deceased'], ['stillborn', 'Stillborn'], ['miscarriage', 'Miscarriage'],
      ['unborn', 'Unborn'], ['aborted', 'Aborted']];
  } }],
  ['relation', { label: 'Relationship', ops: [['blood', 'blood relative of'], ['ancestor', 'ancestor of'],
    ['descendant', 'descendant of'], ['sibling', 'sibling of'], ['partner', 'partner of']],
  value: 'person', value2: 'select', options2: function() {
    return [['1', '1st degree'], ['2', 'up to 2nd degree'], ['3', 'up to 3rd degree'], ['99', 'any degree']];
  } }],
  ['phenotype', { label: 'Phenotype (HPO)', ops: HAS_OPS, value: 'select', options: function(v) {
    return [['', 'Any phenotype']].concat(v.hpo.map(function(h) { return [h, hpoName(h), true]; }));
  } }],
  ['ancestry', { label: 'Ancestry', ops: HAS_OPS, value: 'select', options: function(v) {
    var list = v.ancestry.length ? v.ancestry : ANCESTRY_OPTIONS;
    return list.map(function(a) { return [a, a]; });
  } }],
  ['name', { label: 'Name, ID or comment', ops: [['contains', 'contains'], ['notcontains', 'does not contain']], value: 'text' }],
  ['flag', { label: 'Other', ops: IS_OPS, value: 'select', options: function() {
    return [['proband', 'Proband'], ['adopted', 'Adopted'], ['nocontact', 'Not in contact'], ['twin', 'Twin'], ['comments', 'With comments']];
  } }]
];

var FIELD_MAP = {};
FIELDS.forEach(function(f) { FIELD_MAP[f[0]] = f[1]; });

var PRESETS = [
  ['Affected', 'all', function() { return [{ field: 'clinical', op: 'is', value: 'affected' }]; }],
  ['Positive genetic test', 'all', function() { return [{ field: 'test', op: 'positive', value: '' }]; }],
  ['Diagnosed at 50 or younger', 'all', function() { return [{ field: 'agediag', op: 'lte', value: '50', value2: '' }]; }],
  ['Living untested relatives of the proband', 'all', function(proband) {
    return [
      { field: 'relation', op: 'blood', value: String(proband), value2: '3' },
      { field: 'life', op: 'is', value: 'alive' },
      { field: 'test', op: 'none', value: '' }
    ];
  }],
  ['Ancestors of the proband', 'all', function(proband) { return [{ field: 'relation', op: 'ancestor', value: String(proband) }]; }]
];

var disorderName = function(id) {
  try {
    var d = editor.getDisorderLegend().getDisorder(id);
    return (d && d.getName && d.getName()) || id;
  } catch (e) {
    return id;
  }
};

var hpoName = function(id) {
  try {
    var t = editor.getHPOLegend().getTerm(id);
    return (t && t.getName && t.getName()) || id;
  } catch (e) {
    return id;
  }
};

/**
 * "Find people" panel: filters on sex, clinical status, conditions, ages, genetic tests,
 * ancestry and relationships (ancestors, descendants, blood relatives...), combined with
 * AND / OR. Matches are ringed on the chart (others faded) and listed; clicking one centres it.
 * The panel floats over the chart and does not block editing; results follow every change.
 *
 * @class SearchPanel
 */
var SearchPanel = Class.create({

  initialize: function() {
    var _this = this;
    this._panel = null;
    this._filters = [];
    this._match = 'all';
    this._results = null;
    this._dimOthers = true;
    this._timer = null;
    try {
      this._dimOthers = localStorage.getItem('openpedigree_search_dim') !== '0';
    } catch (e) {}

    var refresh = function() { _this.scheduleRefresh(); };
    ['pedigree:node:setproperty', 'pedigree:node:modify', 'pedigree:node:remove', 'pedigree:undo', 'pedigree:redo',
      'pedigree:person:newparent', 'pedigree:person:newsibling', 'pedigree:person:newpartnerandchild',
      'pedigree:person:newchildonly', 'pedigree:partnership:newchild', 'pedigree:person:drag:newparent',
      'pedigree:person:drag:newpartner', 'pedigree:person:drag:newsibling', 'pedigree:history:restored',
      'pedigree:load:finish'].forEach(function(name) {
      document.observe(name, refresh);
    });
    document.observe('pedigree:graph:clear', function() { _this.clear(); });
  },

  isVisible: function() {
    return !!(this._panel && this._panel.visible());
  },

  toggle: function() {
    if (this.isVisible()) {
      this.close();
    } else {
      this.show();
    }
  },

  show: function() {
    if (!this._panel) {
      this._build();
    }
    this._values = collectValues(editor.getGraph());
    this._fixReferences();
    if (!this._filters.length) {
      this._filters.push(this._newFilter('clinical'));
    }
    this._renderFilters();
    this._panel.show();
    this._run();
    editor.getOverlay().setSearchLegendVisible(false);
    var first = this._panel.down('.search-filter select, .search-filter input');
    if (first) first.focus();
  },

  /** Hides the panel; the highlight stays on the chart with a small legend to reopen it */
  close: function() {
    if (this._panel) this._panel.hide();
    editor.getOverlay().setSearchLegendVisible(true);
  },

  /** Removes every filter and the highlight */
  clear: function() {
    this._filters = [];
    this._results = null;
    editor.getOverlay() && editor.getOverlay().clearSearchHighlight();
    if (this.isVisible()) {
      this._filters.push(this._newFilter('clinical'));
      this._renderFilters();
      this._renderResults();
    }
  },

  /** Called by the view after nodes are added or removed */
  onGraphChanged: function(changeSet) {
    if (changeSet && changeSet.removed && changeSet.removed.length) {
      // node ids are renumbered after a removal: point relationship filters back at the proband
      var proband = String(editor.getGraph().getProbandId());
      this._filters.forEach(function(f) {
        if (f.field === 'relation') f.value = proband;
      });
      if (this.isVisible()) this._renderFilters();
    }
    this.scheduleRefresh();
  },

  scheduleRefresh: function() {
    var _this = this;
    if (!this._filters.length) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(function() { _this._run(); }, 80);
  },

  // -------------------------------------------------------------------------------------------

  _newFilter: function(field) {
    var def = FIELD_MAP[field];
    var f = { field: field, op: def.ops[0][0], value: '', value2: '' };
    var values = this._values || collectValues(editor.getGraph());
    if (def.value === 'select') {
      var opts = def.options(values);
      f.value = opts.length ? opts[0][0] : '';
    } else if (def.value === 'person') {
      f.value = String(editor.getGraph().getProbandId());
    }
    if (def.value2 === 'select' && def.options2) {
      var opts2 = def.options2(values);
      f.value2 = field === 'relation' ? '3' : (opts2.length ? opts2[0][0] : '');
    }
    return f;
  },

  _fixReferences: function() {
    var graph = editor.getGraph();
    var proband = String(graph.getProbandId());
    this._filters.forEach(function(f) {
      if (f.field === 'relation' && !(f.value !== '' && graph.isPerson(parseInt(f.value, 10)))) f.value = proband;
    });
  },

  _run: function() {
    var overlay = editor.getOverlay();
    if (!overlay) return;
    var graph = editor.getGraph();
    var query = new Query(graph);
    this._total = query.ids.length;
    this._results = query.run(this._filters, this._match);
    if (this._results === null) {
      overlay.clearSearchHighlight();
    } else {
      overlay.setSearchHighlight(this._results, { dimOthers: this._dimOthers, summary: this._summaryText() });
      overlay.setSearchLegendVisible(!this.isVisible());
    }
    if (this.isVisible()) this._renderResults();
  },

  _summaryText: function() {
    var n = this._results ? this._results.length : 0;
    return translate('Search:') + ' ' + n + ' ' + translate(n === 1 ? 'person found' : 'people found');
  },

  // -------------------------------------------------------------------------------------------
  // UI

  _build: function() {
    var _this = this;
    var panel = new Element('section', { 'class': 'search-panel', 'role': 'dialog', 'aria-label': translate('Find people') });
    panel.hide();

    var header = new Element('div', { 'class': 'search-panel-header' });
    header.insert(new Element('span', { 'class': 'fa fa-search search-panel-icon', 'aria-hidden': 'true' }));
    header.insert(new Element('h2', { 'class': 'search-panel-title' }).update(translate('Find people')));
    var closeBtn = new Element('button', { 'type': 'button', 'class': 'search-icon-btn search-panel-close', 'title': translate('Close'), 'aria-label': translate('Close') }).update('&times;');
    closeBtn.observe('click', function() { _this.close(); });
    header.insert(closeBtn);
    panel.insert(header);

    var body = new Element('div', { 'class': 'search-panel-body' });
    panel.insert(body);

    // presets
    var presets = new Element('div', { 'class': 'search-presets' });
    presets.insert(new Element('span', { 'class': 'search-presets-label' }).update(translate('Quick:')));
    PRESETS.forEach(function(p) {
      var b = new Element('button', { 'type': 'button', 'class': 'search-preset' }).update(translate(p[0]));
      b.observe('click', function() {
        _this._match = p[1];
        _this._filters = p[2](editor.getGraph().getProbandId());
        _this._renderFilters();
        _this._run();
      });
      presets.insert(b);
    });
    body.insert(presets);

    // match all / any
    var matchLine = new Element('div', { 'class': 'search-match' });
    var matchSelect = new Element('select', { 'class': 'search-select search-match-select', 'aria-label': translate('Combine filters') });
    [['all', 'all filters (AND)'], ['any', 'any filter (OR)']].forEach(function(o) {
      matchSelect.insert(new Element('option', { 'value': o[0] }).update(translate(o[1])));
    });
    matchSelect.observe('change', function() {
      _this._match = matchSelect.value;
      _this._run();
    });
    matchLine.insert(new Element('span').update(translate('People who match')));
    matchLine.insert(matchSelect);
    body.insert(matchLine);
    this._matchSelect = matchSelect;

    this._filtersBox = new Element('div', { 'class': 'search-filters' });
    body.insert(this._filtersBox);

    var tools = new Element('div', { 'class': 'search-tools' });
    var addBtn = new Element('button', { 'type': 'button', 'class': 'search-add' })
      .insert(new Element('span', { 'class': 'fa fa-plus', 'aria-hidden': 'true' })).insert(' ' + translate('Add filter'));
    addBtn.observe('click', function() {
      _this._filters.push(_this._newFilter('clinical'));
      _this._renderFilters();
      _this._run();
      var rows = _this._filtersBox.select('.search-filter');
      var last = rows[rows.length - 1];
      last && last.down('select') && last.down('select').focus();
    });
    var dimLabel = new Element('label', { 'class': 'search-dim' });
    var dimCb = new Element('input', { 'type': 'checkbox' });
    dimCb.checked = this._dimOthers;
    dimCb.observe('change', function() {
      _this._dimOthers = dimCb.checked;
      try { localStorage.setItem('openpedigree_search_dim', dimCb.checked ? '1' : '0'); } catch (e) {}
      _this._run();
    });
    dimLabel.insert(dimCb).insert(new Element('span').update(translate('Fade the others')));
    tools.insert(addBtn).insert(dimLabel);
    body.insert(tools);

    this._resultsBox = new Element('div', { 'class': 'search-results', 'aria-live': 'polite' });
    body.insert(this._resultsBox);

    var footer = new Element('div', { 'class': 'search-panel-footer' });
    var copyBtn = new Element('button', { 'type': 'button', 'class': 'search-footer-btn' }).update(translate('Copy list'));
    copyBtn.observe('click', function() { _this._copyList(copyBtn); });
    var clearBtn = new Element('button', { 'type': 'button', 'class': 'search-footer-btn' }).update(translate('Clear'));
    clearBtn.observe('click', function() { _this.clear(); });
    footer.insert(copyBtn).insert(clearBtn);
    panel.insert(footer);

    panel.observe('keydown', function(e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.stop();
        _this.close();
      }
    });

    $('work-area').insert(panel);
    this._panel = panel;
  },

  _select: function(options, value, cls, ariaLabel) {
    var sel = new Element('select', { 'class': 'search-select ' + (cls || ''), 'aria-label': ariaLabel || '' });
    var found = false;
    options.forEach(function(o) {
      // o[2]: the label is data (a disorder or gene name), not text to translate
      var opt = new Element('option', { 'value': o[0] }).update((o[2] ? o[1] : translate(o[1])).escapeHTML());
      if (String(o[0]) === String(value)) {
        opt.selected = true;
        found = true;
      }
      sel.insert(opt);
    });
    if (!found && value !== '' && value !== undefined && value !== null) {
      // keep a value that is no longer in the pedigree (e.g. a removed condition)
      var keep = new Element('option', { 'value': value }).update(String(value).escapeHTML());
      keep.selected = true;
      sel.insert(keep);
    }
    return sel;
  },

  _personOptions: function() {
    var graph = editor.getGraph();
    var numbering = computeStandardNumbering(editor);
    var ids = new Query(graph).ids;
    var byId = numbering.byId;
    ids.sort(function(a, b) {
      var na = byId[a] || { generation: 99, index: a }, nb = byId[b] || { generation: 99, index: b };
      return (na.generation - nb.generation) || (na.index - nb.index);
    });
    var proband = graph.getProbandId();
    return ids.map(function(id) {
      var node = editor.getNode(id);
      var name = (node && node.getName && node.getName()) || '';
      var std = (byId[id] && byId[id].label) || '';
      var text = (std ? std + ' · ' : '') + (name || (id === proband ? translate('Proband') : translate('Unnamed')));
      if (id === proband && name) text += ' (' + translate('Proband') + ')';
      return [String(id), text, true];
    });
  },

  _renderFilters: function() {
    var _this = this;
    var values = this._values || collectValues(editor.getGraph());
    this._matchSelect.value = this._match;
    this._filtersBox.update('');
    var personOptions = null;

    this._filters.forEach(function(f, index) {
      var def = FIELD_MAP[f.field];
      var row = new Element('div', { 'class': 'search-filter' });

      var fieldSel = _this._select(FIELDS.map(function(x) { return [x[0], x[1].label]; }), f.field, 'search-field', translate('Filter'));
      fieldSel.observe('change', function() {
        _this._filters[index] = _this._newFilter(fieldSel.value);
        _this._renderFilters();
        _this._run();
      });
      row.insert(fieldSel);

      var opSel = _this._select(def.ops, f.op, 'search-op', translate('Operator'));
      opSel.observe('change', function() {
        f.op = opSel.value;
        _this._renderFilters();
        _this._run();
      });
      row.insert(opSel);

      var onValue = function(key, input, live) {
        input.observe(live ? 'input' : 'change', function() {
          f[key] = input.value;
          _this.scheduleRefresh();
        });
      };

      var showValue = !(f.field === 'age' && f.op === 'unknown');
      if (showValue && def.value === 'text') {
        var text = new Element('input', { 'type': 'text', 'class': 'search-input', 'value': f.value || '', 'placeholder': translate('Type to search'), 'aria-label': translate('Value') });
        onValue('value', text, true);
        row.insert(text);
      } else if (showValue && def.value === 'number') {
        var n1 = new Element('input', { 'type': 'number', 'min': 0, 'max': 130, 'class': 'search-input search-number', 'value': f.value || '', 'placeholder': translate('years'), 'aria-label': translate('Value') });
        onValue('value', n1, true);
        row.insert(n1);
        if (f.field === 'age' && f.op === 'between') {
          row.insert(new Element('span', { 'class': 'search-and' }).update(translate('and')));
          var n2 = new Element('input', { 'type': 'number', 'min': 0, 'max': 130, 'class': 'search-input search-number', 'value': f.value2 || '', 'placeholder': translate('years'), 'aria-label': translate('Value') });
          onValue('value2', n2, true);
          row.insert(n2);
        }
      } else if (def.value === 'select') {
        var sel = _this._select(def.options(values), f.value, 'search-value', translate('Value'));
        onValue('value', sel, false);
        row.insert(sel);
      } else if (def.value === 'person') {
        personOptions = personOptions || _this._personOptions();
        var psel = _this._select(personOptions, f.value, 'search-value search-person', translate('Person'));
        onValue('value', psel, false);
        row.insert(psel);
      }

      if (def.value2 === 'select' && (f.field !== 'relation' || f.op === 'blood')) {
        var sel2 = _this._select(def.options2(values), f.value2, 'search-value2', translate('Value'));
        onValue('value2', sel2, false);
        row.insert(sel2);
      }

      var remove = new Element('button', { 'type': 'button', 'class': 'search-icon-btn search-remove', 'title': translate('Remove filter'), 'aria-label': translate('Remove filter') }).update('&times;');
      remove.observe('click', function() {
        _this._filters.splice(index, 1);
        _this._renderFilters();
        _this._run();
      });
      row.insert(remove);

      if (index > 0) {
        _this._filtersBox.insert(new Element('div', { 'class': 'search-joiner' }).update(translate(_this._match === 'any' ? 'or' : 'and')));
      }
      _this._filtersBox.insert(row);
    });

    if (!this._filters.length) {
      this._filtersBox.insert(new Element('p', { 'class': 'search-empty' }).update(translate('Add a filter or choose a quick search.')));
    }
  },

  _describe: function(id) {
    var node = editor.getNode(id);
    var parts = [];
    if (!node) return '';
    var sex = node.getGender && node.getGender();
    parts.push(sex === 'M' ? '♂' : (sex === 'F' ? '♀' : '◇'));
    var age = personAge(node);
    if (age !== null) parts.push(Math.floor(age + 1e-9) + ' ' + translate('years'));
    var status = node.getLifeStatus && node.getLifeStatus();
    if (status && status !== 'alive') parts.push(translate(status));
    var ds = disordersOf(node).map(disorderName);
    if (ds.length) parts.push(ds.join(', '));
    return parts.join(' · ');
  },

  _rows: function() {
    var _this = this;
    var numbering = computeStandardNumbering(editor);
    var byId = numbering.byId;
    var proband = editor.getGraph().getProbandId();
    var ids = (this._results || []).slice();
    ids.sort(function(a, b) {
      var na = byId[a] || { generation: 99, index: a }, nb = byId[b] || { generation: 99, index: b };
      return (na.generation - nb.generation) || (na.index - nb.index);
    });
    return ids.map(function(id) {
      var node = editor.getNode(id);
      var name = (node && node.getName && node.getName()) || '';
      return {
        id: id,
        label: (byId[id] && byId[id].label) || '',
        name: name || (id === proband ? translate('Proband') : translate('Unnamed')),
        details: _this._describe(id)
      };
    });
  },

  _renderResults: function() {
    var box = this._resultsBox;
    box.update('');
    if (this._results === null) {
      return;
    }
    var n = this._results.length;
    box.insert(new Element('div', { 'class': 'search-count' }).update(
      '<strong>' + n + '</strong> ' + translate('of') + ' ' + this._total + ' ' + translate(this._total === 1 ? 'person' : 'people')));
    if (!n) {
      box.insert(new Element('p', { 'class': 'search-empty' }).update(translate('Nobody matches these filters.')));
      return;
    }
    var list = new Element('ul', { 'class': 'search-result-list' });
    this._rows().forEach(function(r) {
      var item = new Element('li');
      var btn = new Element('button', { 'type': 'button', 'class': 'search-result', 'title': translate('Show on chart') });
      btn.insert(new Element('span', { 'class': 'search-result-id' }).update(r.label.escapeHTML()));
      var text = new Element('span', { 'class': 'search-result-text' });
      text.insert(new Element('span', { 'class': 'search-result-name' }).update(r.name.escapeHTML()));
      text.insert(new Element('span', { 'class': 'search-result-details' }).update(r.details.escapeHTML()));
      btn.insert(text);
      btn.observe('click', function() {
        editor.getWorkspace().centerAroundNode(r.id);
      });
      item.insert(btn);
      list.insert(item);
    });
    box.insert(list);
  },

  _copyList: function(button) {
    var rows = this._rows();
    var text = [[translate('ID'), translate('Name'), translate('Details')].join('\t')].concat(rows.map(function(r) {
      return [r.label, r.name, r.details].join('\t');
    })).join('\n');
    var done = function() {
      var old = button.innerHTML;
      button.update(translate('Copied!'));
      setTimeout(function() { button.update(old); }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function() {});
    }
  }
});

export default SearchPanel;
