/**
 * Inheritance-aware cascade risks.
 *
 * Given an index person who carries a familial variant, computes for every person in the
 * pedigree the prior probability of carrying it, following how the variant is transmitted
 * under each mode of inheritance:
 *
 *   AD   autosomal dominant         each parent passes one of two homologs (1/2)
 *   AR   autosomal recessive        same transmission; the index may carry one variant
 *                                   (heterozygous) or two (biallelic: one from each parent)
 *   XLR  X-linked recessive         a father passes his X to all daughters and to no son;
 *   XLD  X-linked dominant          a mother passes one of her two X (1/2)
 *   MT   mitochondrial              only mothers transmit, to all children
 *   YL   Y-linked                   only fathers transmit, to all sons
 *
 * Method: the variant is traced upwards from the index along every possible line of origin
 * (each weighted by its probability, ending in a de novo mutation or where a parent is missing
 * from the pedigree), then transmitted downwards from every carrier on that line. Each line is
 * then weighted by how well it explains the recorded phenotypes (with penetrance and age at
 * onset) and test results, and the evidence updates every person's genotype (peeling). Results
 * are summed over all lines (Bayes). Exact for pedigrees without loops. With consanguinity loops
 * the fast peeling is an approximation, so the transmissions are then enumerated completely
 * (exact) when that is small enough; otherwise the result is reported as approximate. Germline
 * mosaicism is not modelled. Monozygotic twins are treated as one genome.
 *
 * Each person's state is a bitmask of the familial alleles they carry: bit 1 = first allele
 * (the only one, or the paternal one in biallelic AR), bit 2 = maternal allele in biallelic AR.
 */

import { makeTwinCanon } from './kinship.js';

var MODES = ['AD', 'AR', 'XLR', 'XLD', 'MT', 'YL'];

var MAX_DEPTH = 10;   // generations traced upwards
var MAX_PATHS = 512;  // per allele
// complete enumeration of transmissions (exact with loops): number of joint genotype
// configurations allowed, over all lines, before falling back to the approximation
var EXACT_BUDGET = 200000;
var EXACT_BUDGET_FORCED = 5000000;
var BUDGET_EXCEEDED = { budgetExceeded: true };

var isXLinked = function(mode) {
  return mode === 'XLR' || mode === 'XLD';
};

/**
 * Biological parents of a person, placed in father / mother slots. A parent of unknown sex
 * takes whichever slot is still free. Adopted persons have no biological parents here.
 */
var getParentSlots = function(graph, id) {
  var slots = { f: null, m: null };
  var parents;
  try {
    if (graph.isAdopted(id)) {
      return slots;
    }
    parents = graph.DG.GG.getParents(id);
  } catch (e) {
    return slots;
  }
  var unknown = [];
  parents.forEach(function(p) {
    var g = graph.getGender(p);
    if (g === 'M' && slots.f === null) slots.f = p;
    else if (g === 'F' && slots.m === null) slots.m = p;
    else if (g !== 'M' && g !== 'F') unknown.push(p);
    // a second parent of the same sex (same-sex couple) is not placed in the other sex's slot:
    // only the first one is treated as the biological parent of that sex
  });
  unknown.forEach(function(p) {
    if (slots.f === null) slots.f = p;
    else if (slots.m === null) slots.m = p;
  });
  return slots;
};

/**
 * How a carrier of the given sex came to carry the variant: de novo ('dn') or from the father
 * ('f') or mother ('m'). d is the de novo proportion entered by the user.
 *
 * Autosomal, mitochondrial, Y-linked: de novo with probability d at every person, otherwise
 * inherited through the transmitting parent(s).
 *
 * X-linked: d is the de novo share among (isolated) hemizygous males. At mutation-selection
 * equilibrium (Haldane), with k = male / female mutation rate and fitness f of affected males,
 * d = (1 - f) / (2 + k), and a carrier female received the variant from her mother in 1/2 of
 * cases, de novo (in either parent's germ cell) in (1 + k) d / (2 (1 - d)), and from an affected
 * father in the rest. With k = 1 this is d / (1 - d): the textbook 2/3 for the mother and 1/3 for
 * the maternal grandmother of an isolated case with d = 1/3. The de novo share is capped at 1/2
 * (d at or above 1 / (2 + k): affected males do not reproduce).
 */
