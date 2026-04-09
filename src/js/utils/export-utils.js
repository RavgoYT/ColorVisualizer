import { PALETTES, current } from '../core/state.js';
import { hexToRgb, textColor, luminance, getDisplay } from './color-utils.js';

export function copyURL() {
  navigator.clipboard.writeText(location.href).catch(()=>{});
  const btn=event.target; btn.textContent='copied!'; setTimeout(()=>btn.textContent='copy link',1200);
}

export function toggleExport() { document.getElementById('export-popup').classList.toggle('open'); }

export function doExport(fmt) {
  const p=PALETTES[current], cols=p.colors; let out='', msg='';
  if(fmt==='js'){
    out=`const ${p.name.toUpperCase().replace(/[^A-Z0-9]/g,'_')} = [\n`+cols.map((c,i)=>`  { r:${String(hexToRgb(c).r).padStart(3)}, g:${String(hexToRgb(c).g).padStart(3)}, b:${String(hexToRgb(c).b).padStart(3)} }, // ${i+1}: ${p.names[i]} ${c}`).join('\n')+'\n];';
    navigator.clipboard.writeText(out).catch(()=>{}); msg='js copied!';
  } else if(fmt==='css'){
    out=':root {\n'+cols.map((c,i)=>`  --${p.names[i].replace(/\s+/g,'-')}: ${c};`).join('\n')+'\n}';
    navigator.clipboard.writeText(out).catch(()=>{}); msg='css copied!';
  } else if(fmt==='json'){
    out=JSON.stringify({name:p.name,colors:cols.map((c,i)=>({name:p.names[i],hex:c}))},null,2);
    navigator.clipboard.writeText(out).catch(()=>{}); msg='json copied!';
  } else if(fmt==='image'){
    exportPNG(); document.getElementById('export-popup').classList.remove('open'); return;
  }
  document.getElementById('export-popup').classList.remove('open');
  const btn=document.querySelector('.btn:last-child'); const orig=btn.textContent;
  btn.textContent=msg; setTimeout(()=>btn.textContent=orig,1400);
}

function roundRect(ctx,x,y,w,h,r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
  ctx.closePath();
}

export function exportPNG() {
  const p=PALETTES[current], cols=p.colors, names=p.names;
  const isLight=document.documentElement.classList.contains('light');
  const n=cols.length, SCALE=2, W=1400, H=600, PAD=60, GAP=8;
  const SW=(W-PAD*2-GAP*(n-1))/n, SH=H-PAD*2-70;
  const canvas=document.createElement('canvas'); canvas.width=W*SCALE; canvas.height=H*SCALE;
  const ctx=canvas.getContext('2d'); ctx.scale(SCALE,SCALE);
  roundRect(ctx,0,0,W,H,24); ctx.clip();
  ctx.fillStyle=isLight?'#ffffff':'#0e0e16'; ctx.fillRect(0,0,W,H);
  ctx.font=`500 13px "JetBrains Mono", monospace`; ctx.letterSpacing='3px';
  ctx.fillStyle=isLight?'rgba(12,12,28,.4)':'rgba(255,255,255,.3)';
  ctx.textAlign='left'; ctx.fillText('PALETTE — '+p.name.toUpperCase(),PAD,PAD-18);
  ctx.textAlign='right'; ctx.fillText('Made using colors.ravgo.dev',W-PAD,H-20);
  cols.forEach((c,i)=>{
    const x=PAD+i*(SW+GAP), y=PAD;
    roundRect(ctx,x,y,SW,SH,14); ctx.fillStyle=c; ctx.fill();
    const tc=textColor(c);
    ctx.font=`400 ${Math.max(10,Math.min(12,SW*.1))}px "JetBrains Mono", monospace`;
    ctx.letterSpacing='2px'; ctx.fillStyle=tc==='#ffffff'?'rgba(255,255,255,0.7)':'rgba(0,0,0,0.6)';
    ctx.textAlign='center'; ctx.fillText(names[i].toUpperCase(),x+SW/2,y+SH-18);
    ctx.font=`500 ${Math.max(11,Math.min(14,SW*.13))}px "JetBrains Mono", monospace`;
    ctx.letterSpacing='1px'; ctx.fillStyle=isLight?'rgba(12,12,28,.6)':'rgba(255,255,255,.5)';
    ctx.fillText(c.toUpperCase(),x+SW/2,y+SH+30);
  });
  canvas.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`palette-${p.name}.png`; a.click(); },'image/png');
}

// Expose for mobile viz action menu calls
if (typeof window !== 'undefined') {
  // Will be set after module loads; use dynamic reference
  window._exportVizCard = (type) => exportVizCard(type);
}

