// Módulo compartilhado de geração de embeddings (base de conhecimento RAG).
//
// Migrado do Lovable AI Gateway (google/gemini-embedding-001, 3072
// dimensões) pro AI Gateway próprio (self-hosted, modelo local
// intfloat/multilingual-e5-large via fastembed, 1024 dimensões — dentro do
// limite de indexação do pgvector, diferente do modelo anterior).
//
// e5 exige um prefixo no texto pra funcionar bem: "query: " pro texto de
// busca (pergunta do cliente), "passage: " pro texto sendo indexado (pedaço
// de documento) — o próprio gateway aplica esse prefixo com base no
// `input_type` enviado, não precisa fazer aqui.

export const EMBEDDING_MODEL = 'intfloat/multilingual-e5-large';
export const EMBEDDING_DIMENSIONS = 1024;

type EmbeddingInputType = 'query' | 'passage';

function getGatewayConfig(): { url: string; secret: string } {
  const url = Deno.env.get('AI_GATEWAY_URL');
  const secret = Deno.env.get('AI_GATEWAY_SECRET');
  if (!url || !secret) throw new Error('AI_GATEWAY_URL/AI_GATEWAY_SECRET não configurados');
  return { url: url.replace(/\/$/, ''), secret };
}

export async function generateEmbedding(text: string, inputType: EmbeddingInputType = 'passage'): Promise<number[] | null> {
  const results = await generateEmbeddingsBatch([text], inputType);
  return results[0];
}

export async function generateEmbeddingsBatch(texts: string[], inputType: EmbeddingInputType = 'passage'): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];

  try {
    const { url, secret } = getGatewayConfig();
    const response = await fetch(`${url}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-secret': secret,
      },
      body: JSON.stringify({ input: texts, input_type: inputType }),
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
