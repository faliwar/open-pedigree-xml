import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { findBloodRelatives, relationshipName, isRealPerson, getBiologicalParents, inbreedingOf, formatCoefficient } from 'pedigree/model/kinship';
import { classificationInfo, compactAge, normalizeAncestry } from 'pedigree/model/clinicalData';
import getAge from 'pedigree/view/ageCalc';
import { toPortuguese } from 'pedigree/i18n';

/**
 * Family history as a list for the medical record, one line per relative (or per group of
 * relatives with nothing recorded), in clinical order, e.g.
 *   - Pais não consanguíneos. Ancestralidade: pai Europeia (não finlandesa); mãe Africana.
 *   - Pai, 65 anos, Diabetes, Depressão
 *   - Irmão Fulano, 35 anos, sem condições registradas. Possui 1 filho: menino de 1 ano, sem comorbidades conhecidas.
 *   - Avó materna, falecida aos 80 anos, Doença de Alzheimer
 *   - 3 tios e 1 tia (lado paterno), sem condições registradas.
 *
 * Each line has the age (or age at death), the conditions with age at diagnosis, genetic test
 * results, phenotypes, carrier marks and the free-text comments of the person. Children of
 * siblings, of the proband and of uncles/aunts are summarized in their parent's line.
 * The language is chosen independently of the interface ('en' or 'pt-BR').
 */

