# StoreLink Admin Panel — Founder Study Guide (A → Z)

**Audience:** Founder / Head of Product  
**Product:** StoreLink marketplace ops console  
**Repo:** `admin-storelink` (GitHub: `ad-storelink`)  
**Stack:** Next.js 16 · React 19 · Supabase (same DB as mobile + web) · Vercel  
**Version note:** Reflects the admin console as of the ops rebuild (Phases 0–2b). Ads stay **OFF** until go-live.

---

## How to use this guide

Read once end-to-end (≈45–60 min), then keep as a desk reference.

1. **Mental model** (what this panel is)
2. **Access & roles** (who can do what)
3. **Shell** (how you move around)
4. **Every desk A→Z** (what each page does)
5. **Money, trust, growth** (how systems connect)
6. **Your operating cadence** (daily / weekly)
7. **Hard rules** (what not to do)

---

## 1. Mental model — what the admin panel is

StoreLink has three client surfaces:

| Surface | Repo | Users |
|---------|------|--------|
| Mobile app | `store-link-mobile` | Buyers & sellers |
| Web app | `storelink-web` | Buyers & sellers |
| **Admin** | `admin-storelink` / `ad-storelink` | Your ops staff |

All three talk to the **same Supabase project**. The admin does **not** invent a second database. When you approve KYC, resolve a dispute, or flip a feature flag, you are changing production state the apps read.

**What admin is for**

- Trust & safety (KYC, reports, suspensions)
- Money & escrow (orders, bookings, disputes, payouts, stuck payments)
- Catalog inspection (products, services, listing locks)
- Social moderation (reels, stories, comments, chats, communities)
- Ads review (seller Boosts + house ads) — delivery gated until you turn ads on
- Growth & comms (broadcasts, banners, scheduled announcements)
- Platform knobs (staff, settings, flags, experiments, geo, legal, observability)

**What admin is not**

- Not a second storefront
- Not a place to “message as the user” from P2P Chats (read-only investigations)
- Not automatic marketing send for scheduled announcements (you still press Send)

---

## 2. Access & roles (RBAC)

### Login flow

1. Go to `/login`
2. Sign in with email + password (Supabase Auth)
3. You must also exist in `admin_users` with `is_active = true`
4. Otherwise you land on **Unauthorized**
5. Login is recorded (device / session context) for staff audits

### Roles

| Role | Intent |
|------|--------|
| **super_admin** | Founder / eng lead — full access, staff, settings, kill switches |
| **moderator** | Trust & safety — KYC, reports, social, users |
| **finance** | Treasury — disputes, payouts, clawbacks, transaction ops |
| **support** | Care — tickets, lookups, some money desks (no staff/settings) |
| **content** | Growth/comms — Content Studio, house ads, some social |
| **analyst** | Read-only — sees desks but write buttons hidden; APIs also 403 |

### Three layers of protection

1. **Middleware** — blocks wrong roles from opening a URL
2. **API** (`getApiAdminContext`) — blocks writes even if someone crafts a request
3. **UI** (`canWrite`) — hides buttons for analysts

Sidebar items you cannot open show as **Restricted**.

**Single source of truth for who sees what:** `src/constants/adminNavigation.ts`

---

## 3. Shell — how you navigate

### Eight sidebar groups

1. **Overview** — morning pulse
2. **Trust & safety** — users, KYC, reports, support, listing integrity
3. **Money** — finance, payments, orders, bookings, clawbacks
4. **Catalog** — products, services, flash drops
5. **Social** — spotlight, reels, stories, comments, chats, communities
6. **Ads** — house ads, campaigns, reporting
7. **Growth** — content, curations, loyalty, referrals, onboarding, analytics
8. **Platform** — staff, settings, flags, audit, observability, QA

### Everyday shortcuts

- **Ctrl+K / Cmd+K** — command palette (jump to any desk you can see)
- **Country filter** (header) — scope lists/metrics to NG / GH / ZA / KE / CI / EG / RW or ALL  
  - **Caution:** with ALL countries, summed GMV/revenue can mix currencies — don’t treat that sum as one number
- **Queue badges** (refresh ~every 60s) — pending KYC, ads review, disputes, open reports
- **Mobile** — hamburger opens the full drawer

### Patterns on every write desk

- **Confirm** before irreversible actions
- **Reason** (often ≥10 characters + category) written to the **Audit Log**
- Prefer **staging** for experiments; production for real interventions

---

## 4. Every desk A → Z

Roles: **SA** super_admin · **M** moderator · **F** finance · **S** support · **C** content · **A** analyst

---

### Overview — `/dashboard` · SA M F S C A

**Purpose:** Morning command center.

**See**

