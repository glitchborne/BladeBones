'use strict';
// Numeric helpers and small formatting utilities.
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function rad(d){return d*Math.PI/180;}
function deg(r){return r*180/Math.PI;}
function normAngle(a){return ((a+180)%360+360)%360-180;}
function lerpAngle(a,b,t){return normAngle(a+normAngle(b-a)*t);}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function copyTr(t){return{x:Number(t?.x||0),y:Number(t?.y||0),r:normAngle(Number(t?.r||0)),len:Math.max(4,Number(t?.len||80)),sx:Number(t?.sx??1)||1,sy:Number(t?.sy??1)||1};}
function normalizeHex(value,fallback='#ffffff'){
  let s=String(value||fallback).trim();
  if(!s.startsWith('#'))s='#'+s;
  if(/^#[0-9a-f]{3}$/i.test(s))s='#'+s.slice(1).split('').map(ch=>ch+ch).join('');
  return /^#[0-9a-f]{6}$/i.test(s)?s.toLowerCase():fallback;
}
function hexToRgb(value){const h=normalizeHex(value).slice(1);return{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)};}
function rgbToHex({r,g,b}){const c=v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0');return '#'+c(r)+c(g)+c(b);}
function lerpColor(a,b,t){const ca=hexToRgb(a),cb=hexToRgb(b);return rgbToHex({r:lerp(ca.r,cb.r,t),g:lerp(ca.g,cb.g,t),b:lerp(ca.b,cb.b,t)});}
function mixColor(base,tint,amount){return lerpColor(normalizeHex(base,'#888888'),normalizeHex(tint,'#ffffff'),clamp(Number(amount||0),0,1));}
function copySlotPose(s){return{visible:!!s.visible,alpha:clamp(Number(s.alpha??1),0,1),attachment:s.attachment||null,tint:normalizeHex(s.tint||s.color||'#ffffff'),tintAlpha:clamp(Number(s.tintAlpha??0),0,1),blendMode:s.blendMode||'normal'};}
// Image pixels use a top-left / Y-down axis, while BladeBones local space is Y-up.
function imageTextureToLocalTransform(att){
  const w=Math.max(0,Number(att?.w||0)),h=Math.max(0,Number(att?.h||0));
  const pivotX=Number(att?.pivotX??.5),pivotY=Number(att?.pivotY??.5);
  return{a:1,b:0,c:0,d:-1,e:-pivotX*w,f:(1-pivotY)*h};
}
function imageUVToSourcePoint(uv,att){
  const w=Math.max(0,Number(att?.w||0)),h=Math.max(0,Number(att?.h||0));
  return{x:Number(uv?.u||0)*w,y:(1-Number(uv?.v||0))*h};
}
function htm(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