var W = {
  en: {
    and: 'and', dx: 'dx', onset: 'onset', contralateral: 'contralateral',
    years: ['year', 'years'], months: ['month', 'months'], weeks: ['week', 'weeks'], days: ['day', 'days'],
    diedAt: { M: 'died at', F: 'died at', U: 'died at' }, deceased: { M: 'deceased', F: 'deceased', U: 'deceased' },
    nothing: 'no conditions recorded', noKnown: 'no known conditions',
    parentsNot: 'Non-consanguineous parents.', parentsYes: 'Consanguineous parents.',
    parentsYesF: "Consanguineous parents (proband's inbreeding coefficient F = {f}).",
    ancestry: 'Ancestry', father: 'Father', mother: 'Mother', fatherLc: 'father', motherLc: 'mother',
    proband: { M: 'Proband', F: 'Proband', U: 'Proband' },
    partner: { M: 'Partner of the proband', F: 'Partner of the proband', U: 'Partner of the proband' },
    other: 'Not blood-related',
    hasChildren: function(n) { return n === 1 ? 'Has 1 child' : 'Has ' + n + ' children'; },
    totalChildren: function(n) { return n === 1 ? '1 child in total' : n + ' children in total'; },
    child: function(sex, age) {
      if (age !== null && age < 18) return sex === 'M' ? 'a boy' : (sex === 'F' ? 'a girl' : 'a child');
      return sex === 'M' ? 'a son' : (sex === 'F' ? 'a daughter' : 'a child');
    },
    aged: function(noun, age) { return noun + ' aged ' + age; },
    childDied: function(noun, text) { return noun + ' who ' + (text === 'deceased' ? 'died' : text); },
    stillborn: 'a stillbirth', miscarriage: 'a miscarriage', unborn: 'an ongoing pregnancy', aborted: 'a terminated pregnancy',
    grand: function(sex, side) { return (side === 'paternal' ? 'Paternal ' : (side === 'maternal' ? 'Maternal ' : '')) + (sex === 'M' ? 'grandfather' : (sex === 'F' ? 'grandmother' : 'grandparent')); },
    uncle: function(sex, side) { return (side === 'paternal' ? 'Paternal ' : (side === 'maternal' ? 'Maternal ' : '')) + (sex === 'M' ? 'uncle' : (sex === 'F' ? 'aunt' : 'uncle/aunt')); },
    uncleGroup: function(m, f, u, side) {
      var parts = [];
      if (m) parts.push(m + ' ' + (m === 1 ? 'uncle' : 'uncles'));
      if (f) parts.push(f + ' ' + (f === 1 ? 'aunt' : 'aunts'));
      if (u) parts.push(u + ' ' + (u === 1 ? 'uncle/aunt' : 'uncles/aunts'));
      var sideText = side === 'paternal' ? ' (paternal side)' : (side === 'maternal' ? ' (maternal side)' : '');
      return joinList(parts, 'and') + sideText;
    },
    carrier: 'carrier', presymptomatic: 'pre-symptomatic', features: 'features',
    unspecified: 'affected (condition not specified)', adopted: 'adopted',
    declined: 'declined {g} testing', pending: 'result pending', causeOfDeath: 'Cause of death:',
    laterality: { Left: 'left', Right: 'right', Bilateral: 'bilateral' },
    classes: { P: 'pathogenic', LP: 'likely pathogenic', POS: 'positive', VUS: 'VUS', LB: 'likely benign', B: 'benign', NEG: 'negative' }
  },
  'pt-BR': {
    and: 'e', dx: 'dx', onset: 'início', contralateral: 'contralateral',
    years: ['ano', 'anos'], months: ['mês', 'meses'], weeks: ['semana', 'semanas'], days: ['dia', 'dias'],
    diedAt: { M: 'falecido aos', F: 'falecida aos', U: 'falecido(a) aos' }, deceased: { M: 'falecido', F: 'falecida', U: 'falecido(a)' },
    nothing: 'sem condições registradas', noKnown: 'sem comorbidades conhecidas',
    parentsNot: 'Pais não consanguíneos.', parentsYes: 'Pais consanguíneos.',
    parentsYesF: 'Pais consanguíneos (coeficiente de endogamia do probando F = {f}).',
    ancestry: 'Ancestralidade', father: 'Pai', mother: 'Mãe', fatherLc: 'pai', motherLc: 'mãe',
    proband: { M: 'Probando', F: 'Probanda', U: 'Probando(a)' },
    partner: { M: 'Parceiro do(a) probando', F: 'Parceira do(a) probando', U: 'Parceiro(a) do(a) probando' },
    other: 'Não consanguíneo(a)',
    hasChildren: function(n) { return n === 1 ? 'Possui 1 filho(a)' : 'Possui ' + n + ' filhos'; },
    totalChildren: function(n) { return n === 1 ? '1 filho(a) no total' : n + ' filhos no total'; },
    child: function(sex, age) {
      if (age !== null && age < 18) return sex === 'M' ? 'menino' : (sex === 'F' ? 'menina' : 'criança');
      return sex === 'M' ? 'filho' : (sex === 'F' ? 'filha' : 'filho(a)');
    },
    aged: function(noun, age) { return noun + ' de ' + age; },
    childDied: function(noun, text) { return noun + ' ' + text; },
    stillborn: 'natimorto', miscarriage: 'aborto espontâneo', unborn: 'gestação em curso', aborted: 'interrupção da gestação',
    grand: function(sex, side) {
      var s = side === 'paternal' ? (sex === 'F' ? ' paterna' : ' paterno') : (side === 'maternal' ? (sex === 'F' ? ' materna' : ' materno') : '');
      return (sex === 'M' ? 'Avô' : (sex === 'F' ? 'Avó' : 'Avô/avó')) + s;
    },
    uncle: function(sex, side) {
      var s = side === 'paternal' ? (sex === 'F' ? ' paterna' : ' paterno') : (side === 'maternal' ? (sex === 'F' ? ' materna' : ' materno') : '');
      return (sex === 'M' ? 'Tio' : (sex === 'F' ? 'Tia' : 'Tio(a)')) + s;
    },
    uncleGroup: function(m, f, u, side) {
      var parts = [];
      if (m) parts.push(m + ' ' + (m === 1 ? 'tio' : 'tios'));
      if (f) parts.push(f + ' ' + (f === 1 ? 'tia' : 'tias'));
      if (u) parts.push(u + ' ' + (u === 1 ? 'tio(a)' : 'tios(as)'));
      var sideText = side === 'paternal' ? ' (lado paterno)' : (side === 'maternal' ? ' (lado materno)' : '');
      return joinList(parts, 'e') + sideText;
    },
    carrier: 'portador(a)', presymptomatic: 'pré-sintomático(a)', features: 'achados',
    unspecified: 'afetado(a) (condição não especificada)', adopted: 'adotado(a)',
    declined: 'recusou teste de {g}', pending: 'resultado pendente', causeOfDeath: 'Causa do óbito:',
    laterality: { Left: 'esquerda', Right: 'direita', Bilateral: 'bilateral' },
    classes: { P: 'patogênica', LP: 'provavelmente patogênica', POS: 'positivo', VUS: 'VUS', LB: 'provavelmente benigna', B: 'benigna', NEG: 'negativo' }
  }
};

var str = function(v) {
  return (v === undefined || v === null) ? '' : String(v).trim();
};

var capitalize = function(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
};

