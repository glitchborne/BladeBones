'use strict';
// Left/right panel rendering, scene outliner and tabbed inspectors.

function currentOutlinerTab(){
  const tab=state.outliner?.tab||'scene';
  return ['scene','rig','draw'].includes(tab)?tab:'scene';
}
function setOutlinerTab(tab){
  state.outliner.tab=['scene','rig','draw'].includes(tab)?tab:'scene';
  renderOutlinerTabs();
}
function renderOutlinerTabs(){
  const tab=currentOutlinerTab();
  const pairs=[['scene','#outlinerTabScene','.outliner-scene-box'],['rig','#outlinerTabRig','.outliner-rig-box'],['draw','#outlinerTabDraw','.outliner-draw-box']];
  for(const [key,btnSel,boxSel] of pairs){
    const btn=$(btnSel),box=$(boxSel);
    if(btn)btn.classList.toggle('on',tab===key);
    if(box)box.classList.toggle('active',tab===key);
  }
}

function objectHasKeys(kind,id){
  if(kind==='bone')return !!(state.anim.boneTracks||{})[id]?.length;
  if(kind==='slot')return !!(state.anim.slotTracks||{})[id]?.length;
  if(kind==='object'){const o=rigObject(id);return !!(o&&state.anim.boneTracks?.[o.root]?.length);}
  return false;
}
function selectedBoneSet(){
  const exact=typeof selectedBoneIds==='function'?selectedBoneIds({exact:true}):[];
  if(exact.length>1)return new Set(exact);
  const root=selectedBone();if(!root)return new Set();
  const ids=new Set([root.id]);let changed=true;
  while(changed){changed=false;for(const b of state.bones){if(b.parent&&ids.has(b.parent)&&!ids.has(b.id)){ids.add(b.id);changed=true;}}}
  return ids;
}
function selectedBoneExactSet(){return new Set((typeof selectedBoneIds==='function'?selectedBoneIds({exact:true}):[]));}
function parentSlots(bid){return state.slots.filter(s=>s.bone===bid);}
function parentMarkers(bid){return state.markers.filter(m=>m.bone===bid);}
function outlinerMatch(text){const q=(state.outliner.query||'').trim().toLowerCase();return !q||String(text||'').toLowerCase().includes(q);}
function outlinerBoneRoleVisible(b){
  const f=state.outliner?.roleFilter||'all';
  if(f==='all')return true;
  if(f==='weighted')return state.slots.some(s=>slotInfluenceBoneIds(s).includes(b.id)||slotParentBoneId(s)===b.id);
  return inferBoneRole(b)===f;
}
function boneConnectionMeta(b){
  if(!b||isProjectRootBone(b))return 'locked root';
  const role=boneRoleLabel(b);
  const conn=isObjectRootBone(b)?'object root':(isConnectedBone(b)?'connected':'free');
  const locks=[];if(b.lockMove)locks.push('M');if(b.lockRotate)locks.push('R');if(b.lockScale)locks.push('S');if(b.lockLength)locks.push('L');
  return role+' · '+conn+(locks.length?' · lock '+locks.join(''):'');
}
function outlinerRow({type,id,name,indent=0,meta='',muted=false,icon=null,onClick=null,selected=false}){
  const div=document.createElement('div');
  const multi=type==='bone'&&typeof isBoneSelected==='function'&&isBoneSelected(id);
  const active=state.selected.type===type&&state.selected.id===id;
  const on=selected||active||multi;
  div.className='tree-row '+type+(on?' on':'')+(multi&&!active?' multi':'')+(muted?' muted':'');
  div.style.paddingLeft=(8+indent*14)+'px';
  const keyed=objectHasKeys(type,id)?'<span class="tree-badge keyed">K</span>':'';
  const multiBadge=multi?'<span class="tree-badge multi-badge '+(active?'active':'')+'">'+(active?'ACTIVE':'SEL')+'</span>':'';
  const ic=icon||(type==='object'?'O':type==='bone'?(isProjectRootBone(bone(id))?'R':(isObjectRootBone(bone(id))?'O':({deform:'B',control:'C',socket:'S',root:'O'}[inferBoneRole(bone(id))]||'B'))):type==='slot'?'S':type==='marker'?'M':'•');
  const icHtml=typeof iconForToken==='function'?iconForToken(ic,type,'tree-svg'):htm(ic);
  div.innerHTML='<span class="tree-icon">'+icHtml+'</span><span class="tree-name">'+htm(name)+'</span><span class="tree-meta">'+multiBadge+keyed+htm(meta)+'</span>';
  div.onclick=ev=>{
    if(onClick){onClick(ev);return;}
    if(type==='bone')select('bone',id,{append:ev.shiftKey,toggle:ev.ctrlKey||ev.metaKey});
    else select(type,id);
  };
  return div;
}
function childObjectsForSlot(slotId){return state.objects.filter(o=>o.parentSlot===slotId);}
function childObjectsForObject(objectId){
  const owned=new Set(slotsForObject(objectId).map(s=>s.id));
  return state.objects.filter(o=>o.parentSlot&&owned.has(o.parentSlot));
}
function slotOwnsObjectLabel(slotId){
  const kids=childObjectsForSlot(slotId);
  return kids.length?kids.map(o=>o.name).join(', '):'';
}
function activeObjectSlots(){
  const active=state.activeObjectId;
  return active?state.slots.filter(s=>(s.objectId===active||objectOfSlotId(s.id)===active)):[];
}
function dominantBoneForSlot(s){
  if(!s)return null;
  if(slotParentBoneId(s))return slotParentBoneId(s);
  const m=s.mesh;if(!m||!Array.isArray(m.vertices))return null;
  const scores=new Map();
  for(const v of m.vertices){
    for(const w of (v.weights||[])){
      const bid=w?.bone||w?.boneId;if(!bid||!bone(bid))continue;
      scores.set(bid,(scores.get(bid)||0)+Number(w.w??w.weight??0));
    }
  }
  let best=null,bestScore=0;
  for(const [bid,score] of scores){if(score>bestScore){best=bid;bestScore=score;}}
  return best;
}
function bonesForSlotObject(s){
  const oid=s?objectOfSlotId(s.id):state.activeObjectId;
  return state.bones.filter(b=>!isProjectRootBone(b)&&(!oid||objectOfBoneId(b.id)===oid));
}
function slotInfluenceNames(s,max=3){
  const ids=slotInfluenceBoneIds(s);
  const names=ids.slice(0,max).map(id=>bone(id)?.name||id);
  return names.join(', ')+(ids.length>max?' +'+(ids.length-max):'');
}
function slotStatusMeta(s,{draw=false}={}){
  const st=slotBindingStatus(s);
  const parent=slotParentBoneId(s);
  const parentName=parent?(bone(parent)?.name||parent):'no parent';
  const infl=slotInfluenceNames(s);
  const nested=slotOwnsObjectLabel(s.id);
  const grid=slotMeshGridSize(s);
  const m=ensureSlotMesh(s);
  const warn=st.severity==='ok'?'':'! ';
  const parts=[];
  if(draw){parts.push('parent: '+parentName);parts.push(st.label);parts.push(m?.enabled?('mesh '+grid.cols+'×'+grid.rows):'rigid sprite');}
  else {parts.push(warn+st.label);parts.push('parent: '+parentName);}
  if(infl&&st.kind!=='rigid'&&st.kind!=='rigidMesh')parts.push('weights: '+infl);
  if(nested)parts.push('child: '+nested);
  return parts.filter(Boolean).join(' · ');
}
function slotBindingIssuesHtml(s){
  const issues=slotBindingIssues(s);
  if(!issues.length)return '<div class="binding-issues ok">✓ Binding looks good.</div>';
  return '<div class="binding-issues">'+issues.map(it=>'<div class="binding-issue '+htm(it.severity||'warn')+'"><b>'+htm((it.code||'issue').replace(/-/g,' '))+'</b><span>'+htm(it.message)+'</span></div>').join('')+'</div>';
}
function slotBindingSummaryHtml(s){
  const st=slotBindingStatus(s);const parent=slotParentBoneId(s);const m=ensureSlotMesh(s);const grid=slotMeshGridSize(s);
  const inf=slotInfluenceBoneIds(s);const infText=inf.length?inf.map(id=>htm(bone(id)?.name||id)).join(', '):'none';
  const statusClass=st.severity==='ok'?'status-ok':'status-warn';
  const parentText=parent?htm(bone(parent)?.name||parent):'<span class="warn-text">none</span>';
  const meshMode=m?.enabled?'mesh render ON':'mesh render OFF';
  const unweighted=meshUnweightedVertexIndices(s).length;
  return `<div class="binding-summary">
    <div class="summary-line"><span>Status</span><b class="status-pill ${statusClass}">${htm(st.label)}</b></div>
    <div class="summary-line"><span>Parent bone</span><b>${parentText}</b></div>
    <div class="summary-line"><span>Mesh</span><b>${htm(meshMode)} · ${grid.cols}×${grid.rows} · ${m?.vertices?.length||0} verts</b></div>
    <div class="summary-line"><span>Weights</span><b>${infText}${unweighted&&m?.enabled?' · '+unweighted+' unweighted':''}</b></div>
    <p class="note">${htm(st.detail)}</p>
    ${slotBindingIssuesHtml(s)}
  </div>`;
}


function meshDiagnosticsPanelHtml(s){
  const d=typeof meshDiagnosticsForSlot==='function'?meshDiagnosticsForSlot(s):{ok:true,issues:[],counts:{},deformMismatches:[]};
  const c=d.counts||{};const issueRows=(d.issues||[]).slice(0,7).map(it=>`<div class="diag-row ${htm(it.severity||'warn')}"><b>${htm((it.code||'issue').replace(/-/g,' '))}</b><span>${htm(it.message||'')}</span></div>`).join('');
  const more=(d.issues||[]).length>7?`<div class="diag-row info"><b>more</b><span>${(d.issues||[]).length-7} more issue(s)</span></div>`:'';
  const test=typeof testPoseHealthSummary==='function'?testPoseHealthSummary(s.id):{active:false,bones:0,affectedSlots:0,unweightedVertices:0};
  return `<div class="mesh-diagnostics ${d.ok?'ok':'warn'}">
    <div class="mesh-subpanel-title">Deformation diagnostics <span class="status-pill ${d.ok?'status-ok':'status-warn'}">${d.ok?'clean':'needs work'}</span></div>
    <div class="diag-metrics"><span>${c.verts||0} verts</span><span>${c.unweighted||0} unweighted</span><span>${c.tooMany||0} too many inf.</span><span>${c.missingBind||0} missing bind</span><span>${c.deformMismatches||0} deform mismatch</span></div>
    ${issueRows||'<div class="binding-issues ok">✓ Mesh weights/deform data look good.</div>'}${more}
    <div class="summary-line"><span>Test Pose health</span><b>${test.active?`${test.bones} moved bone(s) · ${test.affectedSlots} affected slot(s)`: 'inactive'} · ${test.unweightedVertices||0} unweighted</b></div>
    <label><input id="wbDiagShowOverlay" type="checkbox" ${state.meshEdit.showDiagnostics!==false?'checked':''}> show viewport warnings</label>
    <div class="inline"><button id="wbDiagFixUnweighted" ${(c.unweighted||0)?'':'disabled'}>Auto-weight unweighted</button><button id="wbDiagPrune" ${(c.tooMany||c.badBone||c.overweight)?'':'disabled'}>Prune / clean influences</button><button id="wbDiagRebind" ${(c.missingBind||0)?'':'disabled'}>Rebuild bind coords</button><button id="wbDiagFixDeform" ${(c.deformMismatches||0)?'':'disabled'}>Fix deform offsets</button><button id="wbDiagFixAll" ${d.ok?'disabled':''}>Fix all safe</button></div>
    <p class="note">Viewport overlay: red = unweighted, orange = too many influences, pink = missing bone, yellow = missing bind coordinates, purple = overweight.</p>
  </div>`;
}

function bindingWorkflowStepHtml({n,title,state='todo',detail='',actions=''}){
  const label={done:'Done',warn:'Needs work',todo:'Next',off:'Optional'}[state]||state;
  return `<div class="binding-step ${htm(state)}"><div class="binding-step-num">${n}</div><div class="binding-step-body"><div class="binding-step-title"><b>${htm(title)}</b><span>${htm(label)}</span></div><p>${detail}</p>${actions?'<div class="inline">'+actions+'</div>':''}</div></div>`;
}
function slotBindingWorkflowHtml(s,{bindBone=null,weightBone=null,parent=null,parentName='none',selectedBoneOk=false}={}){
  const m=ensureSlotMesh(s);const grid=slotMeshGridSize(s);const st=slotBindingStatus(s);
  const hasParent=!!parent;const meshActive=!!m?.enabled;const hasTopology=!!(m?.vertices?.length>=3&&(m.triangles||[]).length);
  const influences=slotInfluenceBoneIds(s);const unweighted=meshUnweightedVertexIndices(s);const candidates=typeof allMeshCandidateBoneIds==='function'?allMeshCandidateBoneIds(s.id):[];
  const selectedName=bindBone?htm(bindBone.name):'none';const weightName=weightBone?htm(weightBone.name):'none';
  const parentStep=hasParent?'done':'warn';
  const meshStep=meshActive&&hasTopology?'done':(hasParent?'todo':'off');
  const weightStep=!meshActive?'off':(influences.length&&unweighted.length===0?'done':(influences.length?'warn':'todo'));
  const testStep=st.severity==='ok'?'done':(meshActive?'warn':(hasParent?'done':'todo'));
  const parentActions=`<button id="wbFlowParentSelected" ${bindBone?'':'disabled'}>Use selected</button><button id="wbFlowParentNearest">Nearest</button>`;
  const meshActions=`<button id="wbFlowMesh33">Create 3×3 mesh</button><button id="wbFlowMesh44">Create 4×4 mesh</button><button id="wbFlowGoMesh">Open Mesh</button>`;
  const weightActions=`<button id="wbFlowAutoObject" ${candidates.length?'':'disabled'}>Auto object bones</button><button id="wbFlowAutoParent" ${hasParent?'':'disabled'}>Parent chain</button><button id="wbFlowGoWeights">Open Weights</button>`;
  const testActions=`<button id="wbFlowSelectParent" ${hasParent?'':'disabled'}>Select parent</button><button id="wbFlowSelectWeight" ${weightBone?'':'disabled'}>Select active bone</button><button id="wbFlowExitMesh">Exit mesh edit</button>`;
  return `<div class="binding-flow">
    <div class="binding-flow-head"><div><div class="mesh-subpanel-title inline-title">Guided binding workflow</div><p class="note">Use this when turning artwork into a controllable rigged slot: parent it, create topology, bind weights, then test by moving bones.</p></div><div class="binding-flow-actions"><button id="wbFlowQuickRigid" ${hasParent||bindBone?'':'disabled'}>Quick rigid</button><button id="wbFlowQuickSetup">Quick mesh setup</button></div></div>
    <div class="binding-step-grid">
      ${bindingWorkflowStepHtml({n:1,title:'Parent slot',state:parentStep,detail:`Current parent: <b>${htm(parentName)}</b>. Selected/last bone: <b>${selectedName}</b>.`,actions:parentActions})}
      ${bindingWorkflowStepHtml({n:2,title:'Create mesh topology',state:meshStep,detail:`Mesh render is <b>${meshActive?'ON':'OFF'}</b>. Topology: ${grid.cols}×${grid.rows}, ${m?.vertices?.length||0} verts, ${(m?.triangles||[]).length} triangles.`,actions:meshActions})}
      ${bindingWorkflowStepHtml({n:3,title:'Bind / auto-weight',state:weightStep,detail:`Active weight bone: <b>${weightName}</b>. Influences: ${influences.length||0}. ${unweighted.length?'<b>'+unweighted.length+' unweighted verts</b>.':'All vertices have weights.'}`,actions:weightActions})}
      ${bindingWorkflowStepHtml({n:4,title:'Test deformation',state:testStep,detail:`Status: <b>${htm(st.label)}</b>. Move a parent/influence bone in Rigging to check deformation before animating.`,actions:testActions})}
    </div>
  </div>`;
}
function meshDeformSummary(s){
  const m=ensureSlotMesh(s);if(!m||!m.vertices?.length)return 'No mesh vertices.';const sel=meshSelectedIndices(s);const list=sel.length?sel:m.vertices.map((_,i)=>i);const offsets=cloneSlotDeformOffsets(s);
  return list.slice(0,32).map(i=>{const o=offsets[i]||{x:0,y:0};const active=Math.abs(o.x)>0.001||Math.abs(o.y)>0.001;return '<span class="mesh-vrow '+(active?'active':'')+'">v'+i+': dx '+Number(o.x||0).toFixed(1)+' · dy '+Number(o.y||0).toFixed(1)+'</span>';}).join('<br>')+(list.length>32?'<br>…':'');
}

