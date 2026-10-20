# EduBot: Plano de Implementação, Integração LTI 1.3 no Canvas (Instructure) e Arquitetura de Dados

**Projeto:** EduBot (Plataforma de Tutoria Inteligente e Análise de Aprendizagem)  
**Objetivo do Documento:** Especificação técnica e executiva para acoplamento da camada cognitiva do EduBot ao Canvas LMS (Instructure). Detalha a configuração do protocolo LTI 1.3 / LTI Advantage, telemetria de estudo ativo, processamento na Arquitetura de Dois Cérebros, sincronização com o ambiente virtual e cronograma de implantação em 8 semanas.  
**Maturidade Tecnológica:** TRL 6-7 (Sistema operacional em contêineres Docker, banco relacional MySQL 8.4 com 29 tabelas e 23 migrações SQL idempotentes, 51 rotas REST documentadas e suíte de 258 testes automatizados executados em 2,74 segundos).  
**Stakeholder Âncora de Validação:** Ecossistema SENAI CIMATEC (validação em disciplinas técnicas e de engenharia).

---

## 1. Visão Geral e Proposta de Valor na Integração com o Canvas

O Canvas (desenvolvido pela Instructure) responde por aproximadamente metade das instalações de ambientes virtuais de aprendizagem no Ensino Superior e em grandes redes de ensino básico. Projetado originalmente como repositório de distribuição de arquivos e registro retrospectivo de notas, o sistema não foi desenhado para medir a cognição do aluno durante o processo de estudo. 

Na operação diária, métricas tradicionais de LMS limitam-se a contabilizar cliques superficiais e tempo de tela aberta. Esse modelo gera falsos positivos de dedicação e deixa professores sem visibilidade real sobre o aprendizado de turmas com mais de 100 alunos até a realização das avaliações formais. Além disso, o incidente de segurança do Canvas Breach registrado em maio de 2026 expôs vulnerabilidades no tratamento de dados institucionais, elevando as exigências de privacidade no setor educacional.

O EduBot soluciona esse gargalo operando como camada cognitiva em circuito fechado acoplada ao Canvas via protocolo LTI 1.3 (Learning Tools Interoperability). Sem exigir a substituição do LMS vigente na instituição, o sistema agrega inteligência de processo:

* **Substituição de métricas superficiais por telemetria de leitura ativa:** Mede foco real de aba no navegador, retenção por seção do conteúdo textual e consumo autêntico de mídias em vídeo.
* **Diagnóstico contínuo por competência curricular:** Utiliza modelagem probabilística via Bayesian Knowledge Tracing (BKT) combinada ao algoritmo SuperMemo SM-2 para conter a curva de esquecimento de Ebbinghaus.
* **Governança docente com intervenção antecipada:** Opera com agente autônomo frugal (Arquitetura de Dois Cérebros) para construir Objetos Virtuais de Aprendizagem (OVAs) de reforço referenciados em literatura científica (API Crossref com DOI) e submeter recomendações à aprovação do professor antes que a reprovação ocorra.

### 1.1 Comparativo Direto: Canvas Nativo vs. Canvas Integrado ao EduBot

