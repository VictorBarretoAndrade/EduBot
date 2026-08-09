# Plano de Correções Pendentes — pós-implementação do Plano de Rastreabilidade

> Documento de PLANEJAMENTO (nenhum código foi alterado para produzi-lo).
> Contexto: as Fases 0–4 do [PLANO_RASTREABILIDADE.md](PLANO_RASTREABILIDADE.md)
> foram implementadas e validadas (256 testes verdes, ponta a ponta na stack real
> — ver o registro em [LOG_EXECUCAO.md](LOG_EXECUCAO.md)). Este plano cobre o que
> **ficou com problema ou pendente**, com diagnóstico e caminho de resolução.

---

## P1 — As 2 falhas em `tests/test_outcomes.py` (pré-existentes, CAUSA ENCONTRADA)

**Sintoma:** `test_agent_kpi_route` (IndexError) e `test_agent_kpi_by_format`
(KeyError `'video'`) falham — já falhavam ANTES desta rodada (confirmado rodando a
suíte com as mudanças guardadas em stash).

**Diagnóstico (fechado):** é uma *bomba-relógio de datas nos testes*, não um bug
do produto.

- O arquivo define `NOW = datetime(2026, 6, 1)` **fixo** e o helper `_decision()`
  cria decisões com `created_at = NOW - days_ago`.
- A rota `/tutor/agent-kpi` (tutorRoute.py) filtra por janela **relativa ao agora
  real**: `datetime.now() - 60 dias`.
- Conta: `2026-06-01 − 5d + 60d = 2026-07-27`. A partir de 27/07, as decisões dos
  testes caíram para FORA da janela de 60 dias → lista de KPIs vazia → IndexError/
  KeyError. Os testes passavam até essa data e "estragaram sozinhos".
- A prova de que é erro de helper: o mesmo arquivo tem `_recent_decision()` (usa
  `datetime.now()`) com o comentário *"outcomes_summary/tool/kpi consultam a
  janela relativa ao AGORA real, então usam datas recentes"* — os testes de
  summary/tool usam o helper certo e passam; só os 2 de KPI usam `_decision`.

**Plano de correção (2 passos, ~5 min):**
1. Nos 2 testes, trocar `_decision(...)` por `_recent_decision(...)` — mesmos
   argumentos (`days_ago`, `digest`, `outcome`); nada mais muda.
2. (Opcional, robustez de longo prazo) A rota `agent-kpi` poderia aceitar um
   `now` injetável (como `compute_outcomes(now=...)` já aceita) para permitir
   testes com relógio congelado; adiar se não houver nova ocorrência.

**Critério de aceite:** `python -m pytest` → **258 passed, 0 failed**.

---

## P2 — Fase 5 do plano não implementada (aposentar `interactions`)

**O que é:** a tabela legada `interactions` (strings PT livres, data/hora como
texto) segue viva em *double-write* com `learning_events` (`ova_opened` +
`opened`). Foi deixada por último DE PROPÓSITO: é a fase de menor valor e maior
risco (mexe em `dias_sem_acesso` e `active_student_ids`, que alimentam painel e
sweep).

**Plano (na ordem, cada passo com teste antes do seguinte):**
1. **Migrar leitores primeiro, escrita depois** (ordem inversa quebraria o painel):
   - `student_context._days_without_access`: já usa 5 fontes em UNION; remover a
     fonte `interactions` só DEPOIS do passo 2 rodar em produção por um ciclo.
   - `proactivity.active_student_ids`: adicionar `learning_events` e
     `resource_progress` às fontes (fecha também o achado P7 da auditoria — aluno
     "só mídia"/"só login" invisível ao sweep). Esta parte pode ser feita ANTES da
     aposentadoria e já é ganho por si só.
2. Trocar as escritas restantes do front (`registerInteraction`: `ova_opened`,
   carrossel/acordeão, `ova_assistant_opened`) por `track()` com verbos do enum
   (`opened`/`read` + contexto), removendo o double-write.
3. Congelar a tabela (parar de escrever; manter para histórico) e marcar a rota
   `/interaction/register` como deprecated → remover numa limpeza futura.

**Critério de aceite:** painel do tutor e sweep idênticos antes/depois com o seed
de demonstração; nenhum leitor de `interactions` restante além de relatórios
históricos.

---

