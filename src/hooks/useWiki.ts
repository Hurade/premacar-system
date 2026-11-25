import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'
import type {
  WikiArticle, WikiSearchResult, WikiModule, WikiModuleArticle, WikiProgress,
  WikiQuizQuestion, WikiRoleplay, WikiAskResponse, WikiAgent, WikiSimulatorSession,
  WikiTeamProgressRow, WikiAiQuery,
} from '@/types/wiki'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

export function useWikiSearch(query: string, area: string | null, system: string | null) {
  return useQuery({
    queryKey: ['wiki_search', query, area, system],
    queryFn: async () => {
      const { data, error } = await db.rpc('search_wiki_articles', {
        p_query: query || null,
        p_area: area,
        p_system: system,
        p_limit: 40,
      })
      if (error) throw error
      return (data ?? []) as WikiSearchResult[]
    },
  })
}

export function useWikiArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['wiki_article', id],
    queryFn: async () => {
      const { data, error } = await db.from('wiki_articles').select('*').eq('id', id).single()
      if (error) throw error
      return data as WikiArticle
    },
    enabled: !!id,
  })
}

export function useWikiModules(track: string) {
  return useQuery({
    queryKey: ['wiki_modules', track],
    queryFn: async () => {
      const { data, error } = await db.from('wiki_modules').select('*').eq('track', track).order('order_index')
      if (error) throw error
      return (data ?? []) as WikiModule[]
    },
    enabled: !!track,
  })
}

export function useWikiModuleArticles(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['wiki_module_articles', moduleId],
    queryFn: async () => {
      const { data, error } = await db
        .from('wiki_module_articles')
        .select('module_id, article_id, order_index, article:wiki_articles(*)')
        .eq('module_id', moduleId)
        .order('order_index')
      if (error) throw error
      return (data ?? []) as WikiModuleArticle[]
    },
    enabled: !!moduleId,
  })
}

export function useWikiModuleQuiz(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['wiki_module_quiz', moduleId],
    queryFn: async () => {
      const { data: links, error: linksError } = await db
        .from('wiki_module_articles').select('article_id').eq('module_id', moduleId)
      if (linksError) throw linksError
      const articleIds = (links ?? []).map((l: { article_id: string }) => l.article_id)
      if (articleIds.length === 0) return [] as WikiQuizQuestion[]
      const { data, error } = await db.from('wiki_quiz_questions').select('*').in('article_id', articleIds)
      if (error) throw error
      return (data ?? []) as WikiQuizQuestion[]
    },
    enabled: !!moduleId,
  })
}

export function useWikiTrackQuiz(track: string) {
  return useQuery({
    queryKey: ['wiki_track_quiz', track],
    queryFn: async () => {
      const { data: modules, error: modError } = await db.from('wiki_modules').select('id').eq('track', track)
      if (modError) throw modError
      const moduleIds = (modules ?? []).map((m: { id: string }) => m.id)
      if (moduleIds.length === 0) return [] as WikiQuizQuestion[]
      const { data: links, error: linksError } = await db
        .from('wiki_module_articles').select('article_id').in('module_id', moduleIds)
      if (linksError) throw linksError
      const articleIds = [...new Set((links ?? []).map((l: { article_id: string }) => l.article_id))]
      if (articleIds.length === 0) return [] as WikiQuizQuestion[]
      const { data, error } = await db.from('wiki_quiz_questions').select('*').in('article_id', articleIds)
      if (error) throw error
      return (data ?? []) as WikiQuizQuestion[]
    },
    enabled: !!track,
  })
}

export function useWikiProgress() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['wiki_progress', user?.id],
    queryFn: async () => {
      const { data, error } = await db.from('wiki_progress').select('*').eq('user_id', user!.id)
      if (error) throw error
      return (data ?? []) as WikiProgress[]
    },
    enabled: !!user?.id,
  })
}

export function useMarkModuleStudied() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (moduleId: string) => {
      const { error } = await db.from('wiki_progress').upsert({
        user_id: user!.id,
        module_id: moduleId,
        studied_at: new Date().toISOString(),
      }, { onConflict: 'user_id,module_id' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki_progress'] })
      toast.success('Módulo marcado como estudado!')
    },
    onError: () => toast.error('Não foi possível salvar o progresso'),
  })
}

