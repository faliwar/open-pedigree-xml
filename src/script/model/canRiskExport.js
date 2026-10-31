import Disorder from 'pedigree/disorder';
import { computeStandardNumbering } from 'pedigree/model/nomenclature';
import { getParentSlots } from 'pedigree/model/inheritance';
import { testResult, CONTRALATERAL_FIELD } from 'pedigree/model/clinicalData';

/**
 * Export to the CanRisk pedigree file format v4 (BOADICEA / CanRisk risk calculations).
 * Specification: https://canrisk.atlassian.net/wiki/spaces/FAQS/pages/2749661185
 *
 *   ##CanRisk 4.0
 *   ##FamID Name Target IndivID FathID MothID Sex MZtwin Dead Age Yob BC1 BC2 OC PRO PAN Ashkn
 *     BRCA1 BRCA2 PALB2 ATM CHEK2 BARD1 RAD51D RAD51C BRIP1 HOXB13 ER:PR:HER2:CK14:CK56
 *   one TAB-separated record per family member
 *
 * Rules applied: sex must be M or F; every person has both parents or none (a missing parent is
 * added as a dummy founder); IndivID up to 7 characters; cancer ages are integers or AU (affected,
 * age unknown); genes are type:result (type 0/S/T, result 0/P/N; HOXB13 uses T and HET/HOM/N);
 * pathology is five colon-separated 0/N/P values. Names are replaced by the standard pedigree
 * identifiers (I-1, II-3...) because the file is uploaded to an external service.
 *
 * Risk-factor header lines (menarche, parity, BMI, PRS...) are optional and not written: they
 * can be entered on the CanRisk website.
 */

var GENES = ['BRCA1', 'BRCA2', 'PALB2', 'ATM', 'CHEK2', 'BARD1', 'RAD51D', 'RAD51C', 'BRIP1'];

var COLUMNS = ['FamID', 'Name', 'Target', 'IndivID', 'FathID', 'MothID', 'Sex', 'MZtwin', 'Dead', 'Age', 'Yob',
  'BC1', 'BC2', 'OC', 'PRO', 'PAN', 'Ashkn'].concat(GENES, ['HOXB13', 'ER:PR:HER2:CK14:CK56']);

var EXCLUDED_STATES = { miscarriage: 'miscarriage', aborted: 'termination of pregnancy', unborn: 'pregnancy', stillborn: 'stillbirth' };

// CanRisk cancer columns, recognised from the condition name (English or Portuguese)
var CANCER_TYPES = [
  { column: 'BC1', pattern: /breast|mama|mamário/i },
  { column: 'OC', pattern: /ovar|fallopian|tuba uterina|peritone/i },
  { column: 'PRO', pattern: /prostat|próstata/i },
  { column: 'PAN', pattern: /pancrea|pâncreas/i }
];

var IN_SITU = /in situ|\bdcis\b|\blcis\b/i;

var parseAge = function(value) {
  var m = String(value || '').match(/^\s*(\d{1,3})/);
  return m ? parseInt(m[1], 10) : null;
};

var yearsBetween = function(from, to) {
  var years = to.getFullYear() - from.getFullYear();
  if (to.getMonth() < from.getMonth() || (to.getMonth() === from.getMonth() && to.getDate() < from.getDate())) {
    years--;
  }
  return Math.max(0, years);
};

var disorderName = function(id) {
  try {
    var d = editor.getDisorderLegend().getDisorder(id);
    if (d && d.getName && d.getName() !== 'loading...') return d.getName();
  } catch (e) {}
  return Disorder.desanitizeID(id);
};

var receptor = function(value) {
  var v = String(value || '').toLowerCase();
  if (/^pos|positiv/.test(v)) return 'P';
  if (/^neg|negativ/.test(v)) return 'N';
  return '0';
};

/**
 * @param {Object} [options] { targetId: node id of the person the risk is calculated for (default: proband) }
 * @return {Object} { text, warnings: [String], count }
 */
