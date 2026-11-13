# Painel de Parcerias — AG3

Front do Painel de Parcerias: o painel em que parceiros (white label) e a equipe AG3 acompanham a carteira de clientes,
criam workspaces e atendem chamados. **Todo o desenvolvimento desse front acontece neste repositório.**

- **Plano:** `docs/plano_parceiros_chamados.md`, no repositório do backend (`SistemaAG3.ai-Backend-Django`). A seção
  4.3 descreve este painel e a seção 9 traz as decisões.
- **Backend:** Django, no repositório `SistemaAG3.ai-Backend-Django` (apps `partners` e `support`). Este repositório não
  tem backend próprio.
- **Pilha e regras:** as mesmas do app mobile (`SistemaAG3.ai-Mobile`): React, Vite, TypeScript, Tailwind, Zod em toda
  resposta da API, testes com a API simulada e nenhum segredo no navegador.
- **Situação:** nada implementado. O código começa na onda 2 do plano, depois do backend da onda 1.
