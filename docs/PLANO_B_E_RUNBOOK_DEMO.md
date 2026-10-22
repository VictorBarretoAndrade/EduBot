# Runbook de Demonstração e Plano B — Hackathon EduBot (`v1.0`)

Este documento descreve a preparação do notebook de apresentação para operar em **3 níveis de contingência** (Plano A, Plano B1 e Plano B2), garantindo que **nenhuma falha de Wi-Fi, queda de rede do evento ou instabilidade de API de LLM** interrompa a demonstração ao vivo.

---

## 1. Os 3 Níveis de Operação da Demo

| Plano | Cenário | URL de Acesso | Cérebro do Agente | Latência das Ações de IA | Dependência de Internet |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Plano A (Principal)** | Produção na Nuvem Azure com HTTPS | `https://edubot-project.chilecentral.cloudapp.azure.com/app/` | Azure AI Foundry Real (`gpt-5-mini-2025-08-07`) | **3,5 s – 12,0 s** | Sim (Wi-Fi / 4G) |
| **Plano B1 (Degradação Automática em Nuvem)** | Nuvem acessível, mas API da LLM oscila ou atinge *rate-limit* | `https://edubot-project.chilecentral.cloudapp.azure.com/app/` | Circuit Breaker automático $\rightarrow$ `_MockAgentClient` | **< 50 ms** | Sim (apenas até a VM) |
| **Plano B2 (Notebook 100% Offline)** | Queda total do Wi-Fi/4G no auditório do Hackathon | `http://localhost:8010/app/` | Modo Mock Determinístico (`EDUBOT_LLM_PROVIDER=mock`, `EDUBOT_OFFLINE=1`) | **< 25 ms** | **Zero (100% Offline)** |

---

## 2. O Que Foi Preparado para Garantir Operação 100% Offline (Plano B2)

Foram eliminados todos os pontos que poderiam travar ou depender de rede externa quando o notebook estiver sem internet:

1. **Bundle do Frontend React Pré-Compilado em Disco (`Front-End/files/app/`):**
   - Os 32 arquivos compilados da SPA React (`index.html`, `Avatar3D`, `OvaReader`, `TutorPanel`, `ManagerDashboard`, `Reforco`, etc.) estão salvos localmente em `Front-End/files/app/`.
   - O `compose.yaml` foi ajustado para detectar o bundle já compilado e pular o `npm install` quando offline, subindo o container em **< 1 segundo**.
2. **Catálogo Acadêmico Curado Offline (`Back-End/edubot/agent/external_sources.py`):**
   - Na Cena 4 (exploração de bases científicas externas via `/edubot/external-resources`), quando em modo `mock`/`offline` (ou se a API da Crossref não responder), o backend devolve em **< 1 ms** artigos científicos reais curados por área (*Nature*, *Cambridge University Press*, *PNAS*, *Communications of the ACM*, *NIST*, *Review of Educational Research*).
3. **Bypass Instantâneo do AWS Polly para Web Speech Offline (`Back-End/edubot/services/speech.py`):**
   - Sem credenciais AWS ou com `EDUBOT_OFFLINE=1`, a rota `/edubot/speech` responde imediatamente (`0 ms` de espera de rede) sinalizando ao frontend para usar o sintetizador nativo offline do navegador (`window.speechSynthesis`) com animação de lip-sync do Avatar 3D.
4. **Loop Completo de Tool-Use em Modo Mock (`_MockAgentClient`):**
   - Em modo `mock`, clicar em **"Gerar OVA de Reforço"** executa exatamente o mesmo loop de 4 ferramentas (`listar_competencias_fracas` $\rightarrow$ `listar_recursos_remediacao` $\rightarrow$ `listar_questoes_reforco` $\rightarrow$ `criar_ova_personalizada`), valida os IDs no servidor e persiste a trilha real no MySQL em **~15 ms**.
5. **Consentimentos LGPD Pré-Concedidos no Seed (`Back-End/tools/seed_perfis_demo.py`):**
   - Todos os perfis de demonstração (`1`, `3`, `5`, `6`, `Sanval` e `Edon`) já nascem com os consentimentos `tracking_pedagogico`, `ia_sobre_dados`, `imagem_voz` e `ranking_turma` ativos para não bloquear o Coach nem o Redator durante o pitch.

---

## 3. Comandos Rápidos para o Dia da Apresentação

Use o script [scripts/plano_b_demo.ps1](../scripts/plano_b_demo.ps1) no PowerShell:

### A. Antes de subir ao palco (Resetar os perfis na Nuvem Azure — Plano A)
Garante que o **Thiago (`6`)** volte para `0%` de consumo e que **Eduardo (`1`)**, **Yasmin (`3`)**, **Pedro (`5`)**, **Sanval (`Sanval`/`Cimatec123`)** e **Edon (`Edon`/`Cimatec@123`)** estejam impecáveis:
```powershell
.\scripts\plano_b_demo.ps1 -Acao reset-nuvem
.\scripts\plano_b_demo.ps1 -Acao testar-nuvem
```

### B. Ativar o Plano B2 no Notebook (100% Offline + Modo Mock)
*(Importante: deixe o **Docker Desktop** aberto no Windows antes da apresentação para que as imagens `mysql:8.4`, `ova_flask` e `ova_apache` já estejam em execução local).*
```powershell
.\scripts\plano_b_demo.ps1 -Acao mock
```
* **URL Local do Plano B2:** `http://localhost:8010/app/`
* Para resetar os perfis locais entre um ensaio e outro:
```powershell
.\scripts\plano_b_demo.ps1 -Acao reset-local
```

---

## 4. Tabela de Bolso — Acessos da Demonstração

| Papel / Cena | Nome | Login (RA / Usuário) | Senha | O que demonstrar na tela |
| :--- | :--- | :---: | :---: | :--- |
| **Cena 1 — Primeiro Acesso** | Thiago | `6` | `6` | Painel em **0%**, escolha do Companheiro 3D (EduBot / Einstein / Marie Curie), leitura por seção e gate do quiz. |
| **Cena 2 — Alto Desempenho** | Eduardo | `1` | `1` | **96% de consumo**, domínio BKT alto (>85%), streak de 5 dias, nível 5, medalhas e modo desafio liberado. |
| **Cena 3 — Médio Desempenho + IA** | Yasmin | `3` | `3` | **55% de consumo**, dúvida no **Chat Tutor Socrático**, fala do **Coach com Avatar 3D** e **OVA Personalizada de Reforço** ativa. |
| **Cena 4 — Risco de Evasão** | Pedro | `5` | `5` | **14 dias inativo**, 83% de erro no quiz, 3 revisões SM-2 vencidas e intervenção proativa de retomada. |
| **Cena 5 — Visão Docente / Gestor** | Sanval (Coordenador) | `4` | `4` | **Painel do Tutor** (Pedro com risco 78/100 + alerta aberto + heatmap da turma) e **Painel do Gestor** (cobertura do acervo). |
| **Acesso Extra (Tutor)** | Gabriel | `2` | `2` | **Painel do Tutor** dedicado. |
| **Acesso Nominal 1** | Sanval | `Sanval` | `Cimatec123` | Login alfanumérico de aluno. |
| **Acesso Nominal 2** | Educação Online | `Edon` | `Cimatec@123` | Login alfanumérico de aluno com caracteres especiais na senha. |
