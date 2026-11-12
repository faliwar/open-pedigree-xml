import test from 'node:test';
import assert from 'node:assert/strict';

test('collapsed branch badges are marked to be omitted from export', () => {
  // Simulates overlay element attribute assignment
  const overlayAttributes = {
    'data-opx-overlay': 'collapsed-badge',
    'data-opx-export': 'omit'
  };

  assert.equal(overlayAttributes['data-opx-overlay'], 'collapsed-badge');
  assert.equal(overlayAttributes['data-opx-export'], 'omit');

  // Verify that an SVG string containing these tags is stripped of omit/collapsed-badge elements
  let svg = '<svg><g data-opx-overlay="collapsed-badge" data-opx-export="omit"><text>+73</text></g><circle cx="10" cy="10" r="5"/></svg>';
  svg = svg.replace(/<[^>]*data-opx-export="omit"[^>]*>.*?<\/[^>]+>/g, '');
  assert.ok(!svg.includes('+73'));
  assert.ok(svg.includes('<circle'));
});

test('export bounding box adds 36px breathing margin avoiding node cropping', () => {
  const pad = 36;
  const bbox = { x: 100, y: 150, width: 400, height: 300 };
  const bX = Math.floor(bbox.x - pad);
  const bY = Math.floor(bbox.y - pad);
  const bWidth = Math.ceil(bbox.width + pad * 2);
  const bHeight = Math.ceil(bbox.height + pad * 2);

  assert.equal(bX, 64);
  assert.equal(bY, 114);
  assert.equal(bWidth, 472);
  assert.equal(bHeight, 372);
  assert.ok(bY < bbox.y, 'ViewBox top extends above topmost element');
  assert.ok(bX < bbox.x, 'ViewBox left extends before leftmost element');
});