| Dimensão Operacional | Canvas Nativo (Instructure) | Canvas Integrado ao EduBot (LTI 1.3) |
|---|---|---|
| **Conceito Central** | Repositório estático de arquivos, tarefas e boletim | Camada cognitiva ativa integrada ao fluxo de estudo |
| **Métrica de Engajamento** | Tempo de aba aberta e contagem bruta de cliques | Telemetria de foco ativo (Page Visibility API), leitura por bloco e reprodução real de vídeo |
| **Controle de Leitura Prévia** | Inexistente (o aluno pode abrir o questionário sem leitura do conteúdo) | Trava pedagógica no servidor (HTTP 403), exigindo 70% de leitura ativa para liberar o quiz |
| **Diagnóstico de Aprendizado** | Média aritmética retrospectiva após a prova | Bayesian Knowledge Tracing (BKT) contínuo com decaimento temporal |
| **Retenção de Longo Prazo** | Nenhuma (conteúdo encerrado não é revisitado de forma sistemática) | Agendamento automatizado de revisões espaçadas via SM-2 (1, 6, 15 e 30 dias) |
| **Tratamento de Defasagem** | Reativo (aguarda notas insuficientes no fechamento de ciclo) | IA proativa que gera OVA de reforço sob medida com DOI e calibra dificuldade na ZDP de Vygotsky |
| **Relação com o Corpo Docente** | Relatórios estáticos consultados manualmente | Fila de Aprovação docente: diagnósticos e mensagens rascunhadas aguardando validação em um clique |
| **Flexibilidade de Modelos de IA** | Dependente de soluções fechadas de mercado | Política BYOM (Bring Your Own Model): Claude 3.5 Haiku padrão, GPT-4o, Gemini ou LLMs locais (Llama 3.3, Mistral) |
| **Segurança e Proteção de Dados** | Histórico de vulnerabilidade (exposição no Canvas Breach) | Arquitetura segura por desenho: 4 permissões granulares no banco, bloqueio no servidor e anonimização total |

---

## 2. Guia Técnico de Integração: Implementação LTI 1.3 no Canvas

A integração do EduBot ao Canvas não requer alterações no código-fonte do LMS. A aplicação cliente do EduBot, construída em React 18, TypeScript em modo estrito, Vite e Tailwind CSS, possui um pacote inicial otimizado de aproximadamente 62 kB, sendo carregada diretamente nos módulos das disciplinas via LTI 1.3 e LTI Advantage.

### 2.1 Passo 1: Registro de Chaves de Desenvolvedor no Canvas Admin

O administrador do ambiente Canvas cadastra o EduBot como ferramenta externa confiável com os seguintes parâmetros:

1. No menu **Canvas Admin > Developer Keys**, cria-se uma nova chave do tipo **LTI Key**.
2. Preenchem-se os endpoints de serviço do backend EduBot:
   * **Target Link URI:** Endpoint de inicialização da interface (`/lti/launch`).
   * **OpenID Connect Initiation Url:** Endpoint disparador do handshake de autenticação (`/lti/login`).
   * **JWK Method (Public JWK URL):** Chaves públicas criptográficas do EduBot (`/lti/jwks.json`) para validação de assinaturas RS256.
3. Habilitam-se os serviços do LTI Advantage:
   * **LTI Assignment and Grade Services (AGS):** Criação automática de colunas no Gradebook do Canvas e sincronização bidirecional de notas.
   * **LTI Names and Role Provisioning Services (NRPS):** Reconhecimento de papéis (aluno, professor, administrador) para roteamento automático da interface.
   * **LTI Deep Linking 2.0:** Seleção de módulos didáticos, OVAs e questionários do EduBot diretamente pelo painel de criação de conteúdo do professor no Canvas.
4. Ao ativar a chave, o Canvas fornece o **Client ID** e, na vinculação da disciplina, o **Deployment ID**, os quais são configurados no arquivo de ambiente do contêiner backend do EduBot.

### 2.2 Passo 2: Fluxo de Autenticação OIDC e Proteção de Dados

Quando o estudante acessa uma atividade do EduBot no Canvas, o fluxo de segurança ocorre em quatro etapas:

1. **Início do Login OIDC:** O Canvas envia parâmetros `login_hint` e `lti_message_hint` para o endpoint `/lti/login`. O backend valida a requisição e devolve o redirecionamento ao servidor de autorização da instituição.
2. **Emissão e Checagem do Token JWT:** O Canvas emite um JSON Web Token (JWT) assinado com RS256 para `/lti/launch`. O backend do EduBot valida a chave pública no JWK do Canvas, verifica a proteção contra repetição (nonce) e gera um Bearer Token interno para a interface React, mantendo as credenciais de infraestrutura isoladas no servidor.
3. **Gestão Granular de Privacidade:** No primeiro acesso do aluno, a aplicação apresenta a interface de consentimento com quatro níveis independentes registrados no banco de dados:
   * *Acompanhamento Pedagógico:* Base contratual para cálculo de progresso nas competências.
   * *Processamento por IA de Dados de Estudo:* Autorização voluntária e revogável a qualquer momento.
   * *Interatividade com Áudio e Avatar:* Habilitação de síntese de voz (Web Speech API) e renderização tridimensional (Three.js).
   * *Quadro de Destaque da Turma:* Opção de exibição do progresso em quadros de esforço compartilhado.
