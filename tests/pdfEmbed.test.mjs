// Pedigree XML embedded in PDFs: standard embedded file (plain or compressed) and legacy comment.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';
import { PEDIGREE_FILE_NAME, extractPedigreeXmlFromPdf, toBase64Utf8 } from '../src/script/model/pdfEmbed.js';

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n<tree><indi id="0"><first_name value="João"/></indi></tree>';
const enc = (s) => new Uint8Array(Buffer.from(s, 'latin1'));
const concat = (...parts) => Uint8Array.from(Buffer.concat(parts.map((p) => Buffer.from(p))));

test('reads an uncompressed embedded file', async () => {
  const body = Buffer.from(XML, 'utf8');
  const pdf = concat(enc('%PDF-1.3\n5 0 obj\n<< /Type /EmbeddedFile /Subtype /application#2Fxml /Length ' + body.length + ' >>\nstream\n'), body, enc('\nendstream\nendobj\n%%EOF'));
  assert.equal(await extractPedigreeXmlFromPdf(pdf), XML);
});

test('reads a Flate-compressed embedded file (PDF re-saved by another tool)', async () => {
  const body = zlib.deflateSync(Buffer.from(XML, 'utf8'));
  const pdf = concat(enc('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n7 0 obj\n<< /Type /EmbeddedFile /Filter /FlateDecode /Length ' + body.length + ' >>\nstream\r\n'), body, enc('\r\nendstream\nendobj\n%%EOF'));
  assert.equal(await extractPedigreeXmlFromPdf(pdf), XML);
});

test('reads the legacy trailing comment', async () => {
  const pdf = enc('%PDF-1.3\n1 0 obj\n<< >>\nendobj\n%%EOF\n% PedigreeXML: ' + toBase64Utf8(XML));
  assert.equal(await extractPedigreeXmlFromPdf(pdf), XML);
});

test('returns null for a PDF without pedigree data', async () => {
  const pdf = enc('%PDF-1.3\n3 0 obj\n<< /Length 4 >>\nstream\nq Q\nendstream\nendobj\n%%EOF');
  assert.equal(await extractPedigreeXmlFromPdf(pdf), null);
});

test('round trip with the PDFKit build used by the application', async () => {
  const require = createRequire(import.meta.url);
  const PDFDocument = require('../public/vendor/pdfkit/pdfkit.standalone.js');
  const doc = new PDFDocument({ compress: false });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', resolve));
  doc.text('pedigree');
  doc.file('data:application/xml;base64,' + toBase64Utf8(XML), { name: PEDIGREE_FILE_NAME, type: 'application/xml' });
  doc.end();
  await done;
  const pdf = new Uint8Array(Buffer.concat(chunks));
  assert.match(Buffer.from(pdf).toString('latin1'), /\/EmbeddedFiles/);
  assert.equal(await extractPedigreeXmlFromPdf(pdf), XML);
});
