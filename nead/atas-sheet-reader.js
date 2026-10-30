import {readWorkbook} from './workbook.js';
export async function readHistoricalWorkbook(file){
 if(file.size>10485760)throw Error('Planilha deve ter até 10 MB.');
 if(/\.xlsx$/i.test(file.name))return readWorkbook(file);
 if(!/\.xls$/i.test(file.name))throw Error('Selecione uma planilha XLS ou XLSX.');
 const bytes=await file.arrayBuffer();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./atas-xls-worker.js',import.meta.url));
  const finish=(error,sheets)=>{clearTimeout(timer);worker.terminate();error?reject(Error(error)):resolve(sheets);};
  const timer=setTimeout(()=>finish('A leitura do XLS excedeu o tempo. Salve como XLSX e tente novamente.'),15000);
  worker.onerror=()=>finish('Falha ao ler o XLS. Salve como XLSX e tente novamente.');
  worker.onmessage=e=>finish(e.data.error,e.data.sheets);
  worker.postMessage(bytes,[bytes]);
 });
}
