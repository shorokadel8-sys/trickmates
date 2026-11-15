// TRICKMATES — WebSocket client with automatic reconnect + session resume
const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} },
};

export class Net {
  constructor() {
    this.ws = null; this.handlers = {}; this.queue = [];
    this.token = store.get('tm_token'); this.wantOpen = false; this.retry = 0; this.status = 'idle';
  }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  emit(type, data) { (this.handlers[type] || []).forEach(f => f(data)); }
  url() {
    const override = new URLSearchParams(location.search).get('server');
    if (override) return override;
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  }
  connect() {
    this.wantOpen = true;
    if (this.ws && this.ws.readyState <= 1) return Promise.resolve();
    return new Promise((resolve) => {
      this.setStatus('connecting');
      const ws = new WebSocket(this.url());
      this.ws = ws;
      ws.onopen = () => {
        this.retry = 0; this.setStatus('online');
        if (this.token && this.resumeOnOpen) ws.send(JSON.stringify({ type: 'resume', token: this.token }));
        this.queue.splice(0).forEach(m => ws.send(m));
        resolve();
      };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.type === 'joined') { this.token = m.token; store.set('tm_token', m.token); this.resumeOnOpen = true; }
        if (m.type === 'resume_failed') { this.token = null; store.set('tm_token', null); this.resumeOnOpen = false; }
        this.emit(m.type, m);
        if (m.type === 'ev') this.emit('ev:' + m.ev, m);
      };
      ws.onclose = () => {
        this.setStatus('offline');
        if (this.wantOpen) { const d = Math.min(5000, 500 * 2 ** this.retry++); setTimeout(() => this.connect(), d); }
      };
      ws.onerror = () => {};
    });
  }
  setStatus(s) { this.status = s; this.emit('status', s); }
  send(m) {
    const s = JSON.stringify(m);
    if (this.ws && this.ws.readyState === 1) this.ws.send(s); else if (m.type !== 'pos') this.queue.push(s);
  }
  hasSession() { return !!this.token; }
  resume() { this.resumeOnOpen = true; return this.connect(); }
  leave() { this.send({ type: 'leave' }); this.token = null; store.set('tm_token', null); this.resumeOnOpen = false; }
}
