// src/timeline.js
export function renderTimeline(data){
  const W = 1280, H = 800;
  const svgNS = 'http://www.w3.org/2000/svg';

  const root = document.getElementById('root');
  if (!root) { console.error('No #root element'); return; }
  root.innerHTML = '';

  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('id','svgRoot');
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.background = '#ffffff';

  // Title
  const titleG = document.createElementNS(svgNS,'g');
  const title = document.createElementNS(svgNS,'text');
  title.setAttribute('x', 60); title.setAttribute('y', 80);
  title.setAttribute('font-weight','800');
  title.setAttribute('font-size','42');
  title.setAttribute('fill','#1d3146');
  title.textContent = data.title || 'Timeline';
  titleG.appendChild(title);

  const sub = document.createElementNS(svgNS,'text');
  sub.setAttribute('x', 60); sub.setAttribute('y', 110);
  sub.setAttribute('font-weight','600');
  sub.setAttribute('font-size','18');
  sub.setAttribute('fill','#6b7a90');
  sub.textContent = data.subtitle || '';
  titleG.appendChild(sub);
  svg.appendChild(titleG);

  // Curve
  const path = document.createElementNS(svgNS,'path');
  path.setAttribute('id','curve');
  path.setAttribute('d','M120,620 C380,340 720,420 1140,200');
  path.setAttribute('fill','none');
  path.setAttribute('stroke','#c6d3df');
  path.setAttribute('stroke-width','10');
  path.setAttribute('stroke-linecap','round');
  svg.appendChild(path);

  // Nodes + labels
  const items = data.items || [];
  const N = items.length;
  const total = path.getTotalLength();
  const inset = total * 0.03;
  const step = (total - inset*2) / Math.max(1, (N-1));

  items.forEach((item, i) => {
    const p = path.getPointAtLength(inset + i*step);
    const g = document.createElementNS(svgNS,'g');

    const outer = document.createElementNS(svgNS,'circle');
    outer.setAttribute('cx', p.x); outer.setAttribute('cy', p.y);
    outer.setAttribute('r', 30); outer.setAttribute('fill', '#2c5a85');
    g.appendChild(outer);

    const inner = document.createElementNS(svgNS,'circle');
    inner.setAttribute('cx', p.x); inner.setAttribute('cy', p.y);
    inner.setAttribute('r', 22); inner.setAttribute('fill', '#3f7fb5');
    g.appendChild(inner);

    const num = document.createElementNS(svgNS,'text');
    num.setAttribute('x', p.x); num.setAttribute('y', p.y+6);
    num.setAttribute('text-anchor','middle');
    num.setAttribute('font-size','18');
    num.setAttribute('font-weight','800');
    num.setAttribute('fill','#fff');
    num.textContent = (i+1).toString();
    g.appendChild(num);

    const right = i % 2 === 0;
    const dx = right ? 36 : -36;
    const anchor = right ? 'start' : 'end';

    const year = document.createElementNS(svgNS,'text');
    year.setAttribute('x', p.x + dx);
    year.setAttribute('y', p.y - 38);
    year.setAttribute('text-anchor', anchor);
    year.setAttribute('font-size','26');
    year.setAttribute('font-weight','800');
    year.setAttribute('fill','#2c5a85');
    year.textContent = item.year || '';
    g.appendChild(year);

    const ttl = document.createElementNS(svgNS,'text');
    ttl.setAttribute('x', p.x + dx);
    ttl.setAttribute('y', p.y - 14);
    ttl.setAttribute('text-anchor', anchor);
    ttl.setAttribute('font-size','16');
    ttl.setAttribute('font-weight','800');
    ttl.setAttribute('fill','#1d3146');
    ttl.textContent = item.title || '';
    g.appendChild(ttl);

    svg.appendChild(g);
  });

  root.appendChild(svg);
}

// 👇 critical: expose it globally so Puppeteer can call it
window.renderTimeline = renderTimeline;

// Optional: auto-render if TIMELINE was set before this script loaded
if (window.TIMELINE) window.renderTimeline(window.TIMELINE);
