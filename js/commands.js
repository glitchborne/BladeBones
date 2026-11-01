'use strict';
// Editor commands that mutate project state.
function moveSlot(id,dir){const i=state.slots.findIndex(s=>s.id===id);if(i<0)return;const obj=objectOfSlotId(id);let j=i+dir;if(obj){let k=i+dir;while(k>=0&&k<state.slots.length&&objectOfSlotId(state.slots[k].id)!==obj)k+=dir;j=k;}j=clamp(j,0,state.slots.length-1);if(i===j||!state.slots[j])return;pushUndo();const [s]=state.slots.splice(i,1);state.slots.splice(j,0,s);changed();renderAll();}
function addEvent(){pushUndo();let payload={};const txt=$('#eventPayload').value.trim();if(txt){try{payload=JSON.parse(txt);}catch{payload={text:txt};}}state.anim.events.push({t:roundTime(state.currentTime),name:$('#eventName').value||'event',payload});state.anim.events.sort((a,b)=>a.t-b.t);changed();renderAll();}
function savePose(){const name=$('#poseName').value||('pose_'+state.nextPose++);const bones={};for(const b of state.bones)bones[b.id]={...b.local};const i=state.poses.findIndex(p=>p.name===name);const p={id:'p'+state.nextPose++,name,bones};if(i>=0)state.poses[i]=p;else state.poses.push(p);changed();renderPoseList();}
function applyPose(){const name=$('#poseName').value;const p=state.poses.find(x=>x.name===name)||state.poses[0];if(!p)return;const blend=clamp(Number($('#poseBlend')?.value||100)/100,0,1);pushUndo();for(const [id,tr]of Object.entries(p.bones)){const b=bone(id);if(b&&!isProjectRootBone(b)){const src=copyTr(tr);b.local={x:lerp(b.local.x,src.x,blend),y:lerp(b.local.y,src.y,blend),r:lerpAngle(b.local.r,src.r,blend),len:lerp(b.local.len,src.len,blend),sx:lerp(Number(b.local.sx??1),Number(src.sx??1),blend),sy:lerp(Number(b.local.sy??1),Number(src.sy??1),blend)};}}changed();renderAll();}
function makeClip({name='anim',duration=1.2,fps=24,boneTracks={},slotTracks={},deformTracks={},cameraTracks={},events=[]}={}){return{id:'clip'+state.nextClip++,name,duration:Math.max(.1,Number(duration||1.2)),fps:Math.max(1,Number(fps||24)),boneTracks,slotTracks,deformTracks,cameraTracks,events};}
function cloneClip(clip,name){const copy=JSON.parse(JSON.stringify(clip));copy.id='clip'+state.nextClip++;copy.name=name||(`${clip.name}_copy`);return copy;}
function ensureClipStore(){if(!state.anim.id)state.anim.id='clip'+state.nextClip++;if(!Array.isArray(state.animations)||!state.animations.length)state.animations=[state.anim];if(!state.animations.some(c=>c.id===state.anim.id))state.animations.push(state.anim);state.activeAnimationId=state.anim.id;}
function syncAnimationFields(){const a=state.anim;const ids=['animName','duration','fps'];if($('#animName'))$('#animName').value=a.name;if($('#duration'))$('#duration').value=a.duration;if($('#fps'))$('#fps').value=a.fps;if(state.timeline.rangeEnd<=state.timeline.rangeStart||state.timeline.rangeEnd>state.anim.duration)state.timeline.rangeEnd=state.anim.duration;syncTime();}
function setActiveClip(id){ensureClipStore();const clip=state.animations.find(c=>c.id===id);if(!clip)return;pushUndo();state.anim=clip;state.activeAnimationId=clip.id;state.keySelection={kind:null,id:null,time:null};state.selectedKeys=[];syncAnimationFields();setTime(0,true);changed();renderAll();}
function addClip(){ensureClipStore();pushUndo();const clip=makeClip({name:'new_clip',duration:state.anim.duration,fps:state.anim.fps});state.animations.push(clip);state.anim=clip;state.activeAnimationId=clip.id;state.timeline.rangeStart=0;state.timeline.rangeEnd=clip.duration;syncAnimationFields();changed();renderAll();}
function duplicateClip(){ensureClipStore();pushUndo();const clip=cloneClip(state.anim);state.animations.push(clip);state.anim=clip;state.activeAnimationId=clip.id;syncAnimationFields();changed();renderAll();}
function deleteClip(){ensureClipStore();if(state.animations.length<=1)return;pushUndo();const idx=state.animations.findIndex(c=>c.id===state.anim.id);state.animations.splice(Math.max(0,idx),1);state.anim=state.animations[Math.max(0,idx-1)]||state.animations[0];state.activeAnimationId=state.anim.id;syncAnimationFields();changed();renderAll();}