- Users, GMV, revenue, disputes, pending KYC
- DB latency / system pulse
- Escrow health (escrow balance, pending payouts, product + service disputes, deposit · balance due)
- Disaster recovery shortcuts (stuck payments, webhook, payouts)
- Links into Moderation, Finance, Users, QA

**Founder tip:** Start here every day before opening tickets.

---

### Users — `/dashboard/users` · SA M A

**Purpose:** User dossier — the investigation home.

**Do**

- Search by email / slug
- Open profile: status, verification, phone (Termii), subscription, order/curation counts, disputes, tickets
- Suspend / activate with a clear reason

**Touches:** account access across the whole product.

---

### Moderation — `/dashboard/moderator` · SA M A · badge KYC

**Tabs**

1. KYC / Identity  
2. Business / CAC  
3. Abuse reports  
4. Moderation cases  
5. Suspension appeals  

**Do**

- Approve / reject identity & business verification (bulk + claim/release assignee chips)
- Work abuse into cases
- Approve appeal (reactivate) or reject with reason

**Touches:** seller verification badges, business double-check, account reinstatement.

---

### Report Inbox — `/dashboard/content-reports` · SA M S C A · badge reports

**Purpose:** One queue for user reports + ML borderline flags.

**Do**

- Claim / release
- Bulk dismiss (with reason)
- Triage here → take action on the **surface desk** (Reels, Stories, Comments, …)

---

### Listing Integrity — `/dashboard/listing-integrity` · SA M S C A

**Purpose:** Catch bait-and-switch / locked listing identity drift.

**Do**

- Review content locks & snapshot drift
- Unlock via product/service detail only with reason

---

### Support — `/dashboard/support` · SA S M A

**Purpose:** Customer care desk.

**Do**

- Open tickets, read thread, reply as support, resolve/close
- Look up orders / bookings / users in context
- Escalate money → Finance; safety → Moderation

---

### Finance — `/dashboard/finance` · SA F A · badge disputes

**Tabs**

1. **Dispute Tribunal** — refund buyer or release to seller (product + service disputes)
2. **Withdrawal Watchtower** — approve / reject seller payouts

Always leave a reason. This is money + audit.

---

### Payment Incidents — `/dashboard/payment-incidents` · SA F S A

**Purpose:** Stuck checkout without hunting UUIDs.

**See**

- Webhook failures
- Orders stuck in `AWAITING_PAYMENT`

**Do**

- Mark as paid when Paystack succeeded but the app didn’t catch it
- Super Admin can tune alert thresholds

---

### Transaction Ops — `/dashboard/orders` · SA F S

**Purpose:** Product order lookup & privileged interventions.

**Do**

- Search by order UUID or Paystack reference
- Prefer **Mark as paid** with a real Paystack ref
- Force Complete / Force Cancel only with strong reason

**Related:** Payment Incidents for queues; Finance for disputes.

---

### Bookings — `/dashboard/bookings` · SA F S

**Purpose:** Service / booking lifecycle.

**Do**

- Lookup by booking UUID or linked payment order
- Force complete / cancel / refund with audit
- Read 30/70 escrow timeline, deposit snapshot, clawback cap

**Note:** Some refunds create **seller clawback debt** (seller locked until repaid).

---

### Clawback Debts — `/dashboard/clawback-debts` · SA F S A

**Purpose:** Track company-funded booking refunds the seller owes back.

**Do**

- Age open debts
- Note / waive / mark manually paid (with categories + reasons)

---

### Service Listings — `/dashboard/service-listings` · SA F S A

Browse / filter services; open detail; unlock locked content with reason.

---

### Products — `/dashboard/products` · SA F S A M

Browse / filter products; open detail; force unlock content when locked.

---

### Flash Drops — `/dashboard/flash-drops` · SA F S A M

Live flash listings; watch end times / price deltas / fake-urgency signals.

---

### Spotlight — `/dashboard/spotlight` · SA M S A

Moderate Spotlight reports: hide / remove / reinstate.

---

### Reels — `/dashboard/reels` · SA M S A

Moderate Explore/Discover reels + reports; optional trust strikes.

---

### Stories — `/dashboard/stories` · SA M S C A

Moderate live stories + reports (expired stories drop off naturally).

---

### Comments — `/dashboard/comments` · SA M S C A

Unified comment-report queue across product, service, spotlight, reel.

---

### P2P Chats — `/dashboard/chats` · SA M S A

**Read-only** buyer–seller transcripts for investigations.  
Every load is audit-logged. Do **not** expect to chat as support here — use **Support**.

---

### Communities — `/dashboard/groups` · SA M S A

List seller communities; force-archive; ban hosts from creating new groups.

---

### House Ads — `/dashboard/house-ads` · SA C A

Platform Discover/Home banners (presets). Activate / pause / end with confirm.  
**Delivery requires `ads_enabled`.**

---

### Ad Campaigns — `/dashboard/ads` · SA M C S A · badge ads

