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
