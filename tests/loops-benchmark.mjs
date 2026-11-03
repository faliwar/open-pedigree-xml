// Error of the fast peeling in looped pedigrees, against complete enumeration.
// Usage: node --import ./tests/setup.mjs tests/loops-benchmark.mjs
import { loopCases, maxCarrierDifference } from './loops.mjs';
import { computeVariantRisks } from '../src/script/model/inheritance.js';

const rows = [];
for (const c of loopCases()) {
  const fast = computeVariantRisks(c.graph, c.index, c.mode, c.genotype, 0.005, Object.assign({}, c.options, { exact: false }));
  const t0 = performance.now();
  const exact = computeVariantRisks(c.graph, c.index, c.mode, c.genotype, 0.005, Object.assign({}, c.options, { exact: true }));
  const ms = performance.now() - t0;
  rows.push({ name: c.name, flagged: fast.approximate.loop, maxError: maxCarrierDifference(fast, exact), exactMs: ms });
}
const flagged = rows.filter((r) => r.flagged);
const errs = flagged.map((r) => r.maxError).sort((a, b) => a - b);
const pct = (q) => errs.length ? errs[Math.min(errs.length - 1, Math.floor(q * errs.length))] : 0;
console.log(JSON.stringify({
  cases: rows.length,
  flaggedAsApproximate: flagged.length,
  unflaggedMaxError: Math.max(0, ...rows.filter((r) => !r.flagged).map((r) => r.maxError)),
  flaggedMaxError: errs.length ? errs[errs.length - 1] : 0,
  flaggedMedianError: pct(0.5),
  flaggedOver1pt: errs.filter((e) => e > 0.01).length,
  exactMsMax: Math.max(...rows.map((r) => r.exactMs)),
  worst: flagged.sort((a, b) => b.maxError - a.maxError).slice(0, 5)
}, null, 1));
