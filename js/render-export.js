'use strict';
// ToonDoc PNG render/export helpers.

function ensureRenderExportSettings(){
  state.renderExport=state.renderExport||{scope:'sequence',output:'final',range:'clip',busy:false,lastMessage:''};
  if(!['current','sequence'].includes(state.renderExport.scope))state.renderExport.scope='sequence';
  if(!['final','passes','both'].includes(state.renderExport.output))state.renderExport.output='final';
  if(!['clip','timeline'].includes(state.renderExport.range))state.renderExport.range='clip';
  return state.renderExport;
}
function renderExportFrameCount(scope='sequence',range='clip'){
  const fps=Math.max(1,Number(state.anim?.fps||24));
  const a=range==='timeline'?Number(state.timeline?.rangeStart||0):0;
  const b=range==='timeline'?Number(state.timeline?.rangeEnd||state.anim?.duration||0):Number(state.anim?.duration||0);
  if(scope==='current')return 1;
  const start=Math.max(0,Math.min(a,b));
  const end=Math.max(start,Math.max(a,b));
  return Math.max(1,Math.floor((end-start)*fps+0.0001)+1);
}
function renderExportFileBase(frameIndex,time,fps){
  const proj=safeFileName(state.projectName||'project');
  const clip=safeFileName(state.anim?.name||'anim');
  const frameNo=Math.round(Number(time||0)*Math.max(1,Number(fps||24)));
  const seq=String(frameIndex).padStart(4,'0');
  return `${proj}_${clip}_${seq}_f${String(frameNo).padStart(4,'0')}`;
}
function canvasBlendMode(mode){return !mode||mode==='normal'?'source-over':mode;}
function createRenderSurface(){const c=document.createElement('canvas');const t=ensureToon();c.width=Math.max(1,Number(t.canvas?.width||1920));c.height=Math.max(1,Number(t.canvas?.height||1080));return c;}
function renderCameraWorldToScreenFactory(camera,cw,ch){
  const z=Math.max(.001,Number(camera?.z||1)),cr=rad(-(Number(camera?.r||0))),cs=Math.cos(cr),sn=Math.sin(cr),cx=Number(camera?.x||0),cy=Number(camera?.y||0);
  return function(p){
    const dx=Number(p?.x||0)-cx,dy=Number(p?.y||0)-cy;
    const lx=dx*cs-dy*sn,ly=dx*sn+dy*cs;
    return{x:cw*.5+lx*z,y:ch*.5-ly*z};
  };
}
function renderExportApplyWorldAffine(rctx,w2s,sw){
  const origin={x:Number(sw?.x||0),y:Number(sw?.y||0)};
  const p0=w2s(origin);
  const px=w2s({x:origin.x+Number(sw?.ax??1),y:origin.y+Number(sw?.ay??0)});
  const py=w2s({x:origin.x+Number(sw?.bx??0),y:origin.y+Number(sw?.by??1)});
  rctx.setTransform(px.x-p0.x,px.y-p0.y,py.x-p0.x,py.y-p0.y,p0.x,p0.y);
}
function renderExportTriangleTransform(src,dst){
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
function renderExportMeshVertexUV(v,att){
  if(Number.isFinite(Number(v?.u))&&Number.isFinite(Number(v?.v)))return{u:Number(v.u),v:Number(v.v)};
  const x0=-(att.pivotX??.5)*att.w,y0=-(att.pivotY??.5)*att.h;
  return{u:att.w?((Number(v?.x||0)-x0)/att.w):0,v:att.h?((Number(v?.y||0)-y0)/att.h):0};
}
function renderExportMeshVertexSourcePoint(v,att){const uv=renderExportMeshVertexUV(v,att);return{x:uv.u*att.w,y:uv.v*att.h};}
function renderExportTrianglePath(rctx,points){rctx.beginPath();rctx.moveTo(points[0].x,points[0].y);rctx.lineTo(points[1].x,points[1].y);rctx.lineTo(points[2].x,points[2].y);rctx.closePath();}
function renderExportDrawImageMeshTriangle(rctx,img,att,srcPts,dstPts,tint,tintAlpha){
  const m=renderExportTriangleTransform(srcPts,dstPts);if(!m)return;
  rctx.save();renderExportTrianglePath(rctx,dstPts);rctx.clip();rctx.setTransform(m.a,m.b,m.c,m.d,m.e,m.f);rctx.drawImage(img,0,0,att.w,att.h);rctx.restore();
  if(tintAlpha>0){rctx.save();rctx.globalAlpha*=tintAlpha;rctx.globalCompositeOperation='source-atop';rctx.fillStyle=tint;renderExportTrianglePath(rctx,dstPts);rctx.fill();rctx.restore();}
}
function renderExportDrawSlotMesh(rctx,w2s,s,att,alpha,tint,tintAlpha,blend){
  const mesh=ensureSlotMesh(s);if(!mesh||!mesh.enabled||!mesh.vertices?.length)return false;
  const verts=slotMeshWorldVertices(s).map(w2s),tris=mesh.triangles||[[0,1,2],[0,2,3]];
  rctx.save();rctx.globalAlpha=alpha;rctx.globalCompositeOperation=canvasBlendMode(blend);
  if(att.type==='image'){
    const img=getImage(att);
    if(img&&img.complete&&img.naturalWidth){
      for(const tri of tris){const src=tri.map(i=>renderExportMeshVertexSourcePoint(mesh.vertices[i],att)),dst=tri.map(i=>verts[i]);renderExportDrawImageMeshTriangle(rctx,img,att,src,dst,tint,tintAlpha);}
    }else{
      rctx.fillStyle=mixColor('#333333',tint,tintAlpha);rctx.beginPath();verts.forEach((p,i)=>i?rctx.lineTo(p.x,p.y):rctx.moveTo(p.x,p.y));rctx.closePath();rctx.fill();
    }
  }else{
    rctx.fillStyle=mixColor(att.color||'#888888',tint,tintAlpha);rctx.globalAlpha=alpha*.65;rctx.beginPath();verts.forEach((p,i)=>i?rctx.lineTo(p.x,p.y):rctx.moveTo(p.x,p.y));rctx.closePath();rctx.fill();
  }
  rctx.restore();return true;
}
function renderExportDrawSlot(rctx,w2s,s){
  if(!s||!s.pose?.visible)return;
  const att=attachment(s.pose.attachment);if(!att)return;
  const sw=slotWorld(s);if(!sw)return;
  const alpha=clamp(Number(s.pose.alpha??1),0,1),tint=normalizeHex(s.pose.tint||s.tint||'#ffffff'),tintAlpha=clamp(Number(s.pose.tintAlpha??s.tintAlpha??0),0,1),blend=s.pose.blendMode||s.blendMode||'normal';
  const mesh=ensureSlotMesh(s);
  if(mesh&&mesh.enabled&&renderExportDrawSlotMesh(rctx,w2s,s,att,alpha,tint,tintAlpha,blend))return;
  rctx.save();rctx.globalAlpha=alpha;rctx.globalCompositeOperation=canvasBlendMode(blend);renderExportApplyWorldAffine(rctx,w2s,sw);
  const x=-(att.pivotX??.5)*att.w,y=-(att.pivotY??.5)*att.h;
  if(att.type==='image'){
    const img=getImage(att);
    if(img&&img.complete&&img.naturalWidth){rctx.drawImage(img,x,y,att.w,att.h);if(tintAlpha>0){rctx.save();rctx.globalAlpha=tintAlpha;rctx.globalCompositeOperation='source-atop';rctx.fillStyle=tint;rctx.fillRect(x,y,att.w,att.h);rctx.restore();}}
    else{rctx.fillStyle=mixColor('#333333',tint,tintAlpha);rctx.fillRect(x,y,att.w,att.h);}
  }else{
    rctx.fillStyle=mixColor(att.color||'#888888',tint,tintAlpha);rctx.globalAlpha=alpha*.65;rctx.fillRect(x,y,att.w,att.h);
  }
  rctx.restore();
}
function renderExportDrawObjectSlots(rctx,w2s,objectId,drawn,layerId=null){
  if(!objectId||drawn.has(objectId))return;drawn.add(objectId);
  const o=rigObject(objectId);if(o&&o.visible===false)return;
  const matches=!layerId||((o.renderLayerId||defaultRenderLayerId())===layerId);
  for(const s of state.slots){
    if(objectOfSlotId(s.id)!==objectId)continue;
    if(matches)renderExportDrawSlot(rctx,w2s,s);
    for(const child of state.objects.filter(x=>x.parentSlot===s.id))renderExportDrawObjectSlots(rctx,w2s,child.id,drawn,layerId);
  }
}
function renderExportDrawCompositeScene(rctx,w2s){
  // Important: draw every visible render layer independently. A shared drawn-set
  // across layers hides objects that live on later layers, so the final render
  // may look like background-only when the first visible layer is Background.
  for(const s of state.slots.filter(s=>!s.objectId&&!s.bone))renderExportDrawSlot(rctx,w2s,s);
  for(const layer of sortedRenderLayers().filter(l=>l.visible!==false))renderExportDrawLayerScene(rctx,w2s,layer.id);
}
function renderExportLooseSlotsVisible(){return state.slots.some(s=>!s.objectId&&!s.bone&&s.pose?.visible&&attachment(s.pose.attachment));}
function renderExportDrawLayerScene(rctx,w2s,layerId){
  if(layerId==='__unassigned__'){for(const s of state.slots.filter(s=>!s.objectId&&!s.bone))renderExportDrawSlot(rctx,w2s,s);return;}
  const drawn=new Set();const top=state.objects.filter(o=>!o.parentSlot||!slot(o.parentSlot));
  for(const o of top)renderExportDrawObjectSlots(rctx,w2s,o.id,drawn,layerId);
  for(const o of state.objects)if(!drawn.has(o.id))renderExportDrawObjectSlots(rctx,w2s,o.id,drawn,layerId);
}
function fillRenderSurfaceBackground(rctx,{transparent=false}={}){
  const t=ensureToon(),w=Math.max(1,Number(t.canvas?.width||1920)),h=Math.max(1,Number(t.canvas?.height||1080));
  rctx.setTransform(1,0,0,1,0,0);rctx.clearRect(0,0,w,h);
  if(!transparent&&!t.canvas?.transparent){rctx.fillStyle=normalizeHex(t.canvas?.background||'#000000','#000000');rctx.fillRect(0,0,w,h);}
}
function renderFrameToSurface(surface,{camera=null,layerId=null}={}){
  const t=ensureToon(),cam=camera||activeToonCamera();if(!cam)throw new Error('No active ToonDoc camera.');
  surface.width=Math.max(1,Number(t.canvas?.width||1920));surface.height=Math.max(1,Number(t.canvas?.height||1080));
  const rctx=surface.getContext('2d',{alpha:true,willReadFrequently:false});
  // Layer passes should be transparent even when the final comp uses a solid BG.
  fillRenderSurfaceBackground(rctx,{transparent:!!layerId});
  updateWorld(false);
  const w2s=renderCameraWorldToScreenFactory(cam,surface.width,surface.height);
  if(layerId)renderExportDrawLayerScene(rctx,w2s,layerId);else renderExportDrawCompositeScene(rctx,w2s);
  rctx.setTransform(1,0,0,1,0,0);
  return surface;
}
function canvasToBlob(canvasEl){return new Promise((res,rej)=>canvasEl.toBlob(b=>b?res(b):rej(new Error('PNG encode failed')),'image/png'));}
async function writeFileToHandle(fileHandle,blob){const w=await fileHandle.createWritable();await w.write(blob);await w.close();}
function waitForImage(img){return new Promise(resolve=>{if(!img||img.complete)return resolve();const done=()=>resolve();img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});});}
async function ensureRenderAssetsReady(){const waits=[];for(const a of state.attachments||[]){if(a?.type!=='image'||!a.src)continue;const img=getImage(a);if(img&&(!img.complete||!img.naturalWidth))waits.push(waitForImage(img));}if(waits.length)await Promise.all(waits);}
function currentRenderTimes(scope='sequence',range='clip'){
  const fps=Math.max(1,Number(state.anim?.fps||24));
  if(scope==='current')return[{time:Number(state.currentTime||0),frameIndex:0,fps}];
  const start=range==='timeline'?Number(state.timeline?.rangeStart||0):0;
  const end=range==='timeline'?Number(state.timeline?.rangeEnd||state.anim?.duration||0):Number(state.anim?.duration||0);
  const a=Math.max(0,Math.min(start,end)),b=Math.max(a,Math.max(start,end));
  const total=Math.max(1,Math.floor((b-a)*fps+0.0001)+1),items=[];
  for(let i=0;i<total;i++)items.push({time:Math.min(b,a+i/fps),frameIndex:i,fps});
  return items;
}
function captureRenderExportSnapshot(){
  return{pose:capturePose(),toon:JSON.parse(JSON.stringify(state.toon||defaultToonSettings())),playing:!!state.playing};
}
function restoreRenderExportSnapshot(snap){
  if(!snap)return;
  state.playing=!!snap.playing;
  if(snap.toon)state.toon=JSON.parse(JSON.stringify(snap.toon));
  restorePose(snap.pose);updateWorld(false);syncTime();renderAll();
}
async function renderPngSequenceToFolder(options={}){
  if(state.documentType!=='toon'){alert('PNG render export is currently available for ToonDoc only.');return false;}
  if(!window.showDirectoryPicker){alert('PNG render export needs a Chromium-style browser with File System Access API.');return false;}
  const settings=ensureRenderExportSettings();
  const scope=options.scope||settings.scope||'sequence';
  const output=options.output||settings.output||'final';
  const range=options.range||settings.range||'clip';
  const frames=currentRenderTimes(scope,range);
  const status=(msg)=>{ensureRenderExportSettings().lastMessage=msg;renderDocumentPanel?.();};
  settings.busy=true;status('Preparing render…');
  const snapshot=captureRenderExportSnapshot();const surface=createRenderSurface();
  try{
    await ensureRenderAssetsReady();
    const dir=await window.showDirectoryPicker({mode:'readwrite'});if(!dir)return false;
    let finalDir=dir,passesDir=null;
    const needsFinal=(output==='final'||output==='both'),needsPasses=(output==='passes'||output==='both');
    if(needsFinal&&needsPasses)finalDir=await dir.getDirectoryHandle('final',{create:true});
    if(needsPasses)passesDir=await dir.getDirectoryHandle('passes',{create:true});
    const passLayers=[];
    if(needsPasses){
      if(renderExportLooseSlotsVisible())passLayers.push({id:'__unassigned__',name:'Unassigned'});
      for(const l of sortedRenderLayers().filter(l=>l.visible!==false))passLayers.push({id:l.id,name:l.name||l.id});
    }
    const activeCam=activeToonCamera();
    for(let i=0;i<frames.length;i++){
      const rec=frames[i];
      if(scope!=='current')evaluate(rec.time,false,false);
      updateWorld(false);
      const base=renderExportFileBase(rec.frameIndex,rec.time,rec.fps);
      if(needsFinal){
        renderFrameToSurface(surface,{camera:activeCam,layerId:null});
        const blob=await canvasToBlob(surface);const fh=await finalDir.getFileHandle(base+'.png',{create:true});await writeFileToHandle(fh,blob);
      }
      if(needsPasses){
        for(const layer of passLayers){
          const sub=await passesDir.getDirectoryHandle(safeFileName(layer.name||layer.id),{create:true});
          renderFrameToSurface(surface,{camera:activeCam,layerId:layer.id});
          const blob=await canvasToBlob(surface);const fh=await sub.getFileHandle(base+'.png',{create:true});await writeFileToHandle(fh,blob);
        }
      }
      status(`Rendering ${i+1}/${frames.length} frame(s)…`);
      await new Promise(r=>setTimeout(r,0));
    }
    const msg=`Done: ${frames.length} frame(s) rendered as ${output==='final'?'final PNG':(output==='passes'?'layer passes':'final PNG + passes')}.`;
    status(msg);alert(msg);return true;
  }catch(err){
    if(err&&err.name==='AbortError'){status('Render cancelled.');return false;}
    console.error(err);status('Render failed: '+(err?.message||err));alert('Render failed: '+(err?.message||err));return false;
  }finally{settings.busy=false;restoreRenderExportSnapshot(snapshot);}
}
