import {config} from './config.js';
import {escapeHtml as esc} from './model.js?v=20261027-atas-4';
const root=document.querySelector('#assinatura-etapas'),message=document.querySelector('#assinatura-mensagem');
const token=location.hash.slice(1);history.replaceState(null,'',location.pathname);let desafio='',sessao='',dados=null,blobUrl='',busy=false;
const consentimento='Li a ata e concordo em assiná-la eletronicamente mediante confirmação do meu e-mail.';
const say=(s,error=false)=>{message.textContent=s;message.className=error?'form-message error':'section-note';};
async function call(acao,extra={},pdf=false){
 const r=await fetch(config.url+'/functions/v1/nead-assinaturas',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({acao,token,sessao,...extra}),cache:'no-store',referrerPolicy:'no-referrer'});
 if(!r.ok){let e;try{e=await r.json();}catch{}throw Error(e?.error||'Operação não confirmada. Tente novamente.');}
 return pdf?r.blob():r.json();
}
const button=(text,action)=>'<button type="button" class="button primary" data-sign="'+action+'">'+text+'</button>';
function start(){root.innerHTML='<h2>Confirmar e-mail</h2><p>O código será enviado ao e-mail registrado para este convite. O acesso ao link, sozinho, não assina a ata.</p>'+button('Solicitar código por e-mail','codigo');}
async function documentView(){
 dados=await call('consultar');root.innerHTML='<h2>'+esc(dados.titulo||'Ata institucional')+'</h2><p>Signatário: <strong>'+esc(dados.nome)+'</strong></p><p class="revision">SHA-256 do documento original: '+esc(dados.hash)+'</p><div id="signature-pdf" class="ata-pdf-pages"></div><a class="button secondary" id="signature-download">Baixar PDF para leitura</a>'+(dados.assinado?'<div class="notice">Sua assinatura já foi registrada. A cópia final será enviada por e-mail quando todos concluírem a assinatura.</div>':'<p><label><input id="signature-consent" type="checkbox"> '+esc(consentimento)+'</label></p>'+button('Confirmar minha assinatura','assinar'));
 const blob=await call('documento',{},true);if(blobUrl)URL.revokeObjectURL(blobUrl);blobUrl=URL.createObjectURL(blob);const link=document.querySelector('#signature-download');link.href=blobUrl;link.download='Ata-NEAD.pdf';
 const {mountPdfViewer}=await import('./pdf-viewer.js?v=20261027-atas-5');await mountPdfViewer(document.querySelector('#signature-pdf'),blob);
}
root.addEventListener('click',async event=>{
 const el=event.target.closest('[data-sign]');if(!el||busy)return;const acao=el.dataset.sign;busy=true;el.disabled=true;say('Processando…');
 try{
 if(acao==='codigo'){const r=await call('codigo');desafio=r.desafio;root.innerHTML='<h2>Digite o código</h2><label class="field">Código recebido por e-mail<input id="signature-code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="8" pattern="[0-9]{8}" aria-label="Código de confirmação"></label><div class="actions wrap">'+button('Confirmar código','validar')+button('Solicitar novo código','codigo')+'</div>';say('Código solicitado. Confira sua caixa de entrada e o spam. Aguarde ao menos um minuto para solicitar outro.');}
 else if(acao==='validar'){const codigo=document.querySelector('#signature-code').value.trim();if(!/^[0-9]{8}$/.test(codigo))throw Error('Informe os oito dígitos recebidos.');const r=await call('validar',{desafio,codigo});sessao=r.sessao;await documentView();say('E-mail confirmado. Leia o documento antes de assinar.');}
 else if(acao==='assinar'){if(!document.querySelector('#signature-consent').checked)throw Error('Leia a ata e marque sua concordância antes de confirmar.');await call('assinar',{hash:dados.hash,consentimento});await documentView();say('Assinatura registrada. Você receberá o PDF final por e-mail após a conclusão de todos.');}
 }catch(error){say(error.message,true);}finally{busy=false;if(el.isConnected)el.disabled=false;}
});
if(/^[a-f0-9.-]{100,130}$/.test(token))start();else{root.innerHTML='<h2>Link indisponível</h2><p>Abra o link completo recebido por e-mail ou solicite um novo convite ao NEAD.</p>';}
window.addEventListener('pagehide',()=>{if(blobUrl)URL.revokeObjectURL(blobUrl);});

window.addEventListener('hashchange',()=>{if(location.hash)location.reload();});