var joinList = function(items, and) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' ' + and + ' ' + items[items.length - 1];
};

var sexOf = function(node) {
  return (node && node.getGender && node.getGender()) || 'U';
};

// "42 y" / "8 mo" / "3 wk" / "5 days" (ageCalc) -> "42 anos" / "8 meses" / ...
var longAge = function(text, w) {
  var m = str(text).match(/^(\d+)\s*(y|yrs?|mo|wk|days?|day)$/i);
  if (!m) return str(text);
  var n = parseInt(m[1], 10);
  var unit = m[2].toLowerCase();
  var forms = unit.charAt(0) === 'y' ? w.years : (unit === 'mo' ? w.months : (unit === 'wk' ? w.weeks : w.days));
  return n + ' ' + forms[n === 1 ? 0 : 1];
};

// "51 yrs", "51y", "51" -> "51a" / "51y" (compact, inside a condition)
var diagnosisAge = function(value, w) {
  var c = compactAge(value);
  return /^\d+y$/.test(c) ? c.replace(/y$/, w === W['pt-BR'] ? 'a' : 'y') : str(value);
};

/** { text: "65 anos" | "falecida aos 80 anos" | "falecido" | "", years: number|null } */
var ageOf = function(node, w) {
  var status = (node.getLifeStatus && node.getLifeStatus()) || 'alive';
  var birth = node.getBirthDate && node.getBirthDate();
  var death = node.getDeathDate && node.getDeathDate();
  var sex = sexOf(node);
  var years = null;
  if (birth && birth.getTime) {
    var end = (status === 'deceased' && death && death.getTime) ? death : new Date();
    years = (end.getTime() - birth.getTime()) / (365.25 * 24 * 3600 * 1000);
  }
  if (status === 'alive') {
    return { text: (birth && birth.getTime) ? longAge(getAge(birth, null), w) : '', years: years };
  }
  if (status === 'deceased') {
    var age = '';
    if (birth && birth.getTime && death && death.getTime) {
      age = longAge(getAge(birth, death), w);
    } else if (node.getAgeAtDeath && str(node.getAgeAtDeath())) {
      var a = str(node.getAgeAtDeath());
      age = /^\d{1,3}$/.test(a) ? a + ' ' + w.years[a === '1' ? 0 : 1] : longAge(a, w);
      if (/^\d{1,3}$/.test(a)) years = parseInt(a, 10);
    }
    return { text: age ? w.diedAt[sex] + ' ' + age : w.deceased[sex], years: years };
  }
  return { text: '', years: years };
};

var disorderName = function(id, w) {
  if (id === 'affected') return w.unspecified;
  try {
    var d = editor.getDisorderLegend().getDisorder(id);
    return (d && d.getName && d.getName()) || id;
  } catch (e) {
    return id;
  }
};

var hpoName = function(id) {
  try {
    var t = editor.getHPOLegend().getTerm(id);
    return (t && t.getName && t.getName()) || id;
  } catch (e) {
    return id;
  }
};

/** "BRCA1 c.68_69del, patogênica", "declined MSH2 testing" */
var describeTest = function(t, w) {
  var info = classificationInfo(t.classification);
  if (info.code === 'DECLINED') return w.declined.replace('{g}', t.gene);
  return t.gene + (t.variant ? ' ' + t.variant : '') + ', ' + (w.classes[info.code] || w.pending);
};

/**
 * What is recorded for a person, as phrases: conditions (with age at diagnosis and laterality),
 * test results, phenotypes, carrier marks and the free-text comments.
 */
