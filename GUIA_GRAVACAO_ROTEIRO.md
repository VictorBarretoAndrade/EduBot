# Guia de gravação — Ecossistema EduBot (passo a passo por cena)

Roteiro de cliques para gravar o vídeo (novo roteiro: *"O Ecossistema de
Aprendizagem Inteligente e Agêntico — EduBot"*, 6 cenas / ~8 min). Cada cena traz
o que dizer, **onde clicar** e o que aparece.

## Antes de gravar
0. **Zerar o aluno (começar do ZERO):** rode `.\reset-aluno.ps1` na pasta `OVA-IA`
   (apaga só o progresso do RA 1, mantém todo o conteúdo). Variações:
   `.\reset-aluno.ps1 -RA 3` (outro aluno) · `.\reset-aluno.ps1 -All` (todos).
   Depois, Ctrl+F5 no app.
1. Suba a plataforma: `docker compose up -d` (na pasta `OVA-IA`); aguarde o MySQL.
2. Abra **http://localhost:8010/app/** e dê **Ctrl+F5**.
3. Credenciais: **Aluno** RA `1` / `1` · **Tutor** RA `2` / `2`.
4. A conta do **Eduardo (RA 1)** já vem com dados de demo: **72 min de leitura**,
   **26% de recursos consumidos**, uma competência **desenvolvida** e uma
   **lacuna** detectada (para o reforço/alerta).
5. **Idioma:** o botão **PT/EN** fica no topo (Topbar). A interface e os textos de
   Competências/Conteúdos/Atividades trocam de idioma.
6. **Voz do EduBot:** use o **Microsoft Edge** para as vozes neurais mais naturais.
7. **IA real (opcional):** se a key da AWS Bedrock estiver válida no `.env`, o botão
   "Versão do EduBot (IA)" gera o texto pelo Claude; senão usa o texto local.

---

## CENA 1 — O Desafio e a Visão (0:00–1:00)
Narração sobre personalização em escala; surge a interface roxa/branca.
- **Tela de login** (já mostra o **logo do EduBot** e a marca).
- Fale da **interface bilíngue**: **clique no botão PT/EN** no topo para mostrar a
  troca de idioma (pode fazer login já em inglês para reforçar o "bilíngue").
- Faça login: RA `1` / `1` → abre o **Dashboard**.

## CENA 2 — O Motor da Rastreabilidade (1:00–2:30)
Narração sobre rastreabilidade total; cada interação é um sensor.
- No **Dashboard**, aponte os indicadores do Eduardo: **"72 min"** (Tempo de
  leitura), **"26%"** (Recursos consumidos), acerto nos quizzes e o donut de
  **Progresso**.
- **Clique em "Conteúdos"** → selecione **"Computação Quântica"** → **"Abrir conteúdo"**.
- No leitor: **role a página** (carrossel de qubits, acordeões), **dê play no vídeo**.
  Narre que tempo de leitura, vídeo, podcast e quiz viram **dados estruturados**.

## CENA 3 — A IA Agêntica em Ação (2:30–4:00)
Chat contextual + voz do EduBot no "My Performance".
- Com o OVA aberto, use o **chat lateral** (Assistente / "Pergunte à IA"):
  digite uma pergunta sobre o conteúdo → a resposta vem **contextual, com o chip
  "📌 Fonte"** citando a seção do material.
- **Clique em "Meu Desempenho"** (em inglês, *"My Performance"*).
- No card **"EduBot fala com você"** aparece o **avatar 3D**. **Escolha a persona**
  nos botões abaixo dele (*Prof. Einstein* / *Dra. Marie Curie*) — a troca é
  instantânea e fica salva.
- **Clique em "Ouvir o EduBot" / "Listen to EduBot"** → a **voz sintetizada** lê o
  feedback e a **boca do avatar 3D anima**. (Se a key da Bedrock estiver ativa,
  clique antes em **"Versão do EduBot (IA)"** para o texto gerado pelo Claude via
  **AWS Bedrock**.)
  - Setup dos modelos 3D (criar/trocar os avatares): ver [AVATAR_3D.md](AVATAR_3D.md).
- Mostre também a **Teia de competências** (radar) logo abaixo.

## CENA 4 — Ludicidade e Intervenção Proativa (4:00–5:30)
Avatar amigável + reforço ("Reinforcement") + alerta ao tutor.
- **Clique em "Reforço" / "Reinforcement"** → **"Gerar OVA de reforço"**: o EduBot
  diagnostica a **lacuna** (competência fraca) e monta a trilha; mostre o selo
  **"Foco: …"**, os recursos e o bloco **"Materiais externos"** (artigos Crossref).
- Troque para a conta de **tutor** (Sair → RA `2` / `2`) → aba **"Turma" / "Class"**.
- **Clique em "Analisar turma"** → o EduBot roda as **regras de decisão** e o
  aviso do aluno em risco aparece na **Central de alertas** ("alerta o tutor").

## CENA 5 — Excelência Técnica e Viabilidade (5:30–7:00)
Narração sobre a stack (React + Node.js + AWS Bedrock), TRL 4, mercado.
- **Tela:** mostre o **VS Code** com a estrutura de pastas e o **GitHub** do projeto
  (branch `feature/frontend-melhorias-conteudo`). Opcional: o diagrama de
  arquitetura. Use como pano de fundo da narração.

## CENA 6 — O Futuro é Agora (7:00–8:00)
Celebração; "Agentic AI for Education"; QR Code do GitHub.
- **Clique em "Dashboard"** para fechar mostrando a interface principal.
- Encerre com a vinheta **"Agentic AI for Education"** + QR Code (edição de vídeo).

---

## Percurso de cliques (resumo)
```
Login (PT/EN) → RA 1/1
 └ Dashboard: 72 min · 26% · Progresso
 └ Conteúdos → Computação Quântica → Abrir conteúdo → rolar + vídeo
     └ Chat lateral: perguntar → chip "Fonte"
 └ Meu Desempenho → Ouvir o EduBot (voz + boca) [+ Versão IA]
 └ Reforço → Gerar OVA de reforço → Materiais externos
 └ Sair → RA 2/2 (tutor) → Turma → Analisar turma → Central de alertas
 └ (Cena 5: VS Code + GitHub)  →  Dashboard (encerramento)
```

## Observações
- **Voz realmente natural** (nível ElevenLabs/Polly) exige uma credencial de
  **voz** — a key da Bedrock cobre só o **texto** (IA). No navegador, o Edge dá o
  melhor resultado.
- Se a key da Bedrock expirar, o botão de IA usa o **texto local** (sem erro).

*Guia de gravação — última atualização: 2026-07-01.*
