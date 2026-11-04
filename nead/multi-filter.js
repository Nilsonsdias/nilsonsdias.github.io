import {escapeHtml as esc} from './model.js?v=20261027-filtros-2';
import {selectionValues} from './filter-selection.js';
const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
export const dateFilterYear=value=>/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(String(value))?String(value).slice(0,4):'';
export function sortedFilterEntries(choices,type='auto'){
 return Object.entries(choices).filter(([value])=>value!=='').sort(([a,la],[b,lb])=>{
  if(type==='date'&&dateFilterYear(a)&&dateFilterYear(b))return a.localeCompare(b);
  const number=v=>/^-?\d+(?:[.,]\d+)?$/.test(String(v).trim())?Number(String(v).replace(',','.')):NaN;
  if(type==='number'){const x=number(la),y=number(lb);if(Number.isFinite(x)&&Number.isFinite(y)&&x!==y)return x-y;}
  return collator.compare(String(la),String(lb))||collator.compare(a,b);
 });
}
// [] conserva a regra existente: sem marcações, todas as opções.
export function changedFilterSelection(options,selected,action){
 const picked=new Set(selectionValues(selected));
 for(const value of options){if(action.kind==='all')picked.add(value);else if(action.kind==='none')picked.delete(value);else if(action.kind==='year'&&dateFilterYear(value)===String(action.year)){if(action.checked)picked.add(value);else picked.delete(value);}}
 return options.filter(value=>picked.has(value));
}
export function renderMultiFilter(key,title,choices,selected=[],allLabel='Todas as opções',options={}){
 const type=options.type||(['inicio','data_local'].includes(key)?'date':'auto');
 const values=selectionValues(selected),items=sortedFilterEntries(choices,type),chosen=new Set(values);
 const summary=!values.length?allLabel:values.length===1?(choices[values[0]]??values[0]):values.length+' opções selecionadas';
 const count=items.filter(([v])=>chosen.has(v)).length;
 const years=type==='date'?[...new Set(items.map(([v])=>dateFilterYear(v)).filter(Boolean))].sort():[];
 const toolbar='<div class="multi-filter-actions"><button type="button" data-multi-select="all" '+(!items.length||count===items.length?'disabled':'')+'>Marcar todos</button><button type="button" data-multi-select="none" '+(!count?'disabled':'')+'>Desmarcar todos</button></div>';
 const annual=years.length?'<fieldset class="multi-filter-years"><legend>Ano</legend><div>'+years.map(year=>{const dates=items.filter(([v])=>dateFilterYear(v)===year),n=dates.filter(([v])=>chosen.has(v)).length;return '<label class="start-date-option"><input type="checkbox" data-multi-year="'+esc(year)+'" aria-label="Ano '+esc(year)+'" aria-checked="'+(n===dates.length?'true':n?'mixed':'false')+'" '+(n===dates.length?'checked':'')+'><span>'+esc(year)+'</span></label>';}).join('')+'</div></fieldset>':'';
 const list=items.map(([value,label])=>'<label class="start-date-option"><input type="checkbox" data-multi-filter="'+esc(key)+'" value="'+esc(value)+'" '+(chosen.has(value)?'checked':'')+'><span>'+esc(label)+'</span></label>').join('')||'<span>Nenhuma opção cadastrada</span>';
 return '<div class="compact-filter multi-filter-control" data-filter-control="'+esc(key)+'"><span>'+esc(title)+'</span><details class="start-date-menu multi-filter-menu" data-multi-menu="'+esc(key)+'" data-filter-title="'+esc(title)+'" data-all-label="'+esc(allLabel)+'"><summary aria-label="'+esc(title+': '+summary)+'"><span data-multi-summary aria-live="polite">'+esc(summary)+'</span></summary><div class="start-date-options" role="group" aria-label="'+esc(title)+'">'+toolbar+annual+list+'<p>Sem marcações, todas as opções.</p></div></details></div>';
}
function syncMenu(menu,updateSummary=true){
 const inputs=[...menu.querySelectorAll('[data-multi-filter]')],selected=inputs.filter(input=>input.checked),values=selected.map(input=>input.value);
 if(updateSummary){const summary=!values.length?menu.dataset.allLabel:values.length===1?selected[0].nextElementSibling.textContent:values.length+' opções selecionadas';menu.querySelector('[data-multi-summary]').textContent=summary;menu.querySelector('summary').setAttribute('aria-label',menu.dataset.filterTitle+': '+summary);}
 const all=menu.querySelector('[data-multi-select="all"]'),none=menu.querySelector('[data-multi-select="none"]');
 if(all)all.disabled=!inputs.length||selected.length===inputs.length;if(none)none.disabled=!selected.length;
 for(const input of menu.querySelectorAll('[data-multi-year]')){const dates=inputs.filter(date=>dateFilterYear(date.value)===input.dataset.multiYear),n=dates.filter(date=>date.checked).length;input.checked=!!dates.length&&n===dates.length;input.indeterminate=n>0&&n<dates.length;input.setAttribute('aria-checked',input.indeterminate?'mixed':String(input.checked));}
 return values;
}
export function readMultiFilter(target){
 if(!target.matches('[data-multi-filter]'))return null;
 const menu=target.closest('[data-multi-menu]');if(!menu)return null;
 return {key:target.dataset.multiFilter,values:syncMenu(menu)};
}
export function installMultiFilterDismiss(root=document){
 const closeExcept=active=>{for(const menu of root.querySelectorAll('[data-multi-menu][open]'))if(menu!==active)menu.open=false;};
 const outsideClick=event=>closeExcept(event.target.closest?.('[data-multi-menu]'));
 const escape=event=>{if(event.key!=='Escape')return;const active=(root.activeElement||root.ownerDocument?.activeElement)?.closest?.('[data-multi-menu][open]');closeExcept(null);if(active)active.querySelector('summary').focus();};
 const apply=(menu,action)=>{
  if(!menu)return;const inputs=[...menu.querySelectorAll('[data-multi-filter]')];if(!inputs.length)return;
  const values=new Set(changedFilterSelection(inputs.map(input=>input.value),inputs.filter(input=>input.checked).map(input=>input.value),action));
  for(const input of inputs)input.checked=values.has(input.value);
  syncMenu(menu);
  const EventType=inputs[0].ownerDocument?.defaultView?.Event||Event;inputs[0].dispatchEvent(new EventType('change',{bubbles:true}));
 };
 const bulk=event=>{const button=event.target.closest?.('[data-multi-select]');if(!button||button.disabled)return;apply(button.closest('[data-multi-menu]'),{kind:button.dataset.multiSelect});};
 const year=event=>{if(event.target.matches?.('[data-multi-year]'))apply(event.target.closest('[data-multi-menu]'),{kind:'year',year:event.target.dataset.multiYear,checked:event.target.checked});};
 const open=event=>{if(event.target.matches?.('[data-multi-menu]')&&event.target.open)syncMenu(event.target,false);};
 root.addEventListener('click',outsideClick,true);root.addEventListener('keydown',escape);root.addEventListener('click',bulk);root.addEventListener('change',year);root.addEventListener('toggle',open,true);
 return ()=>{root.removeEventListener('click',outsideClick,true);root.removeEventListener('keydown',escape);root.removeEventListener('click',bulk);root.removeEventListener('change',year);root.removeEventListener('toggle',open,true);};
}
