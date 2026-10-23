import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { getLanguage, translate } from 'pedigree/i18n';

var TEMPLATES = {
  en: {
    clear: 'Cleared the pedigree',
    remove: 'Removed {p}',
    set: 'Changed {f} of {p}',
    addTwin: 'Added a twin to {p}',
    modify: 'Modified {p}',
    newParents: 'Added parents of {p}',
    dragParent: 'Linked {p} to existing parents',
    newSibling: 'Added a sibling of {p}',
    dragSibling: 'Linked {p} and {q} as siblings',
    newPartnerChild: 'Added a partner and child of {p}',
    newChild: 'Added a child of {p}',
    dragPartner: 'Linked {p} and {q} as partners',
    coupleChild: 'Added a child to a couple',
    reorder: 'Reordered siblings',
    relayout: 'Re-arranged the layout',
    load: 'Loaded or imported a pedigree',
    generic: 'Updated the pedigree',
    undo: 'Undo: {d}',
    redo: 'Redo: {d}',
    restore: 'Restored the version from {t}',
    couple: 'a couple',
    yes: 'yes',
    no: 'no',
    cleared: 'cleared'
  },
  pt: {
    clear: 'Limpou o heredograma',
    remove: 'Removeu {p}',
    set: 'Alterou {f} de {p}',
    addTwin: 'Adicionou um gêmeo a {p}',
    modify: 'Modificou {p}',
    newParents: 'Adicionou os pais de {p}',
    dragParent: 'Ligou {p} a pais existentes',
    newSibling: 'Adicionou irmão(ã) de {p}',
    dragSibling: 'Ligou {p} e {q} como irmãos',
    newPartnerChild: 'Adicionou parceiro(a) e filho(a) de {p}',
    newChild: 'Adicionou filho(a) de {p}',
    dragPartner: 'Ligou {p} e {q} como parceiros',
    coupleChild: 'Adicionou filho(a) a um casal',
    reorder: 'Reordenou irmãos',
    relayout: 'Reorganizou o layout',
    load: 'Carregou ou importou um heredograma',
    generic: 'Atualizou o heredograma',
    undo: 'Desfez: {d}',
    redo: 'Refez: {d}',
    restore: 'Restaurou a versão de {t}',
    couple: 'um casal',
    yes: 'sim',
    no: 'não',
    cleared: 'removido'
  }
};

var FIELDS = {
  setGender: ['sex', 'sexo'], setName: ['name', 'nome'], setFirstName: ['name', 'nome'], setLastName: ['name', 'nome'],
  setExternalID: ['identifier', 'identificador'], setCarrierStatus: ['carrier status', 'status de portador'],
  setEvaluated: ['evaluation', 'avaliação'], setDisorders: ['disorders', 'doenças'], setGenes: ['genes', 'genes'],
  setHPO: ['phenotypes', 'fenótipos'], setAgeInput: ['age', 'idade'], setBirthDate: ['date of birth', 'data de nascimento'],
  setDeathDate: ['date of death', 'data de óbito'], setLifeStatus: ['life status', 'status vital'],
  setGestationAge: ['gestation age', 'idade gestacional'], setChildlessStatus: ['heredity options', 'opções de hereditariedade'],
  setAdopted: ['adoption', 'adoção'], setMonozygotic: ['monozygotic twin', 'gêmeo monozigótico'],
  setLostContact: ['contact with proband', 'contato com o probando'], setProband: ['proband', 'probando'],
  makePlaceholder: ['placeholder', 'marcador'], setComments: ['comments', 'comentários'],
  setConsanguinity: ['consanguinity', 'consanguinidade'], setBrokenStatus: ['separation', 'separação'],
  setNumPersons: ['group size', 'tamanho do grupo'], setDobApprox: ['approximate date of birth', 'data de nascimento aproximada']
};

// Values that would leak free text into a short summary are not shown (only the field name is)
var HIDE_VALUE = { setComments: true };

