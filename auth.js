// Autenticação confirma a identidade; nead_meu_acesso decide a autorização.
export async function prepareGoogleLogin(client, config, origin, request = fetch) {
  let response;
  try { response = await request(`${config.url}/auth/v1/settings`, {
    headers: { apikey: config.publishableKey }, signal: AbortSignal.timeout(15000)
  }); } catch { throw new Error('Não foi possível consultar o login Google. Verifique sua conexão e tente novamente.'); }
  if (!response.ok) throw new Error('Não foi possível consultar o login Google. Tente novamente.');
  const settings = await response.json();
  if (settings.external?.google !== true) {
    throw new Error('O login Google ainda está sendo configurado. Use e-mail e senha enquanto a equipe conclui a ativação.');
  }
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL('/', origin).href,
      scopes: 'openid email profile',
      queryParams: { prompt: 'select_account' },
      skipBrowserRedirect: true
    }
  });
  if (error) throw new Error('Não foi possível iniciar o login Google. Tente novamente.');
  const target = new URL(data?.url || '', config.url);
  if (!data?.url || target.origin !== new URL(config.url).origin || target.pathname !== '/auth/v1/authorize') {
    throw new Error('Não foi possível iniciar o login Google. Tente novamente.');
  }
  return target.href;
}

export function oauthCallbackError(href) {
  const url = new URL(href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const error = url.searchParams.get('error') || hash.get('error');
  if (!error && !url.searchParams.has('error_code') && !hash.has('error_code')) return null;
  return error === 'access_denied'
    ? 'O acesso pelo Google foi cancelado ou recusado. Você pode tentar novamente e escolher sua conta autorizada.'
    : 'Não foi possível concluir o login Google. Tente novamente ou use e-mail e senha.';
}

export function clearOAuthErrorUrl(href) {
  const url = new URL(href);
  for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has('error') || hash.has('error_code')) url.hash = '';
  return url.href;
}
