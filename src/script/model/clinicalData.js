import { translate } from 'pedigree/i18n';

/**
 * Structured clinical data of a person: genetic test results and diagnosis details.
 *
 *   geneticTests: [{
 *     gene, variant (HGVS c.), protein (HGVS p.), zygosity ('het'|'hom'|'hemi'|'compound'|''),
 *     classification ('P'|'LP'|'VUS'|'LB'|'B'|'NEG'|'POS'|''), lab, date, comment,
 *     invitaeName, invitaeValue   (kept from imported Invitae/Progeny XML for round trips)
 *   }]
 *
 *   disorderDetails: { disorderName: {
 *     type (basis of diagnosis), onset (age at onset), atdiag (age at diagnosis), note,
 *     fields: [{name, value}]  (e.g. laterality, histology, ER/PR/HER2, grade, stage),
 *     code, shortTitle, status (kept from imported Invitae/Progeny XML)
 *   } }
 *
 * Invitae/Progeny XML stores tests as
 *   <condition_tests><test name="brca1" value="1" title="BRCA1" company="Lab"/></condition_tests>
 * with value 0 = unknown, 1 = positive, 2 = negative, 3 = declined testing (confirmed with a
 * Progeny file whose individuals are named after each code). Progeny has no code for a VUS:
 * it is written as 0 plus classification="VUS". Diagnosis details are attributes and <field>
 * children of <condition>.
 */

var CLASSIFICATIONS = [
  { code: 'P',   label: 'Pathogenic',                      short: 'P',   result: 'positive' },
  { code: 'LP',  label: 'Likely pathogenic',               short: 'LP',  result: 'positive' },
  { code: 'POS', label: 'Positive (class not specified)',  short: '+',   result: 'positive' },
  { code: 'VUS', label: 'Uncertain significance (VUS)',    short: 'VUS', result: 'vus' },
  { code: 'LB',  label: 'Likely benign',                   short: 'LB',  result: 'negative' },
  { code: 'B',   label: 'Benign',                          short: 'B',   result: 'negative' },
  { code: 'NEG', label: 'Negative (no variant found)',     short: '−', result: 'negative' },
  { code: 'DECLINED', label: 'Declined testing',           short: 'declined', result: 'declined' },
  { code: '',    label: 'Unknown / pending',               short: '?',   result: '' }
];

/**
 * Ancestry choices: the gnomAD genetic ancestry groups plus founder populations that matter for
 * carrier frequencies and risk models. Stored in English (shown translated); any other text can be
 * typed. A person can have several (mixed ancestry). CanRisk's Ashkenazi flag is derived from it.
 */
var ANCESTRY_OPTIONS = [
  'African / African American',
  'Admixed American / Latino',
  'Amish',
  'Ashkenazi Jewish',
  'East Asian',
  'European (non-Finnish)',
  'Finnish',
  'French Canadian',
  'Indigenous American',
  'Middle Eastern',
  'North African',
  'Pacific Islander',
  'Sephardic or Mizrahi Jewish',
  'South Asian',
  'Southeast Asian'
];

var normalizeAncestry = function(list) {
  var out = [];
  (Array.isArray(list) ? list : (list ? [list] : [])).forEach(function(v) {
    var s = str(v);
    // older files (BOADICEA import) used "Ashkenazi Jews"
    if (/^ashkenazi/i.test(s)) s = 'Ashkenazi Jewish';
    if (s && out.indexOf(s) === -1) out.push(s);
  });
  return out;
};

var hasAshkenaziAncestry = function(list) {
  return normalizeAncestry(list).some(function(a) { return /ashkenazi/i.test(a); });
};

// How the gene was tested (CanRisk/BOADICEA: S = mutation search, T = direct gene test)
var TEST_TYPES = [
  { code: '', label: 'Panel / full gene (mutation search)' },
  { code: 'targeted', label: 'Targeted (known familial variant)' }
];

// detail field holding the age at a second (contralateral) breast cancer
var CONTRALATERAL_FIELD = 'Contralateral age';

var ZYGOSITIES = [
  { code: '', label: '—' },
  { code: 'het', label: 'Heterozygous' },
  { code: 'hom', label: 'Homozygous' },
  { code: 'hemi', label: 'Hemizygous' },
  { code: 'compound', label: 'Compound heterozygous' }
];

// Basis of diagnosis, as written in Invitae/Progeny files ("type" attribute); free text allowed
var DIAGNOSIS_TYPES = [
  'Clinical Diagnosis', 'Confirmed Genetically', 'Confirmed by Pathology',
  'Confirmed Enzymatically', 'Self-reported', 'Unconfirmed'
];

var RECEPTOR_VALUES = ['', 'Positive test', 'Negative test', 'Equivocal', 'Not done'];
var LATERALITY_VALUES = ['', 'Left', 'Right', 'Bilateral'];

var classificationInfo = function(code) {
  for (var i = 0; i < CLASSIFICATIONS.length; i++) {
    if (CLASSIFICATIONS[i].code === (code || '')) return CLASSIFICATIONS[i];
  }
  return CLASSIFICATIONS[CLASSIFICATIONS.length - 1];
};

/** 'positive' | 'negative' | 'vus' | 'declined' | '' */
var testResult = function(test) {
  return classificationInfo(test && test.classification).result;
};

var str = function(v) {
  return (v === undefined || v === null) ? '' : String(v).trim();
};

var normalizeTest = function(t) {
  t = t || {};
  var out = {
    gene: str(t.gene).toUpperCase(),
    variant: str(t.variant),
    protein: str(t.protein),
    zygosity: str(t.zygosity),
    testType: str(t.testType) === 'targeted' ? 'targeted' : '',
    classification: classificationInfo(t.classification).code,
    lab: str(t.lab),
    date: str(t.date),
    comment: str(t.comment)
  };
  if (t.invitaeName) out.invitaeName = str(t.invitaeName);
  if (t.invitaeValue !== undefined && t.invitaeValue !== null && t.invitaeValue !== '') out.invitaeValue = str(t.invitaeValue);
  return out;
};

