/**
 * Kinship calculations used by cascade testing.
 *
 * For an index person, finds every blood relative up to a given degree, together with:
 *  - the relationship name ("Maternal aunt", "Half-brother", "Tia (lado materno)"...);
 *  - the degree of relationship (1st: parents/siblings/children, 2nd: grandparents,
 *    aunts/uncles, nieces/nephews, half-siblings..., 3rd: first cousins, great-grandparents...);
 *  - the coefficient of relationship r, i.e. the expected chance that the relative shares
 *    an autosomal heterozygous variant carried by the index person (50%, 25%, 12.5%...).
 *
 * r follows Wright's definition, r = 2 phi(a, b) / sqrt((1 + F(a)) (1 + F(b))), with the
 * kinship coefficient phi computed recursively (see makeInbreeding), so several paths
 * (consanguinity) and inbred common ancestors are both accounted for. The degree of
 * relationship comes from the shortest path through the nearest common ancestors.
 * Adopted children are not linked to their adoptive parents, since they are not blood
 * relatives. Gamete donors replace the parent of the same biological sex (or fill the open
 * parent slot); surrogates (gestational carriers) do not contribute gametes. Monozygotic
 * twins are treated as one genome.
 */

var isRealPerson = function(graph, id) {
  try {
    return graph.isPerson(id) && !graph.isPlaceholder(id) && !graph.isVirtualDummyChild(id) && !graph.isVirtualParent(id);
  } catch (e) {
    return false;
  }
};

/**
 * Biological sex of a person for genetic inheritance ('M', 'F' or 'U'): when sex assigned at
 * birth (AMAB / AFAB / UAAB, Bennett et al. 2022) is recorded, it determines the sex chromosomes
 * and gametes; otherwise the symbol's gender is used.
 */
var getGeneticSex = function(graph, id) {
  try {
    var props = (graph.getProperties && graph.getProperties(id)) || {};
    if (props.sexAtBirth === 'AMAB') return 'M';
    if (props.sexAtBirth === 'AFAB') return 'F';
    if (props.sexAtBirth === 'UAAB') return 'U';
    return graph.getGender(id) || 'U';
  } catch (e) {
    return 'U';
  }
};

/**
 * Biological parents of a person, placed in father / mother slots ('f' = sperm, 'm' = egg).
 * A gamete donor ('donor' with a line of descent to this person) replaces the parent of the same
 * biological sex, or fills the open slot of a single parent or same-sex couple; a surrogate ('S',
 * gestational carrier) does not contribute gametes and is not a biological parent. Adopted
 * persons have no biological parents here.
 */
var getParentSlots = function(graph, id) {
  var slots = { f: null, m: null };
  try {
    if (graph.isAdopted && graph.isAdopted(id)) {
      return slots;
    }
  } catch (e) {
    return slots;
  }

  var props = (graph.getProperties && graph.getProperties(id)) || {};
  var artLinks = Array.isArray(props.artLinks) ? props.artLinks : [];
  if (artLinks.length && graph.getMaxNodeId && graph.getProperties) {
    var maxId = graph.getMaxNodeId();
    for (var d = 0; d <= maxId; d++) {
      if (d === id || !isRealPerson(graph, d)) continue;
      var dp = graph.getProperties(d) || {};
      if (dp.artRole !== 'donor' || dp.artKey === undefined || dp.artKey === null) continue;
      if (artLinks.indexOf(dp.artKey) === -1) continue;
      var dg = getGeneticSex(graph, d);
      if (dg === 'M' && slots.f === null) slots.f = d;
      else if (dg === 'F' && slots.m === null) slots.m = d;
    }
  }

  var parents = [];
  try {
    parents = graph.DG.GG.getParents(id) || [];
  } catch (e) {
    parents = [];
  }
  var unknown = [];
  parents.forEach(function(p) {
    if (p === slots.f || p === slots.m) return;
    var g = getGeneticSex(graph, p);
    if (g === 'M' && slots.f === null) slots.f = p;
    else if (g === 'F' && slots.m === null) slots.m = p;
    else if (g !== 'M' && g !== 'F') unknown.push(p);
    // a second parent of the same biological sex is not placed in the other sex's slot:
    // only the first one (or the gamete donor of that sex) is the biological parent of that sex
  });
  unknown.forEach(function(p) {
    if (slots.f === null) slots.f = p;
    else if (slots.m === null) slots.m = p;
  });
  return slots;
};

