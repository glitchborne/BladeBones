'use strict';
// Skeleton, slots, attachments, markers, undo/redo.
function bone(id){return state.bones.find(b=>b.id===id)||null;}
function slot(id){return state.slots.find(s=>s.id===id)||null;}
function attachment(id){return state.attachments.find(a=>a.id===id)||null;}
function marker(id){return state.markers.find(m=>m.id===id)||null;}

function rigObject(id){return state.objects.find(o=>o.id===id)||null;}
function activeRigObject(){return rigObject(state.activeObjectId)||null;}
function objectForRootBone(rootId){return state.objects.find(o=>o.root===rootId)||null;}
function isObjectRootBone(b){return !!b&&!isProjectRootBone(b)&&(b.objectRoot===true||!!objectForRootBone(b.id));}
function objectOfBoneId(boneId){
  let b=bone(boneId);const guard=new Set();
  while(b&&!guard.has(b.id)){if(isProjectRootBone(b))return null;guard.add(b.id);if(b.objectId&&rigObject(b.objectId))return b.objectId;const o=objectForRootBone(b.id);if(o)return o.id;b=bone(b.parent);}
  return null;
}
function objectOfSlotId(slotId){const s=slot(slotId);if(!s)return null;if(s.objectId&&rigObject(s.objectId))return s.objectId;if(s.bone)return objectOfBoneId(s.bone);return state.activeObjectId||null;}
function setActiveObject(id){if(rigObject(id)){state.activeObjectId=id;state.lastObjectId=id;return true;}return false;}
function syncObjectMembership(){
  for(const o of state.objects){const r=bone(o.root);if(r){r.objectRoot=true;r.objectId=o.id;}}
  for(const b of state.bones){if(isProjectRootBone(b))continue;if(!b.objectId||!rigObject(b.objectId))b.objectId=objectOfBoneId(b.id);}
  for(const s of state.slots){if(s.bone)s.objectId=objectOfBoneId(s.bone);else if(!s.objectId||!rigObject(s.objectId))s.objectId=state.activeObjectId||state.objects[0]?.id||null;}
}
function ensureDefaultObjectForLegacy(){
  ensureProjectRoot({reparent:false});
  if(!state.objects.length){
    const root=projectRoot();
    const children=state.bones.filter(b=>!isProjectRootBone(b)&&(!b.parent||b.parent===root?.id));
    if(children.length||state.slots.length){
      const objId='obj'+state.nextObject++;
      let objRoot=children.find(b=>b.objectRoot)||children[0];
      if(!objRoot){objRoot=makeBone({name:'Object_root',parent:root?.id||null,x:0,y:0,r:0,len:32,connected:false});}
      objRoot.objectRoot=true;objRoot.objectId=objId;objRoot.name=objRoot.name||'Object_root';
      const obj={id:objId,name:'Object',root:objRoot.id,parentSlot:null,visible:true,renderLayerId:(typeof defaultRenderLayerId==='function'?defaultRenderLayerId():null)};state.objects.push(obj);
      for(const b of state.bones){if(!isProjectRootBone(b)&&b.id!==objRoot.id&&!b.objectId){b.objectId=objId;if(!b.parent||b.parent===root?.id)b.parent=objRoot.id;}}
      for(const sl of state.slots){if(!sl.objectId)sl.objectId=objId;}
      state.activeObjectId=objId;state.lastObjectId=objId;
    }
  }
  if(!state.activeObjectId&&state.objects[0])state.activeObjectId=state.objects[0].id;
  syncObjectMembership();
}
function makeRigObject(name='Object',opts={}){
  ensureProjectRoot({reparent:false});
  const objId='obj'+state.nextObject++;
  const p=opts.position||(typeof s2w==='function'&&typeof viewRect==='function'?s2w(viewRect().w/2,viewRect().h/2):{x:0,y:0});
  const rootBone=makeBone({name:(name||objId)+'_root',parent:state.projectRootId,x:Number(opts.x??p.x)||0,y:Number(opts.y??p.y)||0,r:Number(opts.r||0),len:32,sx:Number(opts.sx??1)||1,sy:Number(opts.sy??1)||1,width:16,color:'#ffcc33',moveOnly:false,connected:false});
  rootBone.objectRoot=true;rootBone.objectId=objId;rootBone.connected=false;rootBone.role='root';
  const obj={id:objId,name:name||objId,root:rootBone.id,parentSlot:null,visible:true,renderLayerId:(typeof defaultRenderLayerId==='function'?defaultRenderLayerId():null)};
  state.objects.push(obj);setActiveObject(objId);select('bone',rootBone.id);return obj;
}
function objectHasDescendantObject(objectId,targetId){
  if(objectId===targetId)return true;
  const stack=[objectId];const seen=new Set();
  while(stack.length){const id=stack.pop();if(seen.has(id))continue;seen.add(id);for(const o of state.objects){const ps=slot(o.parentSlot);const po=ps?objectOfSlotId(ps.id):null;if(po===id){if(o.id===targetId)return true;stack.push(o.id);}}}
  return false;
}
function objectRootWorld(o){const b=bone(o?.root);if(!b)return null;updateWorld(false);return{x:b.w.sx,y:b.w.sy,r:b.w.r,sx:b.w.scaleX||1,sy:b.w.scaleY||1};}
function localTransformFromBasisWorld(sw,world){
  const loc=inversePointFromBasis(slotBasisForInverse(sw),{x:world.x||0,y:world.y||0});
  return{x:loc.x,y:loc.y,r:normAngle((world.r||0)-(sw.r||0)),len:Math.max(4,world.len||32),sx:(world.sx||1)/(sw.sx||1),sy:(world.sy||1)/(sw.sy||1)};
}
function attachObjectToSlot(objectId,slotId,keepWorld=true){
  const o=rigObject(objectId),s=slot(slotId);if(!o||!s||!bone(o.root))return false;
  const parentObject=objectOfSlotId(s.id);if(parentObject&&objectHasDescendantObject(o.id,parentObject))return false;
  updateWorld(false);const root=bone(o.root);const world=keepWorld?{x:root.w.sx,y:root.w.sy,r:root.w.r,len:root.local?.len||32,sx:root.w.scaleX||1,sy:root.w.scaleY||1}:null;
  o.parentSlot=s.id;root.parent=state.projectRootId;root.connected=false;
  if(keepWorld&&world){const sw=slotWorld(s,false);root.local=localTransformFromBasisWorld(sw,world);if(state.mode!=='pose')root.rest={...root.local};}
  topoSort();syncObjectMembership();return true;
}
function detachObjectFromSlot(objectId,keepWorld=true){
  const o=rigObject(objectId);if(!o||!o.parentSlot||!bone(o.root))return false;updateWorld(false);const root=bone(o.root);const world=keepWorld?{x:root.w.sx,y:root.w.sy,r:root.w.r,len:root.local?.len||32,sx:root.w.scaleX||1,sy:root.w.scaleY||1}:null;
  o.parentSlot=null;root.parent=state.projectRootId;root.connected=false;
  if(keepWorld&&world){root.local={x:world.x,y:world.y,r:world.r,len:Math.max(4,world.len||32),sx:world.sx||1,sy:world.sy||1};if(state.mode!=='pose')root.rest={...root.local};}
  topoSort();syncObjectMembership();return true;
}
function deleteRigObject(objectId){
  const o=rigObject(objectId);if(!o)return false;const ownedSlots=new Set(state.slots.filter(s=>objectOfSlotId(s.id)===objectId).map(s=>s.id));for(const sid of ownedSlots){delete state.anim.slotTracks[sid];if(state.anim.deformTracks)delete state.anim.deformTracks[sid];}state.slots=state.slots.filter(s=>!ownedSlots.has(s.id));const root=bone(o.root);if(root)deleteBone(root.id);state.objects=state.objects.filter(x=>x.id!==objectId);for(const child of state.objects){if(child.parentSlot&&ownedSlots.has(child.parentSlot))child.parentSlot=null;}if(state.activeObjectId===objectId)state.activeObjectId=state.objects[0]?.id||null;syncObjectMembership();return true;
}
function slotsForObject(objectId){return state.slots.filter(s=>objectOfSlotId(s.id)===objectId);}
function bonesForObject(objectId){return state.bones.filter(b=>objectOfBoneId(b.id)===objectId);}
function selectedBone(){return state.selected.type==='bone'?bone(state.selected.id):null;}
function selectedSlot(){return state.selected.type==='slot'?slot(state.selected.id):null;}
function selectedMarker(){return state.selected.type==='marker'?marker(state.selected.id):null;}
function normalizeBoneSelection(){
  const out=[];const seen=new Set();
  for(const id of state.selectedBones||[]){if(!seen.has(id)&&bone(id)){seen.add(id);out.push(id);}}
  if(state.selected.type==='bone'&&state.selected.id&&bone(state.selected.id)&&!seen.has(state.selected.id)){out.push(state.selected.id);}
  state.selectedBones=out;return out;
}
function selectedBoneIds({exact=false}={}){
  const ids=normalizeBoneSelection();
  if(exact)return ids.slice();
  if(ids.length>1)return ids.slice();
  const b=selectedBone();return b?[b.id]:[];
}
function selectedBonesList(opts={}){return selectedBoneIds(opts).map(bone).filter(Boolean);}
function isBoneSelected(id){return selectedBoneIds({exact:true}).includes(id);}
function selectedBoneCount(){return selectedBoneIds({exact:true}).length;}
function clearBoneSelection(){state.selectedBones=[];}
function selectBone(id,{append=false,toggle=false}={}){
  if(!id||!bone(id)){state.selected={type:'bone',id:null};state.selectedBones=[];renderAll();return;}
  const set=new Set((state.selectedBones||[]).filter(x=>bone(x)));
  if(toggle){if(set.has(id))set.delete(id);else set.add(id);}
  else if(append){set.add(id);}
  else{set.clear();set.add(id);}
  if(!set.size)set.add(id);
  state.selectedBones=[...set];state.selected={type:'bone',id};state.lastBoneId=id;setActiveObject(objectOfBoneId(id));renderAll();
}
function selectedBoneMoveRoots(activeId=null){
  let ids=selectedBoneIds({exact:true});
  if(activeId&&(!ids.includes(activeId)||ids.length<=1))ids=[activeId];
  const set=new Set(ids);
  return ids.map(bone).filter(Boolean).filter(b=>!ids.some(id=>id!==b.id&&isDescendant(b.id,id))).filter(b=>canMoveBone(b));
}
function slotDisplayAttachment(s){return attachment(s?.pose?.attachment||s?.attachment)||null;}
function rememberLastMeshSlot(id){const s=slot(id);if(s&&slotDisplayAttachment(s))state.lastSlotId=s.id;}
function select(type,id,opts={}){
  if(type==='bone'){selectBone(id,opts);return;}
  const prev=state.selected;state.selected={type,id};state.selectedBones=[];
  if(type==='slot'&&id){rememberLastMeshSlot(id);setActiveObject(objectOfSlotId(id));}
  if(type!=='slot'||prev?.id!==id){if(state.meshEdit){state.meshEdit.selectedVerts=[];state.meshEdit.selectedEdges=[];state.meshEdit.selectedFaces=[];state.meshEdit.hoveredVert=null;state.meshEdit.hoveredEdge=null;state.meshEdit.hoveredFace=null;state.meshEdit.enabled=state.meshEdit.enabled&&type==='slot';}}renderAll();}

function pushUndo(){
  if(state.loading) return;
  state.undo.push(JSON.stringify(exportData()));
  if(state.undo.length>80) state.undo.shift();
  state.redo.length=0;
}
function undo(){if(!state.undo.length)return;const cur=JSON.stringify(exportData());const raw=state.undo.pop();state.redo.push(cur);importData(raw,true);}
function redo(){if(!state.redo.length)return;const cur=JSON.stringify(exportData());const raw=state.redo.pop();state.undo.push(cur);importData(raw,true);}

function topoSort(){
  const by=new Map(state.bones.map(b=>[b.id,b]));const out=[];const seen=new Set();
  function visit(b){if(!b||seen.has(b.id))return;visit(by.get(b.parent));seen.add(b.id);out.push(b);} state.bones.forEach(visit);state.bones=out;
}
function depth(b){let d=0,p=bone(b.parent);while(p){d++;p=bone(p.parent);}return d;}
function isDescendant(id,parent){let b=bone(id);while(b){if(b.parent===parent)return true;b=bone(b.parent);}return false;}
function children(id){return state.bones.filter(b=>b.parent===id);}

function isProjectRootBone(b){return !!b&&(b.isRoot===true||b.id===state.projectRootId);}
const MOVE_ONLY_BONE_LEN=26;
const BONE_SHAPES=['bone','cross','circleCross','square','squareCross'];
const BONE_ROLES=['deform','control','socket','root'];
function normalizeBoneShape(v){return BONE_SHAPES.includes(v)?v:'bone';}
function normalizeBoneRole(v){return BONE_ROLES.includes(v)?v:'deform';}
function inferBoneRole(b){
  if(!b)return 'deform';
  if(isProjectRootBone(b)||isObjectRootBone(b)||b.objectRoot)return 'root';
  if(b.role)return normalizeBoneRole(b.role);
  if(b.moveOnly||normalizeBoneShape(b.shape||'bone')!=='bone')return 'control';
  return 'deform';
}
function setBoneRole(bOrId,role){
  const b=typeof bOrId==='string'?bone(bOrId):bOrId;if(!b||isProjectRootBone(b))return false;
  role=normalizeBoneRole(role);
  if(isObjectRootBone(b))role='root';
  else if(role==='root')role='deform';
  b.role=role;
  if(role==='control'){b.moveOnly=!!b.moveOnly||normalizeBoneShape(b.shape||'bone')!=='bone';if(normalizeBoneShape(b.shape||'bone')==='bone')b.shape='circleCross';b.connected=false;}
  if(role==='socket'){b.moveOnly=true;b.connected=false;if(normalizeBoneShape(b.shape||'bone')==='bone')b.shape='cross';}
  if(role==='deform'){if(b.shape===undefined)b.shape='bone';}
  return true;
}
function boneAffectsWeights(b){return !!b&&!isProjectRootBone(b)&&!isObjectRootBone(b)&&inferBoneRole(b)==='deform'&&b.affectWeights!==false;}
function boneRoleLabel(b){const r=inferBoneRole(b);return {deform:'Deform',control:'Control',socket:'Socket',root:'Root'}[r]||'Deform';}
function isMoveOnlyBone(b){return !!b&&!isProjectRootBone(b)&&(b.moveOnly===true||inferBoneRole(b)==='socket');}
function boneLocks(b){return {move:!!b?.lockMove,rotate:!!b?.lockRotate,scale:!!b?.lockScale,length:!!b?.lockLength};}

function boneRoleVisibleInViewport(b){
  if(!b)return false;
  if(!state.view?.bones)return false;
  const role=isProjectRootBone(b)||isObjectRootBone(b)?'root':inferBoneRole(b);
  const roles=state.view?.boneRoles||{};
  return roles[role]!==false;
}
function boneRoleSelectableInViewport(b){
  if(!b||!boneRoleVisibleInViewport(b))return false;
  if(!state.pick?.bones)return false;
  const role=isProjectRootBone(b)||isObjectRootBone(b)?'root':inferBoneRole(b);
  const roles=state.pick?.boneRoles||{};
  return roles[role]!==false;
}
function mirroredBoneName(name){
  const next=counterpartName(String(name||'bone'));
  if(next&&next!==name)return next;
  if(/_mirror$/i.test(name))return String(name).replace(/_mirror$/i,'');
  return String(name||'bone')+'_mirror';
}
function mirrorAxisXForBone(b){
  const obj=rigObject(objectOfBoneId(b?.id)||state.activeObjectId);
  const rb=bone(obj?.root);
  updateWorld(false);
  if(rb&&!isProjectRootBone(rb))return rb.w?.sx||0;
  return 0;
}
function mirrorWorldTransformForBone(b,axisX=null){
  if(!b)return null;updateWorld(false);
  const ax=axisX===null?mirrorAxisXForBone(b):Number(axisX||0);
  return {x:2*ax-(b.w?.sx||0),y:b.w?.sy||0,r:normAngle(180-(b.w?.r||0)),len:b.local?.len||b.rest?.len||80,sx:b.local?.sx??b.rest?.sx??1,sy:b.local?.sy??b.rest?.sy??1};
}
function copyBoneRigProps(src,dst){
  if(!src||!dst)return dst;
  dst.width=Number(src.width||dst.width||12);
  dst.color=normalizeHex(src.color||dst.color||'#dddddd');
  dst.shape=normalizeBoneShape(src.shape||dst.shape||'bone');
  dst.role=normalizeBoneRole(src.role||dst.role||'deform');
  dst.moveOnly=!!src.moveOnly||dst.role==='control'||dst.role==='socket';
  dst.affectWeights=src.affectWeights!==false;
  dst.lockMove=!!src.lockMove;dst.lockRotate=!!src.lockRotate;dst.lockScale=!!src.lockScale;dst.lockLength=!!src.lockLength;
  dst.elastic=normalizeElasticSettings(JSON.parse(JSON.stringify(src.elastic||{})));
  if(dst.role==='control'||dst.role==='socket')dst.connected=false;
  return dst;
}
function matchingMirrorBone(src){
  if(!src)return null;
  const name=mirroredBoneName(src.name);
  const oid=objectOfBoneId(src.id);
  return state.bones.find(b=>b.name===name&&objectOfBoneId(b.id)===oid)||state.bones.find(b=>b.name===name)||null;
}
function mirrorBoneBranch(rootId,{branch=false}={}){
  const root=typeof rootId==='string'?bone(rootId):rootId;
  if(!root||isProjectRootBone(root)||isObjectRootBone(root))return null;
  const axisX=mirrorAxisXForBone(root);
  const ids=branch?boneSubtreeIds(root.id):[root.id];
  const idSet=new Set(ids);
  const mirrorMap=new Map();
  let last=null;
  for(const id of ids){
    const src=bone(id);if(!src||isProjectRootBone(src)||isObjectRootBone(src))continue;
    const parentSrc=bone(src.parent);
    let parentId=src.parent||state.projectRootId;
    if(parentSrc&&idSet.has(parentSrc.id)&&mirrorMap.has(parentSrc.id))parentId=mirrorMap.get(parentSrc.id);
    else if(parentSrc&&!isProjectRootBone(parentSrc)){const mp=matchingMirrorBone(parentSrc);if(mp)parentId=mp.id;}
    let dst=matchingMirrorBone(src);
    if(!dst||isDescendant(src.id,dst.id)){
      dst=makeBone({name:mirroredBoneName(src.name),parent:parentId,connected:false,role:inferBoneRole(src),moveOnly:!!src.moveOnly,shape:src.shape,width:src.width,color:src.color,len:src.local?.len||src.rest?.len||80,sx:src.local?.sx??1,sy:src.local?.sy??1});
    }else{
      dst.parent=parentId;
    }
    dst.name=mirroredBoneName(src.name);
    dst.objectId=objectOfBoneId(parentId)||src.objectId||state.activeObjectId;
    copyBoneRigProps(src,dst);
    const world=mirrorWorldTransformForBone(src,axisX);
    const parent=bone(parentId);
    const canConnect=!!(parent&&!isProjectRootBone(parent)&&isConnectedBone(src)&&!isMoveOnlyBone(dst));
    dst.parent=parentId;
    dst.connected=canConnect;
    if(canConnect){
      updateWorld(false);
      dst.local={x:0,y:0,r:normAngle(world.r-(parent.w?.r||0)),len:Math.max(4,world.len||80),sx:Number(world.sx??1)||1,sy:Number(world.sy??1)||1};
      if(state.mode!=='pose')dst.rest={...dst.local};
    }else setBoneFreeLocalFromWorld(dst,world,parentId);
    mirrorMap.set(src.id,dst.id);last=dst;
  }
  topoSort();syncObjectMembership();
  if(last){select('bone',last.id);}return last;
}

