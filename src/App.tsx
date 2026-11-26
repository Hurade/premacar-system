import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGate from './components/RoleGate';

import { CompanySettingsProvider } from './hooks/useCompanySettings';
import { NotificationSettingsProvider } from './hooks/useNotificationSettings';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { UserRoleProvider } from './hooks/useUserRole';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { Toaster } from 'sonner';
import { useOnlinePresence } from './hooks/useOnlinePresence';
import NotificationBell from './components/NotificationBell';

const Dashboard = lazy(() => import('./components/Dashboard'));
const ChatInterface = lazy(() => import('./components/ChatInterface'));
const Contacts = lazy(() => import('./components/Contacts'));
const Settings = lazy(() => import('./components/Settings'));
const Team = lazy(() => import('./components/Team'));
const Scheduling = lazy(() => import('./components/Scheduling'));
const Kanban = lazy(() => import('./components/Kanban'));
const Campanhas = lazy(() => import('./pages/Campanhas'));
const CreateCampaign = lazy(() => import('./pages/CreateCampaign'));
const CampaignDetails = lazy(() => import('./pages/CampaignDetails'));
const Followup = lazy(() => import('./pages/Followup'));
const Automacoes = lazy(() => import('./pages/Automacoes'));
const Auth = lazy(() => import('./pages/Auth'));
const OAuthConsent = lazy(() => import('./pages/OAuthConsent'));
const PropostasDashboard = lazy(() => import('./pages/propostas/PropostasDashboard'));
const Leads = lazy(() => import('./pages/propostas/Leads'));
const NovaPropostaWizard = lazy(() => import('./pages/propostas/NovaPropostaWizard'));
const PropostaDetalhe = lazy(() => import('./pages/propostas/PropostaDetalhe'));
const PropostaPreview = lazy(() => import('./pages/propostas/PropostaPreview'));
const PropostaPublica = lazy(() => import('./pages/propostas/PropostaPublica'));
const Biblioteca = lazy(() => import('./pages/propostas/Biblioteca'));
const Wiki = lazy(() => import('./pages/wiki/Wiki'));
const ArtigoDetalhe = lazy(() => import('./pages/wiki/ArtigoDetalhe'));
const ApresentacoesDashboard = lazy(() => import('./pages/apresentacoes/ApresentacoesDashboard'));
const NovaApresentacaoWizard = lazy(() => import('./pages/apresentacoes/NovaApresentacaoWizard'));
const ApresentacaoDetalhe = lazy(() => import('./pages/apresentacoes/ApresentacaoDetalhe'));
const ApresentacaoPreview = lazy(() => import('./pages/apresentacoes/ApresentacaoPreview'));
const ApresentacaoPublica = lazy(() => import('./pages/apresentacoes/ApresentacaoPublica'));
const DuplicateContacts = lazy(() => import('./pages/DuplicateContacts'));
const CsatPublic = lazy(() => import('./pages/CsatPublic'));
const OnboardingWizard = lazy(() =>
  import('./components/OnboardingWizard').then(module => ({ default: module.OnboardingWizard }))
);

// Sem UI própria — só mantém a sessão do usuário logado marcada como "online"
// via Presence API do Supabase Realtime enquanto o app estiver aberto.
const PresenceTracker: React.FC = () => {
  const { user } = useAuth();
  useOnlinePresence(user);
  return null;
};


