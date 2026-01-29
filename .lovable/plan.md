
# Plano: Migração para Evolution API

## Visão Geral
Substituir a integração com a API oficial do WhatsApp da Meta pela **Evolution API**, uma alternativa open-source que permite conectar o WhatsApp Business sem precisar de aprovação da Meta.

---

## 1. Interface de Configuração (Fase 2 do Onboarding)

### Novos Campos a Adicionar
- **URL da Evolution API** - Campo de texto para a URL base (ex: `https://evolution.sua-api.com`)
- **API Key** - Campo senha para a chave de autenticação (mínimo 10 caracteres)
- **Nome da Instância** - Campo de texto para identificar a instância conectada
- **Webhook URL** - Campo somente leitura com botão de copiar, mostrando a URL que deve ser configurada na Evolution

### Campos a Remover
- Access Token da Meta
- Phone Number ID
- WhatsApp Business Account ID
- Webhook Verify Token da Meta

### Card de Instruções
Adicionar um bloco visual com o passo a passo:
1. Acesse o painel da Evolution API
2. Crie ou selecione uma instância
3. Conecte escaneando o QR Code
4. Copie a API Key
5. Configure o webhook apontando para a URL fornecida
6. Cole as informações nos campos

### Funcionalidades Extras
- **Botão "Testar Conexão"** - Verifica se a API está respondendo corretamente
- **Indicador de status** - Mostra se a instância está conectada/desconectada
- **Tooltips explicativos** - Em cada campo para guiar o usuário
- **Link para documentação** - `https://doc.evolution-api.com/`

---

## 2. Alterações no Banco de Dados

### Novos Campos na Tabela `nina_settings`
- `evolution_api_url` (text) - URL base da Evolution API
- `evolution_api_key` (text) - Chave de autenticação
- `evolution_instance_name` (text) - Nome da instância

### Campos a Manter (para retrocompatibilidade)
Os campos antigos da Meta podem ser mantidos temporariamente ou removidos conforme preferência.

---

## 3. Backend - Edge Functions

### Webhook de Recebimento (`whatsapp-webhook`)
Adaptar para o formato de payload da Evolution API:
```json
{
  "event": "messages.upsert",
  "instance": "nome_instancia",
  "data": {
    "key": { "remoteJid": "5511999999999@s.whatsapp.net" },
    "message": { "conversation": "Texto" },
    "pushName": "Nome do Contato"
  }
}
```

### Envio de Mensagens (`whatsapp-sender`)
Alterar para usar o endpoint da Evolution:
- **URL:** `POST {evolution_url}/message/sendText/{instance_name}`
- **Headers:** `apikey: {api_key}`
- **Body:** `{ "number": "5511999999999", "text": "Mensagem" }`

### Download de Mídia (`message-grouper`)
Adaptar para buscar mídias pela Evolution API ao invés da API da Meta.

---

## 4. Validações

### No Frontend
- URL deve começar com `http://` ou `https://`
- API Key com mínimo de 10 caracteres
- Todos os campos obrigatórios preenchidos
- Feedback visual de sucesso/erro

### No Backend
- Validar formato do webhook recebido
- Tratar diferentes eventos da Evolution (messages.upsert, connection.update, etc.)

---

## 5. Testes e Verificação

### Novo Endpoint de Teste
Criar função para verificar conexão com a Evolution API e status da instância.

### Atualizar Tela de Configurações
A página de Settings também precisa refletir as mesmas mudanças da Evolution API.

---

## Arquivos a Modificar

| Área | Arquivos |
|------|----------|
| **UI Onboarding** | `src/components/onboarding/StepWhatsApp.tsx` |
| **UI Settings** | `src/components/settings/ApiSettings.tsx` |
| **Wizard** | `src/components/OnboardingWizard.tsx` |
| **Hooks** | `src/hooks/useOnboardingStatus.ts` |
| **Banco** | Nova migration para adicionar campos |
| **Backend** | `supabase/functions/whatsapp-webhook/index.ts` |
| **Backend** | `supabase/functions/whatsapp-sender/index.ts` |
| **Backend** | `supabase/functions/message-grouper/index.ts` |
| **Backend** | Nova função `test-evolution-connection` |

---

## Resultado Final
- Interface moderna e intuitiva para configurar a Evolution API
- Instruções claras para o usuário
- Webhook adaptado para o formato Evolution
- Envio de mensagens funcionando com a nova API
- Botão de teste de conexão
- Status visual da instância (conectada/desconectada)
