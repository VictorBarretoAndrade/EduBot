# Alterações realizadas — Relatório

**Resumo**: Implementei suporte para gerar o JSON de relatório do estudante, adicionei modelos e migração DDL mínima, criei um endpoint agregador e um script de testes locais. Também adicionei um fallback SQLite para permitir testes sem o container MySQL.

**Arquivos adicionados**
- [Back-End/data/models/ova_progress.py](Back-End/data/models/ova_progress.py): modelo Peewee para progresso por OVA (`read_time`, `perc_scrolled`, `completed`, `last_access`).
- [Back-End/data/models/attempts.py](Back-End/data/models/attempts.py): registra tentativas de resposta com `is_correct` e `attempt_time`.
- [Back-End/data/models/interventions.py](Back-End/data/models/interventions.py): histórico de intervenções (data, tipo, descrição, resultado).
- [Back-End/data/models/resources.py](Back-End/data/models/resources.py): lista de recursos por OVA (`resource_type`, `resource_title`).
- [Database/sql/ddl_extra.sql](Database/sql/ddl_extra.sql): DDL adicional para criar as tabelas acima em MySQL.
- [Back-End/api/routes/reportRoute.py](Back-End/api/routes/reportRoute.py): novo endpoint `GET /student/report/<id>` que agrega dados e retorna o JSON solicitado.
- [Back-End/tools/init_test_db.py](Back-End/tools/init_test_db.py): script para inicializar um banco SQLite `dev_ova.db` com dados de exemplo (usado durante testes locais).

**Arquivos modificados**
- [Back-End/data/models/__init__.py](Back-End/data/models/__init__.py): exportei os novos modelos (`OVAProgress`, `Attempts`, `Interventions`, `Resources`).
- [Back-End/data/models/base.py](Back-End/data/models/base.py): adicionei fallback para SQLite quando o host MySQL (`ova_mysql`) não for resolvível — facilita testes locais sem Docker. (Quando o host `ova_mysql` existe, usa MySQL como antes.)
- [Back-End/api/api.py](Back-End/api/api.py): registrei o blueprint `report` para expor o novo endpoint.

**Como testar localmente (rascunho rápido)**

1. Instale dependências do backend:

```powershell
pip install -r Back-End/requirements.txt
```

2. Inicialize o banco de testes (cria `dev_ova.db` e insere dados de exemplo):

```powershell
cd Back-End
python tools/init_test_db.py
```

3. Inicie a API (a partir de `Back-End` para que imports resolvam):

```powershell
cd Back-End
python api/api.py
```

4. Chame o endpoint de relatório (exemplo PowerShell):

```powershell
# retorna JSON agregado para student_id = 1
Invoke-RestMethod -Uri 'http://127.0.0.1:8090/student/report/1' -UseBasicParsing | ConvertTo-Json -Depth 5
```

**Como aplicar a migração no MySQL (produção/container)**

1. Copie ou importe o arquivo `Database/sql/ddl_extra.sql` para dentro do ambiente MySQL.
2. Exemplo (no host com cliente MySQL):

```bash
mysql -u root -p -h <mysql-host> ova_db < Database/sql/ddl_extra.sql
```

Substitua `<mysql-host>` por `ova_mysql` quando executar a partir do container de orquestração (ou use `docker exec` para rodar dentro do container MySQL).

**Observações importantes**
- O fallback SQLite em `Back-End/data/models/base.py` foi adicionado apenas para permitir testes locais rápidos; em produção com Docker Compose, a configuração original MySQL deve ser usada e o fallback pode ser removido.
- O script `init_test_db.py` cria um usuário de teste: nome "Ana Clara", RA `1`, senha `1` (apenas para testes locais). Ele popula também exemplos de `resources`, `attempts` e `interventions` para validar o endpoint.
- O endpoint `reportRoute.py` gera campos com base nas tabelas existentes e nas novas tabelas; algumas métricas dependem que o frontend envie `read_time`/`perc_scrolled` ou que as tentativas sejam registradas (via `attempts`).

**Próximos passos sugeridos**
- Gerar um Pull Request com essas alterações.
- Remover o fallback SQLite e documentar a migração para MySQL no README do Back-End.
- Atualizar o frontend para enviar `read_time` e `perc_scrolled` para `ova_progress` e enviar tentativas para `attempts`.

Se quiser, eu gero o Pull Request com essas mudanças agora e incluo instruções de rollback. 

**Alterações adicionais (commit posteriores)**
- Adicionado `.gitignore` para excluir `__pycache__`, `*.pyc`, `dev_ova.db` e artefatos de IDE.
- Adicionado `Back-End/tools/cleanup_repo.py` para remover arquivos rastreados indesejados do índice git localmente.
- O arquivo de teste `dev_ova.db` foi removido do workspace; use `Back-End/tools/init_test_db.py` para regenerá-lo localmente se necessário.
- Branch com as mudanças enviada para o fork do autor: `feature/student-report` em https://github.com/VictorBarretoAndrade/OVA-IA
