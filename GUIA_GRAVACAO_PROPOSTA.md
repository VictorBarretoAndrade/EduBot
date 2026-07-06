# Guia de gravação — Roteiro "Proposta de Roteiro" (8 min, 6 cenas)

Passo a passo de **onde clicar** e **o que mostrar** na plataforma, com as
**falas (narração)** de cada cena, para gravar o vídeo de 8 minutos descrito em
`Proposta de Roteriro.docx`.

> Legenda: 🎬 o que mostrar/onde clicar · 🎙️ narração (fala) · 💡 nota técnica.

---

## Preparação (antes de gravar)

1. **Suba a plataforma:** na pasta `OVA-IA`, `docker compose up -d` (aguarde o MySQL).
2. **Abra** http://localhost:8010/app/ e dê **Ctrl+F5**.
3. **Credenciais:** Aluno **RA `1` / senha `1`** (Eduardo) · Tutor **RA `2` / senha `2`** (Gabriel).
4. **Voz do EduBot:** use o **Microsoft Edge** (vozes neurais mais naturais).
5. **IA real (AWS Bedrock):** já ligada para a fala do EduBot ("Versão do EduBot (IA)").
   Se a key expirar, o card usa o texto local automaticamente (sem quebrar).
6. **Dados do aluno — escolha o modo:**
   - **Modo AO VIVO (recomendado, casa com a narração):** rode `.\reset-aluno.ps1`
     para zerar o Eduardo. Nas Cenas 2–3 você **gera os dados na frente da câmera**
     (lê, assiste, responde o quiz **errando 1–2 questões de uma competência**).
     Entre uma cena e outra, **Ctrl+F5** para os gráficos refletirem o novo dado.
   - **Modo PRÉ-PREENCHIDO:** faça esses passos **antes** de gravar (consuma
     recursos + erre parte do quiz), assim as Cenas 3–4 já abrem com gráficos e
     lacuna prontos, sem risco ao vivo.

💡 As Cenas 3 e 4 precisam de **alguma atividade + erro no quiz** para o avatar
falar do progresso, a Teia de competências encher e o Reforço detectar a lacuna.

---

## CENA 1 — Introdução: o desafio e nossa solução (0:00–0:45)

