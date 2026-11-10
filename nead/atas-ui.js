import {ataType,ataFilterChoices,filterAtaList} from './atas-list.js?v=20261110-consulta-2';
import {ordemOf} from './ordem.js?v=20261103-multiplas-1';
import {canUseStandardText,standardTextDecision} from './ata-standard-text.js?v=20261030-padrao-1';
import {createHistoricalBatch} from './atas-batch.js?v=20261104-complemento-1';
import {guardAtaSession} from './ata-session.js';
import {renderMultiFilter,readMultiFilter} from './multi-filter.js?v=20261103-filtros-1';
import {escapeHtml as esc,formatDate} from './model.js?v=20261027-atas-4';
import {ataNumber,ataTitle,ataStatus,ataFields,ataParticipants,parseNames,canCreateAta,canAttachSignedPdf} from './atas-model.js?v=20261105-assinaturas-1';
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
  return '<div class="table-scroll"><table><thead><tr><th>Número / ano</th><th>Tipo</th><th>Título / curso</th><th>Data</th><th>Situação</th><th>Ação</th></tr></thead><tbody>'+
  records.map(a=>'<tr><td class="number">'+esc(ataNumber(a))+'</td><td>'+ataType(a)+'</td><td><strong>'+esc(ataTitle(a))+'</strong><div class="table-sub">'+esc(ataFields(a).curso)+'</div></td><td>'+formatDate(a.data_ata)+'</td><td>'+esc(ataStatus(a))+'</td><td><button class="row-open" data-ata-action="open" data-id="'+esc(a.id)+'">Abrir →</button></td></tr>').join('')+
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
  (!edit?'<div class="notice">'+(a.tipo==='historica'?'O PDF histórico importado é o arquivo final assinado. Ele está preservado e não exige outro anexo de assinatura. Use Visualizar PDF original para consultar na tela.':a.modalidade_assinatura==='codigo_email'?'Conteúdo finalizado. Acompanhe abaixo a coleta das assinaturas eletrônicas.':'Conteúdo finalizado e preservado. Anexe o PDF assinado para registrar a assinatura.')+'</div>':'')+
  '<form id="atas-editor"><div class="editor-grid"><div><section class="panel panel-body"><h2>Identificação</h2><p>'+esc(ataNumber(a))+' · '+formatDate(a.data_ata)+' · '+(a.categoria==='administrativa'?'Administrativa':'Alinhamento')+'</p>'+
  (a.disciplina?'<p>Disciplina: '+esc(a.disciplina)+(a.ordem_disciplina?' · Ordem '+esc(ordemOf(a)):'')+'</p>':'')+'</section>'+
  (a.tipo==='historica'?'':'<section class="panel panel-body"><div class="actions wrap" style="justify-content:space-between"><label class="field" for="atas-texto">Texto da ata</label>'+(canUseStandardText(a,writable())?btn('Usar texto padrão','standard-text'):'')+'</div><textarea id="atas-texto" name="texto" class="editor-text" '+(edit?'':'readonly')+'>'+esc(state.text)+'</textarea><p id="atas-dirty">'+(state.dirty?'Alterações não salvas':'Conteúdo salvo')+'</p></section>')+
  '<section class="panel panel-body"><h3>Foto e legenda opcionais</h3>'+(photo?'<img class="ata-photo-preview" alt="Foto da reunião" src="'+esc(photo)+'">':'')+
  (edit?'<label class="field">Foto da reunião<input type="file" id="atas-photo" accept="image/jpeg,image/png,image/webp"></label>'+(photo?btn('Remover foto','photo-remove'):''):'')+
  '<label class="field">Legenda<input name="legenda" maxlength="500" value="'+esc(legenda)+'" '+(edit?'':'readonly')+'></label></section></div>'+
  '<aside><section class="panel panel-body"><h3>Curso e participantes</h3>'+fields(draft,!edit,a.categoria)+'<p class="section-note">Nomes e curso pertencem a esta ata; não alteram Pessoas e Ofertas.</p></section>'+
  '<section class="panel panel-body" id="assinaturas-painel"><h3>Assinatura</h3><p>'+esc(a.tipo==='historica'?'PDF histórico final assinado':a.status_assinatura==='assinada'?'Assinada':a.status==='rascunho'?'Não iniciada':'Aguardando PDF assinado')+'</p><p class="revision">Revisão '+a.revisao+'. Histórico preservado.</p></section>'+
  '</aside></div></form>';
  if(a.modalidade_assinatura==='codigo_email')loadSignatures(a);
 }
 function render(main){
  if(state.view==='editor'){editor(main);return true;}
  if(!['overview','records','historical','signatures'].includes(state.view))return false;
  const signatures=state.view==='signatures';
  const choices=ataFilterChoices(state.records);
  const heading=signatures?'Assinaturas':state.view==='overview'?'Gestão de atas':'Atas Registradas';
  main.innerHTML='<div class="page-heading"><div><span class="eyebrow">ACERVO NEAD</span><h1>'+heading+'</h1><p>Atas de alinhamento e administrativas em uma única sequência anual.</p></div><div class="actions">'+
  (writable()?btn('Nova ata avulsa','new')+btn('Importar PDF original','import')+btn('Importação em lote','batch'):'')+btn('Atualizar','reload')+'</div></div>'+carga()+
  (state.view==='overview'?'<section class="stats" aria-label="Resumo do acervo">'+[['Total de atas',state.summary?.total],['Em elaboração',state.summary?.rascunhos],['Aguardando assinatura',state.summary?.aguardando_assinatura],['Acervo histórico',state.summary?.historicas]].map(([label,value])=>'<article class="stat"><div class="stat-top">'+label+'</div><div class="stat-value">'+(value??'—')+'</div></article>').join('')+'</section>':'')+
  (signatures?'<div class="notice">Nas novas atas, acompanhe a assinatura por código de e-mail. Após todas as assinaturas, o PDF final com auditoria será enviado aos signatários. As atas anteriores mantêm o anexo de PDF assinado; atas históricas já possuem o arquivo final.</div>':'')+
  '<section class="panel"><div class="list-toolbar wrap"><input id="atas-search" type="search" class="filter-input" placeholder="Buscar número, título ou curso" aria-label="Buscar atas" value="'+esc(state.filter||'')+'">'+renderMultiFilter('atas-status','Situação',{rascunho:'Rascunho',finalizada:'Finalizada',registrada:'Histórica',assinada:'Assinada'},state.status,'Todas as situações')+renderMultiFilter('atas-type','Tipo',{historica:'Histórica',regular:'Regular'},state.ataTypes,'Todos os tipos')+renderMultiFilter('atas-course','Curso',choices.courses,state.ataCourses,'Todos os cursos')+renderMultiFilter('atas-year','Ano',choices.years,state.ataYears,'Todos os anos',{type:'number'})+btn('Limpar filtros','clear-filters')+'</div><div id="atas-results"></div><div class="table-footer"><span id="atas-count"></span>'+(state.hasMore?btn('Carregar mais','more'):'')+'</div></section>';
  const base=state.records.filter(a=>(!signatures||canAttachSignedPdf(a)||a.modalidade_assinatura==='codigo_email'&&a.status==='finalizada'));
  const update=()=>{const records=filterAtaList(base,{query:state.filter,status:state.status,types:state.ataTypes,courses:state.ataCourses,years:state.ataYears});document.querySelector('#atas-results').innerHTML=table(records);document.querySelector('#atas-count').textContent=records.length+' resultado(s) · '+base.length+' ata(s) no acervo';};
  document.querySelector('#atas-search').addEventListener('input',e=>{state.filter=e.target.value;update();});
  const filterState={'atas-status':'status','atas-type':'ataTypes','atas-course':'ataCourses','atas-year':'ataYears'};
  document.querySelectorAll('[data-multi-filter^="atas-"]').forEach(el=>el.addEventListener('change',e=>{const selection=readMultiFilter(e.target);state[filterState[selection.key]]=selection.values;update();}));update();return true;
 }

 async function signature(body){
  const {data,error}=await invoke('nead-assinaturas',{body});
  if(error){let text='Operação de assinatura não confirmada.';try{text=(await error.context.json()).error||text;}catch{}throw Error(text);}return data;
 }
 async function loadSignatures(a){
  const holder=document.querySelector('#assinaturas-painel');if(!holder)return;
  if(a.status==='rascunho'){holder.innerHTML='<h3>Assinatura eletrônica</h3><p>Ao finalizar, confira o e-mail de cada participante. Todos receberão um convite para assinar por código de e-mail, sem conta no portal.</p>';return;}
  holder.innerHTML='<h3>Assinaturas</h3><p>Carregando situação…</p>';
  try{const e=await rpc('nead_assinaturas',{p_ata:a.id});if(state.current?.id!==a.id||!holder.isConnected)return;
   if(!e)throw Error('Solicitação ainda não disponível.');
   if(e.estado==='concluido'&&state.current.status_assinatura!=='assinada'){const updated=await rpc('nead_obter_ata',{p_ata:a.id});if(state.current?.id===a.id){state.current=updated;state.text=updated.texto;renderView();}return;}
   const done=e.signatarios.filter(s=>s.assinado_em).length;
   holder.innerHTML='<h3>Assinaturas: '+done+' de '+e.signatarios.length+'</h3><p>'+esc(({preparando:'Preparando PDF e convites',aguardando:'Aguardando assinaturas',pdf_pendente:'Assinaturas coletadas — preparando PDF final',concluido:'Assinada e concluída',revogado:'Solicitação revogada'})[e.estado])+'</p>'+e.signatarios.map(s=>'<div class="signer-status"><strong>'+esc(s.nome)+'</strong><p>'+esc(s.email)+'</p><p>'+esc(s.assinado_em?'Assinou em '+new Date(s.assinado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Pendente')+'</p><p>Convite: '+esc(s.convite||'aguardando PDF')+(e.estado==='concluido'?' · Cópia final: '+esc(s.copia_final||'pendente'):'')+'</p>'+(writable()&&!s.assinado_em&&e.estado==='aguardando'?'<div class="actions wrap">'+['copiar','reenviar','renovar','corrigir_email'].map(k=>'<button type="button" class="text-button" data-ata-action="sign-'+k+'" data-signer="'+s.id+'">'+({copiar:'Copiar link',reenviar:'Reenviar convite',renovar:'Renovar link',corrigir_email:'Corrigir e-mail'})[k]+'</button>').join('')+'</div>':'')+(writable()&&(s.convite==='incerto'||s.copia_final==='incerto')?'<button type="button" class="text-button" data-ata-action="sign-reprocessar" data-signer="'+s.id+'">Reprocessar confirmação de envio</button>':'')+(writable()&&s.copia_final==='incerto'?'<button type="button" class="text-button" data-ata-action="sign-reenviar_final" data-signer="'+s.id+'">Reenviar cópia final após conferência</button>':'')+'</div>').join('')+btn('Atualizar assinaturas','sign-refresh')+(writable()&&(['preparando','pdf_pendente'].includes(e.estado)||e.signatarios.some(s=>s.convite==='pendente'||s.copia_final==='pendente'))?btn('Processar pendências','sign-processar'):'')+(e.estado!=='preparando'&&e.estado!=='revogado'?btn(e.estado==='concluido'?'Baixar PDF final':'Baixar PDF para assinatura','sign-pdf'):'');
  }catch(error){if(holder.isConnected)holder.innerHTML='<h3>Assinaturas</h3><p>'+esc(error.message)+'</p>'+btn('Atualizar assinaturas','sign-refresh');}
 }
 async function signatureForm(){
  sync();const people=ataParticipants({...state.current,dados_ata:draft});const signers=[...new Map(people.map(p=>[p.nome,{nome:p.nome,papel:people.filter(x=>x.nome===p.nome).map(x=>x.papel).join(' / ')}])).values()];
  if(!signers.length)throw Error('Informe os participantes antes de finalizar.');
  const d=dialog('<h2>Conferir signatários</h2><p>Confira os e-mails. Após finalizar, o texto e os destinatários ficarão preservados. Cada participante receberá um convite individual; após todas as assinaturas, receberá também o PDF final.</p><form id="signers-finalize">'+signers.map((s,i)=>'<label class="field"><strong>'+esc(s.nome)+'</strong><span>'+esc(s.papel)+'</span><input type="email" name="email_'+i+'" autocomplete="off" required maxlength="254" aria-label="E-mail de '+esc(s.nome)+'"></label>').join('')+'<p class="form-message error" role="alert"></p><div class="actions"><button type="submit" class="button primary">Finalizar e solicitar assinaturas</button>'+btn('Cancelar','close')+'</div></form>');
  if(state.permissions?.pessoas&&state.permissions.pessoas!=='negado')try{const list=await rpc('nead_consultar',{p_modulo:'pessoas'});if(d.open)signers.forEach((s,i)=>{const matches=list.filter(p=>p.ativo&&p.nome_completo?.trim().toLocaleLowerCase('pt-BR')===s.nome.trim().toLocaleLowerCase('pt-BR'));if(matches.length===1)d.querySelector('[name=email_'+i+']').value=matches[0].email||'';});}catch{}
  d.querySelector('form').addEventListener('submit',async event=>{
   event.preventDefault();event.stopImmediatePropagation();if(working)return;
   const b=d.querySelector('[type=submit]');working=true;state.busy=true;b.disabled=true;
   try{const values=new FormData(event.target),payload=signers.map((s,i)=>({...s,email:String(values.get('email_'+i)||'').trim()}));
    await rpc('nead_finalizar_assinaturas',{p_ata:state.current.id,p_revisao:state.current.revisao,p_texto:state.text,p_dados:draft,p_signatarios:payload});
    const id=state.current.id;state.current=await rpc('nead_obter_ata',{p_ata:id});state.text=state.current.texto;state.dirty=false;draftId=null;close();renderView();notify('Ata finalizada. PDF e convites na fila de processamento.');
    try{await signature({acao:'processar',ata_id:id});if(state.current?.id===id)await loadSignatures(state.current);}catch{notify('Ata preservada; processamento pendente. Confira o painel de assinaturas.',true);}
   }catch(error){if(d.open)d.querySelector('[role=alert]').textContent=error.message;}finally{working=false;state.busy=false;if(b.isConnected)b.disabled=false;}
  });
 }

 function sync(){
  const f=document.querySelector('#atas-editor');if(!f||!canEdit())return;
  const data=new FormData(f);draft={...readFields(data),foto:photo,legenda:String(data.get('legenda')||'')};legenda=draft.legenda;state.text=String(data.get('texto')||'');
  state.dirty=state.text!==(state.current.texto||'')||Object.keys(ataFields(state.current)).some(k=>JSON.stringify(draft[k])!==JSON.stringify(ataFields(state.current)[k]));
  const el=document.querySelector('#atas-dirty');if(el)el.textContent=state.dirty?'Alterações não salvas':'Conteúdo salvo';
 }
 function newForm(historical){
  const id=historical?'atas-import':'atas-new';
  const d=dialog('<h2>'+(historical?'Importar ata histórica':'Nova ata avulsa')+'</h2><p>'+(historical?'O ano será obtido da data do documento. Em 2026, use o número original de 1 a 170. Para números repetidos no histórico, use um complemento, como 2.1.':'O número será atribuído automaticamente na sequência do ano informado.')+'</p><form id="'+id+'" class="form-grid">'+
   '<label class="field">Categoria<select name="categoria"><option value="administrativa" '+(!historical?'selected':'')+'>Administrativa</option><option value="alinhamento" '+(historical?'selected':'')+'>Alinhamento</option></select></label>'+
   '<label class="field">Título da reunião<input name="titulo" maxlength="300" placeholder="Ex.: Reunião de Formação de Docentes"></label>'+
   (historical?'<label class="field">Número da ata<input name="numero" type="text" inputmode="decimal" pattern="[0-9]+([.][0-9]+)?" maxlength="25" placeholder="2 ou 2.1" required></label>':'')+
   '<label class="field">Data da ata<input name="data_ata" type="date" required></label><label class="field" data-alignment>Disciplina<input name="disciplina"></label><label class="field" data-alignment>Ordem da disciplina<input name="ordem_disciplina" type="text" placeholder="1 a 10 ou Módulo 1"></label>'+
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
   if(form.id==='atas-new')a=await rpc('nead_criar_avulsa_v3',{p_data:f.get('data_ata'),p_titulo:f.get('titulo'),p_categoria:f.get('categoria'),p_dados:readFields(f),p_disciplina:f.get('disciplina')||null,p_ordem:f.get('categoria')==='alinhamento'?f.get('ordem_disciplina'):null});
   else a=(await archive(f)).ata;
   state.dirty=false;draftId=null;close();await loadData();await openRecord(a.id);notify(form.id==='atas-signed'?'PDF assinado registrado. Ata marcada como Assinada.':'Ata registrada e preservada.');
  }catch(error){form.querySelector('[role=alert]').textContent=error.message||'Operação não confirmada. Confira os dados.';}
  finally{working=false;state.busy=false;submit.disabled=false;}
 },true);
 app.addEventListener('click',async e=>{
  const el=e.target.closest('[data-ata-action]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();if(working)return;
  const action=el.dataset.ataAction;
  if(action==='close'){close();return;}
  if(action==='standard-text'||action==='standard-text-confirm'){
   sync();const result=standardTextDecision(state.current,writable(),state.text,action==='standard-text-confirm');
   if(result.action==='blocked')return;
   if(result.action==='confirm'){
    dialog('<h2>Substituir o texto da ata?</h2><p>O campo já possui conteúdo. Usar o texto padrão substituirá esse conteúdo na edição atual. A alteração só será gravada quando você salvar o rascunho.</p><div class="actions">'+btn('Cancelar','close')+btn('Substituir pelo texto padrão','standard-text-confirm')+'</div>');return;
   }
   const textarea=document.querySelector('#atas-editor [name=texto]');if(!textarea)return;
   textarea.value=result.text;sync();if(action==='standard-text-confirm')close();textarea.focus();notify('Texto padrão inserido. Edite os marcadores e salve o rascunho.');return;
  }
  if(action==='clear-filters'){state.filter='';state.status=[];state.ataTypes=[];state.ataCourses=[];state.ataYears=[];renderView();return;}
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
  if(action==='finalize'&&state.current.modalidade_assinatura==='codigo_email'){try{await signatureForm();}catch(error){fail(error);}return;}
  if(action.startsWith('sign-')){
   if(working)return;working=true;el.disabled=true;
   try{
    const actionName=action.slice(5),id=state.current.id;
    if(actionName==='corrigir_email'){
     const signerId=el.dataset.signer,d=dialog('<h2>Corrigir e-mail do signatário</h2><p>O link e os códigos anteriores serão revogados. O novo convite será enviado ao endereço informado. A alteração ficará registrada na auditoria; o cadastro de Pessoas não será alterado.</p><form id="signature-email-fix"><label class="field">Novo e-mail<input type="email" name="email" required maxlength="254"></label><p role="alert" class="form-message error"></p><button type="submit" class="button primary">Corrigir e enviar novo convite</button>'+btn('Cancelar','close')+'</form>');
     d.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();event.stopImmediatePropagation();if(working)return;working=true;const b=event.target.querySelector('[type=submit]');b.disabled=true;try{await signature({acao:'corrigir_email',ata_id:id,signatario_id:signerId,email:new FormData(event.target).get('email')});close();await loadSignatures(state.current);notify('E-mail corrigido e novo convite solicitado.');}catch(error){d.querySelector('[role=alert]').textContent=error.message;}finally{working=false;if(b.isConnected)b.disabled=false;}});return;
    }
    if(actionName==='refresh'){await loadSignatures(state.current);return;}
    if(actionName==='pdf'){const bytes=await signature({acao:'documento_admin',ata_id:id});const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type:'application/pdf'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Ata-'+ataNumber(state.current).replace('/','-')+'-assinatura.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return;}
    if(['reenviar','renovar','reprocessar','reenviar_final'].includes(actionName)&&!confirm(actionName==='renovar'?'Revogar o link anterior e enviar um novo convite?':'Confirmar envio para este signatário? Em caso de envio anterior incerto, confira a caixa de enviados institucional antes de repetir.'))return;
    const r=await signature({acao:actionName,ata_id:id,signatario_id:el.dataset.signer});
    if(actionName==='copiar'){try{await navigator.clipboard.writeText(r.link);notify('Link individual copiado.');}catch{dialog('<h2>Link individual de assinatura</h2><p>O destinatário precisará do código enviado ao seu e-mail.</p><label class="field">Copie o link<input readonly value="'+esc(r.link)+'"></label>'+btn('Fechar','close'));}}else{notify('Solicitação processada. Confira o resultado por signatário.');await loadSignatures(state.current);}
   }catch(error){fail(error);}finally{working=false;if(el.isConnected)el.disabled=false;}return;
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
    const bytes=action==='pdf'?(state.current.modalidade_assinatura==='codigo_email'&&state.current.status==='finalizada'?await signature({acao:'documento_admin',ata_id:state.current.id}):await(await import('./ata-pdf.js?v=20261027-atas-4')).generateAtaPdf(state.current)):await archive({ata_id:state.current.id,assinado:action==='signed-view'});
    const blob=bytes instanceof Blob?bytes:new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob);urls.add(url);
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
