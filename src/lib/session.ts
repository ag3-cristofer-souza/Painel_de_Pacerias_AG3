/**
 * Sessão do Painel de Parcerias no navegador. É uma sessão própria (`ag3s_…`, sistema `parceiros`): não abre o painel
 * nem o app, e sair encerra só ela. O acesso ao storage pode falhar (modo privado), então nada aqui lança erro.
 */
const TOKEN_KEY = "ag3.parcerias.token";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sem storage, a sessão dura só enquanto a aba estiver aberta.
  }
}

export const getToken = () => read(TOKEN_KEY);
export const setToken = (token: string) => write(TOKEN_KEY, token);
export const clearSession = () => write(TOKEN_KEY, null);
