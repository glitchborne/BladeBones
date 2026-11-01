'use strict';
// Pointer, keyboard and toolbar event wiring.
function normalizeMode(value){return value==='pose'||value==='animate'||value==='animation'?'pose':'skeleton';}
function toolAllowedInMode(tool){
  if(tool==='bone')return state.mode!=='pose';
  return ['select','pan'].includes(tool);
}
function meshContextLabel(){
  if(!state.meshEdit?.enabled||state.selected.type!=='slot'||!selectedSlot())return '';
  const labels={vertices:'Mesh Edit',weights:'Weight Edit',deform:'FFD Deform'};
  const session=state.meshEdit?.weightPaintSession;
  const sessionMode=session?.active?(session.mode||state.meshEdit?.weightTool||'paint'):null;
  const label=(state.meshEdit.tool==='weights'&&sessionMode)?(sessionMode==='adjust'?'Weight Adjust Session':'Weight Paint Session'):(labels[state.meshEdit.tool]||'Mesh Edit');
  const sel=state.meshEdit.selectedVerts?.length||0,edges=state.meshEdit.selectedEdges?.length||0,faces=state.meshEdit.selectedFaces?.length||0;
  const rawMode=state.meshEdit.selectionMode||'vertex';
  const modeLabel=rawMode==='face'?'triangle':rawMode;
  const mode=state.meshEdit.tool==='vertices'?(' · '+modeLabel+'/'+(state.meshEdit.actionTool||'select')):'';
  const pickSummary=faces?(' · '+faces+' triangles'):(edges?(' · '+edges+' edges'):(sel?' · '+sel+' verts':''));
  return ' · '+label+mode+pickSummary;
}
function currentToolLabel(){
  const mode=(rigTestPoseActive?.()?'Test Pose':(state.mode==='pose'?'Animation':'Rigging'));
  const labels={select:'Select',bone:'Create Bone',pan:'Pan'};
  const g={move:'Move',rotate:'Rotate',scale:'Scale'}[state.gizmoMode]||state.gizmoMode;
  let extra=meshContextLabel();
  if(!extra&&state.selected?.type==='bone'&&selectedBone()){const c=typeof selectedBoneCount==='function'?selectedBoneCount():1;extra=' · Bone: '+selectedBone().name+(c>1?' · '+c+' selected':'');}
  if(!extra&&state.selected?.type==='slot'&&selectedSlot())extra=' · Slot: '+selectedSlot().name;
  if(!extra&&state.selected?.type==='camera'&&typeof activeToonCamera==='function'){const cam=activeToonCamera();if(cam)extra=' · Camera: '+(cam.name||'Camera');}
  return mode+' · '+(labels[state.tool]||'Select')+' · '+g+extra+(rigTestPoseActive?.()?' · temporary deformation preview':'');
}
function updateToolStatus(){
  const text=currentToolLabel();
  const el=$('#toolStatus');if(el)el.textContent=text;
  const pick=$('#pickStatus');if(pick)pick.textContent=text;
}
function setMeshContext(kind='vertices',enabled=true){
  if(kind==='mesh')kind='vertices';
  if(kind==='weights')kind='weights';
  if(kind==='deform')kind='deform';
  if(kind!=='vertices'&&kind!=='weights'&&kind!=='deform')kind='vertices';
  if(enabled){
    if(kind==='deform'&&state.mode!=='pose')setMode('pose');
    if(kind!=='deform'&&state.mode==='pose')setMode('skeleton');
    if(state.selected.type!=='slot'&&state.lastSlotId&&slot(state.lastSlotId))select('slot',state.lastSlotId);
    state.meshEdit.enabled=state.selected.type==='slot';
    state.meshEdit.tool=kind;
    if(kind==='vertices'){
      state.meshEdit.selectionMode=state.meshEdit.selectionMode||'vertex';
      state.meshEdit.actionTool=state.meshEdit.actionTool||'select';
    }
    state.meshEdit.showWeights=kind==='weights';
    if(kind==='vertices')state.meshEdit.workbenchTab='mesh';
    else if(kind==='weights')state.meshEdit.workbenchTab='weights';
    else state.inspectorTab='deform';
    if(kind!=='deform'&&['binding','mesh','weights'].includes(state.inspectorTab))state.inspectorTab='transform';
    state.tool='select';
  }else{
    state.meshEdit.enabled=false;
    clearMeshElementSelection?.();
  }
  updateToolStatus();if(typeof renderInspector==='function')renderInspector();renderAll();
}

function weightPaintSessionActive(){
  const sess=state.meshEdit?.weightPaintSession;
  return !!(sess&&sess.active&&sess.slotId&&slot(sess.slotId));
}
function activeWeightSessionMode(){
  const sess=state.meshEdit?.weightPaintSession;
  return weightPaintSessionActive()?(sess.mode||state.meshEdit?.weightTool||'paint'):null;
}
function beginWeightSession(mode='paint'){
  const s=selectedSlot();if(!s)return false;
  const b=activeWeightBrushBone?.();if(!b)return false;
  mode=mode==='adjust'?'adjust':'paint';
  state.meshEdit.weightBoneId=b.id;
  ensureSlotMesh(s);state.meshEdit.enabled=true;state.meshEdit.tool='weights';state.meshEdit.workbenchTab='weights';
  state.meshEdit.weightTool=mode;state.meshEdit.showWeights=true;state.tool='select';state.meshEdit.weightAdjustDelta=0;
  const existing=state.meshEdit.weightPaintSession;
  if(existing?.active&&existing.slotId===s.id&&existing.mode===mode){renderAll();return true;}
  state.meshEdit.weightPaintSession={active:true,mode,slotId:s.id,snapshot:JSON.parse(JSON.stringify(s.mesh||ensureSlotMesh(s))),undoStart:state.undo.length,undoPushed:false,dirty:false};
  updateToolStatus?.();renderMeshWorkbench?.();renderAll();return true;
}
function beginWeightPaintSession(){return beginWeightSession('paint');}
function beginWeightAdjustSession(){return beginWeightSession('adjust');}
function ensureWeightPaintSessionUndo(){
  const sess=state.meshEdit?.weightPaintSession;if(!sess?.active)return false;
  if(!sess.undoPushed){pushUndo();sess.undoPushed=true;}
  sess.dirty=true;return true;
}
function applyWeightPaintSession(){
  const sess=state.meshEdit?.weightPaintSession;if(!sess?.active)return false;
  const dirty=!!sess.dirty;state.meshEdit.weightPaintSession=null;state.meshEdit.weightTool='select';
  state.meshEdit.weightBrushHits=[];state.meshEdit.weightBrushCursor=null;state.meshEdit.weightAdjustDelta=0;state.meshEdit.enabled=false;
  if(dirty)changed();updateToolStatus?.();renderMeshWorkbench?.();renderAll();return true;
}
function cancelWeightPaintSession(){
  const sess=state.meshEdit?.weightPaintSession;if(!sess?.active)return false;
  const s=slot(sess.slotId);if(s&&sess.snapshot)s.mesh=JSON.parse(JSON.stringify(sess.snapshot));
  if(Number.isInteger(sess.undoStart))state.undo=state.undo.slice(0,sess.undoStart);
  state.meshEdit.weightPaintSession=null;state.meshEdit.weightTool='select';state.meshEdit.weightBrushHits=[];state.meshEdit.weightBrushCursor=null;state.meshEdit.weightAdjustDelta=0;
  state.meshEdit.enabled=false;updateToolStatus?.();renderMeshWorkbench?.();renderAll();return true;
}

