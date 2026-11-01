'use strict';
// Elastic / Spring / Rubber bone helpers.
// Runtime preview is non-destructive: animation pose is sampled first, then elastic is applied on top.
const ELASTIC_PRESETS={
  Hair:{mode:'spring',stiffness:.22,damping:.72,stretch:0},
  Tail:{mode:'spring',stiffness:.36,damping:.62,stretch:0},
  Cloth:{mode:'spring',stiffness:.18,damping:.78,stretch:0},
  Rubber:{mode:'rubber',stiffness:.48,damping:.48,stretch:.38},
  Jelly:{mode:'rubber',stiffness:.25,damping:.38,stretch:.6},
  Mechanical:{mode:'spring',stiffness:.78,damping:.86,stretch:0}
};

const ELASTIC_FIXED_STEP=1/120;
const ELASTIC_BAKE_SAMPLE_FPS=90;
const ELASTIC_BAKE_SIM_FPS=180;
const ELASTIC_SMART_BAKE={visualTol:1.0,maxInterval:.42};
function elasticBakeSettings(){
  state.elastic=state.elastic||{preview:true,sim:{}};
  const e=state.elastic;
  return{
    visualTol:clamp(Number(e.bakeVisualError??ELASTIC_SMART_BAKE.visualTol),.1,8),
    maxInterval:clamp(Number(e.bakeMaxInterval??ELASTIC_SMART_BAKE.maxInterval),.08,2)
  };
}
function elasticFixedStepCount(dt){return Math.max(1,Math.ceil(clamp(Number(dt)||ELASTIC_FIXED_STEP,1/1000,.25)/ELASTIC_FIXED_STEP));}
function roundBakeTime(t){return Math.round(clamp(Number(t)||0,0,state.anim.duration)*1000000)/1000000;}
function elasticEnabledBones(selectedOnly=false){
  const set=selectedOnly?selectedBoneSet():null;
  return state.bones.filter(b=>!isProjectRootBone(b)&&b.elastic?.enabled&&(!set||set.has(b.id)));
}
function elasticParams(b){b.elastic=normalizeElasticSettings(b.elastic||{});return b.elastic;}
function setElasticPreset(bOrId,name){
  const b=typeof bOrId==='string'?bone(bOrId):bOrId;if(!b||isProjectRootBone(b))return false;
  const p=ELASTIC_PRESETS[name]||ELASTIC_PRESETS.Tail;b.elastic=normalizeElasticSettings({...b.elastic,enabled:true,preset:name,...p});return true;
}
function resetElasticSimulation(){
  state.elastic=state.elastic||{preview:true,sim:{}};state.elastic.sim={};state.elastic.lastFrameTime=null;
  updateWorld(false);
  for(const b of elasticEnabledBones(false))state.elastic.sim[b.id]={x:b.w.ex,y:b.w.ey,vx:0,vy:0,len:b.local?.len||b.rest?.len||80};
}
function ensureElasticStateForBone(b){
  state.elastic=state.elastic||{preview:true,sim:{}};state.elastic.sim=state.elastic.sim||{};
  let s=state.elastic.sim[b.id];
  if(!s){s={x:b.w.ex,y:b.w.ey,vx:0,vy:0,len:b.local?.len||b.rest?.len||80};state.elastic.sim[b.id]=s;}
  return s;
}
function shouldPreviewElastic(){return state.elastic?.preview!==false&&elasticEnabledBones(false).length>0;}
function integrateElasticSubstep(step){
  updateWorld(false);
  for(const b of state.bones){
    if(!b.elastic?.enabled||isProjectRootBone(b))continue;
    const el=elasticParams(b),s=ensureElasticStateForBone(b);
    const target={x:b.w.ex,y:b.w.ey},start={x:b.w.sx,y:b.w.sy};
    const k=lerp(18,180,el.stiffness);
    const damp=lerp(2,34,el.damping);
    s.vx+=((target.x-s.x)*k-s.vx*damp)*step;
    s.vy+=((target.y-s.y)*k-s.vy*damp)*step;
    s.x+=s.vx*step;s.y+=s.vy*step;
    let dx=s.x-start.x,dy=s.y-start.y;let curLen=Math.max(.0001,Math.hypot(dx,dy));
    const baseLen=Math.max(4,Number(b.local?.len||b.rest?.len||80));
    const stretch=el.mode==='rubber'?clamp(Number(el.stretch||0),0,1):0;
    let outLen=baseLen;
    if(el.mode==='rubber'&&stretch>0){
      const minLen=baseLen*(1-stretch*.45),maxLen=baseLen*(1+stretch*1.25);
      outLen=clamp(curLen,minLen,maxLen);
      if(stretch<1)outLen=lerp(baseLen,outLen,stretch);
    }
    const scale=outLen/curLen;dx*=scale;dy*=scale;s.x=start.x+dx;s.y=start.y+dy;
    const worldR=deg(Math.atan2(dy,dx));const p=bone(b.parent);
    b.local.r=normAngle(worldR-(p?p.w.r:0));
    if(el.mode==='rubber')b.local.len=outLen;
    updateWorld(false);
  }
}
function stepElasticBones(dt,{force=false}={}){
  if(!force&&!state.playing)return false;
  if(!shouldPreviewElastic()&&!force)return false;
  const bones=elasticEnabledBones(false);if(!bones.length)return false;
  const total=clamp(Number(dt)||1/60,1/240,1/15);
  const steps=elasticFixedStepCount(total),sub=total/steps;
  for(let i=0;i<steps;i++)integrateElasticSubstep(sub);
  return true;
}
function cloneJson(v){return JSON.parse(JSON.stringify(v||{}));}
function makeElasticBakeSample(id,t){
  const b=bone(id);if(!b||isProjectRootBone(b))return null;
  updateWorld(false);
  const p=bone(b.parent);
  return{
    t:roundBakeTime(t),
    id,
    connected:isConnectedBone(b),
    x:Number(b.local.x||0),y:Number(b.local.y||0),r:normAngle(Number(b.local.r||0)),len:Math.max(4,Number(b.local.len||80)),lsx:Number(b.local.sx??1)||1,lsy:Number(b.local.sy??1)||1,
    sx:Number(b.w.sx||0),sy:Number(b.w.sy||0),ex:Number(b.w.ex||0),ey:Number(b.w.ey||0),
    wr:Number(b.w.r||0),pr:Number(p?.w?.r||0)
  };
}
function cloneElasticBakePoint(k){
  return{
    t:roundBakeTime(k.t),id:k.id||'',connected:!!k.connected,
    x:Number(k.x||0),y:Number(k.y||0),r:normAngle(Number(k.r||0)),len:Math.max(4,Number(k.len||80)),lsx:Number(k.lsx??1)||1,lsy:Number(k.lsy??1)||1,
    sx:Number(k.sx||0),sy:Number(k.sy||0),ex:Number(k.ex||0),ey:Number(k.ey||0),
    wr:Number(k.wr||0),pr:Number(k.pr||0),
    _ru:Number.isFinite(Number(k._ru))?Number(k._ru):normAngle(Number(k.r||0))
  };
}
function unwrapElasticBakeAngles(points){
  if(!points.length)return points;
  let prev=Number(points[0].r||0),offset=0;points[0]._ru=prev;
  for(let i=1;i<points.length;i++){
    let r=Number(points[i].r||0),d=r-prev;
    if(d>180)offset-=360;else if(d<-180)offset+=360;
    points[i]._ru=r+offset;prev=r;
  }
  return points;
}
function elasticBakeValue(p,key){return key==='r'?Number(p._ru||0):Number(p[key]||0);}
function elasticBakeChannelSpan(points,a,b,key){
  let mn=Infinity,mx=-Infinity;
  for(let i=a;i<=b;i++){const v=elasticBakeValue(points[i],key);if(v<mn)mn=v;if(v>mx)mx=v;}
  return Math.max(0,mx-mn);
}
function fitElasticScalarHermite(points,a,b,key){
  const p0=elasticBakeValue(points[a],key),p1=elasticBakeValue(points[b],key);
  const dt=Math.max(.000001,points[b].t-points[a].t),sec=(p1-p0)/dt;
  if(b<=a+1)return{out:sec,in:sec};
  let s00=0,s01=0,s11=0,r0=0,r1=0,used=0;
  for(let i=a+1;i<b;i++){
    const u=clamp((points[i].t-points[a].t)/dt,0,1),u2=u*u,u3=u2*u;
    const h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
    const A0=h10*dt,A1=h11*dt;
    const target=elasticBakeValue(points[i],key)-(h00*p0+h01*p1);
    s00+=A0*A0;s01+=A0*A1;s11+=A1*A1;r0+=A0*target;r1+=A1*target;used++;
  }
  const det=s00*s11-s01*s01;
  let m0=sec,m1=sec;
  if(used&&Math.abs(det)>1e-12){m0=(r0*s11-r1*s01)/det;m1=(s00*r1-s01*r0)/det;}
  // Least-squares cubic fits can explode on almost-flat data. Clamp to a generous local velocity range.
  const span=elasticBakeChannelSpan(points,a,b,key);
  const maxSlope=Math.max(Math.abs(sec)*10,span/dt*10, key==='r'?360:10);
  m0=clamp(m0,-maxSlope,maxSlope);m1=clamp(m1,-maxSlope,maxSlope);
  return{out:m0,in:m1};
}
function fitElasticHermiteSegment(points,a,b){
  const out={},inn={};
  for(const key of ['x','y','r','len']){
    const m=fitElasticScalarHermite(points,a,b,key);
    out[key]=Number(m.out||0);inn[key]=Number(m.in||0);
  }
  return{a,b,out,inn};
}
function elasticHermiteEvalSegment(points,seg,t){
  const a=points[seg.a],b=points[seg.b];
  const dt=Math.max(.000001,b.t-a.t),u=clamp((t-a.t)/dt,0,1);
  return{
    t,
    x:hermiteValue(Number(a.x||0),Number(b.x||0),Number(seg.out.x||0),Number(seg.inn.x||0),dt,u),
    y:hermiteValue(Number(a.y||0),Number(b.y||0),Number(seg.out.y||0),Number(seg.inn.y||0),dt,u),
    _ru:hermiteValue(Number(a._ru||0),Number(b._ru||0),Number(seg.out.r||0),Number(seg.inn.r||0),dt,u),
    len:Math.max(4,hermiteValue(Number(a.len||80),Number(b.len||80),Number(seg.out.len||0),Number(seg.inn.len||0),dt,u))
  };
}
function elasticApproxWorldFromLocal(raw,q){
  const pr=Number(raw.pr||0),a=rad(pr);
  let sx=Number(raw.sx||0),sy=Number(raw.sy||0);
  if(!raw.connected){
    const dx=Number(q.x||0)-Number(raw.x||0),dy=Number(q.y||0)-Number(raw.y||0);
    sx+=dx*Math.cos(a)-dy*Math.sin(a);
    sy+=dx*Math.sin(a)+dy*Math.cos(a);
  }
  const wr=rad(pr+Number(q._ru||0));
  const len=Math.max(4,Number(q.len||80));
  return{sx,sy,ex:sx+Math.cos(wr)*len,ey:sy+Math.sin(wr)*len};
}
function elasticBakeVisualErrorForPoint(points,seg,index){
  const p=points[index],q=elasticHermiteEvalSegment(points,seg,p.t),w=elasticApproxWorldFromLocal(p,q);
  const startErr=p.connected?0:Math.hypot(Number(p.sx||0)-w.sx,Number(p.sy||0)-w.sy);
  const endErr=Math.hypot(Number(p.ex||0)-w.ex,Number(p.ey||0)-w.ey);
  return Math.max(startErr,endErr);
}
function elasticSegmentMaxError(points,seg){
  let best=-1,bestErr=0;
  for(let i=seg.a+1;i<seg.b;i++){
    const err=elasticBakeVisualErrorForPoint(points,seg,i);
    if(err>bestErr){bestErr=err;best=i;}
  }
  return{index:best,error:bestErr};
}
function polishElasticFitSegments(points,segments,settings){
  let changed=true,guard=0;
  while(changed&&guard++<24){
    changed=false;
    for(let i=0;i<segments.length-1;i++){
      const a=segments[i].a,b=segments[i+1].b;
      if(points[b].t-points[a].t>settings.maxInterval)continue;
      const merged=fitElasticHermiteSegment(points,a,b);
      const e=elasticSegmentMaxError(points,merged);
      if(e.error<=settings.visualTol*.9){segments.splice(i,2,merged);changed=true;break;}
    }
  }
  return segments;
}
function makeElasticBakeKeyFromPoint(p){
  return{
    t:roundBakeTime(p.t),x:Number(p.x||0),y:Number(p.y||0),r:normAngle(Number(p._ru??p.r??0)),len:Math.max(4,Number(p.len||80)),sx:Number(p.lsx??1)||1,sy:Number(p.lsy??1)||1,
    curve:makeDefaultCurve('hermite'),
    outTangent:{x:0,y:0,r:0,len:0,sx:0,sy:0},
    inTangent:{x:0,y:0,r:0,len:0,sx:0,sy:0}
  };
}
function keysFromElasticFitSegments(points,segments){
  const map=new Map();
  const keyFor=(idx)=>{let k=map.get(idx);if(!k){k=makeElasticBakeKeyFromPoint(points[idx]);map.set(idx,k);}return k;};
  for(const seg of segments){
    const ka=keyFor(seg.a),kb=keyFor(seg.b);
    ka.curve=makeDefaultCurve('hermite');kb.curve=makeDefaultCurve('hermite');
    ka.outTangent={x:Number(seg.out.x||0),y:Number(seg.out.y||0),r:Number(seg.out.r||0),len:Number(seg.out.len||0),sx:0,sy:0};
    kb.inTangent={x:Number(seg.inn.x||0),y:Number(seg.inn.y||0),r:Number(seg.inn.r||0),len:Number(seg.inn.len||0),sx:0,sy:0};
  }
  const idx=[...map.keys()].sort((a,b)=>a-b);
  // End keys need safe tangents too, because users may move/copy segments later.
  for(const i of idx){const k=map.get(i);if(!k.inTangent)k.inTangent={...k.outTangent};if(!k.outTangent)k.outTangent={...k.inTangent};}
  return idx.map(i=>map.get(i));
}
function simplifyElasticBakeKeys(points,settings=elasticBakeSettings()){
  points=(points||[]).filter(Boolean).map(cloneElasticBakePoint);
  if(points.length<=2){
    unwrapElasticBakeAngles(points);
    const seg=fitElasticHermiteSegment(points,0,Math.max(0,points.length-1));
    return keysFromElasticFitSegments(points,[seg]);
  }
  unwrapElasticBakeAngles(points);
  const segments=[];
  const stack=[[0,points.length-1,0]];
  while(stack.length){
    const [a,b,depth]=stack.pop();
    if(b<=a+1){segments.push(fitElasticHermiteSegment(points,a,b));continue;}
    const seg=fitElasticHermiteSegment(points,a,b),e=elasticSegmentMaxError(points,seg),duration=points[b].t-points[a].t;
    if((e.error<=settings.visualTol&&duration<=settings.maxInterval)||depth>28){segments.push(seg);continue;}
    let split=e.index;
    if(split<=a||split>=b)split=Math.floor((a+b)/2);
    // Avoid pathological one-sample recursion when maxInterval is the only reason to split.
    split=clamp(split,a+1,b-1);
    stack.push([split,b,depth+1],[a,split,depth+1]);
  }
  segments.sort((x,y)=>x.a-y.a);
  polishElasticFitSegments(points,segments,settings);
  const keys=keysFromElasticFitSegments(points,segments);
  for(const k of keys)k.curve=makeDefaultCurve('hermite');
  return keys;
}
function bakeElasticToKeys({selectedOnly=false}={}){
  const targets=elasticEnabledBones(selectedOnly);if(!targets.length){if(typeof alert==='function')alert('No elastic bones to bake. Enable Elastic on a bone first.');return false;}
  const ids=new Set(targets.map(b=>b.id));const settings=elasticBakeSettings();const oldTime=state.currentTime;pushUndo();
  const fps=Math.max(1,Number(state.anim.fps||24));const dur=Math.max(.001,Number(state.anim.duration||1));const sampleHz=Math.max(ELASTIC_BAKE_SAMPLE_FPS,fps*2);const frames=Math.max(1,Math.round(dur*sampleHz));
  const originalTracks=cloneJson(state.anim.boneTracks||{});
  const baked={};for(const id of ids)baked[id]=[];
  const bakeHz=Math.max(ELASTIC_BAKE_SIM_FPS,sampleHz*2);const bakeStep=1/bakeHz;
  let simTime=0;

  // Smart Bake 3: sample the original live elastic simulation, then fit cubic Hermite segments.
  // The reducer measures visual error of each bone tip and stores broken in/out tangents.
  state.anim.boneTracks=cloneJson(originalTracks);
  applyAnimationPose(0);resetElasticSimulation();state.selectedKeys=[];
  for(const id of ids)baked[id].push(makeElasticBakeSample(id,0));

  for(let i=1;i<=frames;i++){
    const outTime=Math.min(dur,i/sampleHz);
    while(simTime<outTime-.000001){
      const dt=Math.min(bakeStep,outTime-simTime);simTime+=dt;
      applyAnimationPose(simTime);stepElasticBones(dt,{force:true});
    }
    for(const id of ids)baked[id].push(makeElasticBakeSample(id,outTime));
  }

  state.anim.boneTracks=cloneJson(originalTracks);
  let rawCount=0,smartCount=0;
  for(const id of ids){
    const raw=(baked[id]||[]).filter(Boolean);rawCount+=raw.length;
    const keys=simplifyElasticBakeKeys(raw,settings);smartCount+=keys.length;
    state.anim.boneTracks[id]=keys;
    mergeDuplicateKeysOnTrack('bone',id);
    const b=bone(id);if(b?.elastic)b.elastic.enabled=false;
    for(const k of state.anim.boneTracks[id]||[])state.selectedKeys.push(keyRef('bone',id,k.t));
  }
  cleanSelectedKeys();applyAnimationPose(oldTime);resetElasticSimulation();state.currentTime=oldTime;changed();renderTimeline();renderInspector();renderAll();
  console.info(`Elastic Smart Bake 3: ${rawCount} samples -> ${smartCount} Hermite keys, error ${settings.visualTol}px, max segment ${settings.maxInterval}s`);
  return true;
}
function bakeSelectedElasticToKeys(){return bakeElasticToKeys({selectedOnly:true});}
function bakeAllElasticToKeys(){return bakeElasticToKeys({selectedOnly:false});}
function applyElasticToSelectedChain(preset='Tail'){
  const ids=selectedBoneSet();if(!ids.size)return false;pushUndo();let count=0;
  for(const b of state.bones){if(ids.has(b.id)&&!isProjectRootBone(b)){if(setElasticPreset(b,preset))count++;}}
  if(!count){state.undo.pop();return false;}resetElasticSimulation();changed();renderAll();return true;
}
