'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sourceFiles = [
  'js/state.js',
  'js/utils.js',
  'js/model.js',
  'js/animation-curves.js',
  'js/commands.js',
  'js/persistence.js',
  'js/doc-types.js'
];

function makeElement(){
  return{
    value:'',innerHTML:'',textContent:'',checked:false,
    classList:{add(){},remove(){},toggle(){}},
    getContext(){return{};},querySelector(){return makeElement();},querySelectorAll(){return[];},
    appendChild(){},remove(){},click(){},focus(){},blur(){},
    style:{},dataset:{},children:[]
  };
}

function loadEditor(){
  const elements=new Map();
  const elementFor=selector=>{if(!elements.has(selector))elements.set(selector,makeElement());return elements.get(selector);};
  const document={
    activeElement:null,body:makeElement(),
    querySelector:elementFor,querySelectorAll:()=>[],createElement:()=>makeElement()
  };
  const context=vm.createContext({
    console,document,performance:{now:()=>0},requestAnimationFrame:()=>0,
    localStorage:{getItem:()=>null,setItem(){}},navigator:{},window:{},
    setTimeout,clearTimeout,Blob,URL,FileReader:function(){},atob:s=>Buffer.from(s,'base64').toString('binary')
  });
  for(const file of sourceFiles){
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  }
  vm.runInContext('renderAll=()=>{};renderInspector=()=>{};syncTime=()=>{};refreshImages=()=>{};',context);
  return context;
}

function run(context,source){return vm.runInContext(source,context);}
function read(context,source){return JSON.parse(run(context,`JSON.stringify(${source})`));}

