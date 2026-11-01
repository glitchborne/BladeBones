'use strict';
// Animation keyframes, interpolation curves, key clipboard, multi-key editing and playback evaluation.
function makeDefaultCurve(type='smooth'){
  if(type==='linear')return{type:'linear',x1:0,y1:0,x2:1,y2:1};
  if(type==='hold')return{type:'hold',x1:0,y1:0,x2:1,y2:0};
  if(type==='bezier')return{type:'bezier',x1:.33,y1:0,x2:.67,y2:1};
  // Hermite is used by Elastic Smart Bake 3. It stores value velocities on the keys,
  // so long smooth spring arcs can be described with far fewer timeline keys.
  if(type==='hermite')return{type:'hermite'};
  return{type:'smooth',x1:.33,y1:0,x2:.67,y2:1};
}
function normalizeKeyCurve(k){if(!k.curve)k.curve=makeDefaultCurve();return k;}
function normalizeAnimationCurves(){
  for(const tracks of [state.anim.boneTracks,state.anim.slotTracks,state.anim.deformTracks]){
    for(const keys of Object.values(tracks||{})){
      if(Array.isArray(keys))keys.forEach(normalizeKeyCurve);
    }
  }
}
function cubicBezierCoord(t,a1,a2){const inv=1-t;return 3*inv*inv*t*a1+3*inv*t*t*a2+t*t*t;}
function cubicBezierDerivative(t,a1,a2){return 3*(1-t)*(1-t)*a1+6*(1-t)*t*(a2-a1)+3*t*t*(1-a2);}
function cubicBezierYForX(x,x1,y1,x2,y2){let t=clamp(x,0,1);for(let i=0;i<8;i++){const current=cubicBezierCoord(t,x1,x2)-x;const d=cubicBezierDerivative(t,x1,x2);if(Math.abs(current)<.0001||Math.abs(d)<.0001)break;t=clamp(t-current/d,0,1);}return clamp(cubicBezierCoord(t,y1,y2),0,1);}
function easeFromCurve(a,b,u){const c=a?.curve||makeDefaultCurve();if(c.type==='linear')return u;if(c.type==='hold')return 0;if(c.type==='bezier')return cubicBezierYForX(u,Number(c.x1??.33),Number(c.y1??0),Number(c.x2??.67),Number(c.y2??1));return u*u*(3-2*u);}
function hermiteValue(p0,p1,m0,m1,dt,u){
  const u2=u*u,u3=u2*u;
  const h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
  return h00*p0+h10*dt*m0+h01*p1+h11*dt*m1;
}
function tangentValue(tan,key){return tan&&Number.isFinite(Number(tan[key]))?Number(tan[key]):0;}
function sampleHermiteBoneSegment(a,b,t,u){
  const dt=Math.max(.00001,b.t-a.t),out=a.outTangent||a.curve?.outTangent||{},inn=b.inTangent||b.curve?.inTangent||{};
  const r1=Number(a.r||0)+normAngle(Number(b.r||0)-Number(a.r||0));
  return{
    t,
    x:hermiteValue(Number(a.x||0),Number(b.x||0),tangentValue(out,'x'),tangentValue(inn,'x'),dt,u),
    y:hermiteValue(Number(a.y||0),Number(b.y||0),tangentValue(out,'y'),tangentValue(inn,'y'),dt,u),
    r:normAngle(hermiteValue(Number(a.r||0),r1,tangentValue(out,'r'),tangentValue(inn,'r'),dt,u)),
    len:Math.max(4,hermiteValue(Number(a.len||80),Number(b.len||80),tangentValue(out,'len'),tangentValue(inn,'len'),dt,u)),
    sx:hermiteValue(Number(a.sx??1),Number(b.sx??1),tangentValue(out,'sx'),tangentValue(inn,'sx'),dt,u),
    sy:hermiteValue(Number(a.sy??1),Number(b.sy??1),tangentValue(out,'sy'),tangentValue(inn,'sy'),dt,u)
  };
}
function chainToRoot(id){const out=[];let b=bone(id);while(b){if(!isProjectRootBone(b))out.push(b);b=bone(b.parent);}return out.reverse();}
function snapTime(t){const fps=Math.max(1,Number(state.anim.fps||24));return state.timeline.snapFrames?Math.round(t*fps)/fps:t;}
function roundTime(t){return Math.round(clamp(snapTime(t),0,state.anim.duration)*1000)/1000;}
function quantizeTimelineTime(t,snap=state.timeline.snapFrames){const fps=Math.max(1,Number(state.anim.fps||24));const v=snap?Math.round(t*fps)/fps:t;return Math.round(clamp(v,0,state.anim.duration)*1000)/1000;}
function playbackRange(){const dur=Math.max(.001,Number(state.anim.duration||1));let start=state.timeline.useRange?Number(state.timeline.rangeStart||0):0;let end=state.timeline.useRange?Number(state.timeline.rangeEnd||dur):dur;start=clamp(start,0,dur);end=clamp(end,0,dur);if(end<=start)end=dur;return{start,end,duration:Math.max(.001,end-start)};}
function normalizeAnimationTime(t,wrap=state.loop){const dur=Math.max(.001,Number(state.anim.duration||1));if(wrap)return((t%dur)+dur)%dur;return clamp(t,0,dur);}
function timeForEvaluation(t,wrap=false,snap=true){const normalized=normalizeAnimationTime(t,wrap);const value=snap?roundTime(normalized):clamp(normalized,0,state.anim.duration);return Math.round(value*1000)/1000;}

