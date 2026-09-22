# Integração externa — abrindo os dados do EduBot para um parceiro

Guia de implantação da API que permite a um sistema de terceiros ler os dados do
EduBot (catálogo, rastreio, métricas e alunos) sem receber acesso ao MySQL.

**Escrito para:** quem vai operar a integração do lado do EduBot (você) e quem vai
consumi-la do lado do parceiro (a pessoa externa). As seções 1–4 são suas; a
seção 6 é a que se entrega a ela.

---

## O que NÃO fazer, e por quê

A solução aparentemente mais rápida é abrir a porta `3310` do MySQL e mandar as
credenciais do banco para a pessoa. Não faça isso:

| Problema | Consequência concreta |
|---|---|
| A credencial `eduardo` tem INSERT/UPDATE/DELETE | Um erro no script do parceiro apaga progresso real de aluno |
| Não há filtro de linha | Ele lê nome, RA e senha de todos os alunos, inclusive os que não são do piloto |
| Não há trilha de acesso | Perante a LGPD você não consegue responder quem leu qual dado pessoal, nem quando |
| Revogar exige trocar a senha do banco | E isso derruba o Flask junto, porque é a mesma credencial |
| MySQL exposto na internet | Alvo de varredura automatizada em questão de horas |

O que este guia implanta é o contrário disso: uma porta HTTP somente-leitura,
com credencial por parceiro, escopo declarado, pseudonimização por padrão e
contagem de uso por chave.

---

## Os dois caminhos

Ambos estão implementados. Eles expõem **o mesmo contrato JSON**, então o mesmo
cliente PHP serve aos dois.

```
CAMINHO A (recomendado)
  App PHP do parceiro  ──HTTP + X-API-Key──▶  Flask /api/v1/*  ──▶  MySQL
                                              (chaves em banco, escopos testados)

CAMINHO B (alternativo)
  App do parceiro  ──HTTP + X-API-Key──▶  api.php (PDO)  ──▶  MySQL
                                          (usuário SOMENTE-LEITURA, chaves em arquivo)
```

**Use o A** se o Flask já está no ar. As chaves ficam em banco (revogar é um
comando, não uma edição de arquivo), as regras de escopo têm 47 testes
automatizados, e a política de acesso mora num lugar só.

**Use o B** se a hospedagem disponível é PHP/cPanel e subir Python não é opção.
Ele é autônomo, mas é uma **segunda porta**: endpoint novo que você criar no
Flask não aparece nele automaticamente.

---

## Escopos

Uma chave só lê o que o escopo dela declara. Conceder um não concede os outros.

| Escopo | Libera | Contém dado pessoal? |
|---|---|---|
| `catalog:read` | OVAs, competências, questões, cursos | Não |
| `tracking:read` | Eventos de aprendizado, progresso, leitura por seção | Pseudonimizado |
| `metrics:read` | Domínio por competência, cobertura, engajamento, item-analysis | Não (agregado) |
| `students:read` | Lista de alunos (pseudônimo, curso, papel) | Pseudonimizado |
| `students:pii` | **Nome e RA do aluno** | **Sim — exige base legal** |

Sobre a **pseudonimização**: o parceiro recebe `subject_id`, um hash estável de
16 caracteres. Estável porque ele precisa correlacionar os eventos do mesmo aluno
ao longo do tempo; opaco porque não deve conseguir chegar à pessoa. O salt é o
`EDUBOT_PSEUDONYM_SALT` — trocá-lo rotaciona todos os pseudônimos de uma vez.

`students:pii` é deliberadamente um escopo à parte. Conceder rastreio não
concede nome e RA junto; é preciso pedir os dois.

---

## 1. Aplicar a migration

Cria a tabela `api_keys`. É idempotente — rodar duas vezes não faz mal.

```bash
docker exec -i ova_db mysql -ueduardo -pPassword-1 ova_db \
  < Database/sql/migration_021_api_keys.sql
```

> Num banco criado do zero (volume novo) o arquivo já roda sozinho pelo
> `docker-entrypoint-initdb.d`. O comando acima é para o volume que já existe —
> o mesmo gotcha das migrations anteriores.

## 2. Definir os segredos

No `.env` da raiz do projeto:

```bash
# Salt da pseudonimização. Gere com:
#   python -c "import secrets; print(secrets.token_hex(32))"
EDUBOT_PSEUDONYM_SALT=cole-aqui-um-valor-longo-e-aleatorio

# Teto por chave (opcional; os valores abaixo são os padrões)
EDUBOT_APIKEY_RATE_LIMIT=120
EDUBOT_APIKEY_RATE_WINDOW=60
```

E repasse-os ao container, em `compose.yaml`, no bloco `environment` do
`ova_flask` — **sem esta linha o valor do `.env` não chega ao container**:

```yaml
      EDUBOT_PSEUDONYM_SALT: ${EDUBOT_PSEUDONYM_SALT:-}
      EDUBOT_APIKEY_RATE_LIMIT: ${EDUBOT_APIKEY_RATE_LIMIT:-120}
      EDUBOT_APIKEY_RATE_WINDOW: ${EDUBOT_APIKEY_RATE_WINDOW:-60}
```

