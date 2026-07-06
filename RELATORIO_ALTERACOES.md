# Relatorio de alteracoes

Data: 2026-05-28

## Contexto

O frontend apresentava erro ao chamar o backend:

```text
172.168.30.3:8090/login Failed to load resource: net::ERR_CONNECTION_TIMED_OUT
```

Depois da correcao da comunicacao entre frontend e backend, apareceu outro erro vindo do banco:

```text
{"Error": "(1146, \"Table 'ova_db.students' doesn't exist\")"}
```

## Diagnostico

### Comunicacao frontend -> backend

O frontend estava usando o IP interno do container Docker:

```text
172.168.30.3:8090
```

Esse endereco funciona apenas dentro da rede interna do Docker. Como o navegador roda fora dos containers, ele deve acessar a porta publicada no host:

```text
localhost:5010
```

No `compose.yaml`, o backend Flask esta publicado assim:

```yaml
ports:
  - 5010:8090
```

### Inicializacao do banco

O MySQL criava o banco `ova_db`, mas nao criava as tabelas. Nos logs do container `ova_mysql`, o script `dcl.sql` falhava antes da execucao do `ddl.sql`:

```text
ERROR 1524 (HY000) at line 1: Plugin 'mysql_native_password' is not loaded
```

Como o MySQL usado e a imagem `mysql:8.4`, o plugin `mysql_native_password` nao vem carregado por padrao. Isso interrompia a inicializacao em `/docker-entrypoint-initdb.d/`.

## Arquivos alterados

### `Front-End/files/js/request.js`

Antes, as requisicoes usavam:

```javascript
const PORT = 8090;
const HOST = "172.168.30.3";
```

Agora usam:

```javascript
const PORT = 5010;
const HOST = window.location.hostname || "localhost";
```

Tambem foi removido o header incorreto:

```javascript
"Access-Control-Allow-Origin": "http:"
```

Esse header deve ser enviado pelo servidor, nao pelo cliente.

### `Front-End/files/js/video-player.js`

Foi aplicada a mesma correcao de URL usada no arquivo `request.js`, pois o player tambem registra interacoes diretamente no backend.

Tambem foi removido o header incorreto `Access-Control-Allow-Origin`.

### `Back-End/api/api.py`

O Flask antes escutava no host interno:

```python
app.run(debug=True, host="ova_flask", port=8090)
```

Agora escuta em todas as interfaces do container:

```python
app.run(debug=True, host="0.0.0.0", port=8090)
```

Isso permite que a porta publicada `5010:8090` funcione corretamente.

O CORS tambem foi ajustado de:

```python
CORS(app, resources={r"/*": {"origins": "http://ova_apache:*/*"}})
```

para:

```python
CORS(app)
```

Assim o frontend servido em `http://localhost:8010` consegue chamar o backend em `http://localhost:5010`.

### `Database/sql/dcl.sql`

Antes:

```sql
ALTER USER 'eduardo'@'%' IDENTIFIED WITH mysql_native_password BY 'Password-1';
```

Agora o script nao altera mais o plugin de autenticacao, porque o usuario ja e criado pelo proprio `compose.yaml`:

```yaml
MYSQL_USER: "eduardo"
MYSQL_PASSWORD: "Password-1"
MYSQL_DATABASE: "ova_db"
```

Isso evita a falha no MySQL 8.4 e permite que os scripts seguintes criem e populam as tabelas.

## Acoes executadas no ambiente

Foi verificado o estado dos containers:

```powershell
docker compose ps
```

Foi consultado o MySQL para confirmar que as tabelas nao existiam:

```powershell
docker compose exec -T ova_mysql mysql -uroot -pPassword-1 -e "SHOW TABLES FROM ova_db;"
```

Foram lidos os logs do MySQL:

```powershell
docker compose logs --tail=80 ova_mysql
```

Foram aplicados manualmente os scripts SQL no banco atual:

```powershell
docker compose exec -T ova_mysql sh -c "mysql -uroot -pPassword-1 ova_db < /docker-entrypoint-initdb.d/ddl.sql"
docker compose exec -T ova_mysql sh -c "mysql -uroot -pPassword-1 ova_db < /docker-entrypoint-initdb.d/dml.sql"
```

Foi confirmado que as tabelas existem:

```powershell
docker compose exec -T ova_mysql mysql -uroot -pPassword-1 -e "SHOW TABLES FROM ova_db;"
```

Foi confirmado que a tabela `students` possui dados:

```text
students
500
```

Foi reiniciado o backend:

```powershell
docker compose restart ova_flask
```

Foi reconstruida a imagem do MySQL para incluir a correcao do `dcl.sql`:

```powershell
docker compose build ova_mysql
```

## Validacoes realizadas

### Sintaxe do backend

```powershell
python -m py_compile Back-End\api\api.py
```

Resultado: sem erros.

### Login direto no backend

Comando:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:5010/login" -Method POST -ContentType "application/json" -Body '[{"ra":"1","password":"1"}]'
```

Resposta:

```json
{"Message": "Logged successfully!", "ids": {"course_id": 1, "student_id": 1}, "is_admin": false}
```

## Resultado esperado

O login pelo frontend em:

```text
http://localhost:8010/html/login.html
```

deve chamar:

```text
http://localhost:5010/login
```

e nao mais:

```text
http://172.168.30.3:8090/login
```

## Observacao sobre arquivos `.pyc`

O `git status` mostra varios arquivos `__pycache__/*.pyc` modificados. Eles nao fazem parte da correcao funcional e normalmente devem ser ignorados pelo Git.

Arquivos funcionais modificados:

- `Back-End/api/api.py`
- `Database/sql/dcl.sql`
- `Front-End/files/js/request.js`
- `Front-End/files/js/video-player.js`
