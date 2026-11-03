// Module resolution hook: 'pedigree/model/x' -> <repo>/src/script/model/x.js (as in webpack.config.js)
const ROOT = new URL('../src/script/', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('pedigree/')) {
    let path = specifier.slice('pedigree/'.length);
    if (!/\.m?js$/.test(path)) path += '.js';
    return nextResolve(new URL(path, ROOT).href, context);
  }
  return nextResolve(specifier, context);
}
