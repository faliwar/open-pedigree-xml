/**
 * Free browser-side genetic variant classification lookup using:
 *  1. NCBI ClinVar E-utilities (esearch + esummary, live VCV germline classification,
 *     review status / gold stars, associated conditions, molecular consequence, coordinates)
 *  2. MyVariant.info v1 (gnomAD exome/genome allele frequency, dbSNP rsID, CADD, REVEL,
 *     AlphaMissense, and ClinVar fallback if E-utilities is unavailable)
 *
 * Both APIs are free, public, CORS-enabled, and require no API key.
 */

var _cache = {};

var str = function(v) {
  return (v === undefined || v === null) ? '' : String(v).trim();
};

/**
 * Maps a ClinVar germline classification description to an OPX classification code.
 * @param {String} desc
 * @return {String} 'P' | 'LP' | 'VUS' | 'LB' | 'B' | ''
 */
var mapClinVarToClassification = function(desc) {
  var s = str(desc).toLowerCase();
  if (!s) return '';
  if (s.indexOf('conflicting') !== -1 || s.indexOf('uncertain') !== -1) return 'VUS';
  if (s.indexOf('likely pathogenic') !== -1 && s.indexOf('pathogenic/') === -1) return 'LP';
  if (s.indexOf('pathogenic') !== -1 && s.indexOf('benign') === -1) return 'P';
  if (s.indexOf('likely benign') !== -1 && s.indexOf('benign/') === -1) return 'LB';
  if (s.indexOf('benign') !== -1) return 'B';
  return '';
};

/**
 * Converts a ClinVar review status string to the official 0-4 gold star rating.
 * @param {String} reviewStatus
 * @return {Number}
 */
var reviewStatusToStars = function(reviewStatus) {
  var s = str(reviewStatus).toLowerCase();
  if (!s || s.indexOf('no assertion') !== -1 || s.indexOf('no classification') !== -1) return 0;
  if (s.indexOf('practice guideline') !== -1) return 4;
  if (s.indexOf('reviewed by expert panel') !== -1) return 3;
  if (s.indexOf('multiple submitters, no conflicts') !== -1) return 2;
  if (s.indexOf('criteria provided') !== -1) return 1;
  return 0;
};

/**
 * Formats an allele frequency for clinical display (e.g. "0.00012 (0.012%)").
 * @param {Number|null} af
 * @return {String}
 */
var formatAlleleFrequency = function(af) {
  if (typeof af !== 'number' || !isFinite(af) || af < 0) return '';
  if (af === 0) return '0';
  if (af < 0.0001) {
    return af.toExponential(2);
  }
  var pct = (af * 100);
  var pctStr = pct >= 1 ? pct.toFixed(2) : pct.toPrecision(2);
  return af.toPrecision(3) + ' (' + pctStr + '%)';
};

var _extractFromTitle = function(title) {
  var t = str(title);
  var transcript = '';
  var hgvsC = '';
  var hgvsP = '';
  var mTx = t.match(/\b((?:NM|NR|ENST)_[0-9]+(?:\.[0-9]+)?)/);
  if (mTx) transcript = mTx[1];
  var mC = t.match(/(c\.[^\s()]+)/);
  if (mC) hgvsC = mC[1];
  var mP = t.match(/\((p\.[^)]+)\)/) || t.match(/\b(p\.[A-Za-z0-9_*=]+)/);
  if (mP) hgvsP = mP[1];
  return { transcript: transcript, hgvsC: hgvsC, hgvsP: hgvsP };
};

var _normVar = function(v) {
  return str(v).replace(/\s+/g, '').toLowerCase();
};

var _scoreSummaryMatch = function(summary, gene, variant, protein) {
  if (!summary) return -1;
  var score = 0;
  var title = str(summary.title).toLowerCase();
  var g = str(gene).toUpperCase();
  var v = _normVar(variant);
  var p = _normVar(protein);

  var genes = Array.isArray(summary.genes) ? summary.genes : [];
  if (g && genes.some(function(x) { return str(x && x.symbol).toUpperCase() === g; })) {
    score += 50;
  } else if (g && title.indexOf('(' + g.toLowerCase() + ')') !== -1) {
    score += 40;
  }

  var parsed = _extractFromTitle(summary.title);
  var titleC = _normVar(parsed.hgvsC);
  var titleP = _normVar(parsed.hgvsP);

  if (v) {
    if (titleC && titleC === v) {
      score += 100;
    } else if (titleC && titleC.indexOf(v) === 0) {
      score += 60 - Math.min(20, titleC.length - v.length);
    } else if (title.indexOf(v) !== -1) {
      score += 40;
    }
  }
  if (p) {
    if (titleP && titleP === p) {
      score += 80;
    } else if (str(summary.protein_change).toLowerCase().indexOf(p.replace(/^p\./, '')) !== -1) {
      score += 50;
    }
  }
  var gc = summary.germline_classification || summary.clinical_significance || {};
  score += reviewStatusToStars(gc.review_status) * 3;
  return score;
};

