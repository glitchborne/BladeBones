'use strict';
const PROJECT_SAVE_VERSION='indie-2d-v11-stable-runtime-export';
const RUNTIME_SCHEMA_ID='indie-2d-runtime-v11';
const RUNTIME_SCHEMA_VERSION='11.0.0';

// Import/export, autosave and image cache refresh.
function clipForExport(c){return{id:c.id,name:c.name,duration:c.duration,fps:c.fps,boneTracks:c.boneTracks||{},slotTracks:c.slotTracks||{},deformTracks:c.deformTracks||{},cameraTracks:c.cameraTracks||{},events:c.events||[]};}
function normalizeImportedClip(c,i=0){const id=String(c.id||('clip'+(i+1)));return{id,name:String(c.name||c.id||('anim_'+(i+1))),duration:Math.max(.1,Number(c.duration||1.2)),fps:Math.max(1,Number(c.fps||24)),boneTracks:c.boneTracks||c.tracks||{},slotTracks:c.slotTracks||{},deformTracks:c.deformTracks||{},events:Array.isArray(c.events)?c.events:[]};}
function exportData(){ensureClipStore();return{version:PROJECT_SAVE_VERSION,objects:state.objects.map(o=>({id:o.id,name:o.name,root:o.root,parentSlot:o.parentSlot||null,visible:o.visible!==false})),bones:state.bones.map(b=>({id:b.id,name:b.name,parent:b.parent,objectId:b.objectId||null,objectRoot:!!b.objectRoot,isRoot:!!b.isRoot,moveOnly:!!b.moveOnly,connected:!!b.connected,role:inferBoneRole(b),affectWeights:b.affectWeights!==false,lockMove:!!b.lockMove,lockRotate:!!b.lockRotate,lockScale:!!b.lockScale,lockLength:!!b.lockLength,elastic:normalizeElasticSettings(b.elastic||{}),rest:b.rest,local:b.local,width:b.width,color:b.color,shape:normalizeBoneShape(b.shape)})),slots:state.slots.map(s=>({id:s.id,name:s.name,bone:s.bone,parentBone:s.bone,objectId:s.objectId||null,attachment:s.attachment,visible:s.visible,alpha:s.alpha,tint:s.tint,tintAlpha:s.tintAlpha,blendMode:s.blendMode,local:s.local,setupLocal:s.setupLocal||s.local,mesh:ensureSlotMesh(s),pose:s.pose})),attachments:state.attachments,markers:state.markers,poses:state.poses,animation:clipForExport(state.anim),animations:state.animations.map(clipForExport),activeAnimationId:state.activeAnimationId,editor:{projectRootId:state.projectRootId,view:state.view,activeObjectId:state.activeObjectId,lastObjectId:state.lastObjectId,pick:state.pick,onion:state.onion,timeline:state.timeline,layout:state.layout,art:state.art,outliner:state.outliner,inspectorTab:state.inspectorTab,color:state.color,rig:state.rig||{},elastic:{preview:state.elastic?.preview!==false,bakeVisualError:state.elastic?.bakeVisualError??1,bakeMaxInterval:state.elastic?.bakeMaxInterval??.42},meshEdit:{enabled:false,workbenchTab:state.meshEdit?.workbenchTab||'binding',bindingTab:state.meshEdit?.bindingTab||'workflow',selectionMode:state.meshEdit?.selectionMode||'vertex',actionTool:'select',weightTool:state.meshEdit?.weightTool||'paint',showWeights:state.meshEdit?.showWeights!==false,maxInfluences:state.meshEdit?.maxInfluences||4,weightBoneId:state.meshEdit?.weightBoneId||null,weightBrushSize:state.meshEdit?.weightBrushSize||46,weightBrushStrength:state.meshEdit?.weightBrushStrength??.35,weightBrushValue:state.meshEdit?.weightBrushValue??1,weightBrushMode:state.meshEdit?.weightBrushMode||'add',weightBrushSelectedOnly:state.meshEdit?.weightBrushSelectedOnly===true,weightAdjustSensitivity:state.meshEdit?.weightAdjustSensitivity??.005,weightVertexDisplay:state.meshEdit?.weightVertexDisplay||'activeFill',showDiagnostics:state.meshEdit?.showDiagnostics!==false,weightMirrorAxis:state.meshEdit?.weightMirrorAxis||'slot',weightMirrorDirection:state.meshEdit?.weightMirrorDirection||'selected'},lastSlotId:state.lastSlotId||null,selected:state.selected||{type:'bone',id:null},selectedBones:(state.selectedBones||[]).filter(id=>bone(id))}};}

