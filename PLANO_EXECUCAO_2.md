# Plano de Execução 2 — Preferência de aprendizagem + Gamificação + Engajamento

> Continuação do `PLANO_EXECUCAO.md` (Etapas 1–6, concluídas e auditadas em
> 2026-07-10). Este plano ataca a próxima fronteira, definida com o produto em
> 2026-07-10: **(1)** o Reforço passa a perceber COMO cada aluno prefere aprender;
> **(2)** "Meu Desempenho" ganha uma camada gamificada (XP, níveis, conquistas,
> sequência e ranking); **(3)** melhorias de uso que fecham o ciclo (metas,
> deep-links, sino unificado, painel de engajamento do tutor).
>
> O plano original adiou gamificação "antes de personalização medida" — esse
> pré-requisito FOI entregue (BKT, learning_events, outcomes B.6). Agora é a hora.

## Decisões de produto (fechadas em 2026-07-10)

| Decisão | Escolha |
|---|---|
| Ranking entre alunos | **Opt-in com apelido**; semanal (zera toda segunda); quem não participa vê só a própria posição/percentil |
| O que pontua (XP/ranking) | **Esforço e constância** (concluir, revisar em dia, manter sequência). Nota/domínio NUNCA entra no ranking — vira conquista PESSOAL |
| Preferência de aprendizagem | **Formato completo**: conclusão por formato + resposta às intervenções por formato (outcomes B.6) + dificuldade confortável. Sem horário (fica p/ depois) |
| Recompensas de nível | **As três**: personas de avatar · insígnias/títulos · desafios avançados |

## Convenções (as mesmas do plano 1)

- **Esforço**: P (≤ meio dia) · M (1–3 dias) · G (1–2 semanas).
- **IDs**: P.x = preferência/personalização do reforço · G.x = gamificação ·
  R.x = recompensas · E.x = engajamento/experiência · H.x = histórico/ilustração
  de métricas.
- **Migrations**: idempotentes (`information_schema` + `PREPARE`), rodam em volume
  existente via `docker exec`. A numeração continua de onde parou: **014+**
  (013 permanece reservada para `avatar_licenses`, Etapa 6/V.4).
- **Testes**: todo passo de backend adiciona pytest (SQLite em memória).
- **Fallback**: nada quebra o modo `EDUBOT_LLM_PROVIDER=mock`; a gamificação
  inteira é **aditiva** e desligável (`EDUBOT_GAMIFICATION=off` → a UI esconde a
  camada e os hooks viram no-op).
- **Orçamento de queries**: o perfil (`/student/me`) continua **≤ 8 queries**
  (teste de contrato existente é o guardião — nada aqui pode inflá-lo).

## Princípios de design (não negociáveis)

1. **XP mede esforço, não talento.** Concluir módulo, revisar em dia, manter
   sequência. Acertar quiz NÃO dá XP de ranking — dominar competência dá
   **conquista pessoal** (e recompensa), invisível aos colegas. Um aluno com
   dificuldade pode vencer a semana.
2. **Anti-farm por construção.** XP só server-side; cada prêmio é idempotente
   (UNIQUE por aluno+regra+objeto+dia); teto diário por regra; nada de XP por
   evento bruto do front.
3. **LGPD primeiro.** Ranking é finalidade nova de consentimento
   (`ranking_turma`, opt-in) + apelido obrigatório; revogar esconde o aluno do
   ranking imediatamente; tutor continua vendo a turma pelo nome (interesse
   legítimo pedagógico, como hoje).
4. **Perder sequência não pune.** Streak quebrado zera o contador, nunca tira XP
   ganho; 1 "escudo" automático por semana (uma folga não quebra a chama).
5. **Gamificação serve à pedagogia**, não o contrário: toda mecânica aponta para
   um comportamento de estudo (concluir, revisar, voltar amanhã, tentar o
   desafio) — nunca para "ficar online".

## Mapa de dependências

```
ETAPA 7 (preferência no Reforço + histórico de domínio)
   │
   ├──► ETAPA 8 (gamificação núcleo: XP, conquistas, streak, ranking, UI)
   │            │
   └────────────┴──► ETAPA 9 (recompensas + metas + navegação + validação)
```

---