var getBiologicalParents = function(graph, id) {
  var slots = getParentSlots(graph, id);
  var out = [];
  if (slots.f !== null) out.push(slots.f);
  if (slots.m !== null && slots.m !== slots.f) out.push(slots.m);
  return out;
};

/**
 * A view of the graph in which the parents who are not drawn exist as (virtual) people, for
 * sibships with at least two children: siblings on one sibship line share both parents, also when
 * only one parent, or none, is drawn. Without this, children of a single parent would count as
 * half-siblings, and a variant coming from the parent who is not drawn would never reach them.
 * Virtual people have ids above getMaxNodeId() of the real graph, no parents and no data; the sex
 * of a single missing parent is the opposite of the drawn one. Returns the graph itself when there
 * is nothing to add.
 */
var withMissingParents = function(graph) {
  if (graph.isVirtualPerson) return graph; // already a view
  var extra = {};   // child id -> [virtual parent ids]
  var virtual = {}; // virtual id -> sex
  var maxId, count = 0;
  try {
    maxId = graph.getMaxNodeId();
    var sibships = {};
    for (var id = 0; id <= maxId; id++) {
      if (!isRealPerson(graph, id) || (graph.isAdopted && graph.isAdopted(id)) || !graph.getParentRelationship) continue;
      var rel = graph.getParentRelationship(id);
      if (rel === null || rel === undefined) continue;
      (sibships[rel] = sibships[rel] || []).push(id);
    }
    Object.keys(sibships).forEach(function(rel) {
      var children = sibships[rel];
      if (children.length < 2) return;
      var known = (graph.DG.GG.getParents(children[0]) || []).filter(function(p) { return isRealPerson(graph, p); });
      if (known.length >= 2) return;
      var sexes = ['M', 'F'];
      if (known.length === 1) {
        var g = getGeneticSex(graph, known[0]);
        sexes = [g === 'M' ? 'F' : (g === 'F' ? 'M' : 'U')];
      }
      var ids = sexes.map(function(sex) {
        var v = maxId + 1 + count++;
        virtual[v] = sex;
        return v;
      });
      children.forEach(function(c) { extra[c] = ids; });
    });
  } catch (e) {
    return graph;
  }
  if (!count) return graph;
  var isVirtual = function(v) { return virtual.hasOwnProperty(v); };
  return {
    isVirtualPerson: isVirtual,
    isPerson: function(v) { return isVirtual(v) || graph.isPerson(v); },
    isPlaceholder: function(v) { return !isVirtual(v) && graph.isPlaceholder(v); },
    isVirtualDummyChild: function(v) { return !isVirtual(v) && graph.isVirtualDummyChild(v); },
    isVirtualParent: function(v) { return !isVirtual(v) && graph.isVirtualParent(v); },
    isAdopted: function(v) { return !isVirtual(v) && !!(graph.isAdopted && graph.isAdopted(v)); },
    getGender: function(v) { return isVirtual(v) ? virtual[v] : graph.getGender(v); },
    getProperties: function(v) { return isVirtual(v) ? {} : (graph.getProperties ? graph.getProperties(v) : {}); },
    getParentRelationship: function(v) { return isVirtual(v) ? null : graph.getParentRelationship(v); },
    getMaxNodeId: function() { return maxId + count; },
    DG: { GG: { getParents: function(v) {
      if (isVirtual(v)) return [];
      var parents = graph.DG.GG.getParents(v) || [];
      return extra[v] ? parents.concat(extra[v]) : parents;
    } } }
  };
};

/**
 * Maps every member of a monozygotic twin group to one representative (the lowest id), so
 * that genetic calculations treat identical twins as the same genome. Other persons map to
 * themselves.
 */
