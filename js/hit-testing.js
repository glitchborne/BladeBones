'use strict';
// Hit testing and inverse-kinematics helpers.
function hitTestBone(p){
  updateWorld(false);const r=10/state.camera.z;let best=null;
  for(let i=state.bones.length-1;i>=0;i--){
    const b=state.bones[i];if(!boneRoleSelectableInViewport(b))continue;const s={x:b.w.sx,y:b.w.sy},e={x:b.w.ex,y:b.w.ey};
    const shape=normalizeBoneShape(b.shape||'bone');
    const visualTol=Math.max(r,(Number(b.width||12)*.5)/Math.max(.25,state.camera.z));
    const ds=dist(p,s);
    if(isProjectRootBone(b)){if(ds<r*1.2)return{b,part:'root',d:ds};continue;}
    if(ds<(shape==='bone'?r:visualTol))return{b,part:'start',d:ds};
    const de=dist(p,e);if(shape==='bone'&&de<Math.max(r,visualTol*.55))return{b,part:'end',d:de};
    const d=segDist(p,s,e);if(shape==='bone'&&d<Math.max(r*.75,visualTol*.18)&&(!best||d<best.d))best={b,part:'body',d};
  }
  return best;
}
function hitTestBoneGizmoScreen(clientX,clientY){
  if(typeof hitTestBoneUniversalGizmoScreen==='function'){const u=hitTestBoneUniversalGizmoScreen(clientX,clientY);if(u)return u;}
  const b=selectedBone();if(!b||isProjectRootBone(b))return null;updateWorld(false);
  const a=w2s({x:b.w.sx,y:b.w.sy}),e=w2s({x:b.w.ex,y:b.w.ey});
  const near=(p,r=10)=>Math.hypot(clientX-p.x,clientY-p.y)<=r;
  if(state.gizmoMode==='scale'){
    const side=w2s({x:b.w.sx+(b.w.bx||0)*Math.max(18,Number(b.width||12)*2),y:b.w.sy+(b.w.by||1)*Math.max(18,Number(b.width||12)*2)});
    if(!canScaleBone(b,'scale'))return null;
    if(near(side,14))return{type:'boneScaleY',id:b.id,start:s2w(clientX,clientY),startWorldLen:Math.max(1,dist({x:b.w.sx,y:b.w.sy},s2w(clientX,clientY))),local:{...b.local}};
    if(near(e,16))return{type:'boneScaleX',id:b.id,start:s2w(clientX,clientY),startWorldLen:Math.max(1,dist({x:b.w.sx,y:b.w.sy},s2w(clientX,clientY))),local:{...b.local}};
    return null;
  }
  if(state.gizmoMode==='move'){
    if(canMoveBone(b)){
      const axis=typeof gizmoAxisHit==='function'?gizmoAxisHit(clientX,clientY,a,{centerRadius:16,axisRadius:10,len:70}):null;
      if(axis)return{type:'boneMoveAxis',id:b.id,last:s2w(clientX,clientY),axis};
      if(near(a,22)||near(a,60))return{type:'boneMove',id:b.id,last:s2w(clientX,clientY)};
    }
    return null;
  }
  if(state.gizmoMode==='rotate'){
    if(!canRotateBone(b))return null;
    if(near(e,16)||near(e,60))return{type:'boneRotate',id:b.id,stretch:false};
    return null;
  }
  return null;
}

function hitTestToonCameraScreen(clientX,clientY){
  if(typeof isToonCameraView==='function'&&isToonCameraView())return null;
  if(state.documentType!=='toon'||typeof toonCameraFrameInfo!=='function')return null;
  const info=toonCameraFrameInfo();if(!info)return null;
  const q={x:clientX,y:clientY};
  const near=(p,r=12)=>Math.hypot(q.x-p.x,q.y-p.y)<=r;
  if(near(info.center,15))return{camera:info.cam,part:'center'};
  for(let i=0;i<info.corners.length;i++){
    const a=info.corners[i],b=info.corners[(i+1)%info.corners.length];
    if(near(a,12)||gizmoPointSegDist?.(q,a,b)<=9)return{camera:info.cam,part:'frame'};
  }
  const label=info.label,labelW=Math.max(146,Math.min(220,String(info.cam.name||'Camera').length*7+78));
  if(q.x>=label.x&&q.x<=label.x+labelW&&q.y>=label.y-18&&q.y<=label.y)return{camera:info.cam,part:'label'};
  return null;
}

