import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  Handshake,
  Loader2,
  PauseCircle,
  Undo2,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { billingApi, type BillingDetail, type PostponeInput } from "@/api/billing";
import { usePanel } from "@/features/auth/AuthProvider";
import {
  centsToInput,
  formatDate,
  formatDateTime,
  formatInt,
  formatMoneyCents,
  inDays,
  localIsoDate,
  parseMoneyCents,
} from "@/lib/format";
import { POSTPONE_KIND, SUSPENSION_EFFECTS } from "@/lib/labels";
import { canWriteBilling } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Field, TextArea } from "@/ui/field";

type Action = "payment" | "postpone" | "schedule" | "cancel" | null;

/** Cor do resumo: suspenso (vermelho), em atraso ou adiado (amarelo), em dia (verde). */
function summaryTone(d: BillingDetail): string {
  if (d.suspended) return "border-destructive/30 bg-destructive/5";
  if (d.status === "overdue" || d.status === "postponed") return "border-warning/30 bg-warning/5";
  if (d.status === "ok") return "border-success/30 bg-success/5";
  return "border-border bg-muted/40";
}

function statusText(d: BillingDetail): string {
  if (!d.enrolled) return "Vencimento não informado";
  if (d.suspended) return d.suspended_by_billing ? "Suspenso pela mensalidade" : "Suspenso à mão";
  switch (d.status) {
    case "overdue":
      return `Em atraso há ${formatInt(d.days_late ?? 0)} dias`;
    case "postponed":
      return `Em atraso há ${formatInt(d.days_late ?? 0)} dias, suspensão adiada`;
    case "due_soon":
      return "Vence em breve";
    default:
      return "Em dia";
  }
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{children}</dd>
    </div>
  );
}

function Facts({ d }: { d: BillingDetail }) {
  let suspension: string;
  if (d.suspended) suspension = "Já suspenso";
  else if (!d.auto_suspend) suspension = "Automática desligada (só avisos)";
  else if (d.suspend_on)
    suspension = `${formatDate(d.suspend_on)} (${inDays(d.days_to_suspension ?? 0)})`;
  else suspension = "—";
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Fact label="Situação">{statusText(d)}</Fact>
      <Fact label="Vencimento em aberto">{d.due_date ? formatDate(d.due_date) : "—"}</Fact>
      <Fact label="Valor">
        {d.amount_cents !== undefined ? formatMoneyCents(d.amount_cents) : "Não informado"}
      </Fact>
      <Fact label="Suspensão automática">{suspension}</Fact>
    </dl>
  );
}