# ETAPA 7 — O Reforço percebe como o aluno aprende

**Objetivo**: a trilha de reforço, a recomendação e o redator passam a usar um
modelo de preferência REAL (conclusão por formato + o que funcionou nas
intervenções), e o backend começa a guardar o histórico diário de domínio que a
Etapa 8 vai ilustrar.
**Duração estimada**: 1–2 semanas.

## P.1 — Serviço de preferência de aprendizagem (M)

**Sem tabela nova.** Os três sinais já existem no banco:

1. **Conclusão por formato** — o perfil já agrega `consumption_by_type`
   (`{video: {total, consumidos, concluidos}, ...}`): taxa de conclusão =
   `concluidos/total`. É sinal mais forte que o `preferencia_formato` atual
   (que conta CONSUMO — começar um vídeo ≠ aprender com ele).
2. **Resposta a intervenções por formato** — `agent_decisions.input_digest`
   já carrega `formato_preferido`/tipo; cruzar com `outcome`
   (aceita/melhorou vs. dispensada) diz **a que formato de sugestão o aluno
   respondeu** (B.6 vira sensor de preferência).
3. **Dificuldade confortável** — `attempts × questions.difficulty`: em qual
   nível o aluno tem a melhor razão acerto/tentativa (já indexado, A.2/D.4).

```python
# edubot/services/preferences.py (novo)
def learning_preference(student_id, profile=None):
    """{formato, formato_fallback, confianca (0..1), taxa_conclusao_por_formato,
    respondeu_melhor_a, dificuldade_confortavel}.
    - `formato`: maior taxa de conclusão com >= MIN_SIGNALS (3) itens; empate ->
      desempata pelo outcome das intervenções; sem sinal -> None (confianca 0).
    - Se `profile` é passado (caminho do agente), reusa consumption_by_type
      SEM query extra; sozinho, faz as 2-3 queries agregadas próprias.
    - NUNCA no caminho do /student/me (o perfil fica em <= 8 queries)."""
```

- `confianca` baixa (< 0.4) ⇒ os consumidores tratam como "sem preferência"
  (comportamento atual). **Degradação segura é o default.**
- Expor no perfil apenas o que já é grátis: `preferencia_formato` passa a ser
  calculado por CONCLUSÃO (mesma query, muda a fórmula) — anunciar como
  "preferência v2" (nota de corte, como o domínio v2 do D.2).

**Teste**: aluno que conclui 3 vídeos e abandona 3 textos → `formato=video`,
`confianca>=0.5`; aluno sem conclusões → `formato=None`; digest de intervenções
dispensadas em texto + aceitas em vídeo → `respondeu_melhor_a=video`.

## P.2 — Reforço e OVA personalizada montados no formato do aluno (M)

1. **`listar_recursos_remediacao`** (tool): devolve os recursos **ordenados pelo
   formato preferido primeiro** (com `motivo_ordem: "preferencia_video"`) e
   ganha o campo `formato_preferido_do_aluno` no payload — o modelo real "vê" a
   preferência; o mock determinístico usa a MESMA ordem.
2. **`criar_ova_personalizada`**: mantém a ordem pedida pelo modelo (contrato
   atual), mas o **mock** passa a montar `resource_ids` começando pelo formato
   preferido — o comportamento de referência fica correto com e sem LLM.
3. **System prompt** do agente de reforço ganha a instrução: *"comece a trilha
   pelo formato em que o aluno mais conclui (campo formato_preferido...); se não
   houver material nesse formato, use o fallback"*.
4. **Rota/Front (`Reforco.tsx`)**: a OVA gerada mostra o chip
   **"No seu formato: 🎬 vídeo primeiro"** ao lado do "Foco: …" — o aluno
   percebe a personalização (é isso que gera confiança no agente).

**Teste de regressão**: `test_personalized_ova.py` continua verde; novo teste:
com preferência=video, o primeiro item da OVA é vídeo; sem material em vídeo na
competência, a trilha não vem vazia (fallback = ordem atual).

## P.3 — Recomendação e redator citam (e aprendem) o formato (P/M)