Depois: `docker compose up -d ova_flask`.

## 3. Emitir a chave do parceiro

```bash
docker exec -it ova_back_end python -m tools.apikey_tool criar \
  --nome "Piloto Parceiro X" \
  --escopos catalog:read,tracking:read,metrics:read \
  --dias 90 \
  --notas "contato: fulano@exemplo.br"
```

A chave em claro aparece **uma única vez**. O banco guarda só o SHA-256, então
não existe comando para exibi-la depois — se o parceiro perder, revogue e emita
outra. Entregue por canal seguro (não por e-mail em texto aberto).

```bash
docker exec -it ova_back_end python -m tools.apikey_tool listar    # sem segredos
docker exec -it ova_back_end python -m tools.apikey_tool revogar --prefixo ek_live_3f9aK2
docker exec -it ova_back_end python -m tools.apikey_tool escopos
```

Comece com o escopo mínimo. Ampliar depois é um comando; recolher um dado que já
saiu, não.

## 4. Conferir

```bash
curl -s http://localhost:5010/api/v1/ping -H "X-API-Key: ek_live_..."
```

```json
{"ok": true, "key_name": "Piloto Parceiro X",
 "scopes": ["catalog:read", "tracking:read", "metrics:read"], ...}
```

Sem chave deve vir `401`; com escopo faltando, `403`.

---

## 5. Caminho B — a API PHP autônoma

Só se você escolheu o Caminho B. Se ficou no A, pule para a seção 6.

**5.1. Criar o usuário somente-leitura.** Abra
`Database/sql/usuario_somente_leitura.sql`, troque `TROQUE-ESTA-SENHA` por uma
senha forte e aplique:

```bash
docker exec -i ova_db mysql -uroot -pPassword-1 < Database/sql/usuario_somente_leitura.sql
docker exec -i ova_db mysql -uroot -pPassword-1 -e "SHOW GRANTS FOR 'edubot_leitura'@'%';"
```

A saída deve mostrar **apenas `SELECT`**. O arquivo concede tabela a tabela, e a
coluna `student_name`/`ra` fica de fora por padrão — há um bloco comentado no fim
para o caso de você ter base legal para incluí-las.

**5.2. Publicar os arquivos.** Copie `integracoes/php/` para o servidor web
(`/var/www/html/edubot/`, `public_html/edubot/` etc.).

**5.3. Configurar.** No servidor:

```bash
cp config.php config.local.php
php -r "echo 'ek_php_'.bin2hex(random_bytes(24)).PHP_EOL;"   # gera uma chave
```

Edite `config.local.php` com a senha do `edubot_leitura`, a chave gerada e **o
mesmo** `EDUBOT_PSEUDONYM_SALT` do Flask — se os salts divergirem, os dois
caminhos geram `subject_id` diferentes para o mesmo aluno e o parceiro não
consegue cruzar os dados.

**5.4. Testar.**

```bash
curl -s "http://localhost/edubot/api.php?recurso=ping" -H "X-API-Key: ek_php_..."
curl -s "http://localhost/edubot/api.php?recurso=ovas" -H "X-API-Key: ek_php_..."
```

**Requisitos:** PHP 7.4+ com `pdo_mysql`. Em produção, sirva por HTTPS — a chave
viaja no header e, em HTTP puro, em claro.

---

## 6. Para entregar ao parceiro

Mande três coisas: a **URL base**, a **chave** e a pasta `integracoes/php/`.

### Consumo mínimo, sem dependência nenhuma

```php
<?php
$ch = curl_init('http://SEU-SERVIDOR:5010/api/v1/catalog/ovas');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-API-Key: ek_live_SUA_CHAVE'],
]);
$dados = json_decode(curl_exec($ch), true);
curl_close($ch);

foreach ($dados['data'] as $ova) {
    echo $ova['ova_id'] . ' - ' . $ova['ova_name'] . PHP_EOL;
}
```

### Com o cliente pronto

```php
<?php
require __DIR__ . '/edubot_client.php';
$edubot = new EduBotClient('http://SEU-SERVIDOR:5010', 'ek_live_SUA_CHAVE');

print_r($edubot->ping());                    // diagnóstico
$ovas   = $edubot->ovas();                   // catálogo
$metrica = $edubot->dominioPorCompetencia(); // métricas
```

`php exemplo.php` exercita a integração inteira e imprime o resultado de cada
bloco.

### Sincronização incremental (o padrão para um job recorrente)

Não reprocesse a base toda a cada execução. Guarde o último `event_id` e retome
dali — cada evento chega exatamente uma vez:

```php
$ultimo = (int) @file_get_contents('cursor.txt');

foreach ($edubot->eventosDesde($ultimo) as $evento) {
    // $evento['subject_id']  identificador pseudonimizado, estável
    // $evento['verb']        opened | read | played | answered | completed | ...
    // $evento['context']     JSON com perc, seconds, correct, response_ms...
    processar($evento);
    $ultimo = $evento['event_id'];
}

file_put_contents('cursor.txt', (string) $ultimo);
```

