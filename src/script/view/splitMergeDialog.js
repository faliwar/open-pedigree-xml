import { translate } from 'pedigree/i18n';
import PedigreeImport from 'pedigree/model/import';
import PedigreeExport from 'pedigree/model/export';
import InvitaeConverter from 'pedigree/InvitaeConverter';
import DynamicPositionedGraph from 'pedigree/model/dynamicGraph';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';
import { extractPedigreeXmlFromPdf } from 'pedigree/model/pdfEmbed';
import {
  listPeople, getPartners, selectPart, extractPart, mergePedigrees, countPeople
} from 'pedigree/model/pedigreeSplitMerge';

/**
 * "Split or merge pedigrees" (Tools menu).
 *
 *  - Merge: reads a second pedigree (Progeny/Invitae XML, OPX JSON, GA4GH FHIR, PED, GEDCOM,
 *    BOADICEA or a PDF with embedded data) and joins it to the current one through a person
 *    drawn in both, or by making a couple of one person from each.
 *  - Split: keeps one part of the current pedigree around a person (family of origin,
 *    descendants, or one side of a couple), or downloads that part as a separate XML file.
 *
 * Both are single undoable steps. The editor draws one connected family, which is why a
 * merge always needs a link between the two pedigrees.
 *
 * @class SplitMergeDialog
 */

function detectType(content) {
  var t = content.trim();
  if (t.charAt(0) === '<') return 'invitae';
  if (t.charAt(0) === '{' || t.charAt(0) === '[') {
    try {
      var parsed = JSON.parse(t);
      if (parsed && (parsed.GG || (Array.isArray(parsed) && parsed.length && parsed[0].id !== undefined))) {
        return 'opx';
      }
    } catch (e) {}
    return 'GA4GH';
  }
  if (t.indexOf('0 HEAD') !== -1 || t.indexOf('0 @') !== -1) return 'gedcom';
  if (t.indexOf('BOADICEA') !== -1) return 'BOADICEA';
  return 'ped';
}

/** any supported text format -> serialized graph without layout helpers */
export function parsePedigreeText(content) {
  var type = detectType(content);
  var G;
  if (type === 'opx') {
    var parsed = JSON.parse(content.trim());
    G = PedigreeImport.initFromPhenotipsInternal(parsed.GG || parsed);
  } else if (type === 'invitae') {
    G = PedigreeImport.initFromInvitae(InvitaeConverter.sanitizeInvitaeXML(content));
  } else if (type === 'GA4GH') {
    G = PedigreeImport.initFromGA4GH(content);
  } else if (type === 'gedcom') {
    G = PedigreeImport.initFromGEDCOM(content, false, true);
  } else if (type === 'BOADICEA') {
    G = PedigreeImport.initFromBOADICEA(content, true);
  } else {
    G = PedigreeImport.initFromPED(content, true, false, true);
  }
  return JSON.parse(JSON.stringify(G.makeGWithCollapsedMultiRankEdges().serialize()));
}

function personLabel(p) {
  var sex = p.gender === 'M' ? '♂' : (p.gender === 'F' ? '♀' : '◇');
  var label = sex + ' ' + (p.name || (translate('Person') + ' #' + p.id));
  if (p.birthYear) label += ' (' + p.birthYear + ')';
  if (p.externalID) label += ' [' + p.externalID + ']';
  if (p.isProband) label += ' — ' + translate('proband');
  return label;
}