1. `evaluate_student`/digest do redator ganham `formato_preferido` e
   `respondeu_melhor_a` (P.1) — o Haiku é instruído a **propor no formato que
   funciona** ("preparei um vídeo curto — vi que é assim que você rende melhor")
   e a TROCAR de formato quando `historico_outcomes` mostra dispensas.
2. As **ações** das regras (mock) trocam a ordem: regra 3 (revisão alternativa)
   sugere primeiro o formato preferido (já existia `formato_preferido` raso —
   agora usa o sinal v2).
3. **Métrica de validação** (fecha o loop): o KPI do tutor (B.6) ganha recorte
   `taxa_aceitacao × formato_sugerido` — 1 GROUP BY a mais em `/tutor/agent-kpi`.

**Gate de saída da Etapa 7**: OVA de reforço abre pelo formato do aluno (visível
no chip); digest do redator carrega preferência; KPI por formato no painel;
perfil segue ≤ 8 queries; suíte verde.

## H.1 — Histórico diário de domínio (fundação das métricas ilustradas) (M)

*(entra aqui porque a Etapa 8 precisa de ~1 semana de snapshots acumulados)*

1. `migration_014_mastery_history.sql`:

```sql
CREATE TABLE IF NOT EXISTS student_mastery_history (
    student_id    INT NOT NULL,
    competency_id INT NOT NULL,
    snapshot_date DATE NOT NULL,
    p_mastery     FLOAT NOT NULL,
    PRIMARY KEY (student_id, competency_id, snapshot_date),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    FOREIGN KEY (competency_id) REFERENCES competencies(competency_id) ON DELETE CASCADE
);
```

2. Job no sweep diário (`run_class_evaluation`): upsert do snapshot do dia para
   todo aluno com linha em `student_mastery` (INSERT IGNORE — idempotente, rodar
   2× no dia não duplica).
3. Serviço `mastery_trend(student_id, days=7)` → `{competency_id: delta}`;
   `/student/me` NÃO muda (a tendência vai numa rota nova barata
   `GET /mastery/trend`, chamada só pela tela de desempenho).

**Teste**: 2 snapshots simulados a 7 dias → delta certo; job idempotente.

---

# ETAPA 8 — Gamificação núcleo (XP, conquistas, sequência, ranking)

**Objetivo**: a camada de jogo inteira — motor de XP anti-farm, conquistas,
streak com escudo, ranking semanal opt-in — e a reforma visual de
"Meu Desempenho" (nível, vitrine, tendências ilustradas, micro-momentos).
**Depende de**: Etapa 7 (H.1 acumulando; P.1 para conquista de formato).
**Duração estimada**: 2–3 semanas.

## G.1 — Motor de XP server-side (M/G)

1. `migration_015_gamification.sql`:

```sql
CREATE TABLE IF NOT EXISTS xp_events (
    xp_event_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    student_id  INT NOT NULL,
    rule        VARCHAR(40) NOT NULL,     -- modulo_concluido|revisao_em_dia|...
    object_type VARCHAR(20) NULL,
    object_id   INT NULL,
    points      INT NOT NULL,
    awarded_on  DATE NOT NULL,
    created_at  DATETIME NOT NULL,
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
    CONSTRAINT uc_xp UNIQUE (student_id, rule, object_type, object_id, awarded_on),
    INDEX idx_xp_student_week (student_id, awarded_on)
);

CREATE TABLE IF NOT EXISTS student_streak (
    student_id INT PRIMARY KEY,
    current_days INT NOT NULL DEFAULT 0,
    best_days INT NOT NULL DEFAULT 0,
    last_activity_date DATE NULL,
    shield_used_on DATE NULL,             -- escudo semanal (1 folga não quebra)
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_achievements (
    student_id INT NOT NULL,
    achievement_id VARCHAR(40) NOT NULL,  -- catálogo vive no código
    unlocked_at DATETIME NOT NULL,
    PRIMARY KEY (student_id, achievement_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);
```

2. `edubot/services/gamification.py` — regras em constantes (mesmo espírito dos
   thresholds do BKT):

