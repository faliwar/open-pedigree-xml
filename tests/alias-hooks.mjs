// Module resolution hook: 'pedigree/model/x' -> <repo>/src/script/model/x.js (as in webpack.config.js)
const ROOT = new URL('../src/script/', import.meta.url);

const RAPHAEL_STUB = 'data:text/javascript,' + encodeURIComponent(`
  function FakeSet() { this.items = []; }
  FakeSet.prototype.forEach = function(fn) { this.items.forEach(fn); };
  FakeSet.prototype.push = function(el) { this.items.push(el); return this; };
  const Raphael = {
    st: FakeSet.prototype,
    el: {},
    getColor: () => '#336699',
    pathBBox: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    transformPath: (p) => p,
    animation: (attrs) => attrs
  };
  export default Raphael;
`);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'raphael') {
    return { url: RAPHAEL_STUB, shortCircuit: true };
  }
  if (specifier.startsWith('pedigree/')) {
    let path = specifier.slice('pedigree/'.length);
    if (!/\.m?js$/.test(path)) path += '.js';
    return nextResolve(new URL(path, ROOT).href, context);
  }
  return nextResolve(specifier, context);
}
