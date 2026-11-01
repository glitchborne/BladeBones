'use strict';
// Shared 2D transform gizmo helpers. The gizmo is deliberately target-agnostic:
// slots, bones and vertex selections can all use the same screen-space handles.
function gizmoPointSegDist(p,a,b){
  const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,l2=vx*vx+vy*vy||1;
  const t=clamp((wx*vx+wy*vy)/l2,0,1);
  return Math.hypot(p.x-(a.x+vx*t),p.y-(a.y+vy*t));
}
function gizmoArrowEnd(p,axis,len=58){return axis==='x'?{x:p.x+len,y:p.y}:{x:p.x,y:p.y-len};}
function gizmoAxisHit(clientX,clientY,p,{centerRadius=14,axisRadius=9,len=64}={}){
  const q={x:clientX,y:clientY};
  if(Math.hypot(q.x-p.x,q.y-p.y)<=centerRadius)return 'xy';
  const x0={x:p.x+14,y:p.y},x1={x:p.x+len,y:p.y};
  const y0={x:p.x,y:p.y-14},y1={x:p.x,y:p.y-len};
  if(gizmoPointSegDist(q,x0,x1)<=axisRadius||Math.hypot(q.x-x1.x,q.y-x1.y)<=axisRadius+4)return 'x';
  if(gizmoPointSegDist(q,y0,y1)<=axisRadius||Math.hypot(q.x-y1.x,q.y-y1.y)<=axisRadius+4)return 'y';
  return null;
}
function draw2DMoveGizmoAt(p,{label='',alpha=1,innerGap=0,centerRadius=7,centerStyle='solid',len=58,labelOffset=null}={}){
  ctx.save();ctx.globalAlpha=alpha;ctx.lineWidth=2;ctx.strokeStyle='#ffcc33';ctx.fillStyle='#101010';
  const xEnd=gizmoArrowEnd(p,'x',len),yEnd=gizmoArrowEnd(p,'y',len);
  const xStart={x:p.x+Math.max(0,innerGap),y:p.y};
  const yStart={x:p.x,y:p.y-Math.max(0,innerGap)};
  ctx.beginPath();ctx.moveTo(xStart.x,xStart.y);ctx.lineTo(xEnd.x,xEnd.y);ctx.moveTo(yStart.x,yStart.y);ctx.lineTo(yEnd.x,yEnd.y);ctx.stroke();
  ctx.fillStyle='#ffcc33';
  ctx.beginPath();ctx.moveTo(xEnd.x+10,xEnd.y);ctx.lineTo(xEnd.x-4,xEnd.y-6);ctx.lineTo(xEnd.x-4,xEnd.y+6);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(yEnd.x,yEnd.y-10);ctx.lineTo(yEnd.x-6,yEnd.y+4);ctx.lineTo(yEnd.x+6,yEnd.y+4);ctx.closePath();ctx.fill();
  ctx.fillStyle='#101010';ctx.strokeStyle='#ffcc33';ctx.beginPath();ctx.arc(p.x,p.y,centerRadius,0,Math.PI*2);
  if(centerStyle==='solid')ctx.fill();ctx.stroke();
  ctx.fillStyle='#ffcc33';ctx.font='11px system-ui';ctx.fillText('X',xEnd.x+13,xEnd.y+4);ctx.fillText('Y',yEnd.x+8,yEnd.y-12);
  if(label){const o=labelOffset||{x:12,y:-12};ctx.fillText(label,p.x+o.x,p.y+o.y);}
  ctx.restore();
}
function drawSelectionBounds(bounds,{dashed=true,color='#ffcc33'}={}){
  const x=bounds.x,y=bounds.y,w=bounds.w,h=bounds.h;
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.5;if(dashed)ctx.setLineDash([5,3]);ctx.strokeRect(x,y,w,h);ctx.restore();
}
function expandedScreenBounds(points,minSize=42){
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y);let minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  if(maxX-minX<minSize){minX=cx-minSize/2;maxX=cx+minSize/2;}
  if(maxY-minY<minSize){minY=cy-minSize/2;maxY=cy+minSize/2;}
  return{x:minX,y:minY,w:maxX-minX,h:maxY-minY,cx,cy};
}
function selectedVertexGizmoInfo(){
  if(!meshEditorActive()||state.meshEdit?.tool==='weights')return null;
  const s=selectedSlot();const m=ensureSlotMesh(s);if(!s||!m||!m.vertices.length)return null;
  const ids=meshSelectedIndices(s);if(!ids.length)return null;
  const worldAll=slotMeshWorldVertices(s);const pts=ids.map(i=>worldAll[i]).filter(Boolean);if(!pts.length)return null;
  const screens=pts.map(w2s);const bounds=expandedScreenBounds(screens,44);
  const pivotWorld={x:pts.reduce((a,p)=>a+p.x,0)/pts.length,y:pts.reduce((a,p)=>a+p.y,0)/pts.length};
  const pivotScreen=w2s(pivotWorld);
  const selMode=(state.meshEdit?.tool==='vertices'?(state.meshEdit.selectionMode||'vertex'):'vertex');
  const elementLabel=selMode==='edge'?'EDGE':(selMode==='face'?'TRIANGLE':'VERTEX');
  const elementCount=selMode==='edge'?(state.meshEdit.selectedEdges?.length||0):(selMode==='face'?(state.meshEdit.selectedFaces?.length||0):ids.length);
  return{slot:s,mesh:m,indices:ids,world:pts,screens,bounds,pivotWorld,pivotScreen,tool:state.meshEdit.tool,elementLabel,elementCount};
}
function drawVertexTransformGizmo(){
  const g=selectedVertexGizmoInfo();if(!g)return;
  ctx.save();
  drawSelectionBounds(g.bounds,{dashed:false,color:'#ffcc33'});
  const p=g.pivotScreen;
  ctx.fillStyle='#ffcc33';ctx.font='11px system-ui';
  const item=(g.elementLabel||'VERTEX').toLowerCase();
  const count=g.elementCount||g.indices.length;
  const itemWord=item==='vertex'?(count===1?'vertex':'vertices'):(count===1?item:item+'s');
  const label=(g.tool==='deform'?'FFD':(g.elementLabel||'MESH'))+' · '+count+' '+itemWord+' · '+g.indices.length+' vert'+(g.indices.length===1?'':'s');
  if(state.gizmoMode==='move'){
    draw2DMoveGizmoAt(p,{label});
  }else if(state.gizmoMode==='scale'){
    const b=g.bounds;const handles=[
      {x:b.x,y:b.y,axis:'uniform'},{x:b.x+b.w,y:b.y,axis:'uniform'},{x:b.x+b.w,y:b.y+b.h,axis:'uniform'},{x:b.x,y:b.y+b.h,axis:'uniform'},
      {x:b.x+b.w/2,y:b.y,axis:'y'},{x:b.x+b.w,y:b.y+b.h/2,axis:'x'},{x:b.x+b.w/2,y:b.y+b.h,axis:'y'},{x:b.x,y:b.y+b.h/2,axis:'x'}
    ];
    ctx.strokeStyle='#ffcc33';ctx.fillStyle='#101010';ctx.lineWidth=1.5;
    for(const h of handles){if(h.axis==='uniform'){ctx.fillRect(h.x-5,h.y-5,10,10);ctx.strokeRect(h.x-5,h.y-5,10,10);}else{ctx.beginPath();ctx.arc(h.x,h.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}}
    ctx.fillStyle='#101010';ctx.strokeStyle='#ffcc33';ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffcc33';ctx.fillText(label+' · SCALE',p.x+12,p.y-12);
  }else if(state.gizmoMode==='rotate'){
    const b=g.bounds;const r=Math.max(28,Math.hypot(b.w,b.h)/2+18);
    ctx.strokeStyle='#ffcc33';ctx.fillStyle='#101010';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.stroke();
    const h={x:p.x,y:p.y-r};ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(h.x,h.y);ctx.stroke();ctx.beginPath();ctx.arc(h.x,h.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffcc33';ctx.fillText(label+' · ROTATE',p.x+12,p.y-12);
  }
  ctx.restore();
}
function hitTestVertexGizmoScreen(clientX,clientY){
  const g=selectedVertexGizmoInfo();if(!g)return null;
  const p=g.pivotScreen;
  if(state.gizmoMode==='move'){
    const axis=gizmoAxisHit(clientX,clientY,p,{centerRadius:15,axisRadius:10,len:70});
    if(axis)return{mode:'move',axis,info:g};
    return null;
  }
  if(state.gizmoMode==='scale'){
    const b=g.bounds;const q={x:clientX,y:clientY};
    const handles=[
      {x:b.x,y:b.y,axis:'uniform'},{x:b.x+b.w,y:b.y,axis:'uniform'},{x:b.x+b.w,y:b.y+b.h,axis:'uniform'},{x:b.x,y:b.y+b.h,axis:'uniform'},
      {x:b.x+b.w/2,y:b.y,axis:'y'},{x:b.x+b.w,y:b.y+b.h/2,axis:'x'},{x:b.x+b.w/2,y:b.y+b.h,axis:'y'},{x:b.x,y:b.y+b.h/2,axis:'x'}
    ];
    for(const h of handles){if(Math.hypot(q.x-h.x,q.y-h.y)<=12)return{mode:'scale',axis:h.axis,info:g,startHandle:{x:h.x,y:h.y}};}
    return null;
  }
  if(state.gizmoMode==='rotate'){
    const b=g.bounds;const r=Math.max(28,Math.hypot(b.w,b.h)/2+18);const d=Math.hypot(clientX-p.x,clientY-p.y);
    if(Math.abs(d-r)<=12||Math.hypot(clientX-p.x,clientY-(p.y-r))<=14)return{mode:'rotate',axis:'z',info:g};
    return null;
  }
  return null;
}
function makeVertexGizmoDrag(hit,e){
  const g=hit.info,s=g.slot,m=g.mesh;const startWorld=s2w(e.clientX-canvas.getBoundingClientRect().left,e.clientY-canvas.getBoundingClientRect().top);
  const startScreen=canvasPoint(e);
  const sw=slotWorld(s);
  const starts=g.indices.map(i=>{
    const v=m.vertices[i];
    if(g.tool==='deform'){
      const off=slotDeformOffset(s,i);return{i,startWorld:slotMeshWorldVertices(s)[i],baseWorld:slotMeshVertexWorldNoDeform(s,v),ox:off.x||0,oy:off.y||0};
    }
    return{i,startWorld:slotMeshBaseVertexWorld(s,v)};
  });
  return{type:'vertexGizmo',id:s.id,tool:g.tool,mode:hit.mode,axis:hit.axis,startWorld,startScreen,pivotWorld:{...g.pivotWorld},pivotScreen:{...g.pivotScreen},starts,sw:sw?{...sw}:null};
}
function applyVertexGizmoDrag(d,e){
  const s=slot(d.id);const m=ensureSlotMesh(s);if(!s||!m)return;
  const cp=canvasPoint(e);const nowWorld=pointer(e);
  let sx=1,sy=1,ang=0,delta={x:nowWorld.x-d.startWorld.x,y:nowWorld.y-d.startWorld.y};
  if(d.mode==='move'){
    if(d.axis==='x')delta.y=0;if(d.axis==='y')delta.x=0;
  }else if(d.mode==='scale'){
    const px=d.pivotScreen.x,py=d.pivotScreen.y;
    const dx0=d.startScreen.x-px,dy0=d.startScreen.y-py,dx=cp.x-px,dy=cp.y-py;
    if(d.axis==='x')sx=clamp(Math.abs(dx)/Math.max(1,Math.abs(dx0)),.05,20);
    else if(d.axis==='y')sy=clamp(Math.abs(dy)/Math.max(1,Math.abs(dy0)),.05,20);
    else{const f=clamp(Math.hypot(dx,dy)/Math.max(1,Math.hypot(dx0,dy0)),.05,20);sx=f;sy=f;}
  }else if(d.mode==='rotate'){
    ang=Math.atan2(nowWorld.y-d.pivotWorld.y,nowWorld.x-d.pivotWorld.x)-Math.atan2(d.startWorld.y-d.pivotWorld.y,d.startWorld.x-d.pivotWorld.x);
  }
  const cos=Math.cos(ang),sin=Math.sin(ang),piv=d.pivotWorld;
  const transform=(p)=>{
    if(d.mode==='move')return{x:p.x+delta.x,y:p.y+delta.y};
    let x=(p.x-piv.x)*sx,y=(p.y-piv.y)*sy;
    if(d.mode==='rotate'){const rx=x*cos-y*sin,ry=x*sin+y*cos;x=rx;y=ry;}
    return{x:piv.x+x,y:piv.y+y};
  };
  for(const st of d.starts||[]){
    const nw=transform(st.startWorld);
    if(d.tool==='deform'){
      const sw=slotWorld(s);if(!sw)continue;const dv={x:nw.x-st.baseWorld.x,y:nw.y-st.baseWorld.y};const loc=inverseVectorFromBasis(sw,dv);setSlotDeformOffset(s,st.i,loc.x,loc.y);
    }else setSlotMeshVertexWorld(s,st.i,nw,{updateUV:true});
  }
  renderInspector();
}


// ToonDoc camera gizmo. The render camera lives in scene/world space; the
// editor viewport remains an independent pan/zoom camera.
function cameraGizmoInfo(){
  if(typeof isToonCameraView==='function'&&isToonCameraView())return null;
  if(state.documentType!=='toon'||state.selected?.type!=='camera'||typeof toonCameraFrameInfo!=='function')return null;
  const info=toonCameraFrameInfo(state.selected.id);if(!info||!info.cam)return null;
  const b=expandedScreenBounds(info.corners,48);
  const radius=Math.max(42,Math.hypot(b.w,b.h)/2+24);
  const angle=rad(Number(info.cam.r||0)+90);
  const rotateHandle={x:info.center.x+Math.cos(angle)*radius,y:info.center.y-Math.sin(angle)*radius};
  return{...info,bounds:b,rotateRadius:radius,rotateHandle};
}
function drawCameraUniversalGizmo(){
  const g=cameraGizmoInfo();if(!g)return false;
  const c=g.center;
  ctx.save();ctx.strokeStyle='#ffcc33';ctx.fillStyle='#101010';ctx.lineWidth=1.7;ctx.font='11px system-ui';
  ctx.setLineDash([4,3]);ctx.beginPath();g.corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  if(state.gizmoMode==='move'){
    if(typeof draw2DMoveGizmoAt==='function')draw2DMoveGizmoAt(c,{label:'CAMERA'});
    else{ctx.beginPath();ctx.arc(c.x,c.y,16,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffcc33';ctx.fillText('CAMERA',c.x+12,c.y-12);}
  }else if(state.gizmoMode==='rotate'){
    ctx.beginPath();ctx.arc(c.x,c.y,g.rotateRadius,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(g.rotateHandle.x,g.rotateHandle.y);ctx.stroke();
    ctx.beginPath();ctx.arc(g.rotateHandle.x,g.rotateHandle.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffcc33';ctx.fillText('ROTATE',g.rotateHandle.x+10,g.rotateHandle.y-8);
  }else if(state.gizmoMode==='scale'){
    const b=g.bounds;
    const handles=[
      {x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h},
      {x:b.x+b.w/2,y:b.y},{x:b.x+b.w,y:b.y+b.h/2},{x:b.x+b.w/2,y:b.y+b.h},{x:b.x,y:b.y+b.h/2}
    ];
    ctx.fillStyle='#101010';ctx.strokeStyle='#ffcc33';
    for(const h of handles){ctx.fillRect(h.x-5,h.y-5,10,10);ctx.strokeRect(h.x-5,h.y-5,10,10);}
    ctx.beginPath();ctx.arc(c.x,c.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffcc33';ctx.fillText('ZOOM '+Number(g.cam.z||1).toFixed(2)+'×',c.x+12,c.y-12);
  }
  ctx.restore();return true;
}
function hitTestCameraGizmoScreen(clientX,clientY){
  const g=cameraGizmoInfo();if(!g)return null;
  const q={x:clientX,y:clientY},near=(p,r=12)=>Math.hypot(q.x-p.x,q.y-p.y)<=r;
  if(state.gizmoMode==='move'){
    const axis=typeof gizmoAxisHit==='function'?gizmoAxisHit(clientX,clientY,g.center,{centerRadius:16,axisRadius:10,len:70}):null;
    if(axis)return makeCameraGizmoDrag('move',axis,g,clientX,clientY);
    return null;
  }
  if(state.gizmoMode==='rotate'){
    const d=Math.hypot(q.x-g.center.x,q.y-g.center.y);
    if(Math.abs(d-g.rotateRadius)<=12||near(g.rotateHandle,14))return makeCameraGizmoDrag('rotate','z',g,clientX,clientY);
    return null;
  }
  if(state.gizmoMode==='scale'){
    const b=g.bounds;
    const handles=[
      {x:b.x,y:b.y},{x:b.x+b.w,y:b.y},{x:b.x+b.w,y:b.y+b.h},{x:b.x,y:b.y+b.h},
      {x:b.x+b.w/2,y:b.y},{x:b.x+b.w,y:b.y+b.h/2},{x:b.x+b.w/2,y:b.y+b.h},{x:b.x,y:b.y+b.h/2}
    ];
    for(const h of handles)if(near(h,14))return makeCameraGizmoDrag('scale','zoom',g,clientX,clientY);
    return null;
  }
  return null;
}
function makeCameraGizmoDrag(mode,axis,g,clientX,clientY){
  const p=s2w(clientX,clientY);const distScreen=Math.max(1,Math.hypot(clientX-g.center.x,clientY-g.center.y));
  return{type:'cameraGizmo',id:g.cam.id,mode,axis,last:p,start:p,startScreen:{x:clientX,y:clientY},centerWorld:{...g.centerWorld},centerScreen:{...g.center},startX:Number(g.cam.x||0),startY:Number(g.cam.y||0),startR:Number(g.cam.r||0),startZ:Math.max(.001,Number(g.cam.z||1)),startDistScreen:distScreen,startAngle:Math.atan2(p.y-g.centerWorld.y,p.x-g.centerWorld.x)};
}
function applyCameraGizmoDrag(d,e){
  if(state.documentType!=='toon'||typeof ensureToon!=='function')return;
  const t=ensureToon();const cam=(t.cameras||[]).find(c=>c.id===d.id)||activeToonCamera?.();if(!cam)return;
  const p=pointer(e);
  if(d.mode==='move'){
    let delta={x:p.x-d.last.x,y:p.y-d.last.y};if(d.axis==='x')delta.y=0;if(d.axis==='y')delta.x=0;
    cam.x=Number(cam.x||0)+delta.x;cam.y=Number(cam.y||0)+delta.y;d.last={x:d.last.x+delta.x,y:d.last.y+delta.y};
  }else if(d.mode==='rotate'){
    const a=Math.atan2(p.y-d.centerWorld.y,p.x-d.centerWorld.x);cam.r=normAngle(d.startR+deg(a-d.startAngle));
  }else if(d.mode==='scale'){
    const cp=canvasPoint(e);const distScreen=Math.max(1,Math.hypot(cp.x-d.centerScreen.x,cp.y-d.centerScreen.y));
    const factor=distScreen/Math.max(1,d.startDistScreen);cam.z=clamp(d.startZ/Math.max(.02,factor),.01,100);
  }
  if(typeof renderInspector==='function')renderInspector();
}

function drawUniversalTransformGizmo(){
  if(meshEditorActive()){drawVertexTransformGizmo();return true;}
  if(state.selected?.type==='camera'&&typeof drawCameraUniversalGizmo==='function')return drawCameraUniversalGizmo();
  if(state.selected?.type==='bone'&&typeof drawBoneUniversalGizmo==='function')return drawBoneUniversalGizmo();
  return false;
}

// Bone-aware adapter for the shared 2D gizmo. It uses the same visual language
// as vertex/slot gizmos, but preserves bone semantics: move start point, rotate
// around start, and keep length separate from transform scale.
function boneGizmoInfo(){
  if(state.selected?.type!=='bone')return null;
  const b=selectedBone();if(!b||isProjectRootBone(b)||!boneRoleVisibleInViewport(b)||!boneRoleSelectableInViewport(b))return null;
  updateWorld(false);
  const startWorld={x:b.w.sx,y:b.w.sy},endWorld={x:b.w.ex,y:b.w.ey};
  const startScreen=w2s(startWorld),endScreen=w2s(endWorld);
  const ax={x:b.w.ax||1,y:b.w.ay||0},by={x:b.w.bx||0,y:b.w.by||1};
  const axScale=Math.hypot(ax.x,ax.y)||1,byScale=Math.hypot(by.x,by.y)||1;
  const axisWorld={x:ax.x/axScale,y:ax.y/axScale};
  const perpWorld={x:by.x/byScale,y:by.y/byScale};
  const axisScreenRaw={x:endScreen.x-startScreen.x,y:endScreen.y-startScreen.y};
  const screenLen=Math.hypot(axisScreenRaw.x,axisScreenRaw.y)||1;
  const axisScreen={x:axisScreenRaw.x/screenLen,y:axisScreenRaw.y/screenLen};
  const perpScreen={x:-axisScreen.y,y:axisScreen.x};
  const lenHandle=endScreen;
  const sxHandle={x:endScreen.x+axisScreen.x*30,y:endScreen.y+axisScreen.y*30};
  const syHandle={x:startScreen.x+perpScreen.x*52,y:startScreen.y+perpScreen.y*52};
  const rotateRadius=Math.max(34,Math.min(120,screenLen+18));
  const rotateHandle={x:startScreen.x+axisScreen.x*rotateRadius,y:startScreen.y+axisScreen.y*rotateRadius};
  const shape=normalizeBoneShape(b.shape||'bone');
  const visualSize=(typeof boneVisualWidth==='function'?boneVisualWidth(b):Number(b.width||12));
  const controllerRadius=shape==='bone'?0:Math.max(10,visualSize*.48);
  return{b,startWorld,endWorld,startScreen,endScreen,axisWorld,perpWorld,axisScreen,perpScreen,axScale,byScale,screenLen,lenHandle,sxHandle,syHandle,rotateRadius,rotateHandle,shape,visualSize,controllerRadius,canMove:canMoveBone(b),canRotate:canRotateBone(b),canScale:canScaleBone(b,'scale'),canLength:canScaleBone(b,'len'),moveOnly:isMoveOnlyBone(b),objectRoot:isObjectRootBone(b)};
}
function drawBoneUniversalGizmo(){
  const g=boneGizmoInfo();if(!g)return false;
  const {b,startScreen:a,endScreen:e}=g;
  ctx.save();ctx.strokeStyle='#ffcc33';ctx.fillStyle='#101010';ctx.lineWidth=1.7;ctx.font='11px system-ui';
  // Highlight selected bone segment so the gizmo target is explicit.
  ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(e.x,e.y);ctx.stroke();ctx.setLineDash([]);
  if(state.gizmoMode==='move'){
    if(g.canMove){
      const isController=g.shape!=='bone';
      draw2DMoveGizmoAt(a,{
        label:g.objectRoot?'OBJECT ROOT':'',
        innerGap:isController?g.controllerRadius+10:0,
        centerRadius:isController?g.controllerRadius+8:7,
        centerStyle:isController?'ring':'solid',
        len:isController?Math.max(64,g.controllerRadius+58):58,
        labelOffset:isController?{x:g.controllerRadius+18,y:g.controllerRadius+20}:null
      });
    }
    else{ctx.strokeStyle='rgba(255,204,51,.55)';ctx.beginPath();ctx.arc(a.x,a.y,18,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(255,204,51,.85)';ctx.fillText('CONNECTED · move locked',a.x+14,a.y-12);}
  }else if(state.gizmoMode==='rotate'){
    if(g.canRotate){
      ctx.strokeStyle='#ffcc33';ctx.beginPath();ctx.arc(a.x,a.y,g.rotateRadius,0,Math.PI*2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(g.rotateHandle.x,g.rotateHandle.y);ctx.stroke();
      ctx.fillStyle='#101010';ctx.strokeStyle='#ffcc33';ctx.beginPath();ctx.arc(g.rotateHandle.x,g.rotateHandle.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffcc33';ctx.fillText('ROTATE',g.rotateHandle.x+10,g.rotateHandle.y-8);
    }else{ctx.fillStyle='#ffcc33';ctx.fillText('MOVE ONLY',a.x+12,a.y-12);}
  }else if(state.gizmoMode==='scale'){
    const square=(p,size=12)=>{ctx.fillStyle='#101010';ctx.strokeStyle='#ffcc33';ctx.fillRect(p.x-size/2,p.y-size/2,size,size);ctx.strokeRect(p.x-size/2,p.y-size/2,size,size);};
    const circle=(p,r=6)=>{ctx.fillStyle='#101010';ctx.strokeStyle='#ffcc33';ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();};
    const diamond=(p,r=7)=>{ctx.fillStyle='#101010';ctx.strokeStyle='#ffcc33';ctx.beginPath();ctx.moveTo(p.x,p.y-r);ctx.lineTo(p.x+r,p.y);ctx.lineTo(p.x,p.y+r);ctx.lineTo(p.x-r,p.y);ctx.closePath();ctx.fill();ctx.stroke();};
    // Length changes the bone lever/endpoint. SX/SY are true transform scale.
    square(g.lenHandle,13);diamond(g.sxHandle,7);circle(g.syHandle,6);
    ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(g.sxHandle.x,g.sxHandle.y);ctx.moveTo(a.x,a.y);ctx.lineTo(g.syHandle.x,g.syHandle.y);ctx.stroke();
    ctx.fillStyle='#ffcc33';ctx.fillText('LEN',g.lenHandle.x+10,g.lenHandle.y-8);ctx.fillText('SX',g.sxHandle.x+10,g.sxHandle.y-8);ctx.fillText('SY',g.syHandle.x+10,g.syHandle.y-8);
  }
  ctx.restore();return true;
}
function hitTestBoneUniversalGizmoScreen(clientX,clientY){
  const g=boneGizmoInfo();if(!g)return null;
  const q={x:clientX,y:clientY};
  const near=(p,r=12)=>Math.hypot(q.x-p.x,q.y-p.y)<=r;
  if(state.gizmoMode==='move'){
    if(!g.canMove)return null;
    const axis=gizmoAxisHit(clientX,clientY,g.startScreen,{centerRadius:16,axisRadius:10,len:70});
    if(axis)return makeBoneUniversalGizmoDrag('move',axis,g,clientX,clientY);
    return null;
  }
  if(state.gizmoMode==='rotate'){
    if(!g.canRotate)return null;
    const d=Math.hypot(q.x-g.startScreen.x,q.y-g.startScreen.y);
    if(Math.abs(d-g.rotateRadius)<=12||near(g.rotateHandle,14))return makeBoneUniversalGizmoDrag('rotate','z',g,clientX,clientY);
    return null;
  }
  if(state.gizmoMode==='scale'){
    if(g.canLength&&near(g.lenHandle,14))return makeBoneUniversalGizmoDrag('scale','length',g,clientX,clientY);
    if(g.canScale&&near(g.sxHandle,14))return makeBoneUniversalGizmoDrag('scale','sx',g,clientX,clientY);
    if(g.canScale&&near(g.syHandle,14))return makeBoneUniversalGizmoDrag('scale','sy',g,clientX,clientY);
  }
  return null;
}
function makeBoneUniversalGizmoDrag(mode,axis,g,clientX,clientY){
  const p=s2w(clientX,clientY);const b=g.b;
  const dot=(v,a)=>v.x*a.x+v.y*a.y;
  const rel={x:p.x-g.startWorld.x,y:p.y-g.startWorld.y};
  const ids=(mode==='move'&&typeof selectedBoneIds==='function'&&isBoneSelected(b.id))?selectedBoneIds({exact:true}):[b.id];
  return{type:'boneGizmo',id:b.id,ids,mode,axis,last:p,start:p,startWorld:{...g.startWorld},endWorld:{...g.endWorld},axisWorld:{...g.axisWorld},perpWorld:{...g.perpWorld},axScale:g.axScale,byScale:g.byScale,startLocal:{...b.local},startAxisScalar:dot(rel,g.axisWorld),startPerpScalar:dot(rel,g.perpWorld),startAngle:Math.atan2(p.y-g.startWorld.y,p.x-g.startWorld.x)};
}
function applyBoneUniversalGizmoDrag(d,e){
  const b=bone(d.id);if(!b||isProjectRootBone(b))return;
  const p=pointer(e);const dot=(v,a)=>v.x*a.x+v.y*a.y;
  if(d.mode==='move'){
    if(!canMoveBone(b))return;let delta={x:p.x-d.last.x,y:p.y-d.last.y};if(d.axis==='x')delta.y=0;if(d.axis==='y')delta.x=0;const targets=typeof selectedBoneMoveRoots==='function'?selectedBoneMoveRoots(d.id):[b];for(const tb of targets)moveBoneByWorldDelta(tb,delta);d.last={x:d.last.x+delta.x,y:d.last.y+delta.y};
  }else if(d.mode==='rotate'){
    if(!canRotateBone(b))return;updateWorld(false);if(state.ik.enabled&&state.mode==='pose')solveCCD(b.id,p,state.ik.chain);else rotateBoneTowardPointer(b,p,false);
  }else if(d.mode==='scale'){
    const rel={x:p.x-d.startWorld.x,y:p.y-d.startWorld.y};
    if(d.axis==='length'){if(!canScaleBone(b,'len'))return;
      const scalar=dot(rel,d.axisWorld);const len=Math.max(4,scalar/Math.max(1e-6,d.axScale));applyEdit(b,'len',len);
    }else if(d.axis==='sx'){if(!canScaleBone(b,'scale'))return;
      const scalar=dot(rel,d.axisWorld);const denom=Math.abs(d.startAxisScalar)>1e-6?d.startAxisScalar:((d.startLocal.len||80)*d.axScale+1e-6);let factor=scalar/denom;if(!Number.isFinite(factor))factor=1;factor=clamp(Math.abs(factor),.05,20);applyEdit(b,'sx',(d.startLocal.sx??1)*factor);
    }else if(d.axis==='sy'){if(!canScaleBone(b,'scale'))return;
      const scalar=dot(rel,d.perpWorld);const denom=Math.abs(d.startPerpScalar)>1e-6?d.startPerpScalar:1;let factor=scalar/denom;if(!Number.isFinite(factor))factor=1;factor=clamp(Math.abs(factor),.05,20);applyEdit(b,'sy',(d.startLocal.sy??1)*factor);
    }
  }
  renderInspector();if(typeof renderBoneList==='function')renderBoneList();
}