```python
XP_RULES = {                      # pontos, teto/dia (0 = 1x por objeto, sem teto diário)
    "modulo_concluido":   (40, 0),   # transição de conclusão do OVA (D.1 completed)
    "quiz_do_modulo":     (15, 0),   # terminou o quiz do módulo (independe de nota!)
    "revisao_em_dia":     (30, 0),   # respondeu revisão na data (D.3 register_result)
    "dia_de_estudo":      (10, 1),   # 1º evento de aprendizado do dia (streak)
    "pergunta_ao_tutor":  ( 5, 2),   # perguntar é esforço; teto 2/dia (anti-spam)
    "meta_semanal":       (50, 0),   # Etapa 9 (E.3)
    "desafio_tentado":    (20, 0),   # Etapa 9 (R.3) — por TENTAR, não por acertar
}
def award(student_id, rule, object_type=None, object_id=None, today=None):
    """Idempotente (uc_xp) + teto diário. Best-effort: nunca quebra a rota.
    Retorna pontos concedidos (0 se dedup/teto/desligado)."""
```

3. **Ganchos** (todos em pontos que JÁ emitem evento — nenhuma rota nova de
   escrita): `progressRoute` (conclusão), `questionRoute` (última questão do pool
   respondida), `reviews.register_result` (em dia), `events.emit`
   (1º evento do dia → `dia_de_estudo` + atualiza streak), `edubotRoute`
   (tutor-chat). Flag global `EDUBOT_GAMIFICATION` (default `on`).
4. Nível derivado (sem coluna): `level = 1 + floor(sqrt(xp_total / 60))` —
   curva suave, constante ajustável.

**Testes**: award idempotente (2 chamadas = 1 linha); teto diário respeitado;
flag off → 0 pontos e rotas intactas; nível pelas faixas.

## G.2 — Conquistas (badges) (M)

Catálogo **no código** (`ACHIEVEMENTS`), checagem barata disparada após cada
`award` (e no login, para as retroativas):

| id | Nome | Critério (fonte já existente) |
|---|---|---|
| `primeiro_modulo` | Primeiro passo | 1º `modulo_concluido` |
| `revisor_pontual` | Revisor pontual | 5 `revisao_em_dia` |
| `sequencia_7` | Semana perfeita | streak ≥ 7 |
| `mestre_competencia` | Mestre em {X} | BKT ≥ 0.8 numa competência (pessoal!) |
| `curioso` | Curioso | 5 `asked_tutor` |
| `trilha_completa` | Trilha completa | todos os OVAs do curso concluídos |
| `desafiante` | Desafiante | 1º desafio avançado tentado (Etapa 9) |
| `no_seu_formato` | Do seu jeito | concluiu uma OVA de reforço personalizada |

- Desbloqueio grava `student_achievements` + **emite `learning_event`**
  (`verb=completed, object_type=achievement`? — NÃO: verbos são enum fechado;
  usar `context.kind="achievement"` num evento `completed` de `object_type=
  session`) e devolve no payload para o front celebrar (toast + avatar fala).
- Conquistas de DESEMPENHO (`mestre_competencia`) existem — mas são pessoais,
  nunca somam no ranking (princípio 1).

**Teste**: critérios disparam 1x; retroativo no login não duplica.

## G.3 — Sequência (streak) com escudo (P/M)

- Atualizada no 1º evento do dia (gancho do G.1): ontem estudou → `+1`;
  buraco de 1 dia e escudo disponível na semana → consome escudo e mantém;
  buraco maior → zera (best_days preservado).
- `GET /gamification/me` devolve `{current_days, best_days, shield_available}`.

**Teste**: sequência cresce; escudo segura 1 folga; 2 folgas zeram; best mantém.

## G.4 — Ranking semanal opt-in com apelido (M)

1. `migration_016_nickname.sql`: `ALTER TABLE students ADD COLUMN nickname
   VARCHAR(40) NULL` (idempotente, padrão das migrations 010/012).
2. **Consentimento**: nova finalidade `ranking_turma`
   (`opt_in: True, default_granted: False`) em `PURPOSES` — **zero migration**
   (a tabela consents já é genérica); aparece automaticamente em "Meus dados".
3. Opt-in é **contextual**, não no modal de 1º login: o card do ranking mostra
   "Participar do ranking da turma" → pede apelido → grava nickname + consent.
   Revogou → some do ranking na hora (o SELECT filtra pelo consent).