function defaultElasticSettings(){return{enabled:false,mode:'spring',preset:'Tail',stiffness:.45,damping:.65,stretch:0};}
function normalizeElasticSettings(el={}){const mode=el.mode==='rubber'?'rubber':'spring';return{...defaultElasticSettings(),...el,enabled:!!el.enabled,mode,preset:el.preset||'Tail',stiffness:clamp(Number(el.stiffness??.45),0,1),damping:clamp(Number(el.damping??.65),0,1),stretch:mode==='rubber'?clamp(Number(el.stretch??0),0,1):0};}
function isElasticBone(b){return !!b&&!isProjectRootBone(b)&&!!b.elastic?.enabled;}
function isConnectedBone(b){return !!b&&!isProjectRootBone(b)&&!isMoveOnlyBone(b)&&b.connected!==false&&!!bone(b.parent)&&!isProjectRootBone(bone(b.parent));}
function canMoveBone(b){if(!b||isProjectRootBone(b)||b.lockMove)return false;const p=bone(b.parent);return !p||isProjectRootBone(p)||!isConnectedBone(b);}
function canRotateBone(b){return !!b&&!isProjectRootBone(b)&&!isMoveOnlyBone(b)&&!b.lockRotate;}
function canScaleBone(b,key='scale'){if(!b||isProjectRootBone(b))return false;if(key==='len'||key==='length')return !b.lockLength;return !b.lockScale;}
function lockProjectRootTransform(root){
  if(!root)return null;
  const len=Math.max(4,Number(root.local?.len||root.rest?.len||70));
  root.parent=null;root.isRoot=true;root.local={x:0,y:0,r:0,len,sx:1,sy:1};root.rest={x:0,y:0,r:0,len,sx:1,sy:1};
  return root;
}
function projectRoot(){return bone(state.projectRootId);}
function makeProjectRoot(){
  const root={id:state.projectRootId,name:'project_root',parent:null,isRoot:true,connected:false,rest:{x:0,y:0,r:0,len:70,sx:1,sy:1},local:{x:0,y:0,r:0,len:70,sx:1,sy:1},width:20,color:'#ffcc33',shape:'cross',role:'root',lockMove:true,lockRotate:true,lockScale:true,lockLength:true,w:{sx:0,sy:0,ex:0,ey:0,r:0,ax:1,ay:0,bx:0,by:1,scaleX:1,scaleY:1}};
  state.bones.unshift(root);return lockProjectRootTransform(root);
}
function ensureProjectRoot({reparent=true}={}){
  let root=projectRoot();
  if(!root)root=makeProjectRoot();
  root.isRoot=true;root.parent=null;root.connected=false;root.name=root.name||'project_root';root.rest=copyTr(root.rest||root.local||{x:0,y:0,r:0,len:70});root.local=copyTr(root.local||root.rest||{x:0,y:0,r:0,len:70});root.color=normalizeHex(root.color||'#ffcc33');root.width=Number(root.width||20);root.shape=normalizeBoneShape(root.shape||'cross');root.role='root';root.lockMove=true;root.lockRotate=true;root.lockScale=true;root.lockLength=true;root.w=root.w||{sx:0,sy:0,ex:0,ey:0,r:0,ax:1,ay:0,bx:0,by:1,scaleX:1,scaleY:1};
  lockProjectRootTransform(root);
  if(reparent){for(const b of state.bones){if(b.id!==root.id&&!b.parent)b.parent=root.id;}}
  topoSort();return root;
}


function makeBone({name,parent=null,x=0,y=0,r=0,len=80,sx=1,sy=1,width=12,color,shape='bone',role=null,moveOnly=false,connected=null,elastic=null,lockMove=false,lockRotate=false,lockScale=false,lockLength=false,affectWeights=true}={}){
  if(!parent){const ao=activeRigObject();if(ao&&bone(ao.root))parent=ao.root;else if(projectRoot())parent=state.projectRootId;}
  const id='b'+state.nextBone++;const tr={x,y,r:normAngle(r),len:Math.max(4,len),sx:Number(sx)||1,sy:Number(sy)||1};
  const p=bone(parent);const useConnected=connected===null?!!(p&&!isProjectRootBone(p)&&!moveOnly):!!connected;
  const objId=parent?objectOfBoneId(parent):(state.activeObjectId||null);
  const resolvedRole=normalizeBoneRole(role||(moveOnly?'control':'deform'));
  const b={id,name:name||id,parent,objectId:objId,objectRoot:false,connected:useConnected,rest:{...tr},local:{...tr},width:Number(width)||12,color:normalizeHex(color||colors[state.bones.length%colors.length]),shape:normalizeBoneShape(shape),role:resolvedRole,moveOnly:!!moveOnly,affectWeights:affectWeights!==false,lockMove:!!lockMove,lockRotate:!!lockRotate,lockScale:!!lockScale,lockLength:!!lockLength,elastic:normalizeElasticSettings(elastic||{}),w:{sx:0,sy:0,ex:0,ey:0,r:0,ax:1,ay:0,bx:0,by:1,scaleX:1,scaleY:1}};
  if(b.moveOnly||b.role==='socket'||b.role==='control')b.connected=false;
  state.bones.push(b);topoSort();state.selected={type:'bone',id};state.selectedBones=[id];state.lastBoneId=id;return b;
}
function makeRectAttachment(name='rect',w=70,h=30,color='#888888'){
  const a={id:'a'+state.nextAtt++,name,type:'rect',w,h,pivotX:.5,pivotY:.5,color};state.attachments.push(a);return a;
}
function makeImageAttachment(name,src,naturalW,naturalH){
  const w=Math.max(1,Math.round(Number(naturalW)||1)),h=Math.max(1,Math.round(Number(naturalH)||1));
  const a={id:'a'+state.nextAtt++,name:name||('image_'+state.nextAtt),type:'image',w,h,naturalW:w,naturalH:h,pivotX:.5,pivotY:.5,src:src||'',color:'#888'};
  state.attachments.push(a);return a;
}
function imageAttachmentLooksLegacyDownscaled(att,nw,nh){
  if(!att||att.type!=='image')return false;
  nw=Math.max(1,Math.round(Number(nw)||0));nh=Math.max(1,Math.round(Number(nh)||0));
  if(Math.max(nw,nh)<=220)return false;
  const scale=Math.min(1,220/Math.max(nw,nh));
  const oldW=Math.max(1,Math.round(nw*scale)),oldH=Math.max(1,Math.round(nh*scale));
  return Math.abs(Number(att.w||0)-oldW)<=1&&Math.abs(Number(att.h||0)-oldH)<=1;
}
function rescaleSlotMeshToAttachmentPixels(s){
  const att=attachment(s?.pose?.attachment||s?.attachment);if(!s||!att)return false;
  const m=ensureSlotMesh(s);if(!m||!Array.isArray(m.vertices)||!m.vertices.length)return false;
  const x0=-(att.pivotX??.5)*att.w,y0=-(att.pivotY??.5)*att.h;
  for(const v of m.vertices){
    if(Number.isFinite(Number(v.u))&&Number.isFinite(Number(v.v))){v.x=x0+att.w*clamp(Number(v.u),0,1);v.y=y0+att.h*clamp(Number(v.v),0,1);}
  }
  return true;
}
function updateImageAttachmentNaturalSize(att,img,{force=false,restoreLegacy=true}={}){
  if(!att||att.type!=='image'||!img||!img.naturalWidth||!img.naturalHeight)return false;
  const nw=Math.max(1,Math.round(img.naturalWidth)),nh=Math.max(1,Math.round(img.naturalHeight));
  const shouldRestore=force||!att.w||!att.h||(restoreLegacy&&imageAttachmentLooksLegacyDownscaled(att,nw,nh));
  att.naturalW=nw;att.naturalH=nh;
  if(!shouldRestore)return false;
  att.w=nw;att.h=nh;
  for(const s of state.slots){
    const sid=s.pose?.attachment||s.attachment;
    if(sid===att.id)rescaleSlotMeshToAttachmentPixels(s);
  }
  return true;
}
function restoreAllImageAttachmentsToNaturalSize({legacyOnly=true}={}){
  let changedAny=false;
  for(const att of state.attachments||[]){
    if(att.type!=='image')continue;
    const img=imageCache.get(att.id)||getImage?.(att);
    if(!img||!img.complete||!img.naturalWidth)continue;
    changedAny=updateImageAttachmentNaturalSize(att,img,{force:!legacyOnly,restoreLegacy:true})||changedAny;
  }
  return changedAny;
}
function makeSlot(boneId=null,attId=null,name='slot',opts={}){
  const id='s'+state.nextSlot++;
  const local={
    x:Number(opts.x ?? (boneId?35:0)),
    y:Number(opts.y ?? 0),
    r:normAngle(Number(opts.r ?? 0)),
    sx:Number(opts.sx ?? 1)||1,
    sy:Number(opts.sy ?? 1)||1
  };
  const tint=normalizeHex(opts.tint||state.color?.defaultTint||'#ffffff'),tintAlpha=clamp(Number(opts.tintAlpha??state.color?.defaultTintAlpha??0),0,1),blendMode=opts.blendMode||state.color?.defaultBlendMode||'normal';
  const objId=boneId?objectOfBoneId(boneId):(opts.objectId||state.activeObjectId||null);
  const s={id,name:(opts.exactName?name:(name+'_'+state.nextSlot)),bone:boneId||null,objectId:objId,attachment:attId,visible:true,alpha:1,tint,tintAlpha,blendMode,local,setupLocal:{...local},mesh:null,pose:{visible:true,alpha:1,attachment:attId,tint,tintAlpha,blendMode}};ensureSlotMesh(s,true);
  state.slots.push(s);state.selected={type:'slot',id};state.lastSlotId=id;return s;
}
function makeMarker(type,boneId){
  const id='m'+state.nextMarker++;const m={id,type,name:type+'_'+state.nextMarker,bone:boneId,x:40,y:0,r:0,w:type==='hitbox'?50:8,h:type==='hitbox'?32:8,visible:true};
  state.markers.push(m);state.selected={type:'marker',id};return m;
}


function updateWorld(useRest=false){
  const by=new Map(state.bones.map(b=>[b.id,b]));const seen=new Set();const visiting=new Set();
  function compute(b){
    if(!b||seen.has(b.id))return;if(visiting.has(b.id))return;visiting.add(b.id);
    const tr=copyTr(useRest?b.rest:b.local);
    const p=by.get(b.parent);if(p)compute(p);
    const cr=Math.cos(rad(tr.r)),sr=Math.sin(rad(tr.r));
    const localAx={x:cr*(tr.sx??1),y:sr*(tr.sx??1)};
    const localBy={x:-sr*(tr.sy??1),y:cr*(tr.sy??1)};
    let origin={x:tr.x,y:tr.y};let ax=localAx,byv=localBy;
    const obj=objectForRootBone(b.id);
    if(isProjectRootBone(b)){
      origin={x:0,y:0};ax={x:1,y:0};byv={x:0,y:1};
    }else if(obj?.parentSlot&&slot(obj.parentSlot)){
      const ps=slot(obj.parentSlot);const po=rigObject(objectOfSlotId(ps?.id));if(po?.root)compute(bone(po.root));if(ps?.bone)compute(bone(ps.bone));
      const sw=slotWorld(ps,false)||{x:0,y:0,r:0,ax:1,ay:0,bx:0,by:1,sx:1,sy:1};
      const off=worldVectorFromBasis({ax:sw.ax,ay:sw.ay,bx:sw.bx,by:sw.by},tr.x,tr.y);
      origin={x:(sw.x||0)+off.x,y:(sw.y||0)+off.y};
      ax=worldVectorFromBasis({ax:sw.ax,ay:sw.ay,bx:sw.bx,by:sw.by},localAx.x,localAx.y);
      byv=worldVectorFromBasis({ax:sw.ax,ay:sw.ay,bx:sw.bx,by:sw.by},localBy.x,localBy.y);
    }else if(p){
      const base=isConnectedBone(b)&&!isProjectRootBone(p)?{x:p.w.ex,y:p.w.ey}:{x:p.w.sx,y:p.w.sy};
      const off=isConnectedBone(b)&&!isProjectRootBone(p)?{x:0,y:0}:worldVectorFromBasis(p.w,tr.x,tr.y);
      origin={x:base.x+off.x,y:base.y+off.y};
      ax=worldVectorFromBasis(p.w,localAx.x,localAx.y);
      byv=worldVectorFromBasis(p.w,localBy.x,localBy.y);
    }
    b.w=b.w||{};b.w.sx=origin.x;b.w.sy=origin.y;b.w.ax=ax.x;b.w.ay=ax.y;b.w.bx=byv.x;b.w.by=byv.y;
    b.w.scaleX=Math.hypot(ax.x,ax.y)||1;b.w.scaleY=Math.hypot(byv.x,byv.y)||1;b.w.r=normAngle(deg(Math.atan2(ax.y,ax.x)));
    b.w.ex=b.w.sx+ax.x*tr.len;b.w.ey=b.w.sy+ax.y*tr.len;
    visiting.delete(b.id);seen.add(b.id);
  }
  for(const b of state.bones)compute(b);
}
function worldVectorFromBasis(w,x,y){return{x:(w.ax??1)*x+(w.bx??0)*y,y:(w.ay??0)*x+(w.by??1)*y};}
function worldPointFromBasis(w,x,y){const v=worldVectorFromBasis(w,x,y);return{x:(w.sx||0)+v.x,y:(w.sy||0)+v.y};}
function inversePointFromBasis(w,p){const dx=(p.x||0)-(w.sx||0),dy=(p.y||0)-(w.sy||0);const ax=w.ax??1,ay=w.ay??0,bx=w.bx??0,by=w.by??1;const det=ax*by-ay*bx;if(Math.abs(det)<1e-8)return{x:dx,y:dy};return{x:(dx*by-dy*bx)/det,y:(ax*dy-ay*dx)/det};}
function rotatePoint(x,y,r){const c=Math.cos(rad(r)),s=Math.sin(rad(r));return{x:x*c-y*s,y:x*s+y*c};}

