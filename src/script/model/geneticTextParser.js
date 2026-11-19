/**
 * Reads genetic test results written as free text (a lab report or a note in the medical record,
 * in Portuguese, English or Spanish) and splits them into the fields of a test result: gene,
 * variant (HGVS c. or exon deletion / duplication), protein change, zygosity, classification, test
 * type, laboratory, date and transcript.
 *
 *   "BRCA2 NM_000059.4:c.5946del p.(Ser1982Argfs*22) em heterozigose, patogênica (Fleury, 12/03/2023)"
 *   → { gene: 'BRCA2', variant: 'c.5946del', protein: 'p.(Ser1982Argfs*22)', zygosity: 'het',
 *       classification: 'P', lab: 'Fleury', date: '2023-03-12', comment: 'NM_000059.4' }
 *
 * Several variants in the same text give several results. Each variant takes the gene written
 * nearest before it (or right after it), and the zygosity, classification and so on written between
 * it and the next variant's gene; what is written before the first one ("Variantes patogênicas em
 * heterozigose: ...") applies to all. A text with no variant but a negative result ("painel negativo
 * para BRCA1 e BRCA2") gives one negative result per gene named.
 *
 * Nothing is looked up: the fields are only filled from the text, to be checked by the user.
 */

// Words in capitals that are not gene symbols (methods, classes, units, words of reports)
var NOT_GENES = ('DNA RNA CDNA MRNA VUS VSI CNV CNVS SNV SNVS INDEL MLPA PCR QPCR NGS WES WGS HGVS ACMG AMP CAP ' +
  'OMIM HPO ORPHA MONDO NM NP NC NG NR ENST LRG ID CID CRM CPF RG SUS UTI USA EUA UK EU OK LAB LTDA SA ' +
  'GENE GENES GEN PAINEL PANEL EXOMA EXOME GENOMA GENOME LAUDO EXAME TESTE TEST DATA DATE RESULTADO ' +
  'RESULT NEGATIVO NEGATIVE POSITIVO POSITIVE HET HOM HEMI AD AR XL XLR XLD MT YL LP LB VS NA ND NR ' +
  'DR DRA PROF MAE PAI AVO TIA TIO IRMA FILHA FILHO SIM NAO NO YES HIGH LOW II III IV VI VII VIII IX XI XII ' +
  'XIII XIV XV CLASSE CLASS ART REF OBS NOTA NOTE ATT ANO ANOS DIA DIAS MES MESES HPV HIV HCV HBV COVID ' +
  'MRI RNM TC CT ECG ECO EEG IMC BMI IARC NCCN ESMO ASCO UNK DEL DUP INS INV FS TER EXON EXONS').split(' ');

var STOP = {};
NOT_GENES.forEach(function(w) { STOP[w] = true; });

// ACMG criteria (PVS1, PM2, BP4...) and similar codes
var CRITERION = /^(PVS|PS|PM|PP|BA|BS|BP)\d+$/;

var KNOWN_LABS = ['Fleury', 'DASA', 'Mendelics', 'Invitae', 'Ambry', 'GeneDx', 'Myriad', 'Hermes Pardini', 'Genomika',
  'Sabin', 'Centogene', 'Blueprint Genetics', 'Color', 'Igenomix', 'DB Diagnósticos', 'Diagnósticos do Brasil',
  'Albert Einstein', 'Sírio-Libanês', 'Progenética', 'GenePro', 'Neogenomica', 'Oncoclínicas', 'Natera',
  'PreventionGenetics', 'Prevention Genetics', 'Fulgent', 'Quest', 'LabCorp', 'Baylor', 'Mayo Clinic', 'Labforce', 'Genera', 'Hospital Israelita'];

