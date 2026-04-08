// image-extractor.js
import { PALETTES, current, locks, setLocks } from '../core/state.js';
import { rgbToHex } from '../utils/color-utils.js';
import { updateURL } from '../core/url-manager.js';
import { getColorName } from '../utils/color-namer.js';

let _render = () => {};
export function setRenderCallback(fn) { _render = fn; }

let mode = 'auto'; // 'auto' | 'pick'
let selectedColors = []; // { hex, px, py } where px/py are 0-1 fractions
let imgBitmap = null;
let offCanvas = null, offCtx = null;

export function closeImgModal() {
  document.getElementById('img-modal').classList.remove('open');
  document.getElementById('img-status').textContent = '';
  selectedColors = [];
  imgBitmap = null; offCanvas = null; offCtx = null;
  document.getElementById('img-drop').style.display = 'block';
  document.getElementById('img-picker-area').style.display = 'none';
  document.getElementById('img-pick-controls').style.display = 'none';
  document.getElementById('img-loupe').style.display = 'none';
  document.getElementById('img-selected-strip').innerHTML = '<div class="strip-empty" id="img-strip-empty">click colors on the image above</div>';
  document.getElementById('img-count-num').textContent = '0';
  switchMode('auto');
  updateExtractBtn();
}

export function handleBackdropClick(e) {
  if (e.target === document.getElementById('img-modal')) closeImgModal();
}

export function switchImgMode(m) {
  mode = m;
  document.querySelectorAll('.img-mode-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === m)
  );
  updatePickControls();
  if (imgBitmap) {
    updateExtractBtn();
    renderPickerCanvas();
  }
}

function switchMode(m) {
  mode = m;
  document.querySelectorAll('.img-mode-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === m)
  );
}

function updatePickControls() {
  const show = mode === 'pick' && !!imgBitmap;
  document.getElementById('img-pick-controls').style.display = show ? 'block' : 'none';
  const canvas = document.getElementById('img-picker-canvas');
  canvas.style.cursor = (mode === 'pick') ? 'crosshair' : 'default';
}

function updateExtractBtn() {
  const btn = document.getElementById('img-extract-btn');
  if (!imgBitmap) { 
    btn.disabled = true; 
    btn.textContent = 'load an image first'; 
    btn.style.display = 'none';
    return; 
  }
  btn.style.display = 'block';
  if (mode === 'auto') { btn.disabled = false; btn.textContent = 'extract palette'; return; }
  if (selectedColors.length === 0) { btn.disabled = true; btn.textContent = 'pick at least one color'; return; }
  btn.disabled = false;
  btn.textContent = `use ${selectedColors.length} selected color${selectedColors.length > 1 ? 's' : ''}`;
}

export function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    offCanvas = document.createElement('canvas');
    offCanvas.width = img.naturalWidth;
    offCanvas.height = img.naturalHeight;
    offCtx = offCanvas.getContext('2d');
    offCtx.drawImage(img, 0, 0);
    imgBitmap = img;
    document.getElementById('img-drop').style.display = 'none';
    document.getElementById('img-picker-area').style.display = 'block';
    renderPickerCanvas();
    updatePickControls();
    updateExtractBtn();
    document.getElementById('img-status').textContent = '';
  };
  img.src = url;
}

function renderPickerCanvas() {
  const area = document.getElementById('img-picker-area');
  const canvas = document.getElementById('img-picker-canvas');
  const dpr = window.devicePixelRatio || 1;
  const w = area.clientWidth, h = area.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const ar = imgBitmap.naturalWidth / imgBitmap.naturalHeight;
  let dw = w, dh = w / ar;
  if (dh > h) { dh = h; dw = h * ar; }
  const dx = (w - dw) / 2, dy = (h - dh) / 2;
  ctx.drawImage(imgBitmap, dx, dy, dw, dh);
  // draw selection dots only in pick mode
  if (mode === 'pick') {
    selectedColors.forEach(sc => {
      const px = sc.px * w, py = sc.py * h;
      ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = sc.hex; ctx.fill();
    });
  }
}