function boneLocalFromWorldStart(world,parentId=null){
  const p=bone(parentId);const root=projectRoot();
  if(p){
    updateWorld(false);
    const loc=inversePointFromBasis(p.w||{sx:0,sy:0,ax:1,ay:0,bx:0,by:1},{x:world.x||0,y:world.y||0});
    return{x:loc.x,y:loc.y,r:normAngle((world.r||0)-(p.w?.r||0)),len:Math.max(4,Number(world.len||80)),sx:Number(world.sx??1)||1,sy:Number(world.sy??1)||1};
  }
  if(root){
    const q={x:(world.x||0)-root.local.x,y:(world.y||0)-root.local.y};const loc=rotatePoint(q.x,q.y,-root.local.r);
    return{x:loc.x,y:loc.y,r:normAngle((world.r||0)-root.local.r),len:Math.max(4,Number(world.len||80)),sx:Number(world.sx??1)||1,sy:Number(world.sy??1)||1};
  }
  return{x:Number(world.x||0),y:Number(world.y||0),r:normAngle(Number(world.r||0)),len:Math.max(4,Number(world.len||80)),sx:Number(world.sx??1)||1,sy:Number(world.sy??1)||1};
}
function setBoneFreeLocalFromWorld(b,world,parentId=b?.parent){
  if(!b)return false;const loc=boneLocalFromWorldStart(world,parentId);
  b.local={x:loc.x,y:loc.y,r:loc.r,len:loc.len,sx:loc.sx??1,sy:loc.sy??1};
  if(state.mode!=='pose')b.rest={...b.local};
  return true;
}
function reparentBoneKeepWorld(bOrId,parentId,{connected='auto'}={}){
  const b=typeof bOrId==='string'?bone(bOrId):bOrId;if(!b||isProjectRootBone(b)||isObjectRootBone(b))return false;
  const nextParent=parentId||null;if(nextParent===b.id||isDescendant(nextParent,b.id))return false;
  updateWorld(false);const world={x:b.w.sx,y:b.w.sy,r:b.w.r,len:b.local?.len||b.rest?.len||80,sx:b.local?.sx??b.rest?.sx??1,sy:b.local?.sy??b.rest?.sy??1};const p=bone(nextParent);
  let useConnected=false;
  if(connected==='auto'){
    useConnected=!!(p&&!isProjectRootBone(p)&&!isMoveOnlyBone(b)&&dist(world,{x:p.w.ex,y:p.w.ey})<=10/Math.max(.25,state.camera?.z||1));
  }else useConnected=!!(connected&&p&&!isProjectRootBone(p)&&!isMoveOnlyBone(b));
  b.parent=nextParent;b.connected=useConnected;
  if(useConnected){
    b.local={x:0,y:0,r:normAngle(world.r-p.w.r),len:Math.max(4,Number(world.len||80)),sx:Number(world.sx??b.local?.sx??1)||1,sy:Number(world.sy??b.local?.sy??1)||1};
    if(state.mode!=='pose')b.rest={...b.local};
  }else setBoneFreeLocalFromWorld(b,world,nextParent);
  topoSort();return true;
}
function setBoneConnectedKeepWorld(bOrId,connected){
  const b=typeof bOrId==='string'?bone(bOrId):bOrId;if(!b||isProjectRootBone(b))return false;
  const p=bone(b.parent);if(!p||isProjectRootBone(p)||isMoveOnlyBone(b)){b.connected=false;return false;}
  updateWorld(false);const world={x:b.w.sx,y:b.w.sy,r:b.w.r,len:b.local?.len||b.rest?.len||80,sx:b.local?.sx??b.rest?.sx??1,sy:b.local?.sy??b.rest?.sy??1};
  b.connected=!!connected;
  if(b.connected){b.local={x:0,y:0,r:normAngle(world.r-p.w.r),len:Math.max(4,Number(world.len||80)),sx:Number(world.sx??b.local?.sx??1)||1,sy:Number(world.sy??b.local?.sy??1)||1};if(state.mode!=='pose')b.rest={...b.local};}
  else setBoneFreeLocalFromWorld(b,world,b.parent);
  topoSort();return true;
}

function slotWorld(s,doUpdate=true){
  const l=s.local||{x:0,y:0,r:0,sx:1,sy:1};
  const b=bone(s.bone);
  const cr=Math.cos(rad(Number(l.r||0))),sr=Math.sin(rad(Number(l.r||0)));
  const lsx=Number(l.sx??1)||1,lsy=Number(l.sy??1)||1;
  if(doUpdate)updateWorld(false);
  let base=null;
  if(b)base=b.w||{sx:0,sy:0,ax:1,ay:0,bx:0,by:1,r:0,scaleX:1,scaleY:1};
  else{
    const o=rigObject(s.objectId);const rb=bone(o?.root);
    if(rb&&!isProjectRootBone(rb))base=rb.w||{sx:0,sy:0,ax:1,ay:0,bx:0,by:1,r:0,scaleX:1,scaleY:1};
  }
  if(!base){return{x:Number(l.x||0),y:Number(l.y||0),r:normAngle(Number(l.r||0)),sx:lsx,sy:lsy,ax:cr*lsx,ay:sr*lsx,bx:-sr*lsy,by:cr*lsy,world:true};}
  const off=worldVectorFromBasis(base,Number(l.x||0),Number(l.y||0));
  const ax=worldVectorFromBasis(base,cr*lsx,sr*lsx);
  const by=worldVectorFromBasis(base,-sr*lsy,cr*lsy);
  return{x:(base.sx||0)+off.x,y:(base.sy||0)+off.y,r:normAngle(deg(Math.atan2(ax.y,ax.x))),sx:Math.hypot(ax.x,ax.y)||1,sy:Math.hypot(by.x,by.y)||1,ax:ax.x,ay:ax.y,bx:by.x,by:by.y,world:!b&&!base};
}
function markerWorld(m){const b=bone(m.bone);if(!b)return null;updateWorld(false);const base=b.w||{sx:0,sy:0,r:0,ax:1,ay:0,bx:0,by:1};const off=worldVectorFromBasis(base,m.x,m.y);return{x:(base.sx||0)+off.x,y:(base.sy||0)+off.y,r:normAngle((base.r||0)+m.r)};}


function slotLocalFromWorld(sw,boneId){
  const b=bone(boneId);if(!b)return{x:sw.x,y:sw.y,r:normAngle(sw.r||0),sx:sw.sx||1,sy:sw.sy||1};
  updateWorld(false);
  const loc=inversePointFromBasis(b.w,{x:sw.x,y:sw.y});
  return{x:loc.x,y:loc.y,r:normAngle((sw.r||0)-(b.w.r||0)),sx:(sw.sx||1)/(b.w.scaleX||1),sy:(sw.sy||1)/(b.w.scaleY||1)};
}
function bindSlotToBone(slotId,boneId,keepWorld=true){
  const s=slot(slotId),b=bone(boneId);if(!s||!b)return false;
  updateWorld(false);
  const sw=keepWorld?slotWorld(s):null;
  s.bone=b.id;s.objectId=objectOfBoneId(b.id);
  if(sw)s.local=slotLocalFromWorld(sw,b.id);
  return true;
}
function unbindSlot(slotId,keepWorld=true){
  const s=slot(slotId);if(!s)return false;
  updateWorld(false);
  const sw=keepWorld?slotWorld(s):null;
  s.bone=null;s.objectId=s.objectId||state.activeObjectId||null;
  if(sw){const o=rigObject(s.objectId);const rb=bone(o?.root);if(rb){const inv=inversePointFromBasis(rb.w,{x:sw.x,y:sw.y});s.local={x:inv.x,y:inv.y,r:normAngle((sw.r||0)-(rb.w.r||0)),sx:(sw.sx||1)/(rb.w.scaleX||1),sy:(sw.sy||1)/(rb.w.scaleY||1)};}else s.local={x:sw.x,y:sw.y,r:normAngle(sw.r||0),sx:sw.sx||1,sy:sw.sy||1};}
  return true;
}

function migrateLegacySlotBindingToMeshWeights(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;
  if(!s||!s.bone||!bone(s.bone)||isProjectRootBone(bone(s.bone)))return false;
  // v9.1: s.bone is no longer an obsolete whole-slot bind. It is the slot's
  // parent bone, DragonBones-style. Keep it visible in the rig hierarchy.
  // If an older project already had mesh rendering enabled but no vertex
  // weights, seed rigid 100% weights to preserve the old visual result.
  const m=ensureSlotMesh(s);if(!m||!m.vertices?.length)return false;
  const hasWeights=m.vertices.some(v=>Array.isArray(v.weights)&&v.weights.length);
  if(m.enabled===true&&!hasWeights)bindSlotMeshVerticesToBone(s,s.bone,m.vertices.map((_,i)=>i),'replace',1);
  return true;
}

function slotParentBoneId(sOrId){const s=typeof sOrId==='string'?slot(sOrId):sOrId;return s&&s.bone&&bone(s.bone)?s.bone:null;}
function slotInfluenceBoneIds(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;const m=ensureSlotMesh(s);const ids=new Set();
  if(!m||!Array.isArray(m.vertices))return[];
  for(const v of m.vertices)for(const w of (v.weights||[])){if(w?.bone&&bone(w.bone))ids.add(w.bone);}
  return[...ids];
}
function slotHasVertexWeights(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;const m=ensureSlotMesh(s);
  return !!(m&&Array.isArray(m.vertices)&&m.vertices.some(v=>Array.isArray(v.weights)&&v.weights.length));
}
function meshUnweightedVertexIndices(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;const m=ensureSlotMesh(s);
  if(!m||!Array.isArray(m.vertices))return[];
  return m.vertices.map((v,i)=>Array.isArray(v.weights)&&v.weights.length?null:i).filter(i=>i!==null);
}
function meshInvalidWeightBoneIds(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;const m=ensureSlotMesh(s);const ids=new Set();
  if(!m||!Array.isArray(m.vertices))return[];
  for(const v of m.vertices)for(const w of (v.weights||[])){if(w?.bone&&!bone(w.bone))ids.add(w.bone);}
  return[...ids];
}
function slotBindingIssues(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;if(!s)return[{severity:'warn',code:'missing',message:'Slot data is missing.'}];
  const issues=[];const parent=slotParentBoneId(s);const m=ensureSlotMesh(s);const verts=m?.vertices||[];const weighted=verts.filter(v=>Array.isArray(v.weights)&&v.weights.length);const unweighted=meshUnweightedVertexIndices(s);
  if(!slotDisplayAttachment(s))issues.push({severity:'warn',code:'no-attachment',message:'No image/attachment assigned.'});
  if(!parent)issues.push({severity:'warn',code:'no-parent',message:'No Parent Bone. Set a parent so the slot is visible under the rig hierarchy.'});
  if(m?.enabled&&verts.length&&!weighted.length)issues.push({severity:'warn',code:'no-weights',message:'Mesh is enabled but no vertices have weights. Use “Bind all to parent” or “Auto bind selected bones”.'});
  if(m?.enabled&&weighted.length&&unweighted.length)issues.push({severity:'warn',code:'mixed-weights',message:`${unweighted.length} unweighted vertex/vertices. Mixed weights can leave part of the image rigid or unexpected.`});
  const bad=meshInvalidWeightBoneIds(s);if(bad.length)issues.push({severity:'warn',code:'bad-bone',message:`${bad.length} missing bone reference(s) in weights.`});
  return issues;
}


// v10.17 Deformation Diagnostics helpers.
function finiteNumber(n){return Number.isFinite(Number(n));}
function meshWeightSum(v){return (v?.weights||[]).reduce((a,w)=>a+Math.max(0,Number(w.w||0)),0);}
function meshDiagnosticVertexSets(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;
  const raw=(s?.mesh&&Array.isArray(s.mesh.vertices))?s.mesh:null;
  const m=raw||ensureSlotMesh(s);const max=Math.max(1,Number(state.meshEdit?.maxInfluences||4));
  const sets={unweighted:[],tooMany:[],badBone:[],missingBind:[],overweight:[],partial:[]};
  if(!s||!m||!Array.isArray(m.vertices))return sets;
  for(let i=0;i<m.vertices.length;i++){
    const v=m.vertices[i],ws=Array.isArray(v?.weights)?v.weights.filter(Boolean):[];
    const positive=ws.filter(w=>Number(w.w??w.weight??0)>0);
    const sum=positive.reduce((a,w)=>a+Math.max(0,Number(w.w??w.weight??0)||0),0);
    if(!positive.length){sets.unweighted.push(i);continue;}
    if(positive.length>max)sets.tooMany.push(i);
    if(positive.some(w=>!w.bone||!bone(w.bone)))sets.badBone.push(i);
    if(positive.some(w=>!finiteNumber(w.x)||!finiteNumber(w.y)))sets.missingBind.push(i);
    if(sum>1.0001)sets.overweight.push(i);
    if(sum>0&&sum<.999&&positive.length>1)sets.partial.push(i);
  }
  return sets;
}
function meshDeformMismatchDetails(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;const m=ensureSlotMesh(s);const expected=m?.vertices?.length||0;const items=[];
  if(!s||!m)return items;
  if(s.deform&&Array.isArray(s.deform.offsets)&&s.deform.offsets.length!==expected)items.push({scope:'current pose',count:s.deform.offsets.length,expected});
  for(const clip of slotAnimationClipsForTopology()){
    const keys=clip?.deformTracks?.[s.id]||[];
    for(let ki=0;ki<keys.length;ki++){const k=keys[ki];if(Array.isArray(k.offsets)&&k.offsets.length!==expected)items.push({scope:(clip.name||clip.id||'clip')+' key '+ki,count:k.offsets.length,expected});}
  }
  return items;
}
function meshDiagnosticsForSlot(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;const sets=meshDiagnosticVertexSets(s);const m=ensureSlotMesh(s);const issues=[];
  if(!s||!m)return{ok:false,issues:[{severity:'warn',code:'missing-slot',message:'Slot or mesh is missing.'}],sets,counts:{}};
  const topo=meshTopologyIssues(s).map(it=>({...it,code:'topology'}));
  issues.push(...topo);
  if(m.enabled&&sets.unweighted.length)issues.push({severity:'warn',code:'unweighted',message:`${sets.unweighted.length} unweighted vertex/vertices.`});
  if(sets.tooMany.length)issues.push({severity:'warn',code:'too-many-influences',message:`${sets.tooMany.length} vertex/vertices exceed max influences (${state.meshEdit?.maxInfluences||4}).`});
  if(sets.badBone.length)issues.push({severity:'warn',code:'bad-bone-ref',message:`${sets.badBone.length} vertex/vertices reference missing or invalid bones.`});
  if(sets.missingBind.length)issues.push({severity:'warn',code:'missing-bind',message:`${sets.missingBind.length} vertex/vertices have missing bind coordinates.`});
  if(sets.overweight.length)issues.push({severity:'warn',code:'overweight',message:`${sets.overweight.length} vertex/vertices have total weight above 100%.`});
  const dm=meshDeformMismatchDetails(s);if(dm.length)issues.push({severity:'warn',code:'deform-offsets',message:`${dm.length} deform offset block(s) do not match vertex count.`});
  const counts={verts:m.vertices.length,triangles:(m.triangles||[]).length,edges:(m.edges||[]).length,unweighted:sets.unweighted.length,tooMany:sets.tooMany.length,badBone:sets.badBone.length,missingBind:sets.missingBind.length,overweight:sets.overweight.length,deformMismatches:dm.length};
  return{ok:issues.filter(i=>i.severity!=='info').length===0,issues,sets,deformMismatches:dm,counts};
}
function meshDiagnosticProblemVertexIndices(sOrId){
  const sets=meshDiagnosticVertexSets(sOrId);const out=new Set();
  for(const key of ['unweighted','tooMany','badBone','missingBind','overweight'])for(const i of sets[key]||[])out.add(i);
  return[...out].sort((a,b)=>a-b);
}
function fixSlotMeshUnweightedVertices(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;
  const ids=meshUnweightedVertexIndices(s);if(!ids.length)return false;
  const candidates=allMeshCandidateBoneIds(s.id);const parent=slotParentBoneId(s);
  if(candidates.length)return autoBindSlotMesh(s,candidates,ids);
  if(parent)return bindSlotMeshVerticesToBone(s,parent,ids,'replace',1);
  return false;
}
function pruneSlotMeshBadInfluences(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;let changed=false;const max=Math.max(1,Number(state.meshEdit?.maxInfluences||4));
  for(let i=0;i<m.vertices.length;i++){
    const v=m.vertices[i];const before=JSON.stringify(v.weights||[]);
    v.weights=(v.weights||[]).filter(w=>w&&w.bone&&bone(w.bone)&&Number(w.w)>0);
    if((v.weights||[]).length>max)pruneVertexWeights(v,max);else sanitizeVertexWeights(v);
    if(JSON.stringify(v.weights||[])!==before)changed=true;
  }
  if(changed)ensureMeshTopology(m);return changed;
}
function fixSlotMeshDeformOffsets(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;const expected=m.vertices.length;let changed=false;
  const fix=offs=>{if(!Array.isArray(offs))return false;let dirty=false;while(offs.length<expected){offs.push({x:0,y:0});dirty=true;}if(offs.length>expected){offs.length=expected;dirty=true;}for(const o of offs){if(!finiteNumber(o.x)){o.x=0;dirty=true;}if(!finiteNumber(o.y)){o.y=0;dirty=true;}}return dirty;};
  if(!s.deform||!Array.isArray(s.deform.offsets)){s.deform={offsets:makeZeroDeformOffsets(expected)};changed=true;}else changed=fix(s.deform.offsets)||changed;
  for(const clip of slotAnimationClipsForTopology())for(const k of clip?.deformTracks?.[s.id]||[])if(k&&Array.isArray(k.offsets))changed=fix(k.offsets)||changed;
  return changed;
}
function rebuildSlotMeshBindCoordinates(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;let n=0;
  for(let i=0;i<m.vertices.length;i++){if((m.vertices[i].weights||[]).length){rebindSlotMeshVertexWeights(s,i,{normalize:false});n++;}}
  return n>0;
}
function fixSlotMeshDiagnostics(slotId,kind='all'){
  const s=typeof slotId==='string'?slot(slotId):slotId;if(!s)return false;let ok=false;
  if(kind==='all'||kind==='unweighted')ok=fixSlotMeshUnweightedVertices(s)||ok;
  if(kind==='all'||kind==='prune')ok=pruneSlotMeshBadInfluences(s)||ok;
  if(kind==='all'||kind==='bind')ok=rebuildSlotMeshBindCoordinates(s)||ok;
  if(kind==='all'||kind==='deform')ok=fixSlotMeshDeformOffsets(s)||ok;
  ensureMeshTopology(ensureSlotMesh(s));return ok;
}
function testPoseHealthSummary(slotId=null){
  const st=deformationTestStats();const slots=slotId?[slot(slotId)].filter(Boolean):(state.slots||[]);let affected=0,unweighted=0,bad=0;
  const movedInfluenceIds=new Set();
  if(rigTestPoseActive()){
    const snap=state.rig?.testPose?.snapshot;const bmap=new Map((snap?.bones||[]).map(r=>[r.id,r.local]));
    for(const b of state.bones||[]){if(isProjectRootBone(b))continue;const base=bmap.get(b.id)||b.rest||{},a=b.local||{};if(Math.abs((a.x||0)-(base.x||0))>.001||Math.abs((a.y||0)-(base.y||0))>.001||Math.abs(normAngle((a.r||0)-(base.r||0)))>.001||Math.abs((a.len||0)-(base.len||0))>.001||Math.abs(Number(a.sx??1)-Number(base.sx??1))>.001||Math.abs(Number(a.sy??1)-Number(base.sy??1))>.001)movedInfluenceIds.add(b.id);}
  }
  for(const s of slots){const d=meshDiagnosticsForSlot(s);unweighted+=d.counts.unweighted||0;bad+=d.issues.filter(i=>i.severity!=='info').length;const inf=slotInfluenceBoneIds(s);if(inf.some(id=>movedInfluenceIds.has(id)))affected++;}
  return{...st,affectedSlots:affected,unweightedVertices:unweighted,issueCount:bad};
}
function slotBindingStatus(sOrId){
  const s=typeof sOrId==='string'?slot(sOrId):sOrId;if(!s)return{kind:'missing',label:'Missing',detail:'slot missing',severity:'warn'};
  const parent=slotParentBoneId(s);const m=ensureSlotMesh(s);const verts=m?.vertices||[];
  const weighted=verts.filter(v=>Array.isArray(v.weights)&&v.weights.length);const influences=slotInfluenceBoneIds(s);
  const allWeighted=verts.length>0&&weighted.length===verts.length;
  const unweighted=meshUnweightedVertexIndices(s);
  const onlyParent=!!parent&&allWeighted&&influences.length===1&&influences[0]===parent&&weighted.every(v=>{const w=v.weights[0];return Math.abs(Number(w.w??1)-1)<.001;});
  if(!parent&&!weighted.length)return{kind:'unbound',label:'Unbound',detail:'no parent bone / no weights',severity:'warn'};
  if(parent&&m?.enabled&&verts.length&&!weighted.length)return{kind:'meshNoWeights',label:'Mesh no weights',detail:'mesh enabled, but vertices are not bound',severity:'warn'};
  if(parent&&!m?.enabled&&!weighted.length)return{kind:'rigid',label:'Rigid',detail:'slot follows parent bone',severity:'ok'};
  if(parent&&!weighted.length)return{kind:'rigid',label:'Rigid',detail:'slot follows parent bone',severity:'ok'};
  if(parent&&onlyParent)return{kind:'rigidMesh',label:'Rigid mesh',detail:'all vertices 100% parent',severity:'ok'};
  if(parent&&allWeighted)return{kind:'weighted',label:'Weighted',detail:influences.length+' influence bone(s)',severity:'ok'};
  if(!parent&&weighted.length)return{kind:'weightedNoParent',label:'Weighted / no parent',detail:'vertices weighted, slot has no parent bone',severity:'warn'};
  return{kind:'mixed',label:'Mixed',detail:weighted.length+'/'+verts.length+' vertices weighted; '+unweighted.length+' unweighted',severity:'warn'};
}
function setSlotParentBone(slotId,boneId,keepWorld=true){return boneId?bindSlotToBone(slotId,boneId,keepWorld):unbindSlot(slotId,keepWorld);}
function bindSlotMeshAllToParent(slotId){const s=typeof slotId==='string'?slot(slotId):slotId;const bid=slotParentBoneId(s);if(!s||!bid)return false;const m=ensureSlotMesh(s);if(!m)return false;m.enabled=true;return bindSlotMeshVerticesToBone(s,bid,m.vertices.map((_,i)=>i),'replace',1);}
function makeSlotRigidToParent(slotId){const s=typeof slotId==='string'?slot(slotId):slotId;const bid=slotParentBoneId(s);if(!s||!bid)return false;const m=ensureSlotMesh(s);if(m)m.enabled=false;return true;}


