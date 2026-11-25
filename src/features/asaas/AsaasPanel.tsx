import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { asaasApi, type AsaasNfse, type AsaasOverview, type AsaasSubscription } from "@/api/asaas";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { TextArea } from "@/ui/field";

/**
 * Cobrança pelo Asaas do cliente — só a equipe AG3 (adendo kn). O plano muda quando o Asaas avisa o pagamento; se o
 * aviso se perder, o sistema confere sozinho de hora em hora. Aqui o suporte ou o financeiro confere na hora ou,
 * com o pagamento confirmado por fora (extrato, comprovante), ativa à mão — com o motivo, registrado.
 */

const STATUS: Record<
  string,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" }
> = {
  pending: { label: "Aguardando pagamento", tone: "warning" },
  active: { label: "Ativa", tone: "success" },
  overdue: { label: "Em atraso", tone: "danger" },
  canceled: { label: "Cancelada", tone: "neutral" },
};
const PAY_STATUS: Record<string, string> = {
  paid: "Pago",
  pending: "Em aberto",
  overdue: "Vencido",
  refunded: "Estornado",
};
const METHOD: Record<string, string> = { card: "Cartão", pix: "Pix", boleto: "Boleto" };

const brl = (cents: number | null) =>
  cents === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const NOTA: Record<string, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> =
  {
    REQUESTED: { label: "Pedida", tone: "warning" },
    SCHEDULED: { label: "Agendada", tone: "warning" },
    SYNCHRONIZED: { label: "Na prefeitura", tone: "warning" },
    AUTHORIZED: { label: "Emitida", tone: "success" },
    ERROR: { label: "Recusada", tone: "danger" },
    PROCESSING_CANCELLATION: { label: "Cancelando", tone: "warning" },
    CANCELED: { label: "Cancelada", tone: "neutral" },
    CANCELLATION_DENIED: { label: "Cancelamento negado", tone: "danger" },
    SKIPPED: { label: "Não emitida (estorno)", tone: "neutral" },
  };

