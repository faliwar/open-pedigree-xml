import BaseGraph from 'pedigree/model/baseGraph';
import RelationshipTracker from 'pedigree/model/relationshipTracker';
import OntologyLookup from 'pedigree/ontologyLookup';
import { normalizeTests, normalizeDetails, toInvitaeValue, fromInvitaeValue, toInvitaeAge, needsClassificationAttribute } from 'pedigree/model/clinicalData';

/**
 * InvitaeConverter handles import and export of pedigrees in the Invitae/Progeny
 * Family History Tool XML format.
 *
 * XML Structure:
 *   <tree>
 *     <indi id="N" ...> ... </indi>   (one per individual)
 *     <fam id="fN" ...> ... </fam>    (one per family/relationship)
 *   </tree>
 *
 * @class InvitaeConverter
 */

var InvitaeConverter = function () {};

InvitaeConverter.prototype = {};

InvitaeConverter.PREF_COLORS = [
  '#CC0000', '#4575B4', '#E8A735', '#7B68A0', '#2E8B57',
  '#D4856A', '#5F9EA0', '#8B6C42', '#C75B8E', '#6B8E8E'
];

InvitaeConverter._findClosestPaletteIndex = function (hex) {
  if (!hex || typeof hex !== 'string') return -1;
  var m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return -1;
  var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  var bestIdx = -1;
  var bestDist = Infinity;
  for (var i = 0; i < InvitaeConverter.PREF_COLORS.length; i++) {
    var pm = InvitaeConverter.PREF_COLORS[i].match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (pm) {
      var pr = parseInt(pm[1], 16), pg = parseInt(pm[2], 16), pb = parseInt(pm[3], 16);
      var dist = Math.pow(r - pr, 2) + Math.pow(g - pg, 2) + Math.pow(b - pb, 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
  }
  return bestIdx;
};

InvitaeConverter._getDisorderColorIndex = function (disorderKey, disorderName, disorderIndexMap) {
  var hexColor = null;
  try {
    if (typeof editor !== 'undefined' && editor && editor.getDisorderLegend) {
      var legend = editor.getDisorderLegend();
      if (legend) {
        var candidates = [disorderKey, disorderName];
        for (var i = 0; i < candidates.length; i++) {
          if (!candidates[i]) continue;
          if (legend.getObjectColor) {
            var c = legend.getObjectColor(candidates[i]);
            if (c && c !== '#ff0000' && c !== '#ffffff') {
              hexColor = c;
              break;
            }
          }
          if (legend._objectColors && legend._objectColors.hasOwnProperty(candidates[i])) {
            hexColor = legend._objectColors[candidates[i]];
            break;
          }
        }
      }
    }
  } catch (e) {}

  if (hexColor) {
    hexColor = hexColor.toUpperCase();
    var idx = InvitaeConverter.PREF_COLORS.indexOf(hexColor);
    if (idx >= 0) {
      return String(idx);
    }
    var closestIdx = InvitaeConverter._findClosestPaletteIndex(hexColor);
    if (closestIdx >= 0) {
      return String(closestIdx);
    }
  }

  var key = disorderName || disorderKey;
  if (!disorderIndexMap.hasOwnProperty(key)) {
    var usedIndices = Object.values(disorderIndexMap).map(function (v) { return parseInt(v, 10); });
    var nextIdx = 0;
    while (usedIndices.indexOf(nextIdx) !== -1 && nextIdx < InvitaeConverter.PREF_COLORS.length) {
      nextIdx++;
    }
    disorderIndexMap[key] = String(nextIdx % InvitaeConverter.PREF_COLORS.length);
  }
  return disorderIndexMap[key];
};

/**
 * Returns the human-readable name for a MONDO/HP code if it has been resolved by the
 * editor legends; otherwise returns the value unchanged (free text, or name not loaded yet).
 * @private
 */
InvitaeConverter._resolveOntologyName = function (value, kind) {
  if (!value) {
    return value;
  }
  var oboID = OntologyLookup.toOboID(value);
  if (!oboID) {
    return value;
  }
  if (OntologyLookup._cache && OntologyLookup._cache[oboID] && OntologyLookup._cache[oboID].label) {
    return OntologyLookup._cache[oboID].label;
  }
  try {
    if (typeof editor !== 'undefined' && editor) {
      var item = null;
      if (kind === 'hpo' && editor.getHPOLegend) {
        item = editor.getHPOLegend().getTerm(value);
      } else if (kind === 'disorder' && editor.getDisorderLegend) {
        item = editor.getDisorderLegend().getDisorder(value);
      }
      var name = item && item.getName ? item.getName() : null;
      if (name && name !== 'loading...') {
        return name;
      }
    }
  } catch (e) {
    // fall through and keep the code
  }
  return value;
};

// ===========================================================================================
//  IMPORT: Invitae/Progeny XML → BaseGraph
// ===========================================================================================

/**
 * Sanitizes and repairs Invitae/Progeny XML input text:
 * 1. Strips markdown code block fences (```xml ... ``` or ``` ...) and surrounding commentary.
 * 2. Cleans undefined attribute strings (e.g. value="undefined" -> value="",
 *    display="undefined" -> display="imperial" for weight/height, display="" for others).
 *
 * @param {String} inputText
 * @returns {String} Cleaned XML string
 */
InvitaeConverter.sanitizeInvitaeXML = function (inputText) {
  if (!inputText || typeof inputText !== 'string') {
    return inputText;
  }

  var cleaned = inputText.trim();

  // 1. Strip leading and trailing markdown code block fences (e.g. ```xml ... ``` or ``` ...)
  cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\s*\r?\n?/, '');
  cleaned = cleaned.replace(/\r?\n?```\s*$/, '');
  cleaned = cleaned.trim();

  // If there's conversational commentary before/after the XML, isolate from <?xml or <tree to </tree>
  var xmlStart = cleaned.search(/<\?xml|<tree\b/i);
  if (xmlStart > 0) {
    cleaned = cleaned.substring(xmlStart);
  }
  var treeEnd = cleaned.match(/<\/tree>/i);
  if (treeEnd && treeEnd.index !== undefined) {
    cleaned = cleaned.substring(0, treeEnd.index + '</tree>'.length);
  }
  cleaned = cleaned.trim();

  // 2. Sanitize "undefined" strings in attributes:
  // For weight and height display attribute: use "imperial"
  cleaned = cleaned.replace(/(<(?:weight|height)\b[^>]*?\bdisplay=)["']undefined["']/gi, '$1"imperial"');
  // For any other display="undefined"
  cleaned = cleaned.replace(/\bdisplay=["']undefined["']/gi, 'display=""');
  // For value="undefined"
  cleaned = cleaned.replace(/\bvalue=["']undefined["']/gi, 'value=""');
  // For any other attribute="undefined"
  cleaned = cleaned.replace(/(\s+[a-zA-Z0-9_:-]+=)["']undefined["']/g, '$1""');

  return cleaned;
};

/**
 * Parses Invitae/Progeny XML text and creates a BaseGraph.
 *
 * @param {String} inputText  The raw XML string
 * @returns {BaseGraph}
 */
InvitaeConverter.initFromInvitaeXML = function (inputText) {
  // Pre-process & sanitize raw XML string
  inputText = InvitaeConverter.sanitizeInvitaeXML(inputText);

  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(inputText, 'text/xml');

  var parseError = xmlDoc.querySelector('parsererror');
  if (parseError) {
    throw 'Unable to import pedigree: invalid XML - ' + parseError.textContent;
  }

  var treeEl = xmlDoc.querySelector('tree');
  if (!treeEl) {
    throw 'Unable to import pedigree: no <tree> root element found';
  }

  var indiElements = treeEl.querySelectorAll(':scope > indi');
  var famElements = treeEl.querySelectorAll(':scope > fam');

  if (indiElements.length === 0) {
    throw 'Unable to import pedigree: no individuals found in XML';
  }

  // Pre-pass DOM sanitization for any remaining "undefined" attributes inside <indi>
  for (var i = 0; i < indiElements.length; i++) {
    var indiEl = indiElements[i];
    var allDescendants = indiEl.querySelectorAll('*');
    for (var d = 0; d < allDescendants.length; d++) {
      var childEl = allDescendants[d];
      var tagName = childEl.tagName ? childEl.tagName.toLowerCase() : '';
      if (childEl.hasAttribute('display') && childEl.getAttribute('display') === 'undefined') {
        childEl.setAttribute('display', (tagName === 'weight' || tagName === 'height') ? 'imperial' : '');
      }
      if (childEl.hasAttribute('value') && childEl.getAttribute('value') === 'undefined') {
        childEl.setAttribute('value', '');
      }
    }
    for (var a = 0; a < indiEl.attributes.length; a++) {
      if (indiEl.attributes[a].value === 'undefined') {
        indiEl.attributes[a].value = '';
      }
    }
  }

  // -------------------------------------------------------------------
  // Pre-pass: Identify dummy childless/infertile nodes & auto-sync reciprocal <siblings>
  // -------------------------------------------------------------------
  var dummyMap = {}; // Tracks childInvitaeId -> statusType (childless/infertile)
  var indiById = {};
  for (var i = 0; i < indiElements.length; i++) {
    var indi = indiElements[i];
    var indiId = indi.getAttribute('id');
    if (indiId) {
      indiById[indiId] = indi;
    }

    // Identify dummy childless/infertile nodes
    var statusVal = InvitaeConverter._getChildAttr(indi, 'status', 'value');
    var fName = InvitaeConverter._getChildAttr(indi, 'first_name', 'value');
    var lName = InvitaeConverter._getChildAttr(indi, 'last_name', 'value');
    var isDummyChildless = (indiId && indiId.indexOf('d') === 0 && (statusVal === '7' || statusVal === '6')) ||
      ((statusVal === '7' || statusVal === '6') && (!fName || fName === 'undefined' || fName === '') && (!lName || lName === 'undefined' || lName === ''));
    if (isDummyChildless) {
      dummyMap[indiId] = (statusVal === '7') ? 'childless' : 'infertile';
    }
  }

  // Auto-Sync Reciprocal <siblings> from <fam><children>:
  // Ensure that all real <child> elements sharing a <fam> have reciprocal <sibling id="..." type="0"/> entries
  for (var f = 0; f < famElements.length; f++) {
    var fam = famElements[f];
    var childrenEl = fam.querySelector(':scope > children');
    if (!childrenEl) continue;
    var childEls = childrenEl.querySelectorAll(':scope > child');
    var realChildIds = [];
    for (var c = 0; c < childEls.length; c++) {
      var cId = childEls[c].getAttribute('id');
      if (cId && !dummyMap[cId] && indiById[cId]) {
        realChildIds.push(cId);
      }
    }

    for (var i = 0; i < realChildIds.length; i++) {
      var childIdA = realChildIds[i];
      var indiA = indiById[childIdA];
      var siblingsElA = indiA.querySelector(':scope > siblings');
      if (!siblingsElA) {
        siblingsElA = xmlDoc.createElement('siblings');
        indiA.appendChild(siblingsElA);
      }

      for (var j = 0; j < realChildIds.length; j++) {
        if (i === j) continue;
        var childIdB = realChildIds[j];
        var indiB = indiById[childIdB];
        var existingSibAtoB = siblingsElA.querySelector(':scope > sibling[id="' + childIdB + '"]');

        if (!existingSibAtoB) {
          // Check if B already declared A as a twin (type 1 or 2)
          var siblingsElB = indiB ? indiB.querySelector(':scope > siblings') : null;
          var existingSibBtoA = siblingsElB ? siblingsElB.querySelector(':scope > sibling[id="' + childIdA + '"]') : null;
          var sibType = '0';
          if (existingSibBtoA && (existingSibBtoA.getAttribute('type') === '1' || existingSibBtoA.getAttribute('type') === '2')) {
            sibType = existingSibBtoA.getAttribute('type');
          }

          var newSib = xmlDoc.createElement('sibling');
          newSib.setAttribute('id', childIdB);
          newSib.setAttribute('type', sibType);
          siblingsElA.appendChild(newSib);
        }
      }
    }
  }

  var newG = new BaseGraph();

  // -------------------------------------------------------------------
  // Pass 1: Parse all individuals from <indi> elements
  // -------------------------------------------------------------------
  var invitaeIdToPedigreeId = {};
  var probandInvitaeId = null;
  var nextPedigreeId = 1; // reserve 0 for the proband
  var nextTwinGroup = 1;
  var twinGroupIdMap = {};

  // First, find the proband (marked_by == 2 on an individual that is NOT a group spouse placeholder)
  // We look for the first individual with marked_by="2" that is not a group
  for (var i = 0; i < indiElements.length; i++) {
    var indi = indiElements[i];
    var indiId = indi.getAttribute('id');
    var markedBy = InvitaeConverter._getChildAttr(indi, 'marked_by', 'value');
    var isPat = indi.getAttribute('pat');
    var multipleEl = indi.querySelector(':scope > multiple');
    var isGroup = (multipleEl && multipleEl.getAttribute('value') === '1');

    if (isPat === '1' && !isGroup && probandInvitaeId === null) {
      probandInvitaeId = indiId;
    }
  }

  // If no proband found, use the first individual
  if (probandInvitaeId === null) {
    probandInvitaeId = indiElements[0].getAttribute('id');
  }

  // Parse all individuals
  for (var i = 0; i < indiElements.length; i++) {
    var indi = indiElements[i];
    var indiId = indi.getAttribute('id');

    if (dummyMap[indiId]) {
      continue;
    }

    var properties = InvitaeConverter._parseIndividual(indi);

    // Handle twins
    if (properties.twinInfo) {
      var tg = twinGroupIdMap[indiId];
      if (!tg) {
        tg = nextTwinGroup++;
        twinGroupIdMap[indiId] = tg;
      }
      properties.twinGroup = tg;
      if (properties.twinInfo.some(t => t.type === '2')) {
        properties.monozygotic = true;
      } else {
        properties.monozygotic = false;
      }
      // Map other twins to this group
      for (var t = 0; t < properties.twinInfo.length; t++) {
        twinGroupIdMap[properties.twinInfo[t].id] = tg;
      }
      delete properties.twinInfo;
    }

    var useId;
    if (indiId === probandInvitaeId) {
      useId = 0;
    } else {
      // Make sure we don't conflict with 0
      useId = nextPedigreeId++;
    }

    var width = newG.defaultPersonNodeWidth;
    if (properties.numPersons && properties.numPersons > 1) {
      // groups are wider
      width = newG.defaultPersonNodeWidth;
    }

    var pedigreeId = newG._addVertex(useId, BaseGraph.TYPE.PERSON, properties, width);
    invitaeIdToPedigreeId[indiId] = pedigreeId;
  }

  // -------------------------------------------------------------------
  // Pass 2: Parse family relationships from <fam> elements
  // -------------------------------------------------------------------
  var defaultEdgeWeight = 1;
  var relationshipTracker = new RelationshipTracker(newG, defaultEdgeWeight);

  for (var f = 0; f < famElements.length; f++) {
    var fam = famElements[f];
    var maleEl = fam.querySelector(':scope > male');
    var femaleEl = fam.querySelector(':scope > female');
    var childrenEl = fam.querySelector(':scope > children');
    var consanguinity = fam.getAttribute('consanguinity');
    var exPartner = fam.getAttribute('ex');

    var fatherId = null;
    var motherId = null;

    if (maleEl) {
      var maleInvitaeId = maleEl.getAttribute('id');
      if (invitaeIdToPedigreeId.hasOwnProperty(maleInvitaeId)) {
        fatherId = invitaeIdToPedigreeId[maleInvitaeId];
      }
    }
    if (femaleEl) {
      var femaleInvitaeId = femaleEl.getAttribute('id');
      if (invitaeIdToPedigreeId.hasOwnProperty(femaleInvitaeId)) {
        motherId = invitaeIdToPedigreeId[femaleInvitaeId];
      }
    }

    // If only one parent exists, use single-parent relationship (no virtual partner)
    var isSingleParent = false;
    var singleParentId = null;
    if (fatherId === null && motherId !== null) {
      isSingleParent = true;
      singleParentId = motherId;
    }
    if (motherId === null && fatherId !== null) {
      isSingleParent = true;
      singleParentId = fatherId;
    }

    // Create a single virtual unknown parent.
    if (fatherId === null && motherId === null) {
      var unknownParentId = newG._addVertex(null, BaseGraph.TYPE.PERSON,
        { 'gender': 'U', 'comments': '', 'isVirtualParent': true }, newG.defaultPersonNodeWidth);
      isSingleParent = true;
      singleParentId = unknownParentId;
    }

    var childEls = childrenEl ? childrenEl.querySelectorAll(':scope > child') : [];
    
    // Check if we have real children
    var hasRealChildren = false;
    for (var c = 0; c < childEls.length; c++) {
      var cid = childEls[c].getAttribute('id');
      if (!dummyMap[cid] && invitaeIdToPedigreeId.hasOwnProperty(cid)) {
        hasRealChildren = true;
        break;
      }
    }

    var chhubId;
    var relNode;
    
    if (isSingleParent) {
      if (hasRealChildren) {
        // Get or create a single-parent childhub
        chhubId = relationshipTracker.createOrGetSingleParentChildhub(singleParentId);
        // Find the relationship node for this single parent
        var singleParentOutEdges = newG.getOutEdges(singleParentId);
        for (var e = 0; e < singleParentOutEdges.length; e++) {
          var candidate = singleParentOutEdges[e];
          if (newG.isRelationship(candidate)) {
            var relInEdges = newG.getInEdges(candidate);
            if (relInEdges.length === 1 && relInEdges[0] === singleParentId) {
              relNode = candidate;
              break;
            }
          }
        }
      }
    } else {
      // Always get or create the childhub for this couple
      chhubId = relationshipTracker.createOrGetChildhub(motherId, fatherId);
      relNode = newG.getRelationshipNode(fatherId, motherId);
      
      if (!hasRealChildren) {
        // PositionedGraph requires all relationships to have a childhub with at least one child. Add a dummy child.
        var dummyChildId = newG._addVertex( null, BaseGraph.TYPE.PERSON, {'gender': 'U', 'comments': '', 'isVirtualDummyChild': true, 'isPlaceholder': true}, newG.defaultPersonNodeWidth );
        newG.addEdge( chhubId, dummyChildId, defaultEdgeWeight );
      }
    }

    if (relNode !== null && relNode !== undefined) {
      if (consanguinity === '1') {
        newG.properties[relNode]['consangr'] = 'Y';
      }
      if (exPartner === '1') {
        newG.properties[relNode]['broken'] = true;
      }
    }

    // Process children and statuses
    for (var c = 0; c < childEls.length; c++) {
      var childInvitaeId = childEls[c].getAttribute('id');
      
      if (dummyMap[childInvitaeId]) {
         var dummyStatus = dummyMap[childInvitaeId];
         if (relNode !== null && relNode !== undefined && !isSingleParent) {
           if (!newG.properties[relNode]) newG.properties[relNode] = {};
           newG.properties[relNode]['childlessStatus'] = dummyStatus;
         } else {
           if (fatherId !== null) {
              if (!newG.properties[fatherId]) newG.properties[fatherId] = {};
              newG.properties[fatherId]['childlessStatus'] = dummyStatus;
           }
           if (motherId !== null) {
              if (!newG.properties[motherId]) newG.properties[motherId] = {};
              newG.properties[motherId]['childlessStatus'] = dummyStatus;
           }
         }
      } else if (invitaeIdToPedigreeId.hasOwnProperty(childInvitaeId) && chhubId !== undefined) {
        var childPedigreeId = invitaeIdToPedigreeId[childInvitaeId];
        newG.addEdge(chhubId, childPedigreeId, defaultEdgeWeight);
      }
    }
  }

  // Now that the graph structure is in place, validate it to ensure we haven't introduced any broken
  // nodes or cycles.
  try {
    newG.validate();
  } catch (e) {
    var eStr = e.toString();
    if (eStr.indexOf('all relationships should have a childhub') === -1 &&
        eStr.indexOf('all childhubs should have at least one child') === -1) {
      throw 'Error importing pedigree: ' + e;
    }
  }
  return newG;
};

/**
 * Parses a single <indi> element into a properties object.
 * @private
 */
InvitaeConverter._parseIndividual = function (indiEl) {
  var properties = {};

  // Gender: 0=male, 1=female, 2=unknown
  var genderVal = InvitaeConverter._getChildAttr(indiEl, 'gender', 'value');
  if (genderVal === '0') {
    properties.gender = 'M';
  } else if (genderVal === '1') {
    properties.gender = 'F';
  } else {
    properties.gender = 'U';
  }

  // Marked By (Evaluation status)
  var markedBy = InvitaeConverter._getChildAttr(indiEl, 'marked_by', 'value');
  if (markedBy === '1') {
    properties.evaluated = '+';
  } else if (markedBy === '2') {
    properties.evaluated = '-';
  } else if (markedBy === '3') {
    properties.evaluated = '*';
  }

  // Names
  var fName = InvitaeConverter._getChildAttr(indiEl, 'first_name', 'value');
  var lName = InvitaeConverter._getChildAttr(indiEl, 'last_name', 'value');
  var fullName = '';
  if (fName && fName !== '' && fName !== 'undefined') {
    fullName += fName;
  }
  if (lName && lName !== '' && lName !== 'undefined') {
    if (fullName !== '') {
      fullName += ' ';
    }
    fullName += lName;
  }
  fullName = fullName.trim();
  if (fullName !== '') {
    properties.name = fullName;
    properties.fName = fullName;
  }

  // External ID (MRN)
  var mrn = indiEl.getAttribute('MRN');
  if (mrn && mrn !== '') {
    properties.externalID = mrn;
  }

  // Life status: 0=alive, 1=deceased, 3=abortion, 5=miscarriage, 7=stillborn
  var statusVal = InvitaeConverter._getChildAttr(indiEl, 'status', 'value');
  if (statusVal === '1') {
    properties.lifeStatus = 'deceased';
  } else if (statusVal === '3') {
    properties.lifeStatus = 'aborted';
  } else if (statusVal === '5') {
    properties.lifeStatus = 'miscarriage';
  } else if (statusVal === '7') {
    properties.lifeStatus = 'stillborn';
  }

  // Fetus
  var fetusVal = InvitaeConverter._getChildAttr(indiEl, 'fetus', 'value');
  if (fetusVal === '1') {
    properties.lifeStatus = 'unborn';
  }

  // Carrier (element-level, separate from condition status)
  var carrierVal = InvitaeConverter._getChildAttr(indiEl, 'carrier', 'value');
  if (carrierVal === '1') {
    properties.carrierStatus = 'carrier';
  }

  // Adoption
  var adoptionVal = InvitaeConverter._getChildAttr(indiEl, 'adoption', 'value');
  var adoptionFromVal = InvitaeConverter._getChildAttr(indiEl, 'adoption_from', 'value');
  if (adoptionVal === '1' || adoptionFromVal === '1') {
    properties.isAdopted = true;
  }

  // DOB
  var dobVal = indiEl.getAttribute('date_of_birth') || indiEl.getAttribute('dob') || indiEl.getAttribute('DOB') ||
               InvitaeConverter._getChildAttr(indiEl, 'date_of_birth', 'value') || 
               InvitaeConverter._getChildAttr(indiEl, 'dob', 'value');
               
  if (!dobVal) {
    var dobEl = indiEl.querySelector(':scope > date_of_birth') || indiEl.querySelector(':scope > dob');
    if (dobEl) dobVal = dobEl.textContent || dobEl.getAttribute('value');
  }

  if (dobVal && dobVal !== '' && dobVal !== 'undefined') {
    properties.dob = dobVal;
  }

  // Age — stored as "N yrs" string or as a date. When it's an age string,
  // compute an approximate DOB from today minus the age value.
  var ageVal = InvitaeConverter._getChildAttr(indiEl, 'age', 'value');
  if (ageVal && ageVal !== '' && ageVal !== 'undefined' && !properties.dob) {
    var ageMatch = ageVal.match(/(\d+)\s*yrs?/i);
    var moMatch = ageVal.match(/(\d+)\s*mo/i);
    var wkMatch = ageVal.match(/(\d+)\s*wk/i);
    if (ageMatch) {
      var ageNum = parseInt(ageMatch[1]);
      var approxDob = new Date();
      approxDob.setFullYear(approxDob.getFullYear() - ageNum);
      properties.dob = (approxDob.getMonth() + 1) + '/' + approxDob.getDate() + '/' + approxDob.getFullYear();
      properties.dobApprox = true;
      properties.ageInput = String(ageNum);
    } else if (moMatch) {
      var moNum = parseInt(moMatch[1]);
      var approxDob = new Date();
      approxDob.setMonth(approxDob.getMonth() - moNum);
      properties.dob = (approxDob.getMonth() + 1) + '/' + approxDob.getDate() + '/' + approxDob.getFullYear();
      properties.dobApprox = true;
      properties.ageInput = moNum + ' mo';
    } else if (wkMatch) {
      var wkNum = parseInt(wkMatch[1]);
      var approxDob = new Date();
      approxDob.setDate(approxDob.getDate() - (wkNum * 7));
      properties.dob = (approxDob.getMonth() + 1) + '/' + approxDob.getDate() + '/' + approxDob.getFullYear();
      properties.dobApprox = true;
      properties.ageInput = wkNum + ' wk';
    } else if (ageVal.match(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/) || ageVal.match(/^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/)) {
      // If age is directly a date like "02/20/1985"
      properties.dob = ageVal;
    }
  }

  // Detect "approximate DOB" note — also set dobApprox if found
  var notesElForApprox = indiEl.querySelector(':scope > notes');
  if (notesElForApprox) {
    var noteElsForApprox = notesElForApprox.querySelectorAll(':scope > note');
    for (var na = 0; na < noteElsForApprox.length; na++) {
      var noteVal = noteElsForApprox[na].getAttribute('string_value') || noteElsForApprox[na].getAttribute('value');
      if (noteVal && noteVal.toLowerCase() === 'approximate dob') {
        properties.dobApprox = true;
        break;
      }
    }
  }

  // Age at death (its own field; exact dates are not available in this format)
  var ageAtDeath = InvitaeConverter._getChildAttr(indiEl, 'age_at_death', 'value');
  if (ageAtDeath && ageAtDeath !== '' && ageAtDeath !== 'undefined') {
    properties.ageAtDeath = ageAtDeath;
  }

  // Cause of death
  var causeVal = InvitaeConverter._getChildAttr(indiEl, 'cause', 'value');
  if (causeVal && causeVal !== '' && causeVal !== 'undefined') {
    if (!properties.comments) {
      properties.comments = '';
    }
    properties.comments += (properties.comments ? '\n' : '') + 'Cause of death: ' + causeVal;
  }

  // Comments
  var commentsVal = InvitaeConverter._getChildAttr(indiEl, 'comments', 'value');
  if (commentsVal && commentsVal !== '' && commentsVal !== 'undefined') {
    if (!properties.comments) {
      properties.comments = '';
    }
    properties.comments += (properties.comments ? '\n' : '') + commentsVal;
  }
  // Clean up leading newline and sanitize 'undefined' string values
  if (properties.comments) {
    properties.comments = properties.comments.replace(/^\n/, '');
    // Remove literal 'undefined' that may have been stored in the XML
    if (properties.comments === 'undefined') {
      delete properties.comments;
    }
  }

  // Multiple / Person Group
  var multipleEl = indiEl.querySelector(':scope > multiple');
  if (multipleEl) {
    var multipleFlag = multipleEl.getAttribute('value');
    if (multipleFlag === '1') {
      var count = parseInt(multipleEl.textContent);
      if (count && count > 0) {
        properties.numPersons = count;
      }
    }
  }

  // Conditions → disorders + carrierStatus overrides
  var conditionsEl = indiEl.querySelector(':scope > conditions');
  if (conditionsEl) {
    var condEls = conditionsEl.querySelectorAll(':scope > condition');
    for (var c = 0; c < condEls.length; c++) {
      var condEl = condEls[c];
      var condTitle = condEl.getAttribute('title') || condEl.getAttribute('code');
      var condStatus = condEl.getAttribute('status');
      var colorAttr = condEl.getAttribute('color');

      if (!properties.disorders) {
        properties.disorders = [];
      }
      properties.disorders.push(condTitle);

      // Diagnosis details: basis of diagnosis, ages, note and detail fields (e.g. cancer
      // laterality, histology, receptors), plus the Progeny code/short title for round trips
      var noteChild = condEl.querySelector(':scope > note');
      var detail = {
        type: condEl.getAttribute('type') || '',
        onset: condEl.getAttribute('onset') || '',
        atdiag: condEl.getAttribute('atdiag') || '',
        note: (noteChild && noteChild.getAttribute('value')) || condEl.getAttribute('note') || '',
        fields: [],
        code: condEl.getAttribute('code') || '',
        shortTitle: condEl.getAttribute('shortenTitle') || '',
        status: condStatus || ''
      };
      var fieldEls = condEl.querySelectorAll(':scope > field');
      for (var fi = 0; fi < fieldEls.length; fi++) {
        detail.fields.push({ name: fieldEls[fi].getAttribute('name') || '', value: fieldEls[fi].getAttribute('value') || '' });
      }
      if (!properties.disorderDetails) {
        properties.disorderDetails = {};
      }
      properties.disorderDetails[condTitle] = detail;

      if (condStatus === 'carrier') {
        properties.carrierStatus = 'carrier';
      } else {
        properties.carrierStatus = 'affected';
      }

      // Preserve condition color in legend cache if specified
      if (colorAttr !== null && colorAttr !== '') {
        var cIdx = parseInt(colorAttr, 10);
        if (!isNaN(cIdx) && cIdx >= 0 && cIdx < InvitaeConverter.PREF_COLORS.length) {
          var assignedHex = InvitaeConverter.PREF_COLORS[cIdx];
          try {
            if (typeof editor !== 'undefined' && editor && editor.getDisorderLegend) {
              var dl = editor.getDisorderLegend();
              if (dl && dl._objectColors) {
                dl._objectColors[condTitle] = assignedHex;
              }
            }
          } catch (e) {}
        }
      }
    }
  }

  // Genetic tests: <condition_tests><test name="brca1" value="1" title="BRCA1" company=""/>
  // value 0 = unknown, 1 = positive, 2 = negative, 3 = declined testing. Extra attributes written by this editor
  // (variant, protein, zygosity, classification, date, comment) are read back when present.
  var testEls = indiEl.querySelectorAll(':scope > condition_tests > test');
  for (var ti = 0; ti < testEls.length; ti++) {
    var tEl = testEls[ti];
    var tName = tEl.getAttribute('name') || '';
    var gene = tEl.getAttribute('title') || tName;
    if (!gene) {
      continue;
    }
    var tValue = tEl.getAttribute('value') || '';
    if (!properties.geneticTests) {
      properties.geneticTests = [];
    }
    properties.geneticTests.push({
      gene: gene,
      variant: tEl.getAttribute('variant') || '',
      protein: tEl.getAttribute('protein') || '',
      zygosity: tEl.getAttribute('zygosity') || '',
      testType: tEl.getAttribute('testType') || '',
      classification: tEl.getAttribute('classification') || fromInvitaeValue(tValue),
      lab: tEl.getAttribute('company') || '',
      date: tEl.getAttribute('date') || '',
      comment: tEl.getAttribute('comment') || '',
      invitaeName: tName,
      invitaeValue: tValue
    });
  }

  // Elements not edited here (surgical removals, Gail model answers): kept verbatim
  ['surgical_removals', 'gail_properties'].forEach(function(tag) {
    var el = indiEl.querySelector(':scope > ' + tag);
    if (el && el.children && el.children.length > 0) {
      if (!properties.invitaeExtra) {
        properties.invitaeExtra = {};
      }
      properties.invitaeExtra[tag] = new XMLSerializer().serializeToString(el);
    }
  });

  // Notes → Phenotype notes as HPO terms, other notes as comments
  var notesEl = indiEl.querySelector(':scope > notes');
  if (notesEl) {
    var noteEls = notesEl.querySelectorAll(':scope > note');
    for (var n = 0; n < noteEls.length; n++) {
      var noteEl = noteEls[n];
      var noteType = noteEl.getAttribute('string_title');
      var noteValue = noteEl.getAttribute('string_value') || noteEl.getAttribute('value');

      if (noteValue && noteValue !== '' && noteValue !== 'undefined') {
        if (noteType === 'Phenotype') {
          if (!properties.hpoTerms) {
            properties.hpoTerms = [];
          }
          properties.hpoTerms.push(noteValue);
        } else if (noteType === 'Ethnicity' && /ashkenazi/i.test(noteValue)) {
          properties.ashkenazi = true;
        } else if (noteValue.toLowerCase() !== 'approximate dob') {
          // Generic note → comments
          if (!properties.comments) {
            properties.comments = '';
          }
          properties.comments += (properties.comments ? '\n' : '') + noteValue;
        }
      }
    }
  }

  // Scrub any lingering "approximate DOB" from comments
  if (properties.comments) {
    properties.comments = properties.comments.replace(/approximate DOB(\r?\n)?/igm, '');
    properties.comments = properties.comments.replace(/^\s*[\r\n]/gm, '').trim();
  }

  // Siblings / Twins
  var siblingsEl = indiEl.querySelector(':scope > siblings');
  if (siblingsEl) {
    var sibEls = siblingsEl.querySelectorAll(':scope > sibling');
    for (var s = 0; s < sibEls.length; s++) {
      var sibType = sibEls[s].getAttribute('type');
      if (sibType === '1' || sibType === '2') {
        if (!properties.twinInfo) properties.twinInfo = [];
        properties.twinInfo.push({ id: sibEls[s].getAttribute('id'), type: sibType });
      }
    }
  }

  return properties;
};

/**
 * Helper to get a child element's attribute value.
 * @private
 */
InvitaeConverter._getChildAttr = function (parentEl, childTagName, attrName) {
  var child = parentEl.querySelector(':scope > ' + childTagName);
  if (child) {
    return child.getAttribute(attrName);
  }
  return null;
};


// ===========================================================================================
//  EXPORT: Pedigree → Invitae/Progeny XML
// ===========================================================================================

/**
 * Exports the pedigree as Invitae/Progeny compatible XML.
 *
 * @param {Object} pedigree  The pedigree data (pedigree.GG is the base graph)
 * @param {String} privacySetting  'all', 'nopersonal', or 'minimal'
 * @returns {String}  XML string
 */
InvitaeConverter.exportAsInvitaeXML = function (pedigree, privacySetting) {
  var now = new Date();
  var dateStr = InvitaeConverter._formatDate(now);

  var guid = InvitaeConverter._generateGUID();

  var xml = '';
  xml += '<tree created="' + dateStr + '" opened="' + dateStr + '" condition_mask="null" purpose="10000" guid="' + guid + '">';
  xml += '<metainformation/>';
  xml += '<notes/>';

  // --- Orders section (simplified) ---
  xml += '<orders/>';

  // --- Settings ---
  xml += '<settings>';
  xml += '<risk_assessment value="0"/>';
  xml += '<risk_analysis value="0"/>';
  xml += '<risk_analysis_for_family value="0"/>';
  xml += '</settings>';

  // --- Build individual and family data ---
  var idToInvitaeId = {};
  var maxIndiId = -1;

  // Assign Invitae IDs (use the graph node index as the ID)
  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }
    if (pedigree.GG.properties[i] && (pedigree.GG.properties[i].isVirtualParent || pedigree.GG.properties[i].isVirtualDummyChild)) {
      continue;
    }
    idToInvitaeId[i] = String(i);
    if (i > maxIndiId) {
      maxIndiId = i;
    }
  }

  // Next available ID for dummy childless individuals must be an integer (Progeny/Invitae requires numeric indi IDs)
  var nextDummyIndiId = maxIndiId + 1;
  var dummyIndis = '';
  var singlePersonChildless = [];
  var relChildlessMap = {};
  var disorderIndexMap = {};

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }
    if (pedigree.GG.properties[i] && (pedigree.GG.properties[i].isVirtualParent || pedigree.GG.properties[i].isVirtualDummyChild)) {
      continue;
    }

    var props = pedigree.GG.properties[i];
    xml += InvitaeConverter._buildIndiElement(i, props, pedigree, privacySetting, idToInvitaeId, disorderIndexMap);

    if (props && (props.childlessStatus === 'childless' || props.childlessStatus === 'infertile')) {
      var dId = String(nextDummyIndiId++);
      var sVal = (props.childlessStatus === 'childless') ? '7' : '6';
      dummyIndis += '<indi id="' + dId + '" pat="0"><marked_by value="0"/><first_name value=""/><last_name value=""/><gender value="0"/><status value="' + sVal + '"/><comments value="undefined"/><cause value=""/><age value=""/><weight display="undefined" value="undefined"/><height display="undefined" value="undefined"/><carrier value="0"/><adoption value="0"/><adoption_from value="0"/><smoker value="3"/><obese value="0"/><age_at_death value=""/><medications value=""/><allergies value=""/><fertilization value="0"/><fetus value="0"/><multiple value="0">0</multiple><attrib_data/><gail_properties/></indi>';
      singlePersonChildless.push({ parentId: idToInvitaeId[i], gender: props.gender, dummyChildId: dId });
    }
  }

  // Pre-process relationships to catch any dummy indis we need to declare
  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (pedigree.GG.isRelationship(i)) {
      var relProps = pedigree.GG.properties[i] || {};
      if (relProps.childlessStatus === 'childless' || relProps.childlessStatus === 'infertile') {
        var dId = String(nextDummyIndiId++);
        var sVal = (relProps.childlessStatus === 'childless') ? '7' : '6';
        dummyIndis += '<indi id="' + dId + '" pat="0"><marked_by value="0"/><first_name value=""/><last_name value=""/><gender value="0"/><status value="' + sVal + '"/><comments value="undefined"/><cause value=""/><age value=""/><weight display="undefined" value="undefined"/><height display="undefined" value="undefined"/><carrier value="0"/><adoption value="0"/><adoption_from value="0"/><smoker value="3"/><obese value="0"/><age_at_death value=""/><medications value=""/><allergies value=""/><fertilization value="0"/><fetus value="0"/><multiple value="0">0</multiple><attrib_data/><gail_properties/></indi>';
        relChildlessMap[i] = dId;
      }
    }
  }

  xml += dummyIndis;

  // Build families from relationships
  var famIndex = 0;
  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isRelationship(i)) {
      continue;
    }

    var relProps = pedigree.GG.properties[i] || {};
    var parents = pedigree.GG.getParents(i);
    if (!parents || parents.length < 1) {
      continue;
    }

    var parent1 = parents[0];
    var parent2 = parents.length > 1 ? parents[1] : null;

    // Determine male/female
    var maleId = null;
    var femaleId = null;
    var p1Gender = pedigree.GG.properties[parent1] ? pedigree.GG.properties[parent1].gender : 'U';
    var p2Gender = parent2 !== null && pedigree.GG.properties[parent2] ? pedigree.GG.properties[parent2].gender : 'U';

    if (parent2 === null) {
      // single-parent relationship
      if (p1Gender === 'F') {
        femaleId = parent1;
      } else {
        maleId = parent1;
      }
    } else if (p1Gender === 'M') {
      maleId = parent1;
      femaleId = parent2;
    } else if (p2Gender === 'M') {
      maleId = parent2;
      femaleId = parent1;
    } else if (p1Gender === 'F') {
      femaleId = parent1;
      maleId = parent2;
    } else {
      maleId = parent1;
      femaleId = parent2;
    }

    // Get children
    var childhub = pedigree.GG.getOutEdges(i);
    var children = [];
    if (childhub && childhub.length > 0) {
      var chhubId = pedigree.GG.downTheChainUntilNonVirtual(childhub[0]);
      var childEdges = pedigree.GG.getOutEdges(chhubId);
      if (childEdges) {
        for (var ce = 0; ce < childEdges.length; ce++) {
          children.push(pedigree.GG.downTheChainUntilNonVirtual(childEdges[ce]));
        }
      }
    }

    var consangr = relProps['consangr'];
    var consanguinity = (consangr === 'Y' || consangr === 'A') ? '1' : '0';
    var broken = relProps['broken'] ? '1' : '0';

    var hasParents = (maleId !== null && idToInvitaeId[maleId] !== undefined) ||
                     (femaleId !== null && idToInvitaeId[femaleId] !== undefined);

    var validChildren = [];
    for (var c = 0; c < children.length; c++) {
      if (idToInvitaeId[children[c]] !== undefined) {
        validChildren.push(children[c]);
      }
    }

    if (!hasParents && validChildren.length === 0 && !relChildlessMap[i]) {
      continue;
    }

    // link=1 seems to indicate a secondary link/cross-branch marriage, not twins. Default to 0.
    xml += '<fam id="f' + famIndex + '" ex="' + (relProps.broken ? '1' : '0') + '" consanguinity="' + consanguinity + '" link="0">';

    if (maleId !== null && idToInvitaeId[maleId] !== undefined) {
      xml += '<male id="' + idToInvitaeId[maleId] + '"/>';
    }
    if (femaleId !== null && idToInvitaeId[femaleId] !== undefined) {
      xml += '<female id="' + idToInvitaeId[femaleId] + '"/>';
    }

    if (validChildren.length > 0 || relChildlessMap[i]) {
      xml += '<children>';
      if (relChildlessMap[i]) {
        xml += '<child id="' + relChildlessMap[i] + '"/>';
      }
      for (var c = 0; c < validChildren.length; c++) {
        xml += '<child id="' + idToInvitaeId[validChildren[c]] + '"/>';
      }
      xml += '</children>';
    }

    xml += '</fam>';
    famIndex++;
  }

  // Single-person dummy families (must follow f<int> naming convention)
  for (var sp = 0; sp < singlePersonChildless.length; sp++) {
    var spEntry = singlePersonChildless[sp];
    var pTag = (spEntry.gender === 'F') ? 'female' : 'male';
    xml += '<fam id="f' + famIndex + '" ex="0" consanguinity="0" link="0"><' + pTag + ' id="' + spEntry.parentId + '"/><children><child id="' + spEntry.dummyChildId + '"/></children></fam>';
    famIndex++;
  }

  xml += '</tree>';
  return xml;
};

/**
 * Builds a single <indi> XML element.
 * @private
 */
InvitaeConverter._buildIndiElement = function (nodeId, props, pedigree, privacySetting, idToInvitaeId, disorderIndexMap) {
  var invitaeId = idToInvitaeId[nodeId];
  var mrn = (privacySetting === 'all' && props.externalID) ? props.externalID : '';

  var xml = '<indi id="' + invitaeId + '" pat="' + ((props.probandFlag === true || (nodeId === 0 && props.probandFlag !== false)) ? '1' : '0') + '" MRN="' + InvitaeConverter._escapeXml(mrn) + '">';

  // marked_by: 1 = positive, 2 = negative, 3 = documented, 0 = none
  var markedBy = '0';
  if (props.evaluated === '+') {
    markedBy = '1';
  } else if (props.evaluated === '-') {
    markedBy = '2';
  } else if (props.evaluated === '*') {
    markedBy = '3';
  }
  xml += '<marked_by value="' + markedBy + '"/>';

  // Names
  if (privacySetting === 'all') {
    var pName = props.name || props.fName || '';
    if (!pName && props.lName) {
      pName = props.lName;
    }
    xml += '<first_name value="' + InvitaeConverter._escapeXml(pName) + '"/>';
    xml += '<last_name value=""/>';
  } else {
    xml += '<first_name value=""/>';
    xml += '<last_name value=""/>';
  }

  // Gender and Status depend on lifeStatus for aborted/miscarriage
  var genderVal = '2';
  var statusVal = '0';

  if (props.lifeStatus === 'aborted') {
    genderVal = '-2';
    statusVal = '3';
  } else if (props.lifeStatus === 'miscarriage') {
    genderVal = '-2';
    statusVal = '5';
  } else {
    // Normal gender mapping: M→0, F→1, U→2
    if (props.gender === 'M') {
      genderVal = '0';
    } else if (props.gender === 'F') {
      genderVal = '1';
    }
    // Normal status mapping: alive→0, deceased→1, stillborn→7
    if (props.lifeStatus === 'deceased') {
      statusVal = '1';
    } else if (props.lifeStatus === 'stillborn') {
      statusVal = '7';
    }
  }
  xml += '<gender value="' + genderVal + '"/>';
  xml += '<status value="' + statusVal + '"/>';

  // Comments
  var comments = '';
  if (privacySetting !== 'minimal' && props.comments) {
    // Filter out the synthetic comments we added during import
    comments = (props.comments || '').replace(/^(Age at death:.*|Cause of death:.*)$/gm, '').trim();
  }
  xml += '<comments value="' + InvitaeConverter._escapeXml(comments) + '"/>';

  // Cause of death (extract from comments if present)
  var cause = '';
  if (props.comments) {
    var causeMatch = props.comments.match(/Cause of death:\s*(.+)/);
    if (causeMatch) {
      cause = causeMatch[1].trim();
    }
  }
  xml += '<cause value="' + InvitaeConverter._escapeXml(cause) + '"/>';
  // Age — export the DOB date (approximate or exact) in MM/DD/YYYY format
  var ageStr = '';
  if (privacySetting === 'all') {
    if (props.dob) {
      try {
        var dob = new Date(props.dob);
        if (!isNaN(dob.getTime())) {
          var mm = String(dob.getMonth() + 1).padStart(2, '0');
          var dd = String(dob.getDate()).padStart(2, '0');
          var yyyy = dob.getFullYear();
          ageStr = mm + '/' + dd + '/' + yyyy;
        }
      } catch (e) { /* ignore */ }
    }
  }
  xml += '<age value="' + ageStr + '"/>';

  xml += '<weight display="imperial" value=""/>';
  xml += '<height display="imperial" value=""/>';

  // Carrier flag
  var carrierFlag = '0';
  if (props.carrierStatus === 'carrier') {
    carrierFlag = '1';
  }
  xml += '<carrier value="' + carrierFlag + '"/>';

  // Adoption
  xml += '<adoption value="' + (props.isAdopted ? '1' : '0') + '"/>';
  xml += '<adoption_from value="' + (props.isAdopted ? '1' : '0') + '"/>';
  xml += '<smoker value="3"/>';
  xml += '<obese value="0"/>';

  // Age at death (own field; older saves kept it as a comment line)
  var ageAtDeath = props.ageAtDeath || '';
  if (!ageAtDeath && props.comments) {
    var ageDeathMatch = props.comments.match(/Age at death:\s*(.+)/);
    if (ageDeathMatch) {
      ageAtDeath = ageDeathMatch[1].trim();
    }
  }
  xml += '<age_at_death value="' + InvitaeConverter._escapeXml(ageAtDeath) + '"/>';

  xml += '<medications value=""/>';
  xml += '<allergies value=""/>';
  xml += '<fertilization value="0"/>';

  // Fetus
  xml += '<fetus value="' + (props.lifeStatus === 'unborn' ? '1' : '0') + '"/>';

  // Multiple (person groups)
  var numPersons = props.numPersons || 0;
  if (numPersons > 1) {
    xml += '<multiple value="1">' + numPersons + '</multiple>';
  } else {
    xml += '<multiple value="0">0</multiple>';
  }

  xml += '<attrib_data/>';

  // Genetic tests (Progeny order: right after attrib_data)
  var tests = normalizeTests(props.geneticTests);
  if (tests.length > 0) {
    xml += '<condition_tests>';
    for (var t = 0; t < tests.length; t++) {
      var test = tests[t];
      var attr = function(name, value) {
        return ' ' + name + '="' + InvitaeConverter._escapeXml(value || '') + '"';
      };
      xml += '<test' + attr('name', test.invitaeName || test.gene.toLowerCase()) + attr('value', toInvitaeValue(test)) +
        attr('title', test.gene) + attr('company', test.lab);
      // details Progeny does not define: written only when filled in, read back by this editor
      if (test.variant) xml += attr('variant', test.variant);
      if (test.protein) xml += attr('protein', test.protein);
      if (test.zygosity) xml += attr('zygosity', test.zygosity);
      if (test.testType) xml += attr('testType', test.testType);
      if (needsClassificationAttribute(test)) xml += attr('classification', test.classification);
      if (test.date) xml += attr('date', test.date);
      if (test.comment && privacySetting !== 'minimal') xml += attr('comment', test.comment);
      xml += '/>';
    }
    xml += '</condition_tests>';
  }

  // Siblings — compute from graph (share same parent relationship)
  var siblings = InvitaeConverter._findSiblings(nodeId, pedigree);
  if (siblings.length > 0) {
    xml += '<siblings>';
    for (var s = 0; s < siblings.length; s++) {
      var sibId = siblings[s];
      if (idToInvitaeId[sibId] !== undefined) {
        var sibType = "0";
        if (props.twinGroup !== undefined && pedigree.GG.properties[sibId] && props.twinGroup === pedigree.GG.properties[sibId].twinGroup) {
          sibType = props.monozygotic ? "2" : "1";
        }
        xml += '<sibling id="' + idToInvitaeId[sibId] + '" type="' + sibType + '"/>';
      }
    }
    xml += '</siblings>';
  }

  // Conditions (disorders)
  if (props.disorders && props.disorders.length > 0) {
    var allDetails = normalizeDetails(props.disorderDetails);
    xml += '<conditions>';
    for (var d = 0; d < props.disorders.length; d++) {
      var disorderName = InvitaeConverter._resolveOntologyName(props.disorders[d], 'disorder');
      var detail = allDetails[props.disorders[d]] || allDetails[disorderName] || null;
      var condStatus = 'affected';
      if (props.carrierStatus === 'carrier') {
        condStatus = 'carrier';
      }
      if (detail && detail.status) {
        condStatus = detail.status;
      }
      var condNote = (detail && privacySetting !== 'minimal') ? detail.note : '';
      var condColor = InvitaeConverter._getDisorderColorIndex(props.disorders[d], disorderName, disorderIndexMap || {});
      // keep Progeny's own code and short title (e.g. code="Invitae80") when the condition came from it
      xml += '<condition code="' + InvitaeConverter._escapeXml((detail && detail.code) || disorderName) + '"';
      xml += ' title="' + InvitaeConverter._escapeXml(disorderName) + '"';
      xml += ' shortenTitle="' + InvitaeConverter._escapeXml((detail && detail.shortTitle) || disorderName) + '"';
      xml += ' type="' + InvitaeConverter._escapeXml(detail ? detail.type : '') + '"';
      xml += ' onset="' + InvitaeConverter._escapeXml(detail ? toInvitaeAge(detail.onset) : '') + '"';
      xml += ' atdiag="' + InvitaeConverter._escapeXml(detail ? toInvitaeAge(detail.atdiag) : '') + '"';
      xml += ' note="" color="' + condColor + '" visible="1" ontology="All"';
      xml += ' status="' + InvitaeConverter._escapeXml(condStatus) + '">';
      xml += '<note value="' + InvitaeConverter._escapeXml(condNote) + '"/>';
      if (detail) {
        detail.fields.forEach(function(f) {
          xml += '<field value="' + InvitaeConverter._escapeXml(f.value) + '" name="' + InvitaeConverter._escapeXml(f.name) + '"/>';
        });
      }
      xml += '</condition>';
    }
    xml += '</conditions>';
  }

  // Elements kept verbatim from an imported file (Progeny order: after conditions)
  var extra = props.invitaeExtra || {};
  if (extra.surgical_removals) {
    xml += extra.surgical_removals;
  }

  // Notes (HPO terms as phenotype notes + approximate DOB note)
  var hasHpoNotes = props.hpoTerms && props.hpoTerms.length > 0;
  var hasDobApproxNote = !!props.dobApprox;
  var hasEthnicityNote = !!props.ashkenazi;
  if (hasHpoNotes || hasDobApproxNote || hasEthnicityNote) {
    xml += '<notes>';
    if (hasEthnicityNote) {
      // same shape as Progeny's own ethnicity note
      xml += '<note id="1" note_id="1" value="Ashkenazi Jewish" string_type="composite" string_title="Ethnicity" string_value="Ashkenazi Jewish"/>';
    }
    var noteIdx = 12;
    if (hasHpoNotes) {
      for (var h = 0; h < props.hpoTerms.length; h++) {
        var hpoName = InvitaeConverter._resolveOntologyName(props.hpoTerms[h], 'hpo');
        xml += '<note id="' + noteIdx + '" note_id="' + noteIdx + '"';
        xml += ' value="' + InvitaeConverter._escapeXml(hpoName) + '"';
        xml += ' string_type="composite" string_title="Phenotype"';
        xml += ' string_value="' + InvitaeConverter._escapeXml(hpoName) + '"/>';
        noteIdx++;
      }
    }
    if (hasDobApproxNote) {
      xml += '<note id="' + noteIdx + '" note_id="' + noteIdx + '"';
      xml += ' value="approximate DOB" string_type="multiline" string_title="Note"';
      xml += ' string_value="approximate DOB"/>';
    }
    xml += '</notes>';
  }

  xml += extra.gail_properties || '<gail_properties/>';

  xml += '</indi>';

  return xml;
};

/**
 * Finds siblings for a given node (nodes sharing the same parent relationship).
 * @private
 */
InvitaeConverter._findSiblings = function (nodeId, pedigree) {
  var siblings = [];
  var parentRel = pedigree.GG.getProducingRelationship(nodeId);
  if (parentRel === null || parentRel === undefined) {
    return siblings;
  }
  var childhub = pedigree.GG.getRelationshipChildhub(parentRel);
  if (childhub === null || childhub === undefined) {
    return siblings;
  }
  var children = pedigree.GG.getOutEdges(childhub);
  if (children) {
    for (var i = 0; i < children.length; i++) {
      if (children[i] !== nodeId && pedigree.GG.isPerson(children[i])) {
        if (pedigree.GG.properties[children[i]] && (pedigree.GG.properties[children[i]].isVirtualDummyChild || pedigree.GG.properties[children[i]].isPlaceholder)) {
          continue;
        }
        siblings.push(children[i]);
      }
    }
  }
  return siblings;
};

/**
 * Escapes special characters for XML attribute values.
 * @private
 */
InvitaeConverter._escapeXml = function (str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Formats a Date as MM/DD/YYYY HH:MM:SS.
 * @private
 */
InvitaeConverter._formatDate = function (d) {
  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + d.getFullYear()
    + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
};

/**
 * Generates a simple GUID string.
 * @private
 */
InvitaeConverter._generateGUID = function () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
};

export default InvitaeConverter;
