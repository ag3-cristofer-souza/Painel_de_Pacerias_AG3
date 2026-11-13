# Painel de Parcerias — AG3

Front do Painel de Parcerias: o painel em que parceiros (white label) e a equipe AG3 acompanham a carteira de clientes,
criam workspaces e atendem chamados. **Todo o desenvolvimento desse front acontece neste repositório.**

- **Plano:** `docs/plano_parceiros_chamados.md`, no repositório do backend (`SistemaAG3.ai-Backend-Django`). A seção
  4.3 descreve este painel e a seção 9 traz as decisões.
- **Backend:** Django, no repositório `SistemaAG3.ai-Backend-Django` (apps `partners` e `support`). Este repositório não
  tem backend próprio.
- **Pilha e regras:** as mesmas do app mobile (`SistemaAG3.ai-Mobile`): React, Vite, TypeScript, Tailwind, Zod em toda
  resposta da API, testes com a API simulada e nenhum segredo no navegador.
- **Situação:** F1 feita (esqueleto, login com 2FA e sessão própria, menu por papel). Próximas: F2 carteira e
  cliente, F3 mensalidades em atraso, F4 novo workspace e equipe, F5 imagem e deploy no cluster.

## Rodar

Node 22 (`nvm use`):

```bash
npm install
npm run dev      # http://localhost:3100, API pelo proxy até o Django local (DEV_BACKEND_URL)
npm run lint && npm test && npm run build
```

O login é o do sistema, com o código por e-mail sempre pedido. Só entra quem é membro ativo de um parceiro ativo ou
da equipe AG3 (`support_staff`), cadastrados no Django Admin.