var originWeights = function(mode, sex, d, k) {
  k = (k > 0) ? k : 1;
  var male = function() {
    if (mode === 'XLR' || mode === 'XLD' || mode === 'MT') return { dn: d, f: 0, m: 1 - d };
    if (mode === 'YL') return { dn: d, f: 1 - d, m: 0 };
    return { dn: d, f: (1 - d) / 2, m: (1 - d) / 2 };
  };
  var female = function() {
    if (mode === 'XLR' || mode === 'XLD') {
      var e = d < 1 ? Math.min(0.5, (1 + k) * d / (2 * (1 - d))) : 0.5;
      return { dn: e, f: 0.5 - e, m: 0.5 };
    }
    if (mode === 'MT') return { dn: d, f: 0, m: 1 - d };
    if (mode === 'YL') return { dn: 0, f: 0, m: 0 };
    return { dn: d, f: (1 - d) / 2, m: (1 - d) / 2 };
  };
  if (sex === 'M') return male();
  if (sex === 'F') return female();
  var a = male(), b = female();
  return { dn: (a.dn + b.dn) / 2, f: (a.f + b.f) / 2, m: (a.m + b.m) / 2 };
};

/**
 * Distribution of the allele set a parent passes to a child, as an array indexed by bitmask.
 */
var transmit = function(mode, parentState, slot, childSex) {
  var none = [1, 0, 0, 0];
  if (parentState === 0) {
    return none;
  }
  var whole = [0, 0, 0, 0];
  whole[parentState] = 1;

  // a parent has two homologs: two different familial alleles sit on different homologs
  var homolog = function() {
    var d = [0, 0, 0, 0];
    if (parentState === 3) {
      d[1] = 0.5;
      d[2] = 0.5;
    } else {
      d[parentState] = 0.5;
      d[0] = 0.5;
    }
    return d;
  };
  var mix = function(a, b) {
    return a.map(function(v, i) { return (v + b[i]) / 2; });
  };

  switch (mode) {
    case 'AD':
    case 'AR':
      return homolog();
    case 'XLR':
    case 'XLD':
      if (slot === 'm') return homolog();
      if (childSex === 'F') return whole;
      if (childSex === 'M') return none;
      return mix(whole, none);
    case 'MT':
      return slot === 'm' ? whole : none;
    case 'YL':
      if (slot === 'm') return none;
      if (childSex === 'M') return whole;
      if (childSex === 'F') return none;
      return mix(whole, none);
  }
  return none;
};

/**
 * Lines of origin of the variant copy in `start`. Each line is
 *   { nodes: [start, parent, grandparent, ...], slots: ['f'|'m' per node], w, founder }
 * where slots[i] is the parent slot through which nodes[i] received the copy, and
 * founder ('node:slot') identifies the founder allele the copy descends from (the copy
 * entered the pedigree through a parent who is not recorded).
 * forcedSlot restricts the first step (biallelic AR: one allele from each parent).
 * deNovo is the probability that a carrier's copy arose as a new mutation in that person
 * (slot 'dn', founder 'dn:node') instead of being inherited; it applies at every person
 * along the line, so the parent of an isolated case carries it with probability 1 - deNovo.
 */