function setTool(t){
  if(!t)t='select';
  if(typeof weightPaintSessionActive==='function'&&weightPaintSessionActive()&&t!=='pan'&&t!=='select'){updateToolStatus();renderAll();return;}
  // Backward-compatible aliases from the previous overloaded toolbar. These now
  // enable contextual slot edit modes instead of becoming global viewport tools.
  if(t==='slot')t='select';
  if(t==='mesh'||t==='weights'||t==='deform'){setMeshContext(t==='mesh'?'vertices':t,true);return;}
  if(!toolAllowedInMode(t))t='select';
  if(t==='bone'){
    if(state.mode!=='skeleton')setMode('skeleton');
    state.meshEdit.enabled=false;
    clearMeshElementSelection?.();
  }
  state.tool=t;
  const ids=['Select','Bone','Pan'];
  for(const name of ids){const el=$('#tool'+name);if(el)el.classList.toggle('on',t.toLowerCase()===name.toLowerCase());}
  $('#toolMove')?.classList.toggle('on',state.gizmoMode==='move');
  $('#toolRotate')?.classList.toggle('on',state.gizmoMode==='rotate');
  $('#toolScale')?.classList.toggle('on',state.gizmoMode==='scale');
  updateToolStatus();if(typeof renderInspector==='function')renderInspector();
}
function setGizmoMode(mode){
  state.gizmoMode=mode;
  if(state.tool==='bone')state.tool='select';
  setTool(state.tool);
  renderAll();
}
function pointer(e){const r=canvas.getBoundingClientRect();return s2w(e.clientX-r.left,e.clientY-r.top);}
function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
function setMeshHoverFromScreen(x,y){
  if(!meshEditorActive?.())return false;
  const prev=JSON.stringify({v:state.meshEdit.hoveredVert,e:state.meshEdit.hoveredEdge?.key,f:state.meshEdit.hoveredFace?.index});
  state.meshEdit.hoveredVert=null;state.meshEdit.hoveredEdge=null;state.meshEdit.hoveredFace=null;
  if(state.meshEdit.tool==='vertices'){
    const mode=meshSelectionMode();
    if(mode==='vertex'){const h=hitTestMeshVertexScreen(x,y);if(h)state.meshEdit.hoveredVert=h.index;}
    else if(mode==='edge')state.meshEdit.hoveredEdge=hitTestMeshEdgeScreen(x,y);
    else if(mode==='face')state.meshEdit.hoveredFace=hitTestMeshFaceScreen(x,y);
    if(meshActionTool()==='knife'){state.meshEdit.hoveredEdge=hitTestMeshEdgeScreen(x,y);state.meshEdit.hoveredFace=state.meshEdit.hoveredEdge?null:hitTestMeshFaceScreen(x,y);}
  }else if(state.meshEdit.tool==='weights'){
    state.meshEdit.weightBrushCursor={x,y};
    const h=hitTestMeshVertexScreen(x,y);if(h)state.meshEdit.hoveredVert=h.index;
    const s=selectedSlot();
    state.meshEdit.weightBrushHits=(s&&state.meshEdit.weightTool==='paint'&&weightPaintSessionActive())?slotMeshBrushHitsFromScreen(s,{x,y}).map(h=>h.i):[];
  }
  const next=JSON.stringify({v:state.meshEdit.hoveredVert,e:state.meshEdit.hoveredEdge?.key,f:state.meshEdit.hoveredFace?.index});
  return prev!==next;
}
function toggleInSet(set,value){if(set.has(value))set.delete(value);else set.add(value);return set;}
function beginMeshElementDrag(s,indices,p){
  const m=ensureSlotMesh(s);const list=[...new Set(indices||[])].filter(i=>m?.vertices?.[i]);if(!m||!list.length)return false;
  state.drag={type:'meshVertex',id:s.id,start:p,indices:list,starts:list.map(i=>({i,x:m.vertices[i].x,y:m.vertices[i].y,world:slotMeshBaseVertexWorld(s,m.vertices[i])}))};pushUndo();renderAll();return true;
}
function selectMeshEdgeHit(hit,{toggle=false,append=false}={}){
  if(!hit)return false;state.meshEdit.selectionMode='edge';const key=meshEdgeKey(hit.a,hit.b);let keys=new Set((state.meshEdit.selectedEdges||[]));
  if(toggle)toggleInSet(keys,key);else if(append)keys.add(key);else keys=new Set([key]);
  setMeshSelectedEdges([...keys]);return true;
}
function selectMeshFaceHit(hit,{toggle=false,append=false}={}){
  if(!hit)return false;state.meshEdit.selectionMode='face';let faces=new Set((state.meshEdit.selectedFaces||[]));
  if(toggle)toggleInSet(faces,hit.index);else if(append)faces.add(hit.index);else faces=new Set([hit.index]);
  setMeshSelectedFaces([...faces]);return true;
}
function applyMeshKnifeAt(p,cp){
  const s=selectedSlot();if(!s)return false;const edge=hitTestMeshEdgeScreen(cp.x,cp.y);if(edge){pushUndo();const ok=splitSlotMeshEdge(s,edge.a,edge.b,edge.t);if(!ok)state.undo.pop();else changed();renderAll();return true;}
  const face=hitTestMeshFaceScreen(cp.x,cp.y);if(face){pushUndo();const ok=insertSlotMeshFaceVertex(s,face.index,p);if(!ok)state.undo.pop();else changed();renderAll();return true;}
  return false;
}
function canPick(kind){if(state.mode==='pose'&&state.pick.lockNonBonesInPose&&kind!=='bone'){if(kind==='slot'&&(state.selected.type==='slot'||state.meshEdit?.tool==='deform'))return state.pick.slots!==false;return false;}if(kind==='bone')return state.pick.bones!==false;if(kind==='slot')return state.pick.slots!==false;if(kind==='marker')return state.pick.markers!==false;return true;}
function setMode(value){
  const next=normalizeMode(value);
  if(typeof weightPaintSessionActive==='function'&&weightPaintSessionActive()&&next!==state.mode){renderModeBadge();return;}
  if(state.mode===next){renderModeBadge();return;}
  if(rigTestPoseActive?.())exitDeformationTestPose({restore:true});
  state.mode=next;
  if(next==='pose'){state.meshEdit.enabled=false;state.tool='select';state.meshEdit.selectedVerts=[];state.meshEdit.selectedEdges=[];state.meshEdit.selectedFaces=[];applyAnimationPose?.(state.currentTime||0);}
  else{setPlaying(false);restoreBindPose?.({push:false,clearDeform:true});}
  if($('#mode'))$('#mode').value=next;
  state.inspectorTab='transform';
  renderModeBadge();setTool('select');renderInspector();renderTimeline();sizeCanvas();
}
function renderModeBadge(){
  const app=$('.app');if(app){app.classList.toggle('mode-rig',state.mode!=='pose');app.classList.toggle('mode-animate',state.mode==='pose');}
  const isAnim=state.mode==='pose',isTest=rigTestPoseActive?.(),badge=$('#modeBadge');
  if(badge){badge.textContent=isTest?'TEST POSE MODE':(isAnim?'ANIMATION MODE':'RIGGING MODE');badge.className='mode-badge '+(isTest?'test':(isAnim?'animate':'rig'));}
  $('#modeRig')?.classList.toggle('on',!isAnim);$('#modeAnimate')?.classList.toggle('on',isAnim);if($('#mode'))$('#mode').value=isAnim?'pose':'skeleton';
  const hud=$('#viewportHud');if(hud)hud.textContent=isTest?'Test Pose: drag bones to preview mesh deformation. No keys or setup changes are saved. Reset or Exit from Binding > Test Pose.':(isAnim?'Animation: V Select, G/W Move, R Rotate, S Scale, Space Play, K Key selected, O Onion. Rigging workbenches are hidden in Animation mode.':'Rigging: V Select, B Create Bone, G/W Move, R Rotate, S Scale, H Pan. Assets/Markers and Binding/Mesh/Weights live in the lower workbench; View/Pick filters are in the side panel.');
  const cv=$('#cameraViewToggle');if(cv){const on=!!(state.documentType==='toon'&&state.view?.cameraView);cv.classList.toggle('on',on);cv.textContent=on?'World View':'Camera View';}
  updateToolStatus();
}
function setPlaying(value){const next=!!value;state.playing=next;const play=$('#play');if(play)play.textContent=state.playing?'Pause':'Play';state.lastNow=performance.now();if(typeof resetElasticSimulation==='function'){if(next)resetElasticSimulation();else{applyAnimationPose(state.currentTime);resetElasticSimulation();}}syncTime();}
function stopPlayback(){setPlaying(false);setTime(state.timeline.useRange?playbackRange().start:0,true);}
function stepFrame(dir){setPlaying(false);const fps=Math.max(1,Number(state.anim.fps||24));setTime(state.currentTime+dir/fps,true,true);}
function goPlaybackStart(){setPlaying(false);setTime(state.timeline.useRange?playbackRange().start:0,true);}
function goPlaybackEnd(){setPlaying(false);setTime(state.timeline.useRange?playbackRange().end:state.anim.duration,true);}
function setRangePoint(which){const t=roundTime(state.currentTime);if(which==='in')state.timeline.rangeStart=clamp(t,0,state.anim.duration);else state.timeline.rangeEnd=clamp(t,0,state.anim.duration);if(state.timeline.rangeEnd<=state.timeline.rangeStart)state.timeline.rangeEnd=state.anim.duration;state.timeline.useRange=true;const use=$('#useRange');if(use)use.checked=true;changed();syncTime();renderTimeline();}
function autoKeyEnabled(){const el=$('#autoKey');return state.mode==='pose'&&!!(el&&el.checked);}
function ensureAutoKeyAnimateMode(){return state.mode==='pose'&&!!($('#autoKey')?.checked);}
function autoKeyBoneAfterEdit(id=state.selected.id,includeParents=true){if(!autoKeyEnabled())return false;if(!ensureAutoKeyAnimateMode())return false;if(!id)return false;const list=includeParents?chainToRoot(id):[bone(id)].filter(Boolean);for(const b of list)writeBoneKey(b.id,state.currentTime);const kt=roundTime(state.currentTime);state.selectedKeys=list.map(b=>keyRef('bone',b.id,kt));state.keySelection={kind:'bone',id,time:kt};changed();renderTimeline();renderKeyInfo();return true;}
function autoKeyBonesAfterEdit(ids=[]){
  if(!autoKeyEnabled())return false;if(!ensureAutoKeyAnimateMode())return false;
  const seen=new Set(),list=[];
  for(const id of ids){const b=bone(id);if(b&&!seen.has(b.id)&&!isProjectRootBone(b)){seen.add(b.id);list.push(b);}}
  if(!list.length)return false;
  for(const b of list)writeBoneKey(b.id,state.currentTime);
  const kt=roundTime(state.currentTime);state.selectedKeys=list.map(b=>keyRef('bone',b.id,kt));state.keySelection={kind:'bone',id:list[0]?.id||null,time:kt};changed();renderTimeline();renderKeyInfo();return true;
}
function autoKeySlotAfterEdit(id=state.selected.id){if(!autoKeyEnabled())return false;if(!ensureAutoKeyAnimateMode())return false;if(!id)return false;writeSlotKey(id,state.currentTime);const kt=roundTime(state.currentTime);state.selectedKeys=[keyRef('slot',id,kt)];state.keySelection={kind:'slot',id,time:kt};changed();renderTimeline();renderKeyInfo();return true;}
function autoKeyCameraAfterEdit(id=state.selected.id){if(!autoKeyEnabled())return false;if(!ensureAutoKeyAnimateMode())return false;if(state.documentType!=='toon'||!id||typeof writeCameraKey!=='function')return false;writeCameraKey(id,state.currentTime);const kt=roundTime(state.currentTime);state.selectedKeys=[keyRef('camera',id,kt)];state.keySelection={kind:'camera',id,time:kt};changed();renderTimeline();renderKeyInfo();return true;}
function syncWorkflowControls(){
  const map={pickBones:state.pick.bones,pickRootBones:state.pick.boneRoles?.root!==false,pickDeformBones:state.pick.boneRoles?.deform!==false,pickControlBones:state.pick.boneRoles?.control!==false,pickSocketBones:state.pick.boneRoles?.socket!==false,pickSlots:state.pick.slots,pickMarkers:state.pick.markers,lockNonBonesInPose:state.pick.lockNonBonesInPose,onionEnabled:state.onion.enabled,onionAttachments:state.onion.attachments,snapFrames:state.timeline.snapFrames,useRange:state.timeline.useRange,transportSnap:state.timeline.snapFrames,transportUseRange:state.timeline.useRange,loop:state.loop,transportLoop:state.loop,artAutoPlace:state.art.autoPlace,artAutoBind:state.art.autoBindOnBoneCreate,channelCamera:state.timeline.channels?.camera!==false,channelBones:state.timeline.channels?.bones!==false,channelSlots:state.timeline.channels?.slots!==false,channelDeform:state.timeline.channels?.deform!==false,channelEvents:state.timeline.channels?.events!==false,timelineSelectedOnly:!!state.timeline.selectedOnly,timelineAnimatedOnly:!!state.timeline.animatedOnly,timelineShowEmptyGroups:state.timeline.showEmptyGroups!==false,outlinerBones:state.outliner.showBones!==false,outlinerSlots:state.outliner.showSlots!==false,outlinerMarkers:state.outliner.showMarkers!==false,outlinerUnbound:state.outliner.showUnbound!==false,showAttachments:state.view.attachments!==false,showBones:state.view.bones!==false,showRootBones:state.view.boneRoles?.root!==false,showDeformBones:state.view.boneRoles?.deform!==false,showControlBones:state.view.boneRoles?.control!==false,showSocketBones:state.view.boneRoles?.socket!==false,showNames:state.view.names!==false,showRest:!!state.view.rest,showMarkers:state.view.markers!==false,showMesh:!!state.view.mesh,stretch:!!state.view.stretch};
  for(const [id,val]of Object.entries(map)){const el=$('#'+id);if(el)el.checked=!!val;}
  if($('#mode'))$('#mode').value=state.mode;if($('#outlinerRoleFilter'))$('#outlinerRoleFilter').value=state.outliner.roleFilter||'all';if($('#onionPrev'))$('#onionPrev').value=state.onion.prev;if($('#onionNext'))$('#onionNext').value=state.onion.next;if($('#onionStep'))$('#onionStep').value=state.onion.stepFrames;if($('#onionOpacity'))$('#onionOpacity').value=state.onion.opacity;if($('#timeDisplay'))$('#timeDisplay').value=state.timeline.display;if($('#outlinerSearch'))$('#outlinerSearch').value=state.outliner.query||'';if($('#poseBlend'))$('#poseBlend').value=100;
  syncTime();renderModeBadge();setTool(state.tool);if(typeof renderOutlinerTabs==='function')renderOutlinerTabs();if(typeof applyLayout==='function')applyLayout(false);
}
function moveSlotByWorldDelta(s,delta){if(!s)return;updateWorld(false);if(s.bone){const b=bone(s.bone);const loc=inverseVectorFromBasis(b.w,delta);s.local.x+=loc.x;s.local.y+=loc.y;}else{const o=rigObject(s.objectId),rb=bone(o?.root);if(rb){const loc=inverseVectorFromBasis(rb.w,delta);s.local.x+=loc.x;s.local.y+=loc.y;}else{s.local.x+=delta.x;s.local.y+=delta.y;}}if(state.mode!=='pose'&&!rigTestPoseActive?.()&&typeof markSlotSetupFromLocal==='function')markSlotSetupFromLocal(s);}
function inverseVectorFromBasis(w,v){const ax=w.ax??1,ay=w.ay??0,bx=w.bx??0,by=w.by??1;const det=ax*by-ay*bx;if(Math.abs(det)<1e-8)return{x:v.x,y:v.y};return{x:(v.x*by-v.y*bx)/det,y:(ax*v.y-ay*v.x)/det};}
function objectRootParentBasis(b){const o=objectForRootBone(b?.id);if(!o?.parentSlot)return null;const s=slot(o.parentSlot);if(!s)return null;return slotWorld(s,true);}
function moveBoneByWorldDelta(b,delta){
  if(!canMoveBone(b))return;
  updateWorld(false);const objBasis=objectRootParentBasis(b);
  if(objBasis){const loc=inverseVectorFromBasis(objBasis,delta);applyEdit(b,'x',(b.local.x||0)+loc.x);applyEdit(b,'y',(b.local.y||0)+loc.y);return;}
  const p=bone(b.parent);
  if(p){const loc=inverseVectorFromBasis(p.w,delta);applyEdit(b,'x',(b.local.x||0)+loc.x);applyEdit(b,'y',(b.local.y||0)+loc.y);}
  else{applyEdit(b,'x',(b.local.x||0)+delta.x);applyEdit(b,'y',(b.local.y||0)+delta.y);}
}
function rotateBoneTowardPointer(b,p,stretch=false){
  if(!b||isProjectRootBone(b)||!canRotateBone(b))return;
  updateWorld(false);const start={x:b.w.sx,y:b.w.sy};const worldR=deg(Math.atan2(p.y-start.y,p.x-start.x));const objBasis=objectRootParentBasis(b);const par=bone(b.parent);
  applyEdit(b,'r',worldR-(objBasis?objBasis.r:(par?par.w.r:0)));
  if(stretch)applyEdit(b,'len',dist(start,p));
}
function beginAddBoneDrag(p){
  pushUndo();if(!activeRigObject())makeRigObject('Object '+state.nextObject,{position:p});updateWorld(false);
  const parent=selectedBone();const rootParent=parent&&isProjectRootBone(parent);
  let start=p,connected=false;
  if(parent&&!rootParent){
    const end={x:parent.w.ex,y:parent.w.ey};
    const nearEnd=dist(p,end)<=18/Math.max(.25,state.camera.z);
    if(nearEnd){start=end;connected=true;}
  }
  state.drag={type:'addBone',start,parent:parent?.id||projectRoot()?.id||null,connected};
  state.ghost={a:start,e:p};
}


