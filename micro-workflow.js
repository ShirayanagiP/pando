/* Microscale election workflow UI; ordinary map legends stay independent. */
window.PandoMicroUI={create({data,getProject,mutate,toast,openColor,locateRegion,locateDistrict,changeStage,confirm,activateBrush}){
  const E=window.PandoElections,$=id=>document.getElementById(id),regions=new Map(data.regions.map(r=>[r.id,r]));
  const selected=new Set(),opened=new Set(),closed=new Set(),regionExpanded=new Map(),regionMemberCounts=new Map();
  let electionLimit=30,regionLimit=40,seatLimit=40,basePickerOpen=false;
  const config=()=>E.configuration(getProject(),data),normalize=s=>String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  const matches=(s,query)=>String(query).trim().split(/\s+/).filter(Boolean).every(q=>normalize(s).includes(normalize(q)));
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const button=(name,action,cls='text-button')=>{const b=make('button',cls,name);b.type='button';b.addEventListener('click',action);return b;};
  function option(select,id,name){const o=make('option','',name);o.value=id;select.appendChild(o);}
  function select(items,value,label,onChange,empty='미배정'){
    const s=make('select');s.setAttribute('aria-label',label);option(s,'',empty);for(const item of items)option(s,item.id,item.name);s.value=value||'';
    s.addEventListener('change',()=>onChange(s.value));return s;
  }
  function checkbox(label,checked,action){const n=make('input');n.type='checkbox';n.checked=checked;n.setAttribute('aria-label',label);n.addEventListener('change',()=>action(n.checked));return n;}
  function apply(fn,fullRender=true){try{mutate(fn,fullRender);return true;}catch(error){toast(error.message);return false;}}
  function editable(value,label,onChange){
    const input=make('input','workflow-name');input.value=value;input.maxLength=60;input.setAttribute('aria-label',label);let committed=value;
    const commit=()=>{const next=input.value.trim();if(!next){input.value=committed;return;}if(next===committed)return;committed=next;apply(()=>onChange(next));};
    input.addEventListener('change',commit);input.addEventListener('blur',commit);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();input.blur();}});return input;
  }
  function refresh(){
    $('election-selection-count').textContent=`${selected.size}개 읍면동 선택`;$('election-move').disabled=!selected.size;$('election-clear-selection').disabled=!selected.size;
    for(const n of $('election-list').querySelectorAll('[data-member-check]'))n.checked=selected.has(n.dataset.memberCheck);
    for(const n of $('election-list').querySelectorAll('[data-district-check]')){
      const d=n.dataset.districtCheck==='unassigned'?{memberIds:E.unassigned(getProject(),data)}:E.districtFor(data,n.dataset.districtCheck,getProject());
      if(!d)continue;const count=d.memberIds.filter(id=>selected.has(id)).length;n.checked=count>0&&count===d.memberIds.length;n.indeterminate=count>0&&count<d.memberIds.length;
    }
    const totals=E.seatTotals(getProject(),data);
    for(const node of $('party-list').querySelectorAll('[data-party-count]'))node.textContent=(totals.national.byParty[node.dataset.partyCount]||0)+'석';
    $('seat-summary').textContent=`지역구 ${totals.districtNational.assigned} / ${totals.districtNational.total}석 | 비례대표 ${totals.proportionalNational.total}석 | 배정 합계 ${totals.national.assigned}석 | 지역구 미배정 ${totals.districtNational.unassigned}석`;
    const c=config();
    for(const row of $('regional-seat-summary').querySelectorAll('[data-pr-scope]')){const counts=row.dataset.prScope==='region'?c.proportionalSeats?.regions[row.dataset.prRegion]:c.proportionalSeats?.[row.dataset.prScope];row.lastElementChild.textContent=c.parties.reduce((sum,p)=>sum+(counts?.[p.id]||0),0);}
    const totalRow=$('regional-seat-summary').querySelector('.seat-total-row');if(totalRow){const cells=totalRow.querySelectorAll('td');if(cells.length===c.parties.length+2){c.parties.forEach((p,i)=>{cells[i].textContent=totals.national.byParty[p.id]||0;});cells[c.parties.length].textContent=totals.national.unassigned;cells[c.parties.length+1].textContent=totals.national.total;}}
  }
  function districtList(){
    const c=config(),query=$('election-search').value,sido=$('election-sido').value;
    return c.districts.filter(d=>(!sido||d.sido===sido)&&matches(d.name+' '+d.sido+' '+d.memberIds.map(id=>{const r=regions.get(id);return r.sourceName+' '+r.englishName+' '+r.provinceEnglishName;}).join(' '),query));
  }
  function renderDistricts(){
    const c=config(),list=$('election-list'),all=districtList();list.replaceChildren();
    const unassigned=E.unassigned(getProject(),data);
    $('election-result-count').textContent=`${all.length} / ${c.districts.length}개 선거구 | ${unassigned.length}개 읍면동 미배정`;
    const target=$('election-move-target'),old=target.value;target.replaceChildren();option(target,'','미배정으로 이동');
    for(const d of c.districts)option(target,d.id,(d.sido?d.sido+' ':'')+d.name);target.value=c.districts.some(d=>d.id===old)?old:'';
    const search=$('election-search').value.trim();
    function card(d,isUnassigned=false){
      const node=make('section','legend-family election-card');node.dataset.election=d.id;node.classList.toggle('editing',c.activeDistrictId===d.id);
      const root=make('div','legend-row election-root'),allCheck=checkbox(d.name+' 읍면동 전체 선택',false,on=>{for(const id of d.memberIds)on?selected.add(id):selected.delete(id);refresh();});allCheck.dataset.districtCheck=d.id;root.appendChild(allCheck);
      const expanded=opened.has(d.id)||!closed.has(d.id)&&search&&all.length<=8;
      const toggle=button(expanded?'⌃':'⌄',()=>{const on=body.hidden;body.hidden=!on;toggle.textContent=on?'⌃':'⌄';toggle.setAttribute('aria-expanded',String(on));on?(opened.add(d.id),closed.delete(d.id)):(opened.delete(d.id),closed.add(d.id));},'workflow-expand');toggle.setAttribute('aria-label',d.name+' 소속 읍면동 펼치기');toggle.setAttribute('aria-expanded',String(!!expanded));root.appendChild(toggle);
      if(isUnassigned)root.appendChild(make('strong','workflow-district-title',d.name));
      else root.appendChild(editable(d.name,d.name+' 선거구 이름',name=>E.renameDistrict(getProject(),data,d.id,name)));
      root.appendChild(make('span','legend-count',d.memberIds.length));
      if(!isUnassigned)root.appendChild(button('×',()=>{apply(()=>E.deleteDistrict(getProject(),data,d.id));selected.clear();toast('선거구를 삭제했습니다. 소속 읍면동은 미배정으로 옮겼습니다.');},'workflow-remove'));
      root.lastElementChild?.setAttribute('aria-label',isUnassigned?d.name:d.name+' 선거구 삭제');node.appendChild(root);
      const sub=make('div','workflow-district-sub');sub.appendChild(make('span','',d.sido||''));
      if(!isUnassigned){sub.appendChild(button(c.activeDistrictId===d.id?'지도 편집 중':'지도에서 편집',()=>{apply(()=>{c.activeDistrictId=d.id;});toast(d.name+' 선택 | 지도에서 읍면동을 클릭·드래그해 배정하세요.');}));if(d.memberIds.length)sub.appendChild(button('확대',()=>locateDistrict(d)));}node.appendChild(sub);
      const body=make('div','election-members');body.hidden=!expanded;
      const members=isUnassigned&&search?d.memberIds.filter(id=>matches(regions.get(id).sourceName+' '+regions.get(id).englishName,search)):d.memberIds;
      const shown=isUnassigned?members.slice(0,100):members;
      for(const id of shown){const r=regions.get(id),row=make('div','legend-row election-member'),check=checkbox(r.sourceName+' 선택',selected.has(id),on=>{on?selected.add(id):selected.delete(id);refresh();});check.dataset.memberCheck=id;
        row.append(check,button(r.name,()=>locateRegion(id),'election-member-name'),button('옮기기',()=>{selected.clear();selected.add(id);refresh();$('election-move-target').focus();},'text-button'));row.title=r.sourceName;body.appendChild(row);}
      if(isUnassigned&&members.length>100)body.appendChild(make('p','section-hint','처음 100개를 표시합니다. 검색으로 읍면동을 좁혀 찾을 수 있습니다.'));
      if(!d.memberIds.length)body.appendChild(make('p','section-hint','읍면동을 선택해 이 선거구로 옮기세요.'));node.appendChild(body);list.appendChild(node);
    }
    if(unassigned.length){const d={id:'unassigned',name:'미배정 읍면동',sido:'',memberIds:unassigned};if(!search||unassigned.some(id=>matches(regions.get(id).sourceName,search)))card(d,true);}
    for(const d of all.slice(0,electionLimit))card(d);
    if(!all.length&&!unassigned.length)list.appendChild(make('p','election-empty','검색 결과가 없습니다.'));
    $('election-more').hidden=all.length<=electionLimit;$('election-more').textContent=`선거구 더 보기 | ${Math.min(all.length,electionLimit)} / ${all.length}`;refresh();
  }
  function regionOptions(){return config().regions;}
  function regionDistricts(){return config().districts.filter(d=>matches(d.name+' '+d.sido,$('region-district-search').value));}
  function syncRegionBulk(){
    const filtered=regionDistricts(),target=$('region-bulk-target').value;
    $('region-bulk-assign').disabled=!filtered.length||!config().regions.some(r=>r.id===target);
    $('region-bulk-assign').textContent=`검색 결과 ${filtered.length}개 전체 배정`;
  }
  function renderRegions(){
    const c=config(),list=$('electoral-region-list');list.replaceChildren();
    if(!c.regions.length)list.appendChild(make('p','election-empty','아직 만든 권역이 없습니다. 권역 없이 의석 단계로 넘어가도 됩니다.'));
    for(const region of c.regions){
      const card=make('section','legend-family election-card electoral-region-card'),row=make('div','legend-row'),districts=c.districts.filter(d=>d.regionId===region.id);card.dataset.electoralRegion=region.id;
      if((regionMemberCounts.get(region.id)??0)<=8&&districts.length>8)regionExpanded.set(region.id,false);regionMemberCounts.set(region.id,districts.length);
      const expanded=regionExpanded.get(region.id)??districts.length<=8;
      const toggle=button(expanded?'⌃':'⌄',()=>{regionExpanded.set(region.id,!expanded);renderRegions();},'workflow-expand');toggle.setAttribute('aria-label',region.name+' 소속 선거구 펼치기');toggle.setAttribute('aria-expanded',String(expanded));
      row.append(toggle,editable(region.name,region.name+' 권역 이름',name=>{region.name=name;}),make('span','legend-count',districts.length),button('×',()=>apply(()=>E.deleteRegion(getProject(),data,region.id)),'workflow-remove'));row.lastElementChild.setAttribute('aria-label',region.name+' 권역 삭제');card.appendChild(row);
      const body=make('div','election-members');body.hidden=!expanded;
      if(expanded)for(const d of districts){const member=make('div','legend-row');member.append(make('span','election-member-name',d.name),button('해제',()=>apply(()=>E.assignRegion(getProject(),data,[d.id],null))));body.appendChild(member);}
      card.appendChild(body);if(!expanded)card.appendChild(button(`${districts.length}개 선거구 펼치기`,()=>{regionExpanded.set(region.id,true);renderRegions();},'region-collapsed-summary'));list.appendChild(card);
    }
    const target=$('region-bulk-target'),previous=target.value;target.replaceChildren();option(target,'','배정할 권역 선택');
    for(const region of c.regions)option(target,region.id,region.name);target.value=c.regions.some(r=>r.id===previous)?previous:'';syncRegionBulk();
    const filtered=regionDistricts(),assignment=$('region-district-list');assignment.replaceChildren();
    $('region-district-count').textContent=`${filtered.length}개 선거구 | 권역은 선택 사항`;
    for(const d of filtered.slice(0,regionLimit)){const row=make('div','workflow-assignment-row');row.dataset.district=d.id;row.append(make('span','',d.sido+' '+d.name),select(regionOptions(),d.regionId,d.name+' 권역 배정',id=>apply(()=>E.assignRegion(getProject(),data,[d.id],id)),'권역 미지정'));assignment.appendChild(row);}
    $('region-district-more').hidden=filtered.length<=regionLimit;
  }
  function renderSeats(){
    const c=config(),totals=E.seatTotals(getProject(),data),list=$('party-list');list.replaceChildren();
    for(const party of c.parties){
      const card=make('div','legend-family party-card');card.classList.toggle('active',c.activePartyId===party.id);
      const chip=button('',()=>openColor(party,chip,color=>apply(()=>{party.color=color;c.activePartyId=party.id;c.activeShade=0;})),'legend-color');chip.style.background=party.color;chip.setAttribute('aria-label',party.name+' 정당 색상 변경');chip.setAttribute('aria-haspopup','dialog');
      const choose=button(c.activePartyId===party.id?'선택됨':'선택',()=>{basePickerOpen=false;apply(()=>{c.activePartyId=party.id;c.activeShade=0;});activateBrush();});choose.setAttribute('aria-label',party.name+' 색칠 선택');choose.setAttribute('aria-pressed',String(c.activePartyId===party.id));
      const count=make('strong','party-count',(totals.national.byParty[party.id]||0)+'석');count.dataset.partyCount=party.id;
      const remove=button('×',()=>{if(apply(()=>E.deleteParty(getProject(),data,party.id)))toast(party.name+' 정당을 삭제했습니다. 실행 취소로 되돌릴 수 있습니다.');},'workflow-remove');remove.setAttribute('aria-label',party.name+' 정당 삭제');remove.disabled=party.id==='independent';remove.title=remove.disabled?'무소속은 고정 항목입니다.':'정당 삭제';
      card.append(chip,editable(party.name,party.name+' 정당 이름',name=>{party.name=name;}),count,choose,remove);list.appendChild(card);
    }
    const regional=$('regional-seat-summary');regional.replaceChildren();
    const table=make('table','regional-seat-table'),thead=make('thead'),head=make('tr');for(const label of ['권역',...c.parties.map(p=>p.name),'미배정','합계']){const th=make('th','',label);th.scope='col';head.appendChild(th);}thead.appendChild(head);table.appendChild(thead);const tbody=make('tbody');table.appendChild(tbody);
    function countRow(name,counts,cls=''){const tr=make('tr',cls),heading=make('th','',name);heading.scope='row';tr.appendChild(heading);for(const p of c.parties)tr.appendChild(make('td','',counts.byParty[p.id]||0));tr.append(make('td','',counts.unassigned),make('td','',counts.total));tbody.appendChild(tr);}
    function proportionalRow(name,scope,regionId,counts){
      const tr=make('tr','proportional-row'),heading=make('th','',scope==='national'?'비례대표 (전국)':'└ 비례대표');heading.scope='row';tr.dataset.prScope=scope;tr.dataset.prRegion=regionId||'';tr.appendChild(heading);
      for(const party of c.parties){const td=make('td'),input=make('input','proportional-seat-input');input.type='number';input.min='0';input.max=String(Number.MAX_SAFE_INTEGER);input.step='1';input.value=counts.byParty[party.id]||0;input.setAttribute('aria-label',name+' '+party.name+' 비례대표 의석');let previous=input.value;
        const commit=()=>{const next=input.value.trim()||'0';if(next===previous)return;let accepted=false;apply(()=>{E.setProportionalSeats(getProject(),data,scope,regionId,party.id,next);accepted=true;},false);if(accepted){previous=next;input.value=next;}else input.value=previous;};
        input.addEventListener('change',commit);input.addEventListener('blur',commit);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit();input.blur();}});td.appendChild(input);tr.appendChild(td);}
      tr.append(make('td','','—'),make('td','',counts.total));tbody.appendChild(tr);
    }
    for(const r of [...totals.regions,{id:null,name:'권역 미지정',...totals.unregionalized}]){countRow(r.name+' (지역구)',r);if(c.proportionalRegional)proportionalRow(r.name,r.id?'region':'unregionalized',r.id,r.proportional);}
    if(!c.proportionalRegional)proportionalRow('전국','national',null,totals.proportionalNational);
    countRow('합계',totals.national,'seat-total-row');regional.appendChild(table);
    $('proportional-settings').setAttribute('aria-pressed',String(c.proportionalRegional===true));$('proportional-mode').textContent=c.proportionalRegional?'권역별 비례대표 입력 중':'전국 단위 비례대표 입력 중';
    const query=$('seat-district-search').value,filtered=E.eligible(getProject()).filter(d=>matches(d.name+' '+d.sido+' '+(c.regions.find(r=>r.id===d.regionId)?.name||''),query)),assignment=$('seat-district-list');assignment.replaceChildren();
    $('seat-district-count').textContent=`${filtered.length}개 선거구 | 각 1석`;
    for(const d of filtered.slice(0,seatLimit)){const row=make('div','workflow-assignment-row');row.dataset.district=d.id;row.append(button(d.sido+' '+d.name,()=>locateDistrict(d),'workflow-seat-locate'),select(c.parties,c.partyAssignments[d.id],d.name+' 의석 정당',id=>apply(()=>E.assignParty(getProject(),data,d.id,id)),'의석 미배정'));assignment.appendChild(row);}
    $('seat-district-more').hidden=filtered.length<=seatLimit;refresh();
  }
  function render(stage){
    const c=config();
    for(const [id,on] of [['micro-region-borders',c.showRegionBorders],['micro-election-borders',c.showBorders],['micro-detail-paint',c.detailPainting]])$(id).setAttribute('aria-pressed',String(!!on));
    $('micro-detail-paint').hidden=stage!=='seats';$('micro-clear-paint').hidden=stage!=='seats';
    $('micro-paint-hint').textContent=stage==='seats'?(c.detailPainting?'읍면동 세부 색칠 | 의석 배정 유지':'선거구 색칠 | 의석 자동 배정'):'읍면동 경계와 선거구 경계를 각각 켜고 끌 수 있습니다.';
    $('micro-border-color').value=c.borderColor||'#586f60';$('micro-border-preview').style.background=c.borderColor||'#586f60';
    $('micro-border-width').value=E.strokeWidth(c.borderWidth);$('micro-show-caption').checked=getProject().settings.legend;
    $('party-palette-note').textContent=c.detailPainting?'세부 색칠은 의석 배정에 영향을 주지 않습니다.':'선거구를 칠하면 선택한 정당에 의석이 배정됩니다.';
    renderPalette();
    if(stage==='election')renderDistricts();else if(stage==='regions')renderRegions();else if(stage==='seats')renderSeats();
    const steps=['election','regions','seats'],index=steps.indexOf(stage);
    $('workflow-navigation').hidden=index<0;$('workflow-prev').disabled=index<=0;$('workflow-next').disabled=index===2;
    $('workflow-step').textContent=index>=0?`${index+1} / 3 | ${['선거구 획정','권역 배정 | 선택','정당별 의석 배정'][index]}`:'';
    $('workflow-next').textContent=index===0?'다음 | 권역':index===1?'다음 | 의석':'완료';
  }
  function renderPalette(){
    const c=config();if(c.stage!=='seats')return;
    const party=c.parties.find(p=>p.id===c.activePartyId)||c.parties[0],tones=E.shades(party.color),list=$('party-shades');list.replaceChildren();
    $('party-palette-name').textContent=party.name+' | '+tones.find(t=>t.shade===(c.activeShade||0)).name;
    $('base-color-controls').hidden=!basePickerOpen;$('party-base-toggle').setAttribute('aria-expanded',String(basePickerOpen));
    for(const tone of tones){const b=button('',()=>{apply(()=>{c.activeShade=tone.shade;});activateBrush();},'swatch');b.style.background=tone.color;b.dataset.shade=tone.shade;b.title=party.name+' '+tone.name+' '+tone.color.toUpperCase();b.setAttribute('aria-label',party.name+' '+tone.name);b.setAttribute('aria-pressed',String(tone.shade===(c.activeShade||0)));b.classList.toggle('selected',tone.shade===(c.activeShade||0));if(tone.shade===(c.activeShade||0))b.textContent='✓';list.appendChild(b);}
  }
  function paintRegion(id,erase,stage){
    const c=config();if(stage==='legend')return null;
    const own=E.membership(getProject(),data),districtId=own.get(id);
    if(stage==='election'){
      const target=erase?null:c.activeDistrictId;if(!erase&&!target){toast('먼저 선거구 카드에서 ‘지도에서 편집’을 선택해주세요.');return {changed:false};}
      if((districtId||null)===target)return {changed:false};E.moveMembers(getProject(),data,[id],target);return {changed:true,ids:[id],color:null};
    }
    if(stage==='seats'){
      if(!c.detailPainting&&!districtId){toast('미배정 읍면동은 ‘세부 색칠’을 켜고 칠할 수 있습니다.');return {changed:false};}
      const result=E.paintSeatMap(getProject(),data,id,erase);if(!result.changed)return result;const ids=result.ids;
      const shown=E.displayProject(getProject(),data,'seats'),colors=new Map(shown.groups.map(g=>[g.id,g.color]));
      return {changed:true,ids,colors:Object.fromEntries(ids.map(id=>[id,colors.get(shown.assignments[id])||'#dce6db']))};
    }
    return {changed:false};
  }
  $('election-search').addEventListener('input',()=>{electionLimit=30;renderDistricts();});$('election-sido').addEventListener('change',()=>{electionLimit=30;renderDistricts();});$('election-more').addEventListener('click',()=>{electionLimit+=30;renderDistricts();});
  $('election-clear-selection').addEventListener('click',()=>{selected.clear();refresh();});
  $('election-move').addEventListener('click',()=>{const ids=[...selected],target=$('election-move-target').value;selected.clear();apply(()=>E.moveMembers(getProject(),data,ids,target||null));toast(`${ids.length}개 읍면동의 소속을 변경했습니다.`);});
  $('election-add').addEventListener('click',()=>{$('district-new-name').value='';$('district-new-sido').value=$('election-sido').value;$('district-add-selection').textContent=selected.size?`선택한 ${selected.size}개 읍면동을 새 선거구에 배정합니다.`:'빈 선거구를 만든 뒤 읍면동을 옮겨 넣을 수 있습니다.';$('district-add-dialog').showModal();$('district-new-name').focus();});
  $('district-add-cancel').addEventListener('click',()=>$('district-add-dialog').close());
  $('district-add-form').addEventListener('submit',event=>{event.preventDefault();let created;apply(()=>{created=E.addDistrict(getProject(),data,$('district-new-name').value,$('district-new-sido').value,[...selected]);});if(!created)return;selected.clear();opened.add(created.id);$('district-add-dialog').close();$('election-search').value=created.name;$('election-sido').value='';renderDistricts();});
  $('election-reset').addEventListener('click',()=>confirm('22대 구성으로 초기화할까요?','수정한 선거구와 권역·의석 배정을 초기화합니다. 일반 범례의 색칠은 유지하며 실행 취소할 수 있습니다.','초기화',()=>{selected.clear();apply(()=>E.resetDistricts(getProject(),data));}));
  $('region-add-form').addEventListener('submit',event=>{event.preventDefault();apply(()=>E.addRegion(getProject(),data,$('region-new-name').value));$('region-new-name').value='';});
  $('region-district-search').addEventListener('input',()=>{regionLimit=40;renderRegions();});$('region-district-more').addEventListener('click',()=>{regionLimit+=40;renderRegions();});
  $('region-bulk-target').addEventListener('change',syncRegionBulk);
  $('region-bulk-assign').addEventListener('click',()=>{
    const region=config().regions.find(r=>r.id===$('region-bulk-target').value),ids=regionDistricts().map(d=>d.id);
    if(!region||!ids.length)return;
    apply(()=>E.assignRegion(getProject(),data,ids,region.id));toast(`${ids.length}개 선거구를 ‘${region.name}’ 권역에 배정했습니다.`);
  });
  $('seat-district-search').addEventListener('input',()=>{seatLimit=40;renderSeats();});$('seat-district-more').addEventListener('click',()=>{seatLimit+=40;renderSeats();});
  for(const [id,key] of [['micro-region-borders','showRegionBorders'],['micro-election-borders','showBorders'],['micro-detail-paint','detailPainting']])$(id).addEventListener('click',()=>{apply(()=>{config()[key]=!config()[key];});if(key==='detailPainting')activateBrush();});
  $('micro-clear-paint').addEventListener('click',()=>{if(!Object.keys(config().mapPaint||{}).length){toast('별도로 칠한 색상이 없습니다.');return;}confirm('지도 색칠만 비울까요?','정당 명도로 덧칠한 색상을 지웁니다. 선거구와 의석 배정은 유지하며 실행 취소할 수 있습니다.','색칠 비우기',()=>apply(()=>{config().mapPaint={};}));});
  $('party-base-toggle').addEventListener('click',()=>{basePickerOpen=!basePickerOpen;renderPalette();});
  $('party-add-form').addEventListener('submit',event=>{event.preventDefault();const color=window.PandoColors.palette(config().parties.length+24).find(color=>!config().parties.some(p=>p.color===color));apply(()=>E.addParty(getProject(),data,$('party-new-name').value,color));$('party-new-name').value='';basePickerOpen=false;renderPalette();activateBrush();});
  $('proportional-settings').addEventListener('click',()=>apply(()=>{config().proportionalRegional=!config().proportionalRegional;}));
  $('micro-border-form').addEventListener('submit',event=>{event.preventDefault();const color=window.PandoColors.parseHex($('micro-border-color').value);if(!color){toast('경계 색상은 #RRGGBB 또는 #RGB로 입력해주세요.');return;}apply(()=>{config().borderColor=color;});});
  $('micro-border-preview').addEventListener('click',()=>openColor({id:'election-border-color',name:'선거구 경계선',color:config().borderColor||'#586f60'},$('micro-border-preview'),color=>apply(()=>{config().borderColor=color;})));
  const commitBorderWidth=()=>{const width=E.strokeWidth(Number($('micro-border-width').value));if(width!==config().borderWidth)apply(()=>{config().borderWidth=width;});};
  $('micro-border-width').addEventListener('change',commitBorderWidth);$('micro-border-width').addEventListener('blur',commitBorderWidth);
  $('micro-border-width').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commitBorderWidth();event.target.blur();}});
  $('micro-show-caption').addEventListener('change',()=>apply(()=>{getProject().settings.legend=$('micro-show-caption').checked;}));
  $('workflow-prev').addEventListener('click',()=>changeStage(config().stage==='seats'?'regions':'election'));$('workflow-next').addEventListener('click',()=>changeStage(config().stage==='election'?'regions':'seats'));
  for(const sido of [...new Set(data.elections.districts.map(d=>d.sido))]){option($('election-sido'),sido,sido);option($('district-new-sido'),sido,sido);}
  return {render,refresh,renderPalette,paintRegion};
}};
