// Loaded with `node --import`: resolves the webpack alias 'pedigree/...' to src/script/ and
// provides the minimal browser globals some model modules expect at load time.
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);

if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