var makeTwinCanon = function(graph) {
  var rep = {};
  try {
    var groups = {};
    var maxId = graph.getMaxNodeId();
    for (var id = 0; id <= maxId; id++) {
      if (!isRealPerson(graph, id) || !graph.getProperties) continue;
      var props = graph.getProperties(id) || {};
      if (!props.monozygotic || props.twinGroup === undefined || props.twinGroup === null) continue;
      var key = graph.getParentRelationship(id) + ':' + props.twinGroup;
      groups[key] = groups.hasOwnProperty(key) ? Math.min(groups[key], id) : id;
      rep[id] = key;
    }
    Object.keys(rep).forEach(function(id) { rep[id] = groups[rep[id]]; });
  } catch (e) {
    rep = {};
  }
  return function(id) {
    return rep.hasOwnProperty(id) ? rep[id] : (typeof id === 'string' ? parseInt(id, 10) : id);
  };
};

/**
 * Returns { ancestorId: { distance: numberOfPaths } }, including the person itself at distance 0.
 */
var buildAncestorMap = function(graph, id, cache) {
  if (cache[id]) {
    return cache[id];
  }
  var result = {};
  result[id] = { 0: 1 };
  cache[id] = result; // guards against (invalid) cycles
  getBiologicalParents(graph, id).forEach(function(parent) {
    var parentMap = buildAncestorMap(graph, parent, cache);
    Object.keys(parentMap).forEach(function(anc) {
      result[anc] = result[anc] || {};
      Object.keys(parentMap[anc]).forEach(function(dist) {
        var d = parseInt(dist, 10) + 1;
        result[anc][d] = (result[anc][d] || 0) + parentMap[anc][dist];
      });
    });
  });
  return result;
};

var minDistance = function(distMap) {
  return Math.min.apply(null, Object.keys(distMap).map(function(d) { return parseInt(d, 10); }));
};

/**
 * Persons at exactly `dist` generations above the owner of `ancMap` whose parents include `ancestor`.
 */
var childrenOfAncestorOnPath = function(graph, ancMap, ancestor, dist) {
  return Object.keys(ancMap).filter(function(id) {
    return ancMap[id].hasOwnProperty(dist) &&
      getBiologicalParents(graph, parseInt(id, 10)).map(String).indexOf(String(ancestor)) !== -1;
  });
};

/**
 * Describes how `relativeId` is related to `indexId`, or returns null when they are not blood relatives.
 */
var describeKinship = function(graph, indexId, relativeId, cache) {
  var indexAnc = buildAncestorMap(graph, indexId, cache);
  var relAnc = buildAncestorMap(graph, relativeId, cache);

  var common = Object.keys(indexAnc).filter(function(a) { return relAnc.hasOwnProperty(a); });
  if (!common.length) {
    return null;
  }

  // nearest common ancestors: those that are not ancestors of another common ancestor
  var nearest = common.filter(function(c) {
    return !common.some(function(d) {
      if (d === c) {
        return false;
      }
      var dAnc = cache[d] || buildAncestorMap(graph, parseInt(d, 10), cache);
      return dAnc.hasOwnProperty(c);
    });
  });

  // Wright's coefficient of relationship from the kinship coefficient (exact with loops and
  // inbred ancestors); one kinship calculator is shared by all calls with the same cache
  if (!cache.__inbreeding) {
    cache.__inbreeding = makeInbreeding(graph);
  }
  var inb = cache.__inbreeding;
  var fi = inb.inbreeding(indexId), fr = inb.inbreeding(relativeId);
  var r = 2 * inb.kinship(indexId, relativeId) / Math.sqrt((1 + fi) * (1 + fr));
  var best = null; // closest common ancestor: { ancestor, up, down }
  nearest.forEach(function(c) {
    var up = minDistance(indexAnc[c]);
    var down = minDistance(relAnc[c]);
    if (!best || up + down < best.up + best.down) {
      best = { ancestor: c, up: up, down: down };
    }
  });

  var up = best.up;
  var down = best.down;
  var lineal = (up === 0 || down === 0);

  // Collateral relatives are "full" when they share both biological parents
  // (e.g. full siblings; half-siblings or donor-conceived siblings who share only one parent are "half").
  var full = true;
  if (!lineal) {
    var sameParents = function(a, b) {
      var pa = getBiologicalParents(graph, parseInt(a, 10));
      var pb = getBiologicalParents(graph, parseInt(b, 10));
      return pa.length === 2 && pb.length === 2 &&
        ((pa[0] === pb[0] && pa[1] === pb[1]) || (pa[0] === pb[1] && pa[1] === pb[0]));
    };
    var indexSide = childrenOfAncestorOnPath(graph, indexAnc, best.ancestor, up - 1);
    var relSide = childrenOfAncestorOnPath(graph, relAnc, best.ancestor, down - 1);
    full = indexSide.some(function(x) {
      return relSide.some(function(y) { return sameParents(x, y); });
    });
  }

  var degree = lineal ? (up + down) : (full ? up + down - 1 : up + down);

  // Paternal / maternal side, from the index's biological parent slot on the path to the common ancestor
  // (with consanguineous parents a relative can be on both sides)
  var side = '';
  if (up >= 2) {
    var sides = {};
    var indexSlots = getParentSlots(graph, indexId);
    [['f', 'paternal'], ['m', 'maternal']].forEach(function(pair) {
      var parent = indexSlots[pair[0]];
      if (parent === null) return;
      var pAnc = buildAncestorMap(graph, parent, cache);
      if (nearest.some(function(c) { return pAnc.hasOwnProperty(c); })) {
        sides[pair[1]] = true;
      }
    });
    side = (sides.paternal && sides.maternal) ? 'both' : (sides.paternal ? 'paternal' : (sides.maternal ? 'maternal' : ''));
  }

  return { up: up, down: down, full: full, degree: degree, r: r, side: side };
};

