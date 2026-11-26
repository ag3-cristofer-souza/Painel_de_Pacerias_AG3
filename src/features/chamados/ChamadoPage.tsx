import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, KeyRound, Loader2, LogIn, Paperclip, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  supportApi,
  type TicketChange,
  type TicketDetail,
  type TicketMessage,
  type Visibility,
} from "@/api/support";
import { usePanel } from "@/features/auth/AuthProvider";
import { formatDateTime } from "@/lib/format";
import {
  OPEN_STATUSES,
  PANEL_STATUSES,
  PRIORITIES,
  SIDE_LABELS,
  VISIBILITY,
  eventText,
  fileSize,
  levelLabel,
  priority,
  slaBadge,
  ticketStatus,
} from "@/lib/support";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const select = "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

function Message({ m }: { m: TicketMessage }) {
  const note = m.visibility !== "public";
  return (
    <li
      className={cn(
        "rounded-xl border p-3 text-sm",
        note
          ? "border-warning/40 bg-warning/5"
          : m.author.side === "client"
            ? "bg-card"
            : "bg-muted/40"
      )}
    >
      <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          {m.author.name || SIDE_LABELS[m.author.side]}
        </span>
        <span>{SIDE_LABELS[m.author.side] ?? m.author.side}</span>
        <span>· {formatDateTime(m.created_at)}</span>
        {note && <Badge tone="warning">{VISIBILITY[m.visibility]?.label ?? m.visibility}</Badge>}
      </p>
      <p className="whitespace-pre-wrap break-words">{m.body}</p>
      {m.attachments.length > 0 && (
        <ul className="mt-2 space-y-1" aria-label="Anexos">
          {m.attachments.map((a) => (
            <li key={a.key} className="text-xs">
              {a.url ? (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  {a.name}
                </a>
              ) : (
                <span className="text-muted-foreground">{a.name} (indisponível agora)</span>
              )}{" "}
              <span className="text-muted-foreground">{fileSize(a.size)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Reply({ t, staff }: { t: TicketDetail; staff: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const options: Visibility[] = [
    ...(t.can_attend && t.status !== "closed" ? (["public"] as const) : []),
    "internal",
    ...(staff ? (["ag3"] as const) : []),
  ];
  const [visibility, setVisibility] = useState<Visibility>(options[0] ?? "internal");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const send = useMutation({
    mutationFn: () => supportApi.reply(t.id, { body: body.trim(), visibility, files }),
    onSuccess: () => {
      setBody("");
      setFiles([]);
      void qc.invalidateQueries({ queryKey: ["ticket", t.id] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
    },
  });

  const add = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const big = picked.filter((f) => f.size > MAX_BYTES);
    const next = [...files, ...picked.filter((f) => f.size <= MAX_BYTES)].slice(0, MAX_FILES);
    setFiles(next);
    setFileError(
      big.length
        ? `${big.map((f) => f.name).join(", ")}: maior que 10 MB.`
        : files.length + picked.length > MAX_FILES
          ? `Até ${MAX_FILES} arquivos por mensagem.`
          : ""
    );
    if (input.current) input.current.value = "";
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (body.trim()) send.mutate();
  };

  return (
    <form onSubmit={submit} className="surface space-y-3 p-4" aria-label="Responder">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Para quem</legend>
        {options.map((v) => (
          <label
            key={v}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm",
              visibility === v
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            <input
              type="radio"
              name="visibility"
              value={v}
              checked={visibility === v}
              onChange={() => setVisibility(v)}
              className="sr-only"
            />
            {VISIBILITY[v]?.label ?? v}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-muted-foreground">{VISIBILITY[visibility]?.hint}</p>
      <label className="block">
        <span className="sr-only">Mensagem</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={20000}
          placeholder={visibility === "public" ? "Escreva a resposta ao cliente" : "Escreva a nota"}
          className="w-full rounded-xl border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        aria-label="Anexar arquivos"
        onChange={(e) => add(e.target.files)}
      />
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Arquivos anexados">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs"
            >
              <span className="max-w-[12rem] truncate">{f.name}</span>
              <button
                type="button"
                aria-label={`Remover ${f.name}`}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ErrorText>{fileError}</ErrorText>
      <ErrorText>{send.isError ? send.error.message : ""}</ErrorText>
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          onClick={() => input.current?.click()}
          disabled={files.length >= MAX_FILES || send.isPending}
        >
          <Paperclip aria-hidden="true" />
          Anexar
        </Button>
        <Button type="submit" loading={send.isPending} disabled={!body.trim()}>
          Enviar
        </Button>
      </div>
    </form>
  );
}

function ReasonForm({
  label,
  onSubmit,
  onCancel,
  pending,
}: {
  label: string;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onSubmit(reason.trim());
      }}
    >
      <label className="block text-sm font-medium">
        Motivo
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={2000}
          className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" loading={pending} disabled={!reason.trim()}>
          {label}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Transferir o responsável (26/11): a lista vem do servidor, com quem atende o chamado no nível atual. */
function Transfer({
  t,
  pending,
  onPick,
  onCancel,
}: {
  t: TicketDetail;
  pending: boolean;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const options = useQuery({
    queryKey: ["ticket-assignees", t.id, t.level],
    queryFn: () => supportApi.assignees(t.id),
  });
  const choices = (options.data ?? []).filter((p) => !p.current);
  const [picked, setPicked] = useState("");
  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (picked) onPick(picked);
      }}
    >
      <label className="block text-sm font-medium">
        Transferir para
        <select
          className={cn(select, "mt-1")}
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          disabled={options.isPending}
        >
          <option value="">{options.isPending ? "Carregando…" : "Escolha a pessoa"}</option>
          {choices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || "Sem nome"}
            </option>
          ))}
        </select>
      </label>
      {options.data && choices.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Ninguém mais atende este chamado neste nível.
        </p>
      )}
      <ErrorText>{options.error?.message}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={!picked} loading={pending}>
          Confirmar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Actions({ t, staff, userId }: { t: TicketDetail; staff: boolean; userId: string }) {
  const qc = useQueryClient();
  const [moving, setMoving] = useState<"" | "escalate" | "return">("");
  const [issue, setIssue] = useState(t.issue_url ?? "");
  const [transferring, setTransferring] = useState(false);
  const done = (detail: TicketDetail) => {
    qc.setQueryData(["ticket", t.id], detail);
    void qc.invalidateQueries({ queryKey: ["tickets"] });
    setMoving("");
  };
  const update = useMutation({
    mutationFn: (c: TicketChange) => supportApi.update(t.id, c),
    onSuccess: done,
  });
  const escalate = useMutation({
    mutationFn: (r: string) => supportApi.escalate(t.id, r),
    onSuccess: done,
  });
  const giveBack = useMutation({
    mutationFn: (r: string) => supportApi.returnDown(t.id, r),
    onSuccess: done,
  });
  const error = [update, escalate, giveBack].find((m) => m.isError)?.error?.message;
  const closed = t.status === "closed";
  const mine = t.assignee?.id === userId;

  if (!t.can_attend || closed) {
    return (
      <div className="surface space-y-2 p-4 text-sm text-muted-foreground">
        {closed
          ? "Chamado fechado. Se o cliente precisar, ele abre um novo."
          : `O chamado está no ${levelLabel(t.level)}: você acompanha e pode escrever nota interna, mas quem atende é esse nível.`}
        {staff && !closed && t.level !== "n1" && (
          <ReturnButton t={t} moving={moving} setMoving={setMoving} giveBack={giveBack} />
        )}
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }

  return (
    <div className="surface space-y-3 p-4">
      <label className="block text-sm font-medium">
        Situação
        <select
          value={PANEL_STATUSES.includes(t.status as never) ? t.status : ""}
          onChange={(e) => update.mutate({ status: e.target.value })}
          className={cn(select, "mt-1")}
          disabled={update.isPending}
        >
          {!PANEL_STATUSES.includes(t.status as never) && (
            <option value="">{ticketStatus(t.status).label}</option>
          )}
          {PANEL_STATUSES.filter((s) => s !== "waiting_fix" || t.level === "n3").map((s) => (
            <option key={s} value={s}>
              {ticketStatus(s).label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Prioridade
        <select
          value={t.priority}
          onChange={(e) => update.mutate({ priority: e.target.value })}
          className={cn(select, "mt-1")}
          disabled={update.isPending}
        >
          {PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <div className="text-sm">
        <p className="font-medium">Responsável</p>
        <p className="text-muted-foreground">{t.assignee?.name || "Ninguém ainda"}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            variant="outline"
            loading={update.isPending && !transferring}
            onClick={() => update.mutate({ assignee_id: mine ? null : userId })}
          >
            {mine ? "Soltar" : "Assumir"}
          </Button>
          {!transferring && (
            <Button variant="outline" onClick={() => setTransferring(true)}>
              Transferir
            </Button>
          )}
        </div>
        {transferring && (
          <Transfer
            t={t}
            pending={update.isPending}
            onPick={(id) =>
              update.mutate({ assignee_id: id }, { onSuccess: () => setTransferring(false) })
            }
            onCancel={() => setTransferring(false)}
          />
        )}
      </div>

      {staff && t.level === "n3" && (
        <form
          className="space-y-1 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate({ issue_url: issue.trim() || null });
          }}
        >
          <label className="block font-medium">
            Issue da correção
            <input
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="https://github.com/…"
              className={cn(select, "mt-1")}
            />
          </label>
          <Button type="submit" variant="outline" loading={update.isPending}>
            Salvar issue
          </Button>
        </form>
      )}

      {moving === "escalate" ? (
        <ReasonForm
          label={`Escalar para o ${levelLabel(t.level === "n1" ? "n2" : "n3")}`}
          pending={escalate.isPending}
          onSubmit={(r) => escalate.mutate(r)}
          onCancel={() => setMoving("")}
        />
      ) : (
        moving === "" &&
        t.level !== "n3" && (
          <Button variant="secondary" onClick={() => setMoving("escalate")}>
            Escalar
          </Button>
        )
      )}
      {staff && t.level !== "n1" && (
        <ReturnButton t={t} moving={moving} setMoving={setMoving} giveBack={giveBack} />
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function ReturnButton({
  t,
  moving,
  setMoving,
  giveBack,
}: {
  t: TicketDetail;
  moving: string;
  setMoving: (v: "" | "escalate" | "return") => void;
  giveBack: { isPending: boolean; mutate: (r: string) => void };
}) {
  const below = t.level === "n3" ? "n2" : "n1";
  if (moving === "return")
    return (
      <ReasonForm
        label={`Devolver ao ${levelLabel(below)}`}
        pending={giveBack.isPending}
        onSubmit={(r) => giveBack.mutate(r)}
        onCancel={() => setMoving("")}
      />
    );
  if (moving !== "") return null;
  return (
    <Button variant="ghost" onClick={() => setMoving("return")}>
      Devolver ao {levelLabel(below)}
    </Button>
  );
}

/** Acesso de suporte ao workspace (D14; 3d): só leitura, 24 h renováveis, enquanto o chamado está aberto. */
function Access({ t }: { t: TicketDetail }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["ticket", t.id] });
  const open = useMutation({ mutationFn: () => supportApi.openAccess(t.id), onSuccess: refresh });
  const close = useMutation({ mutationFn: () => supportApi.closeAccess(t.id), onSuccess: refresh });
  const a = t.support_access;
  const canOpen = t.can_attend && OPEN_STATUSES.includes(t.status);
  if (!a && !canOpen) return null;
  return (
    <div className="surface space-y-2 p-4 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <KeyRound className="size-4 text-primary" aria-hidden="true" />
        Acesso ao workspace
      </p>
      {a ? (
        <>
          <p className="text-muted-foreground">
            Só leitura, até {formatDateTime(a.expires_at)}
            {a.renewals > 0 ? ` (renovado ${a.renewals}x)` : ""}. O cliente vê na auditoria.
          </p>
          {a.enter_url && (
            <a
              href={a.enter_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <LogIn className="size-4" aria-hidden="true" />
              Entrar no workspace
            </a>
          )}
          <div className="flex flex-wrap gap-2">
            {canOpen && (
              <Button variant="outline" loading={open.isPending} onClick={() => open.mutate()}>
                Renovar por 24 h
              </Button>
            )}
            <Button variant="destructive" loading={close.isPending} onClick={() => close.mutate()}>
              Encerrar acesso
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-muted-foreground">
            Para ver o workspace do cliente como ele vê, só lendo, por 24 h. Fica registrado na
            auditoria do cliente.
          </p>
          <Button variant="outline" loading={open.isPending} onClick={() => open.mutate()}>
            Abrir acesso ao workspace
          </Button>
        </>
      )}
      <ErrorText>
        {open.isError ? open.error.message : close.isError ? close.error.message : ""}
      </ErrorText>
    </div>
  );
}

/**
 * Um chamado no Painel de Parcerias (5.1 e 5.2; passo 8a): a conversa com as notas internas destacadas, a resposta (ao
 * cliente, nota interna ou nota só da AG3) com anexos, as ações de quem atende no nível (situação, prioridade,
 * assumir, escalar; a equipe AG3 também devolve e liga a issue no N3), o acesso de suporte e o histórico.
 */
export function ChamadoPage() {
  const { id = "" } = useParams();
  const panel = usePanel();
  const staff = panel.kind === "ag3";
  const query = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => supportApi.get(id),
    refetchInterval: 30_000,
  });

  if (query.isPending)
    return (
      <div className="surface flex justify-center p-10" role="status">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">Carregando chamado</span>
      </div>
    );
  if (query.isError) return <ErrorText>{query.error.message}</ErrorText>;

  const t = query.data;
  const st = ticketStatus(t.status);
  const pr = priority(t.priority);
  const sla = slaBadge(t);
  return (
    <>
      <Link
        to="/chamados"
        className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Chamados
      </Link>
      <div className="mb-4 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          #{t.number} · {t.subject}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          <Badge tone={pr.tone}>Prioridade {pr.label.toLowerCase()}</Badge>
          <Badge>{levelLabel(t.level)}</Badge>
          {sla && <Badge tone={sla.tone}>{sla.label}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          <Link
            to={`/clientes/${encodeURIComponent(t.company.id)}`}
            className="font-medium text-primary"
          >
            {t.company.name}
          </Link>
          {staff && (t.partner ? ` · ${t.partner.name}` : " · cliente direto")} · {t.category.name}{" "}
          · aberto em {formatDateTime(t.created_at)}
          {t.opened_by?.name ? ` por ${t.opened_by.name}` : ""}
          {t.rating ? ` · avaliado ${t.rating.score} de 5` : ""}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <ul className="space-y-2" aria-label="Conversa">
            {t.messages.map((m) => (
              <Message key={m.id} m={m} />
            ))}
          </ul>
          <Reply key={`${t.id}-${t.can_attend}-${t.status}`} t={t} staff={staff} />
        </div>
        <aside className="space-y-4">
          <Actions key={`${t.id}-${t.issue_url}`} t={t} staff={staff} userId={panel.user.id} />
          {staff && <Access t={t} />}
          <div className="surface p-4">
            <p className="mb-2 text-sm font-medium">Histórico</p>
            <ol className="space-y-2 text-xs" aria-label="Histórico">
              {t.events.map((e) => (
                <li key={e.id}>
                  <p className="text-foreground">{eventText(e)}</p>
                  {e.reason && <p className="text-muted-foreground">Motivo: {e.reason}</p>}
                  <p className="text-muted-foreground">
                    {e.actor.name || SIDE_LABELS[e.actor.side] || "Sistema"} ·{" "}
                    {formatDateTime(e.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