function getPixelAt(x, y) {
  const area = document.getElementById('img-picker-area');
  const w = area.clientWidth, h = area.clientHeight;
  const ar = imgBitmap.naturalWidth / imgBitmap.naturalHeight;
  let dw = w, dh = w / ar;
  if (dh > h) { dh = h; dw = h * ar; }
  const dx = (w - dw) / 2, dy = (h - dh) / 2;
  if (x < dx || x > dx + dw || y < dy || y > dy + dh) return null;
  const imgX = Math.round((x - dx) / dw * imgBitmap.naturalWidth);
  const imgY = Math.round((y - dy) / dh * imgBitmap.naturalHeight);
  const d = offCtx.getImageData(imgX, imgY, 1, 1).data;
  if (d[3] < 128) return null;
  return { r: d[0], g: d[1], b: d[2], hex: rgbToHex(d[0], d[1], d[2]) };
}

export function initPickerCanvas() {
  const canvas = document.getElementById('img-picker-canvas');
  const loupeEl = document.getElementById('img-loupe');
  const loupeCanvas = document.getElementById('img-loupe-canvas');
  const loupeCtx = loupeCanvas.getContext('2d');

  canvas.addEventListener('mousemove', e => {
    if (!imgBitmap || mode !== 'pick') { loupeEl.style.display = 'none'; return; }
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const pixel = getPixelAt(x, y);
    if (!pixel) { loupeEl.style.display = 'none'; return; }

    loupeEl.style.display = 'block';
    const lx = x + 16, ly = y - 96;
    loupeEl.style.left = Math.min(rect.width - 80, Math.max(0, lx)) + 'px';
    loupeEl.style.top  = Math.min(rect.height - 80, Math.max(0, ly)) + 'px';

    const area = document.getElementById('img-picker-area');
    const w = area.clientWidth, h = area.clientHeight;
    const ar = imgBitmap.naturalWidth / imgBitmap.naturalHeight;
    let dw = w, dh = w / ar;
    if (dh > h) { dh = h; dw = h * ar; }
    const dx = (w - dw) / 2, dy = (h - dh) / 2;
    const imgX = (x - dx) / dw * imgBitmap.naturalWidth;
    const imgY = (y - dy) / dh * imgBitmap.naturalHeight;
    loupeCtx.clearRect(0, 0, 80, 80);
    loupeCtx.drawImage(offCanvas, imgX - 10, imgY - 10, 20, 20, 0, 0, 80, 80);
    // color swatch in loupe
    loupeCtx.fillStyle = pixel.hex;
    loupeCtx.beginPath(); loupeCtx.arc(40, 70, 7, 0, Math.PI * 2); loupeCtx.fill();
    loupeCtx.strokeStyle = 'rgba(255,255,255,0.8)'; loupeCtx.lineWidth = 1.5; loupeCtx.stroke();
  });

  canvas.addEventListener('mouseleave', () => { loupeEl.style.display = 'none'; });

  canvas.addEventListener('click', e => {
    if (!imgBitmap || mode !== 'pick') return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const pixel = getPixelAt(x, y);
    if (!pixel) return;
    if (selectedColors.length >= 15) {
      document.getElementById('img-status').textContent = 'max 15 colors';
      setTimeout(() => document.getElementById('img-status').textContent = '', 1500);
      return;
    }
    if (selectedColors.some(c => c.hex === pixel.hex)) return;
    const area = document.getElementById('img-picker-area');
    selectedColors.push({ ...pixel, px: x / area.clientWidth, py: y / area.clientHeight });
    renderPickerCanvas();
    updateStrip();
    updateExtractBtn();
  });

  window.addEventListener('resize', () => { if (imgBitmap) renderPickerCanvas(); });
}

function updateStrip() {
  const strip = document.getElementById('img-selected-strip');
  strip.innerHTML = '';
  document.getElementById('img-count-num').textContent = selectedColors.length;
  if (selectedColors.length === 0) {
    strip.innerHTML = '<div class="strip-empty">click colors on the image above</div>';
    return;
  }
  selectedColors.forEach((c, i) => {
    const chip = document.createElement('div');
    chip.className = 'sel-chip';
    chip.style.background = c.hex;
    chip.title = c.hex;
    chip.innerHTML = `<div class="sel-chip-x"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>`;
    chip.onclick = () => { selectedColors.splice(i, 1); renderPickerCanvas(); updateStrip(); updateExtractBtn(); };
    strip.appendChild(chip);
  });
}

