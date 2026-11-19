// Free-text genetic results (lab reports, notes in the medical record) split into test fields.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGeneticText } from '../src/script/model/geneticTextParser.js';

const pick = (t) => ({ gene: t.gene, variant: t.variant, protein: t.protein, zygosity: t.zygosity, classification: t.classification });

test('one variant, Portuguese report sentence', () => {
  const r = parseGeneticText('Identificada variante patogênica em heterozigose no gene BRCA2: NM_000059.4:c.5946del p.(Ser1982Argfs*22). Laboratório: Fleury, 12/03/2023.');
  assert.equal(r.length, 1);
  assert.deepEqual(pick(r[0]), { gene: 'BRCA2', variant: 'c.5946del', protein: 'p.(Ser1982Argfs*22)', zygosity: 'het', classification: 'P' });
  assert.equal(r[0].lab, 'Fleury');
  assert.equal(r[0].date, '2023-03-12');
  assert.equal(r[0].comment, 'NM_000059.4');
});

test('transcript with the gene in brackets, English', () => {
  const r = parseGeneticText('NM_007294.4(BRCA1):c.68_69delAG (p.Glu23ValfsTer17), heterozygous, Likely Pathogenic');
  assert.deepEqual(pick(r[0]), { gene: 'BRCA1', variant: 'c.68_69delAG', protein: 'p.Glu23ValfsTer17', zygosity: 'het', classification: 'LP' });
});

test('several variants: each takes its own gene and classification', () => {
  const r = parseGeneticText('Painel: BRCA1 c.5266dupC (patogênica, heterozigose) e ATM c.1010G>A p.(Arg337His) VUS.');
  assert.equal(r.length, 2);
  assert.deepEqual(pick(r[0]), { gene: 'BRCA1', variant: 'c.5266dupC', protein: '', zygosity: 'het', classification: 'P' });
  assert.deepEqual(pick(r[1]), { gene: 'ATM', variant: 'c.1010G>A', protein: 'p.(Arg337His)', zygosity: '', classification: 'VUS' });
});

test('what is written before the first variant applies to all', () => {
  const r = parseGeneticText('Variantes em heterozigose composta no gene CFTR: c.1521_1523del e c.1624G>T, ambas patogênicas.');
  assert.equal(r.length, 2);
  r.forEach((t) => {
    assert.equal(t.gene, 'CFTR');
    assert.equal(t.zygosity, 'compound');
    assert.equal(t.classification, 'P');
  });
});

test('one field per line (key: value)', () => {
  const r = parseGeneticText('Gene: MLH1\nVariante: c.1852_1854del\nProteína: p.Lys618del\nZigosidade: Heterozigoto\nClassificação: Provavelmente patogênica\nData do laudo: 2022-08-01');
  assert.deepEqual(pick(r[0]), { gene: 'MLH1', variant: 'c.1852_1854del', protein: 'p.Lys618del', zygosity: 'het', classification: 'LP' });
  assert.equal(r[0].date, '2022-08-01');
});

test('exon deletion, hemizygous, targeted test of the familial variant', () => {
  const r = parseGeneticText('Pesquisa da variante familiar: deleção dos éxons 45 a 50 do gene DMD em hemizigose (patogênica).');
  assert.deepEqual(pick(r[0]), { gene: 'DMD', variant: 'del ex45-50', protein: '', zygosity: 'hemi', classification: 'P' });
  assert.equal(r[0].testType, 'targeted');
});

test('homozygous variant and ACMG criteria are not genes', () => {
  const r = parseGeneticText('GBA1 c.1226A>G (p.Asn409Ser) em homozigose. Classificação ACMG: patogênica (PS3, PM2, PP5).');
  assert.equal(r.length, 1);
  assert.deepEqual(pick(r[0]), { gene: 'GBA1', variant: 'c.1226A>G', protein: 'p.Asn409Ser', zygosity: 'hom', classification: 'P' });
});

test('negative panel: one negative result per gene named', () => {
  const r = parseGeneticText('Painel de câncer hereditário negativo para BRCA1, BRCA2, PALB2 e TP53.');
  assert.deepEqual(r.map((t) => t.gene), ['BRCA1', 'BRCA2', 'PALB2', 'TP53']);
  r.forEach((t) => assert.equal(t.classification, 'NEG'));
});

test('Spanish, protein change only, class 4 and month-first date are read', () => {
  const r = parseGeneticText('Se detectó la variante p.Arg1443Ter en el gen BRCA1, en heterocigosis, probablemente patogénica (laboratorio Invitae, 03/25/2021).');
  assert.deepEqual(pick(r[0]), { gene: 'BRCA1', variant: '', protein: 'p.Arg1443Ter', zygosity: 'het', classification: 'LP' });
  assert.equal(r[0].lab, 'Invitae');
  assert.equal(r[0].date, '2021-03-25');
});

test('lower-case gene after the word gene; words of the report are not genes', () => {
  const r = parseGeneticText('LAUDO: EXOMA. Encontrada variante no gene mutyh c.1187G>A, homozigose, PATOGÊNICA.');
  assert.equal(r.length, 1);
  assert.equal(r[0].gene, 'MUTYH');
  assert.equal(r[0].zygosity, 'hom');
  assert.equal(r[0].classification, 'P');
});

test('nothing genetic: no result', () => {
  assert.deepEqual(parseGeneticText('Paciente com HAS e DM2, em acompanhamento.'), []);
  assert.deepEqual(parseGeneticText(''), []);
});