function selectedMeshInfluencesHtml(s){
  const m=ensureSlotMesh(s);if(!m||!m.vertices?.length)return '<div class="mesh-influence-summary empty">No mesh vertices.</div>';
  const sel=meshSelectedIndices(s);const list=sel.length?sel:m.vertices.map((_,i)=>i);const totals=new Map();let unweighted=0;
  for(const i of list){const v=m.vertices[i];if(!v)continue;const weights=v.weights||[];if(!weights.length){unweighted++;continue;}for(const w of weights){const bid=w.bone;if(!bid)continue;totals.set(bid,(totals.get(bid)||0)+Number(w.w||0));}}
  const denom=Math.max(1,list.length);const rows=[...totals.entries()].sort((a,b)=>b[1]-a[1]).map(([bid,sum])=>{const pct=Math.round(sum/denom*100);return `<div class="influence-row"><span>${htm(bone(bid)?.name||bid)}</span><b>${pct}% avg</b></div>`;}).join('');
  const head=`<div class="mesh-influence-summary"><div class="mesh-subpanel-title">Selected vertex influences</div><div class="note">${list.length} vertex/vertices${sel.length?' selected':' total'}${unweighted?' · <span class="warn-text">'+unweighted+' unweighted</span>':''}</div>`;
  return head+(rows||'<div class="empty small">No bone weights on these vertices.</div>')+'</div>';
}
function selectedBoneForBinding(s=null){
  const b=selectedBone()||bone(state.lastBoneId)||bone(state.meshEdit?.weightBoneId)||bone(s?.bone);
  return b&&!isProjectRootBone(b)?b:null;
}
function objectSceneBranchMatches(o){
  if(!o)return false;
  const q=(state.outliner.query||'').trim().toLowerCase();
  if(!q)return true;
  if(String(o.name||'').toLowerCase().includes(q))return true;
  const rb=bone(o.root);if(rb&&String(rb.name||'').toLowerCase().includes(q))return true;
  return childObjectsForObject(o.id).some(objectSceneBranchMatches);
}
function renderSceneObjectBranch(root,o,indent=1){
  if(!o||!objectSceneBranchMatches(o))return;
  const rb=bone(o.root);
  const parentName=o.parentSlot?(slot(o.parentSlot)?.name||o.parentSlot):'scene object';
  const passName=state.documentType==='toon'?(renderLayerById(o.renderLayerId||defaultRenderLayerId())?.name||'pass'):'object';
  root.appendChild(outlinerRow({
    type:'object',id:o.id,name:o.name,indent,
    meta:(o.parentSlot?('in '+parentName):'scene object')+(state.documentType==='toon'?' · pass: '+passName:''),icon:'O',
    selected:state.activeObjectId===o.id,
    onClick:()=>{setActiveObject(o.id);select('bone',o.root);}
  }));
  for(const child of childObjectsForObject(o.id))renderSceneObjectBranch(root,child,indent+1);
}
function renderSceneOutliner(){
  const root=$('#sceneOutliner');if(!root)return;root.innerHTML='';
  if(!state.bones.length&&!state.slots.length&&!state.markers.length&&!state.objects.length){root.innerHTML='<div class="empty">No scene objects yet</div>';return;}
  const pr=projectRoot();
  if(pr)root.appendChild(outlinerRow({type:'bone',id:pr.id,name:'Scene Root',indent:0,meta:'locked',icon:'R',onClick:()=>select('bone',pr.id)}));
  const topObjects=state.objects.filter(o=>!o.parentSlot||!slot(o.parentSlot));
  for(const o of topObjects)renderSceneObjectBranch(root,o,1);
  if(state.outliner.showUnbound!==false){
    const unbound=state.slots.filter(s=>!s.objectId&&!objectOfSlotId(s.id));
    if(unbound.length){const group=document.createElement('div');group.className='tree-group';group.textContent='Scene-level Artwork';root.appendChild(group);for(const s of unbound){const a=attachment(s.pose.attachment);if(outlinerMatch(s.name)||outlinerMatch(a?.name))root.appendChild(outlinerRow({type:'slot',id:s.id,name:s.name,indent:1,meta:a?.name||'world'}));}}
  }
}
function renderRigBoneBranch(root,b,indent,shownSlots){
  if(!b)return;
  const visible=state.outliner.showBones!==false&&outlinerBoneRoleVisible(b)&&(outlinerMatch(b.name)||children(b.id).some(ch=>objectOfBoneId(ch.id)===state.activeObjectId));
  if(visible)root.appendChild(outlinerRow({type:'bone',id:b.id,name:b.name,indent,meta:(isElasticBone(b)?'E · ':'')+boneConnectionMeta(b)+' · '+Math.round(b.local.len)}));
  const childIndent=indent+1;
  if(state.outliner.showSlots!==false){
    for(const s of activeObjectSlots()){
      const dominant=dominantBoneForSlot(s);
      if(dominant!==b.id)continue;
      const a=attachment(s.pose.attachment);
      const nested=slotOwnsObjectLabel(s.id);
      if(outlinerMatch(s.name)||outlinerMatch(a?.name)||outlinerMatch(b.name)||outlinerMatch(nested)){
        shownSlots.add(s.id);
        root.appendChild(outlinerRow({type:'slot',id:s.id,name:s.name,indent:childIndent,meta:(a?.name||'-')+' · '+slotStatusMeta(s),muted:!s.pose.visible}));
      }
    }
  }
  if(state.outliner.showMarkers!==false){
    for(const m of parentMarkers(b.id)){if(outlinerMatch(m.name)||outlinerMatch(b.name))root.appendChild(outlinerRow({type:'marker',id:m.id,name:m.name,indent:childIndent,meta:m.type,muted:!m.visible}));}
  }
  for(const ch of children(b.id)){
    if(objectOfBoneId(ch.id)!==state.activeObjectId)continue;
    if(objectForRootBone(ch.id)&&ch.id!==activeRigObject()?.root)continue;
    renderRigBoneBranch(root,ch,childIndent,shownSlots);
  }
}
function renderObjectRigTree(){
  const root=$('#objectRigTree');if(!root)return;root.innerHTML='';
  const o=activeRigObject();if(!o){root.innerHTML='<div class="empty">No active object. Click New object.</div>';return;}
  const rb=bone(o.root);if(!rb){root.innerHTML='<div class="empty">Active object has no root bone.</div>';return;}
  const title=document.createElement('div');title.className='tree-group';
  const selCount=(typeof selectedBoneIds==='function'?selectedBoneIds({exact:true}).filter(id=>objectOfBoneId(id)===o.id).length:0);
  title.textContent=o.name+(selCount>1?' · '+selCount+' bones selected':'');root.appendChild(title);
  const shownSlots=new Set();
  renderRigBoneBranch(root,rb,0,shownSlots);
  if(state.outliner.showSlots!==false){
    const loose=activeObjectSlots().filter(s=>!shownSlots.has(s.id));
    if(loose.length){
      const g=document.createElement('div');g.className='tree-group';g.textContent='Object slots / mesh artwork';root.appendChild(g);
      for(const s of loose){const a=attachment(s.pose.attachment);const nested=slotOwnsObjectLabel(s.id);if(outlinerMatch(s.name)||outlinerMatch(a?.name)||outlinerMatch(nested))root.appendChild(outlinerRow({type:'slot',id:s.id,name:s.name,indent:1,meta:(a?.name||'-')+' · '+slotStatusMeta(s),muted:!s.pose.visible}));}
    }
  }
}
function renderDrawOrderList(){
  const root=$('#drawOrderList');if(!root)return;root.innerHTML='';
  const o=activeRigObject();if(!o){root.innerHTML='<div class="empty">No active object</div>';return;}
  const slots=activeObjectSlots();
  if(!slots.length){root.innerHTML='<div class="empty">No slots in selected object</div>';return;}
  slots.forEach((s,i)=>{
    const a=attachment(s.pose.attachment);const m=s.mesh;const weighted=!!m?.vertices?.some(v=>v.weights?.length);const nested=slotOwnsObjectLabel(s.id);
    const div=outlinerRow({type:'slot',id:s.id,name:s.name,indent:0,meta:'#'+i+' · '+slotStatusMeta(s,{draw:true})+' · '+(a?.name||'no image')+(weighted?' · mesh':'')+(nested?' · ↳ '+nested:''),muted:!s.pose.visible});
    div.classList.add('draw-row');
    root.appendChild(div);
  });
}
function renderObjectList(){
  const root=$('#objectList');
  const objSel=$('#objectAttachSelect'),slotSel=$('#objectParentSlotSelect'),passSel=$('#objectRenderLayerSelect');
  if(objSel){objSel.innerHTML=state.objects.map(o=>'<option value="'+o.id+'" '+(state.activeObjectId===o.id?'selected':'')+'>'+htm(o.name)+'</option>').join('');}
  if(passSel){
    const active=activeRigObject();
    passSel.disabled=state.documentType!=='toon'||!active;
    passSel.innerHTML=state.documentType==='toon'?sortedRenderLayers().map(l=>'<option value="'+l.id+'" '+(((active?.renderLayerId||defaultRenderLayerId())===l.id)?'selected':'')+'>'+htm(l.name)+'</option>').join(''):'<option>GameDoc</option>';
  }
  if(slotSel){
    const active=activeRigObject();
    const opts=state.slots.filter(s=>!active||objectOfSlotId(s.id)!==active.id).map(s=>'<option value="'+s.id+'" '+(state.lastSlotId===s.id?'selected':'')+'>'+htm((rigObject(objectOfSlotId(s.id))?.name||'Scene')+' / '+s.name)+'</option>').join('');
    slotSel.innerHTML='<option value="">— scene root —</option>'+opts;
  }
  if(!root)return;root.innerHTML='';
  if(!state.objects.length){root.innerHTML='<div class="empty">No objects. Click New object.</div>';return;}
  for(const o of state.objects){
    const div=document.createElement('div');div.className='item'+(state.activeObjectId===o.id?' on':'')+(o.visible===false?' muted':'');
    const parent=o.parentSlot?('↳ '+(slot(o.parentSlot)?.name||o.parentSlot)):'scene';
    const pass=state.documentType==='toon'?(renderLayerById(o.renderLayerId||defaultRenderLayerId())?.name||'pass'):parent;
    div.innerHTML='<span>'+htm(o.name)+'</span><span>'+htm(parent)+(state.documentType==='toon'?' · '+htm(pass):'')+'</span>';
    div.onclick=()=>{setActiveObject(o.id);select('bone',o.root);};root.appendChild(div);
  }
}
function renderBoneList(){renderObjectRigTree();}
function renderSlotList(){renderDrawOrderList();}
function renderAttList(){const root=$('#attList');if(!root)return;root.innerHTML='';if(!state.attachments.length){root.innerHTML='<div class="empty">No attachments</div>';return;}for(const a of state.attachments){const div=document.createElement('div');div.className='item';let thumb='';if(a.type==='image')thumb='<img class="asset-thumb" src="'+a.src+'">';else thumb='<span class="swatch" style="background:'+a.color+'"></span>';div.innerHTML='<span>'+thumb+htm(a.name)+'</span><span>'+a.type+' · '+Math.round(a.w)+'×'+Math.round(a.h)+'</span>';div.onclick=()=>{const s=selectedSlot();pushUndo();if(s){s.attachment=a.id;s.pose.attachment=a.id;}else placeAttachmentOnStage(a.id,a.name);changed();renderAll();};root.appendChild(div);}}
function renderMarkerList(){const root=$('#markerList');if(!root)return;root.innerHTML='';if(!state.markers.length){root.innerHTML='<div class="empty">No markers</div>';return;}for(const m of state.markers){const div=document.createElement('div');div.className='item'+(state.selected.type==='marker'&&m.id===state.selected.id?' on':'')+(m.visible?'':' muted');div.innerHTML='<span>'+htm(m.name)+'</span><span>'+m.type+'</span>';div.onclick=()=>select('marker',m.id);root.appendChild(div);}}
function renderPoseList(){const root=$('#poseList');if(!root)return;root.innerHTML='';if(!state.poses.length){root.innerHTML='<div class="empty">No saved poses</div>';return;}const groups=new Map();for(const p of state.poses){const cat=p.category||'General';if(!groups.has(cat))groups.set(cat,[]);groups.get(cat).push(p);}for(const [cat,poses] of groups){const g=document.createElement('div');g.className='tree-group';g.textContent=cat;root.appendChild(g);for(const p of poses){const div=document.createElement('div');div.className='item pose-card';div.innerHTML='<span>'+htm(p.name)+'</span><span>'+Object.keys(p.bones||{}).length+' bones</span>';div.onclick=()=>{$('#poseName').value=p.name;if($('#poseCategory'))$('#poseCategory').value=p.category||'General';};root.appendChild(div);}}}
function renderEventList(){const root=$('#eventList');if(!root)return;root.innerHTML='';if(!state.anim.events.length)return;for(const ev of state.anim.events.sort((a,b)=>a.t-b.t)){const div=document.createElement('div');div.className='item';div.innerHTML='<span>'+htm(ev.name)+'</span><span>'+ev.t.toFixed(2)+'</span>';div.onclick=()=>setTime(ev.t,true);root.appendChild(div);}}

function inspectorTabsForType(type){
  const rig=state.mode!=='pose';
  if(type==='camera')return ['Camera','Data'];
  if(type==='slot')return rig?['Transform','Image','Data']:['Transform','Image','Animation','Deform','Data'];
  if(type==='marker')return ['Transform','Object','Data'];
  return rig?['Transform','Object','Rig','Elastic','Data']:['Transform','Animation','Data'];
}
function renderInspectorTabs(type){
  const tabs=$('#inspectorTabs');if(!tabs)return;const list=inspectorTabsForType(type);const normalized=list.map(x=>x.toLowerCase());if(!normalized.includes(state.inspectorTab))state.inspectorTab=normalized[0];tabs.innerHTML='';
  for(const label of list){const key=label.toLowerCase();const b=document.createElement('button');b.className='tab-button'+(state.inspectorTab===key?' on':'');b.textContent=label;b.onclick=()=>{state.inspectorTab=key;renderInspector();};tabs.appendChild(b);} 
}
function renderInspector(){const root=$('#inspector');if(!root)return;const type=state.selected.type||'bone';renderInspectorTabs(type);if(type==='camera')return renderCameraInspector(root);if(type==='slot')return renderSlotInspector(root);if(type==='marker')return renderMarkerInspector(root);return renderBoneInspector(root);}

function currentMeshWorkbenchTab(){
  const tab=state.meshEdit?.workbenchTab||'binding';
  return ['binding','mesh','weights'].includes(tab)?tab:'binding';
}
function setMeshWorkbenchTab(tab){
  tab=['mesh','weights'].includes(tab)?tab:'binding';
  if(state.meshEdit?.weightPaintSession?.active&&tab!=='weights'){renderMeshWorkbench();return;}
  state.meshEdit.workbenchTab=tab;
  if(tab==='mesh'){setMeshContext('vertices',true);return;}
  if(tab==='weights'){setMeshContext('weights',true);return;}
  if(state.meshEdit?.tool!=='deform')state.meshEdit.enabled=false;
  updateToolStatus?.();renderAll();
}
function currentBindingWorkbenchTab(){
  const tab=state.meshEdit?.bindingTab||'workflow';
  return ['workflow','advanced'].includes(tab)?tab:'workflow';
}
function setBindingWorkbenchTab(tab){
  if(!state.meshEdit)state.meshEdit={};
  state.meshEdit.bindingTab=tab==='advanced'?'advanced':'workflow';
  renderMeshWorkbench();
}
function meshWorkbenchEmpty(root,msg='Select a slot to edit binding, mesh and weights.'){
  root.classList.remove('active');root.innerHTML='';root.setAttribute('aria-hidden','true');
}

function setupPoseCardHtml(){
  const diff=typeof setupPoseDiffStats==='function'?setupPoseDiffStats():{total:0,bones:0,slots:0};
  const dirty=diff.total>0;
  const last=state.rig?.bindPoseLastSetAt?new Date(state.rig.bindPoseLastSetAt).toLocaleString():'not saved this session';
  return `<div class="setup-pose-card ${dirty?'warn':'ok'}">
    <div class="mesh-subpanel-title">Setup / Bind Pose</div>
    <div class="summary-line"><span>Viewport pose</span><b class="status-pill ${dirty?'status-warn':'status-ok'}">${dirty?'differs from setup':'setup pose'}</b></div>
    <p class="note">Rigging mode edits setup/rest data. Animation mode samples keys from this setup pose. ${dirty?htm(setupGuardLabel()):'No pose drift detected.'}</p>
    <div class="inline"><button id="wbSetBindPose">Set Bind Pose</button><button id="wbRestoreBindPose">Restore Bind Pose</button><button id="wbRebindWeights">Rebind weights</button><button id="wbGoAnimateTest">Animate test</button></div>
    <p class="note">Set Bind Pose copies current bones/slots into setup and updates mesh bind coordinates. Restore returns the viewport to setup before you keep rigging.</p>
    <p class="note">Last set: ${htm(last)}</p>
  </div>`;
}

