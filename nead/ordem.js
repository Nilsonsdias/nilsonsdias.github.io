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
export const ordemOf=row=>ordemLabel(row?.ordem_disciplina,row?.ordem_tipo);
export function compareOrdens(a,b){
 try{const x=parseOrdem(a),y=parseOrdem(b);return Number(x.tipo==='modulo')-Number(y.tipo==='modulo')||x.numero-y.numero;}catch{return String(a).localeCompare(String(b),'pt-BR',{numeric:true});}
}