var escapeRe = function(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

var isGeneToken = function(token) {
  if (!token || token.length < 2 || token.length > 10) return false;
  var upper = token.toUpperCase();
  if (STOP[upper] || CRITERION.test(upper)) return false;
  if (/^[A-Z][A-Z0-9]+(-[A-Z0-9]+)?$/.test(token)) {
    // all-letter words in capitals: gene symbols are short (ATM, APC, PTEN, MUTYH, EPCAM)
    return /\d/.test(token) || token.length <= 6;
  }
  // mixed case only with a digit (C9orf72)
  return /^[A-Z][A-Za-z0-9]*\d[A-Za-z0-9]*$/.test(token) && /[A-Z]{1,}/.test(token);
};

/** Every gene-like token with its position: [{ symbol, index, end }] */
var findGenes = function(text) {
  var out = [];
  // accented letters are part of the word ("PATOGÊNICA" is one word, not the symbol "PATOG")
  var re = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]*(?:-[A-Z0-9]+)?/g;
  var m;
  while ((m = re.exec(text))) {
    var token = m[0];
    var before = text.charAt(m.index - 1);
    // part of a transcript or of HGVS (NM_000059, c.68): not a gene
    if (before === '_' || before === '.' || /^[cgmnrp]$/.test(token)) continue;
    var gene = isGeneToken(token);
    // "gene brca2", "gen brca1": a symbol written in lower case after the word gene
    if (!gene && /(?:^|[^A-Za-z])(gene|gen)\s+$/i.test(text.slice(Math.max(0, m.index - 8), m.index)) &&
        isGeneToken(token.toUpperCase())) {
      gene = true;
    }
    if (gene) out.push({ symbol: token.toUpperCase().replace(/^C(\d+)ORF/, 'C$1orf'), index: m.index, end: m.index + token.length });
  }
  return out;
};

// trims punctuation that ends the sentence, and closing brackets with no opening one
var trimNotation = function(s) {
  s = s.replace(/\s+/g, '');
  for (;;) {
    var last = s.charAt(s.length - 1);
    if (/[.,:;]/.test(last)) {
      s = s.slice(0, -1);
      continue;
    }
    if (last === ')' || last === ']') {
      var open = last === ')' ? '(' : '[';
      var opens = s.split(open).length - 1, closes = s.split(last).length - 1;
      if (closes > opens) {
        s = s.slice(0, -1);
        continue;
      }
    }
    return s;
  }
};

