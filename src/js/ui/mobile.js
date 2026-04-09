// src/js/ui/mobile.js
import { PALETTES, current, locks, setLocks } from '../core/state.js';
import { updateURL } from '../core/url-manager.js';
import { textColor, getDisplay } from '../utils/color-utils.js';
import { getColorName } from '../utils/color-namer.js';

/* ── callback wired up from main.js ──────────────────────────────────────── */
let _render = () => {};
export function setMobileRenderCallback(fn) { _render = fn; }

/* ── single-add guard: prevents double-fires across re-renders ───────────── */
let _addCooldown = false;

/* ── query ───────────────────────────────────────────────────────────────── */
export function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOOTSTRAP  — called once from main.js
   ═══════════════════════════════════════════════════════════════════════════ */
export function initMobile() {
  if (!isMobile()) return;
  injectActionBar();
  injectBottomSheet();
  injectSheetBackdrop();
}

/* ═══════════════════════════════════════════════════════════════════════════
   ACTION BAR
   ═══════════════════════════════════════════════════════════════════════════ */
function injectActionBar() {
  if (document.getElementById('mobile-action-bar')) return;

  const bar = document.createElement('div');
  bar.id = 'mobile-action-bar';
  bar.className = 'mobile-action-bar';
  bar.innerHTML = `
    <button class="mob-btn-generate" id="mob-generate">Generate</button>
    <button class="mob-btn-icon" id="mob-share" title="Copy link">
      <svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
    </button>
    <button class="mob-btn-icon" id="mob-viz" title="Visualize">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
    </button>
    <button class="mob-btn-icon" id="mob-export" title="Export">
      <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </button>
    <button class="mob-btn-icon" id="mob-menu" title="Menu">
      <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  `;
  document.body.appendChild(bar);

  document.getElementById('mob-generate').addEventListener('click', () => {
    if (typeof window.randomize === 'function') window.randomize();
  });

  document.getElementById('mob-share').addEventListener('click', () => {
    const btn = document.getElementById('mob-share');
    if (navigator.share) {
      navigator.share({ url: location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(location.href).catch(() => {});
    }
    btn.classList.add('active-view');
    setTimeout(() => btn.classList.remove('active-view'), 1200);
  });

  document.getElementById('mob-viz').addEventListener('click', () => {
    const editSection = document.getElementById('view-edit');
    const vizSection  = document.getElementById('view-viz');
    const isViz = vizSection.classList.contains('active');
    editSection.classList.toggle('active', isViz);
    vizSection.classList.toggle('active', !isViz);
    document.getElementById('mob-viz').classList.toggle('active-view', !isViz);
    if (!isViz) {
      document.dispatchEvent(new CustomEvent('mobile-render-viz'));
      // On entering viz view, swap download buttons to share buttons
      requestAnimationFrame(() => swapVizButtonsToShare());
    }
  });

  document.getElementById('mob-export').addEventListener('click', () => {
    if (typeof window.toggleExport === 'function') window.toggleExport();
  });

  document.getElementById('mob-menu').addEventListener('click', openSheet);

  // Also swap viz buttons whenever the viz view is rendered via the event
  document.addEventListener('mobile-render-viz', () => {
    requestAnimationFrame(() => swapVizButtonsToShare());
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIZ SHARE BUTTONS  — replace download icon with share on mobile
   ═══════════════════════════════════════════════════════════════════════════ */
const VIZ_SHARE_PATHS = ['/geo', '/typo', '/layers', '/gradient'];

function swapVizButtonsToShare() {
  const btns = document.querySelectorAll('.viz-dl-btn');
  btns.forEach((btn, i) => {
    if (btn.dataset.mobileShareWired) return; // don't double-wire
    btn.dataset.mobileShareWired = '1';
    btn.classList.add('mob-viz-share');

    // Swap icon to share/upload arrow
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>`;

    // Replace onclick with share handler (remove inline onclick from HTML)
    btn.removeAttribute('onclick');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const slug = VIZ_SHARE_PATHS[i] || '';
      const base = location.origin + location.pathname.replace(/\/$/, '');
      const shareURL = base + slug;
      if (navigator.share) {
        navigator.share({ url: shareURL }).catch(() => {
          navigator.clipboard.writeText(shareURL).catch(() => {});
        });
      } else {
        navigator.clipboard.writeText(shareURL).catch(() => {});
        showMobileToast('link copied');
      }
    });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   BACKDROP
   ═══════════════════════════════════════════════════════════════════════════ */
function injectSheetBackdrop() {
  if (document.getElementById('mobile-sheet-backdrop')) return;
  const bd = document.createElement('div');
  bd.id = 'mobile-sheet-backdrop';
  bd.className = 'mobile-sheet-backdrop';
  bd.addEventListener('click', closeSheet);
  document.body.appendChild(bd);
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOTTOM SHEET
   ═══════════════════════════════════════════════════════════════════════════ */
function injectBottomSheet() {
  if (document.getElementById('mobile-bottom-sheet')) return;

  const sheet = document.createElement('div');
  sheet.id = 'mobile-bottom-sheet';
  sheet.className = 'mobile-bottom-sheet';
  sheet.innerHTML = `
    <div class="mobile-sheet-handle"></div>
    <div class="mobile-sheet-title">Tools</div>

    <div class="mobile-info-section" id="mob-info-section">
      <div class="info-card"><div class="info-label">selected</div><div class="info-value" id="mob-sel-hex">#—</div></div>
      <div class="info-card"><div class="info-label">hsl</div><div class="info-value" id="mob-sel-hsl">—</div></div>
      <div class="info-card"><div class="info-label">contrast</div><div class="info-value" id="mob-sel-contrast">—</div></div>
    </div>

    <div class="drawer-body">
      <div class="drawer-section-label">Modes</div>
      <div class="drawer-tab active" id="mob-tab-edit" data-sheet-action="edit">
        <div class="drawer-tab-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
        <div class="drawer-tab-text"><div class="drawer-tab-label">Editor</div><div class="drawer-tab-sub">build palette</div></div>
      </div>
      <div class="drawer-tab" id="mob-tab-viz" data-sheet-action="viz">
        <div class="drawer-tab-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></div>
        <div class="drawer-tab-text"><div class="drawer-tab-label">Visualize</div><div class="drawer-tab-sub">see it in action</div></div>
      </div>

      <div class="drawer-section-label" style="margin-top:4px;">Vision</div>
      <div class="drawer-tab" id="mob-tab-cvd" data-sheet-action="cvd">
        <div class="drawer-tab-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg></div>
        <div class="drawer-tab-text"><div class="drawer-tab-label">Color Vision</div><div class="drawer-tab-sub" id="mob-cvd-sub">normal</div></div>
        <div class="drawer-tab-arr"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:14px;height:14px"><polyline points="9 18 15 12 9 6"/></svg></div>
      </div>

      <div class="drawer-section-label" style="margin-top:4px;">Import</div>
      <div class="drawer-tab" id="mob-tab-img" data-sheet-action="img">
        <div class="drawer-tab-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
        <div class="drawer-tab-text"><div class="drawer-tab-label">Color from Image</div><div class="drawer-tab-sub">extract palette</div></div>
      </div>

      <div class="drawer-section-label" style="margin-top:4px;">Appearance</div>
      <div class="drawer-tab" data-sheet-action="theme">
        <div class="drawer-tab-icon" id="mob-theme-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:15px;height:15px"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg></div>
        <div class="drawer-tab-text"><div class="drawer-tab-label" id="mob-theme-label">Dark mode</div><div class="drawer-tab-sub">toggle light / dark</div></div>
      </div>

      <div class="drawer-section-label" style="margin-top:4px;">Palette name</div>
      <div style="padding:4px 14px 8px;">
        <input type="text" id="mob-palette-name"
          style="width:100%;background:var(--hover);border:.5px solid var(--border2);border-radius:8px;
                 color:var(--text);font-size:12px;padding:9px 12px;font-family:var(--mono);
                 outline:none;letter-spacing:.1em;transition:border-color 0.2s;"
          placeholder="palette name" />
      </div>
    </div>
  `;
  document.body.appendChild(sheet);

  // wire tab clicks
  sheet.querySelectorAll('[data-sheet-action]').forEach(el => {
    el.addEventListener('click', () => {
      const action = el.dataset.sheetAction;
      if (action === 'edit') {
        document.getElementById('view-edit')?.classList.add('active');
        document.getElementById('view-viz')?.classList.remove('active');
        document.getElementById('mob-viz')?.classList.remove('active-view');
        closeSheet();
      } else if (action === 'viz') {
        document.getElementById('view-viz')?.classList.add('active');
        document.getElementById('view-edit')?.classList.remove('active');
        document.getElementById('mob-viz')?.classList.add('active-view');
        document.dispatchEvent(new CustomEvent('mobile-render-viz'));
        closeSheet();
      } else if (action === 'cvd') {
        if (typeof window.activateTab === 'function') window.activateTab('cvd');
        const sub = document.getElementById('mob-cvd-sub');
        const desk = document.getElementById('cvd-sub');
        if (sub && desk) sub.textContent = desk.textContent;
      } else if (action === 'img') {
        if (typeof window.activateTab === 'function') window.activateTab('img');
        closeSheet();
      } else if (action === 'theme') {
        if (typeof window.toggleTheme === 'function') window.toggleTheme();
        syncThemeLabel();
      }
    });
  });

  sheet.querySelector('#mob-palette-name').addEventListener('change', function() {
    if (typeof window.updatePaletteName === 'function') window.updatePaletteName(this.value);
    const topInput = document.getElementById('palette-name-input');
    if (topInput) topInput.value = this.value;
  });
}

export function openSheet() {
  document.getElementById('mobile-bottom-sheet')?.classList.add('open');
  document.getElementById('mobile-sheet-backdrop')?.classList.add('open');
  const nameInput = document.getElementById('mob-palette-name');
  if (nameInput) nameInput.value = PALETTES[current]?.name || '';
  syncThemeLabel();
  syncSheetInfo();
}

export function closeSheet() {
  document.getElementById('mobile-bottom-sheet')?.classList.remove('open');
  document.getElementById('mobile-sheet-backdrop')?.classList.remove('open');
}
window.closeMobileSheet = closeSheet;

function syncThemeLabel() {
  const isLight = document.documentElement.classList.contains('light');
  const label = document.getElementById('mob-theme-label');
  const icon  = document.getElementById('mob-theme-icon');
  if (label) label.textContent = isLight ? 'Light mode' : 'Dark mode';
  if (icon) {
    icon.innerHTML = isLight
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:15px;height:15px"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="7.05" y2="7.05"/><line x1="16.95" y1="16.95" x2="19.07" y2="19.07"/><line x1="4.93" y1="19.07" x2="7.05" y2="16.95"/><line x1="16.95" y1="7.05" x2="19.07" y2="4.93"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="width:15px;height:15px"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  }
}

export function syncSheetInfo() {
  if (!isMobile()) return;
  [['mob-sel-hex','sel-hex'],['mob-sel-hsl','sel-hsl'],['mob-sel-contrast','sel-contrast']].forEach(([m,d]) => {
    const mob = document.getElementById(m), desk = document.getElementById(d);
    if (mob && desk) mob.textContent = desk.textContent;
  });
  const mc = document.getElementById('mob-cvd-sub'), dc = document.getElementById('cvd-sub');
  if (mc && dc) mc.textContent = dc.textContent;
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════════════════════════ */
function showMobileToast(msg) {
  let toast = document.getElementById('mob-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mob-toast';
    toast.style.cssText = [
      'position:fixed',
      'bottom:82px',
      'left:50%',
      'transform:translateX(-50%) translateY(8px)',
      'background:var(--card)',
      'border:.5px solid var(--border2)',
      'border-radius:10px',
      'padding:9px 18px',
      'font-family:var(--mono)',
      'font-size:10px',
      'letter-spacing:.14em',
      'text-transform:uppercase',
      'color:var(--text)',
      'z-index:500',
      'opacity:0',
      'transition:opacity 0.18s ease, transform 0.18s ease',
      'pointer-events:none',
      'white-space:nowrap',
      'box-shadow:0 4px 20px var(--shadow)',
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  // Force reflow so transition fires even on re-use
  void toast.offsetWidth;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(8px)';
  }, 2200);
}

/* ═══════════════════════════════════════════════════════════════════════════
   MOBILE SWATCH RENDER
   ═══════════════════════════════════════════════════════════════════════════ */
export function renderMobileSwatches() {
  if (!isMobile()) return;

  const p       = PALETTES[current];
  const display = getDisplay(); // CVD-simulated colours for bg
  const container = document.getElementById('swatches');
  if (!container) return;

  container.innerHTML = '';

  display.forEach((hex, i) => {
    const realHex  = p.colors[i];
    const tc       = textColor(hex);
    const name     = (p.names && p.names[i]) || getColorName(realHex) || '';
    const isLocked = locks[i] || false;

    const row = document.createElement('div');
    row.className = 'swatch';
    row.dataset.index = String(i);
    row.style.background = hex;
    row.style.setProperty('color', tc);

    row.innerHTML = `
      <div class="mob-swipe-delete-bg" data-index="${i}">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </div>

      <div class="mob-swipe-content" data-index="${i}">
        <div class="copy-check" id="check-${i}">
          <svg viewBox="0 0 48 48" preserveAspectRatio="xMidYMid meet">
            <circle class="check-circle" cx="24" cy="24" r="16" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            <polyline class="check-tick" points="16,24 22,30 32,18" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <div class="mobile-swatch-info">
          <div class="mobile-hex" style="color:${tc}">${realHex.toUpperCase()}</div>
          <div class="mobile-name" style="color:${tc}">${name}</div>
        </div>

        <div class="mobile-swatch-icons">
          <div class="mobile-icon mobile-drag-handle" title="Reorder">
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
              <polyline points="12 4 9 7 15 7 12 4"/><line x1="12" y1="7" x2="12" y2="17"/><polyline points="9 17 12 20 15 17"/>
            </svg>
          </div>
          <div class="mobile-icon" data-action="copy" title="Copy hex">
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </div>
          <div class="mobile-icon" data-action="edit" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div class="mobile-icon ${isLocked ? 'locked' : ''}" data-action="lock" title="${isLocked ? 'Unlock' : 'Lock'}">
            ${isLocked
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`
            }
          </div>
        </div>
      </div>
    `;

    row.querySelector('[data-action="copy"]').addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(realHex).catch(() => {});
      showCheck(i);
    });

    row.querySelector('[data-action="edit"]').addEventListener('click', e => {
      e.stopPropagation();
      if (typeof window.openEditorAt === 'function') window.openEditorAt(i, row);
    });

    row.querySelector('[data-action="lock"]').addEventListener('click', e => {
      e.stopPropagation();
      locks[i] = !locks[i];
      setLocks([...locks]);
      _render();
    });

    initTouchDrag(row.querySelector('.mobile-drag-handle'), i, container);
    initSwipeToDelete(row, i);
    container.appendChild(row);
  });

  syncSheetInfo();
  syncThemeLabel();
  initPullToAdd(container);
}

function showCheck(i) {
  const el = document.getElementById('check-' + i);
  if (!el) return;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1200);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SWIPE-TO-DELETE  (Discord-style)
   ═══════════════════════════════════════════════════════════════════════════ */
function initSwipeToDelete(row, idx) {
  const content = row.querySelector('.mob-swipe-content');
  const bg      = row.querySelector('.mob-swipe-delete-bg');
  if (!content || !bg) return;

  const DELETE_THRESHOLD = 110; // px needed to trigger delete
  const MAX_REVEAL       = 90;  // px of delete bg shown at rest before threshold
  let startX = 0, startY = 0;
  let currentX = 0;
  let isDragging = false;
  let isHorizontal = null;
  let isAnimating = false;

  content.addEventListener('touchstart', e => {
    if (isAnimating) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    currentX = 0;
    isDragging = true;
    isHorizontal = null;
    content.style.transition = 'none';
    bg.style.transition = 'none';
  }, { passive: true });

  content.addEventListener('touchmove', e => {
    if (!isDragging || isAnimating) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    // Determine gesture direction on first significant move
    if (isHorizontal === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isHorizontal = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontal) return; // let vertical scrolling happen naturally

    e.preventDefault(); // prevent scroll for horizontal swipe

    // Only allow left swipe (negative dx)
    const rawDelta = Math.min(0, dx);

    // If locked, give rubber-band resistance: can only pull slightly
    const isLocked = locks[idx] || false;
    if (isLocked) {
      // Rubberband: sqrt dampening, max 24px reveal
      currentX = -Math.min(24, Math.sqrt(Math.abs(rawDelta)) * 2.5);
    } else {
      if (Math.abs(rawDelta) <= DELETE_THRESHOLD) {
        currentX = rawDelta;
      } else {
        // Past threshold: slow down extra pull (rubber band)
        const extra = Math.abs(rawDelta) - DELETE_THRESHOLD;
        currentX = -(DELETE_THRESHOLD + extra * 0.18);
      }
    }

    applySwipePosition(content, bg, currentX, DELETE_THRESHOLD, isLocked);
  }, { passive: false });

  content.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    isHorizontal = null;

    const isLocked = locks[idx] || false;

    if (!isLocked && Math.abs(currentX) >= DELETE_THRESHOLD) {
      // Trigger delete: fly out then remove
      triggerDeleteAnimation(row, idx, content, bg);
    } else {
      // Spring back
      isAnimating = true;
      content.style.transition = 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)';
      bg.style.transition      = 'opacity 0.38s cubic-bezier(0.34,1.56,0.64,1), width 0.38s cubic-bezier(0.34,1.56,0.64,1)';
      content.style.transform  = 'translateX(0)';
      bg.style.opacity         = '0';
      bg.style.width           = '0';
      setTimeout(() => {
        isAnimating = false;
        content.style.transition = '';
        bg.style.transition = '';
      }, 400);
    }
    currentX = 0;
  }, { passive: true });
}

function applySwipePosition(content, bg, dx, threshold, isLocked) {
  content.style.transform = `translateX(${dx}px)`;
  const progress = Math.min(1, Math.abs(dx) / threshold);
  const bgWidth  = Math.abs(dx);
  bg.style.width   = `${bgWidth}px`;
  bg.style.opacity = isLocked ? String(Math.min(0.25, progress * 0.4)) : String(Math.min(1, progress * 1.4));

  // Past threshold: tint bg red
  if (!isLocked && Math.abs(dx) >= threshold) {
    bg.classList.add('mob-delete-ready');
  } else {
    bg.classList.remove('mob-delete-ready');
  }
}

function triggerDeleteAnimation(row, idx, content, bg) {
  const rowHeight = row.getBoundingClientRect().height;

  // Step 1: Fly the content out to the left
  content.style.transition = 'transform 0.2s cubic-bezier(0.4,0,0.8,0.6)';
  bg.style.transition      = 'width 0.2s cubic-bezier(0.4,0,0.8,0.6)';
  content.style.transform  = `translateX(-110%)`;
  bg.style.width           = '100%';

  setTimeout(() => {
    // Step 2: Pin the row to its current height so we can animate FROM it
    row.style.maxHeight  = rowHeight + 'px';
    row.style.minHeight  = '0';          // override the 10vh floor so it can collapse
    row.style.flex       = '0 0 auto';   // stop it participating in flex distribution
    row.style.overflow   = 'hidden';

    // Force a reflow so the browser registers the starting state
    void row.offsetHeight;

    // Step 3: Animate to zero — siblings flex-grow to fill the gap
    row.style.transition = [
      'max-height 0.32s cubic-bezier(0.4,0,0.2,1)',
      'opacity 0.22s ease',
      'padding 0.32s cubic-bezier(0.4,0,0.2,1)',
    ].join(', ');
    row.style.maxHeight  = '0';
    row.style.opacity    = '0';

    setTimeout(() => {
      const p    = PALETTES[current];
      const cols = [...p.colors];
      const nms  = [...(p.names || [])];
      const lks  = [...locks];
      cols.splice(idx, 1);
      nms.splice(idx, 1);
      lks.splice(idx, 1);
      p.colors = cols;
      p.names  = nms;
      setLocks(lks);
      updateURL();
      _render();
    }, 340);
  }, 200);
}

/* ═══════════════════════════════════════════════════════════════════════════
   PULL-TO-ADD  (spring resistance, like the desktop + button)

   The zone lives as the last child of .swatches (the scrollable container),
   so it is naturally hidden when you have few swatches — you have to scroll
   down to see it, just like any other content below the fold.

   10 swatches fill the viewport (min-height: 10vh each). Beyond 10 the
   container scrolls. The zone is always at the bottom of the scroll content,
   so you reach it by scrolling down.

   After a successful add we scroll the container to the bottom so the zone
   stays in view — otherwise the re-render resets scroll to top and you'd
   have to scroll back down to add another one.
   ═══════════════════════════════════════════════════════════════════════════ */
function initPullToAdd(container) {
  // Remove any old zone first (re-render case)
  const old = container.querySelector('.mob-pull-up-zone');
  if (old) old.remove();

  // Build the zone inside the scroll container so it's in normal flow
  const zone = document.createElement('div');
  zone.className = 'mob-pull-up-zone';
  zone.innerHTML = `
    <div class="mob-pull-up-inner">
      <div class="mob-pull-up-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </div>
      <span class="mob-pull-up-label">add color</span>
    </div>
  `;
  container.appendChild(zone);

  const inner = zone.querySelector('.mob-pull-up-inner');
  const label = zone.querySelector('.mob-pull-up-label');

  const TRIGGER_DISTANCE = 72;
  const MAX_PULL        = 110;
  let pullStartY  = 0;
  let isPulling   = false;
  let pullDelta   = 0;
  let triggered   = false;
  let isAnimating = false;
  // Track whether pull gesture was initiated at the bottom
  let gestureStartedAtBottom = false;

  // The swatches container IS the scrollable element.
  // We detect "at bottom" generously: the 64px padding-bottom on .swatches
  // is part of scrollHeight but not part of visible content, so we need
  // a tolerance of at least that much plus some subpixel slack.
  container.addEventListener('touchstart', e => {
    if (isAnimating) return;
    gestureStartedAtBottom = false;
    pullDelta = 0;
    triggered = false;
    isPulling = false;

    // Generous tolerance: 64px padding-bottom + 16px subpixel/rounding slack
    const atBottom = (container.scrollTop + container.clientHeight) >= (container.scrollHeight - 80);
    if (!atBottom) return;

    gestureStartedAtBottom = true;
    pullStartY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchmove', e => {
    if (isAnimating || !gestureStartedAtBottom) return;

    const dy = pullStartY - e.touches[0].clientY; // positive = finger moving up = pulling up
    if (dy <= 0) return;

    isPulling = true;
    // Spring curve: sqrt so resistance increases with distance
    pullDelta = Math.min(MAX_PULL, Math.sqrt(dy) * 8.5);

    // Grow the zone (it's in-flow, so it's at the bottom of scroll content)
    zone.style.height  = pullDelta + 'px';
    zone.style.opacity = String(Math.min(1, pullDelta / TRIGGER_DISTANCE));
    inner.style.transform = `scale(${0.7 + 0.3 * Math.min(1, pullDelta / TRIGGER_DISTANCE)})`;

    // Push swatches up by scrolling the container down to follow the growing zone,
    // so it's always visible regardless of how many swatches there are.
    container.scrollTop = container.scrollHeight - container.clientHeight;

    if (pullDelta >= TRIGGER_DISTANCE && !triggered) {
      triggered = true;
      label.textContent = 'release to add';
      zone.classList.add('mob-pull-ready');
      if (navigator.vibrate) navigator.vibrate(10);
    } else if (pullDelta < TRIGGER_DISTANCE && triggered) {
      triggered = false;
      label.textContent = 'add color';
      zone.classList.remove('mob-pull-ready');
    }
  }, { passive: true });

  container.addEventListener('touchend', () => {
    if (!isPulling) {
      gestureStartedAtBottom = false;
      return;
    }
    isPulling = false;
    gestureStartedAtBottom = false;
    zone.classList.remove('mob-pull-ready');

    if (triggered) {
      // Check max swatches before doing anything
      const p = PALETTES[current];
      if (p.colors.length >= 15) {
        // Show error toast and spring back — no add
        showMobileToast('max swatches reached: 15');
        zone.style.transition  = 'height 0.36s cubic-bezier(0.34,1.56,0.64,1), opacity 0.24s ease';
        inner.style.transition = 'transform 0.36s cubic-bezier(0.34,1.56,0.64,1)';
        zone.style.height      = '0';
        zone.style.opacity     = '0';
        inner.style.transform  = 'scale(0.7)';
        setTimeout(() => {
          zone.style.transition  = '';
          inner.style.transition = '';
          label.textContent = 'add color';
        }, 380);
        pullDelta = 0;
        triggered = false;
        return;
      }

      isAnimating = true;
      // Satisfying bounce on the + icon
      inner.style.transition = 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)';
      inner.style.transform  = 'scale(1.18)';
      setTimeout(() => { inner.style.transform = 'scale(0.88)'; }, 130);

      setTimeout(() => {
        // Collapse zone with spring
        zone.style.transition = 'height 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease';
        zone.style.height     = '0';
        zone.style.opacity    = '0';
        setTimeout(() => {
          zone.style.transition  = '';
          inner.style.transition = '';
          inner.style.transform  = 'scale(0.7)';
          label.textContent = 'add color';
          isAnimating = false;
        }, 340);

        // Add color — guarded by module-level cooldown so re-renders can't double-fire
        if (!_addCooldown) {
          _addCooldown = true;
          setTimeout(() => { _addCooldown = false; }, 800); // reset after animation settles

          if (typeof window.addColor === 'function') {
            window.addColor();
          } else {
            const p = PALETTES[current];
            const newHex = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
            p.colors.push(newHex);
            if (!p.names) p.names = [];
            p.names.push(null);
            locks.push(false);
            setLocks([...locks]);
            updateURL();
            _render();
          }

          // After the re-render (which resets DOM), scroll to bottom so the
          // pull zone is visible again. Use a short delay to let render settle.
          setTimeout(() => {
            const c = document.getElementById('swatches');
            if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
          }, 80);
        }
      }, 210);
    } else {
      // Spring back — no add
      zone.style.transition  = 'height 0.36s cubic-bezier(0.34,1.56,0.64,1), opacity 0.24s ease';
      inner.style.transition = 'transform 0.36s cubic-bezier(0.34,1.56,0.64,1)';
      zone.style.height      = '0';
      zone.style.opacity     = '0';
      inner.style.transform  = 'scale(0.7)';
      setTimeout(() => {
        zone.style.transition  = '';
        inner.style.transition = '';
      }, 380);
    }
    pullDelta = 0;
    triggered = false;
  }, { passive: true });
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOUCH DRAG-TO-REORDER
   ═══════════════════════════════════════════════════════════════════════════ */
function initTouchDrag(handle, srcIndex, container) {
  if (!handle) return;
  let targetIndex = srcIndex;
  let rows = [];

  handle.addEventListener('touchstart', e => {
    e.preventDefault();
    targetIndex = srcIndex;
    rows = Array.from(container.querySelectorAll('.swatch'));
    rows[srcIndex]?.classList.add('mobile-dragging');
  }, { passive: false });

  handle.addEventListener('touchmove', e => {
    e.preventDefault();
    const y = e.touches[0].clientY;
    rows.forEach((row, idx) => {
      row.classList.remove('mobile-drag-over-above', 'mobile-drag-over-below');
      const rect = row.getBoundingClientRect();
      if (y >= rect.top && y < rect.bottom) {
        targetIndex = idx;
        row.classList.add(y < rect.top + rect.height / 2
          ? 'mobile-drag-over-above' : 'mobile-drag-over-below');
      }
    });
  }, { passive: false });

  handle.addEventListener('touchend', e => {
    e.preventDefault();
    rows.forEach(r => r.classList.remove('mobile-dragging','mobile-drag-over-above','mobile-drag-over-below'));
    if (targetIndex !== srcIndex) {
      const p    = PALETTES[current];
      const cols = [...p.colors];
      const nms  = [...(p.names || [])];
      const lks  = [...locks];
      const [sc] = cols.splice(srcIndex, 1);
      const [sn] = nms.splice(srcIndex, 1);
      const [sl] = lks.splice(srcIndex, 1);
      cols.splice(targetIndex, 0, sc);
      nms.splice(targetIndex, 0, sn);
      lks.splice(targetIndex, 0, sl);
      p.colors = cols; p.names = nms;
      setLocks(lks);
      updateURL();
      _render();
    }
  }, { passive: false });
}