function pointInPoly(p,pts){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const pi=pts[i],pj=pts[j];if(((pi.y>p.y)!==(pj.y>p.y))&&(p.x<(pj.x-pi.x)*(p.y-pi.y)/((pj.y-pi.y)||1e-9)+pi.x))inside=!inside;}return inside;}
function pointInTri(p,a,b,c){const v0={x:c.x-a.x,y:c.y-a.y},v1={x:b.x-a.x,y:b.y-a.y},v2={x:p.x-a.x,y:p.y-a.y};const dot00=v0.x*v0.x+v0.y*v0.y,dot01=v0.x*v1.x+v0.y*v1.y,dot02=v0.x*v2.x+v0.y*v2.y,dot11=v1.x*v1.x+v1.y*v1.y,dot12=v1.x*v2.x+v1.y*v2.y;const inv=1/((dot00*dot11-dot01*dot01)||1e-9);const u=(dot11*dot02-dot01*dot12)*inv,v=(dot00*dot12-dot01*dot02)*inv;return u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6;}
function pointInSlotMesh(p,s,mesh){const pts=slotMeshWorldVertices(s);for(const tri of mesh.triangles||[]){if(tri.length>=3&&pts[tri[0]]&&pts[tri[1]]&&pts[tri[2]]&&pointInTri(p,pts[tri[0]],pts[tri[1]],pts[tri[2]]))return true;}return false;}
function hitTestSlot(p){updateWorld(false);for(let i=state.slots.length-1;i>=0;i--){const s=state.slots[i];if(!s.pose.visible)continue;const att=attachment(s.pose.attachment);const sw=slotWorld(s);if(!att||!sw)continue;const mesh=ensureSlotMesh(s);if(mesh&&mesh.enabled&&mesh.vertices?.length){if(pointInSlotMesh(p,s,mesh))return s;continue;}const q={x:p.x-sw.x,y:p.y-sw.y};const det=(sw.ax||1)*(sw.by||1)-(sw.ay||0)*(sw.bx||0);let lx=q.x,ly=q.y;if(Math.abs(det)>1e-8){lx=(q.x*(sw.by||1)-q.y*(sw.bx||0))/det;ly=((sw.ax||1)*q.y-(sw.ay||0)*q.x)/det;}const x0=-(att.pivotX??.5)*att.w,y0=-(att.pivotY??.5)*att.h;if(lx>=x0&&lx<=x0+att.w&&ly>=y0&&ly<=y0+att.h)return s;}return null;}
function hitTestMarker(p){updateWorld(false);for(let i=state.markers.length-1;i>=0;i--){const m=state.markers[i];const mw=markerWorld(m);if(!mw)continue;const q={x:p.x-mw.x,y:p.y-mw.y};const inv=rotatePoint(q.x,q.y,-mw.r);if(m.type==='hitbox'){if(inv.x>=-m.w/2&&inv.x<=m.w/2&&inv.y>=-m.h/2&&inv.y<=m.h/2)return m;}else if(Math.hypot(inv.x,inv.y)<12/state.camera.z)return m;}return null;}
function segDist(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,l2=vx*vx+vy*vy||1,t=clamp((wx*vx+wy*vy)/l2,0,1);return Math.hypot(p.x-(a.x+vx*t),p.y-(a.y+vy*t));}
function solveCCD(endId,target,chainLen=3,iterations=14,eps=1.5){const chain=[];let b=bone(endId);while(b&&chain.length<chainLen){if(!isProjectRootBone(b))chain.push(b);b=bone(b.parent);}for(let it=0;it<iterations;it++){updateWorld(false);const eb=bone(endId);if(!eb)return;if(Math.hypot(eb.w.ex-target.x,eb.w.ey-target.y)<eps/state.camera.z)break;for(const jb of chain){updateWorld(false);const end=bone(endId);const joint={x:jb.w.sx,y:jb.w.sy};const e={x:end.w.ex,y:end.w.ey};const a1=Math.atan2(e.y-joint.y,e.x-joint.x);const a2=Math.atan2(target.y-joint.y,target.x-joint.x);applyEdit(jb,'r',jb.local.r+normAngle(deg(a2-a1)));}}}