export function clearImgSelected() {
  selectedColors = [];
  renderPickerCanvas();
  updateStrip();
  updateExtractBtn();
}

function kMeansColors(pixels, k, iters = 18) {
  const step = Math.max(1, Math.floor(pixels.length / 1200)), sample = [];
  for (let i = 0; i < pixels.length; i += step) sample.push(pixels[i]);
  const sorted = [...sample].sort((a, b) => (b[0] * .21 + b[1] * .72 + b[2] * .07) - (a[0] * .21 + a[1] * .72 + a[2] * .07));
  let centers = Array.from({ length: k }, (_, i) => [...sorted[Math.floor(i * sorted.length / k)]]);
  const assign = new Int32Array(sample.length);
  for (let iter = 0; iter < iters; iter++) {
    let moved = false;
    for (let j = 0; j < sample.length; j++) {
      const px = sample[j]; let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) { const d = (px[0]-centers[c][0])**2+(px[1]-centers[c][1])**2+(px[2]-centers[c][2])**2; if(d<bd){bd=d;best=c;} }
      if (assign[j] !== best) { assign[j] = best; moved = true; }
    }
    if (!moved) break;
    const sums = Array.from({ length: k }, () => [0,0,0,0]);
    for (let j = 0; j < sample.length; j++) { const c=assign[j],px=sample[j]; sums[c][0]+=px[0];sums[c][1]+=px[1];sums[c][2]+=px[2];sums[c][3]++; }
    centers = sums.map((s, ci) => s[3] > 0 ? [Math.round(s[0]/s[3]),Math.round(s[1]/s[3]),Math.round(s[2]/s[3])] : centers[ci]);
  }
  const counts = new Array(k).fill(0);
  for (let j = 0; j < sample.length; j++) counts[assign[j]]++;
  return centers.map((c, i) => ({ color: c, count: counts[i], pct: counts[i] / sample.length }));
}

export function extractColors() {
  if (!imgBitmap) { document.getElementById('img-status').textContent = 'no image loaded'; return; }

  if (mode === 'pick') {
    if (selectedColors.length === 0) { document.getElementById('img-status').textContent = 'no colors selected'; return; }
    PALETTES[current].name = 'extracted';
    PALETTES[current].colors = selectedColors.map(c => c.hex);
    PALETTES[current].names = selectedColors.map(c => getColorName(c.hex) || 'color');
    setLocks(PALETTES[current].colors.map(() => false));
    updateURL();
    document.getElementById('img-status').textContent = `used ${selectedColors.length} selected colors`;
    setTimeout(() => { closeImgModal(); _render(); }, 500);
    return;
  }

  document.getElementById('img-status').textContent = 'analyzing…';
  const MAX = 320, canvas = document.createElement('canvas');
  const scale = Math.min(1, MAX / Math.max(imgBitmap.naturalWidth, imgBitmap.naturalHeight));
  canvas.width = Math.max(1, Math.round(imgBitmap.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(imgBitmap.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  try {
    ctx.drawImage(imgBitmap, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data, pixels = [];
    for (let i = 0; i < data.length; i += 4) { if (data[i+3] < 128) continue; pixels.push([data[i],data[i+1],data[i+2]]); }
    if (pixels.length === 0) { document.getElementById('img-status').textContent = 'no opaque pixels found'; return; }
    const clusters = kMeansColors(pixels, 9).filter(c => c.pct >= 0.03).sort((a,b) => b.count - a.count).slice(0, 15);
    if (clusters.length === 0) { document.getElementById('img-status').textContent = 'no dominant colors found'; return; }
    PALETTES[current].name = 'extracted';
    PALETTES[current].colors = clusters.map(c => rgbToHex(c.color[0], c.color[1], c.color[2]));
    PALETTES[current].names = clusters.map(c => getColorName(rgbToHex(c.color[0], c.color[1], c.color[2])) || 'color');
    setLocks(PALETTES[current].colors.map(() => false));
    updateURL();
    document.getElementById('img-status').textContent = `extracted ${clusters.length} colors`;
    setTimeout(() => { closeImgModal(); _render(); }, 500);
  } catch(e) { document.getElementById('img-status').textContent = 'could not read image (CORS?)'; }
}