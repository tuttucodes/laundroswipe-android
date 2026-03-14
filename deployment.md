# LaundroSwipe — Complete Deployment Guide
## From your laptop to live on laundroswipe.com

---

## What You Have (Next.js app)

```
laundroswipe/
├── app/                ← Next.js App Router (customer app at /, admin at /admin)
├── components/         ← LaundroApp (main SPA)
├── lib/                ← Supabase client & API (uses env vars)
└── ...
```

- **Customer app:** https://yoursite.com/
- **Admin dashboard:** https://yoursite.com/admin (sign in with the email and password you set in env)
- **Vendor bill:** https://yoursite.com/admin/vendor

**Admin login:** Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your environment (see Step 3).

**Security:** Never commit real credentials to GitHub. Only `.env.example` (placeholders) is safe to commit. Use `.env.local` locally and Vercel Environment Variables in production; both are ignored by git.

---

## STEP 1: Set Up Your Laptop

### Install Git (if not already)

**Windows:**
Download from https://git-scm.com/download/win → install with defaults.

**Mac:**
```bash
xcode-select --install
```

### Install Node.js (if not already)
Download from https://nodejs.org → install the LTS version.

### Verify everything works
Open Terminal (Mac) or Command Prompt / PowerShell (Windows):
```bash
git --version
node --version
npm --version
```
All 3 should show version numbers. If any fails, reinstall that tool.

---

## STEP 2: Create Project Folder

```bash
# Go to your Desktop (or wherever you want)
cd ~/Desktop

# Create project folder
mkdir laundroswipe
cd laundroswipe

# Create admin subfolder
mkdir admin
```

Now **copy the 2 HTML files** into the right places:
- Put the main `index.html` inside `laundroswipe/`
- Put the admin `index.html` inside `laundroswipe/admin/`

Your folder should look like:
```
~/Desktop/laundroswipe/
├── index.html
└── admin/
    └── index.html
```

---

## STEP 3: Add Your Supabase Credentials (Next.js)

1. Go to your Supabase project → **Settings** → **API**
2. Copy your **Project URL** (e.g. `https://xxxx.supabase.co`)
3. Copy your **anon public** key (starts with `eyJ...`)

**Local development:** Create `.env.local` in the project root. **Never commit this file.** Example:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=choose-a-secure-password
```

**Vercel:** In your project → **Settings** → **Environment Variables**, add (use your real values only in Vercel; they are not in git):
- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
- `ADMIN_EMAIL` = email used to log in to /admin
- `ADMIN_PASSWORD` = password for admin (keep strong and private)

No build-time script is needed; Next.js injects public env at build. Admin credentials stay server-side only.

---

## STEP 4: Test Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 and test:
- Onboarding slides → Login / Sign up
- Sign up (general or student) and schedule a pickup
- Token appears after booking; check Orders and Profile
- Admin: http://localhost:3000/admin — use the email and password from your `.env.local` (ADMIN_EMAIL / ADMIN_PASSWORD)
- Vendor bill: http://localhost:3000/admin/vendor — enter token to lookup order

---

## STEP 5: Push to GitHub

### Create GitHub account (if needed)
Go to https://github.com → sign up.

### Create a new repository
1. Go to https://github.com/new
2. Repository name: `laundroswipe`
3. Keep it **Public** or **Private** (your choice)
4. **DON'T** check "Add README" or anything else
5. Click **Create Repository**

### Push your code from Terminal

```bash
# Make sure you're in the project folder
cd ~/Desktop/laundroswipe

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "LaundroSwipe app + admin dashboard"

# Set main branch
git branch -M main

# Connect to GitHub (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/laundroswipe.git