export function exportVizCard(type) {
  const d=getDisplay(), p=PALETTES[current];
  const isLight=document.documentElement.classList.contains('light');
  const W=800, H=800, PAD=40, SCALE=2;
  const canvas=document.createElement('canvas'); canvas.width=W*SCALE; canvas.height=H*SCALE;
  const ctx=canvas.getContext('2d'); ctx.scale(SCALE,SCALE);
  roundRect(ctx,0,0,W,H,24); ctx.clip();
  ctx.fillStyle=isLight?'#ffffff':'#0e0e16'; ctx.fillRect(0,0,W,H);
  ctx.font=`500 16px "JetBrains Mono", monospace`; ctx.letterSpacing='3px';
  ctx.fillStyle=isLight?'rgba(12,12,28,.4)':'rgba(255,255,255,.3)';
  ctx.textAlign='left'; ctx.textBaseline='top';
  const titles={geo:'GEOMETRY',type:'TYPOGRAPHY',depth:'DEPTH & LAYERS',flow:'GRADIENT FLOW'};
  ctx.fillText(titles[type],PAD,PAD);
  ctx.font=`400 14px "JetBrains Mono", monospace`;
  ctx.textAlign='right'; ctx.textBaseline='bottom';
  ctx.fillText('Made using colors.ravgo.dev',W-PAD,H-16);
  const cw=W-PAD*2, ch=H-PAD*2-60, cx=PAD, cy=PAD+40;

  if(type==='geo'){
    const n=Math.min(5,d.length), r=140, spacing=110;
    const startX=cx+cw/2-((n-1)*spacing)/2, centerY=cy+ch/2;
    ctx.globalCompositeOperation='source-over';
    ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=28; ctx.shadowOffsetX=5; ctx.shadowOffsetY=12;
    for(let i=0;i<n;i++){ ctx.beginPath(); ctx.arc(startX+i*spacing,centerY,r,0,Math.PI*2); ctx.fillStyle=d[Math.floor(i*(d.length/n))]; ctx.fill(); }
    ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
    ctx.globalCompositeOperation='hard-light';
    for(let i=0;i<n;i++){ ctx.beginPath(); ctx.arc(startX+i*spacing,centerY,r,0,Math.PI*2); ctx.fillStyle=d[Math.floor(i*(d.length/n))]; ctx.fill(); }
    ctx.globalCompositeOperation='source-over';
  } else if(type==='flow'){
    const grad=ctx.createLinearGradient(cx,cy,cx+cw,cy+ch);
    d.forEach((c,i)=>grad.addColorStop(i/(d.length-1||1),c));
    roundRect(ctx,cx,cy,cw,ch,16); ctx.fillStyle=grad; ctx.fill();
  } else if(type==='depth'){
    const cards=Math.min(3,d.length), cardW=220, cardH=320;
    for(let i=0;i<cards;i++){
      const cIdx=d.length-1-i;
      ctx.fillStyle=d[cIdx]; ctx.shadowColor='rgba(0,0,0,0.28)'; ctx.shadowBlur=40; ctx.shadowOffsetX=-10; ctx.shadowOffsetY=15;
      const x=cx+cw/2-cardW/2+(i*50-50), y=cy+ch/2-cardH/2+(i*30-30);
      roundRect(ctx,x,y,cardW,cardH,24); ctx.fill();
    }
    ctx.shadowColor='transparent'; ctx.shadowBlur=0; ctx.shadowOffsetX=0; ctx.shadowOffsetY=0;
  } else if(type==='type'){
    const sorted=[...d].sort((a,b)=>luminance(a)-luminance(b));
    const bg=sorted[0], textMain=sorted[d.length-1], accent=d[Math.min(Math.floor(d.length*0.6),d.length-1)];
    const palName=p.name.toUpperCase();
    const leftW=Math.round(cw*0.82), rightW=cw-leftW;
    roundRect(ctx,cx,cy,leftW,ch,0); ctx.fillStyle=bg; ctx.fill();
    const swH=ch/d.length;
    d.forEach((c,i)=>{ ctx.fillStyle=c; ctx.fillRect(cx+leftW,cy+i*swH,rightW,swH+1); });
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.font=`600 15px "JetBrains Mono", monospace`; ctx.letterSpacing='4px';
    ctx.fillStyle=accent; ctx.globalAlpha=0.8; ctx.fillText(palName,cx+55,cy+80); ctx.globalAlpha=1;
    ctx.font='900 72px sans-serif'; ctx.letterSpacing='-3px'; ctx.fillStyle=textMain;
    ctx.fillText('Hello,',cx+55,cy+200); ctx.fillText('World.',cx+55,cy+295);
    ctx.font='400 22px serif'; ctx.letterSpacing='0px'; ctx.fillStyle=textMain; ctx.globalAlpha=0.6;
    ctx.fillText('Designing with color is designing',cx+55,cy+375); ctx.fillText('with emotion.',cx+55,cy+410); ctx.globalAlpha=1;
    const bw=196, bh=54, bx=cx+55, by=cy+ch-100;
    roundRect(ctx,bx,by,bw,bh,27); ctx.fillStyle=accent; ctx.fill();
    ctx.fillStyle=textColor(accent); ctx.font='bold 14px "JetBrains Mono", monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.letterSpacing='2px'; ctx.fillText('EXPLORE',bx+bw/2,by+bh/2);
  }
  canvas.toBlob(b=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=`palette-${p.name}-${type}.png`; a.click(); },'image/png');
}