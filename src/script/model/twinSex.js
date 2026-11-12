/**
 * Sex of twins. The symbol shows gender identity and the sex assigned at birth is written under
 * it (Bennett et al. 2022), so monozygotic twins must share the sex, not the symbol: one twin may
 * be a trans woman (circle, AMAB) and the other a man (square).
 */

/** 'M', 'F' or 'U' (unknown or unassigned): the sex assigned at birth when recorded, else the symbol */
var sexOf = function(gender, sexAtBirth) {
  if (sexAtBirth === 'AMAB') return 'M';
  if (sexAtBirth === 'AFAB') return 'F';
  if (sexAtBirth === 'UAAB') return 'U';
  return (gender === 'M' || gender === 'F') ? gender : 'U';
};

/** Sex of a person from its stored properties ({ gender, sexAtBirth }) */
var sexOfProperties = function(props) {
  props = props || {};
  return sexOf(props.gender, props.sexAtBirth);
};

/** True when the sexes can belong to monozygotic twins: no two known sexes differ */
var canShareSex = function(sexes) {
  var known = sexes.filter(function(s) { return s === 'M' || s === 'F'; });
  return known.every(function(s) { return s === known[0]; });
};

/** The known sex shared by these sexes ('M' or 'F'), or null */
var sharedSex = function(sexes) {
  var known = sexes.filter(function(s) { return s === 'M' || s === 'F'; });
  return known.length ? known[0] : null;
};

/** 'AMAB' / 'AFAB' for 'M' / 'F' */
var sexAtBirthFor = function(sex) {
  return sex === 'M' ? 'AMAB' : (sex === 'F' ? 'AFAB' : '');
};

export { sexOf, sexOfProperties, canShareSex, sharedSex, sexAtBirthFor };
