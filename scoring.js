// Shared, DOM-free scoring logic used by both sheet.html (editor) and
// analysis.html (charts) so the two never drift apart.

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

function gradeFor(total){
  if(total >= 80) return 'S';
  if(total >= 70) return 'A';
  if(total >= 60) return 'B';
  if(total >= 50) return 'C';
  if(total >= 40) return 'D';
  return 'E';
}

// Tolerates a legacy flat-model row shape (pre-period-split) by treating it as empty.
function normalizePeriods(data){
  if(data && (data.first_half !== undefined || data.second_half !== undefined)){
    return { first_half: data.first_half || null, second_half: data.second_half || null };
  }
  return { first_half: null, second_half: null };
}

// "before" is the original recorded value (self); "after" is an optional
// manager override (revisedSelf). Items and 貢献ポイント share this shape.
function effectiveValue(obj){
  return (obj.revisedSelf !== null && obj.revisedSelf !== undefined) ? obj.revisedSelf : obj.self;
}

function computeItemScoreWith(it, valueFn){
  if(!it || it.weight === null || it.weight === undefined) return null;
  const val = valueFn(it);
  if(val === null || val === undefined) return null;
  const max = it.maxPoint || (it.tiers ? it.tiers.length : 6) || 6;
  return (Number(val) / max) * 100 * it.weight / 100;
}

function computeContribScoreWith(c, valueFn){
  if(!c) return null;
  const val = valueFn(c);
  return (val === null || val === undefined) ? null : Number(val);
}

function computeTotalWith(model, valueFn){
  if(!model) return null;
  let total = 0, any = false;
  (model.items || []).forEach(it => {
    const s = computeItemScoreWith(it, valueFn);
    if(s !== null){ total += s; any = true; }
  });
  const cs = computeContribScoreWith(model.contribution, valueFn);
  if(cs !== null){ total += cs; any = true; }
  return any ? total : null;
}

const computeTotalBefore = (model) => computeTotalWith(model, obj => obj.self);
const computeTotalAfter = (model) => computeTotalWith(model, obj => effectiveValue(obj));

function fmtScore(v){ return (v === null || v === undefined) ? '—' : v.toFixed(1); }
function fmtGrade(total){ return total === null ? '—' : gradeFor(total); }
