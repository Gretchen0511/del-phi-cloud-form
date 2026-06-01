const scoreText = {1:'很不合适',2:'不太合适',3:'一般',4:'比较合适',5:'非常合适'};
const mechanismItems = ['玩法规则清晰，便于大学生理解','游戏流程具有趣味性，能吸引学生参与','游戏机制有助于促进情绪识别、需求觉察','该机制适合用于心理健康课程、团辅或心理主题活动','该机制整体安全性较好，不易引发过度暴露或不适'];
const overallItems = ['整体具有心理健康教育价值','整体适合大学生群体','整体具有趣味性和参与感','整体适合课堂、团辅或心理主题活动使用','整体安全性较好，不易引发过度暴露或不适'];
const emotions = [
  ['快乐积极类',['平静','开心','兴奋','感动','爱慕']], ['惊讶探索类',['好奇','惊讶']], ['悲伤低落类',['无聊','低落','失望','委屈','无助','孤独']], ['恐惧焦虑类',['迷茫','焦虑','害怕']], ['愤怒厌恶类',['生气','厌恶','嫉妒','挫败']], ['羞耻内疚类',['尴尬','后悔','自责','羞耻']]
];
const needs = [
  ['连接与归属类',['陪伴','不被排斥','被在乎','被回应']], ['自主与边界类',['个人边界','自主决定']], ['尊重与肯定类',['被尊重','认可肯定','公平对待']], ['安全与恢复类',['放松休息','被保护','稳定感','不被指责']], ['成长与意义类',['目标意义','自我接纳']], ['能力与掌控类',['成就感','可控感','解决办法']]
];
const emotionDims = ['大学生常见性','表达清晰性','区分度','游戏适用性'];
const needDims = ['理论适切性','学生可理解性','情境适配性','游戏适用性'];

function safeKey(s){ return s.replace(/[\s／/]+/g,'_').replace(/[，。、《》：“”]/g,''); }
function ratingHTML(name,label){
  const id = 'r_' + safeKey(name);
  return `<div class="rating-card"><div class="rating-head"><div class="rating-title">${label}</div><div class="rating-value" id="${id}_v">3 分 · 一般</div></div><div class="slider-row"><span>1分：很不合适</span><input id="${id}" name="${name}" type="range" min="1" max="5" step="1" value="3" data-output="${id}_v" /><span>5分：非常合适</span></div></div>`;
}
function ratingWithSuggestion(name,label){
  return `<div class="rating-card">${ratingHTML(name+'.score', label)}<label>修改建议<textarea name="${name}.suggestion"></textarea></label></div>`;
}
function renderRatings(targetId, prefix, items){
  document.getElementById(targetId).innerHTML = items.map(item => ratingWithSuggestion(`${prefix}.${safeKey(item)}`, item)).join('');
}
function renderWordSections(targetId, prefix, groups, dims){
  document.getElementById(targetId).innerHTML = groups.map(([cat, words]) => `<div class="item-group"><h3>${cat}</h3>${words.map(word => `<div class="word-box"><div class="word-title">${word}</div><div class="word-grid">${dims.map(dim => ratingHTML(`${prefix}.${safeKey(cat)}.${safeKey(word)}.${safeKey(dim)}`, dim)).join('')}</div><label>修改建议<textarea name="${prefix}.${safeKey(cat)}.${safeKey(word)}.suggestion"></textarea></label></div>`).join('')}</div>`).join('');
}
function initRatings(){
  document.querySelectorAll('.rating').forEach(el => el.outerHTML = ratingHTML(el.dataset.name, el.dataset.label));
  renderRatings('mechanismRatings','mechanismRatings',mechanismItems);
  renderRatings('overallRatings','overallRatings',overallItems);
  renderWordSections('emotionSections','emotionRatings',emotions,emotionDims);
  renderWordSections('needSections','needRatings',needs,needDims);
  document.querySelectorAll('input[type="range"]').forEach(input => {
    const update = () => document.getElementById(input.dataset.output).textContent = `${input.value} 分 · ${scoreText[input.value]}`;
    input.addEventListener('input', update); update();
  });
}
function setDeep(obj,path,value){
  const parts = path.split('.'); let cur = obj;
  for(let i=0;i<parts.length-1;i++){ cur[parts[i]] ??= {}; cur = cur[parts[i]]; }
  cur[parts.at(-1)] = value;
}
function formToObject(form){
  const data = {};
  new FormData(form).forEach((value,key) => setDeep(data,key,value));
  data.meta = { formName:'心事侦探社第一轮专家咨询表', submittedAt:new Date().toISOString(), scoreScale:{min:'1分：很不合适', max:'5分：非常合适'} };
  return data;
}
initRatings();
const form = document.getElementById('delphiForm');
const statusEl = document.getElementById('submitStatus');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = form.querySelector('button'); btn.disabled = true; statusEl.className=''; statusEl.textContent='正在提交…';
  try {
    const res = await fetch('/api/responses', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(formToObject(form)) });
    const json = await res.json();
    if(!json.ok) throw new Error(json.error || '提交失败');
    statusEl.className='ok'; statusEl.textContent=`提交成功，编号：${json.id}`; form.reset(); initRatings(); window.scrollTo({top:0,behavior:'smooth'});
  } catch(err) {
    statusEl.className='err'; statusEl.textContent=err.message;
  } finally { btn.disabled = false; }
});
