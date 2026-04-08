import { PALETTES, current } from '../core/state.js';
import { hexToRgb, textColor, luminance, getDisplay } from '../utils/color-utils.js';

// Shared roundRect helper (no longer duplicated in export-utils)
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Detect the current viz type from the URL path.
 * Works for both /ColorVisualizer/geo and colors.ravgo.dev/geo
 */
function detectVizType() {
  const pathParts = location.pathname.split('/').filter(Boolean);
  const last = pathParts[pathParts.length - 1];
  const vizMap = { geo: 'geo', typo: 'type', layers: 'depth', gradient: 'flow' };
  return vizMap[last] || 'palette';
}

/**
 * Build the OG worker URL for the current palette + viz type.
 * Uses the same packed-hex + theme-suffix format as url-manager.js buildURL(),
 * so the worker receives exactly the same string it would get from a real page URL.
 *
 * URL shapes:
 *   Title card:  https://og.colors.ravgo.dev/
 *   Palette:     https://og.colors.ravgo.dev/[slug/]<hexes><theme>
 *   Viz:         https://og.colors.ravgo.dev/[slug/]<hexes><theme>/<vizSlug>
 *
 * vizSlug mapping (worker side): geo→geo, type→typo, depth→layers, flow→gradient
 */
const OG_BASE = 'https://og.colors.ravgo.dev';
const VIZ_SLUG = { geo: 'geo', type: 'typo', depth: 'layers', flow: 'gradient' };

function packHexes(colors) {
  const bytes = new Uint8Array(colors.length * 3);
  colors.forEach((c, i) => {
    const n = parseInt(c.replace('#', ''), 16);
    bytes[i * 3]     = (n >> 16) & 0xff;
    bytes[i * 3 + 1] = (n >> 8)  & 0xff;
    bytes[i * 3 + 2] =  n        & 0xff;
  });
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeMeta(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(b64);
    return decoded.split('|').map(n => n === '_' ? null : n);
  } catch {
    return [];
  }
}

function isValidHex(str) {
  return /^[0-9A-Fa-f]{6}$/.test(str);
}

function unpackHexes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const colors = [];
  for (let i = 0; i < binary.length; i += 3) {
    const n = (binary.charCodeAt(i) << 16) |
              (binary.charCodeAt(i + 1) << 8) |
               binary.charCodeAt(i + 2);
    colors.push('#' + n.toString(16).padStart(6, '0'));
  }
  return colors;
}

const VIZ_TYPES = ['geo', 'typo', 'layers', 'gradient'];
const VIZ_MAP = { geo: 'geo', typo: 'type', layers: 'depth', gradient: 'flow' };

function parseOGPath(pathname) {
  const parts = pathname.replace(/^\/+/g, '').split('/').filter(Boolean);
  if (!parts.length) return null;

  let vizType = 'palette';
  if (VIZ_TYPES.includes(parts[parts.length - 1])) {
    vizType = VIZ_MAP[parts.pop()];
  }

  let slug = '';
  let hexPart = '';
  if (parts.length === 1) {
    hexPart = parts[0];
  } else if (parts.length >= 2) {
    slug = parts[0];
    hexPart = parts[1];
  } else {
    return null;
  }

  let metaPart = null;
  if (hexPart.includes('~')) {
    [hexPart, metaPart] = hexPart.split('~');
  }

  let isLight = false;
  if (hexPart.endsWith('L')) {
    isLight = true;
    hexPart = hexPart.slice(0, -1);
  } else if (hexPart.endsWith('B')) {
    isLight = false;
    hexPart = hexPart.slice(0, -1);
  }

  let colors;
  const rawHexes = hexPart.split('-').filter(Boolean);
  if (rawHexes.every(isValidHex)) {
    colors = rawHexes.map(h => '#' + h);
  } else {
    try {
      colors = unpackHexes(hexPart);
    } catch {
      return null;
    }
    if (!colors.length || !colors.every(c => isValidHex(c.slice(1)))) return null;
  }

  const names = metaPart ? decodeMeta(metaPart) : colors.map(() => null);
  return {
    colors,
    names,
    slug: slug.replace(/-/g, ' ') || 'untitled',
    isLight,
    vizType,
  };
}

