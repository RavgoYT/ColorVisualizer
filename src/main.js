// main.js
import './styles.css';
import { loadFromURL } from './js/core/url-manager.js';
import { initLocks, render, randomize, toggleDrawer, activateTab, toggleTheme,
         updatePaletteName, updateSwatchName, removeColor, addColor,
         toggleLock, openEditor, openEditorAt, setEditorTabUI, applyEdit, liveHex, liveRgb, liveHsl, e_stop } from './js/ui/ui-render.js';
import { copyURL, toggleExport, doExport, exportVizCard as _exportVizCard } from './js/utils/export-utils.js';
import { closeImgModal, handleBackdropClick, handleImageFile, extractColors, switchImgMode, clearImgSelected, initPickerCanvas, setRenderCallback } from './js/features/image-extractor.js';
import { updatePageOG } from './js/social/og-integration.js';
import { initMobile, setMobileRenderCallback, isMobile } from './js/ui/mobile.js';

/* Expose to window (required for inline onclick= in HTML) */
Object.assign(window, {
  randomize, toggleDrawer, activateTab, toggleTheme,
  updatePaletteName, updateSwatchName, removeColor, addColor,
  toggleLock, openEditor, openEditorAt,
  setEditorTab: setEditorTabUI,  // HTML calls setEditorTab()
  applyEdit, liveHex, liveRgb, liveHsl, e_stop,
  exportVizCard: _exportVizCard,
  copyURL, toggleExport, doExport,
  closeImgModal, handleBackdropClick, handleImageFile, extractColors, switchImgMode, clearImgSelected,
});

/* global event listeners */
document.addEventListener('keydown', e => {
  if(e.code==='Space' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){
    e.preventDefault(); randomize();
  }
});

document.addEventListener('click', e => {
  if(!e.target.closest('#editor-popup') && !e.target.closest('.swatch-icon:not(.delete-icon)'))
    document.getElementById('editor-popup').classList.remove('open');
  if(!e.target.closest('#export-popup') && !e.target.closest('[onclick="toggleExport()"]'))
    document.getElementById('export-popup').classList.remove('open');
});

document.addEventListener('paste', function(e) {
  if(!document.getElementById('img-modal').classList.contains('open')) return;
  const items=e.clipboardData?.items; if(!items) return;
  for(const item of items){
    if(item.type.startsWith('image/')){ handleImageFile(item.getAsFile()); break; }
  }
});

const dropZone=document.getElementById('img-drop');
if(dropZone){
  dropZone.addEventListener('dragover', e=>{ e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', ()=>dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e=>{ e.preventDefault(); dropZone.classList.remove('dragover'); handleImageFile(e.dataTransfer.files[0]); });
}

/* boot */
// Wrap render to also update OG tags
const renderWithOG = async () => {
  render();
  const currentPath = window.location.pathname + window.location.hash;
  const slug = currentPath.replace(/^\/+/, '').replace(/^#\/?/, '');
  await updatePageOG(slug);
};

setRenderCallback(renderWithOG);
setMobileRenderCallback(renderWithOG);
loadFromURL();
initLocks();
initPickerCanvas();
initMobile();          // inject action bar + bottom sheet DOM
renderWithOG();

/* ── Show page once CSS is loaded, not before */
document.body.classList.add('ready');