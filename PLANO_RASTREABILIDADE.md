# Plano de Rastreabilidade — EduBot (Adapta)

> **Natureza deste documento:** especificação técnica produzida por auditoria de código
> (arquitetura de learning analytics), destinada a ser executada pelo **Claude Opus**
> sem perguntas adicionais. Não contém código — contém contratos de eventos, payloads,
> caminhos de arquivo e ordem de execução. Onde a informação do código não permitiu
> decidir com segurança, o item está marcado como **[DECISÃO EM ABERTO]**.
>
> **Escopo auditado:** `Back-End/edubot/` (rotas + serviços), `Back-End/edubot/agent/`,
> `Front-End/react-logic-demo/src/` (leitor de OVA, players, quizzes, fila de eventos),
> `Database/sql/` (DDL + DML seed + migrations 001–018).

---

## 1. Estado Atual (Auditoria)

### 1.1 O que é rastreado hoje (com origem)

| # | Sinal | Onde é capturado (front) | Onde persiste (back) | Tabela |
|---|---|---|---|---|
| T1 | Tempo de leitura do OVA (segundos ativos, por **delta**) | `src/components/ova/OvaReader.tsx` (ticker 1 s com gate de visibilidade + idle 180 s; sync a cada 15 s e no `pagehide` com keepalive) | `POST /progress/ova` — `edubot/api/routes/progressRoute.py` (acumulação atômica `COALESCE(read_time,0)+delta` no banco) | `ova_progress.read_time` |
| T2 | % de scroll do OVA (marca-d'água, medida sobre o conteúdo) | `OvaReader.tsx` (`readingPerc()` sobre `contentRef`) | mesma rota, `max()` | `ova_progress.perc_scrolled` |
| T3 | Conclusão do OVA (scroll ≥ 90 % ou página curta ≥ 20 s) | `OvaReader.tsx` (`isCompleted()`) | mesma rota; na transição emite evento `completed` + gatilho de proatividade | `ova_progress.completed` |
| T4 | Consumo de vídeo | `src/components/players/VideoPlayer.tsx` (checkpoints de 10 % da **posição** máxima; YouTube via polling 1 s, HTML5 via `timeupdate`) | `POST /progress/resource` (`max()` de perc e seconds) | `resource_progress` |
| T5 | Consumo de podcast (tempo **real** de escuta, 1 s/s tocando) | `src/components/players/AudioPlayer.tsx` | mesma rota | `resource_progress` |
| T6 | Atividade prática (botão "Marcar como concluída") | `OvaReader.tsx` (`completeActivity`) | mesma rota | `resource_progress.completed` |
| T7 | Tentativas de quiz (certas e erradas) + 1ª resposta correta | `src/components/Quiz.tsx` e `src/components/ova/OvaQuiz.tsx` | `POST /question/answer` — `questionRoute.py` (correção server-side; idempotência A7) | `attempts`, `answers` |
| T8 | `response_ms` por questão (esforço) | ambos os quizzes | contexto do evento `answered` | `learning_events.context` |
| T9 | Domínio por competência (BKT 4 parâmetros + decaimento semanal) | — (derivado) | `edubot/services/mastery.py` (`update_on_attempt`, síncrono no `/question/answer`) | `student_mastery` (+ histórico diário em `student_mastery_history`) |
| T10 | Revisão espaçada (SM-2 simplificado) | — (derivado) | `edubot/services/reviews.py` | `review_schedule` |
| T11 | Eventos de aprendizado xAPI-lite (lote de 15 s, `pagehide` keepalive) | `src/services/events.ts` (fila) | `POST /events` → `edubot/services/events.py` (`emit_batch`, enum de verbos) | `learning_events` |
| T12 | Interações legadas (strings livres: `ova_opened`, carrossel, acordeão, `ova_assistant_opened`) | `OvaReader.tsx` (`logInteraction`), `Carousel/Accordion` | `POST /interaction/register` — `interactionRoute.py` | `interactions` |
| T13 | Perguntas ao tutor IA (texto só com consentimento LGPD `ia_sobre_dados`) | painel do tutor | `edubotRoute.py:153` (`asked_tutor`) com minimização em `events.py` | `learning_events` |
| T14 | Intervenções/alertas do agente proativo (+ trilha de decisão com digest minimizado) | — | `edubot/services/proactivity.py`, `decisions.py` | `interventions`, `alerts`, `agent_decisions` |
| T15 | Gamificação (XP, sequência diária, conquistas, metas) | — | `edubot/services/gamification.py`, `goals.py` | tabelas de gamificação (migrations 015/017) |
| T16 | Inatividade (`dias_sem_acesso` = MAX de 5 fontes em UNION) | — | `student_context.py::_days_without_access` | derivado |
| T17 | Login | `src/components/Login.tsx:31` (`logged_in`/`session`) | `POST /events` | `learning_events` |
| T18 | Telemetria do companheiro de estudo (falou/ouviu/dispensou/explicou; TTS de seção) | `src/hooks/useCompanionScript.ts:62–73`, `OvaReader.tsx:141,478` | **NUNCA PERSISTE — ver P1** | — |

**Pontos fortes a preservar** (não regredir): tempo por delta com soma atômica no
banco (corrige double counting entre abas); correção de quiz 100 % server-side;
idempotência de tentativas (A7); conversão de fuso UTC→local em `events.py::_parse_dt`;
fila de eventos com `pagehide`+keepalive; minimização LGPD no backend (não na UI).

### 1.2 Problemas encontrados (bugs, lacunas, dados que mentem)

**P1 — GRAVE (métrica mente): toda a telemetria do companheiro é descartada em silêncio.**
O front emite os verbos `companion_spoke`, `companion_listened`, `companion_dismissed`
(`useCompanionScript.ts:62,69,73`), `companion_explain` (`OvaReader.tsx:478`) e
`played`/`ova_section` (`OvaReader.tsx:141` — TTS de seção). Nenhum deles existe nos
enums `VERBS`/`OBJECT_TYPES` de `edubot/services/events.py:23–27`, então `emit_batch`
os conta como "erro" e **não grava**. Enquanto isso, o painel de engajamento do
professor consulta exatamente esses verbos (`tutorRoute.py:530–534`) — o bloco
"Companheiro de estudo" **sempre exibirá zero**, independentemente do uso real.
É o caso clássico de dashboard que afirma medir algo que o pipeline nunca gravou.

**P2 — GRAVE (métrica mente): "% assistido" de vídeo é posição máxima, não consumo.**
`VideoPlayer.tsx` marca checkpoints de 10 % sobre a **posição corrente** do player:
um *seek* para o final marca 10→100 % instantaneamente sem assistir nada;
`seconds` reportado é a posição (`Math.round(current)`), não tempo assistido —
persiste em `resource_progress.seconds_consumed` com nome enganoso. Pausas, replays,
seeks, velocidade de reprodução e ponto de abandono não são capturados. Os verbos
`played`/`paused`/`seeked` existem no enum do backend, mas **nenhum player os emite**
(enum órfão). O polling do YouTube continua contando com a aba oculta.
Contraste: o `AudioPlayer` mede tempo real de escuta corretamente — o vídeo é a exceção.

**P3 — MÉDIO (métrica inconsistente): `response_ms` inflado no quiz standalone.**
`OvaQuiz.tsx:79–80` re-baseia o cronômetro após cada submissão (correto).
`Quiz.tsx:112–119` corrige o lote inteiro num loop e usa o MESMO
`Date.now() - loadedAtRef` para todas as questões — a média de esforço fica
inflada e duplicada por questão no quiz da aba "Quiz". Mesma métrica, duas semânticas.

**P4 — MÉDIO (dívida): `interactions` é redundante e não agregável.**
Strings PT livres, data/hora gravadas como strings formatadas
(`interactionRoute.py:46–52`), sem enum. Hoje só alimenta `dias_sem_acesso` e
`active_student_ids`. Convive em double-write com `learning_events`
(`OvaReader.tsx:206–211` grava `ova_opened` E `opened`). Plano de aposentadoria já
anunciado nos comentários, nunca executado.

**P5 — LACUNA CENTRAL: não existe rastreamento por seção/assunto dentro do OVA.**
`ovaContent.ts` já estrutura o conteúdo em `sections[]` com identidade estável, mas o
rastreio é do OVA inteiro (1 número de tempo + 1 de scroll). O professor não vê ONDE
o aluno travou. Único sinal por seção era o TTS — que é descartado (P1).

**P6 — MENOR: bordas do idle/visibilidade.** Duas abas visíveis do mesmo OVA contam
tempo em dobro (o delta de ambas soma no servidor). Idle de leitura usa 180 s +
visibilidade (bom); vídeo não tem gate algum (P2).

**P7 — MENOR: `active_student_ids` (`proactivity.py:211–224`) não olha
`learning_events` nem `resource_progress`** — aluno que só assistiu mídia ou só logou
fica invisível ao sweep e ao painel (mitigado na prática porque abrir o leitor grava
`ova_opened` em `interactions`; a mitigação morre junto com a aposentadoria do P4 —
migrar as fontes JUNTO).

**P8 — MÉDIO: fonte de verdade dividida no consentimento LGPD.**
`ConsentModal.tsx` grava flag em `localStorage` (`edubot.consent.v1`); se a flag
existe, o modal não reaparece — mas o backend pode não ter registro em `consents`
(ex.: navegador trocado, flag setada sem POST concluído). O enforcement de `events.py`
consulta o backend (correto), porém a UI acredita no localStorage. Resultado real
observado: catálogo do gestor com "Consentimentos LGPD: 0 registros" numa turma ativa.
**[DECISÃO EM ABERTO]** confirmar o fluxo desejado: propor que a flag local seja só
cache e o `/consents` do backend seja consultado no login (custo: 1 GET).

**P9 — LACUNA: "em risco" é unidimensional.** `tutorRoute.py` (overview) e
`TutorPanel.tsx` usam apenas `taxa_erro > 0.5`. Inatividade prolongada, queda de
domínio (tendência), revisões vencidas acumuladas e consumo baixo não entram. Ver §5.4.

**P10 — LACUNA (reforço): cobertura desigual do seed.** Ver §6.1 — competências 7–9
têm só 2 questões cada; remediação das competências 2, 3, 6, 8 e 9 é só-vídeo
(sem formato alternativo para a personalização por preferência); recursos `quiz` e
`atividade` têm `competency_id` NULL.

**P11 — MENOR (UX de revisão):** o botão "Revisar" (`ReviewsPanel.tsx`) abre o quiz
do OVA inteiro (via `MIN(ova_id)` da competência em `reviewRoute.py`); não filtra as
questões da competência da revisão — o resultado da revisão pode ser diluído por
questões de outras competências do mesmo OVA.

**P12 — NOTA (por design, documentar):** o gatilho de proatividade por evento
deduplica por (aluno, dia) com qualquer intervenção pendente
(`proactivity.py:196–204`) — o primeiro sinal do dia "ganha". Comportamento correto
para custo, mas o professor deve saber que 1 intervenção/dia é o teto por evento.

---

## 2. Eventos e Métricas Propostas

### 2.1 Convenções globais (aplicam-se a TODOS os eventos novos)

- **Camada de captura:** frontend → fila existente `src/services/events.ts` (lote de
  15 s + `pagehide` keepalive). Não criar segundo canal.
- **Camada de validação/persistência:** `edubot/services/events.py` — os enums
  `VERBS`/`OBJECT_TYPES` são a fonte única; todo verbo/tipo novo DEVE ser adicionado lá
  e coberto por teste.
- **`session_id`** (novo, obrigatório em todo contexto de evento do front): UUID v4
  gerado por aba no login/boot do app, mantido em `sessionStorage`. Permite separar
  múltiplas sessões/abas do mesmo aluno sem tabela nova (fica em
  `learning_events.context.session_id`).
- **Timestamps:** manter o contrato atual (front manda ISO UTC; `_parse_dt` converte
  para local naive). Não introduzir um segundo padrão.
- **Regra anti-spam:** nenhum evento novo pode ter cadência natural menor que 10 s,
  exceto transições discretas (play/pause/seek). Agregados (tempo por seção, segmentos
  de vídeo) viajam por UPSERT de progresso, não por evento — eventos carregam
  transições, agregados carregam volumes (ver tradeoff em §3.4).

### 2.2 Correções de contrato (Fase 0 — "parar de mentir")

| Item | Mudança | Onde |
|---|---|---|
| E0.1 | Adicionar aos enums: verbos `companion_spoke`, `companion_listened`, `companion_dismissed`, `companion_explain`, `rate_changed`, `idle_start`, `idle_end`, `section_read`; object_type `ova_section` | `edubot/services/events.py:23–27` + migração de comentário em `migration_006` (documentação da coluna) |
| E0.2 | `response_ms` por questão no quiz standalone: re-basear o cronômetro por questão corrigida (mesma semântica do `OvaQuiz.tsx:80`) | `Front-End/react-logic-demo/src/components/Quiz.tsx` (função `finishQuiz`) |
| E0.3 | Players passam a emitir os verbos já existentes: `played` (no play), `paused` (no pause, com posição), `seeked` (com `{from_s, to_s}`), `completed` (no ended) — object_type `resource` | `VideoPlayer.tsx`, `AudioPlayer.tsx` |
| E0.4 | Renomear semanticamente o que hoje é posição: ver §3 (novas colunas; `seconds_consumed` deixa de receber posição de vídeo) | `progressRoute.py`, `VideoPlayer.tsx` |
| E0.5 | Consentimento: no boot autenticado, sincronizar a flag local com `GET /consents` (backend é fonte de verdade; localStorage vira cache) | `ConsentModal.tsx`, `src/App.tsx` |

### 2.3 Eventos novos

| Evento (verbo/objeto) | Gatilho | Payload (`context`) | Camada | Edge cases |
|---|---|---|---|---|
| `section_enter` / `ova_section` | ≥ 50 % da seção visível no viewport por ≥ 1 s (IntersectionObserver) | `{section_id: string, section_index: int, ova_id: int, session_id}` | front (OvaReader) | rolagem rápida atravessando a seção: o requisito de 1 s suprime; duas seções simultaneamente visíveis: ambas contam (tela grande é leitura paralela legítima) |
| `section_exit` / `ova_section` | seção sai do critério acima, OU `pagehide`, OU troca de OVA | `{section_id, section_index, ova_id, active_seconds: int, max_scroll_perc: int, session_id}` | front | `active_seconds` usa o MESMO gate de idle/visibilidade do ticker existente (`OvaReader.tsx:280–292`); exit por `pagehide` viaja no flush keepalive |
| `idle_start` / `session` | 180 s sem atividade com aba visível (reusar `IDLE_LIMIT_SECONDS`) | `{ova_id?, session_id}` | front | disparar UMA vez por período idle; retorno de atividade emite `idle_end` |
| `idle_end` / `session` | primeira atividade após idle | `{idle_seconds: int, session_id}` | front | se a aba fechar durante o idle, o `idle_end` nunca vem — consumidores devem tratar idle aberto como "sessão terminou" |
| `rate_changed` / `resource` | mudança de velocidade de reprodução | `{resource_id, rate: float, session_id}` | front (players) | YouTube: ler via API no polling; emitir só na mudança |
| `section_read` / `ova_section` | flush do agregado de seção QUANDO não há rota de progresso (fallback offline) — ver §4.3 | igual ao `section_exit` | front | **[DECISÃO EM ABERTO]** só existe se a opção B de §4.3 for escolhida |

Métricas derivadas novas (sem evento próprio — calculadas no backend): §5.

---

## 3. Rastreamento de Vídeo — Especificação Técnica

### 3.1 Modelo de dados do consumo real

Substituir a semântica "checkpoint de posição" por três medidas independentes:

1. **`watched_seconds`** — segundos REAIS assistidos: ticker de 1 s ativo somente
   quando `(estado == playing) && (documento visível)`. Replays contam (é consumo).
   Análogo exato do que o `AudioPlayer` já faz, mais o gate de visibilidade.
   **[DECISÃO EM ABERTO]** áudio em segundo plano é escuta legítima (podcast) — manter
   áudio SEM gate de visibilidade; vídeo COM gate. Confirmar com a equipe pedagógica.
2. **`coverage_perc`** — % da LINHA DO TEMPO efetivamente coberta: bitmap de 100
   baldes (1 % cada); o balde `floor(100*posição/duração)` marca-se a cada tick de
   reprodução. Seek NÃO marca baldes. `coverage_perc = baldes_marcados`. É esta
   métrica que passa a alimentar a conclusão (`completed = coverage_perc ≥ 90`).
3. **`max_position_seconds` / `last_position_seconds`** — posição máxima e última
   (retomada + ponto de abandono). O valor que hoje polui `seconds_consumed`
   passa a viver aqui.

### 3.2 Eventos de transição (baixo volume)

`played`, `paused` (`{position_s}`), `seeked` (`{from_s, to_s}` — distingue pulo
para frente/replay), `rate_changed` (`{rate}`), `completed` (no `ended`).
Abandono NÃO é evento próprio: é derivado (último `paused`/último tick antes do
`pagehide`, com `last_position_seconds` já persistido no upsert).

### 3.3 Persistência

- **Agregados** → `resource_progress` estendida (§7): upsert pela rota existente
  `POST /progress/resource` com payload novo
  `{resource_id, watched_seconds_delta, coverage_bitmap, last_position_s, playback_rate}` —
  o servidor SOMA o delta (mesmo padrão atômico do `read_time`) e faz OR do bitmap.
  Cadência: a cada 10 s tocando + pause + ended + `pagehide` (keepalive).
- **Transições** → `learning_events` pela fila existente.

### 3.4 Tradeoff granularidade × volume (racional)

Sessão típica de vídeo de 10 min: ~60 upserts? NÃO — o upsert de 10 s substitui o
anterior em UMA linha por (aluno, recurso); o custo de linha é zero. Eventos de
transição: play/pause/seek raramente passam de 20–30/sessão (< 1 KB no lote).
Rejeitada a alternativa "evento por segundo assistido" (×600 de volume sem valor
analítico) e a alternativa "só agregado" (perde replays/pulos, que são o insight
pedagógico pedido). Bitmap de 100 posições em JSON: 100 bytes — desprezível.
Retenção/rollup de `learning_events`: **[DECISÃO EM ABERTO]** definir janela de
retenção bruta (sugestão: 180 dias brutos, agregação mensal depois) — não há
requisito de retenção documentado no repositório.

### 3.5 Edge cases obrigatórios

- YouTube: polling é a única fonte (sem `timeupdate`); manter 1 s, mas os ticks só
  contam com `player.getPlayerState() == PLAYING` e documento visível.
- `duration` desconhecida (metadata não carregada / `duration_seconds` NULL no seed):
  acumular `watched_seconds` normalmente e adiar bitmap/percentual até a duração
  existir; nunca dividir por zero (o `AudioPlayer` já tem o padrão).
- Vídeo trocado no meio (unmount): flush final no cleanup do efeito (o leitor já faz
  isso para leitura — `OvaReader.tsx:308–316`; replicar nos players).
- Dois players do mesmo recurso em abas distintas: deltas somam (correto); bitmap OR
  (correto) — sem tratamento especial.

---

## 4. Rastreamento de OVA por Seção — Especificação Técnica

### 4.1 Identidade da seção

`src/services/ovaContent.ts` já produz `sections[]` com `id`. Contrato: `section_id`
persistido = `id` do parser + `section_index` (ordem). Como o conteúdo vem de HTML
versionado no repositório (`Front-End/files/ovas/`), o `id` é estável entre sessões.
**[DECISÃO EM ABERTO]** se um OVA for editado (seções renomeadas/reordenadas), o
histórico órfão permanece com o `section_id` antigo — aceitar (dado histórico) e
expor no dashboard só as seções atuais; alternativa (mapa de migração de seções) foi
considerada desproporcional.

### 4.2 Medição

- **Visibilidade por seção:** IntersectionObserver (threshold 0.5) sobre os nós de
  seção já renderizados pelo `OvaReader`. Entrada/saída geram os eventos de §2.3.
- **Tempo ativo por seção:** o ticker EXISTENTE de leitura (`OvaReader.tsx:280`)
  passa a creditar o segundo à(s) seção(ões) atualmente visível(is) — mesmo gate de
  idle/visibilidade; nenhuma segunda máquina de tempo. Se 2 seções visíveis, dividir
  o segundo igualmente (0.5/0.5) para o total do OVA continuar batendo com a soma
  das seções (invariante de auditoria).
- **Releitura:** `visits` incrementa a cada `section_enter`; `visits > 1` = voltou
  para reler (sinal de dificuldade OU de revisão — cruzar com quiz da competência).
- **Múltiplas sessões:** agregação é por (aluno, ova, seção) com deltas somados no
  servidor — sessões se acumulam naturalmente; `session_id` no evento permite
  separar por sessão quando o professor quiser a linha do tempo.

### 4.3 Persistência

**Opção A (recomendada): rota de progresso agregado** — nova rota
`POST /progress/ova-section` (lote: `{ova_id, sections: [{section_id, section_index,
seconds_delta, max_scroll_perc, visits_delta}]}`), upsert somando deltas — espelho
fiel do contrato de `/progress/ova`, tabela nova `ova_section_progress` (§7).
Eventos `section_enter/exit` continuam indo para `learning_events` (linha do tempo).
**Opção B:** só eventos + agregação em job. Rejeitada: o dashboard do professor
precisaria agregar `learning_events` a cada render (caro), e o padrão do projeto é
agregado-no-banco + eventos-para-histórico. Implementar a Opção A.

### 4.4 O que o payload de cada evento carrega

Já especificado em §2.3. Invariante: `Σ seconds das seções ≤ read_time do OVA`
(a diferença é tempo fora de qualquer seção — hero, quiz, mídia).

---

## 5. Novas Métricas de Engajamento Sugeridas

Todas derivadas de dados que passarão a existir (nenhuma exige coleta adicional):

1. **Tempo até a primeira tentativa** — `MIN(attempts.attempt_time) −
   MIN(learning_events.occurred_at WHERE verb='opened' AND object=ova)` por
   (aluno, OVA). Camada: agregação no backend (`tutorRoute` /overview e detalhe).
2. **Padrão de acesso** — histograma hora-do-dia × dia-da-semana de
   `learning_events.occurred_at` (28 d). Requer o índice de §7. Sequência (streak) já
   existe na gamificação — reusar, não duplicar.
3. **Uso de reforço** — por aluno: OVAs personalizadas geradas
   (`personalized_ova`) × itens concluídos (cruzar itens com `resource_progress` /
   `answers`). **[DECISÃO EM ABERTO]** verificar se `personalized_ova_item` guarda
   vínculo por `resource_id`/`question_id` reaproveitável para o cruzamento
   (li a rota, não o modelo item a item).
4. **Score de risco composto (substitui o `em_risco` binário de P9)** — 0–100,
   soma ponderada de: taxa de erro no quiz, dias sem acesso, revisões vencidas
   acumuladas, tendência de domínio em queda (`mastery_trend` já existe em
   `mastery.py:128`), consumo < 40 %. Pesos default sugeridos 30/25/15/20/10 —
   **[DECISÃO EM ABERTO]** calibração pedagógica; entregar os pesos como constantes
   nomeadas ajustáveis (mesmo padrão dos thresholds de `student_context.py:43–45`).
   `em_risco = score ≥ 60`. Exibir os COMPONENTES no painel (explicabilidade).
5. **Esforço × desempenho** — quadrante por aluno/competência: eixo X = tempo
   investido (leitura por seção da competência + vídeo real + tentativas), eixo Y =
   `p_mastery`. "Muito esforço, pouco domínio" é o aluno que o professor não vê hoje.
6. **Abandono de vídeo** — distribuição de `last_position_seconds/duração` por
   recurso: mostra ao professor ONDE a turma larga o vídeo.
7. **Fricção por seção** — ranking de seções por (tempo médio ÷ tamanho do texto) e
   por taxa de releitura (`visits > 1`): as "seções que travam".

---

## 6. OVAs de Reforço — Diagnóstico e Especificação

### 6.1 Situação atual

- **Fluxo:** o aluno clica em "Gerar" na aba Reforço (`Reforco.tsx:75` →
  `POST /edubot/personalized-ova`). O agente de tool-use
  (`edubot/agent/personalized.py`, `tools.py`) diagnostica a competência mais fraca
  (menor `dominio_estimado` GLOBAL do aluno), busca recursos de remediação
  classificados por competência e questões, e monta `personalized_ova` +
  `personalized_ova_item`. O loop de tools é real; só o "cérebro" é mock.
- **Disparo automático: NÃO EXISTE.** A proatividade (`proactivity.py`) cria
  intervenções recomendando reforço, mas nada gera a OVA sem clique. O requisito
  "reforço disparado quando o desempenho for insuficiente" está incompleto.
- **Alvo do diagnóstico:** competência mais fraca global — ao concluir o OVA X com
  dificuldade, o reforço pode sair sobre competência do OVA Y (confuso para o aluno).
- **Cobertura por competência (seed `Database/sql/dml_extra.sql`):**

| Competência | Questões | Remediação classificada | Lacuna |
|---|---|---|---|
| 1 | 3 | 1 texto + 3 vídeos | ok |
| 2 | 3 | 1 vídeo | formato único |
| 3 | 3 | 1 vídeo | formato único |
| 4 | 5 | 2 vídeos + 1 texto | ok |
| 5 | 6 | 1 texto + 1 vídeo | ok |
| 6 | 6 | 1 vídeo | formato único |
| 7 | 2 | 1 texto + 2 vídeos | **só 2 questões** |
| 8 | 2 | 1 vídeo | **só 2 questões, formato único** |
| 9 | 2 | 1 vídeo | **só 2 questões, formato único** |

  Recursos `quiz`/`atividade` têm `competency_id` NULL (não participam da remediação).
  Com 2 questões, o BKT converge mal e o quiz de verificação do reforço repete as
  mesmas questões que o aluno acabou de errar.

### 6.2 Estrutura proposta (regra de cobertura)

**Invariante de conteúdo:** toda competência ativa (ligada a um curso via
`offerings`) deve ter **≥ 3 questões** e **≥ 1 recurso de remediação em ≥ 2 formatos**
(para a personalização por `preferencia_formato` ter o que escolher).
Implementação: consulta de verificação de cobertura exposta em duas superfícies:
(a) seção "Cobertura de conteúdo" no dashboard do gestor (`ManagerDashboard.tsx`),
listando as competências que violam o invariante; (b) teste de seed no backend
(`Back-End/tests/`) que falha se o seed violar — trava regressão de conteúdo.
Não inventar conteúdo: o documento aponta a lacuna; a produção das questões/recursos
das competências 7–9 é tarefa editorial **[DECISÃO EM ABERTO — conteúdo]**.

### 6.3 Fluxo de disparo do reforço

Gatilhos (avaliados nos pontos onde o sinal já flui, sem job novo):

1. **Pós-quiz** (`questionRoute.py`, após `update_on_attempt`): se `p_mastery` da
   competência da questão caiu abaixo de **0.4** E não existe OVA personalizada
   ativa do aluno para essa competência → criar intervenção tipo `reforco_sugerido`
   com CTA profundo ("Praticar agora") que chama o gerador JÁ EXISTENTE com
   `competency_id` **explícito** (novo parâmetro opcional do
   `POST /edubot/personalized-ova` — hoje o agente escolhe sozinho; com o parâmetro,
   o diagnóstico é pulado e a montagem usa a competência do gatilho).
2. **Pós-conclusão de OVA** (`progressRoute.py`, na transição `now_completed`): idem,
   avaliando apenas as competências DAQUELE OVA (resolve o desalinhamento descrito
   em 6.1) — o aluno recebe reforço sobre o que acabou de estudar mal.
3. **Revisão vencida com 2 erros** (`reviews.py::register_result`, ramo do erro):
   segunda falha consecutiva na mesma revisão → mesmo CTA.

Dedup: 1 intervenção `reforco_sugerido` por (aluno, competência) por semana.
Geração da OVA continua on-click (custo do agente é do clique, não do gatilho);
auto-geração completa fica atrás de flag `EDUBOT_AUTO_REINFORCEMENT` (default off)
**[DECISÃO EM ABERTO]** ligar auto-geração exige política de custo quando a LLM real
estiver ativa (no mock é grátis).

---

## 7. Modelo de Dados / Schema (alto nível)

Migrações novas, numeradas na sequência (`migration_019+`), TODAS idempotentes
(padrão das existentes — ver `migration_003_indexes.sql` para o idiom de guarda):

1. **`migration_019_video_tracking.sql`** — `resource_progress` ganha:
   `watched_seconds INT DEFAULT 0` (soma de deltas), `coverage_bitmap` (JSON/TEXT,
   100 posições), `coverage_perc INT DEFAULT 0` (materializado no upsert),
   `last_position_seconds INT NULL`, `max_position_seconds INT NULL`,
   `playback_rate_last DECIMAL(3,2) NULL`. `seconds_consumed` fica congelado como
   legado (leitura antiga) até a Fase 5 — não reaproveitar o nome para a métrica nova.
2. **`migration_020_ova_section_progress.sql`** — tabela nova
   `ova_section_progress(student_id, ova_id, section_id VARCHAR, section_index INT,
   active_seconds INT, max_scroll_perc INT, visits INT, last_access DATETIME,
   UNIQUE(student_id, ova_id, section_id))` + FKs com CASCADE (padrão de
   `ddl_extra.sql`).
3. **`migration_021_events_index.sql`** — índice composto
   `learning_events(student_id, verb, occurred_at)` SE `migration_006` ainda não o
   criou (conferir no arquivo antes; criar com guarda de idempotência).
4. **Enums** vivem em código (`events.py`), não em SQL — sem migração; documentar os
   novos verbos no comentário da coluna em `migration_006` (não alterar dados).
5. **Sem tabela de sessões:** `session_id` fica em `learning_events.context` (JSON).
   Promover a coluna só se a análise por sessão virar consulta quente
   **[DECISÃO EM ABERTO — adiar]**.

---

## 8. Plano de Implementação por Fases

| Fase | Entrega | Depende de | Prioridade |
|---|---|---|---|
| **0 — Parar de mentir** | E0.1–E0.5 (§2.2): enums + telemetria do companheiro passa a persistir; painel do professor volta a ser verdadeiro; `response_ms` consistente; consent sincronizado; players emitem played/paused/seeked | nada | **MÁXIMA** — bugs de honestidade da métrica; pequena e de baixo risco |
| **1 — Vídeo real** | §3 completo: watched_seconds + bitmap + eventos + migração 019 + UI do professor mostrando cobertura real e ponto de abandono | Fase 0 (enums) | ALTA |
| **2 — Seções de OVA** | §4 completo: IntersectionObserver, crédito de tempo por seção, rota `/progress/ova-section`, migração 020, visão "onde a turma trava" no detalhe do aluno e no gestor | Fase 0; independe da 1 | ALTA |
| **3 — Métricas e risco composto** | §5: score de risco com componentes, tempo-até-1ª-tentativa, padrão de acesso, esforço × desempenho; substituir `em_risco` em `tutorRoute.py` + `TutorPanel.tsx` + `ManagerDashboard.tsx` | Fases 1–2 (usa os dados novos; pode entrar parcial só com o que já existe) | MÉDIA |
| **4 — Reforço fechado** | §6: parâmetro `competency_id` no gerador, 3 gatilhos com CTA, dedup semanal, relatório de cobertura no gestor + teste de seed | Fase 0 | MÉDIA-ALTA (é requisito pedagógico explícito) |
| **5 — Aposentar `interactions`** | Migrar `dias_sem_acesso` e `active_student_ids` para `learning_events` (incluindo as fontes que faltam — P7), remover double-write `ova_opened`/`opened`, congelar a tabela | Fases 0–2 estáveis em produção | BAIXA (higiene) |

Critério de aceite por fase: testes de backend verdes (`cd Back-End && python -m pytest`
— suíte atual com 227 testes; cada fase adiciona os seus), `tsc --noEmit` limpo no
front, e o invariante de auditoria da fase (ex.: Fase 2 — soma das seções ≤ total do
OVA) coberto por teste.

## 9. Instruções para o Claude Opus

**Todo código deve seguir princípios de Clean Code:** nomes descritivos, funções
pequenas com responsabilidade única, sem duplicação (reusar a fila de eventos, o
padrão de upsert por delta e os enums existentes — NÃO criar mecanismos paralelos),
comentários apenas onde o porquê não é óbvio (no padrão PT-BR do repositório),
tratamento de erros explícito (best-effort nos caminhos de escrita do aluno, como os
existentes), e testes onde fizer sentido (toda regra de agregação e todo enum novo).

**Arquivos por mudança (caminhos exatos):**

- Enums/validação de eventos: `Back-End/edubot/services/events.py`
- Fila do front / novos tracks: `Front-End/react-logic-demo/src/services/events.ts`,
  `src/hooks/useCompanionScript.ts`, `src/components/ova/OvaReader.tsx`
- Players: `src/components/players/VideoPlayer.tsx`, `src/components/players/AudioPlayer.tsx`
- Progresso: `Back-End/edubot/api/routes/progressRoute.py` (+ nova rota de seção no
  mesmo blueprint), tipos em `src/services/api.ts`
- Quiz: `src/components/Quiz.tsx` (E0.2), `Back-End/edubot/api/routes/questionRoute.py` (gatilho 6.3.1)
- Reforço: `Back-End/edubot/agent/personalized.py`, `tools.py`,
  `Back-End/edubot/api/routes/personalizedOvaRoute.py`, `src/components/Reforco.tsx`
- Proatividade/risco: `Back-End/edubot/services/proactivity.py`,
  `Back-End/edubot/api/routes/tutorRoute.py`, `src/components/TutorPanel.tsx`,
  `src/components/TutorStudentDetail.tsx`, `src/components/ManagerDashboard.tsx`
- Consentimento: `src/components/ConsentModal.tsx`, `Back-End/edubot/api/routes/consentRoute.py`
- Migrações: `Database/sql/migration_019+.sql` (idempotentes; initdb só roda em volume novo —
  documentar a aplicação manual no README como as anteriores)
- Registro de execução: apêndice em `EduBot/LOG_EXECUCAO.md` por etapa (padrão do projeto)

**Ordem de execução:** Fase 0 inteira primeiro (é pequena e destrava as demais);
depois 1 e 2 (podem ser paralelas), 4, 3, 5. Dentro de cada fase: migração → backend
(serviço + rota + testes) → front (tipos → componente) → teste ponta a ponta com a
skill `run` do projeto.

**Restrições do projeto (não negociáveis):** degradação segura (campos novos
opcionais; front antigo não quebra com backend novo e vice-versa); i18n PT/EN em
todo texto de UI; nada depende só de cor (a11y WCAG, padrão do Plano 4); o mock de
LLM nunca quebra; LGPD — minimização/enforcement no backend, nunca só na UI; nunca
commitar `.env`.

**Decisões em aberto (não assumir silenciosamente):** §1.2-P8 (fluxo de consent),
§3.1 (áudio sem gate de visibilidade), §3.4 (retenção de eventos), §4.1 (seções
editadas), §5.3 (modelo do item de reforço), §5.4 (pesos do risco), §6.2 (produção
de conteúdo das competências 7–9), §6.3 (auto-geração com LLM real), §7.5 (coluna
de sessão). Cada uma deve virar pergunta ao usuário OU constante nomeada com default
documentado, conforme indicado no item.

**Claude Opus: implemente tudo seguindo Clean Code.**
