# Deployment Guide — iPad Home on Cloudflare

## Why Cloudflare Pages?

Cloudflare Pages is the best free host for this project in 2026:

| Feature | Cloudflare Pages |
|---|---|
| Bandwidth | **Unlimited** (no cap, no overage) |
| Requests | Unlimited static, 100k/day Functions (free) |
| Global CDN | 300+ edge locations worldwide |
| Custom domain | Free (including SSL) |
| Media storage (R2) | 10 GB free, no egress fees |
| Message storage (KV) | 100k reads + 1k writes/day free |
| Cost | **$0/month** for this use case |

The project uses three Cloudflare services:
- **Pages** — hosts your HTML/CSS/JS files
- **R2** — stores your photos and videos (like S3, no egress fees)
- **KV** — stores guestbook messages (key-value database, globally synced)

---

## What's in Your Project Folder

After downloading, your folder should look like this:

```
ipad-home/
├── index.html              ← main website file
├── wrangler.toml           ← Cloudflare config
├── functions/
│   └── api/
│       ├── guestbook.js    ← KV API for messages
│       └── media.js        ← R2 API for photo/video list
├── icon-messages.png       ← (add your own drawings here)
├── icon-photos.png
├── icon-notes.png
└── icon-tracker.png
```

---

## Step 1 — Create a Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up for free.
2. You don't need a domain to get started — Cloudflare gives you a free `*.pages.dev` subdomain.

---

## Step 2 — Create a KV Namespace (for guestbook messages)

KV stores your guestbook messages in a globally synced database.

1. In the Cloudflare dashboard, go to **Workers & Pages → KV**.
2. Click **Create namespace**.
3. Name it `ipad-home-guestbook` (or anything you like).
4. Click **Add** — you'll see a namespace ID like `abc123def456...`
5. **Copy that ID** — you'll need it in a moment.

**Free tier:** 100,000 reads + 1,000 writes per day. Your guestbook won't come close to this.

---

## Step 3 — Create an R2 Bucket (for photos and videos)

R2 stores your actual media files.

1. In the Cloudflare dashboard, go to **R2 Object Storage**.
2. Click **Create bucket**.
3. Name it `ipad-home-media` (exactly as written in `wrangler.toml`).
4. Leave the region as default → **Create bucket**.

### Enable public access for your bucket

This lets your website load photos/videos directly:

1. Click on your new bucket → **Settings** tab.
2. Scroll to **Public access** → click **Allow Access**.
3. You'll get a public URL like: `https://pub-abc123.r2.dev`
4. **Copy this URL** — you'll paste it into `functions/api/media.js`.

**Free tier:** 10 GB storage, no charge for downloads (unlike AWS S3).

---

## Step 4 — Upload Your Photos and Videos to R2

1. Open your R2 bucket in the Cloudflare dashboard.
2. Click **Upload** → drag and drop your photos and videos.
3. Supported formats: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.mp4`, `.mov`, `.webm`
4. **Naming tip:** Name your files descriptively — the filename becomes the caption in the gallery.
   - `Penang-Trip-2024.jpg` → caption: "Penang Trip 2024"
   - `Cooking-roti-canai.mp4` → caption: "Cooking roti canai"

---

## Step 5 — Edit the Two Config Values in Your Files

### In `wrangler.toml`

Open the file and replace the placeholder with your KV namespace ID:

```toml
[[kv_namespaces]]
binding = "GUESTBOOK"
id = "PASTE_YOUR_KV_ID_HERE"   ← replace this with your actual ID (from Step 2)
```

### In `functions/api/media.js`

Open the file and replace the R2 public URL placeholder:

```javascript
const R2_PUBLIC_URL = 'YOUR_R2_PUBLIC_URL';
```

Replace with the URL from Step 3, e.g.:

```javascript
const R2_PUBLIC_URL = 'https://pub-abc123.r2.dev';
```

---

## Step 6 — Deploy to Cloudflare Pages

There are two ways. **Option A is easiest** if you're not a developer.

### Option A — Upload via Dashboard (no Git required)

1. In Cloudflare dashboard, go to **Workers & Pages → Pages**.
2. Click **Create → Upload assets**.
3. Name your project (e.g. `ipad-home`).
4. Drag your **entire `ipad-home` folder** into the upload area.
5. Click **Deploy site**.
6. Your site is live at something like `https://ipad-home.pages.dev` 🎉