function canonicalProject(){
  const transform=(x=0,y=0,r=0,len=50)=>({x,y,r,len,sx:1,sy:1});
  const vertices=[
    {x:-20,y:-20,u:0,v:0,weights:[{bone:'b2',w:.65,x:-20,y:-20}]},
    {x:20,y:-20,u:1,v:0,weights:[{bone:'b2',w:.65,x:20,y:-20}]},
    {x:20,y:20,u:1,v:1,weights:[{bone:'b2',w:.65,x:20,y:20}]},
    {x:-20,y:20,u:0,v:1,weights:[{bone:'b2',w:.65,x:-20,y:20}]}
  ];
  const curve={type:'bezier',x1:.2,y1:.1,x2:.8,y2:.9};
  const clip={
    id:'walk',name:'Walk Cycle',duration:1,fps:30,
    boneTracks:{b2:[
      {t:0,x:0,y:0,r:0,len:50,sx:1,sy:1,curve},
      {t:1,x:4,y:2,r:12,len:52,sx:1.1,sy:.9,curve:{type:'linear',x1:0,y1:0,x2:1,y2:1},outTangent:{x:2},inTangent:{x:1}}
    ]},
    slotTracks:{s1:[
      {t:0,x:4,y:5,r:0,sx:1,sy:1,visible:true,attachment:'a1',alpha:.8,tint:'#aabbcc',tintAlpha:.2,blendMode:'normal',curve},
      {t:1,x:8,y:6,r:4,sx:1.2,sy:1,visible:true,attachment:'a1',alpha:.6,tint:'#ffffff',tintAlpha:.1,blendMode:'add',curve:{type:'linear',x1:0,y1:0,x2:1,y2:1}}
    ]},
    deformTracks:{s1:[
      {t:0,offsets:vertices.map(()=>({x:0,y:0})),curve},
      {t:1,offsets:[{x:1,y:0},{x:2,y:0},{x:2,y:1},{x:1,y:1}],curve:{type:'hold',x1:0,y1:0,x2:1,y2:0}}
    ]},
    cameraTracks:{'camera-main':[
      {t:0,x:10,y:20,r:0,z:1,curve},
      {t:1,x:90,y:40,r:20,z:1.5,curve:{type:'linear',x1:0,y1:0,x2:1,y2:1}}
    ]},
    events:[{t:.5,name:'footstep',payload:{surface:'stone',volume:.7}}]
  };
  const secondClip={id:'idle',name:'Idle',duration:1,fps:24,boneTracks:{},slotTracks:{},deformTracks:{},cameraTracks:{'camera-main':[{t:0,x:10,y:20,r:0,z:1,curve:{type:'smooth',x1:.33,y1:0,x2:.67,y2:1}}]},events:[]};
  return{
    version:'indie-2d-v11-stable-runtime-export',documentType:'toon',projectName:'Serialization Contract',
    objects:[{id:'obj1',name:'Hero',root:'b1',parentSlot:null,visible:true,renderLayerId:'fx'}],
    bones:[
      {id:'root',name:'Project Root',parent:null,isRoot:true,rest:transform(0,0,0,70),local:transform(0,0,0,70),width:20,color:'#ffcc33',shape:'cross',role:'root'},
      {id:'b1',name:'Hero Root',parent:'root',objectId:'obj1',objectRoot:true,connected:false,rest:transform(2,3,0,40),local:transform(2,3,0,40),width:16,color:'#ffcc33',shape:'bone',role:'root'},
      {id:'b2',name:'Arm',parent:'b1',objectId:'obj1',connected:false,rest:transform(0,0,0,50),local:transform(0,0,0,50),width:10,color:'#88ccff',shape:'bone',role:'deform',affectWeights:true,elastic:{enabled:true,mode:'spring',preset:'Tail',stiffness:.4,damping:.6,stretch:0}}
    ],
    slots:[{
      id:'s1',name:'Arm Art',bone:'b2',parentBone:'b2',objectId:'obj1',attachment:'a1',visible:true,alpha:.8,
      tint:'#aabbcc',tintAlpha:.2,blendMode:'normal',local:{x:4,y:5,r:0,sx:1,sy:1},setupLocal:{x:4,y:5,r:0,sx:1,sy:1},
      pose:{visible:true,alpha:.8,attachment:'a1',tint:'#aabbcc',tintAlpha:.2,blendMode:'normal'},
      mesh:{enabled:true,version:3,vertices,triangles:[[0,1,2],[0,2,3]],edges:[],hull:[],selected:[],bindPoseVersion:1,gridCols:1,gridRows:1}
    }],
    attachments:[{id:'a1',name:'arm.png',type:'image',w:40,h:40,naturalW:40,naturalH:40,pivotX:.5,pivotY:.5,color:'#ffffff',src:'assets/arm.png'}],
    markers:[{id:'m1',type:'socket',name:'hand',bone:'b2',x:10,y:2,r:0,w:8,h:8,visible:true}],
    poses:[{id:'p1',name:'Reach',category:'Combat',bones:{b2:transform(1,2,10,50)},selectedOnly:false,createdAt:'2026-01-01T00:00:00.000Z'}],
    animations:[clip,secondClip],animation:clip,activeAnimationId:'walk',
    toon:{
      canvas:{width:1280,height:720,background:'#102030',transparent:false},
      cameras:[{id:'camera-main',name:'Main',x:50,y:30,r:10,z:1.25,setup:{x:5,y:7,r:2,z:1.1}}],activeCameraId:'camera-main',
      renderLayers:[{id:'bg',name:'Background',order:0,visible:true,locked:false},{id:'chars',name:'Characters',order:10,visible:true,locked:false},{id:'fx',name:'FX',order:20,visible:true,locked:true}]
    },
    editor:{projectRootId:'root',currentTime:.5,activeObjectId:'obj1',lastObjectId:'obj1',selected:{type:'bone',id:'b2'},selectedBones:['b2'],layout:{timelineH:310},view:{bones:true},timeline:{rangeStart:0,rangeEnd:1}}
  };
}

function loadedProject(){
  const context=loadEditor();
  context.__project=canonicalProject();
  run(context,'importData(__project,false)');
  return context;
}

function runtimeFixture(){return read(loadedProject(),'buildRuntimeDocument()');}
function withoutRuntimeMeta(runtime){const copy=structuredClone(runtime);delete copy.meta;return copy;}
function validationError(runtime,pattern){
  const context=loadEditor();context.__runtime=runtime;
  const result=read(context,'validateRuntimeDocument(__runtime)');
  assert.equal(result.ok,false,`Expected validator errors for ${pattern}`);
  assert.match(result.errors.join('\n'),pattern);
  return result;
}

test('Project JSON serialize-deserialize-serialize preserves editable ToonDoc semantics',()=>{
  const context=loadedProject();
  const first=read(context,'exportData()');
  context.__roundTrip=first;
  run(context,'importData(__roundTrip,false)');
  const second=read(context,'exportData()');
  assert.equal(JSON.stringify(second),JSON.stringify(first));
});