/** Linha do tempo da mensalidade em aberto: o que já aconteceu e o que vai acontecer se nada for feito. */
function Timeline({ d }: { d: BillingDetail }) {
  if (!d.timeline.length) return null;
  const next = d.timeline.findIndex((e) => !e.done);
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">O que acontece e quando, se nada for feito</h3>
      <ol className="space-y-2">
        {d.timeline.map((e, i) => (
          <li key={e.kind} className="flex gap-3 text-sm">
            {e.done ? (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-label="já aconteceu"
              />
            ) : (
              <Circle
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  i === next ? "text-warning" : "text-muted-foreground"
                )}
                aria-label={i === next ? "próximo passo" : "ainda não aconteceu"}
              />
            )}
            <span className={cn(e.done && "text-muted-foreground", i === next && "font-medium")}>
              <span className="tabular-nums">{formatDate(e.date)}</span> — {e.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        Os avisos vão por e-mail aos administradores do cliente e aparecem como faixa no painel
        dele, sem citar a AG3: o texto pede para falar com o responsável pela conta.
      </p>
    </div>
  );
}

/** As regras, em palavras simples, para quem nunca usou a tela (D20: "muito bem explicado"). */
function HowItWorks() {
  return (
    <details className="rounded-xl bg-muted/40 p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        Como funciona a mensalidade e a suspensão
      </summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
        <li>
          Depois que o vencimento é informado, o sistema avisa o cliente 3 dias antes, no dia, com 7
          dias de atraso e na véspera da suspensão.
        </li>
        <li>No 15º dia de atraso, o cliente é suspenso automaticamente. {SUSPENSION_EFFECTS}</li>
        <li>
          <strong>Registrar pagamento</strong> passa o vencimento para o mês seguinte. Se o cliente
          estava suspenso pela mensalidade, ele volta na hora.
        </li>
        <li>
          <strong>Adiar à mão</strong> serve para quando o cliente pediu mais uns dias: você escolhe
          a nova data da suspensão e diz o motivo.
        </li>
        <li>
          <strong>Acordo com o cliente</strong> serve para quando houve um combinado: você informa a
          data em que ele prometeu pagar, e a suspensão fica para alguns dias depois dela, como
          margem.
        </li>
        <li>
          Os dois adiamentos valem no máximo 30 dias por vez, podem ser renovados e desfeitos, e
          reativam na hora o cliente suspenso pela mensalidade. Tudo fica no histórico, com o nome
          de quem fez.
        </li>
        <li>
          Suspensão feita à mão, pela carteira, não é desfeita pelo pagamento: ela só sai com a
          reativação manual.
        </li>
      </ul>
    </details>
  );
}

function PostponementBox({
  d,
  canWrite,
  onCancel,
}: {
  d: BillingDetail;
  canWrite: boolean;
  onCancel: () => void;
}) {
  const p = d.postponement;
  if (!p) return null;
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
      <p className="font-semibold">
        {POSTPONE_KIND[p.kind] ?? p.kind}: suspensão só em {formatDate(p.until)}
      </p>
      {p.promised_date && (
        <p className="mt-1">Data prometida de pagamento: {formatDate(p.promised_date)}</p>
      )}
      <p className="mt-1">
        <span className="text-muted-foreground">
          {p.kind === "agreement" ? "O que foi combinado" : "Motivo"}:
        </span>{" "}
        {p.note}
      </p>
      {(p.by_name || p.at) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {p.by_name ? `Por ${p.by_name}` : ""}
          {p.by_name && p.at ? ", em " : ""}
          {p.at ? formatDateTime(p.at) : ""}
        </p>
      )}
      {canWrite && (
        <Button variant="ghost" className="mt-2 -ml-3" onClick={onCancel}>
          <Undo2 aria-hidden="true" />
          Desfazer adiamento
        </Button>
      )}
    </div>
  );
}