4. `GET /gamification/leaderboard` (auth): **soma de XP da semana ISO corrente**,
   só alunos do curso COM `ranking_turma` concedido; devolve top 10
   `{apelido, xp_semana, nivel}` + `me: {rank, percentil, xp_semana}` (o próprio
   sempre se vê, mesmo sem opt-in — vê a posição, não os outros).
5. Segunda-feira zera naturalmente (filtro por semana — sem job).
6. Tutor: vê o ranking com **nome real + apelido** no painel (gestão pedagógica,
   mesmo enquadramento do heatmap D.6).

**Testes**: sem opt-in → aluno não listado mas `me.rank` presente; revogação
esconde; semana ISO corta certo; apelido obrigatório para participar.

## G.5 — "Meu Desempenho" gamificado + métricas ilustradas (M/G)

*(front — Recharts e o design system atuais; nada de lib nova)*

1. **Cabeçalho de jornada**: avatar + **nível com barra de XP** (e quanto falta),
   **chama da sequência** (🔥 + escudo), XP da semana.
2. **Vitrine de conquistas**: grid com desbloqueadas coloridas e bloqueadas em
   silhueta + critério ("faltam 2 revisões em dia") — mostrar o caminho é o que
   engaja, não a medalha.
3. **Teia de competências 2.0**: mantém o radar, adiciona **setas de tendência**
   (↑↓→ via H.1, delta 7d) e mini-sparkline por competência no hover/lista.
4. **Card do ranking** (G.4): top 10 por apelido + "você está em #4 · top 20%";
   CTA de opt-in para quem está de fora.
5. **"Minha semana em números"**: módulos concluídos, revisões em dia, dias
   estudados vs. semana anterior (1 query em `xp_events`) — barras simples.
6. Acessibilidade U.7 mantida: tendências também em texto (`aria-label`),
   `prefers-reduced-motion` desliga confetes/chama animada.

## G.6 — Micro-momentos (dashboard e quiz) (P/M)

- **Quiz**: ao terminar o pool, painel de fechamento "+15 XP · 🔥 3 dias" (o
  feedback certo/errado por questão fica como está — nota não vira festa,
  princípio 1); conquista nova → confete leve + avatar comemora (`speaking`).
- **Dashboard**: chip da sequência no topo + "próxima conquista" (a mais perto
  de desbloquear) + XP da semana no cabeçalho.
- Tudo atrás de `EDUBOT_GAMIFICATION` (off → dashboard atual intacto).

**Gate de saída da Etapa 8**: XP fluindo pelos 5 ganchos (idempotente, capado);
conquistas com retroativo; streak com escudo; ranking respeitando opt-in/apelido
(inclusive revogação); "Meu Desempenho" com nível/vitrine/tendências/ranking;
axe/teclado ok; `EDUBOT_GAMIFICATION=off` devolve a plataforma exatamente atual;
suíte verde.

---

# ETAPA 9 — Recompensas, metas e o ciclo completo

**Objetivo**: dar consequência ao nível (personas, títulos, desafios), deixar o
aluno assumir metas, remover os últimos atritos de navegação e MEDIR se a
gamificação funcionou.
**Depende de**: Etapa 8.
**Duração estimada**: 2–3 semanas.

## R.1 — Personas de avatar por nível/conquista (P/M) — ⚠️ REVOGADA no Plano 3 (AV.1)

> **REVOGADA em 2026-07-14 (PLANO_EXECUCAO_3.md, AV.1).** A decisão de produto mudou:
> as personas deixam de ser recompensa de gamificação e passam a ser **ferramenta de
> estudo, LIVRES para todos desde o 1º acesso**. `PERSONA_UNLOCK` foi removido;
> `personas_state()` devolve tudo `unlocked=True`; o cadeado saiu do `PerformanceCoach`;
> a persona passou a ser atributo do aluno (`students.persona`), desacoplada da
> gamificação. As recompensas de nível continuam sendo R.2 (títulos/insígnias) e R.3
> (desafios). Texto original abaixo mantido por rastreio histórico.

- ~~`AVATAR_PERSONAS` ganha `unlock: {level: N}` (EduBot livre; Einstein nível 3;
  Curie nível 5; futuros GLB do V.3 entram aqui).~~
