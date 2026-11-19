import { translate } from 'pedigree/i18n';
import {
  lookupVariant,
  formatAlleleFrequency
} from 'pedigree/model/variantLookup';
import { ZYGOSITIES, classificationInfo } from 'pedigree/model/clinicalData';

/**
 * Floating card showing genetic variant classification and annotations fetched live from
 * NCBI ClinVar and MyVariant.info (gnomAD, dbSNP, CADD, REVEL, AlphaMissense), plus direct
 * links to ClinVar, gnomAD and VarSome.
 */

var _activeCard = null;
var _cleanupFns = [];
var _requestSeq = 0;

var closeVariantInfoCard = function() {
  _requestSeq++;
  _cleanupFns.forEach(function(fn) {
    try { fn(); } catch (e) {}
  });
  _cleanupFns = [];
  if (_activeCard && _activeCard.parentNode) {
    _activeCard.parentNode.removeChild(_activeCard);
  }
  _activeCard = null;
};

var _starsHtml = function(stars) {
  var out = '';
  for (var i = 0; i < 4; i++) {
    out += i < stars ? '&#9733;' : '&#9734;';
  }
  return out;
};

var _zygosityLabel = function(code) {
  if (!code) return '';
  for (var i = 0; i < ZYGOSITIES.length; i++) {
    if (ZYGOSITIES[i].code === code) return translate(ZYGOSITIES[i].label);
  }
  return code;
};

var _badgeTone = function(code, raw) {
  if (code === 'P' || code === 'LP' || code === 'POS') return 'positive';
  if (code === 'VUS') return 'vus';
  if (code === 'LB' || code === 'B' || code === 'NEG') return 'negative';
  if (raw && /conflicting/i.test(raw)) return 'vus';
  return 'neutral';
};

var _positionCard = function(card, anchorEl) {
  if (window.innerWidth <= 640) {
    card.addClassName('is-mobile');
    return;
  }
  var rect = anchorEl && anchorEl.getBoundingClientRect ? anchorEl.getBoundingClientRect() : null;
  var cardW = Math.min(390, window.innerWidth - 24);
  card.setStyle({ width: cardW + 'px' });
  var cardH = card.offsetHeight || 320;
  var left, top;
  if (rect) {
    left = rect.right + 10;
    if (left + cardW > window.innerWidth - 12) {
      left = rect.left - cardW - 10;
    }
    if (left < 12) {
      left = Math.max(12, Math.min(window.innerWidth - cardW - 12, rect.left));
    }
    top = rect.top - 12;
    if (top + cardH > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - cardH - 12);
    }
    if (top < 12) top = 12;
  } else {
    left = Math.max(12, Math.round((window.innerWidth - cardW) / 2));
    top = Math.max(24, Math.round((window.innerHeight - cardH) / 3));
  }
  card.setStyle({ left: Math.round(left) + 'px', top: Math.round(top) + 'px' });
};

/**
 * Opens the variant information card anchored near `anchorEl`.
 *
 * @param {Object} test { gene, variant, protein, classification, zygosity, lab, date, comment }
 * @param {HTMLElement} [anchorEl]
 * @param {Object} [options] { onApply: function(record) }
 */
