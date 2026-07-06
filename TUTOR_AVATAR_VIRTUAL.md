# Tutor com Avatar Virtual — Análise de viabilidade

> **Documento de análise. Nenhum código foi alterado.**
> Avalia a ideia de adicionar à plataforma um **personagem virtualizado (avatar em
> vídeo, escolhido pelo aluno) que explica o conteúdo do OVA e tira dúvidas em
> tempo real** enquanto o aluno estuda.
>
> Data: 2026-06-21 · Complementa: [PROJETO.md](PROJETO.md),
> [DADOS_E_AGENTE.md](DADOS_E_AGENTE.md), [OVA_PERSONALIZADA.md](OVA_PERSONALIZADA.md).

---

## Veredito

**É viável**, mas é uma **mudança de categoria de sistema**. Tudo que existe hoje é
request/response (Flask + páginas estáticas servidas por Apache). Um personagem que
**fala em vídeo e responde dúvidas ao vivo** é um sistema **multimodal de baixa
latência** (LLM + voz + avatar + streaming). Dá para construir sobre a base atual —
e o EduBot já é o esqueleto do "cérebro" —, mas o que decide o projeto **não é a
parte de código**, e sim **custo por minuto, latência/streaming, LGPD e a
necessidade de ligar o LLM real**.

---

## 1. Anatomia da feature (o "vídeo do personagem" é só a última camada)

| Camada | Função | Já existe? |
|---|---|---|
| **Cérebro (LLM)** | Explicar o assunto e responder dúvidas, ancorado no conteúdo do OVA | **Parcial** — `edubot_agent` já é swap-ready para Claude/Bedrock |
| **Voz de saída (TTS)** | Transformar a resposta em áudio | ❌ |
| **Voz de entrada (STT)** *(se o aluno falar)* | Transcrever a pergunta falada | ❌ (alternativa: aluno digita) |
| **Avatar (vídeo + lip-sync)** | Mostrar o personagem falando, sincronizado ao áudio | ❌ |
| **Orquestração em tempo real** | Pipeline streaming entrada→LLM→TTS→avatar com baixa latência | ❌ (Flask é só HTTP) |

> Ponto-chave: o LLM (Claude) **não gera vídeo nem voz** — gera o texto. O
> "personagem falando" vem de empilhar **TTS + avatar** sobre a resposta do modelo.

---

## 2. Abordagens possíveis para o avatar

| Abordagem | Como funciona | Realismo | Custo | Privacidade (LGPD) | Esforço |
|---|---|---|---|---|---|
| **A. Avatar gerenciado (streaming)** — ex.: Tavus CVI, HeyGen Interactive Avatar, D-ID, Azure TTS Avatar | Browser conecta via WebRTC ao provedor; você envia só o texto do LLM. Talking-head realista | Alto | **Alto** — cobrança **por minuto** (escala rápido com 500 alunos) | Dados/voz saem para terceiro | Médio (SDK pronto) |
| **B. Avatar no browser** — Ready Player Me + lip-sync (TalkingHead.js / Three.js) ou Live2D; voz por TTS (ElevenLabs / Azure / Amazon Polly) | Personagem 3D/2D renderiza no cliente; lip-sync a partir do áudio/visemes | Médio (estilo 3D) | **Baixo** — só TTS + LLM | Pode ficar tudo em 1 nuvem/região (ex.: AWS) | Médio-alto |
| **C. Vídeo pré-gravado + chat de dúvidas** — explicação gravada (Synthesia/HeyGen offline) + tutor de texto/voz para dúvidas (reusa EduBot) | "Explicar o assunto" = vídeo pronto; "tirar dúvidas" = chat | Alto no vídeo, mas **não é Q&A em vídeo ao vivo** | Baixa exposição | Boa | Baixo |

> "Tempo real em vídeo" de verdade só nas opções **A** e **B**. A opção **C** é o
> MVP pragmático: entrega a maior parte do valor com fração do custo/risco.

---

## 3. Encaixe na arquitetura atual (o que se reaproveita)

- **Cérebro**: o `edubot_agent` já tem o ponto de troca para Claude/Bedrock. O tutor
  conversacional reusa esse ponto — agora com **streaming** ligado.
