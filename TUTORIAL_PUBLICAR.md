# 📦 Como publicar o GO SPORTS (passo a passo)

Este guia é para quem usa computador, mas nunca publicou um site. Tudo usa **planos gratuitos**.

**Como fica no final:**

```
[ Vercel ]  front-end (o jogo e a página do celular)   https://go-sports.vercel.app
     │  chama
[ Render ]  backend Node.js (contas, ranking, salas)   https://go-sports-api.onrender.com
     │  guarda dados em
[ Neon ]    banco Postgres gratuito
```

> Atalho: dá para publicar **só no Render** (ele também serve o front-end). Nesse caso pule a parte da Vercel e deixe `SERVER_URL` vazio. A Vercel deixa o carregamento mais rápido no mundo todo.

---

## 1. Instalar o necessário

1. **Node.js** (versão LTS): baixe em https://nodejs.org e instale com "Avançar" em tudo.
2. **Git**: baixe em https://git-scm.com/downloads e instale com as opções padrão.
3. Um editor (opcional, mas ajuda muito): **Visual Studio Code** em https://code.visualstudio.com.

Confira no terminal (no Windows: menu Iniciar → "Prompt de Comando" ou "PowerShell"):

```bash
node -v
```

```bash
git --version
```

Precisa aparecer `v22.13` ou maior para o Node e qualquer versão para o Git.

## 2. Rodar o jogo no seu computador

Abra o terminal **dentro da pasta `go-sports`** (no VS Code: menu Terminal → Novo Terminal) e rode:

```bash
npm install
```

```bash
npm run dev
```

Abra http://localhost:3000. Para usar o celular, siga a seção "Rodar no seu computador" do `README.md` (mesma rede Wi‑Fi, aceitar o aviso de certificado local). Para parar o servidor: `Ctrl + C` no terminal.

Antes de publicar, rode os testes:

```bash
npm test
```

## 3. Criar o repositório no GitHub e enviar o código

1. Crie uma conta em https://github.com.
2. Clique em **New repository** → nome `go-sports` → **Private** ou **Public** → **Create repository** (não marque "Add README").
3. No terminal, dentro da pasta `go-sports`, configure seu nome (só na primeira vez):

```bash
git config --global user.name "Seu Nome"
```

```bash
git config --global user.email "seu-email@exemplo.com"
```

4. Envie o código (troque `SEU-USUARIO` pelo seu usuário do GitHub):

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "GO SPORTS: primeira versão"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/SEU-USUARIO/go-sports.git
```

```bash
git push -u origin main
```

Na primeira vez o Git abre uma janela para você entrar na sua conta do GitHub. O arquivo `.gitignore` já impede o envio de `node_modules`, banco de dados local, certificados e `.env`.

## 4. Banco de dados gratuito (Neon)

O disco do Render gratuito é apagado a cada nova publicação, então use um Postgres gratuito:

1. Crie conta em https://neon.tech → **New Project** (região: São Paulo, se houver, ou a mais próxima).
2. Na tela do projeto, copie a **Connection string** (começa com `postgresql://...`).
3. Guarde: ela vai na variável `DATABASE_URL` no próximo passo. As tabelas são criadas sozinhas na primeira vez que o servidor liga.

## 5. Publicar o backend no Render

1. Crie conta em https://render.com (pode entrar com o GitHub).
2. **New → Web Service** → escolha o repositório `go-sports`.
3. Preencha:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Em **Environment Variables** adicione:

   | Nome | Valor |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | a connection string do Neon |
   | `CLIENT_ORIGIN` | por enquanto `*` (no passo 6 você troca pelo endereço da Vercel) |

5. Clique em **Create Web Service**. Quando terminar, abra `https://SEU-SERVICO.onrender.com/api/health`. Deve aparecer `{"ok":true,"db":"postgres"}`.

