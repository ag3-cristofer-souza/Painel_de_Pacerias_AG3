import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Building2, ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { partnersApi, type PortfolioCompany } from "@/api/partners";
import { usePanel } from "@/features/auth/AuthProvider";
import { formatCost, formatInt } from "@/lib/format";
import { planStatus } from "@/lib/labels";
import { useDebounced } from "@/lib/useDebounced";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { EmptyState, ErrorText } from "@/ui/feedback";
import { Field } from "@/ui/field";
import { PageHeader } from "@/ui/page";

const PAGE_SIZE = 50;

const clientPath = (id: string) => `/clientes/${id}`;

function usersText(c: PortfolioCompany) {
  const limit = c.plan.users_limit;
  return limit
    ? `${formatInt(c.usage.users_active)} de ${formatInt(limit)}`
    : formatInt(c.usage.users_active);
}

function channelsText(c: PortfolioCompany) {
  const total = c.usage.channels + c.usage.meta_channels;
  return c.usage.meta_channels
    ? `${formatInt(total)} (${formatInt(c.usage.meta_channels)} Meta)`
    : formatInt(total);
}

function StatusCell({ status }: { status?: string }) {
  const s = planStatus(status);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/** Computador: tabela. Celular: um cartão por cliente. Os dois levam à tela do cliente. */
function CompanyList({ companies }: { companies: PortfolioCompany[] }) {
  return (
    <>
      <div className="surface hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 text-right font-medium">Usuários</th>
              <th className="px-4 py-3 text-right font-medium">Canais</th>
              <th className="px-4 py-3 text-right font-medium">Conversas no mês</th>
              <th className="px-4 py-3 text-right font-medium">IA e voz no mês</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Link to={clientPath(c.id)} className="font-medium text-primary hover:underline">
                    {c.name}
                  </Link>
                  {c.plan.name && (
                    <span className="block text-xs text-muted-foreground">{c.plan.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusCell status={c.plan.status} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{usersText(c)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{channelsText(c)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatInt(c.usage.conversations)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatCost(c.usage.usage_cost)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {companies.map((c) => (
          <li key={c.id}>
            <Link to={clientPath(c.id)} className="surface block p-4 active:bg-muted">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{c.name}</span>
                <StatusCell status={c.plan.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Usuários</dt>
                <dd className="text-right tabular-nums">{usersText(c)}</dd>
                <dt className="text-muted-foreground">Canais</dt>
                <dd className="text-right tabular-nums">{channelsText(c)}</dd>
                <dt className="text-muted-foreground">Conversas no mês</dt>
                <dd className="text-right tabular-nums">{formatInt(c.usage.conversations)}</dd>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function CarteiraPage() {
  const panel = usePanel();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const term = useDebounced(search.trim());

  const query = useQuery({
    queryKey: ["portfolio", term, page],
    queryFn: () =>
      partnersApi.portfolio({ search: term, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const count = query.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const partner = panel.partner;

  return (
    <>
      <PageHeader title="Carteira">
        {panel.kind === "ag3"
          ? "Clientes diretos da AG3, sem parceiro. Os clientes dos parceiros ficam na carteira de cada parceiro; os atrasados de todos aparecem em Mensalidades em atraso."
          : "Os seus clientes, com o uso deste mês. Abra um cliente para ver o histórico, os usuários e a situação."}
      </PageHeader>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <Field
            label="Buscar cliente"
            type="search"
            placeholder="Nome ou CNPJ"
            leading={<Search />}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
          {query.isFetching && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {query.data &&
            `${formatInt(count)} ${count === 1 ? "cliente" : "clientes"}${
              !term && partner?.max_workspaces !== undefined
                ? ` de ${formatInt(partner.max_workspaces)} do contrato`
                : ""
            }`}
        </p>
      </div>

      {query.isError && <ErrorText className="mb-4">{query.error.message}</ErrorText>}

      {query.isPending ? (
        <div className="surface flex justify-center p-10" role="status">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <span className="sr-only">Carregando clientes</span>
        </div>
      ) : query.data && query.data.data.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon={Building2}
            title={term ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
          >
            {term
              ? "Confira o nome ou o CNPJ digitado."
              : panel.can_admin_workspaces
                ? "Crie o primeiro em Novo workspace."
                : "Quando houver clientes nesta carteira, eles aparecem aqui."}
          </EmptyState>
        </div>
      ) : (
        query.data && <CompanyList companies={query.data.data} />
      )}

      {pages > 1 && (
        <nav aria-label="Páginas" className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            aria-label="Página anterior"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {page + 1} de {pages}
          </span>
          <Button
            variant="outline"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="Próxima página"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      )}
    </>
  );
}
