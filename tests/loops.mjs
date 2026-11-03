// Pedigrees with consanguinity loops, used to compare the fast (approximate) peeling with complete
// enumeration. Shared by tests/loops.test.mjs and tests/loops-benchmark.mjs.
import { makeGraph, P, lik } from './helpers.mjs';

// G1 x G2 -> A, A2 (siblings); A -> B, C; B and C's children D and E (first cousins) -> F, F2
// (the cousins' common ancestor A is uncertain when the index is above A)
const deepCousins = {
  1: P('M'), 2: P('F'), 3: P('M', 1, 2), 4: P('F', 1, 2), 30: P('F'),
  5: P('M', 3, 30), 6: P('F', 3, 30), 31: P('F'), 32: P('M'),
  7: P('M', 5, 31), 8: P('F', 32, 6), 9: P('F', 7, 8), 10: P('M', 7, 8)
};
// double first cousins: brothers 3, 4 marry sisters 5, 6; children 7, 8 marry -> 9, 10
const doubleCousins = {
  1: P('M'), 2: P('F'), 20: P('M'), 21: P('F'),
  3: P('M', 1, 2), 4: P('M', 1, 2), 5: P('F', 20, 21), 6: P('F', 20, 21),
  7: P('M', 3, 5), 8: P('F', 4, 6), 9: P('F', 7, 8), 10: P('M', 7, 8)
};
// uncle-niece union: 3 and 4 siblings; 4's daughter 6 has children 7, 8 with her uncle 3
const uncleNiece = {
  1: P('M'), 2: P('F'), 3: P('M', 1, 2), 4: P('F', 1, 2), 5: P('M'), 6: P('F', 5, 4), 7: P('M', 3, 6), 8: P('F', 3, 6)
};
// two successive first-cousin unions
const repeatedCousins = {
  1: P('M'), 2: P('F'), 3: P('M', 1, 2), 4: P('F', 1, 2), 5: P('F'), 6: P('M'),
  7: P('M', 3, 5), 8: P('F', 6, 4), 9: P('M', 7, 8), 10: P('F', 7, 8),
  11: P('F'), 12: P('M'), 13: P('M', 9, 11), 14: P('F', 12, 10), 15: P('F', 13, 14), 16: P('M', 13, 14)
};
// half-sibling union: 3 and 4 share mother 2; their children 5, 6
const halfSibs = {
  1: P('M'), 2: P('F'), 9: P('M'), 3: P('M', 1, 2), 4: P('F', 9, 2), 5: P('F', 3, 4), 6: P('M', 3, 4), 7: P('M'), 8: P('F', 7, 5)
};

const pedigrees = { deepCousins, doubleCousins, uncleNiece, repeatedCousins, halfSibs };

/** Evidence sets for a pedigree: none, some affected/unaffected relatives, a negative test */
function evidenceSets(people, mode, index) {
  const ids = Object.keys(people).map(Number).filter((id) => id !== index);
  const youngest = ids.slice(-3);
  const sets = { none: null };
  const biallelic = mode === 'AR';
  const pheno = {};
  youngest.forEach((id, i) => {
    pheno[id] = lik({ mode, sex: people[id].sex, affected: i === 0, unaffected: i !== 0, pen: 0.8, fpen: mode === 'XLR' ? 0.1 : 0.8, biallelic });
  });
  sets.phenotypes = pheno;
  const mid = ids[Math.floor(ids.length / 2)];
  sets.negativeTest = { [mid]: lik({ mode, test: '-' }) };
  return sets;
}

/**
 * Cases: { name, graph, index, mode, genotype, options }
 */
export function loopCases() {
  const cases = [];
  for (const [pname, people] of Object.entries(pedigrees)) {
    const graph = makeGraph(people);
    const ids = Object.keys(people).map(Number);
    // indices: a top ancestor, a member of the middle generation and a child of the union
    const candidates = [ids[0], ids[2], ids[ids.length - 2]];
    for (const index of candidates) {
      for (const mode of ['AD', 'XLR', 'AR']) {
        if (mode === 'XLR' && people[index].sex !== 'M') continue;
        const genotype = mode === 'AR' ? (index === ids[ids.length - 2] ? 'biallelic' : 'het') : 'het';
        for (const [ename, likelihood] of Object.entries(evidenceSets(people, mode, index))) {
          if (mode === 'AR' && genotype === 'het' && ename === 'phenotypes') continue;
          cases.push({
            name: `${pname} / index ${index} / ${mode} ${genotype} / ${ename}`,
            graph, index, mode, genotype,
            options: { deNovo: mode === 'XLR' ? 1 / 3 : 0.02, likelihood }
          });
        }
      }
    }
  }
  return cases;
}

/** Largest absolute difference in carrier probability over all persons */
export function maxCarrierDifference(a, b) {
  let max = 0;
  for (const id of Object.keys(b.probs)) {
    const pa = a.probs[id], pb = b.probs[id];
    if (!pa || !pb) continue;
    const ca = pa[1] + pa[2] + pa[3], cb = pb[1] + pb[2] + pb[3];
    max = Math.max(max, Math.abs(ca - cb));
  }
  return max;
}

export { pedigrees };