/** Variants with their position: [{ variant, index, end, kind }] */
var findVariants = function(text) {
  var out = [];
  var m;
  // HGVS c. (also n. and g. when no c. is written)
  var reC = /(^|[^A-Za-z0-9_])(c\.\s?[-*+(?0-9][^\s,;]*)/gi;
  while ((m = reC.exec(text))) {
    var start = m.index + m[1].length;
    var v = trimNotation(m[2]);
    v = 'c.' + v.slice(2);
    if (/\d/.test(v)) out.push({ variant: v, index: start, end: start + m[2].length, kind: 'c' });
  }
  // exon deletions / duplications: "deleção dos éxons 1 a 3", "exon 13 duplication", "del ex 8-9"
  var exon = '(?:[eé]x(?:on|ons|ão|ões|on|ones)?\\.?)';
  var range = '(\\d+)(?:\\s*(?:-|–|a|ao|to|e|and|y)\\s*(\\d+))?';
  var reCnv1 = new RegExp('(dele[cç][aã]o|deletion|duplica[cç][aã]o|duplication|del|dup)\\s+(?:heterozig\\w*\\s+|heterozyg\\w*\\s+)?(?:d[oe]s?|of(?:\\s+the)?)?\\s*' + exon + '\\s*' + range, 'gi');
  while ((m = reCnv1.exec(text))) {
    out.push({ variant: (/^d[eu]l|^dele/i.test(m[1]) && !/^dup/i.test(m[1]) ? 'del' : 'dup') + ' ex' + m[2] + (m[3] ? '-' + m[3] : ''),
      index: m.index, end: m.index + m[0].length, kind: 'cnv' });
  }
  var reCnv2 = new RegExp(exon + '\\s*' + range + '\\s+(dele[cç][aã]o|deleted|deletion|deletad[oa]s?|duplica[cç][aã]o|duplication|duplicated|duplicad[oa]s?)', 'gi');
  while ((m = reCnv2.exec(text))) {
    out.push({ variant: (/^del/i.test(m[3]) ? 'del' : 'dup') + ' ex' + m[1] + (m[2] ? '-' + m[2] : ''),
      index: m.index, end: m.index + m[0].length, kind: 'cnv' });
  }
  // rsID, when it is the only notation of a variant
  var reRs = /\b(rs\d{3,})\b/g;
  while ((m = reRs.exec(text))) {
    out.push({ variant: m[1], index: m.index, end: m.index + m[1].length, kind: 'rs' });
  }
  // protein change written without c. ("p.Arg1443Ter"), kept when no c. is close to it
  var reP = /(^|[^A-Za-z0-9_])(p\.\s?\(?[A-Z*=?][^\s,;]*)/g;
  while ((m = reP.exec(text))) {
    var pStart = m.index + m[1].length;
    out.push({ variant: '', protein: trimNotation(m[2]), index: pStart, end: pStart + m[2].length, kind: 'p' });
  }
  out.sort(function(a, b) { return a.index - b.index; });
  // drop overlaps (a CNV matched twice) and rsIDs / protein changes that go with a nearby c.
  var cs = out.filter(function(v) { return v.kind === 'c' || v.kind === 'cnv'; });
  var near = function(v, dist) {
    return cs.some(function(c) { return Math.abs(c.index - v.index) <= dist; });
  };
  var kept = [];
  out.forEach(function(v) {
    if ((v.kind === 'rs' && near(v, 80)) || (v.kind === 'p' && near(v, 70))) return;
    var last = kept[kept.length - 1];
    if (last && v.index < last.end) return;
    kept.push(v);
  });
  return kept;
};

// earliest match of any of the patterns: [code, regex] pairs; returns { code, index } or null
var earliest = function(text, patterns) {
  var best = null;
  patterns.forEach(function(p) {
    p[1].lastIndex = 0;
    var m = p[1].exec(text);
    if (m && (!best || m.index < best.index)) best = { code: p[0], index: m.index };
  });
  return best;
};

var CLASS_PATTERNS = [
  ['LP', /provavelmente\s+patog[eê]nic|likely\s+pathogenic|probablemente\s+patog[eé]nic|\bLP\b|\bclass[e]?\s*(?:IV|4)\b/i],
  ['P', /(?:^|[^a-zà-ú])(?:patog[eê]nic|pathogenic|patog[eé]nic|deleteri)|\bclass[e]?\s*(?:V|5)\b/i],
  ['VUS', /\bVUS\b|\bVSI\b|significado\s+(?:cl[ií]nico\s+)?incerto|uncertain\s+significance|significado\s+incierto|\bclass[e]?\s*(?:III|3)\b/i],
  ['LB', /provavelmente\s+benign|likely\s+benign|probablemente\s+benign|\bLB\b|\bclass[e]?\s*(?:II|2)\b/i],
  ['B', /(?:^|[^a-zà-ú])(?:benign|benigna|benigno)|\bclass[e]?\s*(?:I|1)\b/i]
];

var ZYG_PATTERNS = [
  ['compound', /heteroz[iy]g\w*\s+compost|compound\s+het|het\w*\s+compuest|\bem\s+trans\b|\bin\s+trans\b/i],
  ['hemi', /hemiz[iy]g|hemic[iy]g|\bhemi\b/i],
  ['hom', /homoz[iy]g|homoc[iy]g|\bhom\b/i],
  ['het', /heteroz[iy]g|heteroc[iy]g|\bhet\b/i]
];

var TARGETED = /segrega|variante\s+familiar|familial\s+variant|known\s+variant|teste\s+(?:direcionado|alvo)|targeted|site[- ]specific|single[- ]site|pesquisa\s+(?:da|de)\s+variante|cascata|cascade/i;

var NEGATIVE = /negativ|n[aã]o\s+(?:foram\s+|foi\s+)?(?:identificad|detectad|encontrad)|no\s+(?:pathogenic\s+|clinically\s+significant\s+)?(?:variants?|mutations?)\s+(?:were\s+)?(?:identified|detected|found)|sem\s+variantes|no\s+se\s+(?:identificaron|detectaron)/i;

// ISO date (yyyy-mm-dd) from dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, yyyy-mm-dd or mm/yyyy
var findDate = function(text) {
  var m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(text);
  var y, mo, d;
  if (m) {
    y = +m[1]; mo = +m[2]; d = +m[3];
  } else if ((m = /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})\b/.exec(text))) {
    d = +m[1]; mo = +m[2]; y = +m[3];
    if (mo > 12 && d <= 12) { var t = d; d = mo; mo = t; } // written month first
    if (y < 100) y += y < 50 ? 2000 : 1900;
  } else if ((m = /\b(\d{1,2})\/(\d{4})\b/.exec(text))) {
    d = 1; mo = +m[1]; y = +m[2];
  } else {
    return '';
  }
  if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1980 && y <= 2100)) return '';
  var pad = function(n) { return (n < 10 ? '0' : '') + n; };
  return y + '-' + pad(mo) + '-' + pad(d);
};

