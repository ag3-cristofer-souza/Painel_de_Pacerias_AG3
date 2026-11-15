# Painel de Parcerias — AG3

Front do Painel de Parcerias: o painel em que parceiros (white label) e a equipe AG3 acompanham a carteira de clientes,
criam workspaces e atendem chamados. **Todo o desenvolvimento desse front acontece neste repositório.**

- **Plano:** `docs/plano_parceiros_chamados.md`, no repositório do backend (`SistemaAG3.ai-Backend-Django`). A seção
  4.3 descreve este painel e a seção 9 traz as decisões.
- **Backend:** Django, no repositório `SistemaAG3.ai-Backend-Django` (apps `partners` e `support`). Este repositório não
  tem backend próprio.
- **Pilha e regras:** as mesmas do app mobile (`SistemaAG3.ai-Mobile`): React, Vite, TypeScript, Tailwind, Zod em toda
  resposta da API, testes com a API simulada e nenhum segredo no navegador.
- **Situação:** F1 a F5 escritas: login com 2FA e sessão própria, menu por papel, carteira e cliente, mensalidades e
  atrasados, novo workspace e equipe, imagem e deploy no cluster. Próximas: chamados (ondas 3 a 5 do plano).

## Rodar

Node 22 (`nvm use`):

```bash
npm install
npm run dev      # http://localhost:3100, API pelo proxy até o Django local (DEV_BACKEND_URL)
npm run lint && npm test && npm run build
```

O login é o do sistema, com o código por e-mail sempre pedido. Só entra quem é membro ativo de um parceiro ativo ou
da equipe AG3 (`support_staff`), cadastrados no Django Admin.

## Imagem e deploy

- `Dockerfile` + `docker/`: nginx servindo o build. O endereço da API entra quando o container sobe (`VITE_API_URL`,
  gravado em `/runtime-config.js`), e sem ele o container não sobe.
- `.github/workflows/ci.yml`: cada push e PR passa por verificações e segurança. No `main`, publica
  `ghcr.io/ag3-cristofer-souza/geon-parceiros` e implanta em `https://parceiros.ag3system.com` (Deployment `ag3-parceiros`).
- Subida inicial (DNS, chave `DEPLOY_SSH_KEY`, manifests, origem liberada na API): runbook A7.20 no backend
  (`docs/runbook_vps.md`).
- Testar a imagem na máquina:

  ```bash
  docker build -t ag3-parceiros:local .
  docker run --rm -p 8080:80 -e VITE_API_URL=https://api.ag3system.com ag3-parceiros:local
  ```