## P3 — Decisões em aberto do plano (§9) que exigem DECISÃO SUA, não código

| # | Decisão | Recomendação | Esforço depois de decidido |
|---|---|---|---|
| 1 | **Pesos do score de risco** (§5.4) | Rodar 2–4 semanas com os defaults (30/30/25/15/15, limiar 40) e recalibrar olhando falsos positivos/negativos reais com um professor | Trivial (constantes em `services/risk.py`) |
| 2 | **Conteúdo das competências 7–9** (§6.2) | Trabalho **editorial**: produzir ≥1 questão extra por competência e 1 material em 2º formato onde falta. O painel do gestor já lista as lacunas exatas ("Lacunas de conteúdo para o reforço") | SQL de seed (`dml_extra.sql`) + conferir o teste de cobertura |
| 3 | **Retenção de `learning_events`** (§3.4) | 180 dias brutos + agregação mensal via job no scheduler existente | Médio (job + migração de índice se necessário) |
| 4 | **Auto-geração de reforço com LLM real** (§6.3) | Manter geração no clique enquanto o provider for mock; se ligar Bedrock, decidir orçamento/dia antes (flag `EDUBOT_AUTO_REINFORCEMENT` já prevista no plano, hoje inexistente de propósito) | Pequeno (guard de orçamento já existe em `decisions.budget_exceeded`) |
| 5 | **Seções renomeadas de OVA** (§4.1) | Aceitar histórico órfão (dado legítimo; o painel só mostra seções atuais). Não construir mapa de migração | Zero (já é o comportamento) |
| 6 | **Medir uso do reforço** (§5.3) | Cruzar `personalized_ova_item` com `resource_progress`/`answers` para "geradas × concluídas" no painel | Médio (1 agregação + card no gestor) |
| 7 | **`session_id` como coluna** (§7.5) | Manter no JSON `context` até a análise por sessão virar consulta quente | Zero por ora |

---

## P4 — Arrumação antes do commit (higiene do repositório)

1. **`package.json` + `package-lock.json` na raiz do EduBot:** criados sem querer
   pelo `npm i playwright` (usado só para os screenshots de validação). **Não
   pertencem ao projeto** → apagar antes de commitar (a pasta `node_modules/` da
   raiz idem — está no gitignore, mas ocupa ~150 MB).
2. **Avisos LF→CRLF do git:** cosméticos (mistura Windows/containers), padrão do
   repositório — nenhuma ação; opcionalmente um `.gitattributes` no futuro.
3. **Commit sugerido em 2 partes** para histórico legível: (a) espec + roteiro
   (`PLANO_RASTREABILIDADE.md`, `ROTEIRO_APRESENTACAO.md`); (b) implementação
   Fases 0–4 (código + migrations + testes + LOG).

---

## P5 — Efeitos colaterais esperados (comunicar, não corrigir)

1. **O modal de consentimento vai reaparecer UMA vez para usuários antigos**
   (inclusive professor/gestor): é a correção E0.5 funcionando — o backend agora é
   a fonte de verdade e essas contas nunca tiveram consentimento GRAVADO (só a
   flag local). Respondeu uma vez, não volta. **Atenção na apresentação:** entre
   nas contas antes, para o modal não aparecer na frente da plateia.
2. **"Vídeo — consumo real" começa perto de 0%** no gestor: a métrica nova só
   conta o que foi assistido DEPOIS da Fase 1 (o histórico antigo media posição,
   não consumo, e não é convertível com honestidade).
3. **Dois números de "em risco" mudaram de significado** (agora score composto ≥
   40 com motivo). Manuel continua em risco; Thiago ENTROU (44% de erro + 12 dias
   ausente — invisível para a regra antiga); Pedro 0.
4. **Custo do `/tutor/overview` cresceu** (o "em risco" reusa `_student_summary`
   por aluno para as duas telas baterem — N consultas para ≤ 60 alunos). Aceitável
   hoje; se a turma real crescer, mover o cálculo do risco para uma agregação SQL
   única é a otimização óbvia (mesma fórmula, outra implementação).

---

**Ordem sugerida de execução:** P1 (5 min, zera a suíte) → P4.1 (limpeza) →
commit → P3.2 (conteúdo, editorial — destrava o reforço de verdade) → P2 (Fase 5)
→ demais decisões de P3 conforme prioridade sua.
