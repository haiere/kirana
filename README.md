# Bikin App Chatbot AI dari Nol — HTML, CSS, JS, Deploy Gratis

Tutorial praktis: dari file kosong sampai chatbot online di domainmu sendiri, tanpa framework, tanpa server sendiri, tanpa biaya. Semua kode di repo ini bisa langsung dipakai.

Yang akan kamu bangun:

- UI chat responsif (dark/light mode) — HTML + CSS + JS murni
- Streaming jawaban token-per-token (efek "mengetik")
- Riwayat percakapan supaya bot ingat konteks
- Proxy serverless supaya API key tidak bocor ke publik
- Deploy ke Cloudflare Pages

---

## 1. Konsep dasar: chatbot itu cuma HTTP POST

Semua API model AI modern (OpenAI, Groq, Together, OpenRouter, bahkan Ollama lokal) memakai bentuk yang sama, namanya "OpenAI-compatible chat completions":

```
POST https://<host>/v1/chat/completions
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "model": "llama-3.3-70b-versatile",
  "messages": [
    { "role": "system",    "content": "Kamu asisten berbahasa Indonesia." },
    { "role": "user",      "content": "Halo, siapa kamu?" },
    { "role": "assistant", "content": "Aku Kirana." },
    { "role": "user",      "content": "Bikin fungsi debounce dong" }
  ],
  "stream": true
}
```

Tiga hal penting:

1. **Model tidak punya memori.** Setiap request kamu kirim ulang seluruh riwayat. Itulah kenapa di `app.js` ada array `history` — array itulah memorinya.
2. **`role: system`** adalah kepribadian dan aturan bot. Ini "otak" produkmu.
3. **`stream: true`** membuat server membalas potongan demi potongan (SSE), bukan menunggu jawaban penuh. Wajib kalau mau terasa seperti ChatGPT.

Karena bentuknya seragam, ganti provider cukup ganti URL + nama model.

---

## 2. Pilih provider dan ambil API key

