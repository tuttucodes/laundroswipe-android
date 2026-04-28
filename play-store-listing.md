# LaundroSwipe — Play Store Listing Pack

Paste each section into Play Console → **Grow → Store presence → Main store listing** (or the linked tab). Hard limits noted per field. Everything below stays inside Google's character/file caps.

---

## 1. App details

| Field | Value |
|---|---|
| **App name** (max 30) | `LaundroSwipe — Campus Laundry` |
| **Short description** (max 80) | `Campus laundry, sorted. Schedule pickups, track every order, swipe to confirm.` |
| **Default language** | `English (United States) – en-US` |
| **App or game** | App |
| **Free or paid** | Free |
| **Category** | `Lifestyle` (primary), `Productivity` (secondary if asked) |
| **Tags** (pick up to 5) | Laundry, Campus, On-demand services, Pickup & delivery, Student utilities |
| **Contact email** | `support@laundroswipe.com` |
| **Contact phone** *(optional)* | leave blank unless you have a support line |
| **Website** | `https://laundroswipe.com` |
| **Privacy Policy URL** | `https://laundroswipe.com/privacy` |
| **Terms of Service URL** *(if asked)* | `https://laundroswipe.com/terms` |

---

## 2. Full description (max 4000 chars)

```
LaundroSwipe is the fastest way to get your laundry done on campus.

Schedule pickups in seconds, track every order from pickup to delivery, and pay only when your clothes come back. No queues. No paper slips. No "is it ready yet?" texts.

WHY STUDENTS LOVE IT
• One-tap scheduling — pick a slot, pick a service, done
• Live order tracking — see exactly where your clothes are
• Swipe-to-confirm pickup — fast handoff with your vendor
• Itemised digital bills — no more "wait, what did I pay for?"
• Push notifications when your order is ready

SERVICES
• Wash & iron — daily wear, dorm bedding, sportswear
• Dry cleaning — formals, jackets, delicates
• Shoe cleaning — sneakers, loafers, treated leather

DESIGNED FOR CAMPUSES
LaundroSwipe is built specifically for residential campuses and student hostels. Your hostel block, room, and college are saved once — every order auto-routes to the right vendor for your block.

FOR VENDORS
Vendors get a built-in point-of-sale, bill builder, Bluetooth thermal printer support, revenue dashboard, and an order queue that updates in real time.

PRIVACY & SECURITY
• Sign in with Google (no password to remember)
• Your address and order history are encrypted in transit and at rest
• We never share your contact info with third parties

GET STARTED
1. Sign in with Google
2. Pick your campus and hostel block
3. Schedule your first pickup
4. Swipe to confirm. Done.

Built for VIT and growing fast. Questions or feedback? support@laundroswipe.com
```

Char count: ~1,540 / 4,000.

---

## 3. App access (required field)

Tell Google reviewers how to test the login-gated flow.

```
Most of the app is behind Google Sign-In. Reviewers can use the test account
below to access the customer experience including order history.

Test account
  Email:    play-review@laundroswipe.com
  Password: <set a one-time password and provide it here>

Login flow
  1. Open the app.
  2. Tap "Continue with Google" on the onboarding screen.
  3. Use the test account credentials above.
  4. The home screen, schedule, orders, and profile are now accessible.

Vendor and Admin areas are not accessible to consumers; they are guarded by
a separate admin password and are not part of the public-facing app.
```

> ACTION ITEM: create `play-review@laundroswipe.com` in your Google Workspace (or use an existing test account), give it a customer profile in Supabase, then paste the password into the box.

---

## 4. Ads

Select: **No, my app does not contain ads.**

---

## 5. Content rating questionnaire (IARC)

Category: **Reference, News, or Educational** → closest match for utility/lifestyle apps with no game-like content. If the wizard insists on a category, pick **Utility, Productivity, Communication, or Other**.

Answer **No** to all of:

- Violence (any kind)
- Sexual content / nudity / suggestive
- Profanity / crude humor
- Controlled substances (alcohol, tobacco, drugs)
- Gambling / simulated gambling
- User-generated content shared with other users
- Unmoderated user-to-user chat
- Sharing user's location with other users
- Digital purchases of physical goods *(answer **Yes** — laundry is a physical service)*
- Personal info collected (name, email, address) *(answer **Yes** — see Data Safety)*

Expected outcome: **Everyone** (or **Everyone 10+** at worst).

---

