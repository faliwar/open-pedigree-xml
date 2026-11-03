/**
 * Pedigree data embedded in exported PDFs.
 *
 * Current exports attach the pedigree XML as a standard embedded file (/EmbeddedFiles, as used
 * by PDF/A-3 associated files), named PEDIGREE_FILE_NAME, which survives most PDF tools.
 * Older exports appended it as a base64 comment line ("% PedigreeXML: ..."), which is still read.
 */

var PEDIGREE_FILE_NAME = 'open-pedigree.xml';
var LEGACY_PATTERN = /%\s*PedigreeXML:\s*([A-Za-z0-9+/=]+)/;

var utf8Decode = function(bytes) {
  return new TextDecoder('utf-8').decode(bytes);
};

var latin1 = function(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  }
  return out;
};

var looksLikePedigreeXml = function(text) {
  return typeof text === 'string' && /<tree[\s>]/.test(text);
};

var inflate = function(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    return Promise.reject(new Error('Compressed embedded file and no DecompressionStream support'));
  }
  var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  return new Response(stream).arrayBuffer().then(function(buf) { return new Uint8Array(buf); });
};

/**
 * Embedded-file streams of a PDF: [{ dict, data: Uint8Array }]
 */
var embeddedFileStreams = function(bytes) {
  var text = latin1(bytes);
  var result = [];
  var objRe = /\d+\s+\d+\s+obj\b([\s\S]*?)stream\r?\n/g;
  var m;
  while ((m = objRe.exec(text)) !== null) {
    var dict = m[1];
    var start = objRe.lastIndex;
    var end = text.indexOf('endstream', start);
    if (end < 0) break;
    objRe.lastIndex = end;
    if (!/\/Type\s*\/EmbeddedFile\b/.test(dict)) continue;
    var stop = end;
    if (text.charAt(stop - 1) === '\n') stop--;
    if (text.charAt(stop - 1) === '\r') stop--;
    result.push({ dict: dict, data: bytes.subarray(start, stop) });
  }
  return result;
};

/**
 * Extracts the pedigree XML from the bytes of a PDF.
 * @param {ArrayBuffer|Uint8Array} buffer
 * @return {Promise<string|null>} the XML, or null when the PDF carries no pedigree data
 */
var extractPedigreeXmlFromPdf = function(buffer) {
  var bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  var streams = embeddedFileStreams(bytes);
  var tryNext = function(i) {
    if (i >= streams.length) {
      var legacy = LEGACY_PATTERN.exec(latin1(bytes));
      if (!legacy) return Promise.resolve(null);
      try {
        var bin = atob(legacy[1]);
        var raw = new Uint8Array(bin.length);
        for (var k = 0; k < bin.length; k++) raw[k] = bin.charCodeAt(k);
        var xml = utf8Decode(raw);
        return Promise.resolve(looksLikePedigreeXml(xml) ? xml : null);
      } catch (e) {
        return Promise.resolve(null);
      }
    }
    var s = streams[i];
    var data = /\/FlateDecode\b/.test(s.dict) ? inflate(s.data) : Promise.resolve(s.data);
    return data.then(function(d) {
      var xml = utf8Decode(d);
      return looksLikePedigreeXml(xml) ? xml : tryNext(i + 1);
    }, function() { return tryNext(i + 1); });
  };
  return tryNext(0);
};

/** Base64 of the UTF-8 bytes of a string (for embedding) */
var toBase64Utf8 = function(text) {
  return btoa(unescape(encodeURIComponent(text)));
};

export { PEDIGREE_FILE_NAME, extractPedigreeXmlFromPdf, toBase64Utf8 };
