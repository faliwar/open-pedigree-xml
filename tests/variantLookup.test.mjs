import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lookupVariant,
  mapClinVarToClassification,
  reviewStatusToStars,
  formatAlleleFrequency,
  parseClinVarSummary,
  mergeMyVariantData,
  buildExternalLinks,
  clearVariantLookupCache
} from '../src/script/model/variantLookup.js';

test('mapClinVarToClassification maps standard ClinVar descriptions to OPX codes', () => {
  assert.equal(mapClinVarToClassification('Pathogenic'), 'P');
  assert.equal(mapClinVarToClassification('Pathogenic/Likely pathogenic'), 'P');
  assert.equal(mapClinVarToClassification('Likely pathogenic'), 'LP');
  assert.equal(mapClinVarToClassification('Uncertain significance'), 'VUS');
  assert.equal(mapClinVarToClassification('Conflicting classifications of pathogenicity'), 'VUS');
  assert.equal(mapClinVarToClassification('Likely benign'), 'LB');
  assert.equal(mapClinVarToClassification('Benign/Likely benign'), 'B');
  assert.equal(mapClinVarToClassification('Benign'), 'B');
  assert.equal(mapClinVarToClassification(''), '');
});

test('reviewStatusToStars maps ClinVar review status to 0-4 gold stars', () => {
  assert.equal(reviewStatusToStars('practice guideline'), 4);
  assert.equal(reviewStatusToStars('reviewed by expert panel'), 3);
  assert.equal(reviewStatusToStars('criteria provided, multiple submitters, no conflicts'), 2);
  assert.equal(reviewStatusToStars('criteria provided, single submitter'), 1);
  assert.equal(reviewStatusToStars('criteria provided, conflicting classifications'), 1);
  assert.equal(reviewStatusToStars('no assertion criteria provided'), 0);
});

test('formatAlleleFrequency formats common and rare allele frequencies cleanly', () => {
  assert.equal(formatAlleleFrequency(0), '0');
  assert.equal(formatAlleleFrequency(0.000015), '1.50e-5');
  assert.equal(formatAlleleFrequency(0.00123), '0.00123 (0.12%)');
  assert.equal(formatAlleleFrequency(0.025), '0.0250 (2.50%)');
  assert.equal(formatAlleleFrequency(null), '');
});

test('parseClinVarSummary extracts VCV classification, stars, coordinates, rsID, and conditions', () => {
  const sample = {
    uid: '17661',
    accession: 'VCV000017661',
    title: 'NM_007294.4(BRCA1):c.68_69del (p.Glu23fs)',
    genes: [{ symbol: 'BRCA1' }],
    molecular_consequence_list: ['frameshift variant'],
    germline_classification: {
      description: 'Pathogenic',
      review_status: 'reviewed by expert panel',
      last_evaluated: '2024-03-10',
      trait_set: [
        { trait_name: 'not provided' },
        { trait_name: 'Hereditary breast and ovarian cancer syndrome' },
        { trait_name: 'Breast-ovarian cancer, familial, susceptibility to, 1' }
      ]
    },
    variation_set: [{
      variation_loc: [
        { assembly_name: 'GRCh38', chr: '17', start: '43124027', stop: '43124028' },
        { assembly_name: 'GRCh37', chr: '17', start: '41276044', stop: '41276045' }
      ],
      variation_xrefs: [
        { db_source: 'dbSNP', db_id: '80357914' }
      ]
    }]
  };

  const rec = parseClinVarSummary(sample, 'BRCA1');
  assert.equal(rec.variationId, '17661');
  assert.equal(rec.accession, 'VCV000017661');
  assert.equal(rec.gene, 'BRCA1');
  assert.equal(rec.transcript, 'NM_007294.4');
  assert.equal(rec.hgvsC, 'c.68_69del');
  assert.equal(rec.hgvsP, 'p.Glu23fs');
  assert.equal(rec.classificationCode, 'P');
  assert.equal(rec.stars, 3);
  assert.equal(rec.rsid, 'rs80357914');
  assert.equal(rec.grch38.label, 'chr17:43124027');
  assert.deepEqual(rec.conditions, [
    'Hereditary breast and ovarian cancer syndrome',
    'Breast-ovarian cancer, familial, susceptibility to, 1'
  ]);
});

