import {escapeHtml as esc} from './model.js?v=20261027-atas-4';

export const dashboardReportUrl='https://datastudio.google.com/embed/reporting/ba4bc55b-c617-4d2a-b6a3-35fce7d471bc/page/p_7tu4eaflud';
export const dashboardSandbox='allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox';

export function dashboardNavigation(active=false){
 return '<button type="button" class="nav-item dashboard-nav'+(active?' active':'')+'" data-action="nav" data-view="dashboards"'+(active?' aria-current="page"':'')+'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 3v17h17M8 16v-5m5 5V7m5 9v-8"/></svg><span>Dashboards</span></button>';
}

export function dashboardMarkup({user,profile}){
 if(!user?.id||!profile?.autorizado)throw Error('Entre com uma conta autorizada para acessar os dashboards.');
 return '<section class="dashboard-view">'+
  '<div class="page-heading"><div><span class="eyebrow">GESTÃO NEAD · UNIVEL</span><h1>Dashboards</h1><p>Indicadores e relatórios da Gestão Integrada EAD.</p></div><div class="actions wrap">'+
  '<button type="button" class="button secondary" data-dashboard-expand aria-pressed="false" aria-controls="dashboard-report">Expandir relatório</button>'+
  '<a class="button secondary" href="'+dashboardReportUrl+'" target="_blank" rel="noopener noreferrer">Abrir no Data Studio ↗</a></div></div>'+
  '<p class="section-note dashboard-access">Use a conta Google <strong>'+esc(profile.email||user.email||'autorizada')+'</strong> para visualizar suas liberações no relatório. Se o Google solicitar acesso ou seleção de conta, abra o relatório no Data Studio.</p>'+
  '<section class="panel dashboard-report" id="dashboard-report" aria-label="Painel de Gestão Integrada EAD — Mediação Pedagógica">'+
  '<div class="dashboard-report-heading"><span>Painel de Gestão Integrada EAD — Mediação Pedagógica</span><span>Data Studio</span></div>'+
  '<iframe class="dashboard-frame" title="Dashboard — Painel de Gestão Integrada EAD — Mediação Pedagógica" src="'+dashboardReportUrl+'" width="600" height="450" frameborder="0" style="border:0" allowfullscreen sandbox="'+dashboardSandbox+'" referrerpolicy="strict-origin-when-cross-origin"></iframe></section></section>';
}

export function renderDashboards(main,identity){
 main.innerHTML=dashboardMarkup(identity);
 const shell=main.closest('.shell'),button=main.querySelector('[data-dashboard-expand]');
 const expand=value=>{
  shell?.classList.toggle('dashboard-expanded',value);
  button.setAttribute('aria-pressed',String(value));
  button.textContent=value?'Voltar à visualização integrada':'Expandir relatório';
 };
 button.addEventListener('click',()=>expand(button.getAttribute('aria-pressed')!=='true'));
 main.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-pressed')==='true'){expand(false);button.focus();}});
}
