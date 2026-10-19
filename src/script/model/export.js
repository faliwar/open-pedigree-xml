import PDFDocument from 'vendor/pdfkit/pdfkit.standalone';
import SVGtoPDF from 'vendor/pdfkit/svg-to-pdfkit';
import blobStream from 'vendor/pdfkit/blob-stream';
import GA4GHFHIRConverter from 'pedigree/GA4GHFHIRConverter';
import InvitaeConverter from 'pedigree/InvitaeConverter';
import { romanize } from 'pedigree/model/helpers';
import PedigreeEditorParameters from 'pedigree/pedigreeEditorParameters';

var PedigreeExport = function () {
};

PedigreeExport.prototype = {
};

//===============================================================================================

/*
 *  PED format:
 *  (from http://pngu.mgh.harvard.edu/~purcell/plink/data.shtml#ped)
 *   Family ID
 *   Individual ID
 *   Paternal ID
 *   Maternal ID
 *   Sex (1=male; 2=female; other=unknown)
 *   Phenotype
 *
 *   Phenotype, by default, should be coded as:
 *      -9 missing
 *       0 missing
 *       1 unaffected
 *       2 affected
 */
PedigreeExport.exportAsPED = function(pedigree, idGenerationPreference) {
  var output = '';

  var familyID = 'OPENPED';

  var idToPedId = PedigreeExport.createNewIDs(pedigree, idGenerationPreference);

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }

    output += familyID + ' ' + idToPedId[i] + ' ';

    // mother & father
    var parents = pedigree.GG.getParents(i);
    if (parents.length > 0) {
      var father = parents[0];
      var mother = parents.length > 1 ? parents[1] : null;

      if (parents.length > 1 &&
          ( pedigree.GG.properties[parents[0]]['gender'] == 'F' ||
                pedigree.GG.properties[parents[1]]['gender'] == 'M' )) {
        father = parents[1];
        mother = parents[0];
      } else if (parents.length == 1) {
        // single-parent: assign based on gender
        if (pedigree.GG.properties[parents[0]]['gender'] == 'F') {
          mother = parents[0];
          father = null;
        } else {
          father = parents[0];
          mother = null;
        }
      }
      output += (father !== null ? idToPedId[father] : '0') + ' ' + (mother !== null ? idToPedId[mother] : '0') + ' ';
    } else {
      output += '0 0 ';
    }

    var sex = 3;
    if (pedigree.GG.properties[i]['gender'] == 'M') {
      sex = 1;
    } else if (pedigree.GG.properties[i]['gender'] == 'F') {
      sex = 2;
    }
    output += (sex + ' ');

    var status = -9; //missing
    if (pedigree.GG.properties[i].hasOwnProperty('carrierStatus')) {
      if (pedigree.GG.properties[i]['carrierStatus'] == 'affected' ||
               pedigree.GG.properties[i]['carrierStatus'] == 'carrier'  ||
               pedigree.GG.properties[i]['carrierStatus'] == 'presymptomatic') {
        status = 2;
      } else {
        status = 1;
      }
    }
    output += status + '\n';
  }

  return output;
};

/* ===============================================================================================
 *
 * Creates and returns a JSON in the "GA4GH FHIR JSON" format
 *
 * ===============================================================================================
 */

PedigreeExport.exportAsGA4GH = function(pedigree, privacySetting = "all", fhirPatientReference = null,
  pedigreeImage = null){
  return GA4GHFHIRConverter.exportAsFHIR(pedigree, privacySetting, fhirPatientReference, pedigreeImage);
};

PedigreeExport.exportAsInvitae = function(pedigree, privacySetting = 'all'){
  return InvitaeConverter.exportAsInvitaeXML(pedigree, privacySetting);
};

// ===============================================================================================

