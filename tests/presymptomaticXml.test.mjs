import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.Class = {
  create(methods) {
    const fn = function () {
      if (this.initialize) {
        this.initialize.apply(this, arguments);
      }
    };
    fn.prototype = methods;
    return fn;
  }
};

function unescapeXml(s) {
  return String(s ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Lightweight recursive XML parser supporting :scope > a > b selectors for InvitaeConverter in Node
class MiniXmlNode {
  constructor(tagName, attrs = {}) {
    this.tagName = tagName;
    this.attributes = attrs;
    this.children = [];
    this._text = '';
  }
  get textContent() {
    return this._text + this.children.map((c) => c.textContent).join('');
  }
  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }
  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }
  querySelectorAll(selector) {
    const sel = selector.trim();
    if (sel.startsWith(':scope')) {
      const chain = sel
        .replace(/^:scope\s*>\s*/, '')
        .split(/\s*>\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      let current = [this];
      for (const tag of chain) {
        const next = [];
        for (const node of current) {
          for (const ch of node.children) {
            if (tag === '*' || ch.tagName === tag) next.push(ch);
          }
        }
        current = next;
      }
      return current;
    }
    const out = [];
    const walk = (n) => {
      for (const ch of n.children) {
        if (ch.tagName === sel) out.push(ch);
        walk(ch);
      }
    };
    walk(this);
    return out;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

function parseMiniXml(xmlText) {
  const root = new MiniXmlNode('#document');
  const stack = [root];
  const tokenRe = /<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<\/([A-Za-z0-9_:-]+)\s*>|<([A-Za-z0-9_:-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;
  while ((m = tokenRe.exec(xmlText)) !== null) {
    if (m[1]) {
      if (stack.length > 1) stack.pop();
    } else if (m[2]) {
      const tag = m[2];
      const attrStr = m[3] || '';
      const selfClose = !!m[4];
      const attrs = {};
      const attrRe = /([A-Za-z0-9_:-]+)\s*=\s*"([^"]*)"/g;
      let am;
      while ((am = attrRe.exec(attrStr)) !== null) {
        attrs[am[1]] = unescapeXml(am[2]);
      }
      const node = new MiniXmlNode(tag, attrs);
      stack[stack.length - 1].children.push(node);
      if (!selfClose) stack.push(node);
    } else if (m[5]) {
      const txt = unescapeXml(m[5]);
      if (txt.trim()) stack[stack.length - 1]._text += txt;
    }
  }
  root.documentElement = root.children[0] || null;
  return root;
}

globalThis.DOMParser = class {
  parseFromString(xmlText) {
    return parseMiniXml(xmlText);
  }
};

globalThis.XMLSerializer = class {
  serializeToString(node) {
    return `<${node.tagName}/>`;
  }
};

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    observe() {},
    fire() {}
  };
}

const { default: PedigreeImport } = await import('../src/script/model/import.js');
const { default: PositionedGraph } = await import('../src/script/model/positionedGraph.js');
const { default: DynamicPositionedGraph } = await import('../src/script/model/dynamicGraph.js');
const { default: InvitaeConverter } = await import('../src/script/InvitaeConverter.js');

function exportDGToXML(dg) {
  const baseG = dg.DG.GG.makeGWithCollapsedMultiRankEdges();
  return InvitaeConverter.exportAsInvitaeXML({ GG: baseG }, 'all');
}

function importXMLToDG(xml) {
  const baseG = InvitaeConverter.initFromInvitaeXML(xml);
  return new DynamicPositionedGraph(new PositionedGraph(baseG));
}

test('pre-symptomatic status without disorders survives Invitae/Progeny XML round-trip', () => {
  const baseG = PedigreeImport.initFromPhenotipsInternal([
    { name: 'proband', properties: { fName: 'Ana', gender: 'F', carrierStatus: 'presymptomatic' } }
  ]);
  const dg = new DynamicPositionedGraph(new PositionedGraph(baseG));

  const xml = exportDGToXML(dg);
  assert.ok(
    xml.includes('string_title="Carrier status" string_value="Pre-symptomatic"'),
    'writes Carrier status Pre-symptomatic standard note to XML'
  );
  assert.ok(xml.includes('<carrier value="0"/>'), 'keeps <carrier value="0"/> for Progeny compatibility');

  const reloaded = importXMLToDG(xml);
  const props = reloaded.getProperties(0);
  assert.equal(props.carrierStatus, 'presymptomatic', 'restores carrierStatus="presymptomatic" on import');
  assert.equal(props.comments || '', '', 'does not leak Pre-symptomatic note into comments');
});

test('pre-symptomatic status with a disorder survives XML round-trip and overrides stale detail.status edits', () => {
  // 1) Export & re-import a pre-symptomatic person with Huntington disease
  const baseG = PedigreeImport.initFromPhenotipsInternal([
    {
      name: 'proband',
      properties: {
        fName: 'Carlos',
        gender: 'M',
        disorders: ['Huntington disease'],
        carrierStatus: 'presymptomatic'
      }
    }
  ]);
  const dg = new DynamicPositionedGraph(new PositionedGraph(baseG));

  const xml1 = exportDGToXML(dg);
  assert.ok(xml1.includes('status="presymptomatic"'), 'writes status="presymptomatic" on <condition>');

  const reloaded1 = importXMLToDG(xml1);
  const props1 = reloaded1.getProperties(0);
  assert.equal(props1.carrierStatus, 'presymptomatic', 'restores presymptomatic with disorder');
  assert.deepEqual(props1.disorders, ['Huntington disease']);
  assert.equal(props1.comments || '', '');

  // 2) Edit imported pre-symptomatic person to Affected -> stale detail.status must NOT keep presymptomatic
  reloaded1.setProperties(0, { ...props1, carrierStatus: 'affected' });
  const xml2 = exportDGToXML(reloaded1);
  assert.ok(xml2.includes('status="affected"'), 'updates <condition> status to affected');
  assert.ok(!xml2.includes('Pre-symptomatic'), 'removes Pre-symptomatic standard note when changed to affected');

  const reloaded2 = importXMLToDG(xml2);
  assert.equal(reloaded2.getProperties(0).carrierStatus, 'affected');

  // 3) Edit imported Affected person (whose detail.status === 'affected') to Pre-symptomatic -> must save presymptomatic
  reloaded2.setProperties(0, { ...reloaded2.getProperties(0), carrierStatus: 'presymptomatic' });
  const xml3 = exportDGToXML(reloaded2);
  assert.ok(xml3.includes('status="presymptomatic"'), 'updates <condition> status from affected to presymptomatic');

  const reloaded3 = importXMLToDG(xml3);
  assert.equal(reloaded3.getProperties(0).carrierStatus, 'presymptomatic');
});

test('external XML with status="presymptomatic" on <condition> (without notes) imports as presymptomatic', () => {
  const externalXml = `<tree>
    <indi id="1" pat="1">
      <first_name value="Beatriz"/>
      <gender value="0"/>
      <status value="0"/>
      <carrier value="0"/>
      <conditions>
        <condition code="BRCA1" title="Hereditary breast and ovarian cancer" color="0" visible="1" ontology="All" status="presymptomatic">
          <note value=""/>
        </condition>
      </conditions>
    </indi>
  </tree>`;
  const dg = importXMLToDG(externalXml);
  assert.equal(dg.getProperties(0).carrierStatus, 'presymptomatic');
});
