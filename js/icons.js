'use strict';
// Local SVG icon integration. Uses the ./icons folder through CSS masks so
// icons inherit currentColor and work offline without an icon font.

const UI_ICON_PATH='icons/';
const UI_ICON_TOKEN_MAP={
  R:'binary-tree-2',O:'stack-2',B:'bone',C:'camera',S:'picture-in-picture-top',M:'flag-3',D:'chart-grid-dots',E:'timeline-event','Σ':'chart-dots-2','•':'circle',K:'key'
};
const UI_ICON_BY_ID={
  newProjectBtn:'plus',saveProjectFolder:'device-floppy',loadProjectFolder:'folder-open',
  modeRig:'bone',modeAnimate:'timeline-event',toolSelect:'pointer',toolBone:'bone',toolPan:'arrow-move-left',toolMove:'arrow-move-left',toolRotate:'fidget-spinner',toolScale:'square',
  clear:'trash-x',undo:'bounce-left',redo:'circle-arrow-right',
  toggleLeftPanel:'layout-sidebar',toggleRightPanel:'layout-sidebar-right',toggleTimelineLeft:'adjustments-horizontal',toggleJsonPanel:'file-text',toggleTimeline:'timeline-event',resetLayout:'layout-grid',
  collapseLeftPanel:'layout-sidebar-right-collapse',collapseRightPanel:'layout-sidebar-right-expand',collapseTimelineLeft:'layout-sidebar-right-collapse',collapseJsonPanel:'layout-sidebar-right-expand',
  outlinerTabScene:'binary-tree-2',outlinerTabRig:'bone',outlinerTabDraw:'stack-2',
  addObject:'plus',deleteObject:'trash',attachObjectToSlot:'link',detachObjectFromSlot:'copy-x',objectAttachSelect:'stack-2',
  addSlot:'square-rounded-plus',slotUp:'arrow-up-square',slotDown:'arrow-down-square',
  addClip:'plus',duplicateClip:'copy',deleteClip:'trash-x',timelineExpandAll:'chevron-down',timelineCollapseAll:'chevron-right',
  keySel:'key',keyAll:'keyframes',delKey:'trash-x',clearKeySelection:'circle-x',copyKey:'copy',pasteKey:'copy-plus',nudgeKeysLeft:'arrow-left-square',nudgeKeysRight:'arrow-big-right',selectVisibleRange:'capture',scaleKeysFirst:'chart-dots',scaleKeysCenter:'chart-dots-2',reverseKeys:'fidget-spinner',applyCurve:'ease-out-control-point',addEvent:'timeline-event',
  addRectAtt:'square-rounded-plus',addPngBtn:'file-upload',addSocket:'link',addHitbox:'square',delMarker:'trash-x',
  center:'current-location',savePose:'device-floppy',applyPose:'circle-check',copyPose:'copy',pastePose:'copy-plus',pasteMirrorPose:'contrast-2',mirrorPose:'contrast-2',validateProjectBtnRight:'rosette-discount-check',validateProjectBtn:'rosette-discount-check',fixOrphansBtn:'bug',
  goStart:'player-track-prev',prevKey:'keyframe-align-horizontal',prevFrame:'player-skip-back',play:'player-play',stop:'player-stop',nextFrame:'player-skip-forward',nextKey:'keyframe-align-horizontal',goEnd:'player-track-next',setRangeIn:'arrow-down-rhombus',setRangeOut:'arrow-up-rhombus',
  export:'file-description',import:'file-upload',save:'device-floppy',load:'folder-open',recover:'lifebuoy',
  createGameDoc:'app-window',createToonDoc:'video',closeNewProjectModal:'x',
  camKey:'key',camFrame:'capture',renderPngBtn:'file-download',toonAddLayer:'plus',
  multiApplyShape:'square',multiApplyColor:'palette',multiApplyWidth:'adjustments-horizontal',multiRoleDeform:'bone',multiRoleControl:'manual-gearbox',multiRoleSocket:'link',multiLockMove:'lock',multiLockRot:'lock',multiLockScale:'lock',multiKey:'keyframes',multiReset:'fidget-spinner',multiClear:'circle-x',multiDelete:'trash-x',
  sKey:'key',sDelKey:'trash-x',mDel:'trash-x',ffdKey:'key',ffdReset:'fidget-spinner',ffdDeleteKey:'trash-x',ffdSelectAll:'square-check',ffdClearSel:'circle-x',meshReset:'fidget-spinner',meshAutoWeights:'automatic-gearbox',meshClearWeights:'circle-x'
};
const UI_ICON_BY_TEXT=new Map(Object.entries({
  'New':'plus','Duplicate':'copy','Delete':'trash-x','Add layer':'plus','Render PNG':'file-download','Rendering…':'fidget-spinner',
  'Key camera':'key','Frame camera':'capture','Key selected':'key','Key all bones':'keyframes','Delete selected':'trash-x',
  'Copy keys':'copy','Paste keys':'copy-plus','Expand all':'chevron-down','Collapse all':'chevron-right',
  'Place rect':'square-rounded-plus','Place PNG':'file-upload','Socket':'link','Hitbox':'square','Validate':'rosette-discount-check',
  'Refresh JSON':'file-description','Import JSON':'file-upload','Save local':'device-floppy','Load local':'folder-open','Recover autosave':'lifebuoy',
  'Close':'x','Apply curve to selected key(s)':'ease-out-control-point','Add event @ time':'timeline-event',
  'Fit to Canvas':'capture','Reset pose':'fidget-spinner','Frame':'capture','Key FK chain':'keyframes','Add Attachment':'file-upload'
}));
const UI_ICON_ONLY_IDS=new Set(['collapseLeftPanel','collapseRightPanel','collapseTimelineLeft','collapseJsonPanel','goStart','prevKey','prevFrame','stop','nextFrame','nextKey','goEnd']);

