'use strict';
// Timeline 2.0: object/group dope sheet with collapsible rows.

const TIMELINE_NAME_W=180;

function curvePathForSegment(a,b,dur){
  const x1=clamp(a.t/dur*100,0,100),x2=clamp(b.t/dur*100,0,100),dx=x2-x1;
  const c=a.curve||makeDefaultCurve();
  if(c.type==='hold')return`M ${x1} 9 L ${x1} 18 L ${x2} 18`;
  if(c.type==='linear')return`M ${x1} 13 L ${x2} 13`;
  const y1=c.type==='bezier'?clamp(22-Number(c.y1??0)*18,4,22):5;
  const y2=c.type==='bezier'?clamp(22-Number(c.y2??1)*18,4,22):21;
  const cx1=c.type==='bezier'?x1+dx*Number(c.x1??.33):x1+dx*.35;
  const cx2=c.type==='bezier'?x1+dx*Number(c.x2??.67):x2-dx*.35;
  return`M ${x1} 13 C ${cx1} ${y1} ${cx2} ${y2} ${x2} 13`;
}
function appendRangeOverlay(lane,dur){if(!state.timeline.useRange)return;const r=playbackRange();const el=document.createElement('div');el.className='range-window';el.style.left=(r.start/dur*100)+'%';el.style.width=((r.end-r.start)/dur*100)+'%';lane.appendChild(el);}
function appendCurveLayer(lane,keys,dur){if(!keys||keys.length<2)return;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','curve-layer');svg.setAttribute('viewBox','0 0 100 26');svg.setAttribute('preserveAspectRatio','none');for(let i=0;i<keys.length-1;i++){const a=normalizeKeyCurve(keys[i]),b=normalizeKeyCurve(keys[i+1]);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class','curve-line '+(a.curve?.type||'smooth'));path.setAttribute('d',curvePathForSegment(a,b,dur));svg.appendChild(path);}lane.appendChild(svg);}
function formatTimeLabel(t){const fps=Math.max(1,Number(state.anim.fps||24));if(state.timeline.display==='frames')return String(Math.round(t*fps));return t.toFixed(2)+'s';}
function renderRuler(root,dur){root.innerHTML='<div class="ruler" id="ruler"></div>';const ruler=$('#ruler');if(state.timeline.display==='frames'){const fps=Math.max(1,Number(state.anim.fps||24));const frames=Math.max(1,Math.ceil(dur*fps));const step=Math.max(1,Math.round(niceStep(frames/8)));for(let f=0;f<=frames;f+=step){const s=document.createElement('span');s.className='tick';s.style.left=(f/frames*100)+'%';s.textContent=f;ruler.appendChild(s);}}else{const step=niceStep(dur/6);for(let t=0;t<=dur+.0001;t+=step){const s=document.createElement('span');s.className='tick';s.style.left=(t/dur*100)+'%';s.textContent=t.toFixed(step<1?1:0);ruler.appendChild(s);}}}

function timelineCollapsed(){if(!state.timeline.collapsed)state.timeline.collapsed={};return state.timeline.collapsed;}
function isTimelineCollapsed(id){return !!timelineCollapsed()[id];}
function setTimelineCollapsed(id,value){const m=timelineCollapsed();if(value)m[id]=true;else delete m[id];}
function toggleTimelineCollapse(id){setTimelineCollapsed(id,!isTimelineCollapsed(id));renderTimeline();}
function collapseAllTimeline(){const m=timelineCollapsed();m['camera:group']=true;for(const o of state.objects||[]){m['obj:'+o.id]=true;m['grp:'+o.id+':bones']=true;m['grp:'+o.id+':slots']=true;m['grp:'+o.id+':deform']=true;}renderTimeline();}
function expandAllTimeline(){state.timeline.collapsed={};renderTimeline();}

