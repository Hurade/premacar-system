import React, { useRef, useState } from 'react';
import { Shield, Bot, Loader2, Save, RotateCcw, BookOpen, Lock, Cable, Smartphone, MessageSquare, Zap, Database, ListPlus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import AgentSettings, { AgentSettingsRef } from './settings/AgentSettings';
import ApiSettings, { ApiSettingsRef } from './settings/ApiSettings';
import SystemRoadmap from './SystemRoadmap';
import IntegrationSettings from './integrations/IntegrationSettings';
import { ConnectionsManager } from './connections/ConnectionsManager';
import { MetaTemplatesManager } from './broadcasts/MetaTemplates';
import QuickRepliesSettings from './settings/QuickRepliesSettings';
import KnowledgeBaseSettings from './settings/KnowledgeBaseSettings';
import CustomFieldsSettings from './settings/CustomFieldsSettings';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { Button } from './Button';
import { useOnboardingStatus } from '@/hooks/useOnboardingStatus';
import { useOutletContext, useSearchParams } from 'react-router-dom';

interface OutletContext {
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
}

const Settings: React.FC = () => {
  const { companyName, isAdmin } = useCompanySettings();
  const agentRef = useRef<AgentSettingsRef>(null);
  const apiRef = useRef<ApiSettingsRef>(null);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'agent');
  const { resetWizard } = useOnboardingStatus();
  const { setShowOnboarding } = useOutletContext<OutletContext>();

  const handleReopenOnboarding = () => {
    resetWizard();
    setShowOnboarding(true);
  };

  const handleSave = async () => {
    if (activeTab === 'agent') {
      await agentRef.current?.save();
    } else if (activeTab === 'connections') {
      await apiRef.current?.save();
    }
  };

  const handleCancel = () => {
    if (activeTab === 'agent') {
      agentRef.current?.cancel();
    } else if (activeTab === 'connections') {
      apiRef.current?.cancel();
    }
  };

  const isSaving = activeTab === 'agent'
    ? agentRef.current?.isSaving
    : activeTab === 'connections'
    ? apiRef.current?.isSaving
    : false;

  // Tabs where the global Save/Cancel buttons are shown
  const hasSaveButton = activeTab === 'agent' || activeTab === 'connections';

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto bg-slate-950 text-slate-50 custom-scrollbar">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Configurações</h2>
          <p className="text-sm text-slate-400 mt-1">
            Central de controle da sua instância {companyName}.
            {!isAdmin && (
              <span className="ml-2 text-amber-400">(Somente leitura)</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReopenOnboarding}
              className="text-slate-400 hover:text-white gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Refazer Onboarding
            </Button>
          )}
          <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs rounded-full font-mono flex items-center">
            {isAdmin ? (
              <>
                <Shield className="w-3 h-3 mr-1" /> Admin
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 mr-1" /> Somente Leitura
              </>
            )}
          </span>
        </div>
      </div>

      <Tabs defaultValue="agent" className="w-full" onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center justify-between mb-8 gap-3">
          <div className="overflow-x-auto pb-1 -mb-1 max-w-full">
            <TabsList>
              <TabsTrigger value="agent" className="gap-2">
                <Bot className="w-4 h-4" />
                Agente
              </TabsTrigger>
              <TabsTrigger value="connections" className="gap-2">
                <Smartphone className="w-4 h-4" />
                Conexões
              </TabsTrigger>
              <TabsTrigger value="integrations" className="gap-2">
                <Cable className="w-4 h-4" />
                Integrações
              </TabsTrigger>
              <TabsTrigger value="templates" className="gap-2">
                <MessageSquare className="w-4 h-4" />
                Templates
              </TabsTrigger>
              <TabsTrigger value="quick-replies" className="gap-2">
                <Zap className="w-4 h-4" />
                Resp. Rápidas
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-2">
                <Database className="w-4 h-4" />
                Base de Conhecimento
              </TabsTrigger>
              <TabsTrigger value="custom-fields" className="gap-2">
                <ListPlus className="w-4 h-4" />
                Campos Personalizados
              </TabsTrigger>
              <TabsTrigger value="docs" className="gap-2">
                <BookOpen className="w-4 h-4" />
                Documentação
              </TabsTrigger>
            </TabsList>
          </div>

          {hasSaveButton && isAdmin && (
            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          )}

          {hasSaveButton && !isAdmin && (
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <Lock className="w-4 h-4" />
              Apenas administradores podem editar
            </div>
          )}
        </div>

        <TabsContent value="agent">
          <AgentSettings ref={agentRef} />
        </TabsContent>

        <TabsContent value="connections">
          <div className="space-y-10">
            {/* API Credentials — Evolution + Meta */}
            <ApiSettings ref={apiRef} />

            {/* Divider */}
            <div className="border-t border-slate-800" />

            {/* Connected numbers managed individually */}
            <ConnectionsManager />
          </div>
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationSettings />
        </TabsContent>

        <TabsContent value="templates">
          <MetaTemplatesManager />
        </TabsContent>
        <TabsContent value="quick-replies">
          <QuickRepliesSettings />
        </TabsContent>
        <TabsContent value="knowledge">
          <KnowledgeBaseSettings />
        </TabsContent>
        <TabsContent value="custom-fields">
          <CustomFieldsSettings />
        </TabsContent>
        <TabsContent value="docs">
          <SystemRoadmap />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
