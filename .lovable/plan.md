## Diagnóstico

Os erros de build vêm de 3 arquivos (`AgentConfigModal.tsx`, `useCampaignVariations.ts`, `Agentes.tsx`) que usam as tabelas `agent_configs`, `campaign_variations` e `campaign_send_rules`. Essas tabelas:

- **Existem nas migrações locais** (`supabase/migrations/20260618120000_create_agent_configs.sql` e `20260618140000_campaign_ab_rules.sql`)
- **Não existem no banco** (confirmado: não aparecem na lista de tabelas do Supabase nem em `src/integrations/supabase/types.ts`)

Resultado: o TypeScript não reconhece os nomes das tabelas, faz fallback para `"contacts_with_stats"` e quebra o build.

Também sobre sua pergunta de sincronização GitHub: a sincronização Lovable ↔ GitHub é automática e bidirecional. Você pode confirmar pelo menu **+ (Plus) → GitHub** no chat, ou comparando o último commit no GitHub com o estado do Code Editor do Lovable.

## Plano de correção

### 1. Aplicar as duas migrações pendentes no banco
Criar uma migração consolidada que executa o conteúdo de:
- `agent_configs` (tabela + índices + trigger updated_at + RLS + 3 agentes seed)
- `campaign_variations` + `campaign_send_rules` (tabelas + RLS + função `increment_variation_counter`)

Adicionando os `GRANT`s exigidos pelo padrão do projeto (que estavam faltando nas migrações originais):
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO authenticated;`
- `GRANT ALL ON public.<tabela> TO service_role;`

E ajustando as policies para também aceitar `service_role` (necessário para edge functions como `nina-orchestrator` e `campaign-processor`).

### 2. Resultado automático
Após a migração:
- `src/integrations/supabase/types.ts` é regenerado automaticamente pelo Lovable Cloud com as 3 novas tabelas.
- Os erros TS desaparecem porque `'agent_configs'`, `'campaign_variations'` e `'campaign_send_rules'` passam a ser nomes de tabela válidos.
- `is_winner`, `trigger_origin`, `model_mode`, `handoff_keywords` etc. passam a existir nos tipos `Row`/`Insert`/`Update`.

### 3. Verificação
Confirmar que o build TypeScript passa lendo o painel de erros após a migração rodar.

## Detalhes técnicos

- A migração será idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE POLICY ... IF NOT EXISTS` via `DROP POLICY IF EXISTS` antes).
- Os 3 agentes seed serão inseridos apenas se a tabela `agent_configs` estiver vazia (`WHERE NOT EXISTS`).
- Nenhum arquivo `.ts`/`.tsx` precisa ser editado — o erro é puramente de tipos derivados do schema.
- Nenhuma alteração de UI.