var EVENTS = [
  'pedigree:graph:clear', 'pedigree:node:remove', 'pedigree:node:setproperty', 'pedigree:node:modify',
  'pedigree:person:drag:newparent', 'pedigree:person:drag:newpartner', 'pedigree:person:drag:newsibling',
  'pedigree:person:newparent', 'pedigree:person:newsibling', 'pedigree:person:newpartnerandchild',
  'pedigree:person:newchildonly', 'pedigree:partnership:newchild', 'pedigree:sibling:reorder'
];

/**
 * Modification history: a timeline of what changed in the pedigree, when, and by whom.
 *
 * Each undo/redo state gets a plain-language description ("Changed life status of II-3: deceased").
 * Undo, redo and restores are logged too, so the timeline is never rewritten. Any version still
 * held by the undo stack can be restored from the panel, and the log can be exported as CSV.
 *
 * Must be created before the Controller, so that it can describe an event (e.g. the name of a
 * person being removed) before the event is applied.
 *
 * @class ModificationHistory
 */
var ModificationHistory = Class.create({

  initialize: function() {
    var _this = this;
    this._entries = [];
    this._pending = null;
    this.dialog = null;
    this._author = '';
    try {
      this._author = localStorage.getItem('openpedigree_history_author') || '';
    } catch (e) {}

    EVENTS.forEach(function(eventName) {
      document.observe(eventName, function(event) {
        if (event.memo && !event.memo.noUndoRedo && !event.memo._opxDesc) {
          try {
            event.memo._opxDesc = _this._describeEvent(eventName, event.memo);
          } catch (e) {}
        }
      });
    });
    document.observe('pedigree:load:start', function() { _this._pending = 'load'; });
    document.observe('pedigree:graph:relayout', function() { _this._pending = 'relayout'; });
  },

  // -------------------------------------------------------------------------------------------
  // Descriptions

  _lang: function() {
    return getLanguage() === 'pt-BR' ? 'pt' : 'en';
  },

  _t: function(key, vars) {
    var text = TEMPLATES[this._lang()][key] || key;
    vars = vars || {};
    return text.replace(/\{(\w)\}/g, function(m, k) { return vars.hasOwnProperty(k) ? vars[k] : ''; });
  },

  _label: function(id) {
    if (id === undefined || id === null || typeof editor === 'undefined') {
      return '';
    }
    try {
      var graph = editor.getGraph();
      if (graph.isRelationship(id)) {
        return this._t('couple');
      }
      var node = editor.getNode(id);
      var name = node && node.getName ? node.getName() : '';
      var std = computeStandardNumbering(editor).byId[id];
      if (name && std) return name + ' (' + std.label + ')';
      if (name) return name;
      if (std) return std.label;
    } catch (e) {}
    return '#' + id;
  },

  _formatValue: function(value) {
    var t = this._t.bind(this);
    if (value === true) return t('yes');
    if (value === false) return t('no');
    if (value === null || value === undefined || value === '') return t('cleared');
    if (value instanceof Date) return value.toLocaleDateString();
    if (Array.isArray(value)) {
      if (!value.length) return t('cleared');
      return value.map(function(v) {
        return (v && typeof v === 'object') ? (v.name || v.gene || v.id || '') : String(v);
      }).filter(Boolean).join(', ');
    }
    if (typeof value === 'object') return '';
    var s = String(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      var d = new Date(s);
      if (!isNaN(d.getTime())) return d.toLocaleDateString();
    }
    return s.length > 40 ? s.substring(0, 37) + '...' : s;
  },

  _describeEvent: function(eventName, memo) {
    var p = this._label(memo.nodeID !== undefined ? memo.nodeID : memo.personID);
    var _this = this;
    switch (eventName) {
      case 'pedigree:graph:clear':
        return this._t('clear');
      case 'pedigree:node:remove':
        return this._t('remove', { p: p });
      case 'pedigree:node:setproperty':
        var langIdx = this._lang() === 'pt' ? 1 : 0;
        var parts = Object.keys(memo.properties || {}).map(function(fn) {
          var field = FIELDS[fn] ? FIELDS[fn][langIdx] : fn.replace(/^set/, '');
          var text = _this._t('set', { f: field, p: p });
          var value = HIDE_VALUE[fn] ? '' : _this._formatValue(memo.properties[fn]);
          return value ? text + ': ' + value : text;
        });
        return parts.join('; ') || this._t('modify', { p: p });
      case 'pedigree:node:modify':
        if (memo.modifications && memo.modifications.addTwin) {
          return this._t('addTwin', { p: p });
        }
        return this._t('modify', { p: p });
      case 'pedigree:person:drag:newparent':
        return this._t('dragParent', { p: p });
      case 'pedigree:person:newparent':
        return this._t('newParents', { p: p });
      case 'pedigree:person:newsibling':
        return this._t('newSibling', { p: p });
      case 'pedigree:person:drag:newsibling':
        return this._t('dragSibling', { p: this._label(memo.sibling1ID), q: this._label(memo.sibling2ID) });
      case 'pedigree:person:newpartnerandchild':
        return this._t('newPartnerChild', { p: p });
      case 'pedigree:person:newchildonly':
        return this._t('newChild', { p: p });
      case 'pedigree:person:drag:newpartner':
        return this._t('dragPartner', { p: p, q: this._label(memo.partnerID) });
      case 'pedigree:partnership:newchild':
        return this._t('coupleChild');
      case 'pedigree:sibling:reorder':
        return this._t('reorder');
    }
    return this._t('generic');
  },

  /**
   * Description for a new undo/redo state (called by ActionStack.addState)
   */
  describeState: function(event) {
    if (event && event.memo && event.memo._opxDesc) {
      return event.memo._opxDesc;
    }
    if (event && event.eventName) {
      return this._describeEvent(event.eventName, event.memo || {});
    }
    var pending = this._pending;
    this._pending = null;
    return this._t(pending || 'generic');
  },

  getAuthor: function() {
    return this._author;
  },

  setAuthor: function(author) {
    this._author = (author || '').trim();
    try {
      localStorage.setItem('openpedigree_history_author', this._author);
    } catch (e) {}
  },

  /**
   * Called by ActionStack: kind is 'change', 'update' (merged into previous change), 'undo' or 'redo'
   */
  onStackEvent: function(kind, state) {
    if (kind === 'change') {
      this._entries.push({ kind: 'change', time: state.timestamp, author: state.author, text: state.description, state: state });
    } else if (kind === 'update') {
      var last = this._entries[this._entries.length - 1];
      if (last && last.state === state) {
        last.time = state.timestamp;
        last.text = state.description;
        last.author = state.author;
      } else {
        this._entries.push({ kind: 'change', time: state.timestamp, author: state.author, text: state.description, state: state });
      }
    } else if (kind === 'undo' || kind === 'redo') {
      this._entries.push({ kind: kind, time: new Date(), author: this._author, text: this._t(kind, { d: state.description || this._t('generic') }), state: null });
    }
    if (this.dialog) {
      this._renderList();
    }
  },

  getEntries: function() {
    return this._entries.slice(0);
  },

  restore: function(entry) {
    var stack = editor.getActionStack();
    if (!entry.state || !stack.goToState(entry.state)) {
      return false;
    }
    this._entries.push({ kind: 'restore', time: new Date(), author: this._author, text: this._t('restore', { t: this._formatTime(entry.time) }), state: null });
    // let other parts (e.g. Drive autosave) know the pedigree changed
    document.fire('pedigree:history:restored');
    return true;
  },

  // -------------------------------------------------------------------------------------------
  // UI

  _formatTime: function(date) {
    if (!date) return '';
    var now = new Date();
    var time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (date.toDateString() === now.toDateString()) {
      return time;
    }
    return date.toLocaleDateString() + ' ' + time;
  },

  show: function() {
    var _this = this;
    if (this.dialog) {
      this.hide();
    }
    var content = new Element('div', { 'class': 'history-dialog-content' });
    content.insert(new Element('p', { 'class': 'history-intro' }).update(
      translate('Timeline of changes made in this session. Restore any earlier version still available; restoring is also recorded.')));

    var authorRow = new Element('label', { 'class': 'history-author' });
    authorRow.insert(new Element('span').update(translate('Your name or initials (recorded with each change)')));
    var authorInput = new Element('input', { 'type': 'text', 'class': 'history-author-input', 'maxlength': 40, 'value': this._author, 'placeholder': translate('e.g. FP') });
    authorInput.observe('change', function() { _this.setAuthor(authorInput.value); });
    authorInput.observe('blur', function() { _this.setAuthor(authorInput.value); });
    authorRow.insert(authorInput);
    content.insert(authorRow);

    this._list = new Element('ol', { 'class': 'history-list' });
    content.insert(this._list);
    this._renderList();

    var buttons = new Element('div', { 'class': 'history-buttons' });
    var exportBtn = new Element('input', { 'type': 'button', 'class': 'button secondary', 'value': translate('Export log (CSV)') });
    exportBtn.observe('click', function() { _this.exportCSV(); });
    var closeBtn = new Element('input', { 'type': 'button', 'class': 'button history-close-btn', 'value': translate('Close') });
    closeBtn.observe('click', function() { _this.hide(); });
    buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(exportBtn));
    buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(closeBtn));
    content.insert(buttons);

    this.dialog = new PhenoTips.widgets.ModalPopup(content, {
      close: { method: function() { _this.hide(); }, keys: ['Esc'] }
    }, {
      extraClassName: 'history-modal-box',
      title: translate('Modification history'),
      displayCloseButton: true,
      removeOnClose: true
    });
    this.dialog.show();
  },

  hide: function() {
    if (this.dialog) {
      var d = this.dialog;
      this.dialog = null;
      try {
        d.close();
      } catch (e) {
        // already closed by its own X button
      }
      if (d.dialog && d.dialog.parentNode) {
        d.dialog.remove();
      }
    }
  },

  _renderList: function() {
    var _this = this;
    if (!this._list) {
      return;
    }
    this._list.update('');
    var stack = editor.getActionStack();
    var states = stack.getStates();
    var currentState = states[stack.getCurrentIndex()];

    if (!this._entries.length) {
      this._list.insert(new Element('li', { 'class': 'history-empty' }).update(translate('No changes yet.')));
      return;
    }

    this._entries.slice(0).reverse().forEach(function(entry) {
      var li = new Element('li', { 'class': 'history-item history-kind-' + entry.kind });
      var icon = { change: 'fa-pen', undo: 'fa-undo', redo: 'fa-redo', restore: 'fa-history' }[entry.kind] || 'fa-pen';
      li.insert(new Element('span', { 'class': 'history-icon fa ' + icon, 'aria-hidden': 'true' }));

      var body = new Element('div', { 'class': 'history-body' });
      body.insert(new Element('div', { 'class': 'history-text' }).update((entry.text || '').escapeHTML()));
      var meta = _this._formatTime(entry.time) + (entry.author ? ' · ' + entry.author : '');
      body.insert(new Element('div', { 'class': 'history-meta' }).update(meta.escapeHTML()));
      li.insert(body);

      if (entry.kind === 'change') {
        var idx = states.indexOf(entry.state);
        if (entry.state && entry.state === currentState) {
          li.addClassName('is-current');
          li.insert(new Element('span', { 'class': 'history-badge' }).update(translate('Current')));
        } else if (idx >= 0) {
          if (idx > stack.getCurrentIndex()) {
            li.addClassName('is-undone');
          }
          var btn = new Element('button', { 'type': 'button', 'class': 'history-restore' }).update(translate('Restore'));
          btn.observe('click', function() {
            if (_this.restore(entry)) {
              _this._renderList();
            }
          });
          li.insert(btn);
        }
      }
      _this._list.insert(li);
    });
  },

  exportCSV: function() {
    var cell = function(v) {
      v = (v === undefined || v === null) ? '' : String(v);
      return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    var lines = [[translate('Date'), translate('Time'), translate('Author'), translate('Action'), translate('Change')].map(cell).join(',')];
    this._entries.forEach(function(e) {
      lines.push([e.time.toLocaleDateString(), e.time.toLocaleTimeString(), e.author || '', translate(e.kind), e.text].map(cell).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var fileName = 'pedigree-history.csv';
    if (typeof window.saveAs === 'function') {
      window.saveAs(blob, fileName);
    } else {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }
});

export default ModificationHistory;
