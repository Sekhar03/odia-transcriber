# Cloudflare Pages Deployment Guide 🌐

This guide outlines how to deploy the React frontend of the **OdiaTube AI Transcriber** application to **Cloudflare Pages** and connect it to your backend API.

---

## ⚡ Why Cloudflare Pages?
Cloudflare Pages is a highly performant, globally distributed hosting platform for static frontends. Deploying the frontend to Cloudflare Pages while keeping the Express backend on Vercel or a VPS ensures extremely fast initial page load times and global scalability.

---

## 🚀 Step 1: Deploy Frontend to Cloudflare Pages

### Option A: Via GitHub Integration (Recommended)
1. Commit all your latest changes and push to GitHub:
   ```bash
   git add .
   git commit -m "docs: setup env file and cloudflare guide"
   git push
   ```
2. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com/).
3. Navigate to **Workers & Pages** -> **Pages** -> **Connect to Git**.
4. Select your GitHub repository.
5. In the **Build configuration** settings:
   * **Framework preset:** `Vite`
   * **Build command:** `npm run build`
   * **Build output directory:** `client/dist`
   * **Root directory:** `client` (specify `/client` if it asks where your frontend is located).
6. Click **Save and Deploy**.

### Option B: Deploying via Wrangler CLI
If you want to deploy directly from your local terminal:
1. Install Wrangler globally:
   ```bash
   npm install -g wrangler
   ```
2. Build the production React frontend:
   ```bash
   npm run build
   ```
3. Deploy the build directory to Cloudflare Pages:
   ```bash
   wrangler pages deploy client/dist --project-name=odia-transcriber
   ```

---

## 🔌 Step 2: Configure Environment Variables on Cloudflare

To link your Cloudflare Pages frontend to your backend API, set up environment variables in your Cloudflare project dashboard:

1. In the Cloudflare Dashboard, go to your **Pages project**.
2. Navigate to **Settings** -> **Environment variables**.
3. Under **Production** (and optionally Preview), click **Add variables** and add:
   * **`VITE_API_BASE_URL`**: Set this to your backend API URL (e.g., `https://your-app.vercel.app` or your backend VPS address).
4. Save the variables.
5. Trigger a new deployment (Redeploy) for the changes to take effect.

---

## 🔒 Step 3: Configure CORS on Backend (If needed)
Because your frontend will run on a Cloudflare domain (e.g., `*.pages.dev`) and query a separate backend domain (e.g., `*.vercel.app`), Cross-Origin Resource Sharing (CORS) must be enabled on the backend server.

The Express server (`server.js`) is already pre-configured to handle CORS requests from any origin:
```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});
```
No additional backend changes are required!
