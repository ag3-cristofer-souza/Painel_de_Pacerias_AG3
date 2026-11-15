import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Mail, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { workspaceApi, type PortfolioCompany, type WorkspaceInput } from "@/api/partners";
import { useAuth, usePanel } from "@/features/auth/AuthProvider";
import { formatInt } from "@/lib/format";
import { Button } from "@/ui/button";
import { ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import { PageHeader } from "@/ui/page";

const EMPTY: WorkspaceInput = { name: "", cnpj: "", admin_name: "", admin_email: "" };

function Created({
  company,
  email,
  onAnother,
}: {
  company: PortfolioCompany;
  email: string;
  onAnother: () => void;
}) {
  return (
    <div className="surface max-w-2xl space-y-4 p-6" role="status">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-6 text-success" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Workspace {company.name} criado</h2>
      </div>
      <p className="text-sm">
        Enviamos o convite para <strong>{email}</strong>. A pessoa define a senha pelo link do
        e-mail, que vale por 7 dias, e entra como administradora do cliente. Depois ela convida o
        restante da equipe pelo painel.
      </p>
      <p className="text-sm text-muted-foreground">
        A empresa já nasce com o funil, a caixa de entrada e as permissões padrão. Falta conectar o
        canal de WhatsApp, o que o administrador faz no painel do cliente.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/clientes/${company.id}`}
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Abrir o cliente
        </Link>
        <Button variant="outline" onClick={onAnother}>
          Criar outro
        </Button>
      </div>
    </div>
  );
}

export function NovoWorkspacePage() {
  const panel = usePanel();
  const { retry: refreshPanel } = useAuth();
  const client = useQueryClient();
  const [form, setForm] = useState<WorkspaceInput>(EMPTY);
  const [created, setCreated] = useState<{ company: PortfolioCompany; email: string } | null>(null);

  const partner = panel.partner;
  const max = partner?.max_workspaces;
  const used = partner?.workspaces_used ?? 0;
  const full = max !== undefined && used >= max;

  const mutation = useMutation({
    mutationFn: () => workspaceApi.create(form),
    onSuccess: async (company) => {
      setCreated({ company, email: form.admin_email.trim().toLowerCase() });
      setForm(EMPTY);
      refreshPanel(); // o contador "X de Y do contrato" vem do /partners/me
      await client.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });

  const set = (key: keyof WorkspaceInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const ready = !!(form.name.trim() && form.admin_name.trim() && form.admin_email.trim());

  return (
    <>
      <PageHeader title="Novo workspace">
        Crie a empresa do seu cliente e convide o primeiro administrador dela. Os donos e
        administradores do seu parceiro entram nesse workspace como administradores, sem ocupar vaga
        do plano do cliente.
      </PageHeader>

      {max !== undefined && (
        <p className="mb-4 text-sm text-muted-foreground">
          Clientes no contrato: {formatInt(used)} de {formatInt(max)}.
        </p>
      )}

      {created ? (
        <Created
          company={created.company}
          email={created.email}
          onAnother={() => {
            setCreated(null);
            mutation.reset();
          }}
        />
      ) : full ? (
        <div className="surface max-w-2xl p-6 text-sm">
          O contrato permite {formatInt(max ?? 0)} clientes, e todos já estão em uso. Para criar
          outro, fale com a AG3 para ampliar o limite.
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="surface max-w-2xl space-y-5 p-6"
          aria-label="Novo workspace"
        >
          <fieldset className="space-y-3">
            <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Building2 className="size-4" aria-hidden="true" />A empresa
            </legend>
            <Field
              label="Nome da empresa"
              value={form.name}
              onChange={set("name")}
              maxLength={200}
              required
            />
            <Field
              label="CNPJ (opcional)"
              value={form.cnpj}
              onChange={set("cnpj")}
              maxLength={32}
              inputMode="numeric"
            />
          </fieldset>
          <fieldset className="space-y-3">
            <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <UserRound className="size-4" aria-hidden="true" />O primeiro administrador
            </legend>
            <Field
              label="Nome"
              value={form.admin_name}
              onChange={set("admin_name")}
              maxLength={200}
              autoComplete="off"
              required
            />
            <Field
              label="E-mail"
              type="email"
              value={form.admin_email}
              onChange={set("admin_email")}
              maxLength={254}
              autoComplete="off"
              leading={<Mail />}
              required
            />
            <p className="text-xs text-muted-foreground">
              Precisa ser um e-mail que ainda não tem conta no sistema. Para usar uma conta que já
              existe, fale com a AG3.
            </p>
          </fieldset>
          <ErrorText>{mutation.error?.message}</ErrorText>
          <Button type="submit" loading={mutation.isPending} disabled={!ready}>
            Criar workspace e enviar convite
          </Button>
        </form>
      )}
    </>
  );
}