const MESH_FORMAT_VERSION=3;
function meshEdgeKey(a,b){a=parseInt(a,10);b=parseInt(b,10);return a<b?a+','+b:b+','+a;}
function meshParseEdgeKey(key){const parts=String(key).split(',').map(n=>parseInt(n,10));return Number.isFinite(parts[0])&&Number.isFinite(parts[1])?parts:null;}
function meshTriangleIsValid(mesh,tri){return Array.isArray(tri)&&tri.length===3&&tri.every(i=>Number.isInteger(i)&&i>=0&&i<(mesh?.vertices?.length||0))&&new Set(tri).size===3;}
function meshCleanTriangles(mesh){
  if(!mesh)return[];const seen=new Set(),out=[];
  for(const raw of mesh.triangles||[]){
    const tri=(raw||[]).map(i=>parseInt(i,10));
    if(!meshTriangleIsValid(mesh,tri))continue;
    const key=[...tri].sort((a,b)=>a-b).join(',');
    if(seen.has(key))continue;seen.add(key);out.push(tri);
  }
  mesh.triangles=out;return out;
}
function rebuildMeshEdgesFromTriangles(mesh){
  if(!mesh||!Array.isArray(mesh.vertices))return[];meshCleanTriangles(mesh);
  const map=new Map();
  for(const tri of mesh.triangles||[]){
    for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],key=meshEdgeKey(a,b);const rec=map.get(key)||{a:Math.min(a,b),b:Math.max(a,b),triangles:0};rec.triangles++;map.set(key,rec);}
  }
  mesh.edges=[...map.values()].sort((x,y)=>x.a-y.a||x.b-y.b).map(e=>[e.a,e.b]);return mesh.edges;
}
function meshBoundaryEdges(mesh){
  if(!mesh)return[];meshCleanTriangles(mesh);const map=new Map();
  for(const tri of mesh.triangles||[]){for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3],key=meshEdgeKey(a,b);const rec=map.get(key)||{a,b,count:0};rec.count++;map.set(key,rec);}}
  return [...map.values()].filter(e=>e.count===1).map(e=>[e.a,e.b]);
}
function rebuildMeshHullFromTriangles(mesh){
  const boundary=meshBoundaryEdges(mesh);const verts=mesh?.vertices||[];if(!verts.length){mesh.hull=[];return mesh.hull;}
  if(!boundary.length){mesh.hull=verts.map((_,i)=>i);return mesh.hull;}
  const adj=new Map();
  for(const [a,b] of boundary){if(!adj.has(a))adj.set(a,[]);if(!adj.has(b))adj.set(b,[]);adj.get(a).push(b);adj.get(b).push(a);}
  let start=boundary[0][0];
  for(const i of adj.keys()){const v=verts[i],s=verts[start];if(v&&s&&(v.y<s.y||(v.y===s.y&&v.x<s.x)))start=i;}
  const out=[start];let prev=null,cur=start;
  for(let guard=0;guard<verts.length+boundary.length+4;guard++){
    const nexts=(adj.get(cur)||[]).filter(n=>n!==prev);let next=nexts[0];
    if(next===undefined)next=(adj.get(cur)||[])[0];
    if(next===undefined||next===start)break;
    if(out.includes(next))break;
    out.push(next);prev=cur;cur=next;
  }
  mesh.hull=out.length>=3?out:verts.map((_,i)=>i);return mesh.hull;
}
function ensureMeshTopology(mesh){
  if(!mesh||!Array.isArray(mesh.vertices))return mesh;
  mesh.version=MESH_FORMAT_VERSION;
  mesh.vertices.forEach(v=>{v.x=Number(v.x||0);v.y=Number(v.y||0);const uu=Number(v.u??0),vv=Number(v.v??0);v.u=clamp(Number.isFinite(uu)?uu:0,0,1);v.v=clamp(Number.isFinite(vv)?vv:0,0,1);if(!Array.isArray(v.weights))v.weights=[];sanitizeVertexWeights(v);});
  if(!Array.isArray(mesh.triangles))mesh.triangles=[];meshCleanTriangles(mesh);
  rebuildMeshEdgesFromTriangles(mesh);rebuildMeshHullFromTriangles(mesh);
  if(!Array.isArray(mesh.selected))mesh.selected=[];
  if(mesh.bindPoseVersion===undefined)mesh.bindPoseVersion=1;
  mesh.dirtyTopology=false;
  return mesh;
}
function meshEdgeTriangleCount(mesh,a,b){
  if(!mesh)return 0;const key=meshEdgeKey(a,b);let n=0;
  for(const tri of mesh.triangles||[])for(let k=0;k<3;k++)if(meshEdgeKey(tri[k],tri[(k+1)%3])===key)n++;
  return n;
}
function meshEdgeExists(mesh,a,b){return meshEdgeTriangleCount(mesh,a,b)>0;}
function meshSelectedEdges(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return[];
  const out=[];const seen=new Set();
  for(const raw of state.meshEdit?.selectedEdges||[]){
    const pair=Array.isArray(raw)?raw:meshParseEdgeKey(raw);if(!pair)continue;
    const a=pair[0],b=pair[1];if(!meshEdgeExists(m,a,b))continue;
    const key=meshEdgeKey(a,b);if(!seen.has(key)){seen.add(key);out.push([a,b]);}
  }
  if(out.length)return out;
  const ids=meshSelectedIndices(s);if(ids.length>=2){
    for(let x=0;x<ids.length;x++)for(let y=x+1;y<ids.length;y++){const a=ids[x],b=ids[y];if(meshEdgeExists(m,a,b)){const key=meshEdgeKey(a,b);if(!seen.has(key)){seen.add(key);out.push([a,b]);}}}
  }
  return out;
}
function meshSelectedEdge(slotId){return meshSelectedEdges(slotId)[0]||null;}
function setMeshSelectedEdges(edges){
  const s=selectedSlot(),m=s?ensureSlotMesh(s):null;const keys=[],verts=[];
  for(const raw of edges||[]){const pair=Array.isArray(raw)?raw:meshParseEdgeKey(raw);if(!pair)continue;const a=pair[0],b=pair[1];if(m&&!meshEdgeExists(m,a,b))continue;keys.push(meshEdgeKey(a,b));verts.push(a,b);}
  state.meshEdit.selectedEdges=[...new Set(keys)];state.meshEdit.selectedFaces=[];setMeshSelectedIndices([...new Set(verts)],{preserveEdges:true});
}
function meshSelectedFaces(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return[];
  const out=[];const seen=new Set();
  for(const i of state.meshEdit?.selectedFaces||[]){const n=parseInt(i,10);if(Number.isInteger(n)&&n>=0&&n<(m.triangles||[]).length&&!seen.has(n)){seen.add(n);out.push(n);}}
  return out;
}
function setMeshSelectedFaces(indices){
  const s=selectedSlot(),m=s?ensureSlotMesh(s):null;const faces=[],verts=[];
  for(const i of indices||[]){const n=parseInt(i,10);if(!m||!Number.isInteger(n)||n<0||n>=(m.triangles||[]).length)continue;faces.push(n);verts.push(...m.triangles[n]);}
  state.meshEdit.selectedFaces=[...new Set(faces)];state.meshEdit.selectedEdges=[];setMeshSelectedIndices([...new Set(verts)],{preserveFaces:true});
}
function meshAllEdgeKeys(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return[];ensureMeshTopology(m);
  return (m.edges||[]).map(e=>meshEdgeKey(e[0],e[1]));
}
function meshAllFaceIndices(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return[];return (m.triangles||[]).map((_,i)=>i);
}
function selectAllMeshElements(slotId,mode=meshSelectionMode()){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return false;
  if(mode==='edge'){setMeshSelectedEdges(meshAllEdgeKeys(s));return true;}
  if(mode==='face'){setMeshSelectedFaces(meshAllFaceIndices(s));return true;}
  setMeshSelectedIndices(m.vertices.map((_,i)=>i));return true;
}
function invertMeshSelection(slotId,mode=meshSelectionMode()){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return false;
  if(mode==='edge'){const cur=new Set((state.meshEdit.selectedEdges||[]).map(String));setMeshSelectedEdges(meshAllEdgeKeys(s).filter(k=>!cur.has(k)));return true;}
  if(mode==='face'){const cur=new Set(meshSelectedFaces(s));setMeshSelectedFaces(meshAllFaceIndices(s).filter(i=>!cur.has(i)));return true;}
  const cur=new Set(meshSelectedIndices(s));setMeshSelectedIndices(m.vertices.map((_,i)=>i).filter(i=>!cur.has(i)));return true;
}
function clearMeshElementSelection(){state.meshEdit.selectedVerts=[];state.meshEdit.selectedEdges=[];state.meshEdit.selectedFaces=[];const s=selectedSlot();const m=s?ensureSlotMesh(s):null;if(m)m.selected=[];}
function meshSelectionMode(){return ['vertex','edge','face'].includes(state.meshEdit?.selectionMode)?state.meshEdit.selectionMode:'vertex';}
function setMeshSelectionMode(mode){state.meshEdit.selectionMode=['edge','face'].includes(mode)?mode:'vertex';state.meshEdit.actionTool='select';clearMeshElementSelection();renderAll();}
function meshActionTool(){return ['select','knife'].includes(state.meshEdit?.actionTool)?state.meshEdit.actionTool:'select';}
function setMeshActionTool(tool){state.meshEdit.actionTool=tool==='knife'?'knife':'select';state.meshEdit.knifePath=[];renderAll();}
function meshSelectedFace(slotId){const ids=meshSelectedFaces(slotId);return ids.length?ids[0]:null;}
function meshBoundaryVertexIndices(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return[];
  ensureMeshTopology(m);return Array.isArray(m.hull)&&m.hull.length?m.hull:meshBoundaryEdges(m).flat().filter((v,i,a)=>a.indexOf(v)===i);
}
function meshTopologyIssues(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=(s?.mesh&&Array.isArray(s.mesh.vertices))?s.mesh:ensureSlotMesh(s);if(!m)return[];const issues=[];
  const before=(m.triangles||[]).length;const clean=meshCleanTriangles(m).length;
  if(before!==clean)issues.push({severity:'warn',message:`mesh had ${before-clean} invalid/duplicate triangle(s)`});
  if(m.enabled&&m.vertices.length>=3&&!m.triangles.length)issues.push({severity:'warn',message:'mesh is enabled but has no triangles'});
  const used=new Set((m.triangles||[]).flat());const loose=m.vertices.map((_,i)=>i).filter(i=>!used.has(i));
  if(m.enabled&&loose.length)issues.push({severity:'info',message:`${loose.length} loose mesh vertex/vertices not used by triangles`});
  if(!Array.isArray(m.edges)||!m.edges.length)rebuildMeshEdgesFromTriangles(m);
  if(!Array.isArray(m.hull)||!m.hull.length)rebuildMeshHullFromTriangles(m);
  return issues;
}
function interpolatedVertexWeightsForPoint(s,baseVertex,items){
  const accum=new Map();
  for(const it of items||[]){const v=it?.v,fac=Number(it?.f||0);if(!v||fac<=0)continue;for(const w of v.weights||[]){if(!w?.bone)continue;const cur=accum.get(w.bone)||0;accum.set(w.bone,cur+Number(w.w||0)*fac);}}
  const weights=[];updateWorld(false);const p=slotMeshBaseVertexWorld(s,baseVertex);
  for(const [boneId,ww] of accum.entries()){
    const b=bone(boneId);if(!b||ww<=0)continue;const loc=inversePointFromBasis(b.w,p);weights.push({bone:boneId,w:ww,x:loc.x,y:loc.y});
  }
  const tmp={weights};normalizeVertexWeights(tmp,true);pruneVertexWeights(tmp,state.meshEdit?.maxInfluences||4);return tmp.weights||[];
}
function interpolateMeshVertex(s,a,b,t=.5){
  const m=ensureSlotMesh(s);const va=m?.vertices?.[a],vb=m?.vertices?.[b];if(!va||!vb)return null;t=clamp(Number(t),0,1);
  const v={x:Number(va.x||0)*(1-t)+Number(vb.x||0)*t,y:Number(va.y||0)*(1-t)+Number(vb.y||0)*t,u:Number(va.u||0)*(1-t)+Number(vb.u||0)*t,v:Number(va.v||0)*(1-t)+Number(vb.v||0)*t,weights:[]};
  v.weights=interpolatedVertexWeightsForPoint(s,v,[{v:va,f:1-t},{v:vb,f:t}]);return v;
}
function averageMeshVertex(s,a,b){return interpolateMeshVertex(s,a,b,.5);}
function barycentricWeights2D(p,a,b,c){
  const den=((b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y))||1e-9;
  const wa=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den;
  const wb=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den;
  return{a:wa,b:wb,c:1-wa-wb};
}
function meshVertexFromFacePoint(s,faceIndex,localPoint){
  const m=ensureSlotMesh(s),tri=m?.triangles?.[faceIndex];if(!m||!tri)return null;
  const va=m.vertices[tri[0]],vb=m.vertices[tri[1]],vc=m.vertices[tri[2]];if(!va||!vb||!vc)return null;
  const bc=barycentricWeights2D(localPoint,va,vb,vc);const weights=[bc.a,bc.b,bc.c].map(x=>Number.isFinite(x)?x:0);
  const v={x:Number(localPoint.x||0),y:Number(localPoint.y||0),u:Number(va.u||0)*weights[0]+Number(vb.u||0)*weights[1]+Number(vc.u||0)*weights[2],v:Number(va.v||0)*weights[0]+Number(vb.v||0)*weights[1]+Number(vc.v||0)*weights[2],weights:[]};
  v.u=clamp(v.u,0,1);v.v=clamp(v.v,0,1);v.weights=interpolatedVertexWeightsForPoint(s,v,[{v:va,f:weights[0]},{v:vb,f:weights[1]},{v:vc,f:weights[2]}]);return v;
}
function slotAnimationClipsForTopology(){const list=[];if(state.anim)list.push(state.anim);for(const c of state.animations||[])if(c&&!list.includes(c))list.push(c);return list;}
function insertSlotMeshDeformVertexWeighted(slotId,index,items){
  const s=typeof slotId==='string'?slot(slotId):slotId;const apply=offs=>{if(!Array.isArray(offs))return;let x=0,y=0,total=0;for(const it of items||[]){const o=offs[it.i]||{x:0,y:0},f=Number(it.f||0);x+=Number(o.x||0)*f;y+=Number(o.y||0)*f;total+=f;}if(total>0){x/=total;y/=total;}offs.splice(index,0,{x,y});};
  if(s?.deform?.offsets)apply(s.deform.offsets);
  for(const clip of slotAnimationClipsForTopology())for(const k of clip?.deformTracks?.[s?.id]||[])apply(k.offsets);
}
function insertSlotMeshDeformVertex(slotId,index,a,b,t=.5){insertSlotMeshDeformVertexWeighted(slotId,index,[{i:a,f:1-t},{i:b,f:t}]);}
function removeSlotMeshDeformVertex(slotId,removeIndex,mergeIntoIndex=null){
  const s=typeof slotId==='string'?slot(slotId):slotId;const apply=offs=>{if(!Array.isArray(offs)||removeIndex<0||removeIndex>=offs.length)return;if(mergeIntoIndex!==null&&mergeIntoIndex>=0&&mergeIntoIndex<offs.length&&mergeIntoIndex!==removeIndex){const a=offs[mergeIntoIndex]||{x:0,y:0},b=offs[removeIndex]||{x:0,y:0};offs[mergeIntoIndex]={x:(Number(a.x||0)+Number(b.x||0))/2,y:(Number(a.y||0)+Number(b.y||0))/2};}offs.splice(removeIndex,1);};
  if(s?.deform?.offsets)apply(s.deform.offsets);
  for(const clip of slotAnimationClipsForTopology())for(const k of clip?.deformTracks?.[s?.id]||[])apply(k.offsets);
}
function triangleWithEdgeSplit(tri,a,b,n){
  const posA=tri.indexOf(a),posB=tri.indexOf(b);if(posA<0||posB<0)return[tri];const c=tri.find(i=>i!==a&&i!==b);
  const forward=(posB===(posA+1)%3);return forward?[[a,n,c],[n,b,c]]:[[b,n,c],[n,a,c]];
}
function splitSlotMeshEdge(slotId,a,b,t=.5){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m||!meshEdgeExists(m,a,b))return false;t=clamp(Number(t),0,1);
  const v=interpolateMeshVertex(s,a,b,t);if(!v)return false;const n=m.vertices.length;m.vertices.push(v);
  const key=meshEdgeKey(a,b),next=[];for(const tri of m.triangles||[]){let has=false;for(let k=0;k<3;k++)if(meshEdgeKey(tri[k],tri[(k+1)%3])===key)has=true;if(has)next.push(...triangleWithEdgeSplit(tri,a,b,n));else next.push(tri);}m.triangles=next;insertSlotMeshDeformVertex(s,n,a,b,t);ensureMeshTopology(m);state.meshEdit.selectionMode='vertex';setMeshSelectedIndices([n]);return true;
}
function splitSlotMeshSelectedEdge(slotId){const s=typeof slotId==='string'?slot(slotId):slotId;const e=meshSelectedEdge(s);return e?splitSlotMeshEdge(s,e[0],e[1],.5):false;}
function insertSlotMeshFaceVertex(slotId,faceIndex,worldPoint){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);const tri=m?.triangles?.[faceIndex];if(!s||!m||!tri)return false;
  const local=slotLocalPointFromWorld(s,worldPoint);const v=meshVertexFromFacePoint(s,faceIndex,local);if(!v)return false;const n=m.vertices.length;m.vertices.push(v);
  const bc=barycentricWeights2D(local,m.vertices[tri[0]],m.vertices[tri[1]],m.vertices[tri[2]]);
  m.triangles.splice(faceIndex,1,orientTri(m,[tri[0],tri[1],n]),orientTri(m,[tri[1],tri[2],n]),orientTri(m,[tri[2],tri[0],n]));
  insertSlotMeshDeformVertexWeighted(s,n,[{i:tri[0],f:bc.a},{i:tri[1],f:bc.b},{i:tri[2],f:bc.c}]);ensureMeshTopology(m);state.meshEdit.selectionMode='vertex';setMeshSelectedIndices([n]);return true;
}
function meshSegmentIntersection2D(p0,p1,a,b,eps=1e-6){
  const rx=p1.x-p0.x,ry=p1.y-p0.y,sx=b.x-a.x,sy=b.y-a.y;
  const den=rx*sy-ry*sx;if(Math.abs(den)<eps)return null;
  const qx=a.x-p0.x,qy=a.y-p0.y;
  const lineT=(qx*sy-qy*sx)/den;
  const edgeT=(qx*ry-qy*rx)/den;
  if(lineT<-eps||lineT>1+eps||edgeT<=eps||edgeT>=1-eps)return null;
  return{lineT:clamp(lineT,0,1),edgeT:clamp(edgeT,0,1)};
}
function appendSlotMeshInterpolatedVertexOnEdge(slotId,a,b,t=.5){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return null;
  const n=m.vertices.length;const v=interpolateMeshVertex(s,a,b,t);if(!v)return null;
  m.vertices.push(v);insertSlotMeshDeformVertex(s,n,a,b,t);return n;
}
function meshKnifeCollectLineCuts(slotId,startWorld,endWorld){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return{cuts:[],edgeHits:new Map()};
  const p0=slotLocalPointFromWorld(s,startWorld),p1=slotLocalPointFromWorld(s,endWorld);
  if(Math.hypot(p1.x-p0.x,p1.y-p0.y)<1e-4)return{cuts:[],edgeHits:new Map()};
  ensureMeshTopology(m);const cuts=[],edgeHits=new Map();
  for(let ti=0;ti<(m.triangles||[]).length;ti++){
    const tri=m.triangles[ti];if(!meshTriangleIsValid(m,tri))continue;
    const localHits=new Map();
    for(let k=0;k<3;k++){
      const ea=tri[k],eb=tri[(k+1)%3],va=m.vertices[ea],vb=m.vertices[eb];if(!va||!vb)continue;
      const h=meshSegmentIntersection2D(p0,p1,va,vb);if(!h)continue;
      const lo=Math.min(ea,eb),hi=Math.max(ea,eb),key=meshEdgeKey(lo,hi),tFromLo=ea===lo?h.edgeT:1-h.edgeT;
      const rec={key,a:lo,b:hi,t:tFromLo,lineT:h.lineT,triA:ea,triB:eb};
      localHits.set(key,rec);
    }
    let hits=[...localHits.values()].sort((a,b)=>a.lineT-b.lineT);
    if(hits.length>2)hits=[hits[0],hits[hits.length-1]];
    if(hits.length===2&&hits[0].key!==hits[1].key){
      cuts.push({triIndex:ti,hits});
      for(const h of hits){
        const prev=edgeHits.get(h.key);
        // Shared triangles should compute the same edge t. Average tiny numeric differences.
        if(prev){prev.t=(prev.t+h.t)/2;prev.lineT=(prev.lineT+h.lineT)/2;}
        else edgeHits.set(h.key,{...h});
      }
    }
  }
  return{cuts,edgeHits};
}
function triangulateKnifePolygon(mesh,poly,out){
  const clean=[];for(const i of poly){if(Number.isInteger(i)&&!clean.includes(i))clean.push(i);}if(clean.length<3)return;
  if(clean.length===3){out.push(orientTri(mesh,clean));return;}
  for(let i=1;i<clean.length-1;i++)out.push(orientTri(mesh,[clean[0],clean[i],clean[i+1]]));
}
function splitTriangleByKnifeHits(mesh,tri,hits){
  const out=[];if(!tri||hits.length!==2)return[tri];
  const hitByEdge=new Map(hits.map(h=>[h.key,h]));const ring=[];
  for(let i=0;i<3;i++){
    const a=tri[i],b=tri[(i+1)%3];ring.push(a);
    const h=hitByEdge.get(meshEdgeKey(a,b));if(h&&Number.isInteger(h.n))ring.push(h.n);
  }
  const n0=hits[0].n,n1=hits[1].n,i0=ring.indexOf(n0),i1=ring.indexOf(n1);
  if(i0<0||i1<0||i0===i1)return[tri];
  const a=Math.min(i0,i1),b=Math.max(i0,i1);
  const polyA=ring.slice(a,b+1);
  const polyB=ring.slice(b).concat(ring.slice(0,a+1));
  triangulateKnifePolygon(mesh,polyA,out);triangulateKnifePolygon(mesh,polyB,out);
  return out.length?out:[tri];
}
function knifeCutSlotMeshByWorldLine(slotId,startWorld,endWorld){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;
  const plan=meshKnifeCollectLineCuts(s,startWorld,endWorld);if(!plan.cuts.length||plan.edgeHits.size<2)return false;
  for(const h of plan.edgeHits.values()){h.n=appendSlotMeshInterpolatedVertexOnEdge(s,h.a,h.b,h.t);}
  const cutByTri=new Map();for(const c of plan.cuts){const hits=c.hits.map(h=>plan.edgeHits.get(h.key)).filter(h=>Number.isInteger(h?.n));if(hits.length===2)cutByTri.set(c.triIndex,hits);}
  if(!cutByTri.size)return false;
  const next=[];for(let ti=0;ti<(m.triangles||[]).length;ti++){const tri=m.triangles[ti];const hits=cutByTri.get(ti);if(hits)next.push(...splitTriangleByKnifeHits(m,tri,hits));else next.push(tri);}m.triangles=next;ensureMeshTopology(m);
  const cutEdges=[];const cutVerts=new Set();for(const hits of cutByTri.values()){const a=hits[0].n,b=hits[1].n;if(meshEdgeExists(m,a,b))cutEdges.push(meshEdgeKey(a,b));cutVerts.add(a);cutVerts.add(b);}
  if(cutEdges.length){state.meshEdit.selectionMode='edge';setMeshSelectedEdges([...new Set(cutEdges)]);}else{state.meshEdit.selectionMode='vertex';setMeshSelectedIndices([...cutVerts]);}
  state.meshEdit.actionTool='knife';state.meshEdit.knifePath=[];return true;
}
function remapTriangleIndex(i,removeIndex,mergeIndex){if(i===removeIndex)return mergeIndex;return i>removeIndex?i-1:i;}
function collapseSlotMeshEdge(slotId,a,b){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m||m.vertices.length<=3||!meshEdgeExists(m,a,b))return false;
  const keep=Math.min(a,b),remove=Math.max(a,b);const merged=averageMeshVertex(s,keep,remove);if(!merged)return false;m.vertices[keep]=merged;
  const tris=[];for(const tri of m.triangles||[]){const t=tri.map(i=>remapTriangleIndex(i,remove,keep));if(new Set(t).size===3)tris.push(t);}m.vertices.splice(remove,1);m.triangles=tris;removeSlotMeshDeformVertex(s,remove,keep);ensureMeshTopology(m);setMeshSelectedIndices([keep]);return true;
}
function collapseSlotMeshSelectedEdge(slotId){const s=typeof slotId==='string'?slot(slotId):slotId;const e=meshSelectedEdge(s);return e?collapseSlotMeshEdge(s,e[0],e[1]):false;}
function orientTri(mesh,tri){
  const v=tri.map(i=>mesh.vertices[i]);if(v.some(x=>!x))return tri;const area=(v[1].x-v[0].x)*(v[2].y-v[0].y)-(v[1].y-v[0].y)*(v[2].x-v[0].x);return area<0?[tri[0],tri[2],tri[1]]:tri;
}
function swapSlotMeshEdge(slotId,a,b){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;const key=meshEdgeKey(a,b);const pair=[],rest=[];
  for(const tri of m.triangles||[]){let has=false;for(let k=0;k<3;k++)if(meshEdgeKey(tri[k],tri[(k+1)%3])===key)has=true;if(has)pair.push(tri);else rest.push(tri);}
  if(pair.length!==2)return false;const c=pair[0].find(i=>i!==a&&i!==b),d=pair[1].find(i=>i!==a&&i!==b);if(c===undefined||d===undefined||c===d||meshEdgeExists({triangles:rest,vertices:m.vertices},c,d))return false;
  m.triangles=[...rest,orientTri(m,[c,d,a]),orientTri(m,[d,c,b])];ensureMeshTopology(m);setMeshSelectedIndices([c,d]);return true;
}
function swapSlotMeshSelectedEdge(slotId){const s=typeof slotId==='string'?slot(slotId):slotId;const e=meshSelectedEdge(s);return e?swapSlotMeshEdge(s,e[0],e[1]):false;}
function rebuildSlotMeshTopology(slotId){const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return false;ensureMeshTopology(m);return true;}
function selectSlotMeshBoundary(slotId){const ids=meshBoundaryVertexIndices(slotId);setMeshSelectedIndices(ids);return ids;}
function selectedMeshElementSummary(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;return{verts:meshSelectedIndices(s),edges:meshSelectedEdges(s),faces:meshSelectedFaces(s)};
}
function deleteSlotMeshVertices(slotId,indices){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;const dead=new Set((indices||[]).map(i=>parseInt(i,10)).filter(i=>Number.isInteger(i)&&i>=0&&i<m.vertices.length));if(!dead.size||m.vertices.length-dead.size<3)return false;
  const map=new Map();const verts=[];for(let i=0;i<m.vertices.length;i++){if(dead.has(i))continue;map.set(i,verts.length);verts.push(m.vertices[i]);}
  const tris=[];for(const tri of m.triangles||[]){if(tri.some(i=>dead.has(i)))continue;const t=tri.map(i=>map.get(i));if(t.every(i=>Number.isInteger(i))&&new Set(t).size===3)tris.push(t);}if(!tris.length)return false;
  m.vertices=verts;m.triangles=tris;[...dead].sort((a,b)=>b-a).forEach(i=>removeSlotMeshDeformVertex(s,i));ensureMeshTopology(m);clearMeshElementSelection();return true;
}
function deleteSlotMeshEdges(slotId,edges){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;const dead=new Set((edges||[]).map(e=>Array.isArray(e)?meshEdgeKey(e[0],e[1]):String(e)));
  if(!dead.size)return false;const next=[];for(const tri of m.triangles||[]){let remove=false;for(let k=0;k<3;k++)if(dead.has(meshEdgeKey(tri[k],tri[(k+1)%3])))remove=true;if(!remove)next.push(tri);}if(next.length===(m.triangles||[]).length||!next.length)return false;m.triangles=next;ensureMeshTopology(m);clearMeshElementSelection();return true;
}
function deleteSlotMeshFaces(slotId,faces){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;const dead=new Set((faces||[]).map(i=>parseInt(i,10)).filter(i=>Number.isInteger(i)&&i>=0&&i<(m.triangles||[]).length));
  if(!dead.size||m.triangles.length-dead.size<1)return false;m.triangles=m.triangles.filter((_,i)=>!dead.has(i));ensureMeshTopology(m);clearMeshElementSelection();return true;
}
function compactSlotMeshLooseVertices(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;const used=new Set((m.triangles||[]).flat());
  const dead=m.vertices.map((_,i)=>i).filter(i=>!used.has(i));if(!dead.length)return false;
  const map=new Map(),verts=[];for(let i=0;i<m.vertices.length;i++){if(dead.includes(i))continue;map.set(i,verts.length);verts.push(m.vertices[i]);}
  m.triangles=(m.triangles||[]).map(tri=>tri.map(i=>map.get(i))).filter(tri=>tri.every(i=>Number.isInteger(i))&&new Set(tri).size===3);m.vertices=verts;
  dead.sort((a,b)=>b-a).forEach(i=>removeSlotMeshDeformVertex(s,i));ensureMeshTopology(m);clearMeshElementSelection();return true;
}
function deleteSelectedMeshElements(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;if(!s)return false;const mode=meshSelectionMode();
  if(mode==='face')return deleteSlotMeshFaces(s,meshSelectedFaces(s));
  if(mode==='edge')return deleteSlotMeshEdges(s,meshSelectedEdges(s));
  return deleteSlotMeshVertices(s,meshSelectedIndices(s));
}
function weldSelectedMeshVertices(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;const ids=meshSelectedIndices(s).sort((a,b)=>a-b);if(ids.length<2||m.vertices.length-ids.length+1<3)return false;
  const keep=ids[0],set=new Set(ids),items=ids.map(i=>({v:m.vertices[i],f:1/ids.length}));
  const v={x:0,y:0,u:0,v:0,weights:[]};for(const i of ids){const q=m.vertices[i];v.x+=Number(q.x||0)/ids.length;v.y+=Number(q.y||0)/ids.length;v.u+=Number(q.u||0)/ids.length;v.v+=Number(q.v||0)/ids.length;}v.weights=interpolatedVertexWeightsForPoint(s,v,items);m.vertices[keep]=v;
  const remove=ids.filter(i=>i!==keep).sort((a,b)=>b-a);for(const ri of remove){const remap=i=>i===ri?keep:(i>ri?i-1:i);m.triangles=m.triangles.map(tri=>tri.map(remap)).filter(tri=>new Set(tri).size===3);m.vertices.splice(ri,1);removeSlotMeshDeformVertex(s,ri,keep);}ensureMeshTopology(m);state.meshEdit.selectionMode='vertex';setMeshSelectedIndices([keep]);return true;
}