function objectOfTimelineItem(kind,id){
  if(kind==='bone')return objectOfBoneId(id);
  if(kind==='slot'||kind==='deform')return objectOfSlotId(id);
  return null;
}
function selectedTimelineObjectId(){
  if(state.selected?.type==='bone')return objectOfBoneId(state.selected.id)||state.activeObjectId;
  if(state.selected?.type==='slot')return objectOfSlotId(state.selected.id)||state.activeObjectId;
  return state.activeObjectId||null;
}
function timelineObjectVisible(kind,id,keys){
  if(kind==='bone'&&isProjectRootBone(bone(id)))return false;
  if(state.timeline.selectedOnly){
    const oid=selectedTimelineObjectId();
    if(oid&&objectOfTimelineItem(kind,id)!==oid)return false;
  }
  if(state.timeline.animatedOnly&&!(keys&&keys.length))return false;
  return true;
}
function filteredKeyTimes(){
  const set=new Set();
  if(state.documentType==='toon'&&state.timeline.channels?.camera!==false)for(const a of Object.values(state.anim.cameraTracks||{}))a.forEach(k=>set.add(k.t));
  if(state.timeline.channels?.bones!==false)for(const [id,a] of Object.entries(state.anim.boneTracks||{})){if(timelineObjectVisible('bone',id,a))a.forEach(k=>set.add(k.t));}
  if(state.timeline.channels?.slots!==false)for(const [id,a] of Object.entries(state.anim.slotTracks||{})){if(timelineObjectVisible('slot',id,a))a.forEach(k=>set.add(k.t));}
  if(state.timeline.channels?.deform!==false)for(const [id,a] of Object.entries(state.anim.deformTracks||{})){if(timelineObjectVisible('deform',id,a))a.forEach(k=>set.add(k.t));}
  if(state.timeline.channels?.events!==false)(state.anim.events||[]).forEach(e=>set.add(e.t));
  return[...set].sort((a,b)=>a-b);
}
function uniqKeyTimesFromTrackItems(items){
  const set=new Set();
  for(const item of items||[]){for(const k of item.keys||[])set.add(k.t);}
  return[...set].sort((a,b)=>a-b);
}
function groupHasKeys(items){return (items||[]).some(x=>(x.keys||[]).length);}
function timelineTimeFromLaneEvent(e,lane,dur){const r=lane.getBoundingClientRect();return clamp((e.clientX-r.left)/Math.max(1,r.width)*dur,0,dur);}
function timelineVisibleKeyElements(){return $$('.key[data-kind]',$('#tracks'));
}
function selectedKeyBounds(){const refs=selectedKeyRefs();if(!refs.length)return null;const times=refs.map(r=>r.key.t);return{count:refs.length,start:Math.min(...times),end:Math.max(...times)};}
function updateTimelineSelectionOverlay(){const el=$('#timelineSelectionOverlay');if(!el||!state.timelineDrag||state.timelineDrag.type!=='boxSelect')return;const r=state.timelineDrag.rootRect;const x=Math.min(state.timelineDrag.startX,state.timelineDrag.currentX)-r.left;const y=Math.min(state.timelineDrag.startY,state.timelineDrag.currentY)-r.top;const w=Math.abs(state.timelineDrag.currentX-state.timelineDrag.startX);const h=Math.abs(state.timelineDrag.currentY-state.timelineDrag.startY);el.style.left=x+'px';el.style.top=y+'px';el.style.width=w+'px';el.style.height=h+'px';}
function beginBoxSelect(e,dur){
  const root=$('#tracks');state.timelineDrag={type:'boxSelect',startX:e.clientX,startY:e.clientY,currentX:e.clientX,currentY:e.clientY,rootRect:root.getBoundingClientRect(),append:e.shiftKey||e.ctrlKey||e.metaKey,dur};
  const overlay=document.createElement('div');overlay.id='timelineSelectionOverlay';overlay.className='timeline-selection-box';root.appendChild(overlay);updateTimelineSelectionOverlay();
  window.addEventListener('pointermove',timelinePointerMove);
  window.addEventListener('pointerup',timelinePointerUp,{once:true});
}
function beginKeyMove(e,kind,id,k,dur){
  const already=keySelectionHas(kind,id,k.t);
  if(e.shiftKey||e.ctrlKey||e.metaKey)setKeySelection(keyRef(kind,id,k.t),true);else if(!already)selectSingleKey(kind,id,k.t);
  if(kind==='deform'){state.selected={type:'slot',id};state.selectedBones=[];state.inspectorTab='deform';state.meshEdit.tool='deform';}else{state.selected={type:kind,id};state.selectedBones=kind==='bone'?[id]:[];}setTime(k.t,true);
  const refs=selectedKeyRefs();state.timelineDrag={type:'moveKeys',startX:e.clientX,lastDx:0,dur,refs:refs.map(r=>({kind:r.kind,id:r.id,key:r.key,startT:r.key.t}))};
  pushUndo();
  window.addEventListener('pointermove',timelinePointerMove);
  window.addEventListener('pointerup',timelinePointerUp,{once:true});
  renderTimeline();
}
function timelinePointerMove(e){
  const d=state.timelineDrag;if(!d)return;
  if(d.type==='boxSelect'){d.currentX=e.clientX;d.currentY=e.clientY;updateTimelineSelectionOverlay();return;}
  if(d.type==='moveKeys'){
    const root=$('#tracks');const lane=root.querySelector('.lane');const w=lane?.getBoundingClientRect().width||300;const dt=(e.clientX-d.startX)/Math.max(1,w)*d.dur;const newRefs=[];
    for(const ref of d.refs){ref.key.t=quantizeTimelineTime(ref.startT+dt,true);newRefs.push(keyRef(ref.kind,ref.id,ref.key.t));}
    sortAllAnimationKeys();state.selectedKeys=newRefs;cleanSelectedKeys();syncTime();renderTimeline();
  }
}
function timelinePointerUp(e){
  const d=state.timelineDrag;if(!d)return;
  if(d.type==='boxSelect'){
    d.currentX=e.clientX;d.currentY=e.clientY;const rect={left:Math.min(d.startX,d.currentX),right:Math.max(d.startX,d.currentX),top:Math.min(d.startY,d.currentY),bottom:Math.max(d.startY,d.currentY)};const picked=[];
    for(const el of timelineVisibleKeyElements()){const r=el.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;if(cx>=rect.left&&cx<=rect.right&&cy>=rect.top&&cy<=rect.bottom)picked.push(keyRef(el.dataset.kind,el.dataset.id,Number(el.dataset.time)));}
    if(d.append)setKeySelection(picked,true);else{state.selectedKeys=picked;cleanSelectedKeys();}
    $('#timelineSelectionOverlay')?.remove();renderTimeline();renderKeyInfo();
  }else if(d.type==='moveKeys'){
    mergeDuplicateKeysForSelection();changed();renderTimeline();renderKeyInfo();
  }
  state.timelineDrag=null;
  window.removeEventListener('pointermove',timelinePointerMove);
}
function handleLanePointerDown(e,lane,dur){
  if(e.button!==0)return;
  if(e.target!==lane&&e.target.className!=='range-window')return;
  const startX=e.clientX,startY=e.clientY;
  let moved=false;
  const move=ev=>{if(Math.abs(ev.clientX-startX)>4||Math.abs(ev.clientY-startY)>4){moved=true;window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);beginBoxSelect(e,dur);timelinePointerMove(ev);}};
  const up=ev=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);if(!moved){const t=timelineTimeFromLaneEvent(ev,lane,dur);setTime(t,true);if(!ev.shiftKey&&!ev.ctrlKey&&!ev.metaKey){state.selectedKeys=[];state.keySelection={kind:null,id:null,time:null};renderTimeline();}}};
  window.addEventListener('pointermove',move);
  window.addEventListener('pointerup',up,{once:true});
}
function selectTimelineKey(kind,id,k,e=null){
  if(kind==='deform'){state.selected={type:'slot',id};state.selectedBones=[];state.inspectorTab='deform';state.meshEdit.tool='deform';}else{state.selected={type:kind,id};state.selectedBones=kind==='bone'?[id]:[];}
  if(e&&(e.shiftKey||e.ctrlKey||e.metaKey))setKeySelection(keyRef(kind,id,k.t),true);else selectSingleKey(kind,id,k.t);
  setTime(k.t,true);renderInspector();renderTimeline();
}
function makeKeyButton(kind,id,name,k,dur){
  const dot=document.createElement('button');
  const sel=keySelectionHas(kind,id,k.t);
  dot.className='key '+(kind==='slot'?'slot ':(kind==='deform'?'deform ':(kind==='camera'?'camera ':'')))+(Math.abs(k.t-state.currentTime)<.012?'now ':'')+(sel?'sel':'');
  dot.style.left=(k.t/dur*100)+'%';dot.title=name+' @ '+formatTimeLabel(k.t)+' · '+((k.curve&&k.curve.type)||'smooth');
  dot.dataset.kind=kind;dot.dataset.id=id;dot.dataset.time=String(k.t);
  dot.onpointerdown=e=>{e.preventDefault();e.stopPropagation();beginKeyMove(e,kind,id,k,dur);};
  dot.onclick=e=>{e.preventDefault();e.stopPropagation();};
  return dot;
}