🎬 **Tela de login** (http://localhost:8010/app/): mostre o **logo/identidade
roxa** do EduBot. Clique no botão **PT/EN** (topo) para evidenciar a **interface
bilíngue**. Faça login: **RA `1` / `1`** → abre o **Dashboard**.

🎙️ *"Em um mundo onde o conhecimento avança exponencialmente, a educação busca um
novo paradigma: como personalizar o aprendizado para cada estudante, mantendo-o
engajado e motivado? Apresentamos uma plataforma web inovadora, projetada para
redefinir a experiência de ensino-aprendizagem, tornando-a verdadeiramente
pessoal, dinâmica e, acima de tudo, eficaz."*

---

## CENA 2 — A aplicação em ação: rastreamento completo + IA embarcada (0:45–3:00)

### Parte A — navegar e gerar dados
🎬 No **Dashboard**, passe o cursor pelos indicadores: **Tempo de leitura**,
**Atividades práticas**, **Acerto nos quizzes**, **Recursos consumidos** e o donut
**Progresso**. Depois:
- Menu lateral → **Conteúdos** → selecione **"Fundamentos de Computação na Nuvem"**
  → **Abrir conteúdo**.
- No leitor: **role a página** (carrossel, acordeões), **dê play no vídeo**, abra o
  **podcast** (player de áudio) e passe pelas **questões**. Narre que cada um vira dado.

🎙️ *"Nossa aplicação web é o coração do Agente Inteligente. Ela não é apenas um
repositório de conteúdo, mas um ambiente totalmente rastreável, onde cada
interação do aluno com textos, vídeos, podcasts, quizzes, atividades e até mesmo a
IA generativa embarcada é um dado valioso. Aqui, o material didático é dinâmico,
alinhado às diretrizes e competências de cada disciplina. Vejam como, na
disciplina 'Fundamentos de Computação na Nuvem', o aluno navega por uma aula,
acessando e interagindo com esses diferentes recursos, e cada um desses pontos
gera dados para o nosso sistema."*

### Parte B — IA generativa embarcada
🎬 No leitor de OVA, abra o **chat lateral** ("Assistente" / "Pergunte à IA") e
**digite uma pergunta sobre o conteúdo na tela** (ex.: *"Qual a diferença entre
IaaS, PaaS e SaaS?"*). A resposta vem **contextual**, com o **chip "📌 Fonte"**
citando a seção do material.

🎙️ *"A inteligência artificial embarcada permite que o aluno dialogue diretamente
com o conteúdo, aprofundando sua compreensão. Este é um dos muitos pontos de
interação que geram dados. Nossa IA processa todas essas interações – sejam elas
com textos, vídeos, quizzes ou com a própria IA generativa – e os dados de
consumo, reconhecendo o percurso do estudante e o quanto ele avança em relação às
competências a serem desenvolvidas. Tudo isso em tempo real, dentro da própria
aplicação, criando um perfil de aprendizagem detalhado que será a base para
análises e recomendações personalizadas."*

💡 **Faça o Quiz agora** (menu **Quiz** ou dentro do OVA) e **erre 1–2 questões de
uma mesma competência** — isso alimenta as Cenas 3 e 4. A correção é no servidor.

---

## CENA 3 — O EduBot e o Avatar: ludicidade e feedback personalizado (3:00–5:00)

🎬 Menu lateral → **Meu Desempenho** ("My Performance"). No card **"EduBot fala com
você"**:
- Aparece o **avatar 3D**. **Escolha a persona** nos botões abaixo dele
  (**Prof. Einstein** / **Dra. Marie Curie**).
- Clique em **"Versão do EduBot (IA)"** → o texto é gerado pelo **Claude na AWS
  Bedrock** (aparece o selo "por IA").
- Clique em **"Ouvir o EduBot"** → a **voz** narra e a **boca do avatar 3D anima**.
- Role para mostrar a **Teia de competências** (radar) e os gráficos de **evolução**.

🎙️ *"Ao final de cada etapa, o EduBot, nosso Agente Educacional de IA, através de
um sistema de processamento de dados robusto, gera um extrato detalhado do
processo de aprendizagem do aluno. Ele acompanha o consumo de recursos, mensura o
desenvolvimento de competências e identifica indicadores de engajamento. E para
tornar esse feedback ainda mais impactante e lúdico, o EduBot se manifesta através
de um avatar personalizado."*

🎙️ (exemplo de fala do avatar — VO encorajadora) *"Olá Ana! Percebo que você
consumiu os materiais, mas errou o quiz. Recomendo uma explicação alternativa e um
novo quiz curto para reforçar seu aprendizado!"*

🎙️ *"Este avatar não é apenas uma interface lúdica; é a personificação do nosso
EduBot, dialogando com o estudante e transformando dados complexos em insights
acionáveis e motivadores. Ele reconhece o percurso individual, o quanto cada
estudante avançou e quais competências foram desenvolvidas, atuando de forma
proativa."*

💡 O texto real na tela citará **"Eduardo"** (o aluno logado). A fala "Olá Ana…" do
roteiro é um **exemplo ilustrativo** — narre como exemplo, ou apenas deixe o
EduBot falar o texto do Eduardo.

---

## CENA 4 — Recomendação inteligente e intervenções pedagógicas (5:00–6:30)

### Parte A — recomendação com fontes (aluno)
🎬 Menu lateral → **Reforço** ("Reinforcement") → **"Gerar OVA de reforço"**. O
EduBot diagnostica a **lacuna** (competência com mais erro), mostra o selo
**"Foco: …"**, os **recursos da trilha** e o bloco **"Materiais externos"** (artigos
científicos via Crossref — o "explorar bases de dados científicas" da narração).
Clique num material para mostrar que abre o recurso.

🎙️ *"Quando uma competência não é plenamente desenvolvida ou o engajamento diminui,
nosso EduBot ativa um sistema de recomendação personalizado. Baseado na análise
contínua dos dados de aprendizagem, ele sugere conteúdos específicos – seja para
retornar a uma seção da aplicação, consultar materiais da biblioteca virtual ou
explorar bases de dados científicas. Por exemplo, se o Bruno não assistiu ao vídeo
e não fez o quiz, o EduBot envia um plano de retomada e alerta o tutor."*

### Parte B — regras de decisão + alerta ao tutor
🎬 (Na edição, sobreponha os infográficos das regras abaixo.) Depois, **Sair** e
entre como **tutor (RA `2` / `2`)** → menu **Turma** ("Class") → **"Analisar
turma"**: o EduBot roda as regras e o **aluno em risco aparece na Central de
alertas** ("alerta o tutor").

Regras de decisão (infográficos):
- **Sem acesso há 7 dias** → enviar mensagem de retomada.
- **Consumiu < 40% dos recursos** → recomendar trilha mínima.
- **Errou > 50% do quiz** → sugerir revisão com explicação alternativa.

🎙️ *"É um ciclo virtuoso de aprendizado adaptativo, onde o EduBot garante que
nenhuma lacuna seja deixada para trás, impulsionando o estudante em sua jornada de
desenvolvimento e apoiando professores e gestão pedagógica."*

---

## CENA 5 — Inovação e visão futura (6:30–7:30)

🎬 Mostre a **arquitetura/engenharia**: **VS Code** com a estrutura de pastas e o
**GitHub** do projeto (opcional: um diagrama de arquitetura como pano de fundo).
**Volte ao "Meu Desempenho"** e **alterne a persona do avatar (Einstein ↔ Marie
Curie)** — este seletor é a **primeira realização concreta** da visão de "estudar
com o avatar de um especialista renomado".

🎙️ *"O EduBot transcende a funcionalidade de um chatbot tradicional. Ele observa a
jornada de aprendizagem, sabe quais conteúdos foram consumidos, mede competências e
atua de forma preventiva, apoiando estudante, professor e gestão pedagógica. Nossa
IA agêntica, que processa o percurso e as competências, aliada à ludicidade do
avatar, cria uma experiência única e altamente engajadora. E a visão de futuro?
Imagine estudar 'Fundamentos de Computação na Nuvem' com um avatar do próprio Bill
Gates, interagindo com sua voz e conhecimento, respeitando, é claro, todos os
direitos de privacidade e imagem. Nossa plataforma abre as portas para um
aprendizado sem fronteiras, com acesso a especialistas e experiências que antes
eram inimagináveis."*

💡 Os avatares atuais (Einstein/Curie) são **figuras estilizadas** que evocam os
cientistas — ao citar "Bill Gates", mantenha a **ressalva sobre direitos de imagem**
como no roteiro.

---

## CENA 6 — Chamada para ação e impacto (7:30–8:00)

🎬 Volte ao **Dashboard** mostrando a interface principal, agora com dados do aluno.
Encerre com a vinheta **"Agentic AI for Education"** + convite aos avaliadores /
contato (na edição, com QR Code do GitHub).

🎙️ *"O EduBot, não é apenas um projeto; é a promessa de um futuro onde a educação é
100% personalizada, baseada em dados e profundamente engajadora. É a IA agêntica a
serviço do aprendizado humano, transformando desafios em oportunidades e cada
estudante em um protagonista de sua própria jornada."*

🎙️ *"Convidamos vocês a vislumbrar esse futuro conosco. O futuro da educação é
agora. O futuro conectar ensino e aprendizagem com inteligência artificial."*

---

## Percurso de cliques (resumo)

```
Login (PT/EN) → RA 1/1
 └ Dashboard: indicadores + donut Progresso
 └ Conteúdos → Fundamentos de Computação na Nuvem → Abrir conteúdo
     └ rolar + vídeo + podcast + questões
     └ Chat lateral: perguntar → chip "📌 Fonte"
     └ Quiz (errar 1–2 de uma competência)
 └ Meu Desempenho → persona (Einstein/Curie) → Versão do EduBot (IA) → Ouvir o EduBot
     └ Teia de competências (radar) + gráficos
 └ Reforço → Gerar OVA de reforço → Materiais externos (Crossref)
 └ Sair → RA 2/2 (tutor) → Turma → Analisar turma → Central de alertas
 └ (Cena 5: VS Code + GitHub + alternar persona)  →  Dashboard (encerramento)
```

## Observações
- **Voz mais natural:** Edge dá o melhor resultado (vozes neurais pt-BR/en-US).
- **Se a key da Bedrock cair:** o botão de IA usa o texto local, sem erro.
- **Zerar o aluno de novo:** `.\reset-aluno.ps1` (ver Preparação).

*Guia de gravação (Proposta de Roteiro, 8 min) — 2026-07-01.*
