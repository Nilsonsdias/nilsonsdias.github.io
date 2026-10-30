import {createHistoricalBatch} from './atas-batch.js?v=20261030-lote-1';
import {guardAtaSession} from './ata-session.js';
import {renderMultiFilter,readMultiFilter} from './multi-filter.js?v=20261027-recolher-3';
import {escapeHtml as esc,formatDate} from './model.js?v=20261027-atas-4';
import {ataNumber,ataTitle,ataStatus,ataFields,parseNames,canCreateAta,canAttachSignedPdf} from './atas-model.js?v=20261029-reserva-1';
const btn=(label,action)=>'<button type="button" class="button secondary" data-ata-action="'+action+'">'+label+'</button>';
const names=(label,key,value,readonly=false)=>'<label class="field">'+label+'<textarea name="'+key+'" rows="3" '+(readonly?'readonly':'')+' placeholder="Um nome por linha">'+esc((value||[]).join('\n'))+'</textarea></label>';
function fields(d,readonly=false,category='alinhamento'){
 return '<label class="field">Curso<input name="curso" value="'+esc(d.curso||'')+'" maxlength="500" '+(readonly?'readonly':'')+'></label>'+
 (category==='administrativa'?names('Participantes (um por linha)','participantes',d.participantes,readonly):
 names('Professor(es), um por linha','professores',d.professores,readonly)+names('Mediadores Pedagógicos, um por linha','mediadores',d.mediadores,readonly));
}
const readFields=f=>({curso:String(f.get('curso')||''),professores:parseNames(f.get('professores')),mediadores:parseNames(f.get('mediadores')),participantes:parseNames(f.get('participantes'))});
export function installAtas({app,state,rpc,client,notify,renderView,loadData,openRecord}){
 const rawRpc=rpc;rpc=(...args)=>guardAtaSession(state,()=>rawRpc(...args));const invoke=(...args)=>guardAtaSession(state,()=>client.functions.invoke(...args));
 let draftRevision=null,draft=null,draftId=null,photo='',legenda='',urls=new Set(),working=false;
 const admin=()=>state.profile?.perfil==='administrador';
 const writable=()=>state.profile?.pode_editar;
 const canEdit=()=>writable()&&state.current?.tipo==='digital'&&state.current?.status==='rascunho';
 const fail=e=>notify(e.message||'Não foi possível concluir a operação.',true);
 const close=()=>document.querySelector('#atas-dialog')?.close();
 function dialog(html){
  close();const d=document.createElement('dialog');d.id='atas-dialog';d.innerHTML=html;app.append(d);
  d.addEventListener('close',()=>{d.querySelectorAll('[data-blob-url]').forEach(el=>{URL.revokeObjectURL(el.dataset.blobUrl);urls.delete(el.dataset.blobUrl);});d.remove();},{once:true});
  d.showModal();return d;
 }
 async function archive(body){
  const {data,error}=await invoke('nead-acervo',{body});
  if(error){let m='Não foi possível acessar o acervo. Confira a ata antes de repetir.';try{m=(await error.context.json()).error||m;}catch{}throw Error(m);}return data;
 }
 const batch=createHistoricalBatch({app,state,rpc,archive,notify,onImported:()=>loadData()});
 function carga(){
  const c=state.carga;if(!c)return '';
  const reservas=(c.reservas||[]).map(r=>esc(r.ano)+': números '+esc(r.inicio)+' a '+esc(r.fim)+' reservados para atas históricas; novas atas a partir de '+esc(Number(r.fim)+1)+'.').join(' ');
  return '<div class="notice"><div><strong>Numeração anual liberada</strong><p>'+reservas+' A importação histórica pode ser feita a qualquer tempo. Nos demais anos, a sequência inicia em 1.</p></div></div>';
 }
 function table(records){
  return '<div class="table-scroll"><table><thead><tr><th>Número / ano</th><th>Título / curso</th><th>Data</th><th>Situação</th><th>Ação</th></tr></thead><tbody>'+
  records.map(a=>'<tr><td class="number">'+esc(ataNumber(a))+'</td><td><strong>'+esc(ataTitle(a))+'</strong><div class="table-sub">'+esc(ataFields(a).curso)+'</div></td><td>'+formatDate(a.data_ata)+'</td><td>'+esc(ataStatus(a))+'</td><td><button class="row-open" data-ata-action="open" data-id="'+esc(a.id)+'">Abrir →</button></td></tr>').join('')+
  '</tbody></table></div>'+(records.length?'':'<p class="panel-body">Nenhuma ata encontrada.</p>');
 }
 function editor(main){
  const a=state.current,edit=canEdit();
  if(draftId!==a.id||(!state.dirty&&draftRevision!==a.revisao)){draftId=a.id;draftRevision=a.revisao;draft=ataFields(a);photo=draft.foto;legenda=draft.legenda;}
  main.innerHTML='<div class="page-heading"><div>'+btn('Voltar ao acervo','back')+'<h1>Ata '+esc(ataNumber(a))+'</h1><p>'+esc(ataTitle(a))+'</p></div><div class="actions"><span class="badge">'+esc(ataStatus(a))+'</span>'+
  (a.tipo==='historica'?btn('Visualizar PDF original','original')+btn('Baixar PDF original','download'):btn('Gerar PDF','pdf'))+
  (a.documento_assinado_id?btn('Visualizar PDF assinado','signed-view'):'')+
  (writable()&&canAttachSignedPdf(a)?btn(a.documento_assinado_id?'Substituir PDF assinado':'Anexar PDF assinado','signed-upload'):'')+
  (edit?btn('Salvar rascunho','save')+btn('Finalizar ata','finalize'):'')+(admin()?btn('Excluir ata','delete'):'')+'</div></div>'+
  (!edit?'<div class="notice">'+(a.tipo==='historica'?'O PDF histórico importado é o arquivo final assinado. Ele está preservado e não exige outro anexo de assinatura. Use Visualizar PDF original para consultar na tela.':'Conteúdo finalizado e preservado. Anexe o PDF assinado para registrar a assinatura.')+'</div>':'')+
  '<form id="atas-editor"><div class="editor-grid"><div><section class="panel panel-body"><h2>Identificação</h2><p>'+esc(ataNumber(a))+' · '+formatDate(a.data_ata)+' · '+(a.categoria==='administrativa'?'Administrativa':'Alinhamento')+'</p>'+
  (a.disciplina?'<p>Disciplina: '+esc(a.disciplina)+(a.ordem_disciplina?' · Ordem '+esc(a.ordem_disciplina):'')+'</p>':'')+'</section>'+
  (a.tipo==='historica'?'':'<section class="panel panel-body"><label class="field">Texto da ata<textarea name="texto" class="editor-text" '+(edit?'':'readonly')+'>'+esc(state.text)+'</textarea></label><p id="atas-dirty">'+(state.dirty?'Alterações não salvas':'Conteúdo salvo')+'</p></section>')+
  '<section class="panel panel-body"><h3>Foto e legenda opcionais</h3>'+(photo?'<img class="ata-photo-preview" alt="Foto da reunião" src="'+esc(photo)+'">':'')+
  (edit?'<label class="field">Foto da reunião<input type="file" id="atas-photo" accept="image/jpeg,image/png,image/webp"></label>'+(photo?btn('Remover foto','photo-remove'):''):'')+
  '<label class="field">Legenda<input name="legenda" maxlength="500" value="'+esc(legenda)+'" '+(edit?'':'readonly')+'></label></section></div>'+
  '<aside><section class="panel panel-body"><h3>Curso e participantes</h3>'+fields(draft,!edit,a.categoria)+'<p class="section-note">Nomes e curso pertencem a esta ata; não alteram Pessoas e Ofertas.</p></section>'+
  '<section class="panel panel-body"><h3>Assinatura</h3><p>'+esc(a.tipo==='historica'?'PDF histórico final assinado':a.status_assinatura==='assinada'?'Assinada':a.status==='rascunho'?'Não iniciada':'Aguardando PDF assinado')+'</p><p class="revision">Revisão '+a.revisao+'. Histórico preservado.</p></section>'+
  '</aside></div></form>';
 }
 function render(main){
  if(state.view==='editor'){editor(main);return true;}
  if(!['overview','records','historical','signatures'].includes(state.view))return false;
  const historical=state.view==='historical',signatures=state.view==='signatures';
  const heading=historical?'Atas históricas':signatures?'Assinaturas':'Gestão de atas';
  main.innerHTML='<div class="page-heading"><div><span class="eyebrow">ACERVO NEAD</span><h1>'+heading+'</h1><p>Atas de alinhamento e administrativas em uma única sequência anual.</p></div><div class="actions">'+
  (writable()?(historical?btn('Importar PDF original','import')+btn('Importação em lote','batch'):btn('Nova ata avulsa','new')):'')+btn('Atualizar','reload')+'</div></div>'+carga()+
  (state.view==='overview'?'<section class="stats" aria-label="Resumo do acervo">'+[['Total de atas',state.summary?.total],['Em elaboração',state.summary?.rascunhos],['Aguardando assinatura',state.summary?.aguardando_assinatura],['Acervo histórico',state.summary?.historicas]].map(([label,value])=>'<article class="stat"><div class="stat-top">'+label+'</div><div class="stat-value">'+(value??'—')+'</div></article>').join('')+'</section>':'')+
  (signatures?'<div class="notice">Para atas geradas no sistema: finalize a ata, gere o PDF e anexe o arquivo assinado manualmente ou por serviço externo. Atas históricas já possuem o PDF final e não entram nesta etapa. O envio não faz validação criptográfica.</div>':'')+
  '<section class="panel"><div class="list-toolbar"><input id="atas-search" type="search" class="filter-input" placeholder="Buscar número, título ou curso" aria-label="Buscar atas" value="'+esc(state.filter||'')+'">'+renderMultiFilter('atas-status','Situação',{rascunho:'Rascunho',finalizada:'Finalizada',registrada:'Histórica',assinada:'Assinada'},state.status,'Todas as situações')+btn('Limpar filtros','clear-filters')+'</div><div id="atas-results"></div><div class="table-footer">'+(state.hasMore?btn('Carregar mais','more'):'')+'</div></section>';
  const base=state.records.filter(a=>(!historical||a.tipo==='historica')&&(!signatures||canAttachSignedPdf(a)));
  const update=q=>{state.filter=q;const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');document.querySelector('#atas-results').innerHTML=table(base.filter(a=>(!Array.isArray(state.status)||!state.status.length||state.status.includes(a.status)||a.status_assinatura==='assinada'&&state.status.includes('assinada'))&&norm([ataNumber(a),ataTitle(a),ataFields(a).curso].join(' ')).includes(norm(q))));};
  document.querySelector('#atas-search').addEventListener('input',e=>update(e.target.value));document.querySelectorAll('[data-multi-filter="atas-status"]').forEach(el=>el.addEventListener('change',e=>{state.status=readMultiFilter(e.target).values;update(state.filter||'');}));update(state.filter||'');return true;
 }
 function sync(){
  const f=document.querySelector('#atas-editor');if(!f||!canEdit())return;
  const data=new FormData(f);draft={...readFields(data),foto:photo,legenda:String(data.get('legenda')||'')};legenda=draft.legenda;state.text=String(data.get('texto')||'');
  state.dirty=state.text!==(state.current.texto||'')||Object.keys(ataFields(state.current)).some(k=>JSON.stringify(draft[k])!==JSON.stringify(ataFields(state.current)[k]));
  const el=document.querySelector('#atas-dirty');if(el)el.textContent=state.dirty?'Alterações não salvas':'Conteúdo salvo';
 }
 function newForm(historical){
  const id=historical?'atas-import':'atas-new';
  const d=dialog('<h2>'+(historical?'Importar ata histórica':'Nova ata avulsa')+'</h2><p>'+(historical?'O ano será obtido da data do documento. Em 2026, use o número original de 1 a 170.':'O número será atribuído automaticamente na sequência do ano informado.')+'</p><form id="'+id+'" class="form-grid">'+
   '<label class="field">Categoria<select name="categoria"><option value="administrativa" '+(!historical?'selected':'')+'>Administrativa</option><option value="alinhamento" '+(historical?'selected':'')+'>Alinhamento</option></select></label>'+
   '<label class="field">Título da reunião<input name="titulo" maxlength="300" placeholder="Ex.: Reunião de Formação de Docentes"></label>'+
   (historical?'<label class="field">Número da ata<input name="numero" type="number" min="1" required></label>':'')+
   '<label class="field">Data da ata<input name="data_ata" type="date" required></label><label class="field" data-alignment>Disciplina<input name="disciplina"></label><label class="field" data-alignment>Ordem da disciplina<input name="ordem_disciplina" type="number" min="1"></label>'+
   '<div class="atas-person-fields"></div>'+
   (historical?'<label class="field">PDF original (até 20 MB)<input name="arquivo" type="file" accept="application/pdf,.pdf" required></label>':'')+
   '<p class="form-message error" role="alert"></p><div class="form-actions"><button type="submit" class="button primary">'+(historical?'Registrar original':'Criar rascunho')+'</button>'+btn('Cancelar','close')+'</div></form>');
  const category=d.querySelector('[name=categoria]'),holder=d.querySelector('.atas-person-fields');
  let saved={curso:'',professores:[],mediadores:[],participantes:[]};
  const update=()=>{saved={...saved,...readFields(new FormData(d.querySelector('form')))};holder.innerHTML=fields(saved,false,category.value);
   d.querySelectorAll('[data-alignment]').forEach(el=>el.hidden=category.value!=='alinhamento');
   d.querySelector('[name=titulo]').required=category.value==='administrativa';
   d.querySelector('[name=disciplina]').required=category.value==='alinhamento';
   d.querySelector('[name=ordem_disciplina]').required=category.value==='alinhamento';};
  category.addEventListener('change',update);update();
 }
 app.addEventListener('input',e=>{if(e.target.closest('#atas-editor'))sync();});
 app.addEventListener('change',async e=>{
  if(e.target.id!=='atas-photo')return;const file=e.target.files[0];if(!file||!canEdit())return;
  try{sync();if(file.size>10*1024*1024)throw Error('Selecione uma foto de até 10 MB.');
   const image=await createImageBitmap(file),canvas=document.createElement('canvas'),scale=Math.min(1,1600/image.width,1600/image.height);
   canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);image.close();
   photo=canvas.toDataURL('image/jpeg',.85);if(photo.length>2800000){photo=draft.foto||'';throw Error('Foto acima do limite. Selecione uma imagem menor.');}
   draft.foto=photo;state.dirty=true;renderView();
  }catch(error){fail(error);}
 });
 app.addEventListener('submit',async e=>{
  if(!['atas-import','atas-new','atas-signed','atas-editor'].includes(e.target.id))return;
  e.preventDefault();e.stopImmediatePropagation();if(e.target.id==='atas-editor')return;if(working)return;
  const form=e.target,submit=form.querySelector('[type=submit]');working=true;state.busy=true;submit.disabled=true;
  try{
   const f=new FormData(form);let a;
   if(form.id==='atas-new')a=await rpc('nead_criar_avulsa',{p_data:f.get('data_ata'),p_titulo:f.get('titulo'),p_categoria:f.get('categoria'),p_dados:readFields(f),p_disciplina:f.get('disciplina')||null,p_ordem:f.get('categoria')==='alinhamento'?Number(f.get('ordem_disciplina')):null});
   else a=(await archive(f)).ata;
   state.dirty=false;draftId=null;close();await loadData();await openRecord(a.id);notify(form.id==='atas-signed'?'PDF assinado registrado. Ata marcada como Assinada.':'Ata registrada e preservada.');
  }catch(error){form.querySelector('[role=alert]').textContent=error.message||'Operação não confirmada. Confira os dados.';}
  finally{working=false;state.busy=false;submit.disabled=false;}
 },true);
 app.addEventListener('click',async e=>{
  const el=e.target.closest('[data-ata-action]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();if(working)return;
  const action=el.dataset.ataAction;
  if(action==='close'){close();return;}
  if(action==='clear-filters'){state.filter='';state.status=[];renderView();return;}
  if(action==='open'){draftId=null;return openRecord(el.dataset.id);}
  if(action==='back'){if(state.dirty&&!confirm('Descartar alterações não salvas?'))return;state.dirty=false;state.current=null;state.view='records';return loadData();}
  if(action==='reload'){if(state.dirty&&!confirm('Descartar alterações não salvas?'))return;return loadData();}
  if(action==='more')return loadData(true);
  if(action==='batch'){batch.open();return;}
  if(action==='new'||action==='import'){
   if(action==='new'&&!canCreateAta(state.carga)){fail(Error('Conclua a importação histórica antes de criar novas atas.'));return;}
   newForm(action==='import');return;
  }
  if(action==='photo-remove'){sync();photo='';draft.foto='';state.dirty=true;renderView();return;}
  if(action==='signed-upload'){
   if(!canAttachSignedPdf(state.current)){fail(Error('O anexo de assinatura é exclusivo das atas geradas e finalizadas no sistema.'));return;}
   dialog('<h2>Anexar PDF assinado — '+esc(ataNumber(state.current))+'</h2><p>Selecione a ata já assinada manualmente ou por serviço externo. O original e as versões anteriores serão preservados.</p><form id="atas-signed"><label class="field">PDF assinado (até 20 MB)<input name="arquivo" type="file" accept="application/pdf,.pdf" required></label><input type="hidden" name="acao" value="assinado"><input type="hidden" name="ata_id" value="'+state.current.id+'"><input type="hidden" name="revisao" value="'+state.current.revisao+'"><p class="section-note">A indicação Assinada registra o recebimento; não é validação criptográfica.</p><p class="form-message error" role="alert"></p><div class="actions"><button class="button primary" type="submit">Registrar PDF assinado</button>'+btn('Cancelar','close')+'</div></form>');return;
  }
  if(action==='finalize'&&!confirm('Conferiu identificação, participantes e texto? Após finalizar o conteúdo ficará bloqueado.'))return;
  working=true;state.busy=true;el.disabled=true;
  try{
   if(action==='save'||action==='finalize'){
    sync();document.querySelectorAll('#atas-editor input,#atas-editor textarea').forEach(x=>x.disabled=true);
    const updated=await rpc('nead_salvar_ata_v2',{p_ata:state.current.id,p_revisao:state.current.revisao,p_texto:state.text,p_dados:draft,p_fonte_ia:state.iaSource||null,p_finalizar:action==='finalize'});
    state.current=updated;state.text=updated.texto;state.dirty=false;draftId=null;renderView();notify(action==='save'?'Rascunho salvo.':'Ata finalizada. Gere o PDF e anexe a versão assinada.');
   }else if(action==='delete'){
    const motivo=prompt('Motivo da exclusão (mínimo 5 caracteres). Histórico e arquivos serão preservados.');if(motivo===null)return;
    if(!confirm('Excluir a ata '+ataNumber(state.current)+' da listagem? O administrador poderá reimportar uma ata histórica no mesmo número, dentro da faixa reservada.'))return;
    await rpc('nead_excluir_ata',{p_ata:state.current.id,p_revisao:state.current.revisao,p_motivo:motivo});state.dirty=false;state.current=null;state.view='records';await loadData();notify('Ata excluída da listagem. Histórico e arquivos preservados.');
   }else if(action==='pdf'||action==='download'||action==='original'||action==='signed-view'){
    if(state.dirty)throw Error('Salve o rascunho antes de gerar o PDF.');
    const bytes=action==='pdf'?await(await import('./ata-pdf.js?v=20261027-atas-4')).generateAtaPdf(state.current):await archive({ata_id:state.current.id,assinado:action==='signed-view'});
    const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob);urls.add(url);
    if(action==='original'||action==='signed-view'){
     const d=dialog('<div class="actions"><h2>PDF da ata '+esc(ataNumber(state.current))+'</h2>'+btn('Fechar','close')+'</div><div class="ata-pdf-pages"></div><a class="button secondary">Baixar PDF</a>');d.classList.add('ata-viewer');
     d.querySelector('.ata-pdf-pages').dataset.blobUrl=url;const {mountPdfViewer}=await import('./pdf-viewer.js?v=20261027-atas-5');if(!d.open)return;await mountPdfViewer(d.querySelector('.ata-pdf-pages'),blob);const link=d.querySelector('a');link.href=url;link.download='Ata-'+ataNumber(state.current).replace('/','-')+'.pdf';
    }else{
     const link=document.createElement('a');link.href=url;link.download='Ata-'+ataNumber(state.current).replace('/','-')+'.pdf';link.click();setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},10000);
    }
   }

  }catch(error){fail(error);}
  finally{working=false;state.busy=false;el.disabled=false;document.querySelectorAll('#atas-editor input,#atas-editor textarea').forEach(x=>x.disabled=false);}
 },true);
 return {render};
}