function makeGroupKeyButton(t,dur,title){
  const dot=document.createElement('button');dot.className='key summary '+(Math.abs(t-state.currentTime)<.012?'now':'');dot.style.left=(t/dur*100)+'%';dot.title=title+' @ '+formatTimeLabel(t);dot.onclick=e=>{e.stopPropagation();state.keySelection={kind:'summary',id:null,time:t};setTime(t,true);};return dot;
}
function appendGroupKeys(lane,times,dur,title){for(const t of times||[])lane.appendChild(makeGroupKeyButton(t,dur,title));}
function addTrackRow(root,dur,{kind,id,name,keys=[],depthPx=0,icon='',extraClass='',onClick=null}){
  keys=keys||[];keys.forEach(normalizeKeyCurve);
  const row=document.createElement('div');row.className='track '+extraClass;
  const n=document.createElement('div');
  const active=((kind==='deform'?state.selected.type==='slot':state.selected.type===kind)&&state.selected.id===id);
  n.className='track-name'+(active?' on':'');n.style.paddingLeft=depthPx+'px';
  const ic=icon||(kind==='bone'?'B':(kind==='deform'?'D':(kind==='camera'?'C':'S')));n.innerHTML='<span class="timeline-icon">'+(typeof iconForToken==='function'?iconForToken(ic,kind,'timeline-svg'):htm(ic))+'</span><span class="timeline-label">'+htm(name)+'</span>';
  n.onclick=()=>{if(onClick)onClick();else if(kind==='deform'){select('slot',id);state.inspectorTab='deform';state.meshEdit.tool='deform';state.meshEdit.enabled=true;}else select(kind,id);};
  const lane=document.createElement('div');lane.className='lane';lane.onpointerdown=e=>handleLanePointerDown(e,lane,dur);appendRangeOverlay(lane,dur);appendCurveLayer(lane,keys,dur);for(const k of keys)lane.appendChild(makeKeyButton(kind,id,name,k,dur));row.appendChild(n);row.appendChild(lane);root.appendChild(row);return row;
}
function addGroupRow(root,dur,{collapseId,name,times=[],depthPx=0,icon='▾',extraClass='',onClick=null,subtitle=''}){
  const collapsed=isTimelineCollapsed(collapseId);
  const row=document.createElement('div');row.className='track timeline-group '+extraClass+(collapsed?' collapsed':'');
  const n=document.createElement('div');n.className='track-name group-name';n.style.paddingLeft=depthPx+'px';
  const btn=document.createElement('button');btn.className='timeline-disclosure';btn.textContent=collapsed?'▸':'▾';btn.title=collapsed?'Expand':'Collapse';btn.onclick=e=>{e.stopPropagation();toggleTimelineCollapse(collapseId);};
  const ico=document.createElement('span');ico.className='timeline-icon';ico.innerHTML=typeof iconForToken==='function'?iconForToken(icon,'','timeline-svg'):htm(icon);
  const label=document.createElement('span');label.className='timeline-label';label.textContent=name;
  n.appendChild(btn);n.appendChild(ico);n.appendChild(label);
  if(subtitle){const sub=document.createElement('span');sub.className='timeline-subtitle';sub.textContent=subtitle;n.appendChild(sub);}
  n.onclick=()=>{if(onClick)onClick();else toggleTimelineCollapse(collapseId);};
  const lane=document.createElement('div');lane.className='lane group-lane';lane.onpointerdown=e=>handleLanePointerDown(e,lane,dur);appendRangeOverlay(lane,dur);appendGroupKeys(lane,times,dur,name);row.appendChild(n);row.appendChild(lane);root.appendChild(row);return row;
}
function boneChildrenOf(parentId,objectId){return state.bones.filter(b=>b.parent===parentId&&objectOfBoneId(b.id)===objectId&&!isProjectRootBone(b));}
function bonesOrderedForObject(objectId){
  const o=rigObject(objectId);if(!o)return[];const out=[];const seen=new Set();
  const walk=(pid,level=0)=>{for(const b of boneChildrenOf(pid,objectId)){if(seen.has(b.id))continue;seen.add(b.id);out.push({bone:b,level});walk(b.id,level+1);}};
  const root=bone(o.root);if(root&&!isProjectRootBone(root)){out.push({bone:root,level:0});seen.add(root.id);walk(root.id,1);}else walk(null,0);
  for(const b of bonesForObject(objectId)){if(!seen.has(b.id)&&!isProjectRootBone(b)){seen.add(b.id);out.push({bone:b,level:0});}}
  return out;
}
function childObjectsForTimelineObject(objectId){
  const owned=new Set(slotsForObject(objectId).map(s=>s.id));
  return state.objects.filter(o=>o.parentSlot&&owned.has(o.parentSlot));
}
function topTimelineObjects(){return state.objects.filter(o=>!o.parentSlot||!slot(o.parentSlot));}
function slotDrawOrderForObject(objectId){return slotsForObject(objectId);}
function trackItemsForObject(objectId,kind){
  if(kind==='bone')return bonesOrderedForObject(objectId).map(x=>({kind:'bone',id:x.bone.id,name:x.bone.name,level:x.level,keys:state.anim.boneTracks?.[x.bone.id]||[]})).filter(x=>timelineObjectVisible('bone',x.id,x.keys));
  if(kind==='slot')return slotDrawOrderForObject(objectId).map(s=>({kind:'slot',id:s.id,name:s.name,level:0,keys:state.anim.slotTracks?.[s.id]||[]})).filter(x=>timelineObjectVisible('slot',x.id,x.keys));
  if(kind==='deform')return slotDrawOrderForObject(objectId).map(s=>({kind:'deform',id:s.id,name:'Deform · '+s.name,level:0,keys:state.anim.deformTracks?.[s.id]||[]})).filter(x=>timelineObjectVisible('deform',x.id,x.keys));
  return[];
}
function visibleItemsForObject(objectId){
  return [
    ...(state.timeline.channels?.bones!==false?trackItemsForObject(objectId,'bone'):[]),
    ...(state.timeline.channels?.slots!==false?trackItemsForObject(objectId,'slot'):[]),
    ...(state.timeline.channels?.deform!==false?trackItemsForObject(objectId,'deform'):[])
  ];
}
function timelineGroupItems(kind,objectId){return state.timeline.channels?.[kind+'s']===false?[]:trackItemsForObject(objectId,kind);}
function shouldShowGroup(items){return state.timeline.showEmptyGroups!==false||items.length>0||!state.timeline.animatedOnly;}
function renderObjectTimeline(root,dur,o,indent=0){
  if(state.timeline.selectedOnly){const oid=selectedTimelineObjectId();if(oid&&o.id!==oid)return;}
  const allItems=visibleItemsForObject(o.id);
  const objectTimes=uniqKeyTimesFromTrackItems(allItems);
  if(state.timeline.animatedOnly&&!objectTimes.length)return;
  addGroupRow(root,dur,{collapseId:'obj:'+o.id,name:o.name||o.id,times:objectTimes,depthPx:indent,icon:'O',extraClass:o.id===state.activeObjectId?'object active-object':'object',subtitle:objectTimes.length?`${objectTimes.length} key time(s)`:'' ,onClick:()=>{setActiveObject(o.id);if(o.root)select('bone',o.root);renderTimeline();}});
  if(isTimelineCollapsed('obj:'+o.id))return;

  const groupDefs=[
    {key:'bone',channel:'bones',label:'Bones',icon:'B'},
    {key:'slot',channel:'slots',label:'Slots',icon:'S'},
    {key:'deform',channel:'deform',label:'FFD Deform',icon:'D'}
  ];
  for(const gd of groupDefs){
    if(state.timeline.channels?.[gd.channel]===false)continue;
    const items=trackItemsForObject(o.id,gd.key);
    if(state.timeline.animatedOnly&&!groupHasKeys(items))continue;
    if(!shouldShowGroup(items))continue;
    const gid='grp:'+o.id+':'+gd.channel;
    const times=uniqKeyTimesFromTrackItems(items);
    addGroupRow(root,dur,{collapseId:gid,name:gd.label,times,depthPx:indent+14,icon:gd.icon,extraClass:'subgroup '+gd.channel,subtitle:items.length?`${items.length} track(s)`:''});
    if(isTimelineCollapsed(gid))continue;
    for(const item of items){
      if(state.timeline.animatedOnly&&!(item.keys&&item.keys.length))continue;
      const depthPx=indent+32+Math.min((item.level||0)*12,72);
      addTrackRow(root,dur,{kind:item.kind,id:item.id,name:item.name,keys:item.keys,depthPx,icon:item.kind==='bone'?'B':(item.kind==='slot'?'S':'D')});
    }
  }
  for(const child of childObjectsForTimelineObject(o.id))renderObjectTimeline(root,dur,child,indent+18);
}

