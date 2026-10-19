const schema=require('./public/round2/schema.json');
function validate(body){
 if(!body||body.version!==schema.version||!body.answers||typeof body.answers!=='object'||Array.isArray(body.answers))return '问卷版本或数据格式错误，请刷新页面';
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.submission_id||''))return '提交编号无效';
 const a=body.answers;
 for(const f of schema.fields){const v=a[f.id];
 if(f.type==='score'){if(!Number.isInteger(v)||v<1||v>5)return f.label+'：请主动评分';}
 else if(f.type==='choice'){if(!f.options.includes(v))return f.label+'：请选择';}
 else if(f.type==='multi'){if(!Array.isArray(v)||!v.length||new Set(v).size!==v.length||v.some(x=>!f.options.includes(x)))return f.label+'：请至少选择一项';}
 else if(f.required&&(typeof v!=='string'||!v.trim()))return f.label+'：必填';
 if(v!==undefined&&!['multi','score'].includes(f.type)&&(typeof v!=='string'||v.length>10000))return f.label+'：文字过长或格式错误';
 if(f.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))return '填写日期无效';
 }
 if(a.F8.includes('其他')&&!a.F8_other?.trim())return '请填写其他应用场景';
 return null;
}
function clean(body){return {version:schema.version,answers:Object.fromEntries(schema.fields.map(f=>[f.id,body.answers[f.id]??'']))};}
function csv(rows){const esc=v=>'"'+String(v??'').replace(/^[\s]*[=+@-]/,'\'$&').replace(/"/g,'""')+'"';return '\uFEFF'+[['提交编号','提交时间',...schema.fields.map(f=>f.label.startsWith(f.id+' ')?f.label:f.id+' '+f.label)],...rows.map(r=>[r.id,new Date(r.created_at).toISOString(),...schema.fields.map(f=>{let v=r.payload.answers[f.id];return Array.isArray(v)?v.join('；'):v;})])].map(r=>r.map(esc).join(',')).join('\r\n');}
module.exports={schema,validate,clean,csv};
