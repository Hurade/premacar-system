
# Plano: Permitir Modelo de Mensagem com 1 Variação

## Objetivo
Alterar o sistema de modelos de mensagem para permitir criar modelos com apenas 1 variação de texto, em vez do mínimo obrigatório de 3 variações.

## Alterações no Arquivo

**Arquivo:** `src/components/broadcasts/Templates.tsx`

### 1. Alterar o Estado Inicial do Formulário
- **Linha 51**: Mudar de 3 variações vazias para apenas 1
- De: `variations: ['', '', '']`
- Para: `variations: ['']`

### 2. Remover Padding de Variações ao Editar
- **Linhas 77-78**: Remover lógica que força mínimo de 3 ao editar
- Usar as variações existentes do modelo diretamente

### 3. Permitir Remoção até 1 Variação
- **Linha 96**: Mudar validação de mínimo de 3 para 1
- De: `if (formData.variations.length <= 3)`
- Para: `if (formData.variations.length <= 1)`

### 4. Validação ao Salvar
- **Linha 120**: Mudar validação de 3 para 1
- De: `if (validVariations.length < 3)`
- Para: `if (validVariations.length < 1)`

### 5. Atualizar Mensagens da Interface
- **Linha 287**: Atualizar label de "mínimo 3" para "mínimo 1"
- De: `Variações da Mensagem (mínimo 3)`
- Para: `Variações da Mensagem (mínimo 1)`

### 6. Botão de Remover Variação
- **Linha 320**: Permitir remover se tiver mais de 1
- De: `{formData.variations.length > 3 && ...}`
- Para: `{formData.variations.length > 1 && ...}`

## Resumo Visual

| Componente | Antes | Depois |
|------------|-------|--------|
| Variações iniciais | 3 | 1 |
| Mínimo para remover | 3 | 1 |
| Validação ao salvar | ≥ 3 | ≥ 1 |
| Label do campo | "mínimo 3" | "mínimo 1" |

## Observação

Essa alteração mantém a flexibilidade de adicionar até 10 variações para quem quiser usar a rotação de mensagens, mas remove a obrigatoriedade para campanhas simples que precisam de apenas 1 mensagem.
