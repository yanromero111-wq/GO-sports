// Gerencia o perfil: conta no servidor (com token) ou convidado (salvo só neste aparelho).
// Cache local sempre atualizado; com conta, o servidor é a fonte da verdade.
import { apiBase } from './net.js';
import { normalizeProfile, newProfile, applyMatch, claimDoubleCoins } from '../shared/progression.js';
import { buyItem } from '../shared/catalog.js';

const LS = {
  get(k, d) { try { const v = localStorage.getItem('gs_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gs_' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('gs_' + k); } catch {} },
};
export const storage = LS;

async function req(method, path, body, token) {
  const res = await fetch(apiBase() + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Falha de conexão');
    err.status = res.status;
    throw err;
  }
  return data;
}

export class ProfileManager {
  constructor() {
    this.token = LS.get('token', null);
    this.profile = this.token ? normalizeProfile(LS.get('account_cache', null)) : null;
    this.guest = LS.get('guest', null);
    this.listeners = new Set();
    this.saveTimer = null;
    this.online = true;
  }
  get isGuest() { return !this.token; }
  get hasLocalPlayer() { return !!(this.token || this.guest); }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.profile); }

  setProfile(p) {
    this.profile = normalizeProfile(p);
    if (this.token) LS.set('account_cache', this.profile);
    else LS.set('guest', this.profile);
    this.emit();
  }

  // Tenta restaurar a sessão salva. Retorna true se há um jogador pronto (conta ou convidado).
  async restore() {
    if (this.token) {
      try {
        const { profile } = await req('GET', '/profile', null, this.token);
        this.setProfile(profile);
        return true;
      } catch (e) {
        if (e.status === 401) { this.token = null; LS.del('token'); }
        else if (this.profile) { this.online = false; return true; } // offline: usa o cache
      }
    }
    if (this.guest) { this.profile = normalizeProfile(this.guest); this.emit(); return true; }
    return false;
  }

  startGuest(username, avatar) {
    const p = newProfile(username || 'Convidado');
    if (avatar) p.avatar = { ...p.avatar, ...avatar };
    this.token = null;
    LS.del('token');
    this.setProfile(p);
  }

  async checkUsername(username) { return req('POST', '/auth/check', { username }); }

  async register(username, password, avatar) {
    const guestProfile = this.isGuest && this.profile ? this.profile : LS.get('guest', null);
    const { token, profile } = await req('POST', '/auth/register', { username, password, avatar, guestProfile });
    this.token = token;
    LS.set('token', token);
    this.setProfile(profile);
  }

  async login(username, password, mergeGuest = false) {
    const guestProfile = LS.get('guest', null);
    const { token, profile } = await req('POST', '/auth/login', { username, password, guestProfile, mergeGuest });
    this.token = token;
    LS.set('token', token);
    this.setProfile(profile);
  }

  async logout() {
    if (this.token) req('POST', '/auth/logout', {}, this.token).catch(() => {});
    this.token = null;
    LS.del('token');
    LS.del('account_cache');
    this.profile = this.guest ? normalizeProfile(LS.get('guest', null)) : null;
    this.emit();
  }

  // Salva campos editáveis (avatar, ajustes, calibração, equipamentos). Agrupa chamadas próximas.
  save(fields = {}) {
    Object.assign(this.profile, fields);
    this.setProfile(this.profile);
    if (!this.token) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const p = this.profile;
      req('PUT', '/profile', { avatar: p.avatar, settings: p.settings, calibration: p.calibration, equipped: p.equipped, tutorialsSeen: p.tutorialsSeen }, this.token)
        .catch((e) => console.warn('falha ao salvar perfil', e));
    }, 600);
  }

  // Fim de partida: servidor calcula as recompensas (conta) ou o próprio navegador (convidado).
  async reportMatch(result) {
    if (this.token) {
      try {
        const { summary, profile } = await req('POST', '/match', result, this.token);
        this.setProfile(profile);
        return summary;
      } catch (e) {
        console.warn('partida não sincronizada, salvando localmente', e);
        const pend = LS.get('pending_matches', []);
        pend.push(result);
        LS.set('pending_matches', pend.slice(-10));
      }
    }
    const summary = applyMatch(this.profile, result);
    this.setProfile(this.profile);
    return summary;
  }

  async flushPending() {
    if (!this.token) return;
    const pend = LS.get('pending_matches', []);
    if (!pend.length) return;
    LS.set('pending_matches', []);
    for (const r of pend) await this.reportMatch(r).catch(() => {});
  }

  async claimDouble() {
    if (this.token) {
      const { coins, profile } = await req('POST', '/reward/double', {}, this.token);
      this.setProfile(profile);
      return coins;
    }
    const coins = claimDoubleCoins(this.profile);
    this.setProfile(this.profile);
    return coins;
  }

  async buy(itemId) {
    if (this.token) {
      const { profile } = await req('POST', '/shop/buy', { itemId }, this.token);
      this.setProfile(profile);
      return { ok: true };
    }
    const r = buyItem(this.profile, itemId);
    if (r.ok) this.setProfile(this.profile);
    return r;
  }

  async leaderboard(sport) {
    return (await req('GET', '/leaderboard?sport=' + encodeURIComponent(sport))).rows;
  }
}