test('GameDoc project round trip omits ToonDoc-only settings',()=>{
  const context=loadEditor();const project=canonicalProject();
  project.documentType='game';delete project.toon;project.animations.forEach(clip=>{clip.cameraTracks={};});project.animation.cameraTracks={};
  context.__project=project;run(context,'importData(__project,false)');
  const first=read(context,'exportData()');context.__roundTrip=first;run(context,'importData(__roundTrip,false)');
  const second=read(context,'exportData()');
  assert.equal(Object.hasOwn(first,'toon'),false);
  assert.equal(JSON.stringify(second),JSON.stringify(first));
});

test('Project save preserves each object render layer',()=>{
  const data=read(loadedProject(),'exportData()');
  assert.equal(data.objects[0].renderLayerId,'fx');
});

test('Project and runtime preserve an explicit empty slot setup attachment',()=>{
  const context=loadEditor(),project=canonicalProject();
  project.slots[0].attachment=null;project.slots[0].pose.attachment=null;
  context.__project=project;run(context,'importData(__project,false)');
  const first=read(context,'exportData()');
  assert.equal(first.slots[0].attachment,null);
  assert.equal(first.slots[0].pose.attachment,'a1');
  const runtime=read(context,'buildRuntimeDocument()');
  assert.equal(runtime.slots[0].attachment,null);
  assert.equal(runtime.slots[0].setup.attachment,null);
  context.__roundTrip=first;run(context,'importData(__roundTrip,false)');
  const second=read(context,'exportData()');
  assert.equal(JSON.stringify(second),JSON.stringify(first));
});

test('Project save preserves ToonDoc cameras, render layers and current playhead',()=>{
  const data=read(loadedProject(),'exportData()');
  assert.deepEqual(data.toon.cameras[0].setup,{x:5,y:7,r:2,z:1.1});
  assert.equal(data.toon.renderLayers.find(layer=>layer.id==='fx').locked,true);
  assert.equal(data.editor.currentTime,.5);
});

test('Legacy ToonDoc cameras migrate their saved transform into stable setup data',()=>{
  const context=loadEditor();const project=canonicalProject();
  project.toon.cameras[0]={id:'camera-main',name:'Main',x:17,y:19,r:-4,z:1.4};
  context.__project=project;run(context,'importData(__project,false)');
  const camera=read(context,'exportData().toon.cameras[0]');
  assert.deepEqual(camera.setup,{x:17,y:19,r:-4,z:1.4});
});

test('Clip normalize-export round trip preserves transform, deform, camera tracks, curves and metadata',()=>{
  const context=loadEditor();context.__clip=canonicalProject().animations[0];
  const result=read(context,'clipForExport(normalizeImportedClip(__clip))');
  assert.deepEqual(result,context.__clip);
});

test('Project save keeps camera tracks on active and inactive clips',()=>{
  const clips=read(loadedProject(),'exportData().animations');
  assert.deepEqual(Object.keys(clips[0].cameraTracks),['camera-main']);
  assert.deepEqual(Object.keys(clips[1].cameraTracks),['camera-main']);
});

test('Folder save writes asset paths without mutating in-memory attachment sources',async()=>{
  const context=loadedProject();
  run(context,"state.attachments[0].src='data:image/png;base64,AAAA'");
  let writes=0;
  const writer={write:async()=>{writes++;},close:async()=>{}};
  const file={createWritable:async()=>writer};
  const assets={getFileHandle:async()=>file};
  const folder={getDirectoryHandle:async()=>assets,getFileHandle:async()=>file};
  context.window.showDirectoryPicker=async()=>folder;
  context.alert=()=>{};
  await run(context,'saveProjectFolder()');
  assert.equal(read(context,'state.attachments[0].src'),'data:image/png;base64,AAAA');
  assert.equal(writes,2);
});

test('Runtime export uses camera setup rather than the animated playhead pose',()=>{
  const context=loadedProject();
  const first=read(context,'buildRuntimeDocument()');
  assert.deepEqual(first.toon.cameras[0],{id:'camera-main',name:'Main',x:5,y:7,r:2,z:1.1});
  run(context,'evaluate(1,false,false)');
  const second=read(context,'buildRuntimeDocument()');
  assert.deepEqual(second.toon.cameras,first.toon.cameras);
  assert.deepEqual(second.meshes,first.meshes);
});

