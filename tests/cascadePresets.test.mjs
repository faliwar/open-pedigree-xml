// Model files: settings of a disease exported and imported across pedigrees.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPreset, validatePreset, parsePreset, resolvePreset,
  BUILTIN_PRESETS, CATALOG_CATEGORIES, getBuiltInPreset, findMatchingPresets,
  carrierFreqFromPrevalence, maxCredibleAlleleFreq
} from '../src/script/model/cascadePresets.js';

const hboc = buildPreset({
  name: 'HBOC - BRCA1', notes: 'Kuchenbaecker 2017', mode: 'AD', indexGenotype: 'het', carrierFreqN: 400,
  model: { deNovo: 2, penetrance: 70, unrecordedUnaffected: false, conditionParams: {
    Breast__cancer: { penetrance: 72, onsetFrom: 25, onsetTo: 80, phenocopy: 12 },
    Ovarian__cancer: { penetrance: 44, onsetFrom: 35, onsetTo: 80, phenocopy: 1.1 } } },
  conditionIds: ['Breast__cancer', 'Ovarian__cancer'],
  conditionNames: { Breast__cancer: 'Breast cancer', Ovarian__cancer: 'Ovarian cancer' },
  ascertainment: true
});

test('a model stores conditions by name with their own settings', () => {
  assert.deepEqual(validatePreset(hboc), []);
  assert.deepEqual(hboc.conditions.map((c) => c.name), ['Breast cancer', 'Ovarian cancer']);
  assert.equal(hboc.conditions[0].phenocopy, 12);
  assert.equal(hboc.model.unrecordedUnaffected, false);
  assert.equal(hboc.model.conditionParams, undefined);
});

test('a model survives a round trip through a JSON file', () => {
  const r = parsePreset(JSON.stringify(hboc, null, 2));
  assert.deepEqual(r.preset, hboc);
  assert.ok(parsePreset('not json').problems.length);
  assert.ok(parsePreset('{"format":"other"}').problems.length);
});

test('importing a model matches conditions by name in another pedigree', () => {
  const r = resolvePreset(hboc, [{ id: 'd7', name: 'breast  CANCER' }, { id: 'd8', name: 'Prostate cancer' }]);
  assert.deepEqual(r.condition, ['d7']);
  assert.deepEqual(r.unmatched, ['Ovarian cancer']);
  assert.equal(r.model.conditionParams.d7.penetrance, 72);
  assert.equal(r.mode, 'AD');
  assert.equal(r.carrierFreqN, 400);
});

test('alternative names written in a model file are matched', () => {
  const m = Object.assign({}, hboc, { conditions: [{ name: 'Spinocerebellar ataxia type 3', aliases: ['Machado-Joseph disease'] }] });
  const r = resolvePreset(m, [{ id: 'x1', name: 'Machado-Joseph disease' }]);
  assert.deepEqual(r.condition, ['x1']);
  assert.deepEqual(r.unmatched, []);
});

test('without matching conditions the index condition is used automatically', () => {
  assert.equal(resolvePreset(hboc, []).condition, null);
});

test('invalid files are rejected', () => {
  assert.ok(validatePreset({}).length > 0);
  assert.ok(validatePreset({ format: 'open-pedigree-x/cascade-model', name: 'x', mode: 'ZZ' }).length > 0);
  assert.ok(validatePreset(null).length > 0);
});

test('all built-in disease/gene presets are valid cascade models', () => {
  assert.ok(BUILTIN_PRESETS.length >= 40);
  assert.ok(CATALOG_CATEGORIES.length >= 7);
  for (const preset of BUILTIN_PRESETS) {
    assert.deepEqual(validatePreset(preset), [], `Preset ${preset.id} failed validation`);
    assert.equal(getBuiltInPreset(preset.id), preset);
  }
});

test('findMatchingPresets matches genes, variants, and English/Portuguese disorder names', () => {
  // Match by gene in familial variant text
  const m1 = findMatchingPresets({ finding: 'BRCA2 c.5946delT' });
  assert.ok(m1.length > 0);
  assert.equal(m1[0].preset.id, 'brca2');

  // Match by gene list
  const m2 = findMatchingPresets({ genes: ['FGFR3'] });
  assert.ok(m2.length > 0);
  assert.equal(m2[0].preset.id, 'fgfr3');
  assert.equal(m2[0].preset.model.deNovo, 80);

  // Match by Portuguese disorder name (accent-insensitive)
  const m3 = findMatchingPresets({ disorders: [{ id: 'd1', name: 'Síndrome de Marfan' }] });
  assert.ok(m3.length > 0);
  assert.equal(m3[0].preset.id, 'fbn1');
  assert.equal(m3[0].preset.model.deNovo, 25);

  // Match by MONDO code
  const m4 = findMatchingPresets({ disorders: [{ id: 'MONDO:0009061', name: 'CF' }] });
  assert.ok(m4.length > 0);
  assert.equal(m4[0].preset.id, 'cftr');
  assert.equal(m4[0].preset.mode, 'AR');

  // Resolve multi-condition BRCA1 preset against Portuguese disorder names
  const brca1 = getBuiltInPreset('brca1');
  const resolved = resolvePreset(brca1, [{ id: 'c_mama', name: 'Câncer de mama' }]);
  assert.deepEqual(resolved.condition, ['c_mama']);
  assert.equal(resolved.model.penetrance, 72);
  assert.ok(resolved.model.curve.includes('80:72'));
});

test('ACMG v4 / Hardy-Weinberg population carrier frequency and max credible AF calculators', () => {
  // Disease prevalence 1 in 2,500 (e.g. Cystic Fibrosis in Europeans) -> q = 1/50 -> carrier freq ~ 1 in 26
  const nCarrier = carrierFreqFromPrevalence(2500, 100);
  assert.ok(nCarrier >= 25 && nCarrier <= 26);

  // Ultra-rare AR disease 1 in 1,000,000 -> q = 1/1000 -> carrier freq ~ 1 in 500
  const nUltraRare = carrierFreqFromPrevalence(1000000, 100);
  assert.ok(nUltraRare >= 500 && nUltraRare <= 501);

  // Whiffin/Ware max credible AF for AD disorder with prevalence 1 in 10,000, heterogeneity 0.5, penetrance 50%
  const af = maxCredibleAlleleFreq('AD', 10000, 0.5, 50);
  assert.ok(Math.abs(af - 0.00005) < 1e-9);
});

