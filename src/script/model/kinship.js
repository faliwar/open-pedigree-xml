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
 * r is the sum of (1/2)^(n1+n2) over all paths through the nearest common ancestors,
 * so consanguinity (several paths) is accounted for. Adopted children are not linked
 * to their adoptive parents, since they are not blood relatives.
 */

var isRealPerson = function(graph, id) {
  try {
    return graph.isPerson(id) && !graph.isPlaceholder(id) && !graph.isVirtualDummyChild(id) && !graph.isVirtualParent(id);
  } catch (e) {
    return false;
  }
};

var getBiologicalParents = function(graph, id) {
  try {
    if (graph.isAdopted(id)) {
      return [];
    }
    return graph.DG.GG.getParents(id);
  } catch (e) {
    return [];
  }
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

  var r = 0;
  var best = null; // closest common ancestor: { ancestor, up, down }
  nearest.forEach(function(c) {
    Object.keys(indexAnc[c]).forEach(function(d1) {
      Object.keys(relAnc[c]).forEach(function(d2) {
        r += indexAnc[c][d1] * relAnc[c][d2] * Math.pow(0.5, parseInt(d1, 10) + parseInt(d2, 10));
      });
    });
    var up = minDistance(indexAnc[c]);
    var down = minDistance(relAnc[c]);
    if (!best || up + down < best.up + best.down) {
      best = { ancestor: c, up: up, down: down };
    }
  });

  var up = best.up;
  var down = best.down;
  var lineal = (up === 0 || down === 0);

  // Collateral relatives are "full" when the two lines split from the same union
  // (e.g. full siblings share their parents' relationship), otherwise "half".
  var full = true;
  if (!lineal) {
    var indexSide = childrenOfAncestorOnPath(graph, indexAnc, best.ancestor, up - 1);
    var relSide = childrenOfAncestorOnPath(graph, relAnc, best.ancestor, down - 1);
    full = indexSide.some(function(x) {
      var relX = graph.getParentRelationship(parseInt(x, 10));
      return relSide.some(function(y) {
        return relX !== null && relX === graph.getParentRelationship(parseInt(y, 10));
      });
    });
  }

  var degree = lineal ? (up + down) : (full ? up + down - 1 : up + down);

  // Paternal / maternal side, from the index's parent on the path to the common ancestor
  // (with consanguineous parents a relative can be on both sides)
  var side = '';
  if (up >= 2) {
    var sides = {};
    getBiologicalParents(graph, indexId).forEach(function(parent) {
      var pAnc = buildAncestorMap(graph, parent, cache);
      var reaches = nearest.some(function(c) { return pAnc.hasOwnProperty(c); });
      var g = graph.getGender(parent);
      if (reaches && (g === 'M' || g === 'F')) {
        sides[g === 'M' ? 'paternal' : 'maternal'] = true;
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
  for (var id = 0; id <= maxId; id++) {
    if (id === indexId || !isRealPerson(graph, id)) {
      continue;
    }
    var k = describeKinship(graph, indexId, id, cache);
    if (k && k.degree >= 1 && k.degree <= maxDegree) {
      k.id = id;
      result.push(k);
    }
  }
  result.sort(function(a, b) { return (a.degree - b.degree) || (b.r - a.r) || (a.id - b.id); });
  return result;
};

export { findBloodRelatives, describeKinship, relationshipName, isRealPerson };