4. **Isolamento de Identificadores:** Se o aluno optar por não autorizar o processamento por IA, o servidor bloqueia o envio de requisições a modelos externos. Dados sensíveis como número de matrícula, CPF, nome completo ou e-mail institucional não são repassados aos prompts dos agentes em nenhuma circunstância.

### 2.3 Passo 3: Instrumentação dos Sensores de Telemetria no Cliente

Dentro do frame seguro no Canvas, a interface do EduBot ativa quatro rotinas de medição de comportamento:

1. **Monitoramento de Janela Ativa (Page Visibility API):** O cliente registra eventos de alteração de foco e visibilidade da aba (`visibilitychange`, `blur` e `focus`). Em caso de troca de janela, minimização ou inatividade por período superior a 3 minutos, a contagem de tempo de estudo é suspensa de forma automática.
2. **Leitura Estruturada por Seção (`ova_section_progress`):** Mediante observadores de interseção no DOM calibrados por velocidade média de leitura, o sistema valida a visualização contínua de cada bloco textual, impedindo que a rolagem rápida de página seja contabilizada como estudo realizado.
3. **Rastreamento de Mídia em Vídeo:** O componente de vídeo mapeia os intervalos de tempo reproduzidos, identificando quando houve avanço manual da barra de progresso sem visualização do conteúdo intermediário.
4. **Validação da Base Teórica no Servidor (HTTP 403):** O endpoint que disponibiliza as questões avaliativas bloqueia a entrega com resposta HTTP 403 enquanto o banco de dados não acusar pelo menos 70% de leitura ativa do material correspondente, coibindo respostas por tentativa aleatória.

---

## 3. Fluxo de Ponta a Ponta: Da Interação no Canvas ao Banco de Dados e Retorno ao Usuário

Os dados gerados pelo aluno no Canvas percorrem um ciclo estruturado em quatro tempos operacionais: Medir, Modelar, Decidir e Agir.

```
+-----------------------------------------------------------------------------------+
| 1. MEDIR (Telemetria no Canvas)                                                   |
|    Page Visibility API + Leitura por Bloco -> API REST -> MySQL 8.4 (29 tabelas)  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
| 2. MODELAR (Cérebro 1: Motor Determinístico)                                     |
|    BKT Atualiza P(L) + Decaimento Ebbinghaus (-0.02/sem) + Fator SM-2 (1,6,15,30d) |
+-----------------------------------------+-----------------------------------------+
                                          |
                        +-----------------+-----------------+
                        | (95% dos casos: OK)               | (5% críticos)
                        v                                   v
+-----------------------------------+   +-------------------------------------------+
| Retenção local a custo zero       |   | 3. DECIDIR (Cérebro 2: Agente com Trava)   |
| Agenda revisões e atualiza radar  |   |    Claude 3.5 Haiku / BYOM                |
+-----------------+-----------------+   |    API Crossref (DOI) + Rascunho Mensagem |
                  |                     +---------------------+---------------------+
                  |                                           |
                  +---------------------+---------------------+
                                        v
+-----------------------------------------------------------------------------------+
| 4. AGIR (Retorno na Interface e Canvas)                                           |
|    Alunos: Trilhas adaptativas e revisões | Docentes: Fila de aprovação em 1 clique|
|    Sincronização LTI AGS no Gradebook do Canvas                                   |
+-----------------------------------------------------------------------------------+
```

### Tempo 1: Ingestão e Armazenamento (Medir)
* Eventos de telemetria partem da aplicação React autenticados por cabeçalho Bearer Token para a API Python (construída com FastAPI e Peewee ORM), operando sobre 51 rotas mapeadas.
* O banco de dados relacional MySQL 8.4 registra as transações em 29 tabelas governadas por 23 migrações idempotentes, estruturado com codificação `utf8mb4` e suporte nativo a internacionalização de colunas pedagógicas em português e inglês.