function rectFromScreens(a,b){
  return {x0:Math.min(a.x,b.x),x1:Math.max(a.x,b.x),y0:Math.min(a.y,b.y),y1:Math.max(a.y,b.y)};
}
function screenPointInRect(p,r){return p.x>=r.x0&&p.x<=r.x1&&p.y>=r.y0&&p.y<=r.y1;}
function screenSegmentIntersectsRect(a,b,r){
  if(screenPointInRect(a,r)||screenPointInRect(b,r))return true;
  const minX=Math.min(a.x,b.x),maxX=Math.max(a.x,b.x),minY=Math.min(a.y,b.y),maxY=Math.max(a.y,b.y);
  if(maxX<r.x0||minX>r.x1||maxY<r.y0||minY>r.y1)return false;
  const ccw=(p,q,c)=>((c.y-p.y)*(q.x-p.x)>(q.y-p.y)*(c.x-p.x));
  const hit=(p1,p2,p3,p4)=>(ccw(p1,p3,p4)!==ccw(p2,p3,p4))&&(ccw(p1,p2,p3)!==ccw(p1,p2,p4));
  const c1={x:r.x0,y:r.y0},c2={x:r.x1,y:r.y0},c3={x:r.x1,y:r.y1},c4={x:r.x0,y:r.y1};
  return hit(a,b,c1,c2)||hit(a,b,c2,c3)||hit(a,b,c3,c4)||hit(a,b,c4,c1);
}
function screenPointInTriangle(p,a,b,c){
  const area=(x,y,z)=>(y.x-x.x)*(z.y-x.y)-(y.y-x.y)*(z.x-x.x);
  const d1=area(p,a,b),d2=area(p,b,c),d3=area(p,c,a);
  const hasNeg=d1<0||d2<0||d3<0,hasPos=d1>0||d2>0||d3>0;return !(hasNeg&&hasPos);
}
function screenTriangleIntersectsRect(ps,r){
  if(ps.some(p=>screenPointInRect(p,r)))return true;
  const rc=[{x:r.x0,y:r.y0},{x:r.x1,y:r.y0},{x:r.x1,y:r.y1},{x:r.x0,y:r.y1}];
  if(rc.some(p=>screenPointInTriangle(p,ps[0],ps[1],ps[2])))return true;
  return screenSegmentIntersectsRect(ps[0],ps[1],r)||screenSegmentIntersectsRect(ps[1],ps[2],r)||screenSegmentIntersectsRect(ps[2],ps[0],r);
}
function mergeMeshBoxSelection(found,kind,{add=false,toggle=false}={}){
  if(kind==='edge'){let cur=new Set(state.meshEdit.selectedEdges||[]);if(toggle){for(const k of found){if(cur.has(k))cur.delete(k);else cur.add(k);}setMeshSelectedEdges([...cur]);return;}if(add){for(const k of found)cur.add(k);setMeshSelectedEdges([...cur]);return;}setMeshSelectedEdges(found);return;}
  if(kind==='face'){let cur=new Set(state.meshEdit.selectedFaces||[]);if(toggle){for(const i of found){if(cur.has(i))cur.delete(i);else cur.add(i);}setMeshSelectedFaces([...cur]);return;}if(add){for(const i of found)cur.add(i);setMeshSelectedFaces([...cur]);return;}setMeshSelectedFaces(found);return;}
  let cur=new Set(state.meshEdit.selectedVerts||[]);if(toggle){for(const i of found){if(cur.has(i))cur.delete(i);else cur.add(i);}setMeshSelectedIndices([...cur]);return;}if(add){for(const i of found)cur.add(i);setMeshSelectedIndices([...cur]);return;}setMeshSelectedIndices(found);
}
function boneIdsInScreenRect(startScreen,currentScreen){
  updateWorld(false);const r=rectFromScreens(startScreen,currentScreen);const out=[];
  for(const b of state.bones){
    if(!boneRoleSelectableInViewport(b)||isProjectRootBone(b))continue;
    const shape=normalizeBoneShape(b.shape||'bone');
    const a=w2s({x:b.w.sx,y:b.w.sy}),e=w2s({x:b.w.ex,y:b.w.ey});
    const c={x:(a.x+e.x)/2,y:(a.y+e.y)/2};
    const hit=shape==='bone'
      ? (screenPointInRect(a,r)||screenPointInRect(e,r)||screenPointInRect(c,r)||screenSegmentIntersectsRect(a,e,r))
      : screenPointInRect(a,r);
    if(hit)out.push(b.id);
  }
  return out;
}
function applyBoneBoxSelection(d){
  const found=boneIdsInScreenRect(d.startScreen,d.currentScreen||d.startScreen);
  const cur=new Set((state.selectedBones||[]).filter(id=>bone(id)));
  let next=[];
  if(d.toggle){
    for(const id of found){if(cur.has(id))cur.delete(id);else cur.add(id);}
    next=[...cur];
  }else if(d.add){
    for(const id of found)cur.add(id);
    next=[...cur];
  }else next=found;
  if(next.length){state.selectedBones=next;state.selected={type:'bone',id:next[next.length-1]};state.lastBoneId=state.selected.id;setActiveObject(objectOfBoneId(state.selected.id));}
  else if(!d.add&&!d.toggle){state.selected={type:'bone',id:null};state.selectedBones=[];}
  state.keySelection={kind:null,id:null,time:null};state.selectedKeys=[];
}

canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);const p=pointer(e),cp=canvasPoint(e);
  if(e.button===1||e.button===2||state.tool==='pan'){state.drag={type:'pan',sx:e.clientX,sy:e.clientY,cx:state.camera.x,cy:state.camera.y};return;}
  // Bone creation has priority over existing bone handles.
  // Otherwise clicking the selected bone tip in Rig mode hits the ROT handle first
  // and starts rotating instead of creating a connected child bone.
  if(state.tool==='bone'){beginAddBoneDrag(p);return;}
  if(meshEditorActive()){
    setMeshHoverFromScreen(cp.x,cp.y);
    // v10.9: Mesh edit may yield to rigging bone picks, but an explicit
    // Weight Paint session is modal. During painting, clicks paint weights
    // until the user presses Apply or Cancel.
    if(!weightPaintSessionActive()&&state.mode!=='pose'&&state.tool==='select'&&canPick('bone')){
      const boneHit=hitTestBone(p);
      if(boneHit&&boneHit.b){
        state.meshEdit.enabled=false;
        clearMeshElementSelection?.();
        const multiPick=e.shiftKey||e.ctrlKey||e.metaKey;
        const alreadyMulti=typeof isBoneSelected==='function'&&isBoneSelected(boneHit.b.id)&&(typeof selectedBoneCount==='function'&&selectedBoneCount()>1);
        if(alreadyMulti&&!multiPick){state.selected={type:'bone',id:boneHit.b.id};state.lastBoneId=boneHit.b.id;setActiveObject(objectOfBoneId(boneHit.b.id));}
        else select('bone',boneHit.b.id,{append:e.shiftKey,toggle:e.ctrlKey||e.metaKey});
        if(multiPick){renderAll();return;}
        if(isProjectRootBone(boneHit.b)){renderAll();return;}
        const moveIds=typeof selectedBoneIds==='function'?selectedBoneIds({exact:true}):[boneHit.b.id];
        if(state.gizmoMode==='move'&&canMoveBone(boneHit.b)){if(!rigTestPoseActive?.())pushUndo();state.drag={type:'boneMove',id:boneHit.b.id,ids:moveIds,last:p,testPose:rigTestPoseActive?.()};return;}
        if(state.gizmoMode==='rotate'&&canRotateBone(boneHit.b)){if(!rigTestPoseActive?.())pushUndo();state.drag={type:'boneRotate',id:boneHit.b.id,stretch:e.shiftKey||state.view.stretch,testPose:rigTestPoseActive?.()};return;}
        renderAll();return;
      }
    }
    if(state.meshEdit?.tool==='vertices'&&meshActionTool()==='knife'){
      state.meshEdit.knifePath=[cp,cp];
      state.drag={type:'meshKnife',id:selectedSlot()?.id||null,startScreen:cp,currentScreen:cp,startWorld:p,currentWorld:p};
      renderAll();return;
    }
    if(state.meshEdit?.tool==='weights'&&weightPaintSessionActive()){
      const sess=state.meshEdit.weightPaintSession;const s=slot(sess.slotId)||selectedSlot(),b=activeWeightBrushBone?.();
      const sessionMode=sess.mode||state.meshEdit.weightTool||'paint';
      if(sessionMode==='paint'){
        if(s&&b){ensureWeightPaintSessionUndo();applySlotMeshWeightBrushAtScreen(s,cp,{boneId:b.id});state.drag={type:'meshWeightBrush',id:s.id,lastScreen:cp};renderAll();return;}
        renderAll();return;
      }
      if(sessionMode==='adjust'){
        if(s&&b){
          const hit=hitTestMeshVertexScreen(cp.x,cp.y);
          if(hit&&hit.slot&&hit.slot.id===s.id){
            const cur=new Set(state.meshEdit.selectedVerts||[]);
            if(e.shiftKey||e.ctrlKey||e.metaKey){if(cur.has(hit.index))cur.delete(hit.index);else cur.add(hit.index);setMeshSelectedIndices([...cur]);}
            else if(!cur.has(hit.index))setMeshSelectedIndices([hit.index]);
          }
          const indices=meshSelectedIndices(s);
          if(indices.length){
            ensureWeightPaintSessionUndo();
            const m=ensureSlotMesh(s);
            state.meshEdit.weightAdjustDelta=0;
            state.drag={type:'meshWeightAdjust',id:s.id,boneId:b.id,startScreen:cp,indices,startWeights:indices.map(i=>({i,w:meshWeightForBone(m.vertices[i],b.id)})),sensitivity:state.meshEdit.weightAdjustSensitivity||.005};
            renderAll();return;
          }
        }
        renderAll();return;
      }
    }
    const mode=state.meshEdit?.tool==='vertices'?meshSelectionMode():'vertex';
    const vg=(state.meshEdit?.tool!=='weights'&&typeof hitTestVertexGizmoScreen==='function')?hitTestVertexGizmoScreen(cp.x,cp.y):null;
    if(vg){pushUndo();state.drag=makeVertexGizmoDrag(vg,e);renderAll();return;}
    if(state.meshEdit?.tool==='vertices'&&mode==='edge'){
      const eh=hitTestMeshEdgeScreen(cp.x,cp.y);
      if(eh){selectMeshEdgeHit(eh,{toggle:e.ctrlKey||e.metaKey,append:e.shiftKey});beginMeshElementDrag(eh.slot,meshSelectedIndices(eh.slot),p);return;}
    }else if(state.meshEdit?.tool==='vertices'&&mode==='face'){
      const fh=hitTestMeshFaceScreen(cp.x,cp.y);
      if(fh){selectMeshFaceHit(fh,{toggle:e.ctrlKey||e.metaKey,append:e.shiftKey});beginMeshElementDrag(fh.slot,meshSelectedIndices(fh.slot),p);return;}
    }
    const hit=hitTestMeshVertexScreen(cp.x,cp.y);
    if(hit){
      state.meshEdit.selectionMode='vertex';
      const cur=new Set(state.meshEdit.selectedVerts||[]);
      if(e.shiftKey||e.ctrlKey||e.metaKey){if(cur.has(hit.index))cur.delete(hit.index);else cur.add(hit.index);setMeshSelectedIndices([...cur]);}
      else if(!cur.has(hit.index))setMeshSelectedIndices([hit.index]);
      const s=hit.slot,m=ensureSlotMesh(s),indices=meshSelectedIndices(s);
      if(state.meshEdit?.tool==='weights'){renderAll();return;}
      if(state.meshEdit?.tool==='deform'){
        const offs=cloneSlotDeformOffsets(s);
        state.drag={type:'meshDeform',id:s.id,start:p,indices,starts:indices.map(i=>({i,ox:offs[i]?.x||0,oy:offs[i]?.y||0,baseWorld:slotMeshVertexWorldNoDeform(s,m.vertices[i])}))};
        pushUndo();renderAll();return;
      }
      state.drag={type:'meshVertex',id:s.id,start:p,indices,starts:indices.map(i=>({i,x:m.vertices[i].x,y:m.vertices[i].y,world:slotMeshBaseVertexWorld(s,m.vertices[i])}))};
      pushUndo();renderAll();return;
    }
    if(!e.shiftKey&&!e.ctrlKey&&!e.metaKey)clearMeshElementSelection();
    state.drag={type:'meshBox',id:selectedSlot()?.id||null,startScreen:cp,currentScreen:cp,add:e.shiftKey,toggle:e.ctrlKey||e.metaKey,tool:state.meshEdit?.tool||'vertices',selectionMode:state.meshEdit?.selectionMode||'vertex'};
    renderAll();return;
  }
  if(state.tool==='select'&&state.selected.type==='camera'&&typeof hitTestCameraGizmoScreen==='function'){const giz=hitTestCameraGizmoScreen(cp.x,cp.y);if(giz){state.drag=giz;pushUndo();return;}}
  if(state.tool==='select'&&state.selected.type==='slot'){const giz=hitTestSlotGizmoScreen(cp.x,cp.y);if(giz){state.drag={...giz,testPose:rigTestPoseActive?.()};if(!rigTestPoseActive?.())pushUndo();return;}}
  if(state.tool==='select'&&state.selected.type==='bone'){const giz=hitTestBoneGizmoScreen(cp.x,cp.y);if(giz){state.drag={...giz,testPose:rigTestPoseActive?.()};if(!rigTestPoseActive?.())pushUndo();return;}}
  if(state.tool==='select'&&typeof hitTestToonCameraScreen==='function'){const camHit=hitTestToonCameraScreen(cp.x,cp.y);if(camHit?.camera){state.selected={type:'camera',id:camHit.camera.id};state.selectedBones=[];state.inspectorTab='camera';renderAll();return;}}
  if(state.tool==='select'&&canPick('slot')&&!rigTestPoseActive?.()){const sl=hitTestSlot(p);if(sl){select('slot',sl.id);if(state.gizmoMode==='move'){state.drag={type:'slotMove',id:sl.id,last:p};pushUndo();}return;}}
  if(canPick('marker')){const m=hitTestMarker(p);if(m){select('marker',m.id);state.drag={type:'marker',id:m.id,off:{x:p.x-m.x,y:p.y-m.y}};pushUndo();return;}}
  if(canPick('bone')){const hit=hitTestBone(p);if(hit){
    const multiPick=e.shiftKey||e.ctrlKey||e.metaKey;
    const alreadyMulti=typeof isBoneSelected==='function'&&isBoneSelected(hit.b.id)&&(typeof selectedBoneCount==='function'&&selectedBoneCount()>1);
    if(alreadyMulti&&!multiPick){state.selected={type:'bone',id:hit.b.id};state.lastBoneId=hit.b.id;setActiveObject(objectOfBoneId(hit.b.id));}
    else select('bone',hit.b.id,{append:e.shiftKey,toggle:e.ctrlKey||e.metaKey});
    if(multiPick){renderAll();return;}
    if(isProjectRootBone(hit.b)){renderAll();return;}
    const moveIds=typeof selectedBoneIds==='function'?selectedBoneIds({exact:true}):[hit.b.id];
    if(state.gizmoMode==='move'&&canMoveBone(hit.b)){if(!rigTestPoseActive?.())pushUndo();state.drag={type:'boneMove',id:hit.b.id,ids:moveIds,last:p,testPose:rigTestPoseActive?.()};return;}
    if(state.gizmoMode==='rotate'&&canRotateBone(hit.b)){if(!rigTestPoseActive?.())pushUndo();state.drag={type:'boneRotate',id:hit.b.id,stretch:e.shiftKey||state.view.stretch,testPose:rigTestPoseActive?.()};return;}
    renderAll();return;
  }}
  state.drag={type:'boneBox',startScreen:cp,currentScreen:cp,add:e.shiftKey,toggle:e.ctrlKey||e.metaKey};
  renderAll();
});
canvas.addEventListener('pointermove',e=>{
  const p=pointer(e),d=state.drag;if(!d){const cp=canvasPoint(e);if(setMeshHoverFromScreen(cp.x,cp.y))renderAll();return;}
  if(d.type==='pan'){state.camera.x=d.cx+(e.clientX-d.sx);state.camera.y=d.cy+(e.clientY-d.sy);return;}
  if(d.type==='addBone'){state.ghost={a:d.start,e:p};return;}
  if(d.type==='meshKnife'){d.currentScreen=canvasPoint(e);d.currentWorld=p;state.meshEdit.knifePath=[d.startScreen,d.currentScreen];renderAll();return;}
  if(d.type==='meshWeightBrush'){
    const cp=canvasPoint(e);state.meshEdit.weightBrushCursor=cp;
    const s=slot(d.id),b=activeWeightBrushBone?.();
    if(s&&b&&applySlotMeshWeightBrushAtScreen(s,cp,{boneId:b.id})){const sess=state.meshEdit?.weightPaintSession;if(sess)sess.dirty=true;}
    renderAll();return;
  }
  if(d.type==='meshWeightAdjust'){
    const cp=canvasPoint(e);state.meshEdit.weightBrushCursor=cp;
    const s=slot(d.id),b=bone(d.boneId)||activeWeightBrushBone?.();
    if(s&&b){
      const dx=cp.x-(d.startScreen?.x||cp.x),dy=cp.y-(d.startScreen?.y||cp.y);
      const speed=(d.sensitivity||state.meshEdit.weightAdjustSensitivity||.005)*(e.shiftKey?.25:1);
      const delta=clamp((dx-dy)*speed,-1,1);
      state.meshEdit.weightAdjustDelta=delta;
      for(const item of d.startWeights||[]){slotMeshBoneWeightTarget(s,item.i,b.id,clamp((item.w||0)+delta,0,1));}
      const sess=state.meshEdit?.weightPaintSession;if(sess)sess.dirty=true;
    }
    renderAll();return;
  }
  if(d.type==='meshBox'||d.type==='boneBox'){d.currentScreen=canvasPoint(e);renderAll();return;}
  if(d.type==='vertexGizmo'){if(typeof applyVertexGizmoDrag==='function')applyVertexGizmoDrag(d,e);return;}
  if(d.type==='cameraGizmo'){if(typeof applyCameraGizmoDrag==='function')applyCameraGizmoDrag(d,e);return;}
  if(d.type==='boneGizmo'){if(rigTestPoseActive?.())state.rig.testPose.dirty=true;if(typeof applyBoneUniversalGizmoDrag==='function')applyBoneUniversalGizmoDrag(d,e);return;}
  if(d.type==='meshVertex'){
    const s=slot(d.id);if(!s)return;
    const delta={x:p.x-d.start.x,y:p.y-d.start.y};
    // Rigging Mesh mode edits the setup topology / cut positions.
    // UV follows the vertex so the image does not get warped just by moving
    // mesh points in setup. Real vertex deformation is handled by meshDeform.
    const setupMeshEdit=state.mode!=='pose'&&state.meshEdit?.tool==='vertices';
    for(const v of d.starts||[]){setSlotMeshVertexWorld(s,v.i,{x:v.world.x+delta.x,y:v.world.y+delta.y},{updateUV:setupMeshEdit});}
    renderInspector();return;
  }
  if(d.type==='meshDeform'){
    const s=slot(d.id);if(!s)return;const sw=slotWorld(s);if(!sw)return;
    const delta={x:p.x-d.start.x,y:p.y-d.start.y};const loc=inverseVectorFromBasis(sw,delta);
    for(const v of d.starts||[]){setSlotDeformOffset(s,v.i,(v.ox||0)+loc.x,(v.oy||0)+loc.y);}
    renderInspector();return;
  }
  if(d.type==='slotMove'||d.type==='slotMoveAxis'){const s=slot(d.id);if(!s)return;let delta={x:p.x-d.last.x,y:p.y-d.last.y};if(d.type==='slotMoveAxis'){if(d.axis==='x')delta.y=0;if(d.axis==='y')delta.x=0;}moveSlotByWorldDelta(s,delta);d.last={x:d.last.x+delta.x,y:d.last.y+delta.y};renderInspector();return;}
  if(d.type==='boneMove'||d.type==='boneMoveAxis'){if(rigTestPoseActive?.())state.rig.testPose.dirty=true;const b=bone(d.id);if(!b)return;let delta={x:p.x-d.last.x,y:p.y-d.last.y};if(d.type==='boneMoveAxis'){if(d.axis==='x')delta.y=0;if(d.axis==='y')delta.x=0;}const targets=typeof selectedBoneMoveRoots==='function'?selectedBoneMoveRoots(d.id):[b];for(const tb of targets)moveBoneByWorldDelta(tb,delta);d.last={x:d.last.x+delta.x,y:d.last.y+delta.y};renderInspector();renderBoneList();return;}
  if(d.type==='boneRotate'){if(rigTestPoseActive?.())state.rig.testPose.dirty=true;const b=bone(d.id);if(!b)return;updateWorld(false);if(state.ik.enabled&&state.mode==='pose')solveCCD(b.id,p,state.ik.chain);else rotateBoneTowardPointer(b,p,d.stretch||e.shiftKey||state.view.stretch);renderInspector();renderBoneList();return;}
  if(d.type==='boneScaleX'||d.type==='boneScaleY'){if(rigTestPoseActive?.())state.rig.testPose.dirty=true;const b=bone(d.id);if(!b||!canScaleBone(b,'scale'))return;updateWorld(false);const start={x:b.w.sx,y:b.w.sy};const now=Math.max(1,dist(start,p));const factor=clamp(now/Math.max(1,d.startWorldLen||now),.05,20);applyEdit(b,d.type==='boneScaleX'?'sx':'sy',(d.local[d.type==='boneScaleX'?'sx':'sy']||1)*factor);renderInspector();renderBoneList();return;}
  if(d.type==='slotRotate'){const s=slot(d.id);if(!s)return;const sw=d.sw;const a=Math.atan2(p.y-sw.y,p.x-sw.x);const r=normAngle((sw.r||0)+deg(a-d.startAngle));applySlotWorldTransform(s,{...sw,r});renderInspector();return;}
  if(d.type==='slotScale'){const s=slot(d.id);if(!s)return;const sw=d.sw;const startDist=Math.max(1,Math.hypot(d.start.x-w2s(sw).x,d.start.y-w2s(sw).y));const cp=canvasPoint(e);const nowDist=Math.max(1,Math.hypot(cp.x-w2s(sw).x,cp.y-w2s(sw).y));let factor=clamp(nowDist/startDist,.05,20);let sx=(d.local.sx||1)*factor,sy=(d.local.sy||1)*factor;if(!e.shiftKey){sy=sx*Math.sign(d.local.sy||1);}applySlotWorldTransform(s,{...sw,sx,sy});renderInspector();return;}
  if(d.type==='slotScaleAxis'){const s=slot(d.id);if(!s)return;const sw=d.sw;const loc=inversePointFromBasis(sw,p);const axis=d.axis==='x'?'x':'y';const start=Math.abs(d.startLocal?.[axis]||1);let factor=Math.abs(loc[axis]||0)/Math.max(1e-3,start);factor=clamp(factor,.05,20);const sx=axis==='x'?(d.local.sx||1)*factor:(d.local.sx||1);const sy=axis==='y'?(d.local.sy||1)*factor:(d.local.sy||1);applySlotWorldTransform(s,{...sw,sx,sy});renderInspector();return;}
  if(d.type==='marker'){const m=marker(d.id);if(!m)return;updateWorld(false);const b=bone(m.bone);if(!b)return;const root={x:b.w.sx,y:b.w.sy};const q={x:p.x-root.x,y:p.y-root.y};const loc=rotatePoint(q.x,q.y,-b.w.r);m.x=loc.x;m.y=loc.y;renderInspector();return;}
  const b=bone(d.id);if(!b)return;
  if(d.type==='pose'){updateWorld(false);if(state.ik.enabled&&state.mode==='pose'){solveCCD(b.id,p,state.ik.chain);}else{rotateBoneTowardPointer(b,p,d.stretch||e.shiftKey||state.view.stretch);}renderInspector();renderBoneList();}
});
canvas.addEventListener('pointerup',e=>{
  const p=pointer(e),d=state.drag;
  if(d?.type==='meshKnife'){
    const a=d.startScreen||canvasPoint(e),b=d.currentScreen||canvasPoint(e);const moved=Math.hypot((b.x||0)-(a.x||0),(b.y||0)-(a.y||0));
    if(moved<=5){applyMeshKnifeAt(p,canvasPoint(e));}
    else{const s=slot(d.id);if(s){pushUndo();const ok=knifeCutSlotMeshByWorldLine(s,d.startWorld,p);if(!ok)state.undo.pop();else changed();}}
    state.meshEdit.knifePath=[];
  }
  if(d?.type==='meshBox'){
    const s=slot(d.id);const m=s?ensureSlotMesh(s):null;
    if(s&&m){const a=d.startScreen||canvasPoint(e),b=d.currentScreen||canvasPoint(e);const r=rectFromScreens(a,b);const pts=slotMeshWorldVertices(s).map(w2s);const mode=d.selectionMode||meshSelectionMode();
      if(mode==='edge'&&state.meshEdit?.tool==='vertices'){
        ensureMeshTopology(m);const found=[];for(const ed of m.edges||[]){const pa=pts[ed[0]],pb=pts[ed[1]];if(!pa||!pb)continue;if(screenSegmentIntersectsRect(pa,pb,r))found.push(meshEdgeKey(ed[0],ed[1]));}mergeMeshBoxSelection(found,'edge',{add:d.add,toggle:d.toggle});
      }else if(mode==='face'&&state.meshEdit?.tool==='vertices'){
        const found=[];for(let i=0;i<(m.triangles||[]).length;i++){const tri=m.triangles[i],ps=tri.map(j=>pts[j]).filter(Boolean);if(ps.length<3)continue;if(screenTriangleIntersectsRect(ps,r))found.push(i);}mergeMeshBoxSelection(found,'face',{add:d.add,toggle:d.toggle});
      }else{
        const found=[];for(let i=0;i<pts.length;i++){const q=pts[i];if(screenPointInRect(q,r))found.push(i);}mergeMeshBoxSelection(found,'vertex',{add:d.add,toggle:d.toggle});
      }
    }
  }
  if(d?.type==='boneBox'){
    const a=d.startScreen||canvasPoint(e),b=d.currentScreen||canvasPoint(e);
    if(Math.abs(a.x-b.x)>3||Math.abs(a.y-b.y)>3)applyBoneBoxSelection(d);
    else if(!d.add&&!d.toggle){state.selected={type:'bone',id:null};state.selectedBones=[];state.keySelection={kind:null,id:null,time:null};state.selectedKeys=[];}
    renderInspector();renderBoneList();renderTimeline();
  }
  if(d?.type==='addBone'){updateWorld(false);const len=dist(d.start,p);if(len>6){const parent=bone(d.parent)||projectRoot();const worldR=deg(Math.atan2(p.y-d.start.y,p.x-d.start.x));const moveOnly=len<=MOVE_ONLY_BONE_LEN;const connected=!!(d.connected&&!moveOnly&&parent&&!isProjectRootBone(parent));const local=boneLocalFromWorldStart({x:d.start.x,y:d.start.y,r:worldR,len},parent?.id||null);const b=makeBone({parent:parent?.id||null,x:connected?0:local.x,y:connected?0:local.y,r:connected?worldR-parent.w.r:local.r,len,moveOnly,connected});updateWorld(false);}}
  if(d?.type==='pose'||d?.type==='boneGizmo'||d?.type==='boneMove'||d?.type==='boneMoveAxis'||d?.type==='boneRotate'||d?.type==='boneScaleX'||d?.type==='boneScaleY'){if(d.ids&&d.ids.length>1&&typeof autoKeyBonesAfterEdit==='function')autoKeyBonesAfterEdit(d.ids);else autoKeyBoneAfterEdit(state.selected.id);}
  if(d?.type==='cameraGizmo')autoKeyCameraAfterEdit(d.id);
  if(d?.type==='slotMove'||d?.type==='slotMoveAxis'||d?.type==='slotRotate'||d?.type==='slotScale'||d?.type==='slotScaleAxis')autoKeySlotAfterEdit(d.id);
  if(d?.type==='meshDeform'||(d?.type==='vertexGizmo'&&d.tool==='deform')){writeDeformKey(d.id,state.currentTime);const kt=roundTime(state.currentTime);state.selectedKeys=[keyRef('deform',d.id,kt)];state.keySelection={kind:'deform',id:d.id,time:kt};}
  if(d?.type==='meshWeightBrush'){state.meshEdit.weightBrushHits=[];}
  if(d?.type==='meshWeightAdjust'){state.meshEdit.weightAdjustDelta=0;}
  const temporaryTestDrag=!!(d&&d.testPose)||(rigTestPoseActive?.()&&['boneGizmo','boneMove','boneMoveAxis','boneRotate','boneScaleX','boneScaleY','slotMove','slotMoveAxis','slotRotate','slotScale','slotScaleAxis'].includes(d?.type));
  state.drag=null;state.ghost=null;renderAll();if(!temporaryTestDrag)changed();
});
canvas.addEventListener('pointercancel',()=>{state.drag=null;state.ghost=null;});canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('wheel',e=>{e.preventDefault();const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,before=s2w(sx,sy);state.camera.z=clamp(state.camera.z*(e.deltaY<0?1.1:1/1.1),.15,5);const v=viewRect();state.camera.x=sx-v.w/2-before.x*state.camera.z;state.camera.y=sy-v.h/2+before.y*state.camera.z;},{passive:false});