function clearProject(){
  pushUndo();
  state.playing=false;
  const play=$('#play');if(play)play.textContent='Play';
  const duration=Math.max(.1,Number(state.anim?.duration||1.2));
  const fps=Math.max(1,Number(state.anim?.fps||24));
  const name=state.anim?.name||'anim';
  state.bones=[];state.slots=[];state.attachments=[];state.markers=[];state.poses=[];state.objects=[];
  state.nextBone=1;state.nextSlot=1;state.nextAtt=1;state.nextMarker=1;state.nextPose=1;state.nextClip=2;state.nextObject=1;state.activeObjectId=null;state.lastObjectId=null;
  ensureProjectRoot({reparent:false});
  state.anim={id:'clip1',name,duration,fps,boneTracks:{},slotTracks:{},deformTracks:{},events:[]};
  state.animations=[state.anim];state.activeAnimationId=state.anim.id;
  state.selected={type:'bone',id:state.projectRootId};state.selectedBones=[state.projectRootId];state.lastBoneId=state.projectRootId;state.lastSlotId=null;state.activeObjectId=null;state.lastObjectId=null;state.keySelection={kind:null,id:null,time:null};state.selectedKeys=[];state.keyClipboard=null;
  state.currentTime=0;state.drag=null;state.ghost=null;
  state.timeline.rangeStart=0;state.timeline.rangeEnd=duration;
  syncAnimationFields();
  evaluate(0,false,true);
  changed();
  syncWorkflowControls?.();
  renderAll();
}

function renderClipList(){const root=$('#clipList');if(!root)return;ensureClipStore();root.innerHTML='';for(const clip of state.animations){const div=document.createElement('div');div.className='item'+(clip.id===state.anim.id?' on':'');div.innerHTML='<span>'+htm(clip.name)+'</span><span>'+Number(clip.duration||0).toFixed(2)+'s</span>';div.onclick=()=>setActiveClip(clip.id);root.appendChild(div);}}
function updateCurrentClipMeta(){state.anim.name=$('#animName').value||'anim';state.anim.duration=Math.max(.1,parseFloat($('#duration').value)||1);state.anim.fps=Math.max(1,parseInt($('#fps').value,10)||24);state.timeline.rangeEnd=clamp(Number(state.timeline.rangeEnd||state.anim.duration),0,state.anim.duration)||state.anim.duration;state.currentTime=clamp(state.currentTime,0,state.anim.duration);}

function bindSelectedSlotToNearest(){const s=selectedSlot();if(!s)return false;const b=nearestBoneToSlot(s.id);if(!b)return false;pushUndo();bindSlotToBone(s.id,b.id,true);state.lastBoneId=b.id;changed();renderAll();return true;}
function bindSelectedSlotToLastBone(){const s=selectedSlot();const b=bone(state.lastBoneId)||selectedBone();if(!s||!b)return false;pushUndo();bindSlotToBone(s.id,b.id,true);changed();renderAll();return true;}
function unbindSelectedSlot(){const s=selectedSlot();if(!s)return false;pushUndo();unbindSlot(s.id,true);changed();renderAll();return true;}
function bindAllUnboundSlotsToNearest(){let count=0;pushUndo();for(const s of state.slots){if(s.bone)continue;const b=nearestBoneToSlot(s.id);if(b){bindSlotToBone(s.id,b.id,true);count++;}}if(!count){state.undo.pop();return false;}changed();renderAll();return true;}
function autoBindNearestSlotForBone(b){if(!b)return;let best=null;for(const s of state.slots){if(s.bone)continue;const sw=slotWorld(s);if(!sw)continue;const d=segDist({x:sw.x,y:sw.y},{x:b.w.sx,y:b.w.sy},{x:b.w.ex,y:b.w.ey});if(!best||d<best.d)best={s,d};}if(best&&best.d<80/Math.max(.2,state.camera.z))bindSlotToBone(best.s.id,b.id,true);}

