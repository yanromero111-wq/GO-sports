# 🏅 GO SPORTS

Jogo web de esportes em família com **controle por movimento**: o jogo roda na tela grande (computador, TV ou tablet) e o **celular vira o controle** (sensores de movimento + touchpad), conectado por QR code. Visual cartunesco em 3D low‑poly, personagens, marca, músicas e efeitos 100% originais (tudo gerado por código).

**9 esportes:** Tênis · Vôlei · Boliche · Golfe · Beisebol · Boxe · Basquete · Tênis de Mesa · Arco e Flecha.

---

## ✨ O que tem

| Área | Recursos |
|---|---|
| Controle | QR code + código de sala, até 4 celulares, calibração guiada (parado → balançar → girar o pulso), permissão de sensores do iPhone, touchpad/cursor, botões A/B/d‑pad/pausa, botões contextuais por esporte, vibração, teclado do celular para digitar nome e senha. Sem celular: teclado e mouse. |
| Modos de controle | **Sem câmera** (padrão): a mão/braço do avatar copia o celular e o corpo se posiciona sozinho. **Com câmera** (opcional): MediaPipe Pose + Face no navegador, corpo inteiro e cabeça do avatar seguem você, gestos lidos pelo corpo, filtro One Euro contra tremores. Se a câmera falhar ou for negada, volta sozinho para o modo sem câmera. |
| Personagem | Corpo, altura, olhos, boca, sobrancelha, bochechas, 8 cabelos, cores de cabelo/pele/roupa/tênis, acessórios (alguns compráveis), uniforme por esporte. |
| Conta | Nome único, criar conta/entrar com senha (bcrypt), **jogar como convidado** (salvo no aparelho) e levar o progresso ao criar a conta. |
| Esportes | Tutorial na 1ª vez, BOT fácil/médio/difícil, 3 arenas por esporte (grátis, por nível, por moedas), equipamentos próprios (raquete, bola, taco, luvas, arco, tacos de golfe, uniforme). |
| Partidas | Contra BOT, **local com amigos** (2 a 4 celulares) e **online** com matchmaking por liga e BOT reserva se ninguém aparecer. |
| Progressão | Placar, XP e nível, ligas Bronze → Prata → Ouro → Platina → Diamante → Lenda (sobe e desce), ranking global e por esporte, 17 conquistas, 3 missões diárias, moedas e loja. Salva automaticamente ao fim de cada partida. |
| Anúncios | AdSense (banner nos menus) + Ad Placement API para jogos (intervalo com limite de frequência e vídeo premiado **opcional** "moedas em dobro"), sempre identificados como "Publicidade". Aviso de cookies/LGPD e Política de Privacidade. Preparado para "Remover anúncios". |

---

## 🚀 Rodar no seu computador

Requisitos: **Node.js 22.13 ou mais novo** (recomendado a versão LTS) e um navegador moderno (Chrome, Edge, Safari, Firefox).

```bash
npm install
```

```bash
npm run dev
```

Abra **http://localhost:3000** no computador. Aparece o QR code:

1. Celular e computador na **mesma rede Wi‑Fi**.
2. Aponte a câmera do celular para o QR code. Ele abre `https://SEU-IP:3443/controller.html?room=XXXX`.
3. O navegador vai avisar que o certificado não é confiável (é um certificado local gerado na sua máquina). Toque em **Avançado → Continuar**. Isso é necessário porque **sensores e câmera só funcionam em HTTPS**.
4. Toque em **Ativar sensores** e siga a calibração. Pronto!

> **Alternativa sem aviso de certificado (túnel gratuito):** com o jogo rodando, em outro terminal:
> ```bash
> npx cloudflared tunnel --url http://localhost:3000
> ```
> Abra o endereço `https://….trycloudflare.com` **também no computador**; o QR code passa a usar esse endereço automaticamente.

### Jogar só com a câmera (sem celular)
Na tela do QR, clique em **"📷 Jogar só com a câmera"** e permita a webcam. Fique a uns 2 metros, de corpo inteiro na imagem.

| Gesto | Ação |
|---|---|
| Levantar a mão e apontar | move o cursor dos menus |
| Parar o cursor sobre um botão (~1 s) | clica (o anel amarelo enche) |
| As duas mãos acima da cabeça (1 s) | pausa / continua |
| Passos para os lados | anda na quadra (tênis, vôlei, tênis de mesa), escolhe a posição no boliche, mira no golfe e no arremesso do beisebol |
| Movimento rápido do braço | rebater, cortar, arremessar, jogar a bola de boliche, tacada |
| Socar para a frente · mãos no rosto · inclinar o corpo | soco · guarda · esquiva (boxe) |
| Braço esquerdo esticado + afastar as mãos · juntar as mãos | mirar e puxar o arco · soltar a flecha |

Para digitar o nome sem teclado, use o botão **🎲 Nome** no editor e jogue como convidado.

### Jogar com teclado e mouse
Na tela do QR, clique em **"Teclado e mouse"**. Controles:

