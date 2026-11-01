'use strict';
// Viewport camera, canvas rendering and drawing helpers.
function canvasDpr(){const r=canvas.getBoundingClientRect();return r.width?canvas.width/r.width:(window.devicePixelRatio||1);}
function sizeCanvas(){const dpr=window.devicePixelRatio||1;const r=canvas.getBoundingClientRect();const w=Math.max(1,Math.floor(r.width*dpr)),h=Math.max(1,Math.floor(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}ctx.setTransform(dpr,0,0,dpr,0,0);}
function viewRect(){const r=canvas.getBoundingClientRect();return{w:r.width,h:r.height};}
function isToonCameraView(){return !!(state.documentType==='toon'&&state.view?.cameraView&&typeof ensureToon==='function'&&typeof activeToonCamera==='function');}
function cameraPreviewRect(){
  if(!isToonCameraView())return null;
  const t=ensureToon(),cam=activeToonCamera();if(!t||!cam)return null;
  const v=viewRect(),cw=Math.max(1,Number(t.canvas?.width||1920)),ch=Math.max(1,Number(t.canvas?.height||1080));
  const pad=24,scale=Math.max(.001,Math.min((v.w-pad*2)/cw,(v.h-pad*2)/ch));
  const w=cw*scale,h=ch*scale,x=(v.w-w)/2,y=(v.h-h)/2;
  return{x,y,w,h,scale,cw,ch,cam,toon:t};
}
function cameraWorldToScreen(p){
  const r=cameraPreviewRect();if(!r)return null;
  const cam=r.cam,z=Math.max(.001,Number(cam.z||1)),cr=rad(-(Number(cam.r||0))),cs=Math.cos(cr),sn=Math.sin(cr);
  const dx=Number(p.x||0)-Number(cam.x||0),dy=Number(p.y||0)-Number(cam.y||0);
  const lx=dx*cs-dy*sn,ly=dx*sn+dy*cs;
  return{x:r.x+r.cw*.5*r.scale+lx*z*r.scale,y:r.y+r.ch*.5*r.scale-ly*z*r.scale};
}
function cameraScreenToWorld(x,y){
  const r=cameraPreviewRect();if(!r)return null;
  const cam=r.cam,z=Math.max(.001,Number(cam.z||1));
  const lx=((x-r.x)/r.scale-r.cw*.5)/z,ly=-( (y-r.y)/r.scale-r.ch*.5)/z;
  const q=rotatePoint(lx,ly,Number(cam.r||0));return{x:Number(cam.x||0)+q.x,y:Number(cam.y||0)+q.y};
}
function worldScreenScale(){const r=cameraPreviewRect();return r?Math.max(.001,Number(r.cam?.z||1))*r.scale:Math.max(.001,state.camera.z);}
function w2s(p){const cv=cameraWorldToScreen(p);if(cv)return cv;const v=viewRect();return{x:v.w/2+state.camera.x+p.x*state.camera.z,y:v.h/2+state.camera.y-p.y*state.camera.z};}
function s2w(x,y){const cv=cameraScreenToWorld(x,y);if(cv)return cv;const v=viewRect();return{x:(x-v.w/2-state.camera.x)/state.camera.z,y:-(y-v.h/2-state.camera.y)/state.camera.z};}
function niceStep(raw){const p=Math.pow(10,Math.floor(Math.log10(Math.max(.0001,raw))));const n=raw/p;if(n<2)return 2*p;if(n<5)return 5*p;return 10*p;}
function drawGrid(){const v=viewRect();const step=niceStep(60/state.camera.z);const a=s2w(0,0),c=s2w(v.w,v.h);const minX=Math.floor(a.x/step)*step,maxX=Math.ceil(c.x/step)*step,minY=Math.floor(c.y/step)*step,maxY=Math.ceil(a.y/step)*step;ctx.lineWidth=1;for(let x=minX;x<=maxX;x+=step){const s=w2s({x,y:0});ctx.strokeStyle=Math.abs(x)<1e-6?'#3b5975':'#1e1e1e';ctx.beginPath();ctx.moveTo(s.x,0);ctx.lineTo(s.x,v.h);ctx.stroke();}for(let y=minY;y<=maxY;y+=step){const s=w2s({x:0,y});ctx.strokeStyle=Math.abs(y)<1e-6?'#3b5975':'#1e1e1e';ctx.beginPath();ctx.moveTo(0,s.y);ctx.lineTo(v.w,s.y);ctx.stroke();}}
function getImage(att){
  if(!att||att.type!=='image')return null;
  let img=imageCache.get(att.id);
  if(!img){
    img=new Image();
    img.onload=()=>{
      const resized=typeof updateImageAttachmentNaturalSize==='function'&&updateImageAttachmentNaturalSize(att,img,{restoreLegacy:true});
      if(resized){if(typeof changed==='function')changed();if(typeof renderAll==='function')renderAll();}
    };
    img.src=att.src;imageCache.set(att.id,img);
  }else if(img.complete&&img.naturalWidth&&typeof updateImageAttachmentNaturalSize==='function')updateImageAttachmentNaturalSize(att,img,{restoreLegacy:true});
  return img;
}

function applyWorldAffineToCanvas(sw){
  const dpr=canvasDpr();
  const origin={x:sw.x||0,y:sw.y||0};
  const p0=w2s(origin);
  const px=w2s({x:origin.x+(sw.ax??1),y:origin.y+(sw.ay??0)});
  const py=w2s({x:origin.x+(sw.bx??0),y:origin.y+(sw.by??1)});
  ctx.setTransform(dpr*(px.x-p0.x),dpr*(px.y-p0.y),dpr*(py.x-p0.x),dpr*(py.y-p0.y),dpr*p0.x,dpr*p0.y);
}
function screenPointFromWorld(p){return w2s(p);}
function drawTrianglePath(points){ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);ctx.lineTo(points[1].x,points[1].y);ctx.lineTo(points[2].x,points[2].y);ctx.closePath();}
function triangleTransform(src,dst){
  const [s0,s1,s2]=src,[d0,d1,d2]=dst;
  const den=s0.x*(s1.y-s2.y)+s1.x*(s2.y-s0.y)+s2.x*(s0.y-s1.y);
  if(Math.abs(den)<1e-8)return null;
  const a=(d0.x*(s1.y-s2.y)+d1.x*(s2.y-s0.y)+d2.x*(s0.y-s1.y))/den;
  const c=(d0.x*(s2.x-s1.x)+d1.x*(s0.x-s2.x)+d2.x*(s1.x-s0.x))/den;
  const e=(d0.x*(s1.x*s2.y-s2.x*s1.y)+d1.x*(s2.x*s0.y-s0.x*s2.y)+d2.x*(s0.x*s1.y-s1.x*s0.y))/den;
  const b=(d0.y*(s1.y-s2.y)+d1.y*(s2.y-s0.y)+d2.y*(s0.y-s1.y))/den;
  const d=(d0.y*(s2.x-s1.x)+d1.y*(s0.x-s2.x)+d2.y*(s1.x-s0.x))/den;
  const f=(d0.y*(s1.x*s2.y-s2.x*s1.y)+d1.y*(s2.x*s0.y-s0.x*s2.y)+d2.y*(s0.x*s1.y-s1.x*s0.y))/den;
  return{a,b,c,d,e,f};
}
function meshVertexUV(v,att){
  if(Number.isFinite(Number(v.u))&&Number.isFinite(Number(v.v)))return{u:Number(v.u),v:Number(v.v)};
  const x0=-(att.pivotX??.5)*att.w,y0=-(att.pivotY??.5)*att.h;
  return{u:att.w?((Number(v.x||0)-x0)/att.w):0,v:att.h?((Number(v.y||0)-y0)/att.h):0};
}
function meshVertexSourcePoint(v,att){return imageUVToSourcePoint(meshVertexUV(v,att),att);}
function drawImageMeshTriangle(img,att,srcPts,dstPts,tint,tintAlpha){
  const m=triangleTransform(srcPts,dstPts);if(!m)return;
  const dpr=canvasDpr();
  ctx.save();drawTrianglePath(dstPts);ctx.clip();ctx.setTransform(dpr*m.a,dpr*m.b,dpr*m.c,dpr*m.d,dpr*m.e,dpr*m.f);ctx.drawImage(img,0,0,att.w,att.h);ctx.restore();
  if(tintAlpha>0){ctx.save();ctx.globalAlpha*=tintAlpha;ctx.globalCompositeOperation='source-atop';ctx.fillStyle=tint;drawTrianglePath(dstPts);ctx.fill();ctx.restore();}
}
function drawSlotMesh(s,att,alpha,tint,tintAlpha,blend){
  const mesh=ensureSlotMesh(s);if(!mesh||!mesh.enabled||!mesh.vertices.length)return false;
  const verts=slotMeshWorldVertices(s).map(screenPointFromWorld),tris=mesh.triangles||[[0,1,2],[0,2,3]];
  ctx.save();ctx.globalAlpha=alpha;ctx.globalCompositeOperation=blend;
  if(att.type==='image'){
    const img=getImage(att);
    if(img&&img.complete&&img.naturalWidth){
      for(const tri of tris){const src=tri.map(i=>meshVertexSourcePoint(mesh.vertices[i],att)),dst=tri.map(i=>verts[i]);drawImageMeshTriangle(img,att,src,dst,tint,tintAlpha);}
    }else{
      ctx.fillStyle=mixColor('#333333',tint,tintAlpha);ctx.beginPath();verts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();
    }
  }else{
    ctx.fillStyle=mixColor(att.color||'#888888',tint,tintAlpha);ctx.globalAlpha=alpha*.65;ctx.beginPath();verts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fill();ctx.globalAlpha=alpha;
  }
  ctx.globalCompositeOperation='source-over';
  ctx.restore();return true;
}
function drawSlot(s){
  if(!state.view.attachments||!s.pose.visible)return;const att=attachment(s.pose.attachment);if(!att)return;const sw=slotWorld(s);if(!sw)return;
  const alpha=clamp(s.pose.alpha,0,1),tint=normalizeHex(s.pose.tint||s.tint||'#ffffff'),tintAlpha=clamp(Number(s.pose.tintAlpha??s.tintAlpha??0),0,1),blend=s.pose.blendMode||s.blendMode||'normal';
  const mesh=ensureSlotMesh(s);if(mesh&&mesh.enabled&&drawSlotMesh(s,att,alpha,tint,tintAlpha,blend))return;
  ctx.save();ctx.globalAlpha=alpha;ctx.globalCompositeOperation=blend;applyWorldAffineToCanvas(sw);const x=-(att.pivotX??.5)*att.w,y=-(att.pivotY??.5)*att.h;
  if(att.type==='image'){
    const img=getImage(att);if(img&&img.complete&&img.naturalWidth){
      const im=imageTextureToLocalTransform(att);ctx.save();ctx.transform(im.a,im.b,im.c,im.d,im.e,im.f);ctx.drawImage(img,0,0,att.w,att.h);if(tintAlpha>0){ctx.save();ctx.globalAlpha=tintAlpha;ctx.globalCompositeOperation='source-atop';ctx.fillStyle=tint;ctx.fillRect(0,0,att.w,att.h);ctx.restore();}ctx.restore();
    }
    else{ctx.fillStyle=mixColor('#333333',tint,tintAlpha);ctx.fillRect(x,y,att.w,att.h);ctx.strokeStyle='#aaa';ctx.strokeRect(x,y,att.w,att.h);}
  }else{
    ctx.fillStyle=mixColor(att.color||'#888888',tint,tintAlpha);ctx.globalAlpha=alpha*.65;ctx.fillRect(x,y,att.w,att.h);ctx.globalAlpha=alpha;ctx.strokeStyle='#ddd';ctx.strokeRect(x,y,att.w,att.h);
  }
  ctx.globalCompositeOperation='source-over';
  if(state.selected.type==='slot'&&state.selected.id===s.id){ctx.strokeStyle='#ffcc33';ctx.lineWidth=2/state.camera.z;ctx.strokeRect(x,y,att.w,att.h);}
  ctx.restore();
}