### Tempo 2: Processamento Determinístico no Cérebro 1 (Modelar)
* Processa 95% das transações diretamente em CPU e consultas locais de banco de dados, sem gerar custos de nuvem ou chamadas externas.
* **Bayesian Knowledge Tracing (BKT):** Atualiza a estimativa de domínio latente $P(L)$ do estudante por habilidade curricular após cada tentativa, utilizando os parâmetros de calibração validados na literatura:
  * Domínio inicial: $P(L_0) = 0.20$
  * Taxa de aprendizado por transição: $P(T) = 0.15$
  * Probabilidade de acerto por chute casual: $P(G) = 0.25$
  * Probabilidade de erro por descuido: $P(S) = 0.10$
* **Decaimento e Intervalos Espaçados (SM-2):** Aplica redução de 0.02 por semana de inatividade na habilidade correspondente. O algoritmo SM-2 recalcula o fator de facilidade e programa micro-revisões nos intervalos de 1, 6, 15 e 30 dias.

### Tempo 3: Intervenção Cognitiva no Cérebro 2 (Decidir)
* Acionado exclusivamente nos 5% dos casos em que há detecção de estagnação de aprendizado, probabilidade elevada de evasão ou necessidade de recomendação estruturada.
* **Flexibilidade de Provedor (BYOM):** Conectado por padrão ao Claude 3.5 Haiku via AWS Bedrock, com capacidade de alternância via configuração para OpenAI (GPT-4o), Google (Gemini) ou inferência local via Ollama/vLLM (Llama 3.3, Mistral) para instituições que exigem custódia estrita de dados.
* **Hierarquia de 5 Níveis em 11 Ferramentas:**
  * *Nível Leitura (`read`):* Acesso a métricas agregadas sem identificadores diretos (`obter_perfil_resumido`, `historico_intervencoes`).
  * *Nível Automático Seguro (`auto`):* Operações didáticas com reversibilidade imediata (`agendar_revisao`).
  * *Nível Automático Limitado (`auto_capped`):* Ajustes de dificuldade balizados por teto diário (`ajustar_dificuldade`).
  * *Nível de Notificação Escalonada (`auto_or_queue`):* Alertas de desengajamento ao tutor (`alertar_tutor`).
  * *Nível com Retenção Obrigatória (`queue`):* Rascunhos de intervenção pedagógica (`propor_mensagem_do_tutor`), mantidos no servidor aguardando homologação do professor.
* **Controle Orçamentário e Contingência:** O subsistema inclui cota máxima de gasto diário por turma (inferior a US$ 1,00/dia), cache semântico de respostas e disjuntor operacional. Caso o limite financeiro seja alcançado, o sistema migra temporariamente para templates estáticos pré-validados, mantendo o custo de IA em R$ 0,02 por estudante ao mês.

### Tempo 4: Ações no Ambiente Virtual e Sincronização LTI (Agir)

| Perfil / Persona de Validação | Comportamento na Interface Embarcada e no Canvas |
|---|---|
| **Aluno em 1º Acesso**<br>*(Persona Thiago: RA 6 / Senha 6)* | **Apresentação e Consentimento:** Abertura do painel de privacidade com 4 permissões granulares. Renderização do assistente virtual em Three.js em modo de recepção, com pontuações zeradas e sem pressão de desempenho. |
| **Aluna com Dificuldade Detectada**<br>*(Persona Yasmin: RA 3 / Senha 3)* | **Trilha de Recuperação Adaptativa:** Entrega de conteúdo de reforço temático com artigos indexados via API Crossref e DOI checado. O sistema bloqueia questões de nível 3 até que o domínio no BKT atinja 80%, auxiliando a compreensão com leitura em voz pelo sintetizador de fala. |
| **Aluno com Desempenho Avançado**<br>*(Persona Eduardo: RA 1 / Senha 1)* | **Visibilidade de Domínio e Revisões:** Painel de proficiência com indicador de domínio (95%) e agenda de revisões SM-2 aos 1, 6, 15 e 30 dias. Reconhecimento por tempo efetivo de leitura (72 minutos) e constância de acessos em vez de notas pontuais. |
| **Docente Responsável**<br>*(Persona Gabriel: RA 2 / Senha 2)* | **Visão de Risco e Fila de Homologação:** Painel térmico da turma identificando discentes em zona de atenção antes das provas. Fila com diagnósticos e sugestões de mensagem gerados pela IA, permitindo aprovação, ajuste ou descarte em um clique, com sincronização automática de notas no Gradebook via LTI AGS. |
| **Gestor Institucional**<br>*(Persona Sanval: RA 4 / Senha 4)* | **Projeções de Indicadores e Painel de Custos:** Acompanhamento preditivo do desempenho da instituição (ENADE, CPC, IGC e IDEB) com base no domínio acumulado. Controle em tempo real do gasto de processamento de linguagem e status dos testes de integridade. |