function iconFallbackGlyph(name){
  const map={
    plus:'+',x:'×','chevron-right':'›','chevron-down':'⌄','caret-left':'‹','caret-right':'›','player-play':'▶','player-pause':'Ⅱ','player-stop':'■','player-skip-back':'◀','player-skip-forward':'▶','player-track-prev':'|◀','player-track-next':'▶|','key':'◆','keyframes':'◆','trash-x':'×','trash':'×','folder-open':'▣','device-floppy':'▣','file-download':'↓','file-upload':'↑','camera':'◉','bone':'B','pointer':'↖','arrow-move-left':'✥','fidget-spinner':'↻','square':'□','layout-grid':'▦','eye':'◉','lock':'▣','link':'⌁','timeline-event':'◆','stack-2':'▤','binary-tree-2':'┬','chart-grid-dots':'▦','flag-3':'⚑','settings':'⚙'
  };
  return map[name]||'•';
}
function svgForIcon(name){
  const safe=String(name||'').replace(/[^a-z0-9_\-]/gi,'');
  return (window.UI_ICON_SVGS&&window.UI_ICON_SVGS[safe])||'';
}
function normalizeInlineSvg(svgText){
  const tpl=document.createElement('template');tpl.innerHTML=svgText.trim();
  const svg=tpl.content.querySelector('svg');if(!svg)return null;
  svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.classList.add('ui-icon-svg');
  return svg;
}
function hydrateIconSpan(span){
  if(!span||span.dataset.ready==='1')return;
  const name=span.dataset.icon;const raw=svgForIcon(name);
  if(raw){const svg=normalizeInlineSvg(raw);if(svg){span.textContent='';span.appendChild(svg);span.dataset.ready='1';return;}}
  // Last-resort fallback: never leave an icon-only control blank.
  span.textContent=iconFallbackGlyph(name);span.classList.add('ui-icon-fallback');span.dataset.ready='1';
}
function iconMarkup(name,cls=''){
  if(!name)return '';
  const safe=String(name).replace(/[^a-z0-9_\-]/gi,'');
  const raw=svgForIcon(safe);
  if(raw)return `<span class="ui-icon ${cls}" data-icon="${safe}" aria-hidden="true">${raw}</span>`;
  return `<span class="ui-icon ${cls} ui-icon-fallback" data-icon="${safe}" aria-hidden="true">${iconFallbackGlyph(safe)}</span>`;
}
function iconElement(name,cls=''){
  const safe=String(name).replace(/[^a-z0-9_\-]/gi,'');
  const span=document.createElement('span');span.className='ui-icon '+cls;span.dataset.icon=safe;span.setAttribute('aria-hidden','true');
  hydrateIconSpan(span);return span;
}
function textWithoutIcon(el){
  const c=el.cloneNode(true);c.querySelectorAll?.('.ui-icon').forEach(x=>x.remove());return String(c.textContent||'').replace(/\s+/g,' ').trim();
}
function iconNameFromToken(token,kind=''){
  const t=String(token||'').trim();
  if(UI_ICON_TOKEN_MAP[t])return UI_ICON_TOKEN_MAP[t];
  if(kind==='camera')return 'camera';
  if(kind==='bone')return 'bone';
  if(kind==='slot')return 'picture-in-picture-top';
  if(kind==='deform')return 'chart-grid-dots';
  if(kind==='event')return 'timeline-event';
  if(kind==='object')return 'stack-2';
  if(kind==='marker')return 'flag-3';
  return null;
}
function iconForToken(token,kind='',cls=''){
  const name=iconNameFromToken(token,kind);return name?iconMarkup(name,cls):(typeof htm==='function'?htm(token):String(token||''));
}
function iconNameForButton(btn){
  if(!btn)return null;
  if(btn.id==='play')return String(btn.textContent||'').trim().toLowerCase()==='pause'?'player-pause':'player-play';
  if(UI_ICON_BY_ID[btn.id])return UI_ICON_BY_ID[btn.id];
  const t=textWithoutIcon(btn);
  if(UI_ICON_BY_TEXT.has(t))return UI_ICON_BY_TEXT.get(t);
  if(/^\+\s*/.test(t))return 'plus';
  if(/delete|remove/i.test(t))return 'trash-x';
  if(/save/i.test(t))return 'device-floppy';
  if(/load|open/i.test(t))return 'folder-open';
  if(/key/i.test(t))return 'key';
  if(/render/i.test(t))return 'file-download';
  return null;
}
function applyButtonIcon(btn){
  const name=iconNameForButton(btn);if(!name)return;
  const iconOnly=UI_ICON_ONLY_IDS.has(btn.id);
  const label=textWithoutIcon(btn)||btn.title||btn.getAttribute('aria-label')||btn.id;
  btn.querySelectorAll(':scope > .ui-icon').forEach(x=>x.remove());
  if(iconOnly){btn.textContent='';btn.classList.add('icon-only');btn.setAttribute('aria-label',label);if(!btn.title)btn.title=label;}
  else btn.classList.add('has-ui-icon');
  btn.insertBefore(iconElement(name),btn.firstChild);
}
function applyPanelHeaderIcons(root=document){
  const map={
    'Scene Hierarchy':'binary-tree-2','Timeline Tools':'adjustments-horizontal','Assets / Markers':'folders','Inspector / Controls':'adjustments','Data / Export':'file-description',
    'Scene':'binary-tree-2','Selected Object Rig':'bone','Draw Order':'stack-2','Artwork staging':'file-upload','Markers':'flag-3','View':'eye','Pose library':'library','Project Health':'rosette-discount-check','Project JSON':'file-text','Clips':'files','Animation':'timeline-event','Keying':'key','Dope Sheet':'timeline-event','Render Layers':'stack-3','PNG Render':'file-download'
  };
  root.querySelectorAll('.panel-dock-header > span, .box > h3, .mesh-subpanel-title').forEach(el=>{
    if(el.querySelector('.ui-icon'))return;
    const t=String(el.textContent||'').trim();const name=map[t];if(!name)return;
    el.classList.add('has-heading-icon');el.insertBefore(iconElement(name,'heading-icon'),el.firstChild);
  });
}
function iconifyUI(root=document){
  try{
    root.querySelectorAll?.('button').forEach(applyButtonIcon);
    applyPanelHeaderIcons(root);
    root.querySelectorAll?.('.ui-icon[data-icon]').forEach(hydrateIconSpan);
  }catch(err){console.warn('iconifyUI failed',err);}
}
let iconifyPending=false,iconifyBusy=false;
function scheduleIconify(){
  if(iconifyPending||iconifyBusy)return;iconifyPending=true;
  requestAnimationFrame(()=>{iconifyPending=false;iconifyBusy=true;iconifyUI(document);iconifyBusy=false;});
}
if(typeof window!=='undefined'){
  window.addEventListener('DOMContentLoaded',scheduleIconify);
  window.addEventListener('load',scheduleIconify);
  if(typeof MutationObserver!=='undefined'){
    const start=()=>{if(!document.body)return requestAnimationFrame(start);new MutationObserver(()=>scheduleIconify()).observe(document.body,{childList:true,subtree:true,characterData:true});};
    start();
  }
}
