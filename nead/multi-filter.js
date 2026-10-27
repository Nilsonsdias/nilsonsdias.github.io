import {escapeHtml as esc} from './model.js?v=20261027-filtros-2';
import {selectionValues} from './filter-selection.js';
export function renderMultiFilter(key,title,choices,selected=[],allLabel='Todas as opções'){
 const values=selectionValues(selected),items=Object.entries(choices).filter(([value])=>value!=='');
 const summary=!values.length?allLabel:values.length===1?(choices[values[0]]??values[0]):values.length+' opções selecionadas';
 return `<div class="compact-filter multi-filter-control" data-filter-control="${esc(key)}"><span>${esc(title)}</span><details class="start-date-menu multi-filter-menu" data-multi-menu="${esc(key)}" data-filter-title="${esc(title)}" data-all-label="${esc(allLabel)}"><summary aria-label="${esc(title+': '+summary)}"><span data-multi-summary aria-live="polite">${esc(summary)}</span></summary><div class="start-date-options" role="group" aria-label="${esc(title)}">${items.map(([value,label])=>`<label class="start-date-option"><input type="checkbox" data-multi-filter="${esc(key)}" value="${esc(value)}" ${values.includes(value)?'checked':''}><span>${esc(label)}</span></label>`).join('')||'<span>Nenhuma opção cadastrada</span>'}<p>Sem marcações, todas as opções.</p></div></details></div>`;
}
export function readMultiFilter(target){
 if(!target.matches('[data-multi-filter]'))return null;
 const menu=target.closest('[data-multi-menu]'),inputs=[...menu.querySelectorAll('[data-multi-filter]:checked')];
 const values=inputs.map(input=>input.value),summary=!values.length?menu.dataset.allLabel:values.length===1?inputs[0].nextElementSibling.textContent:values.length+' opções selecionadas';
 menu.querySelector('[data-multi-summary]').textContent=summary;
 menu.querySelector('summary').setAttribute('aria-label',menu.dataset.filterTitle+': '+summary);
 return {key:target.dataset.multiFilter,values};
}

export function installMultiFilterDismiss(root=document){
 const closeExcept=active=>{for(const menu of root.querySelectorAll('[data-multi-menu][open]'))if(menu!==active)menu.open=false;};
 const outsideClick=event=>closeExcept(event.target.closest?.('[data-multi-menu]'));
 const escape=event=>{if(event.key!=='Escape')return;const active=root.activeElement?.closest?.('[data-multi-menu][open]');closeExcept(null);if(active)active.querySelector('summary').focus();};
 root.addEventListener('click',outsideClick,true);
 root.addEventListener('keydown',escape);
 return ()=>{root.removeEventListener('click',outsideClick,true);root.removeEventListener('keydown',escape);};
}
