import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "@/App";
import type { Panel } from "@/api/partners";
import { AuthProvider } from "@/features/auth/AuthProvider";

/** O app inteiro numa rota, com a API simulada pelo teste (vi.mock). */
export function renderApp(path = "/") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export const partnerPanel = (overrides: Partial<Panel> = {}): Panel => ({
  kind: "partner",
  user: { id: "u1", email: "dono@parceiro.com", full_name: "Dona Parceira" },
  partner: {
    id: "p1",
    name: "Parceiro Alfa",
    status: "active",
    max_workspaces: 10,
    workspaces_used: 3,
  },
  member_role: "owner",
  can_admin_workspaces: true,
  ...overrides,
});

export const staffPanel = (): Panel => ({
  kind: "ag3",
  user: { id: "u9", email: "suporte@ag3system.com", full_name: "Suporte AG3" },
  support_level: "n2",
  can_admin_workspaces: false,
});
