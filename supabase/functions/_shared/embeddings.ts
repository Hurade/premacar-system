// Módulo compartilhado de geração de embeddings (base de conhecimento RAG).
//
// Dimensão confirmada via edge function de diagnóstico
// (check-embedding-dimension) contra o ambiente real do projeto: o modelo
// "google/gemini-embedding-001" no Lovable AI Gateway retorna vetores de
// 3072 dimensões. Isso excede o limite de indexação do pgvector (ivfflat/hnsw
// suportam até 2000 dimensões) — por isso a migration cria a coluna
// `vector(3072)` SEM índice vetorial (busca por similaridade funciona igual,
// só faz sequential scan; aceitável para o volume esperado de uma base de
// conhecimento interna). Se o corpus crescer muito e a busca ficar lenta,
// a opção futura é usar `output_dimensionality` (se o gateway suportar) para
// gerar vetores menores, ou reindexar com dimensionalidade reduzida.

export const EMBEDDING_MODEL = 'google/gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 3072;

const LOVABLE_EMBEDDINGS_URL = 'https://ai.gateway.lovable.dev/v1/embeddings';

export async function generateEmbedding(text: string, lovableApiKey: string): Promise<number[] | null> {
  const results = await generateEmbeddingsBatch([text], lovableApiKey);
  return results[0];
}

export async function generateEmbeddingsBatch(texts: string[], lovableApiKey: string): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];

  try {
    const response = await fetch(LOVABLE_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts }),
    });

    if (!response.ok) {
      console.error('[Embeddings] Error:', response.status, await response.text());
      return texts.map(() => null);
    }

    const result = await response.json();
    const byIndex = new Map<number, number[]>();
    (result.data || []).forEach((item: any, i: number) => {
      byIndex.set(typeof item.index === 'number' ? item.index : i, item.embedding);
    });
    return texts.map((_, i) => byIndex.get(i) || null);
  } catch (err) {
    console.error('[Embeddings] Exception:', err);
    return texts.map(() => null);
  }
}
