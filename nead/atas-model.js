export const ataNumber=a=>String(a.numero).padStart(2,'0')+'/'+(a.ano||String(a.data_ata).slice(0,4));
export const ataTitle=a=>a.titulo||a.disciplina||'Ata de alinhamento';
export const ataStatus=a=>a.tipo==='historica'?'Histórica — PDF final assinado':a.status_assinatura==='assinada'?'Assinada':a.status==='finalizada'?'Finalizada - aguardando PDF assinado':a.status==='registrada'?'Histórica':a.status;
export function ataFields(a){
 const d=a.dados_ata||{},people=a.contexto?.participantes||[];
 return {professores:d.professores??people.filter(p=>p.papel==='docente').map(p=>p.nome_completo),
 mediadores:d.mediadores??people.filter(p=>p.papel==='mediador').map(p=>p.nome_completo),
 participantes:d.participantes??[],curso:d.curso??[...new Set((a.contexto?.ofertas||[]).map(o=>o.curso))].join(' / '),
 foto:d.foto||'',legenda:d.legenda||''};
}
export function ataParticipants(a){
 const d=ataFields(a);
 return a.categoria==='administrativa'?d.participantes.map(nome=>({nome,papel:'Participante'})):
 [...d.professores.map(nome=>({nome,papel:'Professor(a) formador(a)'})),...d.mediadores.map(nome=>({nome,papel:'Mediação Pedagógica'}))];
}
export function ataPdfTitle(a){
 const title=a.categoria==='administrativa'?ataTitle(a):'REUNIÃO ENTRE MEDIAÇÃO PEDAGÓGICA E PROFESSOR FORMADOR DE DISCIPLINAS DOS CURSOS EAD DO CENTRO UNIVERSITÁRIO UNIVEL';
 return ('ATA Nº '+ataNumber(a)+' - '+title).toLocaleUpperCase('pt-BR');
}
export function parseNames(value){return String(value||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);}

export const canCreateAta=c=>c?.novas_liberadas===true||c?.concluida===true||c?.liberacao_temporaria===true;
export const canAttachSignedPdf=a=>a?.tipo==='digital'&&a?.status==='finalizada';
