// Recebe os quadros e o áudio gerados por client/js/dev/trailer.js e monta o MP4 com o ffmpeg.
// Uso: npm run trailer   (acha o ffmpeg sozinho; opcional: variável FFMPEG com o caminho do ffmpeg)
// Depois, no console da tela principal: const t = await import('/js/dev/trailer.js'); await t.makeTrailer();
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'trailer');
const work = path.join(os.tmpdir(), 'gs-trailer-work');
// Procura o ffmpeg: variável FFMPEG > pacote ffmpeg-static > pasta temporária de ferramentas > ffmpeg do sistema.
async function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { const m = await import('ffmpeg-static'); if (m.default && fs.existsSync(m.default)) return m.default; } catch {}
  const tmp = path.join(os.tmpdir(), 'gs-trailer-tools', 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(tmp)) return tmp;
  return 'ffmpeg';
}
const FFMPEG = await findFfmpeg();
const PORT = Number(process.env.TRAILER_PORT || 3999);

const readBody = (req) => new Promise((res) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => res(Buffer.concat(c))); });
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); };

function encode(name) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${name}.mp4`);
  const args = [
    '-y', '-framerate', '30', '-i', path.join(work, '%05d.jpg'), '-i', path.join(work, 'audio.wav'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out,
  ];
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err))));
  });
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': '*' });
    return res.end();
  }
  const url = new URL(req.url, 'http://x');
  try {
    const body = await readBody(req);
    if (url.pathname === '/start') {
      fs.rmSync(work, { recursive: true, force: true });
      fs.mkdirSync(work, { recursive: true });
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/frame') {
      const i = Number(url.searchParams.get('i'));
      const head = body.subarray(0, 23).toString();
      const data = head.startsWith('data:') ? Buffer.from(body.toString().split(',')[1], 'base64') : body;
      fs.writeFileSync(path.join(work, String(i).padStart(5, '0') + '.jpg'), data);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/audio') {
      fs.writeFileSync(path.join(work, 'audio.wav'), body);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/done') {
      const name = (url.searchParams.get('name') || 'trailer').replace(/[^\w-]/g, '');
      console.log('Codificando o vídeo…');
      const out = await encode(name);
      const frames = fs.readdirSync(work).filter((f) => f.endsWith('.jpg')).length;
      console.log('Pronto:', out);
      return json(res, 200, { ok: true, file: out, frames, sizeMB: +(fs.statSync(out).size / 1e6).toFixed(1) });
    }
    json(res, 404, { error: 'rota desconhecida' });
  } catch (e) {
    console.error(e);
    json(res, 500, { error: String(e.message).slice(-800) });
  }
}).listen(PORT, () => {
  console.log(`Receptor do trailer em http://localhost:${PORT}`);
  console.log(`ffmpeg: ${FFMPEG}`);
  console.log('Agora abra o jogo, entre no menu e rode no console (F12):');
  console.log("  const t = await import('/js/dev/trailer.js'); await t.makeTrailer();");
});
