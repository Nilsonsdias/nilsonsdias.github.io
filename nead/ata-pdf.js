import {PDFDocument,StandardFonts,rgb} from './vendor/pdf-lib.js';
import {ataPdfTitle,ataParticipants,ataFields} from './atas-model.js';
export async function generateAtaPdf(ata){
 if(ata.tipo==='historica')throw Error('Use o PDF original para atas históricas.');
 const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 pdf.setTitle(ataPdfTitle(ata));pdf.setAuthor('NEAD - Centro Universitário Univel');pdf.setSubject('Registro institucional de reunião');
 const width=595.28,height=841.89,left=54,right=541,bodyWidth=right-left,leading=14;
 let page,y,lineNumber=1,blockTop=null,blockBottom=null;
 const safe=s=>String(s??'').normalize('NFC').replace(/[\u2010-\u2015]/g,'-').replace(/\t/g,' ');
 const draw=(text,x,yy,font=regular,size=10)=>{try{page.drawText(safe(text),{x,y:yy,font,size,color:rgb(0,0,0)});}catch{throw Error('O texto contém caracteres não suportados pelo PDF. Revise símbolos ou emojis.');}};
 const finishBlock=()=>{if(blockTop!==null){page.drawRectangle({x:49,y:blockBottom-5,width:497,height:blockTop-blockBottom+16,borderColor:rgb(.25,.25,.25),borderWidth:.5});blockTop=null;}};
 const newPage=()=>{finishBlock();page=pdf.addPage([width,height]);page.drawRectangle({x:24,y:24,width:width-48,height:height-48,borderWidth:.6,borderColor:rgb(.2,.2,.2)});y=height-65;};
 const ensure=(need=leading)=>{if(y-need<60)newPage();};
 const wrap=(text,font=regular,size=10,max=bodyWidth)=>{
  const lines=[];let line='';
  for(const word of safe(text).split(/\s+/).filter(Boolean)){
   if(font.widthOfTextAtSize(word,size)>max){
    if(line){lines.push(line);line='';}
    let chunk='';for(const ch of word){if(font.widthOfTextAtSize(chunk+ch,size)>max){lines.push(chunk);chunk='';}chunk+=ch;}line=chunk;continue;
   }
   if(line&&font.widthOfTextAtSize(line+' '+word,size)>max){lines.push(line);line=word;}else line+=(line?' ':'')+word;
  }if(line)lines.push(line);return lines;
 };
 newPage();
 const heading=wrap(ataPdfTitle(ata),bold,10);
 for(const text of heading){ensure();draw(String(lineNumber++),30,y,regular,8);draw(text,(width-bold.widthOfTextAtSize(text,10))/2,y,bold);y-=leading;}
 y-=10;
 const paragraphs=String(ata.texto||'').split(/\r?\n/).filter(s=>s.trim());
 for(const paragraph of paragraphs){
  const lines=wrap(paragraph);
  for(let i=0;i<lines.length;i++){
   ensure();if(blockTop===null)blockTop=y;
   draw(String(lineNumber++),30,y,regular,8);
   const words=lines[i].split(' ');
   if(i<lines.length-1&&words.length>1){
    const gap=(bodyWidth-words.reduce((n,w)=>n+regular.widthOfTextAtSize(w,10),0))/(words.length-1);
    let x=left;for(const word of words){draw(word,x,y);x+=regular.widthOfTextAtSize(word,10)+gap;}
   }else draw(lines[i],left,y);
   blockBottom=y;y-=leading;
  }
  y-=5;
 }
 finishBlock();y-=38;
 const people=ataParticipants(ata);
 for(let i=0;i<people.length;i+=2){
  const row=people.slice(i,i+2),wrapped=row.map(p=>wrap(p.nome,regular,10,205));
  const rowHeight=30+Math.max(...wrapped.map(x=>x.length))*12;
  ensure(rowHeight+10);
  row.forEach((p,j)=>{
   const x=j===0?65:325;
   page.drawLine({start:{x,y},end:{x:x+205,y},thickness:.6,color:rgb(0,0,0)});
   wrapped[j].forEach((s,k)=>draw(s,x+(205-regular.widthOfTextAtSize(s,10))/2,y-16-k*12));
   draw(p.papel,x+(205-regular.widthOfTextAtSize(p.papel,9))/2,y-rowHeight+8,regular,9);
  });y-=rowHeight+30;
 }
 const fields=ataFields(ata);
 if(fields.foto){
  const image=await pdf.embedJpg(fields.foto),scale=Math.min(300/image.width,230/image.height),w=image.width*scale,h=image.height*scale;
  const caption=wrap(fields.legenda,regular,9,400),need=h+caption.length*12+25;ensure(need);
  page.drawImage(image,{x:(width-w)/2,y:y-h,width:w,height:h});y-=h+16;
  if(caption.length)page.drawRectangle({x:90,y:y-caption.length*12+4,width:415,height:caption.length*12+10,borderColor:rgb(.35,.35,.35),borderWidth:.5});
  for(const text of caption){draw(text,(width-regular.widthOfTextAtSize(text,9))/2,y,regular,9);y-=12;}
 }
 const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText((i+1)+' / '+pages.length,{x:width-70,y:35,size:8,font:regular,color:rgb(.35,.35,.35)}));
 return pdf.save();
}
