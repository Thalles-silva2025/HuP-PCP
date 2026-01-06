
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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

function App() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}

export default App;
