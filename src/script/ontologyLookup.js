/*
 * Helper for resolving ontology codes (MONDO, HP) to human-readable labels
 * using the EBI OLS4 service (the same service used by the autocomplete in the node menu).
 *
 * IDs may arrive in several shapes: "MONDO:0008608" (as stored in the XML),
 * "MONDO__0008608" (sanitized in memory), "MONDO 0008608" (desanitized) or "HP_C_0000501".
 */
var OntologyLookup = {};

OntologyLookup._pattern = /^(MONDO|HP)(?:_C_|__|[_:\s])+(\d+)$/i;
OntologyLookup._cache = {};

/*
 * Returns the canonical OBO id (e.g. "MONDO:0008608") if the given id looks like
 * a MONDO or HP code, otherwise null.
 */
OntologyLookup.toOboID = function(id) {
  if (id === null || id === undefined) {
    return null;
  }
  var match = OntologyLookup._pattern.exec(String(id).trim());
  return match ? match[1].toUpperCase() + ':' + match[2] : null;
};

/*
 * Fetches the label for the given ontology id and calls callback(label) on success,
 * or callback(null) on failure. Results are cached.
 */
OntologyLookup.fetchLabel = function(id, callback) {
  var oboID = OntologyLookup.toOboID(id);
  if (!oboID) {
    callback(null);
    return;
  }
  var cache = OntologyLookup._cache;
  if (cache[oboID] && cache[oboID].label) {
    callback(cache[oboID].label);
    return;
  }
  if (!cache[oboID]) {
    var url = 'https://www.ebi.ac.uk/ols4/api/search?exact=true&queryFields=obo_id&rows=1' +
      '&fieldList=obo_id,label&q=' + encodeURIComponent(oboID);
    cache[oboID] = {
      label: null,
      waiting: [],
      promise: fetch(url)
        .then(function(response) { return response.json(); })
        .then(function(data) {
          var docs = (data && data.response && data.response.docs) || [];
          return docs.length > 0 && docs[0].label ? docs[0].label : null;
        })
        .catch(function(err) {
          console.log('[ONTOLOGY LOOKUP] Error: ' + err);
          return null;
        })
    };
  }
  var entry = cache[oboID];
  entry.promise.then(function(label) {
    if (label) {
      entry.label = label;
    } else {
      delete cache[oboID]; // allow retry later
    }
    callback(label);
  });
};

export default OntologyLookup;