var enumerateOrigins = function(graph, mode, start, forcedSlot, deNovo, mutationRatio, limits) {
  var result = [];
  var d = (deNovo > 0 && deNovo < 1) ? deNovo : (deNovo >= 1 ? 1 : 0);
  limits = limits || {};
  var walk = function(v, nodes, slotsTaken, steps, w, depth, firstStep) {
    if (result.length >= MAX_PATHS) {
      limits.truncated = true;
      return;
    }
    var parents = getParentSlots(graph, v);
    var sex = graph.getGender(v);
    var ow = (firstStep && forcedSlot) ? null : originWeights(mode, sex, d, mutationRatio);
    if (ow && ow.dn > 0) {
      // the copy arose de novo in v
      result.push({ nodes: nodes.concat([v]), slots: slotsTaken.concat(['dn']), steps: steps.concat([ow.dn]), w: w * ow.dn, founder: 'dn:' + v });
    }
    ['f', 'm'].forEach(function(slot) {
      var wt = ow ? ow[slot] : (slot === forcedSlot ? 1 : 0);
      if (wt === 0) {
        return;
      }
      var parent = parents[slot];
      var lineNodes = nodes.concat([v]);
      var lineSlots = slotsTaken.concat([slot]);
      var lineSteps = steps.concat([wt]);
      if (parent !== null && depth >= MAX_DEPTH) {
        limits.depthLimited = true;
      }
      if (parent === null || depth >= MAX_DEPTH || lineNodes.indexOf(parent) !== -1) {
        // the variant entered the pedigree here (parent not recorded)
        result.push({ nodes: lineNodes, slots: lineSlots, steps: lineSteps, w: w * wt, founder: v + ':' + slot });
      } else {
        walk(parent, lineNodes, lineSlots, lineSteps, w * wt, depth + 1, false);
      }
    });
  };
  walk(start, [], [], [], 1, 0, true);
  return result;
};

// Probability of the first i steps of a line (steps[k] = how nodes[k] got the copy)
var weightBelow = function(line, i) {
  var w = 1;
  for (var k = 0; k < i; k++) {
    w *= line.steps[k];
  }
  return w;
};

/**
 * Records which familial copy (bit) each person on a line of origin received, and through
 * which parent slot. Two lines may run through the same person and slot only if they carry
 * the very same copy, i.e. they coincide from there up to the founder; otherwise the
 * combination is impossible (a parent passes a single homolog) and -1 is returned.
 * Otherwise returns the position where the line joins an already marked copy (from there up
 * it is the same copy, so its probability is already counted), or the line length.
 */
var markLine = function(received, line, bit) {
  for (var i = 0; i < line.nodes.length; i++) {
    var v = line.nodes[i];
    var s = line.slots[i];
    received[v] = received[v] || {};
    if (received[v].hasOwnProperty(s)) {
      var existing = received[v][s];
      if (existing.line !== line && !sameAbove(existing.line, existing.index, line, i)) {
        return -1;
      }
      return i; // joins the same physical copy: everything above is shared
    }
    received[v][s] = { bit: bit, line: line, index: i };
  }
  return line.nodes.length;
};

var sameAbove = function(lineA, ia, lineB, ib) {
  if (lineA.nodes.length - ia !== lineB.nodes.length - ib) {
    return false;
  }
  for (var k = 0; ia + k < lineA.nodes.length; k++) {
    if (lineA.nodes[ia + k] !== lineB.nodes[ib + k] || lineA.slots[ia + k] !== lineB.slots[ib + k]) {
      return false;
    }
  }
  return true;
};

/**
 * Persons ordered parents-before-children.
 */
var topologicalPersons = function(graph) {
  var depth = {};
  var visiting = {};
  var getDepth = function(id) {
    if (depth.hasOwnProperty(id)) return depth[id];
    if (visiting[id]) return 0;
    visiting[id] = true;
    var slots = getParentSlots(graph, id);
    var d = 0;
    ['f', 'm'].forEach(function(s) {
      if (slots[s] !== null) d = Math.max(d, getDepth(slots[s]) + 1);
    });
    depth[id] = d;
    return d;
  };
  var ids = [];
  for (var id = 0; id <= graph.getMaxNodeId(); id++) {
    if (graph.isPerson(id)) {
      getDepth(id);
      ids.push(id);
    }
  }
  ids.sort(function(a, b) { return depth[a] - depth[b]; });
  return ids;
};