test('Runtime export leaves editor-only state out of the payload',()=>{
  const context=loadedProject();
  run(context,"state.tool='knife';state.mode='pose';state.meshEdit.weightPaintSession={active:true};state.undo.push('editor history');state.animations[0].boneTracks.b2[0].selected=true;state.animations[0].boneTracks.b2[0].dragCache={x:1};state.animations[0].boneTracks.b2[0].curve.editorHandle={x:2};state.animations[0].events[0].selected=true;state.toon.canvas.panelOpen=true");
  const runtime=read(context,'buildRuntimeDocument()');
  for(const key of ['editor','selection','selected','tool','mode','layout','undo','redo','currentTime','weightPaintSession'])assert.equal(Object.hasOwn(runtime,key),false,`Unexpected runtime field ${key}`);
  assert.equal(Object.hasOwn(runtime.animations[0].boneTracks.b2[0],'selected'),false);
  assert.equal(Object.hasOwn(runtime.animations[0].boneTracks.b2[0],'dragCache'),false);
  assert.equal(Object.hasOwn(runtime.animations[0].boneTracks.b2[0].curve,'editorHandle'),false);
  assert.equal(Object.hasOwn(runtime.animations[0].events[0],'selected'),false);
  assert.equal(Object.hasOwn(runtime.toon.canvas,'panelOpen'),false);
  assert.equal(Object.hasOwn(runtime.meshes[0],'deformSetup'),false);
});

test('Runtime validator rejects editor-only payload fields',()=>{
  const runtime=runtimeFixture();runtime.editor={selected:{type:'bone',id:'b2'}};
  validationError(runtime,/contains editor-only field editor/);
});

test('Runtime validator rejects editor-only fields nested in animation keys',()=>{
  const runtime=runtimeFixture();runtime.animations[0].boneTracks.b2[0].selectedKeys=['b2'];
  validationError(runtime,/contains editor-only field selectedKeys/);
});

test('Canonical runtime fixture exports and validates under v11',()=>{
  const context=loadedProject();
  const runtime=read(context,'JSON.parse(runtimeJsonString())');
  assert.equal(runtime.objects[0].renderLayerId,'fx');
  assert.equal(runtime.slots[0].drawOrder,0);
  assert.equal(runtime.slots[0].mesh,'s1:mesh');
  assert.equal(runtime.meshes[0].weights[0][0].w,.65);
  assert.deepEqual(runtime.meshes[0].weights[0][0].bind,{x:-20,y:-20});
  assert.equal(Object.hasOwn(runtime.toon.renderLayers[2],'locked'),false);
  context.__runtime=runtime;
  const result=read(context,'validateRuntimeDocument(__runtime)');
  assert.equal(result.ok,true,result.errors.join('\n'));
  assert.equal(result.errors.length,0);
});

test('GameDoc runtime omits ToonDoc render-layer references and validates',()=>{
  const context=loadEditor(),project=canonicalProject();
  project.documentType='game';delete project.toon;project.animations.forEach(clip=>{clip.cameraTracks={};});project.animation.cameraTracks={};
  context.__project=project;run(context,'importData(__project,false)');
  const runtime=read(context,'JSON.parse(runtimeJsonString())');
  assert.equal(Object.hasOwn(runtime,'toon'),false);
  assert.equal(Object.hasOwn(runtime.objects[0],'renderLayerId'),false);
  context.__runtime=runtime;
  const result=read(context,'validateRuntimeDocument(__runtime)');
  assert.equal(result.ok,true,result.errors.join('\n'));
});

test('Runtime contract errors on weight sums above one',()=>{
  const runtime=runtimeFixture();runtime.meshes[0].weights[0].push({bone:'b1',w:.4,bind:{x:0,y:0}});
  const result=validationError(runtime,/weights exceed 100%/);
  assert.equal(result.warnings.some(message=>/weights exceed/.test(message)),false);
});

test('Runtime contract errors on missing weighted bone references',()=>{
  const runtime=runtimeFixture();runtime.meshes[0].weights[0][0].bone='missing-bone';
  validationError(runtime,/references missing bone missing-bone/);
});

test('Runtime contract errors on missing bind coordinates',()=>{
  const runtime=runtimeFixture();delete runtime.meshes[0].weights[0][0].bind.x;
  validationError(runtime,/missing or invalid bind coordinates/);
});