### Option B — GitHub (auto-deploys on every change)

1. Install [Git](https://git-scm.com) on your computer.
2. Create a free account at [github.com](https://github.com).
3. Create a new repository → upload your project files.
4. In Cloudflare: **Pages → Create → Connect to Git**.
5. Select your GitHub repository.
6. Build settings:
   - Build command: *(leave blank)*
   - Build output directory: `/`
7. Click **Save and Deploy**.

From now on, every time you push a change to GitHub, Cloudflare redeploys automatically within ~30 seconds.

---

## Step 7 — Connect KV and R2 to Your Pages Project

This is the step that links your database and storage to your website.

1. In Cloudflare, go to **Workers & Pages → your Pages project**.
2. Click the **Settings** tab → **Bindings**.
3. Add a **KV namespace** binding:
   - Variable name: `GUESTBOOK`
   - KV namespace: select `ipad-home-guestbook`
4. Add an **R2 bucket** binding:
   - Variable name: `MEDIA_BUCKET`
   - R2 bucket: select `ipad-home-media`
5. Click **Save** → click **Deployments → Retry deployment** (or push a new commit if using GitHub).

---

## Step 8 — Add to iPad Home Screen

1. Open Safari on your iPad.
2. Navigate to your site URL (e.g. `https://ipad-home.pages.dev`).
3. Tap the **Share** button (box with arrow pointing up).
4. Tap **Add to Home Screen**.
5. Name it whatever you like → tap **Add**.

The site now opens full-screen with no browser UI, exactly like a native app.

---

## Step 9 (Optional) — Custom Domain

If you own a domain (e.g. `myname.com`), you can use it for free:

1. In Cloudflare Pages → your project → **Custom domains**.
2. Click **Set up a custom domain** → enter your domain.
3. If your domain's DNS is already on Cloudflare, it connects automatically.
4. If not, Cloudflare will guide you through pointing your domain's nameservers to Cloudflare.

---

## Adding More Photos Later

Just upload more files to your R2 bucket — no code changes needed:

1. Cloudflare dashboard → R2 → `ipad-home-media`
2. Click **Upload** → drop your new files
3. Refresh your website — new photos appear automatically

---

## Updating Your Icons

Drop your new PNG files into the project folder and re-upload/redeploy:

| File | Used for |
|---|---|
| `icon-messages.png` | Messages app icon |
| `icon-photos.png` | Photos app icon |
| `icon-notes.png` | Notes app icon |
| `icon-tracker.png` | Day tracker widget |

If a PNG is missing, the original hand-drawn SVG shows automatically as a fallback.

---

## Free Tier Limits Summary

| Service | Free Allowance | Your likely usage |
|---|---|---|
| Pages hosting | Unlimited | ✅ Well within |
| Pages Functions | 100k requests/day | ✅ Fine for personal use |
| R2 storage | 10 GB | ✅ ~3,000 photos or ~50 videos |
| R2 Class A ops (writes) | 1M/month | ✅ Fine |
| R2 Class B ops (reads) | 10M/month | ✅ Fine |
| KV reads | 100k/day | ✅ Fine |
| KV writes | 1k/day | ✅ Fine |
| Bandwidth | Unlimited | ✅ No limit |

You will stay on the free tier unless your site gets thousands of daily visitors.

---

## Troubleshooting

**Photos not loading?**
- Check that the R2 bucket has Public Access enabled (Step 3).
- Confirm `R2_PUBLIC_URL` in `functions/api/media.js` matches your bucket's URL exactly (no trailing slash).
- Confirm the R2 binding is set up in Pages Settings → Bindings.

**Guestbook messages not saving?**
- Confirm the KV binding is set up in Pages Settings → Bindings.
- Variable name must be exactly `GUESTBOOK` (case-sensitive).

**Site not updating after changes?**
- If using GitHub: wait ~30 seconds after pushing, then hard-refresh the page.
- If using dashboard upload: make sure you uploaded all files including subfolders.

**Functions not working (404 on /api/...)?**
- Ensure the `functions/` folder was included in your upload.
- The folder structure must be exactly `functions/api/guestbook.js` and `functions/api/media.js`.
