// Test helpers: a minimal pedigree graph with the interface the model engines use.

/**
 * people: { id: { sex: 'M'|'F'|'U', f: id|null, m: id|null, adopted, twinGroup, monozygotic } }
 */
export function makeGraph(people) {
  const ids = Object.keys(people).map(Number);
  const props = (id) => {
    const p = people[id] || {};
    const out = {};
    if (p.twinGroup !== undefined && p.twinGroup !== null) out.twinGroup = p.twinGroup;
    if (p.monozygotic) out.monozygotic = true;
    if (p.sexAtBirth) out.sexAtBirth = p.sexAtBirth;
    if (p.artRole) out.artRole = p.artRole;
    if (p.artKey !== undefined) out.artKey = p.artKey;
    if (p.artLinks) out.artLinks = p.artLinks;
    return out;
  };
  return {
    isPerson: (id) => Object.prototype.hasOwnProperty.call(people, id),
    isPlaceholder: () => false,
    isVirtualDummyChild: () => false,
    isVirtualParent: () => false,
    isAdopted: (id) => !!(people[id] && people[id].adopted),
    getGender: (id) => (people[id] ? people[id].sex : 'U'),
    getMaxNodeId: () => Math.max(...ids),
    getProperties: (id) => props(id),
    getTwinGroupId: (id) => (people[id] && people[id].twinGroup !== undefined ? people[id].twinGroup : null),
    getParentRelationship: (id) => (people[id] && (people[id].f !== null || people[id].m !== null) ? `${people[id].f}-${people[id].m}` : null),
    DG: { GG: { getParents: (id) => (people[id] ? [people[id].f, people[id].m].filter((x) => x !== null && x !== undefined) : []) } }
  };
}

export const P = (sex, f = null, m = null, extra = {}) => Object.assign({ sex, f, m }, extra);

export const PHENOCOPY = 0.001;
export const TEST_ERROR = 0.0001;

/**
 * Likelihood vector [L0..L3] for one person, as built by the cascade dialog
 * (congenital onset unless frac is given).
 */
export function lik({ mode, sex, affected, unaffected, test, pen = 1, fpen = pen, biallelic = false, frac = 1, phenocopy = PHENOCOPY }) {
  const penOf = (s) => {
    if (mode === 'AR' && !biallelic) return null;
    if (s === 0) return 0;
    if (mode === 'AD' || mode === 'MT') return pen;
    if (mode === 'AR') return s === 3 ? pen : 0;
    if (mode === 'XLR' || mode === 'XLD') return sex === 'M' ? pen : fpen;
    if (mode === 'YL') return sex === 'F' ? 0 : pen;
    return 0;
  };
  const v = [1, 1, 1, 1];
  for (let s = 0; s < 4; s++) {
    if (affected || unaffected) {
      const p = penOf(s);
      if (p !== null) {
        const pa = affected ? p : p * frac;
        v[s] *= affected ? pa + (1 - pa) * phenocopy : (1 - pa) * (1 - phenocopy);
      }
    }
    if (test) v[s] *= ((s > 0) === (test === '+')) ? 1 - TEST_ERROR : TEST_ERROR;
  }
  return v;
}

export const carrier = (res, id) => { const p = res.probs[id]; return p[1] + p[2] + p[3]; };

export function close(assert, got, expected, tol = 1e-12, msg = '') {
  assert.ok(Math.abs(got - expected) <= tol, `${msg} expected ${expected}, got ${got}`);
}
