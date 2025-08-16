// src/zigzag.js — 10pt Zig-Zag timeline (auto-wrap, anti-collision)
const W = 1280, H = 840;
const svgNS = 'http://www.w3.org/2000/svg';

const THEME = {
  baseY: 520,                 // baseline where dots sit
  marginX: 90,
  track: { stroke: '#dfe8f1', width: 12 },
  stem:  { stroke: '#b8c9db', width: 3 },
  disk:  { rOuter: 28, rInner: 21, outer: '#2c5a85', inner: '#3f7fb5' },
  title: { x: 60, y: 84, size: 42, color: '#16324a', weight: 900 },
  subtitle: { x: 60, y: 112, size: 18, color: '#6b7a90', weight: 600 },
  year:  { size: 22, color: '#234b6d', weight: 900 },
  label: { size: 16, color: '#1d3146', weight: 800 },
  calloutOffset: 86,          // distance of label from baseline
  wrap: { maxWidth: 230, lines: 2, lineHeight: 20 },
  pad: 10, showBg: true
};

function add(el, tag, attrs = {}) {
  const n = document.createElementNS(svgNS, tag);
  for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, v);
  el.appendChild(n);
  return n;
}

function text(el, x, y, str, opts = {}) {
  const t = add(el, 'text', {
    x, y,
    'font-size': opts.size || 16,
    'font-weight': opts.weight || 600,
    fill: opts.color || '#111',
    'text-anchor': opts.anchor || 'start',
    'dominant-baseline': opts.baseline || 'alphabetic'
  });
  t.textContent = str || '';
  return t;
}

function wrapText(el, x, y, txt, anchor, maxWidth, lineHeight, maxLines) {
  const g = add(el, 'g');
  const tester = text(el, -9999, -9999, '', { anchor, size: THEME.label.size, weight: THEME.label.weight });
  const width = s => { tester.textContent = s; return tester.getBBox().width; };

  const words = (txt || '').split(/\s+/).filter(Boolean);
  let line = [], out = [];
  while (words.length) {
    line.push(words.shift());
    if (width(line.join(' ')) > maxWidth) {
      const last = line.pop();
      out.push(line.join(' '));
      line = [last];
      if (out.length === maxLines - 1) break;
    }
  }
  if (line.length) out.push(line.join(' '));
  if (words.length) {
    let s = out[out.length - 1];
    while (width(s + '…') > maxWidth && s.length) s = s.slice(0, -1);
    out[out.length - 1] = (s.trim() + '…');
  }

  out.forEach((ln, i) => {
    text(g, x, y + i * lineHeight, ln, {
      anchor, size: THEME.label.size, weight: THEME.label.weight, color: THEME.label.color
    });
  });
  tester.remove();
  return g;
}

export function renderTimeline(payload) {
  const { title, subtitle, items = [] } = payload || {};
  const root = document.getElementById('root');
  root.innerHTML = '';

  const svg = add(root, 'svg', { id: 'svgRoot', width: W, height: H, viewBox: `0 0 ${W} ${H}` });

  // Title
  text(svg, THEME.title.x, THEME.title.y, title || 'Key Milestones', {
    size: THEME.title.size, weight: THEME.title.weight, color: THEME.title.color
  });
  text(svg, THEME.subtitle.x, THEME.subtitle.y, subtitle || '', {
    size: THEME.subtitle.size, weight: THEME.subtitle.weight, color: THEME.subtitle.color
  });

  // Track
  add(svg, 'line', {
    x1: THEME.marginX, y1: THEME.baseY,
    x2: W - THEME.marginX, y2: THEME.baseY,
    stroke: THEME.track.stroke, 'stroke-width': THEME.track.width, 'stroke-linecap': 'round'
  });

  // Positions
  const n = items.length;
  const usable = W - THEME.marginX * 2;
  const stepX = usable / Math.max(1, n - 1);

  const placedRects = [];

  items.forEach((it, i) => {
    const x = THEME.marginX + i * stepX;
    const y = THEME.baseY;

    // dot
    add(svg, 'circle', { cx: x, cy: y, r: THEME.disk.rOuter, fill: THEME.disk.outer });
    add(svg, 'circle', { cx: x, cy: y, r: THEME.disk.rInner, fill: THEME.disk.inner });
    const num = text(svg, x, y + 6, String(i + 1), {
      anchor: 'middle', size: 16, weight: 900, color: '#fff'
    });

    // callout side (alternate)
    const side = (i % 2 === 0) ? -1 : 1; // even: up, odd: down
    const labelY = y + side * THEME.calloutOffset;

    // stem (elbow: vertical then tiny horizontal)
    add(svg, 'path', {
      d: `M${x},${y} v${side * (THEME.calloutOffset - 20)} h${side * 12}`,
      fill: 'none', stroke: THEME.stem.stroke, 'stroke-width': THEME.stem.width
    });

    // year + title (wrapped)
    const anchor = (side < 0) ? 'start' : 'end';   // up = left-align to read outward, down = right-align
    const labelX = x + side * 20;

    const yearEl = text(svg, labelX, labelY - 20, it.year || '', {
      anchor, size: THEME.year.size, weight: THEME.year.weight, color: THEME.year.color
    });

    const labelGroup = wrapText(
      svg,
      labelX,
      labelY,
      it.title || '',
      anchor,
      THEME.wrap.maxWidth,
      THEME.wrap.lineHeight,
      THEME.wrap.lines
    );

    // optional white bg behind text (year + label)
    if (THEME.showBg) {
      const yr = yearEl.getBBox();
      const lg = labelGroup.getBBox();
      const x1 = Math.min(yr.x, lg.x), y1 = Math.min(yr.y, lg.y);
      const x2 = Math.max(yr.x + yr.width, lg.x + lg.width);
      const y2 = Math.max(yr.y + yr.height, lg.y + lg.height);
      const bg = add(svg, 'rect', {
        x: x1 - THEME.pad, y: y1 - THEME.pad,
        width: (x2 - x1) + THEME.pad * 2,
        height: (y2 - y1) + THEME.pad * 2,
        rx: 6, ry: 6, fill: '#fff', opacity: 0.92
      });
      // push behind
      bg.parentNode.insertBefore(bg, yearEl);
    }

    // naive anti-collision: nudge alternating blocks if overlapping horizontally
    const current = labelGroup.getBBox();
    const curRect = { x: current.x, y: current.y - 22, w: current.width, h: current.height + 28 };
    let bumped = 0;
    while (placedRects.some(r =>
      !(curRect.x + curRect.w < r.x || r.x + r.w < curRect.x || curRect.y + curRect.h < r.y || r.y + r.h < curRect.y)
    ) && bumped < 8) {
      const bump = 18;
      const dx = side * bump; // push outward
      [yearEl, ...labelGroup.querySelectorAll('text')].forEach(t => {
        t.setAttribute('x', +t.getAttribute('x') + dx);
      });
      curRect.x += dx;
      bumped++;
    }
    placedRects.push(curRect);
  });
}

// expose
window.renderTimeline = renderTimeline;
if (window.TIMELINE) window.renderTimeline(window.TIMELINE);
