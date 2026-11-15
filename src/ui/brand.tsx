import { Building2, LifeBuoy, ReceiptText, ShieldCheck } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import logoBranco from "@/assets/logo-branco.png";
import { cn } from "@/lib/utils";

const BRAND_COLOR = "#12224e";

/** A barra do sistema acompanha a tela de entrada enquanto ela estiver aberta. */
function useBrandStatusBar(): void {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = BRAND_COLOR;
    return () => {
      meta.content = previous;
    };
  }, []);
}

/** Selo do produto: "Painel de Parcerias" com a marca AG3. */
function ProductTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em]",
        className
      )}
    >
      <LifeBuoy className="size-3.5" aria-hidden="true" />
      Painel de Parcerias
    </span>
  );
}

type Tone = "ok" | "attn" | "late";

const TONE: Record<Tone, string> = {
  ok: "bg-emerald-400/15 text-emerald-300",
  attn: "bg-amber-400/15 text-amber-300",
  late: "bg-rose-400/15 text-rose-300",
};

const QUEUE: { level: string; title: string; client: string; sla: string; tone: Tone }[] = [
  {
    level: "N1",
    title: "Canal desconectado",
    client: "Loja Centro",
    sla: "responder em 12 min",
    tone: "ok",
  },
  {
    level: "N2",
    title: "Dúvida na cadência",
    client: "Clínica Sorriso",
    sla: "responder em 38 min",
    tone: "attn",
  },
  {
    level: "N3",
    title: "Erro ao importar leads",
    client: "Imobiliária Sul",
    sla: "aguardando correção",
    tone: "late",
  },
];

const PREVIEW_STATS = [
  ["24", "clientes ativos"],
  ["96%", "no prazo do SLA"],
  ["2", "mensalidades em atraso"],
] as const;

/** Prévia ilustrativa da fila de atendimento: mostra para que serve o painel antes de entrar. */
function ConsolePreview() {
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1a3d]/80 p-4 shadow-[0_24px_60px_rgba(0,6,30,0.55)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Fila de atendimento</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
          exemplo
        </span>
      </div>
      <ul className="space-y-2">
        {QUEUE.map((item) => (
          <li
            key={item.level}
            className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#2563eb]/25 text-xs font-bold text-[#9cc0ff]">
              {item.level}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">{item.title}</span>
              <span className="block truncate text-xs text-white/55">{item.client}</span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                TONE[item.tone]
              )}
            >
              {item.sla}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {PREVIEW_STATS.map(([n, label]) => (
          <div key={label} className="rounded-xl bg-white/[0.04] px-2 py-2">
            <div className="text-base font-semibold text-white">{n}</div>
            <div className="text-[11px] leading-tight text-white/55">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PILLARS = [
  { icon: Building2, title: "Carteira", text: "Uso, canais e situação de cada cliente." },
  { icon: LifeBuoy, title: "Chamados", text: "Atendimento por nível, do N1 ao N3, com prazo." },
  { icon: ReceiptText, title: "Mensalidades", text: "Vencimentos, avisos e acordos explicados." },
];

/** Lado da marca (computador): azul-marinho da AG3, com cara de central de atendimento. */
function PartnerHero() {
  return (
    <aside className="partner-hero relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:gap-10 lg:p-10 xl:p-14">
      <div className="flex items-center gap-4">
        <img src={logoBranco} alt="AG3.AI" width={132} height={30} />
        <span className="h-6 w-px bg-white/20" aria-hidden="true" />
        <ProductTag className="border-white/15 bg-white/[0.06] text-white/80" />
      </div>

      <div className="max-w-xl space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Seus clientes, os chamados e as mensalidades num só lugar.
          </h2>
          <p className="max-w-lg text-base text-white/70">
            O painel de quem implanta, atende e acompanha os clientes: parceiros e a equipe de
            suporte da AG3, cada um com o seu nível de acesso.
          </p>
        </div>
        <ConsolePreview />
      </div>

      <div className="space-y-6">
        <ul className="grid grid-cols-3 gap-4">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="space-y-1.5">
              <Icon className="size-5 text-[#8fb4ff]" aria-hidden="true" />
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs leading-snug text-white/60">{text}</p>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-2 text-xs text-white/55">
          <ShieldCheck className="size-4 text-emerald-300" aria-hidden="true" />
          Acesso só para parceiros e equipe de suporte, com código por e-mail em toda entrada.
        </p>
      </div>
    </aside>
  );
}

/**
 * Tela de entrada: marca à esquerda (no computador) e o formulário num fundo claro, como o resto do painel.
 * No celular, a marca vira uma faixa azul-marinho no topo.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  useBrandStatusBar();
  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <PartnerHero />
      <div className="flex min-h-dvh flex-col">
        <header className="partner-hero flex items-center justify-between gap-3 px-5 py-4 text-white lg:hidden">
          <img src={logoBranco} alt="AG3.AI" width={104} height={24} />
          <ProductTag className="border-white/15 bg-white/[0.06] text-white/80" />
        </header>
        <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">{children}</div>
        </main>
        <footer className="px-5 pb-6 text-center text-xs text-muted-foreground sm:px-8">
          Problemas para entrar? Fale com o seu contato na AG3.
        </footer>
      </div>
    </div>
  );
}