function meshTriangleEdges(tri){return [[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]];}
function meshBoundaryIndices(mesh){
  if(!mesh||!Array.isArray(mesh.vertices)||!mesh.vertices.length)return[];
  const counts=new Map();
  for(const tri of mesh.triangles||[]){
    if(!tri||tri.length<3)continue;
    for(const [a,b] of meshTriangleEdges(tri)){
      if(a===undefined||b===undefined||a===b)continue;
      const key=a<b?a+'|'+b:b+'|'+a;
      const rec=counts.get(key)||{a,b,count:0};rec.count++;counts.set(key,rec);
    }
  }
  const adj=new Map();
  for(const rec of counts.values()){
    if(rec.count!==1)continue;
    if(!adj.has(rec.a))adj.set(rec.a,[]);if(!adj.has(rec.b))adj.set(rec.b,[]);
    adj.get(rec.a).push(rec.b);adj.get(rec.b).push(rec.a);
  }
  if(!adj.size)return mesh.vertices.map((_,i)=>i);
  const verts=[...adj.keys()];
  let start=verts[0];
  for(const i of verts){
    const vi=mesh.vertices[i],vs=mesh.vertices[start];
    if(!vs||Number(vi.y)<Number(vs.y)||Math.abs(Number(vi.y)-Number(vs.y))<1e-6&&Number(vi.x)<Number(vs.x))start=i;
  }
  const out=[start];let prev=null,cur=start;
  for(let guard=0;guard<verts.length+4;guard++){
    const ns=(adj.get(cur)||[]).filter(n=>n!==prev);
    let next=ns[0];
    if(next===undefined)next=(adj.get(cur)||[])[0];
    if(next===undefined||next===start)break;
    if(out.includes(next))break;
    out.push(next);prev=cur;cur=next;
  }
  return out.length>=3?out:mesh.vertices.map((_,i)=>i);
}
function slotMeshBoundaryWorldVertices(s){
  const m=ensureSlotMesh(s);if(!m||!m.vertices?.length)return[];
  const pts=slotMeshWorldVertices(s);return meshBoundaryIndices(m).map(i=>pts[i]).filter(Boolean);
}
function weightColorForBoneId(boneId,fallback='#ff7043'){
  const b=bone(boneId);return normalizeHex?.(b?.color||fallback)||fallback;
}
function drawVertexActiveWeightGauge(p,v,idx,{weightBone,selected=false,hover=false,brushHit=false}={}){
  const activeId=weightBone?.id||null;
  const w=activeId?clamp(meshWeightForBone(v,activeId),0,1):0;
  const r=selected?11:(hover?10:8.5);
  const color=activeId?weightColorForBoneId(activeId,'#ff7043'):'#ff7043';
  ctx.save();
  ctx.globalAlpha=1;
  ctx.fillStyle='rgba(12,16,22,.92)';
  ctx.strokeStyle=brushHit?'#ffffff':(selected?'#ffcc33':'rgba(220,240,255,.9)');
  ctx.lineWidth=brushHit?2.5:(selected?2:1.35);
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  // Filled pie, not alpha: the visible area shows the active bone weight.
  if(w>0.0001){
    ctx.beginPath();ctx.moveTo(p.x,p.y);
    if(w>=.999){ctx.arc(p.x,p.y,r-2,0,Math.PI*2);}
    else ctx.arc(p.x,p.y,r-2,-Math.PI/2,-Math.PI/2+Math.PI*2*w,false);
    ctx.closePath();ctx.fillStyle=color;ctx.fill();
  }
  // Tick marks make 25/50/75/100% easier to read on dense meshes.
  ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=1;
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){ctx.beginPath();ctx.moveTo(p.x+Math.cos(a)*(r-3),p.y+Math.sin(a)*(r-3));ctx.lineTo(p.x+Math.cos(a)*(r+1),p.y+Math.sin(a)*(r+1));ctx.stroke();}
  ctx.fillStyle='rgba(255,255,255,.95)';ctx.font='9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  if(selected||hover||brushHit)ctx.fillText(String(Math.round(w*100)),p.x,p.y);
  ctx.restore();
}
function drawVertexInfluencePies(p,v,{selected=false,hover=false}={}){
  const weights=(v?.weights||[]).filter(w=>w&&w.bone&&Number(w.w)>0).sort((a,b)=>Number(b.w||0)-Number(a.w||0));
  const r=selected?10.5:(hover?9.5:8);
  ctx.save();ctx.fillStyle='rgba(12,16,22,.92)';ctx.strokeStyle=selected?'#ffcc33':'rgba(220,240,255,.8)';ctx.lineWidth=selected?2:1.25;
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
  let start=-Math.PI/2;
  if(!weights.length){ctx.restore();return;}
  for(const ww of weights){
    const frac=clamp(Number(ww.w||0),0,1);if(frac<=0)continue;const end=start+Math.PI*2*frac;
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,r-2,start,end,false);ctx.closePath();ctx.fillStyle=weightColorForBoneId(ww.bone,'#ff7043');ctx.fill();start=end;
  }
  ctx.restore();
}
function drawMeshWireForSlot(s,{editor=false,weights=false,force=false}={}){
  const m=ensureSlotMesh(s);if(!m||(!force&& !m.enabled)||!m.vertices?.length)return;
  const pts=slotMeshWorldVertices(s).map(w2s);const selected=new Set(editor?meshSelectedIndices(s):[]);const weightBone=bone(state.meshEdit?.weightBoneId)||bone(state.lastBoneId)||bone(s.bone);
  const selectedEdges=new Set(editor&&typeof meshSelectedEdges==='function'?meshSelectedEdges(s).map(e=>meshEdgeKey(e[0],e[1])):[]);
  const selectedFaces=new Set(editor&&typeof meshSelectedFaces==='function'?meshSelectedFaces(s):[]);
  const hoverEdge=editor&&state.meshEdit?.hoveredEdge?state.meshEdit.hoveredEdge.key:null;
  const hoverFace=editor&&state.meshEdit?.hoveredFace?state.meshEdit.hoveredFace.index:null;
  ctx.save();ctx.lineWidth=editor?1.25:1;ctx.strokeStyle=editor?'rgba(80,180,255,.95)':'rgba(80,180,255,.42)';ctx.fillStyle='rgba(30,30,30,.85)';
  for(let ti=0;ti<(m.triangles||[]).length;ti++){const tri=m.triangles[ti];if(!tri)continue;ctx.beginPath();tri.forEach((i,k)=>{const p=pts[i];if(!p)return;if(k)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();if(editor&&(selectedFaces.has(ti)||hoverFace===ti)){ctx.fillStyle=selectedFaces.has(ti)?'rgba(255,204,51,.20)':'rgba(143,211,255,.12)';ctx.fill();}ctx.strokeStyle='rgba(80,180,255,.95)';ctx.lineWidth=editor?1.25:1;ctx.stroke();}
  const drawEdge=(aIdx,bIdx,color,width,dash=false)=>{const a=pts[aIdx],b=pts[bIdx];if(!a||!b)return;ctx.save();if(dash)ctx.setLineDash([4,3]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();};
  if(editor){for(const key of selectedEdges){const e=meshParseEdgeKey(key);if(e)drawEdge(e[0],e[1],'#ffcc33',3,false);}if(hoverEdge&&!selectedEdges.has(hoverEdge)){const e=meshParseEdgeKey(hoverEdge);if(e)drawEdge(e[0],e[1],'rgba(143,211,255,.95)',2,true);}}
  if(editor&&weights&&state.meshEdit.showWeights){
    const brushHits=new Set(state.meshEdit?.weightBrushHits||[]);
    const canShowActive=weightBone&&!isProjectRootBone(weightBone);
    for(let i=0;i<m.vertices.length;i++){
      const p=pts[i];if(!p)continue;const v=m.vertices[i];const sel=selected.has(i),hover=state.meshEdit?.hoveredVert===i,hit=brushHits.has(i);
      if(canShowActive)drawVertexActiveWeightGauge(p,v,i,{weightBone,selected:sel,hover,brushHit:hit});
      else drawVertexInfluencePies(p,v,{selected:sel,hover});
    }
  }
  if(editor&&weights){
    for(let i=0;i<m.vertices.length;i++){const p=pts[i];if(!p)continue;if((m.vertices[i].weights||[]).length)continue;ctx.save();ctx.strokeStyle='#ff4d4d';ctx.fillStyle='rgba(255,77,77,.10)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(p.x-5,p.y-5);ctx.lineTo(p.x+5,p.y+5);ctx.moveTo(p.x+5,p.y-5);ctx.lineTo(p.x-5,p.y+5);ctx.stroke();ctx.restore();}
  }
  if(editor&&state.meshEdit?.showDiagnostics!==false&&typeof meshDiagnosticVertexSets==='function'){
    const sets=meshDiagnosticVertexSets(s);
    const drawWarn=(idx,color,label,shape='circle')=>{const p=pts[idx];if(!p)return;ctx.save();ctx.strokeStyle=color;ctx.fillStyle='rgba(9,12,16,.72)';ctx.lineWidth=2.25;if(shape==='diamond'){ctx.beginPath();ctx.moveTo(p.x,p.y-14);ctx.lineTo(p.x+14,p.y);ctx.lineTo(p.x,p.y+14);ctx.lineTo(p.x-14,p.y);ctx.closePath();}else{ctx.beginPath();ctx.arc(p.x,p.y,14,0,Math.PI*2);}ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,p.x,p.y);ctx.restore();};
    for(const i of sets.unweighted||[])drawWarn(i,'#ff4d4d','!');
    for(const i of sets.tooMany||[])drawWarn(i,'#ffb84a','+');
    for(const i of sets.badBone||[])drawWarn(i,'#ff66d9','?','diamond');
    for(const i of sets.missingBind||[])drawWarn(i,'#ffdf5d','B','diamond');
    for(const i of sets.overweight||[])drawWarn(i,'#b18cff','>');
  }
  if(editor&&!weights){
    for(let i=0;i<m.vertices.length;i++){
      const p=pts[i];if(!p)continue;const sel=selected.has(i),hover=state.meshEdit?.hoveredVert===i;ctx.fillStyle=sel?'#ffcc33':'#101010';ctx.strokeStyle=hover?'#ffffff':(sel?'#ffcc33':'#50b4ff');ctx.lineWidth=hover?2.5:(sel?2:1.25);ctx.beginPath();ctx.arc(p.x,p.y,sel?6:(hover?5.5:5),0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=sel?'#101010':'#d9f2ff';ctx.font='10px system-ui';ctx.fillText(String(i),p.x+7,p.y-7);
    }
  }
  if(editor&&weights&&state.meshEdit?.weightTool==='paint'&&state.meshEdit?.weightPaintSession?.active&&state.meshEdit?.weightBrushCursor){
    const c=state.meshEdit.weightBrushCursor,r=Math.max(4,Number(state.meshEdit.weightBrushSize||46));
    ctx.save();ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(c.x,c.y,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='11px system-ui';const b=bone(state.meshEdit.weightBoneId);ctx.fillText((state.meshEdit.weightBrushMode||'add')+(b?' · '+b.name:''),c.x+r+6,c.y-6);ctx.restore();
  }
  if(editor&&weights&&state.meshEdit?.weightTool==='adjust'&&state.meshEdit?.weightPaintSession?.active){
    const c=state.meshEdit.weightBrushCursor||pts[[...selected][0]]||{x:16,y:64};
    const delta=Number(state.meshEdit.weightAdjustDelta||0);const b=bone(state.meshEdit.weightBoneId);
    ctx.save();ctx.fillStyle='rgba(255,255,255,.9)';ctx.strokeStyle=delta>=0?'rgba(90,220,120,.9)':'rgba(255,120,120,.9)';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(c.x-22,c.y);ctx.lineTo(c.x+22,c.y);ctx.moveTo(c.x,c.y-22);ctx.lineTo(c.x,c.y+22);ctx.stroke();
    ctx.font='11px system-ui';ctx.fillText('adjust '+(delta>=0?'+':'')+delta.toFixed(2)+(b?' · '+b.name:''),c.x+10,c.y-12);ctx.restore();
  }
  ctx.restore();
}
function activeMeshOverlaySlot(){
  const direct=state.selected.type==='slot'?selectedSlot():null;
  const remembered=slot(state.lastSlotId);
  const s=direct&&slotDisplayAttachment(direct)?direct:(remembered&&slotDisplayAttachment(remembered)?remembered:null);
  return s;
}
function drawMeshVisibilityOverlay(){
  if(!state.view.mesh||meshEditorActive()||state.mode==='pose')return;
  const s=activeMeshOverlaySlot();if(!s)return;
  drawMeshWireForSlot(s,{editor:false,force:true});
}
function drawSlotGhost(s,color,alpha){if(!state.onion.attachments||!s.pose.visible)return;const att=attachment(s.pose.attachment);if(!att)return;const mesh=ensureSlotMesh(s);ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;if(mesh&&mesh.enabled){const pts=slotMeshBoundaryWorldVertices(s).map(w2s);ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();}else{const sw=slotWorld(s);if(!sw){ctx.restore();return;}applyWorldAffineToCanvas(sw);const x=-(att.pivotX??.5)*att.w,y=-(att.pivotY??.5)*att.h;ctx.lineWidth=1/state.camera.z;ctx.strokeRect(x,y,att.w,att.h);}ctx.restore();}
function drawRootBoneMarker(b,alpha=1){
  const a=w2s({x:b.w.sx,y:b.w.sy});const active=state.selected.type==='bone'&&b.id===state.selected.id;const multi=typeof isBoneSelected==='function'&&isBoneSelected(b.id);const sel=active||multi;
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=sel?'#ffcc33':'rgba(255,204,51,.85)';ctx.lineWidth=sel?2.5:2;
  const r=7;
  ctx.beginPath();
  ctx.moveTo(a.x-r,a.y);ctx.lineTo(a.x+r,a.y);
  ctx.moveTo(a.x,a.y-r);ctx.lineTo(a.x,a.y+r);
  ctx.stroke();
  ctx.beginPath();ctx.arc(a.x,a.y,2.5,0,Math.PI*2);ctx.fillStyle=ctx.strokeStyle;ctx.fill();
  ctx.restore();
}
function drawObjectRootMarker(b,alpha=1){
  const a=w2s({x:b.w.sx,y:b.w.sy});const active=state.selected.type==='bone'&&b.id===state.selected.id;const multi=typeof isBoneSelected==='function'&&isBoneSelected(b.id);const sel=active||multi;
  ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=sel?'#ffcc33':'rgba(255,204,51,.75)';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=sel?2.5:1.75;
  const r=9;ctx.beginPath();ctx.arc(a.x,a.y,r,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(a.x-r-4,a.y);ctx.lineTo(a.x+r+4,a.y);ctx.moveTo(a.x,a.y-r-4);ctx.lineTo(a.x,a.y+r+4);ctx.stroke();
  if(sel&&state.view.names){const o=objectForRootBone(b.id);ctx.font='11px system-ui';ctx.fillText(o?.name||b.name,a.x+13,a.y-11);}
  ctx.restore();
}
function boneVisualWidth(b){return clamp(Number(b?.width||12),4,96);}
function boneColor(b,useRest=false){return useRest?'#666':normalizeHex(b?.color||'#dddddd');}
function drawViewportTextBadge(text,x,y,{color='#ffcc33',font='12px system-ui'}={}){
  if(!text)return;
  ctx.save();
  ctx.font=font;
  const w=ctx.measureText(text).width;
  const h=15;
  ctx.fillStyle='rgba(5,8,12,.76)';
  ctx.strokeStyle='rgba(255,255,255,.16)';
  ctx.lineWidth=1;
  ctx.fillRect(x-4,y-h+3,w+8,h+4);
  ctx.strokeRect(x-4,y-h+3,w+8,h+4);
  ctx.fillStyle=color;
  ctx.fillText(text,x,y);
  ctx.restore();
}
function boneControllerLabelPos(a,b,selected,shape,width){
  const r=Math.max(10,width*.5);
  // Selected controller bones often have transform axes around their origin.
  // Put the name in the quieter lower-right quadrant so it does not collide
  // with the symbol, X/Y arrows, or controller cross.
  if(shape!=='bone')return selected?{x:a.x+r+14,y:a.y+r+19}:{x:a.x+r+10,y:a.y-r-8};
  return null;
}
function drawBoneShapeAt(p,b,{selected=false,useRest=false,alpha=1}={}){
  const shape=normalizeBoneShape(b?.shape||'bone');
  const size=boneVisualWidth(b);
  const col=boneColor(b,useRest);
  const rot=rad(b?.w?.r||0);
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.translate(p.x,p.y);
  ctx.rotate(rot);
  const half=Math.max(6,size*.42),r=Math.max(6,size*.42);
  const drawCross=()=>{ctx.beginPath();ctx.moveTo(-half,0);ctx.lineTo(half,0);ctx.moveTo(0,-half);ctx.lineTo(0,half);ctx.stroke();};
  if(selected){ctx.strokeStyle='#ffcc33';ctx.lineWidth=Math.max(3,size*.12)+3;ctx.fillStyle='rgba(255,204,51,.08)';
    if(shape==='cross')drawCross();
    else if(shape==='circleCross'){ctx.beginPath();ctx.arc(0,0,r+2,0,Math.PI*2);ctx.stroke();drawCross();}
    else if(shape==='square'||shape==='squareCross'){ctx.strokeRect(-half-2,-half-2,(half+2)*2,(half+2)*2);if(shape==='squareCross')drawCross();}
  }
  ctx.strokeStyle=col;ctx.fillStyle='#101010';ctx.lineWidth=Math.max(1.5,size*.1);
  if(shape==='cross'){drawCross();}
  else if(shape==='circleCross'){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();drawCross();}
  else if(shape==='square'){ctx.fillRect(-half,-half,half*2,half*2);ctx.strokeRect(-half,-half,half*2,half*2);}
  else if(shape==='squareCross'){ctx.fillRect(-half,-half,half*2,half*2);ctx.strokeRect(-half,-half,half*2,half*2);drawCross();}
  ctx.restore();
}
function drawBone(b,alpha=1,useRest=false){
  if(isProjectRootBone(b)){drawRootBoneMarker(b,alpha);return;}
  if(isObjectRootBone(b)){drawObjectRootMarker(b,alpha);return;}
  const sx=b.w.sx,sy=b.w.sy,ex=b.w.ex,ey=b.w.ey;const a=w2s({x:sx,y:sy}),e=w2s({x:ex,y:ey});
  const active=state.selected.type==='bone'&&b.id===state.selected.id&&!useRest;const multi=typeof isBoneSelected==='function'&&isBoneSelected(b.id)&&!useRest;const sel=active||multi;const shape=normalizeBoneShape(b.shape||'bone');const col=boneColor(b,useRest);const width=boneVisualWidth(b);
  ctx.save();ctx.globalAlpha=alpha;
  if(shape==='bone'){
    const line=Math.max(1.5,width*.11);
    if(sel){ctx.strokeStyle='#ffcc33';ctx.lineWidth=line+4;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(e.x,e.y);ctx.stroke();}
    ctx.strokeStyle=col;ctx.lineWidth=line;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(e.x,e.y);ctx.stroke();
    const sr=Math.max(3,width*.18),er=Math.max(4,width*.23);
    ctx.fillStyle=col;ctx.strokeStyle=sel?'#ffcc33':col;ctx.lineWidth=sel?2:1;
    ctx.beginPath();ctx.arc(a.x,a.y,sr,0,Math.PI*2);ctx.fill();if(sel)ctx.stroke();
    ctx.beginPath();ctx.arc(e.x,e.y,er,0,Math.PI*2);ctx.fill();if(sel)ctx.stroke();
  }else{
    // Controller-style bones are drawn as compact symbols at their start point.
    drawBoneShapeAt(a,b,{selected:sel,useRest,alpha:1});
    if(sel||state.view.names){ctx.strokeStyle=sel?'rgba(255,204,51,.65)':'rgba(255,255,255,.18)';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(e.x,e.y);ctx.stroke();ctx.setLineDash([]);}
    if(sel){ctx.fillStyle=col;ctx.beginPath();ctx.arc(e.x,e.y,Math.max(3,width*.14),0,Math.PI*2);ctx.fill();}
  }
  if(state.view.names&&!useRest){
    const labelColor=sel?'#ffcc33':'#bbb';
    if(shape==='bone'){
      ctx.fillStyle=labelColor;ctx.font='12px system-ui';
      ctx.fillText(b.name,(a.x+e.x)/2+5,(a.y+e.y)/2-5);
    }else{
      const lp=boneControllerLabelPos(a,b,sel,shape,width);
      drawViewportTextBadge(b.name,lp.x,lp.y,{color:labelColor,font:'12px system-ui'});
    }
  }
  ctx.restore();
}
function drawOnionBone(b,color,alpha){const a=w2s({x:b.w.sx,y:b.w.sy}),e=w2s({x:b.w.ex,y:b.w.ey});ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1.5;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(e.x,e.y);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(e.x,e.y,3,0,Math.PI*2);ctx.fill();ctx.restore();}
function drawMarkers(){if(!state.view.markers)return;for(const m of state.markers){if(!m.visible)continue;const mw=markerWorld(m);if(!mw)continue;const p=w2s(mw);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-rad(mw.r));ctx.scale(state.camera.z,state.camera.z);ctx.strokeStyle=(state.selected.type==='marker'&&state.selected.id===m.id)?'#ffcc33':(m.type==='hitbox'?'#ff6666':'#65d46e');ctx.lineWidth=2/state.camera.z;if(m.type==='hitbox'){ctx.strokeRect(-m.w/2,-m.h/2,m.w,m.h);}else{ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.moveTo(0,-8);ctx.lineTo(0,8);ctx.stroke();}ctx.restore();}}
function drawOnionSkins(){if(!state.onion.enabled||!state.bones.length)return;const fps=Math.max(1,Number(state.anim.fps||24));const step=Math.max(1,Number(state.onion.stepFrames||1))/fps;const snap=capturePose();const base=state.currentTime;const dur=Math.max(.001,Number(state.anim.duration||1));const drawFrame=(time,index,total,past)=>{let t=time;if(state.loop)t=((t%dur)+dur)%dur;else t=clamp(t,0,dur);applyAnimationPose(t);updateWorld(false);const alpha=clamp(Number(state.onion.opacity||.25),.05,.8)*(1-index/(total+1));const color=past?'#48a8ff':'#ffb84a';for(const s of state.slots)drawSlotGhost(s,color,alpha*.8);if(state.view.bones){for(const b of state.bones)if(boneRoleVisibleInViewport(b))drawOnionBone(b,color,alpha);}};for(let i=Number(state.onion.prev||0);i>=1;i--)drawFrame(base-step*i,i,Number(state.onion.prev||0),true);for(let i=1;i<=Number(state.onion.next||0);i++)drawFrame(base+step*i,i,Number(state.onion.next||0),false);restorePose(snap);updateWorld(false);}
function drawGhost(){if(!state.ghost)return;const a=w2s(state.ghost.a),e=w2s(state.ghost.e);ctx.save();ctx.strokeStyle='#ffcc33';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(e.x,e.y);ctx.stroke();ctx.restore();}
function meshEditorActive(){return !!(state.meshEdit?.enabled&&state.selected.type==='slot'&&selectedSlot());}
function drawMeshKnifePreview(){
  const path=state.meshEdit?.knifePath||[];if(!path.length||state.meshEdit?.tool!=='vertices'||state.meshEdit?.actionTool!=='knife')return;
  const a=path[0],b=path[path.length-1];if(!a||!b)return;
  ctx.save();ctx.strokeStyle='#ffcc33';ctx.fillStyle='#ffcc33';ctx.lineWidth=2;ctx.setLineDash([8,5]);
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.arc(a.x,a.y,4,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fill();
  if(Math.hypot(b.x-a.x,b.y-a.y)>5){ctx.fillStyle='rgba(9,12,16,.82)';ctx.fillRect(Math.min(a.x,b.x)+8,Math.min(a.y,b.y)-20,142,18);ctx.fillStyle='#ffcc33';ctx.font='11px system-ui';ctx.fillText('release to cut line',Math.min(a.x,b.x)+14,Math.min(a.y,b.y)-7);}
  ctx.restore();
}
function drawMeshEditorOverlay(){
  if(!meshEditorActive())return;const s=selectedSlot();const m=ensureSlotMesh(s);if(!s||!m||!m.vertices.length)return;
  drawMeshWireForSlot(s,{editor:true,weights:state.meshEdit.tool==='weights',force:true});
  const rawMode=(typeof meshSelectionMode==='function'?meshSelectionMode():state.meshEdit.selectionMode||'vertex');
  const mode=(rawMode==='face'?'TRIANGLE':rawMode.toUpperCase());
  const act=(typeof meshActionTool==='function'?meshActionTool():state.meshEdit.actionTool||'select').toUpperCase();
  ctx.save();
  ctx.fillStyle = '#ffcc33';
  ctx.font = '12px system-ui';
  const status = state.meshEdit.tool === 'weights'
    ? (state.meshEdit.weightPaintSession?.active ? 'Weight session / Apply or Cancel to finish' : 'Weights / choose a bone, then Paint or Adjust')
    : (state.meshEdit.tool === 'deform' ? 'Deform shape / drag vertices' : `Mesh / ${mode} / ${act}`);
  ctx.fillText(status, 14, 64);
  ctx.restore();
  drawMeshKnifePreview();
}
function drawObjectSlots(objectId,drawn=new Set()){
  if(!objectId||drawn.has(objectId))return;drawn.add(objectId);
  const o=rigObject(objectId);if(o&&o.visible===false)return;
  for(const s of state.slots){
    if(objectOfSlotId(s.id)!==objectId)continue;
    drawSlot(s);
    for(const child of state.objects.filter(o=>o.parentSlot===s.id))drawObjectSlots(child.id,drawn);
  }
}
function objectRenderLayerVisible(o){
  if(state.documentType!=='toon'||typeof renderLayerById!=='function')return true;
  const layer=renderLayerById(o?.renderLayerId);return !layer||layer.visible!==false;
}
function drawSceneSlots(){
  const drawn=new Set();
  for(const s of state.slots.filter(s=>!s.objectId&&!s.bone))drawSlot(s);
  const top=state.objects.filter(o=>!o.parentSlot||!slot(o.parentSlot));
  const ordered=(state.documentType==='toon'&&typeof objectRenderLayerOrder==='function')?[...top].sort((a,b)=>objectRenderLayerOrder(a)-objectRenderLayerOrder(b)):top;
  for(const o of ordered){if(!objectRenderLayerVisible(o)){drawn.add(o.id);continue;}drawObjectSlots(o.id,drawn);}
  for(const o of state.objects)if(!drawn.has(o.id)&&objectRenderLayerVisible(o))drawObjectSlots(o.id,drawn);
}

function toonCameraFrameInfo(cameraId=null){
  if(state.documentType!=='toon'||typeof ensureToon!=='function')return null;
  const t=ensureToon();
  const cam=(cameraId&&Array.isArray(t.cameras)?t.cameras.find(c=>c.id===cameraId):null)||((typeof activeToonCamera==='function')?activeToonCamera():null);
  if(!cam)return null;
  const cw=Number(t.canvas?.width||1920),ch=Number(t.canvas?.height||1080),z=Math.max(.001,Number(cam.z||1));
  const hw=cw/(2*z),hh=ch/(2*z),r=Number(cam.r||0),cx=Number(cam.x||0),cy=Number(cam.y||0);
  const local=[[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]];
  const cornersWorld=local.map(([x,y])=>{const q=rotatePoint(x,y,r);return{x:cx+q.x,y:cy+q.y};});
  const corners=cornersWorld.map(w2s),centerWorld={x:cx,y:cy},center=w2s(centerWorld);
  const label=corners[3]||w2s({x:cx-hw,y:cy+hh});
  return{toon:t,cam,cw,ch,z,hw,hh,r,centerWorld,center,cornersWorld,corners,label};
}
function drawToonCameraFrame(){
  const info=toonCameraFrameInfo();if(!info)return;
  const {cam,cw,ch,corners,label}=info;
  const selected=state.selected?.type==='camera'&&state.selected.id===cam.id;
  ctx.save();
  ctx.strokeStyle=selected?'#fff6bf':'#ffcc33';ctx.lineWidth=selected?2.25:1.5;ctx.setLineDash(selected?[]:[7,5]);
  ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  const labelW=Math.max(146,Math.min(220,String(cam.name||'Camera').length*7+78));
  ctx.fillStyle='rgba(17,20,25,.86)';ctx.fillRect(label.x,label.y-18,labelW,18);ctx.strokeStyle=selected?'rgba(255,246,191,.75)':'rgba(255,204,51,.45)';ctx.strokeRect(label.x,label.y-18,labelW,18);
  ctx.fillStyle=selected?'#fff6bf':'#ffcc33';ctx.font='11px system-ui';ctx.fillText((cam.name||'Camera')+' · '+cw+'×'+ch,label.x+5,label.y-5);
  ctx.restore();
}


function drawBoneParentLinks(){
  if(!state.view.bones)return;
  updateWorld(false);
  ctx.save();ctx.lineWidth=1;ctx.setLineDash([4,4]);
  for(const b of state.bones){
    if(!boneRoleVisibleInViewport(b)||isProjectRootBone(b)||isObjectRootBone(b)||isConnectedBone(b))continue;
    const p=bone(b.parent);if(!p||isProjectRootBone(p))continue;
    const a=w2s({x:p.w.sx,y:p.w.sy}),c=w2s({x:b.w.sx,y:b.w.sy});
    ctx.strokeStyle=inferBoneRole(b)==='control'?'rgba(68,217,197,.35)':inferBoneRole(b)==='socket'?'rgba(177,140,255,.42)':'rgba(255,255,255,.20)';
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke();
  }
  ctx.setLineDash([]);ctx.restore();
}

function drawViewportSelectionBox(){
  const d=state.drag;if(!d||!['meshBox','boneBox'].includes(d.type)||!d.startScreen||!d.currentScreen)return;
  const a=d.startScreen,b=d.currentScreen;const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
  ctx.save();
  ctx.strokeStyle=d.type==='boneBox'?'#ffcc33':'#4ea1ff';
  ctx.fillStyle=d.type==='boneBox'?'rgba(255,204,51,.13)':'rgba(78,161,255,.14)';
  ctx.lineWidth=1;ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.restore();
}

function drawCameraViewBackground(){
  const r=cameraPreviewRect();if(!r)return null;
  const c=r.toon?.canvas||{};
  ctx.save();
  ctx.fillStyle='#090c10';ctx.fillRect(0,0,viewRect().w,viewRect().h);
  if(c.transparent){
    const size=12;
    for(let y=r.y;y<r.y+r.h;y+=size){
      for(let x=r.x;x<r.x+r.w;x+=size){ctx.fillStyle=((Math.floor((x-r.x)/size)+Math.floor((y-r.y)/size))%2)?'#20252b':'#15191f';ctx.fillRect(x,y,Math.min(size,r.x+r.w-x),Math.min(size,r.y+r.h-y));}
    }
  }else{ctx.fillStyle=normalizeHex(c.background||'#000000','#000000');ctx.fillRect(r.x,r.y,r.w,r.h);}
  ctx.strokeStyle='#dfe8f2';ctx.lineWidth=1.5;ctx.strokeRect(r.x,r.y,r.w,r.h);
  ctx.fillStyle='rgba(9,12,16,.82)';ctx.fillRect(r.x,r.y-22,Math.min(360,r.w),22);
  ctx.fillStyle='#dfe8f2';ctx.font='11px system-ui';ctx.fillText('Camera View · '+r.cw+'×'+r.ch,r.x+8,r.y-7);
  ctx.restore();return r;
}
function drawSceneEditorLayers(){
  if(state.view.rest||rigTestPoseActive?.()){updateWorld(true);for(const b of state.bones)if(boneRoleVisibleInViewport(b))drawBone(b,(rigTestPoseActive?.()?0.35:0.45),true);}
  drawOnionSkins();updateWorld(false);drawSceneSlots();drawMarkers();
  if(state.view.bones){drawBoneParentLinks();for(const b of state.bones)if(boneRoleVisibleInViewport(b))drawBone(b,1,false);}
  drawMeshVisibilityOverlay();drawTransformGizmo();drawMeshEditorOverlay();if(rigTestPoseActive?.())drawViewportTextBadge('TEST POSE · temporary deformation preview · Esc exit / Enter reset',14,24,{color:'#9fffc3'});drawGhost();
}
function draw(){
  sizeCanvas();const v=viewRect();ctx.clearRect(0,0,v.w,v.h);
  const cv=isToonCameraView();
  if(cv){
    const r=drawCameraViewBackground();
    if(r){ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();drawSceneEditorLayers();ctx.restore();}
    drawViewportSelectionBox();return;
  }
  drawGrid();drawToonCameraFrame();drawSceneEditorLayers();drawViewportSelectionBox();
}

function slotWorldCorners(s){
  const att=attachment(s.pose?.attachment||s.attachment);const sw=slotWorld(s);if(!att||!sw)return null;
  const x0=-(att.pivotX??.5)*att.w,y0=-(att.pivotY??.5)*att.h;
  const pts=[[x0,y0],[x0+att.w,y0],[x0+att.w,y0+att.h],[x0,y0+att.h]].map(([x,y])=>({x:sw.x+(sw.ax??1)*x+(sw.bx??0)*y,y:sw.y+(sw.ay??0)*x+(sw.by??1)*y}));
  return{sw,att,pts};
}
function drawSlotGizmo(s){
  const info=slotWorldCorners(s);if(!info)return;const {sw,pts}=info;const c=w2s({x:sw.x,y:sw.y});const sc=Math.max(.001,state.camera.z);
  const screens=pts.map(w2s);const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});const mids=[mid(screens[0],screens[1]),mid(screens[1],screens[2]),mid(screens[2],screens[3]),mid(screens[3],screens[0])];
  ctx.save();ctx.strokeStyle='#ffcc33';ctx.fillStyle='#101010';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);ctx.beginPath();screens.forEach((p,i)=>{if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#ffcc33';ctx.fillStyle='#101010';
  if(state.gizmoMode==='move'){
    if(typeof draw2DMoveGizmoAt==='function')draw2DMoveGizmoAt(c,{label:'SLOT'});
    else{ctx.beginPath();ctx.moveTo(c.x-16,c.y);ctx.lineTo(c.x+16,c.y);ctx.moveTo(c.x,c.y-16);ctx.lineTo(c.x,c.y+16);ctx.stroke();ctx.beginPath();ctx.arc(c.x,c.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}
  }else if(state.gizmoMode==='scale'){
    for(const p of screens){ctx.fillStyle='#101010';ctx.fillRect(p.x-4,p.y-4,8,8);ctx.strokeRect(p.x-4,p.y-4,8,8);}
    ctx.fillStyle='#101010';for(let i=0;i<mids.length;i++){const p=mids[i];ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.fillStyle='#ffcc33';ctx.font='10px system-ui';ctx.fillText('SX',mids[1].x+8,mids[1].y+3);ctx.fillText('SY',mids[0].x+8,mids[0].y+3);
  }else if(state.gizmoMode==='rotate'){
    const up=rotatePoint(0,-70/sc,sw.r);const rh=w2s({x:sw.x+up.x,y:sw.y+up.y});ctx.beginPath();ctx.moveTo(c.x,c.y);ctx.lineTo(rh.x,rh.y);ctx.stroke();ctx.beginPath();ctx.arc(rh.x,rh.y,7,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  ctx.fillStyle='#ffcc33';ctx.font='11px system-ui';ctx.fillText(state.gizmoMode.toUpperCase(),c.x+12,c.y-12);
  ctx.restore();
}
function drawBoneGizmo(b){
  if(isProjectRootBone(b))return;
  updateWorld(false);const a=w2s({x:b.w.sx,y:b.w.sy}),e=w2s({x:b.w.ex,y:b.w.ey});ctx.save();ctx.strokeStyle='#ffcc33';ctx.fillStyle='#101010';ctx.lineWidth=1.5;ctx.font='11px system-ui';
  if(state.gizmoMode==='move'&&canMoveBone(b)){
    if(typeof draw2DMoveGizmoAt==='function')draw2DMoveGizmoAt(a,{label:'BONE'});
    else{ctx.beginPath();ctx.arc(a.x,a.y,18,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffcc33';ctx.fillText('MOVE',a.x+10,a.y+25);}
  }else if(state.gizmoMode==='scale'){
    const side=w2s({x:b.w.sx+(b.w.bx||0)*Math.max(18,Number(b.width||12)*2),y:b.w.sy+(b.w.by||1)*Math.max(18,Number(b.width||12)*2)});
    ctx.fillStyle='#101010';ctx.strokeStyle='#ffcc33';ctx.fillRect(e.x-6,e.y-6,12,12);ctx.strokeRect(e.x-6,e.y-6,12,12);ctx.fillRect(side.x-6,side.y-6,12,12);ctx.strokeRect(side.x-6,side.y-6,12,12);ctx.fillStyle='#ffcc33';ctx.fillText('SX',e.x+10,e.y-8);ctx.fillText('SY',side.x+10,side.y-8);
  }else if(state.gizmoMode==='rotate'&&!isMoveOnlyBone(b)){
    ctx.fillStyle='#101010';ctx.beginPath();ctx.arc(e.x,e.y,8,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#ffcc33';ctx.fillText('ROT',e.x+10,e.y-8);
  }
  ctx.restore();
}
function drawTransformGizmo(){
  if(typeof drawUniversalTransformGizmo==='function'&&drawUniversalTransformGizmo())return;
  if(state.selected.type==='slot'){const s=selectedSlot();if(s)drawSlotGizmo(s);}else if(state.selected.type==='bone'){const b=selectedBone();if(b)drawBoneGizmo(b);}
}
