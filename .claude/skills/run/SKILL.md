---
name: run
description: Sobe e testa a stack do EduBot ponta a ponta (MySQL + Flask + React/Apache via docker compose). Use quando pedirem para rodar, iniciar, testar ou tirar screenshot do app. Cobre o gotcha das migrations em volume MySQL existente e como dirigir o front com Playwright.
---

# Rodar e testar o EduBot

Stack multi-container via `docker compose` (raiz do projeto): **MySQL** + **Flask**
(pacote `edubot/`, porta 5010) + um container que **builda o React** e sai, servido
pelo **Apache** (porta 8010). Modo IA **mock** é o default — sem custo, sem credencial.

## 1. Antes de subir: cheque conflito de stack

Nomes de container e portas são **fixos**: `ova_db`/3310, `ova_back_end`/5010,
`ova_front_end`/8010. Se já houver uma stack no ar (ex.: outra checkout do projeto),
subir de novo **falha** por nome/porta em conflito.

```bash
docker ps --filter "name=ova_" --format "{{.Names}}\t{{.Status}}"
# de onde uma stack existente foi subida:
docker inspect ova_back_end --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

Se precisar derrubar a existente, rode `docker compose down` **na pasta que a subiu**.

## 2. Subir

```bash
docker compose up -d --build     # ova_react_build deve sair com código 0
docker compose ps                # espere ova_db (healthy)
```

Para ligar a IA real (Bedrock/Anthropic) em vez do mock: ver `Back-End/.env.example`
e criar um `.env` na raiz (o compose o carrega). Sem isso, roda mock determinístico.

## 3. Migrations em volume MySQL EXISTENTE (gotcha importante)

O MySQL só executa os `.sql` de `Database/sql/` (incluindo `migration_*.sql`) na
**primeira** inicialização (volume vazio). Reusando um volume antigo, as migrations
novas **não** rodam → **sintoma: `GET /student/me` responde 500** (colunas `*_en`
ausentes, migration_001) **e o login quebra no 2º acesso** (coluna de senha estreita,
migration_002 — o hash trunca).

- **Do zero (recomendado):** `docker compose down -v && docker compose up -d --build`
  — o initdb roda ddl → dml → migrations, tudo em ordem.
- **Em volume existente:** aplique as migrations (são **idempotentes**):

```bash
for m in Database/sql/migration_*.sql; do
  docker exec -i ova_db mysql -ueduardo -pPassword-1 ova_db < "$m"
done
```

## 4. Credenciais de teste (seed)

Senha = RA. Alunos RA `1`..`N`; **RA `2` = tutor**, **RA `4` = admin**.

> **A5 (hash de senha):** o 1º login de cada aluno converte a senha para hash
> (upgrade-on-login). Aplique as migrations **antes** de logar. Se um aluno ficou com
> hash truncado (logou antes da migration_002), resete:
> `docker exec ova_db mysql -ueduardo -pPassword-1 ova_db -e "UPDATE students SET student_password='1' WHERE student_id=1;"`

## 5. Smoke test da API (curl)

Corpo das requisições: **objeto JSON puro** (o envelope `[obj]` legado ainda é aceito).

```bash
API=http://localhost:5010
TOKEN=$(curl -s -X POST "$API/login" -H "Content-Type: application/json" \
  -d '{"ra":"1","password":"1"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s "$API/student/me"          -H "Authorization: Bearer $TOKEN"   # perfil (PT)
curl -s "$API/student/me?lang=en"  -H "Authorization: Bearer $TOKEN"   # conteúdo traduzido (A12)

# Quiz sem gabarito + proatividade: errar uma questão cria intervenção SEM clique (A13)
curl -s -X POST "$API/question/answer" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"question_id":1,"selected":"a"}'
curl -s "$API/edubot/interventions" -H "Authorization: Bearer $TOKEN"  # deve listar pendentes
```

## 6. Dirigir o front (Playwright headless)

App em `http://localhost:8010/app/` (a raiz `/` redireciona). Navegação por **hash**:
`#/dashboard`, `#/quiz`, `#/reforco`, `#/tutor` (tutor/admin)...

O driver `shot.mjs` (neste diretório) injeta a sessão para pular o login e captura o
dashboard + o quiz:

```bash
npm i playwright && npx playwright install chromium
TOKEN=$(curl -s -X POST http://localhost:5010/login -H "Content-Type: application/json" \
  -d '{"ra":"1","password":"1"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
node .claude/skills/run/shot.mjs "$TOKEN" .
```

Sucesso = `dashboard.png` mostra a caixa **"O EduBot tem recomendações para você"**
(proatividade), `CONSOLE_ERRORS: none`, e `HASH_AFTER_NAV: #/quiz`. **Olhe o
screenshot** — frame branco = falha ao carregar.

## 7. Testes unitários (rápido, sem Docker)

```bash
cd Back-End && python -m pytest      # 42 testes em SQLite na memória
```