// ---------------------------------------------------------------------------------------------
// Relationship names

var pick = function(sex, male, female, unknown) {
  return sex === 'M' ? male : (sex === 'F' ? female : unknown);
};

var greats = function(n, word) {
  // n = number of "great-" prefixes
  var prefix = '';
  for (var i = 0; i < n; i++) {
    prefix += 'great-';
  }
  return prefix + word;
};

var nameEnglish = function(k, sex) {
  var u = k.up, v = k.down, half = !k.full ? 'half-' : '';
  if (u === 0) {
    if (v === 1) return pick(sex, 'Son', 'Daughter', 'Child');
    return capitalize(greats(v - 2, pick(sex, 'grandson', 'granddaughter', 'grandchild')));
  }
  if (v === 0) {
    if (u === 1) return pick(sex, 'Father', 'Mother', 'Parent');
    return capitalize(greats(u - 2, pick(sex, 'grandfather', 'grandmother', 'grandparent')));
  }
  if (u === 1 && v === 1) return capitalize(half + pick(sex, 'brother', 'sister', 'sibling'));
  if (u === 1) {
    var nib = pick(sex, 'nephew', 'niece', 'nephew/niece');
    return capitalize(half + (v === 2 ? nib : greats(v - 3, 'grand' + nib)));
  }
  if (v === 1) {
    var au = pick(sex, 'uncle', 'aunt', 'uncle/aunt');
    return capitalize(half + (u === 2 ? au : greats(u - 2, au)));
  }
  var cousinNumber = Math.min(u, v) - 1;
  var removed = Math.abs(u - v);
  var ordinals = ['', 'First', 'Second', 'Third', 'Fourth'];
  var name = (ordinals[cousinNumber] || (cousinNumber + 'th')) + ' ' + (half ? 'half-' : '') + 'cousin';
  if (removed === 1) name += ' once removed';
  if (removed === 2) name += ' twice removed';
  if (removed > 2) name += ' ' + removed + ' times removed';
  return name;
};