Seller **Boost** desk:

- Approve / reject / pause / **resume** / end
- Bulk actions
- Issue unused budget as Store Coins
- Creative review checklist
- Global **`ads_enabled` kill switch** (Super Admin)

**Launch hold:** keep platform ads **OFF** until go-live. You can still review & pause while delivery is gated.

---

### Ads Reporting — `/dashboard/ads/reporting` · SA A F

Daily Boost warehouse: spend, billable views, clicks, eCPM, conversions (cron ~01:30 UTC). Read-heavy.

---

### Content — `/dashboard/content` · SA C A

**Broadcasts** — push to All / Sellers / Buyers (confirm before send; irreversible)  
**Banners** — in-app hero images create / remove  
**Calendar** — schedule announcements; **Send now** or Cancel  
  - Nothing auto-sends until a human confirms (no send cron yet)

---

### Curations — `/dashboard/curations` · SA M C A

Buyer curation hubs from completed purchases; preview; hide; feature.

---

### Loyalty — `/dashboard/loyalty` · SA F S A C

Platform max reward % and per-seller caps (mirrors mobile Store Rewards 1/2/5%).

---

### Referrals — `/dashboard/referrals` · SA F S A

Invite attributions, reward payouts, fraud heuristics, review queue.

---

### Onboarding — `/dashboard/onboarding` · SA A

Funnel conversion / drop-off aggregates only (no user identifiers).

---

### Analytics — `/dashboard/analytics` · SA A

Daily DAU / GMV / conversion warehouse snapshots (cron ~01:15 UTC).

---

### Super Admin — `/dashboard/super-admin` · SA

- Invite staff with roles
- Suspend / activate staff
- View / revoke admin sessions
- Fast audit tab

---

### System Settings — `/dashboard/settings` · SA

- Maintenance mode (lock app for non-admins)
- Min iOS / Android versions (force update)
- Support phone shown in-app

---

### Geo Policy — `/dashboard/geo-policy` · SA A

Cross-country rules for deep links, checkout, chat, discovery.

---

### Legal & Policy — `/dashboard/legal-policy` · SA C A

Versioned terms / privacy / service policies served to mobile.

---

### Audit Log — `/dashboard/audit` · SA A

Every sensitive admin action. Filter by type / date / search. **Export CSV** for compliance.

---

### Feature Flags — `/dashboard/feature-flags` · SA A

Toggle product/platform flags with reason. Staging-first; ramp slowly (1% → 5% → 20%).  
Ads gate also controllable from Ads desk. Ranking v2 kill switches live on **Experiments**.

---

### Experiments — `/dashboard/experiments` · SA A

Home/Explore ranking v2 rollout, calibration, kill switch. Analyst read-only on writes.

---

### Search AI — `/dashboard/search-embeddings` · SA

Gemini embedding coverage for products/services (semantic search quality).

---

### Observability — `/dashboard/observability` · SA A

App + admin events: info / warning / error / critical. Pair with Payment Incidents during outages.

---

### QA Hub — `/dashboard/safety-tests` · SA A

Runbooks, escrow health, staging smoke, CI commerce safety tests — run before risky deploys.

---

## 5. How money works (escrow mental model)

```
PRODUCT COMMERCE                         SERVICE / BOOKINGS
────────────────                         ──────────────────
orders (Paystack)                        service_orders (+ payment order)
  AWAITING_PAYMENT → PAID → …              deposit / funded legs
  COMPLETED / CANCELLED / DISPUTE          30% start + 70% complete escrow
disputes → Finance Tribunal                dispute_state → Finance + Bookings
payouts → Withdrawal Watchtower            refund may create clawback debt
```

**Recovery rule of thumb**

1. Customer paid, app stuck → **Payment Incidents** or **Transaction Ops → Mark as paid** (real Paystack ref)
2. Prefer Mark as paid over blind Force Complete
3. Mass payouts stuck → Finance + check `payout-processor` cron (needs service_role JWT, not anon)
4. Booking refund funded by company → watch **Clawback Debts**

Deposit / balance-due volume appears on Overview **Escrow health**.

---

## 6. Trust & safety loop

1. **KYC** (identity + business) on Moderation  
2. **Report Inbox** triage → surface desks  
3. **Listing Integrity** for locked / drifted listings  
4. **Social desks** for content actions  
5. **Users** for account freeze / reactivation  
6. **Suspension appeals** for fair reinstatement  
7. Close the loop in **Audit Log** + **Observability**

Queues support **claim / release** so two people don’t double-work the same case.

---

## 7. Growth & communications

| Channel | Desk | Notes |
|---------|------|--------|
| Push broadcast | Content | Segmented; confirm; irreversible |
| In-app banner | Content | Image + title |
| Scheduled announcement | Content → Calendar | Manual Send now — not auto |
| House ads | House Ads | Needs `ads_enabled` |
| Seller Boost | Ad Campaigns | Review OK while gate off; delivery needs gate on |
| Loyalty / referrals / curations | Growth desks | Program levers |

