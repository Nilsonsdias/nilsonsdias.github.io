// Identificador histórico: base e complemento, nunca ponto flutuante.
export function parseHistoricalNumber(value){
 const s=String(value??'').trim(),m=/^([0-9]{1,15})(?:\.([0-9]{1,9}))?$/.exec(s);
 if(!m||Number(m[1])<1||(m[2]!==undefined&&Number(m[2])<1))throw Error('Informe um número como 2 ou 2.1. O complemento após o ponto deve ser inteiro positivo.');
 const numero=Number(m[1]),numero_complemento=m[2]===undefined?0:Number(m[2]);
 return {numero,numero_complemento,rotulo:String(numero)+(numero_complemento?'.'+numero_complemento:'')};
}
export function historicalNumberValue(value){try{const p=parseHistoricalNumber(value);return p.numero_complemento?p.rotulo:p.numero;}catch{return NaN;}}
export function historicalNumberLabel(record){return String(record.numero)+(record.tipo!=='digital'&&record.numero_complemento?'.'+record.numero_complemento:'');}
export function validHistoricalNumber(value){try{parseHistoricalNumber(value);return true;}catch{return false;}}