/**
 * @param {DynamicPositionedGraph} graph
 * @param {Number} indexId
 * @param {String} mode one of MODES
 * @param {String} indexGenotype 'het' or 'biallelic' (biallelic only applies to AR)
 * @param {Number} [alleleFrequency] population frequency q of the variant. With a biallelic
 *   index it weighs a single ancestral copy inherited through both parents (identity by
 *   descent, prior q) against two copies of independent origin (prior q^2): in consanguineous
 *   families with a rare variant the common-ancestor explanation dominates.
 * @param {Object} [options]
 *   deNovo     probability that a carrier's copy is a new mutation (single-allele modes only)
 *   mutationRatio  male / female mutation rate k for X-linked modes (default 1, see originWeights)
 *   likelihood {id: [L0, L1, L2, L3]} probability of what is observed in each person (phenotype,
 *              test result) for each state; persons left out carry no evidence
 * @return {Object} { probs: {id: [p0, p1, p2, p3]}, warning: '', ibd: probability that the
 *   index's two copies descend from one ancestral copy (biallelic only), deNovoIndex: probability
 *   that the variant arose de novo in the index, evidenceLikelihood: probability of the evidence
 *   under this mode given that the index carries the variant (1 without evidence),
 *   approximate: { truncated, depthLimited, loop, exact } (loop: an approximation was used for a
 *   consanguinity loop; exact: complete enumeration was used instead) }
 *   options.exact: true to always enumerate (within options.exactBudget), false never; by
 *   default only when a loop would otherwise make the result approximate.
 *   p(any) = p1 + p2 + p3 is the chance of carrying at least one familial allele;
 *   p3 is the chance of carrying both (biallelic AR: affected).
 *   All probabilities are conditioned on the evidence given in options.likelihood.
 */
