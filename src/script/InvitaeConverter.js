import BaseGraph from 'pedigree/model/baseGraph';
import RelationshipTracker from 'pedigree/model/relationshipTracker';

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

// ===========================================================================================
//  IMPORT: Invitae/Progeny XML → BaseGraph
// ===========================================================================================

/**
 * Parses Invitae/Progeny XML text and creates a BaseGraph.
 *
 * @param {String} inputText  The raw XML string
 * @returns {BaseGraph}
 */
InvitaeConverter.initFromInvitaeXML = function (inputText) {
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
  var dummyMap = {}; // Tracks childInvitaeId -> statusType (childless/infertile)
  for (var i = 0; i < indiElements.length; i++) {
    var indi = indiElements[i];
    var indiId = indi.getAttribute('id');

    // Identify dummy childless/infertile nodes
    var statusVal = InvitaeConverter._getChildAttr(indi, 'status', 'value');
    var fName = InvitaeConverter._getChildAttr(indi, 'first_name', 'value');
    var lName = InvitaeConverter._getChildAttr(indi, 'last_name', 'value');
    if ((statusVal === '7' || statusVal === '6') && (!fName || fName === 'undefined' || fName === '') && (!lName || lName === 'undefined' || lName === '')) {
      dummyMap[indiId] = (statusVal === '7') ? 'childless' : 'infertile';
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

    // If NO parents exist, we still need to create a family to connect the siblings.
    // Create a single virtual unknown parent.
    if (fatherId === null && motherId === null) {
      var unknownParentId = newG._addVertex(null, BaseGraph.TYPE.PERSON,
        { 'gender': 'U', 'comments': 'unknown' }, newG.defaultPersonNodeWidth);
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
      if (hasRealChildren) {
        // Get or create the childhub for this couple
        chhubId = relationshipTracker.createOrGetChildhub(motherId, fatherId);
        // Set relationship properties (consanguinity, broken/ex)
        relNode = newG.getRelationshipNode(fatherId, motherId);
      } else {
        // Create relationship node WITHOUT a childhub for childless couples
        var existingRel = newG.getRelationshipNode(fatherId, motherId);
        if (existingRel !== null && existingRel !== undefined) {
          relNode = existingRel;
        } else {
          relNode = newG._addVertex( null, BaseGraph.TYPE.RELATIONSHIP, {}, newG.defaultNonPersonNodeWidth );
          newG.addEdge( motherId, relNode, defaultEdgeWeight );
          newG.addEdge( fatherId, relNode, defaultEdgeWeight );
        }
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
  if (fName && fName !== '' && fName !== 'undefined') {
    properties.fName = fName;
  }
  var lName = InvitaeConverter._getChildAttr(indiEl, 'last_name', 'value');
  if (lName && lName !== '' && lName !== 'undefined') {
    properties.lName = lName;
  }

  // External ID (MRN)
  var mrn = indiEl.getAttribute('MRN');
  if (mrn && mrn !== '') {
    properties.externalID = mrn;
  }

  // Life status: 0=alive, 1=deceased, 7=miscarriage/stillborn
  var statusVal = InvitaeConverter._getChildAttr(indiEl, 'status', 'value');
  if (statusVal === '1') {
    properties.lifeStatus = 'deceased';
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

  // Age at death
  var ageAtDeath = InvitaeConverter._getChildAttr(indiEl, 'age_at_death', 'value');
  if (ageAtDeath && ageAtDeath !== '' && ageAtDeath !== 'undefined') {
    // Store as comment since we can't derive exact date
    if (!properties.comments) {
      properties.comments = '';
    }
    properties.comments += (properties.comments ? '\n' : '') + 'Age at death: ' + ageAtDeath;
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
  // Clean up leading newline
  if (properties.comments) {
    properties.comments = properties.comments.replace(/^\n/, '');
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

      if (condStatus === 'affected') {
        if (!properties.disorders) {
          properties.disorders = [];
        }
        properties.disorders.push(condTitle);
        properties.carrierStatus = 'affected';
      } else if (condStatus === 'carrier') {
        properties.carrierStatus = 'carrier';
        // Also track the condition name even for carriers
        if (!properties.disorders) {
          properties.disorders = [];
        }
        properties.disorders.push(condTitle);
      }
      // "unknown" status → no action needed
    }
  }

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
  xml += '<risk_analysis value="0"/>';
  xml += '<risk_analysis_for_family value="0"/>';
  xml += '</settings>';

  // --- Build individual and family data ---
  var idToInvitaeId = {};
  var families = [];

  // Assign Invitae IDs (use the graph node index as the ID)
  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }
    idToInvitaeId[i] = String(i);
  }

  // Build individuals
  var dummyIndis = '';
  var dummyFams = '';
  var nextDummyId = pedigree.GG.getMaxRealVertexId() + 1000;
  var relChildlessMap = {};

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }

    var props = pedigree.GG.properties[i];
    xml += InvitaeConverter._buildIndiElement(i, props, pedigree, privacySetting, idToInvitaeId);
    
    if (props && (props.childlessStatus === 'childless' || props.childlessStatus === 'infertile')) {
      var dId = nextDummyId++;
      var sVal = (props.childlessStatus === 'childless') ? '7' : '6';
      dummyIndis += '<indi id="d' + dId + '" pat="0"><marked_by value="0"/><first_name value=""/><last_name value=""/><gender value="0"/><status value="' + sVal + '"/><comments value="undefined"/><cause value=""/><age value=""/><weight display="undefined" value="undefined"/><height display="undefined" value="undefined"/><carrier value="0"/><adoption value="0"/><adoption_from value="0"/><smoker value="3"/><obese value="0"/><age_at_death value=""/><medications value=""/><allergies value=""/><fertilization value="0"/><fetus value="0"/><multiple value="0">0</multiple><attrib_data/><gail_properties/></indi>';
      var dfId = 'df' + dId;
      var pTag = (props.gender === 'F') ? 'female' : 'male';
      dummyFams += '<fam id="' + dfId + '" ex="0" consanguinity="0" link="0"><' + pTag + ' id="' + idToInvitaeId[i] + '"/><children><child id="d' + dId + '"/></children></fam>';
    }
  }

  // Pre-process relationships to catch any dummy indis we need to declare
  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (pedigree.GG.isRelationship(i)) {
      var relProps = pedigree.GG.properties[i] || {};
      if (relProps.childlessStatus === 'childless' || relProps.childlessStatus === 'infertile') {
        var dId = nextDummyId++;
        var sVal = (relProps.childlessStatus === 'childless') ? '7' : '6';
        dummyIndis += '<indi id="d' + dId + '" pat="0"><marked_by value="0"/><first_name value=""/><last_name value=""/><gender value="0"/><status value="' + sVal + '"/><comments value="undefined"/><cause value=""/><age value=""/><weight display="undefined" value="undefined"/><height display="undefined" value="undefined"/><carrier value="0"/><adoption value="0"/><adoption_from value="0"/><smoker value="3"/><obese value="0"/><age_at_death value=""/><medications value=""/><allergies value=""/><fertilization value="0"/><fetus value="0"/><multiple value="0">0</multiple><attrib_data/><gail_properties/></indi>';
        relChildlessMap[i] = 'd' + dId;
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
    var parents = pedigree.GG.getInEdges(i);
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
      var chhubId = childhub[0];
      var childEdges = pedigree.GG.getOutEdges(chhubId);
      if (childEdges) {
        children = childEdges;
      }
    }

    var consangr = relProps['consangr'];
    var consanguinity = (consangr === 'Y' || consangr === 'A') ? '1' : '0';
    var broken = relProps['broken'] ? '1' : '0';

    // link=1 seems to indicate a secondary link/cross-branch marriage, not twins. Default to 0.
    xml += '<fam id="f' + famIndex + '" ex="' + (relProps.broken ? '1' : '0') + '" consanguinity="' + (relProps.consangr ? '1' : '0') + '" link="0">';

    if (maleId !== null && idToInvitaeId[maleId] !== undefined) {
      xml += '<male id="' + idToInvitaeId[maleId] + '"/>';
    }
    if (femaleId !== null && idToInvitaeId[femaleId] !== undefined) {
      xml += '<female id="' + idToInvitaeId[femaleId] + '"/>';
    }

    if (children.length > 0 || relChildlessMap[i]) {
      xml += '<children>';
      if (relChildlessMap[i]) {
        xml += '<child id="' + relChildlessMap[i] + '"/>';
      }
      for (var c = 0; c < children.length; c++) {
        if (idToInvitaeId[children[c]] !== undefined) {
          xml += '<child id="' + idToInvitaeId[children[c]] + '"/>';
        }
      }
      xml += '</children>';
    }

    xml += '</fam>';
    famIndex++;
  }

  xml += dummyFams;
  xml += '</tree>';
  return xml;
};

/**
 * Builds a single <indi> XML element.
 * @private
 */
InvitaeConverter._buildIndiElement = function (nodeId, props, pedigree, privacySetting, idToInvitaeId) {
  var invitaeId = idToInvitaeId[nodeId];
  var mrn = (privacySetting === 'all' && props.externalID) ? props.externalID : '';

  var xml = '<indi id="' + invitaeId + '" pat="' + (nodeId === 0 ? '1' : '0') + '" MRN="' + InvitaeConverter._escapeXml(mrn) + '">';

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
    xml += '<first_name value="' + InvitaeConverter._escapeXml(props.fName || '') + '"/>';
    xml += '<last_name value="' + InvitaeConverter._escapeXml(props.lName || '') + '"/>';
  } else {
    xml += '<first_name value=""/>';
    xml += '<last_name value=""/>';
  }

  // Gender: M→0, F→1, U→2
  var genderVal = '2';
  if (props.gender === 'M') {
    genderVal = '0';
  } else if (props.gender === 'F') {
    genderVal = '1';
  }
  xml += '<gender value="' + genderVal + '"/>';

  // Status: alive→0, deceased→1, stillborn/miscarriage→7
  var statusVal = '0';
  if (props.lifeStatus === 'deceased') {
    statusVal = '1';
  } else if (props.lifeStatus === 'stillborn' || props.lifeStatus === 'miscarriage') {
    statusVal = '7';
  }
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
  // For approximate DOBs with an age input, export the age string (e.g. "44 yrs")
  var ageStr = '';
  if (privacySetting === 'all') {
    if (props.dobApprox && props.ageInput) {
      ageStr = props.ageInput;
      if (ageStr.match(/^\d+$/)) {
        ageStr += ' yrs';
      }
    } else if (props.dob) {
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

  // Age at death (extract from comments)
  var ageAtDeath = '';
  if (props.comments) {
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
    xml += '<conditions>';
    for (var d = 0; d < props.disorders.length; d++) {
      var disorderName = props.disorders[d];
      var condStatus = 'affected';
      if (props.carrierStatus === 'carrier') {
        condStatus = 'carrier';
      }
      xml += '<condition code="' + InvitaeConverter._escapeXml(disorderName) + '"';
      xml += ' title="' + InvitaeConverter._escapeXml(disorderName) + '"';
      xml += ' shortenTitle="' + InvitaeConverter._escapeXml(disorderName) + '"';
      xml += ' type="" onset="" atdiag="" note="" color="9" visible="1" ontology="All"';
      xml += ' status="' + condStatus + '">';
      xml += '<note value=""/>';
      xml += '</condition>';
    }
    xml += '</conditions>';
  }

  // Notes (HPO terms as phenotype notes + approximate DOB note)
  var hasHpoNotes = props.hpoTerms && props.hpoTerms.length > 0;
  var hasDobApproxNote = !!props.dobApprox;
  if (hasHpoNotes || hasDobApproxNote) {
    xml += '<notes>';
    var noteIdx = 12;
    if (hasHpoNotes) {
      for (var h = 0; h < props.hpoTerms.length; h++) {
        xml += '<note id="' + noteIdx + '" note_id="' + noteIdx + '"';
        xml += ' value="' + InvitaeConverter._escapeXml(props.hpoTerms[h]) + '"';
        xml += ' string_type="composite" string_title="Phenotype"';
        xml += ' string_value="' + InvitaeConverter._escapeXml(props.hpoTerms[h]) + '"/>';
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

  xml += '<gail_properties/>';
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