| Tecla | Ação |
|---|---|
| Espaço (segure para mais força) | balançar / rebater / arremessar |
| Setas durante o balanço | direção (↑ por cima, ↓ por baixo, ← →) |
| Q / E | efeito (giro do pulso) |
| Setas fora do balanço | mirar, posição, trocar taco |
| Enter / Esc | OK / pausa |
| J K (socos) · U O (ganchos) · I (uppercut) · L (guarda) · A D (esquiva) | boxe |
| F ou botão direito do mouse (segure e solte) + mouse para mirar | arco e flecha |

---

## 🗂️ Estrutura

```
go-sports/
├─ server/                 # Node.js: Express + WebSocket
│  ├─ index.js             # servidor único (front + API + WS), HTTPS local automático
│  ├─ api.js               # contas, perfil, partidas, loja, ranking
│  ├─ db.js                # SQLite embutido do Node (padrão) ou Postgres (DATABASE_URL)
│  └─ realtime.js          # salas TV↔celular, relay de gestos, matchmaking online
├─ client/                 # front-end 100% estático (pode ir para a Vercel)
│  ├─ index.html           # tela principal (o jogo)
│  ├─ controller.html      # página do celular (só controle)
│  ├─ privacy.html         # Política de Privacidade (LGPD)
│  ├─ config.js            # SERVER_URL do backend em produção
│  ├─ ads.config.js        # ⬅️ cole aqui seus IDs do AdSense
│  ├─ shared/              # regras compartilhadas com o servidor (progressão, ligas, loja)
│  ├─ vendor/three/        # Three.js (copiado de node_modules no npm install)
│  └─ js/
│     ├─ main.js           # estados do app, pareamento, loop, pausa
│     ├─ input.js          # entrada unificada (celular, teclado/mouse, câmera)
│     ├─ audio.js          # música e efeitos gerados por código (Web Audio)
│     ├─ profile.js        # conta/convidado, cache local e sincronização
│     ├─ ads.js · consent.js
│     ├─ engine/           # mundo 3D, avatar articulado, materiais toon, efeitos, cenário
│     ├─ sports/           # UM MÓDULO POR ESPORTE + núcleos comuns
│     ├─ camera/           # MediaPipe Pose/Face + filtro One Euro
│     ├─ controller/       # lógica do celular (sensores, calibração, touchpad)
│     ├─ ui/               # telas, HUD, cursor do touchpad
│     └─ dev/autoplay.js   # testes automáticos que jogam partidas inteiras
├─ scripts/                # copy-vendor e smoke-test do backend
├─ render.yaml · vercel.json · .env.example
├─ README.md
└─ TUTORIAL_PUBLICAR.md    # passo a passo para publicar
```

### Como adicionar um esporte novo
1. Crie `client/js/sports/<id>.js` exportando `create(ctx)` (use `SportBase` de `sports/common.js`: entrada por jogador, timers, avatares, `this.end({...})`).
2. Adicione os metadados (tutorial, durações, dica do celular) em `client/js/sports/registry.js`.
3. Adicione o esporte em `client/shared/progression.js` (`SPORTS`) e arenas/itens em `client/shared/catalog.js`.

### Como o online funciona
O servidor só repassa mensagens pequenas. Cada aparelho é a "autoridade" das jogadas do próprio jogador:
- **Esportes de rali** (tênis, tênis de mesa, vôlei): cada lado envia suas rebatidas/toques; quem **recebe** a bola decide o ponto.
- **Esportes por turno** (boliche, golfe, basquete, arco): envia‑se só os parâmetros da jogada; a física é determinística, então os dois aparelhos calculam o mesmo resultado.
- **Beisebol:** o arremessador envia o arremesso; o rebatedor decide o resultado. **Boxe:** quem leva o soco decide se defendeu.

---

## ✅ Testes

```bash
npm test
```
Sobe o servidor numa porta livre e verifica 28 itens: contas, senha, limite anti‑trapaça do progresso de convidado, partidas, ligas, conquistas, vídeo premiado, loja, ranking, pareamento TV↔celular e matchmaking (com bot reserva).

Teste dos jogos no navegador (abra o console na tela principal, já no menu):
```js
const t = await import('/js/dev/autoplay.js'); await t.selfTest(); // joga uma partida de cada esporte
```

---

## ⚙️ Configuração

| Arquivo | Para quê |
|---|---|
| `.env` (copie de `.env.example`) | porta, HTTPS local, `DATABASE_URL` (Postgres), `CLIENT_ORIGIN` (CORS), tempo do matchmaking |
| `client/config.js` | `SERVER_URL` do backend quando o front‑end estiver em outro domínio |
| `client/ads.config.js` | ID do AdSense, bloco de banner, modo de teste e limites de frequência |

Publicação passo a passo: veja **[TUTORIAL_PUBLICAR.md](TUTORIAL_PUBLICAR.md)**.

## Limitações conhecidas
- O modo câmera precisa de webcam e boa iluminação, com o corpo inteiro visível; foi testado com dados sintéticos e com o fluxo de permissão/queda para o modo sem câmera, mas a calibração fina dos gestos deve ser ajustada com pessoas reais.
- A detecção de gestos do celular usa o giroscópio (`rotationRate`) com o celular segurado como um controle remoto (tela para cima, topo para a TV). A calibração adapta a força a cada pessoa.
- No plano gratuito do Render o servidor "dorme" após 15 min sem uso; o primeiro acesso pode levar ~1 minuto.
