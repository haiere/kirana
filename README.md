<div align="center">

# Bikin App Chatbot AI dari Nol

**HTML · CSS · JS · Deploy Gratis**

Tutorial praktis: dari file kosong sampai chatbot online di domainmu sendiri — tanpa framework, tanpa server sendiri, tanpa biaya.

Semua kode di repo ini bisa langsung dipakai.

<br />

<img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5" />
<img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3" />
<img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="Vanilla JavaScript" />
<img src="https://img.shields.io/badge/Deploy-Cloudflare_Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare Pages" />
<img src="https://img.shields.io/badge/No_Build_Step-4B0082?style=flat-square" alt="No build step" />

<br />

<img src="https://img.shields.io/badge/Streaming-SSE-3B82F6?style=flat-square" alt="Streaming SSE" />
<img src="https://img.shields.io/badge/Provider-OpenAI_Compatible-7FD8CB?style=flat-square" alt="OpenAI-compatible" />
<img src="https://img.shields.io/badge/Proxy-Serverless-B4788C?style=flat-square" alt="Serverless proxy" />

</div>

---

<div align="center">

### Yang akan kamu bangun

<table>
<tr>
<td width="50%" valign="top">

- UI chat responsif dengan dark/light mode — HTML + CSS + JS murni
- Streaming jawaban token-per-token dengan efek "mengetik"
- Riwayat percakapan supaya bot ingat konteks
- Proxy serverless supaya API key tidak bocor ke publik
- Deploy ke Cloudflare Pages

</td>
<td width="50%" valign="top">

**Yang tidak dibutuhkan**

- Tidak ada framework
- Tidak ada server sendiri
- Tidak ada biaya
- Tidak ada `npm install`
- Tidak ada build step

</td>
</tr>
</table>

</div>

---

<div align="center">

### Daftar Isi

<table>
<tr>
<td valign="top" width="33%">

**Dasar**