> Alternativa: **New → Blueprint** usa o arquivo `render.yaml` do projeto e já cria o serviço configurado (você só cola `DATABASE_URL` e `CLIENT_ORIGIN`).
>
> O plano gratuito "dorme" após 15 minutos sem uso; o primeiro acesso depois disso pode levar ~1 minuto. Os WebSockets (pareamento e online) funcionam normalmente.

## 6. Publicar o front-end na Vercel

1. No seu computador, abra `client/config.js` e coloque o endereço do Render:

```js
SERVER_URL: 'https://SEU-SERVICO.onrender.com',
```

2. Envie a mudança:

```bash
git add .
```

```bash
git commit -m "Configura o backend de produção"
```

```bash
git push
```

3. Crie conta em https://vercel.com (entre com o GitHub) → **Add New → Project** → importe `go-sports`.
4. **Framework Preset:** Other. O arquivo `vercel.json` já define tudo (pasta `client`, cópia do Three.js). Clique em **Deploy**.
5. Copie o endereço gerado (ex.: `https://go-sports.vercel.app`).
6. Volte ao Render → seu serviço → **Environment** → mude `CLIENT_ORIGIN` para o endereço da Vercel (sem barra no final) → **Save** (ele reinicia sozinho).

## 7. HTTPS e domínio próprio

