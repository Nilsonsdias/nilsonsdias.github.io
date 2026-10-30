import {escapeHtml as esc,formatDate} from './model.js?v=20261027-atas-4';
import {readHistoricalWorkbook} from './atas-sheet-reader.js';
import {parseHistoricalRows,historicalIssues,matchHistoricalFile,checkHistoricalPdf,historicalKey,historicalForm,runHistoricalBatch} from './atas-batch-model.js';
const serverLabels={ocupada:'Número já utilizado no acervo.',excluida:'Registro excluído: trate a reimportação pelo formulário individual.',fora_da_reserva:'Número fora da faixa histórica reservada.',duplicado_no_lote:'Número repetido no lote.'};
export function createHistoricalBatch({app,state,rpc,archive,notify,onImported}){
 return {open(){
  if(!state.user?.id||!state.profile?.pode_editar)throw Error('Seu acesso não permite importar atas.');
  const operator=state.user.id,d=document.createElement('dialog');d.className='atas-batch-dialog';d.id='atas-batch-dialog';
  let rows=[],sheets=[],files=[],page=0,busy=false,uploading=false,stop=false,changed=false;
  const active=()=>state.user?.id===operator;
  const order=()=>Number(d.querySelector('#batch-order').value);
  d.innerHTML='<div class="actions batch-heading"><div><h2>Importar atas históricas em lote</h2><p>Uma ordem por lote. Título da reunião e disciplina terão o mesmo nome.</p></div><button type="button" class="button secondary" data-batch="close">Fechar</button></div>'+
   '<section class="batch-setup"><label class="field">Relação de atas (XLS ou XLSX, até 10 MB)<input id="batch-sheet-file" type="file" accept=".xls,.xlsx"></label><label class="field" id="batch-sheet-label" hidden>Aba da planilha<select id="batch-sheet"></select></label>'+
   '<div class="form-grid"><label class="field">Ordem das disciplinas<input id="batch-order" type="number" min="1" max="2147483647" step="1" value="1"></label><label class="field">Pasta dos PDFs<input id="batch-folder" type="file" webkitdirectory multiple></label><label class="field">Alternativa: selecionar PDFs<input id="batch-files" type="file" accept=".pdf,application/pdf" multiple></label></div><p class="section-note" id="batch-source">Selecione a planilha e a pasta acessível neste computador.</p></section>'+
   '<div class="notice">Números de 1 a 170 estão reservados para históricas de 2026. Nenhum número será gerado para estas importações. Arquivos existentes não serão substituídos pelo lote.</div>'+
   '<div class="actions wrap batch-toolbar"><button class="button secondary" type="button" data-batch="check">Conferir dados e arquivos</button><label class="field">Mostrar<select id="batch-filter"><option value="all">Todas as atas</option><option value="pending">Com pendências</option><option value="ready">Aptas para importar</option><option value="sent">Importadas</option></select></label><button class="button secondary" type="button" data-batch="report">Baixar relatório CSV</button></div>'+
   '<p class="section-note" id="batch-message" role="status" aria-live="polite"></p><div id="batch-editor"></div><div class="table-scroll"><table class="batch-table"><thead><tr><th>Selecionar</th><th>Número / ano</th><th>Arquivo / título e disciplina</th><th>Data / curso(s)</th><th>Situação</th><th>Ações</th></tr></thead><tbody id="batch-rows"></tbody></table></div>'+
   '<div class="table-footer"><span id="batch-page"></span><div class="actions"><button class="button secondary" type="button" data-batch="prev">Anterior</button><button class="button secondary" type="button" data-batch="next">Próxima</button></div></div>'+
   '<div class="actions wrap batch-bottom"><label class="check"><input type="checkbox" id="batch-confirm"> Conferi os documentos e autorizo importar somente as atas selecionadas.</label><button class="button primary" type="button" data-batch="import">Importar selecionadas</button><button class="button secondary" type="button" data-batch="stop" hidden>Parar após o arquivo atual</button></div>'+
   '<p class="section-note">PDFs históricos são preservados como arquivos finais assinados. Imagens precisam ser convertidas para PDF antes da seleção. O lote grava um documento por vez; se houver interrupção, as atas já confirmadas permanecem importadas.</p>';
  app.append(d);d.showModal();
  const message=(text,error=false)=>{const el=d.querySelector('#batch-message');el.textContent=text;el.classList.toggle('error',error);};
  const issues=r=>historicalIssues(r,rows,order());
  const reasons=r=>[...issues(r),...(r.fileError?[r.fileError]:[]),...(r.servidor&&r.servidor!=='livre'?[serverLabels[r.servidor]||'Conferência do acervo pendente.']:[]),...(!r.servidor?['Confira os dados e arquivos antes de importar.']:[])];
  const ready=r=>!r.resultado&&r.servidor==='livre'&&r.file&&!reasons(r).length;
  function render(){
   const filter=d.querySelector('#batch-filter').value,filtered=rows.filter(r=>filter==='all'||filter==='sent'&&r.resultado==='importada'||filter==='ready'&&ready(r)||filter==='pending'&&r.resultado!=='importada'&&!ready(r));
   const pages=Math.max(1,Math.ceil(filtered.length/8));page=Math.min(page,pages-1);
   d.querySelector('#batch-rows').innerHTML=filtered.slice(page*8,page*8+8).map(r=>'<tr><td><input type="checkbox" data-select="'+r.linha+'" aria-label="Selecionar ata '+esc(r.numero)+'" '+(r.selecionada?'checked':'')+' '+(!ready(r)||busy?'disabled':'')+'></td><td>'+esc(Number.isFinite(r.numero)?r.numero:'Inválido')+'/'+esc(r.data_ata.slice(0,4)||'—')+'</td><td><strong>'+esc(r.titulo)+'</strong><div class="table-sub">'+esc(r.arquivo)+'</div></td><td>'+formatDate(r.data_ata)+'<div class="table-sub">'+esc(r.curso)+'</div></td><td>'+esc(r.resultado==='importada'?'Importada':r.resultado==='enviando'?'Enviando…':r.resultado==='conferir'?'Envio sem confirmação — confira o acervo':ready(r)?'Apta para importar':reasons(r).join(' '))+(r.erro?'<div class="error">'+esc(r.erro)+'</div>':'')+'</td><td><div class="actions wrap"><button class="text-button" type="button" data-edit="'+r.linha+'" '+(busy||r.resultado?'disabled':'')+'>Revisar</button>'+(r.file?'<button class="text-button" type="button" data-pdf="'+r.linha+'" '+(busy?'disabled':'')+'>Ver PDF</button>':'')+'</div></td></tr>').join('')||'<tr><td colspan="6">Nenhuma ata nesta seleção.</td></tr>';
   d.querySelector('#batch-page').textContent=rows.length+' atas · '+rows.filter(ready).length+' aptas · '+rows.filter(r=>r.resultado==='importada').length+' importadas · Página '+(page+1)+' de '+pages;
   d.querySelector('[data-batch=prev]').disabled=busy||page===0;d.querySelector('[data-batch=next]').disabled=busy||page===pages-1;
   d.querySelector('[data-batch=import]').disabled=busy||!rows.some(r=>r.selecionada&&ready(r))||!d.querySelector('#batch-confirm').checked;
   d.querySelector('[data-batch=check]').disabled=busy||!rows.length;
   d.querySelector('[data-batch=close]').disabled=busy;
   d.querySelector('[data-batch=stop]').hidden=!uploading;d.querySelector('[data-batch=stop]').disabled=stop;
   d.querySelectorAll('.batch-setup input,.batch-setup select,#batch-filter,#batch-confirm').forEach(el=>el.disabled=busy);
  }
  function invalidate(){for(const r of rows)if(!r.resultado){r.servidor=null;r.file=null;r.fileError='';r.selecionada=false;}d.querySelector('#batch-confirm').checked=false;render();}
  function loadSheet(){rows=parseHistoricalRows(sheets[Number(d.querySelector('#batch-sheet').value)].rows);page=0;d.querySelector('#batch-editor').replaceChildren();invalidate();message(rows.length+' atas lidas. Selecione a pasta e confira os dados.');}
  async function check(){
   if(!active())throw Error('Sua sessão mudou. Feche o lote e entre novamente.');
   busy=true;state.busy=true;render();let done=0;
   try{
    for(const r of rows){if(r.resultado==='importada')continue;r.selecionada=false;r.servidor=null;r.file=null;r.fileError='';if(r.resultado==='conferir'){r.resultado=null;r.erro='';}const match=matchHistoricalFile(r,files);r.fileError=match.error;if(match.file){try{await checkHistoricalPdf(match.file);r.file=match.file;}catch(e){r.fileError=e.message;}}}
    const valid=rows.filter(r=>Number.isSafeInteger(r.numero)&&r.numero>0&&/^\d{4}-\d{2}-\d{2}$/.test(r.data_ata)&&r.resultado!=='importada');
    if(valid.length){const statuses=await rpc('nead_conferir_lote_historicas',{p_itens:valid.map(r=>({numero:r.numero,data_ata:r.data_ata}))});if(!active())throw Error('Sua sessão mudou durante a conferência.');for(const r of valid){const status=statuses.find(s=>s.numero===r.numero&&s.ano===Number(r.data_ata.slice(0,4)));r.servidor=status?.situacao||null;}}
    for(const r of rows){r.selecionada=ready(r);if(r.selecionada)done++;}
    message(done+' ata(s) apta(s). Revise as pendências ou desmarque as que não deseja importar.');
   }finally{busy=false;state.busy=false;render();}
  }
  function edit(r){
   const holder=d.querySelector('#batch-editor');holder.innerHTML='<section class="panel panel-body"><h3>Revisar linha '+r.linha+' · Ata '+esc(r.numero)+'</h3>'+(r.observacoes?'<p class="notice">'+esc(r.observacoes)+'</p>':'')+'<div class="form-grid"><label class="field">Nome do arquivo<input name="batch-filename" value="'+esc(r.arquivo)+'"></label><label class="field">Número original da ata<input name="batch-number" type="number" min="1" value="'+esc(Number.isFinite(r.numero)?r.numero:'')+'"></label><label class="field">Título da reunião e disciplina<input name="batch-title" maxlength="300" value="'+esc(r.titulo)+'"></label><label class="field">Data da reunião<input name="batch-date" type="date" value="'+esc(r.data_ata)+'"></label><label class="field">Curso(s)<input name="batch-course" maxlength="500" value="'+esc(r.curso)+'"></label></div><label class="check"><input id="batch-reviewed" type="checkbox" '+(r.revisado?'checked':'')+'> Conferi os dados no documento original.</label><div class="actions"><button class="button secondary" type="button" data-apply="'+r.linha+'">Aplicar revisão</button><button class="text-button" type="button" data-batch="close-editor">Fechar revisão</button></div></section>';
  }
  async function preview(r){const viewer=document.createElement('dialog');viewer.className='ata-viewer';viewer.innerHTML='<div class="actions"><h2>PDF da ata '+esc(r.numero)+'</h2><button class="button secondary" type="button">Fechar</button></div><div class="ata-pdf-pages"></div>';app.append(viewer);viewer.querySelector('button').onclick=()=>viewer.close();viewer.addEventListener('close',()=>viewer.remove(),{once:true});viewer.showModal();try{const {mountPdfViewer}=await import('./pdf-viewer.js?v=20261027-atas-5');if(viewer.open)await mountPdfViewer(viewer.querySelector('.ata-pdf-pages'),r.file);}catch(e){viewer.querySelector('.ata-pdf-pages').textContent=e.message;}}
  d.addEventListener('change',async e=>{
   if(busy)return;
   try{
    if(e.target.id==='batch-sheet-file'){
     const file=e.target.files[0];if(!file)return;rows=[];sheets=[];render();busy=true;state.busy=true;render();
     try{sheets=await readHistoricalWorkbook(file);if(!active())throw Error('Sua sessão mudou.');d.querySelector('#batch-sheet').innerHTML=sheets.map((s,i)=>'<option value="'+i+'">'+esc(s.name)+'</option>').join('');d.querySelector('#batch-sheet-label').hidden=sheets.length<2;loadSheet();}
     finally{busy=false;state.busy=false;render();}
    }else if(e.target.id==='batch-sheet')loadSheet();
    else if(['batch-folder','batch-files'].includes(e.target.id)){files=Array.from(e.target.files||[]);invalidate();d.querySelector('#batch-source').textContent=files.length+' arquivos selecionados. Somente arquivos vinculados a linhas escolhidas serão enviados.';}
    else if(e.target.id==='batch-order')invalidate();
    else if(e.target.id==='batch-filter'){page=0;render();}
    else if(e.target.id==='batch-confirm')render();
    else if(e.target.dataset.select){const r=rows.find(r=>r.linha===Number(e.target.dataset.select));r.selecionada=e.target.checked&&ready(r);render();}
   }catch(error){message(error.message,true);}
  });
  d.addEventListener('click',async e=>{
   const b=e.target.closest('button');if(!b)return;const action=b.dataset.batch;
   if(action==='stop'){stop=true;b.disabled=true;message('O lote será interrompido após confirmar o arquivo atual.');return;}if(busy)return;
   try{
    if(action==='close'){d.close();return;}
    if(action==='close-editor'){d.querySelector('#batch-editor').replaceChildren();return;}
    if(action==='prev'||action==='next'){page+=action==='next'?1:-1;render();return;}
    if(action==='check'){await check();return;}
    if(b.dataset.edit){edit(rows.find(r=>r.linha===Number(b.dataset.edit)));return;}
    if(b.dataset.pdf){await preview(rows.find(r=>r.linha===Number(b.dataset.pdf)));return;}
    if(b.dataset.apply){const r=rows.find(r=>r.linha===Number(b.dataset.apply)),h=d.querySelector('#batch-editor');r.arquivo=h.querySelector('[name=batch-filename]').value.trim();r.numero=Number(h.querySelector('[name=batch-number]').value);r.titulo=h.querySelector('[name=batch-title]').value.trim();r.disciplina=r.titulo;r.data_ata=h.querySelector('[name=batch-date]').value;r.curso=h.querySelector('[name=batch-course]').value.trim();r.revisado=h.querySelector('#batch-reviewed').checked;invalidate();message('Revisão aplicada ao lote. Confira novamente os dados e arquivos.');return;}
    if(action==='report'){const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';const csv='\uFEFF'+[['Linha','Número','Ano','Arquivo','Título / disciplina','Data','Curso(s)','Resultado'],...rows.map(r=>[r.linha,r.numero,r.data_ata.slice(0,4),r.arquivo,r.titulo,r.data_ata,r.curso,r.resultado||reasons(r).join(' ')||'Apta para importar'])].map(r=>r.map(cell).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='conferencia-atas-ordem-'+order()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    if(action==='import'){
     const selected=rows.filter(r=>r.selecionada&&ready(r));if(!selected.length||!d.querySelector('#batch-confirm').checked)return;
     if(!active())throw Error('Sua sessão mudou. Feche o lote.');
     if(!confirm('Importar '+selected.length+' ata(s) históricas da ordem '+order()+'? Cada PDF confirmado será preservado como documento final assinado.'))return;
     busy=true;uploading=true;state.busy=true;stop=false;changed=true;render();const selectedOrder=order();
     try{
      const sent=await runHistoricalBatch(selected,{active,stop:()=>stop,send:r=>{if(!active())throw Error('Sessão alterada.');return archive(historicalForm(r,selectedOrder,r.file));},progress:r=>{message('Ata '+r.numero+'/'+r.data_ata.slice(0,4)+': '+(r.resultado==='importada'?'importação confirmada':r.resultado==='enviando'?'enviando PDF…':'envio sem confirmação'),r.resultado==='conferir');render();}});
      changed=changed||sent>0;d.querySelector('#batch-confirm').checked=false;message(sent+' ata(s) confirmada(s) neste envio. '+(selected.some(r=>r.resultado==='conferir')?'Confira o acervo antes de repetir o registro sem confirmação.':stop?'Lote interrompido a seu pedido.':'As demais linhas permanecem disponíveis para conferência.'));
     }finally{busy=false;uploading=false;state.busy=false;render();}
    }
   }catch(error){message(error.message,true);}
  });
  d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  d.addEventListener('close',()=>{d.remove();if(changed&&active())onImported().catch(e=>notify(e.message,true));},{once:true});render();
 }};
}
