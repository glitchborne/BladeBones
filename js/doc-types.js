'use strict';
// v10 document types: GameDoc and ToonDoc.
// GameDoc = rig/game asset. ToonDoc = same scene graph plus canvas, cameras and render layers.

function defaultToonSettings(){return {
  canvas:{width:1920,height:1080,background:'#000000',transparent:true},
  cameras:[{id:'cam1',name:'Main Camera',x:0,y:0,r:0,z:1,setup:{x:0,y:0,r:0,z:1}}],activeCameraId:'cam1',
  renderLayers:[
    {id:'bg',name:'Background',order:0,visible:true,locked:false},
    {id:'chars',name:'Characters',order:10,visible:true,locked:false},
    {id:'fx',name:'FX',order:20,visible:true,locked:false},
    {id:'ui',name:'UI',order:30,visible:true,locked:false}
  ]
};}
function normalizeDocumentType(v){return v==='toon'?'toon':(v==='game'?'game':'none');}
function ensureCameraSetup(camera){
  if(!camera)return null;
  const src=camera.setup||camera;
  camera.setup={x:Number(src.x??0),y:Number(src.y??0),r:Number(src.r??0),z:Math.max(.01,Number(src.z??1))};
  return camera.setup;
}
function ensureToon(){state.toon=state.toon||defaultToonSettings();state.toon.canvas={...defaultToonSettings().canvas,...(state.toon.canvas||{})};state.toon.cameras=Array.isArray(state.toon.cameras)&&state.toon.cameras.length?state.toon.cameras:defaultToonSettings().cameras;state.toon.cameras.forEach(ensureCameraSetup);state.toon.renderLayers=Array.isArray(state.toon.renderLayers)&&state.toon.renderLayers.length?state.toon.renderLayers:defaultToonSettings().renderLayers;if(!state.toon.activeCameraId||!state.toon.cameras.some(c=>c.id===state.toon.activeCameraId))state.toon.activeCameraId=state.toon.cameras[0].id;return state.toon;}
function activeToonCamera(){const t=ensureToon();return t.cameras.find(c=>c.id===t.activeCameraId)||t.cameras[0];}
function renderLayerById(id){const t=ensureToon();return t.renderLayers.find(l=>l.id===id)||t.renderLayers[0]||null;}
function defaultRenderLayerId(){const t=ensureToon();return t.renderLayers.find(l=>l.id==='chars')?.id||t.renderLayers[0]?.id||null;}
function sortedRenderLayers(){return [...ensureToon().renderLayers].sort((a,b)=>Number(a.order||0)-Number(b.order||0));}
function objectRenderLayerOrder(o){const l=renderLayerById(o?.renderLayerId);return Number(l?.order||0);}
function documentLabel(){return state.documentType==='toon'?'ToonDoc':(state.documentType==='game'?'GameDoc':'No document');}
function refreshDocumentChrome(){const sub=$('#docTypeLabel');if(sub){const label=documentLabel();sub.textContent=state.documentType==='none'?label:(label+(state.projectName?' · '+state.projectName:''));}document.body.classList.toggle('toondoc',state.documentType==='toon');document.body.classList.toggle('gamedoc',state.documentType==='game');}
function resetCounters(){state.nextBone=1;state.nextSlot=1;state.nextAtt=1;state.nextMarker=1;state.nextPose=1;state.nextClip=2;state.nextObject=1;}
function resetProject(type='game',name=null,options={}){
  type=normalizeDocumentType(type);if(type==='none')type='game';
  state.loading=true;
  try{
    state.documentType=type;state.projectName=name||(type==='toon'?'Untitled ToonDoc':'Untitled GameDoc');
    state.playing=false;const play=$('#play');if(play)play.textContent='Play';
    state.bones=[];state.slots=[];state.attachments=[];state.markers=[];state.poses=[];state.objects=[];resetCounters();
    state.projectRootId='root';state.activeObjectId=null;state.lastObjectId=null;state.lastBoneId=null;state.lastSlotId=null;
    state.anim={id:'clip1',name:'anim',duration:1.2,fps:24,boneTracks:{},slotTracks:{},deformTracks:{},cameraTracks:{},events:[]};
    state.animations=[state.anim];state.activeAnimationId=state.anim.id;
    state.toon=defaultToonSettings();
    if(type==='toon'&&options?.canvas){state.toon.canvas={...state.toon.canvas,...options.canvas};}
    state.selected={type:'bone',id:null};state.selectedBones=[];state.keySelection={kind:null,id:null,time:null};state.selectedKeys=[];state.keyClipboard=null;state.poseClipboard=null;
    state.currentTime=0;state.drag=null;state.ghost=null;state.undo.length=0;state.redo.length=0;
    state.timeline.rangeStart=0;state.timeline.rangeEnd=state.anim.duration;state.timeline.collapsed={};state.view.cameraView=false;
    ensureProjectRoot({reparent:false});
    const obj=makeRigObject('Object 1',{x:0,y:0});if(obj)obj.renderLayerId=defaultRenderLayerId();
    evaluate(0,false,true);
  } finally {state.loading=false;}
  changed();syncAnimationFields?.();syncWorkflowControls?.();refreshDocumentChrome();renderAll();hideNewProjectModal();
}
function clearProject(){if(state.documentType==='none')return showNewProjectModal();if(confirm('Clear current document and create a new '+documentLabel()+'?'))resetProject(state.documentType,state.projectName);}
function showNewProjectModal(){const m=$('#newProjectModal');if(m)m.classList.add('show');}
function hideNewProjectModal(){const m=$('#newProjectModal');if(m)m.classList.remove('show');}
function wireNewProjectButtons(){
  const n=$('#newProjectBtn');if(n)n.onclick=showNewProjectModal;
  const projectName=()=>String($('#newProjectName')?.value||'').trim()||null;
  const g=$('#createGameDoc');if(g)g.onclick=()=>resetProject('game',projectName());
  const t=$('#createToonDoc');if(t)t.onclick=()=>{const canvas={width:Math.max(1,Number($('#newToonWidth')?.value)||1920),height:Math.max(1,Number($('#newToonHeight')?.value)||1080),background:normalizeHex($('#newToonBg')?.value||'#000000','#000000'),transparent:!!$('#newToonTransparent')?.checked};resetProject('toon',projectName(),{canvas});};
  const c=$('#closeNewProjectModal');if(c)c.onclick=()=>hideNewProjectModal();
}
function currentCameraTrackId(){return ensureToon().activeCameraId||'cam1';}
function writeCameraKey(id=currentCameraTrackId(),t=state.currentTime){const cam=activeToonCamera();if(!cam)return false;state.anim.cameraTracks=state.anim.cameraTracks||{};const qt=roundTime(t);const k={t:qt,x:Number(cam.x||0),y:Number(cam.y||0),r:normAngle(Number(cam.r||0)),z:Math.max(.01,Number(cam.z||1)),curve:makeDefaultCurve()};const arr=state.anim.cameraTracks[id]||(state.anim.cameraTracks[id]=[]);const i=arr.findIndex(x=>Math.abs(x.t-k.t)<.0005);if(i>=0){k.curve=arr[i].curve||makeDefaultCurve();arr[i]=k;}else arr.push(k);arr.sort((a,b)=>a.t-b.t);return true;}
function sampleCameraTrack(keys,t){if(!keys||!keys.length)return null;keys.forEach(normalizeKeyCurve);if(keys.length===1||t<=keys[0].t)return{...keys[0]};if(t>=keys[keys.length-1].t)return{...keys[keys.length-1]};let lo=0,hi=keys.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(keys[m].t<=t)lo=m;else hi=m;}const a=keys[lo],b=keys[hi];const u=(t-a.t)/Math.max(.00001,b.t-a.t),e=easeFromCurve(a,b,u);return{t,x:lerp(Number(a.x||0),Number(b.x||0),e),y:lerp(Number(a.y||0),Number(b.y||0),e),r:lerpAngle(Number(a.r||0),Number(b.r||0),e),z:lerp(Number(a.z||1),Number(b.z||1),e)};}
function applyCameraAnimationPose(time){if(state.documentType!=='toon')return;const cam=activeToonCamera();if(!cam)return;const setup=ensureCameraSetup(cam);cam.x=setup.x;cam.y=setup.y;cam.r=setup.r;cam.z=setup.z;const tr=state.anim.cameraTracks?.[cam.id];const sm=sampleCameraTrack(tr,time);if(sm){cam.x=sm.x;cam.y=sm.y;cam.r=sm.r;cam.z=Math.max(.01,sm.z||1);}}
function keyCamera(){if(state.documentType!=='toon')return false;pushUndo();writeCameraKey();const kt=roundTime(state.currentTime);state.selectedKeys=[keyRef('camera',currentCameraTrackId(),kt)];state.keySelection={kind:'camera',id:currentCameraTrackId(),time:kt};changed();renderTimeline();renderDocumentPanel?.();return true;}

