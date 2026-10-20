# EduBot — Dossiê de Contexto Completo do Projeto (Master Reference)
> **Finalidade:** Base de Conhecimento Integral e Unificada para Preenchimento de Avaliações, Plataformas de Q&A (Argon), Questionários de Hackathons e Apresentações Técnicas/Executivas.  
> **Status:** Documento Completo e Atualizado (Outubro de 2026) — Confidencial / Não Versionar.

---

## 📑 Índice Geral
1. [Identidade e Visão Geral do Projeto](#1-identidade-e-visão-geral-do-projeto)
2. [O Problema Real e a Macroeconomia da Defasagem](#2-o-problema-real-e-a-macroeconomia-da-defasagem)
3. [O Efeito Cascata: O Que se Perde vs. O Que se Ganha](#3-o-efeito-cascata-o-que-se-perde-vs-o-que-se-ganha)
4. [Análise de Mercado e Concorrência Direta com o Canvas](#4-análise-de-mercado-e-concorrência-direta-com-o-canvas)
5. [A Solução: O Ciclo dos Quatro Tempos](#5-a-solução-o-ciclo-dos-quatro-tempos)
6. [Fundamentação Pedagógica e Científica](#6-fundamentação-pedagógica-e-científica)
7. [Arquitetura de Software e Engenharia de Custos (Two-Brain)](#7-arquitetura-de-software-e-engenharia-de-custos-two-brain)
8. [Flexibilidade de Modelos de IA (Bring Your Own Model - BYOM)](#8-flexibilidade-de-modelos-de-ia-bring-your-own-model---byom)
9. [Governança Ética, Privacidade e Conformidade LGPD/GDPR](#9-governança-ética-privacidade-e-conformidade-lgpdgdpr)
10. [Modelo de Negócio, Unit Economics e Ponto de Equilíbrio](#10-modelo-de-negócio-unit-economics-e-ponto-de-equilíbrio)
11. [Alinhamento com os ODS da ONU e Stakeholder CIMATEC](#11-alinhamento-com-os-ods-da-onu-e-stakeholder-cimatec)
12. [Maturidade Tecnológica (TRL) e Métricas de Código](#12-maturidade-tecnológica-trl-e-métricas-de-código)
13. [Guia das Personas de Demonstração](#13-guia-das-personas-de-demonstração)
14. [Banco Rápido de Perguntas e Respostas (Argon Cheatsheet)](#14-banco-rápido-de-perguntas-e-respostas-argon-cheatsheet)

---

## 1. Identidade e Visão Geral do Projeto

* **Nome do Projeto:** EduBot (Intelligent Tutoring & Learning Analytics Platform)
* **O que é:** Um Ambiente Virtual de Aprendizagem (LMS) de Próxima Geração, nativo em Inteligência Artificial agêntica e malha fechada (*closed-loop*), projetado para **instituições de ensino em geral** (Educação Básica, Redes Técnicas/Profissionais e Ensino Superior).
* **Proposta de Valor:** O EduBot elimina a cegueira pedagógica dos sistemas tradicionais. Ele mede o estudo real através de telemetria honesta, modela probabilisticamente o domínio do estudante por competência (BKT), combate o esquecimento temporal (SM-2) e age de forma proativa gerando reforço adaptativo sob governança humana (*Human-in-the-Loop*).
* **Slogan:** *"A camada cognitiva agêntica que transforma dados em oportunidades de aprender e previne a evasão escolar."*

---

## 2. O Problema Real e a Macroeconomia da Defasagem

O sistema educacional tradicional opera no escuro. Professores atendem de 100 a 150+ alunos semanalmente e são forçados a atuar como burocratas de notas retrospectivas: só descobrem que o aluno não aprendeu quando a prova bimestral fecha no vermelho ou quando o estudante abandona o curso.

### 2.1 O Cenário Brasileiro
* **Custo da Evasão na Educação Básica:** O Brasil perde **R$ 214 bilhões por ano** devido à evasão escolar (*Estudo Insper & Fundação Roberto Marinho / Senado*). Manter o aluno na escola e aprendendo custa uma fração desse prejuízo reparatório (*Apufsc, 2023*).
* **Segurança Pública e Violência Juvenil:** A violência envolvendo jovens custa ao Brasil **R$ 26 bilhões por ano**. Pesquisas comprovam que **cada 1 ponto percentual de redução na taxa de evasão escolar evita cerca de 550 homicídios por ano**.
* **Apagão STEM e Estagnação de Patentes:** As defasagens em matemática e ciências impedem a formação massiva de engenheiros e cientistas. Estudos do *Centre for Economic Policy Research (CEPR)* mostram que potenciais inventores são perdidos precocemente pela evasão, travando a criação de patentes, a atração de P&D multinacional e confinando o país na exportação de *commodities* primárias.

### 2.2 O Impacto Global
* **Perda Econômica de US$ 700 Trilhões:** Uma das mais abrangentes análises educacionais do mundo (*Gust, Hanushek & Woessmann, 2024 - EconPol Forum*) projeta que a falha em garantir competências básicas universais a todos os estudantes gera uma perda global superior a **US$ 700 trilhões** (equivalente a 12% de todo o PIB do século XXI).
* **Déficit de Competências:** Atinge **65% dos estudantes na América Latina**, **89% no Sul da Ásia** e **94% na África Subsaariana**.

---

## 3. O Efeito Cascata: O Que se Perde vs. O Que se Ganha

A defasagem não é isolada; ela funciona como um efeito dominó contínuo entre os níveis de ensino:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          O EFEITO CASCATA NEGATIVO                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Aluno sem acompanhamento ativo em disciplinas de base (Cálculo/STEM)    │
│    └──> Ilusão de competência, erro crônico no quiz, desmotivação silenciosa│
│ 2. Reprovação no 1º/2º semestre & Evasão precoce                            │
│    └──> Frustração do estudante e quebra do projeto de vida pessoal         │
│ 3. Impacto nas Instituições de Ensino em Geral:                             │
│    ├── Na Educação Básica/Técnica: Queda no IDEB e desperdício de verbas    │
│    ├── No Ensino Superior: Perda de R$ 11.400/ano em mensalidade por evasão │
│    └── Queda geral nos índices oficiais de qualidade (IDEB, CPC, IGC, ENADE)│
│ 4. Impacto Social & Segurança Pública (Jovens de 15 a 29 anos):             │
│    ├── Vulnerabilidade social e perda de perspectivas produtivas            │
│    ├── Custo da violência juvenil no Brasil: R$ 26 bilhões/ano              │
│    └── Cada 1% a mais de evasão = +550 homicídios por ano no país           │
│ 5. Impacto Macroeconômico & Inovação (CEPR & Hanushek):                     │
│    ├── Perda anual de R$ 214 bilhões por ano no Brasil (Insper/R. Marinho)  │
│    ├── Apagão de engenheiros e cientistas para P&D e registro de patentes   │
│    └── Perda global acumulada de US$ 700 trilhões (12% do PIB futuro do XXI)│
└─────────────────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          O EFEITO CASCATA POSITIVO                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Telemetria honesta + BKT + Agente com curadoria adaptativa               │
│    └──> Diagnóstico em tempo real da lacuna antes do boletim ou da prova    │
│ 2. Nivelamento proativo + Fila de Aprovação para o Professor/Tutor          │
│    └──> Resgate da autoeficácia discente e redução de 40% na reprovação      │
│ 3. Vitória da Instituição de Ensino:                                        │
│    ├── Retenção de matrículas em faculdades (1 aluno salvo paga para 105)   │
│    ├── Otimização de verbas do FUNDEB e cumprimento de metas de permanência │
│    ├── Previsão preditiva e alavancagem de notas no IDEB, ENADE, CPC e IGC  │
│    └── Posicionamento como pioneira em IA Ética e Inovação Pedagógica       │
│ 4. Geração de Valor Tecnológico & Industrial:                               │
│    ├── Formação de técnicos e engenheiros qualificados (padrão CIMATEC)     │
│    ├── Aumento do depósito de patentes industriais e startups de deep tech  │
│    └── Cumprimento direto dos ODS 4, 8, 9 e 10 da ONU                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Análise de Mercado e Concorrência Direta com o Canvas

O mercado de Learning Management Systems (LMS) movimenta bilhões de dólares, mas está estagnado em arquiteturas concebidas há 15 anos:

### 4.1 O Market Share Global (2025/2026)
* **Canvas (Instructure) — ~50% do mercado:** Líder absoluto no Ensino Superior e em distritos escolares K-12. No entanto, é um sistema passivo de arquivos ("repositório glorificado de PDFs"). Em **maio de 2026, sofreu o catastrófico "Canvas Breach"**, vazamento de dados que expôs registros confidenciais e credenciais de milhares de instituições, abrindo uma crise de desconfiança global.
* **D2L Brightspace — ~20%:** Crescendo sobre perdas de concorrentes legados.
* **Blackboard Learn — ~12%:** Em retração acentuada; a controladora (Anthology) pediu recuperação judicial (**Chapter 11**) no fim de 2025.
* **Moodle — ~9%:** Opção open-source tradicional para soberania de dados, mas carente de inteligência cognitiva nativa.

### 4.2 Matriz Comparativa: Canvas vs. EduBot

| Dimensão | Canvas (Instructure) | EduBot (Next-Gen AI LMS) |
|:---|:---|:---|
| **Conceito Nuclear** | Repositório estático de arquivos e notas | Camada cognitiva agêntica em malha fechada |
| **Métrica de Engajamento** | "Tempo de tela aberta" e clique (Falso) | **Telemetria Honesta** (foco de tela, scroll por seção, % de vídeo) |
| **Avaliação do Conhecimento** | Média aritmética fria e atrasada | **Bayesian Knowledge Tracing (BKT)** com decaimento temporal |
| **Memória de Longo Prazo** | Nenhuma (ignora o esquecimento humano) | **Repetição Espaçada SM-2** automática |
| **Ação contra Dificuldade** | Nenhuma (espera o aluno tirar nota vermelha) | **IA Agêntica Proativa**: gera reforço adaptativo na hora |
| **Relação com o Docente** | Gera relatórios burocráticos manuais | **Fila de Aprovação**: IA prepara a ação e o professor valida |
| **Flexibilidade de IA** | Fechada ou chatbots genéricos de terceiros | **Model-Agnostic (BYOM)**: use o padrão ou plugue seu LLM |
| **Segurança e LGPD** | Fragilizado (Vítima do *Canvas Breach* 2026) | **LGPD Nativa por design**: PII isolado do prompt do agente |
| **Interoperabilidade** | Fechado / Extensões limitadas | **LTI 1.3 nativo**: substitui ou integra dentro de outro LMS |

---

## 5. A Solução: O Ciclo dos Quatro Tempos

O coração operacional do EduBot é um circuito de realimentação contínuo:

```
   ┌──────────────────────────────────────────────────────────────┐
   │                  THE FOUR-BEAT CYCLE                         │
   ▼                                                              │
① MEDIR ──────────────────────────────────────────────────────────┤
  Telemetria honesta: abas ocultas ignoradas, leitura ativa.      │
  │                                                               │
  ▼                                                               │
② MODELAR ────────────────────────────────────────────────────────┤
  BKT calcula domínio de competências (0-100%) com decaimento.    │
  │                                                               │
  ▼                                                               │
③ DECIDIR ────────────────────────────────────────────────────────┤
  Dois Cérebros: Regras determinísticas (QUANDO) + Agente (COMO). │
  │                                                               │
  ▼                                                               │
④ AGIR ───────────────────────────────────────────────────────────┤
  OVA de reforço personalizada, repetição SM-2, fila do professor.│
  └────────────────── Realimenta o Tempo 1 ───────────────────────┘
```

1. **Tempo 1 — Medir com Honestidade:**
   * Utiliza a `Page Visibility API` do navegador e monitor de inatividade de 3 minutos. Se o aluno sai da aba ou para de interagir, a contagem congela.
   * Rastreia leitura ativa por seção (`ova_section_progress`).
   * Rastreia consumo real de vídeo (distingue assistir de arrastar a barra).
   * **Trava Pedagógica do Quiz:** O quiz é bloqueado no servidor (HTTP 403) até que o estudante leia ao menos 70% do material do módulo.
2. **Tempo 2 — Modelar a Mente (Cognição):**
   * Transforma dados brutos em probabilidades matemáticas de domínio através do **Bayesian Knowledge Tracing (BKT)**, filtrando ruídos estatísticos.
   * Aplica decaimento temporal se o aluno passar semanas sem estudar (Curva de Ebbinghaus).
3. **Tempo 3 — Decidir com Governança:**
   * O motor de regras determinístico decide **quando** intervir a custo zero.
   * O agente generativo decide **como** intervir navegando em 11 ferramentas especializadas.
4. **Tempo 4 — Agir e Capacitar:**
   * Gera uma trilha de reforço adaptativa multimídia.
   * Agenda sessões de revisão espaçada SM-2.
   * Alimenta o painel do professor com alertas acionáveis na Fila de Aprovação.

---

## 6. Fundamentação Pedagógica e Científica

O EduBot foi desenhado sob teorias consolidadas da psicologia da aprendizagem e neurociência cognitiva:

1. **Zona de Desenvolvimento Proximal (Lev Vygotsky):**
   * O sistema calibra a dificuldade das questões em três níveis (1 fácil, 2 média, 3 difícil). Um aluno com domínio frágil recebe questões acessíveis para construir autoeficácia; somente após atingir 80% de domínio as questões complexas são liberadas.
2. **Bayesian Knowledge Tracing - BKT (Corbett & Anderson):**
   * Modela a probabilidade latente $P(L)$ de o aluno dominar a competência:
     * $P(L_0) = 0.20$ (Domínio inicial)
     * $P(T) = 0.15$ (Probabilidade de aprendizado a cada interação)
     * $P(G) = 0.25$ (Chute com acerto sem domínio)
     * $P(S) = 0.10$ (Deslize com erro apesar de dominar)
3. **Curva do Esquecimento e Repetição Espaçada (Hermann Ebbinghaus & SuperMemo SM-2):**
   * O aprendizado decai com o tempo sem prática ($Decay = 0.02$/semana). O algoritmo SM-2 agenda micro-revisões nos intervalos ideais (1 dia, 6 dias, 15 dias, 30 dias) calculados com base no fator de facilidade (*EF*) e taxa de acerto do estudante.
4. **Combate à "Ilusão de Competência":**
   * Pesquisas cognitivas mostram que reler passivamente um texto dá uma falsa impressão de domínio. A trava de 70% associada a quizzes ativos imediatos força o resgate ativo de memória (*retrieval practice*).
5. **Gamificação Baseada no Esforço (Carol Dweck - Mindset de Crescimento):**
   * Pontos de experiência (XP), títulos e sequências de estudo premiam **dedicação, rotina e resiliência**, não notas puras. Um aluno com dificuldades históricas pode ser o líder de XP da semana por seu empenho.

---

## 7. Arquitetura de Software e Engenharia de Custos (Two-Brain)

O calcanhar de Aquiles das soluções de IA educacionais é a fatura de tokens em nuvem. O EduBot resolve isso por desenho arquitetural:

### 7.1 A Arquitetura de Dois Cérebros
* **Cérebro 1 — Motor de Regras Determinístico (Custo Zero, 100% Auditável):**
  * Executa **95% dos eventos pedagógicos** na CPU/banco local: cálculo de telemetria, probabilidades BKT, agendamento SM-2, detecção de inatividade e escores de risco.
* **Cérebro 2 — Agente Autônomo com Tool-Use (AWS Bedrock / Claude Haiku):**
  * Acionado apenas nos **5% de intervenções** que exigem empatia, geração de texto personalizado ou curadoria de conteúdo.
  * Opera em loop estrito de no máximo 8 passos (média empírica de 5 passos) sobre **11 ferramentas pedagógicas**.
  * **5 Tiers de Autonomia Estrita:**
    * `read`: Consulta de perfil minimizado e histórico (`obter_perfil_resumido`, `historico_intervencoes`).
    * `auto`: Ações seguras e reversíveis (`agendar_revisao`).
    * `auto_capped`: Ajuste adaptativo de nível com teto diário (`ajustar_dificuldade`).
    * `auto_or_queue`: Alertas escalonáveis ao docente (`alertar_tutor`).
    * `queue`: Redação de mensagens em nome do professor — **bloqueadas no servidor sem validação humana expressa** (`propor_mensagem_do_tutor`).
* **Mecanismos de Segurança Orçamentária:** Teto diário configurável (< US$ 1,00/dia/turma), cache inteligente e *circuit breaker* que degrada graciosamente para templates inteligentes se a cota atingir 100%.

### 7.2 Stack Tecnológica
* **Frontend:** Single Page Application (SPA) moderna em React 18, TypeScript strict, Vite e Tailwind CSS. Bundle inicial ultra-leve de apenas **~62 kB**. Avatar 3D procedural acessível via Three.js e suporte nativo a Web Speech API e Edge Neural TTS.
* **Backend:** Python 3.10+ conteinerizado, Flask/FastAPI, Peewee ORM, autenticação Bearer Token sem expor segredos.
* **Banco de Dados:** MySQL 8.4 oficial com **23 migrações estruturadas**, suporte nativo a UTF-8 (`utf8mb4`).
* **Integração:** Padrão internacional **LTI 1.3** (compatível com Canvas, Brightspace, Blackboard e Moodle) e integração com a **API Crossref** para ancoragem de artigos científicos com DOI verificado.

---

## 8. Flexibilidade de Modelos de IA (Bring Your Own Model - BYOM)

Para garantir soberania tecnológica e atender desde redes públicas até faculdades e polos militares/industriais:
* **Padrão de Fábrica (Out-of-the-Box):** Operação nativa com **Claude 3.5 Haiku via AWS Bedrock**, entregando latência mínima e custo de frações de centavo por requisição.
* **Bring Your Own Model (BYOM):** A instituição tem autonomia total para trocar o motor de inteligência:
  * **OpenAI (GPT-4o / GPT-4o-mini)** para instituições do ecossistema Microsoft Campus;
  * **Google (Gemini 1.5 Pro / Flash)** para ecossistemas Google for Education;
  * **Modelos Open-Source Locais (Llama 3.3, Mistral, DeepSeek)** rodando *on-premise* no próprio data center da instituição, garantindo 100% de sigilo para pesquisas de defesa, patentes e dados confidenciais.

---

## 9. Governança Ética, Privacidade e Conformidade LGPD/GDPR

Diferente de sistemas que tratam privacidade como um pop-up de cookies, o EduBot aplica **Privacy by Design no backend**:
* **4 Switches de Consentimento Granular:**
  1. *Acompanhamento Pedagógico:* Base legal da prestação do serviço educacional.
  2. *IA sobre Dados Pessoais:* Estritamente opt-in e revogável a qualquer momento.
  3. *Uso de Imagem e Voz:* Opt-in para funcionalidades de avatar e biometria.
  4. *Ranking da Turma:* Opt-in para participação em gamificação competitiva.
* **Bloqueio Server-Side:** Se o aluno desativa o switch de IA, o servidor bloqueia o envio de seus dados para qualquer LLM e aplica pseudonimização matemática no banco de dados.
* **Proteção contra Vazamentos (Anti-Breach):** RAs, sobrenomes e identificadores fiscais jamais são inseridos nos prompts do agente.

---

## 10. Modelo de Negócio, Unit Economics e Ponto de Equilíbrio

O EduBot possui modelo comercial híbrido sustentável:

### 10.1 Precificação (Pricing Strategy)
* **B2B Universitário & Faculdades Privadas:** **R$ 9,00 / aluno / mês** (R$ 108,00 / ano).
* **B2B Centros Tecnológicos e P&D (ex: CIMATEC):** **R$ 14,00 / aluno / mês** (com BYOM dedicado e suporte a clusters locais).
* **B2G Rede Pública de Educação Básica e Técnica:** **R$ 2,50 a R$ 3,50 / aluno / mês** (R$ 30,00 a R$ 42,00 / ano), viabilizado por verbas vinculadas do **FUNDEB** e contratação simplificada pelo **Marco Legal das Startups (CPSI)**.

### 10.2 Custo dos Produtos Vendidos (COGS) por Aluno / Mês

| Linha de Custo | Valor (BRL) | Premissa / Hipótese |
|:---|:---:|:---|
| **Consumo de IA / Tokens (LLM)** | R$ 0,02 | Arquitetura Two-Brain: 95% das operações a custo zero; 4 chamadas Haiku/mês |
| **Infraestrutura Cloud & CDN** | R$ 0,34 | Cluster compartilhado AWS/OCI com bundle SPA de 62 kB e MySQL 8.4 gerenciado |
| **Operação, Suporte e LGPD** | R$ 0,40 | Suporte técnico N1/N2, logs de auditoria e conformidade de dados |
| **COGS TOTAL POR ALUNO** | **R$ 0,76** | **Custo mensal unitário por estudante ativo** |

### 10.3 Margens e Ponto de Equilíbrio (Break-Even)
* **Margem Bruta Unitária B2B:** **91,5%** (Margem de R$ 8,24 por aluno).
* **Margem Bruta Unitária B2G:** **78,3%** (Margem de R$ 2,74 por aluno).
* **Custos Fixos Mensais (Burn Rate):** **R$ 28.500,00 / mês** (Equipe enxuta de escala pós-hackathon: 2 Devs/IA, 1 Pedagogo, 1 Comercial, infra e jurídico).
* **Alunos para Break-Even:**
  * No B2B Universitário: **3.458 alunos** (apenas **1 faculdade privada de médio porte** cobre 100% dos custos fixos da empresa).
  * No B2G Educação Básica: **10.401 alunos** (apenas **1 secretaria municipal de médio porte ou 2 ETECs**).

### 10.4 O ROI Irrefutável para o Comprador
* **Para a Faculdade / Universidade Privada:**
  * Mensalidade média: R$ 950,00/mês (R$ 11.400,00/ano).
  * Custo do EduBot: R$ 108,00/aluno/ano.
  * **Salvar 1 único aluno de engenharia/TI da evasão por semestre paga o sistema para 105 alunos durante o ano inteiro**, além de elevar o conceito oficial no ENADE e CPC.
* **Para a Rede Pública / Governo:**
  * Custo do EduBot: R$ 42,00/aluno/ano.
  * Custo social de 1 ano de evasão: mais de R$ 14.000,00/jovem.
  * **Evitar a evasão de 1 aluno a cada 330 matriculados paga 100% do contrato público**, gerando economia direta em segurança pública e fortalecendo o capital humano regional.

---

## 11. Alinhamento com os ODS da ONU e Stakeholder CIMATEC

### 11.1 Os Objetivos de Desenvolvimento Sustentável (ODS)
* **ODS 4 (Educação de Qualidade):** Assegura educação inclusiva, equitativa e de qualidade, acabando com a exclusão gerada pela defasagem de base em ciências e matemática.
* **ODS 8 (Trabalho Decente e Crescimento Econômico):** Prepara a juventude para profissões de alta produtividade na economia digital.
* **ODS 9 (Indústria, Inovação e Infraestrutura):** Fomenta o funil de engenheiros necessários para acelerar a indústria 4.0 e patentes tecnológicas.
* **ODS 10 (Redução das Desigualdades):** Leva tutoria adaptativa de nível internacional para escolas públicas vulneráveis com conexões 3G simples.

### 11.2 Stakeholder Âncora: O Ecossistema SENAI CIMATEC
O **SENAI CIMATEC** é o polo de maior prestígio em engenharia, computação avançada e robótica do Brasil. Ele atua como **ambiente âncora de validação**:
* O CIMATEC integra ensino técnico, faculdade de engenharia, pós-graduação e P&D com a indústria.
* Disciplinas de alta complexidade (Cálculo Avançado, Física, Nuvem e Robótica) no CIMATEC servem de parâmetro: **se a IA do EduBot consegue nivelar e prevenir a evasão de alunos no padrão CIMATEC, a plataforma tem robustez para ser adotada em qualquer universidade do mundo**.

---

## 12. Maturidade Tecnológica (TRL) e Métricas de Código

* **TRL 6-7 (Technology Readiness Level):** Sistema totalmente funcional, operando em contêineres Docker, testado de ponta a ponta.
* **Testes Automatizados:** **258 testes automatizados unitários e de integração**, 100% verdes, executados em **2,74 segundos** com SQLite em memória.
* **Banco de Dados Relacional:** 29 tabelas, **23 migrações SQL estruturadas e idempotentes**, suporte completo a português e inglês (`_en`).
* **Endpoints de API:** 51 rotas REST documentadas cobrindo autenticação, telemetria, BKT, revisões SM-2, governança de IA e catálogo LTI.
* **Frontend SPA:** 100% construído em React 18 e TypeScript estrito, responsivo para smartphones e desktops.

---

## 13. Guia das Personas de Demonstração

Para demonstrar a plataforma sem atrito, 5 personas estão pré-configuradas no banco de dados (`seed_perfis_demo.py`):

| Persona | RA / Senha | Papel | O Que Demostra na Interface |
|---|:---:|---|---|
| **Thiago** | `6` / `6` | Aluno (1º Acesso) | Modal LGPD com 4 switches, onboarding amigável do avatar 3D, estado acolhedor zerado. |
| **Eduardo** | `1` / `1` | Aluno Dedicado | Telemetria honesta (72 min de leitura ativa), radar de domínio BKT (95%), revisão espaçada SM-2, gamificação por esforço (nível 5, 5 dias de streak). |
| **Yasmin** | `3` / `3` | Aluna em Risco | Trava pedagógica de leitura no quiz (70%), geração autônoma de OVA de Reforço com curadoria adaptativa e fontes Crossref com DOI. |
| **Gabriel** | `2` / `2` | Professor / Tutor | Mapa de calor de competências da turma (verde/amarelo/vermelho), escore de risco multi-sinal (0 a 100), Fila de Aprovação *Human-in-the-Loop*. |
| **Sanval** | `4` / `4` | Gestor / Reitor | Painel de controle de custos de tokens, status do *circuit breaker*, alternância de modelos BYOM e métricas de acreditação oficial. |

---

## 14. Banco Rápido de Perguntas e Respostas (Argon Cheatsheet)

Use estas respostas cirúrgicas para preencher campos de avaliação, formulários do Argon ou arguições da banca:

### Q1: O que é a inovação principal do EduBot?
> **R:** É o Ciclo dos Quatro Tempos em malha fechada: substitui o falso engajamento (cliques e tempo de janela) por Telemetria Honesta de leitura e vídeo; substitui médias frias por Bayesian Knowledge Tracing (BKT) com esquecimento de Ebbinghaus; e aciona uma IA agêntica de custo frugal com governança de 5 níveis e aprovação humana obrigatória.

### Q2: Como o EduBot se compara ao Canvas (Instructure)?
> **R:** O Canvas é um LMS passivo de 15 anos atrás que apenas armazena arquivos e mede tempo de página aberta, além de ter sofrido o grave *Canvas Breach* em maio de 2026. O EduBot é o Next-Gen AI-Native LMS: mede a leitura real por seção, detecta lacunas cognitivas por competência, gera trilhas adaptativas de reforço e possui segurança LGPD nativa.

### Q3: Qual é o público-alvo e modelo de negócio?
> **R:** Instituições de ensino em geral: no B2B, universidades e faculdades privadas (R$ 9,00 a R$ 14,00/aluno/mês); no B2G, redes públicas municipais e estaduais de educação básica e técnica (R$ 2,50 a R$ 3,50/aluno/mês via verbas do FUNDEB e Marco Legal das Startups).

### Q4: Como vocês controlam o custo de IA para não falir a operação?
> **R:** Com a Arquitetura de Dois Cérebros: 95% do processamento roda em regras matemáticas determinísticas no servidor a custo zero. O agente generativo só opera nos 5% de ações de alta empatia sob Claude 3.5 Haiku, mantendo o custo de tokens em apenas R$ 0,02/aluno/mês, com tetos diários e *circuit breakers*. Nosso COGS total é de R$ 0,76/mês.

### Q5: As instituições podem usar seus próprios modelos de IA?
> **R:** Sim. O EduBot é totalmente agnóstico a modelos (BYOM - Bring Your Own Model). A instituição pode utilizar o Claude Haiku padrão, plugar chaves da OpenAI (GPT-4o) ou Google (Gemini), ou rodar modelos locais open-source como Llama 3 dentro do seu próprio data center para pesquisas sigilosas.

### Q6: Como o EduBot impacta as notas e avaliações oficiais da instituição?
> **R:** O sistema calcula a probabilidade real de domínio curricular via BKT e combate a curva de esquecimento com o algoritmo SM-2. Isso gera relatórios preditivos que alertam a coordenação sobre fraquezas pedagógicas meses antes das provas oficiais, alavancando as notas do IDEB na educação básica e do ENADE, CPC e IGC no ensino superior.

### Q7: Qual é o papel do SENAI CIMATEC no projeto?
> **R:** O SENAI CIMATEC atua como stakeholder âncora de validação e excelência. Suas disciplinas de alta complexidade em engenharia e indústria 4.0 são o ambiente de prova definitivo para validar a eficácia pedagógica e a prontidão do software.

### Q8: Como o sistema garante a conformidade com a LGPD e evita incidentes de segurança?
> **R:** Privacidade por design com 4 níveis de consentimento no banco de dados. A IA sobre dados pessoais é estritamente opt-in. Se o aluno recusar, seus dados são anonimizados no servidor antes de qualquer processamento e dados sensíveis (RA, CPF) jamais entram nos prompts dos modelos.