**Ads posture (current):** keep `ads_enabled` **OFF**. Review backlog is fine; do not turn delivery on until launch decision.

---

## 8. Founder operating cadence

### Every morning (15–25 minutes)

1. **Overview** — Escrow health + Disaster Recovery panel  
2. Sidebar badges — KYC · disputes · reports · ads pending  
3. **Payment Incidents** — webhook spike / stuck payments  
4. **Observability** — Error / Critical last 24h  
5. Skim **Finance** if finance staff aren’t on shift  

### Weekly

- Spot-check **Audit Log** (high-risk actions)
- Confirm **ads still OFF** pre-launch; clear review backlog
- **Content calendar** — send due items manually; prune banners
- **QA Hub** before risky deploys
- **Feature Flags / Experiments** — no surprise prod ramps
- **Clawback Debts** aging
- **Super Admin → Sessions** — revoke stale staff sessions

### Incident severity cheat sheet

| Severity | Example | First desk |
|----------|---------|------------|
| SEV-1 | Webhook down / error spike | Payment Incidents + Observability |
| SEV-2 | Mass payouts stuck | Finance + cron health |
| SEV-3 | One customer paid, order stuck | Transaction Ops → Mark as paid |

---

## 9. Hard rules — what NOT to do

1. **Do not turn `ads_enabled` on** until go-live.  
2. **Do not force-complete** when a Paystack reference exists — mark as paid.  
3. **Do not** skip reasons on money / account / moderation actions.  
4. **Do not** treat “All countries” GMV as a single currency total.  
5. **Do not** assume scheduled announcements auto-fire — press Send.  
6. **Do not** ramp flags / ranking experiments first in production.  
7. **Do not** expect house ads or Boosts to deliver while ads gate is off.  
8. **Do not** use P2P Chats as a support reply channel.  
9. **Analysts cannot write** — UI and API both block.  
10. **Do not** leave ex-staff sessions alive — revoke in Super Admin.

---

## 10. App feature → admin control map

| In the app | Admin desk | What you control |
|------------|------------|------------------|
| Orders / checkout | Transaction Ops, Payment Incidents | Lookup, mark paid, force status |
| Escrow / disputes | Finance, Overview escrow | Refund / release |
| Seller payouts | Finance → Withdrawals | Approve / reject |
| Bookings / services | Bookings, Clawback Debts | Force status, refund, clawbacks |
| Seller Boost ads | Ad Campaigns | Review, pause, resume, kill switch |
| Platform banners (ads) | House Ads | Publish / pause (needs ads on) |
| Feature rollout | Feature Flags, Experiments | Toggle + ramp |
| Support tickets | Support | Reply / resolve |
| Merchant KYC | Moderation | Approve / reject |
| Reels / Stories / Comments | Social desks + Report Inbox | Hide / remove / reinstate |
| Users | Users | Dossier, suspend / activate |
| Push / banners | Content | Broadcasts, banners, calendar |
| Errors / outages | Observability | Incident forensics |
| Who did what | Audit Log | Filter + CSV export |
| Staff access | Super Admin | Invite, suspend, revoke sessions |
| App lock / force update | System Settings | Maintenance, min versions |

---

## 11. Engineer file map (when you need depth)

| Concern | Path |
|---------|------|
| Middleware RBAC | `middleware.ts` |
| Nav + roles + badges | `src/constants/adminNavigation.ts` |
| API auth | `src/utils/auth/apiAdmin.ts` |
| Shell (sidebar, Ctrl+K, country, badges) | `src/app/dashboard/layout.tsx` |
| Role / canWrite | `src/hooks/useAdminRole.ts` |
| Queue claim/release | `src/hooks/useQueueAssignments.tsx` |
| Operator guide (shorter) | `docs/ADMIN_OPERATOR_GUIDE.md` |
| Desk pages | `src/app/dashboard/**/page.tsx` |
| Admin APIs | `src/app/api/admin/**/route.ts` |

---

## 12. One-page cheat sheet

**Start:** Overview → badges → Payment Incidents → Observability  
**Money stuck:** Mark as paid > Force complete  
**Seller can’t post:** Moderation KYC / Business  
**User reports content:** Report Inbox → surface desk  
**User angry about refund:** Finance Tribunal + Bookings timeline  
**Seller owes after refund:** Clawback Debts  
**Need to announce:** Content → confirm → send  
**Ads review only:** Ad Campaigns — leave kill switch OFF  
**Something broke:** Observability + Audit Log  
**Who has access:** Super Admin staff + sessions  

---

*End of founder study guide. Print or save the PDF companion of this file for offline study.*
