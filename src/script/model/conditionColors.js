/**
 * Condition colours shared by the legend, the colour picker and the Invitae XML converter.
 *
 * Invitae XML stores a condition colour as an index: <condition ... color="1"/>.
 * INVITAE_PALETTE[i] is the colour Invitae shows for index i: its "Choose color" grid,
 * read row by row (2 rows of 5).
 */
var INVITAE_PALETTE = [
  '#C00000', // 0 red
  '#00B050', // 1 green
  '#7F7F7F', // 2 grey
  '#948A54', // 3 olive
  '#00B0F0', // 4 sky blue
  '#FFC000', // 5 gold
  '#7030A0', // 6 purple
  '#31859C', // 7 teal
  '#E46C0A', // 8 orange
  '#366092'  // 9 steel blue
];

/** Order in which new conditions get an automatic colour (red, blue, green, purple, ...) */
var AUTO_ORDER = [0, 9, 1, 6, 8, 7, 5, 4, 3, 2];

var HEX_RE = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;

/** "#abc123" / "abc123" -> "#ABC123"; anything else -> '' */
var normalizeHex = function(value) {
  var m = HEX_RE.exec(String(value || '').trim());
  return m ? ('#' + m[1] + m[2] + m[3]).toUpperCase() : '';
};

/** Invitae index of the palette colour closest to the given colour (-1 if not a colour) */
var closestPaletteIndex = function(hex) {
  var m = HEX_RE.exec(String(hex || ''));
  if (!m) return -1;
  var r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  var best = -1, bestDist = Infinity;
  INVITAE_PALETTE.forEach(function(p, i) {
    var pm = HEX_RE.exec(p);
    var d = Math.pow(r - parseInt(pm[1], 16), 2) + Math.pow(g - parseInt(pm[2], 16), 2) + Math.pow(b - parseInt(pm[3], 16), 2);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
};

export { INVITAE_PALETTE, AUTO_ORDER, normalizeHex, closestPaletteIndex };
