// Identificador textual. Somente a serialização antiga de primeiro dia, à meia-noite, recebe apresentação ano.mês.
export function displayTurma(value){
 const text=String(value??'');
 const match=text.match(/^(\d{4})-(0[1-9]|1[0-2])-01T00:00:00(?:\.000)?Z?$/);
 return match?match[1]+'.'+Number(match[2]):text;
}
// Salvar outro campo não regrava implicitamente a turma legada.
export function turmaForSave(original,edited){
 const text=String(edited??'');return text===displayTurma(original)?String(original??''):text;
}