### Endpoints

Base do Caminho A: `/api/v1/`. No Caminho B: `api.php?recurso=<nome>`.

| Caminho A | Caminho B | Escopo | Retorna |
|---|---|---|---|
| `GET /ping` | `?recurso=ping` | — | Diagnóstico e escopos da chave |
| `GET /scopes` | — | — | Catálogo de escopos e o que a chave tem |
| `GET /catalog/courses` | `?recurso=cursos` | `catalog:read` | Cursos |
| `GET /catalog/ovas` | `?recurso=ovas` | `catalog:read` | OVAs (`?subject_id=`) |
| `GET /catalog/competencies` | `?recurso=competencias` | `catalog:read` | Competências |
| `GET /catalog/questions` | `?recurso=questoes` | `catalog:read` | Questões (`?ova_id=`, `?include_answer=1`) |
| `GET /tracking/events` | `?recurso=eventos` | `tracking:read` | Eventos (`?since=`, `?verb=`, `?after_id=`) |
| `GET /tracking/progress` | `?recurso=progresso` | `tracking:read` | Progresso por OVA |
| `GET /tracking/sections` | `?recurso=secoes` | `tracking:read` | Leitura por seção |
| `GET /metrics/mastery` | `?recurso=dominio` | `metrics:read` | Domínio médio por competência |
| `GET /metrics/questions` | `?recurso=questoes_desempenho` | `metrics:read` | Taxa de acerto por questão |
| `GET /metrics/coverage` | — | `metrics:read` | Cobertura de conteúdo |
| `GET /metrics/engagement` | `?recurso=engajamento` | `metrics:read` | Eventos por verbo |
| `GET /students` | `?recurso=alunos` | `students:read` | Alunos (`?course_id=`) |

**Paginação:** `?limit=` (máx. 500) + `?after_id=`. A resposta traz
`next_after_id`, que é `null` na última página. É cursor e não `OFFSET` porque a
tabela de eventos cresce durante a varredura, e `OFFSET` pularia ou repetiria
linhas.

**Datas:** `?since=` / `?until=` em ISO-8601 (`2026-09-01` ou
`2026-09-01T14:30:00`). Data malformada devolve `400`, não é ignorada.

**Erros:**

| Status | Significa | O que fazer |
|---|---|---|
| `400` | Parâmetro malformado | A mensagem diz qual |
| `401` | Chave ausente, inválida, revogada ou expirada | Conferir o header `X-API-Key` |
| `403` | Chave válida, escopo insuficiente | `GET /scopes` mostra o que ela tem |
| `429` | Teto de requisições estourado | Esperar a janela, ou usar `limit` maior e fazer menos chamadas |

---

## Notas de segurança

**A chave só existe em servidor.** Nunca a coloque em JavaScript de navegador —
seria o mesmo que publicá-la. É por isso que o CORS do Flask não inclui
`/api/v1`: a integração é servidor-a-servidor. Se o parceiro precisa exibir os
dados num front, o backend dele chama a API e repassa o que for necessário.

**HTTPS em produção.** A chave viaja no header; em HTTP puro, qualquer ponto do
caminho a lê. E mantenha `EDUBOT_VERIFY_TLS = true`: desligar a verificação de
certificado entrega a chave a quem estiver no meio.

**LGPD.** `students:pii` expõe nome e RA. Antes de conceder: registre a base
legal (contrato, termo de consentimento ou finalidade de pesquisa aprovada),
prefira prazo de validade (`--dias`), e guarde o `listar` como evidência de quem
teve acesso e até quando. A revogação é `active = 0`, não `DELETE`, justamente
para preservar a trilha.

**O que nunca sai:** `student_password` não é selecionada em nenhum caminho, com
ou sem `students:pii`. O gabarito das questões só sai com `?include_answer=1`
explícito. Texto livre escrito pelo aluno (`context.text` de `asked_tutor`) é
removido sem `students:pii`.

---

## Arquivos

| Arquivo | Papel |
|---|---|
| `Database/sql/migration_021_api_keys.sql` | Tabela `api_keys` |
| `Database/sql/usuario_somente_leitura.sql` | Usuário MySQL só-SELECT (Caminho B) |
| `Back-End/edubot/data/models/api_keys.py` | Model Peewee |
| `Back-End/edubot/api/apikey.py` | `require_api_key`, escopos, pseudonimização |
| `Back-End/edubot/api/routes/publicApiRoute.py` | Endpoints `/api/v1/*` |
| `Back-End/tools/apikey_tool.py` | Criar, listar e revogar chaves |
| `Back-End/tests/test_public_api.py` | 47 testes (auth, escopo, LGPD, cursor) |
| `integracoes/php/config.php` | Modelo de configuração |
| `integracoes/php/edubot_client.php` | Cliente PHP (Caminho A) |
| `integracoes/php/api.php` | API PHP autônoma (Caminho B) |
| `integracoes/php/exemplo.php` | Demonstração executável |
