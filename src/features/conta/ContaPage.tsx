import { LogOut } from "lucide-react";
import { useAuth, usePanel } from "@/features/auth/AuthProvider";
import { panelOwnerName, panelRoleLabel } from "@/lib/roles";
import { Button } from "@/ui/button";
import { PageHeader } from "@/ui/page";

export function ContaPage() {
  const panel = usePanel();
  const { signOut } = useAuth();
  const partner = panel.partner;
  return (
    <>
      <PageHeader title="Minha conta" />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="surface space-y-1 p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Você</h2>
          <p className="font-medium">{panel.user.full_name}</p>
          <p className="text-sm text-muted-foreground">{panel.user.email}</p>
        </section>
        <section className="surface space-y-1 p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Em nome de</h2>
          <p className="font-medium">{panelOwnerName(panel)}</p>
          <p className="text-sm text-muted-foreground">{panelRoleLabel(panel)}</p>
          {partner && (
            <p className="text-sm text-muted-foreground">
              Clientes: {partner.workspaces_used}
              {partner.max_workspaces !== undefined && ` de ${partner.max_workspaces} do contrato`}
            </p>
          )}
        </section>
      </div>
      <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
        Sair encerra só esta sessão. O painel e o app do celular continuam conectados. Para trocar a
        senha, use &ldquo;Esqueci a senha&rdquo; na tela de entrada.
      </p>
      <Button variant="outline" className="mt-4" onClick={signOut}>
        <LogOut aria-hidden="true" />
        Sair
      </Button>
    </>
  );
}
