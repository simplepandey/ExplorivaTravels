'use strict';
// Generates original abstract landscape placeholders (SVG) in public/img/trips/.
// Replace them with real photos any time; run: node scripts/make-placeholders.js
const fs = require('fs');
const path = require('path');
const out = path.join(__dirname, '..', 'public', 'img', 'trips');
fs.mkdirSync(out, { recursive: true });

const W = 1200, H = 900;
const ridge = (y, amp, seed, fill) => {
  let d = `M0 ${H} L0 ${y}`;
  for (let x = 0; x <= W; x += 60) d += ` L${x} ${Math.round(y - amp * Math.abs(Math.sin(x / 140 + seed)) - amp * 0.4 * Math.sin(x / 61 + seed * 2))}`;
  return `<path d="${d} L${W} ${H} Z" fill="${fill}"/>`;
};
const waves = (y, fill, seed) => {
  let d = `M0 ${H} L0 ${y}`;
  for (let x = 0; x <= W; x += 40) d += ` L${x} ${Math.round(y + 14 * Math.sin(x / 70 + seed))}`;
  return `<path d="${d} L${W} ${H} Z" fill="${fill}"/>`;
};
const dome = (cx, base, r, fill) => `<g fill="${fill}"><rect x="${cx - r}" y="${base - r}" width="${r * 2}" height="${r}"/><path d="M${cx - r} ${base - r} A${r} ${r} 0 0 1 ${cx + r} ${base - r} Z"/><rect x="${cx - 4}" y="${base - r * 2 - 40}" width="8" height="40"/></g>`;
const palm = (x, base, h, fill) => `<g stroke="${fill}" stroke-width="10" stroke-linecap="round" fill="none"><path d="M${x} ${base} Q${x + 20} ${base - h / 2} ${x + 10} ${base - h}"/><path d="M${x + 10} ${base - h} q-70 -10 -110 40 M${x + 10} ${base - h} q70 -10 110 40 M${x + 10} ${base - h} q-30 -50 -90 -50 M${x + 10} ${base - h} q30 -50 90 -50"/></g>`;
const sun = (x, y, r, fill, o = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${o}"/>`;
const star = (n) => Array.from({ length: n }, (_, i) => `<circle cx="${(i * 197) % W}" cy="${(i * 89) % 380}" r="${1 + (i % 3)}" fill="#fff" opacity=".8"/>`).join('');

const svg = (grad, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${grad[0]}"/><stop offset="1" stop-color="${grad[1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${body}</svg>\n`;

const sets = {
  rajasthan: [
    [['#F6B26B', '#FCE5CD'], sun(820, 330, 110, '#E85D2A', .9) + ridge(640, 40, 1, '#C96A3B') + dome(300, 700, 90, '#8E3B1E') + dome(520, 700, 60, '#8E3B1E') + `<rect y="700" width="${W}" height="200" fill="#6D2B14"/>`],
    [['#FFD59A', '#F9A66C'], sun(300, 260, 90, '#fff3d6') + ridge(600, 60, 3, '#D9822B') + ridge(720, 40, 5, '#B5541E') + `<rect y="780" width="${W}" height="120" fill="#7A2E12"/>`],
    [['#8E4B8E', '#F4A261'], sun(600, 480, 140, '#FFE29A', .95) + dome(200, 760, 110, '#3D1F3D') + dome(980, 760, 80, '#3D1F3D') + `<rect y="760" width="${W}" height="140" fill="#2B142B"/>`],
    [['#FDDCAF', '#E8A87C'], ridge(520, 90, 2, '#C0713A') + ridge(680, 60, 6, '#9E4F22') + ridge(800, 30, 4, '#7A3A18')],
  ],
  kerala: [
    [['#A8E6CF', '#E8F7EE'], sun(950, 200, 80, '#FFF3B0') + ridge(520, 50, 2, '#2E8B57') + waves(600, '#3AA6A0', 1) + palm(220, 640, 260, '#14532D')],
    [['#BDE0FE', '#E2F3FF'], waves(430, '#4FB0C6', 2) + waves(560, '#2C8DA3', 4) + waves(700, '#1F6F85', 6) + palm(900, 560, 220, '#166534')],
    [['#FFD6A5', '#FDFFB6'], sun(300, 520, 120, '#FF9F1C', .9) + waves(560, '#2A9D8F', 3) + waves(700, '#1D6F65', 5) + palm(980, 700, 300, '#0F3D2E')],
    [['#74C69D', '#D8F3DC'], ridge(380, 80, 4, '#40916C') + ridge(560, 70, 1, '#2D6A4F') + ridge(720, 50, 7, '#1B4332')],
  ],
  spiti: [
    [['#5C7AEA', '#DDE7FF'], ridge(420, 160, 1, '#F8FAFF') + ridge(560, 110, 3, '#8A97B8') + ridge(720, 70, 5, '#5B6682') + `<rect y="800" width="${W}" height="100" fill="#3D4663"/>`],
    [['#0B1D51', '#3A506B'], star(70) + sun(900, 200, 55, '#F1F5F9') + ridge(560, 140, 2, '#1C2541') + ridge(740, 80, 6, '#0B132B')],
    [['#F7B267', '#F4845F'], sun(300, 400, 100, '#FFF1C9') + ridge(520, 130, 4, '#8D5A4A') + ridge(700, 90, 1, '#5E3A31') + ridge(820, 40, 8, '#3B2420')],
    [['#9AD0EC', '#EAF6FD'], ridge(360, 120, 5, '#FFFFFF') + ridge(520, 100, 2, '#9FB3C8') + ridge(700, 80, 7, '#627D98')],
  ],
  bali: [
    [['#FFB4A2', '#FFE5D9'], sun(600, 420, 150, '#FFD166', .95) + waves(520, '#E5989B', 2) + waves(640, '#B5838D', 4) + waves(760, '#6D597A', 6)],
    [['#CDEAC0', '#F2FFE8'], ridge(300, 70, 1, '#7FB069') + ridge(470, 90, 4, '#5A9C4B') + ridge(640, 60, 2, '#3D7A33') + ridge(780, 40, 8, '#26561F')],
    [['#FFE066', '#FF8C42'], sun(880, 300, 90, '#FFF8DC') + waves(600, '#2A9D8F', 1) + palm(260, 700, 300, '#134E4A') + palm(420, 720, 240, '#0F3D3A') + waves(780, '#1D6F65', 5)],
    [['#E0AAFF', '#F8EDFF'], sun(300, 300, 70, '#fff') + ridge(560, 90, 3, '#9D4EDD') + ridge(720, 60, 6, '#7B2CBF') + ridge(820, 30, 9, '#5A189A')],
  ],
};
for (const [name, imgs] of Object.entries(sets)) {
  imgs.forEach(([grad, body], i) => fs.writeFileSync(path.join(out, `${name}-${i + 1}.svg`), svg(grad, body)));
}
console.log('Wrote', Object.values(sets).flat().length, 'placeholder images to', out);
