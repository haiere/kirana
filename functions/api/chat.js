/**
 * Cloudflare Pages Function — proxy aman ke API model.
 * File ini otomatis jadi endpoint POST /api/chat setelah di-deploy.
 * API key TIDAK pernah dikirim ke browser; disimpan sebagai secret di dashboard Pages.
 *
 * Set di Cloudflare: Settings > Variables and Secrets > Add (Secret)
 *   GROQ_API_KEY = gsk_xxxxx
 */

const UPSTREAM = 'https://api.groq.com/openai/v1/chat/completions';
const ALLOWED_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b',
]);

export async function onRequestPost({ request, env }) {
  if (!env.GROQ_API_KEY) {
    return json({ error: 'GROQ_API_KEY belum diset di environment' }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body harus JSON' }, 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return json({ error: 'messages wajib diisi' }, 400);
  }
  // Batasi ukuran supaya tagihan/rate-limit tidak jebol.
  if (JSON.stringify(messages).length > 24000) {
    return json({ error: 'Percakapan terlalu panjang' }, 413);
  }

  const model = ALLOWED_MODELS.has(body.model) ? body.model : 'llama-3.1-8b-instant';

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.slice(-21),
      stream: body.stream !== false,
      temperature: Math.min(Number(body.temperature) || 0.7, 1.5),
      max_tokens: 1024,
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    return json({ error: 'Upstream error', detail: detail.slice(0, 500) }, upstream.status);
  }

  // Teruskan stream SSE apa adanya ke browser.
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
