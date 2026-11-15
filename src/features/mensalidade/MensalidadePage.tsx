import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { billingApi } from "@/api/billing";
import { PageHeader } from "@/ui/page";
import { BillingPanel } from "./BillingPanel";

/** A mensalidade de um cliente, aberta pela lista de atrasados. Serve também para a equipe AG3 nos clientes dos
 *  parceiros, que não estão na carteira dela (a tela do cliente fica com o parceiro). */
export function MensalidadePage() {
  const { id = "" } = useParams();
  // Mesma chave do BillingPanel: o pedido é um só.
  const { data } = useQuery({ queryKey: ["billing", id], queryFn: () => billingApi.get(id) });
  return (
    <>
      <Link
        to="/atrasados"
        className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Mensalidades em atraso
      </Link>
      <PageHeader title={data?.company.name ?? "Mensalidade"}>
        {data
          ? data.partner
            ? `Cliente do parceiro ${data.partner.name}.`
            : "Mensalidade do cliente."
          : undefined}
      </PageHeader>
      <section className="surface p-5">
        <BillingPanel companyId={id} />
      </section>
    </>
  );
}
