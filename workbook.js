// Leitor XLSX limitado a dados tabulares. Não executa fórmulas, macros ou links.
const decoder=new TextDecoder();
const fail=message=>{throw Error(message);};
const xml=bytes=>{const doc=new DOMParser().parseFromString(decoder.decode(bytes),'application/xml');if(doc.querySelector('parsererror'))fail('XML inválido no XLSX.');return doc;};
export async function unzipWorkbook(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)fail('Arquivo XLSX inválido.');if(v.getUint16(end+4,true)||v.getUint16(end+6,true))fail('XLSX dividido não é suportado.');
 const count=v.getUint16(end+10,true),offset=v.getUint32(end+16,true);if(count>2000)fail('XLSX contém arquivos demais.');let cursor=offset,total=0;const files={};
 for(let i=0;i<count;i++){
  if(cursor+46>bytes.length||v.getUint32(cursor,true)!==0x02014b50)fail('Diretório XLSX inválido.');
  const flags=v.getUint16(cursor+8,true),method=v.getUint16(cursor+10,true),compressed=v.getUint32(cursor+20,true),size=v.getUint32(cursor+24,true),nameLength=v.getUint16(cursor+28,true),extra=v.getUint16(cursor+30,true),comment=v.getUint16(cursor+32,true),local=v.getUint32(cursor+42,true);
  const name=decoder.decode(bytes.subarray(cursor+46,cursor+46+nameLength));cursor+=46+nameLength+extra+comment;
  if(name.includes('..')||name.startsWith('/')||flags&1)fail('XLSX protegido ou caminho inválido.');
  if(!/^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml))$/.test(name))continue;
  total+=size;if(total>31457280||size>15728640)fail('Conteúdo descompactado excede o limite.');
  if(local+30>bytes.length||v.getUint32(local,true)!==0x04034b50)fail('Entrada XLSX inválida.');
  const start=local+30+v.getUint16(local+26,true)+v.getUint16(local+28,true);if(start+compressed>bytes.length)fail('Entrada XLSX incompleta.');
  const raw=bytes.subarray(start,start+compressed);let data;
  if(method===0)data=raw;
  else if(method===8){const reader=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),chunks=[];let length=0;while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>size||length>15728640){await reader.cancel();fail('Conteúdo XLSX excede o tamanho declarado.');}chunks.push(value);}data=new Uint8Array(length);let pos=0;for(const chunk of chunks){data.set(chunk,pos);pos+=chunk.length;}}
  else fail('Compressão XLSX não suportada.');
  if(data.length!==size)fail('Tamanho de entrada XLSX divergente.');files[name]=data;
 }
 return files;
}
export async function readWorkbook(file){
 if(file.size>10485760)fail('XLSX deve ter até 10 MB.');const files=await unzipWorkbook(new Uint8Array(await file.arrayBuffer()));
 if(!files['xl/workbook.xml']||!files['xl/_rels/workbook.xml.rels'])fail('Pasta de trabalho XLSX incompleta.');
 const relations=Object.fromEntries([...xml(files['xl/_rels/workbook.xml.rels']).getElementsByTagName('Relationship')].filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
 const strings=files['xl/sharedStrings.xml']?[...xml(files['xl/sharedStrings.xml']).getElementsByTagName('si')].map(s=>[...s.getElementsByTagName('t')].map(t=>t.textContent).join('')):[];
 if(xml(files['xl/workbook.xml']).getElementsByTagName('workbookPr')[0]?.getAttribute('date1904')==='1')fail('Exporte esta pasta de trabalho com calendário de datas 1900 ou use CSV.');
 const sheets=[];for(const sheet of xml(files['xl/workbook.xml']).getElementsByTagName('sheet')){
  const target=relations[sheet.getAttribute('r:id')];if(!target)continue;const name=target.startsWith('/')?target.slice(1):'xl/'+target;if(!files[name])continue;
  const doc=xml(files[name]),rows=[];for(const row of doc.getElementsByTagName('row')){const values=[];
   for(const cell of row.getElementsByTagName('c')){const ref=cell.getAttribute('r')||'',letters=ref.match(/^[A-Z]+/)?.[0];if(!letters)continue;let col=0;for(const c of letters)col=col*26+c.charCodeAt(0)-64;col--;if(col>100)fail('Use uma planilha tabular com até 101 colunas.');const type=cell.getAttribute('t'),raw=cell.getElementsByTagName('v')[0]?.textContent||'';if(cell.getElementsByTagName('f').length&&!raw)fail('Fórmula sem valor salvo: abra e salve o XLSX antes de importar.');values[col]=type==='s'?(strings[Number(raw)]??''):type==='inlineStr'?[...cell.getElementsByTagName('t')].map(t=>t.textContent).join(''):raw;}
   if(values.some(x=>String(x).trim()))rows.push(Array.from({length:values.length},(_,i)=>String(values[i]??'')));if(rows.length>501)fail('A aba contém mais de 500 linhas de dados; divida o lote.');
  }
  if(rows.length>=2){const dates=rows[0].map((h,i)=>/^(INICIO|INICIO_SEMANA_PROVAS|TERMINO_SEMANA_PROVAS|SEGUNDA_CHAMADA|SUB_TERMINO|ENCERRAMENTO)$/.test(h.trim().toUpperCase())?i:-1).filter(i=>i>=0);for(const row of rows.slice(1))for(const i of dates)if(/^\d{4,6}(\.\d+)?$/.test(row[i]||'')){const serial=Number(row[i]);if(serial>=61&&serial<=2958465)row[i]=new Date(Date.UTC(1899,11,30)+Math.floor(serial)*86400000).toISOString().slice(0,10);}sheets.push({name:sheet.getAttribute('name'),rows});}
 }
 if(!sheets.length)fail('Nenhuma aba tabular com cabeçalhos encontrada.');return sheets;
}
