const clean=v=>String(v??'').trim();
const norm=v=>clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_|_$/g,'');
export const fileKey=v=>clean(v).normalize('NFC').toLocaleLowerCase('pt-BR');
export function historicalDate(v){
 let s=clean(v);
 if(/^\d{4,6}(\.\d+)?$/.test(s)){const n=Number(s);if(n>=61&&n<=2958465)s=new Date(Date.UTC(1899,11,30)+Math.floor(n)*86400000).toISOString().slice(0,10);}
 if(/^\d{2}\/\d{2}\/\d{4}$/.test(s))s=s.split('/').reverse().join('-');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';
 const d=new Date(s+'T12:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s&&Number(s.slice(0,4))>=1900?s:'';
}
export function parseHistoricalRows(table){
 if(!Array.isArray(table)||table.length<2||table.length>501)throw Error('Use uma aba com cabeçalhos e de 1 a 500 atas.');
 const aliases={NOME_DO_ARQUIVO:'arquivo',ARQUIVO:'arquivo',DATA_DA_REUNIAO:'data_ata',DATA_DA_ATA:'data_ata',DATA:'data_ata',NUMERO_DA_ATA:'numero',NUMERO:'numero',TITULO_DA_REUNIAO:'titulo',TITULO:'titulo',DISCIPLINA:'disciplina',CURSO_S:'curso',CURSOS:'curso',CURSO:'curso',OBSERVACOES:'observacoes'};
 const keys=table[0].map(v=>aliases[norm(v)]||'');
 for(const key of ['arquivo','data_ata','numero','titulo','curso'])if(keys.filter(k=>k===key).length!==1)throw Error('Cabeçalho obrigatório ausente ou repetido: '+({arquivo:'Nome do arquivo',data_ata:'Data da reunião',numero:'Número da ata',titulo:'Título da reunião',curso:'Curso(s)'})[key]);
 return table.slice(1).filter(r=>r.some(v=>clean(v))).map((cells,i)=>{const r={linha:i+2};keys.forEach((k,j)=>{if(k)r[k]=clean(cells[j]);});r.numero=/^\d+$/.test(r.numero)?Number(r.numero):NaN;r.data_ata=historicalDate(r.data_ata);r.disciplina=r.titulo;r.revisado=false;r.selecionada=false;return r;});
}
export function historicalIssues(row,all,order){
 const out=[];
 if(!Number.isInteger(Number(order))||Number(order)<1||Number(order)>2147483647)out.push('Informe a ordem das disciplinas.');
 if(!Number.isSafeInteger(row.numero)||row.numero<1)out.push('Número da ata inválido.');
 if(!historicalDate(row.data_ata))out.push('Data da reunião inválida.');
 if(!clean(row.titulo)||row.titulo.length>300)out.push('Informe um título de até 300 caracteres.');
 if(!clean(row.curso)||row.curso.length>500||/^(NAO_IDENTIFICADO|NAO_INFORMADO|NAO_CONSTA)/.test(norm(row.curso)))out.push('Informe o curso.');
 if(!clean(row.arquivo)||/[\/\\]/.test(row.arquivo))out.push('Informe somente o nome completo do arquivo, com extensão.');
 if(!/\.pdf$/i.test(row.arquivo))out.push('Arquivo deve ser PDF. Converta a imagem fora do sistema e ajuste o nome na relação.');
 if(all.some(r=>r!==row&&r.numero===row.numero&&r.data_ata.slice(0,4)===row.data_ata.slice(0,4)))out.push('Número repetido no lote para o mesmo ano.');
 if(all.some(r=>r!==row&&fileKey(r.arquivo)===fileKey(row.arquivo)))out.push('Mesmo arquivo informado em mais de uma linha.');
 if(!row.revisado&&(/\bassinado\b/i.test(row.titulo)||/diverg|conferir|incert/i.test(row.observacoes||'')))out.push('Revise e confirme os dados desta linha.');
 return out;
}
export function matchHistoricalFile(row,files){
 const found=Array.from(files||[]).filter(f=>fileKey(f.name)===fileKey(row.arquivo));
 if(found.length!==1)return {file:null,error:found.length?'Nome duplicado na pasta. Selecione apenas um arquivo correspondente.':'Arquivo não localizado na pasta.'};
 if(found[0].size<20||found[0].size>20971520)return {file:null,error:'PDF deve ter até 20 MB e não pode estar vazio.'};
 return {file:found[0],error:''};
}
export async function checkHistoricalPdf(file){
 const head=new TextDecoder('latin1').decode(await file.slice(0,12).arrayBuffer());
 const tail=new TextDecoder('latin1').decode(await file.slice(-1024).arrayBuffer());
 if(!/^%PDF-(1\.[0-9]|2\.0)/.test(head)||!tail.includes('%%EOF'))throw Error('Conteúdo não reconhecido como PDF.');
}
export const historicalKey=r=>r.data_ata.slice(0,4)+'/'+r.numero;
export function historicalForm(row,order,file){
 const form=new FormData();
 for(const [k,v] of Object.entries({acao:'historica_lote',numero:row.numero,data_ata:row.data_ata,titulo:clean(row.titulo),disciplina:clean(row.titulo),categoria:'alinhamento',ordem_disciplina:Number(order),curso:clean(row.curso)}))form.set(k,String(v));
 form.set('arquivo',file);return form;
}

// Resultado incerto encerra o lote. Nunca repetir automaticamente um upload.
export async function runHistoricalBatch(rows,{send,active=()=>true,stop=()=>false,progress=()=>{}}){
 let sent=0;
 for(const row of rows){
  if(stop()||!active())break;
  row.resultado='enviando';progress(row);
  try{const result=await send(row);if(!result?.ata?.id||result.ata.numero!==row.numero||result.ata.ano!==Number(row.data_ata.slice(0,4)))throw Error('Resposta não confirmou a ata esperada.');row.resultado='importada';row.ata_id=result.ata.id;sent++;progress(row);if(!active())break;}
  catch(error){row.resultado='conferir';row.erro='Envio sem confirmação. Confira o acervo antes de tentar novamente. '+(error.message||'');progress(row);break;}
 }
 return sent;
}
