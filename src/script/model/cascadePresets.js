/**
 * Cascade-risk model files: the mode of inheritance and model settings for a disease, exported
 * to and imported from a JSON file to reuse them across pedigrees (for example several families
 * with Fabry disease). Everything stays on the client.
 *
 * Conditions are stored by name, with optional alternative names, because each pedigree gives
 * its disorders its own ids; when a model is applied, its conditions are matched by name
 * (ignoring case and spacing) with the disorders of the current pedigree.
 */

var FORMAT = 'open-pedigree-x/cascade-model';
var VERSION = 1;
var MODES = ['AD', 'AR', 'XLR', 'XLD', 'MT', 'YL'];
var MODEL_KEYS = ['deNovo', 'penetrance', 'femalePen', 'onsetFrom', 'onsetTo', 'curve', 'phenocopy',
  'mutationRatio', 'usePhenotypes', 'unrecordedUnaffected', 'useTests'];
var CONDITION_KEYS = ['penetrance', 'femalePen', 'onsetFrom', 'onsetTo', 'curve', 'phenocopy'];

var normalizeName = function(name) {
  return String(name || '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
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
  if (p.format !== FORMAT) problems.push('not an Open Pedigree X model');
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
  var byName = {};
  (disorders || []).forEach(function(d) { byName[normalizeName(d.name)] = d.id; byName[normalizeName(d.id)] = d.id; });
  var matched = [];
  var unmatched = [];
  var conditionParams = {};
  (p.conditions || []).forEach(function(c) {
    var names = [c.name].concat(Array.isArray(c.aliases) ? c.aliases : []);
    var id;
    for (var i = 0; i < names.length && id === undefined; i++) id = byName[normalizeName(names[i])];
    if (id === undefined) {
      unmatched.push(c.name);
      return;
    }
    if (matched.indexOf(id) === -1) matched.push(id);
    var own = pickKeys(c, CONDITION_KEYS);
    if (Object.keys(own).length) conditionParams[id] = own;
  });
  var model = pickKeys(p.model || {}, MODEL_KEYS);
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

export { FORMAT, buildPreset, validatePreset, parsePreset, resolvePreset };
