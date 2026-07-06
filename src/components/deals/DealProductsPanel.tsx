import React, { useState } from 'react';
import { Package, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  useProductCatalog,
  useDealProducts,
  useAddDealProduct,
  useUpdateDealProduct,
  useRemoveDealProduct,
} from '@/hooks/useDealProducts';

interface DealProductsPanelProps {
  dealId: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export function DealProductsPanel({ dealId }: DealProductsPanelProps) {
  const { data: catalog } = useProductCatalog();
  const { data: dealProducts, isLoading } = useDealProducts(dealId);
  const addMutation = useAddDealProduct();
  const updateMutation = useUpdateDealProduct();
  const removeMutation = useRemoveDealProduct();
  const [selectedPlanoId, setSelectedPlanoId] = useState('');

  const total = (dealProducts || []).reduce(
    (sum, dp) => sum + (dp.valor_aplicado || 0) * (dp.quantidade || 1),
    0
  );

  const availableToAdd = (catalog || []).filter(
    (plano) => !(dealProducts || []).some((dp) => dp.plano_id === plano.id)
  );

  const handleAdd = () => {
    const plano = catalog?.find((p) => p.id === selectedPlanoId);
    if (!plano) return;
    addMutation.mutate({ dealId, plano });
    setSelectedPlanoId('');
  };

  return (
    <div className="space-y-2">
      <Label>Produtos</Label>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando produtos...
        </div>
      ) : (dealProducts?.length ?? 0) > 0 ? (
        <div className="space-y-1.5">
          {dealProducts!.map((dp) => (
            <div
              key={dp.id}
              className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-md px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Package className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="text-sm text-slate-200 truncate">{dp.plano?.nome || 'Produto'}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="number"
                  min={1}
                  value={dp.quantidade}
                  onChange={(e) =>
                    updateMutation.mutate({ id: dp.id, dealId, quantidade: Math.max(1, parseInt(e.target.value) || 1) })
                  }
                  className="w-12 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 text-center"
                />
                <span className="text-xs text-slate-400 w-20 text-right">
                  {formatCurrency(dp.valor_aplicado * dp.quantidade)}
                </span>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate({ id: dp.id, dealId })}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between px-3 pt-1 text-xs">
            <span className="text-slate-500">Total dos produtos</span>
            <span className="text-emerald-400 font-semibold">{formatCurrency(total)}</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 py-1">Nenhum produto vinculado a este negócio.</p>
      )}

      {availableToAdd.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <select
            value={selectedPlanoId}
            onChange={(e) => setSelectedPlanoId(e.target.value)}
            className="flex-1 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-300"
          >
            <option value="">Adicionar produto...</option>
            {availableToAdd.map((plano) => (
              <option key={plano.id} value={plano.id}>
                {plano.nome} — {formatCurrency(plano.preco_mensal)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedPlanoId || addMutation.isPending}
            className="p-1.5 rounded-md bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-40 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs text-slate-400 block">{children}</label>;
}
