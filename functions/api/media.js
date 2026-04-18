// functions/api/media.js
// Cloudflare Pages Function — returns a JSON list of all media in your R2 bucket
// Binds to an R2 bucket called MEDIA_BUCKET (configured in Cloudflare dashboard)

export async function onRequest(context) {
  const { env } = context;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60', // cache for 1 minute
  };

  try {
    // List all objects in the R2 bucket
    const listed = await env.MEDIA_BUCKET.list();

    // Build public URLs for each object.
    // Objects are served via the public R2 domain you configure in the dashboard,
    // OR through a custom domain you connect to the bucket.
    // Replace YOUR_R2_PUBLIC_URL with your actual public bucket URL.
    // Example: https://pub-abc123.r2.dev  (found in R2 bucket settings → Public access)
    const R2_PUBLIC_URL = 'https://pub-82a2a1ea24834eadb78b508e039bafba.r2.dev';

    const items = listed.objects.map(obj => {
      const name = obj.key;
      const ext = name.split('.').pop().toLowerCase();
      const isVideo = ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext);

      // Optional: parse caption from filename — e.g. "2024-Penang Trip.jpg" → "Penang Trip"
      const caption = name
        .replace(/\.[^.]+$/, '')           // remove extension
        .replace(/^\d{4}[-_]?/, '')        // remove leading year
        .replace(/[-_]/g, ' ')             // dashes to spaces
        .trim();

      return {
        key: name,
        name: name,
        caption: caption || name,
        url: `${R2_PUBLIC_URL}/${name}`,
        isVideo,
        size: obj.size,
        uploaded: obj.uploaded,
      };
    });

    // Sort by upload date, newest first
    items.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));

    return new Response(JSON.stringify(items), { headers });
  } catch (err) {
    console.error('R2 list error:', err);
    return new Response(JSON.stringify([]), { headers });
  }
}
