export function historicalReservationText(carga){
 return (carga?.reservas||[]).map(r=>{
  const faixas=r.faixas?.length?r.faixas:[{inicio:r.inicio,fim:r.fim}];
  const intervalos=faixas.map(f=>f.inicio+' a '+f.fim).join(' e ');
  return r.ano+': números '+intervalos+' reservados para atas históricas; novas atas a partir de '+(r.novas_a_partir??Number(r.fim)+1)+'.';
 }).join(' ');
}