function buildOGUrl(palette, vizType) {
  // Title card — no palette needed
  if (!palette || vizType === 'titlecard') return OG_BASE + '/';

  const theme = palette.theme === 'L' ? 'L'
    : palette.theme === 'B' ? 'B'
    : palette.isLight === true ? 'L'
    : palette.isLight === false ? 'B'
    : (typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'L' : 'B');

  const hexes = packHexes(palette.colors);
  const slug = (palette.name || '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

  const palettePart = slug && slug !== 'untitled'
    ? `${slug}/${hexes}${theme}`
    : `${hexes}${theme}`;

  const vizSlug = VIZ_SLUG[vizType];
  return vizSlug
    ? `${OG_BASE}/${palettePart}/${vizSlug}`
    : `${OG_BASE}/${palettePart}`;
}

/**
 * Generate PNG preview image.
 *
 * Strategy:
 *   1. Build the OG worker URL for the current palette + viz type.
 *   2. Fetch the SVG from og.colors.ravgo.dev (returns image/svg+xml).
 *   3. Rasterise it onto a canvas via an <img> element, then export as PNG.
 *
 * Falls back to the legacy canvas renderer if the fetch fails (e.g. offline /
 * CORS in dev environments that don't proxy the worker).
 *
 * Returns a data URL (base64 PNG).
 */
export async function generatePreviewPNG() {
  const p = PALETTES[current];
  const type = detectVizType();

  // ── Try OG worker path first ──────────────────────────────────────────────
  try {
    const ogUrl = buildOGUrl(p, type);
    const svg = await fetchSVG(ogUrl);
    if (svg) {
      const dataUrl = await svgToPng(svg, getOutputDimensions(type));
      if (dataUrl) return dataUrl;
    }
  } catch (err) {
    console.warn('[embed-generator] OG worker fetch failed, falling back to canvas:', err);
  }

  // ── Legacy canvas fallback ────────────────────────────────────────────────
  return generatePreviewPNGCanvas();
}

/**
 * Fetch an SVG string from the OG worker URL.
 * Returns null on failure rather than throwing.
 */
async function fetchSVG(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('svg') && !ct.includes('xml')) return null;
  return res.text();
}

/**
 * Rasterise an SVG string to a PNG data URL at the given dimensions.
 */
function svgToPng(svgText, { width, height }) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')); };
    img.src = url;
  });
}

/**
 * Return the pixel dimensions the worker outputs for a given viz type.
 * Palette = 1200×630, all square viz = 630×630.
 */
function getOutputDimensions(vizType) {
  if (vizType === 'palette' || vizType === 'titlecard') return { width: 1200, height: 630 };
  return { width: 630, height: 630 };
}

// ── Legacy canvas renderer (fallback) ────────────────────────────────────────
// Kept intact so offline / dev environments still work.