var normalizeTests = function(tests) {
  if (!Array.isArray(tests)) return [];
  return tests.map(normalizeTest).filter(function(t) { return t.gene !== ''; });
};

var normalizeDetail = function(d) {
  d = d || {};
  var out = {
    type: str(d.type),
    onset: str(d.onset),
    atdiag: str(d.atdiag),
    note: str(d.note),
    fields: (Array.isArray(d.fields) ? d.fields : [])
      .map(function(f) { return { name: str(f && f.name), value: str(f && f.value) }; })
      .filter(function(f) { return f.name !== ''; })
  };
  ['code', 'shortTitle', 'status'].forEach(function(k) {
    if (str(d[k]) !== '') out[k] = str(d[k]);
  });
  return out;
};

var isEmptyDetail = function(d) {
  return !d || (!d.type && !d.onset && !d.atdiag && !d.note && !d.code && !d.shortTitle && !d.status &&
    !(d.fields || []).some(function(f) { return f.value !== ''; }));
};

/** Normalized copy without empty entries */
var normalizeDetails = function(details) {
  var out = {};
  if (!details || typeof details !== 'object') return out;
  Object.keys(details).forEach(function(name) {
    var d = normalizeDetail(details[name]);
    if (!isEmptyDetail(d)) out[name] = d;
  });
  return out;
};

var clone = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};

// "51", "51y", "51 yrs" -> "51 yrs" (Invitae style); other text is kept as typed
var toInvitaeAge = function(value) {
  var v = str(value);
  var m = v.match(/^(\d{1,3})\s*(y|yr|yrs|years?|a|anos?)?$/i);
  return m ? m[1] + ' yrs' : v;
};

// "51 yrs" -> "51y" for compact chart labels
var compactAge = function(value) {
  var v = str(value);
  var m = v.match(/^(\d{1,3})\s*(y|yr|yrs|years?|a|anos?)?$/i);
  return m ? m[1] + 'y' : v;
};

var CANCER_PATTERN = /cancer|carcinoma|\bca\b|tumou?r|neoplas|sarcoma|lymphoma|leuka?emia|melanoma|glioma|blastoma|myeloma|adenoma|mesothelioma/i;

var isCancer = function(name) {
  return CANCER_PATTERN.test(str(name));
};

/**
 * Suggested detail fields for a condition. Breast cancer uses the field names found in
 * Invitae/Progeny files ("Breast" holds the laterality).
 * @return [{name, options?}]
 */
var suggestedFields = function(name) {
  var n = str(name);
  if (!isCancer(n)) return [];
  var fields = [];
  if (/breast|mama/i.test(n)) {
    fields.push({ name: 'Breast', options: LATERALITY_VALUES });
    fields.push({ name: CONTRALATERAL_FIELD });
  } else if (/ovar|kidney|renal|lung|eye|retino|testi|adrenal/i.test(n)) {
    fields.push({ name: 'Laterality', options: LATERALITY_VALUES });
  }
  fields.push({ name: 'Histology' });
  if (/breast|mama/i.test(n)) {
    ['ER', 'PR', 'HER2', 'CK5/6', 'CK14'].forEach(function(r) { fields.push({ name: r, options: RECEPTOR_VALUES }); });
  }
  fields.push({ name: 'Grade' });
  fields.push({ name: 'Stage' });
  return fields;
};

/** Short chart-label text for one test, e.g. "BRCA1 c.68_69del P" or "MSH2 −" */
var testLabel = function(test) {
  var info = classificationInfo(test.classification);
  var parts = [test.gene];
  if (test.variant && info.code !== 'NEG' && info.code !== 'DECLINED') parts.push(test.variant);
  parts.push(info.code === 'DECLINED' ? translate(info.short) : info.short);
  return parts.join(' ');
};

// Invitae/Progeny test value: 0 unknown, 1 positive, 2 negative, 3 declined testing
var toInvitaeValue = function(test) {
  var r = testResult(test);
  if (r === 'positive') return '1';
  if (r === 'negative') return '2';
  if (r === 'declined') return '3';
  if (r === '' && test.invitaeValue && ['1', '2', '3'].indexOf(test.invitaeValue) === -1) {
    return test.invitaeValue; // unknown/pending: keep whatever code the imported file had
  }
  return '0'; // unknown, pending, or VUS (no Progeny code; kept in the classification attribute)
};

var fromInvitaeValue = function(value) {
  switch (str(value)) {
    case '1': return 'POS';
    case '2': return 'NEG';
    case '3': return 'DECLINED';
  }
  return '';
};

// Whether the classification must be written as an extra attribute because the Progeny value
// alone does not say it (P vs LP, LB vs B, and VUS, which Progeny stores as unknown)
var needsClassificationAttribute = function(test) {
  return ['P', 'LP', 'LB', 'B', 'VUS'].indexOf(test.classification) !== -1;
};

export {
  ANCESTRY_OPTIONS, normalizeAncestry, hasAshkenaziAncestry,
  CLASSIFICATIONS, ZYGOSITIES, TEST_TYPES, CONTRALATERAL_FIELD, DIAGNOSIS_TYPES, RECEPTOR_VALUES, LATERALITY_VALUES,
  classificationInfo, testResult, normalizeTest, normalizeTests, normalizeDetail, normalizeDetails,
  isEmptyDetail, clone, toInvitaeAge, compactAge, isCancer, suggestedFields, testLabel,
  toInvitaeValue, fromInvitaeValue, needsClassificationAttribute
};
