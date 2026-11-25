export type WikiAgent = 'max' | 'clara' | 'tutor';

export const AREA_OPTIONS = [
  'CS', 'Comercial', 'Gestão', 'Institucional', 'Onboarding', 'RH', 'Suporte',
] as const;
export type WikiArea = typeof AREA_OPTIONS[number];

export const SYSTEM_OPTIONS = [
  'Automax Frotas', 'Automax Oficina', 'Geral', 'Maxsig',
  'Prema Atendimento', 'Prema Pós-vendas', 'WhaTicket',
] as const;
export type WikiSystem = typeof SYSTEM_OPTIONS[number];

export const TRACK_OPTIONS = [
  'Integração (todos os colaboradores)', 'Suporte', 'CS', 'Comercial',
] as const;
export type WikiTrack = typeof TRACK_OPTIONS[number];

export interface WikiArticle {
  id: string;
  source_id: string;
  title: string;
  system: string;
  area: string;
  category: string | null;
  description: string;
  causes: string[];
  steps: string[];
  observations: string[];
  tools: string[];
  escalate: string | null;
  tags: string[];
  source_file: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WikiSearchResult {
  id: string;
  source_id: string;
  title: string;
  area: string;
  system: string;
  category: string | null;
  description: string;
  tags: string[];
  rank: number;
}

export interface WikiQuizQuestion {
  id: string;
  area: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  article_id: string | null;
}

export interface WikiRoleplay {
  id: string;
  source_id: string;
  title: string;
  area: string;
  persona: string;
  context: string;
  objective: string;
  customer_opening: string;
  success_criteria: string[];
}

export interface WikiModule {
  id: string;
  track: string;
  title: string;
  summary: string | null;
  order_index: number;
}

export interface WikiModuleArticle {
  module_id: string;
  article_id: string;
  order_index: number;
  article: WikiArticle;
}

export interface WikiProgress {
  id: string;
  user_id: string;
  module_id: string;
  studied_at: string | null;
  quiz_score: number | null;
  quiz_total: number | null;
  quiz_attempts: number;
  quiz_passed: boolean;
  last_quiz_at: string | null;
}

export interface WikiTrackQuizResult {
  id: string;
  user_id: string;
  track: string;
  score: number;
  total: number;
  passed: boolean;
  completed_at: string;
}

export interface WikiAiQuery {
  id: string;
  user_id: string | null;
  agent: WikiAgent;
  area_filter: string | null;
  question: string;
  answer: string | null;
  matched_article_ids: string[];
  best_similarity: number | null;
  is_gap: boolean;
  created_at: string;
}

export interface WikiAskResponse {
  success: boolean;
  query_id: string | null;
  answer: string;
  sources: { id: string; source_id: string; title: string; area: string; system: string }[];
  is_gap: boolean;
}

export interface WikiSimulatorTurn {
  role: 'customer' | 'user';
  content: string;
  at: string;
}

export interface WikiSimulatorSession {
  id: string;
  user_id: string;
  roleplay_id: string;
  transcript: WikiSimulatorTurn[];
  status: 'in_progress' | 'evaluated' | 'abandoned';
  score: number | null;
  evaluation: string | null;
  criteria_met: { criterion: string; met: boolean; note: string }[] | null;
  started_at: string;
  finished_at: string | null;
}

export interface WikiTeamProgressRow {
  team_member_id: string;
  name: string;
  email: string;
  role: string;
  track: string;
  total_modules: number;
  studied_modules: number;
  pct_studied: number | null;
  avg_quiz_ratio: number | null;
}
