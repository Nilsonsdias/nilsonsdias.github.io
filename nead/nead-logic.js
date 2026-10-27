import {normalize} from './model.js';

export const stages={producao:'Produção',conferencia:'Conferência',alinhamento:'Alinhamento',revisao:'Revisão',integracao:'Integração de notas'};
export const completed=p=>['concluida','realizado'].includes(p?.status);
export function nextAction(offer){
 const list=Object.keys(stages).map(k=>offer.processos?.find(p=>p.tipo===k));
 const index=list.findIndex(p=>!completed(p));if(index<0)return 'Fluxo concluído';
 const p=list[index];if(p?.tipo==='revisao'&&p.status==='realizada')return 'Registrar gravação e concluir revisão';
 return ({producao:'Concluir produção',conferencia:'Conferir sala AVA',alinhamento:'Agendar ou concluir alinhamento',revisao:'Agendar ou concluir revisão',integracao:'Integrar notas'})[Object.keys(stages)[index]];
}
export function mediatorIds(offer,stage=''){
 const allocated=(offer.participantes||[]).filter(p=>p.papel==='mediador').map(p=>p.id);
 const review=offer.processos?.find(p=>p.tipo==='revisao')?.dados?.tutor_revisao_id;
 return stage==='revisao'?(review?[review]:[]):stage?allocated:[...new Set([...allocated,...(review?[review]:[])])];
}
export function emailStatus(meeting){
 if(meeting.legado_preservado)return 'Histórico preservado';
 const latest=(meeting.comunicacoes||[]).find(c=>c.status!=='substituida');
 if(latest?.resultado?.email_status==='sem_destinatarios')return 'Sem destinatários';
 return latest?.status==='concluida'?'Enviado':latest?.status==='erro'?'Erro':'Pendente';
}
export function filterRows(rows,search='',filters={}){
 return rows.filter(r=>normalize([r.codigo_legado,r.curso,r.turma,r.matriz,r.disciplina,r.nome_completo,r.email,r.cpf,...(r.contexto?.ofertas||[]).map(o=>o.curso+' '+o.turma)].join(' ')).includes(normalize(search))&&Object.entries(filters).every(([k,v])=>{
  if(!v||Array.isArray(v)&&!v.length)return true;
  if(k==='inicio')return v.includes(r.inicio);
  if(k==='etapa')return true;
  if(k==='mediador')return v==='__sem_mediador__'?!(r.participantes||[]).some(p=>p.papel==='mediador'):mediatorIds(r,filters.etapa).includes(v);
  if(k==='docente')return r.participantes?.some(p=>p.papel==='docente'&&p.id===v);
  if(k==='situacao')return r.processos?.some(p=>(!filters.etapa||p.tipo===filters.etapa)&&p.status===v);
  if(k==='email')return emailStatus(r)===v;
  return String(r[k]??'')===v;
 }));
}

export function mapImport(rows,type){
 if(!['pessoas','ofertas'].includes(type))throw Error('Base de importação inválida.');
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/[\s/\-]+/g,'_');
 const alias={ID_OFERTA:'codigo_legado',ID_PESSOA:'codigo_legado',CPF:'cpf',NOME_COMPLETO:'nome_completo',NOME:'nome_completo',TELEFONE:'telefone',EMAIL:'email',E_MAIL:'email',STATUS:type==='pessoas'?'ativo':'status_oferta',CURSO:'curso',TURMA:'turma',MATRIZ:'matriz',ORDEM_DISCIPLINA:'ordem_disciplina',ORDEM:'ordem_disciplina',ORDEM_DE_OFERTA:'ordem_disciplina',ORDEM_DA_OFERTA:'ordem_disciplina',ORDEM_OFERTA:'ordem_disciplina',DISCIPLINA:'disciplina',INICIO:'inicio',INICIO_DA_SEMANA_DE_PROVAS:'inicio_semana_provas',INICIO_SEMANA_PROVAS:'inicio_semana_provas',TERMINO_DE_SEMANA_DE_PROVAS:'termino_semana_provas',TERMINO_DA_SEMANA_DE_PROVAS:'termino_semana_provas',TERMINO_SEMANA_PROVAS:'termino_semana_provas','2ª_CHAMADA':'segunda_chamada','2A_CHAMADA':'segunda_chamada',SEGUNDA_CHAMADA:'segunda_chamada',SUB_TERMINO:'sub_termino',SUB:'sub_termino',TERMINO:'sub_termino',ENCERRAMENTO:'encerramento',STATUS_DA_OFERTA:'status_oferta',STATUS_OFERTA:'status_oferta'};
 const allowed=type==='pessoas'?['codigo_legado','cpf','nome_completo','telefone','email','ativo']:['codigo_legado','curso','turma','matriz','ordem_disciplina','disciplina','inicio','inicio_semana_provas','termino_semana_provas','segunda_chamada','sub_termino','encerramento','status_oferta'];
 const headers=rows[0].map(h=>allowed.includes(alias[norm(h)])?alias[norm(h)]:null);
 for(const req of type==='pessoas'?['cpf','nome_completo']:['curso','turma','matriz','disciplina','ordem_disciplina'])if(!headers.includes(req))throw Error('Cabeçalho obrigatório ausente: '+req);
 if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw Error('Cabeçalhos duplicados.');
 if(rows.length>501)throw Error('Importe até 500 linhas por lote.');
 const mapped=rows.slice(1).map((row,i)=>{
  if(row.length>headers.length&&row.slice(headers.length).some(x=>String(x??'').trim()))throw Error('Linha '+(i+2)+': quantidade de colunas inválida.');
  const obj={};headers.forEach((k,j)=>{if(!k)return;let val=String(row[j]??'').trim();
   if(k==='ativo'){if(!val||/^ativo$/i.test(val))val=true;else if(/^inativo$/i.test(val))val=false;else{obj._erro_importacao='Status deve ser Ativo ou Inativo.';val=true;}}
   else if(k==='cpf')val=val.replace(/\D/g,'');
   else if(['inicio','inicio_semana_provas','termino_semana_provas','segunda_chamada','sub_termino','encerramento'].includes(k)){const m=val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(m)val=m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');}
   obj[k]=val;
  });return obj;
 });
 Object.defineProperty(mapped,'unknownHeaders',{value:rows[0].filter((h,i)=>!headers[i]&&String(h??'').trim()),enumerable:false});return mapped;
}

export function navigationGroups(permission){
 const operations=[['painel','Painel gerencial'],['processos','Gestão dos Processos'],['agenda','Central de agendamentos'],['ofertas','Ofertas'],['pessoas','Pessoas'],['alocacao','Alocação']].filter(([v])=>permission(v)!=='negado');
 const records=permission('atas')==='negado'?[]:[['overview','Visão geral'],['alignments','Alinhamentos e nova ata'],['records','Atas registradas'],['historical','Atas históricas'],['signatures','Assinaturas']];
 return [{id:'rotinas',label:'Processos e Rotinas',items:operations},{id:'atas',label:'Gestão de Atas',items:records},{id:'administracao',label:'Administração',items:[['usuarios','Usuários e acessos'],['auditoria','Auditoria']].filter(([v])=>permission(v)!=='negado')}].filter(g=>g.items.length);
}