// Extend existing animation/key functions with camera track support.
const _baseGetTrackArray=getTrackArray;getTrackArray=function(kind,id){if(kind==='camera')return state.anim.cameraTracks?.[id]||[];return _baseGetTrackArray(kind,id);};
const _baseEnsureTrackArray=ensureTrackArray;ensureTrackArray=function(kind,id){if(kind==='camera'){state.anim.cameraTracks=state.anim.cameraTracks||{};return state.anim.cameraTracks[id]||(state.anim.cameraTracks[id]=[]);}return _baseEnsureTrackArray(kind,id);};
const _baseSortAllAnimationKeys=sortAllAnimationKeys;sortAllAnimationKeys=function(){_baseSortAllAnimationKeys();Object.values(state.anim.cameraTracks||{}).forEach(a=>a.sort((x,y)=>x.t-y.t));};
const _baseApplyAnimationPose=applyAnimationPose;applyAnimationPose=function(time){_baseApplyAnimationPose(time);applyCameraAnimationPose(time);};
const _baseAllKeyTimes=allKeyTimes;allKeyTimes=function(){const set=new Set(_baseAllKeyTimes());Object.values(state.anim.cameraTracks||{}).forEach(a=>a.forEach(k=>set.add(k.t)));return[...set].sort((a,b)=>a-b);};
const _baseSelectSingleKey=selectSingleKey;selectSingleKey=function(kind,id,t){if(kind==='camera'){state.selected={type:'camera',id};state.selectedBones=[];state.selectedKeys=[keyRef(kind,id,t)];state.keySelection={kind,id,time:keyRef(kind,id,t).time};renderInspector?.();return;}return _baseSelectSingleKey(kind,id,t);};
const _baseKeySelected=keySelected;keySelected=function(){if(state.selected.type==='camera')return keyCamera();return _baseKeySelected();};
const _baseKeyAll=keyAll;keyAll=function(){_baseKeyAll();if(state.documentType==='toon'){writeCameraKey();state.selectedKeys.push(keyRef('camera',currentCameraTrackId(),roundTime(state.currentTime)));changed();renderTimeline();}};