function getTrackArray(kind,id){
  if(kind==='bone')return state.anim.boneTracks?.[id]||[];
  if(kind==='slot')return state.anim.slotTracks?.[id]||[];
  if(kind==='deform')return state.anim.deformTracks?.[id]||[];
  return[];
}
function ensureTrackArray(kind,id){
  if(kind==='bone')return state.anim.boneTracks[id]||(state.anim.boneTracks[id]=[]);
  if(kind==='slot')return state.anim.slotTracks[id]||(state.anim.slotTracks[id]=[]);
  if(kind==='deform'){state.anim.deformTracks=state.anim.deformTracks||{};return state.anim.deformTracks[id]||(state.anim.deformTracks[id]=[]);}
  return null;
}
function keyRef(kind,id,t){return{kind,id,time:Math.round(Number(t||0)*1000)/1000};}
function sameKeyRef(a,b,eps=.002){return a&&b&&a.kind===b.kind&&a.id===b.id&&Math.abs(Number(a.time)-Number(b.time))<=eps;}
function keySelectionHas(kind,id,t){return (state.selectedKeys||[]).some(ref=>sameKeyRef(ref,{kind,id,time:t}));}
function resolveKeyRef(ref,eps=.003){
  if(!ref||!ref.kind)return null;
  const arr=getTrackArray(ref.kind,ref.id);
  const key=arr.find(k=>Math.abs(k.t-ref.time)<=eps);
  return key?{kind:ref.kind,id:ref.id,key,arr}:null;
}
function selectedKeyRefs(){
  const out=[];
  for(const ref of state.selectedKeys||[]){const found=resolveKeyRef(ref);if(found)out.push(found);}
  return out;
}
function cleanSelectedKeys(){
  const seen=new Set(),out=[];
  for(const ref of state.selectedKeys||[]){const found=resolveKeyRef(ref);if(!found)continue;const sig=found.kind+'|'+found.id+'|'+Math.round(found.key.t*1000);if(seen.has(sig))continue;seen.add(sig);out.push(keyRef(found.kind,found.id,found.key.t));}
  state.selectedKeys=out;
  if(!out.length)state.keySelection={kind:null,id:null,time:null};
  else state.keySelection={kind:out[out.length-1].kind,id:out[out.length-1].id,time:out[out.length-1].time};
}
function setKeySelection(refs,append=false){
  const list=Array.isArray(refs)?refs:[refs];
  const base=append?[...(state.selectedKeys||[])]:[];
  for(const ref of list){if(!ref||!ref.kind)continue;const r=keyRef(ref.kind,ref.id,ref.time??ref.t);const i=base.findIndex(x=>sameKeyRef(x,r));if(i>=0)base.splice(i,1);else base.push(r);}
  state.selectedKeys=base;
  cleanSelectedKeys();
}
function selectSingleKey(kind,id,t){if(kind==='deform'){state.selected={type:'slot',id};state.selectedBones=[];state.inspectorTab='deform';state.meshEdit.tool='deform';}else {state.selected={type:kind,id};state.selectedBones=kind==='bone'?[id]:[];}state.selectedKeys=[keyRef(kind,id,t)];state.keySelection={kind,id,time:keyRef(kind,id,t).time};}
function clearKeySelection(){state.selectedKeys=[];state.keySelection={kind:null,id:null,time:null};renderTimeline?.();renderKeyInfo?.();}
function sortTrackKeys(kind,id){const arr=getTrackArray(kind,id);if(arr)arr.sort((a,b)=>a.t-b.t);}
function sortAllAnimationKeys(){Object.values(state.anim.boneTracks||{}).forEach(a=>a.sort((x,y)=>x.t-y.t));Object.values(state.anim.slotTracks||{}).forEach(a=>a.sort((x,y)=>x.t-y.t));Object.values(state.anim.deformTracks||{}).forEach(a=>a.sort((x,y)=>x.t-y.t));}
function mergeDuplicateKeysOnTrack(kind,id){
  const arr=getTrackArray(kind,id);if(!arr.length)return;
  arr.sort((a,b)=>a.t-b.t);const out=[];
  for(const k of arr){const last=out[out.length-1];if(last&&Math.abs(last.t-k.t)<.0005)out[out.length-1]=k;else out.push(k);}
  if(kind==='bone')state.anim.boneTracks[id]=out;if(kind==='slot')state.anim.slotTracks[id]=out;if(kind==='deform'){state.anim.deformTracks=state.anim.deformTracks||{};state.anim.deformTracks[id]=out;}
}
function mergeDuplicateKeysForSelection(){const touched=new Set();for(const ref of state.selectedKeys||[])touched.add(ref.kind+'|'+ref.id);for(const sig of touched){const[kind,id]=sig.split('|');mergeDuplicateKeysOnTrack(kind,id);}cleanSelectedKeys();}

