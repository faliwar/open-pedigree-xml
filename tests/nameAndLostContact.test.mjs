// Unit tests for patient full name and "Not in contact with proband" (lostContact) persistence.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.Class = globalThis.Class || {
  create(methods) {
    const fn = function() {
      if (this.initialize) {
        this.initialize.apply(this, arguments);
      }
    };
    fn.prototype = methods;
    return fn;
  }
};

const { default: InvitaeConverter } = await import('../src/script/InvitaeConverter.js');

// Minimal element helper to test InvitaeConverter._parseIndividual in Node
function makeIndiElementFromXml(indiXml) {
  const getAttr = (tagAttrs, attrName) => {
    const r = new RegExp('\\b' + attrName + '="([^"]*)"');
    const m = r.exec(tagAttrs || '');
    return m ? m[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') : null;
  };
  const openMatch = /^<indi\b([^>]*)>/.exec(indiXml.trim());
  const indiAttrs = openMatch ? openMatch[1] : '';

  const noteEls = [];
  const notesMatch = /<notes>([\s\S]*?)<\/notes>/.exec(indiXml);
  if (notesMatch) {
    const noteRegex = /<note\b([^>]*?)\/?>/g;
    let nm;
    while ((nm = noteRegex.exec(notesMatch[1])) !== null) {
      const nAttrs = nm[1];
      noteEls.push({
        getAttribute: (name) => getAttr(nAttrs, name)
      });
    }
  }

  return {
    children: [],
    getAttribute(name) {
      return getAttr(indiAttrs, name);
    },
    querySelectorAll() {
      return [];
    },
    querySelector(sel) {
      const m = /^:scope\s*>\s*([a-zA-Z0-9_]+)$/.exec(sel.trim());
      if (!m) return null;
      const tag = m[1];
      if (tag === 'notes') {
        if (!notesMatch) return null;
        return {
          querySelectorAll(subSel) {
            if (subSel === ':scope > note') return noteEls;
            return [];
          }
        };
      }
      const selfClosing = new RegExp('<' + tag + '\\b([^>]*?)\\/>').exec(indiXml);
      if (selfClosing) {
        return {
          getAttribute: (name) => getAttr(selfClosing[1], name),
          textContent: ''
        };
      }
      const fullTag = new RegExp('<' + tag + '\\b([^>]*)>([\\s\\S]*?)<\\/' + tag + '>').exec(indiXml);
      if (fullTag) {
        return {
          getAttribute: (name) => getAttr(fullTag[1], name),
          textContent: fullTag[2],
          querySelectorAll: () => []
        };
      }
      return null;
    }
  };
}

test('InvitaeConverter._combineFullName preserves full names and combines fName + lName without duplication', () => {
  assert.equal(
    InvitaeConverter._combineFullName('Maria Clara da Silva Oliveira', 'Maria Clara da Silva Oliveira', ''),
    'Maria Clara da Silva Oliveira'
  );
  assert.equal(
    InvitaeConverter._combineFullName('', 'Ana Paula', 'Ferreira'),
    'Ana Paula Ferreira'
  );
  assert.equal(
    InvitaeConverter._combineFullName('Ana Paula', 'Ana Paula', 'Ferreira'),
    'Ana Paula Ferreira'
  );
  assert.equal(
    InvitaeConverter._combineFullName('', 'Ana Paula Ferreira', 'Ferreira'),
    'Ana Paula Ferreira',
    'does not duplicate surname when fName already ends with lName'
  );
  assert.equal(
    InvitaeConverter._combineFullName('', '', 'Santos'),
    'Santos'
  );
});

test('InvitaeConverter exports and imports full patient name (fName + lName) and lostContact without losing data', () => {
  const mockPG = {
    GG: {
      getProducingRelationship: () => null,
      getInEdges: () => [],
      getTwinGroupId: () => null
    }
  };

  const indiXml = InvitaeConverter._buildIndiElement(
    2,
    {
      gender: 'F',
      fName: 'Maria Clara',
      lName: 'da Silva',
      lostContact: true,
      comments: 'Observação clínica'
    },
    mockPG,
    'all',
    { 2: 2 },
    {}
  );

  assert.ok(indiXml.includes('<first_name value="Maria Clara da Silva"/>'), 'exports full combined name in <first_name>');
  assert.ok(indiXml.includes('string_title="Contact with proband"'), 'exports Contact with proband note');
  assert.ok(indiXml.includes('string_value="Not in contact"'), 'exports Not in contact value');

  const parsed = InvitaeConverter._parseIndividual(makeIndiElementFromXml(indiXml));
  assert.equal(parsed.name, 'Maria Clara da Silva');
  assert.equal(parsed.fName, 'Maria Clara da Silva');
  assert.equal(parsed.lostContact, true);
  assert.equal(parsed.comments, 'Observação clínica', 'does not leak lostContact note into comments');
});

test('InvitaeConverter._parseIndividual combines separate first_name and last_name tags and supports direct lost_contact tag', () => {
  const xml = '<indi id="3" pat="0">' +
    '<first_name value="João Pedro"/>' +
    '<last_name value="Almeida"/>' +
    '<gender value="0"/>' +
    '<status value="0"/>' +
    '<lost_contact value="1"/>' +
    '</indi>';
  const parsed = InvitaeConverter._parseIndividual(makeIndiElementFromXml(xml));
  assert.equal(parsed.name, 'João Pedro Almeida');
  assert.equal(parsed.fName, 'João Pedro Almeida');
  assert.equal(parsed.lostContact, true);
});