function defaultMeshForAttachment(att,enabled=false){
  if(!att)return ensureMeshTopology({enabled:!!enabled,version:MESH_FORMAT_VERSION,vertices:[],triangles:[],edges:[],hull:[],selected:[],dirtyTopology:false,bindPoseVersion:1});
  const x0=-(att.pivotX??.5)*att.w,y0=-(att.pivotY??.5)*att.h;
  return ensureMeshTopology({enabled:!!enabled,version:MESH_FORMAT_VERSION,vertices:[
    {x:x0,y:y0,u:0,v:0,weights:[]},{x:x0+att.w,y:y0,u:1,v:0,weights:[]},{x:x0+att.w,y:y0+att.h,u:1,v:1,weights:[]},{x:x0,y:y0+att.h,u:0,v:1,weights:[]}
  ],triangles:[[0,1,2],[0,2,3]],edges:[[0,1],[1,2],[0,2],[2,3],[0,3]],hull:[0,1,2,3],selected:[],gridCols:1,gridRows:1,dirtyTopology:false,bindPoseVersion:1});
}
function ensureSlotMesh(s,force=false){
  if(!s)return null;const att=attachment(s.pose?.attachment||s.attachment);
  const keepEnabled=s.mesh?.enabled===true;
  if(force||!s.mesh||!Array.isArray(s.mesh.vertices)||s.mesh.vertices.length<4){s.mesh=defaultMeshForAttachment(att,keepEnabled);return s.mesh;}
  if(s.mesh.enabled===undefined)s.mesh.enabled=false;
  if(!Array.isArray(s.mesh.selected))s.mesh.selected=[];
  const x0=att?-(att.pivotX??.5)*att.w:0,y0=att?-(att.pivotY??.5)*att.h:0,w=att?att.w:1,h=att?att.h:1;
  for(const v of s.mesh.vertices){
    v.x=Number(v.x||0);v.y=Number(v.y||0);
    if(!Array.isArray(v.weights))v.weights=[];
    if(v.u===undefined)v.u=w?((Number(v.x||0)-x0)/w):0;
    if(v.v===undefined)v.v=h?((Number(v.y||0)-y0)/h):0;
    v.u=clamp(Number(v.u)||0,0,1);v.v=clamp(Number(v.v)||0,0,1);
    sanitizeVertexWeights(v);
  }
  if(!Array.isArray(s.mesh.triangles)||!s.mesh.triangles.length)s.mesh.triangles=[[0,1,2],[0,2,3]];
  return ensureMeshTopology(s.mesh);
}
function makeSlotMeshGrid(slotId,cols=2,rows=2){
  const s=typeof slotId==='string'?slot(slotId):slotId;const att=attachment(s?.pose?.attachment||s?.attachment);if(!s||!att)return false;
  cols=clamp(parseInt(cols,10)||1,1,12);rows=clamp(parseInt(rows,10)||1,1,12);
  const keepEnabled=s.mesh?.enabled===true;const x0=-(att.pivotX??.5)*att.w,y0=-(att.pivotY??.5)*att.h;
  const vertices=[];
  for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++)vertices.push({x:x0+att.w*x/cols,y:y0+att.h*y/rows,u:x/cols,v:y/rows,weights:[]});
  const triangles=[];const rowStride=cols+1;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*rowStride+x;triangles.push([i,i+1,i+rowStride+1],[i,i+rowStride+1,i+rowStride]);}
  s.mesh=ensureMeshTopology({enabled:keepEnabled,version:MESH_FORMAT_VERSION,vertices,triangles,edges:[],hull:[],selected:[],gridCols:cols,gridRows:rows,dirtyTopology:false,bindPoseVersion:1});
  state.meshEdit.selectedVerts=[];state.meshEdit.selectedEdges=[];state.meshEdit.selectedFaces=[];
  return s.mesh;
}
function slotBasisForInverse(sw){return{sx:sw.x||0,sy:sw.y||0,ax:sw.ax??1,ay:sw.ay??0,bx:sw.bx??0,by:sw.by??1};}
function slotMeshBaseVertexWorld(s,v){
  const sw=slotWorld(s);if(!sw||!v)return{x:0,y:0};
  return{x:(sw.x||0)+(sw.ax??1)*Number(v.x||0)+(sw.bx??0)*Number(v.y||0),y:(sw.y||0)+(sw.ay??0)*Number(v.x||0)+(sw.by??1)*Number(v.y||0)};
}
function slotLocalPointFromWorld(s,p){const sw=slotWorld(s);if(!sw)return{x:p.x||0,y:p.y||0};return inversePointFromBasis(slotBasisForInverse(sw),p);}
function compactVertexWeights(v,eps=.001){
  if(!v||!Array.isArray(v.weights))return v;
  const merged=new Map();
  for(const w of v.weights){
    if(!w||!w.bone)continue;
    const ww=Number(w.w??w.weight??0);
    if(!Number.isFinite(ww)||ww<=eps)continue;
    const cur=merged.get(w.bone);const bx=Number(w.x),by=Number(w.y);
    if(cur){cur.w+=ww;if(!finiteNumber(cur.x)&&finiteNumber(bx))cur.x=bx;if(!finiteNumber(cur.y)&&finiteNumber(by))cur.y=by;}
    else merged.set(w.bone,{bone:w.bone,w:ww,x:Number.isFinite(bx)?bx:undefined,y:Number.isFinite(by)?by:undefined});
  }
  v.weights=[...merged.values()].sort((a,b)=>Number(b.w||0)-Number(a.w||0));
  return v;
}
function sanitizeVertexWeights(v){
  compactVertexWeights(v,0);
  const sum=(v?.weights||[]).reduce((a,w)=>a+Number(w.w||0),0);
  // v10.12: preserve partial sums <= 1 because the remainder means
  // implicit rest/unassigned weight. Only normalize malformed data above 100%.
  if(sum>1.0001)normalizeVertexWeights(v,false);
  return v;
}
function rebindSlotMeshVertexWeights(s,index,opts={}){
  const m=(s?.mesh&&Array.isArray(s.mesh.vertices))?s.mesh:ensureSlotMesh(s);if(!m)return false;const v=m.vertices[index];if(!v||!Array.isArray(v.weights)||!v.weights.length)return false;
  updateWorld(false);const p=slotMeshBaseVertexWorld(s,v);
  for(const w of v.weights){const b=bone(w.bone);if(!b)continue;const loc=inversePointFromBasis(b.w,p);w.x=loc.x;w.y=loc.y;}
  if(opts.normalize===false)compactVertexWeights(v);else normalizeVertexWeights(v,true);
  return true;
}
function updateSlotMeshVertexUVFromLocal(s,v){
  const att=attachment(s?.pose?.attachment||s?.attachment);if(!att||!v)return false;
  const x0=-(att.pivotX??.5)*att.w,y0=-(att.pivotY??.5)*att.h;
  v.u=clamp(att.w?((Number(v.x||0)-x0)/att.w):0,0,1);
  v.v=clamp(att.h?((Number(v.y||0)-y0)/att.h):0,0,1);
  return true;
}
function setSlotMeshVertexLocal(s,index,x,y,{rebind=true,updateUV=false}={}){
  const m=ensureSlotMesh(s);if(!m||!m.vertices[index])return false;const v=m.vertices[index];
  v.x=Number(x)||0;v.y=Number(y)||0;
  if(updateUV)updateSlotMeshVertexUVFromLocal(s,v);
  if(rebind)rebindSlotMeshVertexWeights(s,index);return true;
}
function setSlotMeshVertexWorld(s,index,p,opts={}){const loc=slotLocalPointFromWorld(s,p);return setSlotMeshVertexLocal(s,index,loc.x,loc.y,{rebind:true,...opts});}
function normalizeVertexWeights(v,prune=true){
  if(!v||!Array.isArray(v.weights))return v;const merged=new Map();
  for(const w of v.weights){if(!w||!w.bone)continue;const ww=Number(w.w??w.weight??0);if(!Number.isFinite(ww)||ww<=0)continue;const cur=merged.get(w.bone);const next={bone:w.bone,w:ww,x:Number(w.x||0),y:Number(w.y||0)};if(cur){cur.w+=ww;}else merged.set(w.bone,next);}
  let arr=[...merged.values()];if(prune)arr=arr.filter(w=>w.w>.001);let sum=arr.reduce((a,w)=>a+w.w,0);if(sum<=0){v.weights=[];return v;}for(const w of arr)w.w=w.w/sum;v.weights=arr;return v;
}
function pruneVertexWeights(v,max=4){if(!v||!Array.isArray(v.weights))return;v.weights.sort((a,b)=>Number(b.w||0)-Number(a.w||0));v.weights=v.weights.slice(0,Math.max(1,max));normalizeVertexWeights(v,true);}
function meshSelectedIndices(s){const m=ensureSlotMesh(s);if(!m)return[];const arr=state.meshEdit?.selectedVerts?.length?state.meshEdit.selectedVerts:m.selected||[];return arr.filter(i=>i>=0&&i<m.vertices.length);}
function setMeshSelectedIndices(indices,opts={}){
  state.meshEdit.selectedVerts=[...new Set((indices||[]).map(i=>parseInt(i,10)).filter(Number.isFinite))];
  if(!opts.preserveEdges)state.meshEdit.selectedEdges=[];
  if(!opts.preserveFaces)state.meshEdit.selectedFaces=[];
  const s=selectedSlot();const m=s?ensureSlotMesh(s):null;if(m)m.selected=[...state.meshEdit.selectedVerts];
}

