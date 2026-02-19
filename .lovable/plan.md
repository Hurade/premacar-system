

## Plano: Backup Automatico do Banco de Dados na AWS (RDS)

### Resumo

Criar uma rotina automatizada que replica os dados mais importantes do banco do Lovable Cloud para um banco PostgreSQL na AWS (RDS), funcionando como backup externo e redundancia.

---

### Arquitetura

O sistema vai funcionar assim:

1. Uma Edge Function (`db-backup-sync`) roda periodicamente via cron job
2. Ela exporta os dados das tabelas principais em formato JSON
3. Envia os dados para um RDS PostgreSQL na AWS via conexao direta
4. O RDS serve apenas como backup/leitura -- o Lovable Cloud continua sendo o banco principal

---

### O que sera criado

**3 componentes:**

1. **Edge Function `db-backup-sync`** - Exporta dados das tabelas e envia para o RDS
2. **Script SQL `scripts/setup-rds-schema.sql`** - Schema para criar as tabelas espelho no RDS
3. **Script `scripts/setup-server.sh`** (atualizado) - Inclui instalacao do PostgreSQL client no EC2
4. **Workflow `.github/workflows/deploy.yml`** - CI/CD do frontend (como antes)
5. **Cron job** no banco do Lovable Cloud para agendar o backup

---

### Tabelas incluidas no backup

As tabelas mais criticas do sistema serao replicadas:

- `contacts` (dados dos clientes)
- `conversations` (historico de conversas)
- `messages` (mensagens)
- `deals` (negocios/pipeline)
- `appointments` (agendamentos)
- `campaigns` e `campaign_leads` (disparos)
- `nina_settings` (configuracoes)
- `profiles` (perfis de usuario)
- `pipeline_stages`, `tag_definitions`, `teams`, `team_functions`, `team_members`

Tabelas de fila (`*_queue`) nao serao replicadas pois sao transitorias.

---

### Pre-requisitos do usuario

1. **Instancia RDS PostgreSQL na AWS** (db.t3.micro ~$15/mes)
   - Anotar: host, porta, usuario, senha, nome do banco
2. **Security Group do RDS** permitindo conexao da internet (ou VPC peering)
3. **Instancia EC2** com Ubuntu (se quiser hospedar o frontend tambem)

---

### Detalhes tecnicos

**Edge Function `db-backup-sync`:**
- Conecta ao banco do Lovable Cloud via `SUPABASE_DB_URL` (ja configurado como secret)
- Leitura das tabelas via SDK do Supabase (service role)
- Conexao ao RDS via string de conexao armazenada em secret (`RDS_DATABASE_URL`)
- Executa UPSERT (INSERT ON CONFLICT UPDATE) para sincronizar os dados
- Registra log de cada execucao

**Schema espelho no RDS (`setup-rds-schema.sql`):**
- Replica a estrutura das tabelas principais
- Sem RLS (apenas backup, nao acesso direto)
- Inclui indices para performance de leitura
- Coluna `synced_at` para rastrear ultima sincronizacao

**Cron job:**
```sql
-- Executa backup a cada 6 horas
select cron.schedule(
  'db-backup-sync',
  '0 */6 * * *',
  $$ select net.http_post(...) $$
);
```

**Secrets necessarios:**
- `RDS_DATABASE_URL` - String de conexao do RDS (ex: `postgresql://user:pass@host:5432/dbname`)

**Script de setup do EC2 (`setup-server.sh`):**
- Instalacao do Nginx + Node.js 20
- Instalacao do `postgresql-client` para acesso manual ao RDS se necessario
- Configuracao do Nginx para SPA
- Instrucoes para SSL com Certbot

**GitHub Actions Workflow (`deploy.yml`):**
- Build do frontend com variaveis de ambiente
- Deploy via SCP para EC2
- Restart do Nginx

---

### Frequencia de backup

- Padrao: a cada 6 horas (4x por dia)
- Pode ser ajustado para cada hora ou diario conforme necessidade
- Cada execucao faz sync incremental (apenas registros novos/alterados desde o ultimo sync)

---

### Custos estimados

| Componente | Custo mensal |
|---|---|
| RDS db.t3.micro | ~$15-25 |
| EC2 t2.micro (frontend) | ~$8-10 |
| Edge Function (cron) | Incluso no Lovable Cloud |
| **Total** | **~$23-35/mes** |

---

### Ordem de implementacao

1. Gerar o script `setup-rds-schema.sql` para o usuario criar as tabelas no RDS
2. Solicitar o secret `RDS_DATABASE_URL` ao usuario
3. Criar a Edge Function `db-backup-sync`
4. Configurar o cron job para executar o backup periodicamente
5. Gerar o `setup-server.sh` e `deploy.yml` para o EC2/frontend
6. Testar a sincronizacao end-to-end