// Extend persistence without rewriting all existing import internals.
const _baseExportData=exportData;exportData=function(){const data=_baseExportData();data.version=PROJECT_SAVE_VERSION;data.documentType=state.documentType||'game';data.projectName=state.projectName||'Untitled';if(state.documentType==='toon')data.toon=JSON.parse(JSON.stringify(ensureToon()));else delete data.toon;data.objects=(data.objects||[]).map(o=>{const src=rigObject(o.id);return{...o,renderLayerId:src?.renderLayerId||defaultRenderLayerId()};});data.animation={...(data.animation||{}),cameraTracks:state.anim.cameraTracks||{}};data.animations=(data.animations||[]).map(c=>{const src=(state.animations||[]).find(x=>x.id===c.id)||{};return{...c,cameraTracks:src.cameraTracks||{}};});data.editor={...(data.editor||{}),documentType:state.documentType,projectName:state.projectName,currentTime:state.currentTime};return data;};
const _baseImportData=importData;importData=function(raw,fromUndo=false){const data=typeof raw==='string'?JSON.parse(raw):raw;_baseImportData(data,fromUndo);state.documentType=normalizeDocumentType(data.documentType||data.editor?.documentType||'game');state.projectName=String(data.projectName||data.editor?.projectName||'Untitled');state.toon={...defaultToonSettings(),...(data.toon||{})};ensureToon();for(const oData of data.objects||[]){const o=rigObject(oData.id);if(o)o.renderLayerId=oData.renderLayerId||defaultRenderLayerId();}const clips=Array.isArray(data.animations)&&data.animations.length?data.animations:[data.animation||{}];for(const cData of clips){const c=state.animations.find(x=>x.id===(cData.id||state.activeAnimationId));if(c)c.cameraTracks=cData.cameraTracks||{};}state.anim=state.animations.find(c=>c.id===state.activeAnimationId)||state.animations[0];state.anim.cameraTracks=state.anim.cameraTracks||{};evaluate(Math.max(0,Number(data.editor?.currentTime)||0),false,false);refreshDocumentChrome();renderAll();exportJson(true);};