function renderCameraTimeline(root,dur){
  if(state.documentType!=='toon'||state.timeline.channels?.camera===false)return;
  const cam=(typeof activeToonCamera==='function')?activeToonCamera():null;if(!cam)return;
  const keys=state.anim.cameraTracks?.[cam.id]||[];
  if(state.timeline.animatedOnly&&!keys.length)return;
  addGroupRow(root,dur,{collapseId:'camera:group',name:'Camera',times:keys.map(k=>k.t),depthPx:0,icon:'C',extraClass:'camera-group',subtitle:keys.length?`${keys.length} key(s)`:'' ,onClick:()=>{state.selected={type:'camera',id:cam.id};state.selectedBones=[];renderInspector?.();renderTimeline();}});
  if(isTimelineCollapsed('camera:group'))return;
  addTrackRow(root,dur,{kind:'camera',id:cam.id,name:cam.name||'Main Camera',keys,depthPx:20,icon:'C',onClick:()=>{state.selected={type:'camera',id:cam.id};state.selectedBones=[];renderInspector?.();}});
}

function renderEventsTrack(root,dur){
  if(state.timeline.channels?.events===false||!state.anim.events.length)return;
  const row=document.createElement('div');row.className='track events-track';row.innerHTML='<div class="track-name"><span class="timeline-icon">'+(typeof iconForToken==='function'?iconForToken('E','event','timeline-svg'):'E')+'</span><span class="timeline-label">Events</span></div><div class="lane"></div>';
  const lane=$('.lane',row);lane.onpointerdown=e=>handleLanePointerDown(e,lane,dur);appendRangeOverlay(lane,dur);for(const ev of state.anim.events){const dot=document.createElement('button');dot.className='key event'+(Math.abs(ev.t-state.currentTime)<.012?' now':'');dot.style.left=(ev.t/dur*100)+'%';dot.title=(ev.name||'event')+' @ '+formatTimeLabel(ev.t);dot.onclick=()=>setTime(ev.t,true);lane.appendChild(dot);}root.appendChild(row);
}
function renderTimeline(){
  const root=$('#tracks');if(!root)return;const dur=Math.max(.001,state.anim.duration),laneW=Math.max(300,root.clientWidth-(TIMELINE_NAME_W+10));cleanSelectedKeys();renderRuler(root,dur);
  const ph=document.createElement('div');ph.className='playhead';ph.style.left=((TIMELINE_NAME_W+8)+(state.currentTime/dur)*laneW)+'px';root.appendChild(ph);
  const summaryTimes=filteredKeyTimes();
  if(summaryTimes.length){
    const row=document.createElement('div');row.className='track summary-track';row.innerHTML='<div class="track-name"><span class="timeline-icon">'+(typeof iconForToken==='function'?iconForToken('Σ','summary','timeline-svg'):'Σ')+'</span><span class="timeline-label">Summary</span></div><div class="lane"></div>';const lane=$('.lane',row);lane.onpointerdown=e=>handleLanePointerDown(e,lane,dur);appendRangeOverlay(lane,dur);appendGroupKeys(lane,summaryTimes,dur,'All visible tracks');root.appendChild(row);
  }
  renderCameraTimeline(root,dur);
  const top=topTimelineObjects();
  for(const o of top)renderObjectTimeline(root,dur,o,0);
  const attached=new Set();
  for(const p of state.objects)for(const c of childObjectsForTimelineObject(p.id))attached.add(c.id);
  for(const o of state.objects){if(!top.includes(o)&&!attached.has(o.id))renderObjectTimeline(root,dur,o,0);}
  renderEventsTrack(root,dur);
  if(root.children.length<=2){const row=document.createElement('div');row.className='track timeline-empty';row.innerHTML='<div class="track-name">No visible tracks</div><div class="lane"><span class="timeline-empty-text">Turn off filters or create keys.</span></div>';root.appendChild(row);}
  renderKeyInfo();if(typeof iconifyUI==='function')iconifyUI(root);
}

