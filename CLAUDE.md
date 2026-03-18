# Premacar System — Contexto para Claude Code

## Stack
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui (componentes Radix UI)
- Supabase (auth + banco de dados)
- React Router DOM v6 (rotas)
- React Query v5 (estado servidor)
- Framer Motion (animações)
- React Hook Form + Zod (formulários e validação)

## Estrutura de pastas (padrão Lovable)
- `src/components/` — componentes reutilizáveis
- `src/components/ui/` — componentes shadcn (NÃO editar manualmente)
- `src/pages/` — páginas da aplicação
- `src/hooks/` — custom hooks
- `src/integrations/supabase/` — cliente e tipos do Supabase
- `src/lib/` — utilitários

## Regras importantes
- NUNCA editar arquivos em `src/components/ui/` diretamente
- Sempre usar componentes shadcn existentes antes de criar novos
- Manter padrão de imports com `@/` (alias configurado no vite)
- Formulários usam React Hook Form + Zod
- Estilização SEMPRE com Tailwind CSS, nunca CSS inline
- Ícones: usar lucide-react

## Deploy
- Push na branch `main` → Lovable detecta → sincroniza automaticamente
- Não alterar `vite.config.ts` sem necessidade

## Como pedir alterações ao Claude Code
Exemplos de bons prompts:
- "Adiciona campo de telefone no formulário em src/pages/Cadastro.tsx"
- "Cria componente Card em src/components/CardVeiculo.tsx com props: placa, modelo, ano"
- "Corrige o bug no hook src/hooks/useVeiculos.ts linha 42"