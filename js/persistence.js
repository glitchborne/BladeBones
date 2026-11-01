'use strict';
const PROJECT_SAVE_VERSION='indie-2d-v11-stable-runtime-export';
const RUNTIME_SCHEMA_ID='indie-2d-runtime-v11';
const RUNTIME_SCHEMA_VERSION='11.0.0';

// Import/export, autosave and image cache refresh.
function clipForExport(c){return{id:c.id,name:c.name,duration:c.duration,fps:c.fps,boneTracks:c.boneTracks||{},slotTracks:c.slotTracks||{},deformTracks:c.deformTracks||{},cameraTracks:c.cameraTracks||{},events:c.events||[]};}
function normalizeImportedClip(c,i=0){const id=String(c.id||('clip'+(i+1)));return{id,name:String(c.name||c.id||('anim_'+(i+1))),duration:Math.max(.1,Number(c.duration||1.2)),fps:Math.max(1,Number(c.fps||24)),boneTracks:c.boneTracks||c.tracks||{},slotTracks:c.slotTracks||{},deformTracks:c.deformTracks||{},cameraTracks:c.cameraTracks||{},events:Array.isArray(c.events)?c.events:[]};}
function exportData(){ensureClipStore();return{version:PROJECT_SAVE_VERSION,objects:state.objects.map(o=>({id:o.id,name:o.name,root:o.root,parentSlot:o.parentSlot||null,visible:o.visible!==false})),bones:state.bones.map(b=>({id:b.id,name:b.name,parent:b.parent,objectId:b.objectId||null,objectRoot:!!b.objectRoot,isRoot:!!b.isRoot,moveOnly:!!b.moveOnly,connected:!!b.connected,role:inferBoneRole(b),affectWeights:b.affectWeights!==false,lockMove:!!b.lockMove,lockRotate:!!b.lockRotate,lockScale:!!b.lockScale,lockLength:!!b.lockLength,elastic:normalizeElasticSettings(b.elastic||{}),rest:b.rest,local:b.local,width:b.width,color:b.color,shape:normalizeBoneShape(b.shape)})),slots:state.slots.map(s=>({id:s.id,name:s.name,bone:s.bone,parentBone:s.bone,objectId:s.objectId||null,attachment:s.attachment,visible:s.visible,alpha:s.alpha,tint:s.tint,tintAlpha:s.tintAlpha,blendMode:s.blendMode,local:s.local,setupLocal:s.setupLocal||s.local,mesh:ensureSlotMesh(s),pose:s.pose})),attachments:state.attachments,markers:state.markers,poses:state.poses,animation:clipForExport(state.anim),animations:state.animations.map(clipForExport),activeAnimationId:state.activeAnimationId,editor:{projectRootId:state.projectRootId,view:state.view,activeObjectId:state.activeObjectId,lastObjectId:state.lastObjectId,pick:state.pick,onion:state.onion,timeline:state.timeline,layout:state.layout,art:state.art,outliner:state.outliner,inspectorTab:state.inspectorTab,color:state.color,rig:state.rig||{},elastic:{preview:state.elastic?.preview!==false,bakeVisualError:state.elastic?.bakeVisualError??1,bakeMaxInterval:state.elastic?.bakeMaxInterval??.42},meshEdit:{enabled:false,workbenchTab:state.meshEdit?.workbenchTab||'binding',bindingTab:state.meshEdit?.bindingTab||'workflow',selectionMode:state.meshEdit?.selectionMode||'vertex',actionTool:'select',weightTool:state.meshEdit?.weightTool||'paint',showWeights:state.meshEdit?.showWeights!==false,maxInfluences:state.meshEdit?.maxInfluences||4,weightBoneId:state.meshEdit?.weightBoneId||null,weightBrushSize:state.meshEdit?.weightBrushSize||46,weightBrushStrength:state.meshEdit?.weightBrushStrength??.35,weightBrushValue:state.meshEdit?.weightBrushValue??1,weightBrushMode:state.meshEdit?.weightBrushMode||'add',weightBrushSelectedOnly:state.meshEdit?.weightBrushSelectedOnly===true,weightAdjustSensitivity:state.meshEdit?.weightAdjustSensitivity??.005,weightVertexDisplay:state.meshEdit?.weightVertexDisplay||'activeFill',showDiagnostics:state.meshEdit?.showDiagnostics!==false,weightMirrorAxis:state.meshEdit?.weightMirrorAxis||'slot',weightMirrorDirection:state.meshEdit?.weightMirrorDirection||'selected'},lastSlotId:state.lastSlotId||null,selected:state.selected||{type:'bone',id:null},selectedBones:(state.selectedBones||[]).filter(id=>bone(id))}};}

