import { translate } from 'pedigree/i18n';

/**
 * Gene symbol autocomplete for a text input: genes already used in the pedigree first, then
 * HGNC symbols from MyGene.info (same service and ranking as the former "Genes" field).
 * Works offline with the local list only. Keyboard: arrows to move, Enter to pick, Esc to close.
 */

var cache = {};

var localGenes = function() {
  var genes = [];
  try {
    var legend = editor.getGeneLegend();
    Object.keys((legend && legend._affectedNodes) || {}).forEach(function(g) {
      if (genes.indexOf(g) === -1) genes.push(g);
    });
    var graph = editor.getGraph();
    for (var id = 0; id <= graph.getMaxNodeId(); id++) {
      var node = editor.getNode(id);
      if (node && node.getGeneticTests) {
        node.getGeneticTests().forEach(function(t) {
          if (t.gene && genes.indexOf(t.gene) === -1) genes.push(t.gene);
        });
      }
    }
  } catch (e) {}
  return genes;
};

var rank = function(item, q) {
  var sym = item.symbol.toUpperCase();
  if (sym === q) return 0;
  if (sym.indexOf(q) === 0) return 10 + sym.length;
  if (sym.indexOf(q) > 0) return 50;
  if ((item.name || '').toUpperCase().indexOf(q) >= 0) return 100;
  return 200;
};

var remoteSearch = function(q) {
  if (cache[q]) {
    return Promise.resolve(cache[q]);
  }
  var token = q.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  if (!token || typeof fetch !== 'function') {
    return Promise.resolve([]);
  }
  var query = 'symbol:' + token + '^100 OR symbol:' + token + '*^20 OR name:' + token + '*^5 OR alias:' + token + '*';
  var url = 'https://mygene.info/v3/query?species=human&fields=symbol,name&size=10&q=' + encodeURIComponent(query);
  return fetch(url).then(function(r) { return r.json(); }).then(function(data) {
    var hits = ((data && data.hits) || []).filter(function(h) { return h.symbol; })
      .map(function(h) { return { symbol: h.symbol, name: h.name || '' }; });
    cache[q] = hits;
    return hits;
  }).catch(function() { return []; });
};

/**
 * @param {HTMLInputElement} input
 * @param {Function} onPick called with the chosen symbol
 */
var attachGeneSearch = function(input, onPick) {
  var wrap = new Element('div', { 'class': 'gene-search' });
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  var list = new Element('ul', { 'class': 'gene-search-list', 'role': 'listbox' });
  list.hide();
  wrap.insert(list);
  input.writeAttribute({ 'autocomplete': 'off', 'role': 'combobox', 'aria-autocomplete': 'list' });

  var items = [];
  var active = -1;
  var timer = null;
  var seq = 0;

  var close = function() {
    list.hide();
    items = [];
    active = -1;
  };
  var pick = function(symbol) {
    input.value = symbol;
    close();
    onPick(symbol);
  };
  var render = function() {
    list.update('');
    if (!items.length) {
      close();
      return;
    }
    items.forEach(function(item, i) {
      var li = new Element('li', { 'class': 'gene-search-item' + (i === active ? ' is-active' : ''), 'role': 'option' });
      li.insert(new Element('span', { 'class': 'gene-search-symbol' }).update(item.symbol.escapeHTML()));
      if (item.name) {
        li.insert(new Element('span', { 'class': 'gene-search-name' }).update(item.name.escapeHTML()));
      } else if (item.local) {
        li.insert(new Element('span', { 'class': 'gene-search-name' }).update(translate('in this pedigree')));
      }
      // mousedown fires before the input loses focus
      li.observe('mousedown', function(e) {
        e.stop();
        pick(item.symbol);
      });
      list.insert(li);
    });
    list.show();
  };
  var search = function() {
    var q = input.value.trim().toUpperCase();
    if (!q) {
      close();
      return;
    }
    var mine = ++seq;
    var local = localGenes().filter(function(g) { return g.toUpperCase().indexOf(q) !== -1; })
      .map(function(g) { return { symbol: g, name: '', local: true }; });
    items = local.slice(0, 5);
    active = -1;
    render();
    remoteSearch(q).then(function(remote) {
      if (mine !== seq) return; // a newer search is running
      var seen = {};
      var all = local.concat(remote).filter(function(it) {
        var k = it.symbol.toUpperCase();
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      });
      all.sort(function(a, b) { return (rank(a, q) - rank(b, q)) || a.symbol.localeCompare(b.symbol); });
      items = all.slice(0, 6);
      active = -1;
      render();
    });
  };

  input.observe('input', function() {
    clearTimeout(timer);
    timer = setTimeout(search, 200);
  });
  input.observe('keydown', function(e) {
    if (!items.length || !list.visible()) return;
    if (e.keyCode === 40 || e.keyCode === 38) {        // down / up
      e.stop();
      active = (active + (e.keyCode === 40 ? 1 : -1) + items.length) % items.length;
      render();
    } else if (e.keyCode === 13 && active >= 0) {      // Enter
      e.stop();
      pick(items[active].symbol);
    } else if (e.keyCode === 27) {                     // Esc closes the list, not the dialog
      e.stop();
      close();
    }
  });
  input.observe('blur', function() {
    setTimeout(close, 150);
  });
};

export { attachGeneSearch };
