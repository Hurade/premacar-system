
# Atualização de Favicon e Títulos das Páginas

## O que será feito

### 1. Favicons — 3 tamanhos fornecidos
- `favicon-96x96.png` → favicon principal do navegador
- `web-app-manifest-192x192.png` → ícone para dispositivos móveis (PWA)
- `web-app-manifest-512x512.png` → ícone maior para instalação em tela inicial

Todos os arquivos serão copiados para a pasta `public/` e referenciados corretamente no `index.html`.

### 2. Título das páginas
Atualmente o `index.html` tem o título fixo `Dashboard | Sistema SDR`. O sistema não usa `document.title` dinamicamente nas rotas — o título fixo é o único existente.

Será atualizado para: **`PremaCar`** como título base, com o padrão `PremaCar - [Nome da Página]` aplicado dinamicamente conforme a rota ativa, usando um hook simples de título no `App.tsx`.

---

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `public/favicon-96x96.png` | Copiar arquivo enviado |
| `public/web-app-manifest-192x192.png` | Copiar arquivo enviado |
| `public/web-app-manifest-512x512.png` | Copiar arquivo enviado |
| `index.html` | Atualizar `<link rel="icon">` e `<title>` + adicionar tags de manifest |
| `src/App.tsx` | Adicionar lógica de título dinâmico por rota |

---

## Detalhes técnicos

### index.html — Novas tags de favicon

```html
<title>PremaCar</title>
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
<link rel="apple-touch-icon" sizes="192x192" href="/web-app-manifest-192x192.png" />
```

### App.tsx — Títulos dinâmicos por rota

Será adicionado um componente `PageTitle` que usa `useLocation` e `useEffect` para atualizar `document.title` conforme a página:

- `/dashboard` → `PremaCar - Dashboard`
- `/chat` → `PremaCar - Chat`
- `/contacts` → `PremaCar - Contatos`
- `/pipeline` → `PremaCar - Pipeline`
- `/broadcasts` → `PremaCar - Disparos`
- `/scheduling` → `PremaCar - Agendamentos`
- `/team` → `PremaCar - Equipe`
- `/settings` → `PremaCar - Configurações`
- `/auth` → `PremaCar - Login`
- Padrão → `PremaCar`