async function generatePreviewPNGCanvas() {
  const p = PALETTES[current];
  // Use CVD-simulated colors so preview matches the current vision mode
  const cols = getDisplay();
  const names = p.names;
  const isLight = document.documentElement.classList.contains('light');
  const type = detectVizType();

  const n = cols.length;
  const SCALE = 2;
  const W = 1400;
  const H = 600;
  const PAD = 60;
  const GAP = 8;
  const SW = (W - PAD * 2 - GAP * (n - 1)) / n;
  const SH = H - PAD * 2 - 70;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;

  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  // Background
  roundRect(ctx, 0, 0, W, H, 24);
  ctx.clip();
  ctx.fillStyle = isLight ? '#ffffff' : '#0e0e16';
  ctx.fillRect(0, 0, W, H);

  if (type === 'palette') {
    // Header
    ctx.font = `500 13px "JetBrains Mono", monospace`;
    ctx.letterSpacing = '3px';
    ctx.fillStyle = isLight ? 'rgba(12,12,28,.4)' : 'rgba(255,255,255,.3)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('PALETTE — ' + p.name.toUpperCase(), PAD, PAD - 18);

    // Footer
    ctx.textAlign = 'right';
    ctx.fillText('colors.ravgo.dev', W - PAD, H - 20);

    // Color swatches
    cols.forEach((c, i) => {
      const x = PAD + i * (SW + GAP);
      const y = PAD;
      roundRect(ctx, x, y, SW, SH, 14);
      ctx.fillStyle = c;
      ctx.fill();

      const tc = textColor(c);
      ctx.font = `400 ${Math.max(10, Math.min(12, SW * 0.1))}px "JetBrains Mono", monospace`;
      ctx.letterSpacing = '2px';
      ctx.fillStyle = tc === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText((names[i] || '').toUpperCase(), x + SW / 2, y + SH - 18);

      ctx.font = `500 ${Math.max(11, Math.min(14, SW * 0.13))}px "JetBrains Mono", monospace`;
      ctx.letterSpacing = '1px';
      ctx.fillStyle = isLight ? 'rgba(12,12,28,.6)' : 'rgba(255,255,255,.5)';
      ctx.fillText(c.toUpperCase(), x + SW / 2, y + SH + 30);
    });
  } else {
    // Viz rendering
    ctx.font = `500 16px "JetBrains Mono", monospace`;
    ctx.letterSpacing = '3px';
    ctx.fillStyle = isLight ? 'rgba(12,12,28,.4)' : 'rgba(255,255,255,.3)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const titles = { geo: 'GEOMETRY', type: 'TYPOGRAPHY', depth: 'DEPTH & LAYERS', flow: 'GRADIENT FLOW' };
    ctx.fillText(titles[type] || type.toUpperCase(), PAD, PAD);
    ctx.font = `400 14px "JetBrains Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('colors.ravgo.dev', W - PAD, H - 16);

    const cw = W - PAD * 2, ch = H - PAD * 2 - 60, cx = PAD, cy = PAD + 40;
    const d = cols;

    if (type === 'geo') {
      const nn = Math.min(5, d.length), r = 140, spacing = 110;
      const startX = cx + cw / 2 - ((nn - 1) * spacing) / 2, centerY = cy + ch / 2;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 12;
      for (let i = 0; i < nn; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * spacing, centerY, r, 0, Math.PI * 2);
        ctx.fillStyle = d[Math.floor(i * (d.length / nn))];
        ctx.fill();
      }
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
      ctx.globalCompositeOperation = 'hard-light';
      for (let i = 0; i < nn; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * spacing, centerY, r, 0, Math.PI * 2);
        ctx.fillStyle = d[Math.floor(i * (d.length / nn))];
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

    } else if (type === 'flow') {
      const grad = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
      d.forEach((c, i) => grad.addColorStop(i / (d.length - 1 || 1), c));
      roundRect(ctx, cx, cy, cw, ch, 16);
      ctx.fillStyle = grad;
      ctx.fill();

    } else if (type === 'depth') {
      const cards = Math.min(3, d.length), cardW = 220, cardH = 320;
      for (let i = 0; i < cards; i++) {
        const cIdx = d.length - 1 - i;
        ctx.fillStyle = d[cIdx];
        ctx.shadowColor = 'rgba(0,0,0,0.28)';
        ctx.shadowBlur = 40;
        ctx.shadowOffsetX = -10;
        ctx.shadowOffsetY = 15;
        const x = cx + cw / 2 - cardW / 2 + (i * 50 - 50), y = cy + ch / 2 - cardH / 2 + (i * 30 - 30);
        roundRect(ctx, x, y, cardW, cardH, 24);
        ctx.fill();
      }
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

    } else if (type === 'type') {
      const sorted = [...d].sort((a, b) => luminance(a) - luminance(b));
      const bg = sorted[0], textMain = sorted[d.length - 1], accent = d[Math.min(Math.floor(d.length * 0.6), d.length - 1)];
      const palName = p.name.toUpperCase();
      const leftW = Math.round(cw * 0.82), rightW = cw - leftW;
      roundRect(ctx, cx, cy, leftW, ch, 0);
      ctx.fillStyle = bg;
      ctx.fill();
      const swH = ch / d.length;
      d.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(cx + leftW, cy + i * swH, rightW, swH + 1); });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `600 15px "JetBrains Mono", monospace`; ctx.letterSpacing = '4px';
      ctx.fillStyle = accent; ctx.globalAlpha = 0.8;
      ctx.fillText(palName, cx + 55, cy + 80); ctx.globalAlpha = 1;
      ctx.font = '900 72px Orbitron, sans-serif'; ctx.letterSpacing = '-3px'; ctx.fillStyle = textMain;
      ctx.fillText('Hello,', cx + 55, cy + 200); ctx.fillText('World.', cx + 55, cy + 295);
      ctx.font = '400 22px Orbitron, sans-serif'; ctx.letterSpacing = '0px';
      ctx.fillStyle = textMain; ctx.globalAlpha = 0.6;
      ctx.fillText('Designing with color is designing', cx + 55, cy + 375);
      ctx.fillText('with emotion.', cx + 55, cy + 410); ctx.globalAlpha = 1;
      const bw = 196, bh = 54, bx = cx + 55, by = cy + ch - 100;
      roundRect(ctx, bx, by, bw, bh, 27); ctx.fillStyle = accent; ctx.fill();
      ctx.fillStyle = textColor(accent);
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '2px';
      ctx.fillText('EXPLORE', bx + bw / 2, by + bh / 2);
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generate OG meta tags.
 * Uses the OG worker URL as og:image so social crawlers (Discord, Twitter, Slack)
 * can fetch a real image URL rather than an unusable data URL.
 */
export function generateOGMetaTags(slugUrl) {
  const palette = PALETTES[current];
  const type = detectVizType();
  const fullUrl = `${window.location.origin}/${slugUrl}`;
  const ogImageUrl = buildOGUrl(palette, type);

  const isSquare = type !== 'palette' && type !== 'titlecard';
  const imgWidth  = isSquare ? '630' : '1200';
  const imgHeight = isSquare ? '630' : '630';

  const metaTags = [
    { property: 'og:title',        content: palette.name },
    { property: 'og:url',          content: fullUrl },
    { property: 'og:type',         content: 'website' },
    { property: 'og:image',        content: ogImageUrl },
    { property: 'og:image:width',  content: imgWidth },
    { property: 'og:image:height', content: imgHeight },
    { property: 'og:site_name',    content: 'Color Palette Visualizer • colors.ravgo.dev' },
    { name: 'twitter:card',        content: 'summary_large_image' },
    { name: 'twitter:title',       content: palette.name },
    { name: 'twitter:image',       content: ogImageUrl },
  ];

  return metaTags.map(attrs => {
    const el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
  });
}