var namePortuguese = function(k, sex) {
  var u = k.up, v = k.down;
  var half = !k.full;
  var meio = function(m, f, x) {
    if (!half) return pick(sex, m, f, x);
    return pick(sex, 'meio-' + m, 'meia-' + f, 'meio(a)-' + x);
  };
  if (u === 0) {
    if (v === 1) return pick(sex, 'Filho', 'Filha', 'Filho(a)');
    if (v === 2) return pick(sex, 'Neto', 'Neta', 'Neto(a)');
    if (v === 3) return pick(sex, 'Bisneto', 'Bisneta', 'Bisneto(a)');
    return pick(sex, 'Trineto', 'Trineta', 'Trineto(a)');
  }
  if (v === 0) {
    if (u === 1) return pick(sex, 'Pai', 'Mãe', 'Genitor(a)');
    if (u === 2) return pick(sex, 'Avô', 'Avó', 'Avô/avó');
    if (u === 3) return pick(sex, 'Bisavô', 'Bisavó', 'Bisavô/bisavó');
    return pick(sex, 'Trisavô', 'Trisavó', 'Trisavô/trisavó');
  }
  if (u === 1 && v === 1) return capitalize(meio('irmão', 'irmã', 'irmão(ã)'));
  if (u === 1 && v === 2) return capitalize(meio('sobrinho', 'sobrinha', 'sobrinho(a)'));
  if (u === 1 && v === 3) return capitalize(meio('sobrinho-neto', 'sobrinha-neta', 'sobrinho(a)-neto(a)'));
  if (u === 2 && v === 1) return capitalize(meio('tio', 'tia', 'tio(a)'));
  if (u === 3 && v === 1) return capitalize(meio('tio-avô', 'tia-avó', 'tio(a)-avô(ó)'));
  if (u === 2 && v === 2) return capitalize(meio('primo', 'prima', 'primo(a)')) + ' de primeiro grau';
  if (u === 2 && v === 3) return pick(sex, 'Filho', 'Filha', 'Filho(a)') + ' de ' + (half ? 'meio(a)-' : '') + 'primo(a) de primeiro grau';
  if (u === 3 && v === 2) return capitalize(meio('primo', 'prima', 'primo(a)')) + ' do pai/mãe';
  return 'Parente';
};

var capitalize = function(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
};

var relationshipName = function(kinship, sex, lang) {
  var pt = (lang === 'pt-BR');
  var name = pt ? namePortuguese(kinship, sex) : nameEnglish(kinship, sex);
  if (kinship.side === 'both') {
    name += pt ? ' (ambos os lados)' : ' (both sides)';
  } else if (kinship.side) {
    if (pt) {
      name += kinship.side === 'paternal' ? ' (lado paterno)' : ' (lado materno)';
    } else {
      name = (kinship.side === 'paternal' ? 'Paternal ' : 'Maternal ') + name.charAt(0).toLowerCase() + name.slice(1);
    }
  }
  return name;
};

/**
 * Lists the blood relatives of indexId up to maxDegree, closest first.
 *
 * @return {Array} [{ id, up, down, full, degree, r, side }]
 */
var findBloodRelatives = function(graph, indexId, maxDegree) {
  var cache = {};
  var result = [];
  var maxId = graph.getMaxNodeId();
  // parents who are not drawn still make the children of one sibship full siblings
  var view = withMissingParents(graph);
  for (var id = 0; id <= maxId; id++) {
    if (id === indexId || !isRealPerson(graph, id)) {
      continue;
    }
    var k = describeKinship(view, indexId, id, cache);
    if (k && k.degree >= 1 && k.degree <= maxDegree) {
      k.id = id;
      result.push(k);
    }
  }
  result.sort(function(a, b) { return (a.degree - b.degree) || (b.r - a.r) || (a.id - b.id); });
  return result;
};

// ---------------------------------------------------------------------------------------------
// Wright's coefficient of inbreeding

/**
 * Kinship (coancestry) and inbreeding for one graph, computed recursively with memoization:
 *   phi(a, a) = (1 + F(a)) / 2
 *   phi(a, b) = (phi(father of x, y) + phi(mother of x, y)) / 2, where x is whichever of a, b is
 *               not an ancestor of the other (unknown parents are unrelated founders)
 *   F(x)      = phi(father of x, mother of x)
 * so inbred common ancestors are accounted for. Adopted people are not linked to their adoptive
 * parents. Monozygotic twins are one genome: phi(twin 1, twin 2) = (1 + F) / 2, and a twin is
 * treated as a parent of the co-twin's children. F of a child of a couple = phi(partner 1,
 * partner 2); the coefficient of relationship of the couple is r = 2 phi (when the partners are
 * not inbred themselves).
 */
