// functions/api/media.js
// Cloudflare Pages Function — serves media list AND individual files from R2.
//
// HOW IT WORKS:
//   GET /api/media          → returns JSON list of all files in your R2 bucket
//   GET /api/media?key=foo  → streams that specific file directly from R2
//   GET /api/media?debug=1  → shows diagnostics (open in browser to troubleshoot)
//
// No public R2 URL is needed. Files are piped through this Worker,
// which also avoids all CORS issues.
//
// REQUIRED BINDING (Cloudflare dashboard → Pages → Settings → Bindings):
//   Type: R2 Bucket  |  Variable name: MEDIA_BUCKET  |  Bucket: your-bucket-name

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ── DEBUG: visit /api/media?debug=1 in your browser ──
  if (url.searchParams.get('debug') === '1') {
    const info = { binding: !!env.MEDIA_BUCKET, objects: [], error: null };
    try {
      if (!env.MEDIA_BUCKET) {
        info.error = 'MEDIA_BUCKET binding not found. Go to Pages → Settings → Bindings and add an R2 binding with variable name MEDIA_BUCKET.';
      } else {
        const listed = await env.MEDIA_BUCKET.list();
        info.objectCount = listed.objects.length;
        info.truncated = listed.truncated;
        info.objects = listed.objects.map(o => ({ key: o.key, size: o.size }));
      }
    } catch (e) {
      info.error = e.message;
    }
    return new Response(JSON.stringify(info, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── SERVE FILE: GET /api/media?key=filename.jpg ──
  const key = url.searchParams.get('key');
  if (key) {
    if (!env.MEDIA_BUCKET) {
      return new Response('MEDIA_BUCKET binding missing', { status: 500, headers: corsHeaders });
    }
    try {
      const ext = key.split('.').pop().toLowerCase();
      const mimeTypes = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
        heic: 'image/heic', heif: 'image/heif',
        mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
        avi: 'video/x-msvideo', mkv: 'video/x-matroska',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';

      // Support byte-range requests so video scrubbing works
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) {
        const object = await env.MEDIA_BUCKET.get(key);
        if (!object) return new Response('Not found', { status: 404, headers: corsHeaders });
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        const total = object.size;
        const start = match[1] ? parseInt(match[1]) : 0;
        const end = match[2] ? parseInt(match[2]) : total - 1;
        const rangeObj = await env.MEDIA_BUCKET.get(key, {
          range: { offset: start, length: end - start + 1 },
        });
        if (!rangeObj) return new Response('Range not satisfiable', { status: 416, headers: corsHeaders });
        return new Response(rangeObj.body, {
          status: 206,
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      // Normal full-file response
      const object = await env.MEDIA_BUCKET.get(key);
      if (!object) return new Response('Not found', { status: 404, headers: corsHeaders });
      return new Response(object.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': object.size ? String(object.size) : '',
          'Cache-Control': 'public, max-age=86400',
          'ETag': object.etag || '',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // ── LIST: GET /api/media ──
  if (!env.MEDIA_BUCKET) {
    return new Response(JSON.stringify([]), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Paginate — R2 list() returns at most 1000 per call
    let allObjects = [];
    let cursor;
    do {
      const listed = await env.MEDIA_BUCKET.list({ cursor, limit: 1000 });
      allObjects = allObjects.concat(listed.objects);
      cursor = listed.truncated ? listed.cursor : null;
    } while (cursor);

    const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'heif']);
    const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);

    // ── Parse a date out of filenames like:
    //   "1. 9 April 2025.jpg"    → 9 Apr 2025
    //   "2. 11 April 2025.jpg"   → 11 Apr 2025
    //   "9 April 2025.jpg"       → 9 Apr 2025
    //   "April 9 2025.jpg"       → 9 Apr 2025
    //   "2025-04-09.jpg"         → 9 Apr 2025
    //   "09-04-2025.jpg"         → 9 Apr 2025
    const MONTHS = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    function parseDateFromFilename(filename) {
      const base = filename
        .replace(/\.[^.]+$/, '')   // remove extension
        .replace(/^\d+\.\s*/, '')  // remove "1. " prefix
        .trim();

      // "9 April 2025" or "11 April 2025"
      let m = base.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
      if (m) {
        const month = MONTHS[m[2].toLowerCase()];
        if (month) return new Date(parseInt(m[3]), month - 1, parseInt(m[1]));
      }

      // "April 9 2025"
      m = base.match(/([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})/);
      if (m) {
        const month = MONTHS[m[1].toLowerCase()];
        if (month) return new Date(parseInt(m[3]), month - 1, parseInt(m[2]));
      }

      // "2025-04-09" or "2025/04/09"
      m = base.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));

      // "09-04-2025" or "09/04/2025"
      m = base.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));

      return null;
    }

    function makeCaption(filename) {
      return filename
        .replace(/\.[^.]+$/, '')   // remove extension
        .replace(/^\d+\.\s*/, '')  // remove "1. " prefix
        .replace(/(\d)\.(\d{2})(am|pm)/gi, '$1:$2$3') // time X.XX -> X:XX
        .replace(/[-_]+/g, ' ')    // dashes/underscores → spaces
        .replace(/\s+/g, ' ')
        .trim();
    }

    const items = allObjects
      .filter(obj => {
        if (obj.key.startsWith('.') || obj.key.endsWith('/')) return false;
        const ext = obj.key.split('.').pop().toLowerCase();
        return IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext);
      })
      .map(obj => {
        const name = obj.key;
        const ext = name.split('.').pop().toLowerCase();
        const isVideo = VIDEO_EXTS.has(ext);
        const caption = makeCaption(name);
        const parsedDate = parseDateFromFilename(name);

        return {
          key: name,
          name: name,
          caption: caption || name,
          url: `/api/media?key=${encodeURIComponent(name)}`,
          isVideo,
          size: obj.size,
          uploaded: obj.uploaded,
          sortDate: parsedDate ? parsedDate.toISOString() : null,
          sortIndex: parseInt(name.match(/^(\d+)\./)?.[1] ?? '999999'),
        };
      });

    // Sort oldest → newest by filename date.
    // Falls back to numeric prefix ("1.", "2."), then R2 upload time.
    items.sort((a, b) => {
      if (a.sortDate && b.sortDate) return new Date(b.sortDate) - new Date(a.sortDate);
      if (a.sortDate) return 1;
      if (b.sortDate) return -1;
      if (a.sortIndex !== b.sortIndex) return b.sortIndex - a.sortIndex;
      return new Date(b.uploaded) - new Date(a.uploaded);
    });

    return new Response(JSON.stringify(items), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}