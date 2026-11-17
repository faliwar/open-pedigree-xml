/**
 * Built-in catalog of clinical genetics disease and gene presets for cascade testing, plus
 * ACMG/ClinGen (SVC v4 / Whiffin-Ware) population-frequency and rare-disease parameter helpers.
 *
 * Sources of parameters:
 *   - ClinGen Criteria Specification Registry (CSpec) & ACMG Secondary Findings DAFT tables
 *   - GeneReviews (NCBI Bookshelf, NBK1116): de novo proportions, inheritance, penetrance
 *   - ASK2ME (Dana-Farber / Harvard) & BOADICEA / CanRisk v4: age-specific cancer penetrance curves
 *   - Orphadata / Orphanet & HPO Annotations: age of onset intervals and carrier frequencies
 */

var CATALOG_CATEGORIES = [
  { id: 'cancer', label: 'Hereditary cancer' },
  { id: 'cardio', label: 'Cardiogenetics' },
  { id: 'neuro', label: 'Neurogenetics' },
  { id: 'connective', label: 'Connective tissue & skeletal' },
  { id: 'recessive', label: 'Autosomal recessive & metabolic' },
  { id: 'xlinked', label: 'X-linked & mitochondrial' },
  { id: 'acmg', label: 'ACMG v4 / ClinGen rare-disease archetypes' }
];

// Common reusable condition blocks with English and Portuguese aliases and MONDO codes
var COND_BREAST = function(curve, pen, phenocopy) {
  return {
    name: 'Breast cancer',
    aliases: ['Câncer de mama', 'Cancer de mama', 'Carcinoma de mama', 'Neoplasia de mama',
      'Hereditary breast and ovarian cancer', 'HBOC', 'MONDO:0007254', 'MONDO:0016419'],
    penetrance: pen, onsetFrom: 25, onsetTo: 80, curve: curve, phenocopy: phenocopy !== undefined ? phenocopy : 12
  };
};

var COND_OVARIAN = function(curve, pen) {
  return {
    name: 'Ovarian cancer',
    aliases: ['Câncer de ovário', 'Cancer de ovario', 'Carcinoma de ovário', 'Neoplasia de ovário',
      'Fallopian tube cancer', 'Câncer de tuba uterina', 'MONDO:0008170'],
    penetrance: pen, onsetFrom: 35, onsetTo: 80, curve: curve, phenocopy: 1.1
  };
};

var COND_PROSTATE = function(curve, pen) {
  return {
    name: 'Prostate cancer',
    aliases: ['Câncer de próstata', 'Cancer de prostata', 'Carcinoma de próstata', 'MONDO:0008315'],
    penetrance: pen, onsetFrom: 45, onsetTo: 80, curve: curve || '', phenocopy: 11
  };
};

var COND_PANCREATIC = function(pen) {
  return {
    name: 'Pancreatic cancer',
    aliases: ['Câncer de pâncreas', 'Cancer de pancreas', 'Carcinoma pancreático', 'MONDO:0006047'],
    penetrance: pen, onsetFrom: 45, onsetTo: 80, phenocopy: 1.5
  };
};

var COND_COLORECTAL = function(curve, pen) {
  return {
    name: 'Colorectal cancer',
    aliases: ['Câncer colorretal', 'Cancer colorretal', 'Câncer de cólon', 'Cancer de colon',
      'Colon cancer', 'Rectal cancer', 'Câncer de reto', 'Lynch syndrome', 'Síndrome de Lynch', 'MONDO:0005575'],
    penetrance: pen, onsetFrom: 25, onsetTo: 80, curve: curve, phenocopy: 4.2
  };
};

var COND_ENDOMETRIAL = function(curve, pen) {
  return {
    name: 'Endometrial cancer',
    aliases: ['Câncer de endométrio', 'Cancer de endometrio', 'Câncer uterino', 'Uterine cancer', 'MONDO:0011962'],
    penetrance: pen, onsetFrom: 30, onsetTo: 80, curve: curve, phenocopy: 2.8
  };
};