/**
 * Normalizes a single NCBI ClinVar esummary JSON item into a clean display record.
 */
var parseClinVarSummary = function(summary, fallbackGene) {
  if (!summary || typeof summary !== 'object') return null;
  var uid = str(summary.uid);
  var accession = str(summary.accession);
  var title = str(summary.title);
  var parsed = _extractFromTitle(title);

  var genes = Array.isArray(summary.genes) ? summary.genes : [];
  var gene = (genes[0] && str(genes[0].symbol)) || str(fallbackGene).toUpperCase();

  var gc = summary.germline_classification || summary.clinical_significance || {};
  var classificationRaw = str(gc.description);
  var reviewStatus = str(gc.review_status);
  var lastEvaluated = str(gc.last_evaluated);
  if (lastEvaluated && lastEvaluated.indexOf('0001') === 0) lastEvaluated = '';

  var conditions = [];
  var seenCond = {};
  var traits = Array.isArray(gc.trait_set) ? gc.trait_set : (Array.isArray(summary.trait_set) ? summary.trait_set : []);
  traits.forEach(function(tr) {
    var name = str(tr && tr.trait_name);
    var lower = name.toLowerCase();
    if (!name || lower === 'not provided' || lower === 'not specified' || lower === 'see cases') return;
    if (!seenCond[lower]) {
      seenCond[lower] = true;
      conditions.push(name);
    }
  });

  var consequences = Array.isArray(summary.molecular_consequence_list) ? summary.molecular_consequence_list : [];
  var consequence = consequences.filter(Boolean).slice(0, 2).join(', ');

  var grch38 = null;
  var grch37 = null;
  var rsid = '';
  var spdiVcf = null;
  var vset = Array.isArray(summary.variation_set) ? summary.variation_set : [];
  vset.forEach(function(vs) {
    if (!vs) return;
    if (!spdiVcf && vs.canonical_spdi) {
      spdiVcf = spdiToVcf38(vs.canonical_spdi);
    }
    var locs = Array.isArray(vs.variation_loc) ? vs.variation_loc : [];
    locs.forEach(function(loc) {
      if (!loc || !loc.chr) return;
      var asm = str(loc.assembly_name).toUpperCase();
      var entry = {
        chr: str(loc.chr),
        start: str(loc.start),
        stop: str(loc.stop),
        label: 'chr' + str(loc.chr).replace(/^chr/i, '') + ':' + str(loc.start)
      };
      if (asm === 'GRCH38' && !grch38) grch38 = entry;
      if (asm === 'GRCH37' && !grch37) grch37 = entry;
    });
    var xrefs = Array.isArray(vs.variation_xrefs) ? vs.variation_xrefs : [];
    xrefs.forEach(function(x) {
      if (!rsid && x && str(x.db_source).toLowerCase() === 'dbsnp' && str(x.db_id)) {
        rsid = 'rs' + str(x.db_id).replace(/^rs/i, '');
      }
    });
  });

  var hgvsP = parsed.hgvsP;
  if (!hgvsP && str(summary.protein_change)) {
    var firstP = str(summary.protein_change).split(',')[0].trim();
    if (firstP) hgvsP = firstP.indexOf('p.') === 0 ? firstP : ('p.' + firstP);
  }

  return {
    source: 'ClinVar',
    variationId: uid,
    accession: accession,
    title: title,
    gene: gene,
    transcript: parsed.transcript,
    hgvsC: parsed.hgvsC,
    hgvsP: hgvsP,
    classificationRaw: classificationRaw,
    classificationCode: mapClinVarToClassification(classificationRaw),
    reviewStatus: reviewStatus,
    stars: reviewStatusToStars(reviewStatus),
    lastEvaluated: lastEvaluated,
    conditions: conditions,
    consequence: consequence,
    grch38: grch38,
    grch37: grch37,
    rsid: rsid,
    gnomadAf: null,
    gnomadSource: '',
    caddPhred: null,
    revelScore: null,
    alphaMissenseScore: null,
    alphaMissenseClass: '',
    vcf: spdiVcf
  };
};

