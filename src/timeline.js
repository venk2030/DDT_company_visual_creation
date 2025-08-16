// src/timeline.js — pro layout: path-normal labels, wrapping, anti-collision
const W = 1280, H = 800;
const svgNS = 'http://www.w3.org/2000/svg';

const CONFIG = {
  curve: 'M100,600 C420,380 760,440 1140,220', // gentle S
  disk: { rOuter: 30, rInner: 22, colorOuter: '#2c5a85', colorInner: '#3f7fb5' },
  path: { stroke: '#d7e3ee', width: 12 },
  title: { x: 60, y: 80, size: 44, color: '#16324a', weight: 800 },
  subtitle: { x: 60, y: 110, size: 18, color: '#6b7a90', weight: 600 },
  wrap: { maxWidth: 260, lines: 2, lineHeight: 20 }, // adjust to taste
  labelOffset: 46,                                     // distance from dot
  yearDy: -40,                                         // year baseline relative to dot
  titleDy: -16,                                        // title baseline relative to dot
  labelPad: 8,                                        // background pad
  showLabelBg: true,                                  // white bg under label
};

function add(el, tag, attrs = {}) {
  const n = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  el.appendChild(n);
  return n;
}

function textNode(g, x, y, txt, opts = {}) {
  const t = add(g, 'text', {
    x, y,
    'font-size': opts.size || 16,
    'font-weight': opts.weight || 600,
    fill: opts.color || '#1d3146',
    'text-anchor': opts.anchor || 'start',
    'dominant-baseline': 'alphabetic'
  });
  t.textContent = txt;
  return t;
}

function addWrappedText(g, x, y, text, anchor, maxWidth, lineHeight, maxLines, measureSvg) {
  // simple greedy wrap by words with width check via getBBox
  const group = add(g, 'g');
  let words = (text || '').split(/\s+/).filter(Boolean);
  let line = [];
  let lines = [];

  const tmp = textNode(measureSvg, x, y, '', { anchor, size: 16, weight: 800 });
  const measure = (s) => { tmp.textContent = s || ''; return tmp.getBBox().width; };

  while (words.length) {
    line.push(words.shift());
    if (measure(line.join(' ')) > maxWidth) {
      const w = line.pop();           // last word overflowed
      lines.push(line.join(' '));
      line = [w];
      if (lines.length === maxLines - 1) break; // room left for final line only
    }
  }
  if (line.length) lines.push(line.join(' '));

  // ellipsis if overflow remains
  if (words.length) {
    let s = lines[lines.length - 1];
    while (measure(s + '…') > maxWidth && s.length) s = s.slice(0, -1);
    lines[lines.length - 1] = (s || '').replace(/\s+$/, '') + '…';
  }

  // render tspans
  lines.forEach((ln, i) => {
    const t = add(group, 'text', {
      x, y: y + i * lineHeight,
      'font-size': 16,
      'font-weight': 800,
      fill: '#1d3146',
      'text-anchor': anchor
    });
    t.textContent = ln;
  });

  tmp.remove();
  return group;
}

function tangentAt(pathEl, s, eps = 0.5) {
  const a = pathEl.getPointAtLength(Math.max(0, s - eps));
  const b = pathEl.getPointAtLength(Math.min(pathEl.getTotalLength(), s + eps));
  const tx = b.x - a.x, ty = b.y - a.y;
  const len = Math.hypot(tx, ty) || 1;
  return { tx: tx / len, ty: ty / len };
}

function normalFromTangent(t) {
  // rotate tangent 90° to get normal
  return { nx: -t.ty, ny: t.tx };
}

function rectFromTextGroup(g) {
  const bbox = g.getBBox();
  return { x: bbox.x, y: bbox.y, w: bbox.width, h: bbox.height };
}

