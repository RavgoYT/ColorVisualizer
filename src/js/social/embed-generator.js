import { PALETTES, current } from '../core/state.js';
import { hexToRgb, textColor, luminance, getDisplay } from '../utils/color-utils.js';

/**
 * Generate PNG preview image using existing export logic
 * Returns as data URL (base64 encoded)
 * @returns {Promise<string>} Data URL for the image
 */
export async function generatePreviewPNG() {
  const p = PALETTES[current];
  const cols = p.colors;
  const names = p.names;
  const isLight = document.documentElement.classList.contains('light');
  
  // Determine type: palette or viz
  let type = 'palette';
  const pathParts = location.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 3) {
    const last = pathParts[pathParts.length - 1];
    if (['geo', 'typo', 'layers', 'gradient'].includes(last)) {
      type = last;
    }
  }
  // Map to internal types
  if (type === 'typo') type = 'type';
  else if (type === 'layers') type = 'depth';
  else if (type === 'gradient') type = 'flow';
  
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
    ctx.fillText('PALETTE — ' + p.name.toUpperCase(), PAD, PAD - 18);
    
    // Footer
    ctx.textAlign = 'right';
    ctx.fillText('Made using colors.ravgo.dev', W - PAD, H - 20);
    
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
      ctx.fillText(names[i].toUpperCase(), x + SW / 2, y + SH - 18);
      
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
    ctx.fillText(titles[type], PAD, PAD);
    ctx.font = `400 14px "JetBrains Mono", monospace`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Made using colors.ravgo.dev', W - PAD, H - 16);
    const cw = W - PAD * 2, ch = H - PAD * 2 - 60, cx = PAD, cy = PAD + 40;
    const d = cols; // colors
    
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
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
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
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else if (type === 'type') {
      const sorted = [...d].sort((a, b) => luminance(a) - luminance(b));
      const bg = sorted[0], textMain = sorted[d.length - 1], accent = d[Math.min(Math.floor(d.length * 0.6), d.length - 1)];
      const palName = p.name.toUpperCase();
      const leftW = Math.round(cw * 0.82), rightW = cw - leftW;
      roundRect(ctx, cx, cy, leftW, ch, 0);
      ctx.fillStyle = bg;
      ctx.fill();
      const swH = ch / d.length;
      d.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(cx + leftW, cy + i * swH, rightW, swH + 1);
      });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.font = `600 15px "JetBrains Mono", monospace`;
      ctx.letterSpacing = '4px';
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.8;
      ctx.fillText(palName, cx + 55, cy + 80);
      ctx.globalAlpha = 1;
      ctx.font = '900 72px Orbitron, sans-serif';
      ctx.letterSpacing = '-3px';
      ctx.fillStyle = textMain;
      ctx.fillText('Hello,', cx + 55, cy + 200);
      ctx.fillText('World.', cx + 55, cy + 295);
      ctx.font = '400 22px Orbitron, sans-serif';
      ctx.letterSpacing = '0px';
      ctx.fillStyle = textMain;
      ctx.globalAlpha = 0.6;
      ctx.fillText('Designing with color is designing', cx + 55, cy + 375);
      ctx.fillText('with emotion.', cx + 55, cy + 410);
      ctx.globalAlpha = 1;
      const bw = 196, bh = 54, bx = cx + 55, by = cy + ch - 100;
      roundRect(ctx, bx, by, bw, bh, 27);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.fillStyle = textColor(accent);
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '2px';
      ctx.fillText('EXPLORE', bx + bw / 2, by + bh / 2);
    }
  }
  
  // Return as data URL (base64 encoded PNG)
  return canvas.toDataURL('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
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
 * Generate Open Graph (OG) metadata for social embeds
 * @param {string} slugUrl - URL slug for the palette
 * @param {string} imageDataUrl - Data URL of preview image
 * @returns {HTMLElement[]} Array of meta tags to insert in head
 */
export function generateOGMetaTags(slugUrl, imageDataUrl) {
  const palette = PALETTES[current];
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}/${slugUrl}`;
  
  const metaTags = [
    // Open Graph
    { property: 'og:title', content: `${palette.name}` },
    // I don't need description text.
    //{ property: 'og:description', content: `Create and visualize beautiful color palettes at colors.ravgo.dev` },
    { property: 'og:url', content: baseUrl },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: imageDataUrl },
    { property: 'og:image:width', content: '1400' },
    { property: 'og:image:height', content: '600' },
    { property: 'og:site_name', content: 'Color Palette Visualizer • ravgo.color.dev' },
    
    // Twitter Card
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: `${palette.name}` },
    // again no description needed, but here is an example
    //{ name: 'twitter:description', content: `Create and visualize beautiful color palettes at colors.ravgo.dev` },
    { name: 'twitter:image', content: imageDataUrl },
    
    // Canonical
    { rel: 'canonical', href: baseUrl },
  ];
  
  return metaTags.map(meta => {
    const el = document.createElement('meta');
    Object.entries(meta).forEach(([key, value]) => {
      if (key === 'rel') {
        el.setAttribute('rel', value);
      } else {
        el.setAttribute(key, value);
      }
    });
    return el;
  });
}



