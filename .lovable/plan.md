
## Contexto

O deploy da `voice-call-twiml` **já foi aplicado** nas execuções anteriores. Evidência: o log `[voice-twiml] voice_mode=twilio-tts, contact=..., dtmf=false` (13/07 02:16:53) vem da versão atual do código (linha 192). Não há necessidade de CLI Supabase, access token ou envolver o dono do workspace — no Lovable Cloud edge functions deployam automaticamente via ferramenta interna.

O que falta é diagnóstico do problema real, não redeploy.

## Investigação a executar

1. **Buscar logs filtrados** em `voice-call-twiml` com os termos `"TwiML inicial"`, `"UNHANDLED"`, `"ElevenLabs"` — vai confirmar se as linhas 313/322 estão sendo executadas (só não apareceram no output anterior porque a listagem é truncada).

2. **Buscar logs recentes da tabela `system_logs`** (função `saveLog` grava lá) filtrando `source = 'voice-call-twiml'` — traz o histórico completo persistido, sem truncamento.

3. **Verificar `nina_settings`** para saber se `elevenlabs_api_key` está preenchido. Se estiver vazio, o modo `twilio-tts` é esperado e não é bug — a Cris fala com a voz Polly.Vitoria do próprio Twilio.

4. **Verificar o registro em `voice_calls`** da ligação `CA8610931b27f4e34c96f23bea0e8929de` — status final, `dtmf_response`, `duration_seconds` — pra entender se a ligação completou, se o lead teclou algo, ou onde ela parou.

## Hipóteses a validar

- **H1:** Deploy está ok, ElevenLabs não configurado → som robótico do Twilio TTS é o que o usuário está ouvindo, e ele interpretou isso como "deploy antigo". Ação: pedir ativação do ElevenLabs em Configurações → Integrações.
- **H2:** Deploy está ok, TwiML inicial é gerado mas Twilio rejeita algo (URL do Gather, escape XML) → verificar nos logs se aparece erro do lado do Twilio na ligação seguinte.
- **H3:** A URL do webhook cadastrada no número Twilio aponta pra outro lugar (não pra `voice-call-twiml`) → verificar em `make-voice-call` a `Url` enviada no `callParams` — mas essa é dinâmica no código, então improvável.

## Resposta ao usuário

Explicar em texto claro:
1. Deploy foi feito e está ativo — evidência nos logs mostrados.
2. O CLI/token não é necessário e não resolveria nada diferente.
3. O que provavelmente ele viu (Twilio TTS ao invés de ElevenLabs) e o que fazer.
4. Próximos passos concretos baseados no que a investigação retornar.

## Nada será editado nesta plan

Este é diagnóstico. Só depois de confirmar a causa raiz é que discutimos correção de código, se houver.
