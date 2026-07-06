# Como abrir o frontend novo (React / Lovable)

Guia rápido para abrir a **interface nova** (React + Vite + Tailwind, "Adapta
Learn IA"), onde fica a aba **Reforço** (OVA personalizada gerada pelo agente
EduBot), além de Conteúdos, Quiz, Tutor IA e Meu Desempenho.

> O frontend novo é **só do aluno**. Os dashboards do coordenador continuam no
> frontend clássico (`/html/plots.html`).

---

## Opção A — Docker (recomendada, **não precisa de Node**)

Esta é a forma normal de usar. Um container (`ova_react_build`) compila o React
automaticamente durante o `up` e o Apache serve o resultado — você não precisa
ter Node/npm instalado na máquina.

**Pré-requisito:** Docker Desktop instalado e rodando.

```powershell
cd OVA-Rastreamento     # pasta que contém o compose.yaml
docker compose up --build
```

Aguarde os containers subirem (banco, backend, build do React e Apache). Depois
abra no navegador:

- **Interface nova (React):** http://localhost:8010/app/
- Interface clássica (login e dashboards): http://localhost:8010/html/login.html

> Da tela de login clássica também há o link **"✨ Nova interface"**, que leva
> para `/app/`.

### Login

| Perfil | RA | Senha |
|--------|----|-------|
| Aluno  | 1  | 1     |
| Admin (coordenador) | 4 | 4 |

> O app novo é a visão do **aluno** — entre com o RA `1` / senha `1`.

### Onde está a feature de Reforço

Depois de logar em http://localhost:8010/app/, clique em **"Reforço"** na barra
lateral → **"Gerar OVA de reforço"**. O agente diagnostica o assunto em que você
foi pior e monta uma trilha (vídeos, textos e questões). As OVAs geradas ficam
listadas ali; clique em **"Abrir"** para consumir.

> Para o agente ter o que recomendar, é preciso ter conteúdo cadastrado com
> `competency_id` (veja a seção "Onde colocar perguntas, vídeos..." no
> [README.md](README.md)) e algum desempenho registrado (ex.: errar questões do
> quiz daquele assunto).

### Parar

```powershell
docker compose down
```

> ⚠️ Se você já tinha um **volume MySQL antigo** (subiu o projeto antes destas
> mudanças), aplique as migrações de schema/seed — veja a nota no
> [README.md](README.md) (`ddl_extra.sql` / `dml_extra.sql`). Em volume novo
> (primeira vez ou após `docker compose down -v`), os scripts rodam sozinhos.

---

## Opção B — Desenvolvimento com hot-reload (precisa de Node)

Use só se for **mexer no código** do React e quiser recarregamento automático.

**Pré-requisito:** Node.js 20+ instalado **e o backend no ar** (o app fala com a
API em `http://<host>:5010` — suba o backend via `docker compose up`, que expõe
essa porta).

```powershell
cd Front-End/react-logic-demo
npm install
npm run dev
```

O Vite sobe em **http://127.0.0.1:5173/** (porta padrão do Vite). Abra esse
endereço — o app recarrega sozinho a cada alteração.

> Observação: em dev, o app continua chamando a API na porta **5010** e o leitor
> clássico na **8010** — os valores padrão ficam em `src/services/config.ts` e
> podem ser sobrescritos por variáveis de ambiente (`VITE_API_URL` /
> `VITE_CLASSIC_URL`); veja `.env.example`. Por isso o backend (container)
> precisa estar rodando em paralelo; só o `npm run dev` não basta.

Outros scripts (em `package.json`):

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (hot-reload) em `127.0.0.1:5173` |
| `npm run build` | Type-check (`tsc`) + build de produção do Vite |
| `npm run preview` | Serve localmente o build de produção para conferência |

---

## Solução de problemas

| Sintoma | Provável causa / o que fazer |
|---------|------------------------------|
| Página em branco em `/app/` | O build do React ainda não terminou — aguarde o serviço `ova_react_build` concluir no `docker compose up`, ou rode com `--build`. |
| "Não foi possível carregar seus dados. A API está no ar?" | O backend (Flask, porta 5010) não está respondendo. Confira se o container do backend subiu. |
| Volta para a tela de login sozinho | Token expirado/ausente (sessão de 7 dias). Faça login novamente. |
| Aba **Reforço** diz que não há conteúdo de reforço | Falta conteúdo com `competency_id` para o assunto fraco, ou o aluno ainda não tem desempenho registrado. Cadastre recursos/questões (ver README) e responda o quiz. |
| Erro de tipo no build do React | Rode `npm run build` em `Front-End/react-logic-demo` para ver a mensagem do TypeScript; ajuste e rebuild. |

---

## Referências

- [README.md](README.md) — visão geral, endpoints, login e como cadastrar conteúdo.
- [RELATORIO_ALTERACOES.md](RELATORIO_ALTERACOES.md) — integração do React com o backend.
- [DADOS_E_AGENTE.md](DADOS_E_AGENTE.md) — dados do aluno e o agente EduBot.
