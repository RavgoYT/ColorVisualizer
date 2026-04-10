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
/* ── drag-active flag: suppresses pull-to-add during reorder drags ───────── */
let _isDragging = false;

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
  initBottomSheetSwipeDismiss();
  initEditorPopupSwipeDismiss();
  initExportPopupSwipeDismiss();
  initVizActionMenus();
  syncThemeLabel(); // sync theme-color meta on first load
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLOSE ALL MENUS  — call before opening any panel so only one is ever open
   ═══════════════════════════════════════════════════════════════════════════ */
function closeAllMenus() {
  // Tools sheet
  closeSheet();
  // Export popup
  const exportPopup = document.getElementById('export-popup');
  if (exportPopup) exportPopup.classList.remove('open');
  // Editor popup
  const editorPopup = document.getElementById('editor-popup');
  if (editorPopup) editorPopup.classList.remove('open');
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
    <button class="mob-btn-icon" id="mob-viz" title="Visualize">
      <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
    </button>
    <button class="mob-btn-icon" id="mob-export" title="Export">
      <svg viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
    </button>
    <button class="mob-btn-icon" id="mob-menu" title="Menu">
      <svg viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
  `;
  document.body.appendChild(bar);

  document.getElementById('mob-generate').addEventListener('click', () => {
    closeAllMenus();
    if (typeof window.randomize === 'function') window.randomize();
  });

  document.getElementById('mob-viz').addEventListener('click', () => {
    closeAllMenus();
    const editSection = document.getElementById('view-edit');
    const vizSection  = document.getElementById('view-viz');
    const isViz = vizSection.classList.contains('active');
    editSection.classList.toggle('active', isViz);
    vizSection.classList.toggle('active', !isViz);
    document.getElementById('mob-viz').classList.toggle('active-view', !isViz);
    if (!isViz) {
      document.dispatchEvent(new CustomEvent('mobile-render-viz'));
      requestAnimationFrame(() => setupVizButtons());
    }
  });

  // Export button → close all menus first, then open export popup
  document.getElementById('mob-export').addEventListener('click', (e) => {
    e.stopPropagation();
    const exportPopup = document.getElementById('export-popup');
    const isOpen = exportPopup && exportPopup.classList.contains('open');
    closeAllMenus();
    if (!isOpen) {
      if (typeof window.toggleExport === 'function') window.toggleExport();
      injectCopyLinkIntoExportPopup();
    }
  });

  document.getElementById('mob-menu').addEventListener('click', () => {
    const sheet = document.getElementById('mobile-bottom-sheet');
    const isOpen = sheet && sheet.classList.contains('open');
    closeAllMenus();
    if (!isOpen) openSheet();
  });

  document.addEventListener('mobile-render-viz', () => {
    requestAnimationFrame(() => setupVizButtons());
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   VIZ BUTTONS  — upload icon that opens PNG / copy-link mini-menu
   ═══════════════════════════════════════════════════════════════════════════ */
const VIZ_TYPES = ['geo', 'type', 'depth', 'flow'];

function setupVizButtons() {
  const btns = document.querySelectorAll('.viz-dl-btn');
  btns.forEach((btn, i) => {
    if (btn.dataset.mobileVizWired) return;
    btn.dataset.mobileVizWired = '1';
    btn.classList.add('mob-viz-upload');

    // Replace icon with upload/share arrow
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>`;

    // Remove any existing inline onclick (desktop download handler)
    btn.removeAttribute('onclick');

    // Build the mini-menu if not already there
    const card = btn.closest('.viz-card');
    if (!card) return;
    let menu = card.querySelector('.viz-action-menu');
    if (!menu) {
      menu = document.createElement('div');
      menu.className = 'viz-action-menu';
      const type = VIZ_TYPES[i] || 'geo';
      menu.innerHTML = `
        <div class="viz-action-item" data-action="png">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Save PNG
        </div>
        <div class="viz-action-item" data-action="link">
          <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          Copy Link
        </div>
      `;
      card.appendChild(menu);

      menu.querySelector('[data-action="png"]').addEventListener('click', e => {
        e.stopPropagation();
        menu.classList.remove('open');
        btn.classList.remove('active-view');
        // Try window.exportVizCard (if main.js exposes it) then fall back to _exportVizCard
        const fn = window.exportVizCard || window._exportVizCard;
        if (typeof fn === 'function') fn(type);
      });

      menu.querySelector('[data-action="link"]').addEventListener('click', e => {
        e.stopPropagation();
        menu.classList.remove('open');
        btn.classList.remove('active-view');
        const slugMap = { geo: '/geo', type: '/typo', depth: '/layers', flow: '/gradient' };
        const base = location.origin + location.pathname.replace(/\/$/, '');
        const shareURL = base + (slugMap[type] || '');
        if (navigator.share) {
          navigator.share({ url: shareURL }).catch(() => {
            navigator.clipboard.writeText(shareURL).catch(() => {});
          });
        } else {
          navigator.clipboard.writeText(shareURL).catch(() => {});
          showMobileToast('link copied');
        }
      });
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = menu.classList.contains('open');
      // Close all other open menus
      document.querySelectorAll('.viz-action-menu.open').forEach(m => m.classList.remove('open'));
      document.querySelectorAll('.viz-dl-btn.active-view').forEach(b => b.classList.remove('active-view'));
      if (!isOpen) {
        menu.classList.add('open');
        btn.classList.add('active-view');
      }
    });
  });

  // Tap elsewhere closes any open viz menu
  document.addEventListener('click', () => {
    document.querySelectorAll('.viz-action-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.viz-dl-btn.active-view').forEach(b => b.classList.remove('active-view'));
  }, { once: false, capture: true });
}

