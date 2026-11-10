// Cascade carrier probabilities against textbook (analytical) values.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGraph, P, lik, carrier, close, TEST_ERROR } from './helpers.mjs';
import { computeVariantRisks } from '../src/script/model/inheritance.js';

// grandparents 1, 2; mother 3 and aunt 4; father 5; aunt's husband 6; index 7, sister 8, cousin 9
const D = makeGraph({ 1: P('M'), 2: P('F'), 3: P('F', 1, 2), 4: P('F', 1, 2), 5: P('M'), 6: P('M'), 7: P('F', 5, 3), 8: P('F', 5, 3), 9: P('F', 6, 4) });

test('autosomal dominant, no evidence', () => {
  let r = computeVariantRisks(D, 7, 'AD', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(r, 3), 1 / 2, 1e-15, 'parent:');
  close(assert, carrier(r, 8), 1 / 2, 1e-15, 'sibling:');
  close(assert, carrier(r, 1), 1 / 4, 1e-15, 'grandparent:');
  close(assert, carrier(r, 4), 1 / 4, 1e-15, 'aunt:');
  close(assert, carrier(r, 9), 1 / 8, 1e-15, 'first cousin:');
  r = computeVariantRisks(D, 7, 'AD', 'het', 0.005, { deNovo: 0.1 });
  close(assert, carrier(r, 3), 0.45, 1e-15, 'parent with 10% de novo:');
  assert.deepEqual(r.approximate, { truncated: false, depthLimited: false, loop: false, exact: false });
});

test('autosomal dominant, negative test in an aunt', () => {
  const r = computeVariantRisks(D, 7, 'AD', 'het', 0.005, { deNovo: 0, likelihood: { 4: lik({ mode: 'AD', test: '-' }) } });
  // paternal lines (1/2): aunt is a certain non-carrier; maternal lines (1/2): aunt carries w.p. 1/2
  const lAunt = 0.5 * TEST_ERROR + 0.5 * (1 - TEST_ERROR);
  const Z = 0.5 * (1 - TEST_ERROR) + 0.5 * lAunt;
  close(assert, carrier(r, 3), 0.5 * lAunt / Z, 1e-15, 'mother:');
  close(assert, carrier(r, 9), 0.5 * 0.5 * TEST_ERROR * 0.5 / Z, 1e-15, 'cousin:');
  close(assert, carrier(r, 8), 1 / 2, 1e-15, 'sibling:');
});

// maternal grandparents 1, 2; mother 3; father 4; index 5 (affected male); sister 6; brothers 7, 8
const X = makeGraph({ 1: P('M'), 2: P('F'), 3: P('F', 1, 2), 4: P('M'), 5: P('M', 4, 3), 6: P('F', 4, 3), 7: P('M', 4, 3), 8: P('M', 4, 3) });

test('X-linked recessive, isolated case with Haldane d = 1/3', () => {
  const r = computeVariantRisks(X, 5, 'XLR', 'het', 0.005, { deNovo: 1 / 3 });
  close(assert, carrier(r, 3), 2 / 3, 1e-15, 'mother:');
  close(assert, carrier(r, 2), 1 / 3, 1e-15, 'maternal grandmother:');
  close(assert, carrier(r, 6), 1 / 3, 1e-15, 'sister:');
  close(assert, carrier(r, 4), 0, 1e-15, 'father:');
});

test('X-linked recessive, two unaffected brothers (Bayesian update)', () => {
  const u = lik({ mode: 'XLR', sex: 'M', unaffected: true });
  const r = computeVariantRisks(X, 5, 'XLR', 'het', 0.005, { deNovo: 1 / 3, likelihood: { 7: u, 8: u } });
  close(assert, carrier(r, 3), 1 / 3, 1e-15, 'mother:');
  close(assert, carrier(r, 2), 1 / 6, 1e-15, 'maternal grandmother:');
  close(assert, carrier(r, 6), 1 / 6, 1e-15, 'sister:');
});