# Push
git push -u origin main
```

If it asks for login, enter your GitHub username and a **Personal Access Token** (not your password):
- Go to GitHub → Settings → Developer Settings → Personal Access Tokens → Generate New Token
- Give it `repo` access → copy the token and use as password

---

## STEP 6: Deploy on Vercel

1. Go to https://vercel.com
2. Click **"Sign Up"** → **Continue with GitHub**
3. Authorize Vercel to access your GitHub
4. Click **"Add New Project"**
5. Find `laundroswipe` in the list → click **Import**
6. Settings:
   - **Framework Preset:** `Other`
   - **Root Directory:** `./` (leave default)
   - **Build Command:** Leave blank
   - **Output Directory:** Leave blank (or `.`)
7. Click **Deploy**

Vercel will give you a URL like `laundroswipe.vercel.app` — test it!

---

## STEP 7: Buy Domain on Namecheap

1. Go to https://www.namecheap.com
2. Search: `laundroswipe.com`
3. Add to cart → checkout → pay (~$9-12/year)
4. After purchase: Dashboard → Domain List → click **Manage**

**Don't change nameservers yet** — do that in Step 8.

---

## STEP 8: Set Up Cloudflare

1. Go to https://dash.cloudflare.com → sign up / log in
2. Click **"Add a Site"** → type `laundroswipe.com` → click **Add Site**
3. Select **Free plan** → Continue
4. Cloudflare gives you **2 nameservers** like:
   ```
   aria.ns.cloudflare.com
   bob.ns.cloudflare.com
   ```
   **Copy these.**

5. Go back to **Namecheap** → Domain List → Manage → **Nameservers**
6. Change to **Custom DNS** → paste the 2 Cloudflare nameservers → Save
7. Wait 1-24 hours for propagation

---

## STEP 9: Connect Domain to Vercel

### In Vercel:
1. Go to your `laundroswipe` project → **Settings** → **Domains**
2. Add: `laundroswipe.com` → click Add
3. Add: `www.laundroswipe.com` → click Add
4. Vercel will show you what DNS records are needed

### In Cloudflare:
Go to your site → **DNS** → **Records** → Add these:

| Type | Name | Content | Proxy Status |
|------|------|---------|-------------|
| **CNAME** | `@` | `cname.vercel-dns.com` | **DNS Only** (grey cloud ☁️) |
| **CNAME** | `www` | `cname.vercel-dns.com` | **DNS Only** (grey cloud ☁️) |

**IMPORTANT:** Click the orange cloud icon to turn it GREY. Vercel handles SSL — Cloudflare proxy will break it.

### Cloudflare SSL:
- Go to **SSL/TLS** → set to **Full (strict)**
- Go to **SSL/TLS** → **Edge Certificates** → turn ON "Always Use HTTPS"

---

## STEP 10: Supabase Final Setup (required for laundroswipe.com)

Go to your Supabase project:

1. **Authentication** → **URL Configuration:**
   - **Site URL:** `https://laundroswipe.com`
   - **Redirect URLs:** add each (one per line): `https://laundroswipe.com/`, `https://laundroswipe.com`, `https://www.laundroswipe.com/`, `https://www.laundroswipe.com`. For local: `http://localhost:3000/`. Without these, Continue with Google will not work.

2. **Authentication** → **Providers:**
   - Email: already enabled
   - **Google:** Enable and add OAuth Client ID and Secret from Google Cloud Console. In Google Cloud, set Authorized redirect URI to the exact URL Supabase shows (e.g. `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`).

---

## STEP 11: Environment & Supabase config

Your Supabase URL and anon key are now managed via small config files and Vercel env vars.

### Local development

1. Open `config/env.development.js` and paste your **project URL** and **anon public key**:

```js
window.__LS_CONFIG__ = {
  SUPA_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPA_KEY: 'YOUR_SUPABASE_ANON_KEY',
};
```

2. For quick local testing, run the build script so config is injected into the HTML files (no separate env.js file):

```bash
cd ~/Desktop/laundroswipe
SUPABASE_URL='https://YOUR_PROJECT.supabase.co' SUPABASE_ANON_KEY='your_anon_key' npm run generate-env
```

3. Open `index.html` and `admin/index.html` in the browser. Config is inlined in the HTML.

### Vercel / production (laundroswipe.com)