PedigreeExport.exportAsSVG = function(pedigree, privacySetting = 'all') {
  var image = $('canvas');
  var background = image.getElementsByClassName('panning-background')[0];
  var backgroundPosition = background ? background.nextSibling : null;
  var backgroundParent = background ? background.parentNode : null;
  if (backgroundParent && background) {
    backgroundParent.removeChild(background);
  }

  var svgElement = image.down();
  var bbox;
  try {
    bbox = svgElement.getBBox();
  } catch (e) {
    bbox = { x: 0, y: 0, width: svgElement.clientWidth || 1200, height: svgElement.clientHeight || 900 };
  }
  var bWidth = (bbox && bbox.width > 0) ? bbox.width : (svgElement.clientWidth || 1200);
  var bHeight = (bbox && bbox.height > 0) ? bbox.height : (svgElement.clientHeight || 900);
  var bX = (bbox && typeof bbox.x === 'number') ? bbox.x : 0;
  var bY = (bbox && typeof bbox.y === 'number') ? bbox.y : 0;

  var pedigreeImage = image.innerHTML
    .replace(/&nbsp;/g, '&#160;')
    .replace(/xmlns:xlink=".*?"/, '')
    .replace(/width=".*?"/, '')
    .replace(/height=".*?"/, '');

  if (/viewBox=".*?"/.test(pedigreeImage)) {
    pedigreeImage = pedigreeImage.replace(/viewBox=".*?"/, 'viewBox="' + bX + ' ' + bY + ' ' + bWidth + ' ' + bHeight + '" width="' + bWidth + '" height="' + bHeight + '" xmlns:xlink="http://www.w3.org/1999/xlink"');
  } else {
    pedigreeImage = pedigreeImage.replace(/<svg/i, '<svg viewBox="' + bX + ' ' + bY + ' ' + bWidth + ' ' + bHeight + '" width="' + bWidth + '" height="' + bHeight + '" xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  var context = window.location.href.replace(/&/g, '&amp;');
  pedigreeImage = pedigreeImage.split(context).join('');

  if (backgroundParent && background) {
    backgroundParent.insertBefore(background, backgroundPosition);
  }

  const parser = new DOMParser();
  let dom = parser.parseFromString(pedigreeImage, 'image/svg+xml');
  if (dom.getElementsByTagName('parsererror').length > 0) {
    console.warn('SVG XML parsing issue:', dom.getElementsByTagName('parsererror')[0].textContent);
    var htmlDoc = parser.parseFromString(pedigreeImage, 'text/html');
    var svgEl = htmlDoc.querySelector('svg');
    if (svgEl) {
      dom = parser.parseFromString(new XMLSerializer().serializeToString(svgEl), 'image/svg+xml');
    }
  }

  function removeHiddenNodes(domNode) {
    let toRemove = [];
    for (let childNode of domNode.childNodes) {
      if (childNode.style && 'none' === childNode.style.display){
        toRemove.push(childNode);
      }
      else if (childNode.style && '0' == childNode.style.opacity && '0' == childNode.style.fillOpacity){
        toRemove.push(childNode);
      }
      else {
        removeHiddenNodes(childNode);
      }
    }
    for (let childNode of toRemove){
      domNode.removeChild(childNode);
    }
  }
  function removeText(dom, fontSize) {
    let toRemove = [];
    for (let textNode of dom.getElementsByTagName('text')){
      if (textNode.style.fontSize === fontSize){
        toRemove.push(textNode);
      }
    }
    for (let childNode of toRemove){
      childNode.parentNode.removeChild(childNode);
    }
  }

  removeHiddenNodes(dom.getRootNode());
  if (privacySetting !== 'all' ){
    removeText(dom, '20px');
  }
  if (privacySetting === 'minimal'){
    removeText(dom, '19px');
  }

  const serializer = new XMLSerializer();
  return serializer.serializeToString(dom);
};



/*
 * Processes the SVG for PDFKit rendering:
 * 1. Replaces Unicode category indicators with PDF-safe single-byte WinAnsi glyphs.
 * 2. If showNumbers is true, clusters real individuals by vertical level into generations (I, II, III...)
 *    and numbers individuals (1, 2, 3...) sequentially from left to right within each generation.
 */
PedigreeExport._processPdfSvg = function(svgString, showNumbers) {
  if (!svgString) return svgString;

  var parser = new DOMParser();
  var dom = parser.parseFromString(svgString, 'image/svg+xml');
  if (dom.getElementsByTagName('parsererror').length > 0) {
    console.warn('SVG parse error in _processPdfSvg');
    return svgString;
  }

  var svgEl = dom.documentElement;

  // 1. Map Unicode category indicators to PDF-safe single-byte WinAnsi glyphs
  var textNodes = dom.querySelectorAll('text, tspan');
  for (var i = 0; i < textNodes.length; i++) {
    var node = textNodes[i];
    if (node.childNodes && node.childNodes.length > 0) {
      for (var c = 0; c < node.childNodes.length; c++) {
        var child = node.childNodes[c];
        if (child.nodeType === 3 /* TEXT_NODE */ && child.nodeValue) {
          child.nodeValue = child.nodeValue
            .replace(/\uD83D\uDDCE\uFE0E|\uD83D\uDDCE/g, '\u00B6 ') // comment -> pilcrow
            .replace(/\u2B22/g, '\u2022')                          // diagnosis -> bullet
            .replace(/\u25C8/g, '\u00A4')                          // phenotype -> currency / diamond
            .replace(/\u29D3/g, '\u2021');                         // gene -> double dagger
        }
      }
    }
  }

  // 2. Generation & Individual Numbering
  if (showNumbers && typeof editor !== 'undefined' && editor && editor.getGraph && editor.getNode) {
    try {
      var graph = editor.getGraph();
      var radius = (PedigreeEditorParameters.attributes && PedigreeEditorParameters.attributes.radius) || 40;
      var persons = [];

      var maxId = (graph.DG && graph.DG.GG) ? graph.DG.GG.getMaxRealVertexId() : (graph.getMaxNodeId ? graph.getMaxNodeId() : 0);
      for (var id = 0; id <= maxId; id++) {
        if (!graph.isPerson(id) || graph.isPlaceholder(id) || graph.isVirtualDummyChild(id) || graph.isVirtualParent(id)) {
          continue;
        }
        var personNode = editor.getNode(id);
        if (!personNode || (personNode.isVirtual && personNode.isVirtual())) {
          continue;
        }
        persons.push({
          id: id,
          x: personNode.getX(),
          y: personNode.getY()
        });
      }

      if (persons.length > 0) {
        // Cluster into generation tiers based on Y coordinate (within 50px of each other)
        persons.sort(function(a, b) { return a.y - b.y; });
        var tiers = [];
        for (var pIdx = 0; pIdx < persons.length; pIdx++) {
          var p = persons[pIdx];
          var matchedTier = null;
          for (var t = 0; t < tiers.length; t++) {
            if (Math.abs(tiers[t].avgY - p.y) < 50) {
              matchedTier = tiers[t];
              break;
            }
          }
          if (matchedTier) {
            matchedTier.persons.push(p);
            var sumY = 0;
            for (var m = 0; m < matchedTier.persons.length; m++) {
              sumY += matchedTier.persons[m].y;
            }
            matchedTier.avgY = sumY / matchedTier.persons.length;
          } else {
            tiers.push({ avgY: p.y, persons: [p] });
          }
        }

        // Sort tiers from top to bottom
        tiers.sort(function(a, b) { return a.avgY - b.avgY; });

        // Get viewBox
        var vbAttr = svgEl.getAttribute('viewBox') || '';
        var vbParts = vbAttr.split(/\s+/).map(parseFloat);
        var padLeft = 75;
        var padTop = 35;
        var minX = vbParts.length === 4 ? vbParts[0] : 0;
        var minY = vbParts.length === 4 ? vbParts[1] : 0;
        var vbWidth = vbParts.length === 4 ? vbParts[2] : 1200;
        var vbHeight = vbParts.length === 4 ? vbParts[3] : 900;

        // Expand viewBox
        svgEl.setAttribute('viewBox', (minX - padLeft) + ' ' + (minY - padTop) + ' ' + (vbWidth + padLeft) + ' ' + (vbHeight + padTop));
        svgEl.setAttribute('width', String(vbWidth + padLeft));
        svgEl.setAttribute('height', String(vbHeight + padTop));

        var ns = 'http://www.w3.org/2000/svg';

        // Add generation Roman numerals (I, II, III...) on the left margin
        for (var g = 0; g < tiers.length; g++) {
          var tier = tiers[g];
          var romanStr = romanize(g + 1);
          if (romanStr) {
            var genText = dom.createElementNS(ns, 'text');
            genText.setAttribute('x', String(minX - (padLeft / 2)));
            genText.setAttribute('y', String(tier.avgY + 10));
            genText.setAttribute('text-anchor', 'middle');
            genText.setAttribute('font-size', '30');
            genText.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
            genText.setAttribute('font-weight', 'bold');
            genText.setAttribute('fill', '#000000');
            genText.textContent = romanStr;
            svgEl.appendChild(genText);
          }

          // Number individuals 1, 2, 3... from left to right within generation
          tier.persons.sort(function(a, b) { return a.x - b.x; });
          for (var indIdx = 0; indIdx < tier.persons.length; indIdx++) {
            var ind = tier.persons[indIdx];
            var numText = dom.createElementNS(ns, 'text');
            // Position above and to the left of the individual symbol
            numText.setAttribute('x', String(ind.x - radius - 2));
            numText.setAttribute('y', String(ind.y - radius - 5));
            numText.setAttribute('text-anchor', 'end');
            numText.setAttribute('font-size', '20');
            numText.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
            numText.setAttribute('font-weight', 'bold');
            numText.setAttribute('fill', '#000000');
            numText.textContent = String(indIdx + 1);
            svgEl.appendChild(numText);
          }
        }
      }
    } catch (e) {
      console.warn('Error computing generation/individual numbering for PDF:', e);
    }
  }

  return new XMLSerializer().serializeToString(dom);
};

PedigreeExport.exportAsPDF = function(pedigree, privacySetting = 'all', pageSize = 'A4', layout = 'landscape', legendPos = 'TopRight', embedXML = false, showNumbers = false){
  var pedigreeImage = PedigreeExport.exportAsSVG(pedigree, privacySetting);
  pedigreeImage = PedigreeExport._processPdfSvg(pedigreeImage, showNumbers);

  let legend = [];
  let itemCount = 0;
  let container = document.getElementById('legend-container');
  let rgbRegex = /^rgb\(([0-9]+),\s*([0-9]+),\s*([0-9]+)\)$/;

  if (container) {
    for (let c of container.childNodes) {
      if (c.tagName !== 'DIV') continue;
      if (c.style && c.style.display === 'none') continue;

      let h2Array = c.getElementsByTagName('H2');
      let legendSection = {
        heading: '',
        items: []
      };

      if (h2Array && h2Array.length > 0 && h2Array[0].textContent) {
        legendSection.heading = h2Array[0].textContent.trim();
      }

      for (let li of c.getElementsByTagName('li')) {
        let colour = '#CCCCCC';
        let colourArray = li.getElementsByClassName('disorder-color');
        if (colourArray && colourArray.length > 0 && colourArray[0].style) {
          let bg = colourArray[0].style.backgroundColor || '';
          if (bg.startsWith('#')) {
            colour = bg;
          } else if (bg.startsWith('rgb(')) {
            let colourSplit = rgbRegex.exec(bg);
            if (colourSplit != null) {
              colour = '#' + parseInt(colourSplit[1]).toString(16).padStart(2, '0') +
                             parseInt(colourSplit[2]).toString(16).padStart(2, '0') +
                             parseInt(colourSplit[3]).toString(16).padStart(2, '0');
            }
          }
        }

        let name = '';
        let nameArray = li.getElementsByClassName('disorder-name');
        if (nameArray && nameArray.length > 0 && nameArray[0].textContent) {
          name = nameArray[0].textContent.trim();
        }

        let cases = '';
        let casesArray = li.getElementsByClassName('disorder-cases');
        if (casesArray && casesArray.length > 0 && casesArray[0].textContent) {
          cases = casesArray[0].textContent.replace(/\u00A0/g, ' ').trim();
        }

        legendSection.items.push({ colour: colour || '#CCCCCC', name: name, cases: cases });
        itemCount++;
      }

      if (legendSection.items.length > 0 || legendSection.heading) {
        legend.push(legendSection);
      }
    }
  }

  let compress = false;
  // Margins 0 prevents PDFKit from adding accidental extra pages when elements are near margins
  let doc = new PDFDocument({ compress: compress, size: pageSize, layout: layout, margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  let stream = doc.pipe(blobStream());
  stream.on('finish', function () {
    let blob = stream.toBlob('application/pdf');
    if (embedXML && typeof PedigreeExport.exportAsInvitae === 'function') {
      let xml = PedigreeExport.exportAsInvitae(pedigree, privacySetting);
      let finalBlob = new Blob([blob, "\n% PedigreeXML: ", btoa(unescape(encodeURIComponent(xml)))], { type: 'application/pdf' });
      saveAs(finalBlob, 'open-pedigree.pdf');
    } else {
      saveAs(blob, 'open-pedigree.pdf');
    }
  });

  let headingCount = legend.length;

  // calculate max width for legend text
  let maxWidth = 0;
  doc.save();
  for (let cat of legend) {
    doc.fontSize(14);
    const hw = cat.heading ? doc.widthOfString(cat.heading) : 0;
    if (hw > maxWidth) maxWidth = hw;
    for (let item of cat.items) {
      doc.fontSize(10);
      const textStr = (item.name || '') + (item.cases ? ' (' + item.cases + ')' : '');
      const w = doc.widthOfString(textStr);
      if (w > maxWidth) maxWidth = w;
    }
  }
  doc.restore();

  let lineOffset = 14;
  let catOffset = 2;
  let legendHeight = (lineOffset * (headingCount + itemCount)) + (headingCount * catOffset) + 10;
  let xOffset = 5;
  let yOffset = doc.page.height - legendHeight;
  let pedigreeXOffset = 5;
  let pedigreeYOffset = legendHeight;
  let pedigreeWidth = doc.page.width - 10;
  let pedigreeHeight = Math.max(doc.page.height - legendHeight, doc.page.height * 0.6);

  if (legendPos === 'TopLeft') {
    xOffset = 5;
    yOffset = 5;
    pedigreeYOffset = legendHeight;
  } else if (legendPos === 'BottomLeft') {
    xOffset = 5;
    yOffset = doc.page.height - legendHeight;
    pedigreeYOffset = 5;
  } else if (legendPos === 'BottomRight') {
    xOffset = doc.page.width - (20 + maxWidth);
    yOffset = doc.page.height - legendHeight;
    pedigreeYOffset = 5;
  } else {
    // TopRight default
    xOffset = doc.page.width - (20 + maxWidth);
    yOffset = 5;
    pedigreeYOffset = legendHeight;
  }

  // 1. Draw Pedigree SVG first
  let options = {
    warningCallback: (str) => console.warn('SVGtoPDF warning:', str),
    useCSS: false,
    assumePt: false,
    preserveAspectRatio: 'xMidYMid meet',
    height: pedigreeHeight,
    width: pedigreeWidth
  };

  try {
    SVGtoPDF(doc, pedigreeImage, pedigreeXOffset, pedigreeYOffset, options);
  } catch (err) {
    console.error('Error drawing SVG into PDF:', err);
  }

  // 2. Draw Legend
  for (let cat of legend) {
    doc.save();
    doc.fontSize(14);
    if (cat.heading) {
      doc.text(cat.heading, xOffset, yOffset, { lineBreak: false });
      yOffset += lineOffset;
    }
    for (let item of cat.items) {
      doc.save();
      doc.rect(xOffset, yOffset, 8, 8).fill(item.colour || '#CCCCCC', 1);
      doc.restore();
      doc.fontSize(10);
      const textStr = (item.name || '') + (item.cases ? ' (' + item.cases + ')' : '');
      doc.text(textStr, xOffset + 10, yOffset, { lineBreak: false });
      yOffset += lineOffset;
    }
    yOffset += catOffset;
    doc.restore();
  }

  // 3. Top-left embed notice
  if (embedXML) {
    doc.save();
    doc.fontSize(6);
    doc.fillColor('#888888');
    doc.text('To edit: upload PDF to Open Pedigree X.', 10, 10, { lineBreak: false });
    doc.restore();
  }

  // 4. Date of last update (export time), centered at bottom of single page
  {
    let now = new Date();
    let pad = (n) => String(n).padStart(2, '0');
    let stamp = 'Last updated: ' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
    doc.save();
    doc.fontSize(7);
    doc.fillColor('#666666');
    doc.text(stamp, 0, doc.page.height - 14, { width: doc.page.width, align: 'center', lineBreak: false });
    doc.restore();
  }

  doc.end();
  return doc;
};


// ===============================================================================================

// TODO: convert internal properties to match public names and rename this to "supportedProperties"
PedigreeExport.internalToJSONPropertyMapping = {
  'proband':       'proband',
  'name':          'name',
  'fName':         'firstName',
  'lName':         'lastName',
  'comments':      'comments',
  'twinGroup':     'twinGroup',
  'monozygotic':   'monozygotic',
  'isAdopted':     'adoptedIn',
  'evaluated':     'evaluated',
  'dob':           'birthDate',
  'dod':           'deathDate',
  'gestationAge':  'gestationAge',
  'lifeStatus':    'lifeStatus',
  'disorders':     'disorders',
  'ethnicities':   'ethnicities',
  'carrierStatus': 'carrierStatus',
  'externalID':    'externalId',
  'gender':        'sex',
  'numPersons':    'numPersons',
  'hpoTerms':      'hpoTerms',
  'candidateGenes':'candidateGenes',
  'lostContact':   'lostContact',
  'dobApprox':     'birthDateApprox',
  'ageInput':      'ageInput'
};

/*
 * Converts property name from external JSON format to internal - also helps to
 * support aliases for some terms and weed out unsupported terms.
 */
PedigreeExport.convertProperty = function(internalPropertyName, value) {

  if (!PedigreeExport.internalToJSONPropertyMapping.hasOwnProperty(internalPropertyName)) {
    return null;
  }

  var externalPropertyName = PedigreeExport.internalToJSONPropertyMapping[internalPropertyName];

  if (externalPropertyName == 'sex') {
    if (value == 'M') {
      value = 'male';
    } else if (value == 'F') {
      value = 'female';
    } else {
      value = 'unknown';
    }
  }

  return {'propertyName': externalPropertyName, 'value': value };
};

PedigreeExport.createNewIDs = function(pedigree, idGenerationPreference, maxLength) {
  var idToNewId = {};
  var usedIDs   = {};

  var nextUnusedID = 1;

  for (var i = 0; i <= pedigree.GG.getMaxRealVertexId(); i++) {
    if (!pedigree.GG.isPerson(i)) {
      continue;
    }

    var id = nextUnusedID++;
    if (idGenerationPreference == 'external' && pedigree.GG.properties[i].hasOwnProperty('externalID')) {
      nextUnusedID--;
      id = pedigree.GG.properties[i]['externalID'].replace(/\s/g, '_');
    } else if (idGenerationPreference == 'name' && (pedigree.GG.properties[i].hasOwnProperty('name') || pedigree.GG.properties[i].hasOwnProperty('fName'))) {
      nextUnusedID--;
      var nameVal = pedigree.GG.properties[i]['name'] || pedigree.GG.properties[i]['fName'];
      id = nameVal.replace(/\s/g, '_');
    }
    if (maxLength && id.length > maxLength) {
      id = id.substring(0, maxLength);
    }
    while ( usedIDs.hasOwnProperty(id) ) {
      if (!maxLength || id.length < maxLength) {
        id = '_' + id;
      } else {
        id = nextUnusedID++;
      }
    }

    idToNewId[i] = id;
    usedIDs[id]  = true;
  }

  return idToNewId;
};

export default PedigreeExport;
