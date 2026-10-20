const I = {
  spark: '<path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" fill="currentColor"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  bookmarkf: '<path d="M6 3h12v18l-6-4-6 4z" fill="currentColor"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 11a7 7 0 0014 0M12 18v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  search: '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  user: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  users: '<circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="9" r="2.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 20c.8-3.5 3.5-5 6.5-5s5.7 1.5 6.5 5M15.5 14.5c2.8-.3 5 1.2 6 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  walk: '<circle cx="13" cy="4" r="2" fill="currentColor"/><path d="M10 21l2-6 3 3v3M9 12l2-4 4 1 2 4M11 8l-1 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  filter: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="16" cy="7" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="17" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="4" cy="12" r="1.2" fill="currentColor"/><circle cx="4" cy="18" r="1.2" fill="currentColor"/>',
  link: '<path d="M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  reel: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9v6l5-3z" fill="currentColor"/>',
  chev: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9.5" r="2.5" fill="currentColor"/>',
  thumbup: '<path d="M7 10v10H4V10zM7 10l4-7c1.5 0 2.5 1 2.2 2.6L12.6 9H19a2 2 0 012 2.3l-1.3 7A2 2 0 0117.7 20H7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
};
function icon(n, cls = '') { return `<svg class="i ${cls}" viewBox="0 0 24 24">${I[n]}</svg>`; }
document.querySelectorAll('i[data-i]').forEach(el => { el.outerHTML = icon(el.dataset.i, el.className); });

// photo crops from the 18/10 mockup (our own AI image) -- x,y,w,h on a 1024x1536 image
const C = { 'roof-main': [240, 840, 550, 195], 'roof-right': [812, 875, 212, 200], 'roof-left': [0, 875, 212, 275],
  'pin1': [372, 292, 140, 140], 'pin2': [724, 242, 104, 104], 'pin3': [236, 587, 104, 104], 'pin4': [672, 622, 101, 101], 'pin2i': [740, 258, 72, 72], 'pin1i': [394, 314, 96, 96] };
document.querySelectorAll('[data-crop]').forEach(el => {
  el.classList.add('crop');
  const [x, y, w, h] = C[el.dataset.crop]; const W = el.offsetWidth, H = el.offsetHeight;
  const s = Math.max(W / w, H / h);
  el.style.backgroundSize = `${1024 * s}px ${1536 * s}px`;
  el.style.backgroundPosition = `${-(x * s) + (W - w * s) / 2}px ${-(y * s) + (H - h * s) / 2}px`;
});

// pseudo-map of central Rome (seeded) into any [data-map="light|dark|paper"]
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
document.querySelectorAll('[data-map]').forEach(el => {
  const t = el.dataset.map, W = el.offsetWidth, H = el.offsetHeight, r = rng(+(el.dataset.seed || 7));
  const P = { light: { bg: '#f2f1ee', st: '#ffffff', st2: '#e4e2dd', riv: '#cfe0e2', park: '#e3ebdc', lab: '#9aa0a6' },
    paper: { bg: '#f3efe8', st: '#fbf9f5', st2: '#e6e0d5', riv: '#d4e2e0', park: '#e4e8d6', lab: '#a39a8c' },
    dark: { bg: '#0f2427', st: '#1d3a3e', st2: '#16302f', riv: '#0a1a1c', park: '#123029', lab: '#5d7f82' } }[t];
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="${P.bg}"/>`;
  for (let k = 0; k < 4; k++) { const x = r() * W, y = r() * H; s += `<rect x="${x}" y="${y}" width="${40 + r() * 70}" height="${30 + r() * 60}" rx="10" fill="${P.park}" transform="rotate(${r() * 30 - 15} ${x} ${y})"/>`; }
  // blocks: two rotated grids
  for (const [ang, step, w] of [[-12, 34, 2], [70, 46, 2], [24, 90, 5], [-60, 120, 5]]) {
    s += `<g transform="rotate(${ang} ${W / 2} ${H / 2})">`;
    for (let x = -W; x < W * 2; x += step + r() * step * .6) s += `<line x1="${x}" y1="${-H}" x2="${x + (r() - .5) * 40}" y2="${H * 2}" stroke="${w > 3 ? P.st : P.st2}" stroke-width="${w > 3 ? w : 1.3 + r()}"/>`;
    s += '</g>';
  }
  const rx = W * (+(el.dataset.river || .12));
  s += `<path d="M${rx - 40} -20 C ${rx + 60} ${H * .2}, ${rx - 50} ${H * .35}, ${rx + 30} ${H * .5} S ${rx + 120} ${H * .8}, ${rx + 40} ${H + 20}" fill="none" stroke="${P.riv}" stroke-width="30" stroke-linecap="round"/>`;
  (el.dataset.labels || '').split('|').filter(Boolean).forEach(l => { const [n, x, y] = l.split(','); s += `<text x="${x}" y="${y}" fill="${P.lab}" font-family="Inter" font-size="12" font-weight="500" letter-spacing=".3">${n}</text>`; });
  s += '</svg>';
  el.insertAdjacentHTML('afterbegin', s);
});

// tab bar
function tabs(active, mode = '') {
  const t = [['spark', 'Assistente'], ['bookmark', 'Salvati'], ['map', 'Mappa'], ['users', 'Amici'], ['user', 'Profilo']];
  return `<nav class="tabs ${mode}">` + t.map(([i, l]) => l === 'Mappa'
    ? `<div class="t ${active === l ? 'on' : ''}"><div class="mid">${icon(i)}</div>${l}</div>`
    : `<div class="t ${active === l ? 'on' : ''}">${icon(active === l && i === 'bookmark' ? 'bookmarkf' : i)}${l}</div>`).join('') + '</nav>';
}
document.querySelectorAll('[data-tabs]').forEach(el => { el.outerHTML = tabs(el.dataset.tabs, el.dataset.mode || ''); });
document.querySelectorAll('[data-sb]').forEach(el => {
  el.outerHTML = `<div class="sb ${el.dataset.sb}"><span>9:41</span><span class="r"><svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="7" rx="1" fill="currentColor"/><rect x="10" y="2.5" width="3" height="9.5" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg><svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5l2.3-2.6a3.3 3.3 0 00-4.6 0zM3.6 6.8a6.2 6.2 0 018.8 0l1.4-1.6a8.4 8.4 0 00-11.6 0zM.4 3.4a10.8 10.8 0 0115.2 0L15.8 3" fill="currentColor"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor"/><rect x="24.5" y="4.5" width="2" height="4" rx="1" fill="currentColor" opacity=".4"/></svg></span></div>`;
});
document.body.dataset.ready = '1';
