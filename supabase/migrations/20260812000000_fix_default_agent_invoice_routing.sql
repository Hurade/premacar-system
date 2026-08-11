-- ============================================================
-- Corrige o roteador "Atendimento" (trigger_type='default') mandando
-- pedidos de EMISSÃO de nota fiscal pro financeiro.
--
-- "Nota fiscal" é ambíguo: pra clientes do Automax Oficina/Frotas e
-- Maxsig, emitir NF-e é uma FUNCIONALIDADE do próprio sistema (o
-- cliente emitindo a nota do negócio dele) — é suporte, não cobrança.
-- Só é financeiro quando é sobre a nota que a Prema Car/Automax/Maxsig
-- emite PARA o cliente pelo uso do serviço (ex: 2ª via da assinatura).
--
-- Usa replace() em trechos específicos em vez de sobrescrever o
-- system_prompt inteiro, pra não apagar customizações feitas via tela
-- de Configurações > Agentes. Se o texto já tiver sido editado e não
-- bater mais com o original, este UPDATE simplesmente não altera nada.
-- ============================================================

UPDATE public.agent_configs
SET system_prompt = replace(
  replace(
    system_prompt,
    '2. **suporte** — já é cliente/usuário e tem uma dúvida de uso, um erro, algo "não está funcionando", precisa de ajuda técnica ou operacional com o sistema.',
    '2. **suporte** — já é cliente/usuário e tem uma dúvida de uso, um erro, algo "não está funcionando", precisa de ajuda técnica ou operacional com o sistema. Inclui EMITIR nota fiscal/NF-e pelo Automax Oficina, Automax Frotas ou Maxsig — isso é uma funcionalidade do produto (o cliente emitindo a nota do PRÓPRIO negócio dele através do sistema), não assunto financeiro.'
  ),
  '4. **financeiro** — qualquer assunto de cobrança, boleto, pagamento, nota fiscal, valor da fatura, negociação de débito, ou mudança de plano/pagamento.',
  '4. **financeiro** — cobrança, boleto, pagamento, valor da fatura, negociação de débito, ou mudança de plano/pagamento — sempre sobre a cobrança que A PREMA CAR/AUTOMAX/MAXSIG faz PARA o cliente pelo uso do serviço. "Nota fiscal" só é financeiro nesse sentido (ex: 2ª via da nota da assinatura); se o cliente quer emitir/gerar uma nota fiscal usando o sistema (Automax/Maxsig), é suporte — ver item 2.'
)
WHERE trigger_type = 'default' AND is_active = true;