function testPoseCardHtml(){
  const active=rigTestPoseActive?.();
  const st=typeof deformationTestStats==='function'?deformationTestStats():{active:false,total:0,bones:0,slots:0};
  const cls=active?'test-active':'ok';
  const status=active?(st.total?`${st.bones} bone(s), ${st.slots} slot(s) moved`:'active · setup pose'):'inactive';
  return `<div class="test-pose-card ${cls}">
    <div class="mesh-subpanel-title">Deformation Test Pose</div>
    <div class="summary-line"><span>Preview state</span><b class="status-pill ${active?'status-test':'status-ok'}">${htm(status)}</b></div>
    <p class="note">Temporary preview mode for checking mesh deformation. Drag bones in the viewport; no keyframes, setup pose, bind pose, or weights are written.</p>
    <div class="inline"><button id="wbStartTestPose" ${active?'disabled':''}>Start Test Pose</button><button id="wbResetTestPose" ${active?'':'disabled'}>Reset Test Pose</button><button id="wbExitTestPose" ${active?'':'disabled'}>Exit Test Pose</button></div>
    <p class="note">Esc exits and restores setup. Enter resets while staying in Test Pose. Setup ghost is shown through the rest-pose overlay.</p>
  </div>`;
}

function renderMeshWorkbench(){
  const root=$('#meshWorkbench');if(!root)return;
  if(state.mode==='pose'){meshWorkbenchEmpty(root);return;}
  if((state.selected.type!=='slot'||!selectedSlot())&&rigTestPoseActive?.()){
    root.classList.add('active');root.removeAttribute('aria-hidden');
    root.innerHTML=`<div class="mesh-workbench-head"><div class="mesh-workbench-title">Deformation Test Pose <span class="tag">temporary preview</span></div></div><div class="mesh-workbench-grid binding-grid"><div class="mesh-cell wide">${testPoseCardHtml()}</div><div class="mesh-cell"><div class="mesh-subpanel-title">How to use</div><p class="note">Drag selected bones in the viewport to check weighted mesh deformation. This mode does not write keys or setup data. Use Esc to exit quickly.</p></div></div>`;
    if($('#wbResetTestPose'))$('#wbResetTestPose').onclick=()=>resetDeformationTestPose?.();
    if($('#wbExitTestPose'))$('#wbExitTestPose').onclick=()=>exitDeformationTestPose?.({restore:true});
    if(typeof iconifyUI==='function')iconifyUI(root);
    return;
  }
  if(state.selected.type!=='slot'||!selectedSlot()){meshWorkbenchEmpty(root);return;}
  const s=selectedSlot();const m=ensureSlotMesh(s);if(!s||!m){meshWorkbenchEmpty(root);return;}
  root.classList.add('active');root.removeAttribute('aria-hidden');
  let tab=currentMeshWorkbenchTab();
  const grid=slotMeshGridSize(s);const sel=meshSelectedIndices(s);const selectedLabel=sel.length?sel.map(i=>'v'+i).join(', '):'none';
  const selectedEdges=(typeof meshSelectedEdges==='function')?meshSelectedEdges(s):[];
  const selectedEdge=selectedEdges[0]||null;
  const selectedFaces=(typeof meshSelectedFaces==='function')?meshSelectedFaces(s):[];
  const selectedEdgeShare=selectedEdge?meshEdgeTriangleCount(m,selectedEdge[0],selectedEdge[1]):0;
  const selectedEdgeLabel=selectedEdge?('v'+selectedEdge[0]+' ↔ v'+selectedEdge[1]+' · '+selectedEdgeShare+' tri'+(selectedEdges.length>1?' · +'+(selectedEdges.length-1)+' more':'')):'none';
  const selectedFaceLabel=selectedFaces.length?selectedFaces.map(i=>'t'+i).join(', '):'none';
  const elementMode=typeof meshSelectionMode==='function'?meshSelectionMode():(state.meshEdit.selectionMode||'vertex');
  const actionTool=typeof meshActionTool==='function'?meshActionTool():(state.meshEdit.actionTool||'select');
  const meshOn=state.meshEdit?.enabled&&(state.meshEdit.tool==='vertices'||state.meshEdit.tool==='weights');
  const bindBone=selectedBoneForBinding(s);
  const parent=slotParentBoneId(s);
  const parentName=parent?(bone(parent)?.name||parent):'none';
  const selectedFromMemory=bone(state.meshEdit.weightBoneId)||bone(state.lastBoneId)||bone(s.bone)||bindBone;
  if(selectedFromMemory&&!isProjectRootBone(selectedFromMemory))state.meshEdit.weightBoneId=selectedFromMemory.id;
  const weightBone=bone(state.meshEdit.weightBoneId)||selectedFromMemory;
  const selectedBoneOk=weightBone&&boneAffectsWeights(weightBone);
  const boneOpts=['<option value="">choose bone…</option>'].concat(bonesForSlotObject(s).map(b=>'<option value="'+b.id+'" '+(weightBone&&b.id===weightBone.id?'selected':'')+'>'+htm(b.name+' · '+boneRoleLabel(b)+(boneAffectsWeights(b)?'':' · no weights'))+'</option>')).join('');
  const parentOpts=['<option value="">No parent / object root space</option>'].concat(bonesForSlotObject(s).map(b=>'<option value="'+b.id+'" '+(b.id===parent?'selected':'')+'>'+htm(b.name)+'</option>')).join('');
  const tabs=`<div class="mesh-workbench-head"><div class="mesh-workbench-title">Mesh Workbench <span class="tag">${htm(s.name)} · ${m.vertices.length} verts / ${(m.triangles||[]).length} triangles / ${(m.edges||[]).length} edges</span></div><div class="mesh-workbench-tabs"><button id="meshWorkbenchTabBinding" class="${tab==='binding'?'on':''}">Binding</button><button id="meshWorkbenchTabMesh" class="${tab==='mesh'?'on':''}">Mesh</button><button id="meshWorkbenchTabWeights" class="${tab==='weights'?'on':''}">Weights</button></div></div>`;
  let body='';
  if(tab==='binding'){
    const btab=currentBindingWorkbenchTab();
    const subtabs=`<div class="mesh-binding-subtabs segmented"><button id="bindingSubtabWorkflow" class="${btab==='workflow'?'on':''}">Workflow</button><button id="bindingSubtabAdvanced" class="${btab==='advanced'?'on':''}">Advanced / diagnostics</button><span class="subtab-help">Workflow keeps the common bind flow visible. Advanced holds setup pose, diagnostics and manual tools.</span></div>`;
    if(btab==='workflow'){
      body=subtabs+`<div class="mesh-workbench-grid binding-grid binding-workflow-grid binding-workflow-main">
        <div class="mesh-cell wide binding-flow-cell">${slotBindingWorkflowHtml(s,{bindBone,weightBone,parent,parentName,selectedBoneOk})}</div>
        <div class="mesh-cell binding-status-cell"><div class="mesh-subpanel-title">Slot status</div>${slotBindingSummaryHtml(s)}<div class="inline"><button id="bindingSubtabAdvancedFromStatus">Open diagnostics</button><button id="wbFlowStartTestPose">Start Test Pose</button></div><p class="note">For setup pose, diagnostics fixes, and manual binding controls open Advanced / diagnostics.</p></div>
      </div>`;
    }else{
      body=subtabs+`<div class="mesh-workbench-grid binding-grid binding-advanced-grid">
        <div class="mesh-cell">${setupPoseCardHtml()}</div>
        <div class="mesh-cell">${testPoseCardHtml()}</div>
        <div class="mesh-cell diagnostics-cell"><div class="mesh-subpanel-title">Status / diagnostics</div>${slotBindingSummaryHtml(s)}${meshDiagnosticsPanelHtml(s)}</div>
        <div class="mesh-cell"><div class="mesh-subpanel-title">Manual parent</div><div class="row compact-row"><span>Parent bone</span><select id="wbSlotParentBone">${parentOpts}</select></div><div class="inline"><button id="wbSlotParentSelected" ${bindBone?'':'disabled'}>Parent = selected bone</button><button id="wbSlotParentNearest">Parent = nearest</button><button id="wbSlotClearParent">Clear parent</button></div><p class="note">Parent controls rigid placement and where the slot appears in the Object Rig tree.</p></div>
        <div class="mesh-cell"><div class="mesh-subpanel-title">Manual bind actions</div><p class="note">Selected/last bone: <b>${bindBone?htm(bindBone.name):'none'}</b>. Parent: <b>${htm(parentName)}</b>.</p><div class="inline"><button id="wbSlotRigidParent" ${parent?'':'disabled'}>Rigid: follow parent</button><button id="wbSlotBindAllParent" ${parent?'':'disabled'}>Weights: all to parent</button></div><div class="inline"><button id="wbSlotAutoParentChain" ${parent?'':'disabled'}>Auto weights: parent chain</button><button id="wbSlotAutoSelectedChain" ${bindBone?'':'disabled'}>Auto selected chain</button></div></div>
      </div>`;
    }
  }else if(tab==='mesh'){
    body=`<div class="mesh-workbench-grid mesh-grid">
      <div class="mesh-cell"><div class="mesh-subpanel-title">Mode</div><label><input id="wbMeshEnabled" type="checkbox" ${m.enabled===true?'checked':''}> use mesh render</label><label><input id="wbMeshEditToggle" type="checkbox" ${meshOn&&state.meshEdit.tool==='vertices'?'checked':''}> edit mesh in viewport</label><div class="inline segmented"><button id="wbMeshSelModeVertex" class="${elementMode==='vertex'?'on':''}">Vertex 1</button><button id="wbMeshSelModeEdge" class="${elementMode==='edge'?'on':''}">Edge 2</button><button id="wbMeshSelModeFace" class="${elementMode==='face'?'on':''}">Triangle 3</button></div><div class="inline segmented"><button id="wbMeshActionSelect" class="${actionTool==='select'?'on':''}">Select / gizmo</button><button id="wbMeshActionKnife" class="${actionTool==='knife'?'on':''}">Knife K</button><button id="wbMeshClearSelection">Clear</button></div><p class="note">Gizmo transforms selected vertices, edges and triangles as one vertex group. Knife: click edge/triangle for point cut, or drag a line through several triangles.</p></div>
      <div class="mesh-cell"><div class="mesh-subpanel-title">Grid cutter</div><div class="row compact-row"><span>Cols</span><input id="wbMeshCols" type="number" min="1" max="24" step="1" value="${grid.cols}"></div><div class="row compact-row"><span>Rows</span><input id="wbMeshRows" type="number" min="1" max="24" step="1" value="${grid.rows}"></div><label><input id="wbMeshAutoBindAfterCut" type="checkbox" checked> auto bind after grid rebuild</label><div class="inline"><button id="wbMeshApplyGrid">Apply grid</button><button id="wbMeshCutV">+ vertical cut</button><button id="wbMeshCutH">+ horizontal cut</button></div><div class="inline"><button id="wbMeshQuad">Quad</button><button id="wbMeshGrid22">2×2</button><button id="wbMeshGrid33">3×3</button><button id="wbMeshGrid44">4×4</button></div></div>
      <div class="mesh-cell"><div class="mesh-subpanel-title">Topology</div><p class="note">Edge: ${htm(selectedEdgeLabel)} · Triangle: ${htm(selectedFaceLabel)}</p><div class="inline"><button id="wbMeshSplitEdge" ${selectedEdge?'':'disabled'}>Split edge</button><button id="wbMeshCollapseEdge" ${selectedEdge&&m.vertices.length>3?'':'disabled'}>Collapse edge</button><button id="wbMeshSwapEdge" ${selectedEdgeShare===2?'':'disabled'}>Flip edge</button></div><div class="inline"><button id="wbMeshWeldVerts" ${sel.length>=2?'':'disabled'}>Weld verts</button><button id="wbMeshDeleteElement" ${(sel.length||selectedEdges.length||selectedFaces.length)?'':'disabled'}>Delete selected</button></div><div class="inline"><button id="wbMeshSelectBoundary">Select hull</button><button id="wbMeshRebuildTopology">Rebuild topology</button></div></div>
      <div class="mesh-cell selection-cell"><div class="mesh-subpanel-title">Selection / reset</div><div class="mesh-selection-stats"><span>${sel.length} verts</span><span>${selectedEdges.length} edges</span><span>${selectedFaces.length} triangles</span></div><p class="note">Box select supports Shift add and Ctrl/Cmd toggle. Verts: ${htm(selectedLabel)}</p><div class="inline"><button id="wbMeshSelAll">All ${elementMode==='edge'?'edges':(elementMode==='face'?'triangles':'verts')}</button><button id="wbMeshSelInvert">Invert</button><button id="wbMeshSelTop">Top</button><button id="wbMeshSelMid">Middle</button><button id="wbMeshSelBottom">Bottom</button><button id="wbMeshSelLeft">Left</button><button id="wbMeshSelRight">Right</button></div><div class="inline"><button id="wbMeshCompactLoose">Clean loose verts</button><button id="wbMeshQuick">Quick mesh + weights</button><button id="wbMeshReset">Reset quad</button><button id="wbMeshClearWeights">Clear weights</button></div></div>
    </div>`;
  }else{
    const brushMode=state.meshEdit.weightBrushMode||'add';
    const paintSession=state.meshEdit.weightPaintSession;
    const painting=!!(paintSession&&paintSession.active&&paintSession.slotId===s.id&&(paintSession.mode||state.meshEdit.weightTool)==='paint');
    const adjusting=!!(paintSession&&paintSession.active&&paintSession.slotId===s.id&&(paintSession.mode||state.meshEdit.weightTool)==='adjust');
    const sessionActive=painting||adjusting;
    const mirrorDirection=state.meshEdit.weightMirrorDirection||'selected';
    const mirrorAxis=state.meshEdit.weightMirrorAxis||'slot';
    const mirrorPreview=(typeof meshWeightMirrorPreview==='function')?meshWeightMirrorPreview(s,{direction:mirrorDirection,axisMode:mirrorAxis}):{sources:0,pairs:0,missingBones:0,unpaired:0,examples:[]};
    const mirrorExamples=mirrorPreview.examples?.length?(' · '+mirrorPreview.examples.map(htm).join(', ')):'';
    const mirrorWarn=(mirrorPreview.unpaired||mirrorPreview.missingBones)?`<span class="warn-text">${mirrorPreview.unpaired||0} unpaired · ${mirrorPreview.missingBones||0} missing bone pair(s)</span>`:'ready';
    body=`<div class="mesh-workbench-grid weights-grid">
      <div class="mesh-cell"><div class="mesh-subpanel-title">Weight context</div><label><input id="wbWeightMeshEnabled" type="checkbox" ${m.enabled===true?'checked':''}> use mesh render</label><label><input id="wbWeightEditToggle" type="checkbox" ${meshOn&&state.meshEdit.tool==='weights'?'checked':''}> edit weights in viewport</label><label><input id="wbMeshShowWeights" type="checkbox" ${state.meshEdit.showWeights!==false?'checked':''}> show filled vertex weight gauges</label><div class="row compact-row"><span>Bone</span><select id="wbMeshWeightBone">${boneOpts}</select></div><div class="row compact-row"><span>Max inf.</span><input id="wbMeshMaxInfluences" type="number" min="1" max="8" step="1" value="${state.meshEdit.maxInfluences||4}"></div><p class="note">Current: ${selectedBoneOk?htm(weightBone.name):'none'} · selected verts: ${htm(selectedLabel)}. Vertex circles now fill like pie gauges: full circle = 100% active-bone influence.</p></div>
      <div class="mesh-cell ${sessionActive?'active-paint-session':''}"><div class="mesh-subpanel-title">Viewport weight session</div><div class="inline"><button id="wbWeightStartPaint" class="${painting?'on':''}" ${selectedBoneOk||sessionActive?'':'disabled'}>${painting?'Painting active':'Start Paint P'}</button><button id="wbWeightStartAdjust" class="${adjusting?'on':''}" ${selectedBoneOk||sessionActive?'':'disabled'}>${adjusting?'Adjust active':'Start Adjust A'}</button><button id="wbWeightApplyPaint" ${sessionActive?'':'disabled'}>Apply Enter</button><button id="wbWeightCancelPaint" ${sessionActive?'':'disabled'}>Cancel Esc</button><button id="wbWeightToolSelect" ${sessionActive?'disabled':''}>Select verts</button></div><p class="note">Paint uses a brush. Adjust locks the viewport, then drag selected vertices: right/up increases the active bone weight, left/down decreases it. Apply or Cancel closes the session.</p></div>
      <div class="mesh-cell"><div class="mesh-subpanel-title">Vertex selection</div><div class="inline"><button id="wbWeightSelAll">All</button><button id="wbWeightSelTop">Top</button><button id="wbWeightSelMid">Middle</button><button id="wbWeightSelBottom">Bottom</button><button id="wbWeightSelLeft">Left</button><button id="wbWeightSelRight">Right</button></div>${selectedMeshInfluencesHtml(s)}</div>
      <div class="mesh-cell"><div class="mesh-subpanel-title">Mirror / symmetry</div><div class="row compact-row"><span>Direction</span><select id="wbWeightMirrorDirection"><option value="selected" ${mirrorDirection==='selected'?'selected':''}>Selected → opposite</option><option value="lr" ${mirrorDirection==='lr'?'selected':''}>Left → Right</option><option value="rl" ${mirrorDirection==='rl'?'selected':''}>Right → Left</option></select></div><div class="row compact-row"><span>Axis</span><select id="wbWeightMirrorAxis"><option value="slot" ${mirrorAxis==='slot'?'selected':''}>Slot center X</option><option value="bounds" ${mirrorAxis==='bounds'?'selected':''}>Mesh bounds center</option><option value="object" ${mirrorAxis==='object'?'selected':''}>Object root X</option></select></div><div class="mirror-preview"><b>${mirrorPreview.sources||0}</b> source · <b>${mirrorPreview.pairs||0}</b> pair(s) · ${mirrorWarn}${mirrorExamples}</div><div class="inline"><button id="wbWeightMirrorApply" ${(mirrorPreview.pairs||0)?'':'disabled'}>Mirror weights</button><button id="wbWeightMirrorLR">Left → Right</button><button id="wbWeightMirrorRL">Right → Left</button></div><p class="note">Bone names auto-swap _L/_R, .L/.R, -L/-R, L_/R_, left/right. Missing mirrored bones keep the original influence and are reported in the preview.</p></div>
      <div class="mesh-cell"><div class="mesh-subpanel-title">Brush</div><div class="inline segmented"><button id="wbWeightModeAdd" class="${brushMode==='add'?'on':''}">Add</button><button id="wbWeightModeSubtract" class="${brushMode==='subtract'?'on':''}">Subtract</button><button id="wbWeightModeSmooth" class="${brushMode==='smooth'?'on':''}">Smooth</button><button id="wbWeightModeReplace" class="${brushMode==='replace'?'on':''}">Replace</button></div><div class="row compact-row"><span>Size</span><input id="wbWeightBrushSize" type="range" min="4" max="180" step="1" value="${state.meshEdit.weightBrushSize||46}"></div><div class="row compact-row"><span>Strength</span><input id="wbWeightBrushStrength" type="range" min="0" max="1" step="0.01" value="${state.meshEdit.weightBrushStrength??.35}"></div><div class="row compact-row"><span>Replace</span><input id="wbWeightBrushValue" type="range" min="0" max="1" step="0.01" value="${state.meshEdit.weightBrushValue??1}"></div><div class="row compact-row"><span>Adjust speed</span><input id="wbWeightAdjustSensitivity" type="range" min="0.001" max="0.015" step="0.001" value="${state.meshEdit.weightAdjustSensitivity??.005}"></div><label><input id="wbWeightBrushSelectedOnly" type="checkbox" ${state.meshEdit.weightBrushSelectedOnly?'checked':''}> paint selected verts only</label><p class="note">Paint: drag brush while session is active. Adjust: drag selected verts; Shift gives finer control. [ / ] changes brush size.</p></div>
      <div class="mesh-cell"><div class="mesh-subpanel-title">Assign selected</div><div class="inline"><button id="wbMeshBindSelected" ${selectedBoneOk&&sel.length?'':'disabled'}>Set 100%</button><button id="wbMeshAddInfluence" ${selectedBoneOk&&sel.length?'':'disabled'}>Blend +50%</button><button id="wbMeshRemoveInfluence" ${selectedBoneOk&&sel.length?'':'disabled'}>Remove bone</button></div><div class="inline"><button id="wbMeshNormalize" ${sel.length?'':'disabled'}>Normalize</button><button id="wbMeshPrune" ${sel.length?'':'disabled'}>Limit influences</button><button id="wbMeshSmooth" ${sel.length?'':'disabled'}>Smooth</button></div></div>
      <div class="mesh-cell wide"><div class="mesh-subpanel-title">Auto / region bind</div><div class="inline"><button id="wbMeshBindTop" ${selectedBoneOk?'':'disabled'}>Top → bone</button><button id="wbMeshBindBottom" ${selectedBoneOk?'':'disabled'}>Bottom → bone</button><button id="wbMeshBindLeft" ${selectedBoneOk?'':'disabled'}>Left → bone</button><button id="wbMeshBindRight" ${selectedBoneOk?'':'disabled'}>Right → bone</button><button id="wbMeshBindAll" ${selectedBoneOk?'':'disabled'}>All → bone</button></div><div class="inline"><button id="wbMeshAutoAll">Auto object bones</button><button id="wbMeshAutoChain" ${selectedBoneOk?'':'disabled'}>Auto selected chain</button><button id="wbWeightClearWeights">Clear weights</button></div><p class="note">Per-vertex weight details are shown in Vertex Selection and directly in the viewport gauges.</p></div>
    </div>`;
  }
  root.innerHTML=tabs+body;
  $('#meshWorkbenchTabBinding').onclick=()=>setMeshWorkbenchTab('binding');
  $('#meshWorkbenchTabMesh').onclick=()=>setMeshWorkbenchTab('mesh');
  $('#meshWorkbenchTabWeights').onclick=()=>setMeshWorkbenchTab('weights');
  const selectedIds=()=>meshSelectedIndices(s);
  const autoIds=()=>selectedBoneOk?boneSubtreeIds(weightBone.id):allMeshCandidateBoneIds(s.id);
  const applyTopology=fn=>{pushUndo();const ok=fn();if(!ok){state.undo.pop();return;}state.meshEdit.enabled=true;state.meshEdit.workbenchTab='mesh';changed();renderAll();};
  const selectRegion=r=>{selectSlotMeshRegion(s,r);state.meshEdit.enabled=true;renderAll();};
  const rebuild=(c,r)=>{pushUndo();rebuildSlotMeshGrid(s,c,r,{autoBind:$('#wbMeshAutoBindAfterCut')?.checked,boneIds:autoIds()});state.meshEdit.enabled=true;state.meshEdit.tool='vertices';state.meshEdit.workbenchTab='mesh';changed();renderAll();};
  if(tab==='binding'){
    const applyParentSelected=()=>{if(!bindBone)return;pushUndo();setSlotParentBone(s.id,bindBone.id,true);changed();renderAll();};
    const applyParentNearest=()=>{const b=nearestBoneToSlot(s.id);if(!b||isProjectRootBone(b))return;pushUndo();setSlotParentBone(s.id,b.id,true);changed();renderAll();};
    const quickRigid=()=>{pushUndo();let p=slotParentBoneId(s);if(!p&&bindBone){setSlotParentBone(s.id,bindBone.id,true);p=bindBone.id;}if(!p){const b=nearestBoneToSlot(s.id);if(b&&!isProjectRootBone(b)){setSlotParentBone(s.id,b.id,true);p=b.id;}}if(p)makeSlotRigidToParent(s.id);changed();renderAll();};
    const quickMeshSetup=()=>{pushUndo();let p=slotParentBoneId(s);if(!p&&bindBone){setSlotParentBone(s.id,bindBone.id,true);p=bindBone.id;}if(!p){const b=nearestBoneToSlot(s.id);if(b&&!isProjectRootBone(b)){setSlotParentBone(s.id,b.id,true);p=b.id;}}const ids=allMeshCandidateBoneIds(s.id);rebuildSlotMeshGrid(s,3,3,{autoBind:true,boneIds:ids.length?ids:(p?boneSubtreeIds(p):null)});s.mesh.enabled=true;const dom=dominantBoneForSlot(s)||p||ids[0];if(dom)state.meshEdit.weightBoneId=dom;state.meshEdit.showWeights=true;state.meshEdit.workbenchTab='weights';setMeshContext('weights',true);changed();renderAll();};
    const goMesh=()=>{state.meshEdit.workbenchTab='mesh';setMeshContext('vertices',true);renderAll();};
    const goWeights=()=>{state.meshEdit.workbenchTab='weights';state.meshEdit.showWeights=true;setMeshContext('weights',true);renderAll();};
    const testSelect=(bid)=>{if(!bid||!bone(bid))return;state.meshEdit.enabled=false;state.meshEdit.weightPaintSession=null;select('bone',bid);renderAll();};
    const on=(id,fn,evt='onclick')=>{const el=$('#'+id);if(el)el[evt]=fn;};
    on('bindingSubtabWorkflow',()=>setBindingWorkbenchTab('workflow'));
    on('bindingSubtabAdvanced',()=>setBindingWorkbenchTab('advanced'));
    on('bindingSubtabAdvancedFromStatus',()=>setBindingWorkbenchTab('advanced'));
    on('wbFlowStartTestPose',()=>startDeformationTestPose?.({fromSetup:true}));
    on('wbSetBindPose',()=>setBindPoseFromCurrent?.({rebind:true}));
    on('wbRestoreBindPose',()=>restoreBindPose?.({push:true,clearDeform:true}));
    on('wbRebindWeights',()=>{pushUndo();rebindAllMeshWeightsToCurrentPose?.(s.id);changed();renderAll();});
    on('wbGoAnimateTest',()=>enterAnimationTestPose?.());
    on('wbStartTestPose',()=>startDeformationTestPose?.({fromSetup:true}));
    on('wbResetTestPose',()=>resetDeformationTestPose?.());
    on('wbExitTestPose',()=>exitDeformationTestPose?.({restore:true}));
    on('wbDiagShowOverlay',e=>{state.meshEdit.showDiagnostics=e.target.checked;renderAll();},'onchange');
    const diagFix=(kind)=>{pushUndo();const ok=fixSlotMeshDiagnostics?.(s.id,kind);if(!ok){state.undo.pop();}else{changed();renderAll();}};
    on('wbDiagFixUnweighted',()=>diagFix('unweighted'));
    on('wbDiagPrune',()=>diagFix('prune'));
    on('wbDiagRebind',()=>diagFix('bind'));
    on('wbDiagFixDeform',()=>diagFix('deform'));
    on('wbDiagFixAll',()=>diagFix('all'));
    on('wbSlotParentBone',e=>{pushUndo();setSlotParentBone(s.id,e.target.value||null,true);changed();renderAll();},'onchange');
    on('wbSlotParentSelected',applyParentSelected);
    on('wbSlotParentNearest',applyParentNearest);
    on('wbSlotClearParent',()=>{pushUndo();setSlotParentBone(s.id,null,true);changed();renderAll();});
    on('wbSlotRigidParent',()=>{pushUndo();makeSlotRigidToParent(s.id);changed();renderAll();});
    on('wbSlotBindAllParent',()=>{pushUndo();bindSlotMeshAllToParent(s.id);changed();renderAll();});
    on('wbSlotAutoParentChain',()=>{if(!slotParentBoneId(s))return;pushUndo();autoBindSlotMesh(s,boneSubtreeIds(slotParentBoneId(s)));changed();renderAll();});
    on('wbSlotAutoSelectedChain',()=>{if(!bindBone)return;pushUndo();autoBindSlotMesh(s,boneSubtreeIds(bindBone.id));state.meshEdit.weightBoneId=bindBone.id;changed();renderAll();});
    on('wbFlowParentSelected',applyParentSelected);
    on('wbFlowParentNearest',applyParentNearest);
    on('wbFlowMesh33',()=>rebuild(3,3));
    on('wbFlowMesh44',()=>rebuild(4,4));
    on('wbFlowGoMesh',goMesh);
    on('wbFlowAutoObject',()=>{pushUndo();autoBindSlotMesh(s,allMeshCandidateBoneIds(s.id));state.meshEdit.showWeights=true;changed();renderAll();});
    on('wbFlowAutoParent',()=>{if(!slotParentBoneId(s))return;pushUndo();autoBindSlotMesh(s,boneSubtreeIds(slotParentBoneId(s)));state.meshEdit.showWeights=true;changed();renderAll();});
    on('wbFlowGoWeights',goWeights);
    on('wbFlowSelectParent',()=>testSelect(slotParentBoneId(s)));
    on('wbFlowSelectWeight',()=>testSelect(state.meshEdit.weightBoneId));
    on('wbFlowExitMesh',()=>{state.meshEdit.enabled=false;state.meshEdit.weightPaintSession=null;renderAll();});
    on('wbFlowQuickRigid',quickRigid);
    on('wbFlowQuickSetup',quickMeshSetup);
  }else if(tab==='mesh'){
    $('#wbMeshEnabled').onchange=e=>{pushUndo();m.enabled=e.target.checked;changed();renderAll();};
    $('#wbMeshEditToggle').onchange=e=>{setMeshContext('vertices',e.target.checked);state.meshEdit.workbenchTab='mesh';renderAll();};
    $('#wbMeshSelModeVertex').onclick=()=>setMeshSelectionMode('vertex');
    $('#wbMeshSelModeEdge').onclick=()=>setMeshSelectionMode('edge');
    $('#wbMeshSelModeFace').onclick=()=>setMeshSelectionMode('face');
    $('#wbMeshActionSelect').onclick=()=>setMeshActionTool('select');
    $('#wbMeshActionKnife').onclick=()=>setMeshActionTool(actionTool==='knife'?'select':'knife');
    $('#wbMeshClearSelection').onclick=()=>{clearMeshElementSelection();renderAll();};
    $('#wbMeshApplyGrid').onclick=()=>rebuild($('#wbMeshCols').value,$('#wbMeshRows').value);
    $('#wbMeshCutV').onclick=()=>rebuild(grid.cols+1,grid.rows);$('#wbMeshCutH').onclick=()=>rebuild(grid.cols,grid.rows+1);
    $('#wbMeshQuad').onclick=()=>rebuild(1,1);$('#wbMeshGrid22').onclick=()=>rebuild(2,2);$('#wbMeshGrid33').onclick=()=>rebuild(3,3);$('#wbMeshGrid44').onclick=()=>rebuild(4,4);
    $('#wbMeshSplitEdge').onclick=()=>applyTopology(()=>splitSlotMeshSelectedEdge(s));
    $('#wbMeshCollapseEdge').onclick=()=>applyTopology(()=>collapseSlotMeshSelectedEdge(s));
    $('#wbMeshSwapEdge').onclick=()=>applyTopology(()=>swapSlotMeshSelectedEdge(s));
    $('#wbMeshWeldVerts').onclick=()=>applyTopology(()=>weldSelectedMeshVertices(s));
    $('#wbMeshDeleteElement').onclick=()=>applyTopology(()=>deleteSelectedMeshElements(s));
    $('#wbMeshSelectBoundary').onclick=()=>{selectSlotMeshBoundary(s);state.meshEdit.enabled=true;renderAll();};
    $('#wbMeshRebuildTopology').onclick=()=>applyTopology(()=>rebuildSlotMeshTopology(s));
    $('#wbMeshSelAll').onclick=()=>{selectAllMeshElements(s,elementMode);state.meshEdit.enabled=true;renderAll();};
    $('#wbMeshSelInvert').onclick=()=>{invertMeshSelection(s,elementMode);state.meshEdit.enabled=true;renderAll();};
    $('#wbMeshCompactLoose').onclick=()=>applyTopology(()=>compactSlotMeshLooseVertices(s));
    ['Top','Mid','Bottom','Left','Right'].forEach(name=>{const el=$('#wbMeshSel'+name);if(el)el.onclick=()=>selectRegion(name==='Mid'?'middle':name.toLowerCase());});
    $('#wbMeshQuick').onclick=()=>{pushUndo();rebuildSlotMeshGrid(s,3,3,{autoBind:true,boneIds:autoIds()});state.meshEdit.enabled=true;state.meshEdit.tool='weights';state.meshEdit.workbenchTab='weights';state.meshEdit.showWeights=true;changed();renderAll();};
    $('#wbMeshReset').onclick=()=>{pushUndo();ensureSlotMesh(s,true);s.mesh.enabled=true;changed();renderAll();};
    $('#wbMeshClearWeights').onclick=()=>{pushUndo();clearSlotMeshWeights(s);changed();renderAll();};
  }else{
    $('#wbWeightMeshEnabled').onchange=e=>{pushUndo();m.enabled=e.target.checked;changed();renderAll();};
    $('#wbWeightEditToggle').onchange=e=>{setMeshContext('weights',e.target.checked);state.meshEdit.workbenchTab='weights';renderAll();};
    $('#wbMeshShowWeights').onchange=e=>{state.meshEdit.showWeights=e.target.checked;renderAll();};
    $('#wbMeshWeightBone').onchange=e=>{state.meshEdit.weightBoneId=e.target.value||null;renderAll();};
    $('#wbMeshMaxInfluences').onchange=e=>{state.meshEdit.maxInfluences=clamp(parseInt(e.target.value,10)||4,1,8);renderAll();};
    if($('#wbWeightMirrorDirection'))$('#wbWeightMirrorDirection').onchange=e=>{state.meshEdit.weightMirrorDirection=e.target.value||'selected';renderAll();};
    if($('#wbWeightMirrorAxis'))$('#wbWeightMirrorAxis').onchange=e=>{state.meshEdit.weightMirrorAxis=e.target.value||'slot';renderAll();};
    const applyMirror=(direction=null)=>{pushUndo();const res=mirrorSlotMeshWeights?.(s,{direction:direction||state.meshEdit.weightMirrorDirection||'selected',axisMode:state.meshEdit.weightMirrorAxis||'slot'});if(!res||!res.changed){state.undo.pop();return;}state.meshEdit.showWeights=true;changed();renderAll();};
    if($('#wbWeightMirrorApply'))$('#wbWeightMirrorApply').onclick=()=>applyMirror();
    if($('#wbWeightMirrorLR'))$('#wbWeightMirrorLR').onclick=()=>{state.meshEdit.weightMirrorDirection='lr';applyMirror('lr');};
    if($('#wbWeightMirrorRL'))$('#wbWeightMirrorRL').onclick=()=>{state.meshEdit.weightMirrorDirection='rl';applyMirror('rl');};
    $('#wbWeightStartPaint').onclick=()=>{beginWeightPaintSession?.();};
    $('#wbWeightStartAdjust').onclick=()=>{beginWeightAdjustSession?.();};
    $('#wbWeightApplyPaint').onclick=()=>{applyWeightPaintSession?.();};
    $('#wbWeightCancelPaint').onclick=()=>{cancelWeightPaintSession?.();};
    $('#wbWeightToolSelect').onclick=()=>{state.meshEdit.weightTool='select';state.meshEdit.weightPaintSession=null;setMeshContext('weights',true);renderAll();};
    [['#wbWeightModeAdd','add'],['#wbWeightModeSubtract','subtract'],['#wbWeightModeSmooth','smooth'],['#wbWeightModeReplace','replace']].forEach(([id,mode])=>{$(id).onclick=()=>{state.meshEdit.weightBrushMode=mode;renderAll();};});
    $('#wbWeightBrushSize').oninput=e=>{state.meshEdit.weightBrushSize=clamp(parseFloat(e.target.value)||46,4,180);renderAll();};
    $('#wbWeightBrushStrength').oninput=e=>{state.meshEdit.weightBrushStrength=clamp(parseFloat(e.target.value)||0,0,1);renderAll();};
    $('#wbWeightBrushValue').oninput=e=>{state.meshEdit.weightBrushValue=clamp(parseFloat(e.target.value)||0,0,1);renderAll();};
    $('#wbWeightAdjustSensitivity').oninput=e=>{state.meshEdit.weightAdjustSensitivity=clamp(parseFloat(e.target.value)||.005,.001,.015);renderAll();};
    $('#wbWeightBrushSelectedOnly').onchange=e=>{state.meshEdit.weightBrushSelectedOnly=e.target.checked;renderAll();};
    ['All','Top','Mid','Bottom','Left','Right'].forEach(name=>{const el=$('#wbWeightSel'+name);if(el)el.onclick=()=>selectRegion(name==='Mid'?'middle':name.toLowerCase());});
    $('#wbMeshBindSelected').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,selectedIds(),'replace');state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    $('#wbMeshAddInfluence').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,selectedIds(),'add',.5);state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    $('#wbMeshRemoveInfluence').onclick=()=>{pushUndo();removeSlotMeshBoneInfluence(s,weightBone.id,selectedIds());state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    $('#wbMeshNormalize').onclick=()=>{pushUndo();normalizeSlotMeshVertices(s,selectedIds());changed();renderAll();};
    $('#wbMeshPrune').onclick=()=>{pushUndo();pruneSlotMeshVertices(s,selectedIds());changed();renderAll();};
    $('#wbMeshSmooth').onclick=()=>{pushUndo();smoothSlotMeshWeights(s,selectedIds());changed();renderAll();};
    $('#wbMeshBindTop').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,meshSelectionByRegion(s,'top'));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    $('#wbMeshBindBottom').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,meshSelectionByRegion(s,'bottom'));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    $('#wbMeshBindLeft').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,meshSelectionByRegion(s,'left'));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    $('#wbMeshBindRight').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,meshSelectionByRegion(s,'right'));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    $('#wbMeshBindAll').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id);state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    $('#wbMeshAutoAll').onclick=()=>{pushUndo();autoBindSlotMesh(s,allMeshCandidateBoneIds(s.id));changed();renderAll();};
    $('#wbMeshAutoChain').onclick=()=>{pushUndo();autoBindSlotMesh(s,boneSubtreeIds(weightBone.id));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    $('#wbWeightClearWeights').onclick=()=>{pushUndo();clearSlotMeshWeights(s);changed();renderAll();};
  }
  if(typeof iconifyUI==='function')iconifyUI(root);
}

