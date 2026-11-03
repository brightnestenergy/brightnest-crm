# Brightnest Energy CRM

Full Solar & Battery CRM with quote generator, inventory, and customer portal preview. Auto-syncs leads from the Google Sheet.

## Features
- Full pipeline Kanban
- Dashboard + filters (Too Far, status, search)
- Lead drawer with status, GreenSketch, notes
- **Quote Generator** — professional proposals with pricing, STC rebate, printable/PDF
- **Inventory** — product catalogue, stock levels, low-stock alerts, margin
- **Customer Portal** — preview of active customer projects
- Sync from Google Sheet
- Auto Too Far + auto-lost after 14 days

## Local Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. SQL Editor → paste and run `supabase/schema.sql`
3. Authentication → Users → Add user (email + password)
4. Copy `.env.example` to `.env` and fill in your Supabase URL + anon key
5. Run:
   ```bash
   npm install
   npm run dev
   ```

## Deploy to Netlify (free) — Step by Step

### 1. Push to GitHub
```bash
cd brightnest-crm
git init
git add .
git commit -m "Brightnest Energy CRM"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/brightnest-crm.git
git branch -M main
git push -u origin main
```

### 2. Deploy on Netlify
1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. Choose GitHub and select your `brightnest-crm` repo
3. Build settings (usually auto-detected from netlify.toml):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click **Deploy site**

### 3. Add Environment Variables
After the first deploy:
1. Site settings → **Environment variables** → Add:
   - Key: `VITE_SUPABASE_URL` → Value: your Supabase project URL
   - Key: `VITE_SUPABASE_ANON_KEY` → Value: your Supabase anon key
2. Trigger a new deploy (Deploys → Trigger deploy)

### 4. Finish Setup
- Create your first user in Supabase → Authentication → Users
- Open your Netlify URL and sign in
- Click **Sync Sheet** to pull leads

`netlify.toml` is already included so SPA routing works.

## Quote Generator
Open any lead → **Create Quote**. Adjust system size, panels, inverter, battery, costs and STC rebate. Click **Print / PDF**.

## Inventory
Go to the Inventory tab to view stock, margins and low-stock alerts. Add products as needed.

## Customer Portal
The Customer Portal tab shows active customers. Magic-link login can be added later via Supabase Auth.