function cloneRuntimeValue(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function runtimeNum(v,fb=0){const n=Number(v);return Number.isFinite(n)?n:fb;}
function runtimeRound(v,places=4){const n=runtimeNum(v,0);const m=Math.pow(10,places);return Math.round(n*m)/m;}
function runtimeRoundField(v,places=4){return typeof v==='number'&&Number.isFinite(v)?runtimeRound(v,places):v;}
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
  attachment:s.attachment!==undefined?s.attachment:(s.pose?.attachment||null),visible:s.visible!==false
};}
function cleanRuntimeWeight(w){
  const weight=w||{},bind={};
  if(weight.x!==undefined)bind.x=runtimeRound(weight.x);
  if(weight.y!==undefined)bind.y=runtimeRound(weight.y);
  return{bone:weight.bone==null?null:String(weight.bone),w:weight.w===undefined?null:runtimeRound(weight.w,6),bind};
}
function cleanRuntimeVertex(v){
  if(!v||typeof v!=='object'||Array.isArray(v))return cloneRuntimeValue(v);
  return{x:runtimeRoundField(v.x??0),y:runtimeRoundField(v.y??0),u:runtimeRoundField(v.u??0,6),v:runtimeRoundField(v.v??0,6)};
}
function cleanRuntimeMeshForSlot(s){
  const mesh=s?.mesh;if(!mesh)return null;
  const vertices=Array.isArray(mesh.vertices)?mesh.vertices.map(cleanRuntimeVertex):cloneRuntimeValue(mesh.vertices);
  const weights=Array.isArray(mesh.vertices)?mesh.vertices.map(v=>Array.isArray(v?.weights)?v.weights.map(cleanRuntimeWeight):cloneRuntimeValue(v?.weights)):cloneRuntimeValue(mesh.weights);
  const triangles=Array.isArray(mesh.triangles)?mesh.triangles.map(tri=>Array.isArray(tri)?tri.map(i=>Number.isInteger(i)?i:runtimeRoundField(i)):cloneRuntimeValue(tri)):cloneRuntimeValue(mesh.triangles);
  const edges=Array.isArray(mesh.edges)?mesh.edges.map(e=>Array.isArray(e)?e.map(i=>Number.isInteger(i)?i:runtimeRoundField(i)):cloneRuntimeValue(e)):cloneRuntimeValue(mesh.edges);
  const hull=Array.isArray(mesh.hull)?mesh.hull.map(i=>Number.isInteger(i)?i:runtimeRoundField(i)):cloneRuntimeValue(mesh.hull);
  return{
    id:`${s.id}:mesh`,slot:s.id,enabled:mesh.enabled===undefined?false:mesh.enabled,version:mesh.version??3,vertexCount:Array.isArray(vertices)?vertices.length:mesh.vertexCount,triangleCount:Array.isArray(triangles)?triangles.length:mesh.triangleCount,
    vertices,weights,triangles,edges,hull,
    weightSumPolicy:'partial-allowed-rest-space'
  };
}
function runtimeTrackFields(kind){
  if(kind==='bone')return['t','x','y','r','len','sx','sy','curve','inTangent','outTangent'];
  if(kind==='slot')return['t','x','y','r','sx','sy','visible','attachment','alpha','tint','tintAlpha','blendMode','curve'];
  if(kind==='camera')return['t','x','y','r','z','curve'];
  return[];
}
function cleanRuntimeCurve(curve){
  if(curve==null||typeof curve!=='object'||Array.isArray(curve))return cloneRuntimeValue(curve);
  const out={};
  for(const field of ['type','x1','y1','x2','y2','inTangent','outTangent'])if(Object.prototype.hasOwnProperty.call(curve,field))out[field]=cloneRuntimeValue(curve[field]);
  return out;
}
function cleanRuntimeTrackMap(map,kind){
  if(!map||typeof map!=='object'||Array.isArray(map))return cloneRuntimeValue(map);
  const out={};
  for(const [id,arr] of Object.entries(map)){
    if(!Array.isArray(arr)){out[id]=cloneRuntimeValue(arr);continue;}
    out[id]=arr.map(key=>{
      if(!key||typeof key!=='object'||Array.isArray(key))return cloneRuntimeValue(key);
      const clean={};
      for(const field of runtimeTrackFields(kind))if(Object.prototype.hasOwnProperty.call(key,field))clean[field]=field==='curve'?cleanRuntimeCurve(key[field]):cloneRuntimeValue(key[field]);
      for(const field of ['t','x','y','r','sx','sy','len','alpha','tintAlpha','z'])if(field in clean&&typeof clean[field]==='number')clean[field]=runtimeRound(clean[field],field==='t'?5:5);
      return clean;
    }).sort((a,b)=>runtimeNum(a?.t,0)-runtimeNum(b?.t,0));
  }
  return out;
}
function cleanRuntimeClip(c){
  const src=clipForExport(c||{});
  const deformTracks={};
  for(const [slotId,arr] of Object.entries(src.deformTracks||{})){
    if(!Array.isArray(arr)){deformTracks[slotId]=cloneRuntimeValue(arr);continue;}
    deformTracks[slotId]=arr.map(k=>{
      if(!k||typeof k!=='object'||Array.isArray(k))return cloneRuntimeValue(k);
      const clean={};
      for(const field of ['t','offset','offsets','curve'])if(Object.prototype.hasOwnProperty.call(k,field))clean[field]=field==='curve'?cleanRuntimeCurve(k[field]):cloneRuntimeValue(k[field]);
      if(!Object.prototype.hasOwnProperty.call(clean,'offset'))clean.offset=0;
      if(Array.isArray(clean.offsets))clean.offsets=clean.offsets.map(o=>{
        if(!o||typeof o!=='object'||Array.isArray(o))return cloneRuntimeValue(o);
        const offset={};for(const field of ['x','y'])if(Object.prototype.hasOwnProperty.call(o,field))offset[field]=runtimeRoundField(o[field]);return offset;
      });
      if(typeof clean.t==='number')clean.t=runtimeRound(clean.t,5);
      return clean;
    }).sort((a,b)=>runtimeNum(a?.t,0)-runtimeNum(b?.t,0));
  }
  return{
    id:String(src.id||'clip1'),name:String(src.name||src.id||'clip'),duration:runtimeRound(Math.max(.001,runtimeNum(src.duration,1.2)),5),fps:runtimeRound(Math.max(1,runtimeNum(src.fps,24)),3),
    boneTracks:cleanRuntimeTrackMap(src.boneTracks||{},'bone'),slotTracks:cleanRuntimeTrackMap(src.slotTracks||{},'slot'),deformTracks,cameraTracks:cleanRuntimeTrackMap(src.cameraTracks||{},'camera'),events:cleanRuntimeEvents(src.events||[])
  };
}
function cleanRuntimeToon(){
  const toon=ensureToon();
  return{
    canvas:{width:runtimeRoundField(toon.canvas.width),height:runtimeRoundField(toon.canvas.height),background:toon.canvas.background,transparent:toon.canvas.transparent},
    cameras:(toon.cameras||[]).map(c=>{
      const setup=c.setup||c;
      return{id:String(c.id),name:String(c.name||c.id),x:runtimeRoundField(setup.x??0),y:runtimeRoundField(setup.y??0),r:runtimeRoundField(setup.r??0),z:runtimeRoundField(setup.z??1)};
    }),
    activeCameraId:toon.activeCameraId,
    renderLayers:(toon.renderLayers||[]).map(l=>({id:String(l.id),name:String(l.name||l.id),order:runtimeRoundField(l.order??0),visible:l.visible!==false}))
  };
}
function cleanRuntimeEvents(events){
  if(!Array.isArray(events))return cloneRuntimeValue(events);
  return events.map(event=>{
    if(!event||typeof event!=='object'||Array.isArray(event))return cloneRuntimeValue(event);
    const clean={};
    for(const field of ['t','name','payload'])if(Object.prototype.hasOwnProperty.call(event,field))clean[field]=cloneRuntimeValue(event[field]);
    return clean;
  });
}
function buildRuntimeDocument(){
  ensureClipStore();updateWorld(false);
  const objects=state.objects.map(o=>{
    const out={id:String(o.id),name:String(o.name||o.id),root:o.root||null,parentSlot:o.parentSlot||null,visible:o.visible!==false};
    if(state.documentType==='toon')out.renderLayerId=o.renderLayerId||defaultRenderLayerId();
    return out;
  });
  const bones=state.bones.map(b=>({
    id:String(b.id),name:String(b.name||b.id),parent:b.parent||null,objectId:b.objectId||null,objectRoot:!!b.objectRoot,isRoot:!!b.isRoot,
    role:inferBoneRole(b),affectWeights:b.affectWeights!==false,connected:!!b.connected,moveOnly:!!b.moveOnly,
    rest:cleanRuntimeTransform(b.rest,{x:0,y:0,r:0,len:80,sx:1,sy:1}),width:runtimeRound(b.width||12),color:b.color||'#88ccff',shape:normalizeBoneShape(b.shape)
  }));
  const meshes=[];
  const slots=state.slots.map((s,drawOrder)=>{
    const m=cleanRuntimeMeshForSlot(s);if(m&&m.enabled)meshes.push(m);
    return{
      id:String(s.id),name:String(s.name||s.id),objectId:s.objectId||null,bone:s.bone||null,attachment:s.attachment!==undefined?s.attachment:(s.pose?.attachment||null),drawOrder,
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
    meta:{exportedAt:new Date().toISOString(),generator:'Indie 2D Skeletal Editor',runtimeFormat:'stable-v11',migration:'current editor state -> runtime v11',editorOnlyExcluded:['editor','selection','selectedKeys','hover','brush','layout','view','pick','diagnostics','testPose','undo','redo','workbench','poses','currentTime','tool','mode','playing']}
  };
  if(state.documentType==='toon')runtime.toon=cleanRuntimeToon();
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
  const isRecord=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const isFiniteNumber=v=>typeof v==='number'&&Number.isFinite(v);
  const list=(name,value)=>{if(!Array.isArray(value)){errors.push(`${name} must be an array.`);return[];}return value;};
  const uniqueIds=(name,items)=>{
    const ids=new Set();
    for(const item of items){
      const id=item?.id;
      if(typeof id!=='string'||!id){errors.push(`${name} contains an item without an id.`);continue;}
      if(ids.has(id))errors.push(`${name} contains duplicate id ${id}.`);
      ids.add(id);
    }
    return ids;
  };
  const requireVec2=(value,label)=>{
    if(!isRecord(value)||!isFiniteNumber(value.x)||!isFiniteNumber(value.y))errors.push(`${label} must contain finite numeric x and y.`);
  };
  const checkCurve=(curve,label)=>{
    if(curve==null)return;
    if(!isRecord(curve)||!['smooth','linear','hold','bezier','hermite'].includes(curve.type)){errors.push(`${label} has an invalid interpolation curve.`);return;}
    if(curve.type==='bezier')for(const field of ['x1','y1','x2','y2'])if(!isFiniteNumber(curve[field]))errors.push(`${label} bezier curve is missing numeric ${field}.`);
    for(const side of ['inTangent','outTangent'])if(curve[side]!==undefined){
      if(!isRecord(curve[side]))errors.push(`${label} ${side} must be an object.`);
      else for(const [field,value] of Object.entries(curve[side]))if(!isFiniteNumber(value))errors.push(`${label} ${side}.${field} must be finite.`);
    }
  };
  const checkTrackMap=(clip,kind,refs,requiredFields)=>{
    const property=kind+'Tracks',map=clip[property];
    if(!isRecord(map)){errors.push(`Clip ${clip.id} ${property} must be an object.`);return;}
    for(const [id,keys] of Object.entries(map)){
      if(!refs.has(id))errors.push(`Clip ${clip.id} ${kind} track references missing ${kind} ${id}.`);
      if(!Array.isArray(keys)){errors.push(`Clip ${clip.id} ${kind} track ${id} must be an array.`);continue;}
      for(let i=0;i<keys.length;i++){
        const key=keys[i],label=`Clip ${clip.id} ${kind} track ${id} key ${i}`;
        if(!isRecord(key)){errors.push(`${label} must be an object.`);continue;}
        if(!isFiniteNumber(key.t)||key.t<0||key.t>clip.duration)errors.push(`${label} has invalid time.`);
        for(const field of requiredFields)if(!isFiniteNumber(key[field]))errors.push(`${label} is missing finite numeric ${field}.`);
        for(const field of ['x','y','r','sx','sy','len','alpha','tintAlpha','z'])if(key[field]!==undefined&&!isFiniteNumber(key[field]))errors.push(`${label} ${field} must be finite.`);
        if(key.visible!==undefined&&typeof key.visible!=='boolean')errors.push(`${label} visible must be boolean.`);
        for(const field of ['inTangent','outTangent'])if(key[field]!==undefined){
          if(!isRecord(key[field]))errors.push(`${label} ${field} must be an object.`);
          else for(const [channel,value] of Object.entries(key[field]))if(!isFiniteNumber(value))errors.push(`${label} ${field}.${channel} must be finite.`);
        }
        if(kind==='slot'&&key.alpha!==undefined&&(key.alpha<0||key.alpha>1))errors.push(`${label} alpha must be between zero and one.`);
        if(kind==='slot'&&key.tintAlpha!==undefined&&(key.tintAlpha<0||key.tintAlpha>1))errors.push(`${label} tintAlpha must be between zero and one.`);
        if(kind==='camera'&&key.z<=0)errors.push(`${label} zoom must be positive.`);
        if(key.curve!==undefined)checkCurve(key.curve,`${label} curve`);
      }
    }
  };

  if(!isRecord(doc)){return{ok:false,warnings,errors:['Runtime document must be an object.'],stats:{warnings:0,errors:1}};}
  const editorOnlyFields=new Set(['editor','selection','selected','selectedKeys','selectedBones','hover','hoveredVert','hoveredEdge','hoveredFace','brush','weightPaintSession','layout','view','pick','diagnostics','testPose','undo','redo','workbench','poses','currentTime','tool','mode','playing','drag','dragCache','panelOpen','collapsed','meshEdit','inspectorTab','weightBrushCursor','weightBrushHits','actionTool','locked']);
  const seenRuntimeValues=new WeakSet();
  const checkEditorFields=(value,path='Runtime')=>{
    if(!value||typeof value!=='object'||seenRuntimeValues.has(value))return;
    seenRuntimeValues.add(value);
    for(const [field,child] of Object.entries(value)){
      if(editorOnlyFields.has(field))errors.push(`${path} contains editor-only field ${field}.`);
      else if(field!=='payload')checkEditorFields(child,`${path}.${field}`);
    }
  };
  checkEditorFields(doc);
  if(doc.format!=='indie-2d-runtime')errors.push('Runtime document format must be indie-2d-runtime.');
  if(doc.schema!==RUNTIME_SCHEMA_ID)errors.push(`Runtime schema must be ${RUNTIME_SCHEMA_ID}.`);
  if(doc.version!==11)errors.push('Runtime version must be 11.');
  if(doc.schemaVersion!==RUNTIME_SCHEMA_VERSION)errors.push(`Runtime schemaVersion must be ${RUNTIME_SCHEMA_VERSION}.`);
  if(typeof doc.sourceVersion!=='string'||typeof doc.projectName!=='string')errors.push('Runtime sourceVersion and projectName must be strings.');
  if(!isRecord(doc.meta))errors.push('Runtime meta must be an object.');
  if(!isRecord(doc.units)||doc.units.coordinates!=='pixels'||doc.units.angles!=='degrees'||doc.units.time!=='seconds'||doc.units.axis!=='2d-y-down')errors.push('Runtime units do not match the v11 coordinate contract.');
  const objects=list('objects',doc.objects),bones=list('bones',doc.bones),slots=list('slots',doc.slots),attachments=list('attachments',doc.attachments),meshes=list('meshes',doc.meshes),markers=list('markers',doc.markers),animations=list('animations',doc.animations);
  const objectIds=uniqueIds('objects',objects),boneIds=uniqueIds('bones',bones),slotIds=uniqueIds('slots',slots),attachmentIds=uniqueIds('attachments',attachments),meshIds=uniqueIds('meshes',meshes),markerIds=uniqueIds('markers',markers),animationIds=uniqueIds('animations',animations);
  if(!['game','toon'].includes(doc.documentType))errors.push('Runtime documentType must be game or toon.');
  if(!objects.length)warnings.push('No objects in runtime export.');
  if(!bones.length)errors.push('No bones in runtime export.');
  if(!isRecord(doc.setupPose)||!isRecord(doc.setupPose.bones)||!isRecord(doc.setupPose.slots))errors.push('Runtime export must include setupPose.bones and setupPose.slots.');
  const setupBones=isRecord(doc.setupPose?.bones)?doc.setupPose.bones:{};
  const setupSlots=isRecord(doc.setupPose?.slots)?doc.setupPose.slots:{};

  const boneById=new Map(bones.filter(b=>typeof b?.id==='string').map(b=>[b.id,b]));
  const visiting=new Set(),visited=new Set();
  const visitBone=id=>{
    if(visited.has(id))return;
    if(visiting.has(id)){errors.push(`Bone hierarchy contains a cycle at ${id}.`);return;}
    visiting.add(id);const b=boneById.get(id);
    if(b?.parent&&boneById.has(b.parent))visitBone(b.parent);
    visiting.delete(id);visited.add(id);
  };
  for(const b of bones){
    if(!isRecord(b))continue;
    if(typeof b.id!=='string'||!b.id)continue;
    if(b.parent&&(!boneIds.has(b.parent)||b.parent===b.id))errors.push(`Bone ${b.id} has invalid parent reference ${b.parent}.`);
    if(b.objectId&&!objectIds.has(b.objectId))errors.push(`Bone ${b.id} references missing object ${b.objectId}.`);
    if(!isRecord(b.rest))errors.push(`Bone ${b.id} is missing rest transform.`);
    else for(const field of ['x','y','r','len','sx','sy'])if(!isFiniteNumber(b.rest[field]))errors.push(`Bone ${b.id} rest.${field} must be finite.`);
    if(isRecord(b.rest)&&b.rest.len<=0)errors.push(`Bone ${b.id} rest.len must be positive.`);
    if(!['root','deform','control','socket'].includes(b.role))errors.push(`Bone ${b.id} has an invalid role.`);
    if(!Object.prototype.hasOwnProperty.call(setupBones,b.id))errors.push(`Bone ${b.id} is missing setup pose entry.`);
    else if(!isRecord(setupBones[b.id]))errors.push(`Bone ${b.id} setup pose must be an object.`);
    else for(const field of ['x','y','r','len','sx','sy'])if(!isFiniteNumber(setupBones[b.id][field]))errors.push(`Bone ${b.id} setup pose ${field} must be finite.`);
    visitBone(b.id);
  }
  for(const id of Object.keys(setupBones))if(!boneIds.has(id))errors.push(`Setup pose references missing bone ${id}.`);

  const slotById=new Map(slots.filter(s=>typeof s?.id==='string').map(s=>[s.id,s]));
  for(const o of objects){
    if(!isRecord(o))continue;
    if(!o.root||!boneIds.has(o.root))errors.push(`Object ${o.id} references missing root bone ${o.root}.`);
    else if(boneById.get(o.root)?.objectRoot!==true||boneById.get(o.root)?.objectId!==o.id)errors.push(`Object ${o.id} root bone ${o.root} has invalid object ownership.`);
    if(o.parentSlot&&!slotIds.has(o.parentSlot))errors.push(`Object ${o.id} references missing parent slot ${o.parentSlot}.`);
    if(typeof o.visible!=='boolean')errors.push(`Object ${o.id} visibility must be boolean.`);
  }
  const objectById=new Map(objects.filter(o=>typeof o?.id==='string').map(o=>[o.id,o]));
  const objectVisiting=new Set(),objectVisited=new Set();
  const visitObject=id=>{
    if(objectVisited.has(id))return;
    if(objectVisiting.has(id)){errors.push(`Object hierarchy contains a cycle at ${id}.`);return;}
    objectVisiting.add(id);const object=objectById.get(id),parentSlot=slotById.get(object?.parentSlot),parentObject=parentSlot?.objectId;
    if(parentObject&&objectById.has(parentObject))visitObject(parentObject);
    objectVisiting.delete(id);objectVisited.add(id);
  };
  for(const id of objectById.keys())visitObject(id);
  for(const s of slots){
    if(!isRecord(s))continue;
    if(s.objectId&&!objectIds.has(s.objectId))errors.push(`Slot ${s.id} references missing object ${s.objectId}.`);
    if(s.bone&&!boneIds.has(s.bone))errors.push(`Slot ${s.id} references missing parent bone ${s.bone}.`);
    if(s.attachment&&!attachmentIds.has(s.attachment))errors.push(`Slot ${s.id} references missing attachment ${s.attachment}.`);
    if(s.mesh&&!meshIds.has(s.mesh))errors.push(`Slot ${s.id} references missing mesh ${s.mesh}.`);
    if(!isRecord(s.setup))errors.push(`Slot ${s.id} is missing setup data.`);
    else{
      for(const field of ['x','y','r','sx','sy','alpha','tintAlpha'])if(!isFiniteNumber(s.setup[field]))errors.push(`Slot ${s.id} setup.${field} must be finite.`);
      if(s.setup.attachment&&!attachmentIds.has(s.setup.attachment))errors.push(`Slot ${s.id} setup references missing attachment ${s.setup.attachment}.`);
      if(typeof s.setup.visible!=='boolean'||typeof s.setup.tint!=='string'||typeof s.setup.blendMode!=='string')errors.push(`Slot ${s.id} setup display properties are malformed.`);
    }
    if(!Object.prototype.hasOwnProperty.call(setupSlots,s.id))errors.push(`Slot ${s.id} is missing setup pose entry.`);
    else if(!isRecord(setupSlots[s.id]))errors.push(`Slot ${s.id} setup pose must be an object.`);
    else for(const field of ['x','y','r','sx','sy','alpha'])if(!isFiniteNumber(setupSlots[s.id][field]))errors.push(`Slot ${s.id} setup pose ${field} must be finite.`);
    if(typeof s.visible!=='boolean')errors.push(`Slot ${s.id} visibility must be boolean.`);
    if(s.drawOrder!==undefined&&!Number.isInteger(s.drawOrder))errors.push(`Slot ${s.id} drawOrder must be an integer.`);
  }
  for(const id of Object.keys(setupSlots))if(!slotIds.has(id))errors.push(`Setup pose references missing slot ${id}.`);

  for(const a of attachments){
    if(!isRecord(a))continue;
    if(typeof a.name!=='string'||typeof a.type!=='string'||typeof a.src!=='string')errors.push(`Attachment ${a.id} metadata is malformed.`);
    for(const field of ['w','h'])if(!isFiniteNumber(a[field])||a[field]<0)errors.push(`Attachment ${a.id} ${field} must be a non-negative number.`);
    if(!isRecord(a.pivot)||!isFiniteNumber(a.pivot.x)||!isFiniteNumber(a.pivot.y))errors.push(`Attachment ${a.id} pivot must contain finite numeric coordinates.`);
  }

  const meshById=new Map(meshes.filter(m=>typeof m?.id==='string').map(m=>[m.id,m]));
  for(const s of slots)if(s?.mesh&&meshById.get(s.mesh)?.slot!==s.id)errors.push(`Slot ${s.id} references mesh ${s.mesh} owned by another slot.`);
  for(const m of meshes){
    if(!isRecord(m))continue;
    if(typeof m.enabled!=='boolean')errors.push(`Mesh ${m.id} enabled must be boolean.`);
    if(!slotIds.has(m.slot))errors.push(`Mesh ${m.id} references missing slot ${m.slot}.`);
    else if(slotById.get(m.slot)?.mesh!==m.id)errors.push(`Mesh ${m.id} is not referenced by slot ${m.slot}.`);
    const vertices=list(`Mesh ${m.id} vertices`,m.vertices),weights=list(`Mesh ${m.id} weights`,m.weights),triangles=list(`Mesh ${m.id} triangles`,m.triangles);
    const edges=list(`Mesh ${m.id} edges`,m.edges),hull=list(`Mesh ${m.id} hull`,m.hull);
    if(weights.length!==vertices.length)errors.push(`Mesh ${m.id} weights must be parallel to vertices.`);
    if(m.vertexCount!==vertices.length)errors.push(`Mesh ${m.id} vertexCount does not match vertices.`);
    if(m.triangleCount!==triangles.length)errors.push(`Mesh ${m.id} triangleCount does not match triangles.`);
    if(m.enabled&&!vertices.length)warnings.push(`Mesh ${m.id} is enabled with no vertices.`);
    if(m.enabled&&!triangles.length)warnings.push(`Mesh ${m.id} is enabled with no triangles.`);
    for(let i=0;i<vertices.length;i++){
      const v=vertices[i];
      if(!isRecord(v)||!isFiniteNumber(v.x)||!isFiniteNumber(v.y))errors.push(`Mesh ${m.id} vertex ${i} has invalid position.`);
      if(isRecord(v)&&(!isFiniteNumber(v.u)||!isFiniteNumber(v.v)))errors.push(`Mesh ${m.id} vertex ${i} has invalid UV coordinates.`);
      const influences=weights[i];
      if(!Array.isArray(influences)){errors.push(`Mesh ${m.id} vertex ${i} weights must be an array.`);continue;}
      if(m.enabled&&!influences.length)warnings.push(`Mesh ${m.id} vertex ${i} is unweighted.`);
      let sum=0;
      for(const w of influences){
        if(!isRecord(w)){errors.push(`Mesh ${m.id} vertex ${i} has a malformed weight.`);continue;}
        if(typeof w.bone!=='string'||!boneIds.has(w.bone))errors.push(`Mesh ${m.id} vertex ${i} references missing bone ${w.bone}.`);
        if(!isFiniteNumber(w.w)||w.w<0||w.w>1)errors.push(`Mesh ${m.id} vertex ${i} has invalid weight value.`);
        else sum+=w.w;
        if(!isRecord(w.bind)||!isFiniteNumber(w.bind.x)||!isFiniteNumber(w.bind.y))errors.push(`Mesh ${m.id} vertex ${i} has missing or invalid bind coordinates.`);
      }
      if(sum>1.000001)errors.push(`Mesh ${m.id} vertex ${i} weights exceed 100%.`);
    }
    for(const tri of triangles)if(!Array.isArray(tri)||tri.length!==3||tri.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length)||new Set(tri).size!==3)errors.push(`Mesh ${m.id} has invalid triangle ${JSON.stringify(tri)}.`);
    for(const edge of edges)if(!Array.isArray(edge)||edge.length!==2||edge.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length)||edge[0]===edge[1])errors.push(`Mesh ${m.id} has invalid edge ${JSON.stringify(edge)}.`);
    for(const index of hull)if(!Number.isInteger(index)||index<0||index>=vertices.length)errors.push(`Mesh ${m.id} has invalid hull index ${index}.`);
    if(m.version!==3)errors.push(`Mesh ${m.id} version must be 3.`);
    if(m.weightSumPolicy!=='partial-allowed-rest-space')errors.push(`Mesh ${m.id} has an unsupported weightSumPolicy.`);
    if(m.deformSetup!==undefined){
      if(!isRecord(m.deformSetup)||!Array.isArray(m.deformSetup.offsets))errors.push(`Mesh ${m.id} deformSetup offsets must be an array.`);
      else{
        if(m.deformSetup.offsets.length!==vertices.length)errors.push(`Mesh ${m.id} deformSetup offsets do not match vertex count.`);
        m.deformSetup.offsets.forEach((offset,i)=>requireVec2(offset,`Mesh ${m.id} deformSetup offset ${i}`));
      }
    }
  }

  for(const marker of markers)if(isRecord(marker)&&marker.bone&&!boneIds.has(marker.bone))errors.push(`Marker ${marker.id} references missing bone ${marker.bone}.`);
  const toonCameraIds=new Set();
  if(doc.documentType==='toon'){
    if(!isRecord(doc.toon))errors.push('ToonDoc runtime is missing toon settings.');
    else{
      const toon=doc.toon;
      if(!isRecord(toon.canvas)||!isFiniteNumber(toon.canvas.width)||toon.canvas.width<=0||!isFiniteNumber(toon.canvas.height)||toon.canvas.height<=0)errors.push('ToonDoc canvas requires positive numeric width and height.');
      else if(typeof toon.canvas.background!=='string'||typeof toon.canvas.transparent!=='boolean')errors.push('ToonDoc canvas background and transparency must be typed values.');
      const cameras=list('ToonDoc cameras',toon.cameras),layers=list('ToonDoc renderLayers',toon.renderLayers);
      if(!cameras.length)errors.push('ToonDoc requires at least one camera.');
      if(!layers.length)errors.push('ToonDoc requires at least one render layer.');
      for(const c of cameras){if(!isRecord(c))continue;if(typeof c.id!=='string'||!c.id)errors.push('ToonDoc camera without id.');else if(toonCameraIds.has(c.id))errors.push(`ToonDoc contains duplicate camera id ${c.id}.`);else toonCameraIds.add(c.id);for(const f of ['x','y','r','z'])if(!isFiniteNumber(c[f]))errors.push(`ToonDoc camera ${c.id} ${f} must be finite.`);}
      if(!toonCameraIds.has(toon.activeCameraId))errors.push(`ToonDoc active camera ${toon.activeCameraId} is missing.`);
      const layerIds=new Set();for(const layer of layers){if(!isRecord(layer))continue;if(typeof layer.id!=='string'||!layer.id)errors.push('ToonDoc render layer without id.');else if(layerIds.has(layer.id))errors.push(`ToonDoc contains duplicate render layer id ${layer.id}.`);else layerIds.add(layer.id);if(!isFiniteNumber(layer.order)||typeof layer.visible!=='boolean')errors.push(`ToonDoc render layer ${layer.id} has invalid runtime properties.`);}
      for(const o of objects)if(o?.renderLayerId&&!layerIds.has(o.renderLayerId))errors.push(`Object ${o.id} references missing render layer ${o.renderLayerId}.`);
    }
  }else{
    if(Object.prototype.hasOwnProperty.call(doc,'toon'))errors.push('GameDoc runtime must not contain ToonDoc settings.');
    for(const o of objects)if(o?.renderLayerId!==undefined)errors.push(`GameDoc object ${o.id} must not contain a ToonDoc renderLayerId.`);
  }

  for(const clip of animations){
    if(!isRecord(clip))continue;
    if(typeof clip.name!=='string'||!clip.name)errors.push(`Clip ${clip.id} name must be a non-empty string.`);
    if(!isFiniteNumber(clip.duration)||clip.duration<=0)errors.push(`Clip ${clip.id} duration must be positive and finite.`);
    if(!isFiniteNumber(clip.fps)||clip.fps<=0)errors.push(`Clip ${clip.id} fps must be positive and finite.`);
    checkTrackMap(clip,'bone',boneIds,['x','y','r','len']);
    checkTrackMap(clip,'slot',slotIds,['x','y','r','sx','sy','alpha']);
    checkTrackMap(clip,'camera',toonCameraIds,['x','y','r','z']);
    for(const keys of Object.values(isRecord(clip.slotTracks)?clip.slotTracks:{}))if(Array.isArray(keys))for(const key of keys)if(isRecord(key)&&key.attachment&&!attachmentIds.has(key.attachment))errors.push(`Clip ${clip.id} slot key references missing attachment ${key.attachment}.`);
    if(!isRecord(clip.deformTracks))errors.push(`Clip ${clip.id} deformTracks must be an object.`);
    else for(const [sid,keys] of Object.entries(clip.deformTracks)){
      if(!slotIds.has(sid))errors.push(`Clip ${clip.id} deform track references missing slot ${sid}.`);
      if(!Array.isArray(keys)){errors.push(`Clip ${clip.id} deform track ${sid} must be an array.`);continue;}
      const mesh=meshes.find(item=>item?.slot===sid&&item.enabled);
      if(!mesh)errors.push(`Clip ${clip.id} deform track ${sid} has no enabled mesh.`);
      for(let i=0;i<keys.length;i++){
        const key=keys[i],label=`Clip ${clip.id} deform track ${sid} key ${i}`;
        if(!isRecord(key)){errors.push(`${label} must be an object.`);continue;}
        if(!isFiniteNumber(key.t)||key.t<0||key.t>clip.duration)errors.push(`${label} has invalid time.`);
        if(!Number.isInteger(key.offset)||key.offset<0)errors.push(`${label} offset must be a non-negative integer.`);
        if(!Array.isArray(key.offsets))errors.push(`${label} offsets must be an array.`);
        else{
          if(mesh&&key.offsets.length!==mesh.vertices.length)errors.push(`${label} has ${key.offsets.length} offsets; mesh has ${mesh.vertices.length} vertices.`);
          key.offsets.forEach((offset,index)=>requireVec2(offset,`${label} offset ${index}`));
        }
        if(key.curve!==undefined)checkCurve(key.curve,`${label} curve`);
      }
    }
    if(!Array.isArray(clip.events))errors.push(`Clip ${clip.id} events must be an array.`);
    else for(let i=0;i<clip.events.length;i++){const event=clip.events[i];if(!isRecord(event)||!isFiniteNumber(event.t)||event.t<0||event.t>clip.duration||typeof event.name!=='string'||!event.name)errors.push(`Clip ${clip.id} event ${i} is malformed.`);}
  }
  if(doc.activeAnimationId!=null&&!animationIds.has(doc.activeAnimationId))errors.push(`Active animation ${doc.activeAnimationId} is missing.`);
  const stats={objects:objects.length,bones:bones.length,slots:slots.length,attachments:attachments.length,meshes:meshes.filter(m=>m?.enabled).length,animations:animations.length,warnings:warnings.length,errors:errors.length};
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
function importData(raw,fromUndo=false){state.loading=true;try{const data=typeof raw==='string'?JSON.parse(raw):raw;if(!data||!Array.isArray(data.bones))throw Error('Invalid JSON: bones[] missing');const importedRootId=data.editor?.projectRootId||state.projectRootId;state.bones=data.bones.map((b,i)=>{const id=String(b.id||('b'+(i+1))),parent=b.parent||null,isRoot=!!b.isRoot||id===importedRootId,moveOnly=!!b.moveOnly;const connected=b.connected===undefined?!!(parent&&parent!==importedRootId&&!moveOnly&&!isRoot):!!b.connected;return{id,name:String(b.name||b.id||('b'+(i+1))),parent,objectId:b.objectId||null,objectRoot:!!b.objectRoot,connected:!!connected&&!moveOnly&&!isRoot,rest:copyTr(b.rest||b.local||{x:0,y:0,r:0,len:80}),local:copyTr(b.local||b.rest||{x:0,y:0,r:0,len:80}),width:Number(b.width||12),color:normalizeHex(b.color||colors[i%colors.length]),shape:normalizeBoneShape(b.shape||b.display||'bone'),role:normalizeBoneRole(b.role||(isRoot||b.objectRoot?'root':(moveOnly?'control':'deform'))),affectWeights:b.affectWeights!==false,lockMove:!!b.lockMove,lockRotate:!!b.lockRotate,lockScale:!!b.lockScale,lockLength:!!b.lockLength,moveOnly,isRoot,elastic:normalizeElasticSettings(b.elastic||{}),w:{sx:0,sy:0,ex:0,ey:0,r:0,ax:1,ay:0,bx:0,by:1,scaleX:1,scaleY:1}}});state.projectRootId=importedRootId;ensureProjectRoot({reparent:true});state.objects=(data.objects||[]).map((o,i)=>({id:String(o.id||('obj'+(i+1))),name:String(o.name||o.id||('Object '+(i+1))),root:o.root||null,parentSlot:o.parentSlot||null,visible:o.visible!==false}));state.slots=(data.slots||[]).map((s,i)=>{const pose=copySlotPose(s.pose||s);const tint=normalizeHex(s.tint||pose.tint||'#ffffff'),tintAlpha=clamp(Number(s.tintAlpha??pose.tintAlpha??0),0,1),blendMode=s.blendMode||pose.blendMode||'normal';return{id:String(s.id||('s'+(i+1))),name:String(s.name||s.id||('slot_'+(i+1))),bone:((s.parentBone!==undefined?s.parentBone:s.bone)||null),objectId:s.objectId||null,attachment:s.attachment!==undefined?s.attachment:(s.pose?.attachment||null),visible:s.visible??s.pose?.visible??true,alpha:s.alpha??s.pose?.alpha??1,tint,tintAlpha,blendMode,local:{x:Number(s.local?.x||0),y:Number(s.local?.y||0),r:normAngle(Number(s.local?.r||0)),sx:Number(s.local?.sx??1)||1,sy:Number(s.local?.sy??1)||1},setupLocal:{x:Number((s.setupLocal||s.local)?.x||0),y:Number((s.setupLocal||s.local)?.y||0),r:normAngle(Number((s.setupLocal||s.local)?.r||0)),sx:Number((s.setupLocal||s.local)?.sx??1)||1,sy:Number((s.setupLocal||s.local)?.sy??1)||1},mesh:s.mesh?JSON.parse(JSON.stringify(s.mesh)):null,pose:{...pose,tint:normalizeHex(pose.tint||tint),tintAlpha:clamp(Number(pose.tintAlpha??tintAlpha),0,1),blendMode:pose.blendMode||blendMode}}});state.attachments=(data.attachments||[]).map((a,i)=>({id:String(a.id||('a'+(i+1))),name:String(a.name||a.id||('att_'+(i+1))),type:a.type||'rect',w:Number(a.w||60),h:Number(a.h||30),naturalW:a.naturalW?Number(a.naturalW):undefined,naturalH:a.naturalH?Number(a.naturalH):undefined,pivotX:Number(a.pivotX??.5),pivotY:Number(a.pivotY??.5),color:a.color||'#888888',src:a.src||''}));for(const s of state.slots){ensureSlotMesh(s,false);migrateLegacySlotBindingToMeshWeights(s);}ensureDefaultObjectForLegacy();state.markers=(data.markers||[]).map((m,i)=>({id:String(m.id||('m'+(i+1))),type:m.type||'socket',name:m.name||('marker_'+(i+1)),bone:m.bone||state.bones[0]?.id||null,x:Number(m.x||0),y:Number(m.y||0),r:normAngle(Number(m.r||0)),w:Number(m.w||20),h:Number(m.h||20),visible:m.visible!==false}));state.poses=data.poses||[];const clips=Array.isArray(data.animations)&&data.animations.length?data.animations:[data.animation||{}];state.animations=clips.map(normalizeImportedClip);state.activeAnimationId=data.activeAnimationId||state.animations[0]?.id||'clip1';state.anim=state.animations.find(c=>c.id===state.activeAnimationId)||state.animations[0];state.activeAnimationId=state.anim.id;normalizeAnimationCurves();for(const c of state.animations){if(c.boneTracks)delete c.boneTracks[state.projectRootId];}const bid=state.bones.map(b=>Number(String(b.id).replace(/^b/,''))).filter(Number.isFinite);const sid=state.slots.map(s=>Number(String(s.id).replace(/^s/,''))).filter(Number.isFinite);const aid=state.attachments.map(a=>Number(String(a.id).replace(/^a/,''))).filter(Number.isFinite);const mid=state.markers.map(m=>Number(String(m.id).replace(/^m/,''))).filter(Number.isFinite);const cid=state.animations.map(c=>Number(String(c.id).replace(/^clip/,''))).filter(Number.isFinite);const oid=state.objects.map(o=>Number(String(o.id).replace(/^obj/,''))).filter(Number.isFinite);state.nextObject=Math.max(0,...oid)+1;state.nextBone=Math.max(0,...bid)+1;state.nextSlot=Math.max(0,...sid)+1;state.nextAtt=Math.max(0,...aid)+1;state.nextMarker=Math.max(0,...mid)+1;state.nextClip=Math.max(0,...cid)+1;state.view={...state.view,...(data.editor?.view||{})};state.view.boneRoles={root:true,deform:true,control:true,socket:true,...(state.view.boneRoles||{})};state.pick={...state.pick,...(data.editor?.pick||{})};state.pick.boneRoles={root:true,deform:true,control:true,socket:true,...(state.pick.boneRoles||{})};state.onion={...state.onion,...(data.editor?.onion||{})};state.timeline={...state.timeline,...(data.editor?.timeline||{})};state.timeline.channels={bones:true,slots:true,deform:true,events:true,...(state.timeline.channels||{})};state.timeline.collapsed={...(state.timeline.collapsed||{})};if(state.timeline.showEmptyGroups===undefined)state.timeline.showEmptyGroups=true;state.layout={...state.layout,...(data.editor?.layout||{})};state.art={...state.art,...(data.editor?.art||{})};state.color={...state.color,...(data.editor?.color||{})};state.rig={...state.rig,...(data.editor?.rig||{})};state.elastic={...state.elastic,...(data.editor?.elastic||{}),sim:{},lastFrameTime:null};state.meshEdit={...state.meshEdit,...(data.editor?.meshEdit||{}),enabled:false,actionTool:'select',selectedVerts:[],selectedEdges:[],selectedFaces:[],hoveredVert:null,hoveredEdge:null,hoveredFace:null,knifePath:[],weightBrushCursor:null,weightBrushHits:[],weightPaintSession:null,weightAdjustDelta:0};state.outliner={...state.outliner,...(data.editor?.outliner||{})};state.activeObjectId=rigObject(data.editor?.activeObjectId)?data.editor.activeObjectId:(state.objects[0]?.id||null);state.lastObjectId=rigObject(data.editor?.lastObjectId)?data.editor.lastObjectId:state.activeObjectId;syncObjectMembership();state.lastSlotId=slot(data.editor?.lastSlotId)?data.editor.lastSlotId:(state.slots[0]?.id||null);state.inspectorTab=data.editor?.inspectorTab||state.inspectorTab;state.timeline.rangeEnd=state.timeline.rangeEnd||state.anim.duration;state.selected=(data.editor?.selected&&((data.editor.selected.type==='bone'&&state.bones.some(b=>b.id===data.editor.selected.id))||(data.editor.selected.type==='slot'&&state.slots.some(sl=>sl.id===data.editor.selected.id))||(data.editor.selected.type==='marker'&&state.markers.some(m=>m.id===data.editor.selected.id))))?data.editor.selected:{type:'bone',id:projectRoot()?.id||state.bones[0]?.id||null};state.selectedBones=Array.isArray(data.editor?.selectedBones)?data.editor.selectedBones.filter(id=>bone(id)):(state.selected.type==='bone'&&state.selected.id?[state.selected.id]:[]);if(state.selected.type!=='bone')state.selectedBones=[];state.keySelection={kind:null,id:null,time:null};state.selectedKeys=[];state.currentTime=0;syncAnimationFields();refreshImages();evaluate(0,false);renderAll();exportJson(true);if(!fromUndo){state.undo.length=0;state.redo.length=0;}}finally{state.loading=false;}}
function changed(){exportJson(false);try{localStorage.setItem('indie-2d-skeleton-v11-autosave',JSON.stringify(exportData()));}catch(e){}}
