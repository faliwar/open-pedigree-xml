import { findBloodRelatives, relationshipName, isRealPerson, getGeneticSex, getBiologicalParents, inbreedingOf, formatCoefficient, coupleIsConsanguineous } from 'pedigree/model/kinship';
import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { getLanguage, translate } from 'pedigree/i18n';
import getAge from 'pedigree/view/ageCalc';
import { computeVariantRisks } from 'pedigree/model/inheritance';
import { parsePenetranceCurve, curveFraction, curveLifetime, activeCurve } from 'pedigree/model/penetrance';
import { buildPreset, parsePreset, resolvePreset } from 'pedigree/model/cascadePresets';
import { testLabel as clinicalTestLabel, testResult as clinicalTestResult } from 'pedigree/model/clinicalData';

var INHERITANCE_OPTIONS = [
  ['AD', 'Autosomal dominant'],
  ['AR', 'Autosomal recessive'],
  ['XLR', 'X-linked recessive'],
  ['XLD', 'X-linked dominant'],
  ['MT', 'Mitochondrial'],
  ['YL', 'Y-linked']
];

var INHERITANCE_NAMES = {};
INHERITANCE_OPTIONS.forEach(function(o) { INHERITANCE_NAMES[o[0]] = o[1]; });

var MIN_RISK = 0.0005; // below this a relative is considered not at risk

var PEDIGREE_STATE_FORMAT = 'open-pedigree-x/cascade-state';

var DEGREE_COLORS = { 1: '#DC2626', 2: '#EA580C', 3: '#CA8A04' };

var DEGREE_LABELS = { 1: '1st degree', 2: '2nd degree', 3: '3rd degree' };

var LIFE_STATUS_LABELS = {
  alive: 'Alive', deceased: 'Deceased', stillborn: 'Stillborn',
  miscarriage: 'Miscarriage', unborn: 'Unborn', aborted: 'Aborted'
};

var CARRIER_LABELS = { carrier: 'Carrier', affected: 'Affected', presymptomatic: 'Pre-symptomatic' };

var EVALUATION_LABELS = { '+': 'Tested positive (+)', '-': 'Tested negative (−)', '*': 'Documented evaluation (*)' };

/**
 * Cascade testing: starting from an index person (by default the proband), lists the blood
 * relatives up to the 3rd degree with their relationship, chance of sharing the familial
 * variant, age, life status and existing results. Relatives who are already tested or
 * diagnosed, deceased, under the minimum age, unborn or not in contact are not preselected, as
 * in clinical cascade workflows (relatives of unknown age are preselected and marked). The selection can be highlighted on the chart and exported.
 *
 * @class CascadeTestingDialog
 */
