// functions/api/guestbook.js
// Cloudflare Pages Function — handles GET and POST for guestbook messages
// Binds to a KV namespace called GUESTBOOK (configured in Cloudflare dashboard)

export async function onRequest(context) {
  const { request, env } = context;

  // Allow requests from your own domain only
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // GET — return all messages
  if (request.method === 'GET') {
    try {
      const raw = await env.GUESTBOOK.get('messages');
      const messages = raw ? JSON.parse(raw) : [];
      return new Response(JSON.stringify(messages), { headers });
    } catch (err) {
      return new Response(JSON.stringify([]), { headers });
    }
  }

  // POST — add a new message
  if (request.method === 'POST') {
    try {
      const body = await request.json();

      // Basic validation
      const name = String(body.name || 'Anonymous').slice(0, 50);
      const text = String(body.t || '').slice(0, 500);
      if (!text.trim()) {
        return new Response(JSON.stringify({ error: 'Empty message' }), { status: 400, headers });
      }

      const now = new Date();
      const time = now.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' })
        + ' ' + now.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

      const msg = { name, t: text, time };

      // Read existing, append, write back
      const raw = await env.GUESTBOOK.get('messages');
      const messages = raw ? JSON.parse(raw) : [];
      messages.push(msg);

      // Keep last 500 messages maximum
      if (messages.length > 500) messages.splice(0, messages.length - 500);

      await env.GUESTBOOK.put('messages', JSON.stringify(messages));

      return new Response(JSON.stringify(msg), { status: 201, headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Server error' }), { status: 500, headers });
    }
  }

  return new Response('Method not allowed', { status: 405, headers });
}