var findLab = function(text) {
  // the name must start with a capital (no "i" flag: "laboratório de referência" is not a name)
  var m = /(?:[Ll]aborat[óo]rio|LABORAT[ÓO]RIO|[Ll]aboratory|LABORATORY|\b[Ll]ab\b\.?)\s*[:\-–]?\s*([A-ZÀ-Ú][^\n,;()]{1,40}?)(?=\s*(?:[,;()\n]|\.\s|\.$|$|\s+em\s+\d|\s+on\s+\d|\s+\d{1,2}\/))/.exec(text);
  if (m) {
    var name = m[1].trim().replace(/\s+(em|on|de|in)$/i, '');
    if (name && !/^(de|da|do|para|for)$/i.test(name)) return name;
  }
  for (var i = 0; i < KNOWN_LABS.length; i++) {
    if (new RegExp('(^|[^A-Za-zÀ-ú])' + escapeRe(KNOWN_LABS[i]) + '($|[^A-Za-zÀ-ú])', 'i').test(text)) return KNOWN_LABS[i];
  }
  return '';
};

var findTranscript = function(text) {
  var m = /\b(NM_\d+(?:\.\d+)?)/.exec(text);
  return m ? m[1] : '';
};

var emptyTest = function() {
  return { gene: '', classification: '', variant: '', protein: '', zygosity: '', testType: '', lab: '', date: '', comment: '' };
};

/**
 * @param {String} text
 * @return {Array} test results ({ gene, variant, protein, zygosity, classification, testType, lab,
 *   date, comment }), possibly empty
 */