function makeZeroDeformOffsets(count){return Array.from({length:Math.max(0,count||0)},()=>({x:0,y:0}));}
function ensureSlotDeformPose(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return null;
  if(!s.deform||!Array.isArray(s.deform.offsets))s.deform={offsets:makeZeroDeformOffsets(m.vertices.length)};
  while(s.deform.offsets.length<m.vertices.length)s.deform.offsets.push({x:0,y:0});
  if(s.deform.offsets.length>m.vertices.length)s.deform.offsets.length=m.vertices.length;
  for(const o of s.deform.offsets){o.x=Number(o.x||0);o.y=Number(o.y||0);}return s.deform;
}
function clearSlotDeformPose(slotId){const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;s.deform={offsets:makeZeroDeformOffsets(m.vertices.length)};return true;}
function slotDeformOffset(slotId,index){const s=typeof slotId==='string'?slot(slotId):slotId;const d=ensureSlotDeformPose(s);return d?.offsets?.[index]||{x:0,y:0};}
function setSlotDeformOffset(slotId,index,x,y){const s=typeof slotId==='string'?slot(slotId):slotId;const d=ensureSlotDeformPose(s);if(!d||!d.offsets[index])return false;d.offsets[index]={x:Number(x)||0,y:Number(y)||0};return true;}
function slotMeshVertexWorldNoDeform(s,v){
  const sw=slotWorld(s);if(!v)return sw;
  const rest=slotMeshBaseVertexWorld(s,v);
  if(v.weights&&v.weights.length){
    let x=0,y=0,total=0;updateWorld(false);
    for(const w of v.weights){const b=bone(w.bone);if(!b)continue;const ww=Math.max(0,Number(w.w??1));if(!ww)continue;const p=worldPointFromBasis(b.w,Number(w.x||0),Number(w.y||0));x+=p.x*ww;y+=p.y*ww;total+=ww;}
    if(total>1.0001)return{x:x/total,y:y/total};
    if(total>0){const restWeight=Math.max(0,1-total);return{x:x+rest.x*restWeight,y:y+rest.y*restWeight};}
  }
  return rest;
}
function slotDeformVectorWorld(s,index){const off=slotDeformOffset(s,index);const sw=slotWorld(s);if(!sw)return{x:0,y:0};return worldVectorFromBasis(sw,Number(off.x||0),Number(off.y||0));}
function cloneSlotDeformOffsets(slotId){const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);const d=ensureSlotDeformPose(s);return (d?.offsets||makeZeroDeformOffsets(m?.vertices?.length||0)).map(o=>({x:Number(o.x||0),y:Number(o.y||0)}));}
function currentSlotDeformHasAny(slotId,eps=.001){return cloneSlotDeformOffsets(slotId).some(o=>Math.abs(o.x)>eps||Math.abs(o.y)>eps);}
function slotMeshVertexWorld(s,v,index=0){
  const base=slotMeshVertexWorldNoDeform(s,v);
  const dv=slotDeformVectorWorld(s,index);
  return{x:(base?.x||0)+dv.x,y:(base?.y||0)+dv.y};
}
function slotMeshWorldVertices(s){const m=ensureSlotMesh(s);if(!m||!m.vertices.length)return[];return m.vertices.map((v,i)=>slotMeshVertexWorld(s,v,i));}
function bindSlotMeshVerticesToBone(slotId,boneId,indices,mode='replace',weight=1){
  const s=typeof slotId==='string'?slot(slotId):slotId,b=bone(boneId);if(!s||!b||isProjectRootBone(b))return false;updateWorld(false);const m=ensureSlotMesh(s);if(!m)return false;m.enabled=true;
  const list=indices&&indices.length?indices:m.vertices.map((_,i)=>i);
  for(const i of list){const v=m.vertices[i];if(!v)continue;const p=slotMeshBaseVertexWorld(s,v);const loc=inversePointFromBasis(b.w,p);const inf={bone:b.id,w:clamp(Number(weight)||1,0,1),x:loc.x,y:loc.y};
    if(mode==='add'){v.weights=(v.weights||[]).filter(w=>w.bone!==b.id);v.weights.push(inf);normalizeVertexWeights(v,true);pruneVertexWeights(v,state.meshEdit?.maxInfluences||4);}
    else v.weights=[{...inf,w:1}];
  }
  return true;
}
function removeSlotMeshBoneInfluence(slotId,boneId,indices){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return false;const list=indices&&indices.length?indices:m.vertices.map((_,i)=>i);
  for(const i of list){const v=m.vertices[i];if(!v)continue;v.weights=(v.weights||[]).filter(w=>w.bone!==boneId);normalizeVertexWeights(v,true);}return true;
}
function slotMeshTopIndices(s){const m=ensureSlotMesh(s);if(!m)return[];const ys=m.vertices.map(v=>Number(v.y||0));const mid=(Math.min(...ys)+Math.max(...ys))/2;return m.vertices.map((v,i)=>Number(v.y||0)<=mid?i:null).filter(i=>i!==null);}
function slotMeshBottomIndices(s){const m=ensureSlotMesh(s);if(!m)return[];const ys=m.vertices.map(v=>Number(v.y||0));const mid=(Math.min(...ys)+Math.max(...ys))/2;return m.vertices.map((v,i)=>Number(v.y||0)>mid?i:null).filter(i=>i!==null);}
function slotMeshLeftIndices(s){const m=ensureSlotMesh(s);if(!m)return[];const xs=m.vertices.map(v=>Number(v.x||0));const mid=(Math.min(...xs)+Math.max(...xs))/2;return m.vertices.map((v,i)=>Number(v.x||0)<=mid?i:null).filter(i=>i!==null);}
function slotMeshRightIndices(s){const m=ensureSlotMesh(s);if(!m)return[];const xs=m.vertices.map(v=>Number(v.x||0));const mid=(Math.min(...xs)+Math.max(...xs))/2;return m.vertices.map((v,i)=>Number(v.x||0)>mid?i:null).filter(i=>i!==null);}
function clearSlotMeshWeights(slotId){const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return false;for(const v of m.vertices)v.weights=[];return true;}
function boneSubtreeIds(rootId){const out=[];function walk(id){const b=bone(id);if(!b||isProjectRootBone(b))return;out.push(id);for(const c of children(id))walk(c.id);}walk(rootId);return out;}
function allMeshCandidateBoneIds(slotId=null){
  const s=slotId?slot(slotId):selectedSlot();
  const objectId=s?objectOfSlotId(s.id):state.activeObjectId;
  return state.bones.filter(b=>boneAffectsWeights(b)&&(!objectId||objectOfBoneId(b.id)===objectId)).map(b=>b.id);
}
function autoBindSlotMesh(slotId,boneIds=null,indices=null){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return false;updateWorld(false);
  const ids=(boneIds&&boneIds.length?boneIds:allMeshCandidateBoneIds(s.id)).filter(id=>boneAffectsWeights(bone(id))); 
  if(!ids.length)return false;m.enabled=true;const list=indices&&indices.length?indices:m.vertices.map((_,i)=>i);
  for(const i of list){const v=m.vertices[i];if(!v)continue;const p=slotMeshBaseVertexWorld(s,v);const scored=ids.map(id=>{const b=bone(id);const d=segDist(p,{x:b.w.sx,y:b.w.sy},{x:b.w.ex,y:b.w.ey});return{id,b,d,score:1/Math.pow(Math.max(1,d),2)};}).sort((a,b)=>a.d-b.d).slice(0,state.meshEdit?.maxInfluences||4);
    let sum=scored.reduce((a,o)=>a+o.score,0)||1;v.weights=scored.map(o=>{const loc=inversePointFromBasis(o.b.w,p);return{bone:o.id,w:o.score/sum,x:loc.x,y:loc.y};});normalizeVertexWeights(v,true);}
  return true;
}
function smoothSlotMeshWeights(slotId,indices=null){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return false;const selected=indices&&indices.length?new Set(indices):null;
  const neighbors=new Map();for(const tri of m.triangles||[]){for(let a=0;a<tri.length;a++){const i=tri[a],j=tri[(a+1)%tri.length];if(!neighbors.has(i))neighbors.set(i,new Set());if(!neighbors.has(j))neighbors.set(j,new Set());neighbors.get(i).add(j);neighbors.get(j).add(i);}}
  const next=new Map();for(let i=0;i<m.vertices.length;i++){if(selected&&!selected.has(i))continue;const map=new Map();const add=v=>{for(const w of v.weights||[]){const cur=map.get(w.bone)||{bone:w.bone,w:0,x:w.x,y:w.y};cur.w+=Number(w.w||0);map.set(w.bone,cur);}};add(m.vertices[i]);for(const n of neighbors.get(i)||[])add(m.vertices[n]);const arr=[...map.values()];const tmp={weights:arr};normalizeVertexWeights(tmp,true);pruneVertexWeights(tmp,state.meshEdit?.maxInfluences||4);next.set(i,tmp.weights);}
  for(const [i,weights]of next.entries())m.vertices[i].weights=weights;for(const i of next.keys())rebindSlotMeshVertexWeights(s,i);return true;
}
function meshWeightForBone(v,boneId){return (v?.weights||[]).find(w=>w.bone===boneId)?.w||0;}
function meshWeightsSummary(s){
  const m=ensureSlotMesh(s);if(!m)return'';const selected=meshSelectedIndices(s);const list=selected.length?selected:m.vertices.map((_,i)=>i);
  return list.slice(0,24).map(i=>{
    const v=m.vertices[i];const isUnweighted=!(v.weights||[]).length;
    const fallback=slotParentBoneId(s)&&!m.enabled?('rigid parent: '+htm(bone(slotParentBoneId(s))?.name||slotParentBoneId(s))):'<span class="warn-text">unweighted</span>';
    const w=(v.weights||[]).map(w=>htm(bone(w.bone)?.name||w.bone)+' '+Math.round((w.w??1)*100)+'%').join(', ')||fallback;
    return '<span class="mesh-vrow '+(isUnweighted?'warn':'')+'">v'+i+': '+w+'</span>';
  }).join('<br>')+(list.length>24?'<br>…':'');
}
function nearestBoneToPoint(p){
  updateWorld(false);let best=null;
  for(const b of state.bones){const d=segDist(p,{x:b.w.sx,y:b.w.sy},{x:b.w.ex,y:b.w.ey});if(!best||d<best.d)best={bone:b,d};}
  return best?best.bone:null;
}
function nearestBoneToSlot(slotId){const s=slot(slotId);if(!s)return null;const sw=slotWorld(s);return sw?nearestBoneToPoint({x:sw.x,y:sw.y}):null;}
function placeAttachmentOnStage(attId,name='art'){
  const v=viewRect();const p=s2w(v.w/2,v.h/2);
  if(!activeRigObject())makeRigObject('Object '+state.nextObject,{position:p});
  const o=activeRigObject();const rb=bone(o?.root);let local={x:p.x,y:p.y,r:0,sx:1,sy:1};
  if(rb){updateWorld(false);const loc=inversePointFromBasis(rb.w,p);local={x:loc.x,y:loc.y,r:normAngle(0-(rb.w.r||0)),sx:1/(rb.w.scaleX||1),sy:1/(rb.w.scaleY||1)};}
  return makeSlot(null,attId,name,local);
}


