import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { teamApi, type Member, type MemberRole } from "@/api/partners";
import { usePanel } from "@/features/auth/AuthProvider";
import { ResendInvite } from "@/features/convite/ResendInvite";
import { formatDate } from "@/lib/format";
import { MEMBER_ROLE_HELP, MEMBER_ROLE_LABELS, MEMBER_ROLES, isOwner } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import { PageHeader } from "@/ui/page";

const TEAM_KEY = ["team"];

function RolePicker({ value, onChange }: { value: MemberRole; onChange: (r: MemberRole) => void }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="mb-1.5 text-sm font-medium">Papel</legend>
      {MEMBER_ROLES.map((role) => (
        <label
          key={role}
          className={cn(
            "flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 text-sm",
            value === role && "border-primary bg-secondary/60"
          )}
        >
          <input
            type="radio"
            name="role"
            value={role}
            checked={value === role}
            onChange={() => onChange(role)}
            className="sr-only"
          />
          <span className="font-medium">{MEMBER_ROLE_LABELS[role]}</span>
          <span className="text-muted-foreground">{MEMBER_ROLE_HELP[role]}</span>
        </label>
      ))}
    </fieldset>
  );
}

function InviteForm({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("support");
  const mutation = useMutation({
    mutationFn: () => teamApi.invite({ full_name: name, email, role }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: TEAM_KEY });
      onClose();
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };
  return (
    <form onSubmit={submit} className="surface space-y-4 p-5" aria-label="Convidar pessoa">
      <h2 className="font-semibold">Convidar pessoa</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leading={<Mail />}
          required
        />
      </div>
      <RolePicker value={role} onChange={setRole} />
      <p className="text-xs text-muted-foreground">
        A pessoa recebe um e-mail para definir a senha e entra no painel com código de acesso por
        e-mail. Só dá para convidar e-mail que ainda não tem conta no sistema.
      </p>
      <ErrorText>{mutation.error?.message}</ErrorText>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={mutation.isPending} disabled={!name.trim() || !email.trim()}>
          Enviar convite
        </Button>
        <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function MemberRow({
  member,
  canEdit,
  isSelf,
}: {
  member: Member;
  canEdit: boolean;
  isSelf: boolean;
}) {
  const client = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const done = () => client.invalidateQueries({ queryKey: TEAM_KEY });
  const update = useMutation({
    mutationFn: (change: { role?: MemberRole; is_active?: boolean }) =>
      teamApi.update(member.id, change),
    onSuccess: done,
  });
  const remove = useMutation({ mutationFn: () => teamApi.remove(member.id), onSuccess: done });
  const busy = update.isPending || remove.isPending;
  const error = update.error ?? remove.error;

  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {member.full_name}
            {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
            {!member.is_active && <Badge>Desativado</Badge>}
            {member.is_active && member.pending_invite && (
              <Badge tone="warning">Ainda não entrou</Badge>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {member.email} · desde {formatDate(member.created_at)}
          </p>
        </div>
        {canEdit && !isSelf ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`role-${member.id}`}>
              Papel de {member.full_name}
            </label>
            <select
              id={`role-${member.id}`}
              value={member.role}
              disabled={busy}
              onChange={(e) => update.mutate({ role: e.target.value as MemberRole })}
              className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
            >
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {MEMBER_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => update.mutate({ is_active: !member.is_active })}
            >
              {member.is_active ? "Desativar" : "Reativar"}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirmRemove(true)}>
              Tirar da equipe
            </Button>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {MEMBER_ROLE_LABELS[member.role] ?? member.role}
          </span>
        )}
      </div>
      {canEdit && !isSelf && member.is_active && member.pending_invite && (
        <ResendInvite email={member.email} send={() => teamApi.resendInvite(member.id)} />
      )}
      {confirmRemove && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p>
            {member.full_name} perde na hora o acesso ao painel e a todos os clientes. A conta não é
            apagada: dá para convidar de novo pela AG3.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="destructive"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Confirmar
            </Button>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      <ErrorText>{error?.message}</ErrorText>
    </li>
  );
}

export function EquipePage() {
  const panel = usePanel();
  const owner = isOwner(panel);
  const [inviting, setInviting] = useState(false);
  const query = useQuery({ queryKey: TEAM_KEY, queryFn: teamApi.list });

  return (
    <>
      <PageHeader title="Equipe">
        As pessoas de {panel.partner?.name ?? "seu parceiro"} que usam este painel. Donos e
        administradores entram nos seus clientes como administradores; quem sai da equipe perde o
        acesso na hora.
      </PageHeader>

      <div className="space-y-4">
        {owner &&
          (inviting ? (
            <InviteForm onClose={() => setInviting(false)} />
          ) : (
            <Button onClick={() => setInviting(true)}>
              <UserPlus aria-hidden="true" />
              Convidar pessoa
            </Button>
          ))}

        <section className="surface p-5">
          {query.isPending ? (
            <div className="flex justify-center p-6" role="status">
              <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
              <span className="sr-only">Carregando equipe</span>
            </div>
          ) : query.isError ? (
            <ErrorText>{query.error.message}</ErrorText>
          ) : (
            <ul className="divide-y">
              {query.data.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  canEdit={owner}
                  isSelf={m.user_id === panel.user.id}
                />
              ))}
            </ul>
          )}
          {!owner && (
            <p className="mt-3 text-xs text-muted-foreground">
              Só o dono do parceiro convida, muda papéis e tira pessoas da equipe.
            </p>
          )}
        </section>

        <details className="surface p-5 text-sm">
          <summary className="cursor-pointer font-medium">O que cada papel pode fazer</summary>
          <dl className="mt-3 space-y-2">
            {MEMBER_ROLES.map((r) => (
              <div key={r}>
                <dt className="font-medium">{MEMBER_ROLE_LABELS[r]}</dt>
                <dd className="text-muted-foreground">{MEMBER_ROLE_HELP[r]}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </>
  );
}
