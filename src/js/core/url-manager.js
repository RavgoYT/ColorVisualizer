import LZString from 'lz-string'; // mot currently used. considering removing
import { PALETTES, current, setCurrent } from './state.js';
import { hslToHex, updateDynamicAccent } from '../utils/color-utils.js';
import { getColorName } from '../utils/color-namer.js';

/* This is the best I could think of for encoding and decoding. In the future I would use a database server to shorten*/

function slugify(str) {
  return (str || 'untitled').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-');
}

function encodeMeta(p) {
  const encoded = (p.names || []).map((n, i) => {
    return isCustomName(n, p.colors[i]) ? (n || '').trim() : '_';
  });
  return btoa(encoded.join('|'))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeMeta(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(b64);
    console.log('[url] decompressed meta:', decoded);
    return { names: decoded.split('|').map(n => n === '_' ? null : n) };
  } catch { return { names: [] }; }
}

// A name is "custom" only if it differs from the nearest color name for that hex
function isCustomName(name, hex) {
  if (!name || !hex) return false;
  const defaultName = getColorName(hex);
  return name.toLowerCase() !== (defaultName || '').toLowerCase();
}

function packHexes(colors) {
  const bytes = new Uint8Array(colors.length * 3);
  colors.forEach((c, i) => {
    const n = parseInt(c.replace('#',''), 16);
    bytes[i*3]   = (n >> 16) & 0xff;
    bytes[i*3+1] = (n >> 8)  & 0xff;
    bytes[i*3+2] =  n        & 0xff;
  });
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

function unpackHexes(str) {
  const b64 = str.replace(/-/g,'+').replace(/_/g,'/');
  const bin = atob(b64);
  const colors = [];
  for(let i = 0; i < bin.length; i += 3) {
    const n = (bin.charCodeAt(i) << 16) | (bin.charCodeAt(i+1) << 8) | bin.charCodeAt(i+2);
    colors.push('#' + n.toString(16).padStart(6,'0'));
  }
  return colors;
}

export function buildURL(p) {
  const isDefaultPaletteName = (p.name || '').toLowerCase() === 'untitled';
  const hasCustomNames = p.names && p.colors &&
    p.names.some((n, i) => isCustomName(n, p.colors[i]));
  const slug = isDefaultPaletteName ? '' : slugify(p.name);
  const hexes = packHexes(p.colors);
  const meta = hasCustomNames ? '~' + encodeMeta(p) : '';
  const theme = document.documentElement.classList.contains('light') ? 'L' : 'B';
  return slug ? `/${slug}/${hexes}${meta}${theme}` : `/${hexes}${meta}${theme}`;
}

function isValidHex(str) { return /^[0-9a-fA-F]{6}$/.test(str); }

function parseFromPath(path) {
  if(!path||path==='/') return null;
  const clean=path.replace(/^\/+/,'');
  const parts=clean.split('/');
  if(parts.length<1) return null;
  let slug='', rest='';
  if(parts.length===1){ rest=parts[0]; } else { slug=parts[0]; rest=parts[1]; }
let hexPart=rest, metaPart=null;
  if(rest.includes('~')){ [hexPart,metaPart]=rest.split('~'); }

  // Check for theme at the end
  let theme = null;
  if (hexPart.endsWith('L') || hexPart.endsWith('B')) {
    theme = hexPart.slice(-1);
    hexPart = hexPart.slice(0, -1);
  }

  // Try packed base64url first, fall back to legacy dash-separated hex
  let colors;
  const rawHexes=hexPart.split('-').filter(Boolean);
  if(rawHexes.every(isValidHex)) {
    colors = rawHexes.map(h=>'#'+h); // legacy format that I was using earlier. Not really neccesary
  } else {
    try { colors = unpackHexes(hexPart); } catch { return null; }
    if(!colors.length || !colors.every(c => isValidHex(c.slice(1)))) return null;
  }
  let name=slug.replace(/-/g,' ');
  let names=[];
  if(metaPart){ const meta=decodeMeta(metaPart); names=meta.names; }
  return { name: name||'untitled', colors, names, theme };
}

function parseURL() {
  try {
    if(location.protocol==='file:') return location.hash.length>1?parseFromPath(location.hash.slice(1)):null;
    return parseFromPath(location.pathname);
  } catch(e) { console.error('URL parse failed',e); return null; }
}

function createRandomPalette() {
  const randomHex=()=>hslToHex(Math.random()*360,Math.random()*60+40,Math.random()*50+25);
  return { name:'Untitled', colors:Array.from({length:5},randomHex), names:new Array(8).fill('color') };
}

export function loadFromURL() {
  const palette=parseURL();
  if(palette&&palette.colors.length){
    PALETTES.unshift(palette); setCurrent(0);
    if (palette.theme) {
      if (palette.theme === 'L') document.documentElement.classList.add('light');
      else document.documentElement.classList.remove('light');
    }
  } else {
    if(location.protocol==='file:'&&location.hash) location.hash='';
    PALETTES.unshift(createRandomPalette()); setCurrent(0);
  }
}

export function updateURL() {
  const url=buildURL(PALETTES[current]);
  if(location.protocol==='file:'){ location.hash=url; }
  else { history.replaceState(null,'',url); }
  updateDynamicAccent();
}

export { updateURL as updateHash };
