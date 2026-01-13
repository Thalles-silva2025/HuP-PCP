
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProfilePage } from './pages/ProfilePage';
import { PlansPage } from './pages/PlansPage';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ProductionOrderList } from './components/ProductionOrderList';
import { ProductionWizard } from './components/ProductionWizard';
import { MaterialConsolidation } from './components/MaterialConsolidation';
import { CuttingModule } from './components/CuttingModule';
import { SubcontractorModule } from './components/SubcontractorModule';
import { InventoryModule } from './components/InventoryModule';
import { TechPackModule } from './components/TechPackModule';
import { SettingsModule } from './components/SettingsModule';
import { ReportsModule } from './components/ReportsModule';
import { RevisionModule } from './components/RevisionModule';
import { PackingModule } from './components/PackingModule';
import { PaymentsModule } from './components/PaymentsModule';
import { ProductionGoalModule } from './components/ProductionGoalModule';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Configuração do Cache:
// staleTime: 2 minutos (dados considerados frescos, não busca de novo)
// gcTime: 10 minutos (tempo que ficam na memória se não usados)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, 
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false, // Evita recarregar ao trocar de aba do navegador
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Routes>
              {/* Rota Pública - Login */}
              <Route path="/login" element={<LoginPage />} />

              {/* Rota Protegida Especial - Onboarding */}
              <Route path="/onboarding" element={
                 <ProtectedRoute>
                     <OnboardingPage />
                 </ProtectedRoute>
              } />

              {/* Rotas Protegidas - App Principal */}
              <Route path="/*" element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/profile" element={<ProfilePage />} />
                      <Route path="/plans" element={<PlansPage />} />
                      
                      <Route path="/ops" element={<ProductionOrderList />} />
                      <Route path="/ops/new" element={<ProductionWizard />} />
                      <Route path="/consolidation" element={<MaterialConsolidation />} />
                      
                      {/* Modulos */}
                      <Route path="/goals" element={<ProductionGoalModule />} />
                      <Route path="/cutting" element={<CuttingModule />} />
                      <Route path="/subcontractors" element={<SubcontractorModule />} />
                      <Route path="/revision" element={<RevisionModule />} />
                      <Route path="/packing" element={<PackingModule />} />
                      <Route path="/payments" element={<PaymentsModule />} />
                      
                      <Route path="/inventory" element={<InventoryModule />} />
                      <Route path="/tech-packs" element={<TechPackModule />} />
                      <Route path="/settings" element={<SettingsModule />} />
                      <Route path="/reports" element={<ReportsModule />} />
                      
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              } />
            </Routes>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
