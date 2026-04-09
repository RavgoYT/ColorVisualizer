// This code does nothing within this project. It is only here to be uploaded to the Cloudflare worker to run my Open Graph (OG) server.

const APP_ORIGIN = 'https://colors.ravgo.dev';
const UPSTREAM_HTML_ORIGIN = 'https://colors.ravgo.dev';
const OG_BASE = 'https://image-og.colors.ravgo.dev';

const VIZ_TYPES = ['geo', 'typo', 'layers', 'gradient'];
const VIZ_MAP = { geo: 'geo', typo: 'type', layers: 'depth', gradient: 'flow' };

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/' || pathname === '') {
      return handleTitleCard();
    }

    const parsed = parseOGUrl(pathname);
    if (!parsed) {
      return new Response('Not Found', { status: 404 });
    }

    return handleSvgRequest(parsed);
  } catch (error) {
    // For image worker, fail closed: return error instead of proxying
    // (upstream doesn't have these images, so 404 wouldn't be accurate)
    console.error('Image worker error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

function isValidHex(str) {
  return /^[0-9a-fA-F]{6}$/.test(str);
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

function decodeMeta(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(b64);
    return decoded.split('|').map(n => n === '_' ? null : n);
  } catch {
    return [];
  }
}

function parseOGUrl(pathname) {
  const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  if (!parts.length) return null;

  let vizType = 'palette';
  if (VIZ_TYPES.includes(parts[parts.length - 1])) {
    vizType = VIZ_MAP[parts.pop()];
  }

  let hexPart = '';
  let slug = '';
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

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  const rs = r / 255;
  const gs = g / 255;
  const bs = b / 255;
  const rLin = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
  const gLin = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
  const bLin = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

function textColor(hex) {
  return luminance(hex) > 0.3 ? '#0a0a0f' : '#ffffff';
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const W = 1200, H = 630, PAD = 50, GAP = 8;

function labelCol(isLight) {
  return isLight ? 'rgba(12,12,28,0.4)' : 'rgba(255,255,255,0.3)';
}

function makeSVG(width, height, isLight, inner) {
  const bg = isLight ? '#ffffff' : '#0e0e16';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <clipPath id="rc"><rect width="${width}" height="${height}" rx="24" ry="24"/></clipPath>
  </defs>
  <rect width="${width}" height="${height}" rx="24" ry="24" fill="${bg}"/>
  <g clip-path="url(#rc)">${inner}</g>
</svg>`;
}

function footerText(width, height, isLight) {
  const lc = labelCol(isLight);
  return `<text x="${width - PAD}" y="${height - 18}" text-anchor="end" font-family="monospace" font-size="13" fill="${lc}" letter-spacing="3">colors.ravgo.dev</text>`;
}

function buildTitleCard() {
  const sampleColors = ['#a855f7', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];
  const stripH = 12;
  const stripY = H - stripH;
  const sw = W / sampleColors.length;

  const strips = sampleColors.map((c, i) =>
    `<rect x="${(i * sw).toFixed(1)}" y="${stripY}" width="${(sw + 1).toFixed(1)}" height="${stripH}" fill="${c}"/>`
  ).join('');

  let dots = '';
  for (let x = 60; x < W; x += 60) {
    for (let y = 60; y < H; y += 60) {
      dots += `<circle cx="${x}" cy="${y}" r="1.5" fill="rgba(255,255,255,0.04)"/>`;
    }
  }

  const spheres = [
    { cx: 832, color: '#a855f7' },
    { cx: 951, color: '#ec4899' },
    { cx: 1070, color: '#06b6d4' },
  ];
  const SCY = 163, SR = 85;

  const shadows = spheres.map(s =>
    `<circle cx="${s.cx + 5}" cy="${SCY + 12}" r="${SR}" fill="rgba(0,0,0,0.45)"/>`
  ).join('');

  const circles = spheres.map(s =>
    `<circle cx="${s.cx}" cy="${SCY}" r="${SR}" fill="${s.color}" style="mix-blend-mode:hard-light"/>`
  ).join('');

  const grad = `<linearGradient id="vizGrad" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#a855f7"/>
    <stop offset="50%" stop-color="#ec4899"/>
    <stop offset="100%" stop-color="#06b6d4"/>
  </linearGradient>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="rc"><rect width="${W}" height="${H}" rx="24" ry="24"/></clipPath>
    ${grad}
  </defs>
  <rect width="${W}" height="${H}" rx="24" ry="24" fill="#0e0e16"/>
  <g clip-path="url(#rc)">
    ${dots}
    ${shadows}
    ${circles}
    <text x="60" y="88" font-family="monospace" font-size="13" fill="rgba(255,255,255,0.35)" letter-spacing="4">COLOR PALETTE VISUALIZER</text>
    <text x="60" y="240" font-family="sans-serif" font-size="88" font-weight="900" fill="#ffffff" letter-spacing="-3">Create.</text>
    <text x="60" y="338" font-family="sans-serif" font-size="88" font-weight="900" fill="url(#vizGrad)" letter-spacing="-3">Visualize.</text>
    <text x="60" y="436" font-family="sans-serif" font-size="88" font-weight="900" fill="rgba(255,255,255,0.18)" letter-spacing="-3">Share.</text>
    <text x="60" y="490" font-family="sans-serif" font-size="20" fill="rgba(255,255,255,0.45)">Build and share color palettes instantly.</text>
    <text x="60" y="534" font-family="monospace" font-size="17" fill="rgba(255,255,255,0.8)" letter-spacing="2">colors.ravgo.dev</text>
    ${strips}
  </g>
</svg>`;
}

function handleTitleCard() {
  const svg = buildTitleCard();
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function buildPalette({ colors, names, slug, isLight }) {
  const n = colors.length;
  const SW = (W - PAD * 2 - GAP * (n - 1)) / n;
  const SH = H - PAD * 2 - 70;
  const lc = labelCol(isLight);
  const hexLc = isLight ? 'rgba(12,12,28,0.6)' : 'rgba(255,255,255,0.5)';

  const swatches = colors.map((c, i) => {
    const x = PAD + i * (SW + GAP);
    const tc = textColor(c);
    const nameFill = tc === '#ffffff' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)';
    const nameSize = Math.max(10, Math.min(12, SW * 0.1));
    const hexSize = Math.max(11, Math.min(14, SW * 0.13));
    const name = esc((names[i] || '').toUpperCase());
    return `
    <rect x="${x}" y="${PAD}" width="${SW}" height="${SH}" rx="14" fill="${c}"/>
    <text x="${x + SW / 2}" y="${PAD + SH - 18}" text-anchor="middle" font-family="monospace" font-size="${nameSize}" fill="${nameFill}" letter-spacing="2">${name}</text>
    <text x="${x + SW / 2}" y="${PAD + SH + 30}" text-anchor="middle" font-family="monospace" font-size="${hexSize}" fill="${hexLc}" letter-spacing="1">${esc(c.toUpperCase())}</text>`;
  }).join('');

  return makeSVG(W, H, isLight, `
  <text x="${PAD}" y="${PAD - 16}" font-family="monospace" font-size="13" fill="${lc}" letter-spacing="3">PALETTE — ${esc(slug.toUpperCase())}</text>
  ${footerText(W, H, isLight)}
  ${swatches}`);
}

function buildGeo({ colors, isLight }) {
  const total = colors.length;
  const COLS = Math.min(5, total);
  const ROWS = Math.ceil(total / COLS);
  const SZ = 630;
  const lc = labelCol(isLight);
  const headerH = 60;
  const footerH = 40;
  const contentH = SZ - headerH - footerH - PAD;
  const R = 65;
  const SPACING = 51;

  let shadows = '';
  let circles = '';

  for (let i = 0; i < total; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const rowCount = (row === ROWS - 1) ? (total - row * COLS) : COLS;
    const rowOffsetX = PAD + (SZ - PAD * 2) / 2 - ((rowCount - 1) * SPACING) / 2;
    const cx = rowOffsetX + col * SPACING;
    const cy = headerH + PAD / 2 + row * (R * 2 + 20) + R + (contentH - ROWS * (R * 2 + 20)) / 2;
    shadows += `<circle cx="${(cx + 5).toFixed(1)}" cy="${(cy + 12).toFixed(1)}" r="${R}" fill="rgba(0,0,0,0.28)"/>`;
    circles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${R}" fill="${colors[i]}" style="mix-blend-mode:hard-light"/>`;
  }

  return makeSVG(SZ, SZ, isLight, `
  <text x="${PAD}" y="${PAD + 16}" font-family="monospace" font-size="16" fill="${lc}" letter-spacing="3">GEOMETRY</text>
  ${footerText(SZ, SZ, isLight)}
  ${shadows}
  ${circles}`);
}

function buildFlow({ colors, isLight }) {
  const SZ = 630;
  const lc = labelCol(isLight);
  const cx = PAD;
  const cy = PAD + 50;
  const cw = SZ - PAD * 2;
  const ch = SZ - PAD * 2 - 60;

  const stops = colors.map((c, i) =>
    `<stop offset="${(i / (colors.length - 1 || 1) * 100).toFixed(1)}%" stop-color="${c}"/>`
  ).join('');

  return makeSVG(SZ, SZ, isLight, `
  <defs>
    <linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="100%">${stops}</linearGradient>
  </defs>
  <text x="${PAD}" y="${PAD + 16}" font-family="monospace" font-size="16" fill="${lc}" letter-spacing="3">GRADIENT FLOW</text>
  ${footerText(SZ, SZ, isLight)}
  <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="16" fill="url(#fg)"/>`);
}

function buildDepth({ colors, isLight }) {
  const SZ = 630;
  const lc = labelCol(isLight);
  const cards = Math.min(3, colors.length);
  const cardW = 200;
  const cardH = 300;
  const centerX = SZ / 2;
  const centerY = SZ / 2 + 20;

  const cardsSVG = Array.from({ length: cards }, (_, i) => {
    const c = colors[colors.length - 1 - i];
    const x = centerX - cardW / 2 + (i * 45 - 45);
    const y = centerY - cardH / 2 + (i * 28 - 28);
    return `
    <rect x="${x + 8}" y="${y + 14}" width="${cardW}" height="${cardH}" rx="24" fill="rgba(0,0,0,0.22)"/>
    <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="24" fill="${c}"/>`;
  }).join('');

  return makeSVG(SZ, SZ, isLight, `
  <text x="${PAD}" y="${PAD + 16}" font-family="monospace" font-size="16" fill="${lc}" letter-spacing="3">DEPTH &amp; LAYERS</text>
  ${footerText(SZ, SZ, isLight)}
  ${cardsSVG}`);
}

function buildType({ colors, slug, isLight }) {
  const SZ = 630;
  const lc = labelCol(isLight);
  const sorted = [...colors].sort((a, b) => luminance(a) - luminance(b));
  const bg = sorted[0];
  const textMain = sorted[colors.length - 1];
  const accent = colors[Math.min(Math.floor(colors.length * 0.6), colors.length - 1)];
  const cx = PAD;
  const cy = PAD + 50;
  const cw = SZ - PAD * 2;
  const ch = SZ - PAD * 2 - 60;
  const leftW = Math.round(cw * 0.80);
  const rightW = cw - leftW;
  const swH = ch / colors.length;

  const swatches = colors.map((c, i) =>
    `<rect x="${cx + leftW}" y="${cy + i * swH}" width="${rightW}" height="${swH + 1}" fill="${c}"/>`
  ).join('');

  const bx = cx + 40;
  const by = cy + ch - 80;

  return makeSVG(SZ, SZ, isLight, `
  <text x="${PAD}" y="${PAD + 16}" font-family="monospace" font-size="16" fill="${lc}" letter-spacing="3">TYPOGRAPHY</text>
  ${footerText(SZ, SZ, isLight)}
  <rect x="${cx}" y="${cy}" width="${leftW}" height="${ch}" fill="${bg}"/>
  ${swatches}
  <text x="${cx + 40}" y="${cy + 55}" font-family="monospace" font-size="12" fill="${accent}" letter-spacing="4" opacity="0.8">${esc(slug.toUpperCase())}</text>
  <text x="${cx + 40}" y="${cy + 130}" font-family="sans-serif" font-size="54" font-weight="900" fill="${textMain}" letter-spacing="-2">Hello,</text>
  <text x="${cx + 40}" y="${cy + 196}" font-family="sans-serif" font-size="54" font-weight="900" fill="${textMain}" letter-spacing="-2">World.</text>
  <text x="${cx + 40}" y="${cy + 255}" font-family="sans-serif" font-size="16" fill="${textMain}" opacity="0.6">Designing with color</text>
  <text x="${cx + 40}" y="${cy + 278}" font-family="sans-serif" font-size="16" fill="${textMain}" opacity="0.6">is designing with emotion.</text>
  <rect x="${bx}" y="${by}" width="160" height="44" rx="22" fill="${accent}"/>
  <text x="${bx + 80}" y="${by + 27}" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="${textColor(accent)}" letter-spacing="2">EXPLORE</text>`);
}

function handleSvgRequest(parsed) {
  let svg;
  switch (parsed.vizType) {
    case 'geo': svg = buildGeo(parsed); break;
    case 'flow': svg = buildFlow(parsed); break;
    case 'depth': svg = buildDepth(parsed); break;
    case 'type': svg = buildType(parsed); break;
    default: svg = buildPalette(parsed);
  }

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}