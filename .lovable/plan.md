# Plano: Migração para Evolution API

## ✅ CONCLUÍDO

A migração para Evolution API foi implementada com sucesso!

### Alterações Realizadas:

1. **Banco de Dados** ✅
   - Adicionados campos: `evolution_api_url`, `evolution_api_key`, `evolution_instance_name` em `nina_settings`

2. **Frontend - Onboarding** ✅
   - `StepWhatsApp.tsx` - Substituídos campos Meta por campos Evolution
   - Card de instruções, botão "Testar Conexão", tooltips explicativos
   - Validações de URL (http/https) e API Key (min 10 chars)

3. **Frontend - Settings** ✅
   - `ApiSettings.tsx` - Tela de configurações atualizada para Evolution API
   - Webhook URL copiável, documentação linkada

4. **Backend - Edge Functions** ✅
   - `whatsapp-webhook` - Adaptado para formato Evolution (messages.upsert)
   - `whatsapp-sender` - Envia via `POST /message/sendText/{instance}`
   - `test-evolution-connection` - Nova função para testar conexão
   - `message-grouper` - Atualizado para buscar settings da Evolution

5. **Hook de Onboarding** ✅
   - `useOnboardingStatus.ts` - Validação atualizada para campos Evolution