| Provider | Kelebihan | Catatan |
| --- | --- | --- |
| **Groq** | Gratis tanpa kartu kredit, tercepat | Free tier dibatasi rate limit per menit/hari ([Groq](https://console.groq.com/docs/models)) |
| **OpenAI** | Kualitas tertinggi | Bayar per token, butuh kartu ([OpenAI](https://developers.openai.com/api/docs/models)) |
| **OpenRouter** | Satu key untuk banyak model | Ada beberapa model gratis |
| **Ollama** | Jalan lokal, offline, gratis | Butuh RAM besar |

Untuk belajar, pakai **Groq**. Model ID yang tersedia saat ini antara lain `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-120b`, dan `qwen/qwen3.8-27b`, dengan endpoint dasar `https://api.groq.com/openai/v1` ([dokumentasi model Groq](https://console.groq.com/docs/models)). Free tier Groq tidak memakai sistem kredit — hanya dibatasi rate limit ([Price Per Token](https://pricepertoken.com/endpoints/groq/free)).

Daftar di console.groq.com, buat API key, simpan. Key diawali `gsk_`.

---

## 3. Struktur project

```
chatbot-ai/
├── index.html            UI
├── styles.css            tampilan + dark mode
├── app.js                logika chat + streaming
└── functions/
    └── api/
        └── chat.js       proxy serverless (Cloudflare Pages Function)
```

Tidak ada build step. Tidak ada `npm install`. Buka `index.html` di browser, jalan.

---

## 4. Panggilan API paling minimal (versi non-streaming)

Sebelum masuk streaming, pahami versi sederhananya dulu:

```js
async function ask(messages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}
```

Itu saja. Sisanya adalah UI dan pengalaman pengguna.

---

## 5. Streaming: bikin jawaban muncul huruf demi huruf

Dengan `stream: true`, server mengirim **Server-Sent Events**: baris-baris teks berformat `data: {...}`, ditutup `data: [DONE]`.

```js
const res = await fetch(ENDPOINT, { /* ...seperti di atas, + stream: true */ });

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
let full = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop();            // baris terakhir mungkin terpotong

  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;

    const token = JSON.parse(data).choices?.[0]?.delta?.content;
    if (token) {
      full += token;
      render(full);                // update DOM
    }
  }
}
```

Dua jebakan yang paling sering bikin pemula bingung:

- **Jangan lupa `buffer`.** Satu chunk jaringan bisa berhenti di tengah JSON. Kalau kamu langsung `JSON.parse` per chunk, sesekali akan error.
- **`decoder.decode(value, { stream: true })`** wajib pakai `{ stream: true }`, kalau tidak karakter multi-byte (emoji, huruf beraksen) bisa rusak.

Lihat implementasi lengkapnya di `app.js` → fungsi `streamChat`.

---

## 6. Riwayat percakapan (memori bot)

```js
let history = [];

// saat user kirim
history.push({ role: 'user', content: text });

// saat jawaban selesai
history.push({ role: 'assistant', content: reply });

// saat mengirim ke API — system prompt selalu di depan, riwayat dipotong
messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-20)]
```

`slice(-20)` itu penting: percakapan panjang = token banyak = lambat dan mahal, dan akhirnya menabrak batas konteks model. Batasi jumlah pesan, atau ringkas pesan-pesan lama jadi satu ringkasan.

---

## 7. Keamanan: JANGAN taruh API key di JavaScript frontend

Kode frontend bisa dibaca siapa saja lewat View Source. Kalau kamu menaruh key di `app.js` lalu deploy, key itu publik — orang lain bisa memakainya sampai kuotamu habis.

Aturannya:

- **Uji coba pribadi di laptop sendiri** — key di input form (seperti mode Pengaturan di demo ini) masih oke.
- **Begitu dipublikasikan** — key wajib pindah ke server.

Solusinya proxy serverless. File `functions/api/chat.js` di repo ini adalah Cloudflare Pages Function: taruh file di path itu, dan setelah deploy ia otomatis jadi endpoint `POST /api/chat`. Alurnya jadi:

```
browser  ──POST /api/chat──▶  Pages Function  ──+ Authorization──▶  Groq API
         ◀──── stream SSE ───              ◀──── stream SSE ────
```

Isi intinya:

```js
export async function onRequestPost({ request, env }) {
  const body = await request.json();

  const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,   // key hidup di server
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...body, max_tokens: 1024 }),
  });

  return new Response(upstream.body, {                // teruskan stream apa adanya
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

Di versi lengkap saya tambahkan tiga pengaman yang sebaiknya kamu pertahankan:

- **Whitelist model** — supaya orang tidak memaksa model termahal lewat request palsu.
- **Batas panjang percakapan** — menolak payload raksasa.
- **`max_tokens`** — plafon biaya per balasan.

Frontend tinggal memanggil `/api/chat` tanpa header Authorization sama sekali.

---

## 8. Deploy ke Cloudflare Pages

1. Push folder ini ke GitHub.
2. Buka Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Pilih repo. Build command: **kosongkan**. Output directory: **`/`** (root).
4. Setelah deploy pertama, masuk Settings → Variables and Secrets → tambahkan **Secret**:
   - Nama: `GROQ_API_KEY`
   - Value: `gsk_...`
5. Deploy ulang (Retry deployment) supaya secret terbaca.

Situsmu hidup di `namaproject.pages.dev`, plus `/api/chat` yang aman. Custom domain gratis lewat tab Custom domains.

Alternatif: **Netlify** (pakai `netlify/functions/chat.js`, sintaks sedikit beda) atau **Vercel** (`api/chat.js`). GitHub Pages **tidak bisa** dipakai untuk bagian proxy karena hanya melayani file statis — di sana kamu hanya bisa mode bring-your-own-key.

---

## 9. Menjalankan model lokal (bonus, offline)

Ollama menyediakan API yang OpenAI-compatible, dan di Android bisa dijalankan lewat Termux ([panduan Android 2026](https://www.ainomam.com/post/run-ollama-locally-on-android-2026)).

```bash
# di Termux
pkg update && pkg install ollama
ollama serve &          # jalan di http://localhost:11434
ollama pull qwen2.5:1.5b
```

Lalu di `app.js` ganti endpoint saja:

```js
const DIRECT_ENDPOINT = 'http://localhost:11434/v1/chat/completions';
// model: 'qwen2.5:1.5b', Authorization tidak diperlukan
```

Realistis: model 1–3B jalan lumayan di HP kelas menengah; 7B ke atas butuh RAM 8 GB+ dan tetap lambat. Bagus untuk belajar dan privasi, bukan untuk produksi.

---

## 10. Langkah lanjutan

Kalau dasar di atas sudah jalan, ini urutan pengembangan yang masuk akal:

1. **Tombol stop** — simpan `AbortController`, panggil `controller.abort()` saat diklik.
2. **Simpan riwayat** — `localStorage.setItem('chat', JSON.stringify(history))`, muat lagi saat halaman dibuka. (Di demo ini sengaja in-memory karena preview iframe memblokir storage.)
3. **Multi-percakapan** — array of chats, sidebar untuk berpindah.
4. **Markdown lengkap** — pakai `marked` + `DOMPurify`. Jangan pernah `innerHTML` mentah dari output model.
5. **Rate limit di proxy** — Cloudflare KV untuk hitung request per IP.
6. **RAG sederhana** — sisipkan potongan dokumenmu ke system prompt agar bot menjawab dari datamu sendiri.
7. **Function calling** — biar bot bisa memanggil API lain (cuaca, database) sebelum menjawab.

## Kesalahan umum

| Gejala | Penyebab |
| --- | --- |
| `401 Invalid API Key` | Key salah, atau ada spasi/newline ikut ter-copy |
| `429 Too Many Requests` | Kena rate limit free tier, tunggu atau ganti model kecil |
| Jawaban muncul sekaligus | Lupa `stream: true`, atau proxy menunggu `await res.text()` |
| Bot lupa konteks | Riwayat tidak dikirim ulang, atau ter-slice terlalu pendek |
| CORS error | Memanggil API dari browser ke host yang tidak mengizinkan — pakai proxy |
| Key bocor | Key ditulis di file JS yang ikut ter-deploy |