test('X-linked, male/female mutation rate ratio k', () => {
  // k = 1 reproduces the equal-rates result
  let r = computeVariantRisks(X, 5, 'XLR', 'het', 0.005, { deNovo: 1 / 3, mutationRatio: 1 });
  close(assert, carrier(r, 2), 1 / 3, 1e-15, 'k = 1, grandmother:');
  // lethal disorder with k = 10: d = 1 / (2 + k) = 1/12; female de novo share capped at 1/2
  r = computeVariantRisks(X, 5, 'XLR', 'het', 0.005, { deNovo: 1 / 12, mutationRatio: 10 });
  close(assert, carrier(r, 3), 11 / 12, 1e-15, 'k = 10, mother:');
  close(assert, carrier(r, 2), 11 / 24, 1e-15, 'k = 10, grandmother:');
  // non-lethal: k = 3, d = 0.1 -> female de novo share (1 + k) d / (2 (1 - d)) = 2/9
  r = computeVariantRisks(X, 5, 'XLR', 'het', 0.005, { deNovo: 0.1, mutationRatio: 3 });
  // mother carries w.p. 0.9; she got it from her mother w.p. 1/2, from her father w.p. 1/2 - 2/9
  close(assert, carrier(r, 2), 0.9 * 0.5, 1e-15, 'k = 3, grandmother:');
  close(assert, carrier(r, 1), 0.9 * (0.5 - 2 / 9), 1e-15, 'k = 3, grandfather:');
});

test('autosomal recessive, biallelic index and unaffected sibling', () => {
  const R = makeGraph({ 1: P('M'), 2: P('F'), 3: P('F', 1, 2), 4: P('M', 1, 2) });
  const r = computeVariantRisks(R, 3, 'AR', 'biallelic', 0.005, { likelihood: { 4: lik({ mode: 'AR', sex: 'M', unaffected: true, biallelic: true }) } });
  close(assert, carrier(r, 1), 1, 1e-15, 'parents:');
  close(assert, carrier(r, 4), 2 / 3, 1e-15, 'unaffected sibling:');
});

test('mitochondrial and Y-linked transmission', () => {
  const M = makeGraph({ 1: P('M'), 2: P('F'), 3: P('F', 1, 2), 4: P('M', 1, 2), 5: P('F', 1, 2) });
  let r = computeVariantRisks(M, 3, 'MT', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(r, 2), 1, 1e-15, 'MT mother:');
  close(assert, carrier(r, 4), 1, 1e-15, 'MT brother:');
  close(assert, carrier(r, 1), 0, 1e-15, 'MT father:');
  r = computeVariantRisks(M, 4, 'YL', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(r, 1), 1, 1e-15, 'YL father:');
  close(assert, carrier(r, 5), 0, 1e-15, 'YL sister:');
});

test('monozygotic co-twin of the index has the same genotype', () => {
  const T = makeGraph({
    1: P('M'), 2: P('F'),
    3: P('F', 1, 2, { twinGroup: 0, monozygotic: true }), 4: P('F', 1, 2, { twinGroup: 0, monozygotic: true }),
    5: P('M'), 6: P('M', 5, 4), 7: P('F', 1, 2)
  });
  let r = computeVariantRisks(T, 3, 'AD', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(r, 4), 1, 1e-15, 'co-twin:');
  close(assert, carrier(r, 6), 1 / 2, 1e-15, "co-twin's son:");
  close(assert, carrier(r, 7), 1 / 2, 1e-15, 'ordinary sister:');
  // a negative test in the co-twin contradicts the index's result
  r = computeVariantRisks(T, 3, 'AD', 'het', 0.005, { deNovo: 0, likelihood: { 4: lik({ mode: 'AD', test: '-' }) } });
  close(assert, carrier(r, 4), 1, 1e-15, 'co-twin still shares the genotype:');
  close(assert, r.evidenceLikelihood, TEST_ERROR, 1e-15, 'evidence likelihood:');
});

