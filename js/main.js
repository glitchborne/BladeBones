'use strict';
// Application bootstrap and frame loop.
function advancePlayback(dt){const range=playbackRange();let t=state.currentTime+dt;if(state.timeline.useRange&&state.currentTime<range.start)t=range.start;if(state.loop){if(state.timeline.useRange){while(t>range.end)t=range.start+(t-range.end);while(t<range.start)t=range.end-(range.start-t);}else t=normalizeAnimationTime(t,true);}else{const end=state.timeline.useRange?range.end:state.anim.duration;if(t>=end){t=end;state.playing=false;$('#play').textContent='Play';}}evaluate(t,false,false);}
function frame(now){const dt=Math.min(.05,(now-state.lastNow)/1000);state.lastNow=now;if(state.playing){advancePlayback(dt);if(typeof stepElasticBones==='function')stepElasticBones(dt);if(typeof updateTimelinePlayhead==='function')updateTimelinePlayhead();else renderTimeline();}draw();requestAnimationFrame(frame);}
if(typeof initLayout==='function')initLayout();
wireNewProjectButtons?.();
refreshDocumentChrome?.();
syncWorkflowControls?.();
setTool('select');
exportJson(true);
exportRuntimeJson?.(true);
syncTime();
renderAll();
requestAnimationFrame(frame);
