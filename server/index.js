// GO SPORTS - servidor único: front-end estático + API + WebSocket.
// Em desenvolvimento também abre HTTPS (certificado autoassinado) para os sensores do celular funcionarem na rede local.
import express from 'express';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { createDb } from './db.js';
import { apiRouter } from './api.js';
import { attachRealtime } from './realtime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Lê .env (sem dependência extra)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const IS_PROD = process.env.NODE_ENV === 'production';
const DEV_HTTPS = !IS_PROD && process.env.DEV_HTTPS !== '0';

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  // Redes domésticas comuns primeiro
  return out.sort((a, b) => (/^192\.168\./.test(b) ? 1 : 0) - (/^192\.168\./.test(a) ? 1 : 0));
}

async function devCert() {
  const dir = path.join(ROOT, '.certs');
  const file = path.join(dir, 'dev-cert.json');
  const ips = lanAddresses();
  if (fs.existsSync(file)) {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (JSON.stringify(c.ips) === JSON.stringify(ips)) return c;
  }
  const { default: selfsigned } = await import('selfsigned');
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'go-sports.local' }], {
    keySize: 2048,
    algorithm: 'sha256',
    notAfterDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }, ...ips.map((ip) => ({ type: 7, ip }))] }],
  });
  const c = { key: pems.private, cert: pems.cert, ips };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(c));
  return c;
}

const db = await createDb();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));

// CORS para quando o front-end estiver em outro domínio (ex.: Vercel) e a API no Render.
const allowed = (process.env.CLIENT_ORIGIN || '*').split(',').map((s) => s.trim());
app.use((req, res, next) => {
  const o = req.headers.origin;
  if (o && (allowed.includes('*') || allowed.includes(o))) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, db: db.kind }));
app.get('/api/info', (req, res) => res.json({
  lan: lanAddresses(),
  httpsPort: DEV_HTTPS ? HTTPS_PORT : null,
  publicUrl: process.env.PUBLIC_URL || null,
}));
app.get('/api/qr', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 400);
  if (!text) return res.status(400).end();
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1d2b53', light: '#ffffff' } });
  res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
});
app.use('/api', apiRouter(db));
app.use(express.static(path.join(ROOT, 'client'), {
  extensions: ['html'],
  setHeaders: (res) => { if (!IS_PROD) res.setHeader('Cache-Control', 'no-cache'); },
}));

// Porta ocupada: explica em vez de mostrar um erro técnico.
function portBusy(server, port) {
  server.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') throw e;
    console.error(`
  ⚠️  A porta ${port} já está em uso: o GO SPORTS provavelmente já está rodando em outro terminal.`);
    console.error(`  Abra http://localhost:${PORT} no navegador, ou feche o outro servidor (Ctrl + C) e rode de novo.
`);
    process.exit(1);
  });
}

const servers = [];
const httpServer = http.createServer(app);
servers.push(httpServer);
portBusy(httpServer, PORT);
httpServer.listen(PORT, () => {
  console.log(`\n  🏅 GO SPORTS rodando!`);
  console.log(`  Tela principal:   http://localhost:${PORT}`);
});

if (DEV_HTTPS) {
  try {
    const cert = await devCert();
    const httpsServer = https.createServer({ key: cert.key, cert: cert.cert }, app);
    servers.push(httpsServer);
    portBusy(httpsServer, HTTPS_PORT);
    httpsServer.listen(HTTPS_PORT, () => {
      for (const ip of lanAddresses()) console.log(`  Rede local HTTPS: https://${ip}:${HTTPS_PORT}  (o celular usa este endereço)`);
      console.log(`  Dica: no celular aceite o aviso de certificado ("Avançado" > "Continuar").\n`);
    });
  } catch (e) {
    console.warn('[https] não foi possível criar o certificado local:', e.message);
  }
}

attachRealtime(servers);