var makeInbreeding = function(graph) {
  var ancCache = {}, phiMemo = {}, fMemo = {};
  var canon = makeTwinCanon(graph);
  // is a (as a genome) an ancestor of b?
  var isAncestor = function(a, b) {
    if (canon(a) === canon(b)) return false;
    var anc = buildAncestorMap(graph, b, ancCache);
    return Object.keys(anc).some(function(k) { return canon(k) === canon(a); });
  };
  var F = function(x) {
    x = canon(x);
    if (fMemo.hasOwnProperty(x)) return fMemo[x];
    fMemo[x] = 0; // guards against (invalid) cycles
    var p = getBiologicalParents(graph, x);
    var v = p.length === 2 ? phi(p[0], p[1]) : 0;
    fMemo[x] = v;
    return v;
  };
  var phi = function(a, b) {
    a = canon(a);
    b = canon(b);
    if (a === b) return (1 + F(a)) / 2;
    var key = a < b ? a + '|' + b : b + '|' + a;
    if (phiMemo.hasOwnProperty(key)) return phiMemo[key];
    phiMemo[key] = 0;
    var x = a, y = b;
    if (isAncestor(a, b)) { x = b; y = a; }
    var v = 0;
    getBiologicalParents(graph, x).forEach(function(parent) { v += phi(parent, y) / 2; });
    phiMemo[key] = v;
    return v;
  };
  return { kinship: phi, inbreeding: F };
};

/** F of a child of these two people */
var inbreedingOfChildren = function(graph, partner1, partner2) {
  return makeInbreeding(graph).kinship(partner1, partner2);
};

/** F of a person (from the relationship between the parents) */
/**
 * Whether a couple is shown as consanguineous: the user's choice on the couple (Yes / No) wins over
 * automatic detection (common ancestors drawn in the pedigree), as in the double relationship line.
 */
var coupleIsConsanguineous = function(graph, relId) {
  var node = (typeof editor !== 'undefined' && editor && editor.getNode) ? editor.getNode(relId) : null;
  if (node && node.isArtLink && node.isArtLink()) return false;
  try { if (graph.getProperties && (graph.getProperties(relId) || {}).artLink) return false; } catch (e) {}
  var pref = (node && node.getConsanguinity) ? node.getConsanguinity() : 'A';
  if (pref === 'Y') return true;
  if (pref === 'N') return false;
  try { return graph.isConsangrRelationship(relId); } catch (e) { return false; }
};

var inbreedingOf = function(graph, id) {
  return makeInbreeding(graph).inbreeding(id);
};

/**
 * "1/16 (6.25%)" in English, "1/16 (6,25%)" in Portuguese; a fraction only when it is exact
 * (powers of two up to 1/4096), otherwise the percentage alone.
 */
var formatCoefficient = function(value, lang) {
  if (!(value > 0)) return '0';
  var fraction = '';
  for (var den = 2; den <= 4096; den *= 2) {
    var num = value * den;
    if (Math.abs(num - Math.round(num)) < 1e-9) {
      var n = Math.round(num), d = den;
      while (n % 2 === 0 && d > 1) { n /= 2; d /= 2; }
      fraction = n + '/' + d;
      break;
    }
  }
  var pct = value * 100;
  var digits = pct >= 10 ? 1 : (pct >= 1 ? 2 : 3);
  var pctText = parseFloat(pct.toFixed(digits)).toString();
  if (lang === 'pt-BR') pctText = pctText.replace('.', ',');
  return fraction ? fraction + ' (' + pctText + '%)' : pctText + '%';
};

export { findBloodRelatives, describeKinship, relationshipName, isRealPerson, getGeneticSex, getParentSlots, getBiologicalParents,
  makeInbreeding, makeTwinCanon, withMissingParents, inbreedingOfChildren, inbreedingOf, formatCoefficient, coupleIsConsanguineous };