var exportAsCanRisk = function(options) {
  options = options || {};
  var graph = editor.getGraph();
  var numbering = computeStandardNumbering(editor);
  var warnings = [];
  var targetId = (options.targetId !== undefined && options.targetId !== null) ? options.targetId : graph.getProbandId();

  var labelOf = function(id) {
    var node = editor.getNode(id);
    var std = numbering.byId[id] ? numbering.byId[id].label : '';
    var name = node && node.getName ? node.getName() : '';
    return std || name || ('#' + id);
  };

  // ------------------------------------------------------------------ who is included
  var included = {};
  for (var id = 0; id <= graph.getMaxNodeId(); id++) {
    if (!graph.isPerson(id)) continue;
    var props = graph.getProperties(id) || {};
    if (props.isPlaceholder || props.isVirtualDummyChild) continue;
    var node = editor.getNode(id);
    if (!node) continue;
    if (props.numPersons && props.numPersons > 1) {
      warnings.push(labelOf(id) + ': group of people (' + props.numPersons + ') left out.');
      continue;
    }
    var state = node.getLifeStatus ? node.getLifeStatus() : 'alive';
    if (EXCLUDED_STATES[state]) {
      if (!graph.isVirtualParent(id)) warnings.push(labelOf(id) + ': ' + EXCLUDED_STATES[state] + ' left out.');
      continue;
    }
    included[id] = true;
  }

  // ------------------------------------------------------------------ sex (M/F only)
  var sexOf = {};
  var roleSex = {}; // sex implied by being someone's father/mother
  Object.keys(included).forEach(function(k) {
    var slots = getParentSlots(graph, parseInt(k, 10));
    if (slots.f !== null) roleSex[slots.f] = roleSex[slots.f] || 'M';
    if (slots.m !== null) roleSex[slots.m] = roleSex[slots.m] || 'F';
  });
  Object.keys(included).forEach(function(k) {
    var pid = parseInt(k, 10);
    var g = graph.getGender(pid);
    if (g === 'M' || g === 'F') {
      sexOf[pid] = g;
      return;
    }
    var partners = [];
    try { partners = graph.DG.GG.getAllPartners(pid); } catch (e) {}
    var partnerSex = partners.map(function(p) { return graph.getGender(p); }).filter(function(s) { return s === 'M' || s === 'F'; })[0];
    var inferred = roleSex[pid] || (partnerSex ? (partnerSex === 'M' ? 'F' : 'M') : null);
    if (inferred) {
      sexOf[pid] = inferred;
      if (!graph.isVirtualParent(pid)) warnings.push(labelOf(pid) + ': sex unknown, exported as ' + inferred + '.');
    } else {
      delete included[pid];
      warnings.push(labelOf(pid) + ': sex unknown, left out (CanRisk needs M or F).');
    }
  });

  if (!included[targetId]) {
    throw 'The person chosen for the risk calculation cannot be exported (unknown sex, pregnancy or group).';
  }

  // ------------------------------------------------------------------ IDs, parents, twins
  var ids = {};
  var next = 1;
  var order = Object.keys(included).map(function(k) { return parseInt(k, 10); });
  order.sort(function(a, b) {
    var na = numbering.byId[a] || { generation: 99, index: a }, nb = numbering.byId[b] || { generation: 99, index: b };
    return (na.generation - nb.generation) || (na.index - nb.index);
  });
  order.forEach(function(pid) { ids[pid] = String(next++); });

  var rows = [];
  var dummies = [];
  var addDummy = function(sex) {
    var dummyId = String(next++);
    dummies.push({ id: dummyId, sex: sex });
    return dummyId;
  };

  var twinCodes = {};
  var twinSymbols = '123456789A';
  var nextTwin = 0;

  var famId = 'OPX' + new Date().toISOString().slice(0, 10).replace(/-/g, '');
  var unrecognised = {};

  order.forEach(function(pid) {
    var node = editor.getNode(pid);
    var props = graph.getProperties(pid) || {};

    // parents: both or none
    var fath = '0', moth = '0';
    var slots = getParentSlots(graph, pid);
    if (props.isAdopted || (node.isAdopted && node.isAdopted())) {
      slots = { f: null, m: null };
      if (graph.DG.GG.getParents(pid).length) warnings.push(labelOf(pid) + ': adopted, exported without parents (not a blood relative).');
    }
    var bioParents = graph.DG.GG.getParents(pid);
    if (slots.f !== null || slots.m !== null) {
      bioParents.forEach(function(p) {
        if (p !== slots.f && p !== slots.m && !graph.isVirtualParent(p)) {
          warnings.push(labelOf(pid) + ': same-sex parents; ' + labelOf(p) + ' was left out as a parent (CanRisk needs a biological father and mother).');
        }
      });
    }
    var f = (slots.f !== null && included[slots.f]) ? ids[slots.f] : null;
    var m = (slots.m !== null && included[slots.m]) ? ids[slots.m] : null;
    if (f || m) {
      fath = f || addDummy('M');
      moth = m || addDummy('F');
    }

    // identical twins
    var mz = '0';
    if (props.monozygotic && props.twinGroup !== undefined && props.twinGroup !== null) {
      var key = (graph.getParentRelationship(pid) || 'x') + ':' + props.twinGroup;
      if (!twinCodes[key]) {
        twinCodes[key] = twinSymbols.charAt(Math.min(nextTwin++, twinSymbols.length - 1));
      }
      mz = twinCodes[key];
    }

    // vital status, age, year of birth
    var dead = node.getLifeStatus() === 'deceased' ? '1' : '0';
    var dob = node.getBirthDate && node.getBirthDate();
    var dod = node.getDeathDate && node.getDeathDate();
    var age = 0;
    var yob = 0;
    if (dob && dob.getFullYear) {
      yob = dob.getFullYear();
    }
    if (dead === '1') {
      var aad = parseAge(node.getAgeAtDeath ? node.getAgeAtDeath() : '');
      if (aad === null && dob && dob.getFullYear && dod && dod.getFullYear) aad = yearsBetween(dob, dod);
      age = aad || 0;
    } else if (dob && dob.getFullYear) {
      age = yearsBetween(dob, new Date());
    }

    // cancers
    var cancers = { BC1: '0', BC2: '0', OC: '0', PRO: '0', PAN: '0' };
    var breastDetail = null;
    var sex = sexOf[pid];
    (node.getDisorders() || []).forEach(function(d) {
      if (d === 'affected') return;
      var name = disorderName(d);
      var type = null;
      for (var i = 0; i < CANCER_TYPES.length; i++) {
        if (CANCER_TYPES[i].pattern.test(name)) { type = CANCER_TYPES[i]; break; }
      }
      if (!type) {
        if (/cancer|carcinoma|\bca\b|tumou?r|neoplas|sarcoma|lymphoma|leuka?emia|melanoma/i.test(name)) unrecognised[name] = true;
        return;
      }
      if (IN_SITU.test(name)) {
        warnings.push(labelOf(pid) + ': ' + name + ' is in situ and was not counted.');
        return;
      }
      if ((type.column === 'OC' && sex === 'M') || (type.column === 'PRO' && sex === 'F')) {
        warnings.push(labelOf(pid) + ': ' + name + ' does not match the sex and was not counted.');
        return;
      }
      var detail = node.getDisorderDetail ? node.getDisorderDetail(d) : null;
      var dxAge = detail ? (parseAge(detail.atdiag) !== null ? parseAge(detail.atdiag) : parseAge(detail.onset)) : null;
      var value = dxAge !== null ? String(dxAge) : 'AU';
      var current = cancers[type.column];
      // keep the earliest diagnosis of each type
      if (current === '0' || current === 'AU' || (value !== 'AU' && parseInt(value, 10) < parseInt(current, 10))) {
        cancers[type.column] = value;
      }
      if (type.column === 'BC1') {
        breastDetail = detail;
      }
      if (dxAge !== null && age && dxAge > age) {
        warnings.push(labelOf(pid) + ': age at diagnosis of ' + name + ' (' + dxAge + ') is above the age (' + age + ').');
      }
    });
    if (breastDetail) {
      var fields = breastDetail.fields || [];
      var field = function(n) {
        for (var i = 0; i < fields.length; i++) if (fields[i].name.toLowerCase() === n.toLowerCase()) return fields[i].value;
        return '';
      };
      var contra = parseAge(field(CONTRALATERAL_FIELD));
      if (contra !== null) {
        cancers.BC2 = String(contra);
      } else if (/bilateral/i.test(field('Breast')) || /bilateral/i.test(field('Laterality'))) {
        cancers.BC2 = 'AU';
      }
    }
    var pathology = '0:0:0:0:0';
    if (cancers.BC1 !== '0' && breastDetail) {
      var f2 = breastDetail.fields || [];
      var get = function(n) {
        for (var i = 0; i < f2.length; i++) if (f2[i].name.toLowerCase() === n.toLowerCase()) return f2[i].value;
        return '';
      };
      pathology = [get('ER'), get('PR'), get('HER2'), get('CK14'), get('CK5/6') || get('CK56')].map(receptor).join(':');
    }

    // genetic tests
    var tests = (node.getGeneticTests && node.getGeneticTests()) || [];
    var geneCell = function(gene) {
      var cell = '0:0';
      tests.forEach(function(t) {
        if (t.gene !== gene) return;
        var r = testResult(t);
        if (r !== 'positive' && r !== 'negative') return; // VUS, unknown, declined: untested
        var type = t.testType === 'targeted' ? 'T' : 'S';
        var result = r === 'positive' ? 'P' : 'N';
        if (cell === '0:0' || result === 'P') cell = type + ':' + result;
      });
      return cell;
    };
    var hoxb13 = '0:0';
    tests.forEach(function(t) {
      if (t.gene !== 'HOXB13') return;
      var r = testResult(t);
      if (r === 'positive') hoxb13 = 'T:' + (t.zygosity === 'hom' ? 'HOM' : 'HET');
      else if (r === 'negative' && hoxb13 === '0:0') hoxb13 = 'T:N';
    });

    var exportName = graph.isVirtualParent(pid) ? 'dummy' : labelOf(pid).replace(/\s+/g, '_');
    rows.push([famId, exportName, pid === targetId ? '1' : '0', ids[pid], fath, moth, sex, mz, dead,
      String(age), String(yob), cancers.BC1, cancers.BC2, cancers.OC, cancers.PRO, cancers.PAN,
      node.getAshkenazi && node.getAshkenazi() ? '1' : '0']
      .concat(GENES.map(geneCell), [hoxb13, pathology]));
  });

  dummies.forEach(function(d) {
    rows.push([famId, 'dummy', '0', d.id, '0', '0', d.sex, '0', '0', '0', '0', '0', '0', '0', '0', '0', '0']
      .concat(GENES.map(function() { return '0:0'; }), ['0:0', '0:0:0:0:0']));
  });
  if (dummies.length) {
    warnings.push(dummies.length + ' unrecorded parent(s) added as "dummy" (CanRisk needs both parents or none).');
  }
  Object.keys(unrecognised).forEach(function(name) {
    warnings.push(name + ': not one of the cancers used by CanRisk (breast, ovarian, prostate, pancreatic); not exported.');
  });

  var lines = ['##CanRisk 4.0', '##' + COLUMNS.join('\t')].concat(rows.map(function(r) { return r.join('\t'); }));
  return { text: lines.join('\n') + '\n', warnings: warnings, count: rows.length };
};

export { exportAsCanRisk, COLUMNS as CANRISK_COLUMNS };
