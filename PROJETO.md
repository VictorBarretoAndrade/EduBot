# OVA-Rastreamento + EduBot Track — Visão Geral do Projeto

## O que é

O **OVA-Rastreamento** é uma plataforma educacional que rastreia a interação de alunos com **Objetos Virtuais de Aprendizagem (OVAs)** — aulas interativas digitais. O sistema monitora o desempenho dos alunos em avaliações por competências e oferece dashboards analíticos para professores e coordenadores.

O **EduBot Track** é a visão de evolução do projeto: adicionar um agente de IA educacional capaz de interpretar os dados rastreados, classificar o engajamento e a situação de cada aluno, e recomendar intervenções pedagógicas personalizadas de forma autônoma.

---

## Contexto

- Instituição brasileira de Engenharia de Computação
- Disciplinas cobertas: Computação Quântica, Cálculo, Cálculo 2
- 500 alunos pré-cadastrados + 1 administrador (coordenador)
- Linguagem: Português Brasileiro

---

## Arquitetura

O sistema roda via **Docker Compose** com 3 containers em rede bridge interna:

```
[Navegador] → Apache (porta 8010) → Flask API (porta 5010) → MySQL (porta 3310)
                HTML/JS estático       Python backend           Banco de dados
                172.168.30.4           172.168.30.3             172.168.30.2
```

### Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Banco de dados | MySQL 8.4 + Peewee ORM |
| Backend | Python 3.10, Flask, Flask-CORS |
| Frontend | HTML5, Bootstrap 5.3, jQuery 3.7, Plotly 2.31 |
| Infraestrutura | Docker, Docker Compose |

---

## Banco de Dados

### Modelo de dados

```
courses ──── offerings ──── course_subjects ──── competencies
                                                      │
                                                   questions ──── answers
                                                      │
ovas ─────────────────────────────────────────────────┘
 │
interactions ──── students ──── courses
```

### Tabelas

| Tabela | Descrição | Campos principais |
|--------|-----------|------------------|
| `students` | Alunos e admin | `ra`, `student_password`, `student_name`, `course_id`, `is_admin` |
| `courses` | Cursos disponíveis | `course_name` |
| `course_subjects` | Disciplinas | `subject_name` |
| `offerings` | Relação curso-disciplina | `course_id`, `subject_id` |
| `ovas` | Aulas interativas | `ova_name`, `link`, `num_interactions`, `subject_id` |
| `competencies` | Objetivos de aprendizagem | `competency_description`, `subject_id` |
| `questions` | Questões de avaliação (26 total) | `statement`, `alternatives` (JSON), `answer`, `ova_id`, `competency_id` |
| `answers` | Respostas corretas dos alunos | `student_id`, `question_id` |
| `interactions` | Log de ações do aluno | `interaction_date`, `interaction_time`, `student_action`, `student_id`, `ova_id` |
| `ova_progress` | Progresso do aluno por OVA | `student_id`, `ova_id`, `read_time`, `perc_scrolled`, `completed`, `last_access` |
| `attempts` | Tentativas das questões (inclui erradas) | `student_id`, `question_id`, `is_correct`, `attempt_time` |
| `interventions` | Histórico de intervenções (EduBot / admin) | `student_id`, `date`, `type`, `description`, `result` |
| `resources` | Recursos disponíveis por OVA | `ova_id`, `resource_type`, `resource_title`, `resource_url`, `media_type`, `competency_id` |
| `personalized_ova` | OVA de reforço gerada pelo agente para um aluno | `student_id`, `target_competency_id`, `title`, `message`, `rationale`, `status` |
| `personalized_ova_item` | Itens (recurso/questão) de uma OVA de reforço | `personalized_ova_id`, `item_kind`, `resource_id`, `question_id`, `position` |

### Competências mapeadas (6 total)

- 3 competências de Computação Quântica
- 3 competências de Cálculo

---

## Backend — API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/login` | Autentica aluno pelo RA e senha |
| GET | `/courses` | Lista todos os cursos |
| GET | `/course/<id>/subjects` | Lista disciplinas de um curso |
| GET | `/ova/course/<id>` | Lista OVAs disponíveis para o curso, agrupadas por disciplina |
| GET | `/ova/subject/<id>` | Lista OVAs de uma disciplina |
| GET | `/student/course/<id>` | Lista alunos de um curso (admin) |
| POST | `/question/ova` | Retorna questões da OVA com status de resposta do aluno |
| POST | `/question/answer` | Registra resposta correta |
| POST | `/interaction/register` | Registra interação do aluno com o conteúdo |
| POST | `/plot/student` | Desempenho do aluno por competência |
| POST | `/plot/course` | Desempenho geral de todos os alunos do curso |
| POST | `/plot/ova` | Desempenho por aluno em uma OVA específica |
| POST | `/plot/interaction/ova` | Contagem de interações do aluno em uma OVA |
| GET | `/student/report/<id>` | Retorna relatório agregado do aluno (JSON) com progresso, competências e histórico de intervenções |
| POST | `/edubot/personalized-ova` | **Agente de tool-use**: diagnostica a competência fraca e monta uma OVA de reforço (ver [OVA_PERSONALIZADA.md](OVA_PERSONALIZADA.md)) |
| GET | `/personalized-ova` | Lista as OVAs de reforço do aluno logado |
| GET | `/personalized-ova/<id>` | Conteúdo de uma OVA de reforço (recursos + quiz) |

---

## Frontend

### Páginas

