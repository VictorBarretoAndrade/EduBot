```
git clone https://github.com/PERSONALIZED-CONTENT-RECOMMENDER/OVA-Rastreamento.git
```

# Running
```
cd OVA-Rastreamento
docker compose up --build
```
- **Interface nova (React/Lovable, recomendada):** http://localhost:8010/app/
- Interface clássica: http://localhost:8010/html/login.html

> O frontend React é compilado automaticamente por um container Node durante o
> `docker compose up` (serviço `ova_react_build`) — **não é preciso ter Node
> instalado na máquina**. Para desenvolvê-lo com hot-reload, aí sim use Node:
> `cd Front-End/react-logic-demo && npm install && npm run dev`.

> **Nota:** em um volume MySQL já existente (criado antes destas mudanças), aplique as
> migrações manualmente: `docker compose exec -T ova_mysql sh -c "mysql -uroot -pPassword-1 ova_db < /docker-entrypoint-initdb.d/ddl_extra.sql"`
> e o mesmo para `dml_extra.sql`. Em um volume novo, os scripts rodam sozinhos no init.

# EduBot Track

- **Como a plataforma funciona + passo a passo para testar tudo:** [COMO_TESTAR_PLATAFORMA.md](COMO_TESTAR_PLATAFORMA.md)
- **Ligar a IA real (AWS Bedrock) — só configurar a key:** [IA_AWS_SETUP.md](IA_AWS_SETUP.md)
- **Requisitos do projeto × estado atual + backlog:** [REQUISITOS_E_BACKLOG.md](REQUISITOS_E_BACKLOG.md)
- **Plano técnico das features faltantes para o roteiro do vídeo:** [PLANO_TECNICO_ROTEIRO.md](PLANO_TECNICO_ROTEIRO.md)
- **Guia de gravação — passo a passo (onde clicar) por cena:** [GUIA_GRAVACAO_ROTEIRO.md](GUIA_GRAVACAO_ROTEIRO.md)
- **Guia de gravação (Proposta de Roteiro, 8 min) — falas + onde mostrar por cena:** [GUIA_GRAVACAO_PROPOSTA.md](GUIA_GRAVACAO_PROPOSTA.md)
- **Avatar 3D falante (Ready Player Me) + seletor de 2 personas no "Meu Desempenho":** [AVATAR_3D.md](AVATAR_3D.md)
- **Lista completa de arquivos alterados + passo a passo de execução:** [ALTERACOES_EDUBOT.md](ALTERACOES_EDUBOT.md)
- **Mapeamento do código, bugs corrigidos e justificativa da arquitetura:** [ANALISE.md](ANALISE.md)
- **Dados captados, formato de exportação e integração com LLM:** [DADOS_E_AGENTE.md](DADOS_E_AGENTE.md)
- **OVA personalizada (agente de tool-use) — arquitetura, tools, endpoints e como cadastrar conteúdo:** [OVA_PERSONALIZADA.md](OVA_PERSONALIZADA.md)
- **Como adicionar conteúdo (OVAs, vídeos, podcasts e textos) via SQL:** [COMO_ADICIONAR_CONTEUDO.md](COMO_ADICIONAR_CONTEUDO.md)
- **Como abrir o frontend novo (React/Lovable):** [COMO_ABRIR_FRONTEND_NOVO.md](COMO_ABRIR_FRONTEND_NOVO.md)

Resumo do que existe agora:

- **Recursos com vídeo e podcast (4.1)** — tabela `resources` com `resource_url` +
  `media_type` (abstração de hospedagem: upload próprio ou embed externo) e tabela
  `resource_progress` (% assistido, tempo de escuta, conclusão). Players separados em
  `Front-End/files/js/components/` (`video-player.js`, `audio-player.js`), que recebem
  qualquer URL.
- **Autenticação e contexto do aluno (4.2)** — token assinado emitido no `/login`
  (header `Authorization: Bearer`), decorator `require_auth` e `GET /student/me` com o
  perfil completo (consumo, competências, inatividade, preferência de formato).
  Defina `EDUBOT_SECRET` em produção.
- **Agente de IA (4.3)** — módulo `Back-End/edubot_agent/` com o prompt do Claude
  Sonnet (AWS Bedrock) já escrito e parametrizado e um cliente **mockado** que responde
  no formato real da API. `GET /edubot/recommendation` gera e persiste a recomendação.
  A chamada real ao Bedrock ainda **não** está conectada (por decisão de projeto).
- **Painel do aluno (4.4)** — `http://localhost:8010/html/painel.html`: recursos
  consumidos por OVA, status das competências e última recomendação do EduBot.
- **OVA personalizada de reforço (agente de tool-use)** — o EduBot deixa de ser
  uma chamada só e vira um **agente** com ferramentas: ele identifica a
  competência em que o aluno foi pior (erro no quiz por competência), consulta o
  **banco de conteúdo classificado por competência** (`resources.competency_id` +
  questões) e **monta uma OVA de reforço** (tabelas `personalized_ova` /
  `personalized_ova_item`). Disponível nos **dois frontends**: no React/Lovable
  (`/app/`) há a aba **"Reforço"** na barra lateral; no clássico, o botão **"Gerar
  OVA de reforço"** no painel abre `html/ova_personalizada.html?id=<id>`. Ambos
  reaproveitam os mesmos players e o mesmo quiz (corrigido no servidor).
  - O **loop de tool-use é real e definitivo**; só o "cérebro" (o modelo) é
    mockado — o `_MockAgentClient` em
    [Back-End/edubot_agent/personalized.py](Back-End/edubot_agent/personalized.py)
    devolve o **mesmo envelope de tool-use da Anthropic Messages API**. Ligar a
    LLM real = trocar o cliente (esqueleto comentado no fim do arquivo); as tools,
    o loop e o parsing já são os definitivos.

## Endpoints novos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/ova/<id>/resources` | ✔ | Recursos do OVA + progresso do aluno logado |
| POST | `/progress/ova` | ✔ | Upsert de leitura/scroll/conclusão do OVA |
| POST | `/progress/resource` | ✔ | Upsert de consumo de um recurso (vídeo/podcast/atividade) |
| GET | `/student/me` | ✔ | Perfil completo do aluno logado |
| GET | `/edubot/recommendation` | ✔ | Recomendação do agente (mock Bedrock) |
| POST | `/edubot/personalized-ova` | ✔ | **Agente de tool-use**: diagnostica o assunto fraco do aluno e monta uma OVA de reforço (recursos + questões do banco) |
| GET | `/personalized-ova` | ✔ | Lista as OVAs de reforço do aluno logado |
| GET | `/personalized-ova/<id>` | ✔ | Conteúdo de uma OVA de reforço (recursos + quiz) |

## Teste local sem Docker

```powershell
cd Back-End
pip install -r requirements.txt
python tools/init_test_db.py   # cria dev_ova.db (SQLite) com dados de exemplo
python api/api.py              # API em http://127.0.0.1:8090 (login RA 1 / senha 1)
```
