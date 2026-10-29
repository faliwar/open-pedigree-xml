import { findBloodRelatives, relationshipName, isRealPerson } from 'pedigree/model/kinship';
import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { getLanguage, translate } from 'pedigree/i18n';
import getAge from 'pedigree/view/ageCalc';
import { computeVariantRisks } from 'pedigree/model/inheritance';
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
 * variant, age, life status and existing results. Relatives who are deceased, under the
 * minimum age, of unknown age, unborn or not in contact are not preselected, as in
 * clinical cascade workflows. The selection can be highlighted on the chart and exported.
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
    // disorder used to read phenotypes: null = the index person's condition (automatic),
    // '' = anyone marked affected, otherwise a disorder id
    this._condition = null;
    this._model = {};       // per-mode model settings, see _getModel()
    try {
      var saved = JSON.parse(localStorage.getItem('openpedigree_cascade_v1') || '{}');
      if (INHERITANCE_NAMES[saved.mode]) this._mode = saved.mode;
      if (saved.indexGenotype === 'biallelic') this._indexGenotype = 'biallelic';
      if (saved.carrierFreqN > 1) this._carrierFreqN = saved.carrierFreqN;
      if (saved.model && typeof saved.model === 'object') this._model = saved.model;
    } catch (e) {}
  },

  // population carrier frequency, as "1 in N"; allele frequency q = 1 / (2N)
  _carrierFreqN: 100,

  _saveSettings: function() {
    try {
      localStorage.setItem('openpedigree_cascade_v1', JSON.stringify({
        mode: this._mode, indexGenotype: this._indexGenotype, carrierFreqN: this._carrierFreqN, model: this._model
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
   *   usePhenotypes, unrecordedUnaffected, useTests  which evidence to use
   */
  _getModel: function() {
    var defaults = {
      AD: { deNovo: 10, penetrance: 100, femalePen: 100 },
      AR: { deNovo: 0, penetrance: 100, femalePen: 100 },
      XLR: { deNovo: 33.3, penetrance: 100, femalePen: 0 },
      XLD: { deNovo: 33.3, penetrance: 100, femalePen: 100 },
      MT: { deNovo: 0, penetrance: 100, femalePen: 100 },
      YL: { deNovo: 0, penetrance: 100, femalePen: 0 }
    }[this._mode];
    var m = this._model[this._mode] || {};
    var pick = function(key, def) { return (typeof m[key] === 'number' && isFinite(m[key])) ? m[key] : def; };
    var flag = function(key) { return m[key] !== false; };
    return {
      deNovo: pick('deNovo', defaults.deNovo),
      penetrance: pick('penetrance', defaults.penetrance),
      femalePen: pick('femalePen', defaults.femalePen),
      onsetFrom: pick('onsetFrom', 0),
      onsetTo: pick('onsetTo', 0),
      usePhenotypes: flag('usePhenotypes'),
      unrecordedUnaffected: flag('unrecordedUnaffected'),
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
  // The condition actually used: the user's choice, or else the index person's first disorder
  _resolvedCondition: function() {
    if (this._condition !== null && this._condition !== undefined) {
      return this._condition;
    }
    var node = this._indexId !== null ? editor.getNode(this._indexId) : null;
    var ds = ((node && node.getDisorders && node.getDisorders()) || []).filter(function(d) { return d !== 'affected'; });
    return ds.length ? ds[0] : '';
  },

  _buildEvidence: function(model) {
    var graph = editor.getGraph();
    var mode = this._mode;
    var biallelic = this._isBiallelic();
    var condition = this._resolvedCondition();
    var PHENOCOPY = 0.001;   // affected without the familial variant
    var TEST_ERROR = 0.0001;
    var pen = model.penetrance / 100;
    var femalePen = model.femalePen / 100;
    var from = model.onsetFrom, to = model.onsetTo;
    var congenital = !(to > 0) && !(from > 0);
    var counts = { affected: 0, unaffected: 0, tested: 0 };
    var likelihood = {};

    // chance that a person with this state becomes affected (lifetime)
    var penetranceOf = function(state, sex) {
      if (mode === 'AR' && !biallelic) return null; // one familial copy tracked: not informative
      if (state === 0) return 0;
      switch (mode) {
        case 'AD':
        case 'MT':
          return pen;
        case 'AR':
          return state === 3 ? pen : 0;
        case 'XLR':
        case 'XLD':
          return sex === 'M' ? pen : (sex === 'F' ? femalePen : (pen + femalePen) / 2);
        case 'YL':
          return sex === 'F' ? 0 : pen;
      }
      return 0;
    };
    // share of the eventual cases already affected at this age
    var ageFraction = function(age) {
      if (congenital) return 1;
      if (age === null) return null;
      if (to <= from) return age >= from ? 1 : 0;
      return Math.max(0, Math.min(1, (age - from) / (to - from)));
    };

    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      if (!isRealPerson(graph, id) || id === this._indexId) continue;
      var node = editor.getNode(id);
      if (!node) continue;
      var info = this._getPersonInfo(id);
      var L = [1, 1, 1, 1];
      var used = false;

      if (model.usePhenotypes && ['alive', 'deceased'].indexOf(info.lifeStatus) !== -1) {
        var disorders = (node.getDisorders && node.getDisorders()) || [];
        var affected = condition ? disorders.indexOf(condition) !== -1 : node.getCarrierStatus() === 'affected';
        var frac = ageFraction(info.ageYears);
        if (affected || (model.unrecordedUnaffected && frac !== null)) {
          var informative = false;
          for (var s = 0; s < 4; s++) {
            var p = penetranceOf(s, info.sex);
            if (p === null) continue;
            informative = true;
            var pAff = affected ? p : p * frac;
            L[s] *= affected ? (pAff + (1 - pAff) * PHENOCOPY) : (1 - pAff) * (1 - PHENOCOPY);
          }
          if (informative) {
            used = true;
            counts[affected ? 'affected' : 'unaffected']++;
          }
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
    this._evidenceCounts = counts;
    return likelihood;
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
    var info = { name: '', sex: 'U', lifeStatus: 'alive', ageText: '', ageYears: null, lostContact: false, findings: [], tested: false };
    if (!node) {
      return info;
    }
    info.name = (node.getName && node.getName()) || '';
    info.sex = (node.getGender && node.getGender()) || 'U';
    info.lifeStatus = (node.getLifeStatus && node.getLifeStatus()) || 'alive';
    info.lostContact = !!(node.getLostContact && node.getLostContact());

    var birth = node.getBirthDate && node.getBirthDate();
    var death = node.getDeathDate && node.getDeathDate();
    if (birth && birth.getTime) {
      var end = (death && death.getTime) ? death : new Date();
      info.ageYears = (end.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
      info.ageText = getAge(birth, (death && death.getTime) ? death : null);
      if (getLanguage() === 'pt-BR') {
        info.ageText = info.ageText.replace(/(\d) y$/, '$1 anos').replace(/(\d) mo$/, '$1 meses')
          .replace(/(\d) wk$/, '$1 sem').replace(/(\d) days?$/, function(m, d) { return d + (/days$/.test(m) ? ' dias' : ' dia'); })
          .replace('not born yet', 'não nascido');
      }
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
      .map(function(t) { return t.gene; });
    var finding = (this._finding || '').toUpperCase();
    var named = genes.filter(function(g) { return finding.indexOf(g) !== -1; });
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
   * Reason why a relative is not preselected for approach, or '' when they should be.
   */
  _getExclusionReason: function(info) {
    if (info.tested) return translate('Already tested');
    if (info.declined) return translate('Declined testing');
    if (info.lifeStatus === 'unborn') return translate('Unborn');
    if (info.lifeStatus !== 'alive') return translate('Deceased');
    if (info.lostContact) return translate('Not in contact');
    if (info.ageYears === null) return translate('Unknown age');
    if (info.ageYears < this._minAge) return translate('Under minimum age');
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
    var risks = computeVariantRisks(graph, this._indexId, this._mode, this._indexGenotype, 1 / (2 * this._carrierFreqN), {
      deNovo: model.deNovo / 100,
      likelihood: Object.keys(evidence).length ? evidence : null
    });
    this._warning = risks.warning ? translate(risks.warning) : '';
    this._ibd = risks.ibd;
    this._deNovoIndex = risks.deNovoIndex;
    var biallelic = this._isBiallelic();
    var rows = [];
    this._notAtRisk = 0;

    findBloodRelatives(graph, this._indexId, this._maxDegree).forEach(function(k) {
      var p = risks.probs[k.id] || [1, 0, 0, 0];
      var any = p[1] + p[2] + p[3];
      var info = _this._getPersonInfo(k.id);
      if (any < MIN_RISK && !info.tested) {
        // blood relative who cannot carry the variant under this mode (e.g. sons of a man for
        // X-linked) or whose risk the evidence ruled out; tested relatives stay listed
        _this._notAtRisk++;
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
        meaning: biallelic ? translate('Carrier if one variant, affected if both') : _this._meaningIfPositive(info.sex),
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
      'Blood relatives of the index person who may share the familial variant. Relatives who are deceased, unborn, not in contact, of unknown age or under the minimum age are not preselected.',
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
      ['Relatives younger than this are listed but not preselected.']));
    controls.insert(field('Familial variant', findingInput, 'cascade-field-wide',
      ['Optional. Printed in the list and the CSV. When the index has positive tests in several genes, naming the gene here selects which one is the familial variant.']));
    content.insert(controls);

    // --- model: de novo, penetrance, evidence
    var modelBox = new Element('details', { 'class': 'cascade-model' });
    var modelSummary = new Element('span', { 'class': 'cascade-model-summary' });
    modelBox.insert(new Element('summary').insert(new Element('span', { 'class': 'cascade-model-title' }).update(translate('Model and evidence'))).insert(modelSummary));
    var modelGrid = new Element('div', { 'class': 'cascade-controls cascade-model-grid' });
    modelBox.insert(modelGrid);

    var conditionSelect = new Element('select', { 'class': 'cascade-select', 'id': 'cascade-condition' });
    var refreshConditions = function() {
      var current = _this._resolvedCondition();
      conditionSelect.update('');
      var anyOpt = new Element('option', { 'value': '' }).update(translate('Anyone marked as affected'));
      conditionSelect.insert(anyOpt);
      _this._pedigreeDisorders().forEach(function(d) {
        var opt = new Element('option', { 'value': d.id }).update(d.name.escapeHTML());
        if (d.id === current) opt.selected = true;
        conditionSelect.insert(opt);
      });
      if (!current) anyOpt.selected = true;
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
      ['Relatives with this condition count as affected, the others as unaffected (when that option is on). By default, the condition of the index person.']);
    var deNovoField = field('De novo (% of carriers)', deNovoInput, 'cascade-field-narrow',
      ['Share of carriers whose variant is new, so the parents do not carry it.',
        'De novo examples: about 1/3 of isolated males for lethal X-linked conditions (Haldane); about 50% in NF1; about 80% in achondroplasia; rare in late-onset cancer syndromes.']);
    var penLabel = new Element('span', { 'class': 'cascade-field-label' });
    var penField = new Element('label', { 'class': 'cascade-field cascade-field-narrow' }).insert(penLabel).insert(penInput);
    var femalePenField = field('Penetrance in heterozygous females (%)', femalePenInput, 'cascade-field-narrow');
    var onsetField = field('Age at onset', onsetWrap, 'cascade-field-onset',
      ['Age range in which carriers who become affected show signs. 0 to 0 means at birth (congenital). Unaffected relatives younger than the range are less informative.']);
    [conditionField, deNovoField, penField, femalePenField, onsetField].forEach(function(f) { modelGrid.insert(f); });

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
    modelBox.insert(checks);
    content.insert(modelBox);

    var syncModelFields = function() {
      var m = _this._getModel();
      var biallelic = _this._isBiallelic();
      var xl = _this._mode === 'XLR' || _this._mode === 'XLD';
      deNovoInput.value = m.deNovo;
      penInput.value = m.penetrance;
      femalePenInput.value = m.femalePen;
      onsetFromInput.value = m.onsetFrom;
      onsetToInput.value = m.onsetTo;
      usePhenoCb.checked = m.usePhenotypes;
      unrecordedCb.checked = m.unrecordedUnaffected;
      useTestsCb.checked = m.useTests;
      unrecordedCb.disabled = !m.usePhenotypes;
      penLabel.update(translate(biallelic ? 'Penetrance in biallelic individuals (%)' : (xl ? 'Penetrance in hemizygous males (%)' : 'Penetrance in carriers (%)')));
      deNovoField.setStyle({ display: _this._mode === 'AR' ? 'none' : '' });
      femalePenField.setStyle({ display: xl ? '' : 'none' });
      // one familial copy in a recessive condition says nothing about phenotypes
      var phenoUseful = !(_this._mode === 'AR' && !biallelic);
      [conditionField, penField, onsetField].forEach(function(f) { f.setStyle({ display: phenoUseful ? '' : 'none' }); });
      usePhenoCb.up('label').setStyle({ display: phenoUseful ? '' : 'none' });
      unrecordedCb.up('label').setStyle({ display: phenoUseful ? '' : 'none' });
    };
    syncModelFields();

    var bindNumber = function(input, key, min, max) {
      input.observe('change', function() {
        var v = parseFloat(input.value);
        if (isNaN(v)) v = _this._getModel()[key];
        v = Math.max(min, Math.min(max, v));
        input.value = v;
        _this._setModel(key, v);
        recompute(false);
      });
    };
    bindNumber(deNovoInput, 'deNovo', 0, 100);
    bindNumber(penInput, 'penetrance', 0, 100);
    bindNumber(femalePenInput, 'femalePen', 0, 100);
    bindNumber(onsetFromInput, 'onsetFrom', 0, 120);
    bindNumber(onsetToInput, 'onsetTo', 0, 120);
    conditionSelect.observe('change', function() {
      _this._condition = conditionSelect.value;
      recompute(false);
    });

    // --- summary and table
    var warningBox = new Element('div', { 'class': 'cascade-warning', 'role': 'alert' });
    content.insert(warningBox);
    var summary = new Element('div', { 'class': 'cascade-summary' });
    content.insert(summary);
    var tableWrap = new Element('div', { 'class': 'cascade-table-wrap' });
    content.insert(tableWrap);

    var renderTable = function() {
      var rows = _this._rows;
      var selectedCount = rows.filter(function(r) { return r.selected; }).length;
      var testedCount = rows.filter(function(r) { return r.tested; }).length;
      var biallelic = _this._isBiallelic();
      warningBox.update(_this._warning ? _this._warning.escapeHTML() : '');
      warningBox.setStyle({ display: _this._warning ? '' : 'none' });

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
      // one-line summary of the model, visible while the model box is closed
      var ec = _this._evidenceCounts || {};
      var m = _this._getModel();
      var parts = [];
      if (_this._mode !== 'AR') parts.push(translate('de novo') + ' ' + m.deNovo + '%');
      if (!(_this._mode === 'AR' && !biallelic)) parts.push(translate('penetrance') + ' ' + m.penetrance + '%');
      parts.push((ec.affected || 0) + ' ' + translate('affected') + ', ' + (ec.unaffected || 0) + ' ' + translate('unaffected') + ', ' + (ec.tested || 0) + ' ' + translate('tested'));
      modelSummary.update(parts.join(' · ').escapeHTML());

      chips.forEach(function(s) {
        summary.insert(new Element('span', { 'class': 'cascade-chip' })
          .insert(new Element('strong').update(String(s[0])))
          .insert(' ' + translate(s[1])));
      });

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

        var degreeBadge = new Element('span', { 'class': 'cascade-degree' }).setStyle({ borderColor: DEGREE_COLORS[row.degree] || '#94A3B8' }).update(String(row.degree) + 'º');

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
      recompute(true);
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
    minAgeInput.observe('change', function() {
      var v = parseInt(minAgeInput.value, 10);
      _this._minAge = isNaN(v) ? 18 : Math.max(0, v);
      recompute(false);
    });
    findingInput.observe('input', function() {
      _this._finding = findingInput.value;
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
    if (!this._rows.length && this._indexId === null) {
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
    var m = this._getModel();
    if (this._mode !== 'AR') {
      lines.push([translate('De novo (% of carriers)'), m.deNovo + '%']);
    }
    if (!(this._mode === 'AR' && !this._isBiallelic())) {
      lines.push([translate('Penetrance'), m.penetrance + '%' + ((this._mode === 'XLR' || this._mode === 'XLD') ? ' / ' + m.femalePen + '% ' + translate('in heterozygous females') : '')]);
      lines.push([translate('Age at onset'), m.onsetFrom + '–' + m.onsetTo]);
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