// Expose for external calls
function initVizActionMenus() {
  // Will be called after viz renders — no-op at boot, set up via event
}

/* ═══════════════════════════════════════════════════════════════════════════
   SWIPE-DOWN-TO-DISMISS  — bottom sheets & popups
   Attach to any element with a drag-handle; a downward swipe closes it.
   ═══════════════════════════════════════════════════════════════════════════ */
function addSwipeDismiss(el, closeCallback, handleSelector) {
  if (!el) return;
  // If a specific handle selector is given, use it; otherwise use the whole element.
  // For the bottom sheet we want the entire sheet body to be draggable downward.
  const handle = (handleSelector && el.querySelector(handleSelector)) || el;
  let startY = 0, isDragging = false;

  handle.addEventListener('touchstart', e => {
    // Don't intercept taps on interactive children (inputs, buttons, tabs)
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'BUTTON' || e.target.closest('[data-sheet-action]')) return;
    startY = e.touches[0].clientY;
    isDragging = true;
    el.style.transition = 'none';
  }, { passive: true });

  handle.addEventListener('touchmove', e => {
    if (!isDragging) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) {
      el.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });

  handle.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const dy = e.changedTouches[0].clientY - startY;
    el.style.transition = '';
    if (dy > 80) {
      el.style.transform = 'translateY(100%)';
      setTimeout(() => {
        el.style.transform = '';
        closeCallback();
      }, 300);
    } else {
      el.style.transform = '';
    }
  }, { passive: true });
}

function initBottomSheetSwipeDismiss() {
  const tryAttach = () => {
    const sheet = document.getElementById('mobile-bottom-sheet');
    if (sheet) {
      // Pass no handleSelector — entire sheet body is the drag target,
      // interactive children are excluded inside addSwipeDismiss.
      addSwipeDismiss(sheet, closeSheet);
    } else {
      requestAnimationFrame(tryAttach);
    }
  };
  tryAttach();
}

function initEditorPopupSwipeDismiss() {
  // Editor popup handle is the ::before pseudo — we use a wide touch target at top
  const tryAttach = () => {
    const popup = document.getElementById('editor-popup');
    if (popup) {
      // Create an invisible drag handle div at the top of the popup
      if (!popup.querySelector('.mob-popup-handle')) {
        const handle = document.createElement('div');
        handle.className = 'mob-popup-handle';
        handle.style.cssText = 'position:absolute;top:0;left:0;right:0;height:32px;z-index:10;cursor:grab;';
        popup.insertBefore(handle, popup.firstChild);
      }
      addSwipeDismiss(popup, () => {
        popup.classList.remove('open');
        const backdrop = popup.previousElementSibling;
        if (backdrop && backdrop.classList.contains('editor-backdrop')) backdrop.classList.remove('open');
      }, '.mob-popup-handle');
    } else {
      setTimeout(tryAttach, 500);
    }
  };
  tryAttach();
}