test('Runtime contract errors on invalid mesh triangle indices',()=>{
  const runtime=runtimeFixture();runtime.meshes[0].triangles[0]=[0,1,99];
  validationError(runtime,/has invalid triangle/);
});

test('Runtime contract errors on broken slot, object and marker references',()=>{
  const runtime=runtimeFixture();runtime.slots[0].bone='missing-bone';runtime.objects[0].parentSlot='missing-slot';runtime.markers[0].bone='missing-marker-bone';
  const result=validationError(runtime,/Slot s1 references missing parent bone/);
  assert.match(result.errors.join('\n'),/Object obj1 references missing parent slot/);
  assert.match(result.errors.join('\n'),/Marker m1 references missing bone/);
});

test('Runtime contract errors on missing render layers',()=>{
  const runtime=runtimeFixture();runtime.objects[0].renderLayerId='missing-layer';
  validationError(runtime,/references missing render layer missing-layer/);
});

test('Runtime contract rejects nested object cycles',()=>{
  const runtime=runtimeFixture();runtime.objects[0].parentSlot='s1';
  validationError(runtime,/Object hierarchy contains a cycle/);
});

test('Runtime export keeps an invalid slot parent visible to validation',()=>{
  const context=loadedProject();run(context,"state.slots[0].bone='missing-bone'");
  const runtime=read(context,'buildRuntimeDocument()');
  assert.equal(runtime.slots[0].bone,'missing-bone');
  context.__runtime=runtime;
  const result=read(context,'validateRuntimeDocument(__runtime)');
  assert.match(result.errors.join('\n'),/Slot s1 references missing parent bone missing-bone/);
});

test('Runtime export preserves invalid mesh indices so validation can report them',()=>{
  const context=loadedProject();run(context,'state.slots[0].mesh.triangles[0][2]=99');
  const runtime=read(context,'JSON.parse(runtimeJsonString())');
  assert.equal(runtime.meshes[0].triangles[0][2],99);
  context.__runtime=runtime;
  const result=read(context,'validateRuntimeDocument(__runtime)');
  assert.match(result.errors.join('\n'),/has invalid triangle/);
});

test('Runtime contract requires every bone setup pose entry',()=>{
  const runtime=runtimeFixture();delete runtime.setupPose.bones.b2;
  validationError(runtime,/Bone b2 is missing setup pose entry/);
});

test('Runtime contract requires complete slot setup data',()=>{
  const runtime=runtimeFixture();delete runtime.slots[0].setup.x;
  validationError(runtime,/Slot s1 setup.x must be finite/);
});

test('Runtime contract rejects cyclic bone hierarchy',()=>{
  const runtime=runtimeFixture();runtime.bones.find(bone=>bone.id==='b1').parent='b2';
  validationError(runtime,/hierarchy contains a cycle/);
});

test('Runtime contract rejects malformed animation track arrays and key data',()=>{
  const runtime=runtimeFixture();runtime.animations[0].boneTracks.b2={t:0};
  validationError(runtime,/bone track b2 must be an array/);
});

test('Runtime contract rejects animation tracks that reference missing bones',()=>{
  const runtime=runtimeFixture();runtime.animations[0].boneTracks['missing-bone']=[{t:0,x:0,y:0,r:0,len:1}];
  validationError(runtime,/bone track references missing bone missing-bone/);
});

test('Runtime contract rejects deform keys with the wrong vertex count',()=>{
  const runtime=runtimeFixture();runtime.animations[0].deformTracks.s1[0].offsets.pop();
  validationError(runtime,/has 3 offsets; mesh has 4 vertices/);
});

test('Runtime contract rejects camera tracks that reference unknown ToonDoc cameras',()=>{
  const runtime=runtimeFixture();runtime.animations[0].cameraTracks.unknown=[{t:0,x:0,y:0,r:0,z:1}];
  validationError(runtime,/camera track references missing camera unknown/);
});

test('Runtime contract rejects malformed curves and missing animation times',()=>{
  const runtime=runtimeFixture();runtime.animations[0].boneTracks.b2[0].curve={type:'bezier',x1:0};delete runtime.animations[0].boneTracks.b2[0].t;
  const result=validationError(runtime,/has invalid time/);
  assert.match(result.errors.join('\n'),/bezier curve is missing numeric y1/);
});
