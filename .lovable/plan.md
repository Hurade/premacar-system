
# Plano: Integrar Disparo Automático com Evolution API

## Diagnóstico

Após análise do código, identifiquei o problema:

- A função `campaign-processor` está **corretamente integrada** com a Evolution API
- As configurações da Evolution API estão salvas no banco de dados
- A campanha "teste 1" está com status "active" e tem 2 leads pendentes

**O Problema**: Não existe nenhum mecanismo para executar a função `campaign-processor` automaticamente. A função existe, mas não é chamada.

## Solução

Vou implementar duas melhorias:

### 1. Botão de Processamento Manual (Rápido)
Adicionar um botão "Processar Agora" na lista de campanhas para que você possa disparar manualmente o processamento enquanto desenvolve/testa.

### 2. Processamento Automático via Polling (Produção)
Implementar um sistema que processa campanhas automaticamente usando um timer no frontend que chama a função periodicamente enquanto existirem campanhas ativas.

---

## Mudanças Técnicas

### Arquivo: `src/components/broadcasts/CampaignsList.tsx`
- Adicionar botão "Processar Agora" para cada campanha ativa
- Implementar polling automático que verifica campanhas ativas a cada 60 segundos
- Mostrar indicador de processamento em andamento
- Exibir timestamp do último envio

### Arquivo: `supabase/functions/campaign-processor/index.ts`
- Verificar se a função está corretamente tratando erros da Evolution API
- Adicionar logs mais detalhados para debug

### Arquivo: `src/hooks/useCampaigns.ts` (se necessário)
- Adicionar mutation para chamar o campaign-processor diretamente

---

## Fluxo do Processamento

```text
┌─────────────────────────────────────────────────────────────┐
│                    Usuário cria campanha                     │
│                    Status: "active"                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│   Opção A: Clica "Processar Agora"                          │
│   Opção B: Polling automático (a cada 60s)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Edge Function: campaign-processor               │
│  1. Busca campanhas ativas                                  │
│  2. Verifica horário comercial e limites                    │
│  3. Pega próximo lead pendente                              │
│  4. Envia via Evolution API                                 │
│  5. Atualiza status do lead e contadores                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Evolution API envia mensagem                    │
│              Webhook atualiza status (entregue/lido)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após a implementação:
- Botão "Processar" visível em campanhas ativas
- Ao clicar, a função processa 1 lead por campanha ativa
- Indicador visual mostra quando está processando
- Logs detalhados no console para debug
- Opcionalmente: processamento automático periódico

---

## Observações

- O horário comercial configurado na campanha (09:00-18:00, Seg-Sex) será respeitado
- O sistema anti-ban pausará após enviar 50 mensagens (configurável)
- Limite diário de 100 mensagens por campanha será respeitado