var showVariantInfoCard = function(test, anchorEl, options) {
  closeVariantInfoCard();
  options = options || {};
  test = test || {};

  var seq = ++_requestSeq;
  var gene = (test.gene || '').trim().toUpperCase();
  var variant = (test.variant || '').trim();
  var protein = (test.protein || '').trim();
  var titleMain = [gene, variant || protein].filter(Boolean).join(' ') || translate('Genetic variant');

  var card = new Element('div', {
    'class': 'variant-info-card',
    'role': 'dialog',
    'aria-label': titleMain
  });

  // Header
  var header = new Element('div', { 'class': 'variant-card-header' });
  var titleWrap = new Element('div', { 'class': 'variant-card-title-wrap' });
  var titleEl = new Element('div', { 'class': 'variant-card-title' }).update(titleMain.escapeHTML());
  var subtitleEl = new Element('div', { 'class': 'variant-card-subtitle' });
  if (variant && protein) {
    subtitleEl.update(protein.escapeHTML());
  }
  titleWrap.insert(titleEl).insert(subtitleEl);
  var closeBtn = new Element('button', {
    'type': 'button',
    'class': 'variant-card-close',
    'title': translate('Close'),
    'aria-label': translate('Close')
  }).update('&times;');
  closeBtn.observe('click', function(e) {
    e.stop();
    closeVariantInfoCard();
  });
  header.insert(titleWrap).insert(closeBtn);
  card.insert(header);

  var body = new Element('div', { 'class': 'variant-card-body' });
  body.insert(new Element('div', { 'class': 'variant-card-loading' })
    .insert(new Element('span', { 'class': 'variant-card-spinner' }))
    .insert(new Element('span').update(translate('Looking up ClinVar & MyVariant.info…'))));
  card.insert(body);

  var footer = new Element('div', { 'class': 'variant-card-footer' });
  card.insert(footer);

  document.body.appendChild(card);
  _activeCard = card;
  _positionCard(card, anchorEl);

  // Dismiss on Esc or outside click
  var onKey = function(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      if (e.stopPropagation) e.stopPropagation();
      closeVariantInfoCard();
    }
  };
  var onOutside = function(e) {
    if (!card.contains(e.target) && !(anchorEl && anchorEl.contains && anchorEl.contains(e.target))) {
      closeVariantInfoCard();
    }
  };
  var bindTimer = setTimeout(function() {
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('touchstart', onOutside, true);
  }, 0);
  _cleanupFns.push(function() {
    clearTimeout(bindTimer);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onOutside, true);
    document.removeEventListener('touchstart', onOutside, true);
  });

  var renderLinks = function(links) {
    footer.update('');
    var linkList = [
      { label: 'ClinVar', url: links.clinvar },
      { label: 'gnomAD', url: links.gnomad },
      { label: 'VarSome', url: links.varsome }
    ];
    linkList.forEach(function(item) {
      var a = new Element('a', {
        'href': item.url,
        'target': '_blank',
        'rel': 'noopener noreferrer',
        'class': 'variant-card-link'
      }).update(item.label.escapeHTML() + ' &#8599;');
      footer.insert(a);
    });
  };

  var renderLocalSummary = function(container) {
    var bits = [];
    if (test.classification) {
      var cInfo = classificationInfo(test.classification);
      bits.push(translate('Recorded:') + ' ' + translate(cInfo.label));
    }
    var zyg = _zygosityLabel(test.zygosity);
    if (zyg && zyg !== '—') bits.push(zyg);
    if (test.lab) bits.push(test.lab);
    if (test.date) bits.push(test.date);
    if (bits.length) {
      container.insert(new Element('div', { 'class': 'variant-card-local' }).update(bits.join(' · ').escapeHTML()));
    }
  };

  lookupVariant({ gene: gene, variant: variant, protein: protein }).then(function(res) {
    if (seq !== _requestSeq || _activeCard !== card) return;
    body.update('');
    renderLinks(res.links);

    if (!res.found || !res.record) {
      var msg = res.error === 'network' || res.error === 'offline'
        ? translate('Could not reach ClinVar / MyVariant.info. Check your internet connection or use the links below.')
        : translate('Variant not found in ClinVar. Check the HGVS notation (e.g. c.68_69del) or search directly below.');
      body.insert(new Element('div', { 'class': 'variant-card-empty' }).update(msg.escapeHTML()));
      renderLocalSummary(body);
      _positionCard(card, anchorEl);
      return;
    }

    var rec = res.record;
    if (rec.transcript || rec.accession) {
      var subParts = [];
      if (rec.transcript) subParts.push(rec.transcript);
      if (rec.hgvsP && rec.hgvsP !== variant) subParts.push(rec.hgvsP);
      if (rec.accession) subParts.push(rec.accession);
      subtitleEl.update(subParts.join(' · ').escapeHTML());
    }

    // Classification banner
    var tone = _badgeTone(rec.classificationCode, rec.classificationRaw);
    var banner = new Element('div', { 'class': 'variant-card-banner is-' + tone });
    var topRow = new Element('div', { 'class': 'variant-card-banner-top' });
    topRow.insert(new Element('span', { 'class': 'variant-card-class' }).update(
      (rec.classificationRaw || translate('Unclassified')).escapeHTML()
    ));
    if (rec.reviewStatus || rec.stars > 0) {
      topRow.insert(new Element('span', {
        'class': 'variant-card-stars',
        'title': rec.reviewStatus || ''
      }).update(_starsHtml(rec.stars)));
    }
    banner.insert(topRow);
    var metaLine = [];
    if (rec.reviewStatus) metaLine.push(rec.reviewStatus);
    if (rec.lastEvaluated) metaLine.push(translate('Evaluated') + ': ' + rec.lastEvaluated);
    if (metaLine.length) {
      banner.insert(new Element('div', { 'class': 'variant-card-review' }).update(metaLine.join(' · ').escapeHTML()));
    }
    body.insert(banner);

    // Key-value metadata rows
    var grid = new Element('dl', { 'class': 'variant-card-grid' });
    var addRow = function(label, valueHtml) {
      if (!valueHtml) return;
      grid.insert(new Element('dt').update(translate(label).escapeHTML()));
      grid.insert(new Element('dd').update(valueHtml));
    };

    var consParts = [];
    if (rec.hgvsP) consParts.push(rec.hgvsP.escapeHTML());
    if (rec.consequence) consParts.push(rec.consequence.escapeHTML());
    if (consParts.length) addRow('Protein / effect', consParts.join(' · '));

    var locParts = [];
    if (rec.grch38 && rec.grch38.label) locParts.push(rec.grch38.label.escapeHTML() + ' (GRCh38)');
    if (rec.rsid) locParts.push(rec.rsid.escapeHTML());
    if (locParts.length) addRow('Position / dbSNP', locParts.join(' · '));

    if (rec.gnomadAf !== null && rec.gnomadAf !== undefined) {
      addRow('gnomAD AF', formatAlleleFrequency(rec.gnomadAf).escapeHTML());
    }

    // In-silico predictors
    var scores = [];
    if (rec.revelScore !== null) {
      var revCls = rec.revelScore >= 0.773 ? 'is-high' : (rec.revelScore <= 0.29 ? 'is-low' : 'is-mid');
      scores.push('<span class="variant-score ' + revCls + '">REVEL ' + rec.revelScore.toFixed(2) + '</span>');
    }
    if (rec.caddPhred !== null) {
      var caddCls = rec.caddPhred >= 25 ? 'is-high' : (rec.caddPhred < 15 ? 'is-low' : 'is-mid');
      scores.push('<span class="variant-score ' + caddCls + '">CADD ' + rec.caddPhred.toFixed(1) + '</span>');
    }
    if (rec.alphaMissenseScore !== null) {
      var amCls = rec.alphaMissenseScore >= 0.564 ? 'is-high' : (rec.alphaMissenseScore <= 0.34 ? 'is-low' : 'is-mid');
      scores.push('<span class="variant-score ' + amCls + '">AlphaMissense ' + rec.alphaMissenseScore.toFixed(2) + '</span>');
    }
    if (scores.length) {
      addRow('In silico', scores.join(' '));
    }

    if (rec.conditions && rec.conditions.length) {
      var shown = rec.conditions.slice(0, 3).map(function(c) { return c.escapeHTML(); }).join('; ');
      if (rec.conditions.length > 3) shown += ' (+' + (rec.conditions.length - 3) + ')';
      addRow('Conditions', shown);
    }

    if (grid.childNodes.length) {
      body.insert(grid);
    }

    // Optional "Apply to test" button when opened from the clinical editor dialog
    if (typeof options.onApply === 'function' && (rec.classificationCode || rec.hgvsP || rec.hgvsC)) {
      var applyWrap = new Element('div', { 'class': 'variant-card-actions' });
      var applyBtn = new Element('button', {
        'type': 'button',
        'class': 'variant-card-apply'
      }).update(translate('Apply ClinVar data to test'));
      applyBtn.observe('click', function(e) {
        e.stop();
        options.onApply(rec);
        closeVariantInfoCard();
      });
      applyWrap.insert(applyBtn);
      body.insert(applyWrap);
    }

    renderLocalSummary(body);
    _positionCard(card, anchorEl);
  });
};

export { showVariantInfoCard, closeVariantInfoCard };