function updateTimelinePlayhead(){
  const root=$('#tracks');if(!root)return;
  const ph=root.querySelector('.playhead');if(ph){const dur=Math.max(.001,state.anim.duration),laneW=Math.max(300,root.clientWidth-(TIMELINE_NAME_W+10));ph.style.left=((TIMELINE_NAME_W+8)+(state.currentTime/dur)*laneW)+'px';}
  syncTime();
}

function renderAll(){if(typeof renderSceneOutliner==='function')renderSceneOutliner();if(typeof renderObjectList==='function')renderObjectList();if(typeof renderObjectRigTree==='function')renderObjectRigTree();else renderBoneList();if(typeof renderDrawOrderList==='function')renderDrawOrderList();else renderSlotList();if(typeof renderOutlinerTabs==='function')renderOutlinerTabs();if(typeof renderDocumentPanel==='function')renderDocumentPanel();renderAttList();renderMarkerList();renderPoseList();renderEventList();if(typeof renderClipList==='function')renderClipList();renderInspector();if(typeof renderMeshWorkbench==='function')renderMeshWorkbench();renderTimeline();if(typeof renderProjectHealth==='function')renderProjectHealth();syncTime();if(typeof renderModeBadge==='function')renderModeBadge();if(typeof iconifyUI==='function')iconifyUI(document);}
function syncTime(){
  const fps=Math.max(1,Number(state.anim.fps||24));
  const range=$('#timeRange');if(range){range.max=Math.round(state.anim.duration*1000);range.value=Math.round(state.currentTime*1000);}
  const label=$('#timeLabel');if(label)label.textContent=formatTimeLabel(state.currentTime);
  const frame=$('#transportFrameLabel');if(frame)frame.textContent='F'+Math.round(state.currentTime*fps);
  const clip=$('#transportClipLabel');if(clip)clip.textContent=state.anim?.name||'clip';
  const loop=$('#transportLoop');if(loop&&document.activeElement!==loop)loop.checked=!!state.loop;
  const tr=$('#transportUseRange');if(tr&&document.activeElement!==tr)tr.checked=!!state.timeline.useRange;
  const ts=$('#transportSnap');if(ts&&document.activeElement!==ts)ts.checked=!!state.timeline.snapFrames;
  const rs=$('#rangeStart'),re=$('#rangeEnd');
  if(rs&&document.activeElement!==rs)rs.value=state.timeline.display==='frames'?Math.round(state.timeline.rangeStart*fps):Number(state.timeline.rangeStart||0).toFixed(2);
  if(re&&document.activeElement!==re)re.value=state.timeline.display==='frames'?Math.round((state.timeline.rangeEnd||state.anim.duration)*fps):Number(state.timeline.rangeEnd||state.anim.duration).toFixed(2);
}
function renderKeyInfo(){
  const el=$('#keyInfo');const multi=$('#multiKeyInfo');const bounds=selectedKeyBounds();
  if(multi){if(bounds)multi.textContent=`Selected ${bounds.count} key(s), ${formatTimeLabel(bounds.start)} → ${formatTimeLabel(bounds.end)}`;else multi.textContent='Drag on empty timeline space to box-select keys. Drag a selected diamond to move the selection.';}
  if(!el)return;const refs=selectedKeyRefs();if(refs.length>1){el.textContent=`${refs.length} keys selected`;return;}const k=currentKey(.02);if(k){const curve=(k.curve&&k.curve.type)||'smooth';el.textContent=`Key: ${(state.keySelection.kind||state.selected.type)} ${state.selected.id||''} @ ${formatTimeLabel(k.t)} · ${curve}${state.keySelection.kind==='slot'?` · α ${Number(k.alpha??1).toFixed(2)} · tint ${k.tint||'#ffffff'}`:''}`;const sel=$('#curveType');if(sel&&document.activeElement!==sel)sel.value=curve;}else el.textContent=state.keyClipboard?'No key selected · clipboard ready':'No key selected';
}