---

## 4. Cronograma de Ativação Progressiva: Dashboards e Recomendações

A implantação das camadas funcionais do sistema ocorre em quatro etapas sucessivas de duas semanas, alinhadas ao volume de dados coletados na instituição:

```
[ Semanas 1 e 2 ]  Fase 1: Telemetria Honesta, Trava HTTP 403 e Configuração LGPD
[ Semanas 3 e 4 ]  Fase 2: Motor BKT, Curva de Ebbinghaus e Revisões Espaçadas SM-2
[ Semanas 5 e 6 ]  Fase 3: Cérebro 2, OVAs com Artigos DOI e Fila de Aprovação Docente
[ Semanas 7 e 8 ]  Fase 4: Sincronização Gradebook LTI AGS, FinOps e Painel Executivo
```

### Fase 1: Telemetria e Regras Estruturais (Semanas 1 e 2)
* **Entradas de Dados:** Registros de foco ativo (Page Visibility API com limite de 3 minutos), leitura validada por bloco (`ova_section_progress`) e checagem da trava de leitura mínima.
* **Telas Disponíveis:**
  * *Painel do Aluno:* Percentual de leitura ativa por módulo, barra de liberação do quiz e opções de privacidade.
  * *Painel do Professor:* Indicador de tempo real dedicado ao estudo na disciplina, depurando tempos passivos de aba aberta.
* **Lógica de Decisão:** Processamento integral no Cérebro 1, bloqueando requisições ao quiz quando a leitura for inferior a 70% e apontando os blocos pendentes de estudo.

### Fase 2: Diagnóstico Cognitivo BKT e Retenção SM-2 (Semanas 3 e 4)
* **Entradas de Dados:** Histórico de resolução de exercícios correlacionado à cadência de leitura por competência.
* **Telas Disponíveis:**
  * *Painel do Aluno:* Radar de proficiência nas competências da disciplina e calendário de revisões espaçadas.
  * *Painel do Professor:* Mapa térmico da turma (classificação por cores) e índice de risco discente.
* **Lógica de Decisão:** Calibração automática da complexidade dos exercícios e agendamento de baterias de retenção aos 1, 6, 15 e 30 dias mediante cálculo de decaimento temporal.

### Fase 3: Apoio Agêntico e Homologação Docente (Semanas 5 e 6)
* **Entradas de Dados:** Identificação dos 5% de estudantes com persistência de erro ou baixo domínio acumulado.
* **Telas Disponíveis:**
  * *Painel do Aluno:* Acesso a materiais didáticos complementares enriquecidos com artigos acadêmicos via API Crossref e apoio do tutor virtual.
  * *Painel do Professor:* Fila de aprovação de intervenções contendo as notificações e os rascunhos de abordagem pedagógica.
* **Lógica de Decisão:** Acionamento do Cérebro 2 em rotinas de até 8 passos para formulação de rotas personalizadas de estudo e sugestões ao docente.