test('consanguineous loops: exact enumeration replaces the approximation when it is small', () => {
  // siblings 3 and 4; their children 7 and 8 are first cousins with a child 9
  const L = makeGraph({ 1: P('M'), 2: P('F'), 3: P('M', 1, 2), 4: P('F', 1, 2), 5: P('F'), 6: P('M'), 7: P('M', 3, 5), 8: P('F', 6, 4), 9: P('F', 7, 8) });
  // index above the loop: 9 has two uncertain parents
  const approx = computeVariantRisks(L, 3, 'AD', 'het', 0.005, { deNovo: 0, exact: false });
  assert.equal(approx.approximate.loop, true);
  const auto = computeVariantRisks(L, 3, 'AD', 'het', 0.005, { deNovo: 0 });
  assert.equal(auto.approximate.loop, false);
  assert.equal(auto.approximate.exact, true);
  // child 9 of first cousins 7 and 8: P(7 carries) = 1/2 (child of the index);
  // P(8 carries) = P(aunt 4 carries) / 2 = 1/4; given the origin they carry independently,
  // so P(9 carries) = 1 - (1 - p7 / 2)(1 - p8 / 2)
  const p7 = 0.5, p8 = 0.25;
  const p9 = 1 - (1 - p7 / 2) * (1 - p8 / 2);
  close(assert, carrier(auto, 9), p9, 1e-12, 'child of first cousins:');
  // index at the bottom of the loop: every line fixes one parent, so the fast method is exact
  assert.equal(computeVariantRisks(L, 9, 'AD', 'het', 0.005, { deNovo: 0, exact: false }).approximate.loop, false);
});

test('sex assigned at birth (AMAB / AFAB) governs sex-linked transmission', () => {
  // Fabry disease (X-linked): index 7 is a trans woman (circle, AMAB) with partner 8 (F), son 1 and daughter 2;
  // index's mother is 4 (F), sibling is 5 (U)
  const F = makeGraph({
    4: P('F'), 5: P('U', null, 4),
    7: P('F', null, 4, { sexAtBirth: 'AMAB' }), 8: P('F'),
    1: P('M', 7, 8), 2: P('F', 7, 8)
  });
  const r = computeVariantRisks(F, 7, 'XLD', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(r, 1), 0, 1e-15, 'AMAB index passes Y (not X) to son:');
  close(assert, carrier(r, 2), 1, 1e-15, 'AMAB index passes X to daughter:');
  close(assert, carrier(r, 4), 1, 1e-15, 'AMAB index inherited X from mother:');
  close(assert, carrier(r, 5), 0.5, 1e-15, 'sibling via obligate carrier mother:');

  // Trans man (square, AFAB) with X-linked variant passes X to both sons and daughters w.p. 1/2
  const TM = makeGraph({ 1: P('M', null, null, { sexAtBirth: 'AFAB' }), 2: P('M'), 3: P('M', 1, 2), 4: P('F', 1, 2) });
  const r2 = computeVariantRisks(TM, 1, 'XLD', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(r2, 3), 0.5, 1e-15, 'AFAB index passes X to son w.p. 1/2:');
  close(assert, carrier(r2, 4), 0.5, 1e-15, 'AFAB index passes X to daughter w.p. 1/2:');
});

test('assisted reproduction: gamete donors transmit variants; surrogates do not', () => {
  // Couple 1 (M) and 2 (F), sperm donor 3 (M, artKey 1), surrogate 4 (F, artKey 2), child 5
  const G = makeGraph({
    1: P('M'), 2: P('F'),
    3: P('M', null, null, { artRole: 'donor', artKey: 1 }),
    4: P('F', null, null, { artRole: 'surrogate', artKey: 2 }),
    5: P('M', 1, 2, { artLinks: [1, 2] })
  });
  // index is the child: sperm donor 3 and mother 2 are the biological parents; social father 1 and surrogate 4 are not
  let r = computeVariantRisks(G, 5, 'AD', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(r, 3), 0.5, 1e-15, 'sperm donor:');
  close(assert, carrier(r, 2), 0.5, 1e-15, 'biological mother:');
  close(assert, carrier(r, 1), 0, 1e-15, 'non-biological father:');
  close(assert, carrier(r, 4), 0, 1e-15, 'surrogate:');

  // index is the social father 1: child 5 was conceived with donor sperm and is not at risk
  r = computeVariantRisks(G, 1, 'AD', 'het', 0.005, { deNovo: 0 });
  close(assert, carrier(r, 5), 0, 1e-15, 'donor-conceived child of affected social father:');
});
