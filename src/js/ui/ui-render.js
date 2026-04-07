import {
  PALETTES, current,
  selected, setSelected,
  editorTab, setEditorTab,
  editorIndex, setEditorIndex,
  editorHex, setEditorHex,
  locks, setLocks,
  cvdIndex, setCvdIndex,
  drawerOpen, setDrawerOpen,
  activeTab, setActiveTab,
  dragSrc, setDragSrc,
  dragTargetIdx, setDragTargetIdx,
  CVD_MODES,
} from '../core/state.js';
import { hexToRgb, rgbToHex, hexToHsl, hslToHex, textColor, hslStr, contrast, luminance, getDisplay } from '../utils/color-utils.js';

let dragGhost = null;
import { updateURL } from '../core/url-manager.js';
import { getColorName } from '../utils/color-namer.js';

/* ── RENDER ──────────────────────────────────────────────────────────────── */

export function initLocks() {
  const p=PALETTES[current], n=p.colors.length;
  if(!p.names) p.names=[];
  while(p.names.length<n) p.names.push(null);
  // Replace placeholder/default names with the nearest color name
  p.names = p.names.slice(0,n).map((name, i) => {
    const isPlaceholder = !name || ['color','new'].includes(name.toLowerCase());
    return isPlaceholder ? (getColorName(p.colors[i]) || 'color') : name;
  });
  while(locks.length<n) locks.push(false);
  setLocks(locks.slice(0,n));
}