var CascadeTestingDialog = Class.create({

  initialize: function() {
    this.dialog = null;
    this._indexId = null;
    this._maxDegree = 3;
    this._minAge = 18;
    this._finding = '';
    this._overrides = {};   // nodeId -> true/false chosen by the user
    this._rows = [];
    this._mode = 'AD';
    this._indexGenotype = 'het';
    this._notAtRisk = 0;
    this._warning = '';
    // disorders used to read phenotypes: null = the index person's condition (automatic),
    // '' = anyone marked affected, otherwise a disorder id or a list of disorder ids (several
    // conditions caused by the same variant, e.g. breast and ovarian cancer)
    this._condition = null;
    this._model = {};       // per-mode model settings, see _getModel()
    // mode ranking: whether to condition on the index's own phenotype (single ascertainment
    // through an affected index)
    this._ascertainment = true;
    this._approx = null;
    this._presetName = null;   // name of the model last imported or exported
    this._inUse = false;       // cascade testing was used for this pedigree: save its state with it
    this._pendingShifts = [];  // renumberings not yet attached to an undo state, see onNodeIdsChanged()
    this._refreshTimer = null;
    try {
      var saved = JSON.parse(localStorage.getItem('openpedigree_cascade_v1') || '{}');
      if (INHERITANCE_NAMES[saved.mode]) this._mode = saved.mode;
      if (saved.indexGenotype === 'biallelic') this._indexGenotype = 'biallelic';
      if (saved.carrierFreqN > 1) this._carrierFreqN = saved.carrierFreqN;
      if (saved.model && typeof saved.model === 'object') this._model = saved.model;
      if (saved.ascertainment === false) this._ascertainment = false;
    } catch (e) {}
  },

  // -------------------------------------------------------------------------------------------
  // Model files: the settings of a disease, exported and imported to reuse them in other families

  /** The current mode and model settings as a preset with this name */
  _currentPreset: function(name, notes) {
    var names = {};
    this._pedigreeDisorders().forEach(function(d) { names[d.id] = d.name; });
    return buildPreset({
      name: name, notes: notes, mode: this._mode, indexGenotype: this._indexGenotype,
      carrierFreqN: this._carrierFreqN, model: this._getModel(), conditionIds: this._resolvedConditions(),
      conditionNames: names, ascertainment: this._ascertainment
    });
  },

  /** Applies a preset to this pedigree; @return {Array} names of its conditions not found here */
  _applyPreset: function(preset) {
    var r = resolvePreset(preset, this._pedigreeDisorders());
    this._mode = r.mode;
    this._indexGenotype = r.indexGenotype;
    this._carrierFreqN = r.carrierFreqN;
    this._model[r.mode] = r.model;
    this._condition = r.condition;
    this._ascertainment = r.ascertainment;
    this._presetName = preset.name;
    this._inUse = true;
    this._saveSettings();
    return r.unmatched;
  },

  // -------------------------------------------------------------------------------------------
  // Cascade work of this pedigree, saved in its XML file (and so in PDFs that embed the XML)

  /**
   * The cascade settings and choices of this pedigree, or null when cascade testing was not used.
   * People are referred to by node id, which is also their id in the exported XML.
   */
  getPedigreeState: function() {
    if (!this._inUse) return null;
    var overrides = {};
    var own = this._overrides;
    Object.keys(own).forEach(function(id) { overrides[id] = !!own[id]; });
    return {
      format: PEDIGREE_STATE_FORMAT,
      version: 1,
      mode: this._mode,
      indexGenotype: this._indexGenotype,
      carrierFreqN: this._carrierFreqN,
      model: this._model,
      condition: this._condition,
      ascertainment: this._ascertainment,
      presetName: this._presetName,
      indexId: this._indexId,
      maxDegree: this._maxDegree,
      minAge: this._minAge,
      finding: this._finding,
      overrides: overrides,
      highlighted: !!(editor.getOverlay && editor.getOverlay().hasCascadeHighlight())
    };
  },

  /**
   * Restores the state saved with a pedigree that was just loaded. Without a saved state, the
   * choices tied to the previous pedigree (index person, selection, finding) are cleared; the model
   * settings stay as they are.
   * @param {Object} state as returned by getPedigreeState(), or null
   * @param {Object} idMap optional {saved id: current node id}, when the people were renumbered
   */
  loadPedigreeState: function(state, idMap) {
    this.hide();
    this._pendingShifts = [];
    // rings drawn for the previous pedigree
    var overlay = editor.getOverlay && editor.getOverlay();
    if (overlay && overlay.hasCascadeHighlight()) overlay.clearCascadeHighlight();
    this._indexId = null;
    this._overrides = {};
    this._condition = null;
    this._finding = '';
    this._presetName = null;
    this._rows = [];
    this._inUse = false;
    if (!state || typeof state !== 'object' || state.format !== PEDIGREE_STATE_FORMAT) return;

    var mapId = function(id) {
      var key = String(id);
      var mapped = idMap ? idMap[key] : parseInt(key, 10);
      return (typeof mapped === 'number' && !isNaN(mapped)) ? mapped : null;
    };
    if (INHERITANCE_NAMES[state.mode]) this._mode = state.mode;
    this._indexGenotype = state.indexGenotype === 'biallelic' ? 'biallelic' : 'het';
    if (typeof state.carrierFreqN === 'number' && state.carrierFreqN > 1) this._carrierFreqN = state.carrierFreqN;
    if (state.model && typeof state.model === 'object' && !Array.isArray(state.model)) this._model = state.model;
    if (state.condition === '' || typeof state.condition === 'string' || Array.isArray(state.condition)) this._condition = state.condition;
    this._ascertainment = state.ascertainment !== false;
    if (typeof state.presetName === 'string' && state.presetName) this._presetName = state.presetName;
    if (state.indexId !== null && state.indexId !== undefined) this._indexId = mapId(state.indexId);
    if ([1, 2, 3].indexOf(state.maxDegree) !== -1) this._maxDegree = state.maxDegree;
    if (typeof state.minAge === 'number' && state.minAge >= 0) this._minAge = state.minAge;
    if (typeof state.finding === 'string') this._finding = state.finding;
    var overrides = this._overrides;
    if (state.overrides && typeof state.overrides === 'object') {
      Object.keys(state.overrides).forEach(function(id) {
        var mapped = mapId(id);
        if (mapped !== null) overrides[mapped] = !!state.overrides[id];
      });
    }
    this._inUse = true;
    this._saveSettings();
    if (state.highlighted) {
      try {
        this._computeRows();
        this.highlight();
      } catch (e) {}
    }
  },

  // -------------------------------------------------------------------------------------------
  // People are referred to by node id, and the ids after a removed node are renumbered: the index
  // person and the relatives ticked by hand must follow, or they would silently become other people

  /**
   * Nodes were removed and the ones after them renumbered (called by the view).
   * @param {Array} removed ids that no longer exist
   * @param {Object} changed { old id: new id }
   */
  onNodeIdsChanged: function(removed, changed) {
    var shift = { removed: (removed || []).map(Number), changed: Object.assign({}, changed || {}) };
    this._applyIdShift(shift, false);
    // kept for the undo state of this change, so that undoing it can renumber back
    this._pendingShifts.push(shift);
  },

  /** The renumberings since the last call (for the undo / redo state being added), or null */
  takeIdShifts: function() {
    var shifts = this._pendingShifts;
    this._pendingShifts = [];
    return shifts.length ? shifts : null;
  },

  /**
   * Renumbers again after undo or redo restored a whole saved state (no removal is reported then).
   * @param {Array} shifts as returned by takeIdShifts()
   * @param {Boolean} inverse true when the change is being undone
   */
  applyIdShifts: function(shifts, inverse) {
    var list = (shifts || []).slice();
    if (inverse) list.reverse();
    for (var i = 0; i < list.length; i++) {
      this._applyIdShift(list[i], inverse);
    }
    this.onGraphChanged();
  },

  _applyIdShift: function(shift, inverse) {
    var map;
    if (inverse) {
      var back = {};
      Object.keys(shift.changed).forEach(function(oldId) {
        if (shift.removed.indexOf(Number(oldId)) === -1) back[shift.changed[oldId]] = Number(oldId);
      });
      map = function(id) { return back.hasOwnProperty(id) ? back[id] : Number(id); };
    } else {
      map = function(id) {
        if (shift.removed.indexOf(Number(id)) !== -1) return null;
        return shift.changed.hasOwnProperty(id) ? Number(shift.changed[id]) : Number(id);
      };
    }
    var overlay = editor.getOverlay && editor.getOverlay();
    if (this._indexId !== null) {
      this._indexId = map(this._indexId);
      if (this._indexId === null) {
        // the index person was removed: nothing left to follow
        this._overrides = {};
        this._rows = [];
        if (overlay && overlay.hasCascadeHighlight()) overlay.clearCascadeHighlight();
        return;
      }
    }
    var overrides = {};
    var own = this._overrides;
    Object.keys(own).forEach(function(id) {
      var mapped = map(id);
      if (mapped !== null) overrides[mapped] = own[id];
    });
    this._overrides = overrides;
    this._rows = []; // they hold the old ids: computed again when needed
    if (overlay && overlay.remapCascadeIds) overlay.remapCascadeIds(map);
  },

  /**
   * The pedigree changed while the highlight is on the chart: compute it again (shortly after, as
   * one edit reports several changes), so the rings follow the people and the new relatives.
   */
  onGraphChanged: function() {
    var _this = this;
    clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(function() {
      var overlay = editor.getOverlay && editor.getOverlay();
      if (!overlay || !overlay.hasCascadeHighlight() || _this.dialog) return;
      try {
        var graph = editor.getGraph();
        if (_this._indexId === null || !isRealPerson(graph, _this._indexId)) {
          overlay.clearCascadeHighlight();
          return;
        }
        Object.keys(_this._overrides).forEach(function(id) {
          if (!isRealPerson(graph, Number(id))) delete _this._overrides[id];
        });
        _this._computeRows();
        _this.highlight();
      } catch (e) {}
    }, 60);
  },

  /** Saves a file (Blob) with the editor's download helper, or a plain link */
  _download: function(blob, fileName) {
    if (typeof window.saveAs === 'function') {
      window.saveAs(blob, fileName);
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // population carrier frequency, as "1 in N"; allele frequency q = 1 / (2N)
  _carrierFreqN: 100,

  _saveSettings: function() {
    try {
      localStorage.setItem('openpedigree_cascade_v1', JSON.stringify({
        mode: this._mode, indexGenotype: this._indexGenotype, carrierFreqN: this._carrierFreqN, model: this._model,
        ascertainment: this._ascertainment
      }));
    } catch (e) {}
  },

  /**
   * Model settings of the current mode of inheritance (percentages and ages), with defaults:
   *   deNovo     % of carriers whose variant is a new mutation (1/3 for X-linked: Haldane)
   *   penetrance % of carriers who become affected (hemizygous males for X-linked,
   *              biallelic individuals for recessive)
   *   femalePen  % of heterozygous females affected (X-linked)
   *   onsetFrom / onsetTo  age range in which affected carriers develop signs (0-0: at birth)
   *   curve      cumulative penetrance by age, "age:% age:% ...", used instead of the age range:
   *              its shape gives the share of eventual cases manifest by each age and its last
   *              point is the lifetime penetrance (the penetrance field is then not used)
   *   phenocopy  % of non-carriers affected by the condition (sporadic cases)
   *   mutationRatio  male / female mutation rate (X-linked)
   *   usePhenotypes, unrecordedUnaffected, useTests  which evidence to use
   */
  _getModel: function(forMode) {
    var mode = forMode || this._mode;
    var defaults = {
      AD: { deNovo: 10, penetrance: 100, femalePen: 100 },
      AR: { deNovo: 0, penetrance: 100, femalePen: 100 },
      XLR: { deNovo: 33.3, penetrance: 100, femalePen: 0 },
      XLD: { deNovo: 33.3, penetrance: 100, femalePen: 100 },
      MT: { deNovo: 0, penetrance: 100, femalePen: 100 },
      YL: { deNovo: 0, penetrance: 100, femalePen: 0 }
    }[mode];
    var m = this._model[mode] || {};
    var pick = function(key, def) { return (typeof m[key] === 'number' && isFinite(m[key])) ? m[key] : def; };
    var flag = function(key) { return m[key] !== false; };
    return {
      deNovo: pick('deNovo', defaults.deNovo),
      penetrance: pick('penetrance', defaults.penetrance),
      femalePen: pick('femalePen', defaults.femalePen),
      onsetFrom: pick('onsetFrom', 0),
      onsetTo: pick('onsetTo', 0),
      curve: typeof m.curve === 'string' ? m.curve : '',
      phenocopy: pick('phenocopy', 0.1),
      mutationRatio: pick('mutationRatio', 1),
      conditionParams: (m.conditionParams && typeof m.conditionParams === 'object') ? m.conditionParams : {},
      usePhenotypes: flag('usePhenotypes'),
      // off unless chosen: right after drawing a pedigree with the consultand, a relative without
      // the condition recorded is rarely known to be unaffected
      unrecordedUnaffected: m.unrecordedUnaffected === true,
      useTests: flag('useTests')
    };
  },

  _setModel: function(key, value) {
    this._model[this._mode] = this._model[this._mode] || {};
    this._model[this._mode][key] = value;
    this._saveSettings();
  },

  // Disorders recorded in the pedigree, for the "condition" selector: [{id, name}]
  _pedigreeDisorders: function() {
    var graph = editor.getGraph();
    var seen = {};
    var list = [];
    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      var node = isRealPerson(graph, id) && editor.getNode(id);
      var ds = (node && node.getDisorders && node.getDisorders()) || [];
      ds.forEach(function(d) {
        if (d === 'affected' || seen[d]) return;
        seen[d] = true;
        var name = d;
        try {
          var disorder = editor.getDisorderLegend().getDisorder(d);
          name = (disorder && disorder.getName && disorder.getName()) || d;
        } catch (e) {}
        list.push({ id: d, name: name });
      });
    }
    return list;
  },

  /**
   * Evidence for the risk engine: for every person, the probability of what is recorded
   * (affected or not for the chosen condition, test result) under each genotype state.
   * Also counts what was used.
   */
  // The conditions actually used: the user's choice, or else the index person's first disorder.
  // An empty list means "anyone marked as affected".
  _resolvedConditions: function() {
    if (this._condition !== null && this._condition !== undefined) {
      var c = Array.isArray(this._condition) ? this._condition : [this._condition];
      return c.filter(function(d) { return d; });
    }
    var node = this._indexId !== null ? editor.getNode(this._indexId) : null;
    var ds = ((node && node.getDisorders && node.getDisorders()) || []).filter(function(d) { return d !== 'affected'; });
    return ds.length ? [ds[0]] : [];
  },

  // affected for the chosen condition(s)
  _isAffected: function(node, conditions) {
    if (!node) return false;
    if (!conditions.length) return node.getCarrierStatus && node.getCarrierStatus() === 'affected';
    var ds = (node.getDisorders && node.getDisorders()) || [];
    return conditions.some(function(c) { return ds.indexOf(c) !== -1; });
  },

  /**
   * Phenotype settings of each condition used as evidence: [{ condition, pen, femalePen,
   * phenocopy, ageFraction(age) }] (probabilities 0-1). With one condition (or "anyone marked
   * affected") the model's own fields apply; with several, each condition has its own settings
   * (model.conditionParams, defaulting to the model's fields). In the mode ranking, model.penScale
   * and model.femaleFrac scale each condition's settings over the grid.
   */
  _phenotypeSpecs: function(model) {
    var conditions = this._resolvedConditions();
    var multi = conditions.length > 1;
    var params = model.conditionParams || {};
    var num = function(v, def) { return (typeof v === 'number' && isFinite(v)) ? v : def; };
    var make = function(condition, p) {
      p = p || {};
      var curve = activeCurve(p, model);
      var pen = (curve ? curveLifetime(curve) : num(p.penetrance, model.penetrance)) / 100;
      var femalePen = num(p.femalePen, model.femalePen) / 100;
      if (multi && typeof model.penScale === 'number') {
        // ranking grid: scale this condition's penetrance; X-linked female penetrance relative to it
        femalePen = (typeof model.femaleFrac === 'number') ? pen * model.femaleFrac : pen * model.penScale;
        pen = pen * model.penScale;
      } else if (curve && typeof model.penScale === 'number') {
        // ranking grid with a curve: the grid scales the curve's lifetime penetrance
        pen = pen * model.penScale;
      }
      var from = num(p.onsetFrom, model.onsetFrom), to = num(p.onsetTo, model.onsetTo);
      var congenital = !curve && !(to > 0) && !(from > 0);
      return {
        condition: condition,
        pen: pen,
        femalePen: femalePen,
        phenocopy: Math.max(0, Math.min(1, num(p.phenocopy, model.phenocopy) / 100)),
        // share of the eventual cases already affected at this age
        ageFraction: function(age) {
          if (congenital) return 1;
          if (age === null) return null;
          if (curve) return curveFraction(curve, age);
          if (to <= from) return age >= from ? 1 : 0;
          return Math.max(0, Math.min(1, (age - from) / (to - from)));
        }
      };
    };
    if (!multi) return [make(conditions[0] || null, null)];
    return conditions.map(function(c) { return make(c, params[c]); });
  },

  /**
   * @param {Object} model settings from _getModel()
   * @param {Object} [opts] for the mode ranking: { mode, biallelic, includeIndex } (the index's own
   *   phenotype then counts too); without opts, the current mode and the counts shown are updated
   */
  _buildEvidence: function(model, opts) {
    var graph = editor.getGraph();
    var mode = opts ? opts.mode : this._mode;
    var biallelic = opts ? !!opts.biallelic : this._isBiallelic();
    var includeIndex = !!(opts && opts.includeIndex);
    // ascertained index: the family came to attention because the index is affected, so only
    // whether that is possible under the model counts (P(carrier | affected) ~ 1 for a rare variant
    // when the penetrance is above 0), not how likely it was
    var ascertained = !!(opts && opts.ascertained);
    var TEST_ERROR = 0.0001;
    var specs = this._phenotypeSpecs(model);
    var counts = { affected: 0, unaffected: 0, tested: 0 };
    var likelihood = {};

    // chance that a person with this state becomes affected by a condition (lifetime)
    var penetranceOf = function(spec, state, sex) {
      if (mode === 'AR' && !biallelic) return null; // one familial copy tracked: not informative
      if (state === 0) return 0;
      switch (mode) {
        case 'AD':
        case 'MT':
          return spec.pen;
        case 'AR':
          return state === 3 ? spec.pen : 0;
        case 'XLR':
        case 'XLD':
          return sex === 'M' ? spec.pen : (sex === 'F' ? spec.femalePen : (spec.pen + spec.femalePen) / 2);
        case 'YL':
          return sex === 'F' ? 0 : spec.pen;
      }
      return 0;
    };

    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      if (!isRealPerson(graph, id) || (id === this._indexId && !includeIndex)) continue;
      var node = editor.getNode(id);
      if (!node) continue;
      var info = this._getPersonInfo(id);
      var L = [1, 1, 1, 1];
      var used = false;

      if (model.usePhenotypes && ['alive', 'deceased'].indexOf(info.lifeStatus) !== -1) {
        // each condition contributes independently given the genotype
        var anyAffected = false, informative = false;
        for (var k = 0; k < specs.length; k++) {
          var spec = specs[k];
          var affected = this._isAffected(node, spec.condition ? [spec.condition] : []);
          var frac = spec.ageFraction(info.ageYears);
          if (ascertained && id === this._indexId) {
            if (!affected) continue;
            for (var si = 0; si < 4; si++) {
              var pi = penetranceOf(spec, si, info.geneticSex);
              if (pi !== null) L[si] *= pi > 0 ? 1 : spec.phenocopy;
            }
            anyAffected = informative = true;
          } else if (affected || (model.unrecordedUnaffected && frac !== null)) {
            for (var s = 0; s < 4; s++) {
              var p = penetranceOf(spec, s, info.geneticSex);
              if (p === null) continue;
              informative = true;
              var pAff = affected ? p : p * frac;
              L[s] *= affected ? (pAff + (1 - pAff) * spec.phenocopy) : (1 - pAff) * (1 - spec.phenocopy);
            }
            if (affected) anyAffected = true;
          }
        }
        if (informative) {
          used = true;
          counts[anyAffected ? 'affected' : 'unaffected']++;
        }
      }

      if (model.useTests) {
        var ev = node.getEvaluated && node.getEvaluated();
        var cs = node.getCarrierStatus && node.getCarrierStatus();
        var structured = this._familialTestResult(node);  // test for the familial gene, if any
        var positive = structured === 'positive' || (structured === null && (ev === '+' || cs === 'carrier' || cs === 'presymptomatic'));
        var negative = structured === 'negative' || (structured === null && ev === '-');
        if (positive || negative) {
          for (var t = 0; t < 4; t++) {
            var carries = t > 0;
            L[t] *= (carries === positive) ? 1 - TEST_ERROR : TEST_ERROR;
          }
          used = true;
          counts.tested++;
        }
      }

      if (used) likelihood[id] = L;
    }
    if (!opts) this._evidenceCounts = counts;
    this._lastCounts = counts;
    return likelihood;
  },

  /**
   * How well each mode of inheritance explains what is recorded in the pedigree (affected and
   * unaffected relatives for the chosen condition, the index's own phenotype and sex, test
   * results). Each mode is judged over a range of plausible settings rather than one: its fit is
   * the average likelihood over a grid of penetrance, penetrance in heterozygous women (X-linked:
   * low for XLR, high for XLD) and de novo proportion (the age at onset and the evidence options
   * are the mode's own). Averaging rather than taking the best keeps modes with more freedom from
   * winning by flexibility alone. With equal prior weight for the modes, the score is
   * P(pedigree | mode) / sum over modes. With ascertainment correction (default), the
   * family is taken to have come to attention through the affected index: the index's phenotype
   * only rules out settings in which it is impossible (penetrance 0 for the index's sex), instead
   * of favoring settings with high penetrance. Recessive assumes an affected (biallelic) index. The best grid point of each mode
   * is returned as its fitted settings. The score compares modes; it is not a calibrated
   * probability.
   *
   * Why not the current settings: the X-linked default de novo of 1/3 (Haldane) holds only when
   * affected men do not reproduce, and then a carrier woman never inherits from her father; in a
   * family where affected men have affected daughters (e.g. Fabry disease) it would rule X-linked out.
   *
   * @return {Object} { ranking: [{ mode, p, incompatible, fitted }] best first, informative: Boolean }
   */
  _rankModes: function() {
    var graph = editor.getGraph();
    var _this = this;
    var q = 1 / (2 * this._carrierFreqN);
    var informative = false;
    var PEN = [0.5, 0.8, 1];
    var GRID = {
      AD: { fpen: [null], dn: [0.02, 0.2, 0.5] },
      AR: { fpen: [null], dn: [0] },
      XLR: { fpen: [0, 0.1, 0.25], dn: [0.02, 0.15, 1 / 3] },
      XLD: { fpen: [0.5, 0.75, 1], dn: [0.02, 0.15, 1 / 3] },
      MT: { fpen: [null], dn: [0] },
      YL: { fpen: [null], dn: [0] }
    };
    var results = INHERITANCE_OPTIONS.map(function(o) {
      var mode = o[0];
      var biallelic = mode === 'AR';
      var base = _this._getModel(mode);
      var sum = 0, n = 0, best = null;
      PEN.forEach(function(pen) {
        GRID[mode].fpen.forEach(function(fpen) {
          GRID[mode].dn.forEach(function(dn) {
            var model = Object.assign({}, base, {
              penetrance: pen * 100,
              femalePen: (fpen === null ? pen : fpen) * 100,
              deNovo: dn * 100,
              // several conditions: their own penetrances are scaled by the grid instead
              penScale: pen,
              femaleFrac: fpen
            });
            var evidence = _this._buildEvidence(model, { mode: mode, biallelic: biallelic, includeIndex: true, ascertained: _this._ascertainment });
            var c = _this._lastCounts;
            if (c.affected + c.unaffected + c.tested > 1) informative = true;
            var L = 0;
            try {
              var r = computeVariantRisks(graph, _this._indexId, mode, biallelic ? 'biallelic' : 'het', q, {
                deNovo: dn,
                mutationRatio: base.mutationRatio,
                likelihood: Object.keys(evidence).length ? evidence : null
              });
              L = r.evidenceLikelihood || 0;
            } catch (e) {
              L = 0;
            }
            sum += L;
            n++;
            if (!best || L > best.L) {
              best = { L: L, penetrance: pen * 100, femalePen: fpen === null ? null : fpen * 100, deNovo: Math.round(dn * 1000) / 10 };
            }
          });
        });
      });
      return { mode: mode, L: n ? sum / n : 0, fitted: best };
    });
    var total = results.reduce(function(s, r) { return s + r.L; }, 0);
    var ranking = results.map(function(r) {
      return { mode: r.mode, p: total > 0 ? r.L / total : 0, incompatible: !(r.L > 0), fitted: r.fitted };
    }).sort(function(a, b) { return b.p - a.p; });
    return { ranking: ranking, informative: informative && total > 0 };
  },

  /** "penetrance 100%, women 75%, de novo 2%" for the fitted settings of a mode */
  _fittedText: function(mode, fitted) {
    if (!fitted) return '';
    var parts = [translate('penetrance') + ' ' + fitted.penetrance + '%'];
    if ((mode === 'XLR' || mode === 'XLD') && fitted.femalePen !== null) parts.push(translate('women') + ' ' + fitted.femalePen + '%');
    if (mode === 'AD' || mode === 'XLR' || mode === 'XLD') parts.push(translate('de novo') + ' ' + String(fitted.deNovo).replace('.', getLanguage() === 'pt-BR' ? ',' : '.') + '%');
    return parts.join(', ');
  },

  /**
   * Affected men with children in the pedigree (for the chosen condition): then Haldane's 1/3
   * de novo, which assumes that affected men do not reproduce, does not apply to X-linked modes.
   */
  _affectedMenHaveChildren: function() {
    var graph = editor.getGraph();
    var conditions = this._resolvedConditions();
    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      if (!isRealPerson(graph, id) || getGeneticSex(graph, id) !== 'M') continue;
      var node = editor.getNode(id);
      if (!this._isAffected(node, conditions)) continue;
      var hasChild = false;
      for (var c = 0; c <= graph.getMaxNodeId(); c++) {
        if (isRealPerson(graph, c) && getBiologicalParents(graph, c).indexOf(id) !== -1) { hasChild = true; break; }
      }
      if (hasChild) return true;
    }
    return false;
  },

  _isBiallelic: function() {
    return this._mode === 'AR' && this._indexGenotype === 'biallelic';
  },

  /**
   * Short clinical meaning of a positive result for a relative of the given sex.
   */
  _meaningIfPositive: function(sex) {
    switch (this._mode) {
      case 'AD':
        return translate('At risk of the condition');
      case 'AR':
        return translate('Heterozygous carrier (usually unaffected)');
      case 'XLR':
        if (sex === 'M') return translate('Hemizygous: affected');
        if (sex === 'F') return translate('Heterozygous carrier (may have mild signs)');
        return translate('Affected if male, carrier if female');
      case 'XLD':
        if (sex === 'M') return translate('Hemizygous: affected');
        if (sex === 'F') return translate('Heterozygous: at risk (often milder)');
        return translate('At risk of the condition');
      case 'MT':
        return sex === 'M' ? translate('At risk (variable, heteroplasmy); does not transmit') : translate('At risk (variable, heteroplasmy); transmits to all children');
      case 'YL':
        return translate('Hemizygous: at risk; transmits to all sons');
    }
    return '';
  },

  // -------------------------------------------------------------------------------------------
  // Data

  _getPersonInfo: function(id) {
    var node = editor.getNode(id);
    var info = { name: '', sex: 'U', geneticSex: 'U', lifeStatus: 'alive', ageText: '', ageYears: null, lostContact: false, findings: [], tested: false };
    if (!node) {
      return info;
    }
    info.name = (node.getName && node.getName()) || '';
    info.sex = (node.getGender && node.getGender()) || 'U';
    info.geneticSex = getGeneticSex(editor.getGraph(), id);
    info.lifeStatus = (node.getLifeStatus && node.getLifeStatus()) || 'alive';
    info.lostContact = !!(node.getLostContact && node.getLostContact());

    var birth = node.getBirthDate && node.getBirthDate();
    var death = node.getDeathDate && node.getDeathDate();
    var hasDeath = !!(death && death.getTime);
    // someone who is not alive and has no date of death did not live until today: the age then
    // comes from the "age at death" field, or is unknown
    if (birth && birth.getTime && (hasDeath || info.lifeStatus === 'alive')) {
      var end = hasDeath ? death : new Date();
      info.ageYears = (end.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
      info.ageText = getAge(birth, hasDeath ? death : null);
      if (getLanguage() === 'pt-BR') {
        info.ageText = info.ageText.replace(/(\d) y$/, '$1 anos').replace(/(\d) mo$/, '$1 meses')
          .replace(/(\d) wk$/, '$1 sem').replace(/(\d) days?$/, function(m, d) { return d + (/days$/.test(m) ? ' dias' : ' dia'); })
          .replace('not born yet', 'não nascido');
      }
    } else if (info.lifeStatus === 'deceased' && node.getAgeAtDeath) {
      var atDeath = String(node.getAgeAtDeath() || '').trim();
      var years = /^(\d{1,3}(?:[.,]\d+)?)\s*(?:$|y|a)/i.exec(atDeath);
      if (years) {
        info.ageYears = parseFloat(years[1].replace(',', '.'));
      }
      info.ageText = atDeath;
    }

    var carrier = node.getCarrierStatus && node.getCarrierStatus();
    if (carrier && CARRIER_LABELS[carrier]) {
      info.findings.push(translate(CARRIER_LABELS[carrier]));
    }
    var evaluated = node.getEvaluated && node.getEvaluated();
    if (evaluated && EVALUATION_LABELS[evaluated]) {
      info.findings.push(translate(EVALUATION_LABELS[evaluated]));
      info.tested = (evaluated === '+' || evaluated === '-');
    }
    var disorders = (node.getDisorders && node.getDisorders()) || [];
    disorders.forEach(function(d) {
      if (d === 'affected') {
        return;
      }
      var name = d;
      try {
        var disorder = editor.getDisorderLegend().getDisorder(d);
        name = (disorder && disorder.getName && disorder.getName()) || d;
      } catch (e) {}
      info.findings.push(name);
    });
    var genes = (node.getGenes && node.getGenes()) || [];
    genes.forEach(function(g) {
      info.findings.push(typeof g === 'string' ? g : (g.gene || g.id || ''));
    });
    var tests = (node.getGeneticTests && node.getGeneticTests()) || [];
    tests.forEach(function(t) {
      info.findings.push(clinicalTestLabel(t));
    });
    var familial = this._familialTestResult(node);
    if (familial === 'positive' || familial === 'negative') {
      info.tested = true;
    }
    info.declined = (familial === 'declined');
    // already diagnosed with the condition(s) used for phenotypes; the generic "affected" mark
    // (set for any disorder) counts only when no specific condition is chosen
    info.affected = this._isAffected(node, this._resolvedConditions());
    return info;
  },

  /**
   * Genes of the familial variant: those with a positive structured test in the index person,
   * narrowed to the gene(s) named in the "familial variant" field when it names any of them.
   */
  _familialGenes: function() {
    var node = this._indexId !== null ? editor.getNode(this._indexId) : null;
    var tests = (node && node.getGeneticTests) ? node.getGeneticTests() : [];
    var genes = tests.filter(function(t) { return clinicalTestResult(t) === 'positive'; })
      .map(function(t) { return t.gene; })
      .filter(function(g) { return typeof g === 'string' && g.trim(); });
    // the gene must be named as a whole word ("AR" is not named by "PARP1")
    var words = (this._finding || '').toUpperCase().split(/[^A-Z0-9-]+/);
    var named = genes.filter(function(g) { return words.indexOf(g.trim().toUpperCase()) !== -1; });
    return named.length ? named : genes;
  },

  /**
   * 'positive' | 'negative' for a structured test of the familial gene, 'vus' / 'pending' when
   * tested without a usable result, or null when the person has no test for that gene.
   */
  _familialTestResult: function(node) {
    var genes = this._familialGenes();
    if (!genes.length || !node || !node.getGeneticTests) return null;
    var result = null;
    node.getGeneticTests().forEach(function(t) {
      if (genes.indexOf(t.gene) === -1) return;
      var r = clinicalTestResult(t) || 'pending';
      // a usable result wins over a VUS, a pending test or a declined one
      if (r === 'positive' || (r === 'negative' && result !== 'positive') || result === null ||
          (result !== 'positive' && result !== 'negative' && r === 'declined')) result = r;
    });
    return result;
  },

  /**
   * Reason why a relative is not preselected for approach, or '' when they should be: only
   * living, reachable, untested and undiagnosed relatives of known age above the minimum age are
   * preselected (diagnosed relatives may still be chosen, e.g. to confirm segregation).
   */
  _getExclusionReason: function(info) {
    if (info.tested) return translate('Already tested');
    if (info.affected) return translate('Already diagnosed');
    if (info.declined) return translate('Declined testing');
    if (info.lifeStatus === 'unborn') return translate('Unborn');
    if (info.lifeStatus !== 'alive') return translate('Deceased');
    if (info.lostContact) return translate('Not in contact');
    // unknown age: still preselected (noted in the list), as the age can be checked when approaching
    if (info.ageYears !== null && info.ageYears < this._minAge) return translate('Under minimum age');
    return '';
  },

  _computeRows: function() {
    var graph = editor.getGraph();
    var lang = getLanguage();
    var numbering = computeStandardNumbering(editor);
    var _this = this;

    if (this._indexId === null || !isRealPerson(graph, this._indexId)) {
      this._indexId = graph.getProbandId();
      this._overrides = {};
    }

    this._numbering = numbering;
    var model = this._getModel();
    var evidence = this._buildEvidence(model);
    var xl = this._mode === 'XLR' || this._mode === 'XLD';
    var risks = computeVariantRisks(graph, this._indexId, this._mode, this._indexGenotype, 1 / (2 * this._carrierFreqN), {
      deNovo: model.deNovo / 100,
      mutationRatio: model.mutationRatio,
      likelihood: Object.keys(evidence).length ? evidence : null
    });
    this._warning = risks.warning ? translate(risks.warning) : '';
    this._approx = risks.approximate || null;
    // Haldane's lethal-equilibrium de novo share, 1 / (2 + k) (1/3 with equal mutation rates),
    // assumes affected men have no children; then a carrier woman never inherits from her father,
    // which is wrong when they do (e.g. Fabry disease)
    var lethalShare = 100 / (2 + (model.mutationRatio > 0 ? model.mutationRatio : 1));
    this._haldaneFlag = xl && model.deNovo > 0.6 * lethalShare && this._affectedMenHaveChildren();
    this._ibd = risks.ibd;
    this._deNovoIndex = risks.deNovoIndex;
    // Wright's F of the index (from the relationship between the index's parents)
    this._indexF = inbreedingOf(graph, this._indexId);
    var indexParents = null;
    try { indexParents = graph.getParentRelationship(this._indexId); } catch (e) {}
    if (indexParents !== null && indexParents !== undefined && !coupleIsConsanguineous(graph, indexParents)) {
      this._indexF = 0; // the user marked the parents as not consanguineous
    }
    // how well each mode of inheritance explains the pedigree
    this._fit = this._rankModes();
    var biallelic = this._isBiallelic();
    var rows = [];
    this._notAtRisk = 0;
    this._ruledOut = 0;
    // the same risks without the evidence, to tell relatives who cannot carry the variant under
    // this mode from those left out because of what is recorded (phenotypes, tests)
    var priorProbs = null;
    if (Object.keys(evidence).length) {
      try {
        priorProbs = computeVariantRisks(graph, this._indexId, this._mode, this._indexGenotype, 1 / (2 * this._carrierFreqN), {
          deNovo: model.deNovo / 100, mutationRatio: model.mutationRatio, exact: false
        }).probs;
      } catch (e) {}
    }

    findBloodRelatives(graph, this._indexId, this._maxDegree).forEach(function(k) {
      var p = risks.probs[k.id] || [1, 0, 0, 0];
      var any = p[1] + p[2] + p[3];
      var info = _this._getPersonInfo(k.id);
      if (any < MIN_RISK && !info.tested) {
        // blood relative who cannot carry the variant under this mode (e.g. sons of a man for
        // X-linked) or whose risk the evidence ruled out; tested relatives stay listed
        var prior = priorProbs && priorProbs[k.id];
        if (prior && prior[1] + prior[2] + prior[3] >= MIN_RISK) {
          _this._ruledOut++;
        } else {
          _this._notAtRisk++;
        }
        return;
      }
      var reason = _this._getExclusionReason(info);
      var selected = _this._overrides.hasOwnProperty(k.id) ? _this._overrides[k.id] : !reason;
      var notes = [];
      if (any > 0.999) {
        notes.push(biallelic && p[3] > 0.999 ? translate('Obligate biallelic') : translate('Obligate carrier'));
      }
      if (reason) {
        notes.push(reason);
      } else if (info.ageYears === null && info.lifeStatus === 'alive') {
        notes.push(translate('Unknown age'));
      }
      rows.push({
        id: k.id,
        label: (numbering.byId[k.id] && numbering.byId[k.id].label) || '',
        name: info.name,
        relationship: relationshipName(k, info.sex, lang),
        degree: k.degree,
        chance: any,
        carrierChance: p[1] + p[2],   // exactly one familial allele (biallelic AR)
        affectedChance: p[3],         // both familial alleles (biallelic AR)
        meaning: biallelic ? translate('Carrier if one variant, affected if both') : _this._meaningIfPositive(info.geneticSex),
        ageText: info.ageText,
        lifeStatus: translate(LIFE_STATUS_LABELS[info.lifeStatus] || info.lifeStatus),
        findings: info.findings.join('; '),
        tested: info.tested,
        reason: notes.join('; '),
        selected: selected
      });
    });
    rows.sort(function(a, b) { return (a.degree - b.degree) || (b.chance - a.chance) || (a.id - b.id); });
    this._rows = rows;
    return this._rows;
  },

  _formatChance: function(r) {
    var pct = r * 100;
    var rounded = Math.round(pct * 10) / 10;
    return (rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)) + '%';
  },

  _personLabel: function(id) {
    var info = this._getPersonInfo(id);
    var std = (this._numbering && this._numbering.byId[id] && this._numbering.byId[id].label) || '';
    var name = info.name || (id === editor.getGraph().getProbandId() ? translate('Proband') : translate('Unnamed'));
    return (std ? std + ' · ' : '') + name;
  },

  // -------------------------------------------------------------------------------------------
  // UI

  show: function() {
    var _this = this;
    if (this.dialog) {
      this.hide();
    }
    this._inUse = true;
    this._computeRows();

    var content = new Element('div', { 'class': 'cascade-dialog-content' });

    // Explanations live behind (?) buttons; one bubble is shared by all of them
    var bubble = new Element('div', { 'class': 'cascade-help-bubble', 'role': 'tooltip' });
    bubble.hide();
    var bubbleOwner = null;
    var closeBubble = function() {
      bubble.hide();
      bubbleOwner = null;
    };
    var help = function(texts) {
      var btn = new Element('button', { 'type': 'button', 'class': 'cascade-help', 'aria-label': translate('Help') }).update('?');
      btn.observe('click', function(e) {
        e.stop();
        if (bubbleOwner === btn) return closeBubble();
        bubble.update(texts.map(function(t) { return '<p>' + translate(t).escapeHTML() + '</p>'; }).join(''));
        bubble.show();
        bubbleOwner = btn;
        var c = content.getBoundingClientRect(), b = btn.getBoundingClientRect();
        var left = Math.max(8, Math.min(b.left - c.left - 12, content.clientWidth - bubble.offsetWidth - 8));
        bubble.setStyle({ left: left + 'px', top: (b.bottom - c.top + content.scrollTop + 6) + 'px' });
      });
      return btn;
    };
    content.observe('click', function(e) {
      if (bubbleOwner && !e.findElement('.cascade-help-bubble')) closeBubble();
    });

    var topline = new Element('div', { 'class': 'cascade-topline' });
    topline.insert(new Element('span').update(translate('Blood relatives who may share the familial variant.')));
    topline.insert(help([
      'Blood relatives of the index person who may share the familial variant. Only untested relatives without the diagnosis are preselected: those already tested or diagnosed, deceased, unborn, not in contact or under the minimum age are listed but not preselected. Relatives of unknown age are preselected and marked.',
      'Adopted individuals are not counted as blood relatives of their adoptive family.',
      'Chances follow the selected mode of inheritance through the pedigree and are updated with the phenotypes and test results recorded in it, using the model below. Review the de novo proportion and penetrance for the condition.'
    ]));
    content.insert(topline);

    // --- controls
    var controls = new Element('div', { 'class': 'cascade-controls' });

    var indexSelect = new Element('select', { 'class': 'cascade-select', 'id': 'cascade-index' });
    var graph = editor.getGraph();
    var byId = this._numbering.byId;
    var personIds = [];
    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      if (isRealPerson(graph, id)) {
        personIds.push(id);
      }
    }
    // order by generation, then left to right (I-1, I-2, II-1...)
    personIds.sort(function(a, b) {
      var na = byId[a] || { generation: 99, index: a }, nb = byId[b] || { generation: 99, index: b };
      return (na.generation - nb.generation) || (na.index - nb.index);
    });
    personIds.forEach(function(pid) {
      var opt = new Element('option', { 'value': pid }).update(_this._personLabel(pid).escapeHTML());
      if (pid === _this._indexId) opt.selected = true;
      indexSelect.insert(opt);
    });

    var degreeSelect = new Element('select', { 'class': 'cascade-select', 'id': 'cascade-degree' });
    [[1, 'First-degree relatives'], [2, 'Up to 2nd degree'], [3, 'Up to 3rd degree']].forEach(function(o) {
      var opt = new Element('option', { 'value': o[0] }).update(translate(o[1]));
      if (o[0] === _this._maxDegree) opt.selected = true;
      degreeSelect.insert(opt);
    });

    var minAgeInput = new Element('input', { 'type': 'number', 'min': 0, 'max': 99, 'class': 'cascade-input cascade-input-short', 'id': 'cascade-minage', 'value': this._minAge });
    var findingInput = new Element('input', { 'type': 'text', 'class': 'cascade-input', 'id': 'cascade-finding', 'placeholder': translate('e.g. BRCA2 c.5946del'), 'value': this._finding });

    var modeSelect = new Element('select', { 'class': 'cascade-select', 'id': 'cascade-mode' });
    INHERITANCE_OPTIONS.forEach(function(o) {
      var opt = new Element('option', { 'value': o[0] }).update(translate(o[1]));
      if (o[0] === _this._mode) opt.selected = true;
      modeSelect.insert(opt);
    });

    var genotypeSelect = new Element('select', { 'class': 'cascade-select', 'id': 'cascade-genotype' });
    [['het', 'One variant (heterozygous carrier)'], ['biallelic', 'Two variants (biallelic, affected)']].forEach(function(o) {
      var opt = new Element('option', { 'value': o[0] }).update(translate(o[1]));
      if (o[0] === _this._indexGenotype) opt.selected = true;
      genotypeSelect.insert(opt);
    });

    var field = function(labelText, input, cls, helpTexts) {
      var wrap = new Element('label', { 'class': 'cascade-field ' + (cls || '') });
      var label = new Element('span', { 'class': 'cascade-field-label' }).update(translate(labelText));
      if (helpTexts) label.insert(help(helpTexts));
      wrap.insert(label);
      wrap.insert(input);
      // a click on the label text goes to the field itself (by default the browser would
      // activate the first control inside the label, which is the help button)
      wrap.observe('click', function(e) {
        if (e.findElement('button, input, select, textarea, a')) return;
        e.preventDefault();
        var control = (input.match && input.match('input, select')) ? input : input.down('input, select');
        if (control && !control.disabled) control.focus();
      });
      return wrap;
    };
    controls.insert(field('Index person', indexSelect, 'cascade-field-wide'));
    controls.insert(field('Inheritance', modeSelect, 'cascade-field-wide'));
    var genotypeField = field('Index genotype', genotypeSelect, 'cascade-field-wide');
    controls.insert(genotypeField);

    var freqInput = new Element('input', { 'type': 'number', 'min': 2, 'step': 1, 'class': 'cascade-input', 'id': 'cascade-carrier-freq', 'value': this._carrierFreqN });
    var freqWrap = new Element('span', { 'class': 'cascade-freq' });
    freqWrap.insert(new Element('span').update(translate('1 in')));
    freqWrap.insert(freqInput);
    var freqField = field('Carrier frequency', freqWrap, 'cascade-field-wide',
      ['Population carrier frequency. Used to estimate whether both variants of a biallelic index came from one common ancestor (more likely in consanguineous families and for rare variants).']);
    controls.insert(freqField);

    var syncGenotypeField = function() {
      genotypeField.setStyle({ display: _this._mode === 'AR' ? '' : 'none' });
      freqField.setStyle({ display: _this._isBiallelic() ? '' : 'none' });
    };
    syncGenotypeField();
    controls.insert(field('Relatives', degreeSelect));
    controls.insert(field('Minimum age', minAgeInput, 'cascade-field-narrow',
      ['Relatives younger than this are listed but not preselected. Relatives of unknown age are preselected.']));
    controls.insert(field('Familial variant', findingInput, 'cascade-field-wide',
      ['Optional. Printed in the list and the CSV. When the index has positive tests in several genes, naming the gene here selects which one is the familial variant.']));
    content.insert(controls);

    // --- fit of each mode of inheritance to the pedigree (click a mode to use it)
    var fitBox = new Element('div', { 'class': 'cascade-fit' });
    content.insert(fitBox);
    // switches to a mode; with fitted settings from the ranking, applies them to that mode's model
    var useMode = function(mode, fitted) {
      _this._mode = mode;
      if (mode === 'AR') {
        _this._indexGenotype = 'biallelic'; // the ranking assumes an affected index
        genotypeSelect.value = 'biallelic';
      }
      if (fitted) {
        _this._setModel('penetrance', fitted.penetrance);
        if (fitted.femalePen !== null) _this._setModel('femalePen', fitted.femalePen);
        if (mode === 'AD' || mode === 'XLR' || mode === 'XLD') _this._setModel('deNovo', fitted.deNovo);
      }
      modeSelect.value = mode;
      _this._saveSettings();
      syncGenotypeField();
      syncModelFields();
      recompute(false);
    };
    var renderFit = function() {
      var fit = _this._fit;
      fitBox.update('');
      var head = new Element('div', { 'class': 'cascade-fit-head' });
      head.insert(new Element('span', { 'class': 'cascade-fit-title' }).update(translate('Relative compatibility of the modes of inheritance')));
      head.insert(help([
        'How well each mode of inheritance explains the affected and unaffected relatives (for the condition chosen in the model) and the test results. Each mode is tried over a range of penetrance, penetrance in women (X-linked: low for recessive, high for dominant) and de novo proportion, with the age at onset set for it. Recessive assumes an affected index with two variants.',
        'The percentages compare the modes with each other (equal weight beforehand). They are a relative score, not a calibrated probability or a diagnosis: few relatives or unknown ages can change them. Choosing a mode here also applies the settings that fit best.',
        'Ascertainment correction (recommended): the family came to attention through the affected index, so the index\'s phenotype only rules out settings in which it is impossible (for example no affected women), instead of favoring settings with high penetrance.'
      ]));
      fitBox.insert(head);
      // option: ascertainment correction
      var opts = new Element('div', { 'class': 'cascade-fit-options' });
      var ascCb = new Element('input', { 'type': 'checkbox', 'class': 'cascade-row-check' });
      ascCb.checked = _this._ascertainment;
      ascCb.observe('change', function() {
        _this._ascertainment = ascCb.checked;
        _this._saveSettings();
        recompute(false);
      });
      opts.insert(new Element('label', { 'class': 'cascade-check' }).insert(ascCb).insert(new Element('span').update(translate('Correct for ascertainment through the index'))));
      // shown after the scores (inserted at the end of renderFit)
      var insertOptions = function() { fitBox.insert(opts); };
      if (!fit || !fit.informative) {
        fitBox.insert(new Element('div', { 'class': 'cascade-fit-empty' }).update(
          translate('Record affected and unaffected relatives (or test results) to compare the modes.')));
        insertOptions();
        return;
      }
      var chips = new Element('div', { 'class': 'cascade-fit-chips' });
      fit.ranking.forEach(function(r, i) {
        var pct = Math.round(r.p * 1000) / 10;
        var chip = new Element('button', {
          'type': 'button',
          'class': 'cascade-fit-chip' + (r.mode === _this._mode ? ' is-current' : '') + (i === 0 && !r.incompatible ? ' is-best' : '') + (r.incompatible ? ' is-incompatible' : ''),
          'title': translate(INHERITANCE_NAMES[r.mode]) + (r.incompatible ? ' — ' + translate('incompatible with the pedigree')
            : ' — ' + translate('best fit with') + ' ' + _this._fittedText(r.mode, r.fitted))
        });
        // a custom property: Prototype's setStyle does not set those
        chip.style.setProperty('--fit', Math.max(0, Math.min(100, pct)) + '%');
        chip.insert(new Element('span', { 'class': 'cascade-fit-mode' }).update(r.mode));
        chip.insert(new Element('span', { 'class': 'cascade-fit-pct' }).update(r.incompatible ? '0%' : (pct < 0.1 ? '<0.1%' : pct + '%')));
        chip.observe('click', function() { if (r.mode !== _this._mode && !r.incompatible) useMode(r.mode, r.fitted); });
        chips.insert(chip);
      });
      fitBox.insert(chips);
      var best = fit.ranking[0];
      var current = fit.ranking.filter(function(r) { return r.mode === _this._mode; })[0];
      if (best.mode !== _this._mode && best.p >= 0.5 && (!current || best.p >= 2 * current.p)) {
        var tip = new Element('div', { 'class': 'cascade-fit-suggestion' });
        tip.insert(new Element('span').update(translate('Best fit:') + ' <strong>' + translate(INHERITANCE_NAMES[best.mode]).escapeHTML() + '</strong>' +
          ' <span class="cascade-fit-settings">(' + _this._fittedText(best.mode, best.fitted).escapeHTML() + ')</span>'));
        var use = new Element('button', { 'type': 'button', 'class': 'cascade-fit-use' }).update(translate('Use this mode'));
        use.observe('click', function() { useMode(best.mode, best.fitted); });
        tip.insert(use);
        fitBox.insert(tip);
      }
      insertOptions();
    };

    // --- model: de novo, penetrance, evidence
    var modelBox = new Element('details', { 'class': 'cascade-model' });
    var modelSummary = new Element('span', { 'class': 'cascade-model-summary' });
    modelBox.insert(new Element('summary').insert(new Element('span', { 'class': 'cascade-model-title' }).update(translate('Model and evidence'))).insert(modelSummary));
    var modelGrid = new Element('div', { 'class': 'cascade-controls cascade-model-grid' });
    modelBox.insert(modelGrid);

    // several conditions can be chosen when the variant causes more than one: chosen ones are chips
    // (as for ancestry), the list below adds another one
    var conditionSelect = new Element('div', { 'class': 'opx-chip-field', 'id': 'cascade-condition' });
    var conditionChips = new Element('div', { 'class': 'opx-chips' });
    var conditionAdd = new Element('select', { 'class': 'cascade-select opx-chip-add' });
    conditionSelect.insert(conditionChips).insert(conditionAdd);
    var setConditions = function(list) {
      // "anyone marked as affected" when no specific condition is left
      _this._condition = (list && list.length) ? list : '';
      refreshConditions();
      syncModelFields();
      recompute(false);
    };
    var refreshConditions = function() {
      var current = _this._resolvedConditions();
      var disorders = _this._pedigreeDisorders();
      var nameOf = {};
      disorders.forEach(function(d) { nameOf[d.id] = d.name; });
      conditionChips.update('');
      if (!current.length) {
        conditionChips.insert(new Element('span', { 'class': 'opx-chip opx-chip-neutral' }).update(translate('Anyone marked as affected')));
      }
      current.forEach(function(id) {
        var chip = new Element('span', { 'class': 'opx-chip' }).insert(new Element('span').update(String(nameOf[id] || id).escapeHTML()));
        var remove = new Element('button', { 'type': 'button', 'class': 'opx-chip-remove', 'title': translate('Remove'), 'aria-label': translate('Remove') }).update('×');
        remove.observe('click', function() {
          setConditions(current.filter(function(c) { return c !== id; }));
        });
        conditionChips.insert(chip.insert(remove));
      });
      conditionAdd.update('');
      conditionAdd.insert(new Element('option', { 'value': '__add' }).update(translate(current.length ? 'Add another condition…' : 'Choose a condition…')));
      disorders.forEach(function(d) {
        if (current.indexOf(d.id) === -1) conditionAdd.insert(new Element('option', { 'value': d.id }).update(d.name.escapeHTML()));
      });
      if (current.length) conditionAdd.insert(new Element('option', { 'value': '' }).update(translate('Anyone marked as affected')));
      conditionAdd.value = '__add';
      conditionAdd.disabled = conditionAdd.options.length < 2;
    };
    refreshConditions();

    var numberInput = function(id, min, max, step) {
      return new Element('input', { 'type': 'number', 'min': min, 'max': max, 'step': step, 'class': 'cascade-input', 'id': id });
    };
    var deNovoInput = numberInput('cascade-denovo', 0, 100, 'any');
    var penInput = numberInput('cascade-pen', 0, 100, 'any');
    var femalePenInput = numberInput('cascade-femalepen', 0, 100, 'any');
    var onsetFromInput = numberInput('cascade-onset-from', 0, 120, 1);
    var onsetToInput = numberInput('cascade-onset-to', 0, 120, 1);
    var onsetWrap = new Element('span', { 'class': 'cascade-freq' })
      .insert(onsetFromInput).insert(new Element('span').update(translate('to'))).insert(onsetToInput)
      .insert(new Element('span').update(translate('years')));

    var conditionField = field('Condition used for phenotypes', conditionSelect, 'cascade-field-wide',
      ['Relatives with this condition count as affected, the others as unaffected (when that option is on). By default, the condition of the index person.',
        'Add several conditions caused by the same variant, for example breast and ovarian cancer: a relative with any of them counts as affected.']);
    var deNovoField = field('De novo (% of carriers)', deNovoInput, 'cascade-field-narrow',
      ['Share of carriers whose variant is new, so the parents do not carry it.',
        'De novo examples: about 1/3 of isolated males for lethal X-linked conditions (Haldane); about 50% in NF1; about 80% in achondroplasia; rare in late-onset cancer syndromes.']);
    var penLabel = new Element('span', { 'class': 'cascade-field-label' });
    var penField = new Element('label', { 'class': 'cascade-field cascade-field-narrow' }).insert(penLabel).insert(penInput);
    var femalePenField = field('Penetrance in heterozygous females (%)', femalePenInput, 'cascade-field-narrow');
    // age at onset: an age range, or a penetrance curve (whose last point is then the penetrance)
    var curveInput = new Element('input', { 'type': 'text', 'class': 'cascade-input cascade-curve-input', 'id': 'cascade-curve', 'placeholder': translate('e.g. 30:3 40:10 50:25 70:55') });
    var onsetModeSelect = new Element('select', { 'class': 'cascade-select cascade-onset-mode' });
    onsetModeSelect.insert(new Element('option', { 'value': 'range' }).update(translate('Age range')));
    onsetModeSelect.insert(new Element('option', { 'value': 'curve' }).update(translate('Penetrance curve')));
    var onsetMode = parsePenetranceCurve(_this._getModel().curve) ? 'curve' : 'range';
    var onsetBox = new Element('span', { 'class': 'cascade-onset-box' }).insert(onsetModeSelect).insert(onsetWrap).insert(curveInput);
    var onsetField = field('Age at onset', onsetBox, 'cascade-field-onset',
      ['Age range: carriers who become affected show signs between these ages, evenly spread (0 to 0 means at birth, congenital). Unaffected relatives younger than the range are less informative.',
        'Penetrance curve: the cumulative chance of being affected at several ages, as age:% pairs from a published curve (for example 30:3 40:10 50:25 70:55). Its last value is the lifetime penetrance, so the penetrance field follows it.']);
    var phenocopyInput = numberInput('cascade-phenocopy', 0, 100, 'any');
    var phenocopyField = field('Sporadic cases (% of non-carriers affected)', phenocopyInput, 'cascade-field-narrow',
      ['Chance that a relative without the familial variant has the condition anyway (phenocopy). Use the population risk for common conditions, for example about 12% for breast cancer in women, or turn off the use of phenotypes and rely on test results.']);
    var mutationRatioInput = numberInput('cascade-mutation-ratio', 0.1, 100, 'any');
    var mutationRatioField = field('Mutation rate, male / female', mutationRatioInput, 'cascade-field-narrow',
      ['X-linked: how many times more often new variants arise in male than in female germ cells. 1 assumes equal rates (classical Haldane result, 2/3 for the mother of an isolated case). Higher values fit conditions such as hemophilia A, where most mothers of isolated cases are carriers.']);
    [conditionField, deNovoField, penField, femalePenField, onsetField, phenocopyField, mutationRatioField].forEach(function(f) { modelGrid.insert(f); });

    var checks = new Element('div', { 'class': 'cascade-checks' });
    var makeCheck = function(key, text) {
      var cb = new Element('input', { 'type': 'checkbox', 'class': 'cascade-row-check' });
      var wrap = new Element('label', { 'class': 'cascade-check' }).insert(cb).insert(new Element('span').update(translate(text)));
      checks.insert(wrap);
      cb.observe('change', function() {
        _this._setModel(key, cb.checked);
        syncModelFields();
        recompute(false);
      });
      return cb;
    };
    var usePhenoCb = makeCheck('usePhenotypes', 'Use phenotypes of relatives');
    var unrecordedCb = makeCheck('unrecordedUnaffected', 'Relatives without the condition recorded are unaffected');
    var useTestsCb = makeCheck('useTests', 'Use test results (+ / −) and carrier marks');
    // several conditions: one row of settings per condition
    var perConditionBox = new Element('div', { 'class': 'cascade-percondition' });
    modelBox.insert(perConditionBox);
    modelBox.insert(checks);

    // model file: export the settings of this disease, import them in another family
    var modelFile = new Element('div', { 'class': 'cascade-model-file' });
    var importInput = new Element('input', { 'type': 'file', 'accept': '.json,application/json', 'class': 'cascade-model-file-input' });
    importInput.observe('change', function() {
      var file = importInput.files && importInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function() {
        var r = parsePreset(reader.result);
        if (r.problems) {
          alert(translate('This file is not a valid model:') + ' ' + r.problems.join('; '));
          return;
        }
        var unmatched = _this._applyPreset(r.preset);
        _this.show(); // rebuild the dialog with the imported settings
        if (unmatched.length) {
          alert(translate('These conditions of the model are not in this pedigree:') + '\n\n' + unmatched.join('\n') +
            '\n\n' + translate('The other settings were loaded. Check the conditions used for phenotypes.'));
        }
      };
      reader.readAsText(file, 'UTF-8');
      importInput.value = '';
    });
    var fileLink = function(label, title, handler) {
      var a = new Element('button', { 'type': 'button', 'class': 'cascade-model-file-link', 'title': translate(title) }).update(translate(label));
      a.observe('click', handler);
      return a;
    };
    modelFile.insert(fileLink('Export model', 'Save these settings in a file to use them in other families with the same disease', function() {
      var conds = _this._pedigreeDisorders().filter(function(d) { return _this._resolvedConditions().indexOf(d.id) !== -1; })
        .map(function(d) { return d.name; });
      var name = prompt(translate('Name of the model:'), _this._presetName || (conds.join(' + ') + (conds.length ? ' - ' : '') + _this._mode));
      if (!name || !name.trim()) return;
      _this._presetName = name.trim();
      var p = _this._currentPreset(name, '');
      var fileName = p.name.replace(/[^\w\-]+/g, '_').replace(/^_+|_+$/g, '') || 'cascade';
      _this._download(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), fileName + '.opx-model.json');
    }));
    modelFile.insert(new Element('span', { 'class': 'cascade-model-file-sep' }).update('·'));
    modelFile.insert(fileLink('Import model', 'Apply the settings saved in a model file', function() { importInput.click(); }));
    modelFile.insert(importInput);
    modelBox.insert(modelFile);
    content.insert(modelBox);

    var renderConditionTable = function(xl) {
      var conditions = _this._resolvedConditions();
      perConditionBox.update('');
      if (conditions.length < 2) {
        perConditionBox.setStyle({ display: 'none' });
        return;
      }
      perConditionBox.setStyle({ display: '' });
      var m = _this._getModel();
      var names = {};
      _this._pedigreeDisorders().forEach(function(d) { names[d.id] = d.name; });
      var head = new Element('div', { 'class': 'cascade-percondition-head' });
      head.insert(new Element('span', { 'class': 'cascade-field-label' }).update(translate('Settings per condition')));
      head.insert(help(['Each condition has its own penetrance, age at onset (or penetrance curve) and rate of sporadic cases, and the conditions count independently. Empty cells use the general values.',
        'With a penetrance curve, its last value is the penetrance and the onset ages are not used.']));
      perConditionBox.insert(head);
      var table = new Element('table', { 'class': 'cascade-percondition-table' });
      var cols = [['penetrance', xl ? 'Penetrance in hemizygous males (%)' : 'Penetrance (%)', 'number']];
      if (xl) cols.push(['femalePen', 'Penetrance in heterozygous females (%)', 'number']);
      cols.push(['onsetFrom', 'Onset from', 'number'], ['onsetTo', 'Onset to', 'number'],
        ['curve', 'Penetrance curve', 'text'], ['phenocopy', 'Sporadic cases (%)', 'number']);
      var tr = new Element('tr').insert(new Element('th').update(translate('Condition')));
      cols.forEach(function(c) { tr.insert(new Element('th').update(translate(c[1]))); });
      table.insert(new Element('thead').insert(tr));
      var body = new Element('tbody');
      conditions.forEach(function(cond) {
        var row = new Element('tr').insert(new Element('td').update((names[cond] || cond).escapeHTML()));
        var own = m.conditionParams[cond] || {};
        var rowCurve = activeCurve(own, m);
        cols.forEach(function(c) {
          var key = c[0];
          var input = new Element('input', { 'type': c[2], 'class': 'cascade-input', 'step': 'any', 'min': 0 });
          if (c[2] === 'text') input.setAttribute('placeholder', m.curve || translate('e.g. 30:3 40:10 50:25 70:55'));
          input.value = own.hasOwnProperty(key) ? own[key] : '';
          input.setAttribute('placeholder', input.getAttribute('placeholder') || String(m[key]));
          if (rowCurve && key === 'penetrance') {
            // the curve gives the penetrance
            input.value = curveLifetime(rowCurve);
            input.disabled = true;
            input.title = translate('From the penetrance curve');
          } else if (rowCurve && (key === 'onsetFrom' || key === 'onsetTo')) {
            input.value = '';
            input.setAttribute('placeholder', '—');
            input.disabled = true;
            input.title = translate('The penetrance curve is used instead');
          }
          input.observe('change', function() {
            var all = Object.assign({}, _this._getModel().conditionParams);
            var entry = Object.assign({}, all[cond] || {});
            var raw = input.value.trim();
            if (raw === '') {
              delete entry[key];
            } else if (c[2] === 'text') {
              if (parsePenetranceCurve(raw)) entry[key] = raw; else delete entry[key];
            } else {
              var v = parseFloat(raw.replace(',', '.'));
              if (isNaN(v)) delete entry[key]; else entry[key] = Math.max(0, Math.min(key.indexOf('onset') === 0 ? 120 : 100, v));
            }
            all[cond] = entry;
            _this._setModel('conditionParams', all);
            renderConditionTable(xl);
            recompute(false);
          });
          row.insert(new Element('td').insert(input));
        });
        body.insert(row);
      });
      table.insert(body);
      perConditionBox.insert(new Element('div', { 'class': 'cascade-table-wrap' }).insert(table));
    };

    var syncModelFields = function() {
      var m = _this._getModel();
      var biallelic = _this._isBiallelic();
      var xl = _this._mode === 'XLR' || _this._mode === 'XLD';
      deNovoInput.value = m.deNovo;
      penInput.value = m.penetrance;
      femalePenInput.value = m.femalePen;
      onsetFromInput.value = m.onsetFrom;
      onsetToInput.value = m.onsetTo;
      curveInput.value = m.curve;
      var generalCurve = parsePenetranceCurve(m.curve);
      if (generalCurve) onsetMode = 'curve';
      onsetModeSelect.value = onsetMode;
      onsetWrap.setStyle({ display: onsetMode === 'range' ? '' : 'none' });
      curveInput.setStyle({ display: onsetMode === 'curve' ? '' : 'none' });
      // with a curve, the penetrance is its last value
      penInput.disabled = !!generalCurve;
      penInput.title = generalCurve ? translate('From the penetrance curve') : '';
      if (generalCurve) penInput.value = curveLifetime(generalCurve);
      phenocopyInput.value = m.phenocopy;
      mutationRatioInput.value = m.mutationRatio;
      mutationRatioField.setStyle({ display: xl ? '' : 'none' });
      usePhenoCb.checked = m.usePhenotypes;
      unrecordedCb.checked = m.unrecordedUnaffected;
      useTestsCb.checked = m.useTests;
      unrecordedCb.disabled = !m.usePhenotypes;
      penLabel.update(translate(biallelic ? 'Penetrance in biallelic individuals (%)' : (xl ? 'Penetrance in hemizygous males (%)' : 'Penetrance in carriers (%)')));
      deNovoField.setStyle({ display: _this._mode === 'AR' ? 'none' : '' });
      // one familial copy in a recessive condition says nothing about phenotypes
      var phenoUseful = !(_this._mode === 'AR' && !biallelic);
      // with several conditions, their settings are in the per-condition table instead
      var multi = _this._resolvedConditions().length > 1;
      conditionField.setStyle({ display: phenoUseful ? '' : 'none' });
      [penField, onsetField, phenocopyField].forEach(function(f) { f.setStyle({ display: phenoUseful && !multi ? '' : 'none' }); });
      femalePenField.setStyle({ display: xl && !multi ? '' : 'none' });
      renderConditionTable(xl);
      if (!phenoUseful) perConditionBox.setStyle({ display: 'none' });
      usePhenoCb.up('label').setStyle({ display: phenoUseful ? '' : 'none' });
      unrecordedCb.up('label').setStyle({ display: phenoUseful ? '' : 'none' });
    };
    syncModelFields();

    // number fields update the results while typing (after a short pause) and are tidied on change
    var whileTyping = function(input, apply) {
      var timer = null;
      input.observe('input', function() {
        clearTimeout(timer);
        timer = setTimeout(function() {
          var v = parseFloat(String(input.value).replace(',', '.'));
          if (!isNaN(v)) apply(v);
        }, 400);
      });
      return function() { clearTimeout(timer); };
    };
    var bindNumber = function(input, key, min, max) {
      var cancel = whileTyping(input, function(v) {
        if (v < min || v > max) return; // wait until the value is complete
        if (_this._getModel()[key] === v) return;
        _this._setModel(key, v);
        recompute(false);
      });
      input.observe('change', function() {
        cancel();
        var v = parseFloat(String(input.value).replace(',', '.'));
        if (isNaN(v)) v = _this._getModel()[key];
        v = Math.max(min, Math.min(max, v));
        input.value = v;
        if (_this._getModel()[key] === v) return;
        _this._setModel(key, v);
        recompute(false);
      });
    };
    bindNumber(deNovoInput, 'deNovo', 0, 100);
    bindNumber(penInput, 'penetrance', 0, 100);
    bindNumber(femalePenInput, 'femalePen', 0, 100);
    bindNumber(onsetFromInput, 'onsetFrom', 0, 120);
    bindNumber(onsetToInput, 'onsetTo', 0, 120);
    bindNumber(phenocopyInput, 'phenocopy', 0, 100);
    bindNumber(mutationRatioInput, 'mutationRatio', 0.1, 100);
    curveInput.observe('change', function() {
      var text = curveInput.value.trim();
      // keep only what parses; an invalid curve is cleared
      _this._setModel('curve', parsePenetranceCurve(text) ? text : '');
      curveInput.value = _this._getModel().curve;
      syncModelFields();
      recompute(false);
    });
    onsetModeSelect.observe('change', function() {
      onsetMode = onsetModeSelect.value;
      if (onsetMode === 'range' && _this._getModel().curve) {
        // back to the age range: the curve no longer applies
        _this._setModel('curve', '');
        syncModelFields();
        recompute(false);
        return;
      }
      syncModelFields();
      if (onsetMode === 'curve') curveInput.focus();
    });
    conditionAdd.observe('change', function() {
      var value = conditionAdd.value;
      if (value === '__add') return;
      // "anyone marked as affected" replaces the specific conditions
      setConditions(value === '' ? [] : _this._resolvedConditions().concat([value]));
    });

    // --- summary and table
    var warningBox = new Element('div', { 'class': 'cascade-warning', 'role': 'alert' });
    content.insert(warningBox);
    // compact flag: Haldane's 1/3 de novo used although affected men have children
    var haldaneFlag = new Element('div', { 'class': 'cascade-flag', 'role': 'status' });
    haldaneFlag.insert(new Element('span', { 'class': 'cascade-flag-icon', 'aria-hidden': 'true' }).update('!'));
    haldaneFlag.insert(new Element('span').update(translate('De novo 1/3 does not fit: affected men have children')));
    haldaneFlag.insert(help(['Affected men have children in this family: the de novo proportion of 1/3 (Haldane) applies only when affected men do not reproduce, and it rules out daughters inheriting from their affected father. Lower it in the model (for example to 5%).']));
    var haldaneFix = new Element('button', { 'type': 'button', 'class': 'cascade-flag-fix' }).update(translate('Use 5%'));
    haldaneFix.observe('click', function() {
      _this._setModel('deNovo', 5);
      syncModelFields();
      recompute(false);
    });
    haldaneFlag.insert(haldaneFix);
    content.insert(haldaneFlag);
    // approximate result: consanguinity loop, or the search for lines of origin was cut short
    var approxFlag = new Element('div', { 'class': 'cascade-flag', 'role': 'status' });
    approxFlag.insert(new Element('span', { 'class': 'cascade-flag-icon', 'aria-hidden': 'true' }).update('~'));
    var approxText = new Element('span');
    approxFlag.insert(approxText);
    approxFlag.insert(help(['With consanguinity loops, a relative whose two parents may both carry the variant is computed treating the parents as independent, which is an approximation. Very large or deep pedigrees are also searched only up to 10 generations and 512 lines of origin. Check important results with dedicated linkage software.']));
    content.insert(approxFlag);
    // relatives who could carry the variant but were left out by the recorded phenotypes and tests
    var ruledOutFlag = new Element('div', { 'class': 'cascade-flag', 'role': 'status' });
    ruledOutFlag.insert(new Element('span', { 'class': 'cascade-flag-icon', 'aria-hidden': 'true' }).update('!'));
    var ruledOutText = new Element('span');
    ruledOutFlag.insert(ruledOutText);
    ruledOutFlag.insert(help(['These relatives could carry the variant under this mode of inheritance, but the model rules them out: with the penetrance and age at onset set in it, a carrier would already be affected, and they are not recorded as affected (or a test result excludes them).',
      'If the condition has incomplete or late penetrance, set the penetrance and the age at onset in "Model and evidence", or stop counting relatives without the condition as unaffected.']));
    var ruledOutFix = new Element('button', { 'type': 'button', 'class': 'cascade-flag-fix' }).update(translate('Do not count them as unaffected'));
    ruledOutFix.observe('click', function() {
      _this._setModel('unrecordedUnaffected', false);
      syncModelFields();
      recompute(false);
    });
    ruledOutFlag.insert(ruledOutFix);
    content.insert(ruledOutFlag);
    var summary =new Element('div', { 'class': 'cascade-summary' });
    content.insert(summary);
    var tableWrap = new Element('div', { 'class': 'cascade-table-wrap' });
    content.insert(tableWrap);

    var renderTable = function() {
      var rows = _this._rows;
      var selectedCount = rows.filter(function(r) { return r.selected; }).length;
      var testedCount = rows.filter(function(r) { return r.tested; }).length;
      var biallelic = _this._isBiallelic();
      renderFit();
      warningBox.update(_this._warning ? _this._warning.escapeHTML() : '');
      warningBox.setStyle({ display: _this._warning ? '' : 'none' });
      haldaneFlag.setStyle({ display: _this._haldaneFlag ? '' : 'none' });
      var ap = _this._approx || {};
      var approxReasons = [];
      if (ap.loop) approxReasons.push(translate('consanguinity loop'));
      if (ap.truncated || ap.depthLimited) approxReasons.push(translate('search limit reached'));
      approxText.update((translate('Approximate result') + ': ' + approxReasons.join(', ')).escapeHTML());
      approxFlag.setStyle({ display: approxReasons.length ? '' : 'none' });
      var ruledOut = _this._warning ? 0 : (_this._ruledOut || 0);
      var fitModel = _this._getModel();
      ruledOutText.update((ruledOut + ' ' + translate(ruledOut === 1 ? 'relative left out by the recorded phenotypes and tests' : 'relatives left out by the recorded phenotypes and tests')).escapeHTML());
      ruledOutFlag.setStyle({ display: ruledOut ? '' : 'none' });
      ruledOutFix.setStyle({ display: (fitModel.usePhenotypes && fitModel.unrecordedUnaffected && !(_this._mode === 'AR' && !biallelic)) ? '' : 'none' });

      summary.update('');
      var chips = [[rows.length, 'at risk'], [selectedCount, 'selected to approach'], [testedCount, 'already tested']];
      if (_this._notAtRisk) {
        chips.push([_this._notAtRisk, 'not at risk with this inheritance']);
      }
      if (biallelic && _this._ibd > 0) {
        chips.push([_this._formatChance(_this._ibd), 'chance both variants come from one common ancestor']);
      }
      if (_this._deNovoIndex !== null && _this._deNovoIndex !== undefined) {
        chips.push([_this._formatChance(_this._deNovoIndex), 'chance the variant arose de novo in the index']);
      }
      if (_this._indexF > 0) {
        chips.push(['F = ' + formatCoefficient(_this._indexF, getLanguage()), 'inbreeding coefficient of the index (parents related)']);
      }
      // one-line summary of the model, visible while the model box is closed
      var ec = _this._evidenceCounts || {};
      var m = _this._getModel();
      var parts = [];
      if (_this._mode !== 'AR') parts.push(translate('de novo') + ' ' + m.deNovo + '%');
      var nCond = _this._resolvedConditions().length;
      var summaryCurve = parsePenetranceCurve(m.curve);
      if (!(_this._mode === 'AR' && !biallelic)) parts.push(nCond > 1 ? nCond + ' ' + translate('conditions') : translate('penetrance') + ' ' + (summaryCurve ? curveLifetime(summaryCurve) + '% (' + translate('curve') + ')' : m.penetrance + '%'));
      parts.push((ec.affected || 0) + ' ' + translate('affected') + ', ' + (ec.unaffected || 0) + ' ' + translate('unaffected') + ', ' + (ec.tested || 0) + ' ' + translate('tested'));
      modelSummary.update(parts.join(' · ').escapeHTML());

      chips.forEach(function(s) {
        summary.insert(new Element('span', { 'class': 'cascade-chip' })
          .insert(new Element('strong').update(String(s[0])))
          .insert(' ' + translate(s[1])));
      });
      // relatives ticked or unticked by hand: offer to go back to the default selection
      if (Object.keys(_this._overrides).length) {
        var reset = new Element('button', { 'type': 'button', 'class': 'cascade-model-file-link cascade-reset-selection',
          'title': translate('Select again the untested, undiagnosed relatives at risk') }).update(translate('Restore default selection'));
        reset.observe('click', function() { recompute(true); });
        summary.insert(reset);
      }

      tableWrap.update('');
      if (!rows.length) {
        if (!_this._warning) {
          tableWrap.insert(new Element('p', { 'class': 'cascade-empty' }).update(
            translate('No relatives at risk within the selected degree. Add parents, siblings or children to the index person, or check the mode of inheritance.')));
        }
        return;
      }

      var table = new Element('table', { 'class': 'cascade-table' });
      var head = new Element('tr');
      var chanceHeaders = biallelic ? ['Carrier', 'Affected'] : ['Chance'];
      ['', 'ID', 'Name', 'Relationship'].concat(chanceHeaders, ['Age / status', 'Results', 'Note']).forEach(function(h) {
        head.insert(new Element('th').update(h ? translate(h) : ''));
      });
      table.insert(new Element('thead').insert(head));
      var body = new Element('tbody');

      rows.forEach(function(row) {
        var tr = new Element('tr', { 'class': row.selected ? 'is-selected' : '' });
        var cb = new Element('input', { 'type': 'checkbox', 'class': 'cascade-row-check', 'aria-label': translate('Approach this relative') });
        cb.checked = row.selected;
        cb.observe('change', function() {
          row.selected = cb.checked;
          _this._overrides[row.id] = cb.checked;
          renderTable();
        });

        var locate = new Element('button', { 'type': 'button', 'class': 'cascade-locate', 'title': translate('Show on chart') }).update(
          (row.name || translate('Unnamed')).escapeHTML());
        locate.observe('click', function() {
          editor.getWorkspace().centerAroundNode(row.id);
        });

        var degreeBadge = new Element('span', { 'class': 'cascade-degree' }).setStyle({ borderColor: DEGREE_COLORS[row.degree] || '#94A3B8' }).update(
          String(row.degree) + (getLanguage() === 'pt-BR' ? 'º' : (['', 'st', 'nd', 'rd'][row.degree] || 'th')));

        tr.insert(new Element('td').insert(cb));
        tr.insert(new Element('td', { 'class': 'cascade-id' }).update(row.label));
        tr.insert(new Element('td').insert(locate));
        tr.insert(new Element('td', { 'class': 'cascade-rel' }).insert(degreeBadge).insert(' ' + row.relationship.escapeHTML()));
        // what a positive result means is shown on hover (and kept in the CSV)
        var ifPositive = translate('If positive') + ': ' + row.meaning;
        if (biallelic) {
          tr.insert(new Element('td', { 'class': 'cascade-num', 'title': ifPositive }).update(_this._formatChance(row.carrierChance)));
          tr.insert(new Element('td', { 'class': 'cascade-num', 'title': ifPositive }).update(_this._formatChance(row.affectedChance)));
        } else {
          tr.insert(new Element('td', { 'class': 'cascade-num', 'title': ifPositive }).update(_this._formatChance(row.chance)));
        }
        var alive = row.lifeStatus === translate('Alive');
        var ageStatus = alive ? (row.ageText || '—') : row.lifeStatus + (row.ageText ? ' · ' + row.ageText : '');
        tr.insert(new Element('td').update(ageStatus.escapeHTML()));
        tr.insert(new Element('td', { 'class': 'cascade-results', 'title': row.findings || '' }).update(row.findings ? row.findings.escapeHTML() : '—'));
        tr.insert(new Element('td', { 'class': 'cascade-note' }).update(row.reason.escapeHTML()));
        body.insert(tr);
      });
      table.insert(body);
      tableWrap.insert(table);
    };

    // relatives ticked or unticked by hand keep that choice when the model changes; only a new
    // index person or "Restore default selection" clears it
    var recompute = function(resetOverrides) {
      if (resetOverrides) _this._overrides = {};
      _this._computeRows();
      renderTable();
      if (editor.getOverlay().hasCascadeHighlight()) {
        _this.highlight();
      }
    };

    indexSelect.observe('change', function() {
      _this._indexId = parseInt(indexSelect.value, 10);
      _this._condition = null; // follow the new index person's condition
      refreshConditions();
      syncModelFields();
      recompute(true); // the selection made by hand was for the relatives of the previous index
    });
    modeSelect.observe('change', function() {
      _this._mode = modeSelect.value;
      _this._saveSettings();
      syncGenotypeField();
      syncModelFields();
      recompute(false);
    });
    genotypeSelect.observe('change', function() {
      _this._indexGenotype = genotypeSelect.value;
      _this._saveSettings();
      syncGenotypeField();
      syncModelFields();
      recompute(false);
    });
    freqInput.observe('change', function() {
      var n = parseFloat(freqInput.value);
      _this._carrierFreqN = (isNaN(n) || n < 2) ? 100 : n;
      freqInput.value = _this._carrierFreqN;
      _this._saveSettings();
      recompute(false);
    });
    degreeSelect.observe('change', function() {
      _this._maxDegree = parseInt(degreeSelect.value, 10);
      recompute(false);
    });
    var cancelMinAge = whileTyping(minAgeInput, function(v) {
      v = Math.max(0, Math.round(v));
      if (v === _this._minAge) return;
      _this._minAge = v;
      recompute(false);
    });
    minAgeInput.observe('change', function() {
      cancelMinAge();
      var v = parseInt(minAgeInput.value, 10);
      v = isNaN(v) ? 18 : Math.max(0, v);
      minAgeInput.value = v;
      if (v === _this._minAge) return;
      _this._minAge = v;
      recompute(false);
    });
    var findingTimer = null;
    findingInput.observe('input', function() {
      _this._finding = findingInput.value;
      // a gene named here chooses the familial variant among the index's positive tests, which
      // changes whose results count
      clearTimeout(findingTimer);
      findingTimer = setTimeout(function() { if (_this.dialog) recompute(false); }, 500);
    });

    renderTable();

    // --- buttons
    var buttons = new Element('div', { 'class': 'cascade-buttons' });
    var makeButton = function(label, cls, handler) {
      var b = new Element('input', { 'type': 'button', 'value': translate(label), 'class': 'button ' + (cls || '') });
      b.observe('click', handler);
      buttons.insert(new Element('span', { 'class': 'buttonwrapper' }).insert(b));
      return b;
    };
    makeButton('Highlight on chart', 'cascade-primary', function() {
      _this.highlight();
      _this.hide();
    });
    makeButton('Export CSV', 'secondary', function() { _this.exportCSV(); });
    makeButton('Copy list', 'secondary', function(e) { _this.copyList(e && e.element ? e.element() : null); });
    makeButton('Close', 'secondary', function() { _this.hide(); });
    content.insert(buttons);
    content.insert(bubble);

    this.dialog = new PhenoTips.widgets.ModalPopup(content, {
      close: { method: function() { _this.hide(); }, keys: ['Esc'] }
    }, {
      extraClassName: 'cascade-modal-box',
      title: translate('Cascade testing'),
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

  /**
   * Highlights the index person and the selected relatives on the chart.
   */
  highlight: function() {
    this._inUse = true;
    if (!this._rows.length) {
      this._computeRows();
    }
    var colorById = {};
    var degreesPresent = {};
    this._rows.forEach(function(row) {
      if (row.selected) {
        colorById[row.id] = DEGREE_COLORS[row.degree] || '#94A3B8';
        degreesPresent[row.degree] = true;
      }
    });
    var legendItems = Object.keys(degreesPresent).sort().map(function(d) {
      return { color: DEGREE_COLORS[d], label: translate(DEGREE_LABELS[d]) };
    });
    editor.getOverlay().setCascadeHighlight(this._indexId, colorById, legendItems);
  },

  _buildTable: function() {
    var _this = this;
    var biallelic = this._isBiallelic();
    var chanceHeaders = biallelic ? ['Chance of being a carrier', 'Chance of being affected'] : ['Chance of carrying the variant'];
    var header = ['ID', 'Name', 'Relationship', 'Degree'].concat(chanceHeaders, ['If positive', 'Age', 'Status', 'Results', 'Approach', 'Note']).map(translate);
    var lines = [header];
    this._rows.forEach(function(r) {
      var chances = biallelic ? [_this._formatChance(r.carrierChance), _this._formatChance(r.affectedChance)] : [_this._formatChance(r.chance)];
      lines.push([r.label, r.name, r.relationship, String(r.degree)].concat(chances, [r.meaning, r.ageText, r.lifeStatus,
        r.findings, r.selected ? translate('Yes') : translate('No'), r.reason]));
    });
    return lines;
  },

  _preamble: function() {
    var mode = translate(INHERITANCE_NAMES[this._mode]);
    if (this._mode === 'AR') {
      mode += ' — ' + translate(this._isBiallelic() ? 'Two variants (biallelic, affected)' : 'One variant (heterozygous carrier)');
    }
    var lines = [
      [translate('Cascade testing')],
      [translate('Index person'), this._personLabel(this._indexId)],
      [translate('Inheritance'), mode]
    ];
    if (this._isBiallelic()) {
      lines.push([translate('Population carrier frequency'), translate('1 in') + ' ' + this._carrierFreqN]);
    }
    if (this._indexF > 0) {
      lines.push([translate("Inbreeding coefficient of the index (Wright's F)"), formatCoefficient(this._indexF, getLanguage())]);
    }
    if (this._fit && this._fit.informative) {
      lines.push([translate('Relative compatibility of the modes of inheritance'), this._fit.ranking.map(function(r) {
        return r.mode + ' ' + (Math.round(r.p * 1000) / 10) + '%';
      }).join(', ') + (this._ascertainment ? ' (' + translate('Correct for ascertainment through the index').toLowerCase() + ')' : '')]);
    }
    var m = this._getModel();
    var xl = this._mode === 'XLR' || this._mode === 'XLD';
    if (this._mode !== 'AR') {
      lines.push([translate('De novo (% of carriers)'), m.deNovo + '%']);
    }
    if (xl) {
      lines.push([translate('Mutation rate, male / female'), String(m.mutationRatio)]);
    }
    var conditions = this._resolvedConditions();
    if (!(this._mode === 'AR' && !this._isBiallelic()) && conditions.length > 1) {
      // one line per condition with its own settings
      var names = {};
      this._pedigreeDisorders().forEach(function(d) { names[d.id] = d.name; });
      conditions.forEach(function(c) {
        var p = m.conditionParams[c] || {};
        var v = function(key) { return p.hasOwnProperty(key) ? p[key] : m[key]; };
        var rowCurve = activeCurve(p, m);
        lines.push([names[c] || c, translate('Penetrance') + ' ' + (rowCurve ? curveLifetime(rowCurve) : v('penetrance')) + '%' +
          (xl ? ' / ' + v('femalePen') + '% ' + translate('in heterozygous females') : '') + '; ' +
          translate('Age at onset') + ' ' + (rowCurve ? translate('Penetrance curve') + ' ' + (p.curve || m.curve) : (v('onsetFrom') + '–' + v('onsetTo'))) + '; ' +
          translate('Sporadic cases (%)') + ' ' + v('phenocopy') + '%']);
      });
    } else if (!(this._mode === 'AR' && !this._isBiallelic())) {
      var reportCurve = parsePenetranceCurve(m.curve);
      lines.push([translate('Penetrance'), (reportCurve ? curveLifetime(reportCurve) : m.penetrance) + '%' + (xl ? ' / ' + m.femalePen + '% ' + translate('in heterozygous females') : '')]);
      lines.push([translate('Age at onset'), reportCurve ? translate('Penetrance curve') + ': ' + m.curve : m.onsetFrom + '–' + m.onsetTo]);
      lines.push([translate('Sporadic cases (% of non-carriers affected)'), m.phenocopy + '%']);
    }
    var ap = this._approx || {};
    if (ap.loop || ap.truncated || ap.depthLimited) {
      lines.push([translate('Approximate result'), [ap.loop ? translate('consanguinity loop') : '', (ap.truncated || ap.depthLimited) ? translate('search limit reached') : ''].filter(Boolean).join(', ')]);
    }
    var ec = this._evidenceCounts || {};
    lines.push([translate('Evidence:'), (ec.affected || 0) + ' ' + translate('affected') + ', ' + (ec.unaffected || 0) + ' ' + translate('unaffected') + ', ' + (ec.tested || 0) + ' ' + translate('tested')]);
    if (this._finding) {
      lines.push([translate('Familial variant or condition'), this._finding]);
    }
    lines.push([translate('Date'), new Date().toLocaleDateString()]);
    lines.push([]);
    return lines;
  },

  exportCSV: function() {
    var csvCell = function(v) {
      v = (v === undefined || v === null) ? '' : String(v);
      // text that a spreadsheet would run as a formula (a name starting with "=", "+", "-" or "@")
      if (/^[=+\-@\t\r]/.test(v)) v = '\'' + v;
      return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    var text = this._preamble().concat(this._buildTable()).map(function(row) {
      return row.map(csvCell).join(',');
    }).join('\r\n');
    // BOM so spreadsheet apps read accented names correctly
    var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    var fileName = 'cascade-testing.csv';
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
  },

  copyList: function(button) {
    var text = this._preamble().concat(this._buildTable()).map(function(row) {
      return row.join('\t');
    }).join('\n');
    var done = function() {
      if (button) {
        var old = button.value;
        button.value = translate('Copied!');
        setTimeout(function() { button.value = old; }, 1500);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function() {
        alert(translate('Could not copy automatically. Please use Export CSV instead.'));
      });
    } else {
      alert(translate('Could not copy automatically. Please use Export CSV instead.'));
    }
  }
});

export default CascadeTestingDialog;
