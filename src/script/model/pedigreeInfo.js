import Disorder from 'pedigree/disorder';
import { INVITAE_PALETTE, normalizeHex } from 'pedigree/model/conditionColors';

/**
 * Information about the pedigree as a document, not about any person:
 *   title, family (name or ID), author, date (YYYY-MM-DD), notes (free text),
 *   annotations: free-text boxes placed on the chart, [{ id, x, y, text }] in canvas coordinates,
 *   conditionColors: colours chosen for conditions, { disorderID: '#RRGGBB' } (others get automatic colours).
 *
 * Shown as a header on the chart and as header/footer in the PDF. Saved with the pedigree
 * (graph JSON, so undo/redo restore it) and in Invitae/Progeny XML as tree-level notes:
 *   <notes>
 *     <note id="1" note_id="1" value="..." string_type="composite" string_title="Pedigree title" string_value="..."/>
 *     ... "Family", "Author", "Pedigree date", "Pedigree notes"
 *     <note ... string_title="Chart annotation" string_value="text" x="120" y="-40"/>
 *   </notes>
 * Edits go through the 'pedigree:info:set' event so they can be undone and appear in the history.
 */

var FIELDS = ['title', 'family', 'author', 'date', 'notes'];

var XML_TITLES = {
  title: 'Pedigree title',
  family: 'Family',
  author: 'Author',
  date: 'Pedigree date',
  notes: 'Pedigree notes'
};
var ANNOTATION_TITLE = 'Chart annotation';

var str = function(v) {
  return (v === undefined || v === null) ? '' : String(v);
};

var emptyInfo = function() {
  return { title: '', family: '', author: '', date: '', notes: '', annotations: [], conditionColors: {} };
};

var normalize = function(data) {
  var out = emptyInfo();
  if (!data || typeof data !== 'object') return out;
  FIELDS.forEach(function(f) {
    out[f] = str(data[f]).replace(/\r\n?/g, '\n');
    if (f !== 'notes') out[f] = out[f].replace(/\s*\n\s*/g, ' ');
    out[f] = out[f].trim();
  });
  var used = {};
  (Array.isArray(data.annotations) ? data.annotations : []).forEach(function(a, i) {
    if (!a) return;
    var text = str(a.text).replace(/\r\n?/g, '\n').trim();
    var x = parseFloat(a.x), y = parseFloat(a.y);
    if (!text) return;
    var id = str(a.id) || ('a' + i);
    while (used[id]) id += '_';
    used[id] = true;
    out.annotations.push({ id: id, x: isFinite(x) ? Math.round(x) : 0, y: isFinite(y) ? Math.round(y) : 0, text: text });
  });
  var colors = (data.conditionColors && typeof data.conditionColors === 'object') ? data.conditionColors : {};
  Object.keys(colors).sort().forEach(function(id) {
    var hex = normalizeHex(colors[id]);
    if (id && hex) out.conditionColors[id] = hex;
  });
  return out;
};

var clone = function(obj) {
  return JSON.parse(JSON.stringify(obj));
};

var PedigreeInfo = Class.create({

  initialize: function() {
    var _this = this;
    this._data = emptyInfo();
    document.observe('pedigree:info:set', function(event) {
      _this._onSet(event);
    });
    // "Clear all" starts a new pedigree (undo restores the information with the rest)
    document.observe('pedigree:graph:clear', function() {
      _this.load(null);
    });
  },

  /** Copy of the current information */
  get: function() {
    return clone(this._data);
  },

  /** Whether any header field (title, family, author, date, notes) is filled */
  hasHeader: function() {
    var d = this._data;
    return !!(d.title || d.family || d.author || d.date || d.notes);
  },

  hasContent: function() {
    return this.hasHeader() || this._data.annotations.length > 0 || Object.keys(this._data.conditionColors).length > 0;
  },

  /** Colour chosen for a condition, or '' when it uses an automatic colour */
  getConditionColor: function(disorderID) {
    return this._data.conditionColors.hasOwnProperty(disorderID) ? this._data.conditionColors[disorderID] : '';
  },

  /**
   * Moves a chosen colour to the condition's new id when it is renamed (part of the rename's
   * undo step, so no separate one here)
   */
  renameConditionColor: function(fromID, toID) {
    var colors = this._data.conditionColors;
    if (!colors.hasOwnProperty(fromID)) return;
    if (!colors.hasOwnProperty(toID)) colors[toID] = colors[fromID];
    delete colors[fromID];
    document.fire('pedigree:info:changed', {});
  },

  /**
   * Sets (or with an empty colour, removes) the colour of a condition as an undoable change.
   */
  setConditionColor: function(disorderID, color, description) {
    var colors = clone(this._data.conditionColors);
    var hex = normalizeHex(color);
    if (hex) {
      colors[disorderID] = hex;
    } else {
      delete colors[disorderID];
    }
    this.update({ conditionColors: colors }, description);
  },

  /**
   * Replaces the information without an undo step (loading a file, undo/redo of a whole state).
   * null or undefined clears it.
   */
  load: function(data) {
    this._data = normalize(data);
    document.fire('pedigree:info:changed', {});
  },

  /** Serializable copy, or undefined when empty (keeps saved files unchanged) */
  toJSONObject: function() {
    return this.hasContent() ? clone(this._data) : undefined;
  },

  /**
   * Applies new information as an undoable change.
   * @param {Object} data full or partial information (missing fields keep their value)
   * @param {String} description text for the modification history
   */
  update: function(data, description) {
    var merged = this.get();
    Object.keys(data || {}).forEach(function(k) { merged[k] = data[k]; });
    merged = normalize(merged);
    if (JSON.stringify(merged) === JSON.stringify(this._data)) return;
    document.fire('pedigree:info:set', { data: merged, _opxDesc: description || '' });
  },

  _onSet: function(event) {
    var memo = event.memo || {};
    var previous = this.get();
    this._data = normalize(memo.data);
    document.fire('pedigree:info:changed', {});
    if (!memo.noUndoRedo && typeof editor !== 'undefined' && editor.getActionStack) {
      editor.getActionStack().addState(
        { eventName: 'pedigree:info:set', memo: { data: clone(this._data), _opxDesc: memo._opxDesc } },
        { eventName: 'pedigree:info:set', memo: { data: previous, _opxDesc: memo._opxDesc } }
      );
    }
  },

  // -------------------------------------------------------------------------------------------
  // Annotations

  newAnnotationId: function() {
    var ids = {};
    this._data.annotations.forEach(function(a) { ids[a.id] = true; });
    var n = this._data.annotations.length + 1;
    while (ids['a' + n]) n++;
    return 'a' + n;
  },

  getAnnotation: function(id) {
    var found = null;
    this._data.annotations.forEach(function(a) { if (a.id === id) found = clone(a); });
    return found;
  }
});