function renderCameraInspector(root){
  const cam=(typeof activeToonCamera==='function')?activeToonCamera():null;if(!cam){root.innerHTML='<div class="empty">No camera</div>';return;}
  if(state.inspectorTab==='data'){root.innerHTML=rawBlock(cam);return;}
  const t=(typeof ensureToon==='function')?ensureToon():null;
  const keys=state.anim.cameraTracks?.[cam.id]||[];
  root.innerHTML=`<div class="inspector-title">${htm(cam.name||'Camera')} <span class="tag">ToonDoc camera</span></div>
    <div class="row"><span>Name</span><input id="camName" value="${htm(cam.name||'Camera')}"></div>
    <div class="row"><span>X</span><input id="camX" type="number" step="1" value="${Number(cam.x||0).toFixed(3)}"></div>
    <div class="row"><span>Y</span><input id="camY" type="number" step="1" value="${Number(cam.y||0).toFixed(3)}"></div>
    <div class="row"><span>Rot</span><input id="camR" type="number" step="1" value="${Number(cam.r||0).toFixed(3)}"></div>
    <div class="row"><span>Zoom</span><input id="camZ" type="number" step=".05" min=".01" value="${Number(cam.z||1).toFixed(3)}"></div>
    <div class="inline"><button id="camKey">Key camera</button><button id="camFrame">Frame camera</button></div>
    <div class="mesh-subpanel"><div class="mesh-subpanel-title">Output Canvas</div>
      <div class="row compact-row"><span>W</span><input id="camCanvasW" type="number" min="1" value="${Number(t?.canvas?.width||1920)}"></div>
      <div class="row compact-row"><span>H</span><input id="camCanvasH" type="number" min="1" value="${Number(t?.canvas?.height||1080)}"></div>
      <div class="row compact-row"><span>BG</span><input id="camCanvasBg" type="color" value="${htm(t?.canvas?.background||'#000000')}"></div>
      <label><input id="camCanvasTransparent" type="checkbox" ${t?.canvas?.transparent?'checked':''}> transparent</label>
    </div>
    <p class="note">${keys.length} camera key(s). Output pixels come from Canvas W/H; this camera controls what part of the infinite scene is rendered.</p>`;
  const set=(id,k,fn=v=>v)=>{$(id).onchange=e=>{pushUndo();cam[k]=fn(e.target.value);changed();renderAll();}};
  set('#camName','name',v=>String(v||'Camera'));set('#camX','x',Number);set('#camY','y',Number);set('#camR','r',v=>normAngle(Number(v||0)));set('#camZ','z',v=>Math.max(.01,Number(v||1)));
  if(t){
    $('#camCanvasW').onchange=e=>{pushUndo();t.canvas.width=Math.max(1,Number(e.target.value)||1920);changed();renderAll();};
    $('#camCanvasH').onchange=e=>{pushUndo();t.canvas.height=Math.max(1,Number(e.target.value)||1080);changed();renderAll();};
    $('#camCanvasBg').onchange=e=>{pushUndo();t.canvas.background=e.target.value;changed();renderAll();};
    $('#camCanvasTransparent').onchange=e=>{pushUndo();t.canvas.transparent=e.target.checked;changed();renderAll();};
  }
  $('#camKey').onclick=()=>keyCamera?.();
  $('#camFrame').onclick=()=>{state.camera.x=-(cam.x||0)*state.camera.z;state.camera.y=(cam.y||0)*state.camera.z;renderAll();};
}