function downloadText(text, fileName, mime) {
  var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  if (typeof window.saveAs === 'function') {
    window.saveAs(blob, fileName);
    return;
  }
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

var SplitMergeDialog = Class.create({

  initialize: function() {
    this.dialog = null;
    this._incoming = null;
    this._tab = 'merge';
  },

  show: function(tab) {
    var _this = this;
    if (this.dialog) this.hide();
    if (tab) this._tab = tab;
    this._incoming = null;

    var content = new Element('div', { 'class': 'splitmerge-content' });
    var tabs = new Element('div', { 'class': 'splitmerge-tabs', 'role': 'tablist' });
    var mergeTab = new Element('button', { 'type': 'button', 'class': 'splitmerge-tab', 'role': 'tab' })
      .update('<i class="fas fa-object-group"></i> ' + translate('Merge another pedigree'));
    var splitTab = new Element('button', { 'type': 'button', 'class': 'splitmerge-tab', 'role': 'tab' })
      .update('<i class="fas fa-object-ungroup"></i> ' + translate('Split this pedigree'));
    tabs.insert(mergeTab).insert(splitTab);
    content.insert(tabs);

    var mergePane = this._buildMergePane();
    var splitPane = this._buildSplitPane();
    content.insert(mergePane).insert(splitPane);

    var select = function(which) {
      _this._tab = which;
      mergePane.setStyle({ display: which === 'merge' ? '' : 'none' });
      splitPane.setStyle({ display: which === 'split' ? '' : 'none' });
      mergeTab[which === 'merge' ? 'addClassName' : 'removeClassName']('active');
      splitTab[which === 'split' ? 'addClassName' : 'removeClassName']('active');
      mergeTab.setAttribute('aria-selected', which === 'merge');
      splitTab.setAttribute('aria-selected', which === 'split');
    };
    mergeTab.observe('click', function() { select('merge'); });
    splitTab.observe('click', function() { select('split'); });
    select(this._tab);

    this.dialog = new PhenoTips.widgets.ModalPopup(content, {
      close: { method: function() { _this.hide(); }, keys: ['Esc'] }
    }, {
      extraClassName: 'splitmerge-modal-box',
      title: translate('Split or merge pedigrees'),
      displayCloseButton: true,
      removeOnClose: true
    });
    this.dialog.show();
  },

  hide: function() {
    if (this.dialog) {
      var d = this.dialog;
      this.dialog = null;
      try {
        d.close();
      } catch (e) {
        // already closed by its own X button
      }
      if (d.dialog && d.dialog.parentNode) {
        d.dialog.remove();
      }
    }
  },

  _currentGG: function() {
    return editor.getGraph().toCollapsedSerialization();
  },

  _fillPeople: function(sel, people, selectedId) {
    sel.update('');
    people.forEach(function(p) {
      var opt = new Element('option', { 'value': p.id }).update(personLabel(p).escapeHTML());
      if (p.id === selectedId) opt.selected = true;
      sel.insert(opt);
    });
  },

  _field: function(labelText, control) {
    var wrap = new Element('label', { 'class': 'splitmerge-field' });
    wrap.insert(new Element('span', { 'class': 'splitmerge-label' }).update(translate(labelText)));
    wrap.insert(control);
    return wrap;
  },

  _radio: function(name, value, labelText, checked, hint) {
    var wrap = new Element('label', { 'class': 'splitmerge-radio' });
    var input = new Element('input', { 'type': 'radio', 'name': name, 'value': value });
    input.checked = !!checked;
    var text = new Element('span').update('<b>' + translate(labelText) + '</b>' +
      (hint ? '<br><small>' + translate(hint) + '</small>' : ''));
    wrap.insert(input).insert(text);
    return wrap;
  },

  _button: function(label, cls, handler) {
    var b = new Element('input', { 'type': 'button', 'value': translate(label), 'class': 'button ' + (cls || '') });
    b.observe('click', function() { handler(b); });
    return new Element('span', { 'class': 'buttonwrapper' }).insert(b);
  },

  // ------------------------------------------------------------------ merge

  _buildMergePane: function() {
    var _this = this;
    var pane = new Element('div', { 'class': 'splitmerge-pane splitmerge-merge' });
    pane.insert(new Element('p', { 'class': 'splitmerge-intro' }).update(translate(
      'Add a pedigree drawn separately (e.g. the other side of the family) to this one. Both must share a person, or you can make a couple of one person from each.')));

    var text = new Element('textarea', { 'class': 'splitmerge-text', 'rows': 5,
      'placeholder': translate('Paste the other pedigree here (Progeny/Invitae XML, OPX JSON, GA4GH FHIR, PED, GEDCOM or BOADICEA), or select a file.') });
    pane.insert(text);

    var fileInput = new Element('input', { 'type': 'file', 'style': 'display:none',
      'accept': '.xml,.json,.ped,.ged,.gedcom,.boadicea,.txt,.pdf' });
    var status = new Element('div', { 'class': 'splitmerge-status' });
    var linkBox = new Element('div', { 'class': 'splitmerge-link', 'style': 'display:none' });

    var readText = function() {
      status.removeClassName('error');
      try {
        if (!text.value.trim()) throw translate('Nothing to import!');
        _this._incoming = parsePedigreeText(text.value);
      } catch (err) {
        _this._incoming = null;
        linkBox.setStyle({ display: 'none' });
        status.addClassName('error');
        status.update((translate('Could not read this pedigree: ') + translate(String(err))).escapeHTML());
        return;
      }
      status.update((countPeople(_this._incoming) + ' ' + translate('people read from the other pedigree.')).escapeHTML());
      _this._fillPeople(otherSel, listPeople(_this._incoming), null);
      autoMatch();
      linkBox.setStyle({ display: '' });
    };

    fileInput.observe('change', function() {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var fr = new FileReader();
      if (f.name.toLowerCase().endsWith('.pdf')) {
        fr.onload = function(e) {
          extractPedigreeXmlFromPdf(e.target.result).then(function(xml) {
            if (!xml) {
              status.addClassName('error');
              status.update(translate('This PDF does not contain embedded Pedigree data.').escapeHTML());
              return;
            }
            text.value = xml;
            readText();
          });
        };
        fr.readAsArrayBuffer(f);
      } else {
        fr.onload = function(e) { text.value = e.target.result; readText(); };
        fr.readAsText(f, 'UTF-8');
      }
      try { fileInput.value = ''; } catch (e) {}
    });

    var actions = new Element('div', { 'class': 'splitmerge-actions' });
    actions.insert(this._button('Select a file', 'secondary', function() { fileInput.click(); }));
    actions.insert(this._button('Read pedigree', '', readText));
    pane.insert(fileInput).insert(actions).insert(status);

    // how the two pedigrees connect
    var people = listPeople(this._currentGG());
    var proband = people.filter(function(p) { return p.isProband; })[0];
    var thisSel = new Element('select', { 'class': 'splitmerge-select' });
    this._fillPeople(thisSel, people, proband ? proband.id : null);
    var otherSel = new Element('select', { 'class': 'splitmerge-select' });

    // pick the same name in both pedigrees when there is one
    var autoMatch = function() {
      if (!_this._incoming) return;
      var mine = people.filter(function(p) { return String(p.id) === thisSel.value; })[0];
      if (!mine || !mine.name) return;
      var match = listPeople(_this._incoming).filter(function(p) {
        return p.name && p.name.toLowerCase() === mine.name.toLowerCase();
      })[0];
      if (match) otherSel.value = String(match.id);
    };
    thisSel.observe('change', autoMatch);

    linkBox.insert(new Element('div', { 'class': 'splitmerge-section' }).update(translate('How are the two pedigrees connected?')));
    linkBox.insert(this._radio('splitmerge-linktype', 'same', 'Same person in both', true,
      'The two drawings of this person become one; the data in this pedigree are kept and the other only fills in what is missing.'));
    linkBox.insert(this._radio('splitmerge-linktype', 'partners', 'Make them a couple', false,
      'Draws a partnership between the two people.'));
    linkBox.insert(this._field('In this pedigree', thisSel));
    linkBox.insert(this._field('In the other pedigree', otherSel));

    var mergeActions = new Element('div', { 'class': 'splitmerge-actions' });
    mergeActions.insert(this._button('Merge', '', function() {
      var typeInput = linkBox.down('input[name="splitmerge-linktype"]:checked');
      var link = {
        type: typeInput ? typeInput.value : 'same',
        baseId: parseInt(thisSel.value, 10),
        incomingId: parseInt(otherSel.value, 10)
      };
      var merged;
      try {
        merged = mergePedigrees(_this._currentGG(), _this._incoming, link).gg;
      } catch (err) {
        alert(translate('Unable to merge: ') + translate(String(err)));
        return;
      }
      try {
        editor.getSaveLoadEngine().createGraphFromSplitMerge(merged);
      } catch (err) {
        alert(translate('Unable to merge: ') + translate(String(err)));
        return;
      }
      _this.hide();
    }));
    linkBox.insert(mergeActions);
    pane.insert(linkBox);
    return pane;
  },

  // ------------------------------------------------------------------ split

  _buildSplitPane: function() {
    var _this = this;
    var gg = this._currentGG();
    var people = listPeople(gg);
    var total = countPeople(gg);
    var pane = new Element('div', { 'class': 'splitmerge-pane splitmerge-split' });
    pane.insert(new Element('p', { 'class': 'splitmerge-intro' }).update(translate(
      'Keep only one part of this pedigree, or download that part as a separate file. Keeping a part can be undone.')));

    var proband = people.filter(function(p) { return p.isProband; })[0];
    var personSel = new Element('select', { 'class': 'splitmerge-select' });
    this._fillPeople(personSel, people, proband ? proband.id : null);
    pane.insert(this._field('Around', personSel));

    var modes = new Element('div', { 'class': 'splitmerge-modes' });
    modes.insert(this._radio('splitmerge-mode', 'origin', 'Family of origin', true,
      'Parents, siblings, grandparents and the rest of the family above; without partners and children.'));
    modes.insert(this._radio('splitmerge-mode', 'descendants', 'Descendants', false,
      'Partners, children, grandchildren; without parents. Partners are kept without their own families.'));
    var sideRadio = this._radio('splitmerge-mode', 'side', 'Their side of a couple', false,
      'Separates the families of a couple: the partner and their children stay, the partner\'s family does not.');
    modes.insert(sideRadio);
    var partnerSel = new Element('select', { 'class': 'splitmerge-select' });
    var partnerField = this._field('Partner', partnerSel);
    partnerField.addClassName('splitmerge-partner');
    modes.insert(partnerField);
    pane.insert(modes);

    var preview = new Element('div', { 'class': 'splitmerge-preview' });
    pane.insert(preview);

    var current = null;
    var refresh = function() {
      var personId = parseInt(personSel.value, 10);
      var partners = getPartners(gg, personId).filter(function(c) { return c.partnerId !== null; });
      var byId = {};
      people.forEach(function(p) { byId[p.id] = p; });
      var prevPartner = partnerSel.value;
      partnerSel.update('');
      partners.forEach(function(c) {
        var p = byId[c.partnerId];
        if (!p) return;
        partnerSel.insert(new Element('option', { 'value': c.partnerId }).update(personLabel(p).escapeHTML()));
      });
      if (prevPartner) partnerSel.value = prevPartner;
      var sideInput = sideRadio.down('input');
      sideInput.disabled = partnerSel.options.length === 0;
      partnerSel.disabled = sideInput.disabled;
      var modeInput = modes.down('input[name="splitmerge-mode"]:checked');
      if (sideInput.disabled && modeInput === sideInput) {
        modes.down('input[value="origin"]').checked = true;
        modeInput = modes.down('input[value="origin"]');
      }
      partnerField.setStyle({ opacity: sideInput.disabled ? '0.5' : '1' });

      current = null;
      preview.removeClassName('error');
      try {
        var mode = modeInput.value;
        var keep = selectPart(gg, mode, personId, mode === 'side' ? parseInt(partnerSel.value, 10) : undefined);
        current = extractPart(gg, keep, personId);
      } catch (err) {
        preview.addClassName('error');
        preview.update(translate(String(err)).escapeHTML());
        return;
      }
      var kept = listPeople(current);
      var names = kept.map(function(p) { return p.name || (translate('Person') + ' #' + p.id); });
      var shown = names.slice(0, 15).join(', ') + (names.length > 15 ? ', …' : '');
      preview.update('<b>' + (translate('Keeps') + ' ' + kept.length + ' ' + translate('of') + ' ' + total + ' ' + translate('people')).escapeHTML() +
        '</b>: ' + shown.escapeHTML());
      if (kept.length >= total) {
        preview.insert(new Element('div', { 'class': 'splitmerge-note' }).update(translate('This part is the whole pedigree.').escapeHTML()));
      }
    };
    personSel.observe('change', refresh);
    partnerSel.observe('change', refresh);
    modes.select('input[name="splitmerge-mode"]').each(function(r) { r.observe('click', refresh); });
    refresh();

    var actions = new Element('div', { 'class': 'splitmerge-actions' });
    actions.insert(this._button('Keep only this part', '', function() {
      if (!current) return;
      try {
        editor.getSaveLoadEngine().createGraphFromSplitMerge(current);
      } catch (err) {
        alert(translate('Unable to split: ') + translate(String(err)));
        return;
      }
      _this.hide();
    }));
    actions.insert(this._button('Download this part (XML)', 'secondary', function() {
      if (!current) return;
      try {
        downloadText(_this._partAsXML(current), 'open-pedigree-part.xml', 'application/xml;charset=utf-8');
      } catch (err) {
        alert(translate('Unable to split: ') + translate(String(err)));
      }
    }));
    pane.insert(actions);
    return pane;
  },

  /** a part of the pedigree as Progeny/Invitae XML, without touching the open pedigree */
  _partAsXML: function(partGG) {
    var tmp = DynamicPositionedGraph.makeEmpty(PedigreeEditorParameters.attributes.layoutRelativePersonWidth,
      PedigreeEditorParameters.attributes.layoutRelativeOtherWidth);
    tmp.fromCollapsedSerialization(partGG);
    // cascade choices refer to people of the whole pedigree: not saved with the part
    return PedigreeExport.exportAsInvitae(tmp.DG, 'all', { skipCascade: true });
  }
});

export default SplitMergeDialog;