var _NC_TO_CHR = {
  'NC_000001': '1', 'NC_000002': '2', 'NC_000003': '3', 'NC_000004': '4',
  'NC_000005': '5', 'NC_000006': '6', 'NC_000007': '7', 'NC_000008': '8',
  'NC_000009': '9', 'NC_000010': '10', 'NC_000011': '11', 'NC_000012': '12',
  'NC_000013': '13', 'NC_000014': '14', 'NC_000015': '15', 'NC_000016': '16',
  'NC_000017': '17', 'NC_000018': '18', 'NC_000019': '19', 'NC_000020': '20',
  'NC_000021': '21', 'NC_000022': '22', 'NC_000023': 'X', 'NC_000024': 'Y',
  'NC_012920': 'M'
};

/**
 * Converts a ClinVar GRCh38 canonical SPDI string (0-based interbase) to 1-based VCF
 * when both deleted and inserted sequences are non-empty (SNVs, MNVs, delins).
 */
var spdiToVcf38 = function(spdi) {
  var parts = str(spdi).split(':');
  if (parts.length !== 4) return null;
  var accBase = parts[0].split('.')[0].toUpperCase();
  var chr = _NC_TO_CHR[accBase];
  var pos0 = parseInt(parts[1], 10);
  var ref = parts[2].toUpperCase();
  var alt = parts[3].toUpperCase();
  if (!chr || !isFinite(pos0) || !ref || !alt) return null;
  if (!/^[ACGT]+$/.test(ref) || !/^[ACGT]+$/.test(alt)) return null;
  return {
    chr: chr,
    pos: String(pos0 + 1),
    ref: ref,
    alt: alt,
    assembly: 'GRCh38'
  };
};

var _firstNum = function(val) {
  if (typeof val === 'number' && isFinite(val)) return val;
  if (Array.isArray(val)) {
    var nums = val.filter(function(x) { return typeof x === 'number' && isFinite(x); });
    if (nums.length) return Math.max.apply(null, nums);
  }
  return null;
};

/**
 * Enriches an existing record (or creates one from scratch) with MyVariant.info hit data.
 */