var computeVariantRisks = function(fullGraph, indexId, mode, indexGenotype, alleleFrequency, options) {
  options = options || {};
  // monozygotic twins are one genome: only one member of each twin group takes part, and the
  // co-twins' evidence and results are merged into it
  var canon = makeTwinCanon(fullGraph);
  var graph = twinMergedGraph(fullGraph, canon);
  var fullIndexId = indexId;
  indexId = canon(indexId);
  var biallelic = (mode === 'AR' && indexGenotype === 'biallelic');
  var q = (alleleFrequency > 0 && alleleFrequency < 1) ? alleleFrequency : 0.005;
  var deNovo = biallelic ? 0 : (options.deNovo || 0);
  var likelihood = mergeTwinEvidence(options.likelihood || null, canon);
  var indexSex = graph.getGender(indexId);
  var warning = '';
  var limits = { truncated: false, depthLimited: false, loop: false, exact: false };

  if (mode === 'YL' && indexSex === 'F') {
    return { probs: {}, warning: 'Y-linked variants are only carried by males: choose a male index person.', approximate: limits };
  }

  var origins1 = enumerateOrigins(graph, mode, indexId, biallelic ? 'f' : null, deNovo, options.mutationRatio, limits);
  var origins2 = biallelic ? enumerateOrigins(graph, mode, indexId, 'm', 0, options.mutationRatio, limits) : [null];
  var order = topologicalPersons(graph);
  var slotsOf = {};
  var sexOf = {};
  order.forEach(function(id) {
    slotsOf[id] = getParentSlots(graph, id);
    sexOf[id] = graph.getGender(id);
  });

  var totals, totalWeight, priorWeight, ibdWeight, deNovoIndexWeight;
  var exactCost = 0; // estimated number of configurations for complete enumeration (fast pass)

  // useExact: each line is solved by complete enumeration of the transmissions (exact with loops)
  // within `budget`; returns false when the budget runs out
  // adds one line of origin (or pair of lines, biallelic) to the totals
  var solveLine = function(o1, o2, useExact, budget) {
    // which familial copy each person on the lines received, and through which parent
    var received = {};
    markLine(received, o1, 1);
    var w = o1.w;
    if (o2) {
      var join = markLine(received, o2, 2);
      if (join < 0) {
        return; // impossible combination
      }
      // Where the lines meet, the ancestor passes that same copy in two separate meioses
      // (counted for each line); above it the two copies are one, so count that part once.
      w *= (join < o2.nodes.length) ? weightBelow(o2, join + 1) : o2.w;
    }
    if (w === 0) return;
    var ibd = !!(o2 && o1.founder === o2.founder);
    if (o2) {
      // prior of the founder alleles carrying the variant: one copy (q) or two (q^2)
      w *= ibd ? q : q * q;
    }

    var post;
    priorWeight += w;
    if (useExact) {
      var solved = exactLine(mode, order, slotsOf, sexOf, received, likelihood, budget);
      w *= solved.likelihood;
      post = solved.posterior;
    } else {
      // prior genotype distribution of every person under this line of origin
      var prior = forwardPrior(mode, order, slotsOf, sexOf, received, limits);
      post = prior;
      // size of a complete enumeration of this line: about 2 outcomes per uncertain person
      var uncertain = 0;
      order.forEach(function(id) { if (isCertain(prior[id]) < 0) uncertain++; });
      exactCost += Math.pow(2, uncertain);
      if (likelihood) {
        // condition on phenotypes and test results: weight of this line and posteriors
        var peeled = peelEvidence(mode, order, slotsOf, sexOf, received, prior, likelihood, limits);
        w *= peeled.likelihood;
        post = peeled.posterior;
      }
    }
    if (!(w > 0)) return;

    totalWeight += w;
    if (ibd) ibdWeight += w;
    if (o1.founder === 'dn:' + indexId) deNovoIndexWeight += w;
    order.forEach(function(id) {
      var d = post[id];
      for (var s = 0; s < 4; s++) {
        totals[id][s] += w * d[s];
      }
    });
  };

  var runLines = function(useExact, budget) {
    exactCost = 0;
    totals = {};
    order.forEach(function(id) { totals[id] = [0, 0, 0, 0]; });
    totalWeight = 0;
    priorWeight = 0;   // the same sum without the evidence, to normalize it
    ibdWeight = 0;
    deNovoIndexWeight = 0;
    try {
      origins1.forEach(function(o1) {
        origins2.forEach(function(o2) { solveLine(o1, o2, useExact, budget); });
      });
    } catch (e) {
      if (e === BUDGET_EXCEEDED) return false;
      throw e;
    }
    return true;
  };

  // exact: true always enumerates (within options.exactBudget), false never; by default the
  // approximation is replaced by complete enumeration when a loop makes it approximate and the
  // enumeration fits in the budget
  var exactOpt = options.exact;
  if (exactOpt === true) {
    if (runLines(true, { left: options.exactBudget || EXACT_BUDGET_FORCED })) {
      limits.exact = true;
    } else {
      runLines(false);
    }
  } else {
    runLines(false);
    var budgetLeft = options.exactBudget || EXACT_BUDGET;
    // try complete enumeration only when its estimated size fits the budget
    if (exactOpt !== false && limits.loop && exactCost <= budgetLeft) {
      if (runLines(true, { left: budgetLeft })) {
        limits.loop = false;
        limits.exact = true;
      } else {
        runLines(false); // too large to enumerate: keep the (labeled) approximation
      }
    }
  }

  var probs = {};
  if (totalWeight > 0) {
    order.forEach(function(id) {
      probs[id] = totals[id].map(function(v) { return v / totalWeight; });
    });
    // co-twins share the representative's genotype
    for (var id = 0; id <= fullGraph.getMaxNodeId(); id++) {
      if (canon(id) !== id && probs.hasOwnProperty(canon(id))) probs[id] = probs[canon(id)].slice();
    }
    if (fullIndexId !== indexId && probs[indexId]) probs[fullIndexId] = probs[indexId].slice();
  } else if (likelihood) {
    warning = 'The recorded phenotypes and test results contradict each other under this mode of inheritance.';
  }
  return {
    approximate: limits,
    probs: probs,
    warning: warning,
    // P(evidence | mode, the index carries the variant): compares how well modes explain the pedigree
    evidenceLikelihood: priorWeight > 0 ? totalWeight / priorWeight : 0,
    ibd: (biallelic && totalWeight > 0) ? ibdWeight / totalWeight : null,
    deNovoIndex: (deNovo > 0 && totalWeight > 0) ? deNovoIndexWeight / totalWeight : null
  };
};