## 6. Target audience and content

| Field | Answer |
|---|---|
| Target age groups | `18+` (primary). Optionally also `16-17`. |
| Appeals to children | **No** |
| Ads shown to children | N/A (no ads) |

---

## 7. Data safety form

Open Play Console → **App content → Data safety**. Answer exactly as below.

### 7.1 Data collection and security

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** |
| Do you provide a way for users to request that their data be deleted? | **Yes** — direct users to `support@laundroswipe.com` (or build an in-app deletion endpoint and link it). |

### 7.2 Data types — collected

For each row: **Collected = Yes**, **Shared = No**, **Processing = Not ephemeral** (we persist it), **Required vs Optional** as noted, then list the purposes.

| Data type | Required? | Purposes |
|---|---|---|
| **Name** (full name) | Required | Account management, App functionality |
| **Email address** | Required | Account management, App functionality, Communications |
| **User IDs** (Supabase auth UUID) | Required | Account management, App functionality |
| **Phone number** | Optional | App functionality (vendor contact for delivery) |
| **Address** (hostel block + room) | Required | App functionality (pickup/delivery routing) |
| **Purchase history** (orders) | Required | App functionality, Account management |
| **Photos** *(only if user uploads any)* | Optional | App functionality |
| **App interactions** (screens viewed, buttons tapped) | Optional | Analytics |
| **Diagnostics / crash logs** | Optional | Analytics, App functionality |
| **Approximate location** *(only if you query device location — currently you don't)* | Skip | — |
| **Precise location** | Skip | — |
| **Payment info** | Skip — collected by vendors offline at handoff, not by the app |

### 7.3 Data shared with third parties

Answer: **No data shared with third parties.**

Exception: if you enable PostHog analytics in production, change the analytics row above to `Shared = Yes` and add **PostHog (analytics)** as a recipient.

### 7.4 Security practices

- Data encrypted in transit: **Yes** (HTTPS via Supabase + Vercel)
- Users can request data deletion: **Yes**
- Committed to Play's Families Policy: **Not applicable** (target 18+)

---

## 8. Government apps / Financial features / Health

| Question | Answer |
|---|---|
| Government app? | **No** |
| Financial features (loans, investing)? | **No** |
| Health/medical content? | **No** |
| News app? | **No** |
| COVID-19 contact tracing/status? | **No** |

---

## 9. Graphic assets — specs and what to upload

> Generate these once, store under `assets/store/`, upload via Play Console.

| Asset | Spec | Notes |
|---|---|---|
| **App icon** | 512×512 PNG, 32-bit, no alpha | Reuse `assets/images/icon.png`, upscale if needed. |
| **Feature graphic** | 1024×500 JPG/PNG, no alpha | Hero with logo + tagline "Campus laundry, sorted." Brand background `#1746A2`. |
| **Phone screenshots** | 16:9 or 9:16, min 320px short side, max 3840px, JPG/PNG. **2–8 required.** | Capture from a Pixel 7 emulator at 1080×2400. |
| **7-inch tablet screenshots** *(optional)* | min 320px short side | Skip for v1. |
| **10-inch tablet screenshots** *(optional)* | min 1080px short side | Skip for v1. |
| **Promo video** *(optional)* | YouTube URL | Skip for v1. |

### 9.1 Required screenshots — capture these 6

Capture on a Pixel 7 emulator (1080×2400 portrait). Filenames:

1. `01-onboarding.png` — first onboarding slide ("Campus laundry, sorted")
2. `02-home.png` — customer home with active order card
3. `03-services.png` — service grid (wash & iron, dry clean, shoe clean)
4. `04-schedule.png` — schedule screen with slot picker
5. `05-orders.png` — order tracking timeline
6. `06-profile.png` — profile with hostel/block

### 9.2 Feature graphic copy (1024×500)

```
Headline:   Campus laundry, sorted.
Subhead:    Schedule. Track. Swipe to confirm.
Wordmark:   LaundroSwipe
Background: #1746A2 (brand primary)
Foreground: white text + product mockup right-aligned
```

---

## 10. App content declarations (App content tab)

| Item | Status |
|---|---|
| Privacy policy | URL above |
| Ads | None |
| App access | Test account documented above |
| Content rating | Submit IARC questionnaire |
| Target audience | 18+ |
| News app | No |
| COVID-19 contact tracing | No |
| Data safety | See section 7 |
| Government app | No |
| Financial features | No |
| Health | No |
| Actor model rights *(if you show real people)* | Skip — no actors |

---

## 11. Pricing & distribution

| Field | Value |
|---|---|
| Price | **Free** |
| Countries | Start with **India** only. Expand later. |
| Contains ads | No |
| In-app purchases | No |
| Content guidelines | Acknowledge |
| US export laws | Acknowledge |

---

## 12. Privacy Policy — drop-in template

Host at `https://laundroswipe.com/privacy`. Copy below into the web app's `/privacy` route.

```markdown
# Privacy Policy — LaundroSwipe

_Last updated: 2026-04-26_

LaundroSwipe ("we", "our", "us") operates the LaundroSwipe mobile app and
website at https://laundroswipe.com (collectively, the "Service"). This
policy explains what data we collect, why, and your rights.

## 1. Data we collect
- **Account data**: full name, email, Google account ID — collected when you
  sign in with Google.
- **Profile data**: college, hostel block, room number, phone number — you
  enter these to enable pickup/delivery routing.
- **Order data**: services requested, schedule slot, vendor assigned, order
  status, itemised bills.
- **Device data**: app version, OS version, crash logs, push notification
  token.
- **Optional analytics**: anonymised screen views and button taps via
  PostHog (only if enabled).

## 2. How we use it
- Match orders to the right vendor for your hostel block.
- Send push notifications when your order is picked up, ready, or delivered.
- Show your order history.
- Diagnose crashes and improve the app.

## 3. Sharing
We share your name, hostel block, room number, and phone number with the
vendor assigned to your order — only as needed to complete the laundry
service. We do not sell your data. We do not share with advertisers.

## 4. Storage and security
Data is stored on Supabase (Postgres) hosted in Asia-South (Mumbai). All
network traffic uses HTTPS. Authentication tokens are stored in
device-secure storage (iOS Keychain / Android EncryptedSharedPreferences).

## 5. Your rights
- **Access** — request a copy of your data
- **Correction** — fix any field via the in-app profile editor
- **Deletion** — email support@laundroswipe.com to delete your account
- **Withdrawal of consent** — sign out at any time

## 6. Retention
Active account data is retained while your account exists. After deletion,
order records are retained for 12 months for vendor settlement audits, then
purged.

## 7. Children
LaundroSwipe is not intended for users under 18.

## 8. Changes
We will post updates here and notify users via push notification for
material changes.

## 9. Contact
support@laundroswipe.com
LaundroSwipe, VIT Vellore, Tamil Nadu, India.
```

---

## 13. Release notes — first release

Paste into **Production → Create new release → Release notes (en-US)**:

```
LaundroSwipe v1.0.0 — first public release.

• Sign in with Google
• Schedule wash & iron, dry clean, or shoe clean pickups
• Real-time order tracking with push notifications
• Swipe-to-confirm pickup and delivery
• Itemised digital bills

Designed for VIT campus. Questions? support@laundroswipe.com
```

---

## 14. Pre-submit checklist

- [ ] Privacy Policy live at `/privacy`
- [ ] Terms live at `/terms` (optional but recommended)
- [ ] `support@laundroswipe.com` inbox monitored
- [ ] Test account `play-review@laundroswipe.com` created with customer profile
- [ ] Feature graphic generated (1024×500)
- [ ] 6 phone screenshots captured (1080×2400)
- [ ] App icon 512×512 ready
- [ ] Content rating questionnaire submitted (returns IARC certificate)
- [ ] Data safety form completed
- [ ] Target audience set to 18+
- [ ] App access reviewer instructions filled in
- [ ] Countries selected (India only for v1)
- [ ] Internal track promoted to production once approved

---

## 15. Common rejection reasons (avoid these)

| Reason | Mitigation |
|---|---|
| Privacy policy missing or 404 | Confirm URL returns 200 before submit |
| Permissions not justified in description | Camera + Bluetooth permissions are mentioned in the full description (token scanner + thermal printer) — keep that copy |
| Test account doesn't work | Verify Google Sign-In works for `play-review@laundroswipe.com` end-to-end on the production build |
| Data safety form mismatch | Re-verify the form whenever you add a new SDK (analytics, crash reporter) |
| Content rating mismatch | Re-take the questionnaire if you add user-to-user features |
| Target API level too low | Already on Expo SDK 54 → API 35, fine for 2026 |

---

End of pack.