- [Konsep dasar](#1-konsep-dasar-chatbot-itu-cuma-http-post)
- [Pilih provider](#2-pilih-provider-dan-ambil-api-key)
- [Struktur project](#3-struktur-project)
- [API minimal](#4-panggilan-api-paling-minimal-versi-non-streaming)

</td>
<td valign="top" width="33%">

**Inti**

- [Streaming](#5-streaming-bikin-jawaban-muncul-huruf-demi-huruf)
- [Riwayat percakapan](#6-riwayat-percakapan-memori-bot)
- [Keamanan](#7-keamanan-jangan-taruh-api-key-di-javascript-frontend)
- [Deploy](#8-deploy-ke-cloudflare-pages)

</td>
<td valign="top" width="33%">

**Lanjutan**

- [Model lokal](#9-menjalankan-model-lokal-bonus-offline)
- [Langkah lanjutan](#10-langkah-lanjutan)
- [Kesalahan umum](#kesalahan-umum)

</td>
</tr>
</table>

</div>

---

## 1. Konsep dasar: chatbot itu cuma HTTP POST

> Semua API model AI modern — OpenAI, Groq, Together, OpenRouter, bahkan Ollama lokal — memakai bentuk yang sama. Namanya **OpenAI-compatible chat completions**.

```http
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

Tiga hal penting

# Poin Penjelasan
1 Model tidak punya memori Setiap request kamu kirim ulang seluruh riwayat. Itulah kenapa di app.js ada array history — array itulah memorinya.
2 role: system Kepribadian dan aturan bot. Ini "otak" produkmu.
3 stream: true Server membalas potongan demi potongan (SSE), bukan menunggu jawaban penuh. Wajib kalau mau terasa seperti ChatGPT.

[!TIP]
Karena bentuknya seragam, ganti provider cukup ganti URL + nama model.

---

2. Pilih provider dan ambil API key

Provider Kelebihan Catatan
Groq Gratis tanpa kartu kredit, tercepat Free tier dibatasi rate limit per menit/hari — dokumentasi model Groq
OpenAI Kualitas tertinggi Bayar per token, butuh kartu — dokumentasi model
OpenRouter Satu key untuk banyak model Ada beberapa model gratis
Ollama Jalan lokal, offline, gratis Butuh RAM besar

Untuk belajar, pakai Groq

Model ID yang tersedia saat ini antara lain:

· llama-3.3-70b-versatile
· llama-3.1-8b-instant
· openai/gpt-oss-120b
· qwen/qwen3.8-27b

Endpoint dasar: https://api.groq.com/openai/v1

[!NOTE]
Free tier Groq tidak memakai sistem kredit — hanya dibatasi rate limit. Lihat Price Per Token.

Daftar di console.groq.com, buat API key, simpan. Key diawali gsk_.

---

3. Struktur project

```text
chatbot-ai/
├── index.html            UI
├── styles.css            tampilan + dark mode
├── app.js                logika chat + streaming
└── functions/
    └── api/
        └── chat.js       proxy serverless (Cloudflare Pages Function)
```

[!IMPORTANT]
Tidak ada build step. Tidak ada npm install. Buka index.html di browser, jalan.

---

4. Panggilan API paling minimal (versi non-streaming)

Sebelum masuk streaming, pahami versi sederhananya dulu.

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

5. Streaming: bikin jawaban muncul huruf demi huruf

Dengan stream: true, server mengirim Server-Sent Events: baris-baris teks berformat data: {...}, ditutup data: [DONE].

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

Dua jebakan yang paling sering bikin pemula bingung

<table>
<tr>
<td width="50%" valign="top">

Jangan lupa buffer

Satu chunk jaringan bisa berhenti di tengah JSON. Kalau kamu langsung JSON.parse per chunk, sesekali akan error.

</td>
<td width="50%" valign="top">

Wajib pakai { stream: true }

decoder.decode(value, { stream: true }) wajib pakai { stream: true }. Kalau tidak, karakter multi-byte (emoji, huruf beraksen) bisa rusak.

</td>
</tr>
</table>

[!TIP]
Lihat implementasi lengkapnya di app.js → fungsi streamChat.

---

6. Riwayat percakapan (memori bot)

```js
let history = [];

// saat user kirim
history.push({ role: 'user', content: text });

// saat jawaban selesai
history.push({ role: 'assistant', content: reply });

// saat mengirim ke API — system prompt selalu di depan, riwayat dipotong
messages: [{ role: 'system', content: systemPrompt }, ...history.slice(-20)]
```

[!WARNING]
slice(-20) itu penting. Percakapan panjang = token banyak = lambat dan mahal, dan akhirnya menabrak batas konteks model. Batasi jumlah pesan, atau ringkas pesan-pesan lama jadi satu ringkasan.

---

7. Keamanan: JANGAN taruh API key di JavaScript frontend

Kode frontend bisa dibaca siapa saja lewat View Source. Kalau kamu menaruh key di app.js lalu deploy, key itu publik — orang lain bisa memakainya sampai kuotamu habis.

Aturannya

Skenario Boleh taruh key di frontend?
Uji coba pribadi di laptop sendiri Boleh — key di input form (seperti mode Pengaturan di demo ini) masih oke
Begitu dipublikasikan Tidak — key wajib pindah ke server

Solusinya: proxy serverless

File functions/api/chat.js di repo ini adalah Cloudflare Pages Function. Taruh file di path itu, dan setelah deploy ia otomatis jadi endpoint POST /api/chat.

```text
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

Tiga pengaman yang sebaiknya kamu pertahankan

Pengaman Tujuan
Whitelist model Supaya orang tidak memaksa model termahal lewat request palsu
Batas panjang percakapan Menolak payload raksasa
max_tokens Plafon biaya per balasan

[!TIP]
Frontend tinggal memanggil /api/chat tanpa header Authorization sama sekali.

---

8. Deploy ke Cloudflare Pages

1. Push folder ini ke GitHub
2. Buka Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. Pilih repo. Build command: kosongkan. Output directory: / (root)
4. Setelah deploy pertama, masuk Settings → Variables and Secrets → tambahkan Secret:
   · Nama: GROQ_API_KEY
   · Value: gsk_...
5. Deploy ulang (Retry deployment) supaya secret terbaca

Situsmu hidup di namaproject.pages.dev, plus /api/chat yang aman. Custom domain gratis lewat tab Custom domains.

Alternatif hosting

Platform File proxy Catatan
Cloudflare Pages functions/api/chat.js Rekomendasi utama
Netlify netlify/functions/chat.js Sintaks sedikit beda
Vercel api/chat.js Sintaks sedikit beda
GitHub Pages — Tidak bisa — hanya melayani file statis. Di sana kamu hanya bisa mode bring-your-own-key

---

9. Menjalankan model lokal (bonus, offline)

Ollama menyediakan API yang OpenAI-compatible, dan di Android bisa dijalankan lewat Termux — panduan Android 2026.

```bash
# di Termux
pkg update && pkg install ollama
ollama serve &          # jalan di http://localhost:11434
ollama pull qwen2.5:1.5b
```

Lalu di app.js ganti endpoint saja:

```js
const DIRECT_ENDPOINT = 'http://localhost:11434/v1/chat/completions';
// model: 'qwen2.5:1.5b', Authorization tidak diperlukan
```

[!NOTE]
Realistis: model 1–3B jalan lumayan di HP kelas menengah; 7B ke atas butuh RAM 8 GB+ dan tetap lambat. Bagus untuk belajar dan privasi, bukan untuk produksi.

---

10. Langkah lanjutan

Kalau dasar di atas sudah jalan, ini urutan pengembangan yang masuk akal.

# Langkah Detail
1 Tombol stop Simpan AbortController, panggil controller.abort() saat diklik
2 Simpan riwayat localStorage.setItem('chat', JSON.stringify(history)), muat lagi saat halaman dibuka. (Di demo ini sengaja in-memory karena preview iframe memblokir storage.)
3 Multi-percakapan Array of chats, sidebar untuk berpindah
4 Markdown lengkap Pakai marked + DOMPurify. Jangan pernah innerHTML mentah dari output model
5 Rate limit di proxy Cloudflare KV untuk hitung request per IP
6 RAG sederhana Sisipkan potongan dokumenmu ke system prompt agar bot menjawab dari datamu sendiri
7 Function calling Biar bot bisa memanggil API lain (cuaca, database) sebelum menjawab

---

Kesalahan umum

Gejala Penyebab
401 Invalid API Key Key salah, atau ada spasi/newline ikut ter-copy
429 Too Many Requests Kena rate limit free tier — tunggu atau ganti model kecil
Jawaban muncul sekaligus Lupa stream: true, atau proxy menunggu await res.text()
Bot lupa konteks Riwayat tidak dikirim ulang, atau ter-slice terlalu pendek
CORS error Memanggil API dari browser ke host yang tidak mengizinkan — pakai proxy
Key bocor Key ditulis di file JS yang ikut ter-deploy

---

<div align="center">
<sub>
Tutorial praktis · Chatbot AI dari nol dengan HTML, CSS, dan JavaScript.<br />
Tanpa framework, tanpa server sendiri, tanpa biaya.
</sub>
</div>
