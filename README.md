# EduBot — Ecossistema de Aprendizagem Adaptativa e Tutoria Proativa por IA (`v1.0`)

Plataforma de Objetos Virtuais de Aprendizagem (**OVA-IA**) que **mede o engajamento real** do estudante (leitura por seção, vídeo, áudio e tentativas de quiz), **modela o domínio por competência via BKT (*Bayesian Knowledge Tracing*) com decaimento temporal**, e **age proativamente** — intervindo antes da evasão, respondendo dúvidas de forma socrática e montando **OVAs personalizadas de reforço** por meio de um agente autônomo com loop de *tool-use*.

- **Produção (Cloud Azure + HTTPS):** [https://edubot-project.chilecentral.cloudapp.azure.com/app/](https://edubot-project.chilecentral.cloudapp.azure.com/app/)
- **Documentação Arquitetural Completa:** [ARQUITETURA_EDUBOT.md](ARQUITETURA_EDUBOT.md)
- **Relatório Consolidado do Hackathon (Benchmarks $N=100$, Tool-Use e Fundamentação Teórica):** [docs/RESULTADOS_HACKATHON_TAREFAS_1_2_3.md](docs/RESULTADOS_HACKATHON_TAREFAS_1_2_3.md)

---

## Como Executar Localmente

```bash
git clone https://github.com/PERSONALIZED-CONTENT-RECOMMENDER/EduBot.git
cd EduBot
docker compose up -d --build
```

- **Aplicação Web (SPA React / TypeScript):** `http://localhost:8010/app/`
- **API Backend (Flask):** `http://localhost:5010`

> O frontend React é compilado automaticamente durante o `docker compose up` pelo serviço `ova_react_build` — **não é necessário instalar Node.js na máquina host**.

---

## Perfis de Demonstração e Credenciais

A plataforma aceita login tanto por **RA/Matrícula** quanto por **Nome de Usuário** (case-insensitive):

### Alunos (Turma de Engenharia de Computação)
| Perfil | Aluno | Login (RA / Usuário) | Senha | Métricas e Estado Calibrado |
| :--- | :--- | :---: | :---: | :--- |
| **Primeiro Acesso (Zerado)** | Thiago | `6` | `6` | **0% de consumo**, sem tentativas prévias. Ideal para demonstrar a jornada do zero ao vivo. |
| **Alto Desempenho** | Eduardo | `1` | `1` | **96% de consumo**, taxa de erro de **4%**, score de risco **0/100**, streak de 5 dias, nível 5. |
| **Médio Desempenho (Reforço IA)** | Yasmin | `3` | `3` | **55% de consumo**, taxa de erro de **46%**, score de risco **22/100** e **OVA personalizada já gerada**. |
| **Baixo Desempenho / Risco Crítico** | Pedro | `5` | `5` | **Inativo há 14 dias**, consumo de **15%**, taxa de erro de **83%**, score de risco **78/100** e alerta aberto para o tutor. |
| **Acesso Nominal 1** | Sanval | `Sanval` | `Cimatec123` | Conta de aluno nominal para avaliação rápida. |
| **Acesso Nominal 2** | Educação Online | `Edon` | `Cimatec@123` | Conta de aluno nominal para avaliação rápida. |

### Gestão e Tutoria (Dashboards Docente e Institucional)
| Papel | Nome | Login | Senha | O que visualiza |
| :--- | :--- | :---: | :---: | :--- |
| **Coordenador / Admin** | Sanval (Coordenador) | `4` | `4` | **Painel do Tutor** (risco, heatmap de domínio, alertas) + **Painel do Gestor** (métricas globais e cobertura do acervo). |
| **Tutor da Turma** | Gabriel | `2` | `2` | **Painel do Tutor** (fila de aprovação de ações do agente, mapa de calor turma × competência e gargalos por seção). |

---

## Números da Arquitetura (`v1.0`)

| Indicador | Valor Verificado | Detalhamento |
| :--- | :---: | :--- |
| **Testes Automatizados** | **332 testes** | 42 arquivos de teste (`pytest`), 100% passando |
| **Endpoints HTTP** | **67 endpoints** | Distribuídos em **19 blueprints** Flask |
| **Banco de Dados** | **31 tabelas** | 30 arquivos de model (Peewee ORM) e **21 migrations** SQL idempotentes |
| **Módulos de Domínio** | **18 services + 11 agent** | Arquitetura desacoplada em `Back-End/edubot/` |
| **Provedores de IA Suportados** | **4 provedores** | `azure` (Azure AI Foundry `gpt-5-mini`), `bedrock` (AWS Claude), `anthropic` e `mock` determinístico |
| **Capacidades de IA Validadas** | **5 de 5 (`mock=0`)** | 500 execuções reais ($N=100$ por capacidade) auditadas em `agent_decisions` |

---

## Benchmark Real de Latência e Custo do Agente ($N = 100$ por Capacidade)

Medições reais coletadas em produção (`Azure VM Chile Central` $\leftrightarrow$ `Azure AI Foundry East US 2`, modelo `gpt-5-mini-2025-08-07` com `reasoning_effort="low"`, tarifa oficial de `\$0,25/1M` tokens de entrada e `\$2,00/1M` tokens de saída):

| Capacidade do Agente | `trigger_type` | Amostras ($N$) | Latência Média $\pm$ DP | Mediana (P50) | P95 | Tokens Entrada | Tokens Saída | Custo Médio / Uso (USD) | Custo / 1.000 Usos |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Coach Motivacional (Avatar)** | `coach` | 100 | **3,62 s** $\pm$ 0,72 s | 3,45 s | 4,93 s | 197 | 220 | **`$0,000489`** | `$0,49` |
| **Redator Proativo de Intervenções** | `redactor` | 100 | **4,13 s** $\pm$ 0,75 s | 3,94 s | 5,46 s | 322 | 314 | **`$0,000708`** | `$0,71` |
| **Chat Tutor Socrático** | `chat` | 100 | **4,91 s** $\pm$ 0,89 s | 4,82 s | 6,39 s | 187 | 442 | **`$0,000931`** | `$0,93` |
| **Diagnóstico e Recomendação** | `on_demand` | 100 | **7,01 s** $\pm$ 1,02 s | 6,85 s | 8,67 s | 6.244 | 662 | **`$0,002884`** | `$2,88` |
| **Agente OVA (Loop Tool-Use 4 tools)** | `personalized_ova` | 100 | **11,98 s** $\pm$ 1,41 s | 11,78 s | 14,10 s | 35.938 | 348 | **`$0,009680`** | `$9,68` |

> **Unit Economics Fundamentado:** Para um estudante regular ativo em EaD/Híbrido (**12 sessões/mês**, **25 turnos de chat socrático**, **8 intervenções proativas**, **6 diagnósticos pós-quiz** e **3 OVAs personalizadas via tool-use**), o custo total de IA é de **`$0,0812 USD / aluno / mês`** (~**R\$ 0,46/mês**). Veja a fundamentação completa em [docs/RESULTADOS_HACKATHON_TAREFAS_1_2_3.md](docs/RESULTADOS_HACKATHON_TAREFAS_1_2_3.md).

---

## Principais Capacidades da Plataforma

1. **Telemetria Honesta e Eventos xAPI-lite:** Rastreamento de leitura ativa por seção (`ova_section_progress`, descontando aba oculta e ociosidade), consumo real de vídeo/podcast (`resource_progress`), tentativas de quiz corrigidas no servidor (`attempts`) e 20 verbos de eventos (`learning_events`), além de coletor externo via `edubot-tracker.js` (`POST /api/v1/collect`).
2. **Modelo Cognitivo BKT com Esquecimento:** Estima o domínio contínuo ($0$ a $1$) por competência (`student_mastery`), com snapshots diários de tendência (`student_mastery_history`) e agendamento automático de revisão espaçada SM-2 (`review_schedule`).
3. **Agente Híbrido (Regras Determinísticas + Loop de Tool-Use):**
   - Motor determinístico avalia 6 regras pedagógicas a custo zero e decide *se* e *quando* intervir.
   - Loop de *tool-use* ([Back-End/edubot/agent/loop.py](Back-End/edubot/agent/loop.py)) com 11 ferramentas classificadas por tier de autonomia (`read`, `auto`, `auto_capped`, `auto_or_queue`, `queue`), validação server-side de todos os IDs, circuit breaker, teto de orçamento diário e trilha de auditoria LGPD (`agent_decisions`).
4. **Integração Externa (`/api/v1`):** API pública autenticada por chave com escopos granulares (`api_keys`) e coletor de eventos (`collected_events`) para integração com LMS parceiros e Canvas LTI 1.3.

---

## Executando a Suíte de Testes

```bash
cd Back-End
python -m pytest -q
# 332 passed
```
