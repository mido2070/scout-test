<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# CodeScout Pro — Zoning & Construction Regulation Analysis Engine

Intelligent AI-powered Urban Planning, Zoning, and Real-Estate Development Analysis Engine.

Built with React 19, TypeScript, Vite, Google Gemini API, and Cloudflare Workers.

---

## 🚀 Running Locally

**Prerequisites:** Node.js 20+

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your API Key (Optional for local testing):**
   Copy `.env.example` to `.env.local` and set your key:
   ```bash
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *(Alternatively, you can click the **API Key (BYOK)** button directly inside the app interface).*

3. **Start the local development server:**
   ```bash
   npm run dev
   ```
   Vite will serve the frontend and handle `/api/*` endpoints via built-in dev middleware.

---

## ☁️ Deploying to Cloudflare Workers

CodeScout is configured for **Cloudflare Workers with Static Assets** (free plan compatible).

1. **Build the production SPA assets:**
   ```bash
   npm run build
   ```
   This compiles TypeScript and outputs the production bundle to `./dist`.

2. **Deploy with Wrangler:**
   ```bash
   npx wrangler deploy
   ```

3. **Configure your server-side Gemini Secret (Optional):**
   If you wish to provide a global server-side API key instead of requiring user BYOK:
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```
   *(Enter your Gemini API key when prompted).*

---

## 🔒 Security & Bring-Your-Own-Key (BYOK)

- **Zero Bundle Exposure:** The frontend client bundle never contains or leaks Google API keys.
- **Serverless API Routes:** All AI queries go through protected `/api/*` routes (`/api/analyze-zoning`, `/api/analyze-policy`, `/api/chat-assistant`, `/api/refine-policy`, `/api/translate-report`).
- **BYOK Support:** Users can enter their personal Gemini API key in the top navigation bar. The key is stored exclusively in their browser's LocalStorage and transmitted over HTTPS in the `x-gemini-api-key` header.
- **Rate Limiting:** Built-in IP rate limiter protects against excessive traffic on Cloudflare Free.