function hitTestMeshVertexScreen(clientX,clientY){
  const s=selectedSlot();if(!s)return null;const m=ensureSlotMesh(s);if(!m||!m.vertices.length)return null;
  const pts=slotMeshWorldVertices(s).map(w2s);let best=null;
  for(let i=pts.length-1;i>=0;i--){const p=pts[i];const d=Math.hypot(clientX-p.x,clientY-p.y);if(d<=12&&(!best||d<best.d))best={slot:s,index:i,d};}
  return best;
}
function screenSegProjection(p,a,b){const vx=b.x-a.x,vy=b.y-a.y,wx=p.x-a.x,wy=p.y-a.y,l2=vx*vx+vy*vy||1;const t=clamp((wx*vx+wy*vy)/l2,0,1);return{x:a.x+vx*t,y:a.y+vy*t,t,d:Math.hypot(p.x-(a.x+vx*t),p.y-(a.y+vy*t))};}
function hitTestMeshEdgeScreen(clientX,clientY){
  const s=selectedSlot();if(!s)return null;const m=ensureSlotMesh(s);if(!m||!m.vertices.length)return null;ensureMeshTopology(m);
  const pts=slotMeshWorldVertices(s).map(w2s),q={x:clientX,y:clientY};let best=null;
  for(let i=0;i<(m.edges||[]).length;i++){const e=m.edges[i],a=pts[e[0]],b=pts[e[1]];if(!a||!b)continue;const h=screenSegProjection(q,a,b);if(h.d<=9&&(!best||h.d<best.d))best={slot:s,index:i,a:e[0],b:e[1],key:meshEdgeKey(e[0],e[1]),t:h.t,d:h.d};}
  return best;
}
function hitTestMeshFaceScreen(clientX,clientY){
  const s=selectedSlot();if(!s)return null;const m=ensureSlotMesh(s);if(!m||!m.vertices.length)return null;
  const pts=slotMeshWorldVertices(s).map(w2s),q={x:clientX,y:clientY};
  for(let i=(m.triangles||[]).length-1;i>=0;i--){const tri=m.triangles[i];if(!tri||tri.length<3)continue;const a=pts[tri[0]],b=pts[tri[1]],c=pts[tri[2]];if(a&&b&&c&&pointInTri(q,a,b,c))return{slot:s,index:i,tri};}
  return null;
}
function hitTestSlotGizmoScreen(clientX,clientY){
  const s=selectedSlot();if(!s)return null;const info=slotWorldCorners(s);if(!info)return null;const {sw,pts}=info;const c=w2s({x:sw.x,y:sw.y});const screens=pts.map(w2s);
  const near=(p,r=9)=>Math.hypot(clientX-p.x,clientY-p.y)<=r;
  const wpt=s2w(clientX,clientY);const startLocal=inversePointFromBasis(sw,wpt);
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const mids=[mid(screens[0],screens[1]),mid(screens[1],screens[2]),mid(screens[2],screens[3]),mid(screens[3],screens[0])];
  if(state.gizmoMode==='scale'){
    // Edge handles: top/bottom scale Y, left/right scale X.
    if(near(mids[1],11)||near(mids[3],11))return{type:'slotScaleAxis',axis:'x',id:s.id,start:{x:clientX,y:clientY},startLocal,sw:{...sw},local:{...s.local}};
    if(near(mids[0],11)||near(mids[2],11))return{type:'slotScaleAxis',axis:'y',id:s.id,start:{x:clientX,y:clientY},startLocal,sw:{...sw},local:{...s.local}};
    for(let i=0;i<screens.length;i++){if(near(screens[i],10))return{type:'slotScale',id:s.id,corner:i,start:{x:clientX,y:clientY},sw:{...sw},local:{...s.local}};}
    return null;
  }
  if(state.gizmoMode==='rotate'){
    const up=rotatePoint(0,-70/Math.max(.001,state.camera.z),sw.r);const rh=w2s({x:sw.x+up.x,y:sw.y+up.y});
    if(near(rh,12)||near(c,80))return{type:'slotRotate',id:s.id,start:{x:clientX,y:clientY},sw:{...sw},local:{...s.local},startAngle:Math.atan2(wpt.y-sw.y,wpt.x-sw.x)};
    return null;
  }
  if(state.gizmoMode==='move'){
    const axis=typeof gizmoAxisHit==='function'?gizmoAxisHit(clientX,clientY,c,{centerRadius:16,axisRadius:10,len:70}):null;
    if(axis)return{type:'slotMoveAxis',id:s.id,last:wpt,axis};
    if(near(c,16)||near(c,60))return{type:'slotMove',id:s.id,last:wpt};
    return null;
  }
  return null;
}
function applySlotWorldTransform(s,sw){
  if(!s)return; if(s.bone)s.local=slotLocalFromWorld(sw,s.bone);else{const o=rigObject(s.objectId),rb=bone(o?.root);if(rb){const loc=inversePointFromBasis(rb.w,{x:sw.x,y:sw.y});s.local={x:loc.x,y:loc.y,r:normAngle((sw.r||0)-(rb.w.r||0)),sx:(sw.sx||1)/(rb.w.scaleX||1),sy:(sw.sy||1)/(rb.w.scaleY||1)};}else s.local={x:sw.x,y:sw.y,r:normAngle(sw.r||0),sx:sw.sx||1,sy:sw.sy||1};}
  if(state.mode!=='pose'&&!rigTestPoseActive?.()&&typeof markSlotSetupFromLocal==='function')markSlotSetupFromLocal(s);
}