function parentNearbyBonesToSelected(){
  const parent=selectedBone();if(!parent||isProjectRootBone(parent))return false;
  updateWorld(false);const tol=Math.max(12,Number(parent.width||12)*1.25);let count=0;pushUndo();
  for(const b of [...state.bones]){
    if(!b||b.id===parent.id||isProjectRootBone(b))continue;
    if(b.parent===parent.id)continue;
    if(isDescendant(parent.id,b.id))continue;
    const bp=bone(b.parent);
    if(bp&&!isProjectRootBone(bp))continue;
    const d=segDist({x:b.w.sx,y:b.w.sy},{x:parent.w.sx,y:parent.w.sy},{x:parent.w.ex,y:parent.w.ey});
    if(d<=tol){if(reparentBoneKeepWorld(b,parent.id,{connected:false}))count++;}
  }
  if(!count){state.undo.pop();if(typeof alert==='function')alert('No nearby top-level bones found near selected bone.');return false;}
  state.selected={type:'bone',id:parent.id};state.selectedBones=[parent.id];changed();renderAll();return true;
}
function copyPoseToClipboard(){const bones={};for(const b of state.bones)if(!isProjectRootBone(b))bones[b.id]={...b.local,name:b.name,parent:b.parent};state.poseClipboard={bones};return true;}
function counterpartName(name){
  const rules=[[/(_|\.|-)L($|_|\.|-)/,'$1R$2'],[/(_|\.|-)R($|_|\.|-)/,'$1L$2'],[/left/gi,m=>m[0]===m[0].toUpperCase()?'Right':'right'],[/right/gi,m=>m[0]===m[0].toUpperCase()?'Left':'left']];
  for(const [re,rep] of rules){if(re.test(name))return name.replace(re,rep);}return name;
}
function findBoneByName(name){return state.bones.find(b=>b.name===name)||null;}
function mirrorTransformForBone(src,target){const hasParent=!!target.parent;return{x:hasParent?src.x:-src.x,y:src.y,r:normAngle(hasParent?-src.r:180-src.r),len:src.len,sx:src.sx??1,sy:src.sy??1};}
function pastePoseFromClipboard(mirrored=false,blend=1){if(!state.poseClipboard)return false;pushUndo();const byId=state.poseClipboard.bones||{};for(const [id,tr] of Object.entries(byId)){let target=bone(id);let src=tr;if(mirrored){const sourceBone=bone(id);const pairName=counterpartName(tr.name||sourceBone?.name||'');target=findBoneByName(pairName)||target;src=mirrorTransformForBone(tr,target||{});}if(!target||isProjectRootBone(target))continue;target.local={x:lerp(target.local.x,src.x,blend),y:lerp(target.local.y,src.y,blend),r:lerpAngle(target.local.r,src.r,blend),len:lerp(target.local.len,src.len,blend)};}changed();renderAll();return true;}
function mirrorCurrentPose(){copyPoseToClipboard();return pastePoseFromClipboard(true,Number($('#poseBlend')?.value||100)/100);}