/** Notas fiscais do cliente (B18, adendo ks): situação da emissão automática, endereço e uma linha por nota. */
function NfseSection({ nfse }: { nfse: AsaasNfse }) {
  const situacao =
    nfse.state === "off"
      ? "Emissão automática desligada."
      : nfse.state === "incomplete"
        ? `Emissão automática ligada, mas falta preencher no Admin: ${nfse.missing.join(", ")}.`
        : "Emissão automática ligada: uma nota por pagamento confirmado.";
  const f = nfse.fiscal;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Notas fiscais</h3>
      <p className="text-sm text-muted-foreground">
        {situacao}{" "}
        {f.complete
          ? `Endereço: CEP ${f.postal_code ?? ""}, nº ${f.address_number ?? ""}${f.complement ? `, ${f.complement}` : ""}.`
          : f.required
            ? "Sem endereço: o cliente precisa informar CEP e número antes de pagar."
            : "Sem endereço informado."}
      </p>
      {nfse.invoices.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {nfse.invoices.map((n) => {
            const st = NOTA[n.status] ?? { label: n.status, tone: "neutral" as const };
            return (
              <li
                key={n.external_id ?? n.payment ?? n.created_at}
                className="flex flex-wrap items-center gap-x-2"
              >
                <span>{formatDateTime(n.created_at)}</span>
                <span className="font-medium">{brl(n.value_cents)}</span>
                <Badge tone={st.tone}>{st.label}</Badge>
                {n.number && <span className="text-muted-foreground">nº {n.number}</span>}
                {n.pdf_url && (
                  <a
                    href={n.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  >
                    PDF <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                )}
                {n.error && <span className="w-full text-destructive">{n.error}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const ORIGEM: Record<string, string> = {
  explicit: "escolhida pela equipe",
  cutoff: "pela data de corte",
  list: "pela lista do Admin",
  sandbox: "ambiente de teste",
  closed: "cobrança automática fechada (falta a data de corte no Admin)",
};

/** Cobrança manual (como os clientes atuais) ou automática pelo Asaas — escolha da equipe, com motivo (adendo kv). */
function ModeBox({
  companyId,
  automatic,
  source,
  onDone,
}: {
  companyId: string;
  automatic: boolean;
  source?: string;
  onDone: (data: AsaasOverview) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const target = automatic ? "manual" : "automatic";
  const mutation = useMutation({
    mutationFn: () => asaasApi.setMode(companyId, target, reason.trim()),
    onSuccess: (d) => {
      setOpen(false);
      setReason("");
      onDone(d);
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };
  return (
    <div
      role="note"
      className={
        automatic
          ? "rounded-xl border px-3 py-2 text-sm"
          : "rounded-xl border border-warning/40 bg-warning/5 px-3 py-2 text-sm"
      }
    >
      <p>
        {automatic ? (
          <>
            <strong>Cobrança automática</strong> pelo Asaas: assinatura, fatura e nota fiscal saem
            sozinhas.
          </>
        ) : (
          <>
            <strong>Cobrança manual</strong>, como os clientes atuais: o sistema não gera
            assinatura, fatura nem nota. A cobrança e a nota são feitas pela equipe.
          </>
        )}{" "}
        {source && <span className="text-muted-foreground">({ORIGEM[source] ?? source})</span>}
      </p>
      {source !== "closed" && !open && (
        <button
          type="button"
          className="mt-1 text-primary underline-offset-2 hover:underline"
          onClick={() => setOpen(true)}
        >
          {automatic ? "Passar para cobrança manual" : "Passar para cobrança automática"}
        </button>
      )}
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <TextArea
            label="Motivo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: contrato com cobrança por boleto do financeiro"
            minLength={10}
            maxLength={500}
            required
          />
          <ErrorText>{mutation.error?.message}</ErrorText>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={mutation.isPending} disabled={reason.trim().length < 10}>
              {automatic ? "Confirmar cobrança manual" : "Confirmar cobrança automática"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function what(sub: AsaasSubscription) {
  return sub.kind === "plan" ? `Plano ${sub.plan_key ?? ""}` : "Canal não oficial";
}

function ActivateForm({
  companyId,
  sub,
  onDone,
}: {
  companyId: string;
  sub: AsaasSubscription;
  onDone: (data: AsaasOverview) => void;
}) {
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => asaasApi.activate(companyId, sub.id, reason.trim()),
    onSuccess: onDone,
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };
  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl border border-warning/40 p-4">
      <p className="text-sm">
        Use só com o pagamento confirmado por fora (extrato, comprovante). A assinatura fica ativa,
        o plano muda e o administrador do cliente recebe o aviso por e-mail. Fica registrado quem
        fez e por quê.
      </p>
      <TextArea
        label="Motivo"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ex.: Pix de R$ 499,00 conferido no extrato de 25/11 por Fulana"
        minLength={10}
        maxLength={500}
        required
      />
      <ErrorText>{mutation.error?.message}</ErrorText>
      <Button type="submit" loading={mutation.isPending} disabled={reason.trim().length < 10}>
        <ShieldCheck aria-hidden="true" />
        Ativar {what(sub).toLowerCase()}
      </Button>
    </form>
  );
}

export function AsaasPanel({ companyId }: { companyId: string }) {
  const client = useQueryClient();
  const key = ["asaas", companyId];
  const query = useQuery({ queryKey: key, queryFn: () => asaasApi.get(companyId) });
  const [activating, setActivating] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const done = (data: AsaasOverview) => {
    client.setQueryData(key, data);
    void client.invalidateQueries({ queryKey: ["company", companyId] });
  };
  const sync = useMutation({
    mutationFn: () => asaasApi.sync(companyId),
    onSuccess: ({ data, activated }) => {
      done(data);
      setNotice(
        activated > 0
          ? `${activated} assinatura(s) paga(s) no Asaas foram ativadas agora.`
          : "Nada novo: o Asaas não tem pagamento confirmado para as assinaturas pendentes."
      );
    },
  });

  if (query.isPending)
    return <p className="text-sm text-muted-foreground">Carregando a cobrança…</p>;
  if (query.isError) return <ErrorText>{query.error.message}</ErrorText>;
  const data = query.data;
  const pendentes = data.subscriptions.filter(
    (s) => s.status === "pending" || s.status === "overdue"
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Ambiente do Asaas:{" "}
          <strong>{data.environment === "prod" ? "produção" : "teste (sandbox)"}</strong>
          {data.configured ? "" : " · sem chave configurada"}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setNotice(null);
            sync.mutate();
          }}
          loading={sync.isPending}
          disabled={!data.configured}
        >
          <RefreshCw aria-hidden="true" />
          Conferir no Asaas agora
        </Button>
      </div>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <ErrorText>{sync.error?.message}</ErrorText>
      {data.automatic !== undefined && (
        <ModeBox
          companyId={companyId}
          automatic={data.automatic}
          source={data.mode_source}
          onDone={(d) => done(d)}
        />
      )}

      {data.subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este cliente não tem assinatura pelo Asaas.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {data.subscriptions.map((sub) => {
            const st = STATUS[sub.status] ?? { label: sub.status, tone: "neutral" as const };
            const pending = sub.status === "pending" || sub.status === "overdue";
            return (
              <li key={sub.id} className="space-y-1 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{what(sub)}</span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <span className="text-muted-foreground">
                    {brl(sub.value_cents)}/mês
                    {sub.method ? ` · ${METHOD[sub.method] ?? sub.method}` : ""}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Pedida em {sub.created_at ? formatDateTime(sub.created_at) : "—"}
                  {sub.activated_at ? ` · ativa desde ${formatDateTime(sub.activated_at)}` : ""}
                  {sub.next_due_date
                    ? ` · próximo vencimento ${formatDate(sub.next_due_date)}`
                    : ""}
                  {sub.external_id ? ` · ${sub.external_id}` : ""}
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  {sub.invoice_url && (
                    <a
                      href={sub.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                    >
                      Fatura no Asaas <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  )}
                  {pending && activating !== sub.id && (
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => setActivating(sub.id)}
                    >
                      Ativar à mão
                    </button>
                  )}
                </div>
                {activating === sub.id && (
                  <ActivateForm
                    companyId={companyId}
                    sub={sub}
                    onDone={(d) => {
                      setActivating(null);
                      setNotice(`${what(sub)} ativado à mão.`);
                      done(d);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pendentes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Assinatura pendente: o plano muda quando o Asaas avisa o pagamento. Se o cliente diz que
          pagou, primeiro use “Conferir no Asaas agora”; ative à mão só com o pagamento confirmado
          por fora.
        </p>
      )}

      {data.payments.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Pagamentos registrados</h3>
          <ul className="space-y-1 text-sm">
            {data.payments.map((p) => (
              <li key={p.external_id} className="flex flex-wrap gap-x-2">
                <span>{p.due ? formatDate(p.due) : "—"}</span>
                <span className="font-medium">{brl(p.amount_cents)}</span>
                <span className="text-muted-foreground">
                  {PAY_STATUS[p.status ?? ""] ?? p.status ?? "—"}
                  {p.method ? ` · ${p.method}` : ""} · {p.description ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.nfse && <NfseSection nfse={data.nfse} />}

      {data.manual_activations.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Ativações à mão</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {data.manual_activations.map((m) => (
              <li key={m.at}>
                {formatDateTime(m.at)} · {m.by_name || "equipe AG3"} · {m.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
