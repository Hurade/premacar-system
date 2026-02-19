

## Teste de Verificacao do Backup RDS

### Estrategia

Vou usar a tabela `tag_definitions` para o teste. O plano e:

1. **Atualizar um registro** na tabela `tag_definitions` -- mudar a cor da tag "Qualificado" (id: `15bb6268-9832-4510-b322-83aec938ee2f`) de `#22c55e` para `#16a34a`
2. **Forcar o backup incremental** chamando a Edge Function `db-backup-sync`
3. **Fornecer o SQL de verificacao** para voce rodar no RDS

### SQL de verificacao para rodar no RDS

Apos o backup, rode este comando no seu banco RDS:

```text
SELECT id, key, label, color, updated_at, synced_at 
FROM tag_definitions 
WHERE id = '15bb6268-9832-4510-b322-83aec938ee2f';
```

### Valores esperados

| Campo | Valor esperado |
|-------|---------------|
| id | `15bb6268-9832-4510-b322-83aec938ee2f` |
| key | `qualified` |
| label | `Qualificado` |
| color | `#16a34a` (novo valor) |
| synced_at | Timestamp proximo ao momento do backup |

Se o campo `color` mostrar `#16a34a` e o `synced_at` estiver atualizado, o backup incremental esta funcionando corretamente.

### Detalhes tecnicos

- Arquivo alterado: nenhum (apenas operacoes de dados)
- A atualizacao sera feita via ferramenta de insert/update do banco
- O backup sera forcado via chamada POST a Edge Function `db-backup-sync`
- Apos a verificacao, a cor pode ser revertida para `#22c55e` se desejado

