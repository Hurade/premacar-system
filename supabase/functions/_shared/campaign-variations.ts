// Compartilhado entre campaign-processor (Disparos) e
// recurring-campaign-processor (Campanhas) — seleção ponderada de
// variação A/B, com vencedor fixo tendo prioridade sobre o peso.

export interface CampaignVariationLike {
  id: string;
  label: string;
  weight: number;
  is_winner: boolean;
  is_active: boolean;
  total_sent: number;
}

export function selectVariation<T extends CampaignVariationLike>(
  variations: T[]
): { variation: T; index: number } {
  const winner = variations.find((v) => v.is_winner && v.is_active);
  if (winner) {
    return { variation: winner, index: variations.indexOf(winner) };
  }
  const active = variations.filter((v) => v.is_active);
  if (active.length === 0) return { variation: variations[0], index: 0 };
  const totalWeight = active.reduce((s, v) => s + v.weight, 0);
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  for (const v of active) {
    cumulative += v.weight;
    if (rand <= cumulative) {
      return { variation: v, index: variations.indexOf(v) };
    }
  }
  return { variation: active[0], index: variations.indexOf(active[0]) };
}
