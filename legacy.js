function safeColumnName(text) {
  return String(text || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\.\[\]]+/g, '_')
    .replace(/\s+/g, '')
    .slice(0, 80);
}

function flatten(obj, prefix = '', out = {}) {
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const label = safeColumnName(item?.item || item?.dimension || item?.word || `第${index + 1}项`);
      const base = prefix ? `${prefix}_${label}` : label;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const [k, v] of Object.entries(item)) {
          if (['item', 'dimension', 'word', 'category'].includes(k)) continue;
          const col = safeColumnName(`${base}_${k}`);
          if (v && typeof v === 'object') flatten(v, col, out);
          else out[col] = v ?? '';
        }
        if (item.category) out[safeColumnName(`${base}_类别`)] = item.category;
      } else {
        out[safeColumnName(`${base}_${index + 1}`)] = item ?? '';
      }
    });
    return out;
  }

  for (const [key, value] of Object.entries(obj || {})) {
    const next = prefix ? `${prefix}_${key}` : key;
    if (Array.isArray(value)) flatten(value, next, out);
    else if (value && typeof value === 'object') flatten(value, next, out);
    else out[safeColumnName(next)] = value ?? '';
  }
  return out;
}

function toCsv(rows) {
  const flatRows = rows.map(r => ({
    id: r.id,
    created_at: new Date(r.created_at).toISOString(),
    expert_name: r.expert_name || '',
    expert_org: r.expert_org || '',
    ...flatten(r.payload)
  }));
  const preferred = ['id','created_at','expert_name','expert_org','name','gender','age','highest_degree','title','institution','professional_background','work_years','final_decision','final_reason'];
  const allHeaders = [...new Set(flatRows.flatMap(r => Object.keys(r)))];
  const headers = [...preferred.filter(h => allHeaders.includes(h)), ...allHeaders.filter(h => !preferred.includes(h))];
  const esc = v => `"${String(v ?? '').replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  return [headers.map(esc).join(','), ...flatRows.map(r => headers.map(h => esc(r[h])).join(','))].join('\n');
}

module.exports = { flatten, toCsv };