$('#mode').onchange=e=>setMode(e.target.value);$('#modeRig').onclick=()=>setMode('skeleton');$('#modeAnimate').onclick=()=>setMode('pose');$('#toolSelect').onclick=()=>setTool('select');$('#toolBone').onclick=()=>setTool('bone');$('#toolPan').onclick=()=>setTool('pan');$('#toolMove').onclick=()=>setGizmoMode('move');$('#toolRotate').onclick=()=>setGizmoMode('rotate');$('#toolScale').onclick=()=>setGizmoMode('scale');$('#clear').onclick=clearProject;if($('#addObject'))$('#addObject').onclick=()=>{pushUndo();makeRigObject('Object '+state.nextObject);changed();renderAll();};if($('#deleteObject'))$('#deleteObject').onclick=()=>{const o=activeRigObject();if(!o)return;if(!confirm('Delete object '+o.name+'?'))return;pushUndo();deleteRigObject(o.id);changed();renderAll();};if($('#objectAttachSelect'))$('#objectAttachSelect').onchange=e=>{setActiveObject(e.target.value);const o=activeRigObject();if(o)select('bone',o.root);renderObjectList?.();};if($('#objectRenderLayerSelect'))$('#objectRenderLayerSelect').onchange=e=>{const o=activeRigObject();if(!o||state.documentType!=='toon')return;pushUndo();o.renderLayerId=e.target.value||defaultRenderLayerId();changed();renderAll();};if($('#objectParentSlotSelect'))$('#objectParentSlotSelect').onchange=e=>{state.lastSlotId=e.target.value||state.lastSlotId;};if($('#attachObjectToSlot'))$('#attachObjectToSlot').onclick=()=>{const oid=$('#objectAttachSelect')?.value||state.activeObjectId,sid=$('#objectParentSlotSelect')?.value;if(!oid||!sid)return;pushUndo();if(!attachObjectToSlot(oid,sid,true))alert('Cannot attach object here.');changed();renderAll();};if($('#detachObjectFromSlot'))$('#detachObjectFromSlot').onclick=()=>{const oid=$('#objectAttachSelect')?.value||state.activeObjectId;if(!oid)return;pushUndo();detachObjectFromSlot(oid,true);changed();renderAll();};if($('#ensureRoot'))$('#ensureRoot').onclick=()=>{pushUndo();ensureProjectRoot({reparent:true});select('bone',state.projectRootId);changed();renderAll();};$('#ik').onchange=e=>state.ik.enabled=e.target.checked;$('#autoKey').onchange=e=>{if(e.target.checked){setMode('pose');setTool('select');}renderModeBadge();renderTimeline();};$('#ikChain').onchange=e=>state.ik.chain=clamp(parseInt(e.target.value,10)||3,1,8);$('#keySel').onclick=keySelected;$('#keyAll').onclick=keyAll;$('#undo').onclick=undo;$('#redo').onclick=redo;$('#play').onclick=()=>setPlaying(!state.playing);$('#stop').onclick=stopPlayback;$('#goStart').onclick=goPlaybackStart;$('#goEnd').onclick=goPlaybackEnd;$('#prevFrame').onclick=()=>stepFrame(-1);$('#nextFrame').onclick=()=>stepFrame(1);$('#setRangeIn').onclick=()=>setRangePoint('in');$('#setRangeOut').onclick=()=>setRangePoint('out');
$('#addSlot').onclick=()=>{pushUndo();let att=state.attachments[0]||makeRectAttachment();placeAttachmentOnStage(att.id,'slot');changed();renderAll();};$('#slotUp').onclick=()=>selectedSlot()&&moveSlot(state.selected.id,-1);$('#slotDown').onclick=()=>selectedSlot()&&moveSlot(state.selected.id,1);if($('#bindNearestSlot'))$('#bindNearestSlot').onclick=bindSelectedSlotToNearest;if($('#bindLastBone'))$('#bindLastBone').onclick=bindSelectedSlotToLastBone;if($('#bindAllNearest'))$('#bindAllNearest').onclick=bindAllUnboundSlotsToNearest;if($('#unbindSlot'))$('#unbindSlot').onclick=unbindSelectedSlot;if($('#createBoneFromArt'))$('#createBoneFromArt').onclick=createBoneFromSelectedArtwork;if($('#createBonesFromUnbound'))$('#createBonesFromUnbound').onclick=createBonesFromUnboundArtwork;if($('#bindSelectedArtToBone'))$('#bindSelectedArtToBone').onclick=bindSelectedArtToSelectedBone;if($('#unbindKeepWorld'))$('#unbindKeepWorld').onclick=unbindSelectedSlot;if($('#validateProjectBtn'))$('#validateProjectBtn').onclick=validateProject;
$('#addRectAtt').onclick=()=>{pushUndo();const a=makeRectAttachment('rect_'+state.nextAtt,70,35,colors[state.attachments.length%colors.length]);const s=selectedSlot();if(state.art.autoPlace||!s){placeAttachmentOnStage(a.id,'rect');}else{s.attachment=a.id;s.pose.attachment=a.id;ensureSlotMesh(s,true);}changed();renderAll();};
$('#addPngBtn').onclick=()=>$('#pngInput').click();$('#pngInput').onchange=e=>{const files=[...e.target.files];if(!files.length)return;pushUndo();let placed=0;for(const f of files){const reader=new FileReader();reader.onload=ev=>{const img=new Image();img.onload=()=>{const a=makeImageAttachment(f.name,ev.target.result,img.naturalWidth,img.naturalHeight);imageCache.set(a.id,img);const s=selectedSlot();if(state.art.autoPlace||!s){const placedSlot=placeAttachmentOnStage(a.id,f.name.replace(/\.[^.]+$/,''));placedSlot.local.x+=placed*18;placedSlot.local.y-=placed*18;placed++;}else{s.attachment=a.id;s.pose.attachment=a.id;ensureSlotMesh(s,true);}changed();renderAll();};img.src=ev.target.result;};reader.readAsDataURL(f);}e.target.value='';};
$('#addSocket').onclick=()=>{const b=selectedBone()||state.bones[0];if(!b)return;pushUndo();makeMarker('socket',b.id);changed();renderAll();};$('#addHitbox').onclick=()=>{const b=selectedBone()||state.bones[0];if(!b)return;pushUndo();makeMarker('hitbox',b.id);changed();renderAll();};$('#delMarker').onclick=()=>{if(state.selected.type==='marker')deleteSelected();};
$('#showAttachments').onchange=e=>{state.view.attachments=e.target.checked;renderAll();};$('#showBones').onchange=e=>{state.view.bones=e.target.checked;renderAll();};for(const [id,role] of [['showRootBones','root'],['showDeformBones','deform'],['showControlBones','control'],['showSocketBones','socket']]){const el=$('#'+id);if(el)el.onchange=e=>{state.view.boneRoles=state.view.boneRoles||{};state.view.boneRoles[role]=e.target.checked;renderAll();};}$('#showNames').onchange=e=>{state.view.names=e.target.checked;renderAll();};$('#showRest').onchange=e=>{state.view.rest=e.target.checked;renderAll();};$('#showMarkers').onchange=e=>{state.view.markers=e.target.checked;renderAll();};$('#showMesh').onchange=e=>{state.view.mesh=e.target.checked;renderAll();};$('#stretch').onchange=e=>state.view.stretch=e.target.checked;$('#center').onclick=()=>{state.camera={x:0,y:0,z:1};renderAll();};if($('#cameraViewToggle'))$('#cameraViewToggle').onclick=()=>{if(state.documentType!=='toon')return;state.view.cameraView=!state.view.cameraView;renderModeBadge();renderAll();};
$('#savePose').onclick=savePose;$('#applyPose').onclick=applyPose;$('#copyPose').onclick=()=>{copyPoseToClipboard();renderPoseList();};$('#pastePose').onclick=()=>pastePoseFromClipboard(false,Number($('#poseBlend')?.value||100)/100);$('#pasteMirrorPose').onclick=()=>pastePoseFromClipboard(true,Number($('#poseBlend')?.value||100)/100);$('#mirrorPose').onclick=mirrorCurrentPose;
$('#addClip').onclick=addClip;$('#duplicateClip').onclick=duplicateClip;$('#deleteClip').onclick=deleteClip;$('#animName').onchange=e=>{pushUndo();state.anim.name=e.target.value||'anim';changed();renderClipList();syncTime();};$('#duration').onchange=e=>{pushUndo();state.anim.duration=Math.max(.1,parseFloat(e.target.value)||1);state.timeline.rangeEnd=clamp(state.timeline.rangeEnd,0,state.anim.duration)||state.anim.duration;state.currentTime=clamp(state.currentTime,0,state.anim.duration);changed();syncTime();renderTimeline();renderClipList();};$('#fps').onchange=e=>{pushUndo();state.anim.fps=Math.max(1,parseInt(e.target.value,10)||24);changed();syncTime();renderTimeline();};$('#loop').onchange=e=>{state.loop=e.target.checked;syncTime();};$('#prevKey').onclick=()=>jumpKey(-1);$('#nextKey').onclick=()=>jumpKey(1);$('#delKey').onclick=deleteKey;$('#clearKeySelection').onclick=clearKeySelection;$('#copyKey').onclick=copyCurrentKey;$('#pasteKey').onclick=pasteKeyAtTime;$('#nudgeKeysLeft').onclick=()=>nudgeSelectedKeys(-1);$('#nudgeKeysRight').onclick=()=>nudgeSelectedKeys(1);$('#selectVisibleRange').onclick=()=>selectKeysInRange(playbackRange().start,playbackRange().end,{visibleOnly:true});$('#scaleKeysFirst').onclick=()=>scaleSelectedKeys($('#keyScalePercent')?.value||100,'first');$('#scaleKeysCenter').onclick=()=>scaleSelectedKeys($('#keyScalePercent')?.value||100,'center');$('#reverseKeys').onclick=reverseSelectedKeys;$('#applyCurve').onclick=()=>setCurrentKeyCurve($('#curveType').value);$('#addEvent').onclick=addEvent;$('#timeRange').oninput=e=>setTime(parseInt(e.target.value,10)/1000,true);
$('#pickBones').onchange=e=>state.pick.bones=e.target.checked;for(const [id,role] of [['pickRootBones','root'],['pickDeformBones','deform'],['pickControlBones','control'],['pickSocketBones','socket']]){const el=$('#'+id);if(el)el.onchange=e=>{state.pick.boneRoles=state.pick.boneRoles||{};state.pick.boneRoles[role]=e.target.checked;};}$('#pickSlots').onchange=e=>state.pick.slots=e.target.checked;$('#pickMarkers').onchange=e=>state.pick.markers=e.target.checked;$('#lockNonBonesInPose').onchange=e=>{state.pick.lockNonBonesInPose=e.target.checked;renderModeBadge();};$('#artAutoPlace').onchange=e=>state.art.autoPlace=e.target.checked;if($('#artAutoBind'))$('#artAutoBind').onchange=e=>state.art.autoBindOnBoneCreate=e.target.checked;
$('#onionEnabled').onchange=e=>state.onion.enabled=e.target.checked;$('#onionAttachments').onchange=e=>state.onion.attachments=e.target.checked;$('#onionPrev').onchange=e=>state.onion.prev=clamp(parseInt(e.target.value,10)||0,0,8);$('#onionNext').onchange=e=>state.onion.next=clamp(parseInt(e.target.value,10)||0,0,8);$('#onionStep').onchange=e=>state.onion.stepFrames=clamp(parseInt(e.target.value,10)||1,1,24);$('#onionOpacity').oninput=e=>state.onion.opacity=clamp(parseFloat(e.target.value)||.25,.05,.8);$('#timeDisplay').onchange=e=>{state.timeline.display=e.target.value;syncTime();renderTimeline();};$('#snapFrames').onchange=e=>{state.timeline.snapFrames=e.target.checked;syncTime();};$('#useRange').onchange=e=>{state.timeline.useRange=e.target.checked;syncTime();renderTimeline();};$('#rangeStart').onchange=e=>{const val=state.timeline.display==='frames'?(parseInt(e.target.value,10)||0)/state.anim.fps:parseFloat(e.target.value)||0;state.timeline.rangeStart=clamp(val,0,state.anim.duration);renderTimeline();syncTime();};$('#rangeEnd').onchange=e=>{const val=state.timeline.display==='frames'?(parseInt(e.target.value,10)||0)/state.anim.fps:parseFloat(e.target.value)||state.anim.duration;state.timeline.rangeEnd=clamp(val,0,state.anim.duration);renderTimeline();syncTime();};
if($('#channelCamera'))$('#channelCamera').onchange=e=>{state.timeline.channels.camera=e.target.checked;renderTimeline();};$('#channelBones').onchange=e=>{state.timeline.channels.bones=e.target.checked;renderTimeline();};$('#channelSlots').onchange=e=>{state.timeline.channels.slots=e.target.checked;renderTimeline();};if($('#channelDeform'))$('#channelDeform').onchange=e=>{state.timeline.channels.deform=e.target.checked;renderTimeline();};$('#channelEvents').onchange=e=>{state.timeline.channels.events=e.target.checked;renderTimeline();};$('#timelineSelectedOnly').onchange=e=>{state.timeline.selectedOnly=e.target.checked;renderTimeline();};$('#timelineAnimatedOnly').onchange=e=>{state.timeline.animatedOnly=e.target.checked;renderTimeline();};if($('#timelineShowEmptyGroups'))$('#timelineShowEmptyGroups').onchange=e=>{state.timeline.showEmptyGroups=e.target.checked;renderTimeline();};if($('#timelineExpandAll'))$('#timelineExpandAll').onclick=expandAllTimeline;if($('#timelineCollapseAll'))$('#timelineCollapseAll').onclick=collapseAllTimeline;
const rerenderOutliner=()=>{renderSceneOutliner();if(typeof renderObjectRigTree==='function')renderObjectRigTree();if(typeof renderDrawOrderList==='function')renderDrawOrderList();if(typeof renderOutlinerTabs==='function')renderOutlinerTabs();};
$('#outlinerTabScene').onclick=()=>setOutlinerTab('scene');$('#outlinerTabRig').onclick=()=>setOutlinerTab('rig');$('#outlinerTabDraw').onclick=()=>setOutlinerTab('draw');
$('#outlinerSearch').oninput=e=>{state.outliner.query=e.target.value;rerenderOutliner();};$('#outlinerBones').onchange=e=>{state.outliner.showBones=e.target.checked;rerenderOutliner();};$('#outlinerSlots').onchange=e=>{state.outliner.showSlots=e.target.checked;rerenderOutliner();};$('#outlinerMarkers').onchange=e=>{state.outliner.showMarkers=e.target.checked;rerenderOutliner();};$('#outlinerUnbound').onchange=e=>{state.outliner.showUnbound=e.target.checked;rerenderOutliner();};if($('#outlinerRoleFilter'))$('#outlinerRoleFilter').onchange=e=>{state.outliner.roleFilter=e.target.value||'all';rerenderOutliner();};$('#validateProjectBtnRight').onclick=validateProject;$('#fixOrphansBtn').onclick=fixOrphanKeys;
	$('#transportLoop').onchange=e=>{state.loop=e.target.checked;const l=$('#loop');if(l)l.checked=state.loop;syncTime();};$('#transportUseRange').onchange=e=>{state.timeline.useRange=e.target.checked;const r=$('#useRange');if(r)r.checked=state.timeline.useRange;renderTimeline();syncTime();};$('#transportSnap').onchange=e=>{state.timeline.snapFrames=e.target.checked;const s=$('#snapFrames');if(s)s.checked=state.timeline.snapFrames;syncTime();};