- ~~`PerformanceCoach`: persona bloqueada aparece com cadeado + "nível 3";
  desbloquear dispara celebração; a validação de nível é conferida no backend ao
  servir `GET /gamification/me` (o front não é fonte de verdade).~~

## R.2 — Títulos e insígnias de perfil (P)

- Conquista concede **título** ("Revisor Pontual", "Mestre em Lógica");
  o aluno escolhe o título ativo (coluna `students.title` — junto na
  migration_016) e ele aparece no cabeçalho do dashboard/apelido do ranking.
- Moldura do avatar por faixa de nível (CSS, zero asset novo).

## R.3 — Desafios avançados (M)

- Competência com BKT ≥ 0.8 desbloqueia o **modo desafio**: `/question/ova`
  com `{"desafio": true}` serve SÓ as questões `difficulty=3` da competência
  dominada (reusa o pool adaptativo; validação server-side: sem domínio → 403
  como o gate U.1).
- XP `desafio_tentado` por TENTAR (esforço), conquista `desafiante`; acertar
  alimenta o BKT normalmente (pode agendar revisão mais longa — D.3 já cuida).
- Front: card "Desafio disponível 🏆" na competência dominada (Evolution) +
  entrada pela Regra 5 do agente (aprofundamento), que finalmente ganha um alvo
  clicável.

**Teste**: desafio sem domínio → 403; pool só difficulty 3; XP por tentativa 1x.

## E.3 — Metas semanais (M)

1. `migration_017_weekly_goals.sql`: `weekly_goals(goal_id, student_id,
   week_start DATE, kind VARCHAR(30), target INT, progress INT, status,
   UNIQUE(student_id, week_start, kind))`.