var mergeMyVariantData = function(record, hit, fallbackGene) {
  if (!hit || typeof hit !== 'object') return record;

  var out = record ? Object.assign({}, record) : {
    source: 'MyVariant.info',
    variationId: '',
    accession: '',
    title: '',
    gene: str(fallbackGene).toUpperCase(),
    transcript: '',
    hgvsC: '',
    hgvsP: '',
    classificationRaw: '',
    classificationCode: '',
    reviewStatus: '',
    stars: 0,
    lastEvaluated: '',
    conditions: [],
    consequence: '',
    grch38: null,
    grch37: null,
    rsid: '',
    gnomadAf: null,
    gnomadSource: '',
    caddPhred: null,
    revelScore: null,
    alphaMissenseScore: null,
    alphaMissenseClass: '',
    vcf: null
  };

  if (hit.clinvar) {
    var cv = hit.clinvar;
    if (!out.variationId && cv.variant_id) out.variationId = String(cv.variant_id);
    if (!out.gene && cv.gene && cv.gene.symbol) out.gene = str(cv.gene.symbol).toUpperCase();
    if (!out.rsid && cv.rsid) out.rsid = str(cv.rsid);
    var rcvs = Array.isArray(cv.rcv) ? cv.rcv : (cv.rcv ? [cv.rcv] : []);
    if (!out.classificationRaw && rcvs.length) {
      var bestRcv = rcvs[0];
      rcvs.forEach(function(r) {
        if (reviewStatusToStars(r && r.review_status) > reviewStatusToStars(bestRcv && bestRcv.review_status)) {
          bestRcv = r;
        }
      });
      if (bestRcv) {
        out.classificationRaw = str(bestRcv.clinical_significance);
        out.classificationCode = mapClinVarToClassification(out.classificationRaw);
        out.reviewStatus = str(bestRcv.review_status);
        out.stars = reviewStatusToStars(out.reviewStatus);
        if (!out.lastEvaluated && bestRcv.last_evaluated) out.lastEvaluated = str(bestRcv.last_evaluated);
        if (!out.accession && bestRcv.accession) out.accession = str(bestRcv.accession);
      }
    }
    if (!out.conditions.length && rcvs.length) {
      var seen = {};
      rcvs.forEach(function(r) {
        var conds = Array.isArray(r && r.conditions) ? r.conditions : (r && r.conditions ? [r.conditions] : []);
        conds.forEach(function(c) {
          var name = str(c && c.name);
          var lower = name.toLowerCase();
          if (name && lower !== 'not provided' && lower !== 'not specified' && !seen[lower]) {
            seen[lower] = true;
            out.conditions.push(name);
          }
        });
      });
    }
    if (!out.hgvsC && cv.hgvs && cv.hgvs.coding) {
      var coding = Array.isArray(cv.hgvs.coding) ? cv.hgvs.coding[0] : cv.hgvs.coding;
      var parsedC = _extractFromTitle(coding);
      if (parsedC.hgvsC) out.hgvsC = parsedC.hgvsC;
      if (!out.transcript && parsedC.transcript) out.transcript = parsedC.transcript;
    }
    if (!out.hgvsP && cv.hgvs && cv.hgvs.protein) {
      var prot = Array.isArray(cv.hgvs.protein) ? cv.hgvs.protein[0] : cv.hgvs.protein;
      var parsedP = _extractFromTitle(prot);
      if (parsedP.hgvsP) out.hgvsP = parsedP.hgvsP;
    }
  }

  if (!out.rsid && hit.dbsnp && hit.dbsnp.rsid) {
    out.rsid = str(hit.dbsnp.rsid);
  }

  var exomeAf = hit.gnomad_exome && hit.gnomad_exome.af ? _firstNum(hit.gnomad_exome.af.af) : null;
  var genomeAf = hit.gnomad_genome && hit.gnomad_genome.af ? _firstNum(hit.gnomad_genome.af.af) : null;
  if (typeof exomeAf === 'number' && isFinite(exomeAf)) {
    out.gnomadAf = exomeAf;
    out.gnomadSource = 'gnomAD exomes';
  } else if (typeof genomeAf === 'number' && isFinite(genomeAf)) {
    out.gnomadAf = genomeAf;
    out.gnomadSource = 'gnomAD genomes';
  }

  var cadd = hit.cadd ? _firstNum(hit.cadd.phred) : null;
  if (typeof cadd === 'number' && isFinite(cadd)) out.caddPhred = cadd;

  if (hit.dbnsfp) {
    var revel = hit.dbnsfp.revel ? _firstNum(hit.dbnsfp.revel.score) : null;
    if (typeof revel === 'number' && isFinite(revel)) out.revelScore = revel;
    if (hit.dbnsfp.alphamissense) {
      var am = hit.dbnsfp.alphamissense;
      var amScore = _firstNum(am.am_pathogenicity !== undefined ? am.am_pathogenicity : am.score);
      if (typeof amScore === 'number' && isFinite(amScore)) out.alphaMissenseScore = amScore;
      var amCls = Array.isArray(am.am_class) ? am.am_class[0] : am.am_class;
      if (str(amCls)) out.alphaMissenseClass = str(amCls);
    }
  }

  if (hit.vcf && hit.vcf.position && hit.vcf.ref && hit.vcf.alt && hit.chrom) {
    var vcfChr = String(hit.chrom).replace(/^chr/i, '');
    var vcfPos = String(hit.vcf.position);
    var vcfRef = String(hit.vcf.ref);
    var vcfAlt = String(hit.vcf.alt);
    var vcfAssembly = '';

    var hg38Start = (hit.hg38 && hit.hg38.start) ? String(hit.hg38.start) : (out.grch38 && out.grch38.start ? String(out.grch38.start) : '');
    var hg19Start = (hit.hg19 && hit.hg19.start) ? String(hit.hg19.start) : (out.grch37 && out.grch37.start ? String(out.grch37.start) : '');

    if (hg38Start && vcfPos === hg38Start) {
      vcfAssembly = 'GRCh38';
    } else if (hg19Start && vcfPos === hg19Start) {
      if (hg38Start) {
        // Project GRCh37 VCF position to GRCh38 using ClinVar/MyVariant start delta
        var pos38 = parseInt(vcfPos, 10) + (parseInt(hg38Start, 10) - parseInt(hg19Start, 10));
        if (isFinite(pos38) && pos38 > 0) {
          vcfPos = String(pos38);
          vcfAssembly = 'GRCh38';
        } else {
          vcfAssembly = 'GRCh37';
        }
      } else {
        vcfAssembly = 'GRCh37';
      }
    } else if (hg38Start && hg19Start) {
      // Indel anchor base (1 bp before hg19/hg38 start): check distance to each assembly
      var pNum = parseInt(vcfPos, 10);
      var d38 = Math.abs(pNum - parseInt(hg38Start, 10));
      var d19 = Math.abs(pNum - parseInt(hg19Start, 10));
      if (d38 <= 2 && d38 < d19) {
        vcfAssembly = 'GRCh38';
      } else if (d19 <= 2) {
        var proj = pNum + (parseInt(hg38Start, 10) - parseInt(hg19Start, 10));
        if (isFinite(proj) && proj > 0) {
          vcfPos = String(proj);
          vcfAssembly = 'GRCh38';
        } else {
          vcfAssembly = 'GRCh37';
        }
      } else {
        vcfAssembly = 'GRCh37';
      }
    } else {
      // MyVariant.info default query endpoint returns hg19 coordinates
      vcfAssembly = 'GRCh37';
    }

    if (!out.vcf || out.vcf.assembly !== 'GRCh38' || vcfAssembly === 'GRCh38') {
      out.vcf = {
        chr: vcfChr,
        pos: vcfPos,
        ref: vcfRef,
        alt: vcfAlt,
        assembly: vcfAssembly
      };
    }
    if (!out.grch38 && vcfAssembly === 'GRCh38') {
      out.grch38 = {
        chr: out.vcf.chr,
        start: out.vcf.pos,
        stop: out.vcf.pos,
        label: 'chr' + out.vcf.chr + ':' + out.vcf.pos
      };
    }
  }

  return out;
};

