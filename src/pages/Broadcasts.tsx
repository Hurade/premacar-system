import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, PlusCircle, FileText, History, Zap, MessageSquare, CheckCircle, AlertTriangle, Layers } from 'lucide-react';
import { BroadcastCampaignsList } from '@/components/broadcasts/CampaignsList';
import { BroadcastNewCampaign } from '@/components/broadcasts/NewCampaign';
import { BroadcastTemplates } from '@/components/broadcasts/Templates';
import { BroadcastHistory } from '@/components/broadcasts/History';
import { MetaTemplatesManager } from '@/components/broadcasts/MetaTemplates';
import { useCampaignStats } from '@/hooks/useCampaigns';
import { DispatchConversations } from '@/components/broadcasts/DispatchConversations';

const Broadcasts: React.FC = () => {
  const [activeTab, setActiveTab] = useState('campaigns');
  const { data: stats } = useCampaignStats();

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="p-6 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Send className="w-6 h-6 text-primary" />
              Disparos Automáticos
            </h1>
            <p className="text-muted-foreground mt-1">
              Envie mensagens em massa de forma inteligente e segura
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-xs font-medium">Campanhas Ativas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.activeCampaigns ?? 0}</p>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Send className="w-4 h-4" />
              <span className="text-xs font-medium">Enviadas Hoje</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.sentToday ?? 0}</p>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Taxa de Entrega</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.deliveryRate ?? 0}%</p>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-medium">Taxa de Resposta</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.replyRate ?? 0}%</p>
          </div>
          <div className="bg-card/50 border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">Campanhas c/ Erro</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats?.campaignsWithErrors ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 pt-4 border-b border-border/50 flex-shrink-0">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="campaigns" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Campanhas
              </TabsTrigger>
              <TabsTrigger value="new" className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Nova Campanha
              </TabsTrigger>
              <TabsTrigger value="meta-templates" className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Templates Meta
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Modelos Evolution
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="dispatch-conversations" className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Conversas
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto">
            <TabsContent value="campaigns" className="h-full m-0 p-6">
              <BroadcastCampaignsList onNewCampaign={() => setActiveTab('new')} />
            </TabsContent>
            <TabsContent value="new" className="h-full m-0 p-6">
              <BroadcastNewCampaign onSuccess={() => setActiveTab('campaigns')} />
            </TabsContent>
            <TabsContent value="meta-templates" className="h-full m-0 p-6">
              <MetaTemplatesManager />
            </TabsContent>
            <TabsContent value="templates" className="h-full m-0 p-6">
              <BroadcastTemplates />
            </TabsContent>
            <TabsContent value="history" className="h-full m-0 p-6">
              <BroadcastHistory />
            </TabsContent>
            <TabsContent value="dispatch-conversations" className="h-full m-0 p-6">
              <DispatchConversations />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Broadcasts;
