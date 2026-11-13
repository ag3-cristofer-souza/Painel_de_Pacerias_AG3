import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ApiError } from "@/api/client";
import { AtrasadosPage } from "@/features/atrasados/AtrasadosPage";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { LoginPage } from "@/features/auth/LoginPage";
import { RequireAuth } from "@/features/auth/RequireAuth";
import { CarteiraPage } from "@/features/carteira/CarteiraPage";
import { ContaPage } from "@/features/conta/ContaPage";
import { EquipePage } from "@/features/equipe/EquipePage";
import { AppShell, RequireNav } from "@/features/shell/AppShell";
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
            <Route path="/atrasados" element={<AtrasadosPage />} />
            <Route path="/novo-workspace" element={<NovoWorkspacePage />} />
            <Route path="/equipe" element={<EquipePage />} />
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
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