function initExportPopupSwipeDismiss() {
  const tryAttach = () => {
    const popup = document.getElementById('export-popup');
    if (popup) {
      // Use the ::before pseudo-element area (top 28px) as visual handle.
      // We do NOT inject a real DOM handle div — that intercepts taps on export options.
      // Instead we listen for swipe-down starting in the top 36px of the popup.
      let startY = 0, isDragging = false;
      popup.addEventListener('touchstart', e => {
        const rect = popup.getBoundingClientRect();
        if (e.touches[0].clientY - rect.top > 36) return; // only handle-area
        startY = e.touches[0].clientY;
        isDragging = true;
        popup.style.transition = 'none';
      }, { passive: true });
      popup.addEventListener('touchmove', e => {
        if (!isDragging) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > 0) popup.style.transform = `translateY(${dy}px)`;
      }, { passive: true });
      popup.addEventListener('touchend', e => {
        if (!isDragging) return;
        isDragging = false;
        const dy = e.changedTouches[0].clientY - startY;
        popup.style.transition = '';
        if (dy > 80) {
          popup.style.transform = 'translateY(100%)';
          setTimeout(() => { popup.style.transform = ''; popup.classList.remove('open'); }, 300);
        } else {
          popup.style.transform = '';
        }
      }, { passive: true });
    } else {
      setTimeout(tryAttach, 500);
    }
  };
  tryAttach();
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

      <div class="drawer-section-label" style="margin-top:4px;">Export</div>
      <div class="drawer-tab" data-sheet-action="export">
        <div class="drawer-tab-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></div>
        <div class="drawer-tab-text"><div class="drawer-tab-label">Export Palette</div><div class="drawer-tab-sub">CSS, JSON, PNG…</div></div>
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
      } else if (action === 'export') {
        closeSheet();
        setTimeout(() => {
          if (typeof window.toggleExport === 'function') window.toggleExport();
          // Inject "Copy Link" option into the export popup if not already there
          injectCopyLinkIntoExportPopup();
        }, 200);
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

function injectCopyLinkIntoExportPopup() {
  const popup = document.getElementById('export-popup');
  if (!popup || popup.querySelector('[data-mob-copy-link]')) return;
  // Find the divider and insert before it (so Copy Link sits in the Copy section)
  const divider = popup.querySelector('.export-divider');
  const item = document.createElement('div');
  item.className = 'export-opt';
  item.dataset.mobCopyLink = '1';
  item.innerHTML = `
    <div class="export-opt-icon"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></div>
    <div class="export-opt-info"><div class="export-opt-label">Copy link</div><div class="export-opt-sub">share this palette</div></div>
  `;
  item.addEventListener('click', () => {
    navigator.clipboard.writeText(location.href).catch(() => {});
    popup.classList.remove('open');
    showMobileToast('link copied');
  });
  if (divider) {
    popup.insertBefore(item, divider);
  } else {
    popup.appendChild(item);
  }
}

function syncThemeLabel() {
  const isLight = document.documentElement.classList.contains('light');
  const label = document.getElementById('mob-theme-label');
  const icon  = document.getElementById('mob-theme-icon');
  // Keep browser chrome (status bar / Dynamic Island area) in sync with card bg
  const meta = document.getElementById('theme-color-meta');
  if (meta) meta.setAttribute('content', isLight ? '#ffffff' : '#0e0e16');
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
  const display = getDisplay();
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
        <div class="mob-delete-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>
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
          <input class="mobile-name-input" data-action="rename" style="color:${tc};opacity:0.55;" value="${name}" placeholder="name…" />
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

    // Tapping the hex label itself also copies — tap area is scoped to the text
    row.querySelector('.mobile-hex').addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(realHex).catch(() => {});
      showCheck(i);
    });

    row.querySelector('[data-action="edit"]').addEventListener('click', e => {
      e.stopPropagation();
      // Open editor WITHOUT auto-focusing (pass noFocus flag if supported)
      if (typeof window.openEditorAt === 'function') window.openEditorAt(i, row);
    });

    row.querySelector('[data-action="lock"]').addEventListener('click', e => {
      e.stopPropagation();
      locks[i] = !locks[i];
      setLocks([...locks]);
      _render();
    });

    row.querySelector('[data-action="rename"]').addEventListener('click', e => {
      e.stopPropagation();
    });
    row.querySelector('[data-action="rename"]').addEventListener('change', function(e) {
      e.stopPropagation();
      const p = PALETTES[current];
      if (!p.names) p.names = [];
      p.names[i] = this.value;
      if (typeof window.updateSwatchName === 'function') window.updateSwatchName(i, this.value);
      updateURL();
    });

    initTouchDrag(row.querySelector('.mobile-drag-handle'), i, container);
    initLongPressDrag(row, i, container);
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
   SWIPE-TO-DELETE  (full swatch slides; trash icon on card bg)
   ═══════════════════════════════════════════════════════════════════════════ */
