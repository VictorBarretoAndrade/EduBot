@AGENTS.md

# Claude Code neste projeto

Rode os comandos a partir da raiz do repositório (`EduBot/`), não de `Back-End/`.

## Orquestração com o Antigravity

Requer a skill pessoal `antigravity` (`~/.claude/skills/antigravity/`, com o `agy`
logado). Sem ela, ignore esta seção e faça tudo direto.

O Claude decide, escreve e aplica; o `agy` procura, triagem e confere. Siga o
procedimento da skill (pedido fechado num arquivo em `<scratchpad>/agy/`, rodado da
raiz do repo, confira cada `caminho:linha` antes de usar). Rode em
`run_in_background` sempre que der para seguir trabalhando enquanto ele lê.

**Bons alvos de delegação aqui:**
- Achar no `LOG_EXECUCAO.md` (2 mil linhas) ou nos `PLANO_*.md` o porquê de uma decisão.
- Triar os ~35 `.md` da raiz: o que um doc desatualizado diz que diverge do código.
- Varreduras no front: "quais componentes chamam o endpoint X" (`src/services/api.ts`
  → `src/components/`), ou no backend: "quem lê a tabela Y".
- Rascunhos que o Claude revisa: casos de teste no estilo de `Back-End/tests/conftest.py`,
  traduções PT→EN (colunas `*_en`, `src/i18n.tsx`), seeds SQL de questões.
- **Segunda opinião** antes de concluir mudanças em autenticação (`api/auth.py`,
  `api/apikey.py`), migrations, `services/risk.py`, `services/mastery.py` (BKT) e o
  loop do agente (`agent/loop.py`, `agent/tools.py`).

**Não delegue:** nada que envolva os arquivos de segredo listados no `AGENTS.md`;
decisões de arquitetura; tarefas pequenas (fazer direto é mais rápido).