var clinicalPhrases = function(node, w) {
  var out = [];
  ((node.getDisorders && node.getDisorders()) || []).forEach(function(d) {
    var detail = (d !== 'affected' && node.getDisorderDetail) ? node.getDisorderDetail(d) : null;
    var details = [];
    if (detail) {
      var lat = (detail.fields || []).filter(function(f) { return /^(breast|laterality)$/i.test(f.name) && w.laterality[f.value]; })[0];
      if (lat) details.push(w.laterality[lat.value]);
      if (str(detail.atdiag)) details.push(w.dx + ' ' + diagnosisAge(detail.atdiag, w));
      else if (str(detail.onset)) details.push(w.onset + ' ' + diagnosisAge(detail.onset, w));
      var contra = (detail.fields || []).filter(function(f) { return /^contralateral age$/i.test(f.name) && str(f.value); })[0];
      if (contra) details.push(w.contralateral + ' ' + w.dx + ' ' + diagnosisAge(contra.value, w));
    }
    out.push(disorderName(d, w) + (details.length ? ' (' + details.join('; ') + ')' : ''));
  });
  var tests = ((node.getGeneticTests && node.getGeneticTests()) || []).map(function(t) { return describeTest(t, w); });
  out = out.concat(tests);
  var hpo = (node.getHPO && node.getHPO()) || [];
  if (hpo.length) out.push(w.features + ': ' + hpo.map(hpoName).join(', '));
  var cs = node.getCarrierStatus && node.getCarrierStatus();
  if (!tests.length && cs === 'carrier') out.push(w.carrier);
  if (cs === 'presymptomatic') out.push(w.presymptomatic);
  if (node.isAdopted && node.isAdopted()) out.push(w.adopted);
  // free-text comments, one phrase per line ("Cause of death:" from imported files translated)
  str(node.getComments && node.getComments()).split(/\r?\n/).forEach(function(line) {
    var l = line.trim().replace(/^Cause of death:\s*/i, w.causeOfDeath + ' ').replace(/[.;]\s*$/, '');
    if (l) out.push(l);
  });
  return out;
};

/**
 * One line: "Irmão Fulano, 35 anos, Câncer de mama (dx 30a)." The label already carries the
 * relationship; the name is added when asked for.
 */
var personLine = function(label, node, w, options, emptyText, skipAncestry) {
  var head = label + (options.includeName && node.getFirstName && str(node.getFirstName()) ? ' ' + str(node.getFirstName()) : '');
  var parts = [];
  // ancestry of this person (the parents' goes in the first line instead)
  if (!skipAncestry) {
    var anc = normalizeAncestry(node.getAncestry ? node.getAncestry() : []);
    if (anc.length) parts.push(anc.map(function(a) { return w === W['pt-BR'] ? toPortuguese(a) : a; }).join(', '));
  }
  var age = ageOf(node, w).text;
  if (age) parts.push(age);
  var clinical = clinicalPhrases(node, w);
  if (clinical.length) parts = parts.concat(clinical);
  else if (emptyText) parts.push(emptyText);
  return head + (parts.length ? ', ' + parts.join(', ') : '');
};

/** "menina de 14 anos", "filho falecido aos 2 dias (malformação)", "natimorto" */
var childPhrase = function(node, w) {
  var status = (node.getLifeStatus && node.getLifeStatus()) || 'alive';
  if (status === 'stillborn' || status === 'miscarriage' || status === 'unborn' || status === 'aborted') {
    var base = w[status];
    var c = clinicalPhrases(node, w);
    return base + (c.length ? ' (' + c.join(', ') + ')' : '');
  }
  var age = ageOf(node, w);
  var noun = w.child(sexOf(node), age.years);
  var text;
  if (status === 'deceased') {
    text = w.childDied(noun, age.text);
  } else if (age.text) {
    text = w.aged(noun, age.text);
  } else {
    text = noun;
  }
  var clinical = clinicalPhrases(node, w);
  return text + (clinical.length ? ' (' + clinical.join(', ') + ')' : '');
};

var hasFindings = function(node, w) {
  return clinicalPhrases(node, w).length > 0;
};

/** "Possui 2 filhos: menina de 14 anos e menino de 2 anos, sem comorbidades conhecidas." */
var childrenSentence = function(childIds, w, ordered) {
  var kids = ordered(childIds).map(function(id) { return editor.getNode(id); }).filter(Boolean);
  if (!kids.length) return '';
  var phrases = kids.map(function(k) { return childPhrase(k, w); });
  var anyFindings = kids.some(function(k) { return hasFindings(k, w); });
  var allLiving = kids.every(function(k) { return ((k.getLifeStatus && k.getLifeStatus()) || 'alive') === 'alive'; });
  return w.hasChildren(kids.length) + ': ' + joinList(phrases, w.and) + (!anyFindings && allLiving ? ', ' + w.noKnown : '') + '.';
};

/**
 * @param {Object} options
 *   lang            'en' | 'pt-BR'
 *   maxDegree       1, 2, 3 or 99 (all blood relatives)
 *   listUnaffected  include relatives with nothing recorded (grouped when they are uncles/aunts)
 *   includeName     add first names
 *   includeProband  add a line for the proband
 * @return {String} lines starting with "- "
 */
