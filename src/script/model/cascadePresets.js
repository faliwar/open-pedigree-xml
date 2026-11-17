/**
 * Cascade-risk model files: the mode of inheritance and model settings for a disease, exported
 * to and imported from a JSON file to reuse them across pedigrees (for example several families
 * with Fabry disease), or chosen from the built-in clinical genetics catalog. Everything stays on
 * the client.
 *
 * Conditions are stored by name, with optional alternative names, because each pedigree gives
 * its disorders its own ids; when a model is applied, its conditions are matched by name
 * (ignoring case and spacing) with the disorders of the current pedigree.
 */

import { CATALOG_CATEGORIES, RAW_PRESETS } from 'pedigree/model/diseaseCatalog';

var FORMAT = 'open-pedigree-x/cascade-model';
var VERSION = 1;
var MODES = ['AD', 'AR', 'XLR', 'XLD', 'MT', 'YL'];
var MODEL_KEYS = ['deNovo', 'penetrance', 'femalePen', 'onsetFrom', 'onsetTo', 'curve', 'phenocopy',
  'mutationRatio', 'usePhenotypes', 'unrecordedUnaffected', 'useTests'];
var CONDITION_KEYS = ['penetrance', 'femalePen', 'onsetFrom', 'onsetTo', 'curve', 'phenocopy'];