/**
 * A view of the graph in which each monozygotic twin group is a single person (its
 * representative): the other twins are hidden and their children descend from the representative.
 */
var twinMergedGraph = function(graph, canon) {
  var merged = false;
  for (var id = 0; id <= graph.getMaxNodeId(); id++) {
    if (canon(id) !== id) { merged = true; break; }
  }
  if (!merged) return graph;
  return {
    isPerson: function(v) { return graph.isPerson(v) && canon(v) === v; },
    isAdopted: function(v) { return graph.isAdopted(v); },
    getGender: function(v) { return graph.getGender(v); },
    getMaxNodeId: function() { return graph.getMaxNodeId(); },
    DG: { GG: { getParents: function(v) {
      var seen = {};
      return graph.DG.GG.getParents(v).map(canon).filter(function(p) {
        if (seen[p]) return false;
        seen[p] = true;
        return true;
      });
    } } }
  };
};

// Evidence on co-twins applies to their shared genotype
var mergeTwinEvidence = function(likelihood, canon) {
  if (!likelihood) return null;
  var out = {};
  Object.keys(likelihood).forEach(function(key) {
    var id = canon(parseInt(key, 10));
    var l = likelihood[key];
    out[id] = out[id] ? out[id].map(function(v, s) { return v * l[s]; }) : l.slice();
  });
  return out;
};

// ---------------------------------------------------------------------------------------------
// Genotype distributions for one line of origin

// What a person gets through a parent slot: the copy on the line (fixed), nothing (no parent),
// or a transmission from the parent.
var slotSource = function(id, slot, slotsOf, received) {
  if (received[id] && received[id].hasOwnProperty(slot)) {
    return { fixedBit: received[id][slot].bit };
  }
  var parent = slotsOf[id][slot];
  return parent === null ? { none: true } : { parent: parent };
};

var deNovoBits = function(id, received) {
  return (received[id] && received[id].dn) ? received[id].dn.bit : 0;
};

var transmittedFrom = function(mode, parentDist, slot, childSex) {
  var out = [0, 0, 0, 0];
  parentDist.forEach(function(pp, ps) {
    if (pp === 0) return;
    transmit(mode, ps, slot, childSex).forEach(function(tp, ts) {
      out[ts] += pp * tp;
    });
  });
  return out;
};

var sourceDist = function(mode, src, slot, childSex, dist) {
  if (src.fixedBit) {
    var copy = [0, 0, 0, 0];
    copy[src.fixedBit] = 1;
    return copy;
  }
  if (src.none || !dist[src.parent]) return [1, 0, 0, 0];
  return transmittedFrom(mode, dist[src.parent], slot, childSex);
};

// child state = union of what each parent passes (+ a de novo copy arising in the child)
var combine = function(df, dm, extraBits) {
  var d = [0, 0, 0, 0];
  df.forEach(function(pf, sf) {
    if (pf === 0) return;
    dm.forEach(function(pm, sm) {
      d[sf | sm | extraBits] += pf * pm;
    });
  });
  return d;
};

/**
 * Marginal genotype distribution of every person, parents before children (the two parents of
 * a child are treated as independent, which is exact without consanguinity loops).
 */
