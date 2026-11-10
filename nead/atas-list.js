import {ataNumber,ataTitle,ataFields} from './atas-model.js?v=20261105-assinaturas-1';
import {selectionValues} from './filter-selection.js';
export const ataType=a=>a.tipo==='historica'?'Histórica':'Regular';
export const ataYear=a=>String(a.ano||String(a.data_ata||'').slice(0,4));
export function ataCourses(a){
 const course=ataFields(a).curso;
 return [...new Set([...String(course||'').split(/\s*[,;]\s*|\s+\/\s+/),...(a.dados_ata?.curso!=null?[]:(a.contexto?.ofertas||[]).map(o=>o.curso))].map(s=>String(s||'').trim()).filter(Boolean))];
}
export function ataFilterChoices(records){
 const choices=values=>Object.fromEntries([...new Set(values.filter(Boolean))].map(value=>[value,value]));
 return {courses:choices(records.flatMap(ataCourses)),years:choices(records.map(ataYear))};
}
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function filterAtaList(records,{query='',status=[],types=[],courses=[],years=[]}={}){
 const picked={status:selectionValues(status),types:selectionValues(types),courses:selectionValues(courses),years:selectionValues(years)};
 const matches=(key,values)=>!picked[key].length||values.some(value=>picked[key].includes(value));
 return records.filter(a=>matches('status',[a.status,...(a.status_assinatura==='assinada'?['assinada']:[])])&&matches('types',[a.tipo==='historica'?'historica':'regular'])&&matches('courses',ataCourses(a))&&matches('years',[ataYear(a)])&&norm([ataNumber(a),ataTitle(a),ataFields(a).curso].join(' ')).includes(norm(query)));
}
// Reutiliza a paginação autorizada existente, sem limitar os filtros à primeira página.
export async function completeAtaList(first,fetchPage,isCurrent=()=>true){
 let records=[...first],page=first;const seen=new Set(records.map(a=>a.id));
 while(page.length===100&&isCurrent()){
  const cursor=page.at(-1);page=await fetchPage({p_limite:100,p_ano:cursor.ano,p_numero:cursor.numero,p_complemento:cursor.numero_complemento??0});
  if(!isCurrent())return [];
  if(page.some(a=>seen.has(a.id)))throw Error('A lista de atas mudou durante a consulta. Atualize o acervo.');
  for(const a of page)seen.add(a.id);records.push(...page);
 }
 return records;
}