export function useSubmitModuleQuiz() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ moduleId, score, total }: { moduleId: string; score: number; total: number }) => {
      const { data: existing } = await db
        .from('wiki_progress').select('quiz_attempts').eq('user_id', user!.id).eq('module_id', moduleId).maybeSingle()
      const { error } = await db.from('wiki_progress').upsert({
        user_id: user!.id,
        module_id: moduleId,
        quiz_score: score,
        quiz_total: total,
        quiz_attempts: (existing?.quiz_attempts ?? 0) + 1,
        quiz_passed: score / total >= 0.7,
        last_quiz_at: new Date().toISOString(),
      }, { onConflict: 'user_id,module_id' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wiki_progress'] }),
  })
}

export function useSubmitTrackQuiz() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ track, score, total }: { track: string; score: number; total: number }) => {
      const { error } = await db.from('wiki_track_quiz_results').insert({
        user_id: user!.id,
        track,
        score,
        total,
        passed: score / total >= 0.7,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wiki_track_quiz_results'] })
      toast.success('Quiz final registrado!')
    },
  })
}

export function useWikiAsk() {
  return useMutation({
    mutationFn: async (params: { agent: WikiAgent; area?: string | null; question: string }) => {
      const { data, error } = await supabase.functions.invoke('wiki-ask', { body: params })
      if (error) throw error
      return data as WikiAskResponse
    },
  })
}

export function useWikiFeedback() {
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ aiQueryId, rating, comment }: { aiQueryId: string; rating: -1 | 1; comment?: string }) => {
      const { error } = await db.from('wiki_feedback').insert({
        ai_query_id: aiQueryId,
        user_id: user?.id ?? null,
        rating,
        comment: comment ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => toast.success('Obrigado pelo feedback!'),
  })
}

export function useWikiRoleplays(area: string | null) {
  return useQuery({
    queryKey: ['wiki_roleplays', area],
    queryFn: async () => {
      let query = db.from('wiki_roleplays').select('*').order('title')
      if (area) query = query.eq('area', area)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as WikiRoleplay[]
    },
  })
}

export function useSimulatorStart() {
  return useMutation({
    mutationFn: async (roleplayId: string) => {
      const { data, error } = await supabase.functions.invoke('wiki-simulate', {
        body: { action: 'start', roleplay_id: roleplayId },
      })
      if (error) throw error
      return data as { success: boolean; session_id: string; opening: string }
    },
  })
}

export function useSimulatorTurn() {
  return useMutation({
    mutationFn: async ({ sessionId, message }: { sessionId: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke('wiki-simulate', {
        body: { action: 'turn', session_id: sessionId, message },
      })
      if (error) throw error
      return data as { success: boolean; reply: string; transcript: WikiSimulatorSession['transcript'] }
    },
  })
}

export function useSimulatorEvaluate() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { data, error } = await supabase.functions.invoke('wiki-simulate', {
        body: { action: 'evaluate', session_id: sessionId },
      })
      if (error) throw error
      return data as { success: boolean; score: number; criteria_met: { criterion: string; met: boolean; note: string }[]; feedback: string }
    },
  })
}

export function useWikiManagerPanel() {
  const progress = useQuery({
    queryKey: ['wiki_team_progress_summary'],
    queryFn: async () => {
      const { data, error } = await db.from('wiki_team_progress_summary').select('*')
      if (error) throw error
      return (data ?? []) as WikiTeamProgressRow[]
    },
  })

  const gaps = useQuery({
    queryKey: ['wiki_ai_queries_gaps'],
    queryFn: async () => {
      const { data, error } = await db
        .from('wiki_ai_queries').select('*').eq('is_gap', true).order('created_at', { ascending: false }).limit(50)
      if (error) throw error
      return (data ?? []) as WikiAiQuery[]
    },
  })

  const feedback = useQuery({
    queryKey: ['wiki_feedback_negative'],
    queryFn: async () => {
      const { data, error } = await db
        .from('wiki_feedback')
        .select('*, query:wiki_ai_queries(question, answer, agent)')
        .eq('rating', -1)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  return { progress, gaps, feedback }
}