const queryClient = new QueryClient();

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'PremaCar - Dashboard',
  '/chat': 'PremaCar - Chat',
  '/contacts': 'PremaCar - Contatos',
  '/pipeline': 'PremaCar - Pipeline',
  '/campanhas': 'PremaCar - Campanhas',
  '/scheduling': 'PremaCar - Agendamentos',
  '/team': 'PremaCar - Equipe',
  '/settings': 'PremaCar - Configurações',
  '/followup': 'PremaCar - Follow-up',
  '/automacoes': 'PremaCar - Automações',
  '/auth': 'PremaCar - Login',
  '/propostas': 'PremaCar - Propostas',
  '/propostas/leads': 'PremaCar - Leads',
  '/propostas/nova': 'PremaCar - Nova Proposta',
  '/propostas/biblioteca': 'PremaCar - Biblioteca Comercial',
  '/apresentacoes': 'PremaCar - Apresentações',
  '/apresentacoes/nova': 'PremaCar - Nova Apresentação',
  '/contatos-duplicados': 'PremaCar - Contatos Duplicados',
  '/wiki': 'PremaCar - Wiki',
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
      <PresenceTracker />
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[128px] pointer-events-none -translate-x-1/2 -translate-y-1/2 z-0"></div>
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[128px] pointer-events-none translate-x-1/2 translate-y-1/2 z-0"></div>
      
      <Sidebar />
      
      <main className="flex-1 h-full overflow-hidden relative z-10 flex flex-col pt-14 md:pt-0">
        {/* Top Border Gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50 z-20"></div>

        {/* Desktop top bar — notificações */}
        <div className="hidden md:flex h-14 items-center justify-end px-6 border-b border-border/50 shrink-0 relative z-20">
          <NotificationBell />
        </div>

        <div className="flex-1 min-h-0 w-full h-full relative">
          <Outlet context={{ showOnboarding, setShowOnboarding }} />
        </div>
      </main>

      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingWizard isOpen onClose={() => setShowOnboarding(false)} />
        </Suspense>
      )}
    </div>
  );
};

const ThemedToaster: React.FC = () => {
  const { theme } = useTheme();
  return <Toaster position="top-right" richColors theme={theme} />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserRoleProvider>
          <CompanySettingsProvider>
          <NotificationSettingsProvider>
            <BrowserRouter>
              <PageTitle />
              <Suspense fallback={
                <div className="flex h-screen items-center justify-center bg-background text-foreground">
                  Carregando...
                </div>
              }>
              <Routes>
                {/* Public Routes */}
                <Route path="/auth" element={<Auth />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                
                
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
                  <Route path="/followup" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <Followup />
                    </RoleGate>
                  } />
                  <Route path="/automacoes" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <Automacoes />
                    </RoleGate>
                  } />
                  <Route path="/contatos-duplicados" element={
                    <RoleGate allowedRoles={['admin', 'manager']}>
                      <DuplicateContacts />
                    </RoleGate>
                  } />
                  {/* Propostas */}
                  <Route path="/propostas" element={<PropostasDashboard />} />
                  <Route path="/propostas/leads" element={<Leads />} />
                  <Route path="/propostas/nova" element={<NovaPropostaWizard />} />
                  <Route path="/propostas/biblioteca" element={<Biblioteca />} />
                  <Route path="/propostas/:id" element={<PropostaDetalhe />} />
                  <Route path="/propostas/:id/preview" element={<PropostaPreview />} />
                  {/* Apresentações */}
                  <Route path="/apresentacoes" element={<ApresentacoesDashboard />} />
                  <Route path="/apresentacoes/nova" element={<NovaApresentacaoWizard />} />
                  <Route path="/apresentacoes/:id" element={<ApresentacaoDetalhe />} />
                  <Route path="/apresentacoes/:id/preview" element={<ApresentacaoPreview />} />
                  <Route path="/wiki" element={<Wiki />} />
                  <Route path="/wiki/artigo/:id" element={<ArtigoDetalhe />} />
                </Route>

                {/* Páginas públicas (abertas por clientes fora do app) — design
                    sempre escuro, independente da preferência de tema do
                    atendente que gerou o link nesse mesmo navegador. */}
                <Route path="/p/:slug" element={<div className="dark"><PropostaPublica /></div>} />
                <Route path="/apresentacao/:slug" element={<div className="dark"><ApresentacaoPublica /></div>} />
                <Route path="/csat/:token" element={<div className="dark"><CsatPublic /></div>} />

                {/* Catch all - redirect to dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
            <ThemedToaster />
          </NotificationSettingsProvider>
          </CompanySettingsProvider>
        </UserRoleProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