/**
 * Builds direct external reference URLs (ClinVar, gnomAD, UCSC, Franklin) for a variant.
 */
var buildExternalLinks = function(record, query) {
  var gene = str((record && record.gene) || (query && query.gene)).toUpperCase();
  var variant = str((record && record.hgvsC) || (query && query.variant));
  var protein = str((record && record.hgvsP) || (query && query.protein));
  var term = [gene, variant || protein].filter(Boolean).join(' ');

  var clinvarUrl = (record && record.variationId)
    ? ('https://www.ncbi.nlm.nih.gov/clinvar/variation/' + encodeURIComponent(record.variationId) + '/')
    : ('https://www.ncbi.nlm.nih.gov/clinvar/?term=' + encodeURIComponent(term || gene));

  var gnomadUrl;
  if (record && record.vcf) {
    var v = record.vcf;
    var gnomadDataset = (v.assembly === 'GRCh37') ? 'gnomad_r2_1' : 'gnomad_r4';
    gnomadUrl = 'https://gnomad.broadinstitute.org/variant/' +
      encodeURIComponent(v.chr + '-' + v.pos + '-' + v.ref + '-' + v.alt) + '?dataset=' + gnomadDataset;
  } else if (record && record.grch38 && record.grch38.chr && record.grch38.start) {
    var gChr = String(record.grch38.chr).replace(/^chr/i, '');
    var gStop = record.grch38.stop || record.grch38.start;
    gnomadUrl = 'https://gnomad.broadinstitute.org/region/' +
      encodeURIComponent(gChr + '-' + record.grch38.start + '-' + gStop) + '?dataset=gnomad_r4';
  } else if (record && record.rsid) {
    gnomadUrl = 'https://gnomad.broadinstitute.org/awesome?query=' + encodeURIComponent(record.rsid);
  } else {
    gnomadUrl = 'https://gnomad.broadinstitute.org/awesome?query=' + encodeURIComponent(term || gene);
  }

  // Franklin (Genoox / QIAGEN) opens a variant from its hg38/hg19 coordinates
  // (franklin.genoox.com/clinical-db/variant/snp/chr13-32340300-GT-G-hg38); without them, the gene
  // page, from which the variant can be searched
  var franklinUrl;
  if (record && record.vcf) {
    var fAsm = (record.vcf.assembly === 'GRCh37') ? 'hg19' : 'hg38';
    franklinUrl = 'https://franklin.genoox.com/clinical-db/variant/snp/' +
      _pathSegment('chr' + record.vcf.chr + '-' + record.vcf.pos + '-' + record.vcf.ref + '-' + record.vcf.alt + '-' + fAsm);
  } else if (gene) {
    franklinUrl = 'https://franklin.genoox.com/clinical-db/gene/' + _pathSegment(gene);
  } else {
    franklinUrl = 'https://franklin.genoox.com/clinical-db/home';
  }

  // UCSC Genome Browser (hg38/hg19): the variant with some bases on each side, the variant highlighted;
  // without coordinates, the transcript HGVS or the gene, which UCSC's position search accepts
  var ucscDb = (record && record.vcf && record.vcf.assembly === 'GRCh37') ? 'hg19' : 'hg38';
  var ucscBase = 'https://genome.ucsc.edu/cgi-bin/hgTracks?db=' + ucscDb + '&position=';
  var ucscUrl;
  if (record && record.vcf && /^\d+$/.test(String(record.vcf.pos))) {
    var chr = 'chr' + record.vcf.chr;
    var start = parseInt(record.vcf.pos, 10);
    var stop = start + Math.max(1, String(record.vcf.ref || '').length) - 1;
    ucscUrl = ucscBase + encodeURIComponent(chr + ':' + Math.max(1, start - 25) + '-' + (stop + 25)) +
      '&highlight=' + encodeURIComponent(ucscDb + '.' + chr + ':' + start + '-' + stop + '#FFCC00');
  } else if (record && record.grch38 && record.grch38.chr && /^\d+$/.test(String(record.grch38.start))) {
    var rChr = 'chr' + String(record.grch38.chr).replace(/^chr/i, '');
    var rStart = parseInt(record.grch38.start, 10);
    var rStop = /^\d+$/.test(String(record.grch38.stop)) ? parseInt(record.grch38.stop, 10) : rStart;
    ucscUrl = ucscBase + encodeURIComponent(rChr + ':' + Math.max(1, rStart - 25) + '-' + (rStop + 25)) +
      '&highlight=' + encodeURIComponent('hg38.' + rChr + ':' + rStart + '-' + rStop + '#FFCC00');
  } else if (record && record.transcript && record.hgvsC) {
    ucscUrl = ucscBase + encodeURIComponent(record.transcript + ':' + record.hgvsC);
  } else if (gene) {
    ucscUrl = ucscBase + encodeURIComponent(gene);
  } else {
    ucscUrl = 'https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38';
  }

  return {
    clinvar: clinvarUrl,
    gnomad: gnomadUrl,
    ucsc: ucscUrl,
    franklin: franklinUrl
  };
};

