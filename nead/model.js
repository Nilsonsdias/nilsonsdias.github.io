import {selectionValues} from './filter-selection.js';
export function escapeHtml(value='') { return String(value??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])); }
export function formatDate(value) { if(!value)return '—';const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);return match?`${match[3]}/${match[2]}/${match[1]}`:'—'; }
export function numberLabel(value) { return String(value??'').padStart(4,'0'); }
export function normalize(value='') {return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');}
export function filterRecords(records,query='',status='',type='') {const q=normalize(query.trim());return records.filter(a=>(!selectionValues(status).length||selectionValues(status).includes(a.status))&&(!type||a.tipo===type)&&(!q||normalize([a.numero,a.disciplina,...(a.contexto?.ofertas||[]).map(o=>`${o.curso} ${o.turma}`)].join(' ')).includes(q)));}
export function editable(record,profile) {return Boolean(profile?.pode_editar&&record?.tipo==='digital'&&record.status==='rascunho');}
export function savePayload(record,text,finalize=false) {return {p_ata:record.id,p_revisao:record.revisao,p_texto:text,p_fonte_ia:null,p_finalizar:finalize};}
export function errorMessage(error) {
  const messages={'42501':'Seu acesso não está autorizado. Entre novamente ou procure a equipe NEAD.','40001':'Outra pessoa atualizou esta ata. Seu texto foi preservado. Confira a versão atual antes de salvar novamente.','23505':'Este registro ou número já existe. Atualize a lista antes de continuar.','23514':'Confira os dados obrigatórios e os participantes antes de finalizar.','55000':'Esta ata está bloqueada para edição. Atualize a lista para consultar sua situação.','22023':'O registro não está disponível. Atualize a lista e tente novamente.','email_not_confirmed':'Confirme seu e-mail antes de entrar.','invalid_credentials':'E-mail ou senha incorretos. Confira os dados e tente novamente.','over_email_send_rate_limit':'Aguarde alguns minutos antes de solicitar outro e-mail.'};
  if(messages[error?.code])return messages[error.code];
  if(/fetch|network|offline/i.test(error?.message||''))return 'Não foi possível conectar. Confira sua conexão; seu texto foi preservado.';
  return 'Não foi possível concluir a operação. Tente novamente; se continuar, procure a equipe NEAD.';
}
export function statusLabel(status) {return ({rascunho:'Rascunho',finalizada:'Finalizada',registrada:'Histórica',cancelada:'Cancelada',agendada:'Agendado',realizada:'Realizado',aguardando:'Aguardando assinatura',nao_iniciada:'Não iniciada',nao_aplicavel:'Documento original'})[status]||status||'—';}