test('mergeMyVariantData enriches ClinVar record with gnomAD AF and in-silico scores', () => {
  const base = {
    source: 'ClinVar',
    variationId: '17661',
    gene: 'BRCA1',
    hgvsC: 'c.68_69del',
    hgvsP: 'p.Glu23fs',
    classificationRaw: 'Pathogenic',
    classificationCode: 'P',
    reviewStatus: 'reviewed by expert panel',
    stars: 3,
    conditions: ['Hereditary breast and ovarian cancer syndrome']
  };
  const hit = {
    chrom: '17',
    vcf: { position: '43124027', ref: 'ACT', alt: 'A' },
    dbsnp: { rsid: 'rs80357914' },
    gnomad_exome: { af: { af: 0.00018 } },
    cadd: { phred: 34.0 },
    dbnsfp: {
      revel: { score: [0.89, 0.91] },
      alphamissense: { am_pathogenicity: 0.96, am_class: 'likely_pathogenic' }
    }
  };
  const merged = mergeMyVariantData(base, hit, 'BRCA1');
  assert.equal(merged.gnomadAf, 0.00018);
  assert.equal(merged.caddPhred, 34.0);
  assert.equal(merged.revelScore, 0.91);
  assert.equal(merged.alphaMissenseScore, 0.96);
  assert.equal(merged.vcf.pos, '43124027');

  const links = buildExternalLinks(merged, { gene: 'BRCA1', variant: 'c.68_69del' });
  assert.equal(links.clinvar, 'https://www.ncbi.nlm.nih.gov/clinvar/variation/17661/');
  assert.match(links.gnomad, /17-43124027-ACT-A/);
  assert.equal(links.franklin, 'https://franklin.genoox.com/clinical-db/variant/snp/chr17-43124027-ACT-A-hg38');
  assert.equal(links.varsome, undefined);

  // without coordinates: the gene page
  const plain = buildExternalLinks(null, { gene: 'brca2', variant: 'c.5946del' });
  assert.equal(plain.franklin, 'https://franklin.genoox.com/clinical-db/gene/BRCA2');

  // Regression: partial MyVariant hit without revel/cadd/gnomad must keep null (never undefined)
  const sparse = mergeMyVariantData(null, { dbnsfp: {}, clinvar: { variant_id: 99 } }, 'BRCA1');
  assert.equal(sparse.revelScore, null);
  assert.equal(sparse.caddPhred, null);
  assert.equal(sparse.alphaMissenseScore, null);
  assert.equal(sparse.gnomadAf, null);
});

test('lookupVariant combines ClinVar E-utilities and MyVariant.info and falls back cleanly', async () => {
  clearVariantLookupCache();

  const mockFetch = async (url) => {
    if (url.includes('esearch.fcgi')) {
      return { ok: true, json: async () => ({ esearchresult: { idlist: ['17661'] } }) };
    }
    if (url.includes('esummary.fcgi')) {
      return {
        ok: true,
        json: async () => ({
          result: {
            '17661': {
              uid: '17661',
              accession: 'VCV000017661',
              title: 'NM_007294.4(BRCA1):c.68_69del (p.Glu23fs)',
              genes: [{ symbol: 'BRCA1' }],
              germline_classification: {
                description: 'Pathogenic',
                review_status: 'reviewed by expert panel',
                last_evaluated: '2024-03-10'
              }
            }
          }
        })
      };
    }
    if (url.includes('myvariant.info')) {
      return {
        ok: true,
        json: async () => ({
          hits: [{
            chrom: '17',
            vcf: { position: '43124027', ref: 'ACT', alt: 'A' },
            gnomad_exome: { af: { af: 0.0002 } },
            cadd: { phred: 33.0 }
          }]
        })
      };
    }
    throw new Error('Unexpected URL: ' + url);
  };

  const res = await lookupVariant({ gene: 'BRCA1', variant: 'c.68_69del' }, mockFetch);
  assert.equal(res.found, true);
  assert.equal(res.record.classificationCode, 'P');
  assert.equal(res.record.stars, 3);
  assert.equal(res.record.gnomadAf, 0.0002);
  assert.equal(res.record.caddPhred, 33.0);

  // Fallback to MyVariant.info if ClinVar E-utilities fails
  const fallbackFetch = async (url) => {
    if (url.includes('eutils.ncbi.nlm.nih.gov')) {
      throw new Error('ClinVar timeout');
    }
    return {
      ok: true,
      json: async () => ({
        hits: [{
          clinvar: {
            variant_id: 12345,
            gene: { symbol: 'TP53' },
            hgvs: { coding: 'NM_000546.6:c.524G>A', protein: 'NP_000537.3:p.Arg175His' },
            rcv: {
              accession: 'RCV000012345',
              clinical_significance: 'Pathogenic',
              review_status: 'reviewed by expert panel'
            }
          },
          dbnsfp: { revel: { score: 0.95 } }
        }]
      })
    };
  };

  const res2 = await lookupVariant({ gene: 'TP53', variant: 'c.524G>A' }, fallbackFetch);
  assert.equal(res2.found, true);
  assert.equal(res2.record.variationId, '12345');
  assert.equal(res2.record.classificationCode, 'P');
  assert.equal(res2.record.revelScore, 0.95);
});
