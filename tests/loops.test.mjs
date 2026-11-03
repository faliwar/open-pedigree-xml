// Complete enumeration (exact) versus the fast peeling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGraph, P, lik } from './helpers.mjs';
import * as loopsModule from './loops.mjs';
import { loopCases, maxCarrierDifference } from './loops.mjs';
import { computeVariantRisks } from '../src/script/model/inheritance.js';

test('enumeration agrees with peeling in pedigrees without loops', () => {
  const T = makeGraph({
    1: P('M'), 2: P('F'), 3: P('F', 1, 2), 4: P('M', 1, 2), 5: P('M'), 6: P('F', 5, 3), 7: P('M', 5, 3),
    8: P('M'), 9: P('F', 8, 6), 10: P('M', 8, 6), 11: P('F'), 12: P('M', 4, 11)
  });
  for (const mode of ['AD', 'XLR', 'XLD', 'MT']) {
    const likelihood = {
      7: lik({ mode, sex: 'M', affected: true, pen: 0.7, fpen: 0.3 }),
      10: lik({ mode, sex: 'M', unaffected: true, pen: 0.7, fpen: 0.3 }),
      12: lik({ mode, test: '-' })
    };
    const fast = computeVariantRisks(T, 9, mode, 'het', 0.005, { deNovo: 0.05, likelihood, exact: false });
    const exact = computeVariantRisks(T, 9, mode, 'het', 0.005, { deNovo: 0.05, likelihood, exact: true });
    assert.equal(exact.approximate.exact, true);
    assert.ok(maxCarrierDifference(fast, exact) < 1e-12, mode);
    assert.ok(Math.abs(fast.evidenceLikelihood - exact.evidenceLikelihood) < 1e-12, mode + ' evidence');
  }
});

test('enumeration gives valid probabilities in looped pedigrees and is used automatically', () => {
  for (const c of loopCases()) {
    const exact = computeVariantRisks(c.graph, c.index, c.mode, c.genotype, 0.005, Object.assign({}, c.options, { exact: true }));
    const auto = computeVariantRisks(c.graph, c.index, c.mode, c.genotype, 0.005, c.options);
    for (const id of Object.keys(exact.probs)) {
      const sum = exact.probs[id].reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-9, `${c.name}: probabilities of ${id} sum to ${sum}`);
    }
    assert.equal(auto.approximate.loop, false, c.name);
    assert.ok(maxCarrierDifference(auto, exact) < 1e-12, c.name);
  }
});

test('exact value when the parents of a child are correlated through an uncertain ancestor', () => {
  // index 1 (great-grandfather); his son 3 carries w.p. 1/2; 3's children 5 and 6 each w.p. 1/2;
  // their children 7 and 8 (first cousins) w.p. 1/4 each given 3 carries; 9 is the cousins' child.
  // P(9) = 1/2 * [1 - (1 - 1/8)^2] = 15/128, whereas independent parents (1/8 each) give 31/256.
  const { pedigrees } = loopsModule;
  const g = makeGraph(pedigrees.deepCousins);
  const exact = computeVariantRisks(g, 1, 'AD', 'het', 0.005, { deNovo: 0 });
  const fast = computeVariantRisks(g, 1, 'AD', 'het', 0.005, { deNovo: 0, exact: false });
  const c9 = (r) => r.probs[9][1] + r.probs[9][2] + r.probs[9][3];
  assert.ok(Math.abs(c9(exact) - 15 / 128) < 1e-15, `exact ${c9(exact)}`);
  assert.ok(Math.abs(c9(fast) - 31 / 256) < 1e-15, `fast ${c9(fast)}`);
});

test('falls back to the labeled approximation when enumeration exceeds the budget', () => {
  const c = loopCases().find((x) => x.name.startsWith('repeatedCousins / index 1 / AD'));
  const r = computeVariantRisks(c.graph, c.index, c.mode, c.genotype, 0.005, Object.assign({}, c.options, { exactBudget: 1 }));
  assert.equal(r.approximate.exact, false);
  assert.equal(r.approximate.loop, true);
});