### Fase 4: Inteligência Institucional e Sincronização Definitiva (Semanas 7 e 8)
* **Entradas de Dados:** Índices consolidados de retenção, curvas de recuperação discente pós-revisão e dados de custo de nuvem.
* **Telas Disponíveis (Gestão e Reitoria):**
  * *Painel de FinOps:* Monitoramento do custo operacional por aluno e controle de chaves de modelos de linguagem.
  * *Painel Preditivo Institucional:* Simulação de impacto em exames oficiais (ENADE, CPC, IGC e IDEB) e acompanhamento de receita retida por combate à evasão.
* **Lógica de Decisão:** Emissão de relatórios para coordenações apontando disciplinas críticas que concentram taxas anômalas de retenção para ajustes pedagógicos.

---

## 5. Cronograma Executivo de Implantação (8 Semanas em 4 Sprints)

| Sprint / Período | Etapa | Entregas Técnicas no Canvas e no EduBot | Critério de Aceite e Homologação |
|---|---|---|---|
| **Sprint 1**<br>*(Semanas 1 e 2)* | Integração LTI 1.3 e Governança de Dados | Registro de Developer Keys, OIDC e endpoints JWK no Canvas Admin. Implantação dos contêineres Docker (Python 3.10+ e MySQL 8.4 com 29 tabelas). Carregamento da aplicação React (62 kB) e ativação das telas de privacidade. | Login SSO funcional via LTI 1.3 sem exposição de identificadores pessoais. Validação do bloqueio de IA no servidor com a Persona Thiago. |
| **Sprint 2**<br>*(Semanas 3 e 4)* | Telemetria de Estudo e Diagnóstico BKT | Ativação do monitoramento de foco, leitura por seção e trava de liberação de quiz (HTTP 403 aos 70%). Habilitação do cálculo probabilístico BKT, decaimento de Ebbinghaus e agendamento SM-2. | Coleta de telemetria validada no banco de dados. Visualização correta do Radar de Domínio e Mapa Térmico com as Personas Eduardo e Gabriel. |
| **Sprint 3**<br>*(Semanas 5 e 6)* | Assistência Agêntica e Validação Docente | Integração com AWS Bedrock (Claude 3.5 Haiku) ou modelos institucionais. Ativação dos conectores da API Crossref para busca de artigos com DOI. Lançamento da Fila de Aprovação para professores. | Geração de conteúdo complementar para a Persona Yasmin e retenção obrigatória de mensagens rascunhadas até aprovação manual do docente. |
| **Sprint 4**<br>*(Semanas 7 e 8)* | Sincronização LTI AGS e Homologação Geral | Sincronização de notas com o Gradebook do Canvas via LTI AGS. Entrega do painel executivo com telemetria financeira e simulações institucionais. Testes de carga em disciplinas técnicas. | Custo de IA mantido abaixo do teto diário planejado. Suíte com 258 testes automatizados aprovada integralmente em 2,74s com a Persona Sanval. |

---

## 6. Viabilidade Financeira, Sustentabilidade Operacional e Retorno do Investimento

A estrutura de custos do EduBot foi desenhada para viabilizar a sustentabilidade operacional em larga escala, impedindo que o uso de inteligência artificial encareça a manutenção do sistema para a instituição.

### 6.1 Composição do Custo Unitário por Aluno Ativo ao Mês (COGS)

| Componente Operacional | Custo Mensal por Aluno | Justificativa Técnica |
|---|:---:|---|
| **Processamento de IA (Tokens / LLM)** | R$ 0,02 | Arquitetura Two-Brain: 95% das operações ocorrem no motor determinístico local a custo zero de inferência. Média de 4 acionamentos do Haiku por mês para casos críticos. |
| **Infraestrutura Cloud e Distribuição (CDN)** | R$ 0,34 | Aplicação estática compacta (~62 kB), balanceamento de carga e instâncias compartilhadas de MySQL 8.4 gerenciado. |
| **Operação, Suporte e Auditoria de Dados** | R$ 0,40 | Suporte técnico aos administradores, manutenção da segurança da informação e auditoria contínua de registros de privacidade. |
| **Custo Operacional Total (COGS)** | **R$ 0,76** | **Custo consolidado por estudante ativo integrado ao Canvas.** |

### 6.2 Modelos de Contratação e Ponto de Equilíbrio (Break-Even)

