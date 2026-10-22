// Catálogo de itens: arenas desbloqueáveis, equipamentos por esporte e acessórios do avatar.
// price 0 = grátis; level = nível mínimo para desbloquear (sem custo).
import { levelFromXp } from './progression.js';

const arena = (sport, id, name, theme, unlock = {}) => ({ id: `arena_${sport}_${id}`, sport, slot: 'arena', name, theme, price: unlock.price || 0, level: unlock.level || 0 });
const equip = (sport, slot, id, name, color, price, extra = {}) => ({ id: `${slot}_${id}`, sport, slot, name, color, price, level: extra.level || 0, ...extra });

export const CATALOG = [
  // ---------- Tênis ----------
  arena('tennis', 'park', 'Parque Ensolarado', { ground: '#58b368', court: '#3d8bd9', lines: '#ffffff', sky: ['#7ec8ff', '#d9f1ff'] }),
  arena('tennis', 'clay', 'Saibro Laranja', { ground: '#9ccf6b', court: '#d9733b', lines: '#fff6e8', sky: ['#ffb36b', '#ffe6c2'] }, { level: 3 }),
  arena('tennis', 'night', 'Estádio Noturno', { ground: '#1f3d2b', court: '#2a5fa8', lines: '#e8f0ff', sky: ['#0b1440', '#2c3a7a'], night: true }, { price: 300 }),
  equip('tennis', 'racket', 'classic', 'Raquete Clássica', '#e63946', 0),
  equip('tennis', 'racket', 'neon', 'Raquete Neon', '#39ff88', 150),
  equip('tennis', 'racket', 'gold', 'Raquete Dourada', '#ffd166', 400, { level: 5 }),
  equip('tennis', 'ball', 'tennis_pink', 'Bola Rosa', '#ff7eb6', 80),
  // ---------- Vôlei ----------
  arena('volleyball', 'gym', 'Ginásio', { ground: '#d9a066', court: '#f4c27a', lines: '#ffffff', sky: ['#8fd3ff', '#e9f7ff'], indoor: true }),
  arena('volleyball', 'beach', 'Praia Dourada', { ground: '#f2d49b', court: '#f7dfae', lines: '#2b7bb9', sky: ['#4fc3f7', '#e1f5fe'], beach: true }, { level: 2 }),
  arena('volleyball', 'sunset', 'Pôr do Sol', { ground: '#e8b07a', court: '#f0c48e', lines: '#ffffff', sky: ['#ff7e5f', '#feb47b'], beach: true }, { price: 250 }),
  equip('volleyball', 'ball', 'volley_tri', 'Bola Tricolor', '#ffd166', 0),
  equip('volleyball', 'ball', 'volley_rainbow', 'Bola Arco-íris', '#ff6bd6', 120),
  equip('volleyball', 'uniform', 'volley_sun', 'Uniforme Sol', '#ff9f1c', 150),
  // ---------- Boliche ----------
  arena('bowling', 'classic', 'Boliche Clássico', { lane: '#e0b179', wall: '#6c4ab6', accent: '#ffd166', sky: ['#2b1d52', '#4a2f8a'], indoor: true }),
  arena('bowling', 'disco', 'Disco Neon', { lane: '#c98bd9', wall: '#1a1035', accent: '#39ff88', sky: ['#120a2a', '#341a63'], indoor: true, disco: true }, { level: 4 }),
  arena('bowling', 'space', 'Estação Espacial', { lane: '#a9c6e8', wall: '#0d1b2a', accent: '#7ab8ff', sky: ['#000814', '#1b263b'], indoor: true, stars: true }, { price: 350 }),
  equip('bowling', 'ball', 'bowl_blue', 'Bola Azul', '#3a86ff', 0),
  equip('bowling', 'ball', 'bowl_galaxy', 'Bola Galáxia', '#7b2cbf', 180),
  equip('bowling', 'ball', 'bowl_lava', 'Bola Lava', '#ff4d00', 260, { level: 6 }),
  // ---------- Golfe ----------
  arena('golf', 'valley', 'Vale Verde', { ground: '#5cbf5c', rough: '#3f9a46', fairway: '#7ed67e', sky: ['#87ceeb', '#e8f8ff'] }),
  arena('golf', 'beach', 'Praia do Sol', { ground: '#e9d8a6', rough: '#a3c46b', fairway: '#8fdb7a', sky: ['#5ec4f2', '#ddf4ff'], water: true }, { level: 3 }),
  arena('golf', 'snow', 'Montanha Nevada', { ground: '#eef6ff', rough: '#c9dbe8', fairway: '#7fc98a', sky: ['#9fc5e8', '#f4f9ff'], snow: true }, { price: 300 }),
  equip('golf', 'club', 'golf_steel', 'Tacos de Aço', '#c0c7d0', 0),
  equip('golf', 'club', 'golf_ruby', 'Tacos Rubi', '#e63946', 160),
  equip('golf', 'ball', 'golf_orange', 'Bola Laranja', '#ff9f1c', 70),
  // ---------- Beisebol ----------
  arena('baseball', 'park', 'Campo do Bairro', { ground: '#4caf50', dirt: '#c98b4f', sky: ['#7ec8ff', '#e3f4ff'] }),
  arena('baseball', 'stadium', 'Grande Estádio', { ground: '#3e9b47', dirt: '#b97a45', sky: ['#5aa9e6', '#d8efff'], stands: true }, { level: 4 }),
  arena('baseball', 'night', 'Jogo Noturno', { ground: '#2e6b34', dirt: '#8a5a33', sky: ['#0b1440', '#283b7a'], night: true, stands: true }, { price: 320 }),
  equip('baseball', 'bat', 'bat_wood', 'Taco de Madeira', '#c68642', 0),
  equip('baseball', 'bat', 'bat_alu', 'Taco de Alumínio', '#b0bec5', 140),
  equip('baseball', 'bat', 'bat_flame', 'Taco Chama', '#ff5400', 300, { level: 5 }),
  // ---------- Boxe ----------
  arena('boxing', 'gym', 'Academia', { floor: '#3d5a80', ropes: '#ee6c4d', sky: ['#293241', '#3d5a80'], indoor: true }),
  arena('boxing', 'arena', 'Arena Lotada', { floor: '#e0e0e0', ropes: '#d00000', sky: ['#14080e', '#3a0ca3'], indoor: true, stands: true }, { level: 3 }),
  arena('boxing', 'rooftop', 'Cobertura', { floor: '#2a9d8f', ropes: '#e9c46a', sky: ['#ff9a8b', '#ffd3a5'] }, { price: 280 }),
  equip('boxing', 'gloves', 'gloves_red', 'Luvas Vermelhas', '#e63946', 0),
  equip('boxing', 'gloves', 'gloves_blue', 'Luvas Azuis', '#3a86ff', 90),
  equip('boxing', 'gloves', 'gloves_gold', 'Luvas de Ouro', '#ffd166', 350, { level: 6 }),
  // ---------- Basquete ----------
  arena('basketball', 'street', 'Quadra de Rua', { floor: '#6c757d', paint: '#ef476f', sky: ['#8ecae6', '#e9f6ff'] }),
  arena('basketball', 'gym', 'Ginásio Escolar', { floor: '#d9a066', paint: '#118ab2', sky: ['#bde0fe', '#fff'], indoor: true }, { level: 2 }),
  arena('basketball', 'arena', 'Arena Pro', { floor: '#c58b52', paint: '#7209b7', sky: ['#10002b', '#3c096c'], indoor: true, stands: true }, { price: 300 }),
  equip('basketball', 'ball', 'bball_classic', 'Bola Clássica', '#ff8c42', 0),
  equip('basketball', 'ball', 'bball_retro', 'Bola Retrô', '#e63946', 110),
  equip('basketball', 'ball', 'bball_night', 'Bola Noturna', '#3a0ca3', 200),
  // ---------- Tênis de mesa ----------
  arena('pingpong', 'club', 'Clube', { floor: '#8d6e63', table: '#1565c0', sky: ['#cfd8dc', '#eceff1'], indoor: true }),
  arena('pingpong', 'garden', 'Jardim', { floor: '#66bb6a', table: '#2e7d32', sky: ['#81d4fa', '#e1f5fe'] }, { level: 2 }),
  arena('pingpong', 'pro', 'Torneio Pro', { floor: '#37474f', table: '#c62828', sky: ['#1a1a2e', '#16213e'], indoor: true, stands: true }, { price: 260 }),
  equip('pingpong', 'paddle', 'paddle_red', 'Raquete Vermelha', '#d62828', 0),
  equip('pingpong', 'paddle', 'paddle_mint', 'Raquete Menta', '#2ec4b6', 90),
  equip('pingpong', 'paddle', 'paddle_galaxy', 'Raquete Galáxia', '#5a189a', 220, { level: 4 }),
  // ---------- Arco e flecha ----------
  arena('archery', 'field', 'Campo Aberto', { ground: '#7cc576', sky: ['#87ceeb', '#e0f6ff'], wind: 1 }),
  arena('archery', 'forest', 'Floresta', { ground: '#3f7d3a', sky: ['#a8e6cf', '#dcedc1'], wind: 2, trees: true }, { level: 3 }),
  arena('archery', 'canyon', 'Cânion Ventoso', { ground: '#d9895b', sky: ['#ffb88c', '#ffe0c2'], wind: 4, moving: true }, { price: 300 }),
  equip('archery', 'bow', 'bow_wood', 'Arco de Madeira', '#8d5524', 0),
  equip('archery', 'bow', 'bow_carbon', 'Arco de Carbono', '#2b2d42', 160),
  equip('archery', 'bow', 'bow_elf', 'Arco Élfico', '#43aa8b', 280, { level: 5 }),
  // ---------- Avatar ----------
  { id: 'acc_crown', sport: 'avatar', slot: 'acc', value: 'crown', name: 'Coroa', price: 500 },
  { id: 'acc_star', sport: 'avatar', slot: 'acc', value: 'starglasses', name: 'Óculos Estrela', price: 200 },
  { id: 'acc_bunny', sport: 'avatar', slot: 'acc', value: 'bunny', name: 'Orelhas de Coelho', price: 250 },
  { id: 'acc_halo', sport: 'avatar', slot: 'acc', value: 'halo', name: 'Auréola', price: 350, level: 8 },
];