function initSwipeToDelete(row, idx) {
  const content = row.querySelector('.mob-swipe-content');
  const bg      = row.querySelector('.mob-swipe-delete-bg');
  if (!content || !bg) return;

  const DELETE_THRESHOLD = 110;
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

    if (isHorizontal === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isHorizontal = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontal) return;

    e.preventDefault();

    const rawDelta = Math.min(0, dx);
    const isLocked = locks[idx] || false;
    if (isLocked) {
      currentX = -Math.min(24, Math.sqrt(Math.abs(rawDelta)) * 2.5);
    } else {
      if (Math.abs(rawDelta) <= DELETE_THRESHOLD) {
        currentX = rawDelta;
      } else {
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
      triggerDeleteAnimation(row, idx, content, bg);
    } else {
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

  if (!isLocked && Math.abs(dx) >= threshold) {
    bg.classList.add('mob-delete-ready');
  } else {
    bg.classList.remove('mob-delete-ready');
  }
}

function triggerDeleteAnimation(row, idx, content, bg) {
  const p = PALETTES[current];
  if (p.colors.length <= 2) {
    // Snap back with error shake
    content.style.transition = 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)';
    bg.style.transition = 'opacity 0.38s ease, width 0.38s ease';
    content.style.transform = 'translateX(0)';
    bg.style.opacity = '0';
    bg.style.width = '0';
    setTimeout(() => {
      content.style.transition = '';
      bg.style.transition = '';
    }, 400);
    showMobileToast('need at least 2 colors');
    return;
  }
  const rowHeight = row.getBoundingClientRect().height;

  content.style.transition = 'transform 0.2s cubic-bezier(0.4,0,0.8,0.6)';
  bg.style.transition      = 'width 0.2s cubic-bezier(0.4,0,0.8,0.6)';
  content.style.transform  = `translateX(-110%)`;
  bg.style.width           = '100%';

  setTimeout(() => {
    row.style.maxHeight  = rowHeight + 'px';
    row.style.minHeight  = '0';
    row.style.flex       = '0 0 auto';
    row.style.overflow   = 'hidden';

    void row.offsetHeight;

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
   PULL-TO-ADD
   ═══════════════════════════════════════════════════════════════════════════ */
function initPullToAdd(container) {
  const old = container.querySelector('.mob-pull-up-zone');
  if (old) old.remove();

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

  const TRIGGER_DISTANCE = 110;   // was 72 — needs more deliberate pull
  const MAX_PULL        = 130; // was 120
  const DEAD_ZONE       = 28;    // first 28px (was 18) of upward drag is ignored entirely
  let pullStartY  = 0;
  let isPulling   = false;
  let pullDelta   = 0;
  let triggered   = false;
  let isAnimating = false;
  let gestureStartedAtBottom = false;

container.addEventListener('touchstart', e => {
    if (isAnimating || _isDragging) return;
    gestureStartedAtBottom = false;
    pullDelta = 0;
    triggered = false;
    isPulling = false;

    // Require being FULLY at the scroll bottom (within 4px), not just 80px away
    const atBottom = (container.scrollTop + container.clientHeight) >= (container.scrollHeight - 4);
    if (!atBottom) return;

    gestureStartedAtBottom = true;
    pullStartY = e.touches[0].clientY;
  }, { passive: true });

    container.addEventListener('touchmove', e => {
    if (isAnimating || !gestureStartedAtBottom || _isDragging) return;

    const rawDy = pullStartY - e.touches[0].clientY;
    if (rawDy <= 0) return;

    // Dead zone: ignore first DEAD_ZONE px so normal scroll-end bounce doesn't fire
    const dy = Math.max(0, rawDy - DEAD_ZONE);
    if (dy <= 0) return;

    isPulling = true;
    // Steeper resistance: divide by 1.3 before sqrt so you need more travel
    pullDelta = Math.min(MAX_PULL, Math.sqrt(dy / 1.3) * 8.5);

    zone.style.height  = pullDelta + 'px';
    zone.style.opacity = String(Math.min(1, pullDelta / TRIGGER_DISTANCE));
    inner.style.transform = `scale(${0.7 + 0.3 * Math.min(1, pullDelta / TRIGGER_DISTANCE)})`;

    // Scroll to follow the expanding zone so it's always visible
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
      const p = PALETTES[current];
      if (p.colors.length >= 15) {
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
      inner.style.transition = 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)';
      inner.style.transform  = 'scale(1.18)';
      setTimeout(() => { inner.style.transform = 'scale(0.88)'; }, 130);

      setTimeout(() => {
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

        if (!_addCooldown) {
          _addCooldown = true;
          setTimeout(() => { _addCooldown = false; }, 800);

          if (typeof window.addColor === 'function') {
            // Pass a flag so the caller knows NOT to open the editor popup
            window.addColor({ skipEditor: true });
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

          // Scroll to bottom after render so pull zone is reachable
          setTimeout(() => {
            const c = document.getElementById('swatches');
            if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
          }, 80);
        }
      }, 210);
    } else {
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
  startDragBehavior(handle, srcIndex, container, false);
}

function startDragBehavior(triggerEl, srcIndex, container, isLongPress) {
  let targetIndex = srcIndex;
  let rows = [];
  let dragging = false;

const onStart = e => {
    e.preventDefault(); // prevent scroll while using the handle
    targetIndex = srcIndex;
    rows = Array.from(container.querySelectorAll('.swatch'));
    rows[srcIndex]?.classList.add('mobile-dragging');
    dragging = true;
    _isDragging = true;
  };

  const onMove = e => {
    if (!dragging) return;
    e.preventDefault(); // critical: stop page scroll during drag
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
  };

const onEnd = e => {
    if (!dragging) return;
    dragging = false;
    _isDragging = false;
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
  };

  triggerEl.addEventListener('touchstart', onStart, { passive: false });
  triggerEl.addEventListener('touchmove',  onMove,  { passive: false });
  triggerEl.addEventListener('touchend',   onEnd,   { passive: false });
}

function initLongPressDrag(row, srcIndex, container) {
  let longPressTimer = null;
  let didLongPress = false;

  row.addEventListener('touchstart', e => {
    // Don't activate on icon buttons or swipe-content interactions
    if (e.target.closest('.mobile-icon') || e.target.closest('.mob-swipe-content') === null) return;
    didLongPress = false;
    longPressTimer = setTimeout(() => {
      didLongPress = true;
      if (navigator.vibrate) navigator.vibrate([12, 30, 12]);
      row.classList.add('mobile-long-press-lift');
      // Hand off to drag behavior using the row itself as trigger
      // Synthesize a touchstart on the drag system
      const rows = Array.from(container.querySelectorAll('.swatch'));
      let targetIndex = srcIndex;

      const onMove = ev => {
        ev.preventDefault();
        const y = ev.touches[0].clientY;
        rows.forEach((r, idx) => {
          r.classList.remove('mobile-drag-over-above', 'mobile-drag-over-below');
          const rect = r.getBoundingClientRect();
          if (y >= rect.top && y < rect.bottom) {
            targetIndex = idx;
            r.classList.add(y < rect.top + rect.height / 2 ? 'mobile-drag-over-above' : 'mobile-drag-over-below');
          }
        });
      };
      const onEnd = ev => {
        ev.preventDefault();
        _isDragging = false;
        row.classList.remove('mobile-long-press-lift', 'mobile-dragging');
        rows.forEach(r => r.classList.remove('mobile-drag-over-above', 'mobile-drag-over-below'));
        document.removeEventListener('touchmove', onMove, { passive: false });
        document.removeEventListener('touchend', onEnd, { passive: false });
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
      };
      row.classList.add('mobile-dragging');
      _isDragging = true;
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onEnd, { passive: false });
    }, 420);
  }, { passive: true });

  row.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
    if (didLongPress) row.classList.remove('mobile-long-press-lift');
    didLongPress = false;
  }, { passive: true });

  row.addEventListener('touchmove', () => {
    // Cancel long press if finger moves before timer fires
    clearTimeout(longPressTimer);
  }, { passive: true });
}