function rawBlock(obj){return '<textarea class="raw-preview" readonly>'+htm(JSON.stringify(obj,null,2))+'</textarea>';}
function renderBoneInspector(root){
  const b=selectedBone();if(!b){root.innerHTML='<div class="empty">No bone selected</div>';return;}const tab=state.inspectorTab;const tr=state.mode==='pose'?b.local:b.rest;
  const multiBones=typeof selectedBonesList==='function'?selectedBonesList({exact:true}):[b];
  if(multiBones.length>1&&tab!=='data'){
    const nonRoot=multiBones.filter(x=>!isProjectRootBone(x));
    const names=multiBones.map(x=>x.name).join(', ');
    root.innerHTML=`<div class="inspector-title">${multiBones.length} bones selected <span class="tag">active: ${htm(b.name)}</span></div>
      <div class="multi-bone-summary"><b>${multiBones.length}</b> bones selected.<br>${htm(names)}</div>
      <p class="note">Use the Move gizmo to move the selected bones together. Connected children stay attached; when a selected parent is moved, selected children below it are not moved twice.</p>
      <div class="mesh-subpanel"><div class="mesh-subpanel-title">Bulk display</div><div class="row"><span>Shape</span><select id="multiShape"><option value="">— keep —</option>${BONE_SHAPES.map(v=>'<option value="'+v+'">'+({bone:'Normal bone',cross:'Cross',circleCross:'Circle + cross',square:'Square',squareCross:'Square + cross'}[v])+'</option>').join('')}</select></div><div class="row"><span>Color</span><input id="multiColor" type="color" value="#ffcc33"></div><div class="row"><span>Visual size</span><input id="multiWidth" type="number" min="4" max="96" value="12"></div><div class="inline"><button id="multiApplyShape">Apply shape</button><button id="multiApplyColor">Apply color</button><button id="multiApplyWidth">Apply size</button></div></div>
      <div class="mesh-subpanel"><div class="mesh-subpanel-title">Bulk role / locks</div><div class="inline"><button id="multiRoleDeform">Role: Deform</button><button id="multiRoleControl">Role: Control</button><button id="multiRoleSocket">Role: Socket</button></div><div class="inline"><button id="multiLockMove">Toggle lock move</button><button id="multiLockRot">Toggle lock rotate</button><button id="multiLockScale">Toggle lock scale</button></div></div>
      <div class="inline"><button id="multiKey" ${state.mode==='pose'?'':'disabled'}>Key selected bones</button><button id="multiReset">Reset selected pose</button><button id="multiClear">Clear multi-select</button><button id="multiDelete" class="bad">Delete selected bones</button></div>`;
    const each=(fn)=>{pushUndo();for(const x of nonRoot)fn(x);changed();renderAll();};
    $('#multiApplyShape').onclick=()=>{const v=$('#multiShape').value;if(v)each(x=>x.shape=normalizeBoneShape(v));};
    $('#multiApplyColor').onclick=()=>each(x=>x.color=normalizeHex($('#multiColor').value));
    $('#multiApplyWidth').onclick=()=>each(x=>x.width=clamp(parseFloat($('#multiWidth').value)||12,4,96));
    $('#multiRoleDeform').onclick=()=>each(x=>setBoneRole(x,'deform'));$('#multiRoleControl').onclick=()=>each(x=>setBoneRole(x,'control'));$('#multiRoleSocket').onclick=()=>each(x=>setBoneRole(x,'socket'));
    $('#multiLockMove').onclick=()=>each(x=>x.lockMove=!x.lockMove);$('#multiLockRot').onclick=()=>each(x=>x.lockRotate=!x.lockRotate);$('#multiLockScale').onclick=()=>each(x=>x.lockScale=!x.lockScale);
    $('#multiKey').onclick=()=>keySelected();$('#multiReset').onclick=()=>resetPose(false);$('#multiClear').onclick=()=>{state.selectedBones=b?[b.id]:[];renderAll();};$('#multiDelete').onclick=deleteSelected;return;
  }
  if(tab==='transform'){
    const isRoot=isProjectRootBone(b),moveOnly=isMoveOnlyBone(b),connected=isConnectedBone(b),posDisabled=isRoot||!canMoveBone(b),rotDisabled=isRoot||!canRotateBone(b),lenDisabled=isRoot||!canScaleBone(b,'len'),scaleDisabled=isRoot||!canScaleBone(b,'scale');
    const tag=isRoot?'project root':boneRoleLabel(b)+' · '+(isObjectRootBone(b)?'object root':(moveOnly?'move-only':(connected?'connected':'free')));
    root.innerHTML=`<div class="inspector-title">${htm(b.name)} <span class="tag">${tag}</span></div><div class="row"><span>X</span><input id="iX" type="number" step="1" value="${tr.x.toFixed(3)}" ${posDisabled?'disabled':''}></div><div class="row"><span>Y</span><input id="iY" type="number" step="1" value="${tr.y.toFixed(3)}" ${posDisabled?'disabled':''}></div><div class="row"><span>Rot</span><input id="iR" type="number" step="1" value="${tr.r.toFixed(3)}" ${rotDisabled?'disabled':''}></div><div class="row"><span>Len</span><input id="iLen" type="number" min="4" step="1" value="${tr.len.toFixed(3)}" ${lenDisabled?'disabled':''}></div><div class="row"><span>Scale X</span><input id="iSX" type="number" step=".05" value="${Number(tr.sx??1).toFixed(3)}" ${scaleDisabled?'disabled':''}></div><div class="row"><span>Scale Y</span><input id="iSY" type="number" step=".05" value="${Number(tr.sy??1).toFixed(3)}" ${scaleDisabled?'disabled':''}></div><hr><div class="inline"><button id="iKey" ${isRoot?'disabled':''}>Key FK chain</button><button id="iReset" ${isRoot?'disabled':''}>Reset pose</button><button id="iFrame">Frame</button></div>`;
    const bind=(id,key)=>{const el=$(id);if(el&&!el.disabled)el.onchange=e=>{pushUndo();applyEdit(b,key,parseFloat(e.target.value)||0);autoKeyBoneAfterEdit(b.id);changed();renderAll();};};bind('#iX','x');bind('#iY','y');bind('#iR','r');bind('#iLen','len');bind('#iSX','sx');bind('#iSY','sy');$('#iKey').onclick=()=>keyBone(b.id);$('#iReset').onclick=()=>{pushUndo();b.local={...b.rest};changed();renderAll();};$('#iFrame').onclick=()=>frameWorldRect([{x:b.w.sx,y:b.w.sy},{x:b.w.ex,y:b.w.ey}]);return;
  }
  if(tab==='object'){
    const obj=objectForRootBone(b.id);
    if(obj){
      const slotOpts='<option value="">— scene root —</option>'+state.slots.filter(sl=>objectOfSlotId(sl.id)!==obj.id).map(sl=>'<option value="'+sl.id+'" '+(obj.parentSlot===sl.id?'selected':'')+'>'+htm((rigObject(objectOfSlotId(sl.id))?.name||'Scene')+' / '+sl.name)+'</option>').join('');
      root.innerHTML=`<div class="inspector-title">${htm(obj.name)} <span class="tag">scene object</span></div><div class="row"><span>Object ID</span><input value="${obj.id}" disabled></div><div class="row"><span>Object name</span><input id="objName" value="${htm(obj.name)}"></div><div class="row"><span>Root bone</span><input value="${htm(b.name)}" disabled></div><div class="row"><span>Parent slot</span><select id="objParentSlot">${slotOpts}</select></div>${state.documentType==='toon'?'<div class="row"><span>Render pass</span><select id="objRenderLayer">'+sortedRenderLayers().map(l=>'<option value="'+l.id+'" '+((obj.renderLayerId||defaultRenderLayerId())===l.id?'selected':'')+'>'+htm(l.name)+'</option>').join('')+'</select></div>':''}<p class="note">This root is the transform container for one animation object. Detach keeps the same world position.</p><div class="inline"><button id="objDetach">Detach to scene</button><button id="objDelete" class="bad">Delete object</button></div>`;
      $('#objName').onchange=e=>{pushUndo();obj.name=e.target.value||obj.id;b.name=(obj.name+'_root');changed();renderAll();};
      $('#objParentSlot').onchange=e=>{pushUndo();if(e.target.value)attachObjectToSlot(obj.id,e.target.value,true);else detachObjectFromSlot(obj.id,true);changed();renderAll();};if($('#objRenderLayer'))$('#objRenderLayer').onchange=e=>{pushUndo();obj.renderLayerId=e.target.value;changed();renderAll();};
      $('#objDetach').onclick=()=>{pushUndo();detachObjectFromSlot(obj.id,true);changed();renderAll();};
      $('#objDelete').onclick=()=>{if(confirm('Delete object '+obj.name+'?')){pushUndo();deleteRigObject(obj.id);changed();renderAll();}};
      return;
    }
    const parent=bone(b.parent),canFree=!isProjectRootBone(b)&&!!parent&&!isProjectRootBone(parent),freeChecked=!isConnectedBone(b);
    const parentOpts=['<option value="">none</option>'].concat(state.bones.filter(x=>x.id!==b.id&&!isDescendant(x.id,b.id)).map(x=>'<option value="'+x.id+'" '+(x.id===b.parent?'selected':'')+'>'+htm(x.name)+'</option>')).join('');
    const shapeLabels={bone:'Normal bone',cross:'Cross',circleCross:'Circle + cross',square:'Square',squareCross:'Square + cross'};
    const shapeOpts=BONE_SHAPES.map(v=>'<option value="'+v+'" '+(normalizeBoneShape(b.shape)===v?'selected':'')+'>'+shapeLabels[v]+'</option>').join('');
    const roleList=(isObjectRootBone(b)||isProjectRootBone(b))?['root']:['deform','control','socket'];const roleOpts=roleList.map(v=>'<option value="'+v+'" '+(inferBoneRole(b)===v?'selected':'')+'>'+({deform:'Deform bone',control:'Control bone',socket:'Socket bone',root:'Root bone'}[v])+'</option>').join('');
    root.innerHTML=`<div class="inspector-title">Bone Properties <span class="tag">${boneRoleLabel(b)}</span></div>
    <div class="row"><span>ID</span><input value="${b.id}" disabled></div><div class="row"><span>Name</span><input id="iName" value="${htm(b.name)}"></div>
    <div class="mesh-subpanel"><div class="mesh-subpanel-title">Role</div><div class="row"><span>Bone role</span><select id="iRole" ${isProjectRootBone(b)||isObjectRootBone(b)?'disabled':''}>${roleOpts}</select></div><label><input id="iAffectWeights" type="checkbox" ${b.affectWeights!==false?'checked':''} ${inferBoneRole(b)!=='deform'?'disabled':''}> can affect mesh weights</label><p class="note">Deform bones are used by auto weights. Control and Socket bones stay visible for animation/attachments but are ignored by auto-bind.</p></div>
    <div class="mesh-subpanel"><div class="mesh-subpanel-title">Hierarchy</div><div class="row"><span>Parent</span><select id="iParent" ${isProjectRootBone(b)?'disabled':''}>${parentOpts}</select></div><div class="row"><span>Connected child</span><input id="iConnected" type="checkbox" ${isConnectedBone(b)?'checked':''} ${canFree&&!isMoveOnlyBone(b)?'':'disabled'}></div><p class="note">Connected child starts at parent tip. Free child follows parent but keeps its own movable start point.</p></div>
    <div class="mesh-subpanel"><div class="mesh-subpanel-title">Locks</div><label><input id="iLockMove" type="checkbox" ${b.lockMove?'checked':''} ${isProjectRootBone(b)?'disabled':''}> lock move</label><label><input id="iLockRot" type="checkbox" ${b.lockRotate?'checked':''} ${isProjectRootBone(b)?'disabled':''}> lock rotate</label><label><input id="iLockScale" type="checkbox" ${b.lockScale?'checked':''} ${isProjectRootBone(b)?'disabled':''}> lock scale X/Y</label><label><input id="iLockLen" type="checkbox" ${b.lockLength?'checked':''} ${isProjectRootBone(b)?'disabled':''}> lock length</label></div>
    <div class="mesh-subpanel"><div class="mesh-subpanel-title">Display</div><div class="row"><span>Shape</span><select id="iShape" ${isProjectRootBone(b)?'disabled':''}>${shapeOpts}</select></div><div class="row"><span>Visual size</span><input id="iWidth" type="number" min="4" max="96" step="1" value="${Math.round(Number(b.width||12))}" ${isProjectRootBone(b)?'disabled':''}></div><div class="row"><span>Color</span><input id="iColor" type="color" value="${normalizeHex(b.color||'#dddddd')}" ${isProjectRootBone(b)?'disabled':''}></div></div>
    ${isProjectRootBone(b)?'<p class="note">Project root is locked at world 0,0 / 0° and cannot be animated, moved, rotated, or deleted.</p>':'<button id="iDel" class="bad">Delete bone</button>'}`;
    $('#iName').onchange=e=>{pushUndo();b.name=e.target.value||b.id;changed();renderAll();};if($('#iParent'))$('#iParent').onchange=e=>{pushUndo();reparentBoneKeepWorld(b,e.target.value||null,{connected:'auto'});changed();renderAll();};if($('#iConnected'))$('#iConnected').onchange=e=>{pushUndo();setBoneConnectedKeepWorld(b,e.target.checked);changed();renderAll();};if($('#iRole'))$('#iRole').onchange=e=>{pushUndo();setBoneRole(b,e.target.value);changed();renderAll();};if($('#iAffectWeights'))$('#iAffectWeights').onchange=e=>{pushUndo();b.affectWeights=e.target.checked;changed();renderAll();};for(const [id,key] of [['#iLockMove','lockMove'],['#iLockRot','lockRotate'],['#iLockScale','lockScale'],['#iLockLen','lockLength']]){const el=$(id);if(el)el.onchange=e=>{pushUndo();b[key]=e.target.checked;changed();renderAll();};}if($('#iShape'))$('#iShape').onchange=e=>{pushUndo();b.shape=normalizeBoneShape(e.target.value);changed();renderAll();};$('#iWidth').onfocus=()=>{if(!$('#iWidth').dataset.undo){pushUndo();$('#iWidth').dataset.undo='1';}};$('#iWidth').oninput=e=>{b.width=clamp(parseFloat(e.target.value)||12,4,96);changed();renderAll();};$('#iColor').onfocus=()=>{if(!$('#iColor').dataset.undo){pushUndo();$('#iColor').dataset.undo='1';}};$('#iColor').oninput=e=>{b.color=normalizeHex(e.target.value);changed();renderAll();};if($('#iDel'))$('#iDel').onclick=deleteSelected;return;
  }
  if(tab==='animation'){
    const keys=(state.anim.boneTracks||{})[b.id]||[];root.innerHTML=`<p class="note">${keys.length} key(s) on this bone. Current mode: ${state.mode==='pose'?'Animate':'Rig/Artwork'}.</p><div class="inline"><button id="iKey">Key FK chain</button><button id="iKeyOne">Key only this</button><button id="iDelKey" class="bad">Delete key @ time</button></div><hr><p id="keyInfoLocal" class="note">${htm($('#keyInfo')?.textContent||'')}</p>`;$('#iKey').onclick=()=>keyBone(b.id);$('#iKeyOne').onclick=()=>keyBone(b.id,state.currentTime,false);$('#iDelKey').onclick=deleteKey;return;
  }
  if(tab==='rig'){
    const childCount=children(b.id).length;
    root.innerHTML=`<div class="inspector-title">Bone Rig Tools <span class="tag">${boneConnectionMeta(b)}</span></div><p class="note">${isProjectRootBone(b)?'Project root is locked and works only as a stable parent coordinate. ':''}Children: ${childCount}. Markers: ${parentMarkers(b.id).length}.</p>
    <div class="mesh-subpanel"><div class="mesh-subpanel-title">Create / edit branch</div><div class="inline"><button id="rigChild" ${isProjectRootBone(b)?'disabled':''}>Create connected child</button><button id="rigFreeChild" ${isProjectRootBone(b)?'disabled':''}>Create free control child</button></div><div class="inline"><button id="rigSplit" ${isProjectRootBone(b)||isObjectRootBone(b)?'disabled':''}>Split bone</button><button id="rigInsert" ${isProjectRootBone(b)?'disabled':''}>Insert bone</button></div></div>
    <div class="mesh-subpanel"><div class="mesh-subpanel-title">Mirror / symmetry</div><div class="inline"><button id="rigMirrorBone" ${isProjectRootBone(b)||isObjectRootBone(b)?'disabled':''}>Mirror selected bone</button><button id="rigMirrorBranch" ${isProjectRootBone(b)||isObjectRootBone(b)?'disabled':''}>Mirror branch</button></div><p class="note">Mirrors across the active object root X axis. Names auto-swap _L/_R, .L/.R, left/right; if no side suffix exists, “_mirror” is added.</p></div>
    <div class="mesh-subpanel"><div class="mesh-subpanel-title">Sockets / markers</div><div class="inline"><button id="rigMakeSocket" ${isProjectRootBone(b)||isObjectRootBone(b)?'disabled':''}>Convert to socket</button><button id="rigSocketBone" ${isProjectRootBone(b)?'disabled':''}>New socket child</button></div><div class="inline"><button id="rigSocket">Add socket marker</button><button id="rigHitbox">Add hitbox</button></div></div>
    <div class="mesh-subpanel"><div class="mesh-subpanel-title">Hierarchy helpers</div><div class="inline"><button id="rigParentNearby" ${isProjectRootBone(b)?'disabled':''}>Parent nearby bones as free children</button><button id="rigRest">Rest from pose</button><button id="rigReset">Reset pose</button></div><p class="note">Free children follow their parent but remain movable. Socket/control bones do not affect auto mesh weights.</p></div>`;
    $('#rigChild').onclick=()=>{pushUndo();createChildBone(b.id,{free:false,role:'deform'});changed();renderAll();};$('#rigFreeChild').onclick=()=>{pushUndo();createFreeChildBone(b.id,'control');changed();renderAll();};$('#rigSplit').onclick=()=>{pushUndo();splitBone(b);changed();renderAll();};$('#rigInsert').onclick=()=>{pushUndo();insertBoneBetweenSelectedAndFirstChild();changed();renderAll();};if($('#rigMirrorBone'))$('#rigMirrorBone').onclick=mirrorSelectedBone;if($('#rigMirrorBranch'))$('#rigMirrorBranch').onclick=mirrorSelectedBoneBranch;$('#rigMakeSocket').onclick=()=>{pushUndo();makeSelectedBoneSocket();changed();renderAll();};$('#rigSocketBone').onclick=()=>{pushUndo();createFreeChildBone(b.id,'socket');changed();renderAll();};$('#rigSocket').onclick=()=>{pushUndo();makeMarker('socket',b.id);changed();renderAll();};$('#rigHitbox').onclick=()=>{pushUndo();makeMarker('hitbox',b.id);changed();renderAll();};if($('#rigParentNearby'))$('#rigParentNearby').onclick=parentNearbyBonesToSelected;$('#rigRest').onclick=restFromPose;$('#rigReset').onclick=()=>resetPose(false);return;
  }
  if(tab==='elastic'){
    const isRoot=isProjectRootBone(b);b.elastic=normalizeElasticSettings(b.elastic||{});const el=b.elastic;
    const presetOpts=Object.keys(ELASTIC_PRESETS).map(name=>`<option value="${name}" ${el.preset===name?'selected':''}>${name}</option>`).join('');
    const stretchDisabled=isRoot||el.mode!=='rubber';
    const stretchValue=el.mode==='rubber'?el.stretch:0;
    const bake=typeof elasticBakeSettings==='function'?elasticBakeSettings():{visualTol:1,maxInterval:.42};
    root.innerHTML=`<div class="inspector-title">Elastic Bones <span class="tag">${el.enabled?'live':'off'}</span></div><div class="row"><span>Enabled</span><input id="elEnabled" type="checkbox" ${el.enabled?'checked':''} ${isRoot?'disabled':''}></div><div class="row"><span>Preset</span><select id="elPreset" ${isRoot?'disabled':''}>${presetOpts}</select></div><div class="row"><span>Mode</span><select id="elMode" ${isRoot?'disabled':''}><option value="spring" ${el.mode==='spring'?'selected':''}>Spring</option><option value="rubber" ${el.mode==='rubber'?'selected':''}>Rubber</option></select></div><div class="row"><span>Stiffness</span><input id="elStiff" type="range" min="0" max="100" value="${Math.round(el.stiffness*100)}" ${isRoot?'disabled':''}></div><div class="row"><span>Damping</span><input id="elDamp" type="range" min="0" max="100" value="${Math.round(el.damping*100)}" ${isRoot?'disabled':''}></div><div class="row"><span>Stretch</span><input id="elStretch" type="range" min="0" max="100" value="${Math.round(stretchValue*100)}" ${stretchDisabled?'disabled':''}></div><hr><div class="row"><span>Bake error px</span><input id="elBakeErr" type="number" min="0.1" max="8" step="0.1" value="${Number(bake.visualTol).toFixed(1)}"></div><div class="row"><span>Max segment</span><input id="elBakeSeg" type="number" min="0.08" max="2" step="0.02" value="${Number(bake.maxInterval).toFixed(2)}"></div><p class="note">Spring keeps bone length locked. Rubber unlocks Stretch. Smart Bake 3 fits cubic Hermite curve segments with separate in/out tangents and keeps only keys needed for the bone-tip visual error. Bigger error / segment = fewer keys.</p><div class="inline"><button id="elApplyChain" ${isRoot?'disabled':''}>Apply to child chain</button><button id="elBakeSelected" ${isRoot?'disabled':''}>Bake selected</button><button id="elBakeAll">Bake all elastic</button></div><div class="row"><span>Preview</span><input id="elPreview" type="checkbox" ${state.elastic?.preview!==false?'checked':''}></div>`;
    const save=()=>{b.elastic=normalizeElasticSettings(b.elastic);resetElasticSimulation();changed();renderSceneOutliner();renderInspector();};
    $('#elEnabled').onchange=e=>{pushUndo();b.elastic.enabled=e.target.checked;save();};
    $('#elPreset').onchange=e=>{pushUndo();setElasticPreset(b,e.target.value);save();};
    $('#elMode').onchange=e=>{pushUndo();const next=e.target.value;b.elastic.mode=next;if(next==='spring')b.elastic.stretch=0;else if(Number(b.elastic.stretch||0)<=0)b.elastic.stretch=.35;save();};
    $('#elStiff').oninput=e=>{b.elastic.stiffness=clamp(Number(e.target.value)/100,0,1);resetElasticSimulation();};$('#elStiff').onchange=()=>{pushUndo();save();};
    $('#elDamp').oninput=e=>{b.elastic.damping=clamp(Number(e.target.value)/100,0,1);resetElasticSimulation();};$('#elDamp').onchange=()=>{pushUndo();save();};
    $('#elStretch').oninput=e=>{if(b.elastic.mode!=='rubber')return;b.elastic.stretch=clamp(Number(e.target.value)/100,0,1);resetElasticSimulation();};$('#elStretch').onchange=()=>{if(b.elastic.mode!=='rubber')return;pushUndo();save();};
    $('#elBakeErr').onchange=e=>{state.elastic=state.elastic||{};state.elastic.bakeVisualError=clamp(Number(e.target.value)||1,.1,8);changed();renderInspector();};
    $('#elBakeSeg').onchange=e=>{state.elastic=state.elastic||{};state.elastic.bakeMaxInterval=clamp(Number(e.target.value)||.42,.08,2);changed();renderInspector();};
    $('#elApplyChain').onclick=()=>applyElasticToSelectedChain($('#elPreset').value||'Tail');$('#elBakeSelected').onclick=bakeSelectedElasticToKeys;$('#elBakeAll').onclick=bakeAllElasticToKeys;$('#elPreview').onchange=e=>{state.elastic.preview=e.target.checked;resetElasticSimulation();changed();};return;
  }
  root.innerHTML=rawBlock(b);
}
function renderSlotInspector(root){
  const s=selectedSlot();if(!s){root.innerHTML='<div class="empty">No slot selected</div>';return;}const tab=state.inspectorTab;const a=attachment(s.pose.attachment);const sw=slotWorld(s);
  if(tab==='transform'){
    root.innerHTML=`<div class="inspector-title">${htm(s.name)} <span class="tag">${htm(slotBindingStatus(s).label)}</span></div>${slotBindingSummaryHtml(s)}<div class="row"><span>X</span><input id="sX" type="number" step="1" value="${Number(s.local.x||0).toFixed(3)}"></div><div class="row"><span>Y</span><input id="sY" type="number" step="1" value="${Number(s.local.y||0).toFixed(3)}"></div><div class="row"><span>Rot</span><input id="sR" type="number" step="1" value="${Number(s.local.r||0).toFixed(3)}"></div><div class="row"><span>Scale X</span><input id="sSX" type="number" step=".05" value="${s.local.sx}"></div><div class="row"><span>Scale Y</span><input id="sSY" type="number" step=".05" value="${s.local.sy}"></div><p class="note">World: ${sw.x.toFixed(1)}, ${sw.y.toFixed(1)}, ${sw.r.toFixed(1)}°</p>`;
    [['#sX','x'],['#sY','y'],['#sR','r'],['#sSX','sx'],['#sSY','sy']].forEach(([id,k])=>$(id).onchange=e=>{pushUndo();s.local[k]=parseFloat(e.target.value)||0;if(k==='sx'||k==='sy')s.local[k]=s.local[k]||1;if(state.mode!=='pose'&&!rigTestPoseActive?.()&&typeof markSlotSetupFromLocal==='function')markSlotSetupFromLocal(s);autoKeySlotAfterEdit(s.id);changed();renderAll();});return;
  }
  if(tab==='image'){
    const attOpts=['<option value="">none</option>'].concat(state.attachments.map(att=>'<option value="'+att.id+'" '+(att.id===s.pose.attachment?'selected':'')+'>'+htm(att.name)+'</option>')).join('');
    const blendOpts=['normal','multiply','screen','overlay','lighter'].map(v=>'<option value="'+v+'" '+((s.pose.blendMode||s.blendMode||'normal')===v?'selected':'')+'>'+v+'</option>').join('');
    root.innerHTML=`<div class="row"><span>ID</span><input value="${s.id}" disabled></div><div class="row"><span>Name</span><input id="sName" value="${htm(s.name)}"></div><div class="row"><span>Attachment</span><select id="sAtt">${attOpts}</select></div><div class="row"><span>Visible</span><input id="sVis" type="checkbox" ${s.pose.visible?'checked':''}></div><div class="row"><span>Alpha</span><input id="sAlpha" type="number" min="0" max="1" step=".05" value="${s.pose.alpha}"></div><div class="row"><span>Tint</span><input id="sTint" type="color" value="${normalizeHex(s.pose.tint||s.tint||'#ffffff')}"></div><div class="row"><span>Tint mix</span><input id="sTintAlpha" type="number" min="0" max="1" step=".05" value="${clamp(Number(s.pose.tintAlpha??s.tintAlpha??0),0,1)}"></div><div class="row"><span>Blend</span><select id="sBlend">${blendOpts}</select></div><p class="note">${a?`${htm(a.name)} · ${a.type} · ${Math.round(a.w)}×${Math.round(a.h)}`:'No attachment assigned.'}</p><hr><div class="inline"><button id="sKeyLook">Key look</button><button id="sUp">Draw up</button><button id="sDown">Draw down</button><button id="sDel" class="bad">Delete slot</button></div>`;
    $('#sName').onchange=e=>{pushUndo();s.name=e.target.value||s.id;changed();renderAll();};$('#sAtt').onchange=e=>{pushUndo();s.attachment=e.target.value||null;s.pose.attachment=s.attachment;ensureSlotMesh(s,true);autoKeySlotAfterEdit(s.id);changed();renderAll();};$('#sVis').onchange=e=>{pushUndo();s.pose.visible=e.target.checked;s.visible=e.target.checked;autoKeySlotAfterEdit(s.id);changed();renderAll();};$('#sAlpha').onchange=e=>{pushUndo();s.pose.alpha=clamp(parseFloat(e.target.value)||0,0,1);s.alpha=s.pose.alpha;autoKeySlotAfterEdit(s.id);changed();renderAll();};$('#sTint').onchange=e=>{pushUndo();s.pose.tint=normalizeHex(e.target.value);s.tint=s.pose.tint;autoKeySlotAfterEdit(s.id);changed();renderAll();};$('#sTintAlpha').onchange=e=>{pushUndo();s.pose.tintAlpha=clamp(parseFloat(e.target.value)||0,0,1);s.tintAlpha=s.pose.tintAlpha;autoKeySlotAfterEdit(s.id);changed();renderAll();};$('#sBlend').onchange=e=>{pushUndo();s.pose.blendMode=e.target.value;s.blendMode=e.target.value;autoKeySlotAfterEdit(s.id);changed();renderAll();};$('#sKeyLook').onclick=()=>{pushUndo();writeSlotKey(s.id);changed();renderTimeline();};$('#sUp').onclick=()=>moveSlot(s.id,-1);$('#sDown').onclick=()=>moveSlot(s.id,1);$('#sDel').onclick=deleteSelected;return;
  }
  if(tab==='binding'){
    const bindBone=selectedBoneForBinding(s);
    const parent=slotParentBoneId(s);
    const boneOpts=['<option value="">No parent / object root space</option>'].concat(bonesForSlotObject(s).map(b=>'<option value="'+b.id+'" '+(b.id===parent?'selected':'')+'>'+htm(b.name)+'</option>')).join('');
    const bindLabel=bindBone?htm(bindBone.name):'none';
    root.innerHTML=`<div class="inspector-title">Slot Binding <span class="tag">parent + mesh weights</span></div>
      ${slotBindingSummaryHtml(s)}
      <div class="mesh-subpanel"><div class="mesh-subpanel-title">1 · Parent bone</div>
        <div class="row"><span>Parent bone</span><select id="slotParentBone">${boneOpts}</select></div>
        <p class="note">Parent bone is where the slot lives in the Object Rig tree. A rigid slot follows this bone as one piece. A weighted mesh can still use several bones for deformation.</p>
        <div class="inline"><button id="slotParentSelected" ${bindBone?'':'disabled'}>Parent = selected bone</button><button id="slotParentNearest">Parent = nearest bone</button><button id="slotClearParent">Clear parent bone</button></div>
      </div>
      <div class="mesh-subpanel"><div class="mesh-subpanel-title">2 · Rigid or weighted image</div>
        <p class="note">Selected/last bone for quick actions: <b>${bindLabel}</b></p>
        <div class="inline"><button id="slotRigidParent" ${parent?'':'disabled'}>Rigid: follow parent</button><button id="slotBindAllParent" ${parent?'':'disabled'}>Weights: all to parent</button></div>
        <div class="inline"><button id="slotAutoParentChain" ${parent?'':'disabled'}>Auto weights: parent chain</button><button id="slotAutoSelectedChain" ${bindBone?'':'disabled'}>Auto Bind Selected Bones</button></div>
      </div>
      <div class="mesh-subpanel"><div class="mesh-subpanel-title">Recommended workflow</div>
        <ol class="pipeline-list"><li>Set the slot parent bone so it appears under the right bone.</li><li>For simple sprites, keep it rigid.</li><li>For bending sprites, go Mesh → cut grid, then Weights → auto/manual weights.</li></ol>
      </div>`;
    $('#slotParentBone').onchange=e=>{pushUndo();setSlotParentBone(s.id,e.target.value||null,true);changed();renderAll();};
    $('#slotParentSelected').onclick=()=>{if(!bindBone)return;pushUndo();setSlotParentBone(s.id,bindBone.id,true);changed();renderAll();};
    $('#slotParentNearest').onclick=()=>{const b=nearestBoneToSlot(s.id);if(!b||isProjectRootBone(b))return;pushUndo();setSlotParentBone(s.id,b.id,true);changed();renderAll();};
    $('#slotClearParent').onclick=()=>{pushUndo();setSlotParentBone(s.id,null,true);changed();renderAll();};
    $('#slotRigidParent').onclick=()=>{pushUndo();makeSlotRigidToParent(s.id);changed();renderAll();};
    $('#slotBindAllParent').onclick=()=>{pushUndo();bindSlotMeshAllToParent(s.id);changed();renderAll();};
    $('#slotAutoParentChain').onclick=()=>{if(!slotParentBoneId(s))return;pushUndo();autoBindSlotMesh(s,boneSubtreeIds(slotParentBoneId(s)));changed();renderAll();};
    $('#slotAutoSelectedChain').onclick=()=>{if(!bindBone)return;pushUndo();autoBindSlotMesh(s,boneSubtreeIds(bindBone.id));state.meshEdit.weightBoneId=bindBone.id;changed();renderAll();};
    return;
  }
  if(tab==='mesh'||tab==='weights'){
    const m=ensureSlotMesh(s);state.meshEdit.tool=tab==='weights'?'weights':'vertices';
    const sel=meshSelectedIndices(s);const selectedLabel=sel.length?sel.map(i=>'v'+i).join(', '):'none';
    const grid=slotMeshGridSize(s);const selectedFromMemory=bone(state.meshEdit.weightBoneId)||bone(state.lastBoneId)||bone(s.bone);
    if(selectedFromMemory&&!isProjectRootBone(selectedFromMemory))state.meshEdit.weightBoneId=selectedFromMemory.id;
    const weightBone=bone(state.meshEdit.weightBoneId)||selectedFromMemory;const selectedBoneOk=weightBone&&boneAffectsWeights(weightBone);
    const boneOpts=['<option value="">choose bone…</option>'].concat(bonesForSlotObject(s).map(b=>'<option value="'+b.id+'" '+(weightBone&&b.id===weightBone.id?'selected':'')+'>'+htm(b.name+' · '+boneRoleLabel(b)+(boneAffectsWeights(b)?'':' · no weights'))+'</option>')).join('');
    const selectedEdges=(typeof meshSelectedEdges==='function')?meshSelectedEdges(s):[];
    const selectedEdge=selectedEdges[0]||null;
    const selectedFaces=(typeof meshSelectedFaces==='function')?meshSelectedFaces(s):[];
    const selectedEdgeShare=selectedEdge?meshEdgeTriangleCount(m,selectedEdge[0],selectedEdge[1]):0;
    const selectedEdgeLabel=selectedEdge?('v'+selectedEdge[0]+' ↔ v'+selectedEdge[1]+' · '+selectedEdgeShare+' tri'+(selectedEdges.length>1?' · +'+(selectedEdges.length-1)+' more':'')):'none';
    const selectedFaceLabel=selectedFaces.length?selectedFaces.map(i=>'f'+i).join(', '):'none';
    const elementMode=typeof meshSelectionMode==='function'?meshSelectionMode():(state.meshEdit.selectionMode||'vertex');
    const actionTool=typeof meshActionTool==='function'?meshActionTool():(state.meshEdit.actionTool||'select');
    const gridInfo=(m.vertices.length+' verts / '+(m.triangles?.length||0)+' tris / '+((m.edges||[]).length)+' edges · '+grid.cols+'×'+grid.rows);
    if(tab==='mesh'){
      root.innerHTML=`<div class="inspector-title">Mesh Cutting <span class="tag">${gridInfo}</span></div>
        <p class="note">${htm(slotBindingStatus(s).label)} · Parent: ${htm(slotParentBoneId(s)?(bone(slotParentBoneId(s))?.name||slotParentBoneId(s)):'none')}</p>
        <label><input id="meshEnabled" type="checkbox" ${m?.enabled===true?'checked':''}> use mesh for this slot</label>
        <label><input id="meshEditToggle" type="checkbox" ${state.meshEdit?.enabled&&state.meshEdit.tool==='vertices'?'checked':''}> Edit setup vertices in viewport</label>
        <div class="mesh-mode-switch"><button id="meshToolVertices" class="on">Stay in Mesh</button><button id="meshToolWeights">Go to Weights</button></div>
        <p class="note">Rigging mode only. Use explicit Vertex / Edge / Triangle selection for setup topology. Weight setup lives in the Mesh Workbench → Weights tab.</p>
        <div class="mesh-subpanel"><div class="mesh-subpanel-title">Element selection</div>
          <div class="inline"><button id="meshSelModeVertex" class="${elementMode==='vertex'?'on':''}">Vertex 1</button><button id="meshSelModeEdge" class="${elementMode==='edge'?'on':''}">Edge 2</button><button id="meshSelModeFace" class="${elementMode==='face'?'on':''}">Triangle 3</button></div>
          <div class="inline"><button id="meshActionSelect" class="${actionTool==='select'?'on':''}">Select / Move</button><button id="meshActionKnife" class="${actionTool==='knife'?'on':''}">Knife K</button><button id="meshClearSelection">Clear selection</button></div>
          <p class="note">Selected: ${sel.length} verts · ${selectedEdges.length} edges · ${selectedFaces.length} triangles. Edge and face selection can be dragged as vertex groups.</p>
        </div>
        <div class="mesh-subpanel"><div class="mesh-subpanel-title">Grid cutter</div>
          <div class="row"><span>Columns</span><input id="meshCols" type="number" min="1" max="24" step="1" value="${grid.cols}"></div>
          <div class="row"><span>Rows</span><input id="meshRows" type="number" min="1" max="24" step="1" value="${grid.rows}"></div>
          <label><input id="meshAutoBindAfterCut" type="checkbox" checked> auto bind after rebuilding grid</label>
          <div class="inline"><button id="meshApplyGrid">Apply grid</button><button id="meshCutV">+ vertical cut</button><button id="meshCutH">+ horizontal cut</button></div>
          <div class="inline"><button id="meshQuad">Quad</button><button id="meshGrid22">Grid 2×2</button><button id="meshGrid33">Grid 3×3</button><button id="meshGrid44">Grid 4×4</button></div>
        </div>
        <div class="mesh-subpanel"><div class="mesh-subpanel-title">Topology tools</div>
          <p class="note">Edge: ${htm(selectedEdgeLabel)} · Face: ${htm(selectedFaceLabel)}. Tools keep UVs, interpolate weights and update FFD offset arrays.</p>
          <div class="inline"><button id="meshSplitEdge" ${selectedEdge?'':'disabled'}>Split edge</button><button id="meshCollapseEdge" ${selectedEdge&&m.vertices.length>3?'':'disabled'}>Collapse edge</button><button id="meshSwapEdge" ${selectedEdgeShare===2?'':'disabled'}>Swap / flip edge</button></div>
          <div class="inline"><button id="meshWeldVerts" ${sel.length>=2?'':'disabled'}>Weld selected verts</button><button id="meshDeleteElement" ${(sel.length||selectedEdges.length||selectedFaces.length)?'':'disabled'}>Delete selected element</button></div>
          <div class="inline"><button id="meshSelectBoundary">Select hull</button><button id="meshRebuildTopology">Rebuild edges/hull</button></div>
        </div>
        <div class="mesh-subpanel"><div class="mesh-subpanel-title">Vertex selection</div>
          <div class="inline"><button id="meshSelAll">All</button><button id="meshSelTop">Top row</button><button id="meshSelMid">Middle row</button><button id="meshSelBottom">Bottom row</button><button id="meshSelLeft">Left</button><button id="meshSelRight">Right</button></div>
          <p class="note">Selected verts: ${htm(selectedLabel)}. Shift-click vertices in viewport for manual multi-select, then drag them.</p>
        </div>
        <div class="inline"><button id="meshQuick">Quick Mesh + Auto Weights</button><button id="meshReset">Reset to quad</button><button id="meshClear">Clear all weights</button></div>
        <hr><div class="mesh-vertex-list">${meshWeightsSummary(s)||'No vertex data.'}</div>`;
    }else{
      root.innerHTML=`<div class="inspector-title">Mesh Weights <span class="tag">${gridInfo}</span></div>
        <p class="note">${htm(slotBindingStatus(s).label)} · Parent: ${htm(slotParentBoneId(s)?(bone(slotParentBoneId(s))?.name||slotParentBoneId(s)):'none')}</p>
        <label><input id="meshEnabled" type="checkbox" ${m?.enabled===true?'checked':''}> use mesh for this slot</label>
        <label><input id="meshEditToggle" type="checkbox" ${state.meshEdit?.enabled&&state.meshEdit.tool==='weights'?'checked':''}> Edit weights in viewport</label>
        <label><input id="meshShowWeights" type="checkbox" ${state.meshEdit?.showWeights!==false?'checked':''}> show weight heatmap</label>
        <div class="mesh-mode-switch"><button id="meshToolVertices">Go to Mesh</button><button id="meshToolWeights" class="on">Stay in Weights</button></div>
        <div class="row"><span>Weight bone</span><select id="meshWeightBone">${boneOpts}</select></div>
        <div class="row"><span>Max influences</span><input id="meshMaxInfluences" type="number" min="1" max="8" step="1" value="${state.meshEdit?.maxInfluences||4}"></div>
        <p class="note">Selected verts: ${htm(selectedLabel)}. Current weight bone: ${selectedBoneOk?htm(weightBone.name):'none'}.</p>
        ${selectedMeshInfluencesHtml(s)}
        <div class="mesh-subpanel"><div class="mesh-subpanel-title">Select vertices</div>
          <div class="inline"><button id="meshSelAll">All</button><button id="meshSelTop">Top row</button><button id="meshSelMid">Middle row</button><button id="meshSelBottom">Bottom row</button><button id="meshSelLeft">Left</button><button id="meshSelRight">Right</button></div>
        </div>
        <div class="mesh-subpanel"><div class="mesh-subpanel-title">Bind selected vertices</div>
          <div class="inline"><button id="meshBindSelected" ${selectedBoneOk&&sel.length?'':'disabled'}>Set 100% to bone</button><button id="meshAddInfluence" ${selectedBoneOk&&sel.length?'':'disabled'}>Blend +50%</button><button id="meshRemoveInfluence" ${selectedBoneOk&&sel.length?'':'disabled'}>Remove bone weight</button></div>
          <div class="inline"><button id="meshNormalize" ${sel.length?'':'disabled'}>Normalize weights</button><button id="meshPrune" ${sel.length?'':'disabled'}>Limit influences</button><button id="meshSmooth" ${sel.length?'':'disabled'}>Smooth selected weights</button></div>
        </div>
        <div class="mesh-subpanel"><div class="mesh-subpanel-title">Fast bind regions</div>
          <div class="inline"><button id="meshBindTop" ${selectedBoneOk?'':'disabled'}>Top 100% → bone</button><button id="meshBindBottom" ${selectedBoneOk?'':'disabled'}>Bottom 100% → bone</button><button id="meshBindLeft" ${selectedBoneOk?'':'disabled'}>Left 100% → bone</button><button id="meshBindRight" ${selectedBoneOk?'':'disabled'}>Right 100% → bone</button><button id="meshBindAll" ${selectedBoneOk?'':'disabled'}>All 100% → bone</button></div>
        </div>
        <div class="inline"><button id="meshAutoAll">Auto bind object bones</button><button id="meshAutoChain" ${selectedBoneOk?'':'disabled'}>Auto Bind Selected Bones</button><button id="meshClear">Clear all weights</button></div>
        <hr><div class="mesh-vertex-list">${meshWeightsSummary(s)||'No weights yet.'}</div>`;
    }
    const selectedIds=()=>meshSelectedIndices(s);
    const autoIds=()=>selectedBoneOk?boneSubtreeIds(weightBone.id):allMeshCandidateBoneIds(s.id);
    $('#meshEnabled').onchange=e=>{pushUndo();m.enabled=e.target.checked;changed();renderAll();};
    $('#meshEditToggle').onchange=e=>{setMeshContext(tab==='weights'?'weights':'vertices',e.target.checked);state.inspectorTab=tab;renderAll();};
    if($('#meshShowWeights'))$('#meshShowWeights').onchange=e=>{state.meshEdit.showWeights=e.target.checked;renderAll();};
    if($('#meshToolVertices'))$('#meshToolVertices').onclick=()=>{state.inspectorTab='mesh';setMeshContext('vertices',true);renderAll();};
    if($('#meshToolWeights'))$('#meshToolWeights').onclick=()=>{state.inspectorTab='weights';setMeshContext('weights',true);renderAll();};
    if($('#meshSelModeVertex'))$('#meshSelModeVertex').onclick=()=>{setMeshSelectionMode('vertex');renderInspector();};
    if($('#meshSelModeEdge'))$('#meshSelModeEdge').onclick=()=>{setMeshSelectionMode('edge');renderInspector();};
    if($('#meshSelModeFace'))$('#meshSelModeFace').onclick=()=>{setMeshSelectionMode('face');renderInspector();};
    if($('#meshActionSelect'))$('#meshActionSelect').onclick=()=>{setMeshActionTool('select');renderInspector();};
    if($('#meshActionKnife'))$('#meshActionKnife').onclick=()=>{setMeshActionTool(actionTool==='knife'?'select':'knife');renderInspector();};
    if($('#meshClearSelection'))$('#meshClearSelection').onclick=()=>{clearMeshElementSelection();renderAll();};
    if($('#meshWeightBone'))$('#meshWeightBone').onchange=e=>{state.meshEdit.weightBoneId=e.target.value||null;renderAll();};
    if($('#meshMaxInfluences'))$('#meshMaxInfluences').onchange=e=>{state.meshEdit.maxInfluences=clamp(parseInt(e.target.value,10)||4,1,8);renderAll();};
    const selectRegion=r=>{selectSlotMeshRegion(s,r);state.meshEdit.enabled=true;state.inspectorTab=tab;renderAll();};
    ['All','Top','Mid','Bottom','Left','Right'].forEach(name=>{const el=$('#meshSel'+name);if(el)el.onclick=()=>selectRegion(name==='Mid'?'middle':name.toLowerCase());});
    const rebuild=(c,r)=>{pushUndo();rebuildSlotMeshGrid(s,c,r,{autoBind:$('#meshAutoBindAfterCut')?.checked,boneIds:autoIds()});state.meshEdit.enabled=true;state.inspectorTab='mesh';changed();renderAll();};
    if($('#meshApplyGrid'))$('#meshApplyGrid').onclick=()=>rebuild($('#meshCols').value,$('#meshRows').value);
    if($('#meshCutV'))$('#meshCutV').onclick=()=>rebuild(grid.cols+1,grid.rows);
    if($('#meshCutH'))$('#meshCutH').onclick=()=>rebuild(grid.cols,grid.rows+1);
    if($('#meshQuick'))$('#meshQuick').onclick=()=>{pushUndo();rebuildSlotMeshGrid(s,3,3,{autoBind:true,boneIds:autoIds()});state.meshEdit.enabled=true;state.meshEdit.tool='weights';state.meshEdit.showWeights=true;state.inspectorTab='weights';changed();renderAll();};
    if($('#meshQuad'))$('#meshQuad').onclick=()=>rebuild(1,1);
    if($('#meshGrid22'))$('#meshGrid22').onclick=()=>rebuild(2,2);
    if($('#meshGrid33'))$('#meshGrid33').onclick=()=>rebuild(3,3);
    if($('#meshGrid44'))$('#meshGrid44').onclick=()=>rebuild(4,4);
    const applyTopology=fn=>{pushUndo();const ok=fn();if(!ok){state.undo.pop();return;}state.meshEdit.enabled=true;state.inspectorTab='mesh';changed();renderAll();};
    if($('#meshSplitEdge'))$('#meshSplitEdge').onclick=()=>applyTopology(()=>splitSlotMeshSelectedEdge(s));
    if($('#meshCollapseEdge'))$('#meshCollapseEdge').onclick=()=>applyTopology(()=>collapseSlotMeshSelectedEdge(s));
    if($('#meshSwapEdge'))$('#meshSwapEdge').onclick=()=>applyTopology(()=>swapSlotMeshSelectedEdge(s));
    if($('#meshWeldVerts'))$('#meshWeldVerts').onclick=()=>applyTopology(()=>weldSelectedMeshVertices(s));
    if($('#meshDeleteElement'))$('#meshDeleteElement').onclick=()=>applyTopology(()=>deleteSelectedMeshElements(s));
    if($('#meshSelectBoundary'))$('#meshSelectBoundary').onclick=()=>{selectSlotMeshBoundary(s);state.meshEdit.enabled=true;state.inspectorTab='mesh';renderAll();};
    if($('#meshRebuildTopology'))$('#meshRebuildTopology').onclick=()=>applyTopology(()=>rebuildSlotMeshTopology(s));
    if($('#meshReset'))$('#meshReset').onclick=()=>{pushUndo();ensureSlotMesh(s,true);s.mesh.enabled=true;changed();renderAll();};
    if($('#meshClear'))$('#meshClear').onclick=()=>{pushUndo();clearSlotMeshWeights(s);changed();renderAll();};
    if($('#meshBindSelected'))$('#meshBindSelected').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,selectedIds(),'replace');state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    if($('#meshAddInfluence'))$('#meshAddInfluence').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,selectedIds(),'add',.5);state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    if($('#meshRemoveInfluence'))$('#meshRemoveInfluence').onclick=()=>{pushUndo();removeSlotMeshBoneInfluence(s,weightBone.id,selectedIds());state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    if($('#meshNormalize'))$('#meshNormalize').onclick=()=>{pushUndo();normalizeSlotMeshVertices(s,selectedIds());changed();renderAll();};
    if($('#meshPrune'))$('#meshPrune').onclick=()=>{pushUndo();pruneSlotMeshVertices(s,selectedIds());changed();renderAll();};
    if($('#meshBindTop'))$('#meshBindTop').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,meshSelectionByRegion(s,'top'));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    if($('#meshBindBottom'))$('#meshBindBottom').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,meshSelectionByRegion(s,'bottom'));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    if($('#meshBindLeft'))$('#meshBindLeft').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,meshSelectionByRegion(s,'left'));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    if($('#meshBindRight'))$('#meshBindRight').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id,meshSelectionByRegion(s,'right'));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    if($('#meshBindAll'))$('#meshBindAll').onclick=()=>{pushUndo();bindSlotMeshVerticesToBone(s,weightBone.id);state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    if($('#meshAutoAll'))$('#meshAutoAll').onclick=()=>{pushUndo();autoBindSlotMesh(s,allMeshCandidateBoneIds(s.id));changed();renderAll();};
    if($('#meshAutoChain'))$('#meshAutoChain').onclick=()=>{pushUndo();autoBindSlotMesh(s,boneSubtreeIds(weightBone.id));state.meshEdit.weightBoneId=weightBone.id;changed();renderAll();};
    if($('#meshSmooth'))$('#meshSmooth').onclick=()=>{pushUndo();smoothSlotMeshWeights(s,selectedIds());changed();renderAll();};
    return;
  }
  if(tab==='deform'){
    const m=ensureSlotMesh(s);m.enabled=true;const keys=(state.anim.deformTracks||{})[s.id]||[];const has=currentSlotDeformHasAny(s);const sel=meshSelectedIndices(s);
    root.innerHTML=`<div class="inspector-title">FFD Deform <span class="tag">${htm(s.name)}</span></div>
      <p class="note">Animation-only vertex offsets. Rigging Mesh edits setup geometry; this tab stores shape keys on the animation timeline.</p>
      <div class="binding-summary">
        <div class="summary-line"><span>Mesh</span><b>${m.vertices.length} verts · ${slotMeshGridSize(s).cols}×${slotMeshGridSize(s).rows}</b></div>
        <div class="summary-line"><span>Deform keys</span><b>${keys.length}</b></div>
        <div class="summary-line"><span>Current pose</span><b>${has?'has offsets':'neutral'}</b></div>
        <div class="summary-line"><span>Selected verts</span><b>${sel.length||'none'}</b></div>
      </div>
      <label class="check"><input id="ffdEditToggle" type="checkbox" ${state.meshEdit.enabled&&state.meshEdit.tool==='deform'?'checked':''}> Edit FFD vertices in viewport</label>
      <div class="inline"><button id="ffdKey">Key FFD</button><button id="ffdReset">Reset current FFD pose</button><button id="ffdDeleteKey" class="bad">Delete FFD key @ time</button></div>
      <div class="inline"><button id="ffdSelectAll">Select all verts</button><button id="ffdClearSel">Clear selection</button></div>
      <hr><div class="mesh-vertex-list">${meshDeformSummary(s)}</div>`;
    $('#ffdEditToggle').onchange=e=>{setMeshContext('deform',e.target.checked);state.meshEdit.showWeights=false;renderAll();};
    $('#ffdKey').onclick=()=>{pushUndo();writeDeformKey(s.id);const kt=roundTime(state.currentTime);selectSingleKey('deform',s.id,kt);changed();renderTimeline();renderInspector();};
    $('#ffdReset').onclick=()=>{pushUndo();if(sel.length){for(const i of sel)setSlotDeformOffset(s,i,0,0);}else clearSlotDeformPose(s);writeDeformKey(s.id);changed();renderAll();};
    $('#ffdDeleteKey').onclick=()=>{pushUndo();deleteDeformKeyAtTime(s.id,state.currentTime);changed();renderTimeline();renderInspector();};
    $('#ffdSelectAll').onclick=()=>{setMeshSelectedIndices(m.vertices.map((_,i)=>i));setMeshContext('deform',true);renderAll();};
    $('#ffdClearSel').onclick=()=>{setMeshSelectedIndices([]);renderAll();};
    return;
  }
  if(tab==='animation'){
    const keys=(state.anim.slotTracks||{})[s.id]||[];root.innerHTML=`<p class="note">${keys.length} key(s). Slot keys store visibility, alpha, tint/color mix, blend mode, attachment and local transform.</p><div class="inline"><button id="sKey">Key slot</button><button id="sDelKey" class="bad">Delete key @ time</button></div>`;$('#sKey').onclick=()=>{pushUndo();writeSlotKey(s.id);changed();renderTimeline();};$('#sDelKey').onclick=deleteKey;return;
  }
  root.innerHTML=rawBlock(s);
}
function renderMarkerInspector(root){
  const m=selectedMarker();if(!m){root.innerHTML='<div class="empty">No marker selected</div>';return;}const tab=state.inspectorTab;
  if(tab==='transform'){
    root.innerHTML=`<div class="inspector-title">${htm(m.name)} <span class="tag">${m.type}</span></div><div class="row"><span>X</span><input id="mX" type="number" step="1" value="${m.x}"></div><div class="row"><span>Y</span><input id="mY" type="number" step="1" value="${m.y}"></div><div class="row"><span>Rot</span><input id="mR" type="number" step="1" value="${m.r}"></div><div class="row"><span>W</span><input id="mW" type="number" step="1" value="${m.w}"></div><div class="row"><span>H</span><input id="mH" type="number" step="1" value="${m.h}"></div>`;[['#mX','x'],['#mY','y'],['#mR','r'],['#mW','w'],['#mH','h']].forEach(([id,k])=>$(id).onchange=e=>{pushUndo();m[k]=parseFloat(e.target.value)||0;changed();renderAll();});return;
  }
  if(tab==='object'){
    const boneOpts=['<option value="">none</option>'].concat(state.bones.map(b=>'<option value="'+b.id+'" '+(b.id===m.bone?'selected':'')+'>'+htm(b.name)+'</option>')).join('');
    root.innerHTML=`<div class="row"><span>ID</span><input value="${m.id}" disabled></div><div class="row"><span>Name</span><input id="mName" value="${htm(m.name)}"></div><div class="row"><span>Type</span><input value="${m.type}" disabled></div><div class="row"><span>Bone</span><select id="mBone">${boneOpts}</select></div><div class="row"><span>Visible</span><input id="mVis" type="checkbox" ${m.visible?'checked':''}></div><hr><button id="mDel" class="bad">Delete marker</button>`;$('#mName').onchange=e=>{pushUndo();m.name=e.target.value||m.id;changed();renderAll();};$('#mBone').onchange=e=>{pushUndo();m.bone=e.target.value||null;changed();renderAll();};$('#mVis').onchange=e=>{pushUndo();m.visible=e.target.checked;changed();renderAll();};$('#mDel').onclick=deleteSelected;return;
  }
  root.innerHTML=rawBlock(m);
}