// v7 production-prototype helpers.
function createBoneFromSlot(s){
  if(!s)return null;const prop=slotBoneWorldProposal(s);if(!prop)return null;
  const b=makeBone({name:(s.name||'art')+'_bone',x:prop.start.x,y:prop.start.y,r:prop.r,len:prop.len,width:12});
  updateWorld(false);bindSlotToBone(s.id,b.id,true);state.selected={type:'bone',id:b.id};state.selectedBones=[b.id];state.lastBoneId=b.id;return b;
}
function createBoneFromSelectedArtwork(){
  const s=selectedSlot();if(!s)return false;pushUndo();const b=createBoneFromSlot(s);if(!b){state.undo.pop();return false;}changed();renderAll();return true;
}
function createBonesFromUnboundArtwork(){
  const list=state.slots.filter(s=>!s.bone);if(!list.length)return false;pushUndo();let count=0;
  for(const s of list){if(createBoneFromSlot(s))count++;}
  if(!count){state.undo.pop();return false;}changed();renderAll();return true;
}
function bindSelectedArtToSelectedBone(){
  const s=selectedSlot();let b=selectedBone();if(!b&&state.lastBoneId)b=bone(state.lastBoneId);if(!s||!b)return false;pushUndo();bindSlotToBone(s.id,b.id,true);changed();renderAll();return true;
}
function collectPoseBones(selectedOnly=false){
  if(!selectedOnly)return state.bones.filter(b=>!isProjectRootBone(b));
  const ids=selectedBoneSet();if(!ids.size)return state.bones.filter(b=>!isProjectRootBone(b));
  return state.bones.filter(b=>ids.has(b.id)&&!isProjectRootBone(b));
}
function savePose(){
  const name=$('#poseName')?.value||('pose_'+state.nextPose++);const category=$('#poseCategory')?.value||'General';const selectedOnly=!!$('#poseSelectedOnly')?.checked;const bones={};
  for(const b of collectPoseBones(selectedOnly))bones[b.id]={...b.local};
  const i=state.poses.findIndex(p=>p.name===name&&((p.category||'General')===category));const p={id:'p'+state.nextPose++,name,category,bones,selectedOnly,createdAt:new Date().toISOString()};
  if(i>=0)state.poses[i]=p;else state.poses.push(p);changed();renderPoseList();renderProjectHealth();
}
function applyPose(){
  const name=$('#poseName')?.value;const category=$('#poseCategory')?.value;const p=state.poses.find(x=>x.name===name&&(category?((x.category||'General')===category):true))||state.poses.find(x=>x.name===name)||state.poses[0];if(!p)return;
  const blend=clamp(Number($('#poseBlend')?.value||100)/100,0,1);pushUndo();for(const [id,tr]of Object.entries(p.bones||{})){const b=bone(id);if(b&&!isProjectRootBone(b)){const src=copyTr(tr);b.local={x:lerp(b.local.x,src.x,blend),y:lerp(b.local.y,src.y,blend),r:lerpAngle(b.local.r,src.r,blend),len:lerp(b.local.len,src.len,blend),sx:lerp(Number(b.local.sx??1),Number(src.sx??1),blend),sy:lerp(Number(b.local.sy??1),Number(src.sy??1),blend)};}}
  changed();renderAll();
}
function validateProject(){
  const warnings=[];const root=projectRoot();if(!root)warnings.push({severity:'warn',message:'Project root bone is missing.'});else if(state.bones.some(b=>b.id!==root.id&&!b.parent))warnings.push({severity:'info',message:'Some top-level bones are not parented to project_root.'});const boneIds=new Set(state.bones.map(b=>b.id));const slotIds=new Set(state.slots.map(s=>s.id));const attIds=new Set(state.attachments.map(a=>a.id));
  const unbound=state.slots.filter(s=>!s.bone);if(unbound.length)warnings.push({severity:'info',message:`${unbound.length} slot(s) have no Parent Bone.`});
  const bonesNoSlots=state.bones.filter(b=>!isProjectRootBone(b)&&!state.slots.some(s=>s.bone===b.id));if(bonesNoSlots.length)warnings.push({severity:'info',message:`${bonesNoSlots.length} bone(s) have no parented slots.`});
  const missingAtt=state.slots.filter(s=>s.pose?.attachment&&!attIds.has(s.pose.attachment));if(missingAtt.length)warnings.push({severity:'warn',message:`${missingAtt.length} slot(s) reference missing attachments.`});
  const badSlotBone=state.slots.filter(s=>s.bone&&!boneIds.has(s.bone));if(badSlotBone.length)warnings.push({severity:'warn',message:`${badSlotBone.length} slot(s) reference missing Parent Bones.`});
  for(const s of state.slots){
    const st=slotBindingStatus(s);
    for(const issue of slotBindingIssues(s)){
      if(issue.code==='no-attachment')continue;
      const obj=rigObject(objectOfSlotId(s.id));
      warnings.push({severity:issue.severity||'warn',message:`Slot "${s.name}"${obj?' in '+obj.name:''}: ${issue.message} (${st.label})`});
    }
    const nonDeform=slotInfluenceBoneIds(s).filter(id=>bone(id)&&!boneAffectsWeights(bone(id)));
    if(nonDeform.length)warnings.push({severity:'info',message:`Slot "${s.name}" has weights on non-deform bone(s): ${nonDeform.map(id=>bone(id)?.name||id).join(', ')}.`});
    if(typeof meshTopologyIssues==='function')for(const issue of meshTopologyIssues(s))warnings.push({severity:issue.severity||'info',message:`Slot "${s.name}": ${issue.message}.`});
  }
  const badMarkers=state.markers.filter(m=>m.bone&&!boneIds.has(m.bone));if(badMarkers.length)warnings.push({severity:'warn',message:`${badMarkers.length} marker(s) reference missing bones.`});
  for(const clip of state.animations.length?state.animations:[state.anim]){
    for(const id of Object.keys(clip.boneTracks||{}))if(!boneIds.has(id))warnings.push({severity:'warn',message:`Clip "${clip.name}" has orphan bone track ${id}.`});
    for(const id of Object.keys(clip.slotTracks||{}))if(!slotIds.has(id))warnings.push({severity:'warn',message:`Clip "${clip.name}" has orphan slot track ${id}.`});
    const dur=Number(clip.duration||0);for(const [id,arr] of Object.entries(clip.boneTracks||{}))for(const k of arr)if(k.t<-.0005||k.t>dur+.0005)warnings.push({severity:'warn',message:`Clip "${clip.name}" bone ${id} has key outside duration.`});
    for(const [id,arr] of Object.entries(clip.slotTracks||{}))for(const k of arr)if(k.t<-.0005||k.t>dur+.0005)warnings.push({severity:'warn',message:`Clip "${clip.name}" slot ${id} has key outside duration.`});
  }
  const mirrorCandidates=state.bones.filter(b=>/(_|\.|-)L($|_|\.|-)|(_|\.|-)R($|_|\.|-)|left|right/i.test(b.name));
  const missingPairs=mirrorCandidates.filter(b=>!findBoneByName(counterpartName(b.name)));if(missingPairs.length)warnings.push({severity:'info',message:`${missingPairs.length} left/right named bone(s) have no mirror pair.`});
  state.health={warnings,lastRun:new Date().toISOString()};renderProjectHealth();return warnings;
}
function fixOrphanKeys(){
  pushUndo();const boneIds=new Set(state.bones.map(b=>b.id));const slotIds=new Set(state.slots.map(s=>s.id));let changedAny=false;
  for(const clip of state.animations.length?state.animations:[state.anim]){
    for(const id of Object.keys(clip.boneTracks||{})){if(!boneIds.has(id)){delete clip.boneTracks[id];changedAny=true;}else{const before=clip.boneTracks[id].length;clip.boneTracks[id]=clip.boneTracks[id].filter(k=>k.t>=0&&k.t<=clip.duration);changedAny ||= before!==clip.boneTracks[id].length;}}
    for(const id of Object.keys(clip.slotTracks||{})){if(!slotIds.has(id)){delete clip.slotTracks[id];changedAny=true;}else{const before=clip.slotTracks[id].length;clip.slotTracks[id]=clip.slotTracks[id].filter(k=>k.t>=0&&k.t<=clip.duration);changedAny ||= before!==clip.slotTracks[id].length;}}
  }
  if(!changedAny){state.undo.pop();}else changed();validateProject();renderAll();return changedAny;
}

function mirrorSelectedBone(){
  const b=selectedBone();if(!b||isProjectRootBone(b)||isObjectRootBone(b))return false;
  pushUndo();const out=mirrorBoneBranch(b.id,{branch:false});
  if(!out){state.undo.pop();return false;}
  changed();renderAll();return true;
}
function mirrorSelectedBoneBranch(){
  const b=selectedBone();if(!b||isProjectRootBone(b)||isObjectRootBone(b))return false;
  pushUndo();const out=mirrorBoneBranch(b.id,{branch:true});
  if(!out){state.undo.pop();return false;}
  changed();renderAll();return true;
}
