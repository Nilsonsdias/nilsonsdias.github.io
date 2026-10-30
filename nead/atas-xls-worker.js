// Biblioteca local fixada. A planilha é lida em worker; macros/fórmulas não são executadas.
importScripts('./vendor/sheetjs/xlsx.full.min.js');
self.onmessage=e=>{
 try{
  const bytes=new Uint8Array(e.data);
  if(bytes.length>10485760||![208,207,17,224,161,177,26,225].every((v,i)=>bytes[i]===v))throw Error('Arquivo XLS binário inválido. Salve como XLSX se necessário.');
  const wb=XLSX.read(bytes,{type:'array',cellFormula:false,cellHTML:false,cellStyles:false,bookVBA:false,bookDeps:false,sheetRows:502,raw:true});
  if(wb.Workbook?.WBProps?.date1904)throw Error('Salve a planilha usando calendário de datas 1900.');
  const sheets=wb.SheetNames.map(name=>({name,rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,blankrows:false,defval:''}).map(r=>r.map(v=>String(v??'')))})).filter(s=>s.rows.length>=2);
  if(!sheets.length||sheets.some(s=>s.rows.length>501||s.rows.some(r=>r.length>101)))throw Error('Use uma aba tabular com até 500 atas e 101 colunas.');
  self.postMessage({sheets});
 }catch(error){self.postMessage({error:error.message||'Não foi possível ler o XLS.'});}
};
