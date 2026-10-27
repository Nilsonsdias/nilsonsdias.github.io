export function selectionValues(value){
 const values=Array.isArray(value)?value:value==null||value===''?[]:[value];
 return [...new Set(values.filter(v=>v!=null&&v!=='').map(String))];
}