function inflate(r, pad) {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}
function intersects(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function renderTimeline(data) {
  const root = document.getElementById('root');
  root.innerHTML = '';

  const svg = add(root, 'svg', { id: 'svgRoot', width: W, height: H, viewBox: `0 0 ${W} ${H}` });

  // title + subtitle
  const t = textNode(svg, CONFIG.title.x, CONFIG.title.y, data.title || 'Key Milestones', {
    size: CONFIG.title.size, weight: CONFIG.title.weight, color: CONFIG.title.color, anchor: 'start'
  });
  textNode(svg, CONFIG.subtitle.x, CONFIG.subtitle.y, data.subtitle || '2015–2024', {
    size: CONFIG.subtitle.size, weight: CONFIG.subtitle.weight, color: CONFIG.subtitle.color, anchor: 'start'
  });

  // main curve
  const path = add(svg, 'path', {
    id: 'curve',
    d: CONFIG.curve,
    fill: 'none',
    stroke: CONFIG.path.stroke,
    'stroke-width': CONFIG.path.width,
    'stroke-linecap': 'round'
  });

  const items = data.items || [];
  const N = items.length;
  const total = path.getTotalLength();
  const inset = total * 0.03;
  const step = (total - inset * 2) / Math.max(1, N - 1);

  // keep label rectangles to avoid collisions
  const placed = [];

  items.forEach((item, i) => {
    const s = inset + i * step;
    const p = path.getPointAtLength(s);
    const tan = tangentAt(path, s);
    const nrm = normalFromTangent(tan);

    // dot
    const gDot = add(svg, 'g');
    add(gDot, 'circle', { cx: p.x, cy: p.y, r: CONFIG.disk.rOuter, fill: CONFIG.disk.colorOuter });
    add(gDot, 'circle', { cx: p.x, cy: p.y, r: CONFIG.disk.rInner, fill: CONFIG.disk.colorInner });
    const num = add(gDot, 'text', {
      x: p.x, y: p.y + 6, 'text-anchor': 'middle',
      'font-size': 18, 'font-weight': 800, fill: '#fff'
    });
    num.textContent = (i + 1).toString();

    // side selection (push labels to the "upper" side for readability)
    // Using normal's y: negative => above, positive => below; flip if you prefer alternating
    const side = nrm.ny < 0 ? 1 : -1; // 1 = along +normal, -1 = opposite
    const labX = p.x + nrm.nx * CONFIG.labelOffset * side;
    const labY = p.y + nrm.ny * CONFIG.labelOffset * side;

    // anchor: if label is to the right of the dot, start; else end
    const anchor = (labX >= p.x) ? 'start' : 'end';

    // YEAR
    const year = textNode(svg, labX, labY + CONFIG.yearDy, item.year || '', {
      anchor, size: 28, weight: 900, color: '#234b6d'
    });

    // TITLE (wrapped)
    const labelGroup = addWrappedText(
      svg,
      labX,
      labY + CONFIG.titleDy,
      item.title || '',
      anchor,
      CONFIG.wrap.maxWidth,
      CONFIG.wrap.lineHeight,
      CONFIG.wrap.lines,
      svg
    );

    // optional white bg behind year+title for clarity
    if (CONFIG.showLabelBg) {
      const yrRect = year.getBBox();
      const ttlRect = labelGroup.getBBox();
      // union rect
      const x1 = Math.min(yrRect.x, ttlRect.x), y1 = Math.min(yrRect.y, ttlRect.y);
      const x2 = Math.max(yrRect.x + yrRect.width, ttlRect.x + ttlRect.width);
      const y2 = Math.max(yrRect.y + yrRect.height, ttlRect.y + ttlRect.height);
      const r = inflate({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, CONFIG.labelPad);
      const bg = add(svg, 'rect', {
        x: r.x, y: r.y, width: r.w, height: r.h, rx: 6, ry: 6,
        fill: '#fff', opacity: 0.92
      });
      // ensure bg is behind: move it before year/label in DOM
      bg.parentNode.insertBefore(bg, year);
    }

    // simple anti-collision: if current label intersects any previous, nudge further along normal
    let rect = rectFromTextGroup(labelGroup);
    let yr = year.getBBox();
    let union = { x: Math.min(rect.x, yr.x), y: Math.min(rect.y, yr.y),
                  w: Math.max(rect.x+rect.w, yr.x+yr.width) - Math.min(rect.x, yr.x),
                  h: Math.max(rect.y+rect.h, yr.y+yr.height) - Math.min(rect.y, yr.y) };
    let bumped = 0;
    while (placed.some(pr => intersects(pr, union)) && bumped < 12) {
      const bump = 14; // px per step
      const dx = nrm.nx * bump * side;
      const dy = nrm.ny * bump * side;
      // move year + label
      year.setAttribute('x', +year.getAttribute('x') + dx);
      year.setAttribute('y', +year.getAttribute('y') + dy);
      [...labelGroup.querySelectorAll('text')].forEach(t => {
        t.setAttribute('x', +t.getAttribute('x') + dx);
        t.setAttribute('y', +t.getAttribute('y') + dy);
      });
      rect = labelGroup.getBBox();
      yr = year.getBBox();
      union = { x: Math.min(rect.x, yr.x), y: Math.min(rect.y, yr.y),
                w: Math.max(rect.x+rect.w, yr.x+yr.width) - Math.min(rect.x, yr.x),
                h: Math.max(rect.y+rect.h, yr.y+yr.height) - Math.min(rect.y, yr.y) };
      bumped++;
    }
    placed.push(inflate(union, 6));
  });
}

// expose to puppeteer
window.renderTimeline = renderTimeline;
// auto render if data preloaded
if (window.TIMELINE) window.renderTimeline(window.TIMELINE);
