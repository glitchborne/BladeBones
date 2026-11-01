// Shared DOM handles and editor state.

'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const canvas=$('#canvas');
const ctx=canvas.getContext('2d');
const colors=['#4ea1ff','#65d46e','#ffcc33','#ff7777','#b18cff','#44d9c5','#dddddd'];
const imageCache=new Map();

const state={
  documentType:'none',projectName:'Untitled',
  bones:[],slots:[],attachments:[],markers:[],poses:[],objects:[],
  nextBone:1,nextSlot:1,nextAtt:1,nextMarker:1,nextPose:1,nextClip:1,nextObject:1,projectRootId:'root',activeObjectId:null,lastObjectId:null,
  selected:{type:'bone',id:null},selectedBones:[],lastBoneId:null,lastSlotId:null,tool:'select',gizmoMode:'move',mode:'skeleton',inspectorTab:'transform',currentTime:0,playing:false,lastNow:performance.now(),
  anim:{id:'clip1',name:'anim',duration:1.2,fps:24,boneTracks:{},slotTracks:{},deformTracks:{},cameraTracks:{},events:[]},
  animations:[],activeAnimationId:null,
  toon:{canvas:{width:1920,height:1080,background:'#000000',transparent:true},cameras:[{id:'cam1',name:'Main Camera',x:0,y:0,r:0,z:1}],activeCameraId:'cam1',renderLayers:[{id:'bg',name:'Background',order:0,visible:true,locked:false},{id:'chars',name:'Characters',order:10,visible:true,locked:false},{id:'fx',name:'FX',order:20,visible:true,locked:false},{id:'ui',name:'UI',order:30,visible:true,locked:false}]},
  camera:{x:0,y:0,z:1},drag:null,ghost:null,
  view:{attachments:true,bones:true,names:true,rest:false,markers:true,mesh:true,stretch:false,cameraView:false,boneRoles:{root:true,deform:true,control:true,socket:true}},
  pick:{bones:true,slots:true,markers:true,lockNonBonesInPose:true,boneRoles:{root:true,deform:true,control:true,socket:true}},
  onion:{enabled:false,prev:1,next:1,stepFrames:2,opacity:.28,attachments:false},
  timeline:{display:'seconds',snapFrames:true,useRange:false,rangeStart:0,rangeEnd:1.2,selectedOnly:false,animatedOnly:false,channels:{camera:true,bones:true,slots:true,deform:true,events:true},collapsed:{},showEmptyGroups:true},
  color:{defaultTint:'#ffffff',defaultTintAlpha:0,defaultBlendMode:'normal'},
  outliner:{query:'',tab:'scene',showBones:true,showSlots:true,showMarkers:true,showUnbound:true,roleFilter:'all'},
  layout:{
    leftW:300,rightW:356,viewFiltersW:230,timelineH:260,timelineLeftW:300,timelineRightW:356,meshWorkbenchH:420,
    leftCollapsed:false,rightCollapsed:false,viewFiltersCollapsed:false,timelineCollapsed:false,timelineLeftCollapsed:false,jsonCollapsed:false
  },
  keySelection:{kind:null,id:null,time:null},selectedKeys:[],keyClipboard:null,poseClipboard:null,timelineDrag:null,health:{warnings:[],lastRun:null},
  art:{autoPlace:true,autoBindOnBoneCreate:false},ik:{enabled:false,chain:3},elastic:{preview:true,bakeVisualError:1,bakeMaxInterval:.42,sim:{},lastFrameTime:null},
  rig:{setupPoseVersion:2,protectSetupInAnimation:true,bindPoseLastSetAt:null,bindPoseDirty:false,testPose:{active:false,snapshot:null,dirty:false,showSetupGhost:true,startedAt:null}},
  meshEdit:{enabled:false,tool:'vertices',workbenchTab:'binding',bindingTab:'workflow',selectionMode:'vertex',actionTool:'select',weightTool:'paint',selectedVerts:[],selectedEdges:[],selectedFaces:[],hoveredVert:null,hoveredEdge:null,hoveredFace:null,knifePath:[],showWeights:true,maxInfluences:4,weightBoneId:null,weightBrushSize:46,weightBrushStrength:.35,weightBrushValue:1,weightBrushMode:'add',weightBrushSelectedOnly:false,weightAdjustSensitivity:.005,weightAdjustDelta:0,weightVertexDisplay:'activeFill',showDiagnostics:true,weightMirrorAxis:'slot',weightMirrorDirection:'selected',weightBrushCursor:null,weightBrushHits:[],weightPaintSession:null},
  renderExport:{scope:'sequence',output:'final',range:'clip',busy:false,lastMessage:''},loop:true,undo:[],redo:[],loading:false
};
