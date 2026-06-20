-- Converte ai_activation_delay_minutes de INTEGER para NUMERIC(5,2)
-- para suportar frações de minuto (ex: 0.33 = 20s, 0.5 = 30s)

ALTER TABLE nina_settings
  ALTER COLUMN ai_activation_delay_minutes TYPE NUMERIC(5,2);

ALTER TABLE agent_configs
  ALTER COLUMN ai_activation_delay_minutes TYPE NUMERIC(5,2);

COMMENT ON COLUMN nina_settings.ai_activation_delay_minutes IS 'Delay em minutos (aceita decimais: 0.33 = 20s, 0.5 = 30s). 0 = sem delay.';
COMMENT ON COLUMN agent_configs.ai_activation_delay_minutes IS 'Delay em minutos (aceita decimais: 0.33 = 20s, 0.5 = 30s). 0 = sem delay.';