// v10.15 Setup Pose Guard helpers.
function copySlotLocal(tr={}){return{x:Number(tr.x||0),y:Number(tr.y||0),r:normAngle(Number(tr.r||0)),sx:Number(tr.sx??1)||1,sy:Number(tr.sy??1)||1};}
function ensureSlotSetupLocal(s){if(!s)return null;if(!s.setupLocal)s.setupLocal=copySlotLocal(s.local||{});return s.setupLocal;}
function markSlotSetupFromLocal(s){if(!s)return false;s.setupLocal=copySlotLocal(s.local||{});return true;}
function setupPoseDiffStats(){
  let bones=0,slots=0;
  for(const b of state.bones||[]){if(isProjectRootBone(b))continue;const a=b.local||{},r=b.rest||{};if(Math.abs((a.x||0)-(r.x||0))>.001||Math.abs((a.y||0)-(r.y||0))>.001||Math.abs(normAngle((a.r||0)-(r.r||0)))>.001||Math.abs((a.len||0)-(r.len||0))>.001||Math.abs(Number(a.sx??1)-Number(r.sx??1))>.001||Math.abs(Number(a.sy??1)-Number(r.sy??1))>.001)bones++;}
  for(const s of state.slots||[]){const base=ensureSlotSetupLocal(s),a=s.local||{};if(!base)continue;if(Math.abs((a.x||0)-(base.x||0))>.001||Math.abs((a.y||0)-(base.y||0))>.001||Math.abs(normAngle((a.r||0)-(base.r||0)))>.001||Math.abs(Number(a.sx??1)-Number(base.sx??1))>.001||Math.abs(Number(a.sy??1)-Number(base.sy??1))>.001)slots++;}
  return{bones,slots,total:bones+slots};
}
function rebindAllMeshWeightsToCurrentPose(scopeSlotId=null){
  updateWorld(false);let count=0;
  for(const s of state.slots||[]){if(scopeSlotId&&s.id!==scopeSlotId)continue;const m=ensureSlotMesh(s,false);if(!m||!Array.isArray(m.vertices))continue;for(let i=0;i<m.vertices.length;i++){if(rebindSlotMeshVertexWeights(s,i,{normalize:false}))count++;}ensureMeshTopology(m);}
  return count;
}
function setBindPoseFromCurrent({rebind=true}={}){
  pushUndo();
  for(const b of state.bones||[]){if(!isProjectRootBone(b))b.rest=copyTr(b.local||b.rest||{});}
  for(const s of state.slots||[])markSlotSetupFromLocal(s);
  if(rebind)rebindAllMeshWeightsToCurrentPose();
  state.rig=state.rig||{};state.rig.setupPoseVersion=2;state.rig.bindPoseLastSetAt=new Date().toISOString();state.rig.bindPoseDirty=false;
  changed();renderAll();return true;
}
function restoreBindPose({push=true,clearDeform=true}={}){
  if(push)pushUndo();
  for(const b of state.bones||[]){if(!isProjectRootBone(b))b.local=copyTr(b.rest||b.local||{});}
  for(const s of state.slots||[]){const base=ensureSlotSetupLocal(s);if(base)s.local=copySlotLocal(base);if(clearDeform)clearSlotDeformPose(s);s.pose=copySlotPose(s);}
  state.meshEdit.enabled=false;state.meshEdit.weightPaintSession=null;clearMeshElementSelection?.();updateWorld(false);
  if(push){changed();renderAll();}
  return true;
}
function rigTestPoseActive(){return !!(state.rig?.testPose?.active);}
function clearRigTestPoseState(){state.rig=state.rig||{};state.rig.testPose={active:false,snapshot:null,dirty:false,showSetupGhost:true,startedAt:null};return state.rig.testPose;}
function startDeformationTestPose({fromSetup=true}={}){
  if(weightPaintSessionActive?.())applyWeightPaintSession?.();
  if(state.mode==='pose')setMode('skeleton');
  if(fromSetup)restoreBindPose({push:false,clearDeform:true});
  state.rig=state.rig||{};
  state.rig.testPose={active:true,snapshot:capturePose(),dirty:false,showSetupGhost:true,startedAt:new Date().toISOString()};
  state.meshEdit.enabled=false;state.meshEdit.weightPaintSession=null;clearMeshElementSelection?.();
  state.tool='select';state.view.bones=true;state.view.attachments=true;state.view.mesh=true;state.view.rest=true;
  updateWorld(false);updateToolStatus?.();renderMeshWorkbench?.();renderModeBadge?.();renderAll();return true;
}
function resetDeformationTestPose(){
  if(!rigTestPoseActive())return startDeformationTestPose({fromSetup:true});
  restoreBindPose({push:false,clearDeform:true});
  state.rig.testPose.dirty=false;updateWorld(false);updateToolStatus?.();renderMeshWorkbench?.();renderAll();return true;
}
function exitDeformationTestPose({restore=true}={}){
  if(!rigTestPoseActive())return false;
  if(restore)restoreBindPose({push:false,clearDeform:true});
  clearRigTestPoseState();updateWorld(false);updateToolStatus?.();renderMeshWorkbench?.();renderModeBadge?.();renderAll();return true;
}
function deformationTestStats(){
  const active=rigTestPoseActive();
  if(!active)return{active:false,bones:0,slots:0,total:0};
  const snap=state.rig?.testPose?.snapshot;let bones=0,slots=0;
  const bmap=new Map((snap?.bones||[]).map(r=>[r.id,r.local]));
  for(const b of state.bones||[]){if(isProjectRootBone(b))continue;const base=bmap.get(b.id)||b.rest||{};const a=b.local||{};if(Math.abs((a.x||0)-(base.x||0))>.001||Math.abs((a.y||0)-(base.y||0))>.001||Math.abs(normAngle((a.r||0)-(base.r||0)))>.001||Math.abs((a.len||0)-(base.len||0))>.001||Math.abs(Number(a.sx??1)-Number(base.sx??1))>.001||Math.abs(Number(a.sy??1)-Number(base.sy??1))>.001)bones++;}
  const smap=new Map((snap?.slots||[]).map(r=>[r.id,r.local]));
  for(const s of state.slots||[]){const base=smap.get(s.id)||ensureSlotSetupLocal(s)||{};const a=s.local||{};if(Math.abs((a.x||0)-(base.x||0))>.001||Math.abs((a.y||0)-(base.y||0))>.001||Math.abs(normAngle((a.r||0)-(base.r||0)))>.001||Math.abs(Number(a.sx??1)-Number(base.sx??1))>.001||Math.abs(Number(a.sy??1)-Number(base.sy??1))>.001)slots++;}
  return{active:true,bones,slots,total:bones+slots};
}
function enterAnimationTestPose(){setMode('pose');setTool('select');setTime(state.currentTime,true);return true;}
function setupGuardLabel(){const d=setupPoseDiffStats();return d.total?`${d.bones} bone(s), ${d.slots} slot(s) differ from setup pose`:'current viewport matches setup pose';}

function applyEdit(b,key,value){
  if(!b)return;
  if(isProjectRootBone(b))return;
  if((key==='x'||key==='y')&&!canMoveBone(b))return;
  if(key==='r'&&!canRotateBone(b))return;
  if(key==='len'&&!canScaleBone(b,'len'))return;
  if((key==='sx'||key==='sy')&&!canScaleBone(b,'scale'))return;
  if(key==='r')value=normAngle(value);
  if(key==='len')value=Math.max(4,value);
  if(key==='sx'||key==='sy')value=Number(value)||1;
  b.local[key]=value;if(state.mode!=='pose'&&!rigTestPoseActive?.())b.rest[key]=value;
}
function resetPose(all=true){pushUndo();const list=all?state.bones:(typeof selectedBonesList==='function'?selectedBonesList({exact:true}):[selectedBone()].filter(Boolean));for(const b of list)b.local={...b.rest};renderAll();changed();}
function restFromPose(){pushUndo();for(const b of state.bones)b.rest={...b.local};renderAll();changed();}
function deleteSelected(){
  if(state.meshEdit?.enabled&&state.selected.type==='slot'){
    pushUndo();const ok=deleteSelectedMeshElements(state.selected.id);if(!ok){state.undo.pop();return;}changed();renderAll();return;
  }
  pushUndo();
  if(state.selected.type==='bone'){
    const ids=(typeof selectedBoneIds==='function'?selectedBoneIds({exact:true}):[state.selected.id]).filter(id=>id&&id!==state.projectRootId);
    const roots=ids.filter(id=>objectForRootBone(id));
    const normal=ids.filter(id=>!objectForRootBone(id));
    for(const id of roots){const o=objectForRootBone(id);if(o)deleteRigObject(o.id);}
    const deadTop=normal.filter(id=>!normal.some(pid=>pid!==id&&isDescendant(id,pid)));
    for(const id of deadTop)deleteBone(id);
    state.selectedBones=[];
  }else if(state.selected.type==='slot')deleteSlot(state.selected.id);else if(state.selected.type==='marker')deleteMarker(state.selected.id);changed();}

function deleteBone(id){
  if(!id)return;
  if(id===state.projectRootId){if(typeof alert==='function')alert('Project root cannot be deleted.');return;}
  const dead=new Set([id]);let ch=true;
  while(ch){ch=false;for(const b of state.bones){if(b.parent&&dead.has(b.parent)&&!dead.has(b.id)){dead.add(b.id);ch=true;}}}
  updateWorld(false);
  const slotWorlds=new Map();
  for(const s of state.slots){if(dead.has(s.bone))slotWorlds.set(s.id,slotWorld(s));}
  state.bones=state.bones.filter(b=>!dead.has(b.id));
  for(const s of state.slots){if(slotWorlds.has(s.id)){const sw=slotWorlds.get(s.id);s.bone=null;s.local={x:sw.x,y:sw.y,r:normAngle(sw.r||0),sx:sw.sx||1,sy:sw.sy||1};}}
  state.markers=state.markers.filter(m=>!dead.has(m.bone));
  for(const id of dead)delete state.anim.boneTracks[id];
  state.selected={type:'bone',id:state.bones[0]?.id||null};
  state.selectedBones=state.selected.id?[state.selected.id]:[];
  state.lastBoneId=state.selected.id;
  renderAll();
}
function deleteSlot(id){state.slots=state.slots.filter(s=>s.id!==id);delete state.anim.slotTracks[id];if(state.anim.deformTracks)delete state.anim.deformTracks[id];state.selected={type:'slot',id:state.slots[0]?.id||null};state.selectedBones=[];state.lastSlotId=state.selected.id||null;renderAll();}
function deleteMarker(id){state.markers=state.markers.filter(m=>m.id!==id);state.selected={type:'marker',id:state.markers[0]?.id||null};state.selectedBones=[];renderAll();}


function createChildBone(parentId,{free=false,role='deform'}={}){
  const p=bone(parentId)||selectedBone();if(!p||isProjectRootBone(p))return null;updateWorld(false);
  const len=Math.max(24,Number(p.local?.len||p.rest?.len||80)*.65);
  const world={x:free?p.w.sx+(p.w.by||0)*48:p.w.ex,y:free?p.w.sy+(p.w.by||1)*48:p.w.ey,r:p.w.r,len,sx:1,sy:1};
  const loc=boneLocalFromWorldStart(world,p.id);const connected=!free&&role==='deform'&&!isMoveOnlyBone(p);
  const b=makeBone({parent:p.id,x:connected?0:loc.x,y:connected?0:loc.y,r:connected?normAngle(world.r-p.w.r):loc.r,len,connected,role,moveOnly:role==='control'||role==='socket',shape:role==='control'?'circleCross':role==='socket'?'cross':'bone',width:role==='deform'?12:18,color:role==='control'?'#44d9c5':role==='socket'?'#b18cff':undefined});
  if(role==='socket'){b.lockRotate=true;b.lockScale=true;b.lockLength=true;}
  return b;
}
function createFreeChildBone(parentId,role='control'){return createChildBone(parentId,{free:true,role});}
function splitBone(bOrId){
  const b=typeof bOrId==='string'?bone(bOrId):bOrId;if(!b||isProjectRootBone(b)||isObjectRootBone(b))return null;updateWorld(false);
  const oldChildren=children(b.id).map(ch=>({id:ch.id,connected:isConnectedBone(ch)}));
  const oldLen=Math.max(8,Number(b.local?.len||b.rest?.len||80));
  b.local.len=oldLen*.5;if(state.mode!=='pose'&&!rigTestPoseActive?.())b.rest.len=b.local.len;
  const nb=makeBone({name:b.name+'_split',parent:b.id,x:0,y:0,r:0,len:oldLen*.5,connected:true,role:inferBoneRole(b)==='deform'?'deform':'control',shape:b.shape,color:b.color,width:b.width});
  updateWorld(false);
  for(const rec of oldChildren){const ch=bone(rec.id);if(ch&&ch.id!==nb.id)reparentBoneKeepWorld(ch,nb.id,{connected:rec.connected});}
  topoSort();select('bone',nb.id);return nb;
}
function insertBoneBetweenSelectedAndFirstChild(){
  const b=selectedBone();if(!b||isProjectRootBone(b))return null;const ch=children(b.id).find(c=>!isObjectRootBone(c));if(!ch)return splitBone(b);
  updateWorld(false);const mid={x:(b.w.ex+ch.w.sx)/2,y:(b.w.ey+ch.w.sy)/2,r:b.w.r,len:Math.max(16,dist({x:b.w.ex,y:b.w.ey},{x:ch.w.sx,y:ch.w.sy})||Math.max(20,b.local.len*.4)),sx:1,sy:1};
  const loc=boneLocalFromWorldStart(mid,b.id);const nb=makeBone({name:b.name+'_insert',parent:b.id,x:loc.x,y:loc.y,r:loc.r,len:mid.len,connected:false,role:'deform'});
  reparentBoneKeepWorld(ch,nb.id,{connected:false});select('bone',nb.id);return nb;
}
function makeSelectedBoneSocket(){const b=selectedBone();if(!b||isProjectRootBone(b))return;setBoneRole(b,'socket');b.name=b.name.includes('socket')?b.name:(b.name+'_socket');return b;}
function makeSelectedBoneControl(){const b=selectedBone();if(!b||isProjectRootBone(b))return;setBoneRole(b,'control');return b;}

function nearestUnboundSlotToBone(boneId){
  const b=bone(boneId);if(!b)return null;updateWorld(false);let best=null;
  for(const s of state.slots){if(s.bone)continue;const sw=slotWorld(s);if(!sw)continue;const d=segDist({x:sw.x,y:sw.y},{x:b.w.sx,y:b.w.sy},{x:b.w.ex,y:b.w.ey});if(!best||d<best.d)best={s,d};}
  return best?best.s:null;
}
function slotBoneWorldProposal(s){
  const att=attachment(s?.pose?.attachment||s?.attachment);const sw=s?slotWorld(s):null;if(!s||!sw)return null;
  const len=Math.max(12,(att?Number(att.w||60):60)*Math.abs(sw.sx||1));
  const dx=Math.cos(rad(sw.r))*len*.5,dy=Math.sin(rad(sw.r))*len*.5;
  return{start:{x:sw.x-dx,y:sw.y-dy},end:{x:sw.x+dx,y:sw.y+dy},r:sw.r,len};
}
function frameWorldRect(points){
  if(!points||!points.length)return;const v=viewRect();const xs=points.map(p=>p.x),ys=points.map(p=>p.y);const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);const cx=(minX+maxX)/2,cy=(minY+maxY)/2;const span=Math.max(40,maxX-minX,maxY-minY);state.camera.z=clamp(Math.min(v.w,v.h)/(span*2),.15,5);state.camera.x=-cx*state.camera.z;state.camera.y=cy*state.camera.z;
}

