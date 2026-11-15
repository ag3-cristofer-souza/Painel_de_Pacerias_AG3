/** Números, datas e dinheiro no formato brasileiro. */

const intFmt = new Intl.NumberFormat("pt-BR");

export const formatInt = (n: number) => intFmt.format(n);

/** `"2026-10-01"` ou ISO com hora → `01/10/2026`. Data pura não passa por `Date` (o fuso mudaria o dia). */
export function formatDate(value: string): string {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) return `${day[3]}/${day[2]}/${day[1]}`;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** `"2026-10-01"` → `out/2026`. */
export function formatMonth(value: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(value);
  return m ? `${MONTHS[Number(m[2]) - 1] ?? m[2]}/${m[1]}` : value;
}

/** Custo por moeda (`{"USD": 1.5, "BRL": 2}`) → `US$ 1,50 · R$ 2,00`. Sem custo → `—`. */
export function formatCost(cost: Record<string, number>): string {
  const parts = Object.entries(cost)
    .filter(([, v]) => v > 0)
    .map(([currency, v]) => {
      try {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
      } catch {
        return `${currency} ${v.toFixed(2)}`;
      }
    });
  return parts.length ? parts.join(" · ") : "—";
}

export const formatMoneyCents = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

/** Segundos de áudio → minutos inteiros (`0 min` quando não houve). */
export const formatMinutes = (seconds: number) => `${formatInt(Math.round(seconds / 60))} min`;

/** `"199,90"`, `"R$ 1.299,90"` ou `"199.9"` → centavos. Vazio → `null`; texto que não é valor → `undefined`. */
export function parseMoneyCents(text: string): number | null | undefined {
  const clean = text.replace(/R\$|\s/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return undefined;
  return Math.round(Number(normalized) * 100);
}

/** Centavos → texto do campo (`19990` → `"199,90"`). */
export const centsToInput = (cents?: number) =>
  cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",");

/** `0` → "hoje", `1` → "amanhã", `n` → "em n dias". */
export const inDays = (days: number) =>
  days <= 0 ? "hoje" : days === 1 ? "amanhã" : `em ${formatInt(days)} dias`;

/** ISO com hora → `13/11/2026 às 14:05`, no horário de Brasília. */
export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const opts = { timeZone: "America/Sao_Paulo" } as const;
  return `${d.toLocaleDateString("pt-BR", opts)} às ${d.toLocaleTimeString("pt-BR", { ...opts, hour: "2-digit", minute: "2-digit" })}`;
}

/** Data local de hoje mais `days`, em `aaaa-mm-dd` (para o `min` dos campos de data). */
export function localIsoDate(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
