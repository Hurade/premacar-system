

## Correção: Erro de SQL na Edge Function db-backup-sync

### Problema

A Edge Function `db-backup-sync` tem um erro de sintaxe SQL na linha 167. O PostgreSQL **nao permite** `ORDER BY` e `LIMIT` diretamente em um `UPDATE`. O comando atual:

```sql
UPDATE sync_log SET ... 
WHERE table_name = '_full_sync' AND status = 'running'
ORDER BY started_at DESC LIMIT 1
```

### Solução

Reescrever o UPDATE usando um subquery para selecionar o registro correto:

```sql
UPDATE sync_log SET completed_at = now(), status = 'completed', 
records_synced = ...
WHERE id = (
  SELECT id FROM sync_log 
  WHERE table_name = '_full_sync' AND status = 'running'
  ORDER BY started_at DESC LIMIT 1
)
```

### Detalhes técicos

Apenas uma alteração no arquivo `supabase/functions/db-backup-sync/index.ts`, linhas 163-168. A correção substitui o UPDATE invalido por um UPDATE com subquery compativel com PostgreSQL.

Após a correção, a Edge Function sera re-deployada automaticamente e poderemos testar a sincronização novamente.

