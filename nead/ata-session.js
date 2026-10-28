export async function guardAtaSession(state,operation){
 const operator=state.user?.id;
 if(!operator)throw Error('Entre novamente para acessar as atas.');
 const result=await operation();
 if(state.user?.id!==operator)throw Error('Sua sessão mudou durante a operação. Entre novamente antes de continuar.');
 return result;
}
