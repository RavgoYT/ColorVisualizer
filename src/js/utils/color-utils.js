import { PALETTES, CVD_MATRICES, CVD_MODES, current, cvdIndex } from '../core/state.js';

export function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
}
export function rgbToHex(r,g,b) {
  return '#'+[r,g,b].map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
}
export function hexToHsl(hex) {
  let {r,g,b} = hexToRgb(hex); r/=255; g/=255; b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
  let h,s,l=(mx+mn)/2;
  if(mx===mn){ h=s=0; } else {
    const d=mx-mn; s=l>0.5?d/(2-mx-mn):d/(mx+mn);
    switch(mx){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h=Math.round(h*60);
  }
  return { h, s: Math.round(s*100), l: Math.round(l*100) };
}
export function hslToHex(h,s,l) {
  s/=100; l/=100;
  const k=n=>(n+h/30)%12, a=s*Math.min(l,1-l);
  const f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));
  return rgbToHex(Math.round(f(0)*255),Math.round(f(8)*255),Math.round(f(4)*255));
}
export function luminance(hex) {
  let {r,g,b} = hexToRgb(hex);
  [r,g,b]=[r,g,b].map(c=>{ c/=255; return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4); });
  return 0.2126*r+0.7152*g+0.0722*b;
}
export function contrast(hex) {
  const l=luminance(hex);
  return (Math.max(1.05/(l+0.05),(l+0.05)/0.05)).toFixed(1)+':1';
}
export function textColor(hex) { return luminance(hex)>0.3?'#0a0a0f':'#ffffff'; }
export function hslStr(hex) { const {h,s,l}=hexToHsl(hex); return `${h} ${s}% ${l}%`; }
export function simColor(hex, mode) {
  if(!mode||mode==='normal') return hex;
  const m=CVD_MATRICES[mode]; if(!m) return hex;
  const {r,g,b}=hexToRgb(hex);
  return rgbToHex(m[0][0]*r+m[0][1]*g+m[0][2]*b, m[1][0]*r+m[1][1]*g+m[1][2]*b, m[2][0]*r+m[2][1]*g+m[2][2]*b);
}
export function getDisplay() {
  return PALETTES[current].colors.map(c=>simColor(c,CVD_MODES[cvdIndex]));
}
export function updateDynamicAccent() {
  const cols=PALETTES[current].colors;
  let brightest=cols[0], maxScore=-1;
  cols.forEach(c=>{ const lum=luminance(c),hsl=hexToHsl(c),score=lum+(hsl.s/200); if(score>maxScore&&hsl.l<95){maxScore=score;brightest=c;} });
  if(maxScore<0) brightest='#a855f7';
  const r=hexToRgb(brightest);
  document.documentElement.style.setProperty('--accent',brightest);
  document.documentElement.style.setProperty('--accent-dim',`rgba(${r.r},${r.g},${r.b},0.15)`);
}
