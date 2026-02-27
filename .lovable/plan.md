

## Corrigir Erros de Envio da Campanha

### Diagnostico

Campanha "disp 10": 49 leads processados, todos com erro:
- 37x "This message was not delivered to maintain healthy ecosystem engagement"
- 12x "Message undeliverable"
- 0 enviados com sucesso

### Causa Raiz

1. **Versao da API Meta desatualizada**: O sistema usa `v18.0` (lancada em 2023). A Meta deprecia versoes antigas e isso pode causar comportamento erratico. Atualizar para `v21.0`.
2. **Sem circuit breaker**: O processador continua tentando enviar mesmo apos falhas consecutivas, desperdicando cota e piorando a reputacao.
3. **Retry agressivo**: Leads com erro 131049 sao re-tentados ate 3x, o que pode agravar o bloqueio.

### Plano de Correcao

#### 1. Atualizar versao da API Meta (campaign-processor)

Alterar a URL da API em `supabase/functions/campaign-processor/index.ts`:
- De: `https://graph.facebook.com/v18.0/`
- Para: `https://graph.facebook.com/v21.0/`

Fazer o mesmo em `supabase/functions/test-meta-template/index.ts`.

#### 2. Adicionar Circuit Breaker no campaign-processor

Quando houver 5+ erros consecutivos na mesma campanha durante uma execucao, pausar automaticamente a campanha e registrar o motivo. Isso evita desperdicar cota e piorar metricas.

Logica:
- Contador de erros consecutivos por campanha
- Ao atingir 5, marcar campanha como `paused` com motivo no campo de observacoes
- Continuar processando outras campanhas

#### 3. Diferenciar erros retentaveis vs definitivos

- Erro "Message undeliverable" = numero invalido/sem WhatsApp -> marcar como `error` imediatamente (sem retry)
- Erro "ecosystem engagement" (131049) = marcar como `error` imediatamente (retry piora a situacao)
- Erros de rede/timeout = permitir retry

#### 4. Re-processar leads pendentes

Apos corrigir a versao da API, os 51 leads ainda com status `pending` na campanha "disp 10" poderao ser processados normalmente na proxima execucao.

### Detalhes Tecnicos

**Arquivos a modificar:**
- `supabase/functions/campaign-processor/index.ts` - versao API, circuit breaker, classificacao de erros
- `supabase/functions/test-meta-template/index.ts` - versao API

**Mudancas no campaign-processor:**

```text
Linha 86:  v18.0 -> v21.0
Linha 661-711: Refatorar tratamento de erros:
  - Classificar erro como "definitivo" vs "retentavel"
  - Erros definitivos: status = 'error' imediatamente (sem retry)
  - Adicionar contador de erros consecutivos
  - Se >= 5 erros consecutivos: pausar campanha automaticamente
```

**Impacto esperado:**
- Versao atualizada da API pode resolver os erros 131049
- Circuit breaker protege contra perda de cota em cascata
- 51 leads pendentes serao re-processados automaticamente