function writeBoneKey(id,t=state.currentTime){const b=bone(id);if(!b||isProjectRootBone(b))return false;const qt=roundTime(t);const k={t:qt,x:b.local.x,y:b.local.y,r:normAngle(b.local.r),len:b.local.len,sx:Number(b.local.sx??1)||1,sy:Number(b.local.sy??1)||1,curve:makeDefaultCurve()};const arr=state.anim.boneTracks[id]||(state.anim.boneTracks[id]=[]);const i=arr.findIndex(x=>Math.abs(x.t-k.t)<.0005);if(i>=0){k.curve=arr[i].curve||makeDefaultCurve();arr[i]=k;}else arr.push(k);arr.sort((a,b)=>a.t-b.t);return true;}
function keyBone(id=state.selected.id,t=state.currentTime,includeParents=true){if(!id)return;const list=(includeParents?chainToRoot(id):[bone(id)].filter(Boolean)).filter(b=>!isProjectRootBone(b));if(!list.length)return;pushUndo();for(const b of list)writeBoneKey(b.id,t);const kt=roundTime(t);state.selectedKeys=list.map(b=>keyRef('bone',b.id,kt));state.keySelection={kind:'bone',id,time:kt};renderTimeline();changed();}
function writeSlotKey(id,t=state.currentTime){const s=slot(id);if(!s)return false;const qt=roundTime(t);const k={t:qt,visible:s.pose.visible,alpha:s.pose.alpha,attachment:s.pose.attachment,tint:normalizeHex(s.pose.tint||s.tint||'#ffffff'),tintAlpha:clamp(Number(s.pose.tintAlpha??s.tintAlpha??0),0,1),blendMode:s.pose.blendMode||s.blendMode||'normal',x:s.local.x,y:s.local.y,r:normAngle(s.local.r||0),sx:s.local.sx||1,sy:s.local.sy||1,curve:makeDefaultCurve()};const arr=state.anim.slotTracks[id]||(state.anim.slotTracks[id]=[]);const i=arr.findIndex(x=>Math.abs(x.t-k.t)<.0005);if(i>=0){k.curve=arr[i].curve||makeDefaultCurve();arr[i]=k;}else arr.push(k);arr.sort((a,b)=>a.t-b.t);return true;}
function writeDeformKey(id,t=state.currentTime){
  const s=slot(id);if(!s)return false;const m=ensureSlotMesh(s);if(!m||!m.vertices?.length)return false;
  state.anim.deformTracks=state.anim.deformTracks||{};const qt=roundTime(t);
  const k={t:qt,offsets:cloneSlotDeformOffsets(s),curve:makeDefaultCurve()};
  const arr=state.anim.deformTracks[id]||(state.anim.deformTracks[id]=[]);const i=arr.findIndex(x=>Math.abs(x.t-k.t)<.0005);
  if(i>=0){k.curve=arr[i].curve||makeDefaultCurve();arr[i]=k;}else arr.push(k);arr.sort((a,b)=>a.t-b.t);return true;
}
function deleteDeformKeyAtTime(id,t=state.currentTime){const arr=state.anim.deformTracks?.[id];if(!arr)return false;const tt=roundTime(t);const next=arr.filter(k=>Math.abs(k.t-tt)>.012);if(next.length)state.anim.deformTracks[id]=next;else delete state.anim.deformTracks[id];return true;}
function sampleDeformTrack(keys,t,count=0){
  if(!keys||!keys.length)return makeZeroDeformOffsets(count);keys.forEach(normalizeKeyCurve);
  const clean=keys.map(k=>({ ...k, offsets:Array.isArray(k.offsets)?k.offsets:[] })).sort((a,b)=>a.t-b.t);
  const make=(k)=>makeZeroDeformOffsets(count).map((o,i)=>({x:Number(k.offsets[i]?.x||0),y:Number(k.offsets[i]?.y||0)}));
  if(clean.length===1||t<=clean[0].t)return make(clean[0]);
  if(t>=clean[clean.length-1].t)return make(clean[clean.length-1]);
  let lo=0,hi=clean.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(clean[m].t<=t)lo=m;else hi=m;}
  const a=clean[lo],b=clean[hi],u=(t-a.t)/Math.max(.00001,b.t-a.t),e=easeFromCurve(a,b,u);const out=[];
  for(let i=0;i<count;i++){out.push({x:lerp(Number(a.offsets[i]?.x||0),Number(b.offsets[i]?.x||0),e),y:lerp(Number(a.offsets[i]?.y||0),Number(b.offsets[i]?.y||0),e)});}return out;
}
function keySelected(){if(state.selected.type==='slot'){pushUndo();const kt=roundTime(state.currentTime);if(state.inspectorTab==='deform'||state.meshEdit?.tool==='deform'){writeDeformKey(state.selected.id);selectSingleKey('deform',state.selected.id,kt);}else{writeSlotKey(state.selected.id);selectSingleKey('slot',state.selected.id,kt);}renderTimeline();changed();}else if(state.selected.type==='bone'){const ids=typeof selectedBoneIds==='function'?selectedBoneIds({exact:true}):[state.selected.id];if(ids.length>1){pushUndo();const kt=roundTime(state.currentTime);const refs=[];for(const id of ids){if(bone(id)&&!isProjectRootBone(bone(id))){writeBoneKey(id,state.currentTime);refs.push(keyRef('bone',id,kt));}}state.selectedKeys=refs;state.keySelection={kind:'bone',id:ids[0]||null,time:kt};renderTimeline();changed();}else keyBone(state.selected.id);}}
function keyAll(){pushUndo();const kt=roundTime(state.currentTime);for(const b of state.bones)writeBoneKey(b.id,kt);for(const s of state.slots)writeSlotKey(s.id,kt);for(const s of state.slots)if(currentSlotDeformHasAny(s))writeDeformKey(s.id,kt);state.selectedKeys=[...state.bones.filter(b=>!isProjectRootBone(b)).map(b=>keyRef('bone',b.id,kt)),...state.slots.map(s=>keyRef('slot',s.id,kt)),...state.slots.filter(s=>currentSlotDeformHasAny(s)).map(s=>keyRef('deform',s.id,kt))];state.keySelection={kind:'summary',id:null,time:kt};renderTimeline();changed();}
function currentTrackKeys(){if(state.selected.type==='bone')return state.anim.boneTracks[state.selected.id]||[];if(state.selected.type==='slot'){if(state.inspectorTab==='deform'||state.meshEdit?.tool==='deform')return state.anim.deformTracks?.[state.selected.id]||[];return state.anim.slotTracks[state.selected.id]||[];}return[];}
function currentKey(eps=.014){
  if(state.keySelection.kind&&state.keySelection.id){const f=resolveKeyRef(state.keySelection,eps);if(f)return f.key;}
  const t=roundTime(state.currentTime);return currentTrackKeys().find(k=>Math.abs(k.t-t)<=eps)||null;
}
function deleteKey(){
  const refs=selectedKeyRefs();
  if(refs.length){pushUndo();for(const ref of refs){const i=ref.arr.indexOf(ref.key);if(i>=0)ref.arr.splice(i,1);}for(const sig of new Set(refs.map(r=>r.kind+'|'+r.id))){const parts=sig.split('|');const arr=getTrackArray(parts[0],parts[1]);if(parts[0]==='bone'&&!arr.length)delete state.anim.boneTracks[parts[1]];if(parts[0]==='slot'&&!arr.length)delete state.anim.slotTracks[parts[1]];if(parts[0]==='deform'&&!arr.length&&state.anim.deformTracks)delete state.anim.deformTracks[parts[1]];}state.selectedKeys=[];state.keySelection={kind:null,id:null,time:null};renderTimeline();changed();return;}
  pushUndo();const t=roundTime(state.currentTime);if(state.selected.type==='bone'){const id=state.selected.id;if(state.anim.boneTracks[id]){state.anim.boneTracks[id]=state.anim.boneTracks[id].filter(k=>Math.abs(k.t-t)>0.012);if(!state.anim.boneTracks[id].length)delete state.anim.boneTracks[id];}}else if(state.selected.type==='slot'){const id=state.selected.id;if(state.inspectorTab==='deform'||state.meshEdit?.tool==='deform')deleteDeformKeyAtTime(id,t);else if(state.anim.slotTracks[id]){state.anim.slotTracks[id]=state.anim.slotTracks[id].filter(k=>Math.abs(k.t-t)>0.012);if(!state.anim.slotTracks[id].length)delete state.anim.slotTracks[id];}}state.keySelection={kind:null,id:null,time:null};renderTimeline();changed();
}
function ensureCurrentKey(){let k=currentKey(.02);if(k)return k;if(state.selected.type==='bone'){writeBoneKey(state.selected.id,state.currentTime);return currentKey(.02);}if(state.selected.type==='slot'){if(state.inspectorTab==='deform'||state.meshEdit?.tool==='deform')writeDeformKey(state.selected.id,state.currentTime);else writeSlotKey(state.selected.id,state.currentTime);return currentKey(.02);}return null;}
function setCurrentKeyCurve(type){if(!['smooth','linear','hold','bezier','hermite'].includes(type))type='smooth';pushUndo();const refs=selectedKeyRefs();if(refs.length){for(const ref of refs)ref.key.curve=makeDefaultCurve(type);changed();renderTimeline();renderKeyInfo();return;}const k=ensureCurrentKey();if(!k)return;k.curve=makeDefaultCurve(type);const kk=(state.selected.type==='slot'&&(state.inspectorTab==='deform'||state.meshEdit?.tool==='deform'))?'deform':state.selected.type;state.keySelection={kind:kk,id:state.selected.id,time:k.t};state.selectedKeys=[keyRef(kk,state.selected.id,k.t)];changed();renderTimeline();renderKeyInfo();}
function copyCurrentKey(){
  const refs=selectedKeyRefs();
  if(refs.length){const min=Math.min(...refs.map(r=>r.key.t));state.keyClipboard={mode:'multi',baseTime:min,keys:refs.map(r=>({kind:r.kind,id:r.id,key:JSON.parse(JSON.stringify(r.key)),offset:Math.round((r.key.t-min)*1000)/1000}))};renderKeyInfo();return true;}
  const k=currentKey(.02);if(!k)return false;state.keyClipboard={mode:'single',kind:(state.selected.type==='slot'&&(state.inspectorTab==='deform'||state.meshEdit?.tool==='deform'))?'deform':state.selected.type,id:state.selected.id,key:JSON.parse(JSON.stringify(k))};renderKeyInfo();return true;
}
function writeRawKey(kind,id,key){const arr=ensureTrackArray(kind,id);if(!arr)return false;const i=arr.findIndex(k=>Math.abs(k.t-key.t)<.0005);if(i>=0)arr[i]=key;else arr.push(key);arr.sort((a,b)=>a.t-b.t);return true;}
function pasteKeyAtTime(){
  if(!state.keyClipboard)return false;
  pushUndo();const selected=[];
  if(state.keyClipboard.mode==='multi'){
    for(const item of state.keyClipboard.keys){const src=JSON.parse(JSON.stringify(item.key));src.t=roundTime(state.currentTime+item.offset);writeRawKey(item.kind,item.id,src);selected.push(keyRef(item.kind,item.id,src.t));}
  }else{
    const kind=(state.selected.type==='slot'&&(state.inspectorTab==='deform'||state.meshEdit?.tool==='deform'))?'deform':state.selected.type;if(kind!=='bone'&&kind!=='slot'&&kind!=='deform'){state.undo.pop();return false;}const src=JSON.parse(JSON.stringify(state.keyClipboard.key));src.t=roundTime(state.currentTime);writeRawKey(kind,state.selected.id,src);selected.push(keyRef(kind,state.selected.id,src.t));
  }
  state.selectedKeys=selected;state.keySelection=selected[selected.length-1]||{kind:null,id:null,time:null};changed();renderTimeline();renderKeyInfo();return true;
}
function nudgeSelectedKeys(frames){
  const refs=selectedKeyRefs();if(!refs.length)return false;pushUndo();const fps=Math.max(1,Number(state.anim.fps||24));const dt=frames/fps;const newRefs=[];for(const ref of refs){ref.key.t=quantizeTimelineTime(ref.key.t+dt,true);newRefs.push(keyRef(ref.kind,ref.id,ref.key.t));}sortAllAnimationKeys();state.selectedKeys=newRefs;mergeDuplicateKeysForSelection();changed();renderTimeline();renderKeyInfo();return true;
}
function scaleSelectedKeys(percent=100,pivotMode='first'){
  const refs=selectedKeyRefs();if(refs.length<2)return false;pushUndo();const times=refs.map(r=>r.key.t);const min=Math.min(...times),max=Math.max(...times);const factor=clamp(Number(percent||100)/100,.01,20);const pivot=pivotMode==='center'?(min+max)/2:min;const newRefs=[];for(const ref of refs){ref.key.t=quantizeTimelineTime(pivot+(ref.key.t-pivot)*factor,true);newRefs.push(keyRef(ref.kind,ref.id,ref.key.t));}sortAllAnimationKeys();state.selectedKeys=newRefs;mergeDuplicateKeysForSelection();changed();renderTimeline();renderKeyInfo();return true;
}
function reverseSelectedKeys(){
  const refs=selectedKeyRefs();if(refs.length<2)return false;pushUndo();const times=refs.map(r=>r.key.t);const min=Math.min(...times),max=Math.max(...times);const newRefs=[];for(const ref of refs){ref.key.t=quantizeTimelineTime(max-(ref.key.t-min),true);newRefs.push(keyRef(ref.kind,ref.id,ref.key.t));}sortAllAnimationKeys();state.selectedKeys=newRefs;mergeDuplicateKeysForSelection();changed();renderTimeline();renderKeyInfo();return true;
}
function selectKeysInRange(start,end,{visibleOnly=true}={}){
  const a=Math.min(start,end),b=Math.max(start,end);const refs=[];
  if(!visibleOnly||state.timeline.channels?.bones!==false){for(const [id,arr] of Object.entries(state.anim.boneTracks||{}))for(const k of arr)if(k.t>=a-.0005&&k.t<=b+.0005)refs.push(keyRef('bone',id,k.t));}
  if(!visibleOnly||state.timeline.channels?.slots!==false){for(const [id,arr] of Object.entries(state.anim.slotTracks||{}))for(const k of arr)if(k.t>=a-.0005&&k.t<=b+.0005)refs.push(keyRef('slot',id,k.t));}
  if(!visibleOnly||state.timeline.channels?.deform!==false){for(const [id,arr] of Object.entries(state.anim.deformTracks||{}))for(const k of arr)if(k.t>=a-.0005&&k.t<=b+.0005)refs.push(keyRef('deform',id,k.t));}
  state.selectedKeys=refs;cleanSelectedKeys();renderTimeline();renderKeyInfo();return refs.length;
}

