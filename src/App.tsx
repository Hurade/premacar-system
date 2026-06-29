import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import Contacts from './components/Contacts';
import Settings from './components/Settings';
import Team from './components/Team';
import Scheduling from './components/Scheduling';
import Kanban from './components/Kanban';
import Broadcasts from './pages/Broadcasts';
import Campanhas from './pages/Campanhas';
import CreateCampaign from './pages/CreateCampaign';
import CampaignDetails from './pages/CampaignDetails';
import Logs from './pages/Logs';
import Followup from './pages/Followup';
import Agentes from './pages/Agentes';
import BroadcastDetails from './pages/BroadcastDetails';
import Auth from './pages/Auth';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGate from './components/RoleGate';
import PropostasDashboard from './pages/propostas/PropostasDashboard';
import Leads from './pages/propostas/Leads';
import NovaPropostaWizard from './pages/propostas/NovaPropostaWizard';
import PropostaDetalhe from './pages/propostas/PropostaDetalhe';
import PropostaPublica from './pages/propostas/PropostaPublica';
import Biblioteca from './pages/propostas/Biblioteca';

import { CompanySettingsProvider } from './hooks/useCompanySettings';
import { AuthProvider } from './hooks/useAuth';
import { UserRoleProvider } from './hooks/useUserRole';
import { Toaster } from 'sonner';
import { OnboardingWizard } from './components/OnboardingWizard';


const queryClient = new QueryClient();

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'PremaCar - Dashboard',
  '/chat': 'PremaCar - Chat',
  '/contacts': 'PremaCar - Contatos',
  '/pipeline': 'PremaCar - Pipeline',
  '/broadcasts': 'PremaCar - Disparos',
  '/broadcasts/:id': 'PremaCar - Detalhe do Disparo',
  '/campanhas': 'PremaCar - Campanhas',
  '/scheduling': 'PremaCar - Agendamentos',
  '/team': 'PremaCar - Equipe',
  '/settings': 'PremaCar - Configurações',
  '/logs': 'PremaCar - Logs',
  '/followup': 'PremaCar - Follow-up',
  '/agentes': 'PremaCar - Agentes de IA',
  '/auth': 'PremaCar - Login',
  '/propostas': 'PremaCar - Propostas',
  '/propostas/leads': 'PremaCar - Leads',
  '/propostas/nova': 'PremaCar - Nova Proposta',
  '/propostas/biblioteca': 'PremaCar - Biblioteca Comercial',
};

const PageTitle: React.FC = () => {
  const location = useLocation();
  useEffect(() => {
    document.title = PAGE_TITLES[location.pathname] ?? 'PremaCar';
  }, [location.pathname]);
  return null;
};

// Componente de Layout que envolve a aplicação principal
const AppLayout: React.FC = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[128px] pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0"></div>
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[128px] pointer-events-none translate-x-1/2 translate-y-1/2 z-0"></div>
      
      <Sidebar />
      
      <main className="flex-1 h-full overflow-hidden relative z-10 flex flex-col pt-14 md:pt-0">
        {/* Top Border Gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50 z-20"></div>
        
        <div className="flex-1 w-full h-full relative">
          <Outlet context={{ showOnboarding, setShowOnboarding }} />
        </div>
      </main>

      <OnboardingWizard 
        isOpen={showOnboarding} 
        onClose={() => setShowOnboarding(false)} 
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserRoleProvider>
          <CompanySettingsProvider>
            <BrowserRouter>
              <PageTitle />
              <Routes>
                {/* Public Routes */}
                <Route path="/auth" element={<Auth />} />
                
                {/* Protected Routes (With Sidebar) */}
                <Route element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/pipeline" element={<Kanban />} />
                  <Route path="/chat" element={<ChatInterface />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/broadcasts" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <Broadcasts />
                    </RoleGate>
                  } />
                  <Route path="/campanhas" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <Campanhas />
                    </RoleGate>
                  } />
                  <Route path="/campanhas/create" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <CreateCampaign />
                    </RoleGate>
                  } />
                  <Route path="/campanhas/:id" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <CampaignDetails />
                    </RoleGate>
                  } />
                  <Route path="/scheduling" element={<Scheduling />} />
                  <Route path="/team" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <Team />
                    </RoleGate>
                  } />
                  <Route path="/settings" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <Settings />
                    </RoleGate>
                  } />
                  <Route path="/logs" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <Logs />
                    </RoleGate>
                  } />
                  <Route path="/followup" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <Followup />
                    </RoleGate>
                  } />
                  <Route path="/broadcasts/:id" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <BroadcastDetails />
                    </RoleGate>
                  } />
                  <Route path="/agentes" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <Agentes />
                    </RoleGate>
                  } />
                  {/* Propostas */}
                  <Route path="/propostas" element={<PropostasDashboard />} />
                  <Route path="/propostas/leads" element={<Leads />} />
                  <Route path="/propostas/nova" element={<NovaPropostaWizard />} />
                  <Route path="/propostas/biblioteca" element={<Biblioteca />} />
                  <Route path="/propostas/:id" element={<PropostaDetalhe />} />
                </Route>

                {/* Proposta pública — sem autenticação */}
                <Route path="/p/:slug" element={<PropostaPublica />} />

                {/* Catch all - redirect to dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
            <Toaster 
              position="top-right"
              richColors
              theme="dark"
            />
          </CompanySettingsProvider>
        </UserRoleProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
