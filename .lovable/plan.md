
# Plano: Sistema de Delay e Agrupamento de Mensagens Configurável

## Resumo Executivo

O sistema atual já possui uma arquitetura de agrupamento de mensagens, mas com delay fixo de 10 segundos no código e 20 segundos no banco de dados, causando inconsistência. Este plano vai:

1. **Unificar e aumentar o delay** para 20 segundos (configurável)
2. **Adicionar configurações no banco** para permitir customização
3. **Melhorar o mecanismo de extensão do timer** quando novas mensagens chegam
4. **Adicionar logs e monitoramento** para facilitar debug

---

## Arquitetura Atual (Como Funciona Hoje)

```text
┌─────────────────────┐
│  WhatsApp Webhook   │
│  (recebe mensagem)  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│  message_grouping_queue                                 │
│  - Adiciona mensagem com process_after = now + 10s     │
│  - Atualiza process_after de msgs pendentes do mesmo # │
└─────────┬───────────────────────────────────────────────┘
          │
          ▼ (trigger após delay)
┌─────────────────────┐
│   Message Grouper   │
│  - Agrupa mensagens │
│  - Combina conteúdo │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Nina Orchestrator  │
│  (processa IA)      │
└─────────────────────┘
```

**Problema identificado**: O delay no webhook (10s) está diferente do default do banco (20s), e o valor não é configurável pelo usuário.

---

## Alterações Técnicas

### 1. Adicionar Colunas de Configuração no nina_settings

```sql
ALTER TABLE nina_settings 
ADD COLUMN IF NOT EXISTS message_grouping_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS message_grouping_delay INTEGER DEFAULT 20000;
-- delay em milissegundos (20 segundos)
```

Isso permitirá que cada usuário configure:
- Se quer usar o agrupamento de mensagens
- Qual o delay desejado (padrão: 20 segundos)

---

### 2. Atualizar whatsapp-webhook/index.ts

**Mudanças principais:**
- Remover constante hardcoded `GROUPING_DELAY_MS = 10000`
- Buscar delay das configurações do usuário (`message_grouping_delay`)
- Se `message_grouping_enabled = false`, processar imediatamente sem delay
- Adicionar logs melhorados para debug

```typescript
// ANTES
const GROUPING_DELAY_MS = 10000; // hardcoded

// DEPOIS
// Buscar das settings do usuário
const groupingDelay = ownerSettings?.message_grouping_delay || 20000;
const groupingEnabled = ownerSettings?.message_grouping_enabled !== false;

// Usar o valor dinâmico
const processAfter = new Date(Date.now() + groupingDelay).toISOString();
```

**Lógica de extensão do timer melhorada:**
Quando uma nova mensagem chega do mesmo número, o timer é **reiniciado** para que todas as mensagens sejam agrupadas:

```typescript
// Atualizar process_after de mensagens pendentes do mesmo telefone
await supabase
  .from('message_grouping_queue')
  .update({ process_after: processAfter })
  .eq('processed', false)
  .filter('message_data->>from', 'eq', phoneNumber);
```

---

### 3. Atualizar message-grouper/index.ts

**Mudanças principais:**
- Adicionar logs detalhados mostrando quantas mensagens foram agrupadas
- Melhorar tratamento de erros
- Log do conteúdo combinado para debug

```typescript
console.log(`[MessageGrouper] Agrupando ${messages.length} mensagens de ${phoneNumber}`);
console.log(`[MessageGrouper] Conteúdo combinado: ${combinedContent}`);
```

---

### 4. (Opcional) Adicionar UI de Configuração

Em Settings → Configurações do Agente, adicionar:

```text
┌─────────────────────────────────────────────────────┐
│ Agrupamento de Mensagens                            │
│ ─────────────────────────────────────────────────── │
│ [✓] Aguardar mensagens antes de responder           │
│                                                     │
│ Tempo de espera: [20] segundos                      │
│ (Aguarda este tempo após cada mensagem antes de     │
│  processar. Ideal: 15-30 segundos)                  │
└─────────────────────────────────────────────────────┘
```

---

## Fluxo Após Implementação

### Cenário 1: Cliente envia 3 mensagens em 10 segundos
```text
[00:00] Cliente: "oi"
        → process_after = 00:20 (agora + 20s)
        
[00:03] Cliente: "quero saber da premacar"  
        → Atualiza process_after = 00:23 (reinicia timer)
        
[00:08] Cliente: "tenho uma oficina"
        → Atualiza process_after = 00:28 (reinicia timer)
        
[00:28] Timer expira
        → Message Grouper combina: "oi\nquero saber da premacar\ntenho uma oficina"
        → Nina responde UMA vez com contexto completo
```

### Cenário 2: Mensagem única
```text
[00:00] Cliente: "Olá, quero saber sobre a PremaCar"
        → process_after = 00:20
        
[00:20] Timer expira
        → Message Grouper processa 1 mensagem
        → Nina responde
```

### Cenário 3: Conversa alternada (fluxo natural)
```text
[00:00] Cliente: "oi"
[00:20] Nina: "Olá! Como posso ajudar?"
[01:00] Cliente: "tenho uma oficina"
[01:20] Nina: "Que legal! Trabalhamos com..."

(Fluxo normal mantido - cada mensagem tem seu próprio timer)
```

---

## Arquivos a Modificar

| Arquivo | Tipo de Mudança |
|---------|-----------------|
| `supabase/migrations/xxx_add_message_grouping_settings.sql` | Nova migration |
| `supabase/functions/whatsapp-webhook/index.ts` | Usar delay dinâmico das settings |
| `supabase/functions/message-grouper/index.ts` | Melhorar logs e tratamento |
| `src/components/settings/AgentSettings.tsx` | Adicionar UI de configuração (opcional) |

---

## Resultado Esperado

| Situação | Antes | Depois |
|----------|-------|--------|
| 3 mensagens em 5s | 3 respostas da IA | 1 resposta com contexto completo |
| 1 mensagem | Resposta após 10s | Resposta após 20s (configurável) |
| Delay configurável | ❌ Hardcoded | ✅ Via settings |
| Logs de debug | Básicos | Detalhados com contagem |

---

## Validação e Testes

Após implementação, testar:

1. ✅ Enviar 3 mensagens seguidas em 5 segundos → Deve responder 1 vez após 20s
2. ✅ Enviar 1 mensagem → Deve responder 1 vez após 20s  
3. ✅ Conversa normal (cliente → IA → cliente → IA) → Deve funcionar naturalmente
4. ✅ Enviar mensagem, aguardar 25s, enviar outra → Deve responder 2 vezes separadas
5. ✅ Desabilitar agrupamento nas settings → Deve responder imediatamente
