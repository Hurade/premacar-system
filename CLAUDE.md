# PremaCar System — Contexto Completo para Claude Code

> **Última atualização:** Janeiro 2025  
> **Versão do Sistema:** 2.0  
> **Framework de Desenvolvimento:** GMAD + Claude Code + VSCode

---

## 📋 ÍNDICE

1. [Sobre o Projeto](#sobre-o-projeto)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Arquitetura do Sistema](#arquitetura-do-sistema)
4. [Estrutura de Pastas](#estrutura-de-pastas)
5. [Banco de Dados](#banco-de-dados)
6. [Funcionalidades Principais](#funcionalidades-principais)
7. [Integrações](#integrações)
8. [Regras e Convenções](#regras-e-convenções)
9. [Fluxos Importantes](#fluxos-importantes)
10. [Como Trabalhar com Claude Code](#como-trabalhar-com-claude-code)

---

## 📖 SOBRE O PROJETO

### **O que é a PremaCar?**

PremaCar é uma **plataforma SaaS de automação de pós-venda** para oficinas mecânicas e auto centers. O sistema automatiza o contato com clientes inativos via WhatsApp, recuperando clientes que pararam de frequentar a oficina.

### **Proposta de Valor:**

- Conecta com ERP da oficina
- Identifica clientes próximos do intervalo de manutenção
- Envia mensagens personalizadas automaticamente via WhatsApp
- Acompanha retorno de clientes e faturamento gerado
- IA (Cris) conversa com leads no WhatsApp para qualificação

### **Público-Alvo:**

- Donos de oficinas mecânicas
- Gestores de auto centers
- Redes de franquias automotivas

### **Modelo de Negócio:**

- SaaS por assinatura: R$ 650/mês
- Trial gratuito: 14 dias
- Setup em 12 minutos

---

## 🛠️ STACK TECNOLÓGICA

### **Frontend:**
```json
{
  "framework": "React 18.3.1",
  "linguagem": "TypeScript 5.5.3",
  "build": "Vite 5.3.4",
  "estilização": "Tailwind CSS 3.4.1",
  "componentes": "shadcn/ui (Radix UI)",
  "rotas": "React Router DOM v6",
  "estado": "React Query v5 (TanStack Query)",
  "formulários": "React Hook Form 7.52.0",
  "validação": "Zod 3.23.8",
  "animações": "Framer Motion 11.3.8",
  "ícones": "Lucide React 0.400.0",
  "requisições": "Axios"
}
```

### **Backend:**
```json
{
  "banco": "Supabase (PostgreSQL 15)",
  "autenticação": "Supabase Auth",
  "storage": "Supabase Storage",
  "realtime": "Supabase Realtime",
  "edge_functions": "Supabase Edge Functions (Deno)"
}
```

### **Integrações Externas:**
```json
{
  "whatsapp": "Evolution API + Meta Official API",
  "ia": "Anthropic Claude (Sonnet 4.5)",
  "voz": "ElevenLabs (Text-to-Speech)",
  "ligações": "Twilio Voice API",
  "email": "AWS SES",
  "analytics": "PostHog",
  "pagamentos": "Stripe (futuro)"
}
```

### **Infraestrutura:**
```json
{
  "hospedagem_frontend": "Vercel",
  "hospedagem_backend": "Supabase Cloud",
  "cdn": "Vercel Edge Network",
  "domínio": "app.premacar.com.br",
  "ssl": "Automático (Let's Encrypt via Vercel)"
}
```

---

## 🏗️ ARQUITETURA DO SISTEMA

### **Visão Geral:**

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                     │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐ │
│  │Dashboard│  │Pipeline  │  │  Chat   │  │Campanhas │ │
│  └─────────┘  └──────────┘  └─────────┘  └──────────┘ │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SUPABASE (Backend as a Service)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │PostgreSQL│  │   Auth   │  │ Storage  │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │Realtime  │  │  Edge    │  │   RLS    │             │
│  │Subs      │  │Functions │  │ Security │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└──────────────────────────┬──────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
    ┌──────────────┐ ┌──────────┐ ┌─────────────┐
    │  Evolution   │ │ Anthropic│ │   Twilio    │
    │  WhatsApp    │ │  Claude  │ │    Voice    │
    │     API      │ │    API   │ │     API     │
    └──────────────┘ └──────────┘ └─────────────┘
            ▼              ▼              ▼
    ┌──────────────┐ ┌──────────┐ ┌─────────────┐
    │ ElevenLabs   │ │  AWS SES │ │   Stripe    │
    │ Text-to-     │ │  Email   │ │  Payments   │
    │   Speech     │ │  Service │ │   (futuro)  │
    └──────────────┘ └──────────┘ └─────────────┘
```

---

## 📁 ESTRUTURA DE PASTAS

### **Estrutura Completa:**

```
premacar/
├── src/
│   ├── components/           # Componentes reutilizáveis
│   │   ├── ui/              # shadcn/ui components (NÃO EDITAR)
│   │   ├── chat/            # Componentes do chat WhatsApp
│   │   ├── campaigns/       # Componentes de campanhas
│   │   ├── pipeline/        # Componentes do pipeline de vendas
│   │   ├── contacts/        # Componentes de gestão de contatos
│   │   ├── integrations/    # Componentes de integrações
│   │   ├── connections/     # Componentes de conexões WhatsApp
│   │   └── common/          # Componentes comuns
│   │
│   ├── pages/               # Páginas da aplicação
│   │   ├── Dashboard.tsx
│   │   ├── Pipeline.tsx
│   │   ├── Chat.tsx
│   │   ├── Contacts.tsx
│   │   ├── Disparos.tsx
│   │   ├── campanhas/
│   │   │   ├── index.tsx           # Lista de campanhas
│   │   │   ├── create.tsx          # Criar campanha (wizard)
│   │   │   └── [id].tsx            # Detalhes da campanha
│   │   ├── configuracoes/
│   │   │   ├── integracoes/
│   │   │   │   └── index.tsx       # Config de integrações
│   │   │   ├── conexoes/
│   │   │   │   └── index.tsx       # Múltiplas conexões WhatsApp
│   │   │   └── agentes-voz/
│   │   │       └── index.tsx       # Agentes de voz (multi-agente)
│   │   └── Auth.tsx
│   │
│   ├── hooks/               # Custom React Hooks
│   │   ├── useConversations.ts
│   │   ├── useCampaigns.ts
│   │   ├── useConversationWindow.ts  # Janela 24h WhatsApp
│   │   ├── useWhatsAppTemplates.ts
│   │   ├── useWhatsAppConnections.ts
│   │   ├── useVoiceAgents.ts
│   │   └── useContacts.ts
│   │
│   ├── services/            # Lógica de negócio e integrações
│   │   ├── ai/
│   │   │   ├── processMessage.ts      # Processar msg com Claude
│   │   │   ├── aiMessageControl.ts    # Anti-spam IA
│   │   │   └── validateResponse.ts    # Validar resposta IA
│   │   ├── whatsapp/
│   │   │   ├── evolutionAPI.ts        # Evolution API client
│   │   │   └── metaAPI.ts             # Meta Official API client
│   │   ├── voice/
│   │   │   ├── twilioIntegration.ts   # Twilio Voice
│   │   │   ├── elevenlabsIntegration.ts # ElevenLabs TTS
│   │   │   └── voiceAgentOrchestrator.ts # Orquestrador multi-agente
│   │   ├── email/
│   │   │   └── awsSESIntegration.ts   # AWS SES
│   │   └── campaigns/
│   │       ├── campaignOrchestrator.ts # Orquestrador de campanhas
│   │       └── campaignService.ts      # CRUD campanhas
│   │
│   ├── integrations/        # Integrações Supabase
│   │   └── supabase/
│   │       ├── client.ts    # Cliente Supabase
│   │       ├── types.ts     # Tipos TypeScript gerados
│   │       └── queries.ts   # Queries reutilizáveis
│   │
│   ├── lib/                 # Utilitários
│   │   ├── utils.ts         # Funções utilitárias gerais
│   │   └── constants.ts     # Constantes da aplicação
│   │
│   ├── types/               # Tipos TypeScript customizados
│   │   ├── campaign.ts
│   │   ├── contact.ts
│   │   ├── conversation.ts
│   │   └── voiceAgent.ts
│   │
│   ├── App.tsx              # Componente raiz
│   ├── main.tsx             # Entry point
│   └── index.css            # Estilos globais (Tailwind)
│
├── supabase/                # Configurações Supabase
│   ├── migrations/          # Migrações SQL
│   └── functions/           # Edge Functions
│
├── public/                  # Arquivos estáticos
├── .env.local              # Variáveis de ambiente (NÃO commitar)
├── .env.example            # Template de variáveis
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vite.config.ts
└── README.md
```

### **Convenções de Nomenclatura:**

```typescript
// Componentes: PascalCase
components/ChatWindow.tsx
components/CampaignCard.tsx

// Hooks: camelCase com prefixo 'use'
hooks/useConversations.ts
hooks/useCampaignStats.ts

// Services: camelCase
services/ai/processMessage.ts
services/voice/twilioIntegration.ts

// Pages: PascalCase ou kebab-case (rotas)
pages/Dashboard.tsx
pages/campanhas/[id].tsx

// Tipos: PascalCase
types/Campaign.ts
types/VoiceAgent.ts
```

---

## 🗄️ BANCO DE DADOS

### **Principais Tabelas:**

```sql
-- USUÁRIOS E ORGANIZAÇÕES
users                    -- Usuários do sistema
organizations            -- Empresas/oficinas
organization_members     -- Membros por organização

-- CONTATOS E CONVERSAS
contacts                 -- Leads/clientes
contact_folders          -- Pastas de contatos
conversations            -- Conversas WhatsApp
messages                 -- Mensagens trocadas
ai_message_control       -- Controle anti-spam IA

-- CAMPANHAS
recurring_campaigns      -- Campanhas recorrentes multi-canal
campaign_contacts        -- Contatos em campanhas
campaign_action_logs     -- Logs de ações executadas
whatsapp_templates       -- Templates aprovados Meta
email_templates          -- Templates de email

-- INTEGRAÇÕES
integration_settings     -- Credenciais APIs (Twilio, AWS, etc)
whatsapp_connections     -- Múltiplas conexões WhatsApp
voice_agents             -- Agentes de voz (multi-agente)
voice_calls              -- Registro de ligações

-- IA E PROMPTS
ai_prompts               -- Prompts do sistema (Cris, agentes)
ai_conversations         -- Histórico de conversas IA

-- VENDAS E PIPELINE
pipeline_stages          -- Etapas do funil de vendas
deals                    -- Negociações
tasks                    -- Tarefas/follow-ups
```

### **Relacionamentos Principais:**

```
organizations
    ├── users (1:N)
    ├── contacts (1:N)
    ├── recurring_campaigns (1:N)
    ├── whatsapp_connections (1:N)
    └── voice_agents (1:N)

contacts
    ├── conversations (1:N)
    ├── campaign_contacts (1:N)
    └── deals (1:N)

conversations
    ├── messages (1:N)
    ├── ai_message_control (1:1)
    └── whatsapp_connections (N:1)

recurring_campaigns
    ├── campaign_contacts (1:N)
    └── campaign_action_logs (1:N)

voice_agents
    └── voice_calls (1:N)
```

### **Campos Críticos:**

```sql
-- conversations (janela 24h WhatsApp)
last_customer_message_at TIMESTAMP  -- Última msg do cliente
window_expires_at TIMESTAMP         -- Quando janela expira
window_status VARCHAR(20)           -- 'open' ou 'expired'
connection_id UUID                  -- Conexão WhatsApp usada
api_type VARCHAR(20)                -- 'evolution' ou 'meta_official'

-- ai_message_control (anti-spam)
last_message_at TIMESTAMP           -- Última msg enviada
is_waiting_response BOOLEAN         -- Aguardando resposta?
message_count_last_hour INTEGER     -- Contador de msgs/hora

-- whatsapp_connections (múltiplas conexões)
name VARCHAR(100)                   -- "Atendimento", "Vendas"
phone_number VARCHAR(20)            -- Número WhatsApp
is_connected BOOLEAN                -- Status conexão

-- voice_agents (multi-agente)
name VARCHAR(100)                   -- "Cris - Prospecção"
system_prompt TEXT                  -- Prompt completo
use_case VARCHAR(50)                -- 'prospecting', 'reactivation'
```

---

## 🎯 FUNCIONALIDADES PRINCIPAIS

### **1. Chat WhatsApp com IA (Cris)**

**O que faz:**
- IA conversa automaticamente com leads
- Qualifica interesse (oficina? responsável? interesse?)
- Agenda demonstrações
- Encaminha para humano quando necessário

**Componentes:**
- `components/chat/ChatWindow.tsx`
- `components/chat/ConversationList.tsx`
- `components/chat/WindowExpiredAlert.tsx` (janela 24h)

**Serviços:**
- `services/ai/processMessage.ts`
- `services/ai/aiMessageControl.ts` (anti-spam)

**Regras Críticas:**
- ✅ Rate limit: 30 segundos entre mensagens
- ✅ Máximo 10 mensagens/hora por conversa
- ✅ Validação de resposta antes de enviar
- ✅ Deduplicação de webhooks
- ✅ Janela 24h para API Meta (mensagens livres vs templates)

---

### **2. Campanhas Recorrentes Multi-Canal**

**O que faz:**
- Campanhas de 4-5 dias automatizadas
- Dia 1: Ligação (Twilio + ElevenLabs)
- Dia 2: WhatsApp follow-up
- Dia 3: Email
- Dia 4: WhatsApp última tentativa
- Dia 5: Finalizar

**Componentes:**
- `pages/campanhas/index.tsx` (lista)
- `pages/campanhas/create.tsx` (wizard 4 etapas)
- `pages/campanhas/[id].tsx` (detalhes + analytics)

**Fluxo:**
```
Criar Campanha
├─ Etapa 1: Informações básicas
├─ Etapa 2: Configurar fluxo (dias e ações)
├─ Etapa 3: Adicionar contatos (CSV/pastas/manual)
└─ Etapa 4: Revisão e ativação

Executar Campanha (cron job a cada 1h)
├─ Orquestrador identifica ações pendentes
├─ Executa ação do dia (ligação/WhatsApp/email)
├─ Registra resultado
├─ Atualiza status do contato
├─ Aplica tags automáticas
└─ Avança para próximo dia se necessário
```

**Tecnologias:**
- Twilio Voice (ligações)
- ElevenLabs (voz AI)
- Evolution/Meta API (WhatsApp)
- AWS SES (email)

---

### **3. Múltiplas Conexões WhatsApp**

**O que faz:**
- Suporta até 4 números WhatsApp diferentes
- Cada um com nome personalizado ("Atendimento", "Vendas")
- Conversas vinculadas à conexão específica
- Gerenciamento centralizado

**Página:**
- `pages/configuracoes/conexoes/index.tsx`

**Componentes:**
- `components/connections/ConnectionModal.tsx`
- `components/connections/ConnectionCard.tsx`

**Uso:**
- Separar atendimento por departamento
- Escalar operação sem misturar conversas
- A/B testing de abordagens

---

### **4. Agentes de Voz Multi-Agente**

**O que faz:**
- Sistema de múltiplos agentes de voz especializados
- Cada agente com prompt específico para um contexto
- Orquestrador seleciona agente apropriado
- Métricas separadas por agente

**Agentes Disponíveis:**
1. Cris - Prospecção (primeiro contato)
2. Lucas - Reativação (leads frios)
3. Cris - Follow-up Demo
4. Cris - Qualificação
5. Cris - Pós-Venda (satisfação)

**Página:**
- `pages/configuracoes/agentes-voz/index.tsx`

**Serviço:**
- `services/voice/voiceAgentOrchestrator.ts`

**Seleção de Agente:**
```typescript
// Regras do orquestrador
Cliente ativo → Agente Pós-Venda
Teve demo há 2-7 dias → Agente Follow-up
Lead frio (30+ dias) → Agente Reativação
Lead qualificado → Agente Qualificação
Primeiro contato → Agente Prospecção
```

---

### **5. Pipeline de Vendas**

**O que faz:**
- Funil Kanban de vendas
- Etapas customizáveis
- Arrastar e soltar deals
- Tarefas e follow-ups
- Integração com chat

**Etapas Padrão:**
```
Novo Lead → Qualificado → Demo Agendada → 
Proposta Enviada → Negociação → Fechado/Perdido
```

---

### **6. Gestão de Contatos**

**Funcionalidades:**
- Importação CSV em massa
- Organização por pastas
- Tags customizáveis
- Histórico completo de interações
- Campos customizados

---

## 🔌 INTEGRAÇÕES

### **Evolution API (WhatsApp)**

**Uso:** API não oficial do WhatsApp (mais flexível)

**Configuração:**
```typescript
// .env.local
VITE_EVOLUTION_API_URL=https://evolution-api.com
VITE_EVOLUTION_API_KEY=xxxxxxxxxx
VITE_EVOLUTION_INSTANCE=premacar-prod
```

**Endpoints Usados:**
```typescript
POST /message/sendText        // Enviar mensagem
POST /message/sendMedia       // Enviar mídia
GET  /instance/connect        // Conectar (QR Code)
GET  /instance/connectionState // Status conexão
POST /webhook/set             // Configurar webhook
```

**Webhook:**
```
POST /api/webhooks/whatsapp/message
Payload: { messageId, from, body, timestamp, ... }
```

---

### **Meta Official API (WhatsApp)**

**Uso:** API oficial (janela 24h, templates aprovados)

**Configuração:**
```typescript
// integration_settings table
meta_phone_number_id
meta_access_token
meta_business_account_id
```

**Regra Janela 24h:**
```
Cliente responde → Janela 24h abre
Durante 24h → Mensagens livres permitidas
Após 24h → Apenas templates aprovados
Cliente responde template → Nova janela abre
```

---

### **Anthropic Claude (IA)**

**Uso:** IA conversacional (Cris)

**Modelo:** `claude-sonnet-4-20250514`

**Configuração:**
```typescript
VITE_ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxx
```

**Prompts:**
- Armazenados em `ai_prompts` table
- Variáveis renderizadas dinamicamente
- Histórico completo enviado para contexto

**Controles:**
- Rate limit: 30 seg entre msgs
- Max 10 msgs/hora
- Validação de resposta
- Deduplicação de webhooks

---

### **Twilio (Ligações)**

**Uso:** Fazer ligações automatizadas

**Configuração:**
```sql
-- integration_settings
twilio_account_sid
twilio_auth_token
twilio_phone_number
```

**Fluxo:**
```
1. ElevenLabs gera áudio (prompt do agente)
2. Upload para Supabase Storage
3. Twilio faz ligação tocando áudio
4. Webhook atualiza status
5. Registra em voice_calls
```

---

### **ElevenLabs (Voz AI)**

**Uso:** Text-to-Speech ultra-realista

**Configuração:**
```sql
elevenlabs_api_key
elevenlabs_voice_id (padrão: Bella)
```

**Uso:**
```typescript
// Gerar áudio
const audio = await elevenLabs.textToSpeech({
  text: agentPrompt,
  voice_id: 'EXAVITQu4vr4xnSDxMaL',
  model: 'eleven_multilingual_v2'
})

// Upload para storage
const url = await uploadAudio(audio)

// Usar em ligação
await twilioClient.calls.create({
  url: `<Response><Play>${url}</Play></Response>`
})
```

---

### **AWS SES (Email)**

**Uso:** Envio de emails transacionais

**Configuração:**
```sql
aws_access_key_id
aws_secret_access_key
aws_region
aws_ses_email_from
```

**Features:**
- 50.000 emails/mês grátis
- Templates HTML personalizados
- Tracking de aberturas/cliques
- Webhooks via SNS

---

## ⚙️ REGRAS E CONVENÇÕES

### **Regras de Código:**

```typescript
// ✅ SEMPRE FAZER:
- Usar TypeScript com tipos explícitos
- Componentes funcionais com hooks
- Importar com alias @ (ex: @/components)
- Tailwind CSS para estilização
- shadcn/ui para componentes base
- React Query para dados do servidor
- React Hook Form + Zod para formulários

// ❌ NUNCA FAZER:
- Editar arquivos em src/components/ui/ manualmente
- CSS inline ou styled-components
- Usar var ao invés de const/let
- Commits direto na main sem testar
- Expor secrets no código (.env.local apenas)
- Criar componentes sem PropTypes/TypeScript
```

### **Padrão de Componentes:**

```typescript
// ✅ BOM
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/useConversations'

interface ChatWindowProps {
  conversationId: string
  onClose: () => void
}

export function ChatWindow({ conversationId, onClose }: ChatWindowProps) {
  const [message, setMessage] = useState('')
  const { conversation, loading } = useConversations(conversationId)
  
  if (loading) return <div>Carregando...</div>
  
  return (
    <div className="flex flex-col h-full">
      {/* ... */}
    </div>
  )
}

// ❌ RUIM
export default function ChatWindow(props) {
  // Sem tipos, default export, etc
}
```

### **Padrão de Hooks:**

```typescript
// hooks/useConversations.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useConversations(contactId?: string) {
  return useQuery({
    queryKey: ['conversations', contactId],
    queryFn: async () => {
      let query = supabase
        .from('conversations')
        .select('*, contacts(*), messages(count)')
      
      if (contactId) {
        query = query.eq('contact_id', contactId)
      }
      
      const { data, error } = await query
      if (error) throw error
      return data
    }
  })
}
```

### **Padrão de Services:**

```typescript
// services/ai/processMessage.ts
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/integrations/supabase/client'

interface ProcessMessageParams {
  conversationId: string
  userMessage: string
  contactData: Contact
}

export async function processMessage({ 
  conversationId, 
  userMessage,
  contactData 
}: ProcessMessageParams) {
  // 1. Buscar prompt do banco
  const { data: promptData } = await supabase
    .from('ai_prompts')
    .select('content')
    .eq('name', 'cris_sdr_v2')
    .single()
  
  // 2. Renderizar variáveis
  const systemPrompt = promptData.content
    .replace('{{cliente_nome}}', contactData.name)
    .replace('{{data_hora}}', new Date().toISOString())
  
  // 3. Chamar Claude
  const anthropic = new Anthropic({
    apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY
  })
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  })
  
  return response.content[0].text
}
```

---

## 🔄 FLUXOS IMPORTANTES

### **Fluxo 1: Mensagem Recebida no WhatsApp**

```
1. Webhook recebe mensagem do Evolution/Meta
   ├─ POST /api/webhooks/whatsapp/message
   ├─ Payload: { messageId, from, body, ... }
   └─ Deduplicação (Set de IDs processados)

2. Identificar/Criar Conversa
   ├─ Buscar conversation por phone_number
   ├─ Se não existe, criar nova
   └─ Vincular à connection_id correta

3. Verificar Janela 24h (se Meta API)
   ├─ Checar window_status
   ├─ Se expirada, não processar com IA
   └─ Marcar: last_customer_message_at = NOW()

4. Verificar Rate Limit
   ├─ Checar ai_message_control
   ├─ Se < 30 seg desde última msg, IGNORAR
   └─ Se > 10 msgs última hora, BLOQUEAR

5. Processar com IA (se permitido)
   ├─ Buscar histórico de mensagens
   ├─ Buscar prompt da Cris
   ├─ Renderizar variáveis
   ├─ Chamar Claude API
   └─ Validar resposta (< 5 linhas, sem loops)

6. Enviar Resposta
   ├─ POST evolution/meta API
   ├─ Salvar em messages table
   ├─ Atualizar ai_message_control
   └─ Se sucesso, retornar 200 OK

7. Atualizar UI (Realtime)
   ├─ Supabase Realtime publica evento
   └─ Frontend atualiza chat automaticamente
```

---

### **Fluxo 2: Criar e Executar Campanha**

```
CRIAÇÃO:

1. Wizard Etapa 1: Informações Básicas
   ├─ Nome, descrição, objetivo
   ├─ Duração (4-5 dias)
   └─ Tags automáticas

2. Wizard Etapa 2: Configurar Fluxo
   ├─ Dia 1: Ligação (selecionar agente voz)
   ├─ Dia 2: WhatsApp (selecionar template)
   ├─ Dia 3: Email (escrever ou template)
   ├─ Dia 4: WhatsApp (template)
   └─ Dia 5: Finalizar

3. Wizard Etapa 3: Adicionar Contatos
   ├─ Por pasta (selecionar todos)
   ├─ Manual (com paginação)
   └─ CSV (upload)

4. Wizard Etapa 4: Revisão
   ├─ Ver resumo completo
   ├─ Estimativa de custos
   └─ Ativar campanha

EXECUÇÃO (Cron Job a cada 1h):

1. Orquestrador busca ações pendentes
   ├─ SELECT campaign_contacts
   ├─ WHERE current_day = X
   ├─ AND status = 'in_progress'
   └─ AND next_action_at <= NOW()

2. Para cada contato:
   ├─ Buscar configuração do dia
   ├─ Executar ação específica:
   │   ├─ Ligação: voiceAgentOrchestrator.call()
   │   ├─ WhatsApp: evolutionAPI.sendTemplate()
   │   └─ Email: awsSES.sendEmail()
   ├─ Registrar em campaign_action_logs
   └─ Atualizar status do contato

3. Processar Resultado
   ├─ Se sucesso: Marcar + Tag + Avançar dia
   ├─ Se falha: Retry (max 3x) ou Falhar
   └─ Atualizar métricas da campanha

4. Finalizar Campanha
   ├─ Se atingiu último dia, marcar completed
   ├─ Calcular custo total real
   └─ Gerar relatório final
```

---

### **Fluxo 3: Ligação com Multi-Agente**

```
1. Selecionar Agente Apropriado
   ├─ Buscar contexto do contato
   ├─ Orquestrador decide agente:
   │   ├─ Cliente ativo → Pós-Venda
   │   ├─ Teve demo → Follow-up
   │   ├─ Lead frio → Reativação
   │   └─ Novo → Prospecção
   └─ Retorna voice_agent específico

2. Renderizar Prompt do Agente
   ├─ Buscar system_prompt do agente
   ├─ Substituir variáveis:
   │   ├─ {{name}} → "João Silva"
   │   ├─ {{company}} → "Auto Center Silva"
   │   └─ {{context}} → dados do lead
   └─ Prompt final pronto

3. Gerar Áudio com ElevenLabs
   ├─ POST elevenlabs.io/v1/text-to-speech
   ├─ Voice ID do agente
   ├─ Receber audio buffer
   └─ Upload para Supabase Storage

4. Fazer Ligação com Twilio
   ├─ POST twilio.com/Calls.json
   ├─ TwiML: <Play>{audioUrl}</Play>
   ├─ StatusCallback webhook
   └─ Receber call_sid

5. Processar Resultado (Webhook)
   ├─ POST /api/webhooks/twilio/call-status
   ├─ Atualizar voice_calls:
   │   ├─ duration, status, recording_url
   │   └─ outcome ('answered', 'no_answer')
   ├─ Registrar em campaign_action_logs
   └─ Próxima ação baseado em resultado

6. Atualizar Métricas do Agente
   ├─ total_calls++
   ├─ avg_duration = média
   └─ success_rate = % atendidas
```

---

## 🛠️ COMO TRABALHAR COM CLAUDE CODE

### **Estrutura de Prompts Eficazes:**

```markdown
✅ BOM PROMPT:

"Cria hook useConversationWindow em src/hooks/useConversationWindow.ts 
que:
1. Recebe conversationId como parâmetro
2. Chama função SQL check_conversation_window
3. Retorna: windowStatus, canSendFreeMessage, expiresAt, hoursRemaining
4. Atualiza a cada minuto com setInterval
5. Tipos TypeScript completos"

❌ PROMPT RUIM:

"faz um hook pra janela"
```

### **Template de Solicitação:**

```markdown
TASK: [O que fazer]
FILE: [Arquivo a criar/editar]
SPECS:
- [Especificação 1]
- [Especificação 2]
- [Especificação 3]

EXAMPLE:
```typescript
// Código de exemplo se relevante
```

DEPENDENCIES:
- [Bibliotecas necessárias]

TESTS:
- [Como testar]
```

### **Comandos Úteis:**

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Supabase local (se necessário)
npx supabase start
npx supabase db reset
npx supabase migration new nome_da_migration
```

### **Debugging:**

```typescript
// Console logs úteis
console.log('🔍 [DEBUG]', variavel)
console.error('❌ [ERROR]', error)
console.warn('⚠️ [WARN]', mensagem)

// React Query Devtools (já instalado)
// Acessar: http://localhost:5173
// Ver queries ativas, cache, estados

// Supabase Logs
// Dashboard → Logs → API Logs
// Filtrar por método, status, etc
```

---

## 📚 RECURSOS E DOCUMENTAÇÃO

### **Documentação Oficial:**

- React: https://react.dev
- TypeScript: https://www.typescriptlang.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com
- Supabase: https://supabase.com/docs
- React Query: https://tanstack.com/query/latest/docs
- React Hook Form: https://react-hook-form.com
- Zod: https://zod.dev

### **APIs Externas:**

- Evolution API: https://doc.evolution-api.com
- Meta WhatsApp: https://developers.facebook.com/docs/whatsapp
- Anthropic Claude: https://docs.anthropic.com/claude
- Twilio: https://www.twilio.com/docs
- ElevenLabs: https://elevenlabs.io/docs
- AWS SES: https://docs.aws.amazon.com/ses

### **Ferramentas:**

- VSCode: https://code.visualstudio.com
- Claude Code: https://claude.ai/code
- Supabase CLI: https://supabase.com/docs/guides/cli
- Vercel CLI: https://vercel.com/docs/cli

---

## 🚀 PRÓXIMOS PASSOS DO PROJETO

### **Curto Prazo (1-2 semanas):**
- [ ] Implementar sistema multi-agente de voz
- [ ] Finalizar integrações (Twilio, ElevenLabs, AWS SES)
- [ ] Testar campanhas end-to-end
- [ ] Corrigir bugs da IA (anti-spam, validação)

### **Médio Prazo (1-2 meses):**
- [ ] Dashboard de analytics avançado
- [ ] Relatórios de ROI por campanha
- [ ] A/B testing de agentes/templates
- [ ] Integração com ERPs de oficinas
- [ ] Sistema de billing (Stripe)

### **Longo Prazo (3-6 meses):**
- [ ] Mobile app (React Native)
- [ ] IA preditiva (churn, LTV)
- [ ] Marketplace de templates
- [ ] White label para revendas
- [ ] Expansão para outros nichos

---

## 📞 CONTATOS E SUPORTE

### **Time PremaCar:**
- Tech Lead: [Nome]
- Product: [Nome]
- Comercial: [Nome]

### **Ambientes:**
- Produção: https://app.premacar.com.br
- Staging: https://staging.premacar.com.br (se houver)
- Supabase: https://app.supabase.com/project/[id]

---

**Última atualização:** Janeiro 2025  
**Versão deste documento:** 2.0  
**Mantido por:** Time de Desenvolvimento PremaCar

---

## 🎯 QUICK START PARA CLAUDE CODE

```bash
# 1. Ler este arquivo completamente
# 2. Entender arquitetura e fluxos principais
# 3. Ao receber task:
#    - Identificar arquivos afetados
#    - Verificar dependências
#    - Seguir convenções estabelecidas
#    - Testar localmente antes de sugerir
# 4. Sempre perguntar se algo não estiver claro
# 5. Priorizar: segurança > performance > DX
```

---

**FIM DO CONTEXTO**