export const itemById = (id) => CATALOG.find((i) => i.id === id);
export const itemsFor = (sport, slot) => CATALOG.filter((i) => i.sport === sport && (!slot || i.slot === slot));

export function isOwned(profile, item) {
  if (!item) return false;
  if (item.price === 0 && levelFromXp(profile.xp).level >= (item.level || 0)) return true;
  return profile.owned.includes(item.id);
}
export function canBuy(profile, item) {
  if (!item || isOwned(profile, item)) return { ok: false, reason: 'Já é seu' };
  if (levelFromXp(profile.xp).level < (item.level || 0)) return { ok: false, reason: `Requer nível ${item.level}` };
  if (profile.coins < item.price) return { ok: false, reason: 'Moedas insuficientes' };
  return { ok: true };
}
export function buyItem(profile, itemId) {
  const item = itemById(itemId);
  const c = canBuy(profile, item);
  if (!c.ok) return c;
  profile.coins -= item.price;
  profile.owned.push(item.id);
  profile.stats.purchases = (profile.stats.purchases || 0) + 1;
  return { ok: true, item };
}
// Item equipado num slot de um esporte (cai no padrão se não possuir).
export function equipped(profile, sport, slot) {
  const id = profile.equipped?.[sport]?.[slot];
  const item = itemById(id);
  if (item && isOwned(profile, item)) return item;
  return itemsFor(sport, slot).find((i) => isOwned(profile, i)) || null; // padrão: primeiro item grátis/possuído
}
