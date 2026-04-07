export const PALETTES = []; 
// empty because it never has predefined palettes, just an array that gets filled.

export const CVD_MODES = ['normal','deuteranopia','protanopia','tritanopia','achromatopsia'];
export const CVD_MATRICES = {
  normal: null,
  deuteranopia:  [[0.367,0.861,-0.228],[0.280,0.673,0.047],[0.001,0.099,0.900]],
  protanopia:    [[0.152,1.053,-0.205],[0.115,0.786,0.099],[0.004,-0.190,1.186]],
  tritanopia:    [[1.256,-0.077,-0.179],[-0.078,0.931,0.148],[0.005,0.691,0.304]],
  achromatopsia: [[0.299,0.587,0.114],[0.299,0.587,0.114],[0.299,0.587,0.114]],
};

export let current = 0;
export let selected = 0;
export let editorTab = 'hex';
export let editorIndex = 0;
export let editorHex = '';
export let locks = [];
export let cvdIndex = 0;
export let drawerOpen = false;
export let activeTab = 'edit';
export let dragSrc = null;
export let dragTargetIdx = null;

// Setters (needed because ES modules don't allow `let x` reassignment across files)
export function setCurrent(v)       { current = v; }
export function setSelected(v)      { selected = v; }
export function setEditorTab(v)     { editorTab = v; }
export function setEditorIndex(v)   { editorIndex = v; }
export function setEditorHex(v)     { editorHex = v; }
export function setLocks(v)         { locks = v; }
export function setCvdIndex(v)      { cvdIndex = v; }
export function setDrawerOpen(v)    { drawerOpen = v; }
export function setActiveTab(v)     { activeTab = v; }
export function setDragSrc(v)       { dragSrc = v; }
export function setDragTargetIdx(v) { dragTargetIdx = v; }