var forwardPrior = function(mode, order, slotsOf, sexOf, received, limits) {
  var dist = {};
  order.forEach(function(id) {
    var sex = sexOf[id];
    var srcF = slotSource(id, 'f', slotsOf, received);
    var srcM = slotSource(id, 'm', slotsOf, received);
    if (limits && srcF.parent !== undefined && srcM.parent !== undefined && dist[srcF.parent] && dist[srcM.parent] &&
        isCertain(dist[srcF.parent]) < 0 && isCertain(dist[srcM.parent]) < 0) {
      limits.loop = true; // both parents uncertain: treated as independent (approximation)
    }
    var df = sourceDist(mode, srcF, 'f', sex, dist);
    var dm = sourceDist(mode, srcM, 'm', sex, dist);
    dist[id] = combine(df, dm, deNovoBits(id, received));
  });
  return dist;
};

/**
 * Exact solution for one line of origin: enumerates every joint configuration of genotypes,
 * parents before children, with each child's state drawn from the transmissions of its parents'
 * actual states (so related parents in a loop are handled correctly). Weighted by the evidence.
 * Throws BUDGET_EXCEEDED when more than budget.left configurations would be needed.
 *
 * @return {Object} { likelihood: P(evidence | line), posterior: {id: [p0..p3]} }
 */
var exactLine = function(mode, order, slotsOf, sexOf, received, likelihood, budget) {
  var n = order.length;
  var state = {};
  var post = {};
  order.forEach(function(id) { post[id] = [0, 0, 0, 0]; });
  var total = 0;
  var ONE = [1, 1, 1, 1];
  var NONE = [1, 0, 0, 0];
  var sourceOf = function(id, slot, sex) {
    var src = slotSource(id, slot, slotsOf, received);
    if (src.fixedBit) {
      var copy = [0, 0, 0, 0];
      copy[src.fixedBit] = 1;
      return copy;
    }
    if (src.none) return NONE;
    return transmit(mode, state[src.parent], slot, sex);
  };
  var visit = function(i, w) {
    if (i === n) {
      if (--budget.left < 0) throw BUDGET_EXCEEDED;
      total += w;
      for (var k = 0; k < n; k++) post[order[k]][state[order[k]]] += w;
      return;
    }
    var id = order[i];
    var sex = sexOf[id];
    var df = sourceOf(id, 'f', sex);
    var dm = sourceOf(id, 'm', sex);
    var extra = deNovoBits(id, received);
    var L = (likelihood && likelihood[id]) || ONE;
    for (var sf = 0; sf < 4; sf++) {
      if (!(df[sf] > 0)) continue;
      for (var sm = 0; sm < 4; sm++) {
        if (!(dm[sm] > 0)) continue;
        var s = sf | sm | extra;
        var wi = w * df[sf] * dm[sm] * L[s];
        if (!(wi > 0)) continue;
        state[id] = s;
        visit(i + 1, wi);
      }
    }
  };
  visit(0, 1);
  var posterior = {};
  order.forEach(function(id) {
    posterior[id] = total > 0 ? post[id].map(function(v) { return v / total; }) : [1, 0, 0, 0];
  });
  return { likelihood: total, posterior: posterior };
};

var isCertain = function(d) {
  for (var s = 0; s < 4; s++) {
    if (d[s] > 1 - 1e-12) return s;
  }
  return -1;
};

/**
 * Conditions one line of origin on the evidence by peeling: persons whose genotype is uncertain
 * form a forest hanging from the carriers on the line (each uncertain person is attached to one
 * uncertain parent). Upward messages give the likelihood of the evidence, downward messages the
 * posterior of each person. Exact without consanguinity loops; a child with two uncertain
 * parents uses the prior of the second one (approximation).
 *
 * @return {Object} { likelihood: P(evidence | line), posterior: {id: [p0..p3]} }
 */
