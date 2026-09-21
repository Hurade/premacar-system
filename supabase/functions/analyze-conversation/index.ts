import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { complete } from "../_shared/ai-gateway-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { contact_id, conversation_id, user_message, ai_response, current_memory, user_id } = await req.json();

    console.log(`[Analyze Conversation] Starting analysis for contact ${contact_id}`);

    // Calculate interaction count
    const interactionCount = (current_memory.interaction_summary?.total_conversations || 0) + 1;

    // Full analysis on 1st, 3rd, 6th, 9th... message (every 3, plus first contact)
    const shouldAnalyze = interactionCount === 1 || interactionCount % 3 === 0;

    console.log(`[Analyze] Interaction #${interactionCount}, full analysis: ${shouldAnalyze}`);

    if (!shouldAnalyze) {
      // BASIC UPDATE: Just increment counter and add to history
      const basicMemory = {
        ...current_memory,
        last_updated: new Date().toISOString(),
        interaction_summary: {
          ...current_memory.interaction_summary,
          total_conversations: interactionCount,
          last_contact_reason: user_message?.substring(0, 100) || ''
        },
        conversation_history: [
          ...(current_memory.conversation_history || []).slice(-9),
          {
            timestamp: new Date().toISOString(),
            user_summary: user_message?.substring(0, 200),
            ai_action: ai_response?.substring(0, 200)
          }
        ]
      };
      
      await supabase.rpc('update_client_memory', {
        p_contact_id: contact_id,
        p_new_memory: basicMemory
      });
      
      console.log('[Analyze] Basic update completed');
      return new Response(JSON.stringify({ updated: true, type: 'basic' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // FULL ANALYSIS: Fetch pipeline stages, current deal, and last messages for context
    const [{ data: stages }, { data: currentDeal }, { data: recentMessages }] = await Promise.all([
      supabase
        .from('pipeline_stages')
        .select('id, title, ai_trigger_criteria, position')
        .eq('is_ai_managed', true)
        .not('ai_trigger_criteria', 'is', null)
        .eq('is_active', true)
        .order('position', { ascending: true }),
      supabase
        .from('deals')
        .select('id, stage_id, stage')
        .eq('contact_id', contact_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('messages')
        .select('content, from_type, sent_at')
        .eq('conversation_id', conversation_id)
        .neq('from_type', null)
        .order('sent_at', { ascending: false })
        .limit(8)
    ]);

    const hasAiManagedStages = stages && stages.length > 0;
    
    if (!hasAiManagedStages) {
      console.log('[Analyze] ⏭️ No AI-managed stages with criteria - skipping stage determination');
    }

    console.log(`[Analyze] Running full AI analysis${hasAiManagedStages ? ' with stage determination' : ' (insights only)'}...`);

    // Prepare stage criteria for AI (only if there are AI-managed stages)
    const stagesCriteria = hasAiManagedStages
      ? stages.map(s => `- ${s.title} (ID: ${s.id}): ${s.ai_trigger_criteria}`).join('\n')
      : '';

    // Build recent conversation history (oldest → newest)
    const messageHistory = (recentMessages || [])
      .reverse()
      .map(m => {
        const who = m.from_type === 'user' ? 'LEAD' : m.from_type === 'nina' ? 'IA' : 'ATENDENTE';
        return `[${who}]: ${m.content || '(mídia)'}`;
      })
      .join('\n');

    // Prepare conversation snippet for AI analysis
    const conversationSnippet = `
HISTÓRICO RECENTE DA CONVERSA:
${messageHistory || `[LEAD]: ${user_message}\n[ATENDENTE/IA]: ${ai_response}`}

ÚLTIMA TROCA:
MENSAGEM DO CLIENTE: ${user_message}
RESPOSTA DO ASSISTENTE: ${ai_response}

CONTEXTO ACUMULADO:
- Interesses conhecidos: ${current_memory.lead_profile?.interests?.join(', ') || 'Nenhum'}
- Dores identificadas: ${current_memory.sales_intelligence?.pain_points?.join(', ') || 'Nenhuma'}
- Score atual: ${current_memory.lead_profile?.qualification_score || 0}/100
${hasAiManagedStages ? `
CRITÉRIOS DOS ESTÁGIOS DO PIPELINE:
${stagesCriteria}

ESTÁGIO ATUAL DO DEAL: ${currentDeal?.stage || 'Novos Leads'}` : ''}
    `.trim();

    // Tool única com os insights de memória sempre presentes e, quando há
    // estágios gerenciados por IA, a sugestão de estágio aninhada — o AI
    // Gateway (self-hosted) só aceita uma tool por chamada, diferente do
    // formato "tools: [...]" de múltiplas functions do gateway anterior.
    const insightProperties: Record<string, unknown> = {
      interests: {
        type: "array",
        items: { type: "string" },
        description: "Lista de interesses ou necessidades mencionados pelo cliente (max 5)"
      },
      pain_points: {
        type: "array",
        items: { type: "string" },
        description: "Dores, problemas ou desafios mencionados (max 5)"
      },
      qualification_score: {
        type: "number",
        description: "Score de qualificação de 0 a 100 baseado em: interesse demonstrado, budget implícito, urgência, fit com produto",
        minimum: 0,
        maximum: 100
      },
      next_best_action: {
        type: "string",
        enum: ["qualify", "demo", "followup", "close", "nurture"],
        description: "Próxima melhor ação"
      },
      budget_indication: {
        type: "string",
        enum: ["unknown", "low", "medium", "high"],
        description: "Indicação de orçamento baseado em sinais implícitos"
      },
      decision_timeline: {
        type: "string",
        enum: ["unknown", "immediate", "1month", "3months", "6months+"],
        description: "Timeline de decisão baseado em urgência"
      }
    };
    const insightRequired = ["interests", "pain_points", "qualification_score", "next_best_action", "budget_indication", "decision_timeline"];

    if (hasAiManagedStages) {
      insightProperties.stage_suggestion = {
        type: "object",
        description: "Sugestão de para qual estágio do pipeline o deal deve ir com base nos critérios",
        properties: {
          suggested_stage_id: {
            type: "string",
            enum: stages.map(s => s.id),
            description: "ID do estágio sugerido"
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 100,
            description: "Confiança na sugestão (0-100)"
          },
          reasoning: {
            type: "string",
            description: "Justificativa breve para a mudança (max 200 chars)"
          }
        },
        required: ["suggested_stage_id", "confidence", "reasoning"]
      };
      insightRequired.push("stage_suggestion");
    }

    const systemPrompt = hasAiManagedStages
      ? `Você é um analista de conversas de vendas da Prema (plataforma de retenção de clientes para oficinas/centros automotivos).

Analise o histórico da conversa e:
1. Extraia insights estruturados sobre o lead (interesses, dores, qualificação, budget, timeline)
2. Determine para qual estágio do pipeline o deal deve avançar com base nos critérios fornecidos

Regras para mudança de estágio:
- Só sugira avançar para o próximo estágio se houver sinais CLAROS na conversa
- Não regrida estágios (nunca sugira um estágio anterior ao atual)
- Use confidence > 70 apenas quando há evidência concreta na conversa
- Em caso de dúvida, mantenha o estágio atual (não mude)`
      : `Você é um analista de conversas de vendas da Prema (plataforma de retenção de clientes para oficinas/centros automotivos). Analise a interação e extraia insights estruturados para atualizar o perfil do lead.`;

    // Call AI to extract insights AND determine deal stage (if applicable)
    type AnalysisResult = {
      interests: string[];
      pain_points: string[];
      qualification_score: number;
      next_best_action: string;
      budget_indication: string;
      decision_timeline: string;
      stage_suggestion?: { suggested_stage_id: string; confidence: number; reasoning: string };
    };

    let insights: AnalysisResult | null = null;
    let stageResult: { suggested_stage_id: string; confidence: number; reasoning: string } | null = null;
    try {
      const result = await complete<AnalysisResult>({
        system: systemPrompt,
        messages: [{ role: 'user', content: conversationSnippet }],
        tool: {
          name: 'analise_conversa',
          description: 'Registra os insights extraídos da conversa e, se aplicável, a sugestão de estágio do pipeline',
          input_schema: { type: 'object', properties: insightProperties, required: insightRequired, additionalProperties: false },
        },
      });
      insights = result;
      stageResult = result.stage_suggestion ?? null;
    } catch (err) {
      console.error('[Analyze] AI analysis failed:', err);
      throw new Error('AI analysis failed');
    }

    console.log('[Analyze] Insights extracted:', insights);
    console.log('[Analyze] Stage suggestion:', stageResult);

    // Update client memory with insights
    if (insights) {
      const updatedMemory = {
        ...current_memory,
        last_updated: new Date().toISOString(),
        lead_profile: {
          ...current_memory.lead_profile,
          interests: Array.from(new Set([
            ...(current_memory.lead_profile?.interests || []),
            ...insights.interests
          ])).slice(0, 10),
          qualification_score: insights.qualification_score,
          lead_stage: insights.qualification_score > 70 ? 'qualified' : 
                      insights.qualification_score > 40 ? 'engaged' : 'new',
          budget_indication: insights.budget_indication,
          decision_timeline: insights.decision_timeline
        },
        sales_intelligence: {
          ...current_memory.sales_intelligence,
          pain_points: Array.from(new Set([
            ...(current_memory.sales_intelligence?.pain_points || []),
            ...insights.pain_points
          ])).slice(0, 10),
          next_best_action: insights.next_best_action
        },
        interaction_summary: {
          ...current_memory.interaction_summary,
          total_conversations: interactionCount,
          last_contact_reason: user_message?.substring(0, 100) || ''
        },
        conversation_history: [
          ...(current_memory.conversation_history || []).slice(-9),
          {
            timestamp: new Date().toISOString(),
            user_summary: user_message?.substring(0, 200),
            ai_action: ai_response?.substring(0, 200),
            insights_extracted: {
              qualification_score: insights.qualification_score,
              next_action: insights.next_best_action
            }
          }
        ]
      };

      await supabase.rpc('update_client_memory', {
        p_contact_id: contact_id,
        p_new_memory: updatedMemory
      });

      console.log('[Analyze] Memory updated successfully');
    }

    // Move deal if confidence > 70%, stage is different, and we're moving FORWARD (not regressing)
    let dealMoved = false;
    if (stageResult && currentDeal && stageResult.suggested_stage_id !== currentDeal.stage_id && stageResult.confidence > 70) {
      const newStage = stages?.find(s => s.id === stageResult.suggested_stage_id);
      const currentStage = stages?.find(s => s.id === currentDeal.stage_id);

      // Prevent regression: only move forward (higher position)
      const isForwardMove = !currentStage || !newStage || newStage.position > currentStage.position;

      if (newStage && isForwardMove) {
        const { error: updateError } = await supabase
          .from('deals')
          .update({
            stage_id: stageResult.suggested_stage_id,
            stage: newStage.title,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentDeal.id);

        if (!updateError) {
          dealMoved = true;
          console.log(`[Analyze] ✅ Deal moved: ${currentDeal.stage} → ${newStage.title} (confidence: ${stageResult.confidence}%)`);
          console.log(`[Analyze] Reasoning: ${stageResult.reasoning}`);
        } else {
          console.error('[Analyze] Error moving deal:', updateError);
        }
      } else if (!isForwardMove) {
        console.log(`[Analyze] ⏪ Stage regression blocked: ${currentDeal.stage} → ${newStage?.title}`);
      }
    } else if (stageResult && currentDeal) {
      console.log(`[Analyze] Deal NOT moved: same stage or low confidence (${stageResult.confidence}%)`);
    }

    return new Response(JSON.stringify({ 
      updated: true, 
      type: 'full',
      insights,
      stage_result: stageResult,
      deal_moved: dealMoved
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Analyze] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
