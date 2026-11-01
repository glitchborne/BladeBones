'use strict';
// Docking/resizing behavior for the pro-style workspace.
const LAYOUT_STORAGE_KEY='indie-2d-skeleton-pro-layout';
function defaultLayout(){return{leftW:300,assetW:300,rightW:356,viewFiltersW:230,timelineH:260,timelineLeftW:300,timelineRightW:356,meshWorkbenchH:420,leftCollapsed:false,rightCollapsed:false,viewFiltersCollapsed:false,timelineCollapsed:false,timelineLeftCollapsed:false,jsonCollapsed:false};}
function clampLayout(){
  const l=state.layout||(state.layout=defaultLayout());
  l.leftW=clamp(Number(l.leftW||300),180,560);
  l.assetW=clamp(Number(l.assetW||300),200,560);
  l.rightW=clamp(Number(l.rightW||356),220,640);
  l.viewFiltersW=clamp(Number(l.viewFiltersW||230),180,360);
  l.timelineH=clamp(Number(l.timelineH||260),110,Math.max(160,window.innerHeight-180));
  l.timelineLeftW=clamp(Number(l.timelineLeftW||300),200,560);
  l.timelineRightW=clamp(Number(l.timelineRightW||356),220,700);
  l.meshWorkbenchH=clamp(Number(l.meshWorkbenchH||420),180,Math.max(220,window.innerHeight-180));
  l.leftCollapsed=!!l.leftCollapsed;l.rightCollapsed=!!l.rightCollapsed;l.viewFiltersCollapsed=!!l.viewFiltersCollapsed;l.timelineCollapsed=!!l.timelineCollapsed;l.timelineLeftCollapsed=!!l.timelineLeftCollapsed;l.jsonCollapsed=!!l.jsonCollapsed;
  return l;
}
function persistLayout(){try{localStorage.setItem(LAYOUT_STORAGE_KEY,JSON.stringify(state.layout));}catch(e){}}
function restoreLayout(){
  try{const raw=localStorage.getItem(LAYOUT_STORAGE_KEY);if(raw)state.layout={...defaultLayout(),...(state.layout||{}),...JSON.parse(raw)};}
  catch(e){}
  clampLayout();
}
function applyLayout(save=false){
  const l=clampLayout();const app=$('.app');if(!app)return;
  app.style.setProperty('--left-w',(l.leftCollapsed?0:l.leftW)+'px');
  app.style.setProperty('--asset-w',l.assetW+'px');
  app.style.setProperty('--right-w',(l.rightCollapsed?0:l.rightW)+'px');
  app.style.setProperty('--viewfilters-w',(l.viewFiltersCollapsed?0:l.viewFiltersW)+'px');
  app.style.setProperty('--timeline-h',(l.timelineCollapsed?0:l.timelineH)+'px');
  app.style.setProperty('--timeline-left-w',(l.timelineLeftCollapsed?0:l.timelineLeftW)+'px');
  app.style.setProperty('--timeline-right-w',(l.jsonCollapsed?0:l.timelineRightW)+'px');
  app.style.setProperty('--mesh-workbench-h',l.meshWorkbenchH+'px');
  app.classList.toggle('left-collapsed',l.leftCollapsed);
  app.classList.toggle('right-collapsed',l.rightCollapsed);
  app.classList.toggle('viewfilters-collapsed',l.viewFiltersCollapsed);
  app.classList.toggle('timeline-collapsed',l.timelineCollapsed);
  app.classList.toggle('timeline-left-collapsed',l.timelineLeftCollapsed);
  app.classList.toggle('json-collapsed',l.jsonCollapsed);
  const buttons={toggleLeftPanel:!l.leftCollapsed,collapseLeftPanel:!l.leftCollapsed,toggleViewFiltersPanel:!l.viewFiltersCollapsed,collapseViewFiltersPanel:!l.viewFiltersCollapsed,toggleRightPanel:!l.rightCollapsed,collapseRightPanel:!l.rightCollapsed,toggleTimeline:!l.timelineCollapsed,toggleTimelineLeft:!l.timelineLeftCollapsed,collapseTimelineLeft:!l.timelineLeftCollapsed,toggleJsonPanel:!l.jsonCollapsed,collapseJsonPanel:!l.jsonCollapsed};
  for(const [id,on] of Object.entries(buttons)){const el=$('#'+id);if(el)el.classList.toggle('on',!!on);}
  sizeCanvas();renderTimeline();
  if(save)persistLayout();
}
function toggleLayoutPanel(key){state.layout[key]=!state.layout[key];applyLayout(true);}
function resetLayout(){state.layout=defaultLayout();applyLayout(true);}
function bindResizeHandle(handle){
  if(!handle)return;
  handle.addEventListener('pointerdown',e=>{
    e.preventDefault();handle.setPointerCapture(e.pointerId);document.body.classList.add('resizing');
    const kind=handle.dataset.resize,startX=e.clientX,startY=e.clientY,start={...clampLayout()};
    const move=ev=>{
      const dx=ev.clientX-startX,dy=ev.clientY-startY;
      if(kind==='outliner')state.layout.leftW=clamp(start.leftW+dx,180,560);
      if(kind==='main-left')state.layout.assetW=clamp(start.assetW+dx,200,560);
      if(kind==='main-right')state.layout.rightW=clamp(start.rightW-dx,220,640);
      if(kind==='timeline-left')state.layout.timelineLeftW=clamp(start.timelineLeftW+dx,200,560);
      if(kind==='timeline-right')state.layout.timelineRightW=clamp(start.timelineRightW-dx,220,700);
      if(kind==='timeline-height')state.layout.timelineH=clamp(start.timelineH-dy,110,Math.max(160,window.innerHeight-180));
      if(kind==='mesh-workbench-height')state.layout.meshWorkbenchH=clamp(start.meshWorkbenchH-dy,180,Math.max(220,window.innerHeight-180));
      applyLayout(false);
    };
    const up=()=>{document.body.classList.remove('resizing');persistLayout();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
  });
}
function initLayout(){
  restoreLayout();
  const ids={toggleLeftPanel:'leftCollapsed',collapseLeftPanel:'leftCollapsed',toggleViewFiltersPanel:'viewFiltersCollapsed',collapseViewFiltersPanel:'viewFiltersCollapsed',toggleRightPanel:'rightCollapsed',collapseRightPanel:'rightCollapsed',toggleTimeline:'timelineCollapsed',toggleTimelineLeft:'timelineLeftCollapsed',collapseTimelineLeft:'timelineLeftCollapsed',toggleJsonPanel:'jsonCollapsed',collapseJsonPanel:'jsonCollapsed'};
  for(const [id,key] of Object.entries(ids)){const el=$('#'+id);if(el)el.onclick=()=>toggleLayoutPanel(key);}
  const reset=$('#resetLayout');if(reset)reset.onclick=resetLayout;
  $$('.workspace-resizer,.main-resizer,.timeline-resizer,.viewport-workbench-resizer').forEach(bindResizeHandle);
  applyLayout(false);
}