function cloneRuntimeValue(v){return JSON.parse(JSON.stringify(v));}
function runtimeNum(v,fb=0){const n=Number(v);return Number.isFinite(n)?n:fb;}
function runtimeRound(v,places=4){const n=runtimeNum(v,0);const m=Math.pow(10,places);return Math.round(n*m)/m;}
function cleanRuntimeTransform(t,defaults={}){
  const out={};
  const src=t||{};
  for(const k of Object.keys(defaults))out[k]=runtimeRound(src[k]??defaults[k]);
  return out;
}
function cleanRuntimeSlotSetup(s){return{
  x:runtimeRound((s.setupLocal||s.local)?.x||0),y:runtimeRound((s.setupLocal||s.local)?.y||0),r:runtimeRound((s.setupLocal||s.local)?.r||0),
  sx:runtimeRound((s.setupLocal||s.local)?.sx??1),sy:runtimeRound((s.setupLocal||s.local)?.sy??1),
  alpha:clamp(runtimeNum(s.alpha??1,1),0,1),tint:s.tint||'#ffffff',tintAlpha:clamp(runtimeNum(s.tintAlpha??0,0),0,1),blendMode:s.blendMode||'normal',
  attachment:s.attachment||s.pose?.attachment||null,visible:s.visible!==false
};}
function cleanRuntimeWeight(w){return{bone:String(w.bone),w:runtimeRound(clamp(runtimeNum(w.w,0),0,1),6),bind:{x:runtimeRound(w.x||0),y:runtimeRound(w.y||0)}};}
function cleanRuntimeVertex(v){return{x:runtimeRound(v.x||0),y:runtimeRound(v.y||0),u:runtimeRound(clamp(runtimeNum(v.u??0,0),0,1),6),v:runtimeRound(clamp(runtimeNum(v.v??0,0),0,1),6)};}
function cleanRuntimeMeshForSlot(s){
  const mesh=ensureSlotMesh(s);if(!mesh)return null;ensureMeshTopology(mesh);
  const vertices=(mesh.vertices||[]).map(cleanRuntimeVertex);
  const weights=(mesh.vertices||[]).map(v=>(v.weights||[]).filter(w=>w&&w.bone&&runtimeNum(w.w,0)>0).map(cleanRuntimeWeight));
  const triangles=(mesh.triangles||[]).filter(tri=>meshTriangleIsValid(mesh,tri)).map(tri=>tri.map(i=>parseInt(i,10)));
  const edges=(mesh.edges||[]).map(e=>[parseInt(e[0],10),parseInt(e[1],10)]).filter(e=>e.length===2&&e.every(Number.isFinite));
  const hull=(mesh.hull||[]).map(i=>parseInt(i,10)).filter(i=>Number.isFinite(i)&&i>=0&&i<vertices.length);
  const deformSetup=s.deform&&Array.isArray(s.deform.offsets)?{offsets:s.deform.offsets.map(o=>({x:runtimeRound(o.x||0),y:runtimeRound(o.y||0)}))}:undefined;
  return{
    id:`${s.id}:mesh`,slot:s.id,enabled:!!mesh.enabled,version:3,vertexCount:vertices.length,triangleCount:triangles.length,
    vertices,weights,triangles,edges,hull,
    deformSetup,
    weightSumPolicy:'partial-allowed-rest-space'
  };
}
function cleanRuntimeClip(c){
  const src=clipForExport(c||{});
  const cleanTrackMap=(map)=>{const out={};for(const [id,arr] of Object.entries(map||{})){if(!Array.isArray(arr))continue;out[id]=arr.map(k=>{const ck={...cloneRuntimeValue(k)};if('t'in ck)ck.t=runtimeRound(ck.t,5);for(const key of ['x','y','r','sx','sy','len','alpha','tintAlpha'])if(key in ck)ck[key]=runtimeRound(ck[key],5);return ck;}).sort((a,b)=>runtimeNum(a.t,0)-runtimeNum(b.t,0));}return out;};
  const deformTracks={};
  for(const [slotId,arr] of Object.entries(src.deformTracks||{})){
    if(!Array.isArray(arr))continue;
    deformTracks[slotId]=arr.map(k=>({t:runtimeRound(k.t||0,5),offset:parseInt(k.offset||0,10)||0,offsets:Array.isArray(k.offsets)?k.offsets.map(o=>({x:runtimeRound(o.x||0),y:runtimeRound(o.y||0)})):[],curve:cloneRuntimeValue(k.curve||null)})).sort((a,b)=>a.t-b.t);
  }
  return{
    id:String(src.id||'clip1'),name:String(src.name||src.id||'clip'),duration:runtimeRound(Math.max(.001,runtimeNum(src.duration,1.2)),5),fps:runtimeRound(Math.max(1,runtimeNum(src.fps,24)),3),
    boneTracks:cleanTrackMap(src.boneTracks||{}),slotTracks:cleanTrackMap(src.slotTracks||{}),deformTracks,cameraTracks:cleanTrackMap(src.cameraTracks||{}),events:cloneRuntimeValue(src.events||[])
  };
}
function buildRuntimeDocument(){
  ensureClipStore();updateWorld(false);
  const objects=state.objects.map(o=>({id:String(o.id),name:String(o.name||o.id),root:o.root||null,parentSlot:o.parentSlot||null,visible:o.visible!==false,renderLayerId:o.renderLayerId||undefined}));
  const bones=state.bones.map(b=>({
    id:String(b.id),name:String(b.name||b.id),parent:b.parent||null,objectId:b.objectId||null,objectRoot:!!b.objectRoot,isRoot:!!b.isRoot,
    role:inferBoneRole(b),affectWeights:b.affectWeights!==false,connected:!!b.connected,moveOnly:!!b.moveOnly,
    rest:cleanRuntimeTransform(b.rest,{x:0,y:0,r:0,len:80,sx:1,sy:1}),width:runtimeRound(b.width||12),color:b.color||'#88ccff',shape:normalizeBoneShape(b.shape)
  }));
  const meshes=[];
  const slots=state.slots.map((s,drawOrder)=>{
    const m=cleanRuntimeMeshForSlot(s);if(m&&m.enabled)meshes.push(m);
    return{
      id:String(s.id),name:String(s.name||s.id),objectId:s.objectId||null,bone:slotParentBoneId(s),attachment:s.attachment||s.pose?.attachment||null,drawOrder,
      visible:s.visible!==false,setup:cleanRuntimeSlotSetup(s),mesh:(m&&m.enabled)?m.id:null
    };
  });
  const attachments=state.attachments.map(a=>({
    id:String(a.id),name:String(a.name||a.id),type:a.type||'rect',w:runtimeRound(a.w||0),h:runtimeRound(a.h||0),naturalW:a.naturalW?runtimeRound(a.naturalW):undefined,naturalH:a.naturalH?runtimeRound(a.naturalH):undefined,
    pivot:{x:runtimeRound(a.pivotX??.5,6),y:runtimeRound(a.pivotY??.5,6)},color:a.color||'#888888',src:a.src||''
  }));
  const setupPose={
    bones:Object.fromEntries(bones.map(b=>[b.id,cloneRuntimeValue(b.rest)])),
    slots:Object.fromEntries(slots.map(s=>[s.id,cloneRuntimeValue(s.setup)]))
  };
  const runtime={
    format:'indie-2d-runtime',schema:RUNTIME_SCHEMA_ID,version:11,schemaVersion:RUNTIME_SCHEMA_VERSION,sourceVersion:PROJECT_SAVE_VERSION,
    documentType:state.documentType||'game',projectName:state.projectName||'Untitled',
    units:{coordinates:'pixels',angles:'degrees',time:'seconds',axis:'2d-y-down'},
    objects,bones,slots,attachments,meshes,setupPose,
    markers:state.markers.map(m=>({id:String(m.id),type:m.type||'socket',name:String(m.name||m.id),bone:m.bone||null,x:runtimeRound(m.x||0),y:runtimeRound(m.y||0),r:runtimeRound(m.r||0),w:runtimeRound(m.w||0),h:runtimeRound(m.h||0),visible:m.visible!==false})),
    animations:state.animations.map(cleanRuntimeClip),activeAnimationId:state.activeAnimationId||state.anim?.id||null,
    meta:{exportedAt:new Date().toISOString(),generator:'Indie 2D Skeletal Editor',runtimeFormat:'stable-v11',migration:'current editor state -> runtime v11',editorOnlyExcluded:['editor','selection','hover','brush','layout','view','pick','diagnostics','testPose','undo','redo','workbench']}
  };
  if(state.documentType==='toon')runtime.toon=cloneRuntimeValue(ensureToon());
  return runtime;
}
function migrateRuntimePreviewToV11(projectData){
  const oldState=typeof state!=='undefined'?state:null;
  if(!oldState||typeof importData!=='function')throw Error('migrateRuntimePreviewToV11() requires the editor runtime context.');
  const snapshot=exportData();
  try{importData(projectData,false);return buildRuntimeDocument();}
  finally{importData(snapshot,false);}
}
function validateRuntimeDocument(doc=buildRuntimeDocument()){
  const warnings=[];const errors=[];
  if(doc.format!=='indie-2d-runtime')errors.push('Runtime document format must be indie-2d-runtime.');
  if(doc.schema!==RUNTIME_SCHEMA_ID)errors.push(`Runtime schema must be ${RUNTIME_SCHEMA_ID}.`);
  if(Number(doc.version)!==11)errors.push('Runtime version must be 11.');
  const boneIds=new Set((doc.bones||[]).map(b=>b.id));const slotIds=new Set((doc.slots||[]).map(s=>s.id));const attIds=new Set((doc.attachments||[]).map(a=>a.id));const meshIds=new Set((doc.meshes||[]).map(m=>m.id));
  if(!doc.objects?.length)warnings.push('No objects in runtime export.');
  if(!doc.bones?.length)errors.push('No bones in runtime export.');
  if(!doc.setupPose?.bones||!doc.setupPose?.slots)errors.push('Runtime export must include setupPose.bones and setupPose.slots.');
  for(const b of doc.bones||[]){if(!b.id)errors.push('Bone without id.');if(b.parent&&!boneIds.has(b.parent))errors.push(`Bone ${b.id} parent ${b.parent} is missing.`);if(!doc.setupPose?.bones?.[b.id])warnings.push(`Bone ${b.id} missing setup pose entry.`);}
  for(const s of doc.slots||[]){
    if(s.bone&&!boneIds.has(s.bone))warnings.push(`Slot ${s.id} parent bone ${s.bone} is missing.`);
    if(s.attachment&&!attIds.has(s.attachment))warnings.push(`Slot ${s.id} attachment ${s.attachment} is missing.`);
    if(s.mesh&&!meshIds.has(s.mesh))errors.push(`Slot ${s.id} references missing mesh ${s.mesh}.`);
    if(!doc.setupPose?.slots?.[s.id])warnings.push(`Slot ${s.id} missing setup pose entry.`);
  }
  for(const m of doc.meshes||[]){
    if(!slotIds.has(m.slot))errors.push(`Mesh ${m.id} references missing slot ${m.slot}.`);
    if(!Array.isArray(m.vertices))errors.push(`Mesh ${m.id} vertices must be an array.`);
    if(!Array.isArray(m.weights)||m.weights.length!==(m.vertices||[]).length)errors.push(`Mesh ${m.id} weights must be parallel to vertices.`);
    if(m.enabled&&!(m.vertices||[]).length)warnings.push(`Mesh ${m.id} is enabled with no vertices.`);
    if(m.enabled&&!(m.triangles||[]).length)warnings.push(`Mesh ${m.id} is enabled with no triangles.`);
    for(let i=0;i<(m.vertices||[]).length;i++){
      const v=m.vertices[i];if(!Number.isFinite(Number(v.x))||!Number.isFinite(Number(v.y)))errors.push(`Mesh ${m.id} vertex ${i} has invalid position.`);
      const weights=(m.weights?.[i]||[]).filter(w=>Number(w.w)>0);const sum=weights.reduce((a,w)=>a+Number(w.w||0),0);
      if(m.enabled&&!weights.length)warnings.push(`Mesh ${m.id} vertex ${i} is unweighted.`);
      if(sum>1.0001)warnings.push(`Mesh ${m.id} vertex ${i} weights exceed 100%.`);
      for(const w of weights){if(!boneIds.has(w.bone))errors.push(`Mesh ${m.id} vertex ${i} references missing bone ${w.bone}.`);if(!Number.isFinite(Number(w.bind?.x))||!Number.isFinite(Number(w.bind?.y)))warnings.push(`Mesh ${m.id} vertex ${i} has missing bind coordinates.`);}
    }
    for(const tri of m.triangles||[]){if(!Array.isArray(tri)||tri.length!==3||tri.some(i=>!Number.isInteger(i)||i<0||i>=(m.vertices||[]).length))errors.push(`Mesh ${m.id} has invalid triangle ${JSON.stringify(tri)}.`);}
    if(m.deformSetup?.offsets&&m.deformSetup.offsets.length!==(m.vertices||[]).length)warnings.push(`Mesh ${m.id} deformSetup offsets do not match vertex count.`);
  }
  for(const clip of doc.animations||[]){
    for(const bid of Object.keys(clip.boneTracks||{})){if(!boneIds.has(bid))warnings.push(`Clip ${clip.id} has bone track for missing bone ${bid}.`);}
    for(const sid of Object.keys(clip.slotTracks||{})){if(!slotIds.has(sid))warnings.push(`Clip ${clip.id} has slot track for missing slot ${sid}.`);}
    for(const sid of Object.keys(clip.deformTracks||{})){
      if(!slotIds.has(sid))warnings.push(`Clip ${clip.id} has deform track for missing slot ${sid}.`);
      const mesh=(doc.meshes||[]).find(m=>m.slot===sid);for(const k of clip.deformTracks[sid]||[]){if(mesh&&Array.isArray(k.offsets)&&k.offsets.length&&k.offsets.length!==mesh.vertices.length)warnings.push(`Clip ${clip.id} deform key for ${sid} has ${k.offsets.length} offsets; mesh has ${mesh.vertices.length} vertices.`);}
    }
  }
  const stats={objects:(doc.objects||[]).length,bones:(doc.bones||[]).length,slots:(doc.slots||[]).length,attachments:(doc.attachments||[]).length,meshes:(doc.meshes||[]).filter(m=>m.enabled).length,animations:(doc.animations||[]).length,warnings:warnings.length,errors:errors.length};
  return{ok:errors.length===0,warnings,errors,stats};
}
function exportRuntimeJson(force=true){
  const el=$('#runtimeJson');if(!el)return;
  if(!force&&document.activeElement===el)return;
  el.value=JSON.stringify(buildRuntimeDocument(),null,2);
  updateRuntimeValidationPanel();
}
function updateRuntimeValidationPanel(){
  const el=$('#runtimeValidation');if(!el)return;
  let res;try{res=validateRuntimeDocument(buildRuntimeDocument());}catch(err){el.innerHTML='<div class="binding-issues warn">Runtime validation failed: '+htm(err.message||String(err))+'</div>';return;}
  const s=res.stats||{};const rows=[...res.errors.map(x=>({kind:'error',text:x})),...res.warnings.slice(0,10).map(x=>({kind:'warn',text:x}))];
  const more=res.warnings.length>10?`<div class="diag-row info"><b>more</b><span>${res.warnings.length-10} more warning(s)</span></div>`:'';
  el.innerHTML=`<div class="runtime-export-status ${res.ok?'ok':'warn'}"><b>${res.ok?'Runtime v11 export valid':'Runtime v11 export has errors'}</b><span>${s.objects||0} objects · ${s.bones||0} bones · ${s.slots||0} slots · ${s.meshes||0} meshes · ${s.animations||0} clips · ${s.warnings||0} warnings · ${s.errors||0} errors</span></div>`+
    (rows.length?rows.map(r=>`<div class="diag-row ${r.kind}"><b>${r.kind}</b><span>${htm(r.text)}</span></div>`).join('')+more:'<div class="binding-issues ok">✓ Runtime payload conforms to the stable v11 schema.</div>');
}
function runtimeJsonString(){return JSON.stringify(buildRuntimeDocument(),null,2);}
function copyRuntimeJsonToClipboard(){
  const text=runtimeJsonString();
  const el=$('#runtimeJson');if(el)el.value=text;
  if(typeof navigator!=='undefined'&&navigator.clipboard?.writeText)navigator.clipboard.writeText(text).catch(()=>{});
  updateRuntimeValidationPanel();
}
function downloadRuntimeJson(){
  const text=runtimeJsonString();const name=String(state.projectName||'indie_2d_runtime').replace(/[^a-z0-9_\-]+/gi,'_').replace(/^_+|_+$/g,'')||'indie_2d_runtime';
  const blob=new Blob([text],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name+'_runtime_v11.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);updateRuntimeValidationPanel();
}

function exportJson(force=true){if(!force&&document.activeElement===$('#json'))return;$('#json').value=JSON.stringify(exportData(),null,2);}
function refreshImages(){imageCache.clear();for(const a of state.attachments)if(a.type==='image')getImage(a);}
function importData(raw,fromUndo=false){state.loading=true;try{const data=typeof raw==='string'?JSON.parse(raw):raw;if(!data||!Array.isArray(data.bones))throw Error('Invalid JSON: bones[] missing');const importedRootId=data.editor?.projectRootId||state.projectRootId;state.bones=data.bones.map((b,i)=>{const id=String(b.id||('b'+(i+1))),parent=b.parent||null,isRoot=!!b.isRoot||id===importedRootId,moveOnly=!!b.moveOnly;const connected=b.connected===undefined?!!(parent&&parent!==importedRootId&&!moveOnly&&!isRoot):!!b.connected;return{id,name:String(b.name||b.id||('b'+(i+1))),parent,objectId:b.objectId||null,objectRoot:!!b.objectRoot,connected:!!connected&&!moveOnly&&!isRoot,rest:copyTr(b.rest||b.local||{x:0,y:0,r:0,len:80}),local:copyTr(b.local||b.rest||{x:0,y:0,r:0,len:80}),width:Number(b.width||12),color:normalizeHex(b.color||colors[i%colors.length]),shape:normalizeBoneShape(b.shape||b.display||'bone'),role:normalizeBoneRole(b.role||(isRoot||b.objectRoot?'root':(moveOnly?'control':'deform'))),affectWeights:b.affectWeights!==false,lockMove:!!b.lockMove,lockRotate:!!b.lockRotate,lockScale:!!b.lockScale,lockLength:!!b.lockLength,moveOnly,isRoot,elastic:normalizeElasticSettings(b.elastic||{}),w:{sx:0,sy:0,ex:0,ey:0,r:0,ax:1,ay:0,bx:0,by:1,scaleX:1,scaleY:1}}});state.projectRootId=importedRootId;ensureProjectRoot({reparent:true});state.objects=(data.objects||[]).map((o,i)=>({id:String(o.id||('obj'+(i+1))),name:String(o.name||o.id||('Object '+(i+1))),root:o.root||null,parentSlot:o.parentSlot||null,visible:o.visible!==false}));state.slots=(data.slots||[]).map((s,i)=>{const pose=copySlotPose(s.pose||s);const tint=normalizeHex(s.tint||pose.tint||'#ffffff'),tintAlpha=clamp(Number(s.tintAlpha??pose.tintAlpha??0),0,1),blendMode=s.blendMode||pose.blendMode||'normal';return{id:String(s.id||('s'+(i+1))),name:String(s.name||s.id||('slot_'+(i+1))),bone:((s.parentBone!==undefined?s.parentBone:s.bone)||null),objectId:s.objectId||null,attachment:s.attachment||s.pose?.attachment||null,visible:s.visible??s.pose?.visible??true,alpha:s.alpha??s.pose?.alpha??1,tint,tintAlpha,blendMode,local:{x:Number(s.local?.x||0),y:Number(s.local?.y||0),r:normAngle(Number(s.local?.r||0)),sx:Number(s.local?.sx??1)||1,sy:Number(s.local?.sy??1)||1},setupLocal:{x:Number((s.setupLocal||s.local)?.x||0),y:Number((s.setupLocal||s.local)?.y||0),r:normAngle(Number((s.setupLocal||s.local)?.r||0)),sx:Number((s.setupLocal||s.local)?.sx??1)||1,sy:Number((s.setupLocal||s.local)?.sy??1)||1},mesh:s.mesh?JSON.parse(JSON.stringify(s.mesh)):null,pose:{...pose,tint:normalizeHex(pose.tint||tint),tintAlpha:clamp(Number(pose.tintAlpha??tintAlpha),0,1),blendMode:pose.blendMode||blendMode}}});state.attachments=(data.attachments||[]).map((a,i)=>({id:String(a.id||('a'+(i+1))),name:String(a.name||a.id||('att_'+(i+1))),type:a.type||'rect',w:Number(a.w||60),h:Number(a.h||30),naturalW:a.naturalW?Number(a.naturalW):undefined,naturalH:a.naturalH?Number(a.naturalH):undefined,pivotX:Number(a.pivotX??.5),pivotY:Number(a.pivotY??.5),color:a.color||'#888888',src:a.src||''}));for(const s of state.slots){ensureSlotMesh(s,false);migrateLegacySlotBindingToMeshWeights(s);}ensureDefaultObjectForLegacy();state.markers=(data.markers||[]).map((m,i)=>({id:String(m.id||('m'+(i+1))),type:m.type||'socket',name:m.name||('marker_'+(i+1)),bone:m.bone||state.bones[0]?.id||null,x:Number(m.x||0),y:Number(m.y||0),r:normAngle(Number(m.r||0)),w:Number(m.w||20),h:Number(m.h||20),visible:m.visible!==false}));state.poses=data.poses||[];const clips=Array.isArray(data.animations)&&data.animations.length?data.animations:[data.animation||{}];state.animations=clips.map(normalizeImportedClip);state.activeAnimationId=data.activeAnimationId||state.animations[0]?.id||'clip1';state.anim=state.animations.find(c=>c.id===state.activeAnimationId)||state.animations[0];state.activeAnimationId=state.anim.id;normalizeAnimationCurves();for(const c of state.animations){if(c.boneTracks)delete c.boneTracks[state.projectRootId];}const bid=state.bones.map(b=>Number(String(b.id).replace(/^b/,''))).filter(Number.isFinite);const sid=state.slots.map(s=>Number(String(s.id).replace(/^s/,''))).filter(Number.isFinite);const aid=state.attachments.map(a=>Number(String(a.id).replace(/^a/,''))).filter(Number.isFinite);const mid=state.markers.map(m=>Number(String(m.id).replace(/^m/,''))).filter(Number.isFinite);const cid=state.animations.map(c=>Number(String(c.id).replace(/^clip/,''))).filter(Number.isFinite);const oid=state.objects.map(o=>Number(String(o.id).replace(/^obj/,''))).filter(Number.isFinite);state.nextObject=Math.max(0,...oid)+1;state.nextBone=Math.max(0,...bid)+1;state.nextSlot=Math.max(0,...sid)+1;state.nextAtt=Math.max(0,...aid)+1;state.nextMarker=Math.max(0,...mid)+1;state.nextClip=Math.max(0,...cid)+1;state.view={...state.view,...(data.editor?.view||{})};state.view.boneRoles={root:true,deform:true,control:true,socket:true,...(state.view.boneRoles||{})};state.pick={...state.pick,...(data.editor?.pick||{})};state.pick.boneRoles={root:true,deform:true,control:true,socket:true,...(state.pick.boneRoles||{})};state.onion={...state.onion,...(data.editor?.onion||{})};state.timeline={...state.timeline,...(data.editor?.timeline||{})};state.timeline.channels={bones:true,slots:true,deform:true,events:true,...(state.timeline.channels||{})};state.timeline.collapsed={...(state.timeline.collapsed||{})};if(state.timeline.showEmptyGroups===undefined)state.timeline.showEmptyGroups=true;state.layout={...state.layout,...(data.editor?.layout||{})};state.art={...state.art,...(data.editor?.art||{})};state.color={...state.color,...(data.editor?.color||{})};state.rig={...state.rig,...(data.editor?.rig||{})};state.elastic={...state.elastic,...(data.editor?.elastic||{}),sim:{},lastFrameTime:null};state.meshEdit={...state.meshEdit,...(data.editor?.meshEdit||{}),enabled:false,actionTool:'select',selectedVerts:[],selectedEdges:[],selectedFaces:[],hoveredVert:null,hoveredEdge:null,hoveredFace:null,knifePath:[],weightBrushCursor:null,weightBrushHits:[],weightPaintSession:null,weightAdjustDelta:0};state.outliner={...state.outliner,...(data.editor?.outliner||{})};state.activeObjectId=rigObject(data.editor?.activeObjectId)?data.editor.activeObjectId:(state.objects[0]?.id||null);state.lastObjectId=rigObject(data.editor?.lastObjectId)?data.editor.lastObjectId:state.activeObjectId;syncObjectMembership();state.lastSlotId=slot(data.editor?.lastSlotId)?data.editor.lastSlotId:(state.slots[0]?.id||null);state.inspectorTab=data.editor?.inspectorTab||state.inspectorTab;state.timeline.rangeEnd=state.timeline.rangeEnd||state.anim.duration;state.selected=(data.editor?.selected&&((data.editor.selected.type==='bone'&&state.bones.some(b=>b.id===data.editor.selected.id))||(data.editor.selected.type==='slot'&&state.slots.some(sl=>sl.id===data.editor.selected.id))||(data.editor.selected.type==='marker'&&state.markers.some(m=>m.id===data.editor.selected.id))))?data.editor.selected:{type:'bone',id:projectRoot()?.id||state.bones[0]?.id||null};state.selectedBones=Array.isArray(data.editor?.selectedBones)?data.editor.selectedBones.filter(id=>bone(id)):(state.selected.type==='bone'&&state.selected.id?[state.selected.id]:[]);if(state.selected.type!=='bone')state.selectedBones=[];state.keySelection={kind:null,id:null,time:null};state.selectedKeys=[];state.currentTime=0;syncAnimationFields();refreshImages();evaluate(0,false);renderAll();exportJson(true);if(!fromUndo){state.undo.length=0;state.redo.length=0;}}finally{state.loading=false;}}
function changed(){exportJson(false);try{localStorage.setItem('indie-2d-skeleton-v11-autosave',JSON.stringify(exportData()));}catch(e){}}