- **Ancoragem no conteúdo (anti-alucinação)**: os OVAs são páginas **pequenas**
  (`Front-End/files/html/ovas/*.html`). Dá para **injetar o texto do OVA direto no
  system prompt** do Claude — **não precisa de banco vetorial/RAG** nessa escala.
  Grounding praticamente "de graça".
- **Personalização**: `student_context` já sabe a competência fraca do aluno → o
  personagem pode focar proativamente no que ele errou.
- **Telemetria**: cada pergunta/resposta pode virar linha em `interactions` (já
  existe); o consumo do "explicador" alimenta o perfil/EduBot.
- **Seleção de personagem**: uma tabela nova pequena (`avatares`: id, nome, provider,
  voice_id, avatar_id) + preferência no aluno. Trivial.
- **Ponto de montagem no frontend**: o leitor de OVA — `iframe.html`/`ova.js` no
  clássico e `Contents.tsx` no React — recebe o widget do avatar ao lado do conteúdo.

---

## 4. Os 4 problemas reais (não são de código)

1. **Custo** — avatar gerenciado por minuto × 500 alunos = conta que escala rápido.
   Mitigar com limites de uso, sessões curtas, ou abordagem **B** (browser).
2. **Latência** — para parecer "tempo real" é preciso *streaming ponta a ponta*
   (Claude streaming → TTS streaming → avatar). Orçamento realista: ~2–4 s até o
   personagem começar a falar. O Flask atual (request/response) não cobre isso —
   precisa de WebSocket (Flask-SocketIO) e/ou o WebRTC do próprio provedor.
3. **Privacidade / LGPD** — instituição brasileira, dados de aluno (e talvez **voz**)
   indo para serviço externo. Exige consentimento e, idealmente, manter tudo numa
   nuvem/região (ex.: Bedrock + Polly na AWS) ou provedor com acordo de dados.
4. **Decisão do mock** — hoje o LLM é *mockado* por decisão de projeto. Um tutor ao
   vivo **exige o Claude real conectado** — não dá para mockar uma conversa de
   verdade. É o pré-requisito #1.

---

## 5. Caminho recomendado (faseado, para reduzir risco)

- **Fase 0 — Tutor de texto ancorado no OVA** (barato, alto valor): ligar o Claude
  real, injetar o texto do OVA no prompt, chat lateral no leitor. Prova o cérebro +
  grounding. Reusa quase tudo que já existe.
- **Fase 1 — Dar voz e rosto (abordagem B)**: TTS + avatar no browser (Ready Player
  Me + lip-sync) com **seleção de personagem**. O aluno ouve e vê o personagem;
  ainda digita as dúvidas.
- **Fase 2 — Conversa falada / alta fidelidade**: STT para falar com o personagem
  e/ou trocar para avatar gerenciado (Tavus/HeyGen/Azure) onde o realismo justificar
  o custo.

Entrega valor cedo (a Fase 0 já é um tutor útil) e só assume custo/infra de avatar
quando o resto estiver provado.

---

## 6. Decisões que mudam o desenho (a definir antes de implementar)

- **Orçamento/realismo**: avatar realista pago por minuto (A), avatar 3D no browser
  mais barato (B), ou MVP com vídeo pré-gravado + chat (C)?
- **Nuvem**: AWS (Bedrock + Polly), que casa com o plano original do projeto, ou
  outro provedor?
- **Entrada do aluno**: por **voz** (precisa STT) ou **texto** já basta no início?
- **Privacidade**: há restrição de enviar dados/voz de aluno para serviço externo
  (LGPD / política da instituição)?

---

## 7. Conclusão

A ideia é **viável e bem alinhada** à base existente: o EduBot já é o esqueleto do
cérebro, os OVAs são pequenos o suficiente para grounding direto no prompt, e há
pontos claros de montagem no frontend e de telemetria. O esforço técnico é
gerenciável; o sucesso depende sobretudo de **custo, latência/streaming, conformidade
LGPD e de conectar o LLM real**. Recomenda-se começar pela **Fase 0 + abordagem B**.

> Próximo passo sugerido: transformar este documento em um **plano de implementação
> detalhado** para a abordagem escolhida (ainda sem alterar código até aprovação).
