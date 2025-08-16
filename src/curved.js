// src/curved.js — S-curve timeline with tidy labels, wrap + anti-collision
const W = 1280, H = 840;
const svgNS = 'http://www.w3.org/2000/svg';

const THEME = {
  curveD: 'M100,600 C380,420 760,420 1180,260',   // edit to taste
  path:  { stroke: '#dfe8f1', width: 12 },
  disk:  { rOuter: 28, rInner: 21, outer: '#2c5a85', inner: '#3f7fb5' },
  stem:  { stroke: '#b8c9db', width: 3 },          // tiny connector from dot to label
  title: { x: 60, y: 84, size: 42, color: '#16324a', weight: 900 },
  subtitle: { x: 60, y: 112, size: 18, color: '#6b7a90', weight: 600 },
  year:  { size: 22, color: '#234b6d', weight: 900 },
  label: { size: 16, color: '#1d3146', weight: 800 },
  offset: 70,                                       // distance from curve to label
  wrap:   { maxWidth: 260, lines: 2, line: 20 },
  pad: 8, showBg: true
};

function add(el, tag, attrs = {}) {
  const n = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  el.appendChild(n);
  return n;
}
function text(el, x, y, str, o={}) {
  const t = add(el, 'text', {
    x, y,
    'font-size': o.size || 16,
    'font-weight': o.weight || 600,
    fill: o.color || '#111',
    'text-anchor': o.anchor || 'start',
    'dominant-baseline': o.baseline || 'alphabetic'
  });
  t.textContent = str || '';
  return t;
}
function wrapText(el, x, y, txt, anchor, maxW, lineH, maxLines) {
  const g = add(el, 'g');
  const probe = text(el, -9999, -9999, '', { anchor, size: THEME.label.size, weight: THEME.label.weight });
  const width = s => { probe.textContent = s; return probe.getBBox().width; };
  const words = (txt || '').split(/\s+/).filter(Boolean);
  let line = [], out = [];
  while (words.length) {
    line.push(words.shift());
    if (width(line.join(' ')) > maxW) {
      const last = line.pop();
      out.push(line.join(' '));
      line = [last];
      if (out.length === maxLines - 1) break;
    }
  }
  if (line.length) out.push(line.join(' '));
  if (words.length) {
    let s = out[out.length - 1];
    while (width(s + '…') > maxW && s.length) s = s.slice(0, -1);
    out[out.length - 1] = (s.trim() + '…');
  }
  out.forEach((ln, i) => text(g, x, y + i*lineH, ln, { anchor, size: THEME.label.size, weight: THEME.label.weight, color: THEME.label.color }));
  probe.remove();
  return g;
}
function tangentAt(pathEl, s, eps = 0.5) {
  const a = pathEl.getPointAtLength(Math.max(0, s - eps));
  const b = pathEl.getPointAtLength(Math.min(pathEl.getTotalLength(), s + eps));
  const tx = b.x - a.x, ty = b.y - a.y;
  const L = Math.hypot(tx, ty) || 1;
  return { tx: tx / L, ty: ty / L };
}
function normalFrom(t) { return { nx: -t.ty, ny: t.tx }; }
function rectUnion(a, b) {
  const x1 = Math.min(a.x, b.x), y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
function inflate(r, pad) { return { x: r.x - pad, y: r.y - pad, width: r.width + 2*pad, height: r.height + 2*pad }; }
function overlap(a, b) {
  return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
}

export function renderTimeline(payload) {
  const { title, subtitle, items = [] } = payload || {};
  const root = document.getElementById('root');
  root.innerHTML = '';

  const svg = add(root, 'svg', { id: 'svgRoot', width: W, height: H, viewBox: `0 0 ${W} ${H}` });

  text(svg, THEME.title.x, THEME.title.y, title || 'Key Milestones', {
    size: THEME.title.size, weight: THEME.title.weight, color: THEME.title.color
  });
  text(svg, THEME.subtitle.x, THEME.subtitle.y, subtitle || '', {
    size: THEME.subtitle.size, weight: THEME.subtitle.weight, color: THEME.subtitle.color
  });

  // main S-curve
  const curve = add(svg, 'path', { d: THEME.curveD, fill: 'none', stroke: THEME.path.stroke, 'stroke-width': THEME.path.width, 'stroke-linecap':'round' });

  // evenly spaced along curve
  const n = items.length;
  const total = curve.getTotalLength();
  const inset = total * 0.03;
  const step = (total - inset*2) / Math.max(1, n - 1);

  const placed = [];

  items.forEach((it, i) => {
    const s = inset + i * step;
    const p = curve.getPointAtLength(s);
    const t = tangentAt(curve, s);
    const nrm = normalFrom(t);

    // dot
    add(svg, 'circle', { cx: p.x, cy: p.y, r: THEME.disk.rOuter, fill: THEME.disk.outer });
    add(svg, 'circle', { cx: p.x, cy: p.y, r: THEME.disk.rInner, fill: THEME.disk.inner });
    text(svg, p.x, p.y + 6, String(i + 1), { anchor: 'middle', size: 16, weight: 900, color: '#fff' });

    // side: push labels "outside" the curve (based on normal direction)
    const side = (nrm.ny < 0) ? 1 : -1; // tweak if you want consistent above/below
    const lx = p.x + nrm.nx * THEME.offset * side;
    const ly = p.y + nrm.ny * THEME.offset * side;

    // subtle stem
    add(svg, 'path', { d: `M${p.x},${p.y} L${p.x + nrm.nx * (THEME.offset - 18) * side},${p.y + nrm.ny * (THEME.offset - 18) * side}`,
      fill: 'none', stroke: THEME.stem.stroke, 'stroke-width': THEME.stem.width });

    // anchor: text should read outward
    const anchor = (lx >= p.x) ? 'start' : 'end';

    // year + title
    const yearEl = text(svg, lx, ly - 18, it.year || '', { anchor, size: THEME.year.size, weight: THEME.year.weight, color: THEME.year.color });
    const labelG = wrapText(svg, lx, ly + 4, it.title || '', anchor, THEME.wrap.maxWidth, THEME.wrap.line, THEME.wrap.lines);

    // background plate for readability
    if (THEME.showBg) {
      const yr = yearEl.getBBox(), lb = labelG.getBBox();
      const u = inflate(rectUnion(yr, lb), THEME.pad);
      const bg = add(svg, 'rect', { x: u.x, y: u.y, width: u.width, height: u.height, rx: 6, ry: 6, fill: '#fff', opacity: 0.92 });
      bg.parentNode.insertBefore(bg, yearEl);
    }

    // anti-collision: nudge outward along the normal if intersecting previous
    let r = rectUnion(yearEl.getBBox(), labelG.getBBox());
    let attempts = 0;
    while (placed.some(pr => overlap(pr, r)) && attempts < 10) {
      const bump = 16;
      const dx = nrm.nx * bump * side, dy = nrm.ny * bump * side;
      yearEl.setAttribute('x', +yearEl.getAttribute('x') + dx);
      yearEl.setAttribute('y', +yearEl.getAttribute('y') + dy);
      [...labelG.querySelectorAll('text')].forEach(tn => {
        tn.setAttribute('x', +tn.getAttribute('x') + dx);
        tn.setAttribute('y', +tn.getAttribute('y') + dy);
      });
      r = rectUnion(yearEl.getBBox(), labelG.getBBox());
      attempts++;
    }
    placed.push(inflate(r, 6));
  });
}

// expose for puppeteer
window.renderTimeline = renderTimeline;
if (window.TIMELINE) window.renderTimeline(window.TIMELINE);
