import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateEmbeddingsBatch } from "../_shared/embeddings.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;
const EMBEDDING_BATCH_SIZE = 20;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'document_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: doc, error: docError } = await supabase
      .from('knowledge_documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Documento não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('knowledge_documents').update({ status: 'processing', error_message: null }).eq('id', document_id);

    try {
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('knowledge-base')
        .download(doc.storage_path);

      if (downloadError || !fileBlob) {
        throw new Error(`Falha ao baixar arquivo do storage: ${downloadError?.message || 'desconhecido'}`);
      }

      const buffer = await fileBlob.arrayBuffer();
      const text = await extractText(buffer, doc.file_type);

      if (!text || text.trim().length === 0) {
        throw new Error('Não foi possível extrair texto do arquivo (vazio ou formato não suportado)');
      }

      const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
      console.log(`[KnowledgeIngest] ${chunks.length} chunks gerados para documento ${document_id}`);

      // Remove chunks antigos (reprocessamento)
      await supabase.from('knowledge_chunks').delete().eq('document_id', document_id);

      let savedCount = 0;
      for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const embeddings = await generateEmbeddingsBatch(batch, lovableApiKey);

        const rows = batch.map((content, idx) => ({
          document_id,
          chunk_index: i + idx,
          content,
          embedding: embeddings[idx],
        })).filter(row => row.embedding !== null);

        if (rows.length > 0) {
          const { error: insertError } = await supabase.from('knowledge_chunks').insert(rows);
          if (insertError) {
            console.error('[KnowledgeIngest] Erro ao inserir chunks:', insertError);
          } else {
            savedCount += rows.length;
          }
        }
      }

      if (savedCount === 0) {
        throw new Error('Nenhum chunk foi salvo — geração de embeddings falhou para todos os pedaços do documento');
      }

      await supabase
        .from('knowledge_documents')
        .update({ status: 'ready', chunk_count: savedCount, error_message: null })
        .eq('id', document_id);

      return new Response(JSON.stringify({ success: true, chunks: savedCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : 'Erro desconhecido';
      console.error('[KnowledgeIngest] Erro processando documento:', message);
      await supabase.from('knowledge_documents').update({ status: 'error', error_message: message }).eq('id', document_id);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('[KnowledgeIngest] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function extractText(buffer: ArrayBuffer, fileType: string | null): Promise<string | null> {
  const type = (fileType || '').toLowerCase();

  if (type === 'pdf') {
    try {
      const { extractText: extractPdf, getDocumentProxy } = await import('https://esm.sh/unpdf@0.11.0');
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractPdf(pdf, { mergePages: true });
      return typeof text === 'string' ? text : null;
    } catch (err) {
      console.error('[KnowledgeIngest] Erro extraindo PDF:', err);
      return null;
    }
  }

  if (type === 'xlsx' || type === 'xls') {
    try {
      const XLSX = await import('https://esm.sh/xlsx@0.18.5');
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const parts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        if (csv?.trim()) parts.push(`## Planilha: ${sheetName}\n${csv}`);
      }
      return parts.join('\n\n');
    } catch (err) {
      console.error('[KnowledgeIngest] Erro extraindo XLSX:', err);
      return null;
    }
  }

  // csv / txt / fallback: trata como texto plano
  try {
    return new TextDecoder('utf-8').decode(buffer);
  } catch (err) {
    console.error('[KnowledgeIngest] Erro decodificando texto:', err);
    return null;
  }
}

// Chunking simples por caractere com overlap, respeitando quebras de parágrafo
// quando possível para não cortar frases no meio.
function chunkText(text: string, size: number, overlap: number): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (normalized.length <= size) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + size, normalized.length);

    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf('\n\n', end);
      const lineBreak = normalized.lastIndexOf('\n', end);
      const breakPoint = paragraphBreak > start + size / 2 ? paragraphBreak : lineBreak;
      if (breakPoint > start + size / 2) end = breakPoint;
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);

    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