* **Planos Comerciais:**
  * *B2B Ensino Superior Privado:* R$ 9,00 por aluno ao mês (R$ 108,00 anuais), propiciando margem bruta de 91,5% (R$ 8,24 por estudante).
  * *B2B Centros Tecnológicos e P&D (padrão SENAI CIMATEC):* R$ 14,00 por aluno ao mês, incluindo suporte a modelos locais em infraestrutura dedicada da instituição.
  * *B2G Setor Público (Educação Básica e Profissional):* R$ 2,50 a R$ 3,50 por aluno ao mês (R$ 30,00 a R$ 42,00 anuais), com margem bruta de 78,3%, viabilizado por contratações com respaldo no Marco Legal das Startups (CPSI) ou recursos do FUNDEB.
* **Ponto de Equilíbrio da Operação:** Com custos fixos estruturados em R$ 28.500,00 ao mês, a operação atinge equilíbrio financeiro com 3.458 estudantes ativos no modelo privado (volume correspondente a uma faculdade de porte médio) ou 10.401 alunos na rede pública.
* **Retorno Financeiro para a Instituição:**
  * *No Ensino Superior Particular:* Considerando uma mensalidade média de R$ 950,00 (perda de R$ 11.400,00 anuais por evasão) diante da anuidade de R$ 108,00 do sistema, a retenção de um único estudante que desistiria da graduação por dificuldades nos semestres iniciais custeia o EduBot para 105 alunos durante um ano letivo completo, protegendo concomitantemente as notas de avaliação do MEC.
  * *Na Rede Pública de Ensino:* Diante de um custo anual de R$ 42,00 por aluno contra um custo social decorrente do abandono escolar superior a R$ 14.000,00 anuais por jovem evadido, evitar uma única evasão a cada 330 matrículas cobre o valor integral do contrato anual, contribuindo com as metas dos Objetivos de Desenvolvimento Sustentável 4, 8 e 9 da ONU.

---

## 7. Matriz de Síntese de Validação Técnica e Controles de Governança

| Subsistema | Solução Integrada no EduBot | Validação Prática no Canvas LMS |
|---|---|---|
| **Interoperabilidade com o LMS** | Conexão LTI 1.3 via OIDC, checagem criptográfica RS256, cliente React compacto (62 kB) e retorno por LTI AGS. | Autenticação em sessão única nos módulos do curso sem vazamento de chaves e atualização automática do Gradebook. |
| **Conformidade com LGPD** | Painel de controle no primeiro acesso com 4 escolhas granulares, bloqueio de IA no servidor e anonimização de registros. | Proteção contra incidentes de segurança corporativos: dados civis nunca integram requisições de modelos de linguagem (Persona Thiago). |
| **Telemetria de Estudo Efetivo** | Registro de janela ativa via Page Visibility API, leitura por seção e trava de avaliação teórica (HTTP 403). | Congelamento de contagem após 3 minutos sem interação e retenção das questões do quiz até 70% de leitura concluída. |
| **Cérebro 1 (Motor Determinístico)** | Algoritmo BKT parametrizado, compensação de esquecimento de Ebbinghaus e agendamento de revisões via SM-2. | Resolução de 95% dos eventos pedagógicos localmente a custo zero, com agendamentos espaçados aos 1, 6, 15 e 30 dias (Persona Eduardo). |
| **Cérebro 2 (Agente com Supervisão)** | Conexão com Claude 3.5 Haiku / BYOM, limites de até 8 passos, 11 ferramentas em 5 níveis de controle e busca de artigos com DOI via Crossref. | Criação de planos de estudo temáticos para estudantes com dificuldades (Persona Yasmin) e retenção de comunicados até validação docente (Persona Gabriel). |
| **Governança de Custos e Qualidade** | Teto diário de processamento (< US$ 1,00 por turma), disjuntor de segurança, projeções de desempenho institucional e testes automatizados. | Despesa de IA controlada em R$ 0,02 por aluno ao mês (COGS de R$ 0,76) e estabilidade operacional atestada por 258 testes executados em 2,74s (Persona Sanval). |