// Encodes a URL path segment but keeps the characters of variant notation (":", ">", "_", "+")
var _pathSegment = function(text) {
  return encodeURIComponent(text).replace(/%3A/gi, ':').replace(/%3E/gi, '>').replace(/%2B/gi, '+');
};

var _fetchJson = function(fetchImpl, url, timeoutMs) {
  var controller = (typeof AbortController === 'function') ? new AbortController() : null;
  var timer = null;
  var opts = controller ? { signal: controller.signal } : {};
  if (controller && timeoutMs) {
    timer = setTimeout(function() {
      try { controller.abort(); } catch (e) {}
    }, timeoutMs);
  }
  return fetchImpl(url, opts).then(function(res) {
    if (timer) clearTimeout(timer);
    if (!res || !res.ok) throw new Error('HTTP ' + (res ? res.status : 'error'));
    return res.json();
  }, function(err) {
    if (timer) clearTimeout(timer);
    throw err;
  });
};

var _searchClinVar = function(fetchImpl, gene, variant, protein) {
  var terms = [];
  var v = str(variant);
  var p = str(protein);
  var g = str(gene).toUpperCase();

  if (/^rs\d+$/i.test(v)) {
    terms.push(v + '[variant name]');
  } else {
    if (g && v) {
      terms.push(g + '[gene] AND "' + v.replace(/"/g, '') + '"');
    }
    if (g && p && p !== v) {
      terms.push(g + '[gene] AND "' + p.replace(/"/g, '') + '"');
    }
    if (!g && v) {
      terms.push('"' + v.replace(/"/g, '') + '"');
    }
  }
  if (!terms.length) return Promise.resolve(null);

  var tryTerm = function(idx) {
    if (idx >= terms.length) return Promise.resolve(null);
    var esearchUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=clinvar&retmode=json&retmax=5&term=' +
      encodeURIComponent(terms[idx]);
    return _fetchJson(fetchImpl, esearchUrl, 8000).then(function(searchData) {
      var ids = (searchData && searchData.esearchresult && Array.isArray(searchData.esearchresult.idlist))
        ? searchData.esearchresult.idlist : [];
      if (!ids.length) return tryTerm(idx + 1);
      var esummaryUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=clinvar&retmode=json&id=' +
        encodeURIComponent(ids.join(','));
      return _fetchJson(fetchImpl, esummaryUrl, 8000).then(function(sumData) {
        var result = (sumData && sumData.result) || {};
        var best = null;
        var bestScore = -1;
        ids.forEach(function(id) {
          var item = result[id];
          if (!item) return;
          var sc = _scoreSummaryMatch(item, g, v, p);
          if (sc > bestScore) {
            bestScore = sc;
            best = item;
          }
        });
        return best ? parseClinVarSummary(best, g) : tryTerm(idx + 1);
      });
    });
  };

  return tryTerm(0);
};

var _queryMyVariant = function(fetchImpl, record, gene, variant) {
  var q = '';
  if (record && record.variationId) {
    q = 'clinvar.variant_id:' + encodeURIComponent(record.variationId);
  } else if (/^rs\d+$/i.test(str(variant))) {
    q = 'dbsnp.rsid:' + encodeURIComponent(str(variant).toLowerCase());
  } else if (str(gene) && str(variant)) {
    var cleanV = str(variant).replace(/[^\w.>+-]/g, '');
    if (!cleanV) return Promise.resolve(null);
    q = encodeURIComponent('clinvar.gene.symbol:' + str(gene).toUpperCase() + ' AND clinvar.hgvs.coding:*' + cleanV + '*');
  } else {
    return Promise.resolve(null);
  }

  var fields = 'chrom,vcf,hg19,hg38,clinvar,gnomad_exome.af.af,gnomad_genome.af.af,dbsnp.rsid,cadd.phred,dbnsfp.revel,dbnsfp.alphamissense';
  var url = 'https://myvariant.info/v1/query?size=5&fields=' + fields + '&q=' + q;
  return _fetchJson(fetchImpl, url, 8000).then(function(data) {
    var hits = (data && Array.isArray(data.hits)) ? data.hits : [];
    return hits.length ? hits[0] : null;
  });
};

/**
 * Looks up a genetic variant in ClinVar + MyVariant.info.
 * Never rejects; resolves to { found: Boolean, record: Object|null, links: Object, error: String }.
 *
 * @param {Object} query { gene, variant, protein }
 * @param {Function} [fetchImpl] optional custom fetch for testing
 */
var lookupVariant = function(query, fetchImpl) {
  var q = query || {};
  var gene = str(q.gene).toUpperCase();
  var variant = str(q.variant);
  var protein = str(q.protein);
  var links = buildExternalLinks(null, q);

  if (!variant && !protein) {
    return Promise.resolve({ found: false, record: null, links: links, error: '' });
  }

  var cacheKey = [gene, _normVar(variant), _normVar(protein)].join('|');
  if (!fetchImpl && _cache[cacheKey]) {
    return Promise.resolve(_cache[cacheKey]);
  }

  var fn = fetchImpl || (typeof fetch === 'function' ? fetch.bind(window) : null);
  if (!fn) {
    return Promise.resolve({ found: false, record: null, links: links, error: 'offline' });
  }

  var hadError = false;
  return _searchClinVar(fn, gene, variant, protein).catch(function() {
    hadError = true;
    return null;
  }).then(function(cvRecord) {
    return _queryMyVariant(fn, cvRecord, gene, variant).catch(function() {
      if (!cvRecord) hadError = true;
      return null;
    }).then(function(mvHit) {
      var merged = mvHit ? mergeMyVariantData(cvRecord, mvHit, gene) : cvRecord;
      var result = {
        found: !!merged,
        record: merged,
        links: buildExternalLinks(merged, q),
        error: (!merged && hadError) ? 'network' : ''
      };
      if (!fetchImpl && (result.found || !result.error)) {
        _cache[cacheKey] = result;
      }
      return result;
    });
  });
};

var clearVariantLookupCache = function() {
  _cache = {};
};

export {
  lookupVariant,
  mapClinVarToClassification,
  reviewStatusToStars,
  formatAlleleFrequency,
  parseClinVarSummary,
  mergeMyVariantData,
  buildExternalLinks,
  spdiToVcf38,
  clearVariantLookupCache
};