var buildFamilySummary = function(options) {
  options = options || {};
  var lang = options.lang === 'pt-BR' ? 'pt-BR' : 'en';
  var w = W[lang];
  var maxDegree = options.maxDegree || 99;
  var listUnaffected = options.listUnaffected !== false;
  var graph = editor.getGraph();
  var numbering = computeStandardNumbering(editor);
  var probandId = graph.getProbandId();
  var proband = editor.getNode(probandId);
  var lines = [];

  // left-to-right order of the chart
  var ordered = function(ids) {
    return ids.slice().sort(function(a, b) {
      var na = numbering.byId[a] || { generation: 99, index: a }, nb = numbering.byId[b] || { generation: 99, index: b };
      return (na.generation - nb.generation) || (na.index - nb.index);
    });
  };
  var childrenOf = function(id) {
    var kids = [];
    try { kids = graph.getAllChildren(id) || []; } catch (e) {}
    return kids.filter(function(k) { return isRealPerson(graph, k) && getBiologicalParents(graph, k).map(String).indexOf(String(id)) !== -1; });
  };

  // every blood relative with the kinship; the groups below take them out as they are written
  var relatives = findBloodRelatives(graph, probandId, 99);
  var byId = {};
  relatives.forEach(function(k) { byId[k.id] = k; });
  var written = {};
  written[probandId] = true;
  var within = function(k) { return k.degree <= maxDegree; };

  if (options.includeProband && proband) {
    lines.push(personLine(w.proband[sexOf(proband)], proband, w, options, ''));
  }

  // parents: consanguinity and ancestry
  var parents = getBiologicalParents(graph, probandId).filter(function(p) { return isRealPerson(graph, p); });
  var father = parents.filter(function(p) { return graph.getGender(p) === 'M'; })[0];
  var mother = parents.filter(function(p) { return graph.getGender(p) === 'F'; })[0];
  if (parents.length) {
    var first = '';
    var rel = graph.getParentRelationship(probandId);
    if (parents.length === 2 && rel !== null && rel !== undefined) {
      // the user's choice on the couple (Yes / No) wins over automatic detection, as in the drawing
      var consang = false;
      var relNode = editor.getNode(rel);
      var pref = (relNode && relNode.getConsanguinity) ? relNode.getConsanguinity() : 'A';
      if (pref === 'Y') {
        consang = true;
      } else if (pref !== 'N') {
        try { consang = graph.isConsangrRelationship(rel); } catch (e) {}
      }
      if (consang) {
        var f = inbreedingOf(graph, probandId);
        first = f > 0 ? w.parentsYesF.replace('{f}', formatCoefficient(f, lang)) : w.parentsYes;
      } else {
        first = w.parentsNot;
      }
    }
    var anc = [];
    [[father, w.fatherLc], [mother, w.motherLc]].forEach(function(pair) {
      var node = pair[0] !== undefined ? editor.getNode(pair[0]) : null;
      var list = normalizeAncestry(node && node.getAncestry ? node.getAncestry() : []);
      if (list.length) anc.push(pair[1] + ' ' + list.map(function(a) { return lang === 'pt-BR' ? toPortuguese(a) : a; }).join(', '));
    });
    if (anc.length) first += (first ? ' ' : '') + w.ancestry + ': ' + anc.join('; ') + '.';
    if (first) lines.push(first);
  }

  // father, mother
  [[father, w.father], [mother, w.mother]].forEach(function(pair) {
    if (pair[0] === undefined || !byId[pair[0]] || !within(byId[pair[0]])) return;
    var node = editor.getNode(pair[0]);
    written[pair[0]] = true;
    if (!listUnaffected && !hasFindings(node, w)) return;
    lines.push(personLine(pair[1], node, w, options, w.nothing, true));
  });
  // a parent of unknown sex
  parents.forEach(function(p) {
    if (written[p] || !byId[p] || !within(byId[p])) return;
    written[p] = true;
    lines.push(personLine(capitalize(relationshipName(byId[p], 'U', lang)), editor.getNode(p), w, options, w.nothing));
  });

  // siblings (with their children) and the proband's children (with grandchildren)
  var firstDegree = function(test) {
    return ordered(relatives.filter(function(k) { return test(k) && within(k); }).map(function(k) { return k.id; }));
  };
  var withKids = function(ids) {
    ids.forEach(function(id) {
      var node = editor.getNode(id);
      written[id] = true;
      var kids = childrenOf(id).filter(function(c) { return byId[c] && within(byId[c]); });
      kids.forEach(function(c) { written[c] = true; });
      var kidsFindings = kids.some(function(c) { return hasFindings(editor.getNode(c), w); });
      if (!listUnaffected && !hasFindings(node, w) && !kidsFindings) return;
      var line = personLine(capitalize(relationshipName(byId[id], sexOf(node), lang)), node, w, options, w.nothing);
      if (kids.length) line += '. ' + childrenSentence(kids, w, ordered);
      lines.push(line);
    });
  };
  withKids(firstDegree(function(k) { return k.up === 1 && k.down === 1; }));
  withKids(firstDegree(function(k) { return k.up === 0 && k.down === 1; }));

  // each side: grandparents, then uncles/aunts (with cousins); the ones with nothing recorded grouped
  ['maternal', 'paternal', ''].forEach(function(side) {
    var sideOf = function(k) { return side === '' ? (k.side !== 'maternal' && k.side !== 'paternal') : k.side === side; };
    // grandmother first, as usually written
    firstDegree(function(k) { return k.up === 2 && k.down === 0 && sideOf(k); }).sort(function(a, b) {
      return (graph.getGender(a) === 'F' ? 0 : 1) - (graph.getGender(b) === 'F' ? 0 : 1);
    }).forEach(function(id) {
      var node = editor.getNode(id);
      written[id] = true;
      if (!listUnaffected && !hasFindings(node, w)) return;
      lines.push(personLine(w.grand(sexOf(node), side), node, w, options, w.nothing));
    });
    var group = { M: 0, F: 0, U: 0, kids: 0, kidsDetails: false };
    firstDegree(function(k) { return k.up === 2 && k.down === 1 && sideOf(k); }).forEach(function(id) {
      var node = editor.getNode(id);
      written[id] = true;
      var kids = childrenOf(id).filter(function(c) { return byId[c] && within(byId[c]); });
      kids.forEach(function(c) { written[c] = true; });
      var kidsWithFindings = kids.filter(function(c) { return hasFindings(editor.getNode(c), w); });
      // own line when something is recorded about them or their children, or when they died
      var died = (node.getLifeStatus && node.getLifeStatus()) === 'deceased';
      if (hasFindings(node, w) || kidsWithFindings.length || died || !byId[id].full) {
        var label = byId[id].full ? w.uncle(sexOf(node), side) : capitalize(relationshipName(byId[id], sexOf(node), lang));
        var line = personLine(label, node, w, options, w.nothing);
        if (kids.length) line += '. ' + childrenSentence(kids, w, ordered);
        lines.push(line);
      } else {
        group[sexOf(node)]++;
        group.kids += kids.length;
      }
    });
    if (listUnaffected && (group.M + group.F + group.U)) {
      var gl = capitalize(w.uncleGroup(group.M, group.F, group.U, side)) + ', ' + w.nothing;
      if (group.kids) gl += '. ' + capitalize(w.totalChildren(group.kids)) + ', ' + w.noKnown;
      lines.push(gl + '.');
    }
  });

  // other blood relatives with findings (great-grandparents, nieces/nephews' children...)
  ordered(relatives.filter(function(k) { return within(k) && !written[k.id]; }).map(function(k) { return k.id; })).forEach(function(id) {
    var node = editor.getNode(id);
    if (!node || !hasFindings(node, w)) return;
    written[id] = true;
    lines.push(personLine(capitalize(relationshipName(byId[id], sexOf(node), lang)), node, w, options, ''));
  });

  // not blood relatives with findings (e.g. a partner with cancer)
  var partners = [];
  try { partners = graph.DG.GG.getAllPartners(probandId).map(String); } catch (e) {}
  for (var id = 0; id <= graph.getMaxNodeId(); id++) {
    if (!isRealPerson(graph, id) || written[id] || byId[id]) continue;
    var node = editor.getNode(id);
    if (!node || !hasFindings(node, w)) continue;
    var label = partners.indexOf(String(id)) !== -1 ? w.partner[sexOf(node)] : w.other + ' (' + ((numbering.byId[id] && numbering.byId[id].label) || '') + ')';
    lines.push(personLine(label, node, w, options, ''));
  }

  return lines.map(function(l) {
    l = l.replace(/\.\.$/, '.');
    return '- ' + (/[.!?]$/.test(l) ? l : l + '.');
  }).join('\n');
};

export { buildFamilySummary };
