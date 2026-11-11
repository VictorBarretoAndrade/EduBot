# Guia de Hospedagem AWS (Lightsail / EC2) e Conexão SSH

Este guia contém o passo a passo para criar uma instância na AWS de baixo custo, conectar via SSH pelo VS Code (no Windows) e colocar a plataforma EduBot (Engage-Agent) no ar.

---

## 1. Escolha e Criação da Instância na AWS

Para uma versão de testes com até **5 usuários simultâneos**, a opção mais econômica e previsível é o **AWS Lightsail**.

### Opções de Memória
* **1 GB de RAM (~\$3.50 a \$5.00/mês):** Mínimo viável. É **obrigatório** configurar 2 GB de Swap no Linux para o MySQL não sofrer *OOMKilled* (falta de memória).
* **2 GB de RAM (~$10.00/mês):** Recomendado para rodar com folga e sem risco de travamento de I/O em disco.

### Configurações na Criação
1. **Plataforma:** Linux / Unix
2. **Sistema Operacional (Blueprint):** Ubuntu 22.04 LTS ou 24.04 LTS (Apenas SO / OS Only)
3. **Chave SSH:** Baixe o arquivo de chave privada (`.pem`) gerado para o seu computador.
4. **Firewall (Aba Networking / Rede):**
   Garanta que as seguintes portas estão liberadas no IPv4 Firewall:
   * **22 (SSH)** — para acesso remoto
   * **80 (HTTP)** — para tráfego web e validação de certificado SSL
   * **443 (HTTPS)** — para tráfego web seguro

---

## 2. Conectando via SSH pelo VS Code (Windows)

### Passo Prévio Importante: Corrigir Permissões da Chave `.pem` no Windows
O cliente SSH rejeita chaves que tenham permissões abertas para outros usuários (*UNPROTECTED PRIVATE KEY FILE*).

Abra o **PowerShell** no Windows e execute os comandos abaixo substituindo o caminho para onde salvou sua chave:

```powershell
icacls "C:\caminho\para\sua-chave.pem" /inheritance:r
icacls "C:\caminho\para\sua-chave.pem" /grant:r "$($env:USERNAME):(R)"
```

---

### Método A: Pelo Terminal Integrado do VS Code (Mais rápido)

1. No VS Code, abra o terminal (`Ctrl + '` ou menu **Terminal → Novo Terminal**).
2. Conecte diretamente com o comando:
   ```bash
   ssh -i "C:\caminho\para\sua-chave.pem" ubuntu@<SEU_IP_PUBLICO>
   ```
   *(Exemplo: `ssh -i "C:\Users\Rafael\.ssh\minha-chave.pem" ubuntu@18.219.118.39`)*
3. Na primeira conexão, digite `yes` para confirmar a autenticidade do host.

---

### Método B: Pela Extensão "Remote - SSH" (Recomendado para navegar e editar arquivos)

Essa extensão permite abrir pastas remotas diretamente na barra lateral do VS Code.

1. **Instalar a extensão:**
   * No VS Code, acerte `Ctrl + Shift + X`.
   * Procure por **Remote - SSH** (Microsoft) e clique em **Instalar**.
2. **Copiar a chave para a pasta `.ssh` do Windows:**
   * Mova sua chave para `C:\Users\<SeuUsuario>\.ssh\minha-chave.pem`.
3. **Configurar o SSH Config:**
   * Pressione `F1` (ou `Ctrl + Shift + P`) e digite: `Remote-SSH: Open SSH Configuration File...`
   * Selecione o arquivo `C:\Users\<SeuUsuario>\.ssh\config`.
   * Adicione o bloco abaixo no final do arquivo e salve (`Ctrl + S`):
     ```ssh
     Host edubot-aws
         HostName 18.219.118.39
         User ubuntu
         IdentityFile C:\Users\<SeuUsuario>\.ssh\minha-chave.pem
     ```
4. **Conectar:**
   * Pressione `F1` e digite: `Remote-SSH: Connect to Host...`
   * Selecione **`edubot-aws`**.
   * Uma nova janela do VS Code abrirá conectada diretamente na máquina da AWS.

---

## 3. Preparação do Servidor (Após o primeiro login)

Execute os comandos a seguir dentro do terminal da máquina Ubuntu na AWS:

### 3.1. Configurar 2 GB de Memória Swap (Crucial para máquinas de 1 GB a 2 GB)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3.2. Instalar Docker e Docker Compose
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Saia da sessão e reconecte para aplicar a permissão do grupo docker:
exit
```

---

## 4. Clonar e Subir o EduBot

Reconecte na máquina via SSH e execute:

1. **Clonar o repositório:**
   ```bash
   git clone https://github.com/VictorBarretoAndrade/EduBot.git
   cd EduBot
   ```

2. **Configurar as Variáveis de Ambiente:**
   Crie um arquivo `.env` na raiz do projeto:
   ```bash
   nano .env
   ```
   Exemplo de conteúdo para testes:
   ```env
   EDUBOT_SECRET=coloque-aqui-uma-chave-secreta-longa-e-aleatoria
   EDUBOT_CORS_ORIGINS=*
   EDUBOT_LLM_PROVIDER=mock
   ```
   *(Pressione `Ctrl + O`, Enter para salvar e `Ctrl + X` para sair)*.

3. **Ajustar o domínio no `Caddyfile`:**
   Edite o arquivo [Caddyfile](file:///c:/Users/Rafael/GitHub/EduBot/Caddyfile):
   ```bash
   nano Caddyfile
   ```
   Substitua o domínio antigo pelo IP público ou domínio da AWS:
   ```caddy
   18.219.118.39 {
       @api {
           path /login /student/* /course/* /courses /ova/* /question/* /progress/* /edubot/* /personalized-ova* /interaction/* /events* /consents* /reviews* /goals* /mastery/* /gamification/* /tutor/* /collect* /catalog/* /metrics/* /tracking/* /ping /scopes /students /external-courses* /resource/*
       }
       handle @api {
           reverse_proxy ova_flask:8090
       }
       handle {
           reverse_proxy ova_apache:80
       }
   }
   ```
   > **Nota sobre HTTPS:** O Caddy tenta gerar SSL automático via Let's Encrypt quando recebe um domínio válido. Se estiver usando apenas o IP numérico, ele responderá em HTTP na porta 80. Para HTTPS, aponte um domínio (ou subdomínio gratuito) para o IP.

4. **Iniciar os Serviços:**
   ```bash
   docker compose --profile cloud up -d
   ```

5. **Verificar os Containers:**
   ```bash
   docker compose ps
   ```

---

## 5. Dicas de Economia e Performance

1. **Evitar sobrecarga de build no servidor:**
   O container `ova_react_build` pode ser pesado para compilar o React em máquinas com pouca RAM. Caso queira evitar que ele compile no servidor:
   * Gere o build localmente na sua máquina (`cd Front-End/react-logic-demo && npm run build`).
   * O build vai para `Front-End/files/app/`.
   * Ao subir a pasta já compilada, o container detecta que o `index.html` já existe e pula o build pesado.

2. **Custo de IA (LLM):**
   * **Mock:** Custo \$0,00 (`EDUBOT_LLM_PROVIDER=mock`). Ideal para testes de navegação e usabilidade.
   * **AWS Bedrock:** Se ativar o Claude real via Bedrock (`EDUBOT_LLM_PROVIDER=bedrock`), para 5 usuários de teste o custo de tokens é pay-per-use e fica em menos de \$1 a \$2 por mês se usar o modelo `haiku`.
