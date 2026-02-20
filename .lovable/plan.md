
## Diagnóstico do Problema

O problema tem dois pontos de falha no `src/hooks/useConversations.ts`:

**Ponto 1 - `fetchAndAddConversation` (linha 72-128):** Chamada pelo realtime quando chega uma nova conversa ou mensagem de conversa desconhecida. Ela busca e adiciona a conversa ao Chat **sem verificar** se é um disparo sem resposta. Ou seja, quando o `campaign-processor` cria as mensagens de disparo no banco, o realtime dispara `fetchAndAddConversation` e a conversa entra no Chat principal sem filtro.

**Ponto 2 - Realtime de mensagens (linha 200-204):** Quando chega uma nova mensagem numa conversa que não está no estado, chama `fetchAndAddConversation` diretamente — mesmo que a mensagem seja do sistema de disparo (`from_type: 'nina'` ou `from_type: 'human'`) e não do cliente.

**O filtro correto já existe** em `api.fetchConversations` (linhas 1264-1281 de `src/services/api.ts`): ele verifica se a conversa tem `dispatch_sent_at` e só inclui as que têm pelo menos uma mensagem com `from_type = 'user'`. Mas esse filtro **não é aplicado no realtime**.

---

## Solução

### 1. Criar função helper de filtro de disparo

Extrair a lógica de verificação em uma função reutilizável que consulta se uma conversa de disparo tem resposta do cliente:

```text
// Verifica se deve incluir a conversa no Chat
// Retorna true se: não é disparo OU é disparo com resposta do cliente
async function shouldIncludeInChat(conversationId, dispatchSentAt): boolean
```

### 2. Corrigir `fetchAndAddConversation`

Adicionar a verificação antes de incluir a conversa no estado:

```text
// Após buscar convData:
if (convData.dispatch_sent_at) {
  // Verificar se há resposta do cliente
  const { data: userMessages } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('from_type', 'user')
    .limit(1);
  
  if (!userMessages || userMessages.length === 0) {
    // Disparo sem resposta - não adicionar ao Chat
    return;
  }
}
// Continua normalmente...
```

### 3. Corrigir o handler de mensagens novas no realtime

Quando chega uma mensagem em conversa desconhecida, verificar o `from_type` antes de chamar `fetchAndAddConversation`:

```text
if (!conversationExists) {
  // Só carregar a conversa se a mensagem for do cliente
  // (mensagens de disparo não devem trazer a conversa para o Chat)
  if (newMessage.from_type === 'user') {
    fetchAndAddConversation(newMessage.conversation_id);
  }
  // Se for nina/human (disparo), ignorar no Chat
  return prev;
}
```

Isso garante que **apenas quando o cliente responder** (`from_type: 'user'`) a conversa de disparo será carregada no Chat.

### 4. Arquivos alterados

Apenas **um arquivo** será modificado:

- `src/hooks/useConversations.ts`
  - Função `fetchAndAddConversation`: adicionar verificação de disparo sem resposta
  - Handler de mensagens realtime (`INSERT` em `messages`): filtrar chamada a `fetchAndAddConversation` por `from_type`

### Comportamento esperado após a correção

| Cenário | Antes | Depois |
|---------|-------|--------|
| Disparo enviado, cliente não respondeu | Aparece no Chat | Não aparece no Chat |
| Disparo enviado, cliente respondeu | Aparece no Chat | Aparece no Chat |
| Conversa normal (não disparo) | Aparece no Chat | Aparece no Chat |
| Cliente responde a um disparo | Aparece no Chat | Aparece no Chat (em tempo real) |

A aba de Disparos → Conversas continua funcionando normalmente, pois usa um hook separado (`useDispatchConversations`) que não é afetado por essa mudança.