function renderDocumentPanel(){
  const root=$('#documentPanel');if(!root)return;refreshDocumentChrome?.();
  if(state.documentType==='none'){root.innerHTML='<div class="empty">No document. Click New Project.</div>';return;}
  if(state.documentType==='game'){root.innerHTML=`<div class="binding-summary"><div class="summary-line"><span>Document</span><b>GameDoc</b></div><div class="summary-line"><span>Objects</span><b>${state.objects.length}</b></div></div>`;return;}
  const t=ensureToon(),rx=ensureRenderExportSettings?ensureRenderExportSettings():{scope:'sequence',output:'final',range:'clip',busy:false,lastMessage:''};
  const layerRows=sortedRenderLayers().map(l=>`<div class="doc-layer-row"><span>${htm(l.name)}</span><input data-layer-vis="${l.id}" type="checkbox" ${l.visible!==false?'checked':''}><input data-layer-order="${l.id}" type="number" value="${Number(l.order||0)}"></div>`).join('');
  const frameCount=renderExportFrameCount?renderExportFrameCount(rx.scope,rx.range):1;
  root.innerHTML=`<div class="mesh-subpanel"><div class="mesh-subpanel-title">Render Layers / Passes</div>${layerRows}<div class="inline"><button id="toonAddLayer">Add layer</button></div></div>
  <div class="mesh-subpanel">
    <div class="mesh-subpanel-title">PNG Render</div>
    <div class="row"><span>Scope</span><select id="renderScope"><option value="current" ${rx.scope==='current'?'selected':''}>Current frame</option><option value="sequence" ${rx.scope==='sequence'?'selected':''}>Animation sequence</option></select></div>
    <div class="row"><span>Range</span><select id="renderRange"><option value="clip" ${rx.range==='clip'?'selected':''}>Whole clip</option><option value="timeline" ${rx.range==='timeline'?'selected':''}>Timeline range</option></select></div>
    <div class="row"><span>Output</span><select id="renderOutput"><option value="final" ${rx.output==='final'?'selected':''}>Final PNG</option><option value="passes" ${rx.output==='passes'?'selected':''}>Layer passes</option><option value="both" ${rx.output==='both'?'selected':''}>Final + passes</option></select></div>
    <div class="inline"><button id="renderPngBtn" ${rx.busy?'disabled':''}>${rx.busy?'Rendering…':'Render PNG'}</button></div>
    <p class="note">${htm(state.anim?.name||'anim')} · ${Number(state.anim?.duration||0).toFixed(2)}s @ ${Math.max(1,Number(state.anim?.fps||24))} fps → ${frameCount} frame(s).</p>
    <p class="note">Writes PNG files to a folder you choose. Final render uses ToonDoc canvas size and active camera. Pass mode writes one folder per visible render pass/layer.</p>
    ${rx.lastMessage?`<p class="note">${htm(rx.lastMessage)}</p>`:''}
  </div>`;
  const save=()=>{changed();renderAll();};
  $$('[data-layer-vis]',root).forEach(el=>el.onchange=e=>{const l=renderLayerById(e.target.dataset.layerVis);if(l)l.visible=e.target.checked;save();});
  $$('[data-layer-order]',root).forEach(el=>el.onchange=e=>{const l=renderLayerById(e.target.dataset.layerOrder);if(l)l.order=Number(e.target.value)||0;save();});
  $('#toonAddLayer').onclick=()=>{const id='layer'+(t.renderLayers.length+1);t.renderLayers.push({id,name:'Layer '+t.renderLayers.length,order:t.renderLayers.length*10,visible:true,locked:false});save();};
  const rerenderDoc=()=>{if(typeof renderDocumentPanel==='function')renderDocumentPanel();};
  if($('#renderScope'))$('#renderScope').onchange=e=>{ensureRenderExportSettings().scope=e.target.value;rerenderDoc();};
  if($('#renderRange'))$('#renderRange').onchange=e=>{ensureRenderExportSettings().range=e.target.value;rerenderDoc();};
  if($('#renderOutput'))$('#renderOutput').onchange=e=>{ensureRenderExportSettings().output=e.target.value;rerenderDoc();};
  if($('#renderPngBtn'))$('#renderPngBtn').onclick=()=>renderPngSequenceToFolder({scope:ensureRenderExportSettings().scope,range:ensureRenderExportSettings().range,output:ensureRenderExportSettings().output});
}

function renderProjectHealth(){
  const root=$('#projectHealth');if(!root)return;const warnings=state.health?.warnings||[];
  if(!warnings.length){root.innerHTML=state.health?.lastRun?'<div class="health-ok">No blocking issues found.</div>':'Run validation to inspect rig / animation issues.';return;}
  root.innerHTML=warnings.map(w=>'<div class="health-item '+(w.severity||'warn')+'"><strong>'+htm(w.severity||'warn')+'</strong> '+htm(w.message)+'</div>').join('');
}
