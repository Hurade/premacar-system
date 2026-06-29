-- Sistema de Propostas Comerciais - Prema Car

CREATE TABLE IF NOT EXISTS leads_comerciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  empresa TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  cidade TEXT,
  estado TEXT,
  tipo_negocio TEXT NOT NULL CHECK (tipo_negocio IN ('oficina','autocenter','rede','franquia','outro')),
  clientes_mes INTEGER,
  clientes_base INTEGER,
  erp_utilizado TEXT,
  origem TEXT NOT NULL CHECK (origem IN ('feira','indicacao','instagram','whatsapp','prospeccao','site','lista','outro')),
  dor_principal TEXT NOT NULL CHECK (dor_principal IN ('cliente_nao_volta','falta_pos_venda','reclamacoes','baixa_fidelizacao','falta_controle','automatizar_whatsapp','outro')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS planos_propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('mensurar','fidelizar','recuperar')),
  nome TEXT NOT NULL,
  preco_mensal DECIMAL(10,2) NOT NULL,
  recursos JSONB DEFAULT '[]'::jsonb,
  descricao TEXT,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS propostas_comerciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL REFERENCES leads_comerciais(id) ON DELETE CASCADE,
  plano_id UUID REFERENCES planos_propostas(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','visualizada','em_negociacao','revisao','aceita','recusada','expirada')),
  diagnostico JSONB,
  valor_mensal DECIMAL(10,2) NOT NULL DEFAULT 0,
  desconto_percentual DECIMAL(5,2) NOT NULL DEFAULT 0,
  condicao_especial TEXT,
  validade_dias INTEGER NOT NULL DEFAULT 15,
  validade_ate DATE,
  slug TEXT UNIQUE NOT NULL,
  notas_vendedor TEXT,
  motivo_recusa TEXT,
  enviada_at TIMESTAMPTZ,
  visualizada_at TIMESTAMPTZ,
  aceita_at TIMESTAMPTZ,
  recusada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS propostas_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas_comerciais(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_vendedor ON leads_comerciais(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_leads_empresa ON leads_comerciais(empresa);
CREATE INDEX IF NOT EXISTS idx_propostas_lead ON propostas_comerciais(lead_id);
CREATE INDEX IF NOT EXISTS idx_propostas_vendedor ON propostas_comerciais(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON propostas_comerciais(status);
CREATE INDEX IF NOT EXISTS idx_propostas_slug ON propostas_comerciais(slug);
CREATE INDEX IF NOT EXISTS idx_historico_proposta ON propostas_historico(proposta_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads_comerciais;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads_comerciais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_propostas_updated_at ON propostas_comerciais;
CREATE TRIGGER update_propostas_updated_at
  BEFORE UPDATE ON propostas_comerciais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE leads_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_all" ON leads_comerciais FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "planos_select" ON planos_propostas FOR SELECT TO authenticated USING (true);
CREATE POLICY "planos_write" ON planos_propostas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "propostas_all" ON propostas_comerciais FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "propostas_public" ON propostas_comerciais FOR SELECT TO anon USING (status <> 'rascunho');
CREATE POLICY "historico_all" ON propostas_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO planos_propostas (tipo, nome, preco_mensal, recursos, descricao) VALUES
(
  'mensurar', 'Plano Mensurar', 299.00,
  '["Pesquisa de satisfação automática","NPS por WhatsApp","Dashboard de métricas","Relatórios mensais","Suporte por e-mail"]'::jsonb,
  'Ideal para começar medindo a satisfação dos clientes e entender os pontos de melhoria da operação.'
),
(
  'fidelizar', 'Plano Fidelizar', 497.00,
  '["Tudo do Plano Mensurar","Lembretes automáticos de revisão","Campanhas de fidelização","WhatsApp automatizado","Segmentação de clientes","Suporte prioritário"]'::jsonb,
  'Para autocenters que querem aumentar a retenção e fazer o cliente voltar sempre.'
),
(
  'recuperar', 'Plano Recuperar', 997.00,
  '["Tudo do Plano Fidelizar","Recuperação de clientes inativos","IA de conversação (Cris)","Campanhas multicanal","Integração com ERP","Gerente de sucesso dedicado"]'::jsonb,
  'Para quem quer recuperar clientes parados e reativar a base completa com automação inteligente.'
)
ON CONFLICT DO NOTHING;