function dataUrlToBlob(dataUrl){const [head,body]=String(dataUrl||'').split(',');const mime=(head.match(/data:([^;]+)/)||[])[1]||'application/octet-stream';const bin=atob(body||'');const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:mime});}
function blobToDataUrl(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob);});}
function safeFileName(name,ext='png'){return String(name||('asset_'+Date.now())).replace(/\.[^.]+$/,'').replace(/[^a-z0-9_\-]+/gi,'_').slice(0,60)||('asset_'+Date.now());}
async function saveProjectFolder(){
  if(!window.showDirectoryPicker){alert('Folder save needs a Chromium-style browser with File System Access API.');return;}
  if(state.documentType==='none'){showNewProjectModal();return;}
  const dir=await window.showDirectoryPicker({mode:'readwrite'});const assets=await dir.getDirectoryHandle('assets',{create:true});
  const data=JSON.parse(JSON.stringify(exportData()));
  for(const a of data.attachments||[]){if(a.type==='image'&&a.src&&String(a.src).startsWith('data:')){const ext=(String(a.src).match(/^data:image\/(\w+)/)||[])[1]||'png';const fileName=safeFileName(a.name||a.id,ext)+'.'+ext;const handle=await assets.getFileHandle(fileName,{create:true});const w=await handle.createWritable();await w.write(dataUrlToBlob(a.src));await w.close();a.src='assets/'+fileName;}}
  const pj=await dir.getFileHandle('project.json',{create:true});const w=await pj.createWritable();await w.write(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));await w.close();
  alert('Saved project.json and assets/ folder.');
}
async function loadProjectFolder(){
  if(!window.showDirectoryPicker){alert('Folder load needs a Chromium-style browser with File System Access API.');return;}
  const dir=await window.showDirectoryPicker({mode:'read'});const pj=await (await dir.getFileHandle('project.json')).getFile();const data=JSON.parse(await pj.text());
  for(const a of data.attachments||[]){if(a.type==='image'&&a.src&&/^assets\//.test(a.src)){try{const rel=a.src.replace(/^assets\//,'');const ah=await dir.getDirectoryHandle('assets');const f=await (await ah.getFileHandle(rel)).getFile();a.src=await blobToDataUrl(f);}catch(err){console.warn('Missing asset',a.src,err);}}}
  pushUndo();importData(data,false);changed();syncWorkflowControls?.();
}