2. Segunda-feira (sweep): o EduBot **sugere** 2 metas do tamanho do aluno
   (regras: histórico da semana anterior + revisões agendadas — ex.: "estude em
   3 dias", "feche 1 módulo", "2 revisões em dia"); o aluno aceita/ajusta no
   dashboard (1 clique).
3. Progresso atualizado pelos MESMOS ganchos do XP (G.1 — zero telemetria nova);
   cumprir → `meta_semanal` (+50 XP) + fala do avatar.
4. Intervenção de meio de semana se 0 progresso até quinta (dedupada, D.3-style).

**Teste**: sugestão dimensionada; progresso pelos ganchos; XP 1x; semana vira e
arquiva.

## E.1 — Deep-links de módulo (retoma U.8) (M)

- Rotas `#/modulo/:id` e `#/modulo/:id/quiz` no hash router (o parser já foi
  desenhado no plano 1 — U.8); `readerOva` passa a derivar da rota (F5 e
  voltar/avançar funcionam dentro do módulo).
- **Toda intervenção/meta/revisão passa a LINKAR o alvo** ("hora de revisar X" →
  `#/modulo/3/quiz`) — o clique vira ação de 1 passo; o outcome `aceita` (B.6)
  fica mais fiel (abriu o alvo, não "abriu qualquer coisa").

## E.2 — Sino unificado (retoma U.3) (P)

- O sino da topbar passa a consumir `getInterventions()` (mesma fonte do card do
  dashboard) via hook compartilhado `useInterventions()` — badge = pendentes de
  verdade; agir/dispensar dali mesmo.

## E.4 — Painel de engajamento do tutor + validação (M)

1. `GET /tutor/engagement`: participação no ranking, distribuição de streaks,
   XP médio da semana, **alunos prestes a perder a sequência** (não estudam há
   1 dia e sem escudo) — vira alvo de intervenção de 1 clique do tutor
   (`propor_mensagem_do_tutor` pré-preenchida — a fila B.5 já existe).
2. **Validação da gamificação (o gate honesto)**: comparar 4 semanas antes ×
   4 semanas depois via `learning_events` (já coletados desde a Etapa 3):
   dias ativos/aluno/semana, revisões em dia (D.3), conclusão de módulos e taxa
   de aceitação de intervenções (B.6). Card "antes × depois" no painel
   admin/tutor. Se não mexer o ponteiro, a Etapa 9.5 é RECALIBRAR, não adicionar
   mecânica.

**Gate de saída da Etapa 9**: personas/títulos/desafios desbloqueando pelo
backend; metas sugeridas→aceitas→cumpridas fechando com XP; intervenções com
deep-link direto ao alvo; painel de engajamento comparando antes×depois;
suíte verde; `EDUBOT_GAMIFICATION=off` continua devolvendo a plataforma clássica.

---

# Checklist mestre (ordem de execução)

```
ETAPA 7  [x] P.1 serviço de preferência (conclusão+outcomes+dificuldade)
         [x] P.2 reforço/OVA no formato do aluno (+chip no front)
         [x] P.3 redator/regras citam formato + KPI por formato
         [x] H.1 mastery_history (migration_014) + snapshot no sweep + /mastery/trend
         — ETAPA 7 CONCLUÍDA (174 testes; build front exit 0; validada no stack real:
           /mastery/trend delta +0.22 up; reforço degrada p/ 201 com token expirado).
           Bônus: fix de degradação graciosa no loop do agente. Ver LOG_EXECUCAO.md.
ETAPA 8  [x] G.1 motor de XP (migration_015) + ganchos + flag
         [x] G.2 conquistas (catálogo + retroativo)   [x] G.3 streak com escudo
         [x] G.4 ranking semanal opt-in + apelido (migration_016 + purpose ranking_turma)
         [x] G.5 Meu Desempenho gamificado (nível/vitrine/tendências/ranking)
         [x] G.6 micro-momentos (quiz + dashboard)
         — ETAPA 8 CONCLUÍDA (189 testes; build front exit 0; validada no stack real:
           XP/nível/streak/conquistas/ranking opt-in ponta a ponta). Ver LOG_EXECUCAO.md.
ETAPA 9  [x] R.1 personas por nível  [x] R.2 títulos/insígnias  [x] R.3 desafios avançados
         [x] E.3 metas semanais (migration_017)  [x] E.1 deep-links #/modulo/:id
         [x] E.2 sino unificado     [x] E.4 engajamento do tutor + antes×depois
         — ETAPA 9 CONCLUÍDA (203 testes; build front exit 0; validada no stack real).
           PLANO 2 COMPLETO (Etapas 7–9). Ver LOG_EXECUCAO.md.
AUDITORIA[x] Revisão de consistência das Etapas 7–9 (2026-07-11): 6 defeitos encontrados e
           CORRIGIDOS — métrica antes×depois contava eventos e não dias (E.4), display do
           streak ignorava o escudo (G.3), título quebrado em EN (R.2), 403 ambíguo no modo
           desafio (R.3), apelido duplicável na turma (G.4), varredura de conquistas em todo
           sync (perf). 207 testes verdes; validado no MySQL real. Ver LOG_EXECUCAO.md.
```

# Migrations novas (consolidado)

014 mastery_history · 015 gamification (xp_events, student_streak,
student_achievements) · 016 students.nickname + students.title ·
017 weekly_goals. **013 segue reservada** (avatar_licenses, V.4).
Todas idempotentes, mesmo padrão das 003–012.

# Variáveis de ambiente novas

| Variável | Default | Etapa |
|---|---|---|
| `EDUBOT_GAMIFICATION` | `on` | 8 (G.1) |
| `EDUBOT_XP_LEVEL_BASE` | `60` (curva de nível) | 8 (G.1) |
| `EDUBOT_LEADERBOARD_SIZE` | `10` | 8 (G.4) |

*(lembrete operacional: adicioná-las TAMBÉM ao passthrough do `compose.yaml` —
lição da auditoria das Etapas 1–6.)*

# O que este plano deliberadamente NÃO faz

- **Moeda virtual/loja** — recompensas são status e acesso pedagógico, não economia.
- **Ranking por nota/domínio** — desempenho é sempre pessoal (decisão de produto).
- **Punição** — perder streak não tira XP; nada de "vergonha pública".
- **Notificações externas** (e-mail/push) — o canal continua sendo a plataforma.
- **Mudar o BKT/regras pedagógicas** — a gamificação decora o ciclo, não o altera.
- **Lib nova de UI/animação** — Recharts + CSS do design system dão conta.

*Plano criado em 2026-07-10, após as decisões de produto registradas acima.
Execução no mesmo protocolo dos planos anteriores: uma etapa por vez, logs em
`LOG_EXECUCAO.md`, suíte e build verdes a cada gate.*
