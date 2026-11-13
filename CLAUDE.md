# Instruções do projeto: Painel de Parcerias AG3

Painel web em que os parceiros (white label) e a equipe AG3 acompanham a carteira de clientes, as mensalidades, a equipe
do parceiro e, nas próximas ondas, os chamados. React + Vite + TypeScript, consumindo a API do Django. Responda em
português, curto.

**Plano: `docs/plano_parceiros_chamados.md`, no backend (`../SistemaAG3.ai-Backend-Django`), seções 4.3, 9 e 13.**
O backend tem CLAUDE.md próprio, que vale ao mexer lá. Padrões de código vêm do app mobile (`../SistemaAG3.ai-Mobile`).

## O que você NUNCA faz

1. `git commit` ou `git push`: quem commita é o Daniel. `status`, `diff` e `log` pode.
2. Chamar a API de produção ou qualquer provedor real. Testes usam a API simulada (`vi.mock` dos módulos de `src/api/`).
3. Colocar segredo no repositório ou no navegador.
4. Usar outro token que não a sessão própria do painel (`ag3s_…`, `client.system = "parceiros"`): ela não abre o painel
   nem o app, e sair encerra só ela.

## O que pode rodar

Sempre com Node 22 (`nvm use`): `npm run lint`, `npm test`, `npm run build`, `npm run format`. Tudo simulado.
`npm run dev` sobe na porta 3100, com a API pelo proxy do Vite até o Django local (`DEV_BACKEND_URL`, padrão
`http://localhost:8000`).

## Como se programa aqui

- Regra de acesso é do servidor. O menu por papel (`src/features/shell/navigation.ts`) só organiza a tela.
- Toda resposta da API passa por um schema Zod em `src/api/`.
- Mudança de backend: só aditiva, pela esteira do backend, com a suíte de lá.
- Tudo que o painel decide sobre o cliente (suspender, adiar a suspensão, registrar pagamento) precisa estar explicado
  na tela, com as datas do próprio cliente: quem usa não conhece a regra (D20).
- Sem a marca AG3 nos textos que o parceiro repassa ao cliente (white label). O selo "AG3" só aparece para a equipe AG3.

## Ciclo

código → lint, testes e build verdes → Daniel commita. Mudou o backend: ele roda a suíte de lá e aplica pela esteira.