var parseGeneticText = function(text) {
  text = String(text || '').replace(/\r/g, '').replace(/[‐-‒−]/g, '-').replace(/ /g, ' ');
  if (!text.trim()) return [];
  var variants = findVariants(text);
  // words inside the notation (p.(Ser1982Argfs*22)) are not genes
  var notation = [];
  var reNotation = /(^|[^A-Za-z0-9_])([cpgnr]\.\s?[^\s,;]+)/gi;
  var nm;
  while ((nm = reNotation.exec(text))) notation.push([nm.index + nm[1].length, nm.index + nm[0].length]);
  var genes = findGenes(text).filter(function(g) {
    return !notation.some(function(s) { return g.index >= s[0] && g.index < s[1]; });
  });
  var results = [];

  var labAll = findLab(text), dateAll = findDate(text), targetedAll = TARGETED.test(text);

  if (!variants.length) {
    // negative report: one negative result per gene named in the sentences that say so
    if (!NEGATIVE.test(text)) return [];
    var seen = {};
    text.split(/\n|;|\.\s+(?=[A-ZÀ-Ú])/).forEach(function(sentence) {
      if (!NEGATIVE.test(sentence)) return;
      findGenes(sentence).forEach(function(g) {
        if (seen[g.symbol] || Object.keys(seen).length >= 60) return;
        seen[g.symbol] = true;
        var t = emptyTest();
        t.gene = g.symbol;
        t.classification = 'NEG';
        t.lab = labAll;
        t.date = dateAll;
        t.testType = targetedAll ? 'targeted' : '';
        results.push(t);
      });
    });
    return results;
  }

  // the gene of each variant: the nearest one written before it (after the previous variant),
  // otherwise the first one right after it
  var leads = [];
  variants.forEach(function(v, i) {
    var prevEnd = i > 0 ? variants[i - 1].end : 0;
    var nextStart = i + 1 < variants.length ? variants[i + 1].index : text.length;
    var before = genes.filter(function(g) { return g.index >= prevEnd && g.end <= v.index; });
    var gene = before.length ? before[before.length - 1] : null;
    if (!gene) {
      gene = genes.filter(function(g) { return g.index >= v.end && g.index < nextStart && g.index - v.end < 60; })[0] || null;
    }
    var inherited = false;
    if (!gene && i > 0) {
      gene = leads[i - 1].gene; // another variant of the same gene
      inherited = true;
    }
    leads.push({ gene: gene, start: gene && !inherited && gene.index < v.index ? gene.index : v.index });
  });

  var prefix = text.slice(0, leads[0].start);
  // "..., ambas patogênicas" / "both pathogenic": what follows the last variant applies to all
  var lastVariant = variants[variants.length - 1];
  var suffix = text.slice(lastVariant.end);
  var shared = /\b(ambas|ambos|both|todas|todos|all|las\s+dos|los\s+dos)\b/i.test(suffix) ? suffix : '';
  variants.forEach(function(v, i) {
    var end = i + 1 < variants.length ? leads[i + 1].start : text.length;
    if (end <= v.index) end = i + 1 < variants.length ? variants[i + 1].index : text.length;
    var region = text.slice(leads[i].start, end);
    var single = variants.length === 1;
    var scope = single ? text : region;
    var t = emptyTest();
    t.gene = leads[i].gene ? leads[i].gene.symbol : '';
    if (v.kind === 'p') {
      t.protein = v.protein;
    } else {
      t.variant = v.variant;
      var afterVariant = text.slice(v.end, end);
      var p = /(^|[^A-Za-z0-9_])(p\.\s?\(?[A-Z*=?][^\s,;]*)/.exec(afterVariant);
      if (p && p.index < 70) t.protein = trimNotation(p[2]);
    }
    var cls = earliest(scope, CLASS_PATTERNS) || earliest(prefix, CLASS_PATTERNS) || earliest(shared, CLASS_PATTERNS);
    t.classification = cls ? cls.code : '';
    var zyg = earliest(scope, ZYG_PATTERNS) || earliest(prefix, ZYG_PATTERNS) || earliest(shared, ZYG_PATTERNS);
    t.zygosity = zyg ? zyg.code : '';
    t.testType = (TARGETED.test(scope) || TARGETED.test(prefix) || targetedAll) ? 'targeted' : '';
    t.lab = findLab(scope) || labAll;
    t.date = findDate(scope) || dateAll;
    t.comment = findTranscript(region) || (single ? findTranscript(text) : '');
    if (!t.gene && !t.variant && !t.protein) return;
    var dup = results.some(function(r) { return r.gene === t.gene && r.variant === t.variant && r.protein === t.protein; });
    if (!dup) results.push(t);
  });
  return results;
};

export { parseGeneticText, findDate, findLab };