// Mesh editor helpers: structured grid cutting and weight housekeeping.
function slotMeshGridSize(slotId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return{cols:1,rows:1};
  let cols=parseInt(m.gridCols,10),rows=parseInt(m.gridRows,10);
  if(cols>0&&rows>0)return{cols,rows};
  const vc=m.vertices?.length||0,tc=m.triangles?.length||0;
  for(let r=1;r<=24;r++)for(let c=1;c<=24;c++)if((c+1)*(r+1)===vc&&c*r*2===tc)return{cols:c,rows:r};
  return{cols:Math.max(1,Math.round(Math.sqrt(Math.max(1,vc)))-1),rows:Math.max(1,Math.round(Math.sqrt(Math.max(1,vc)))-1)};
}
function rebuildSlotMeshGrid(slotId,cols,rows,{autoBind=false,boneIds=null}={}){
  const s=typeof slotId==='string'?slot(slotId):slotId;if(!s)return false;
  makeSlotMeshGrid(s,cols,rows);s.mesh.enabled=true;s.mesh.gridCols=parseInt(cols,10)||1;s.mesh.gridRows=parseInt(rows,10)||1;
  if(autoBind)autoBindSlotMesh(s,boneIds||allMeshCandidateBoneIds(s.id));
  return s.mesh;
}
function meshSelectionByRegion(slotId,region){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return[];
  if(region==='all')return m.vertices.map((_,i)=>i);
  const xs=m.vertices.map(v=>Number(v.x||0)),ys=m.vertices.map(v=>Number(v.y||0));
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const size=slotMeshGridSize(s);const tolX=Math.max(1,(maxX-minX)/Math.max(1,size.cols)/2),tolY=Math.max(1,(maxY-minY)/Math.max(1,size.rows)/2);
  const midX=(minX+maxX)/2,midY=(minY+maxY)/2;
  return m.vertices.map((v,i)=>{
    const x=Number(v.x||0),y=Number(v.y||0);let ok=false;
    if(region==='top')ok=y<=minY+tolY;
    else if(region==='bottom')ok=y>=maxY-tolY;
    else if(region==='middle')ok=Math.abs(y-midY)<=tolY;
    else if(region==='left')ok=x<=minX+tolX;
    else if(region==='right')ok=x>=maxX-tolX;
    else if(region==='center')ok=Math.abs(x-midX)<=tolX||Math.abs(y-midY)<=tolY;
    return ok?i:null;
  }).filter(i=>i!==null);
}
function selectSlotMeshRegion(slotId,region){const ids=meshSelectionByRegion(slotId,region);setMeshSelectedIndices(ids);return ids;}
function normalizeSlotMeshVertices(slotId,indices=null){const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return false;const list=indices&&indices.length?indices:m.vertices.map((_,i)=>i);for(const i of list){normalizeVertexWeights(m.vertices[i],true);rebindSlotMeshVertexWeights(s,i);}return true;}
function pruneSlotMeshVertices(slotId,indices=null,max=null){const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return false;const list=indices&&indices.length?indices:m.vertices.map((_,i)=>i);const n=max||state.meshEdit?.maxInfluences||4;for(const i of list){pruneVertexWeights(m.vertices[i],n);rebindSlotMeshVertexWeights(s,i);}return true;}


// v10.7 Weight Paint UX helpers.
function meshVertexNeighbors(mesh){
  const map=new Map();
  if(!mesh)return map;
  for(const tri of mesh.triangles||[]){
    for(let k=0;k<3;k++){
      const a=tri[k],b=tri[(k+1)%3];
      if(!map.has(a))map.set(a,new Set());
      if(!map.has(b))map.set(b,new Set());
      map.get(a).add(b);map.get(b).add(a);
    }
  }
  return map;
}
function slotMeshBoneWeightTarget(slotId,index,boneId,target){
  const s=typeof slotId==='string'?slot(slotId):slotId;
  const m=ensureSlotMesh(s),b=bone(boneId);
  if(!s||!m||!m.vertices[index]||!b||!boneAffectsWeights(b))return false;
  const v=m.vertices[index];target=clamp(Number(target)||0,0,1);
  updateWorld(false);const p=slotMeshBaseVertexWorld(s,v);const loc=inversePointFromBasis(b.w,p);
  const maxInf=Math.max(1,Number(state.meshEdit?.maxInfluences||4));
  let others=(v.weights||[])
    .filter(w=>w&&w.bone&&w.bone!==boneId&&bone(w.bone))
    .map(w=>({...w,w:Math.max(0,Number(w.w||0))}))
    .filter(w=>w.w>.001)
    .sort((a,b)=>Number(b.w||0)-Number(a.w||0));

  // When a vertex has only the active bone at 100%, dragging down must not
  // snap back to 100%. In that case the missing remainder is an implicit
  // rest/unassigned influence. It is visible as the empty part of the gauge
  // and is blended against the setup vertex position in slotMeshVertexWorldNoDeform().
  if(target<=.001){
    v.weights=others;
    if(v.weights.length){normalizeVertexWeights(v,true);pruneVertexWeights(v,maxInf);rebindSlotMeshVertexWeights(s,index);}
    else v.weights=[];
    return true;
  }

  if(target>=.999){
    v.weights=[{bone:boneId,w:1,x:loc.x,y:loc.y}];
    return true;
  }

  // Keep the active bone at the exact requested value. If there are other
  // influences, they share the remaining 1-target. If there are no other
  // influences, preserve the partial value instead of normalizing it back to 1.
  if(others.length){
    others=others.slice(0,Math.max(0,maxInf-1));
    const otherSum=others.reduce((a,w)=>a+Number(w.w||0),0);
    if(otherSum>.001){
      const scale=(1-target)/otherSum;
      others=others.map(w=>({...w,w:Number(w.w||0)*scale}));
      v.weights=[...others,{bone:boneId,w:target,x:loc.x,y:loc.y}];
      rebindSlotMeshVertexWeights(s,index,{normalize:false});
      compactVertexWeights(v);
      return true;
    }
  }

  v.weights=[{bone:boneId,w:target,x:loc.x,y:loc.y}];
  rebindSlotMeshVertexWeights(s,index,{normalize:false});
  return true;
}
function slotMeshBrushHitsFromScreen(slotId,screenPoint,radius=null){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return[];
  const pts=slotMeshWorldVertices(s).map(w2s);const r=Math.max(4,Number(radius??state.meshEdit?.weightBrushSize??46));
  const selectedOnly=state.meshEdit?.weightBrushSelectedOnly===true;const selected=new Set(meshSelectedIndices(s));
  const hits=[];
  for(let i=0;i<pts.length;i++){
    if(selectedOnly&&selected.size&&!selected.has(i))continue;
    const p=pts[i];if(!p)continue;const d=Math.hypot(p.x-screenPoint.x,p.y-screenPoint.y);
    if(d<=r){let f=1-d/r;f=f*f*(3-2*f);hits.push({i,d,falloff:f});}
  }
  hits.sort((a,b)=>a.d-b.d);return hits;
}
function applySlotMeshWeightBrushAtScreen(slotId,screenPoint,opts={}){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);const boneId=opts.boneId||state.meshEdit?.weightBoneId;const b=bone(boneId);
  if(!s||!m||!b||!boneAffectsWeights(b))return false;
  m.enabled=true;state.meshEdit.weightBoneId=b.id;
  const mode=opts.mode||state.meshEdit?.weightBrushMode||'add';
  const strength=clamp(Number(opts.strength??state.meshEdit?.weightBrushStrength??.35),0,1);
  const value=clamp(Number(opts.value??state.meshEdit?.weightBrushValue??1),0,1);
  const hits=slotMeshBrushHitsFromScreen(s,screenPoint,opts.size??state.meshEdit?.weightBrushSize);
  state.meshEdit.weightBrushHits=hits.map(h=>h.i);
  if(!hits.length)return false;
  if(mode==='smooth'){
    const neighbors=meshVertexNeighbors(m);const targets=new Map();
    for(const h of hits){
      const ns=[h.i,...(neighbors.get(h.i)||[])];let sum=0,count=0;
      for(const ni of ns){if(!m.vertices[ni])continue;sum+=meshWeightForBone(m.vertices[ni],b.id);count++;}
      const avg=count?sum/count:meshWeightForBone(m.vertices[h.i],b.id);
      const cur=meshWeightForBone(m.vertices[h.i],b.id);targets.set(h.i,cur+(avg-cur)*(strength*h.falloff));
    }
    for(const [i,target] of targets)slotMeshBoneWeightTarget(s,i,b.id,target);
    return true;
  }
  for(const h of hits){
    const v=m.vertices[h.i];if(!v)continue;const cur=meshWeightForBone(v,b.id);const a=strength*h.falloff;let target=cur;
    if(mode==='subtract')target=cur-a;
    else if(mode==='replace')target=cur+(value-cur)*a;
    else target=cur+a;
    slotMeshBoneWeightTarget(s,h.i,b.id,clamp(target,0,1));
  }
  return true;
}
function activeWeightBrushBone(){
  const b=bone(state.meshEdit?.weightBoneId)||bone(state.lastBoneId)||bone(selectedSlot()?.bone);
  return b&&boneAffectsWeights(b)?b:null;
}
function adjustSlotMeshSelectedWeights(slotId,boneId,delta,indices=null){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);const b=bone(boneId);
  if(!s||!m||!b||!boneAffectsWeights(b))return false;
  const list=(indices&&indices.length?indices:meshSelectedIndices(s)).filter(i=>m.vertices[i]);
  if(!list.length)return false;
  for(const i of list){const cur=meshWeightForBone(m.vertices[i],b.id);slotMeshBoneWeightTarget(s,i,b.id,clamp(cur+Number(delta||0),0,1));}
  return true;
}



// v10.19 Weight Mirror / Symmetry helpers.
function meshMirrorCounterpartName(name){
  name=String(name||'');
  const rules=[
    [/(_|\.|-)L($|_|\.|-)/,'$1R$2'],[/(_|\.|-)R($|_|\.|-)/,'$1L$2'],
    [/^L(_|\.|-)/,'R$1'],[/^R(_|\.|-)/,'L$1'],
    [/left/gi,m=>m[0]===m[0].toUpperCase()?'Right':'right'],
    [/right/gi,m=>m[0]===m[0].toUpperCase()?'Left':'left']
  ];
  for(const [re,rep] of rules){if(re.test(name))return name.replace(re,rep);}
  return name;
}
function meshFindBoneByNameInObject(name,objectId=null){
  const exact=state.bones.find(b=>b.name===name&&(!objectId||objectOfBoneId(b.id)===objectId));
  return exact||state.bones.find(b=>b.name===name)||null;
}
function meshMirrorBoneForSlot(slotId,boneId){
  const s=typeof slotId==='string'?slot(slotId):slotId;const src=bone(boneId);if(!src)return{boneId:null,missing:false,unchanged:true,name:null,targetName:null};
  const objectId=s?objectOfSlotId(s.id):objectOfBoneId(src.id);
  const targetName=meshMirrorCounterpartName(src.name||src.id);
  if(!targetName||targetName===(src.name||src.id))return{boneId:src.id,missing:false,unchanged:true,name:src.name,targetName};
  const pair=meshFindBoneByNameInObject(targetName,objectId);
  return{boneId:pair?pair.id:src.id,missing:!pair,unchanged:!pair,name:src.name,targetName};
}
function meshMirrorAxisLocalX(slotId,axisMode=null){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m||!m.vertices?.length)return 0;
  const mode=axisMode||state.meshEdit?.weightMirrorAxis||'slot';
  if(mode==='bounds'){
    const xs=m.vertices.map(v=>Number(v.x||0));return (Math.min(...xs)+Math.max(...xs))/2;
  }
  if(mode==='object'){
    const obj=rigObject(objectOfSlotId(s.id)||state.activeObjectId);const rb=bone(obj?.root);
    if(rb){updateWorld(false);const p=slotLocalPointFromWorld(s,{x:rb.w?.sx||0,y:rb.w?.sy||0});return Number(p.x||0);}
  }
  return 0;
}
function meshAverageEdgeLength(mesh){
  if(!mesh)return 1;ensureMeshTopology(mesh);let sum=0,n=0;
  for(const e of mesh.edges||[]){const a=mesh.vertices[e[0]],b=mesh.vertices[e[1]];if(!a||!b)continue;sum+=Math.hypot(Number(a.x||0)-Number(b.x||0),Number(a.y||0)-Number(b.y||0));n++;}
  return n?sum/n:Math.max(1,...(mesh.vertices||[]).map(v=>Math.hypot(Number(v.x||0),Number(v.y||0))));
}
function meshMirrorTargetIndex(slotId,sourceIndex,axisX=null){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m||!m.vertices[sourceIndex])return null;
  axisX=Number(axisX??meshMirrorAxisLocalX(s));const src=m.vertices[sourceIndex];
  const target={x:2*axisX-Number(src.x||0),y:Number(src.y||0)};
  let best=null;
  for(let i=0;i<m.vertices.length;i++){
    const v=m.vertices[i];if(!v)continue;
    const d=Math.hypot(Number(v.x||0)-target.x,Number(v.y||0)-target.y);
    if(!best||d<best.d)best={i,d};
  }
  const avg=meshAverageEdgeLength(m);const xs=m.vertices.map(v=>Number(v.x||0)),ys=m.vertices.map(v=>Number(v.y||0));
  const span=Math.max(1,Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));
  const tol=Math.max(2,Math.min(span*.18,avg*.85));
  if(!best||best.d>tol)return null;
  if(best.i===sourceIndex&&Math.abs(Number(src.x||0)-axisX)>tol*.25)return null;
  return best.i;
}
function meshMirrorSourceIndices(slotId,direction='selected',indices=null,axisX=null){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m)return[];axisX=Number(axisX??meshMirrorAxisLocalX(s));
  const selected=indices&&indices.length?indices:meshSelectedIndices(s);
  const base=(direction==='selected'&&selected.length)?selected:m.vertices.map((_,i)=>i);
  const eps=Math.max(.001,meshAverageEdgeLength(m)*.05);
  return [...new Set(base.filter(i=>m.vertices[i]).filter(i=>{
    const x=Number(m.vertices[i].x||0);
    if(direction==='lr')return x<axisX-eps;
    if(direction==='rl')return x>axisX+eps;
    if(direction==='selected')return true;
    return Math.abs(x-axisX)>eps;
  }))];
}
function mirrorSlotMeshVertexWeights(slotId,sourceIndex,targetIndex){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!m||!m.vertices[sourceIndex]||!m.vertices[targetIndex])return{ok:false,missing:[]};
  const src=m.vertices[sourceIndex];const dst=m.vertices[targetIndex];const missing=[];
  const next=[];
  for(const w of src.weights||[]){
    if(!w||!w.bone)continue;
    const map=meshMirrorBoneForSlot(s,w.bone);
    if(map.missing)missing.push({source:map.name||w.bone,target:map.targetName||''});
    next.push({bone:map.boneId||w.bone,w:Math.max(0,Number(w.w||0))});
  }
  dst.weights=next.filter(w=>w.bone&&w.w>.001);
  compactVertexWeights(dst,0);
  rebindSlotMeshVertexWeights(s,targetIndex,{normalize:false});
  return{ok:true,missing};
}
function mirrorSlotMeshWeights(slotId,{direction='selected',indices=null,axisMode=null}={}){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m||!m.vertices?.length)return{changed:0,pairs:0,missing:[],unpaired:[],axisX:0};
  const axisX=meshMirrorAxisLocalX(s,axisMode);const sources=meshMirrorSourceIndices(s,direction,indices,axisX);
  const sourceWeights=new Map();for(const i of sources){sourceWeights.set(i,JSON.parse(JSON.stringify(m.vertices[i]?.weights||[])));}
  let changed=0,pairs=0;const missing=[];const unpaired=[];const writes=[];
  for(const i of sources){const j=meshMirrorTargetIndex(s,i,axisX);if(j===null||j===undefined){unpaired.push(i);continue;}pairs++;writes.push([i,j]);}
  for(const [i,j] of writes){
    if(i===j){
      const res=mirrorSlotMeshVertexWeights(s,i,j);
      if(res.ok){changed++;if(res.missing?.length)missing.push(...res.missing.map(x=>({...x,vertex:i,targetVertex:j})));}
      continue;
    }
    const old=m.vertices[i].weights;m.vertices[i].weights=sourceWeights.get(i)||[];
    const res=mirrorSlotMeshVertexWeights(s,i,j);m.vertices[i].weights=old;
    if(res.ok){changed++;if(res.missing?.length)missing.push(...res.missing.map(x=>({...x,vertex:i,targetVertex:j})));}
  }
  ensureMeshTopology(m);return{changed,pairs,missing,unpaired,axisX};
}
function meshWeightMirrorPreview(slotId,{direction='selected',indices=null,axisMode=null}={}){
  const s=typeof slotId==='string'?slot(slotId):slotId;const m=ensureSlotMesh(s);if(!s||!m)return{sources:0,pairs:0,missingBones:0,unpaired:0,axisX:0,examples:[]};
  const axisX=meshMirrorAxisLocalX(s,axisMode);const sources=meshMirrorSourceIndices(s,direction,indices,axisX);
  let pairs=0,unpaired=0;const missing=new Set();const examples=[];
  for(const i of sources){
    const j=meshMirrorTargetIndex(s,i,axisX);if(j===null||j===undefined){unpaired++;continue;}pairs++;if(examples.length<3)examples.push(`v${i} → v${j}`);
    for(const w of m.vertices[i].weights||[]){const map=meshMirrorBoneForSlot(s,w.bone);if(map.missing)missing.add(`${map.name||w.bone} → ${map.targetName||'?'}`);}
  }
  return{sources:sources.length,pairs,missingBones:missing.size,missing:[...missing],unpaired,axisX,examples};
}

function setMeshEditorTool(tool){state.meshEdit.tool=(tool==='weights')?'weights':'vertices';state.meshEdit.showWeights=state.meshEdit.tool==='weights'||state.meshEdit.showWeights!==false;renderAll();}
