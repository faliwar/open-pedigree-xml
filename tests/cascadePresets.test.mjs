// Model files: settings of a disease exported and imported across pedigrees.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreset, validatePreset, parsePreset, resolvePreset } from '../src/script/model/cascadePresets.js';

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