var normalizeName = function(name) {
  return String(name || '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
};

var stripAccents = function(text) {
  var s = normalizeName(text);
  return typeof s.normalize === 'function' ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
};

var pickKeys = function(source, keys) {
  var out = {};
  keys.forEach(function(k) {
    if (source && source.hasOwnProperty(k) && source[k] !== undefined && source[k] !== null) out[k] = source[k];
  });
  return out;
};

/**
 * @param {Object} s { name, notes, mode, indexGenotype, carrierFreqN, model, conditionIds,
 *   conditionNames: {id: name}, ascertainment }
 * @return {Object} preset
 */
var buildPreset = function(s) {
  var model = s.model || {};
  var params = model.conditionParams || {};
  return {
    format: FORMAT,
    version: VERSION,
    name: String(s.name || '').trim(),
    notes: String(s.notes || '').trim(),
    created: new Date().toISOString(),
    mode: s.mode,
    indexGenotype: s.indexGenotype === 'biallelic' ? 'biallelic' : 'het',
    carrierFreqN: s.carrierFreqN,
    model: pickKeys(model, MODEL_KEYS),
    conditions: (s.conditionIds || []).map(function(id) {
      return Object.assign({ name: (s.conditionNames && s.conditionNames[id]) || String(id) }, pickKeys(params[id], CONDITION_KEYS));
    }),
    ascertainment: s.ascertainment !== false
  };
};

/**
 * Checks a model read from a file. @return {Array} problems (empty when valid)
 */
var validatePreset = function(p) {
  var problems = [];
  if (!p || typeof p !== 'object') return ['not a model'];
  if (p.format !== FORMAT) problems.push('not an OPX model');
  if (!p.name) problems.push('missing name');
  if (MODES.indexOf(p.mode) === -1) problems.push('unknown mode of inheritance');
  if (p.model && typeof p.model !== 'object') problems.push('invalid model settings');
  if (p.conditions && !Array.isArray(p.conditions)) problems.push('invalid conditions');
  return problems;
};

/** Parses JSON text into a model. @return {Object} { preset } or { problems } */
var parsePreset = function(text) {
  var p = null;
  try {
    p = JSON.parse(String(text || '').trim());
  } catch (e) {
    return { problems: ['not valid JSON'] };
  }
  var problems = validatePreset(p);
  return problems.length ? { problems: problems } : { preset: p };
};

/**
 * Applies a model to the disorders of the current pedigree.
 * @param {Object} p model
 * @param {Array} disorders [{ id, name }] of the current pedigree
 * @return {Object} { mode, indexGenotype, carrierFreqN, model (with conditionParams by id),
 *   condition (null = automatic, or list of ids), ascertainment, unmatched: [names] }
 */
var resolvePreset = function(p, disorders) {
  var list = disorders || [];
  var byName = {};
  var byStripped = {};
  list.forEach(function(d) {
    byName[normalizeName(d.name)] = d.id;
    byName[normalizeName(d.id)] = d.id;
    byStripped[stripAccents(d.name)] = d.id;
    byStripped[stripAccents(d.id)] = d.id;
  });
  var matched = [];
  var unmatched = [];
  var conditionParams = {};
  (p.conditions || []).forEach(function(c) {
    var names = [c.name].concat(Array.isArray(c.aliases) ? c.aliases : []);
    var id;
    for (var i = 0; i < names.length && id === undefined; i++) {
      id = byName[normalizeName(names[i])];
      if (id === undefined) id = byStripped[stripAccents(names[i])];
    }
    // Second pass: match pedigree disorder names that contain a specific condition name/alias
    // (for example "Breast cancer, right" or "Câncer de mama bilateral" matching "Breast cancer")
    if (id === undefined) {
      for (var j = 0; j < names.length && id === undefined; j++) {
        var needle = stripAccents(names[j]);
        if (needle.length < 5) continue;
        for (var k = 0; k < list.length; k++) {
          var hay = stripAccents(list[k].name);
          if (hay.indexOf(needle) !== -1) {
            id = list[k].id;
            break;
          }
        }
      }
    }
    if (id === undefined) {
      unmatched.push(c.name);
      return;
    }
    if (matched.indexOf(id) === -1) matched.push(id);
    var own = pickKeys(c, CONDITION_KEYS);
    if (Object.keys(own).length) conditionParams[id] = own;
  });
  var model = pickKeys(p.model || {}, MODEL_KEYS);
  // When only one condition of a multi-condition preset is present in the pedigree (e.g. only
  // Ovarian cancer in a BRCA1 family), copy its specific parameters into the single-condition
  // model fields so the single-condition UI and risk engine use them directly.
  if (matched.length === 1 && conditionParams[matched[0]]) {
    var single = conditionParams[matched[0]];
    CONDITION_KEYS.forEach(function(key) {
      if (single.hasOwnProperty(key)) model[key] = single[key];
    });
    if (single.curve && !single.hasOwnProperty('penetrance')) {
      // curve defines lifetime penetrance
    } else if (!single.curve && model.curve && (single.hasOwnProperty('onsetFrom') || single.hasOwnProperty('onsetTo'))) {
      delete model.curve;
    }
  }
  model.conditionParams = conditionParams;
  return {
    mode: p.mode,
    indexGenotype: p.indexGenotype === 'biallelic' ? 'biallelic' : 'het',
    carrierFreqN: (typeof p.carrierFreqN === 'number' && p.carrierFreqN > 1) ? p.carrierFreqN : 100,
    model: model,
    condition: matched.length ? matched : null,
    ascertainment: p.ascertainment !== false,
    unmatched: unmatched
  };
};

// -------------------------------------------------------------------------------------------
// Built-in disease & gene catalog and ACMG v4 / ClinGen helpers

var BUILTIN_PRESETS = RAW_PRESETS.map(function(raw) {
  return {
    id: raw.id,
    category: raw.category,
    format: FORMAT,
    version: VERSION,
    name: raw.name,
    notes: raw.notes || '',
    genes: (raw.genes || []).map(function(g) { return String(g).toUpperCase(); }),
    mondo: (raw.mondo || []).map(function(m) { return String(m).toUpperCase(); }),
    mode: raw.mode,
    indexGenotype: raw.indexGenotype === 'biallelic' ? 'biallelic' : 'het',
    carrierFreqN: raw.carrierFreqN || 100,
    model: pickKeys(raw.model || {}, MODEL_KEYS),
    conditions: (raw.conditions || []).map(function(c) {
      var out = Object.assign({ name: c.name }, pickKeys(c, CONDITION_KEYS));
      if (Array.isArray(c.aliases)) out.aliases = c.aliases.slice();
      return out;
    }),
    ascertainment: raw.ascertainment !== false
  };
});

/**
 * Looks up a built-in preset by its id, name or gene symbol.
 * @param {String} idOrName
 * @return {Object|null}
 */
var getBuiltInPreset = function(idOrName) {
  if (!idOrName) return null;
  var q = normalizeName(idOrName);
  var upper = String(idOrName).trim().toUpperCase();
  for (var i = 0; i < BUILTIN_PRESETS.length; i++) {
    var p = BUILTIN_PRESETS[i];
    if (p.id === q || normalizeName(p.name) === q) return p;
  }
  for (var j = 0; j < BUILTIN_PRESETS.length; j++) {
    if (BUILTIN_PRESETS[j].genes.indexOf(upper) !== -1) return BUILTIN_PRESETS[j];
  }
  return null;
};

var extractMondo = function(text) {
  var m = /MONDO(?:_C_|__|[_:\s])+(\d{7})/i.exec(String(text || ''));
  return m ? 'MONDO:' + m[1] : null;
};

/**
 * Finds built-in presets that match the genes, familial variant text or disorders of a pedigree.
 *
 * @param {Object} context {
 *   genes: [String],           // positive genes in the index person or pedigree
 *   finding: String,           // free-text familial variant / condition field
 *   disorders: [{ id, name }]  // disorders recorded in the pedigree (index person's first)
 * }
 * @return {Array} [{ preset, score, matchedBy }] best match first
 */
var findMatchingPresets = function(context) {
  context = context || {};
  var genes = (context.genes || []).map(function(g) { return String(g || '').trim().toUpperCase(); }).filter(Boolean);
  var findingWords = String(context.finding || '').toUpperCase().split(/[^A-Z0-9-]+/).filter(Boolean);
  var disorders = context.disorders || [];
  var mondoCodes = [];
  var disorderStrings = [];
  disorders.forEach(function(d) {
    if (!d) return;
    var m1 = extractMondo(d.id), m2 = extractMondo(d.name);
    if (m1 && mondoCodes.indexOf(m1) === -1) mondoCodes.push(m1);
    if (m2 && mondoCodes.indexOf(m2) === -1) mondoCodes.push(m2);
    if (d.name) disorderStrings.push(stripAccents(d.name));
    if (d.id && !m1) disorderStrings.push(stripAccents(d.id));
  });
  if (context.finding) disorderStrings.push(stripAccents(context.finding));

  var matches = [];
  BUILTIN_PRESETS.forEach(function(preset) {
    var score = 0;
    var matchedBy = '';

    // 1. Direct gene match on index's genetic tests (highest confidence)
    for (var i = 0; i < preset.genes.length; i++) {
      var g = preset.genes[i];
      if (genes.indexOf(g) !== -1) {
        score = 100;
        matchedBy = g;
        break;
      }
      if (findingWords.indexOf(g) !== -1 && score < 95) {
        score = 95;
        matchedBy = g;
      }
    }

    // 2. MONDO ontology code match on a specific syndrome (single-syndrome presets rank above
    // broad multi-cancer presets that share a general cancer MONDO code)
    if (score < 90 && mondoCodes.length) {
      for (var m = 0; m < preset.mondo.length; m++) {
        if (mondoCodes.indexOf(preset.mondo[m]) !== -1) {
          var s = preset.conditions.length <= 1 ? 88 : 70;
          if (s > score) {
            score = s;
            matchedBy = preset.mondo[m];
          }
        }
      }
    }

    // 3. Condition name / alias match against pedigree disorders
    if (score < 85 && disorderStrings.length) {
      (preset.conditions || []).forEach(function(c) {
        var names = [c.name].concat(Array.isArray(c.aliases) ? c.aliases : []);
        for (var n = 0; n < names.length; n++) {
          if (extractMondo(names[n])) continue;
          var alias = stripAccents(names[n]);
          if (alias.length < 3) continue;
          for (var d = 0; d < disorderStrings.length; d++) {
            var ds = disorderStrings[d];
            if (ds === alias) {
              // Exact condition name match: specific single-syndrome presets score higher than
              // shared cancer phenotypes (e.g. "Breast cancer" across BRCA1/BRCA2/PALB2)
              var exactScore = preset.conditions.length <= 1 ? 85 : 65;
              if (exactScore > score) {
                score = exactScore;
                matchedBy = c.name;
              }
            } else if (alias.length >= 5 && ds.indexOf(alias) !== -1) {
              var subScore = preset.conditions.length <= 1 ? 78 : 60;
              if (subScore > score) {
                score = subScore;
                matchedBy = c.name;
              }
            }
          }
        }
      });
    }

    if (score > 0) {
      matches.push({ preset: preset, score: score, matchedBy: matchedBy });
    }
  });

  matches.sort(function(a, b) { return b.score - a.score; });
  return matches;
};

/**
 * Calculates the population carrier frequency ("1 in N") of an autosomal recessive condition
 * from its disease prevalence ("1 in prevalenceDenom") and penetrance (%), using Hardy-Weinberg
 * equilibrium: P = q^2 * penetrance => q = sqrt(1 / (prevalenceDenom * pen)), carrier = 2q(1 - q).
 *
 * @param {Number} prevalenceDenom e.g. 10000 for 1 in 10,000
 * @param {Number} [penetrancePct=100] penetrance in biallelic individuals (%)
 * @return {Number} N such that carrier frequency is "1 in N" (at least 2)
 */
var carrierFreqFromPrevalence = function(prevalenceDenom, penetrancePct) {
  var d = Number(prevalenceDenom);
  var pen = (typeof penetrancePct === 'number' && penetrancePct > 0) ? Math.min(100, penetrancePct) / 100 : 1;
  if (!(d > 1)) return 100;
  var q = Math.sqrt(1 / (d * pen));
  if (q >= 0.5) return 2;
  var carrierFreq = 2 * q * (1 - q);
  return Math.max(2, Math.round(1 / carrierFreq));
};

/**
 * Whiffin / Ware (2017) & ClinGen SVI / ACMG v4 Maximum Credible Population Allele Frequency
 * (DAFT) for a condition, given its mode of inheritance, disease prevalence ("1 in D"),
 * genetic * allelic heterogeneity (0-1) and penetrance (%).
 *
 *   AD / XLD / XLR / MT:  AF_max = (prevalence * heterogeneity) / (2 * penetrance)  [or / penetrance per chromosome]
 *   AR:                   AF_max = sqrt(prevalence) * heterogeneity / sqrt(penetrance)
 *
 * Following Whiffin et al. (2017) and ClinGen CSpec:
 *   AD: (1 / prevalenceDenom) * heterogeneity / (2 * pen)
 *   AR: sqrt(1 / prevalenceDenom) * heterogeneity / sqrt(pen)
 *
 * @param {String} mode 'AD' | 'AR' | 'XLR' | 'XLD' | 'MT' | 'YL'
 * @param {Number} prevalenceDenom e.g. 50000 for 1 in 50,000
 * @param {Number} [heterogeneity=1] maximum allelic/genetic contribution (0 < h <= 1)
 * @param {Number} [penetrancePct=100] penetrance (%)
 * @return {Number} maximum credible population allele frequency (0 to 1)
 */
var maxCredibleAlleleFreq = function(mode, prevalenceDenom, heterogeneity, penetrancePct) {
  var d = Number(prevalenceDenom);
  if (!(d > 0)) return 0;
  var prev = 1 / d;
  var h = (typeof heterogeneity === 'number' && heterogeneity > 0 && heterogeneity <= 1) ? heterogeneity : 1;
  var pen = (typeof penetrancePct === 'number' && penetrancePct > 0) ? Math.min(100, penetrancePct) / 100 : 1;
  if (mode === 'AR') {
    return Math.min(1, (Math.sqrt(prev) * h) / Math.sqrt(pen));
  }
  return Math.min(1, (prev * h) / (2 * pen));
};

export {
  FORMAT,
  CATALOG_CATEGORIES,
  BUILTIN_PRESETS,
  buildPreset,
  validatePreset,
  parsePreset,
  resolvePreset,
  getBuiltInPreset,
  findMatchingPresets,
  carrierFreqFromPrevalence,
  maxCredibleAlleleFreq
};
