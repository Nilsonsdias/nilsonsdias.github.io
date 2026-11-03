export function parseOrdem(value,tipo='regular'){
 let text=String(value??'').trim().replace(/\s+/g,' ');let type=tipo||'regular';
 if(!['regular','modulo'].includes(type))throw Error('Tipo de ordem inválido.');
 const module=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/^modulo ([0-9]{1,10})$/i);
 if(module){type='modulo';text=module[1];}
 if(!['regular','modulo'].includes(type)||!/^\d{1,10}$/.test(text))throw Error('Informe ordem de 1 a 10 ou Módulo seguido de número positivo.');
 const numero=Number(text);if(numero<1||numero>2147483647||(type==='regular'&&numero>10))throw Error('Ordem regular deve ser de 1 a 10; módulo deve ter número positivo.');
 return {numero,tipo:type,rotulo:type==='modulo'?'Módulo '+numero:String(numero)};
}
export function ordemLabel(value,tipo='regular'){
 if(value==null||String(value).trim()==='')return '';
 try{return parseOrdem(value,tipo).rotulo;}catch{return String(value);}
}
// Uma oferta pode pertencer a várias ordens; cada item conserva o próprio tipo.
export function parseOrdens(value,tipo='regular'){
 const input=Array.isArray(value)?value:String(value??'').split(',');
 if(!input.length||input.length>100)throw Error('Informe entre 1 e 100 ordens separadas por vírgula.');
 const list=input.map(item=>{if(item&&typeof item==='object'){if(!Object.hasOwn(item,'numero')||!Object.hasOwn(item,'tipo'))throw Error('Item de ordem inválido.');return parseOrdem(item.numero,item.tipo);}return parseOrdem(item,tipo);});
 const unique=[...new Map(list.map(o=>[o.tipo+':'+o.numero,o])).values()];
 return unique.sort((a,b)=>Number(a.tipo==='modulo')-Number(b.tipo==='modulo')||a.numero-b.numero);
}
export function ordensDados(value){
 const list=parseOrdens(value),first=list[0];
 return {ordem_disciplina:first.numero,ordem_tipo:first.tipo,ordens_disciplina:list.length>1?list.map(({numero,tipo})=>({numero,tipo})):null};
}
export function ordensOf(row){
 if(row?.contexto?.ofertas?.length)return [...new Set(row.contexto.ofertas.flatMap(ordensOf))].sort(compareOrdens);
 if(Array.isArray(row?.ordens_disciplina))return parseOrdens(row.ordens_disciplina).map(o=>o.rotulo);
 const label=ordemLabel(row?.ordem_disciplina,row?.ordem_tipo);return label?[label]:[];
}
export const ordemOf=row=>ordensOf(row).join(', ');
export function compareOrdens(a,b){
 try{const x=parseOrdem(a),y=parseOrdem(b);return Number(x.tipo==='modulo')-Number(y.tipo==='modulo')||x.numero-y.numero;}catch{return String(a).localeCompare(String(b),'pt-BR',{numeric:true});}
}