- **HTTPS:** a Vercel e o Render já entregam HTTPS automaticamente. Isso é obrigatório para os sensores do celular e para a câmera.
- **Domínio próprio (opcional, mas recomendado para o AdSense):**
  1. Compre um domínio (ex.: `gosports.com.br` no https://registro.br ou `.com` em outro registrador).
  2. Na Vercel: projeto → **Settings → Domains** → adicione `gosports.com.br` e `www.gosports.com.br`.
  3. A Vercel mostra os registros DNS para colar no painel do registrador (normalmente um registro **A** `76.76.21.21` e um **CNAME** `cname.vercel-dns.com`). Pode levar algumas horas para propagar.
  4. Atualize `CLIENT_ORIGIN` no Render com o domínio novo (pode colocar os dois, separados por vírgula).
  5. (Opcional) em `client/config.js`, coloque o domínio em `PUBLIC_URL` para o QR code usar sempre ele.

## 8. Anúncios (Google AdSense) e aprovação

1. Crie conta em https://adsense.google.com com o seu site (use o **domínio próprio**; subdomínios como `vercel.app` normalmente não são aceitos).
2. **Verificação do site:** o AdSense oferece uma meta tag. Abra `client/index.html`, procure a linha comentada `google-adsense-account`, tire o comentário e coloque o seu ID.
3. **ads.txt:** renomeie `client/ads.txt.example` para `client/ads.txt` e troque `pub-0000000000000000` pelo seu ID (sem o `ca-`).
4. **Política de Privacidade:** edite `client/privacy.html` e preencha nome e e‑mail de contato (aparece em `/privacy.html`).
5. Envie (`git add .`, `git commit -m "AdSense"`, `git push`) e peça a revisão no painel do AdSense. A aprovação costuma levar de alguns dias a algumas semanas; ter conteúdo e páginas funcionando ajuda.
6. Depois de aprovado:
   - Abra `client/ads.config.js` e cole o ID em `ADSENSE_CLIENT: 'ca-pub-...'`.
   - Crie um bloco de anúncio **Display** (Anúncios → Por bloco de anúncio) e cole o número em `BANNER_SLOT`.
   - Os intervalos e o vídeo premiado usam os **Anúncios para jogos H5 (Ad Placement API)**. Peça acesso no painel (ou no formulário de anúncios para jogos do Google). Enquanto não for liberado, deixe `TEST_MODE: true`; depois mude para `false`.
7. **Regras importantes (evitam banimento):** não clique nos próprios anúncios, não peça para outras pessoas clicarem, não esconda nem disfarce anúncios, não coloque anúncios grudados em botões do jogo. O GO SPORTS já identifica todos como "Publicidade", limita a frequência dos intervalos e só mostra o vídeo premiado quando o jogador escolhe.
8. **Consentimento:** o jogo mostra o aviso de cookies (LGPD) e, sem consentimento, pede anúncios não personalizados. Se for divulgar para Europa/Reino Unido, ative também a mensagem de consentimento do Google (AdSense → Privacidade e mensagens).

## 9. Testar depois de publicado

Faça este checklist no endereço publicado:

1. Abra o site no computador/TV → aparece o QR code (o primeiro acesso pode demorar se o Render estiver "dormindo").
2. Escaneie com o celular → a página do controle abre e mostra "Conectado à sala XXXX".
3. **Android:** toque em "Ativar sensores". **iPhone:** toque em "Ativar sensores" e aceite a permissão de "Movimento e orientação".
4. Faça a calibração (parado → balançar 3x → girar o pulso). No computador deve avançar sozinho para o personagem.
5. Crie o personagem, crie uma conta, jogue uma partida de cada esporte, confira XP/moedas e o ranking.
6. **Modo câmera:** em um esporte escolha "Com câmera" → o navegador pede permissão → o avatar copia seu corpo. Teste negar a permissão: o jogo volta para o modo sem câmera.
7. **Online:** abra o site em dois computadores (ou duas janelas anônimas) com contas diferentes e escolha Online no mesmo esporte.
8. **Amigos (local):** conecte um segundo celular pelo botão "Conectar celular" e escolha "Com amigos".

## 10. Divulgação (TikTok, YouTube Shorts, Reels)

- **Grave a reação:** tela do jogo + pessoa balançando o celular (celular no tripé atrás do sofá). Reações de família e de avós jogando funcionam muito bem.
- **Primeiros 2 segundos** com o momento forte: um strike, um nocaute, uma cortada, uma flecha na mosca.
- **Desafios:** "Consegue vencer o BOT difícil?", "Quem da sua família faz mais pontos no basquete?", duelos semanais pelo ranking.
- **Chamada clara:** "Joga grátis no navegador, sem instalar: link na bio". Use o link curto do seu domínio.
- **Constância:** 1 vídeo por dia nas primeiras semanas, variando os esportes. Reaproveite o mesmo vídeo nas 3 redes.
- Hashtags simples: `#jogos #jogosemfamilia #esportes #gamer #celular`.

## 11. Como atualizar o jogo depois

1. Faça as mudanças e teste localmente (`npm run dev` e `npm test`).
2. Envie:

```bash
git add .
```

```bash
git commit -m "Descreva o que mudou"
```

```bash
git push
```

3. A Vercel e o Render publicam a nova versão sozinhos em poucos minutos (acompanhe nos painéis em **Deployments**/**Events**; se algo falhar, os **Logs** mostram o erro).
4. Os dados dos jogadores ficam no Neon e não são apagados ao atualizar.

## ❓ Problemas comuns

| Problema | Solução |
|---|---|
| Celular não abre o QR no jogo local | Celular e PC na mesma Wi‑Fi; libere o Node.js no Firewall do Windows (rede privada); ou use o túnel `cloudflared`. |
| "Sua conexão não é particular" no celular (local) | Normal no certificado local: Avançado → Continuar. Em produção não aparece. |
| Sensores não respondem | Precisa ser HTTPS. No iPhone, toque em "Ativar sensores" e permita "Movimento e orientação" (Ajustes → Safari, se tiver negado). Sem sensores, use os gestos por toque (⚙️ no controle). |
| "Sem conexão com o servidor" | Confira `SERVER_URL` em `client/config.js` e se `https://SEU-SERVICO.onrender.com/api/health` abre. |
| Erro de CORS no console | `CLIENT_ORIGIN` no Render precisa ter exatamente o endereço do front‑end (com `https://`, sem barra final). |
| Câmera não liga | Precisa de HTTPS e permissão do navegador; feche outros apps usando a webcam. |
