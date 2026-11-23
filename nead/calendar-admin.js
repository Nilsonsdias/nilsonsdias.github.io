import {escapeHtml as esc} from './model.js';
import {activityPending,formatDay} from './calendar-model.js?v=20261117-calendarios-1';

export const ACTIVITY_SORTS={nome_asc:'Nome · A–Z',nome_desc:'Nome · Z–A',data_asc:'Data de início · menor para maior',data_desc:'Data de início · maior para menor',grupo_asc:'Grupo · A–Z',grupo_desc:'Grupo · Z–A'};
const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
export function sortActivities(activities,groups,sort='data_asc'){
 const [field,direction]=(Object.hasOwn(ACTIVITY_SORTS,sort)?sort:'data_asc').split('_');
 const groupNames=new Map(groups.map(g=>[g.id,g.nome]));
 const value=a=>field==='data'?(a.data_inicio||null):field==='grupo'?(groupNames.get(a.grupo_id)||null):a.titulo;
 return [...activities].sort((a,b)=>{
  const left=value(a),right=value(b);
  if(left==null&&right!=null)return 1;if(right==null&&left!=null)return -1;
  const primary=left==null?0:collator.compare(left,right);
  return primary*(direction==='desc'?-1:1)||collator.compare(a.titulo,b.titulo)||String(a.id).localeCompare(String(b.id));
 });
}
export function renderActivityList(activities,groups,sort='data_asc'){
 const options=groups.map(g=>`<option value="${g.id}">${esc(g.nome)}</option>`).join('');
 return `<section class="panel panel-body"><div class="actions"><label class="field">Ordenar atividades<select id="calendar-sort" aria-label="Ordenar atividades">${Object.entries(ACTIVITY_SORTS).map(([key,label])=>`<option value="${key}" ${key===sort?'selected':''}>${label}</option>`).join('')}</select></label><span id="calendar-selected" role="status">0 atividades selecionadas</span><label class="field">Grupo para as selecionadas<select id="calendar-bulk-group"><option value="">Sem grupo</option>${options}</select></label><button class="button primary" data-cal="bulk-group" disabled>Atribuir grupo às selecionadas</button><button type="button" class="button danger" data-cal="bulk-delete" disabled>Excluir selecionadas</button></div><p>Selecione até 500 atividades. Registros com data de início ou término ausente permanecem nesta lista para edição e não aparecem no calendário.</p><div class="table-scroll"><table><thead><tr><th><input type="checkbox" data-cal-select="all" aria-label="Selecionar/desmarcar todas as atividades (até 500)"></th><th>Título</th><th>Grupo</th><th>Período</th><th>Pendências</th><th>Recorrência</th><th>Ação</th></tr></thead><tbody>${activities.map(a=>`<tr><td><input type="checkbox" data-cal-select="${a.id}" aria-label="Selecionar ${esc(a.titulo)}"></td><td>${esc(a.titulo)}</td><td>${esc(groups.find(g=>g.id===a.grupo_id)?.nome||'Sem grupo')}</td><td>${a.data_inicio?formatDay(a.data_inicio):'Não informado'} – ${a.data_fim?formatDay(a.data_fim):'Não informado'}</td><td>${esc(activityPending(a).join(' · ')||'Completa')}</td><td>${esc(a.recorrencia||'Não repete')}</td><td><button class="row-open" data-cal="edit" data-id="${a.id}">Editar</button></td></tr>`).join('')||'<tr><td colspan="7">Nenhum registro.</td></tr>'}</tbody></table></div></section>`;
}

export function syncActivitySelection(root,activities,selected){
 for(const box of root.querySelectorAll('[data-cal-select]')){
  if(box.dataset.calSelect==='all'){
   const ids=activities.slice(0,500).map(a=>a.id);
   box.checked=ids.length>0&&ids.every(id=>selected.has(id));box.indeterminate=selected.size>0&&!box.checked;
  }else box.checked=selected.has(box.dataset.calSelect);
 }
 root.querySelector('#calendar-selected').textContent=selected.size+' atividades selecionadas';
 for(const button of root.querySelectorAll('[data-cal="bulk-group"],[data-cal="bulk-delete"]'))button.disabled=!selected.size;
}

export function renderDeleteReview(activities,groups){
 return `<div class="panel-body"><h2 id="calendar-delete-title">Excluir atividades selecionadas</h2><p id="calendar-delete-description">Confira as ${activities.length} atividades abaixo. A exclusão é definitiva e não pode ser desfeita nesta tela. Para atividades recorrentes, todas as ocorrências serão removidas.</p><div class="table-scroll calendar-delete-list"><table><thead><tr><th>Atividade</th><th>Grupo</th><th>Período</th></tr></thead><tbody>${activities.map(a=>`<tr><td>${esc(a.titulo)}</td><td>${esc(groups.find(g=>g.id===a.grupo_id)?.nome||'Sem grupo')}</td><td>${a.data_inicio?formatDay(a.data_inicio):'Não informado'} – ${a.data_fim?formatDay(a.data_fim):'Não informado'}</td></tr>`).join('')}</tbody></table></div><p data-delete-error role="alert" hidden></p><div class="actions"><button type="button" class="button secondary" data-cancel-delete>Cancelar</button><button type="button" class="button danger" data-confirm-delete>Excluir definitivamente ${activities.length} atividades</button></div></div>`;
}