$('#export').onclick=()=>{exportJson(true);exportRuntimeJson?.(true);};$('#import').onclick=()=>{try{pushUndo();importData($('#json').value,false);changed();syncWorkflowControls();exportRuntimeJson?.(true);}catch(err){alert(err.message);}};$('#save').onclick=()=>{localStorage.setItem('indie-2d-skeleton-v11-project',JSON.stringify(exportData()));};$('#load').onclick=()=>{const raw=localStorage.getItem('indie-2d-skeleton-v11-project')||localStorage.getItem('indie-2d-skeleton-v10-project');if(raw){pushUndo();importData(raw,false);syncWorkflowControls();exportRuntimeJson?.(true);}};$('#recover').onclick=()=>{const raw=localStorage.getItem('indie-2d-skeleton-v11-autosave')||localStorage.getItem('indie-2d-skeleton-v10-autosave')||localStorage.getItem('indie-2d-skeleton-v3-autosave');if(raw){pushUndo();importData(raw,false);syncWorkflowControls();exportRuntimeJson?.(true);}};if($('#exportRuntime'))$('#exportRuntime').onclick=()=>exportRuntimeJson?.(true);if($('#validateRuntime'))$('#validateRuntime').onclick=()=>updateRuntimeValidationPanel?.();if($('#copyRuntime'))$('#copyRuntime').onclick=()=>copyRuntimeJsonToClipboard?.();if($('#downloadRuntime'))$('#downloadRuntime').onclick=()=>downloadRuntimeJson?.();if($('#saveProjectFolder'))$('#saveProjectFolder').onclick=()=>saveProjectFolder?.();if($('#loadProjectFolder'))$('#loadProjectFolder').onclick=()=>loadProjectFolder?.();
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName))return;if(rigTestPoseActive?.()){const k=e.key.toLowerCase();if(k==='escape'){e.preventDefault();exitDeformationTestPose({restore:true});return;}if(k==='enter'){e.preventDefault();resetDeformationTestPose();return;}}if(weightPaintSessionActive()){const k=e.key.toLowerCase();const sm=activeWeightSessionMode?.()||'paint';if(k==='escape'){e.preventDefault();cancelWeightPaintSession();return;}if(e.key==='Enter'){e.preventDefault();applyWeightPaintSession();return;}if(k==='p'||k==='a'){e.preventDefault();applyWeightPaintSession();return;}if(sm==='paint'&&['[',']'].includes(e.key)){e.preventDefault();const d=e.key==='['?-4:4;state.meshEdit.weightBrushSize=clamp((state.meshEdit.weightBrushSize||46)+d,4,180);renderMeshWorkbench?.();renderAll();return;}}if(state.meshEdit?.enabled&&state.selected.type==='slot'){const k=e.key.toLowerCase();if(k==='escape'){e.preventDefault();state.meshEdit.knifePath=[];if(meshActionTool()==='knife')setMeshActionTool('select');else clearMeshElementSelection();renderAll();return;}if(state.meshEdit.tool==='vertices'&&['1','2','3'].includes(e.key)){e.preventDefault();setMeshSelectionMode(e.key==='1'?'vertex':(e.key==='2'?'edge':'face'));if(typeof renderMeshWorkbench==='function')renderMeshWorkbench();return;}if(state.meshEdit.tool==='vertices'&&k==='k'){e.preventDefault();setMeshActionTool(meshActionTool()==='knife'?'select':'knife');if(typeof renderMeshWorkbench==='function')renderMeshWorkbench();return;}if(state.meshEdit.tool==='weights'&&k==='p'){e.preventDefault();beginWeightPaintSession();return;}if(state.meshEdit.tool==='weights'&&k==='a'){e.preventDefault();beginWeightAdjustSession();return;}if(state.meshEdit.tool==='weights'&&['[',']'].includes(e.key)){e.preventDefault();const d=e.key==='['?-4:4;state.meshEdit.weightBrushSize=clamp((state.meshEdit.weightBrushSize||46)+d,4,180);if(typeof renderMeshWorkbench==='function')renderMeshWorkbench();renderAll();return;}if((e.key==='Delete'||e.key==='Backspace')){e.preventDefault();deleteSelected();return;}if(state.meshEdit.tool==='vertices'&&k==='f'){e.preventDefault();pushUndo();const ok=swapSlotMeshSelectedEdge(state.selected.id);if(!ok)state.undo.pop();else changed();renderAll();return;}}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='c'){e.preventDefault();if(e.shiftKey)copyPoseToClipboard();else copyCurrentKey();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'){e.preventDefault();if(e.shiftKey)pastePoseFromClipboard(true,Number($('#poseBlend')?.value||100)/100);else pasteKeyAtTime();return;}if(e.key==='Escape'&&state.meshEdit?.enabled){state.meshEdit.enabled=false;setMeshSelectedIndices([]);setTool('select');renderAll();return;}if(e.key==='1'||e.key.toLowerCase()==='v'||e.key.toLowerCase()==='q')setTool('select');if(e.key==='2'||e.key.toLowerCase()==='b')setTool('bone');if(e.key.toLowerCase()==='g'||(e.key.toLowerCase()==='w'&&!e.shiftKey))setGizmoMode('move');if(e.key.toLowerCase()==='r')setGizmoMode('rotate');if(e.key.toLowerCase()==='s')setGizmoMode('scale');if(e.key.toLowerCase()==='m'&&state.selected.type==='slot'&&state.mode!=='pose'){setMeshContext('vertices',true);}if(e.key.toLowerCase()==='w'&&e.shiftKey&&state.selected.type==='slot'&&state.mode!=='pose'){setMeshContext('weights',true);}if(e.key.toLowerCase()==='d'&&state.selected.type==='slot'&&state.mode==='pose'){setMeshContext('deform',true);}if(e.key.toLowerCase()==='h')setTool('pan');if(e.key===' '){e.preventDefault();setPlaying(!state.playing);}if(e.key==='ArrowLeft'){e.preventDefault();stepFrame(-1);}if(e.key==='ArrowRight'){e.preventDefault();stepFrame(1);}if(e.key==='Home'){e.preventDefault();goPlaybackStart();}if(e.key==='End'){e.preventDefault();goPlaybackEnd();}if(e.key==='Delete'||e.key==='Backspace')deleteSelected();if(e.key.toLowerCase()==='k')keySelected();if(e.key.toLowerCase()==='a'&&!e.ctrlKey&&!e.metaKey){selectKeysInRange(playbackRange().start,playbackRange().end,{visibleOnly:true});}if(e.key===',' )nudgeSelectedKeys(-1);if(e.key==='.' )nudgeSelectedKeys(1);if(e.key.toLowerCase()==='o'){state.onion.enabled=!state.onion.enabled;syncWorkflowControls();}});window.addEventListener('resize',()=>{sizeCanvas();renderTimeline();});
syncWorkflowControls();
