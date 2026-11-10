// Round-trip tests for custom condition colors in Invitae/Progeny XML export and import.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.Class = {
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

// Minimal DOMParser stub for infoFromInvitaeXML in Node
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = class {
    parseFromString(xmlText) {
      const condEls = [];
      const condRegex = /<condition\b([^>]*?)\/?>/g;
      let m;
      while ((m = condRegex.exec(xmlText)) !== null) {
        const attrs = m[1];
        condEls.push({
          getAttribute(name) {
            const r = new RegExp('\\b' + name + '="([^"]*)"');
            const am = r.exec(attrs);
            return am ? am[1] : null;
          }
        });
      }
      const noteEls = [];
      const notesMatch = /<notes>([\s\S]*?)<\/notes>/.exec(xmlText);
      if (notesMatch) {
        const noteRegex = /<note\b([^>]*?)\/?>/g;
        let nm;
        while ((nm = noteRegex.exec(notesMatch[1])) !== null) {
          const attrs = nm[1];
          noteEls.push({
            getAttribute(name) {
              const r = new RegExp('\\b' + name + '="([^"]*)"');
              const am = r.exec(attrs);
              return am ? am[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null;
            }
          });
        }
      }
      return {
        querySelector(sel) {
          if (sel === 'tree') {
            return {
              querySelectorAll(subSel) {
                if (subSel === ':scope > indi > conditions > condition') return condEls;
                return [];
              },
              querySelector(subSel) {
                if (subSel === ':scope > notes') {
                  return {
                    querySelectorAll() {
                      return noteEls;
                    }
                  };
                }
                return null;
              }
            };
          }
          return null;
        }
      };
    }
  };
}

const docListeners = {};
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    observe(eventName, handler) {
      if (!docListeners[eventName]) docListeners[eventName] = [];
      docListeners[eventName].push(handler);
    },
    fire(eventName, memo) {
      (docListeners[eventName] || []).forEach(fn => fn({ memo }));
    }
  };
}

const { PedigreeInfo, infoToInvitaeNotes, infoFromInvitaeXML } = await import('../src/script/model/pedigreeInfo.js');
const { default: InvitaeConverter } = await import('../src/script/InvitaeConverter.js');

test('custom hex condition colors survive XML notes and condition attribute round-trip', () => {
  const info = new PedigreeInfo();
  info.setConditionColor('Fabry__disease', '#12abef');
  info.setConditionColor('MONDO_0010526', '#8a2be2');

  const notesXml = infoToInvitaeNotes(info.get(), 'all');
  assert.ok(notesXml.includes('OPX condition colors'), 'writes OPX condition colors note to XML');

  const xml = '<family_history><tree>' +
    '<indi id="1"><conditions>' +
    '<condition code="Fabry disease" title="Fabry disease" color="2" color_hex="#12ABEF" status="affected"/>' +
    '</conditions></indi>' +
    notesXml +
    '</tree></family_history>';

  const restored = infoFromInvitaeXML(xml);
  assert.ok(restored, 'parses pedigree info from XML');
  assert.equal(restored.conditionColors['Fabry__disease'], '#12ABEF');
  assert.equal(restored.conditionColors['MONDO_0010526'], '#8A2BE2');
  assert.equal(restored.notes, '', 'does not leak OPX condition colors JSON into pedigree notes');
});

test('InvitaeConverter._buildIndiElement writes color_hex for custom condition colors', () => {
  const info = new PedigreeInfo();
  info.setConditionColor('Fabry__disease', '#12abef');
  globalThis.editor = {
    getPedigreeInfo: () => info,
    getDisorderLegend: () => ({
      getObjectColor: () => '#12abef',
      _objectColors: { 'Fabry__disease': '#12abef' }
    })
  };

  const mockPG = {
    GG: {
      getProducingRelationship: () => null,
      getInEdges: () => [],
      getTwinGroupId: () => null
    }
  };

  const indiXml = InvitaeConverter._buildIndiElement(
    1,
    { gender: 'M', disorders: ['Fabry disease'], carrierStatus: 'affected' },
    mockPG,
    {},
    'all',
    false,
    {}
  );
  assert.ok(indiXml.includes('color_hex="#12ABEF"'), 'includes color_hex="#12ABEF" on <condition>');
  delete globalThis.editor;
});
