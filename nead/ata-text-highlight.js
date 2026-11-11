import {alignmentStandardText} from './ata-standard-text.js?v=20261030-padrao-1';
import {escapeHtml} from './model.js?v=20261027-atas-4';
const markers=new Set(alignmentStandardText.match(/\[[^\]\r\n]+\]/g)||[]);
// Só os marcadores do modelo recebem destaque. O conteúdo continua texto simples.
export function standardMarkerHtml(value){
 return String(value??'').split(/(\[[^\]\r\n]+\])/g).map(part=>markers.has(part)?'<span class="ata-placeholder">'+escapeHtml(part)+'</span>':escapeHtml(part)).join('');
}
export function installStandardMarkerHighlight(textarea){
 if(!textarea||textarea.readOnly)return null;
 const doc=textarea.ownerDocument,wrapper=doc.createElement('div'),layer=doc.createElement('div'),hint=doc.createElement('p');
 wrapper.className='ata-marker-editor';layer.className='ata-marker-layer';layer.setAttribute('aria-hidden','true');
 hint.id=textarea.id+'-marker-help';hint.className='section-note';hint.textContent='Substitua os trechos vermelhos entre colchetes pelas informações da reunião. O texto digitado ficará na cor normal.';
 const described=textarea.getAttribute('aria-describedby');
 textarea.before(wrapper);wrapper.append(layer,textarea);wrapper.after(hint);textarea.classList.add('ata-marked-input');
 textarea.setAttribute('aria-describedby',[described,hint.id].filter(Boolean).join(' '));
 const position=()=>{layer.style.width=textarea.clientWidth+'px';layer.style.height=textarea.clientHeight+'px';layer.scrollTop=textarea.scrollTop;layer.scrollLeft=textarea.scrollLeft;};
 const refresh=()=>{const text=textarea.value;layer.innerHTML=standardMarkerHtml(text)+(text.endsWith('\n')?'\n':'');position();};
 textarea.addEventListener('input',refresh);textarea.addEventListener('scroll',position);
 const view=doc.defaultView,observer=view.ResizeObserver?new view.ResizeObserver(position):null;
 observer?.observe(textarea);view.addEventListener('resize',position);refresh();
 return {refresh,destroy(){observer?.disconnect();view.removeEventListener('resize',position);textarea.removeEventListener('input',refresh);textarea.removeEventListener('scroll',position);textarea.classList.remove('ata-marked-input');if(described===null)textarea.removeAttribute('aria-describedby');else textarea.setAttribute('aria-describedby',described);hint.remove();wrapper.replaceWith(textarea);}};
}
