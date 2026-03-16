import React, { useState } from 'react';
import { Plus, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CampaignMetrics } from '@/components/campaigns/CampaignMetrics';
import { CampaignFilters } from '@/components/campaigns/CampaignFilters';
import { CampaignCard } from '@/components/campaigns/CampaignCard';
import { useRecurringCampaigns } from '@/hooks/useRecurringCampaigns';

const CampanhasPage: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const { campaigns, loading, toggleStatus, deleteCampaign } = useRecurringCampaigns({ filter, search });

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Campanhas Recorrentes</h1>
        </div>
        <Button className="gap-2" onClick={() => navigate('/campanhas/create')}>
          <Plus className="w-4 h-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Metrics */}
      <CampaignMetrics />

      {/* Filters */}
      <CampaignFilters filter={filter} onFilterChange={setFilter} search={search} onSearchChange={setSearch} />

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card/50 border border-border/50 rounded-xl p-5 h-40 animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhuma campanha encontrada</p>
            <p className="text-sm mt-1">Crie sua primeira campanha recorrente para começar</p>
          </div>
        ) : (
          campaigns.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onToggleStatus={toggleStatus}
              onDelete={deleteCampaign}
              onRefresh={refetch}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CampanhasPage;
