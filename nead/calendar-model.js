export const ZONE='America/Sao_Paulo';
export const MODES={month:'Mês',week:'Semana',day:'Dia'};
export const iso=d=>d.toISOString().slice(0,10);
export const date=s=>new Date(s+'T12:00:00Z');
export function today(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function addDays(s,n){const d=date(s);d.setUTCDate(d.getUTCDate()+n);return iso(d);}
export function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(date(s).valueOf())&&iso(date(s))===s;}
export function moveDate(s,mode,step){if(mode!=='month')return addDays(s,step*(mode==='week'?7:1));const d=date(s);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+step);return iso(d);}
export function period(s,mode){let start=s,end;if(mode==='month'){start=s.slice(0,7)+'-01';start=addDays(start,-date(start).getUTCDay());end=addDays(start,42);}else{if(mode==='week')start=addDays(s,-date(s).getUTCDay());end=addDays(start,mode==='week'?7:1);}return {start,end};}
export function titleFor(s,mode){const fmt=opts=>new Intl.DateTimeFormat('pt-BR',{...opts,timeZone:'UTC'}).format(date(s));if(mode==='month')return fmt({month:'long',year:'numeric'});if(mode==='day')return fmt({day:'numeric',month:'long',year:'numeric'});const p=period(s,mode);return `${formatDay(p.start)} – ${formatDay(addDays(p.end,-1))}`;}
export const formatDay=s=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(date(s));
export const colorValid=s=>/^#[0-9a-f]{6}$/i.test(s||'');
export const UNGROUPED_COLOR='#64748b';
export function validateActivity(a){
 const errors=[],title=String(a.titulo||'').trim();
 if(!title)errors.push('Título obrigatório.');else if(title.length>200)errors.push('Título deve ter até 200 caracteres.');
 if(String(a.descricao||'').length>10000)errors.push('Descrição deve ter até 10000 caracteres.');
 for(const field of ['data_inicio','data_fim'])if(a[field]&&(!validDate(a[field])||a[field]<'1900-01-01'||a[field]>'2199-12-31'))errors.push('Datas devem ser válidas, entre 1900 e 2199.');
 if(a.data_inicio&&a.data_fim&&a.data_fim<a.data_inicio)errors.push('Término anterior ao início.');
 const times=[a.hora_inicio,a.hora_fim].map(x=>x||'');
 if(times.some(t=>t&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))errors.push('Horários devem usar HH:MM.');
 if(a.data_inicio&&a.data_inicio===a.data_fim&&times.every(Boolean)&&times[1]<=times[0])errors.push('Horário final deve ser posterior ao inicial.');
 if(a.cor&&!colorValid(a.cor))errors.push('Cor deve ser hexadecimal (#RRGGBB).');
 if(a.recorrencia&&!['diaria','semanal','mensal'].includes(a.recorrencia))errors.push('Recorrência inválida.');
 if(a.recorrencia&&(!validDate(a.data_inicio)||!validDate(a.data_fim)||!validDate(a.recorrer_ate)||a.recorrer_ate<a.data_inicio||a.recorrer_ate>addDays(a.data_inicio,730)))errors.push('Recorrência exige início, término e repetição até uma data em até dois anos.');
 return errors;
}
export function activityPending(a){const pending=[];if(!a.grupo_id)pending.push('Sem grupo');if(!a.data_inicio||!a.data_fim)pending.push('Datas incompletas · fora do calendário');if(Boolean(a.hora_inicio)!==Boolean(a.hora_fim))pending.push('Horários incompletos · exibida como dia inteiro quando houver datas');return pending;}
export function internalEvents(rows,groups,range){const out=[],colors=new Map(groups.map(g=>[g.id,g.cor]));for(const a of rows){if(!validDate(a.data_inicio)||!validDate(a.data_fim)||a.data_fim<a.data_inicio)continue;const timed=Boolean(a.hora_inicio&&a.hora_fim);const duration=Math.round((date(a.data_fim)-date(a.data_inicio))/86400000);for(let i=0;i<733;i++){let d=a.data_inicio;if(i){if(!a.recorrencia)break;if(a.recorrencia==='mensal'){const base=date(a.data_inicio);base.setUTCDate(1);base.setUTCMonth(base.getUTCMonth()+i);const month=base.getUTCMonth();base.setUTCDate(date(a.data_inicio).getUTCDate());if(base.getUTCMonth()!==month)continue;d=iso(base);}else d=addDays(a.data_inicio,i*(a.recorrencia==='semanal'?7:1));if(d>a.recorrer_ate)break;}if(d>=range.end)break;const finish=addDays(d,duration),start=d+(timed?'T'+a.hora_inicio.slice(0,5):''),end=timed?finish+'T'+a.hora_fim.slice(0,5):addDays(finish,1);if(end>range.start)out.push({id:a.id+':'+d,recordId:a.id,title:a.titulo,description:a.descricao||'',start,end,allDay:!timed,color:a.cor||colors.get(a.grupo_id)||UNGROUPED_COLOR,source:'NEAD',group:groups.find(g=>g.id===a.grupo_id)?.nome||'Sem grupo',record:a});}}return out;}
export function lastDay(e){return e.allDay||e.end.endsWith('T00:00')?addDays(e.end.slice(0,10),-1):e.end.slice(0,10);}
export function onDay(e,d){return e.start.slice(0,10)<=d&&lastDay(e)>=d;}
export function weekBars(events,start,days=7){const end=addDays(start,days),lanes=[],bars=[];for(const e of [...events].sort((a,b)=>a.start.localeCompare(b.start)||b.end.localeCompare(a.end))){const first=e.start.slice(0,10)>start?e.start.slice(0,10):start,last=lastDay(e)<addDays(end,-1)?lastDay(e):addDays(end,-1);if(first>last)continue;const col=Math.round((date(first)-date(start))/86400000),span=Math.round((date(last)-date(first))/86400000)+1;let lane=lanes.findIndex(row=>row.every(b=>col>=b.col+b.span||col+span<=b.col));if(lane<0){lane=lanes.length;lanes.push([]);}const bar={event:e,col,span,lane};lanes[lane].push(bar);bars.push(bar);}return bars;}
export function timedLayout(events,day){const minutes=s=>Number(s.slice(11,13))*60+Number(s.slice(14,16));const items=events.filter(e=>!e.allDay&&onDay(e,day)).map(e=>({event:e,from:e.start.slice(0,10)<day?0:minutes(e.start),to:e.end.slice(0,10)>day?1440:minutes(e.end)})).sort((a,b)=>a.from-b.from||b.to-a.to);let cluster=[],edge=-1;const finish=()=>{const lanes=[];for(const e of cluster){let col=lanes.findIndex(end=>end<=e.from);if(col<0)col=lanes.length;lanes[col]=e.to;e.col=col;}for(const e of cluster)e.columns=lanes.length;};for(const e of items){if(e.from>=edge){finish();cluster=[];edge=-1;}cluster.push(e);edge=Math.max(edge,e.to);}finish();return items;}
const key=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
export function excelDate(v){const s=String(v??'').trim();if(validDate(s))return s;const br=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(br)return `${br[3]}-${br[2]}-${br[1]}`;if(/^\d+(\.\d+)?$/.test(s)&&Number(s)>=61&&Number(s)<=2958465)return iso(new Date(Date.UTC(1899,11,30)+Math.floor(Number(s))*86400000));return s;}
export function excelTime(v){const s=String(v??'').trim();if(!s)return '';if(/^\d*\.?\d+$/.test(s)&&Number(s)>=0&&Number(s)<1){const m=Math.round(Number(s)*1440);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}return s;}
export function importPreview(rows,groups,existing=[]){
 if(!rows.length)throw Error('Arquivo vazio.');
 const aliases={titulo_da_atividade:'titulo',titulo:'titulo',nome_da_atividade:'titulo',nome:'titulo',descricao:'descricao',grupo:'grupo',data_de_inicio:'data_inicio',data_inicio:'data_inicio',data_de_termino:'data_fim',data_termino:'data_fim',data_fim:'data_fim',horario_inicial:'hora_inicio',horario_final:'hora_fim',cor_personalizada:'cor'};
 const headers=rows[0].map(h=>aliases[key(h)]||key(h));
 if(!headers.includes('titulo'))throw Error('Coluna obrigatória ausente: titulo');
 const named=headers.filter(Boolean);if(new Set(named).size!==named.length)throw Error('Cabeçalhos duplicados.');
 const fingerprint=a=>[key(a.titulo),a.grupo_id||'',a.data_inicio||'',a.data_fim||'',a.hora_inicio?.slice(0,5)||'',a.hora_fim?.slice(0,5)||''].join('|');
 const seen=new Set(existing.map(fingerprint)),preview=[];let ignored=0;
 for(let i=1;i<rows.length;i++){
  const a=Object.fromEntries(headers.flatMap((h,j)=>h?[[h,String(rows[i][j]??'').trim()]]:[]));
  if(!a.titulo){ignored++;continue;}
  a.grupo_id=groups.find(g=>key(g.nome)===key(a.grupo)&&key(a.grupo))?.id||'';
  a.data_inicio=excelDate(a.data_inicio);a.data_fim=excelDate(a.data_fim);a.hora_inicio=excelTime(a.hora_inicio);a.hora_fim=excelTime(a.hora_fim);
  const errors=validateActivity(a),warnings=activityPending(a);
  if(a.grupo&&!a.grupo_id)warnings.push('Grupo “'+a.grupo+'” não encontrado; será importada sem grupo.');
  const duplicate=fingerprint(a);if(seen.has(duplicate))errors.push('Possível duplicidade: revise antes de importar.');seen.add(duplicate);
  preview.push({line:i+1,activity:a,errors,warnings});
 }
 if(preview.length>500)throw Error('Use até 500 atividades com título por lote.');
 preview.ignored=ignored;return preview;
}