var RAW_PRESETS = [
  // =========================================================================================
  // 1. Hereditary Cancer Syndromes (ASK2ME / CanRisk / ClinGen / GeneReviews)
  // =========================================================================================
  {
    id: 'brca1',
    category: 'cancer',
    name: 'BRCA1 — Hereditary breast and ovarian cancer (HBOC)',
    genes: ['BRCA1'],
    mondo: ['MONDO:0016419', 'MONDO:0007254', 'MONDO:0008170'],
    notes: 'Kuchenbaecker et al. 2017 (JAMA); ASK2ME / CanRisk; GeneReviews',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 400,
    model: {
      deNovo: 2, penetrance: 72, onsetFrom: 25, onsetTo: 80,
      curve: '30:4 40:24 50:43 60:55 70:65 80:72', phenocopy: 12, unrecordedUnaffected: false
    },
    conditions: [
      COND_BREAST('30:4 40:24 50:43 60:55 70:65 80:72', 72, 12),
      COND_OVARIAN('30:0 40:2 50:8 60:22 70:36 80:44', 44),
      COND_PANCREATIC(5),
      COND_PROSTATE('50:1 60:5 70:12 80:20', 20)
    ]
  },
  {
    id: 'brca2',
    category: 'cancer',
    name: 'BRCA2 — Hereditary breast and ovarian cancer (HBOC)',
    genes: ['BRCA2'],
    mondo: ['MONDO:0016419', 'MONDO:0007254', 'MONDO:0008170'],
    notes: 'Kuchenbaecker et al. 2017 (JAMA); ASK2ME / CanRisk; GeneReviews',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 300,
    model: {
      deNovo: 2, penetrance: 69, onsetFrom: 25, onsetTo: 80,
      curve: '30:2 40:13 50:35 60:50 70:61 80:69', phenocopy: 12, unrecordedUnaffected: false
    },
    conditions: [
      COND_BREAST('30:2 40:13 50:35 60:50 70:61 80:69', 69, 12),
      COND_OVARIAN('30:0 40:0.5 50:3 60:8 70:14 80:17', 17),
      COND_PROSTATE('50:2 60:8 70:19 80:27', 27),
      COND_PANCREATIC(7)
    ]
  },
  {
    id: 'palb2',
    category: 'cancer',
    name: 'PALB2 — Hereditary breast and pancreatic cancer',
    genes: ['PALB2'],
    mondo: ['MONDO:0007254'],
    notes: 'Yang et al. 2020 (JCO); ASK2ME / CanRisk',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 800,
    model: {
      deNovo: 2, penetrance: 53, onsetFrom: 30, onsetTo: 80,
      curve: '30:1 40:8 50:21 60:35 70:45 80:53', phenocopy: 12, unrecordedUnaffected: false
    },
    conditions: [
      COND_BREAST('30:1 40:8 50:21 60:35 70:45 80:53', 53, 12),
      COND_OVARIAN('40:0.3 50:1 60:2 70:3.5 80:5', 5),
      COND_PANCREATIC(4)
    ]
  },
  {
    id: 'atm',
    category: 'cancer',
    name: 'ATM — Breast and pancreatic cancer predisposition',
    genes: ['ATM'],
    notes: 'Marabelli et al. 2016; ASK2ME / CanRisk',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 100,
    model: {
      deNovo: 1, penetrance: 33, onsetFrom: 35, onsetTo: 80,
      curve: '40:2 50:6 60:14 70:23 80:33', phenocopy: 12, unrecordedUnaffected: false
    },
    conditions: [
      COND_BREAST('40:2 50:6 60:14 70:23 80:33', 33, 12),
      COND_PANCREATIC(6),
      COND_PROSTATE('50:1 60:4 70:10 80:18', 18)
    ]
  },
  {
    id: 'chek2',
    category: 'cancer',
    name: 'CHEK2 — Breast and colorectal cancer predisposition',
    genes: ['CHEK2', 'BARD1'],
    notes: 'Cybulski et al. 2011; ASK2ME / CanRisk',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 100,
    model: {
      deNovo: 1, penetrance: 28, onsetFrom: 35, onsetTo: 80,
      curve: '40:2 50:6 60:13 70:21 80:28', phenocopy: 12, unrecordedUnaffected: false
    },
    conditions: [
      COND_BREAST('40:2 50:6 60:13 70:21 80:28', 28, 12),
      COND_COLORECTAL('40:0.5 50:2 60:5 70:9 80:12', 12),
      COND_PROSTATE('50:1 60:4 70:9 80:15', 15)
    ]
  },
  {
    id: 'rad51c-rad51d-brip1',
    category: 'cancer',
    name: 'RAD51C / RAD51D / BRIP1 — Ovarian and breast cancer predisposition',
    genes: ['RAD51C', 'RAD51D', 'BRIP1'],
    notes: 'Yang et al. 2020; ASK2ME / CanRisk',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 1000,
    model: {
      deNovo: 1, penetrance: 20, onsetFrom: 35, onsetTo: 80,
      curve: '40:1 50:4 60:9 70:15 80:20', phenocopy: 1.1, unrecordedUnaffected: false
    },
    conditions: [
      COND_OVARIAN('40:0.5 50:2 60:6 70:10 80:13', 13),
      COND_BREAST('40:2 50:6 60:12 70:17 80:21', 21, 12)
    ]
  },
  {
    id: 'lynch-mlh1-msh2',
    category: 'cancer',
    name: 'MLH1 / MSH2 / EPCAM — Lynch syndrome (high penetrance)',
    genes: ['MLH1', 'MSH2', 'EPCAM'],
    mondo: ['MONDO:0005835'],
    notes: 'Dominguez-Valentin et al. 2020 (PLSD); ASK2ME; ClinGen InSiGHT VCEP',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 750,
    model: {
      deNovo: 2, penetrance: 55, onsetFrom: 25, onsetTo: 80,
      curve: '30:2 40:10 50:24 60:38 70:48 80:55', phenocopy: 4.2, unrecordedUnaffected: false
    },
    conditions: [
      COND_COLORECTAL('30:2 40:10 50:22 60:35 70:46 80:52', 52),
      COND_ENDOMETRIAL('30:0.5 40:3 50:15 60:32 70:42 80:45', 45),
      COND_OVARIAN('30:0.5 40:2 50:5 60:9 70:11 80:12', 12),
      { name: 'Gastric cancer', aliases: ['Câncer gástrico', 'Cancer gastrico', 'Câncer de estômago', 'Stomach cancer'], penetrance: 8, onsetFrom: 40, onsetTo: 80, phenocopy: 0.8 }
    ]
  },
  {
    id: 'lynch-msh6-pms2',
    category: 'cancer',
    name: 'MSH6 / PMS2 — Lynch syndrome (moderate penetrance)',
    genes: ['MSH6', 'PMS2'],
    mondo: ['MONDO:0005835'],
    notes: 'Dominguez-Valentin et al. 2020 (PLSD); ASK2ME; ClinGen InSiGHT VCEP',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 400,
    model: {
      deNovo: 1, penetrance: 25, onsetFrom: 35, onsetTo: 80,
      curve: '40:1 50:5 60:12 70:20 80:25', phenocopy: 4.2, unrecordedUnaffected: false
    },
    conditions: [
      COND_COLORECTAL('40:1 50:4 60:9 70:15 80:20', 20),
      COND_ENDOMETRIAL('40:1 50:8 60:20 70:30 80:35', 35),
      COND_OVARIAN('40:0.5 50:2 60:5 70:8 80:10', 10)
    ]
  },
  {
    id: 'tp53',
    category: 'cancer',
    name: 'TP53 — Li-Fraumeni syndrome',
    genes: ['TP53'],
    mondo: ['MONDO:0018875'],
    notes: 'Mai et al. 2016; ClinGen TP53 VCEP; GeneReviews (~14% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 5000,
    model: {
      deNovo: 14, penetrance: 90, onsetFrom: 1, onsetTo: 70,
      curve: '10:15 20:22 30:40 40:58 50:73 60:83 70:90', phenocopy: 2, unrecordedUnaffected: false
    },
    conditions: [
      { name: 'Li-Fraumeni syndrome', aliases: ['Síndrome de Li-Fraumeni', 'Sindrome de Li-Fraumeni', 'Sarcoma', 'Osteosarcoma', 'Adrenocortical carcinoma', 'Carcinoma adrenocortical', 'MONDO:0018875'], penetrance: 90, curve: '10:15 20:22 30:40 40:58 50:73 60:83 70:90', phenocopy: 0.5 },
      COND_BREAST('20:3 30:20 40:45 50:65 60:78 70:85', 85, 12)
    ]
  },
  {
    id: 'apc',
    category: 'cancer',
    name: 'APC — Familial adenomatous polyposis (FAP)',
    genes: ['APC'],
    mondo: ['MONDO:0021056'],
    notes: 'ClinGen InSiGHT APC VCEP; GeneReviews (~20–25% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 10000,
    model: {
      deNovo: 25, penetrance: 98, onsetFrom: 12, onsetTo: 50,
      curve: '15:10 20:35 30:75 40:93 50:98', phenocopy: 0.5
    },
    conditions: [
      { name: 'Familial adenomatous polyposis', aliases: ['Polipose adenomatosa familiar', 'PAF', 'FAP', 'Colorectal polyposis', 'MONDO:0021056'], penetrance: 98, curve: '15:10 20:35 30:75 40:93 50:98', phenocopy: 0.1 },
      COND_COLORECTAL('20:5 30:35 40:75 50:95 60:99', 99)
    ]
  },
  {
    id: 'cdh1',
    category: 'cancer',
    name: 'CDH1 — Hereditary diffuse gastric and lobular breast cancer',
    genes: ['CDH1'],
    mondo: ['MONDO:0007648'],
    notes: 'Roberts et al. 2019 (JAMA Oncol); ClinGen CDH1 VCEP',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 5000,
    model: {
      deNovo: 2, penetrance: 42, onsetFrom: 20, onsetTo: 80,
      curve: '30:4 40:12 50:21 60:29 70:35 80:40', phenocopy: 1, unrecordedUnaffected: false
    },
    conditions: [
      { name: 'Gastric cancer', aliases: ['Diffuse gastric cancer', 'Câncer gástrico', 'Cancer gastrico', 'Câncer gástrico difuso', 'Câncer de estômago', 'Stomach cancer', 'MONDO:0007648'], penetrance: 38, curve: '30:4 40:12 50:21 60:29 70:35 80:38', phenocopy: 0.8 },
      COND_BREAST('30:1 40:7 50:18 60:29 70:37 80:42', 42, 12)
    ]
  },
  {
    id: 'pten',
    category: 'cancer',
    name: 'PTEN — Cowden / PTEN hamartoma tumor syndrome',
    genes: ['PTEN'],
    mondo: ['MONDO:0008623', 'MONDO:0017623'],
    notes: 'ClinGen PTEN VCEP; Tan et al. 2012; GeneReviews (~25% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 100000,
    model: {
      deNovo: 25, penetrance: 85, onsetFrom: 10, onsetTo: 60,
      curve: '20:15 30:35 40:60 50:75 60:85', phenocopy: 1
    },
    conditions: [
      { name: 'Cowden syndrome', aliases: ['Síndrome de Cowden', 'Sindrome de Cowden', 'PTEN hamartoma tumor syndrome', 'MONDO:0008623'], penetrance: 85, curve: '20:15 30:35 40:60 50:75 60:85', phenocopy: 0.05 },
      COND_BREAST('30:3 40:15 50:35 60:55 70:67 80:75', 75, 12),
      { name: 'Thyroid cancer', aliases: ['Câncer de tireoide', 'Cancer de tireoide', 'Carcinoma de tireoide'], penetrance: 30, onsetFrom: 15, onsetTo: 65, phenocopy: 1.2 },
      COND_ENDOMETRIAL('30:1 40:5 50:12 60:20 70:26 80:28', 28)
    ]
  },
  {
    id: 'stk11',
    category: 'cancer',
    name: 'STK11 — Peutz-Jeghers syndrome',
    genes: ['STK11'],
    mondo: ['MONDO:0008280'],
    notes: 'GeneReviews (STK11); Hearle et al. 2006 (~45% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 50000,
    model: { deNovo: 45, penetrance: 95, onsetFrom: 5, onsetTo: 50, phenocopy: 0.1 },
    conditions: [
      { name: 'Peutz-Jeghers syndrome', aliases: ['Síndrome de Peutz-Jeghers', 'Sindrome de Peutz-Jeghers', 'MONDO:0008280'], penetrance: 95, onsetFrom: 5, onsetTo: 50, phenocopy: 0.01 }
    ]
  },
  {
    id: 'ret',
    category: 'cancer',
    name: 'RET — Multiple endocrine neoplasia type 2 (MEN2 / MTC)',
    genes: ['RET'],
    mondo: ['MONDO:0018999', 'MONDO:0008594'],
    notes: 'GeneReviews (MEN2); Wells et al. 2015 (~5–9% de novo in MEN2A, ~50% in MEN2B)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 30000,
    model: {
      deNovo: 10, penetrance: 85, onsetFrom: 10, onsetTo: 65,
      curve: '20:15 30:35 40:58 50:73 60:82 70:85', phenocopy: 0.1
    },
    conditions: [
      { name: 'Medullary thyroid cancer', aliases: ['Multiple endocrine neoplasia type 2', 'MEN2', 'MEN2A', 'MEN2B', 'Neoplasia endócrina múltipla tipo 2', 'NEM2', 'Carcinoma medular de tireoide', 'Câncer medular de tireoide', 'Pheochromocytoma', 'Feocromocitoma', 'MONDO:0018999'], penetrance: 85, curve: '20:15 30:35 40:58 50:73 60:82 70:85', phenocopy: 0.1 }
    ]
  },
  {
    id: 'men1',
    category: 'cancer',
    name: 'MEN1 — Multiple endocrine neoplasia type 1',
    genes: ['MEN1'],
    mondo: ['MONDO:0007546'],
    notes: 'GeneReviews (MEN1; ~10% de novo, >90% penetrance by age 50)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 30000,
    model: {
      deNovo: 10, penetrance: 94, onsetFrom: 10, onsetTo: 55,
      curve: '20:25 30:55 40:80 50:94', phenocopy: 0.1
    },
    conditions: [
      { name: 'Multiple endocrine neoplasia type 1', aliases: ['MEN1', 'NEM1', 'Neoplasia endócrina múltipla tipo 1', 'Primary hyperparathyroidism', 'Hiperparatireoidismo primário', 'MONDO:0007546'], penetrance: 94, curve: '20:25 30:55 40:80 50:94', phenocopy: 0.1 }
    ]
  },
  {
    id: 'vhl',
    category: 'cancer',
    name: 'VHL — Von Hippel-Lindau syndrome',
    genes: ['VHL'],
    mondo: ['MONDO:0008667'],
    notes: 'ClinGen VHL VCEP; Maher et al.; GeneReviews (~20% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 36000,
    model: {
      deNovo: 20, penetrance: 95, onsetFrom: 10, onsetTo: 65,
      curve: '20:20 30:50 40:75 50:90 65:95', phenocopy: 0.1
    },
    conditions: [
      { name: 'Von Hippel-Lindau syndrome', aliases: ['Síndrome de Von Hippel-Lindau', 'Sindrome de Von Hippel-Lindau', 'VHL', 'Hemangioblastoma', 'Clear cell renal cell carcinoma', 'Carcinoma renal', 'Câncer renal', 'MONDO:0008667'], penetrance: 95, curve: '20:20 30:50 40:75 50:90 65:95', phenocopy: 0.1 }
    ]
  },
  {
    id: 'rb1',
    category: 'cancer',
    name: 'RB1 — Hereditary retinoblastoma',
    genes: ['RB1'],
    mondo: ['MONDO:0008380'],
    notes: 'GeneReviews (Retinoblastoma; ~80% de novo, ~90% penetrance by age 5)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 20000,
    model: { deNovo: 80, penetrance: 90, onsetFrom: 0, onsetTo: 5, phenocopy: 0.01 },
    conditions: [
      { name: 'Retinoblastoma', aliases: ['Hereditary retinoblastoma', 'Retinoblastoma hereditário', 'MONDO:0008380'], penetrance: 90, onsetFrom: 0, onsetTo: 5, phenocopy: 0.01 }
    ]
  },

  // =========================================================================================
  // 2. Cardiogenetics (ClinGen Cardiomyopathy / Arrhythmia VCEPs & Whiffin/Ware)
  // =========================================================================================
  {
    id: 'hcm',
    category: 'cardio',
    name: 'MYBPC3 / MYH7 / TNNT2 / TNNI3 — Hypertrophic cardiomyopathy (HCM)',
    genes: ['MYBPC3', 'MYH7', 'TNNT2', 'TNNI3', 'TPM1', 'MYL2', 'MYL3', 'ACTC1'],
    mondo: ['MONDO:0005045'],
    notes: 'ClinGen Cardiomyopathy VCEP (Kelly et al. 2018); Lorenzini et al. 2020; GeneReviews',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 500,
    model: {
      deNovo: 5, penetrance: 60, onsetFrom: 15, onsetTo: 70,
      curve: '20:10 30:22 40:35 50:46 60:55 70:60', phenocopy: 0.2, unrecordedUnaffected: false
    },
    conditions: [
      { name: 'Hypertrophic cardiomyopathy', aliases: ['Cardiomiopatia hipertrófica', 'Cardiomiopatia hipertrofica', 'Miocardiopatia hipertrófica', 'HCM', 'CMH', 'MONDO:0005045'], penetrance: 60, curve: '20:10 30:22 40:35 50:46 60:55 70:60', phenocopy: 0.2 }
    ]
  },
  {
    id: 'dcm',
    category: 'cardio',
    name: 'LMNA / TTN / FLNC / RBM20 — Dilated cardiomyopathy (DCM)',
    genes: ['LMNA', 'TTN', 'FLNC', 'RBM20', 'SCN5A', 'BAG3', 'DES'],
    mondo: ['MONDO:0005021'],
    notes: 'ClinGen DCM VCEP; GeneReviews',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 500,
    model: {
      deNovo: 8, penetrance: 75, onsetFrom: 20, onsetTo: 70,
      curve: '20:5 30:18 40:38 50:58 60:70 70:75', phenocopy: 0.2, unrecordedUnaffected: false
    },
    conditions: [
      { name: 'Dilated cardiomyopathy', aliases: ['Cardiomiopatia dilatada', 'Miocardiopatia dilatada', 'DCM', 'CMD', 'MONDO:0005021'], penetrance: 75, curve: '20:5 30:18 40:38 50:58 60:70 70:75', phenocopy: 0.2 }
    ]
  },
  {
    id: 'arvc',
    category: 'cardio',
    name: 'PKP2 / DSP / DSG2 — Arrhythmogenic cardiomyopathy (ARVC)',
    genes: ['PKP2', 'DSP', 'DSG2', 'DSC2', 'JUP', 'TMEM43'],
    mondo: ['MONDO:0016587'],
    notes: 'ClinGen ARVC VCEP; GeneReviews',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 1000,
    model: { deNovo: 5, penetrance: 45, onsetFrom: 15, onsetTo: 65, phenocopy: 0.05, unrecordedUnaffected: false },
    conditions: [
      { name: 'Arrhythmogenic right ventricular cardiomyopathy', aliases: ['Arrhythmogenic cardiomyopathy', 'Cardiomiopatia arritmogênica', 'Cardiomiopatia arritmogenica', 'Displasia arritmogênica do ventrículo direito', 'ARVC', 'CAVD', 'MONDO:0016587'], penetrance: 45, onsetFrom: 15, onsetTo: 65, phenocopy: 0.05 }
    ]
  },
  {
    id: 'lqts',
    category: 'cardio',
    name: 'KCNQ1 / KCNH2 — Long QT syndrome (LQTS)',
    genes: ['KCNQ1', 'KCNH2', 'KCNE1', 'KCNE2'],
    mondo: ['MONDO:0002442'],
    notes: 'ClinGen Long QT VCEP; Whiffin et al. 2017; GeneReviews (~15% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 2000,
    model: { deNovo: 15, penetrance: 40, onsetFrom: 5, onsetTo: 50, phenocopy: 0.05, unrecordedUnaffected: false },
    conditions: [
      { name: 'Long QT syndrome', aliases: ['Síndrome do QT longo', 'Sindrome do QT longo', 'LQTS', 'SQTL', 'MONDO:0002442'], penetrance: 40, onsetFrom: 5, onsetTo: 50, phenocopy: 0.05 }
    ]
  },
  {
    id: 'brugada',
    category: 'cardio',
    name: 'SCN5A — Brugada syndrome',
    genes: ['SCN5A'],
    mondo: ['MONDO:0015263'],
    notes: 'ClinGen Brugada VCEP; Whiffin et al. 2017; GeneReviews',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 2000,
    model: { deNovo: 5, penetrance: 25, onsetFrom: 20, onsetTo: 65, phenocopy: 0.05, unrecordedUnaffected: false },
    conditions: [
      { name: 'Brugada syndrome', aliases: ['Síndrome de Brugada', 'Sindrome de Brugada', 'MONDO:0015263'], penetrance: 25, onsetFrom: 20, onsetTo: 65, phenocopy: 0.05 }
    ]
  },
  {
    id: 'fh',
    category: 'cardio',
    name: 'LDLR / APOB / PCSK9 — Familial hypercholesterolemia (FH)',
    genes: ['LDLR', 'APOB', 'PCSK9'],
    mondo: ['MONDO:0007750'],
    notes: 'ClinGen FH VCEP (Chora et al. 2018); GeneReviews (~1 in 250 prevalence)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 250,
    model: { deNovo: 1, penetrance: 90, onsetFrom: 5, onsetTo: 55, phenocopy: 2 },
    conditions: [
      { name: 'Familial hypercholesterolemia', aliases: ['Hipercolesterolemia familiar', 'HF', 'FH', 'Hypercholesterolemia', 'Hipercolesterolemia', 'MONDO:0007750'], penetrance: 90, onsetFrom: 5, onsetTo: 55, phenocopy: 2 }
    ]
  },

  // =========================================================================================
  // 3. Neurogenetics (GeneReviews / ClinGen Epilepsy & Neurodegenerative VCEPs)
  // =========================================================================================
  {
    id: 'nf1',
    category: 'neuro',
    name: 'NF1 — Neurofibromatosis type 1',
    genes: ['NF1'],
    mondo: ['MONDO:0018975'],
    notes: 'GeneReviews (NF1; ~50% de novo, ~99% penetrance by age 10)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 3000,
    model: { deNovo: 50, penetrance: 99, onsetFrom: 0, onsetTo: 10, phenocopy: 0.01 },
    conditions: [
      { name: 'Neurofibromatosis type 1', aliases: ['Neurofibromatose tipo 1', 'Neurofibromatose 1', 'NF1', 'Doença de von Recklinghausen', 'MONDO:0018975'], penetrance: 99, onsetFrom: 0, onsetTo: 10, phenocopy: 0.01 }
    ]
  },
  {
    id: 'nf2',
    category: 'neuro',
    name: 'NF2 — NF2-related schwannomatosis',
    genes: ['NF2'],
    mondo: ['MONDO:0007959'],
    notes: 'GeneReviews (NF2; ~50% de novo, ~95% penetrance)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 33000,
    model: { deNovo: 50, penetrance: 95, onsetFrom: 10, onsetTo: 45, phenocopy: 0.01 },
    conditions: [
      { name: 'Neurofibromatosis type 2', aliases: ['Neurofibromatose tipo 2', 'NF2', 'NF2-related schwannomatosis', 'Schwannomatose relacionada a NF2', 'Vestibular schwannoma', 'MONDO:0007959'], penetrance: 95, onsetFrom: 10, onsetTo: 45, phenocopy: 0.01 }
    ]
  },
  {
    id: 'tsc',
    category: 'neuro',
    name: 'TSC1 / TSC2 — Tuberous sclerosis complex (TSC)',
    genes: ['TSC1', 'TSC2'],
    mondo: ['MONDO:0001734'],
    notes: 'GeneReviews (Tuberous Sclerosis Complex; ~66% de novo, ~95% penetrance)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 6000,
    model: { deNovo: 66, penetrance: 95, onsetFrom: 0, onsetTo: 15, phenocopy: 0.01 },
    conditions: [
      { name: 'Tuberous sclerosis complex', aliases: ['Tuberous sclerosis', 'Esclerose tuberosa', 'Complexo esclerose tuberosa', 'TSC', 'ET', 'MONDO:0001734'], penetrance: 95, onsetFrom: 0, onsetTo: 15, phenocopy: 0.01 }
    ]
  },
  {
    id: 'htt',
    category: 'neuro',
    name: 'HTT — Huntington disease',
    genes: ['HTT'],
    mondo: ['MONDO:0007739'],
    notes: 'GeneReviews (Huntington Disease; ~5% de novo expansion, age-dependent penetrance)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 10000,
    model: {
      deNovo: 5, penetrance: 98, onsetFrom: 25, onsetTo: 65,
      curve: '25:2 35:15 45:45 55:75 65:92 75:98', phenocopy: 0.01
    },
    conditions: [
      { name: 'Huntington disease', aliases: ['Doença de Huntington', 'Doenca de Huntington', 'Coreia de Huntington', 'Huntington chorea', 'MONDO:0007739'], penetrance: 98, curve: '25:2 35:15 45:45 55:75 65:92 75:98', phenocopy: 0.01 }
    ]
  },
  {
    id: 'sca3',
    category: 'neuro',
    name: 'ATXN3 / ATXN1 / ATXN2 / CACNA1A — Spinocerebellar ataxia (SCA / Machado-Joseph)',
    genes: ['ATXN3', 'ATXN1', 'ATXN2', 'CACNA1A', 'ATXN7', 'TBP'],
    mondo: ['MONDO:0007182', 'MONDO:0019064'],
    notes: 'GeneReviews (Spinocerebellar Ataxia Type 3 / Machado-Joseph Disease)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 20000,
    model: {
      deNovo: 1, penetrance: 95, onsetFrom: 20, onsetTo: 60,
      curve: '20:5 30:25 40:55 50:80 60:95', phenocopy: 0.01
    },
    conditions: [
      { name: 'Spinocerebellar ataxia type 3', aliases: ['Machado-Joseph disease', 'Doença de Machado-Joseph', 'Doenca de Machado-Joseph', 'Ataxia espinocerebelar', 'Spinocerebellar ataxia', 'SCA3', 'SCA1', 'SCA2', 'SCA6', 'DMJ', 'MONDO:0007182'], penetrance: 95, curve: '20:5 30:25 40:55 50:80 60:95', phenocopy: 0.01 }
    ]
  },
  {
    id: 'dmpk',
    category: 'neuro',
    name: 'DMPK — Myotonic dystrophy type 1 (Steinert disease)',
    genes: ['DMPK'],
    mondo: ['MONDO:0009669'],
    notes: 'GeneReviews (Myotonic Dystrophy Type 1)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 8000,
    model: { deNovo: 2, penetrance: 90, onsetFrom: 5, onsetTo: 50, phenocopy: 0.01 },
    conditions: [
      { name: 'Myotonic dystrophy type 1', aliases: ['Distrofia miotônica tipo 1', 'Distrofia miotonica', 'Doença de Steinert', 'Steinert disease', 'DM1', 'MONDO:0009669'], penetrance: 90, onsetFrom: 5, onsetTo: 50, phenocopy: 0.01 }
    ]
  },
  {
    id: 'cmt1a',
    category: 'neuro',
    name: 'PMP22 / MPZ / GJB1 — Charcot-Marie-Tooth disease (CMT1)',
    genes: ['PMP22', 'MPZ', 'MFN2'],
    mondo: ['MONDO:0018993', 'MONDO:0007308'],
    notes: 'GeneReviews (CMT1A; ~10–15% de novo PMP22 duplication)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 2500,
    model: { deNovo: 15, penetrance: 95, onsetFrom: 5, onsetTo: 35, phenocopy: 0.05 },
    conditions: [
      { name: 'Charcot-Marie-Tooth disease', aliases: ['Doença de Charcot-Marie-Tooth', 'Doenca de Charcot-Marie-Tooth', 'CMT', 'CMT1A', 'Neuropatia hereditária sensitivo-motora', 'MONDO:0018993'], penetrance: 95, onsetFrom: 5, onsetTo: 35, phenocopy: 0.05 }
    ]
  },
  {
    id: 'als-ftd',
    category: 'neuro',
    name: 'C9orf72 / SOD1 / TARDBP / GRN — Hereditary ALS / Frontotemporal dementia',
    genes: ['C9ORF72', 'SOD1', 'TARDBP', 'FUS', 'GRN', 'MAPT'],
    mondo: ['MONDO:0004976', 'MONDO:0017276'],
    notes: 'Murphy et al. 2017; GeneReviews (C9orf72 ALS/FTD)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 1000,
    model: {
      deNovo: 2, penetrance: 75, onsetFrom: 35, onsetTo: 75,
      curve: '40:5 50:22 60:48 70:68 80:75', phenocopy: 0.2, unrecordedUnaffected: false
    },
    conditions: [
      { name: 'Amyotrophic lateral sclerosis', aliases: ['Esclerose lateral amiotrófica', 'Esclerose lateral amiotrofica', 'ELA', 'ALS', 'Frontotemporal dementia', 'Demência frontotemporal', 'DFT', 'FTD', 'MONDO:0004976'], penetrance: 75, curve: '40:5 50:22 60:48 70:68 80:75', phenocopy: 0.2 }
    ]
  },
  {
    id: 'lrrk2',
    category: 'neuro',
    name: 'LRRK2 / SNCA / VPS35 — Autosomal dominant Parkinson disease',
    genes: ['LRRK2', 'SNCA', 'VPS35'],
    mondo: ['MONDO:0005180'],
    notes: 'Healy et al. 2008; ClinGen Parkinson VCEP; GeneReviews (~30–40% penetrance for LRRK2 p.G2019S)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 1000,
    model: {
      deNovo: 1, penetrance: 35, onsetFrom: 40, onsetTo: 80,
      curve: '50:4 60:12 70:25 80:35', phenocopy: 1.5, unrecordedUnaffected: false
    },
    conditions: [
      { name: 'Parkinson disease', aliases: ['Doença de Parkinson', 'Doenca de Parkinson', 'Parkinson', 'MONDO:0005180'], penetrance: 35, curve: '50:4 60:12 70:25 80:35', phenocopy: 1.5 }
    ]
  },
  {
    id: 'scn1a-dee',
    category: 'neuro',
    name: 'SCN1A / KCNQ2 / STXBP1 / SYNGAP1 — Dravet & developmental epileptic encephalopathy',
    genes: ['SCN1A', 'KCNQ2', 'SCN2A', 'SCN8A', 'STXBP1', 'SYNGAP1', 'CHD2'],
    mondo: ['MONDO:0011073'],
    notes: 'ClinGen Epilepsy VCEP; GeneReviews (~85–95% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 20000,
    model: { deNovo: 90, penetrance: 95, onsetFrom: 0, onsetTo: 3, phenocopy: 0.01 },
    conditions: [
      { name: 'Dravet syndrome', aliases: ['Síndrome de Dravet', 'Sindrome de Dravet', 'Developmental and epileptic encephalopathy', 'Encefalopatia epiléptica', 'MONDO:0011073'], penetrance: 95, onsetFrom: 0, onsetTo: 3, phenocopy: 0.01 }
    ]
  },

  // =========================================================================================
  // 4. Connective Tissue, Skeletal & Renal (ClinGen FBN1 / Collagen / Kidney VCEPs)
  // =========================================================================================
  {
    id: 'fbn1',
    category: 'connective',
    name: 'FBN1 — Marfan syndrome',
    genes: ['FBN1'],
    mondo: ['MONDO:0007947'],
    notes: 'ClinGen FBN1 VCEP; GeneReviews (Marfan Syndrome; ~25% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 5000,
    model: { deNovo: 25, penetrance: 98, onsetFrom: 0, onsetTo: 25, phenocopy: 0.02 },
    conditions: [
      { name: 'Marfan syndrome', aliases: ['Síndrome de Marfan', 'Sindrome de Marfan', 'Marfan', 'Thoracic aortic aneurysm', 'Aneurisma de aorta torácica', 'MONDO:0007947'], penetrance: 98, onsetFrom: 0, onsetTo: 25, phenocopy: 0.02 }
    ]
  },
  {
    id: 'col3a1-lds',
    category: 'connective',
    name: 'COL3A1 / TGFBR1 / TGFBR2 / SMAD3 — Vascular Ehlers-Danlos & Loeys-Dietz syndrome',
    genes: ['COL3A1', 'TGFBR1', 'TGFBR2', 'SMAD3', 'TGFB2'],
    mondo: ['MONDO:0017314', 'MONDO:0018954'],
    notes: 'GeneReviews (vEDS / Loeys-Dietz; ~50% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 50000,
    model: { deNovo: 50, penetrance: 95, onsetFrom: 5, onsetTo: 45, phenocopy: 0.01 },
    conditions: [
      { name: 'Vascular Ehlers-Danlos syndrome', aliases: ['Ehlers-Danlos syndrome', 'Síndrome de Ehlers-Danlos', 'Síndrome de Ehlers-Danlos vascular', 'Loeys-Dietz syndrome', 'Síndrome de Loeys-Dietz', 'vEDS', 'SED vascular', 'MONDO:0017314', 'MONDO:0018954'], penetrance: 95, onsetFrom: 5, onsetTo: 45, phenocopy: 0.01 }
    ]
  },
  {
    id: 'fgfr3',
    category: 'connective',
    name: 'FGFR3 — Achondroplasia',
    genes: ['FGFR3'],
    mondo: ['MONDO:0007037'],
    notes: 'GeneReviews (Achondroplasia; ~80% de novo, 100% congenital penetrance)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 25000,
    model: { deNovo: 80, penetrance: 100, onsetFrom: 0, onsetTo: 0, phenocopy: 0.001 },
    conditions: [
      { name: 'Achondroplasia', aliases: ['Acondroplasia', 'Hipocondroplasia', 'Hypochondroplasia', 'MONDO:0007037'], penetrance: 100, onsetFrom: 0, onsetTo: 0, phenocopy: 0.001 }
    ]
  },
  {
    id: 'col1a1-oi',
    category: 'connective',
    name: 'COL1A1 / COL1A2 — Osteogenesis imperfecta',
    genes: ['COL1A1', 'COL1A2'],
    mondo: ['MONDO:0019019'],
    notes: 'GeneReviews (COL1A1/2 Osteogenesis Imperfecta; ~35% de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 15000,
    model: { deNovo: 35, penetrance: 95, onsetFrom: 0, onsetTo: 15, phenocopy: 0.02 },
    conditions: [
      { name: 'Osteogenesis imperfecta', aliases: ['Osteogênese imperfeita', 'Osteogenese imperfeita', 'OI', 'MONDO:0019019'], penetrance: 95, onsetFrom: 0, onsetTo: 15, phenocopy: 0.02 }
    ]
  },
  {
    id: 'adpkd',
    category: 'connective',
    name: 'PKD1 / PKD2 — Autosomal dominant polycystic kidney disease (ADPKD)',
    genes: ['PKD1', 'PKD2'],
    mondo: ['MONDO:0004691'],
    notes: 'GeneReviews (ADPKD; ~10% de novo, age-dependent penetrance)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 1000,
    model: {
      deNovo: 10, penetrance: 95, onsetFrom: 15, onsetTo: 55,
      curve: '20:15 30:45 40:75 50:90 60:95', phenocopy: 0.1
    },
    conditions: [
      { name: 'Autosomal dominant polycystic kidney disease', aliases: ['Polycystic kidney disease', 'Doença renal policística', 'Doenca renal policistica', 'Rins policísticos', 'ADPKD', 'DRPAD', 'MONDO:0004691'], penetrance: 95, curve: '20:15 30:45 40:75 50:90 60:95', phenocopy: 0.1 }
    ]
  },

  // =========================================================================================
  // 5. Autosomal Recessive & Metabolic (ClinGen CSpec / Orphanet / Hardy-Weinberg)
  // =========================================================================================
  {
    id: 'cftr',
    category: 'recessive',
    name: 'CFTR — Cystic fibrosis',
    genes: ['CFTR'],
    mondo: ['MONDO:0009061'],
    notes: 'ClinGen CFTR VCEP; GeneReviews (carrier frequency ~1 in 30)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 30,
    model: { deNovo: 0, penetrance: 98, onsetFrom: 0, onsetTo: 5, phenocopy: 0.01 },
    conditions: [
      { name: 'Cystic fibrosis', aliases: ['Fibrose cística', 'Fibrose cistica', 'Mucoviscidose', 'FC', 'CF', 'MONDO:0009061'], penetrance: 98, onsetFrom: 0, onsetTo: 5, phenocopy: 0.01 }
    ]
  },
  {
    id: 'smn1',
    category: 'recessive',
    name: 'SMN1 — Spinal muscular atrophy (SMA)',
    genes: ['SMN1'],
    mondo: ['MONDO:0001516'],
    notes: 'GeneReviews (SMA; carrier frequency ~1 in 50)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 50,
    model: { deNovo: 0, penetrance: 98, onsetFrom: 0, onsetTo: 3, phenocopy: 0.005 },
    conditions: [
      { name: 'Spinal muscular atrophy', aliases: ['Atrofia muscular espinhal', 'AME', 'SMA', 'MONDO:0001516'], penetrance: 98, onsetFrom: 0, onsetTo: 3, phenocopy: 0.005 }
    ]
  },
  {
    id: 'gba1',
    category: 'recessive',
    name: 'GBA1 — Gaucher disease',
    genes: ['GBA1', 'GBA'],
    mondo: ['MONDO:0018150'],
    notes: 'GeneReviews (Gaucher Disease; carrier frequency ~1 in 100 general, ~1 in 15 Ashkenazi)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 100,
    model: { deNovo: 0, penetrance: 85, onsetFrom: 1, onsetTo: 40, phenocopy: 0.005 },
    conditions: [
      { name: 'Gaucher disease', aliases: ['Gaucher Disease', 'Doença de Gaucher', 'Doenca de Gaucher', 'MONDO:0018150'], penetrance: 85, onsetFrom: 1, onsetTo: 40, phenocopy: 0.005 }
    ]
  },
  {
    id: 'hbb',
    category: 'recessive',
    name: 'HBB — Sickle cell disease & beta-thalassemia',
    genes: ['HBB'],
    mondo: ['MONDO:0011382', 'MONDO:0001309'],
    notes: 'ClinGen Hemoglobinopathy VCEP; GeneReviews (carrier frequency ~1 in 25)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 25,
    model: { deNovo: 0, penetrance: 98, onsetFrom: 0, onsetTo: 2, phenocopy: 0.01 },
    conditions: [
      { name: 'Sickle cell disease', aliases: ['Anemia falciforme', 'Doença falciforme', 'Doenca falciforme', 'Beta-thalassemia', 'Talassemia beta', 'Beta talassemia', 'MONDO:0011382', 'MONDO:0001309'], penetrance: 98, onsetFrom: 0, onsetTo: 2, phenocopy: 0.01 }
    ]
  },
  {
    id: 'pah',
    category: 'recessive',
    name: 'PAH — Phenylketonuria (PKU)',
    genes: ['PAH'],
    mondo: ['MONDO:0009861'],
    notes: 'ClinGen PAH VCEP; GeneReviews (prevalence ~1:10,000 → carrier 1 in 50)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 50,
    model: { deNovo: 0, penetrance: 99, onsetFrom: 0, onsetTo: 1, phenocopy: 0.005 },
    conditions: [
      { name: 'Phenylketonuria', aliases: ['Fenilcetonúria', 'Fenilcetonuria', 'PKU', 'MONDO:0009861'], penetrance: 99, onsetFrom: 0, onsetTo: 1, phenocopy: 0.005 }
    ]
  },
  {
    id: 'gjb2',
    category: 'recessive',
    name: 'GJB2 — Nonsyndromic hearing loss (DFNB1)',
    genes: ['GJB2'],
    mondo: ['MONDO:0008995', 'MONDO:0019587'],
    notes: 'ClinGen Hearing Loss VCEP (Oza et al. 2018); GeneReviews (carrier frequency ~1 in 35)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 35,
    model: { deNovo: 0, penetrance: 95, onsetFrom: 0, onsetTo: 3, phenocopy: 0.1 },
    conditions: [
      { name: 'Nonsyndromic hearing loss', aliases: ['Hearing loss', 'Surdez congênita', 'Surdez neurossensorial', 'Perda auditiva', 'DFNB1', 'Deafness', 'MONDO:0008995'], penetrance: 95, onsetFrom: 0, onsetTo: 3, phenocopy: 0.1 }
    ]
  },
  {
    id: 'hfe',
    category: 'recessive',
    name: 'HFE — Hereditary hemochromatosis',
    genes: ['HFE'],
    mondo: ['MONDO:0006507'],
    notes: 'ClinGen / ACMG SF; GeneReviews (carrier ~1 in 10, clinical penetrance ~20%)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 10,
    model: { deNovo: 0, penetrance: 20, onsetFrom: 30, onsetTo: 70, phenocopy: 0.5, unrecordedUnaffected: false },
    conditions: [
      { name: 'Hereditary hemochromatosis', aliases: ['Hemocromatose hereditária', 'Hemocromatose hereditaria', 'Hemocromatose', 'Hemochromatosis', 'MONDO:0006507'], penetrance: 20, onsetFrom: 30, onsetTo: 70, phenocopy: 0.5 }
    ]
  },
  {
    id: 'atp7b',
    category: 'recessive',
    name: 'ATP7B — Wilson disease',
    genes: ['ATP7B'],
    mondo: ['MONDO:0010200'],
    notes: 'ClinGen / ACMG SF; GeneReviews (prevalence 1:30,000 → carrier 1 in 90)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 90,
    model: { deNovo: 0, penetrance: 95, onsetFrom: 5, onsetTo: 40, phenocopy: 0.01 },
    conditions: [
      { name: 'Wilson disease', aliases: ['Doença de Wilson', 'Doenca de Wilson', 'Degeneração hepatolenticular', 'MONDO:0010200'], penetrance: 95, onsetFrom: 5, onsetTo: 40, phenocopy: 0.01 }
    ]
  },
  {
    id: 'gaa',
    category: 'recessive',
    name: 'GAA — Pompe disease (Glycogen storage disease type II)',
    genes: ['GAA'],
    mondo: ['MONDO:0009290'],
    notes: 'ClinGen GAA VCEP; GeneReviews (prevalence 1:40,000 → carrier 1 in 100)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 100,
    model: { deNovo: 0, penetrance: 95, onsetFrom: 0, onsetTo: 40, phenocopy: 0.005 },
    conditions: [
      { name: 'Pompe disease', aliases: ['Doença de Pompe', 'Doenca de Pompe', 'Glicogenose tipo II', 'Glycogen storage disease type II', 'MONDO:0009290'], penetrance: 95, onsetFrom: 0, onsetTo: 40, phenocopy: 0.005 }
    ]
  },
  {
    id: 'idua',
    category: 'recessive',
    name: 'IDUA — Mucopolysaccharidosis type I (MPS I / Hurler-Scheie)',
    genes: ['IDUA'],
    mondo: ['MONDO:0001586'],
    notes: 'GeneReviews (MPS I; prevalence 1:100,000 → carrier 1 in 160)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 160,
    model: { deNovo: 0, penetrance: 99, onsetFrom: 0, onsetTo: 10, phenocopy: 0.001 },
    conditions: [
      { name: 'Mucopolysaccharidosis type I', aliases: ['Mucopolissacaridose tipo I', 'Mucopolissacaridose tipo 1', 'MPS I', 'MPS 1', 'Síndrome de Hurler', 'Hurler syndrome', 'Scheie syndrome', 'MONDO:0001586'], penetrance: 99, onsetFrom: 0, onsetTo: 10, phenocopy: 0.001 }
    ]
  },
  {
    id: 'cyp21a2',
    category: 'recessive',
    name: 'CYP21A2 — Congenital adrenal hyperplasia (21-OHD)',
    genes: ['CYP21A2'],
    mondo: ['MONDO:0008737'],
    notes: 'GeneReviews (CYP21A2 CAH; prevalence 1:15,000 → carrier 1 in 60)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 60,
    model: { deNovo: 0, penetrance: 98, onsetFrom: 0, onsetTo: 2, phenocopy: 0.01 },
    conditions: [
      { name: 'Congenital adrenal hyperplasia', aliases: ['Hiperplasia adrenal congênita', 'Hiperplasia adrenal congenita', 'HAC', 'CAH', 'MONDO:0008737'], penetrance: 98, onsetFrom: 0, onsetTo: 2, phenocopy: 0.01 }
    ]
  },
  {
    id: 'fxn',
    category: 'recessive',
    name: 'FXN — Friedreich ataxia',
    genes: ['FXN'],
    mondo: ['MONDO:0009249'],
    notes: 'GeneReviews (Friedreich Ataxia; prevalence 1:40,000 → carrier 1 in 90)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 90,
    model: { deNovo: 0, penetrance: 99, onsetFrom: 5, onsetTo: 25, phenocopy: 0.005 },
    conditions: [
      { name: 'Friedreich ataxia', aliases: ['Ataxia de Friedreich', 'MONDO:0009249'], penetrance: 99, onsetFrom: 5, onsetTo: 25, phenocopy: 0.005 }
    ]
  },
  {
    id: 'abca4-ush2a',
    category: 'recessive',
    name: 'ABCA4 / USH2A — Stargardt disease & Usher syndrome',
    genes: ['ABCA4', 'USH2A'],
    mondo: ['MONDO:0019353', 'MONDO:0019501'],
    notes: 'ClinGen Retinal VCEP; GeneReviews (carrier frequency ~1 in 50)',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 50,
    model: { deNovo: 0, penetrance: 95, onsetFrom: 6, onsetTo: 35, phenocopy: 0.02 },
    conditions: [
      { name: 'Stargardt disease', aliases: ['Doença de Stargardt', 'Usher syndrome', 'Síndrome de Usher', 'Retinitis pigmentosa', 'Retinose pigmentar', 'MONDO:0019353', 'MONDO:0019501'], penetrance: 95, onsetFrom: 6, onsetTo: 35, phenocopy: 0.02 }
    ]
  },

  // =========================================================================================
  // 6. X-linked & Mitochondrial (GeneReviews / ClinGen VCEPs)
  // =========================================================================================
  {
    id: 'gla',
    category: 'xlinked',
    name: 'GLA — Fabry disease',
    genes: ['GLA'],
    mondo: ['MONDO:0010526'],
    notes: 'GeneReviews (Fabry Disease; ~7% de novo, ~70% female penetrance, affected males reproduce)',
    mode: 'XLD', indexGenotype: 'het', carrierFreqN: 20000,
    model: { deNovo: 7, penetrance: 99, femalePen: 70, onsetFrom: 5, onsetTo: 35, phenocopy: 0.01, mutationRatio: 1 },
    conditions: [
      { name: 'Fabry disease', aliases: ['Doença de Fabry', 'Doenca de Fabry', 'Anderson-Fabry disease', 'Fabry', 'MONDO:0010526'], penetrance: 99, femalePen: 70, onsetFrom: 5, onsetTo: 35, phenocopy: 0.01 }
    ]
  },
  {
    id: 'dmd',
    category: 'xlinked',
    name: 'DMD — Duchenne / Becker muscular dystrophy',
    genes: ['DMD'],
    mondo: ['MONDO:0010679', 'MONDO:0010311'],
    notes: 'GeneReviews (Dystrophinopathies; Haldane 1/3 de novo, ~8% manifesting female carriers)',
    mode: 'XLR', indexGenotype: 'het', carrierFreqN: 5000,
    model: { deNovo: 33.3, penetrance: 99, femalePen: 8, onsetFrom: 2, onsetTo: 6, phenocopy: 0.01, mutationRatio: 1 },
    conditions: [
      { name: 'Duchenne muscular dystrophy', aliases: ['Distrofia muscular de Duchenne', 'Distrofia muscular de Becker', 'Becker muscular dystrophy', 'DMD', 'DMB', 'MONDO:0010679'], penetrance: 99, femalePen: 8, onsetFrom: 2, onsetTo: 6, phenocopy: 0.01 }
    ]
  },
  {
    id: 'f8',
    category: 'xlinked',
    name: 'F8 — Hemophilia A',
    genes: ['F8'],
    mondo: ['MONDO:0010602'],
    notes: 'ClinGen Coagulation Factor VCEP; GeneReviews (male/female mutation ratio ~5; ~80% of mothers of isolated cases are carriers)',
    mode: 'XLR', indexGenotype: 'het', carrierFreqN: 5000,
    model: { deNovo: 20, penetrance: 99, femalePen: 10, onsetFrom: 0, onsetTo: 2, phenocopy: 0.01, mutationRatio: 5 },
    conditions: [
      { name: 'Hemophilia A', aliases: ['Hemofilia A', 'Hemofilia', 'Hemophilia', 'MONDO:0010602'], penetrance: 99, femalePen: 10, onsetFrom: 0, onsetTo: 2, phenocopy: 0.01 }
    ]
  },
  {
    id: 'f9',
    category: 'xlinked',
    name: 'F9 — Hemophilia B',
    genes: ['F9'],
    mondo: ['MONDO:0010604'],
    notes: 'ClinGen Coagulation Factor VCEP; GeneReviews (male/female mutation ratio ~8)',
    mode: 'XLR', indexGenotype: 'het', carrierFreqN: 25000,
    model: { deNovo: 15, penetrance: 99, femalePen: 10, onsetFrom: 0, onsetTo: 2, phenocopy: 0.01, mutationRatio: 8 },
    conditions: [
      { name: 'Hemophilia B', aliases: ['Hemofilia B', 'Christmas disease', 'MONDO:0010604'], penetrance: 99, femalePen: 10, onsetFrom: 0, onsetTo: 2, phenocopy: 0.01 }
    ]
  },
  {
    id: 'fmr1',
    category: 'xlinked',
    name: 'FMR1 — Fragile X syndrome',
    genes: ['FMR1'],
    mondo: ['MONDO:0010383'],
    notes: 'GeneReviews (FMR1 Disorders; mothers of affected children are obligate premutation/full-mutation carriers)',
    mode: 'XLD', indexGenotype: 'het', carrierFreqN: 4000,
    model: { deNovo: 1, penetrance: 95, femalePen: 50, onsetFrom: 1, onsetTo: 4, phenocopy: 0.05, mutationRatio: 1 },
    conditions: [
      { name: 'Fragile X syndrome', aliases: ['Síndrome do X frágil', 'Sindrome do X fragil', 'X frágil', 'SXF', 'FXS', 'MONDO:0010383'], penetrance: 95, femalePen: 50, onsetFrom: 1, onsetTo: 4, phenocopy: 0.05 }
    ]
  },
  {
    id: 'ids',
    category: 'xlinked',
    name: 'IDS — Mucopolysaccharidosis type II (Hunter syndrome)',
    genes: ['IDS'],
    mondo: ['MONDO:0010674'],
    notes: 'GeneReviews (MPS II / Hunter Syndrome; ~25% de novo)',
    mode: 'XLR', indexGenotype: 'het', carrierFreqN: 50000,
    model: { deNovo: 25, penetrance: 99, femalePen: 1, onsetFrom: 1, onsetTo: 5, phenocopy: 0.001, mutationRatio: 2 },
    conditions: [
      { name: 'Mucopolysaccharidosis type II', aliases: ['Mucopolissacaridose tipo II', 'Mucopolissacaridose tipo 2', 'MPS II', 'MPS 2', 'Hunter syndrome', 'Síndrome de Hunter', 'Sindrome de Hunter', 'MONDO:0010674'], penetrance: 99, femalePen: 1, onsetFrom: 1, onsetTo: 5, phenocopy: 0.001 }
    ]
  },
  {
    id: 'otc',
    category: 'xlinked',
    name: 'OTC — Ornithine transcarbamylase deficiency',
    genes: ['OTC'],
    mondo: ['MONDO:0010703'],
    notes: 'GeneReviews (OTC Deficiency; ~25% de novo, ~20% heterozygous females symptomatic)',
    mode: 'XLD', indexGenotype: 'het', carrierFreqN: 30000,
    model: { deNovo: 25, penetrance: 98, femalePen: 20, onsetFrom: 0, onsetTo: 15, phenocopy: 0.005, mutationRatio: 1 },
    conditions: [
      { name: 'Ornithine transcarbamylase deficiency', aliases: ['Deficiência de ornitina transcarbamilase', 'Deficiencia de OTC', 'OTC deficiency', 'MONDO:0010703'], penetrance: 98, femalePen: 20, onsetFrom: 0, onsetTo: 15, phenocopy: 0.005 }
    ]
  },
  {
    id: 'col4a5',
    category: 'xlinked',
    name: 'COL4A5 — X-linked Alport syndrome',
    genes: ['COL4A5'],
    mondo: ['MONDO:0010520'],
    notes: 'ClinGen Alport VCEP; GeneReviews (~12–15% de novo, high female hematuria/renal risk)',
    mode: 'XLD', indexGenotype: 'het', carrierFreqN: 5000,
    model: { deNovo: 15, penetrance: 98, femalePen: 75, onsetFrom: 5, onsetTo: 45, phenocopy: 0.05, mutationRatio: 1 },
    conditions: [
      { name: 'Alport syndrome', aliases: ['Síndrome de Alport', 'Sindrome de Alport', 'MONDO:0010520'], penetrance: 98, femalePen: 75, onsetFrom: 5, onsetTo: 45, phenocopy: 0.05 }
    ]
  },
  {
    id: 'abcd1',
    category: 'xlinked',
    name: 'ABCD1 — X-linked adrenoleukodystrophy (X-ALD)',
    genes: ['ABCD1'],
    mondo: ['MONDO:0010518'],
    notes: 'GeneReviews (X-ALD; ~8% de novo, ~65% of heterozygous women develop myelopathy by age 60)',
    mode: 'XLR', indexGenotype: 'het', carrierFreqN: 15000,
    model: { deNovo: 8, penetrance: 95, femalePen: 65, onsetFrom: 4, onsetTo: 55, phenocopy: 0.005, mutationRatio: 1 },
    conditions: [
      { name: 'X-linked adrenoleukodystrophy', aliases: ['Adrenoleukodystrophy', 'Adrenoleucodistrofia', 'Adrenoleucodistrofia ligada ao X', 'X-ALD', 'ALD', 'MONDO:0010518'], penetrance: 95, femalePen: 65, onsetFrom: 4, onsetTo: 55, phenocopy: 0.005 }
    ]
  },
  {
    id: 'mecp2',
    category: 'xlinked',
    name: 'MECP2 — Rett syndrome',
    genes: ['MECP2'],
    mondo: ['MONDO:0010726'],
    notes: 'ClinGen Rett/Angelman VCEP; GeneReviews (>99% de novo)',
    mode: 'XLD', indexGenotype: 'het', carrierFreqN: 10000,
    model: { deNovo: 99, penetrance: 99, femalePen: 99, onsetFrom: 0, onsetTo: 2, phenocopy: 0.005, mutationRatio: 1 },
    conditions: [
      { name: 'Rett syndrome', aliases: ['Síndrome de Rett', 'Sindrome de Rett', 'MONDO:0010726'], penetrance: 99, femalePen: 99, onsetFrom: 0, onsetTo: 2, phenocopy: 0.005 }
    ]
  },
  {
    id: 'melas',
    category: 'xlinked',
    name: 'MT-TL1 / MT-TK — Mitochondrial encephalomyopathy (MELAS / MERRF)',
    genes: ['MT-TL1', 'MT-TK', 'MT-ATP6', 'MTTL1', 'MTTK'],
    mondo: ['MONDO:0010789', 'MONDO:0010790'],
    notes: 'ClinGen Mitochondrial VCEP; GeneReviews (~25% de novo, variable heteroplasmy penetrance)',
    mode: 'MT', indexGenotype: 'het', carrierFreqN: 10000,
    model: { deNovo: 25, penetrance: 60, onsetFrom: 2, onsetTo: 45, phenocopy: 0.01, unrecordedUnaffected: false },
    conditions: [
      { name: 'MELAS', aliases: ['MELAS syndrome', 'Síndrome MELAS', 'MERRF', 'Mitochondrial encephalomyopathy', 'Encefalomiopatia mitocondrial', 'Mitochondrial disease', 'Doença mitocondrial', 'MONDO:0010789'], penetrance: 60, onsetFrom: 2, onsetTo: 45, phenocopy: 0.01 }
    ]
  },
  {
    id: 'lhon',
    category: 'xlinked',
    name: 'MT-ND4 / MT-ND1 / MT-ND6 — Leber hereditary optic neuropathy (LHON)',
    genes: ['MT-ND4', 'MT-ND1', 'MT-ND6', 'MTND4', 'MTND1', 'MTND6'],
    mondo: ['MONDO:0010788'],
    notes: 'ClinGen Mitochondrial VCEP; GeneReviews (~30% overall penetrance: ~50% in males, ~10% in females)',
    mode: 'MT', indexGenotype: 'het', carrierFreqN: 30000,
    model: { deNovo: 5, penetrance: 30, onsetFrom: 12, onsetTo: 45, phenocopy: 0.01, unrecordedUnaffected: false },
    conditions: [
      { name: 'Leber hereditary optic neuropathy', aliases: ['Neuropatia óptica hereditária de Leber', 'LHON', 'NOHL', 'MONDO:0010788'], penetrance: 30, onsetFrom: 12, onsetTo: 45, phenocopy: 0.01 }
    ]
  },

  // =========================================================================================
  // 7. ACMG v4 / ClinGen Rare-Disease Archetypes (Whiffin/Ware & SVC v4 framework)
  // =========================================================================================
  {
    id: 'acmg-v4-rare-ad-denovo',
    category: 'acmg',
    name: 'ACMG v4 — Ultra-rare early-onset AD disorder (high de novo / full penetrance)',
    genes: [],
    notes: 'ACMG/ClinGen SVC v4 & Whiffin/Ware: severe pediatric AD condition with low reproductive fitness',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 50000,
    model: { deNovo: 80, penetrance: 98, onsetFrom: 0, onsetTo: 5, phenocopy: 0.01 },
    conditions: []
  },
  {
    id: 'acmg-v4-rare-ad-incomplete',
    category: 'acmg',
    name: 'ACMG v4 — Rare adult-onset AD disorder with reduced penetrance',
    genes: [],
    notes: 'ACMG/ClinGen SVC v4 & Whiffin/Ware: adult-onset AD condition (~50% penetrance, low de novo)',
    mode: 'AD', indexGenotype: 'het', carrierFreqN: 2000,
    model: { deNovo: 5, penetrance: 50, onsetFrom: 20, onsetTo: 65, phenocopy: 0.1, unrecordedUnaffected: false },
    conditions: []
  },
  {
    id: 'acmg-v4-rare-ar',
    category: 'acmg',
    name: 'ACMG v4 — Ultra-rare autosomal recessive disorder (prevalence ≤ 1:100,000)',
    genes: [],
    notes: 'ACMG/ClinGen SVC v4 & Hardy-Weinberg: prevalence ~1:160,000 → carrier frequency ~1 in 200',
    mode: 'AR', indexGenotype: 'biallelic', carrierFreqN: 200,
    model: { deNovo: 0, penetrance: 98, onsetFrom: 0, onsetTo: 10, phenocopy: 0.005 },
    conditions: []
  }
];

export { CATALOG_CATEGORIES, RAW_PRESETS };