function History({ d }: { d: BillingDetail }) {
  if (!d.history.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Histórico</h3>
      <ul className="divide-y text-sm">
        {d.history.map((h, i) => (
          <li key={`${h.at}-${i}`} className="py-2">
            <p>{h.description}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(h.at)}
              {h.by_name ? ` · ${h.by_name}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── formulários ──
interface FormProps {
  d: BillingDetail;
  onDone: (d: BillingDetail) => void;
  onClose?: () => void;
}

function useBillingAction<T>(
  companyId: string,
  fn: (input: T) => Promise<BillingDetail>,
  onDone: (d: BillingDetail) => void
) {
  return useMutation({ mutationFn: fn, onSuccess: onDone, mutationKey: ["billing", companyId] });
}

function FormShell({
  title,
  children,
  onSubmit,
  error,
  pending,
  submitLabel,
  disabled,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  error: Error | null;
  pending: boolean;
  submitLabel: string;
  disabled?: boolean;
  onClose?: () => void;
}) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border p-4" aria-label={title}>
      <h3 className="font-semibold">{title}</h3>
      {children}
      <ErrorText>{error?.message}</ErrorText>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending} disabled={disabled}>
          {submitLabel}
        </Button>
        {onClose && (
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

function ScheduleForm({ d, onDone, onClose }: FormProps) {
  const [due, setDue] = useState(d.due_date ?? "");
  const [amount, setAmount] = useState(centsToInput(d.amount_cents));
  const cents = parseMoneyCents(amount);
  const action = useBillingAction(
    d.company.id,
    () => billingApi.setSchedule(d.company.id, { due_date: due, amount_cents: cents ?? null }),
    onDone
  );
  return (
    <FormShell
      title={d.enrolled ? "Alterar vencimento" : "Informar vencimento"}
      onSubmit={() => action.mutate(undefined)}
      error={
        action.error ??
        (cents === undefined ? new Error("Valor inválido. Use, por exemplo, 199,90.") : null)
      }
      pending={action.isPending}
      submitLabel="Salvar vencimento"
      disabled={!due || cents === undefined}
      onClose={onClose}
    >
      <p className="text-sm text-muted-foreground">
        {d.enrolled
          ? "Use para corrigir a data ou o valor da mensalidade em aberto. Para dizer que ela foi paga, use Registrar pagamento."
          : "A partir deste vencimento, o cliente recebe os avisos automáticos e, se a mensalidade não for paga, é suspenso no 15º dia de atraso."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Vencimento em aberto"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          required
        />
        <Field
          label="Valor (opcional)"
          inputMode="decimal"
          placeholder="199,90"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
    </FormShell>
  );
}

function PaymentForm({ d, onDone, onClose }: FormProps) {
  const [note, setNote] = useState("");
  const action = useBillingAction(
    d.company.id,
    () => billingApi.payment(d.company.id, note),
    onDone
  );
  return (
    <FormShell
      title="Registrar pagamento"
      onSubmit={() => action.mutate(undefined)}
      error={action.error}
      pending={action.isPending}
      submitLabel="Confirmar pagamento"
      onClose={onClose}
    >
      <p className="text-sm">
        Registra que a mensalidade de {d.due_date ? formatDate(d.due_date) : "—"} foi paga. O
        próximo vencimento passa para o mês seguinte e os avisos recomeçam do zero.
        {d.suspended_by_billing &&
          " O cliente, suspenso pela mensalidade, volta a funcionar na hora."}
        {d.suspended &&
          !d.suspended_by_billing &&
          " Este cliente foi suspenso à mão: o pagamento não reativa sozinho. Reative pela carteira."}
      </p>
      <TextArea
        label="Observação (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Ex.: Pix recebido em 13/11"
      />
    </FormShell>
  );
}

function PostponeForm({ d, onDone, onClose }: FormProps) {
  const [kind, setKind] = useState<PostponeInput["kind"]>("manual");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const action = useBillingAction(
    d.company.id,
    () =>
      billingApi.postpone(
        d.company.id,
        kind === "manual" ? { kind, until: date, note } : { kind, promised_date: date, note }
      ),
    onDone
  );
  const options: { value: PostponeInput["kind"]; title: string; text: string; icon: ReactNode }[] =
    [
      {
        value: "manual",
        title: "Adiar à mão",
        text: "O cliente pediu mais uns dias. Você escolhe a nova data da suspensão.",
        icon: <CalendarClock className="size-5" aria-hidden="true" />,
      },
      {
        value: "agreement",
        title: "Acordo com o cliente",
        text: "Houve um combinado de pagamento. A suspensão fica para alguns dias depois da data prometida.",
        icon: <Handshake className="size-5" aria-hidden="true" />,
      },
    ];
  return (
    <FormShell
      title="Adiar suspensão"
      onSubmit={() => action.mutate(undefined)}
      error={action.error}
      pending={action.isPending}
      submitLabel={kind === "manual" ? "Adiar suspensão" : "Registrar acordo"}
      disabled={!date || !note.trim()}
      onClose={onClose}
    >
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Tipo de adiamento</legend>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-xl border p-3 text-sm",
              kind === o.value && "border-primary bg-secondary/60"
            )}
          >
            <input
              type="radio"
              name="kind"
              value={o.value}
              checked={kind === o.value}
              onChange={() => setKind(o.value)}
              className="sr-only"
            />
            <span className="text-primary">{o.icon}</span>
            <span>
              <span className="block font-medium">{o.title}</span>
              <span className="text-muted-foreground">{o.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Field
        label={kind === "manual" ? "Nova data da suspensão" : "Data prometida de pagamento"}
        type="date"
        min={localIsoDate(kind === "manual" ? 1 : 0)}
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      <TextArea
        label={kind === "manual" ? "Motivo" : "O que foi combinado"}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        required
        placeholder={
          kind === "manual" ? "Ex.: pediu até sexta para pagar" : "Ex.: paga via Pix no dia 20"
        }
      />
      <p className="text-xs text-muted-foreground">
        Vale no máximo 30 dias por vez e pode ser renovado ou desfeito. Os avisos ao cliente passam
        a citar a nova data.
        {d.suspended_by_billing &&
          " O cliente, suspenso pela mensalidade, volta a funcionar na hora."}
      </p>
    </FormShell>
  );
}

function CancelForm({ d, onDone, onClose }: FormProps) {
  const action = useBillingAction(
    d.company.id,
    () => billingApi.cancelPostponement(d.company.id),
    onDone
  );
  return (
    <FormShell
      title="Desfazer adiamento"
      onSubmit={() => action.mutate(undefined)}
      error={action.error}
      pending={action.isPending}
      submitLabel="Desfazer adiamento"
      onClose={onClose}
    >
      <p className="text-sm">
        A suspensão volta para a data original. Se ela já passou, o cliente é suspenso na próxima
        verificação, que roda de hora em hora.
      </p>
    </FormShell>
  );
}

const FORMS: Record<Exclude<Action, null>, (p: FormProps) => ReactNode> = {
  payment: PaymentForm,
  postpone: PostponeForm,
  schedule: ScheduleForm,
  cancel: CancelForm,
};

/** A mensalidade de um cliente: resumo, linha do tempo, adiamento, ações e histórico. */
export function BillingPanel({ companyId }: { companyId: string }) {
  const panel = usePanel();
  const client = useQueryClient();
  const canWrite = canWriteBilling(panel);
  const [action, setAction] = useState<Action>(null);
  const query = useQuery({
    queryKey: ["billing", companyId],
    queryFn: () => billingApi.get(companyId),
  });

  const done = async (data: BillingDetail) => {
    client.setQueryData(["billing", companyId], data);
    setAction(null);
    await Promise.all([
      client.invalidateQueries({ queryKey: ["overdue"] }),
      client.invalidateQueries({ queryKey: ["company", companyId] }),
      client.invalidateQueries({ queryKey: ["portfolio"] }),
    ]);
  };

  if (query.isPending) {
    return (
      <div className="flex justify-center p-6" role="status">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Carregando mensalidade</span>
      </div>
    );
  }
  if (query.isError) return <ErrorText>{query.error.message}</ErrorText>;

  const d = query.data;
  const Form = action ? FORMS[action] : null;
  const close = () => setAction(null);

  return (
    <div className="space-y-4">
      <div className={cn("flex gap-3 rounded-xl border p-4 text-sm", summaryTone(d))}>
        {(d.suspended || d.status === "overdue") && (
          <AlertTriangle
            className={cn(
              "mt-0.5 size-5 shrink-0",
              d.suspended ? "text-destructive" : "text-warning"
            )}
            aria-hidden="true"
          />
        )}
        <p>{d.summary}</p>
      </div>

      {d.enrolled && <Facts d={d} />}
      <PostponementBox d={d} canWrite={canWrite} onCancel={() => setAction("cancel")} />

      {canWrite ? (
        Form ? (
          <Form d={d} onDone={done} onClose={close} />
        ) : !d.enrolled ? (
          <ScheduleForm d={d} onDone={done} />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAction("payment")}>
              <CircleDollarSign aria-hidden="true" />
              Registrar pagamento
            </Button>
            {(d.status === "overdue" || d.status === "postponed" || d.suspended_by_billing) && (
              <Button variant="outline" onClick={() => setAction("postpone")}>
                <PauseCircle aria-hidden="true" />
                {d.postponement ? "Renovar adiamento" : "Adiar suspensão"}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setAction("schedule")}>
              <CalendarClock aria-hidden="true" />
              Alterar vencimento
            </Button>
          </div>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Só o dono ou um administrador do parceiro mexe na mensalidade. Você pode acompanhar e
          entrar em contato com o cliente.
        </p>
      )}

      <Timeline d={d} />
      <HowItWorks />
      <History d={d} />
    </div>
  );
}
