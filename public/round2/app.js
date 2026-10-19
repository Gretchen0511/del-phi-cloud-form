let schema;const answers={}, $=id=>document.getElementById(id);let submission_id=crypto.randomUUID();
function el(tag,text,cls){const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;}
function control(f){const box=el('div',null,'question');box.id='q_'+f.id;const label=el('label',f.label+(f.required?' *':f.label.includes('选填')?'':'（选填）'));box.append(label);
 const update=v=>{answers[f.id]=v;box.classList.remove('invalid');progress();};
 if(f.type==='score'){
  const row=el('div',null,'rating'),out=el('output','未评分');const slider=el('input');slider.type='range';slider.min='1';slider.max='5';slider.step='1';slider.value='3';slider.setAttribute('aria-label',f.label);slider.setAttribute('aria-valuetext','未评分');slider.className='untouched';
  const choose=v=>{slider.value=v;slider.classList.remove('untouched');out.textContent=v+' 分';slider.setAttribute('aria-valuetext',v+'分');update(Number(v));row.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===String(v))));};
  slider.addEventListener('input',()=>choose(slider.value));slider.addEventListener('pointerup',()=>choose(slider.value));slider.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose(slider.value);}});
  for(let i=1;i<=5;i++){const b=el('button',String(i));b.type='button';b.setAttribute('aria-label',f.label+' '+i+'分');b.setAttribute('aria-pressed','false');b.onclick=()=>choose(i);row.append(b);}row.append(out);box.append(slider,row);
 }else if(['choice','multi'].includes(f.type)){
  const group=el('div',null,'options');for(const option of f.options){const l=el('label'),input=el('input');input.type=f.type==='choice'?'radio':'checkbox';input.name=f.id;input.value=option;input.onchange=()=>update(f.type==='choice'?option:[...group.querySelectorAll('input:checked')].map(x=>x.value));l.append(input,document.createTextNode(option));group.append(l);}box.append(group);
 }else {const input=el(f.type==='text'?'textarea':'input');input.id='input_'+f.id;label.htmlFor=input.id;if(f.type==='date')input.type='date';input.maxLength=f.type==='text'?10000:200;input.oninput=()=>update(input.value);box.append(input);}
 return box;
}
function progress(){if(!schema)return;const fs=schema.fields.filter(f=>f.required);$('progress').textContent=`必答项目已完成 ${fs.filter(f=>Array.isArray(answers[f.id])?answers[f.id].length:answers[f.id]!==undefined&&answers[f.id]!=='').length} / ${fs.length}`;}
function missing(){return schema.fields.filter(f=>f.required).filter(f=>{const v=answers[f.id];return f.type==='score'?!(Number.isInteger(v)&&v>=1&&v<=5):Array.isArray(v)?!v.length:typeof v!=='string'||!v.trim();});}
async function init(){try{const r=await fetch('/round2/schema.json');if(!r.ok)throw Error();schema=await r.json();let intro=true,table=null,target=$('intro');const meta=[];
 for(const b of schema.blocks){if(['修订版 · 专家复评','《心事侦探社》','第二轮德尔菲专家咨询问卷'].includes(b.text))continue;if(b.text==='作答确认'){intro=false;target=$('questions');meta.forEach(f=>target.append(control(f)));}
  if(b.fields){table=null;if(intro){meta.push(...b.fields);continue;}if(b.fields[0]?.id==='play_1'){
 const wrap=el('div',null,'table-wrap play-matrix'),matrix=el('table'),head=el('tr');['玩法','规则清晰','趣味参与','教育价值','安全可控','总体适合'].forEach(t=>head.append(el('th',t)));matrix.append(head);
 for(let n=0;n<3;n++){const tr=el('tr');tr.append(el('th',['故事线索卡','回应线索卡','图像线索卡'][n]));for(let j=0;j<5;j++){const td=el('td'),k=(n*5+j)*2;td.append(control(b.fields[k]),control(b.fields[k+1]));tr.append(td);}matrix.append(tr);}wrap.append(matrix);target.append(wrap);
 }else b.fields.forEach(f=>target.append(control(f)));}
  else if(b.row){if(!table){const wrap=el('div',null,'table-wrap');table=el('table');wrap.append(table);target.append(wrap);}const row=el('tr');b.row.forEach(c=>{const td=el('td',c);if(b.row.length===1)td.colSpan=Math.max(1,table.rows[0]?.cells.length||1);row.append(td);});table.append(row);}
  else{table=null;target.append(el(b.heading?'h2':'p',b.text));}
 }
 const note=el('p','评分说明：所有评分初始均为“未评分”。可点击分数按钮或操作拖条选择，3分也须主动确认。开放意见和修改建议可留空。');$('intro').append(note);const next=el('button','下一步，进入问卷');next.type='button';next.onclick=()=>{$('intro').hidden=true;$('survey').hidden=false;window.scrollTo(0,0);};$('intro').append(next);$('loading').hidden=true;$('intro').hidden=false;progress();
 }catch{$('loading').textContent='加载失败，请刷新页面重试。';}}
$('survey').addEventListener('submit',async e=>{e.preventDefault();const miss=missing();if(answers.F8?.includes('其他')&&!answers.F8_other?.trim())miss.push(schema.fields.find(f=>f.id==='F8_other'));if(miss.length){$('error').textContent='请完成以下项目：'+miss.map(f=>f.label).join('；');miss.forEach(f=>$('q_'+f.id).classList.add('invalid'));$('q_'+miss[0].id).scrollIntoView({behavior:'smooth',block:'center'});return;}
 $('submit').disabled=true;$('error').textContent='正在提交，请稍候……';try{const r=await fetch('/api/round2/responses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:schema.version,submission_id,answers})});const data=await r.json();if(!r.ok)throw Error(data.error||'提交失败');$('survey').hidden=true;$('success').hidden=false;$('success').textContent='提交成功，感谢您的专业支持。回执编号：'+data.id;window.scrollTo(0,0);}catch(err){$('error').textContent=err.message+'。可再次点击提交，请勿关闭当前页面。';}finally{$('submit').disabled=false;}});init();
