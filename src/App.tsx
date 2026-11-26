import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { AlertasPage } from "@/features/alertas/AlertasPage";
import { ConfigurarAlertasPage } from "@/features/alertas/ConfigurarAlertasPage";
import { AtrasadosPage } from "@/features/atrasados/AtrasadosPage";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { LoginPage } from "@/features/auth/LoginPage";
import { BrandProvider } from "@/features/marca/BrandProvider";
import { MarcaPage } from "@/features/marca/MarcaPage";
import { ArtigosPage } from "@/features/artigos/ArtigosPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { CarteiraPage } from "@/features/carteira/CarteiraPage";
import { ChamadoPage } from "@/features/chamados/ChamadoPage";
import { ChamadosPage } from "@/features/chamados/ChamadosPage";
import { RelatoriosPage } from "@/features/chamados/RelatoriosPage";
import { AuditoriaPage } from "@/features/auditoria/AuditoriaPage";
import { ClientePage } from "@/features/carteira/ClientePage";
import { ContaPage } from "@/features/conta/ContaPage";
import { EquipePage } from "@/features/equipe/EquipePage";
import { MensalidadePage } from "@/features/mensalidade/MensalidadePage";
import { AppShell, RequireNav } from "@/features/shell/AppShell";
import { VisaoAG3Page } from "@/features/visao/VisaoAG3Page";
import { NovoWorkspacePage } from "@/features/workspace/NovoWorkspacePage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Erro do cliente não melhora repetindo; falha de rede e 5xx podem.
      retry: (count, error) =>
        count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route element={<RequireNav />}>
            <Route index element={<CarteiraPage />} />
            <Route path="/clientes/:id" element={<ClientePage />} />
            <Route path="/visao-ag3" element={<VisaoAG3Page />} />
            <Route path="/chamados" element={<ChamadosPage />} />
            <Route path="/chamados/:id" element={<ChamadoPage />} />
            <Route path="/relatorios-sla" element={<RelatoriosPage />} />
            <Route path="/alertas" element={<AlertasPage />} />
            <Route path="/alertas/configurar" element={<ConfigurarAlertasPage />} />
            <Route path="/atrasados" element={<AtrasadosPage />} />
            <Route path="/mensalidade/:id" element={<MensalidadePage />} />
            <Route path="/novo-workspace" element={<NovoWorkspacePage />} />
            <Route path="/equipe" element={<EquipePage />} />
            <Route path="/marca" element={<MarcaPage />} />
            <Route path="/auditoria" element={<AuditoriaPage />} />
            <Route path="/artigos" element={<ArtigosPage />} />
            <Route path="/conta" element={<ContaPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <BrandProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrandProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