export function render() {
  initLocks();
  const p=PALETTES[current];
  document.getElementById('palette-name-input').value=p.name;
  document.querySelector('.title-prefix').textContent=cvdIndex?`palette (${CVD_MODES[cvdIndex]}) —`:`palette —`;

  const sw=document.getElementById('swatches');
  const dropLine=document.getElementById('drop-line');
  sw.innerHTML=''; sw.appendChild(dropLine);
  const display=getDisplay(), n=p.colors.length;

  display.forEach((c,i)=>{
    const tc=textColor(c);
    const div=document.createElement('div');
    div.className='swatch'; div.dataset.index=i; div.style.background=c; div.draggable=true;

    div.innerHTML=`
      <div class="swatch-top">
        <div class="swatch-icons">
          ${n>2?`<div class="swatch-icon delete-icon" onmousedown="e_stop(event)" onclick="removeColor(event,${i})" title="remove"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>`:''}
          <div class="swatch-icon lock-icon ${locks[i]?'locked':''}" onmousedown="e_stop(event)" onclick="toggleLock(event,${i})"><svg viewBox="0 0 24 24">${locks[i]?'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>':'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'}</svg></div>
          <div class="swatch-icon" onmousedown="e_stop(event)" onclick="openEditor(event,${i})"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
          <div class="swatch-icon drag-handle" onmousedown="e_stop(event)"><svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></div>
        </div>
      </div>
      <div class="copy-check" id="check-${i}">
        <svg viewBox="0 0 48 48" preserveAspectRatio="xMidYMid meet">
          <circle class="check-circle" cx="24" cy="24" r="16" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          <polyline class="check-tick" points="16,24 22,30 32,18" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="swatch-label">
        <div class="swatch-hex-lbl" style="color:${tc}">${p.colors[i]}</div>
        <input type="text" class="swatch-name-input" style="color:${tc}" value="${p.names[i]}" onchange="updateSwatchName(${i},this.value)" onmousedown="e_stop(event)" onclick="e_stop(event)" spellcheck="false">
      </div>
      ${locks[i]?`<div class="lock-badge"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>`:''}
    `;

    div.addEventListener('click',e=>{
      if(e.target.closest('.swatch-icon')||e.target.tagName==='INPUT') return;
      showCheck(i); navigator.clipboard.writeText(p.colors[i]).catch(()=>{}); selectColor(i);
    });
    div.addEventListener('dragstart',e=>{ if(e.target.tagName==='INPUT'){e.preventDefault();return;} setDragSrc(i); e.dataTransfer.effectAllowed='move'; 
      dragGhost = document.createElement('div'); dragGhost.style.width='1px'; dragGhost.style.height='1px'; dragGhost.style.background='transparent'; dragGhost.style.position='absolute'; dragGhost.style.left='-1000px'; document.body.appendChild(dragGhost); e.dataTransfer.setDragImage(dragGhost,0,0); });
    div.addEventListener('dragend',()=>{ dropLine.style.display='none'; setDragTargetIdx(null); if(dragGhost){ document.body.removeChild(dragGhost); dragGhost=null; } });
    div.addEventListener('dragover',e=>{
      e.preventDefault(); const rect=div.getBoundingClientRect(), swRect=sw.getBoundingClientRect();
      setDragTargetIdx(e.clientX<rect.left+rect.width/2?i:i+1);
      const lx=e.clientX<rect.left+rect.width/2?(rect.left-swRect.left-1):(rect.right-swRect.left-1);
      dropLine.style.display='block'; dropLine.style.left=lx+'px';
    });
    div.addEventListener('drop',e=>{
      e.preventDefault(); dropLine.style.display='none';
      if(dragSrc!==null&&dragTargetIdx!==null&&dragSrc!==dragTargetIdx&&dragSrc!==dragTargetIdx-1){
        const cols=[...p.colors], lks=[...locks], nms=[...p.names];
        const[sc]=cols.splice(dragSrc,1); const[sl]=lks.splice(dragSrc,1); const[sn]=nms.splice(dragSrc,1);
        const ti=dragSrc<dragTargetIdx?dragTargetIdx-1:dragTargetIdx;
        cols.splice(ti,0,sc); lks.splice(ti,0,sl); nms.splice(ti,0,sn);
        p.colors=cols; setLocks(lks); p.names=nms; updateURL(); render();
      }
      setDragSrc(null); setDragTargetIdx(null);
    });
    sw.appendChild(div);
  });

  if(n<15){
    const addBtn=document.createElement('div'); addBtn.className='add-swatch-btn'; addBtn.title='add color';
    addBtn.innerHTML=`<svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    addBtn.addEventListener('click',addColor); sw.appendChild(addBtn);
  }

  if(selected>=n) setSelected(n-1);
  selectColor(selected); updateURL();
  if(activeTab==='edit'){ renderPreview(); renderGradient(); }
  else if(activeTab==='viz') renderViz();
}

export function e_stop(e) { e.stopPropagation(); }
export function updatePaletteName(val) { PALETTES[current].name=val||'untitled'; updateURL(); }
export function updateSwatchName(i, val) {
  const hex = PALETTES[current].colors[i];
  const colorDefault = getColorName(hex) || 'color';
  // If user typed the same as the default color name, store the default (won't appear in URL)
  PALETTES[current].names[i] = val || colorDefault;
  updateURL();
}

export function removeColor(e,i) {
  e.stopPropagation(); const p=PALETTES[current]; if(p.colors.length<=2) return;
  p.colors=p.colors.filter((_,idx)=>idx!==i);
  p.names=p.names.filter((_,idx)=>idx!==i);
  setLocks(locks.filter((_,idx)=>idx!==i));
  document.getElementById('editor-popup').classList.remove('open'); render();
}

export function addColor() {
  const p=PALETTES[current]; if(p.colors.length>=15) return;
  p.colors.push(p.colors[p.colors.length-1]); p.names.push('new'); locks.push(false); render();
  const swatches=document.getElementById('swatches').querySelectorAll('.swatch');
  if(swatches[p.colors.length-1]) openEditorAt(p.colors.length-1,swatches[p.colors.length-1]);
}

export function showCheck(i) { const el=document.getElementById('check-'+i); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

export function selectColor(i) {
  setSelected(i);
  const hex=PALETTES[current].colors[i];
  document.getElementById('sel-hex').textContent=hex;
  document.getElementById('sel-hsl').textContent=hslStr(hex);
  document.getElementById('sel-contrast').textContent=contrast(hex);
}

export function renderPreview() {
  const d=getDisplay(); const c=i=>d[Math.min(i,d.length-1)];
  document.getElementById('preview-ui').innerHTML=`<div class="preview-label">ui preview</div><div class="ui-bar" style="background:${c(Math.floor(d.length*.6))}"></div><div class="ui-bar" style="background:${c(Math.floor(d.length*.45))};width:70%"></div><div class="ui-dot-row"><div class="ui-dot" style="background:${c(Math.floor(d.length*.75))}"></div><div class="ui-dot" style="background:${c(Math.floor(d.length*.6))}"></div><div class="ui-dot" style="background:${c(Math.floor(d.length*.45))}"></div><div class="ui-pill" style="background:${c(Math.floor(d.length*.3))}"></div></div><div class="ui-text-line" style="background:${c(d.length-1)};width:90%"></div><div class="ui-text-line" style="background:${c(d.length-1)};width:60%;opacity:.6"></div>`;
}

export function renderGradient() {
  document.getElementById('grad-strip').innerHTML=getDisplay().map(c=>`<div class="grad-block" style="background:${c}"></div>`).join('');
}

export function renderViz() {
  const d=getDisplay(), n=d.length;
  const geo=document.getElementById('viz-geo-container');
  geo.innerHTML='';
  for(let i=0;i<Math.min(5,n);i++){
    const div=document.createElement('div'); div.className='viz-geo-shape';
    div.style.backgroundColor=d[Math.floor(i*(n/Math.min(5,n)))];
    geo.appendChild(div);
  }
  const tc=document.getElementById('viz-type-container');
  const sorted=[...d].sort((a,b)=>luminance(a)-luminance(b));
  const bg=sorted[0], textMain=sorted[n-1], accent=d[Math.min(Math.floor(n*0.6),n-1)];
  const palName=PALETTES[current].name;
  tc.innerHTML=`
    <div class="vt-left" style="background:${bg};color:${textMain}">
      <div>
        <div class="vt-eyebrow" style="color:${accent}">${palName}</div>
        <div class="vt-heading">Hello,<br>World.</div>
        <div class="vt-body">Designing with color<br>is designing with emotion.</div>
      </div>
      <div class="vt-btn" style="background:${accent};color:${textColor(accent)}">Explore →</div>
    </div>
    <div class="vt-swatches">${d.map(c=>`<div class="vt-swatch" style="background:${c}"></div>`).join('')}</div>
  `;
  const dc=document.getElementById('viz-depth-container');
  dc.innerHTML='';
  for(let i=0;i<Math.min(3,n);i++){
    const div=document.createElement('div'); div.className='depth-card';
    div.style.backgroundColor=d[n-1-i];
    div.style.transform=`translateZ(${i*40}px) translateX(${i*20-20}px) translateY(${i*10-10}px)`;
    div.style.zIndex=i;
    dc.appendChild(div);
  }
  document.getElementById('viz-flow-container').style.background=`linear-gradient(-45deg, ${d.join(', ')})`;
}

export function randomize() {
  const cur=PALETTES[current];
  const lockedIndices=locks.map((l,i)=>l?i:-1).filter(i=>i!==-1);
  let anchorHsl;
  if(lockedIndices.length===0){
    anchorHsl={ h:Math.random()*360, s:Math.random()*60+40, l:Math.random()*50+25 };
  } else {
    anchorHsl=hexToHsl(cur.colors[lockedIndices[0]]);
  }
  const schemes=['analogous','triadic','complementary','monochromatic'];
  const scheme=schemes[Math.floor(Math.random()*schemes.length)];
  const used=new Set(lockedIndices.map(i=>cur.colors[i]));
  cur.colors=cur.colors.map((c,i)=>{
    if(locks[i]) return c;
    let hex, attempts=0;
    do {
      const jitter=1+attempts*0.15;
      let h=anchorHsl.h;
      const s=Math.max(15,Math.min(95,anchorHsl.s+(Math.random()*50-25)*jitter));
      const l=Math.max(8,Math.min(92,Math.random()*78+11));
      if(scheme==='analogous')          h=(anchorHsl.h+(Math.random()*80-40)*jitter+360)%360;
      else if(scheme==='triadic')       h=(anchorHsl.h+(Math.random()>.5?120:240)+(Math.random()*30-15)+360)%360;
      else if(scheme==='complementary') h=(anchorHsl.h+180+(Math.random()*40-20)*jitter+360)%360;
      else                              h=(anchorHsl.h+(Math.random()*30-15)*jitter+360)%360;
      hex=hslToHex(Math.round(h),Math.round(s),Math.round(l));
      attempts++;
    } while((used.has(hex)||c===hex)&&attempts<40);
    used.add(hex); return hex;
  });
  render();
}

export function toggleLock(e,i) { e.stopPropagation(); locks[i]=!locks[i]; render(); }
export function openEditor(e,i) { e.stopPropagation(); openEditorAt(i,e.target.closest('.swatch')); }

export function openEditorAt(i,swatchEl) {
  setEditorIndex(i); setEditorHex(PALETTES[current].colors[i]);
  const popup=document.getElementById('editor-popup'), wrap=document.getElementById('wrap');
  const sr=swatchEl.getBoundingClientRect(), wr=wrap.getBoundingClientRect();
  let top=sr.top-wr.top+10, left=sr.left-wr.left+sr.width+8;
  if(left+270>wrap.offsetWidth-20) left=sr.left-wr.left-270;
  if(top+260>wrap.offsetHeight) top=wrap.offsetHeight-270;
  popup.style.top=top+'px'; popup.style.left=left+'px'; popup.classList.add('open');
  renderEditorFields();
}

export function setEditorTabUI(t) {
  setEditorTab(t);
  document.querySelectorAll('.editor-tab').forEach(el=>el.classList.toggle('active',el.textContent===t));
  renderEditorFields();
}

export function renderEditorFields() {
  document.getElementById('editor-preview').style.background=editorHex;
  const f=document.getElementById('editor-fields');
  if(editorTab==='hex'){
    f.innerHTML=`<div class="editor-field"><label>hex</label><input type="text" id="ef-hex" value="${editorHex}" oninput="liveHex()"></div>`;
  } else if(editorTab==='rgb'){
    const{r,g,b}=hexToRgb(editorHex);
    f.innerHTML=['r','g','b'].map((ch,i)=>{ const v=[r,g,b][i]; return `<div class="editor-field"><label>${ch}</label><input type="range" min="0" max="255" value="${v}" oninput="liveRgb()"><input type="text" style="width:44px" id="ef-${ch}" value="${v}" oninput="liveRgb()"></div>`; }).join('');
  } else {
    const{h,s,l}=hexToHsl(editorHex);
    f.innerHTML=[['h',h,0,360],['s',s,0,100],['l',l,0,100]].map(([ch,v,mn,mx])=>`<div class="editor-field"><label>${ch}</label><input type="range" min="${mn}" max="${mx}" value="${v}" oninput="liveHsl()"><input type="text" style="width:44px" id="ef-${ch}" value="${v}" oninput="liveHsl()"></div>`).join('');
  }
}

export function liveHex() { const v=document.getElementById('ef-hex').value; if(/^#[0-9a-fA-F]{6}$/.test(v)){setEditorHex(v);document.getElementById('editor-preview').style.background=v;} }
export function liveRgb() {
  const texts=['r','g','b'].map(c=>document.getElementById('ef-'+c));
  const ranges=document.querySelectorAll('#editor-fields input[type=range]');
  ranges.forEach((r,i)=>{ if(document.activeElement!==texts[i]) texts[i].value=r.value; else r.value=texts[i].value; });
  const r=parseInt(texts[0].value)||0, g=parseInt(texts[1].value)||0, b=parseInt(texts[2].value)||0;
  setEditorHex(rgbToHex(r,g,b)); document.getElementById('editor-preview').style.background=editorHex;
}
export function liveHsl() {
  const texts=['h','s','l'].map(c=>document.getElementById('ef-'+c));
  const ranges=document.querySelectorAll('#editor-fields input[type=range]');
  ranges.forEach((r,i)=>{ if(document.activeElement!==texts[i]) texts[i].value=r.value; else r.value=texts[i].value; });
  const h=parseInt(texts[0].value)||0, s=parseInt(texts[1].value)||0, l=parseInt(texts[2].value)||0;
  setEditorHex(hslToHex(h,s,l)); document.getElementById('editor-preview').style.background=editorHex;
}
export function applyEdit() { PALETTES[current].colors[editorIndex]=editorHex; document.getElementById('editor-popup').classList.remove('open'); updateURL(); render(); }

/* ── UI STATE ────────────────────────────────────────────────────────────── */
export function toggleDrawer() {
  setDrawerOpen(!drawerOpen);
  document.getElementById('settings-drawer').classList.toggle('open',drawerOpen);
  document.getElementById('wrap').classList.toggle('drawer-open',drawerOpen);
  document.getElementById('gear-btn').classList.toggle('active',drawerOpen);
}
export function activateTab(tab) {
  if(tab==='cvd'){ setCvdIndex((cvdIndex+1)%CVD_MODES.length); document.getElementById('cvd-sub').textContent=CVD_MODES[cvdIndex]; render(); return; }
  if(tab==='img'){ document.getElementById('img-modal').classList.add('open'); return; }
  setActiveTab(tab);
  document.querySelectorAll('.drawer-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  document.querySelectorAll('.view-section').forEach(s=>s.classList.remove('active'));
  document.getElementById('view-'+tab).classList.add('active');
  if(!drawerOpen&&window.innerWidth>768) toggleDrawer();
  render();
}
export function toggleTheme() {
  document.documentElement.classList.toggle('light');
  localStorage.setItem('theme',document.documentElement.classList.contains('light')?'light':'dark');
  render();
}