var peelEvidence = function(mode, order, slotsOf, sexOf, received, prior, likelihood, limits) {
  var L = function(id) { return likelihood[id] || [1, 1, 1, 1]; };
  var certain = {};
  order.forEach(function(id) { certain[id] = isCertain(prior[id]); });

  var primary = {};   // id -> { parent, slot }
  var cond = {};      // id -> 4x4 matrix P(child state | primary parent state)
  var children = {};  // id -> uncertain children attached to it
  var roots = [];
  var logLik = 0;

  order.forEach(function(id) {
    if (certain[id] >= 0) {
      var l = L(id)[certain[id]];
      logLik += Math.log(l > 0 ? l : 1e-300);
      return;
    }
    var sex = sexOf[id];
    var srcF = slotSource(id, 'f', slotsOf, received);
    var srcM = slotSource(id, 'm', slotsOf, received);
    var uncertainF = srcF.parent !== undefined && certain[srcF.parent] < 0;
    var uncertainM = srcM.parent !== undefined && certain[srcM.parent] < 0;
    if (!uncertainF && !uncertainM) {
      roots.push(id);
      return;
    }
    if (uncertainF && uncertainM && limits) {
      limits.loop = true; // the second parent enters through its prior (approximation)
    }
    var pSlot = uncertainF ? 'f' : 'm';
    var oSlot = uncertainF ? 'm' : 'f';
    var pSrc = uncertainF ? srcF : srcM;
    var oSrc = uncertainF ? srcM : srcF;
    var other = sourceDist(mode, oSrc, oSlot, sex, prior); // fixed, certain or (approx.) prior
    var extra = deNovoBits(id, received);
    var matrix = [];
    for (var ps = 0; ps < 4; ps++) {
      var t = [0, 0, 0, 0];
      t[ps] = 1;
      matrix.push(combine(pSlot === 'f' ? transmittedFrom(mode, t, 'f', sex) : other,
                          pSlot === 'f' ? other : transmittedFrom(mode, t, 'm', sex), extra));
    }
    primary[id] = { parent: pSrc.parent, slot: pSlot };
    cond[id] = matrix;
    (children[pSrc.parent] = children[pSrc.parent] || []).push(id);
  });

  // upward pass (children before parents)
  var beta = {};
  var msg = {};  // msg[child][parentState] = sum over child states
  for (var i = order.length - 1; i >= 0; i--) {
    var id = order[i];
    if (certain[id] >= 0) continue;
    var b = L(id).slice();
    (children[id] || []).forEach(function(c) {
      for (var s = 0; s < 4; s++) b[s] *= msg[c][s];
    });
    beta[id] = b;
    if (primary[id]) {
      var m = [0, 0, 0, 0];
      for (var ps = 0; ps < 4; ps++) {
        for (var cs = 0; cs < 4; cs++) m[ps] += cond[id][ps][cs] * b[cs];
      }
      msg[id] = m;
    }
  }

  var posterior = {};
  var bad = false;
  roots.forEach(function(r) {
    var z = 0;
    var p = [0, 0, 0, 0];
    for (var s = 0; s < 4; s++) {
      p[s] = prior[r][s] * beta[r][s];
      z += p[s];
    }
    if (!(z > 0)) {
      bad = true;
      z = 1;
    }
    logLik += Math.log(z > 0 ? z : 1e-300);
    posterior[r] = p.map(function(v) { return v / z; });
  });

  // downward pass (parents before children)
  order.forEach(function(id) {
    if (certain[id] >= 0) {
      var e = [0, 0, 0, 0];
      e[certain[id]] = 1;
      posterior[id] = e;
      return;
    }
    if (!primary[id]) return; // root, done above
    var par = primary[id].parent;
    var pp = posterior[par];
    var out = [0, 0, 0, 0];
    var z = 0;
    for (var ps = 0; ps < 4; ps++) {
      if (!(pp[ps] > 0) || !(msg[id][ps] > 0)) continue;
      var f = pp[ps] / msg[id][ps];
      for (var cs = 0; cs < 4; cs++) {
        out[cs] += f * cond[id][ps][cs] * beta[id][cs];
      }
    }
    for (var s = 0; s < 4; s++) z += out[s];
    posterior[id] = z > 0 ? out.map(function(v) { return v / z; }) : prior[id];
  });

  return { likelihood: bad ? 0 : Math.exp(logLik), posterior: posterior };
};

export { MODES, computeVariantRisks, isXLinked, getParentSlots };
