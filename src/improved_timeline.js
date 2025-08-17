// src/timeline-improved.js - Enhanced visual quality timeline
const W = 1280, H = 840;
const svgNS = 'http://www.w3.org/2000/svg';

const CONFIG = {
  // Gentler, more spread curve
  curve: 'M80,680 C280,450 500,380 720,320 C900,270 1080,240 1200,200',
  
  // Enhanced visual elements
  disk: { rOuter: 35, rInner: 26, colorOuter: '#2c5a85', colorInner: '#4a90c2' },
  path: { stroke: '#d7e3ee', width: 14, opacity: 0.8 },
  
  // Improved typography
  title: { x: 60, y: 75, size: 36, color: '#16324a', weight: 700 },
  subtitle: { x: 60, y: 105, size: 16, color: '#6b7a90', weight: 500 },
  
  // Better spacing and wrapping
  wrap: { maxWidth: 200, lines: 1, lineHeight: 18 },
  labelOffset: 95, // increased for better separation
  yearDy: -50, // more separation between year and dot
  titleDy: -28, // better title positioning
  
  // Enhanced backgrounds
  labelPad: 14,
  showLabelBg: true,
  labelBg: {
    fill: '#ffffff',
    opacity: 0.96,
    stroke: '#e8eff5',
    strokeWidth: 1.5,
    rx: 10, ry: 10
  },
  
  // Collision avoidance
  minLabelSpacing: 80,
  maxCollisionBumps: 25,
  bumpDistance: 18,
  
  // Connecting stems
  stem: {
    stroke: '#b8c9db',
    width: 2.5,
    opacity: 0.75
  }
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
  const group = add(g, 'g');
  let words = (text || '').split(/\s+/).filter(Boolean);
  let line = [];
  let lines = [];

  const tmp = textNode(measureSvg, x, y, '', { anchor, size: 14, weight: 600 });
  const measure = (s) => { tmp.textContent = s || ''; return tmp.getBBox().width; };

  while (words.length) {
    line.push(words.shift());
    if (measure(line.join(' ')) > maxWidth) {
      const w = line.pop();
      lines.push(line.join(' '));
      line = [w];
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line.length) lines.push(line.join(' '));

  // Smarter ellipsis handling
  if (words.length) {
    let s = lines[lines.length - 1];
    while (measure(s + '…') > maxWidth && s.length > 3) {
      s = s.slice(0, -1);
    }
    lines[lines.length - 1] = (s || '').replace(/\s+$/, '') + '…';
  }

  lines.forEach((ln, i) => {
    const t = add(group, 'text', {
      x, y: y + i * lineHeight,
      'font-size': 14,
      'font-weight': 600,
      fill: '#1d3146',
      'text-anchor': anchor
    });
    t.textContent = ln;
  });

  tmp.remove();
  return group;
}

function tangentAt(pathEl, s, eps = 1.0) {
  const a = pathEl.getPointAtLength(Math.max(0, s - eps));
  const b = pathEl.getPointAtLength(Math.min(pathEl.getTotalLength(), s + eps));
  const tx = b.x - a.x, ty = b.y - a.y;
  const len = Math.hypot(tx, ty) || 1;
  return { tx: tx / len, ty: ty / len };
}

function normalFromTangent(t) {
  return { nx: -t.ty, ny: t.tx };
}

function rectFromElements(elements) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  elements.forEach(el => {
    const bbox = el.getBBox();
    x1 = Math.min(x1, bbox.x);
    y1 = Math.min(y1, bbox.y);
    x2 = Math.max(x2, bbox.x + bbox.width);
    y2 = Math.max(y2, bbox.y + bbox.height);
  });
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function inflate(r, pad) {
  return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

function intersects(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

function getOptimalSide(i, normal, point, placedRects) {
  // Try alternating first
  let side = (i % 2 === 0) ? 1 : -1;
  
  // Test position and flip if too crowded
  const testX = point.x + normal.nx * CONFIG.labelOffset * side;
  const testY = point.y + normal.ny * CONFIG.labelOffset * side;
  
  const nearbyConflicts = placedRects.filter(r => 
    Math.abs(r.x - testX) < CONFIG.minLabelSpacing && 
    Math.abs(r.y - testY) < 60
  ).length;
  
  if (nearbyConflicts > 1) {
    side *= -1; // flip to other side
  }
  
  return side;
}

export function renderTimeline(data) {
  const root = document.getElementById('root');
  root.innerHTML = '';

  const svg = add(root, 'svg', { id: 'svgRoot', width: W, height: H, viewBox: `0 0 ${W} ${H}` });

  // Add subtle background gradient
  const defs = add(svg, 'defs');
  const gradient = add(defs, 'linearGradient', { id: 'bgGrad', x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
  add(gradient, 'stop', { offset: '0%', 'stop-color': '#fafbfc' });
  add(gradient, 'stop', { offset: '100%', 'stop-color': '#f0f4f8' });
  add(svg, 'rect', { width: W, height: H, fill: 'url(#bgGrad)' });

  // Enhanced title + subtitle
  textNode(svg, CONFIG.title.x, CONFIG.title.y, data.title || 'Key Milestones', {
    size: CONFIG.title.size, weight: CONFIG.title.weight, color: CONFIG.title.color
  });
  textNode(svg, CONFIG.subtitle.x, CONFIG.subtitle.y, data.subtitle || '2015–2024', {
    size: CONFIG.subtitle.size, weight: CONFIG.subtitle.weight, color: CONFIG.subtitle.color
  });

  // Enhanced main curve with shadow
  const pathShadow = add(svg, 'path', {
    d: CONFIG.curve,
    fill: 'none',
    stroke: '#c5d1dd',
    'stroke-width': CONFIG.path.width + 2,
    'stroke-linecap': 'round',
    opacity: 0.3,
    transform: 'translate(2, 3)'
  });
  
  const path = add(svg, 'path', {
    id: 'curve',
    d: CONFIG.curve,
    fill: 'none',
    stroke: CONFIG.path.stroke,
    'stroke-width': CONFIG.path.width,
    'stroke-linecap': 'round',
    opacity: CONFIG.path.opacity
  });

  const items = data.items || [];
  const N = items.length;
  const total = path.getTotalLength();
  const inset = total * 0.05; // slightly more inset
  const step = (total - inset * 2) / Math.max(1, N - 1);

  const placed = [];

  items.forEach((item, i) => {
    const s = inset + i * step;
    const p = path.getPointAtLength(s);
    const tan = tangentAt(path, s);
    const nrm = normalFromTangent(tan);

    // Enhanced dot with shadow
    const gDot = add(svg, 'g');
    // Shadow
    add(gDot, 'circle', { 
      cx: p.x + 2, cy: p.y + 3, r: CONFIG.disk.rOuter, 
      fill: 'rgba(44, 90, 133, 0.2)' 
    });
    // Main dot
    add(gDot, 'circle', { cx: p.x, cy: p.y, r: CONFIG.disk.rOuter, fill: CONFIG.disk.colorOuter });
    add(gDot, 'circle', { cx: p.x, cy: p.y, r: CONFIG.disk.rInner, fill: CONFIG.disk.colorInner });
    
    const num = textNode(gDot, p.x, p.y + 7, (i + 1).toString(), {
      anchor: 'middle', size: 18, weight: 800, color: '#ffffff'
    });

    // Smart side selection
    const side = getOptimalSide(i, nrm, p, placed);
    let labX = p.x + nrm.nx * CONFIG.labelOffset * side;
    let labY = p.y + nrm.ny * CONFIG.labelOffset * side;

    // Anchor based on position relative to dot
    const anchor = (labX >= p.x) ? 'start' : 'end';

    // Add connecting stem (curved)
    const stemMidX = p.x + nrm.nx * (CONFIG.labelOffset * 0.6) * side;
    const stemMidY = p.y + nrm.ny * (CONFIG.labelOffset * 0.6) * side;
    const stem = add(svg, 'path', {
      d: `M${p.x + nrm.nx * 25 * side},${p.y + nrm.ny * 25 * side} Q${stemMidX},${stemMidY} ${labX - nrm.nx * 15 * side},${labY - 10}`,
      fill: 'none',
      stroke: CONFIG.stem.stroke,
      'stroke-width': CONFIG.stem.width,
      opacity: CONFIG.stem.opacity
    });

    // YEAR (enhanced)
    const year = textNode(svg, labX, labY + CONFIG.yearDy, item.year || '', {
      anchor, size: 20, weight: 800, color: '#2c5a85'
    });

    // TITLE (wrapped with better handling)
    const labelGroup = addWrappedText(
      svg, labX, labY + CONFIG.titleDy,
      item.title || '', anchor,
      CONFIG.wrap.maxWidth, CONFIG.wrap.lineHeight, CONFIG.wrap.lines,
      svg
    );

    // Enhanced background with border
    if (CONFIG.showLabelBg) {
      const rect = rectFromElements([year, labelGroup]);
      const r = inflate(rect, CONFIG.labelPad);
      const bg = add(svg, 'rect', {
        x: r.x, y: r.y, width: r.w, height: r.h,
        rx: CONFIG.labelBg.rx, ry: CONFIG.labelBg.ry,
        fill: CONFIG.labelBg.fill,
        opacity: CONFIG.labelBg.opacity,
        stroke: CONFIG.labelBg.stroke,
        'stroke-width': CONFIG.labelBg.strokeWidth
      });
      bg.parentNode.insertBefore(bg, year);
    }

    // Enhanced anti-collision with more attempts
    let rect = rectFromElements([year, labelGroup]);
    let bumped = 0;
    while (placed.some(pr => intersects(pr, rect)) && bumped < CONFIG.maxCollisionBumps) {
      const dx = nrm.nx * CONFIG.bumpDistance * side;
      const dy = nrm.ny * CONFIG.bumpDistance * side;
      
      // Move all text elements
      [year, ...labelGroup.querySelectorAll('text')].forEach(t => {
        t.setAttribute('x', +t.getAttribute('x') + dx);
        t.setAttribute('y', +t.getAttribute('y') + dy);
      });
      
      rect = rectFromElements([year, labelGroup]);
      bumped++;
    }
    
    placed.push(inflate(rect, 8));
  });
}

// Expose to puppeteer
window.renderTimeline = renderTimeline;
if (window.TIMELINE) window.renderTimeline(window.TIMELINE);