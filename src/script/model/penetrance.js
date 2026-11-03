/**
 * Age-specific cumulative penetrance curves for the cascade-risk engine.
 *
 * A curve is written as "age:% age:% ...", for example "30:3 40:10 50:25 70:55 80:65" (a decimal
 * comma is accepted: "60:30,5"), giving
 * the cumulative chance (%) that a carrier is affected by each age. Points are sorted by age,
 * the curve is 0 at age 0, linear between points and flat after the last one.
 */

/**
 * @return {Array|null} [[age, percent], ...] sorted by age, or null when the text has no valid point
 */
var parsePenetranceCurve = function(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  var points = [];
  // points are separated by spaces or semicolons; a comma is a decimal mark unless it ends a point
  text.split(/[\s;]+/).forEach(function(part) {
    var m = /^(\d+(?:[.,]\d+)?)[:=](\d+(?:[.,]\d+)?)%?,?$/.exec(part.trim());
    if (!m) return;
    var age = parseFloat(m[1].replace(',', '.'));
    var pct = parseFloat(m[2].replace(',', '.'));
    if (isFinite(age) && isFinite(pct) && age >= 0 && pct >= 0 && pct <= 100) points.push([age, pct]);
  });
  if (!points.length) return null;
  points.sort(function(a, b) { return a[0] - b[0]; });
  // cumulative: never decreasing
  for (var i = 1; i < points.length; i++) {
    if (points[i][1] < points[i - 1][1]) points[i][1] = points[i - 1][1];
  }
  return points[points.length - 1][1] > 0 ? points : null;
};

/** Cumulative penetrance (%) at an age */
var curveValue = function(curve, age) {
  if (age <= 0) return 0;
  var prevAge = 0, prevPct = 0;
  for (var i = 0; i < curve.length; i++) {
    var a = curve[i][0], p = curve[i][1];
    if (age <= a) {
      return a === prevAge ? p : prevPct + (p - prevPct) * (age - prevAge) / (a - prevAge);
    }
    prevAge = a;
    prevPct = p;
  }
  return prevPct;
};

/**
 * Share of eventual cases already affected at this age (0 to 1): the curve value divided by its
 * final value. The lifetime penetrance itself is set separately in the model.
 */
var curveFraction = function(curve, age) {
  var last = curve[curve.length - 1][1];
  return last > 0 ? Math.max(0, Math.min(1, curveValue(curve, age) / last)) : 1;
};

export { parsePenetranceCurve, curveValue, curveFraction };