// ---------------------------------------------------------------------------------------------
// Invitae / Progeny XML

var escapeXml = function(s) {
  return str(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\n/g, '&#10;');
};

/**
 * Tree-level <notes> element for the information (or "<notes/>" when there is none).
 * @param {Object} info as returned by PedigreeInfo.get()
 * @param {String} privacySetting 'all' keeps the family name; other settings drop it
 */
var infoToInvitaeNotes = function(info, privacySetting) {
  info = normalize(info);
  var notes = [];
  FIELDS.forEach(function(f) {
    if (!info[f]) return;
    if (f === 'family' && privacySetting && privacySetting !== 'all') return;
    notes.push({ title: XML_TITLES[f], value: info[f], type: f === 'notes' ? 'multiline' : 'composite' });
  });
  info.annotations.forEach(function(a) {
    notes.push({ title: ANNOTATION_TITLE, value: a.text, type: 'multiline', x: a.x, y: a.y });
  });
  if (!notes.length) return '<notes/>';
  var xml = '<notes>';
  notes.forEach(function(n, i) {
    var id = i + 1;
    xml += '<note id="' + id + '" note_id="' + id + '" value="' + escapeXml(n.value) + '" string_type="' + n.type +
      '" string_title="' + escapeXml(n.title) + '" string_value="' + escapeXml(n.value) + '"';
    if (n.x !== undefined) xml += ' x="' + n.x + '" y="' + n.y + '"';
    xml += '/>';
  });
  return xml + '</notes>';
};

/** Reads the information from Invitae/Progeny XML text; null when there is none */
var infoFromInvitaeXML = function(xmlText) {
  try {
    var doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    var tree = doc.querySelector('tree');
    if (!tree) return null;
    var data = emptyInfo();
    var found = false;
    // condition colours: <indi><conditions><condition title="..." color="1"/>
    // When different conditions share one colour (e.g. files written by an AI that copied the same
    // index everywhere), only the first keeps it; the others get distinct automatic colours.
    var condEls = tree.querySelectorAll(':scope > indi > conditions > condition');
    var colourOwner = {};
    for (var c = 0; c < condEls.length; c++) {
      var cTitle = condEls[c].getAttribute('title') || condEls[c].getAttribute('code');
      var cIdx = parseInt(condEls[c].getAttribute('color'), 10);
      if (!cTitle || isNaN(cIdx) || cIdx < 0 || cIdx >= INVITAE_PALETTE.length) continue;
      var cId = Disorder.sanitizeID(cTitle);
      if (data.conditionColors.hasOwnProperty(cId)) continue;
      if (colourOwner.hasOwnProperty(cIdx) && colourOwner[cIdx] !== cId) continue;
      colourOwner[cIdx] = cId;
      data.conditionColors[cId] = INVITAE_PALETTE[cIdx];
      found = true;
    }
    var notesEl = tree.querySelector(':scope > notes');
    var byTitle = {};
    Object.keys(XML_TITLES).forEach(function(f) { byTitle[XML_TITLES[f].toLowerCase()] = f; });
    var notes = notesEl ? notesEl.querySelectorAll(':scope > note') : [];
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      var title = str(n.getAttribute('string_title')).trim().toLowerCase();
      var value = str(n.getAttribute('string_value') || n.getAttribute('value'));
      if (!value) continue;
      if (title === ANNOTATION_TITLE.toLowerCase()) {
        data.annotations.push({ id: 'a' + (data.annotations.length + 1), x: n.getAttribute('x'), y: n.getAttribute('y'), text: value });
        found = true;
      } else if (byTitle[title]) {
        data[byTitle[title]] = value;
        found = true;
      } else {
        // a pedigree-level note written by another program: keep it in the notes
        data.notes = data.notes ? data.notes + '\n' + value : value;
        found = true;
      }
    }
    return found ? normalize(data) : null;
  } catch (e) {
    return null;
  }
};

/**
 * "2026-10-29" -> "29/10/2026" (Portuguese) or "29 Oct 2026" (English); other text is kept as typed
 */
var formatInfoDate = function(value, lang) {
  var m = str(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return str(value);
  if (lang === 'pt-BR') return m[3] + '/' + m[2] + '/' + m[1];
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return parseInt(m[3], 10) + ' ' + months[parseInt(m[2], 10) - 1] + ' ' + m[1];
};

var todayISO = function() {
  var d = new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

export { PedigreeInfo, normalize as normalizePedigreeInfo, infoToInvitaeNotes, infoFromInvitaeXML, formatInfoDate, todayISO };