function sampleBoneTrack(keys,t){
  if(!keys||!keys.length)return null;keys.forEach(normalizeKeyCurve);
  if(keys.length===1||t<=keys[0].t)return{...keys[0]};
  if(t>=keys[keys.length-1].t)return{...keys[keys.length-1]};
  let lo=0,hi=keys.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(keys[m].t<=t)lo=m;else hi=m;}
  const a=keys[lo],b=keys[hi];const u=(t-a.t)/Math.max(.00001,b.t-a.t);
  if((a.curve?.type||'')==='hermite')return sampleHermiteBoneSegment(a,b,t,u);
  const s=easeFromCurve(a,b,u);return{t,x:lerp(a.x,b.x,s),y:lerp(a.y,b.y,s),r:lerpAngle(a.r,b.r,s),len:lerp(a.len,b.len,s),sx:lerp(Number(a.sx??1),Number(b.sx??1),s),sy:lerp(Number(a.sy??1),Number(b.sy??1),s)};
}
function sampleSlotTrack(keys,t){if(!keys||!keys.length)return null;keys.forEach(normalizeKeyCurve);if(keys.length===1||t<=keys[0].t)return{...keys[0],tint:normalizeHex(keys[0].tint||'#ffffff'),tintAlpha:clamp(Number(keys[0].tintAlpha??0),0,1),blendMode:keys[0].blendMode||'normal'};if(t>=keys[keys.length-1].t){const k=keys[keys.length-1];return{...k,tint:normalizeHex(k.tint||'#ffffff'),tintAlpha:clamp(Number(k.tintAlpha??0),0,1),blendMode:k.blendMode||'normal'};}let lo=0,hi=keys.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(keys[m].t<=t)lo=m;else hi=m;}const a=keys[lo],b=keys[hi];const u=(t-a.t)/Math.max(.00001,b.t-a.t),s=easeFromCurve(a,b,u);return{t,visible:a.visible,attachment:a.attachment,alpha:lerp(Number(a.alpha??1),Number(b.alpha??1),s),tint:lerpColor(a.tint||'#ffffff',b.tint||a.tint||'#ffffff',s),tintAlpha:lerp(Number(a.tintAlpha??0),Number(b.tintAlpha??a.tintAlpha??0),s),blendMode:(s<.5?(a.blendMode||'normal'):(b.blendMode||a.blendMode||'normal')),x:lerp(Number(a.x??0),Number(b.x??a.x??0),s),y:lerp(Number(a.y??0),Number(b.y??a.y??0),s),r:lerpAngle(Number(a.r??0),Number(b.r??a.r??0),s),sx:lerp(Number(a.sx??1),Number(b.sx??a.sx??1),s),sy:lerp(Number(a.sy??1),Number(b.sy??a.sy??1),s)};}
function capturePose(){return{time:state.currentTime,bones:state.bones.map(b=>({id:b.id,local:{...b.local}})),slots:state.slots.map(s=>({id:s.id,pose:{...s.pose},local:{...s.local},deform:{offsets:cloneSlotDeformOffsets(s)}}))};}
function restorePose(snap){for(const rec of snap.bones){const b=bone(rec.id);if(b)b.local={...rec.local};}for(const rec of snap.slots){const s=slot(rec.id);if(s){s.pose={...rec.pose};if(rec.local)s.local={...rec.local};if(rec.deform)s.deform=JSON.parse(JSON.stringify(rec.deform));}}state.currentTime=snap.time;}
function applyAnimationPose(time){
  for(const b of state.bones)b.local={...b.rest};
  for(const s of state.slots){if(typeof ensureSlotSetupLocal==='function'){const base=ensureSlotSetupLocal(s);if(base)s.local=copySlotLocal(base);}s.pose=copySlotPose(s);clearSlotDeformPose(s);}
  for(const [id,keys]of Object.entries(state.anim.boneTracks||{})){const b=bone(id),sm=sampleBoneTrack(keys,time);if(!b||!sm||isProjectRootBone(b))continue;b.local.x=sm.x;b.local.y=sm.y;b.local.r=sm.r;b.local.len=sm.len;b.local.sx=Number(sm.sx??1)||1;b.local.sy=Number(sm.sy??1)||1;}
  lockProjectRootTransform(projectRoot());
  for(const [id,keys]of Object.entries(state.anim.slotTracks||{})){const s=slot(id),sm=sampleSlotTrack(keys,time);if(!s||!sm)continue;s.pose.visible=!!sm.visible;s.pose.alpha=sm.alpha;s.pose.attachment=sm.attachment;s.pose.tint=normalizeHex(sm.tint||s.pose.tint||'#ffffff');s.pose.tintAlpha=clamp(Number(sm.tintAlpha??s.pose.tintAlpha??0),0,1);s.pose.blendMode=sm.blendMode||s.pose.blendMode||'normal';if(sm.x!==undefined){s.local.x=sm.x;s.local.y=sm.y;s.local.r=sm.r;s.local.sx=sm.sx;s.local.sy=sm.sy;}}
  for(const [id,keys]of Object.entries(state.anim.deformTracks||{})){const s=slot(id);const m=ensureSlotMesh(s);if(!s||!m)continue;s.deform={offsets:sampleDeformTrack(keys,time,m.vertices.length)};}
}
function evaluate(t,wrap=false,snap=true){const time=timeForEvaluation(t,wrap,snap);applyAnimationPose(time);state.currentTime=time;syncTime();renderInspector();}
function setTime(t,evalPose=true,snap=true){state.currentTime=snap?roundTime(t):timeForEvaluation(t,false,false);if(evalPose)evaluate(state.currentTime,false,snap);syncTime();renderTimeline();}
function allKeyTimes(){const set=new Set();Object.values(state.anim.boneTracks||{}).forEach(a=>a.forEach(k=>set.add(k.t)));Object.values(state.anim.slotTracks||{}).forEach(a=>a.forEach(k=>set.add(k.t)));Object.values(state.anim.deformTracks||{}).forEach(a=>a.forEach(k=>set.add(k.t)));(state.anim.events||[]).forEach(e=>set.add(e.t));return[...set].sort((a,b)=>a-b);}
function jumpKey(dir){const times=allKeyTimes();if(!times.length)return;const eps=.001;let target;if(dir<0)target=[...times].reverse().find(t=>t<state.currentTime-eps)??times[times.length-1];else target=times.find(t=>t>state.currentTime+eps)??times[0];setTime(target,true);}
