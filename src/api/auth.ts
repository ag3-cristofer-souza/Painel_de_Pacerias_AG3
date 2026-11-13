import { z } from "zod";
import { api } from "./client";

const tokenSchema = z.object({ access_token: z.string().min(1) });

const challengeSchema = z.object({
  mfa_required: z.literal(true),
  challenge_id: z.string(),
  email_hint: z.string(),
  code_expires_in: z.number(),
  resend_in: z.number(),
});

export type MfaChallenge = z.infer<typeof challengeSchema>;

const loginSchema = z.union([challengeSchema, tokenSchema]);
export type LoginResult = z.infer<typeof loginSchema>;

export const isMfaChallenge = (result: LoginResult): result is MfaChallenge =>
  "mfa_required" in result;

export function describeDevice(userAgent = navigator.userAgent): string {
  if (/iphone|ipad/i.test(userAgent)) return "iPhone/iPad, navegador";
  if (/android/i.test(userAgent)) return "Android, navegador";
  return "Computador, navegador";
}

/** Sessão própria do Painel de Parcerias: sempre com o código por e-mail (D9) e separada do painel e do app. */
const client = () => ({ system: "parceiros", device_name: describeDevice() });

const success = z.object({ success: z.boolean() });

export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", loginSchema, { email, password, client: client() }),

  /** 400 = código errado; 410 = desafio encerrado, volta para a senha; 403 = conta sem acesso ao painel. */
  confirmMfa: (challengeId: string, code: string) =>
    api.post("/auth/login/mfa", tokenSchema, { challenge_id: challengeId, code, client: client() }),

  /** 429 = ainda na espera; 410 = desafio encerrado. */
  resendMfa: (challengeId: string) =>
    api.post(
      "/auth/login/mfa/resend",
      z.object({ code_expires_in: z.number(), resend_in: z.number() }),
      { challenge_id: challengeId }
    ),

  /** Responde sucesso mesmo sem conta, para não revelar quais e-mails existem. */
  forgotPassword: (email: string) => api.post("/auth/password/forgot", success, { email }),

  /** Encerra só esta sessão. O token vai explícito porque a sessão local é apagada logo depois. */
  logout: (token: string) =>
    api.post("/auth/logout", success, {}, { Authorization: `Bearer ${token}` }),
};
