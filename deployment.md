# LaundroSwipe — Complete Deployment Guide
## From your laptop to live on laundroswipe.com

---

## What You Have (2 files)

```
laundroswipe/
├── index.html          ← Customer app (laundroswipe.com)
└── admin/
    └── index.html      ← Admin dashboard (laundroswipe.com/admin)
```

**Admin Login:**
- Email: `profab@laundroswipe.com`
- Password: `Mujeeb@123`

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

## STEP 3: Add Your Supabase Credentials

You said you already created Supabase tables — great!

1. Go to your Supabase project → **Settings** → **API**
2. Copy your **Project URL** (looks like `https://abcdefg.supabase.co`)
3. Copy your **anon public key** (starts with `eyJ...`)

Now open BOTH `index.html` files and replace:

**In `laundroswipe/index.html` (line ~11):**
```javascript
const SUPA_URL='YOUR_SUPABASE_URL_HERE';       // ← paste your URL
const SUPA_KEY='YOUR_SUPABASE_ANON_KEY_HERE';   // ← paste your key
```

**In `laundroswipe/admin/index.html` (line ~8):**
```javascript
const SUPA_URL='YOUR_SUPABASE_URL_HERE';       // ← paste your URL
const SUPA_KEY='YOUR_SUPABASE_ANON_KEY_HERE';   // ← paste your key
```

Save both files.

---

## STEP 4: Test Locally

Just double-click `index.html` to open in browser. Test:
- Onboarding slides work
- Sign up works
- Schedule pickup shows only Tuesday & Saturday
- Token number appears after booking
- Go to `admin/index.html` and login with `profab@laundroswipe.com` / `Mujeeb@123`

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

## STEP 10: Supabase Final Setup

Go to your Supabase project:

1. **Authentication** → **URL Configuration:**
   - Site URL: `https://laundroswipe.com` (or your Vercel URL for staging)
   - Redirect URLs: add **all** of:
     - `https://laundroswipe.com/**`
     - `https://laundroswipe.com/` (root, required for Google OAuth callback)
     - For local testing: `http://localhost:3000/`, `http://127.0.0.1:5500/` (or whatever port you use)

2. **Authentication** → **Providers:**
   - Email: already enabled
   - **Google:** enable and add your OAuth Client ID & Secret (from Google Cloud Console). The app uses “Sign in with Google” and redirects back to the Site URL/Redirect URL above.

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

2. For quick local testing, copy it to `config/env.js`:

```bash
cd ~/Desktop/laundroswipe
cp config/env.development.js config/env.js
```

3. Open `index.html` and `admin/index.html` in the browser. Both will read Supabase config from `config/env.js`.

### Vercel / production

1. In your Vercel project → **Settings** → **Environment Variables**, add:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_ANON_KEY` = your anon public key

2. In **Build & Development Settings**, set a build command to generate `config/env.js` before deploy:

```bash
npm install
npm run generate-env
```

Vercel will:
- Install dependencies (for the small Node script in `scripts/generate-env.js`)
- Run `scripts/generate-env.js`, which creates `config/env.js` from your env vars
- Then serve the static HTML (no further build step needed).

> Note: `.gitignore` already ignores `config/env.js` so real keys never get committed.

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
- [ ] Admin: can see Supabase orders (once DB tables are wired) and advance status
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

**"Admin login not working"**
→ Make sure you're typing exactly: `profab@laundroswipe.com` and `Mujeeb@123`

**"I want to update code but git says error"**
→ Run `git pull` first, then make changes, then `git add . && git commit -m "msg" && git push`

---

*LaundroSwipe — Your Laundry Sorted in One Swipe* 🧺