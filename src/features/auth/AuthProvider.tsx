import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "@/api/auth";
import { ApiError, setUnauthorizedHandler } from "@/api/client";
import { partnersApi, type Panel } from "@/api/partners";
import { clearSession, getToken, setToken } from "@/lib/session";

type AuthState =
  | { status: "loading" }
  | { status: "anon"; notice?: string }
  | { status: "error"; message: string }
  | { status: "authed"; panel: Panel };

interface AuthContextValue {
  state: AuthState;
  completeLogin: (token: string) => Promise<void>;
  signOut: () => void;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>(() =>
    getToken() ? { status: "loading" } : { status: "anon" }
  );

  const clearLocal = useCallback(
    (notice?: string) => {
      clearSession();
      queryClient.clear();
      setState({ status: "anon", notice });
    },
    [queryClient]
  );

  /** Encerra a sessão no servidor (só esta: o painel e o app seguem). Sem rede, sai do navegador do mesmo jeito. */
  const signOut = useCallback(() => {
    const token = getToken();
    if (token) void authApi.logout(token).catch(() => undefined);
    clearLocal();
  }, [clearLocal]);

  /**
   * Quem está no painel. 403 = a conta perdeu o acesso (saiu do parceiro, parceiro suspenso, saiu da equipe AG3): a
   * sessão local acaba e a tela de login mostra o motivo.
   */
  const fetchPanel = useCallback(async (): Promise<Panel | null> => {
    try {
      return await partnersApi.me();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        clearLocal(error.detail);
        return null;
      }
      throw error;
    }
  }, [clearLocal]);

  const load = useCallback(async () => {
    if (!getToken()) {
      setState({ status: "anon" });
      return;
    }
    setState((current) => (current.status === "authed" ? current : { status: "loading" }));
    try {
      const panel = await fetchPanel();
      if (panel) setState({ status: "authed", panel });
    } catch (error) {
      // 401 já encerrou a sessão pelo handler. Sem rede, o token continua válido: oferece tentar de novo.
      if (error instanceof ApiError && error.status === 401) return;
      const message = error instanceof ApiError ? error.detail : "Não foi possível carregar.";
      setState((current) => (current.status === "authed" ? current : { status: "error", message }));
    }
  }, [fetchPanel]);

  useEffect(() => {
    setUnauthorizedHandler(() => clearLocal("Sua sessão terminou. Entre de novo."));
    void load();
    return () => setUnauthorizedHandler(null);
  }, [load, clearLocal]);

  const completeLogin = useCallback(
    async (token: string) => {
      setToken(token);
      try {
        setState({ status: "authed", panel: await partnersApi.me() });
      } catch (error) {
        // O erro sobe para a tela de login mostrar (ex.: 403, a conta não tem acesso ao painel).
        clearLocal();
        throw error;
      }
    },
    [clearLocal]
  );

  const value = useMemo<AuthContextValue>(
    () => ({ state, completeLogin, signOut, retry: load }),
    [state, completeLogin, signOut, load]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return context;
}

/** Para telas atrás de `RequireAuth`, onde o acesso ao painel já está garantido. */
export function usePanel(): Panel {
  const { state } = useAuth();
  if (state.status !== "authed") throw new Error("usePanel exige sessão no painel");
  return state.panel;
}
