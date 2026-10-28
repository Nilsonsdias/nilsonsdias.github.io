import * as pdfjs from './vendor/pdfjs/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.min.mjs',import.meta.url).href;
export async function mountPdfViewer(host,blob){
 let closed=false,renderTask=null,pageNumber=1,busy=false,pdf=null;
 const loading=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),
  standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href,
  cMapUrl:new URL('./vendor/pdfjs/cmaps/',import.meta.url).href,cMapPacked:true,
  wasmUrl:new URL('./vendor/pdfjs/wasm/',import.meta.url).href,isEvalSupported:false,enableXfa:false});
 host.innerHTML='<div class="ata-pdf-controls"><button type="button" class="button secondary" data-pdf-prev disabled>Anterior</button><span role="status">Carregando PDF…</span><button type="button" class="button secondary" data-pdf-next disabled>Próxima</button></div><div class="ata-pdf-canvas"><canvas role="img" aria-label="Página do PDF"></canvas></div>';
 const label=host.querySelector('[role=status]'),canvas=host.querySelector('canvas'),previous=host.querySelector('[data-pdf-prev]'),next=host.querySelector('[data-pdf-next]');
 const dispose=()=>{closed=true;renderTask?.cancel();loading.destroy().catch(()=>{});};
 async function paint(){
  if(closed||busy)return;busy=true;previous.disabled=next.disabled=true;
  try{
   const page=await pdf.getPage(pageNumber);if(closed)return;
   const base=page.getViewport({scale:1}),available=Math.min(1100,Math.max(280,host.clientWidth-28)),scale=available/base.width;
   const viewport=page.getViewport({scale}),ratio=Math.min(window.devicePixelRatio||1,2);
   canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);
   canvas.style.width=Math.floor(viewport.width)+'px';canvas.style.height=Math.floor(viewport.height)+'px';
   renderTask=page.render({canvas,canvasContext:canvas.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
   await renderTask.promise;if(closed)return;
   canvas.setAttribute('aria-label','Página '+pageNumber+' de '+pdf.numPages+' do PDF');
   label.textContent='Página '+pageNumber+' de '+pdf.numPages;
  }catch(error){if(!closed){label.textContent='Não foi possível renderizar esta página. Use Baixar PDF para consultar o original.';throw error;}}
  finally{busy=false;if(!closed){previous.disabled=pageNumber<=1;next.disabled=pageNumber>=pdf.numPages;}}
 }
 previous.addEventListener('click',()=>{if(!busy&&pageNumber>1){pageNumber--;paint().catch(()=>{});}});
 next.addEventListener('click',()=>{if(!busy&&pageNumber<pdf.numPages){pageNumber++;paint().catch(()=>{});}});
 host.closest('dialog')?.addEventListener('close',dispose,{once:true});
 try{pdf=await loading.promise;if(!closed)await paint();}
 catch(error){dispose();throw error;}
 return dispose;
}
