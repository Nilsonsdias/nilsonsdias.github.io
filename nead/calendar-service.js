export function calendarService(rpc,client){return {
 list:(start,end)=>rpc('nead_calendario',{p_acao:'consultar',p_dados:{inicio:start,fim:end}}),
 admin:(action,data={})=>rpc('nead_calendario',{p_acao:action,p_dados:data}),
 async google(action,range={}){const {data,error}=await client.functions.invoke('nead-calendario-google',{body:{acao:action,...range}});if(error)throw Error('Não foi possível consultar a conexão Google. Tente novamente ou reconecte.');return data;}
};}