1. In your Vercel project → **Settings** → **Environment Variables**, add (for Production):
   - `SUPABASE_URL` = your Supabase project URL (e.g. `https://xxxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` = your Supabase anon public key (starts with `eyJ...`)

2. In **Settings** → **General** → **Build & Development Settings**:
   - **Build Command:** `npm install && npm run generate-env`
   - **Output Directory:** leave empty (static site)
   - **Install Command:** leave default

   The build injects Supabase config into the HTML files (no separate `/config/env.js` file), so keys are never exposed at a public URL.

3. Redeploy after saving env vars so the config is injected. If "Continue with Google" still does nothing or fails, see **Troubleshooting** below.

> Note: Config is inlined at build time only; it is not committed. The app is **production-only**: login, signup, and orders require Supabase; there is no demo or local-only mode.

---

## STEP 12: Verify Everything

- [ ] Visit `https://laundroswipe.com` — app loads
- [ ] Visit `https://laundroswipe.com/admin` — admin login screen shows
- [ ] Sign up as student → select VIT Chennai → works
- [ ] Select VIT Vellore → shows Coming Soon animation
- [ ] Schedule pickup → only Tuesday & Saturday available
- [ ] Only afternoon slot (12 PM – 4 PM) shown
- [ ] "Timings may change" warning visible
- [ ] ₹20 fee notice visible in small text
- [ ] Token number issued after booking
- [ ] Admin: can log in with your chosen secure credentials
- [ ] Admin: can see Supabase orders and advance status
- [ ] **Continue with Google** works on https://laundroswipe.com (requires STEP 10 and env build)
- [ ] HTTPS green lock showing

---

## How to Update the App Later

Whenever you make changes to the HTML files:

```bash
cd ~/Desktop/laundroswipe

# Add changes
git add .

# Commit with a message
git commit -m "Updated something"

# Push to GitHub
git push
```

Vercel auto-deploys from GitHub — your changes go live in ~30 seconds.

---

## Quick Summary of Where Everything Lives

| What | Where |
|------|-------|
| Code | GitHub repo: `github.com/YOUR_USERNAME/laundroswipe` |
| Hosting | Vercel (auto-deploys from GitHub) |
| Domain | Namecheap: `laundroswipe.com` |
| DNS | Cloudflare (nameservers point here) |
| Database | Supabase (tables already created) |
| Customer App | `https://laundroswipe.com` |
| Admin Dashboard | `https://laundroswipe.com/admin` |

---

## Troubleshooting

**"Site not loading after adding domain"**
→ DNS takes up to 24 hours. Wait and try again.

**"SSL / HTTPS not working"**
→ Make sure Cloudflare proxy is OFF (grey cloud, not orange).
→ Cloudflare SSL must be "Full (strict)".

**"Vercel says domain not configured"**
→ Double check CNAME records in Cloudflare point to `cname.vercel-dns.com`.

**"Continue with Google doesn't work on laundroswipe.com"**
1. **Check that the build ran:** The app gets config from env vars injected into the HTML at build time. If the app loads but sign-in or data fails, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Vercel (Settings → Environment Variables), ensure Build Command is `npm install && npm run generate-env`, and redeploy.
2. **Supabase Redirect URLs:** In Supabase → Authentication → URL Configuration → Redirect URLs, add exactly: `https://laundroswipe.com/` and `https://laundroswipe.com`. If you use www, also add `https://www.laundroswipe.com/` and `https://www.laundroswipe.com`.
3. **Google provider:** Supabase → Authentication → Providers → Google must be enabled with valid Client ID and Secret from Google Cloud Console (redirect URI in Google must match Supabase’s callback URL).

**"Admin login not working"**
→ Use the credentials you set in the admin panel (see `admin/index.html` if you need to change them).

**"I want to update code but git says error"**
→ Run `git pull` first, then make changes, then `git add . && git commit -m "msg" && git push`

---

## What's next (post-launch)

- **Security:** Turn on Row Level Security (RLS) on `users` and `orders` in Supabase and add policies so customers only see their own data. Change the hardcoded admin password or move admin login to Supabase Auth.
- **Vendor bill:** Use **Admin → Vendor / Bill** (`/admin/vendor.html`) to look up orders by token, add line items, and print the 2" thermal receipt (choose your Bluetooth printer in the print dialog).
- **Data:** Orders and users are stored in Supabase; admin and vendor pages read from the same database.

---

*LaundroSwipe — Your Laundry Sorted in One Swipe* 🧺