| Arquivo | Descrição |
|---------|-----------|
| `login.html` | Tela de login com RA e senha |
| `ovas/quantum_computing.html` | Aula interativa de Computação Quântica |
| `ovas/calculus.html` | Aula interativa de Cálculo |
| `ovas/calculus2.html` | Aula interativa de Cálculo 2 |
| `plots.html` | Dashboard analítico com gráficos Plotly |
| `iframe.html` | Player de conteúdo embarcado |

### Sessão do usuário (localStorage)

| Chave | Conteúdo |
|-------|---------|
| `logged` | Boolean de autenticação |
| `is_admin` | Boolean de perfil admin |
| `course_id` | ID do curso do aluno |
| `student_id` | ID do aluno |
| `ova_id` | ID da OVA em uso |
| `read_time` | Tempo lido na OVA (segundos) — Sim (JS). Pode ser persistido no backend se o frontend enviar para `ova_progress` |
| `perc_scrolled` | % de scroll da página — Sim (JS). Pode ser persistido no backend se o frontend enviar para `ova_progress` |

---

## Fluxo de uso

### Aluno

```
Login (RA + senha)
    → Seleciona OVA do seu curso
    → Acessa conteúdo interativo (texto, vídeo, acordeões)
        → Interações registradas automaticamente
        → Responde questões → corretas são salvas
    → Visualiza próprio desempenho por competência
```

### Admin (Coordenador)

```
Login
    → Acessa dashboard (plots.html)
    → Seleciona curso → vê desempenho geral da turma
    → Seleciona aluno → vê desempenho por competência
    → Seleciona OVA → vê ranking de alunos na OVA
```

---

## O que o sistema rastreia hoje

| Dado | Rastreado? | Persiste no banco? |
|------|-----------|-------------------|
| Quais OVAs o aluno acessou | Sim | Sim (`interactions`) |
| Tipo de ação (scroll, clique, vídeo) | Sim | Sim (`interactions`) |
| Tempo de leitura por OVA | Sim (JS) | **Não** |
| % de scroll da OVA | Sim (JS) | **Não** |
| Respostas corretas | Sim | Sim (`answers`) |
| Tentativas erradas | Não | **Não** |
| % de vídeo consumido | Não | **Não** |

---

## Visão EduBot Track — O que falta implementar

### Dados a persistir (já rastreados no JS, só faltam chegar ao backend)

- `read_time` — tempo lido por OVA
- `perc_scrolled` — porcentagem de scroll
- Tentativas erradas nas questões

### Lógica do agente (a construir)

O EduBot classifica cada aluno com base nos dados e age autonomamente:

| Condição | Ação do EduBot |
|----------|---------------|
| Não acessa há 7+ dias | Mensagem de retomada |
| Consumiu < 40% dos recursos | Recomendar trilha mínima |
| Errou > 50% do quiz | Sugerir revisão com explicação alternativa |
| Acessou mas não concluiu atividade | Sugerir checklist de execução |
| Desenvolveu a competência | Recomendar aprofundamento |

### Classificação de engajamento

| Nível | Critério |
|-------|---------|
| Alto | Acessa frequentemente, diversifica interações, responde questões |
| Médio | Acessa com regularidade mas conclusão parcial |
| Baixo | Acesso esporádico, baixa conclusão |
| Em risco | Sem acesso recente + baixa conclusão |

### O que precisaria ser criado do zero

- Player de vídeo com tracking de % consumido
- Suporte a Áudio/Podcast como tipo de recurso
- Sistema de atividades práticas com submissão e avaliação
- Canal de mensagens do EduBot para o aluno (in-app ou email)

### Integração com IA (Claude API)

Com os dados classificados, o EduBot chama a API do Claude para:
- Gerar intervenção personalizada em linguagem natural
- Explicar por que o aluno está em risco
- Sugerir ação específica para o professor

---

## Como rodar

**Pré-requisito:** Docker Desktop instalado e rodando.

```powershell
cd OVA-Rastreamento
docker compose up
```

**Migração de schema para novas tabelas**

Caso deseje usar as novas tabelas em MySQL (produção), o arquivo `Database/sql/ddl_extra.sql` contém a DDL necessária para criar `ova_progress`, `attempts`, `interventions` e `resources`. Execute dentro do host MySQL ou via `docker exec` no container do MySQL:

```bash
docker exec -i <mysql-container> mysql -u root -p ova_db < Database/sql/ddl_extra.sql
```


Acesse: `http://localhost:8010/html/login.html`

| Perfil | RA | Senha |
|--------|----|-------|
| Aluno | 1 | 1 |
| Admin | sanval | sanval |

Para parar:
```powershell
docker compose down
```

---

## Estrutura de arquivos

```
OVA-Rastreamento/
├── compose.yaml                  # Orquestração Docker
├── Back-End/
│   ├── api/
│   │   ├── api.py                # Aplicação Flask principal
│   │   └── routes/
│   │       ├── loginRoute.py
│   │       ├── ovaRoute.py
│   │       ├── courseRoute.py
│   │       ├── studentRoute.py
│   │       ├── questionRoute.py
│   │       ├── interactionRoute.py
│   │       └── plotRoute.py
│   ├── data/models/              # Modelos ORM (Peewee)
│   └── plots/
│       └── data_analysis.py      # Queries de analytics
├── Front-End/
│   └── files/
│       ├── html/
│       │   ├── login.html
│       │   ├── plots.html
│       │   ├── iframe.html
│       │   └── ovas/
│       └── js/
│           ├── request.js        # Cliente HTTP
│           ├── login.js
│           ├── ova.js            # Rastreamento de interações
│           ├── plots.js          # Renderização de gráficos
│           └── make.js
└── Database/
    └── sql/
        ├── ddl.sql               # Criação das tabelas
        └── dml.sql               # 500 alunos + dados iniciais
```
