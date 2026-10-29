import { translate } from 'pedigree/i18n';

var KEY = 'openpedigree_draft_v1';

/**
 * Keeps a copy of the pedigree in this browser (localStorage) after every change, so a reload,
 * a closed tab or a crash does not lose the work. Nothing is sent anywhere.
 *
 * Saving starts after the first user interaction, so the trio shown on startup is never stored
 * as a draft. Closing the page with changes that were not exported asks for confirmation.
 *
 * @class DraftStore
 */
var DraftStore = Class.create({

  initialize: function(enabled) {
    var _this = this;
    this._enabled = !!enabled;
    this._armed = false;
    this._dirty = false;
    this._timer = null;
    if (!this._enabled) return;

    var arm = function() { _this._armed = true; };
    document.addEventListener('pointerdown', arm, { capture: true, once: true });
    document.addEventListener('keydown', arm, { capture: true, once: true });

    document.observe('pedigree:changed', function() {
      if (!_this._armed) return;
      _this._dirty = true;
      clearTimeout(_this._timer);
      _this._timer = setTimeout(function() { _this.save(); }, 600);
    });
    document.observe('pedigree:exported', function() { _this._dirty = false; });

    window.addEventListener('beforeunload', function(e) {
      if (_this._timer) {
        clearTimeout(_this._timer);
        _this.save();
      }
      if (_this._dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  },

  isEnabled: function() {
    return this._enabled;
  },

  /** Marks the pedigree as saved elsewhere (exported), so closing the page does not warn */
  markClean: function() {
    this._dirty = false;
  },

  save: function() {
    this._timer = null;
    if (!this._enabled || typeof editor === 'undefined') return false;
    try {
      var info = editor.getPedigreeInfo ? editor.getPedigreeInfo().get() : {};
      var draft = {
        v: 1,
        savedAt: new Date().getTime(), // not Date.now(): a vendor script replaces it
        label: this._label(info),
        people: this._countPeople(),
        json: editor.getGraph().toJSON()
      };
      localStorage.setItem(KEY, JSON.stringify(draft));
      return true;
    } catch (e) {
      return false;
    }
  },

  /** The saved draft {savedAt, label, people, json}, or null */
  get: function() {
    if (!this._enabled) return null;
    try {
      var draft = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!draft || typeof draft.json !== 'string' || !draft.savedAt) return null;
      return draft;
    } catch (e) {
      return null;
    }
  },

  discard: function() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {}
  },

  restore: function(draft) {
    var json = draft.json;
    try {
      json = editor.getVersionUpdater().updateToCurrentVersion(json);
    } catch (e) {}
    editor.getSaveLoadEngine().createGraphFromSerializedData(json, false, true);
  },

  _countPeople: function() {
    var graph = editor.getGraph();
    var n = 0;
    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      try {
        if (graph.isPerson(id) && !graph.isPlaceholder(id)) n++;
      } catch (e) {}
    }
    return n;
  },

  _label: function(info) {
    if (info && info.title) return info.title;
    if (info && info.family) return translate('Family') + ' ' + info.family;
    try {
      var proband = editor.getNode(editor.getGraph().getProbandId());
      var name = proband && proband.getName && proband.getName();
      if (name) return name;
    } catch (e) {}
    return '';
  }
});

export default DraftStore;
