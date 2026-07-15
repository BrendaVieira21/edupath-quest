
# Plano: Cloud + Área do Professor completa

## Parte 1 — Ativar Lovable Cloud (backend real)

Hoje tudo vive em `localStorage` (some se limpar o navegador, cada dispositivo é isolado). Vou ativar o Lovable Cloud para ter:

- Login real de aluno e professor (email + senha, com opção de Google depois)
- Dados por usuário salvos na nuvem
- A professora acessa de qualquer dispositivo e vê progresso em tempo real
- Base para futuras features (upload de mídia, notificações)

### Estrutura de dados

- `profiles` — dados do usuário (nome, avatar)
- `user_roles` — papéis (`teacher` / `student`), em tabela separada por segurança
- `lessons` — fases (title, emoji, description, content, order_index)
- `quiz_questions` — perguntas por lição
- `attachments` — anexos por lição
- `lesson_progress` — progresso do aluno (lesson_id, user_id, correct, total, completed_at, attempts)

Tudo com RLS: aluno lê lições e escreve só o próprio progresso; professor faz CRUD em lições e lê progresso de todos.

### Migração

- A primeira professora se cadastra e vira `teacher` (via convite ou primeiro usuário; vou usar a opção "código de convite" configurável).
- As lições atuais (seed) são criadas na migração inicial.
- O `app-store` atual será substituído por hooks TanStack Query batendo em server functions.

## Parte 2 — Área do professor mais completa

1. **Cadastro de alunos pela professora**
   - Convidar por email (gera senha temporária) OU criar login manualmente
   - Resetar senha do aluno

2. **Visão detalhada por aluno**
   - Clicar num aluno abre página com: fases concluídas, nota de cada quiz, data, número de tentativas
   - Barra de progresso e "última atividade"

3. **Editor de lição melhorado**
   - Botão **Duplicar lição** (acelera criação de conteúdo parecido)
   - Preview do conteúdo em Markdown ao lado do editor
   - Validação: não deixar salvar sem título/quiz

4. **Dashboard do professor**
   - Cards de resumo: total de alunos, alunos ativos na semana, média geral, fase mais difícil (pior taxa de acerto)
   - Lista de alunos com busca e ordenação

## Ordem de execução

1. Ativar Cloud
2. Criar migração (tabelas + RLS + seed das lições atuais)
3. Auth (login/signup, roles, guardas de rota)
4. Server functions e hooks para lessons, progresso, alunos
5. Reescrever telas atuais consumindo Cloud
6. Novas telas do professor (detalhe do aluno, cadastro, dashboard)

## Observações técnicas

- Roles em tabela separada (`user_roles`) + função `has_role()` SECURITY DEFINER — padrão obrigatório do Cloud.
- Rotas do aluno e do professor ficam sob `_authenticated/`, com verificação de role.
- A migração do localStorage é destrutiva: os dados atuais no navegador serão descartados (é ambiente demo).

Confirma que posso ir por esse caminho? Se quiser, posso começar só pela **Parte 2 sem ativar Cloud** (continuando em localStorage) — mais rápido, mas sem login real.
