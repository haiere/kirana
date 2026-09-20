/* Kirana — chatbot starter
   Dua mode:
   1. Ada API key di Pengaturan  -> panggil Groq langsung dari browser (uji coba pribadi)
   2. Tidak ada key              -> panggil /api/chat (proxy serverless, key aman di server)
*/

const DIRECT_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const PROXY_ENDPOINT = '/api/chat';

const el = {
  chat: document.getElementById('chat'),
  empty: document.getElementById('empty'),
  form: document.getElementById('composer'),
  input: document.getElementById('input'),
  send: document.getElementById('send'),
  status: document.getElementById('status'),
  clear: document.getElementById('clear'),
  apiKey: document.getElementById('apiKey'),
  model: document.getElementById('model'),
  system: document.getElementById('systemPrompt'),
  settings: document.getElementById('settings'),
  settingsBtn: document.getElementById('settingsBtn'),
  themeBtn: document.getElementById('themeBtn'),
};

/** Riwayat percakapan — inilah "memori" bot. */
let history = [];
let busy = false;

/* ---------- penyimpanan preferensi ----------
   Sengaja in-memory: preview iframe memblokir storage browser.
   Di hosting sendiri, ganti isi get/set dengan localStorage bila mau persisten. */
const _mem = {};
const store = {
  get(k) { return _mem[k] ?? null; },
  set(k, v) { _mem[k] = v; },
};

/* ---------- tema ---------- */
let theme = store.get('kirana-theme')
  || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
document.documentElement.dataset.theme = theme;
el.themeBtn.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  store.set('kirana-theme', theme);
});

/* ---------- pengaturan ---------- */
el.apiKey.value = store.get('kirana-key') || '';
el.apiKey.addEventListener('change', () => store.set('kirana-key', el.apiKey.value.trim()));
el.model.value = store.get('kirana-model') || el.model.value;
el.model.addEventListener('change', () => store.set('kirana-model', el.model.value));

el.settingsBtn.addEventListener('click', () => {
  const open = el.settings.hidden;
  el.settings.hidden = !open;
  el.settingsBtn.setAttribute('aria-expanded', String(open));
});

/* ---------- render pesan ---------- */
function addMessage(role, text = '') {
  el.empty?.remove();
  const wrap = document.createElement('div');
  wrap.className = `msg msg-${role}`;
  const badge = document.createElement('div');
  badge.className = 'msg-role';
  badge.textContent = role === 'user' ? 'YOU' : role === 'error' ? '!' : 'AI';
  const body = document.createElement('div');
  body.className = 'msg-body';
  wrap.append(badge, body);
  el.chat.append(wrap);
  setText(body, text);
  scrollDown();
  return body;
}

/** Render teks + blok kode ```...``` tanpa library, aman dari HTML injection. */
function setText(node, text, streaming = false) {
  node.textContent = '';
  const parts = text.split(/```/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      const pre = document.createElement('pre');
      pre.textContent = part.replace(/^[a-zA-Z0-9]*\n/, '');
      node.append(pre);
    } else if (part.trim() || parts.length === 1) {
      const p = document.createElement('p');
      p.textContent = part;
      node.append(p);
    }
  });
  if (streaming) {
    const c = document.createElement('span');
    c.className = 'cursor';
    (node.lastElementChild || node).append(c);
  }
}

function scrollDown() { el.chat.scrollTop = el.chat.scrollHeight; }
function setStatus(s) { el.status.textContent = s; }

/* ---------- kirim ---------- */
el.form.addEventListener('submit', (e) => { e.preventDefault(); send(el.input.value); });

el.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(el.input.value); }
});
el.input.addEventListener('input', () => {
  el.input.style.height = 'auto';
  el.input.style.height = Math.min(el.input.scrollHeight, 144) + 'px';
});

document.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('click', () => send(chip.textContent));
});

el.clear.addEventListener('click', () => {
  history = [];
  el.chat.innerHTML = '';
  addMessage('assistant', 'Riwayat dibersihkan. Silakan mulai lagi.');
  setStatus('Siap');
});

async function send(raw) {
  const text = raw.trim();
  if (!text || busy) return;

  busy = true;
  el.send.disabled = true;
  el.input.value = '';
  el.input.style.height = 'auto';

  addMessage('user', text);
  history.push({ role: 'user', content: text });

  const out = addMessage('assistant');
  setText(out, '', true);
  setStatus('Mengetik…');

  try {
    const reply = await streamChat(history, (partial) => {
      setText(out, partial, true);
      scrollDown();
    });
    setText(out, reply);
    history.push({ role: 'assistant', content: reply });
    setStatus('Siap');
  } catch (err) {
    out.closest('.msg').classList.add('msg-error');
    setText(out, 'Gagal: ' + err.message);
    history.pop();
    setStatus('Error');
  } finally {
    busy = false;
    el.send.disabled = false;
    el.input.focus();
    scrollDown();
  }
}

/* ---------- panggilan API + streaming SSE ---------- */
async function streamChat(messages, onToken) {
  const key = el.apiKey.value.trim();
  const payload = {
    model: el.model.value,
    stream: true,
    temperature: 0.7,
    messages: [{ role: 'system', content: el.system.value }, ...messages.slice(-20)],
  };

  const res = await fetch(key ? DIRECT_ENDPOINT : PROXY_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (!key && (res.status === 404 || res.status === 405)) {
      throw new Error('belum ada API key. Buka Pengaturan dan tempel key Groq gratis kamu.');
    }
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const token = JSON.parse(data).choices?.[0]?.delta?.content;
        if (token) { full += token; onToken(full); }
      } catch { /* potongan JSON belum lengkap, lanjut */ }
    }
  }
  if (!full) throw new Error('respons kosong dari model');
  return full;
}
