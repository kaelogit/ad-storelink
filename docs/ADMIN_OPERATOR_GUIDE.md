## StoreLink Admin – Role-Based Operator Guide

This guide explains how each admin role should use the panel day‑to‑day. It assumes you already have access to the admin and can log in.

**Shell (2026-09):** Sidebar is grouped — Overview · Trust & safety · Money · Catalog · Social · Ads · Growth · Platform. On phones, use the hamburger menu. Press **Ctrl+K / Cmd+K** for the command palette. Escrow health sits on **Overview** (not only QA Hub).

---

## 1. Common concepts (all roles)

- **Navigation**
  - Left sidebar is your home base (grouped desks). Restricted items show locked if your role cannot enter.
  - The top header shows the current section name + country filter.

- **Command palette**
  - Press **Ctrl+K / Cmd+K** anywhere to open the command palette.
  - Jump to Users, Moderation, Finance, Ads, Support, Audit Log, Observability, etc.

- **Audit log**
  - Every sensitive action (suspensions, KYC decisions, disputes, payouts, settings changes, staff changes, broadcasts, banners, ads moderation, feature flags) is logged.
  - `Dashboard → Audit Log`:
    - Filter by **action type**, **date range**, and **search** (email, details, target id).
    - Use **Export CSV** for compliance or investigations.

- **Observability**
  - `Dashboard → Observability` shows recent **error / warning / info events** from the app and admin.
  - Use the **level filter** (Info / Warning / Error / Critical) to narrow down incidents when debugging tickets or outages.

- **Patterns to follow**
  - **Never** perform destructive actions without:
    - A clear **reason** (typed in the modal when prompted).
    - A quick check of the **user / order / payout** context.
  - Prefer **staging** for experiments; production for real interventions only.
  - **Analyst** role is read-only on write desks (buttons hidden; APIs also 403).

---

## 2. Super Admin

**Who**: Founder / Head of Product / Engineering lead.

**Core pages**
- `Overview`:
  - High‑level metrics: users, GMV, revenue, disputes, pending KYC.
  - Infrastructure health (DB latency, system status).
  - **Shortcuts** to Moderation, Finance, Users.
  - **Quality gates** section linking to the smoke tests/playbook.

- `Super Admin`:
  - **Staff list**:
    - Invite new admins with specific roles (Moderator, Finance, Support, Content).
    - Suspend / activate staff accounts.
    - See last login date and IP per admin.
  - **Sessions**:
    - View all current **admin_sessions** (who is logged in, from where, on which device).
    - **Revoke** suspicious sessions (e.g. lost laptop, ex‑employee).
  - **Audit log (tab)**:
    - Fast view of recent staff actions, filterable by email or action type.

- `System Settings`:
  - **Maintenance mode**:
    - Lock the entire app for non‑admins during migrations/incidents.
  - **Force update**:
    - Bump **min iOS / Android** versions to force users onto safe builds.
  - **Support phone**:
    - Update the number shown in‑app for help.

**Your responsibilities**
- Define **who gets which role** and keep the staff list clean.
- Decide when to:
  - Enable **maintenance mode**.
  - Force app upgrades.
  - Run smoke tests before risky deploys.
- Own **incident reviews** via Audit Log + Observability.

---

## 3. Moderator (KYC + Safety)

**Who**: Trust & Safety / Risk / Compliance.

**Core pages**
- `Moderation`:
  - **KYC queue**:
    - Review merchant verification requests.
    - Approve/reject; decisions sync back to profiles.
  - **Abuse reports**:
    - See reports from users (reporter, subject, type, status).
    - Open the user dossier from here when you need more context.
  - **Moderation cases**:
    - Group related reports into a case.
    - Track timeline, actions (warnings, escalations).
  - **Suspension appeals**:
    - See users who appealed a suspension.
    - Open each appeal, read text + evidence, and **Approve** (reactivate) or **Reject**.

- `Users`:
  - Read‑only access to dossiers (status, balances, orders, disputes).
  - For super_admin or specific flows: perform **Suspend / Activate / Ban** from the user dossier with reasons.

- `Audit Log` / `Observability`:
  - Use to cross‑check what actions were taken on users/orders near incidents.

**Your responsibilities**
- Keep the platform **safe**:
  - KYC only legitimate merchants.
  - Respond to abuse reports and escalate serious cases.
  - Treat suspension appeals fairly, with clear reasons logged.

---

## 4. Finance (Escrow, Disputes, Payouts)

**Who**: Finance / Treasury / Ops.

**Core pages**
- `Finance`:
  - **Dispute Tribunal** tab:
    - See all disputes: buyer, seller, order, amounts, status.
    - Open a dispute to view **evidence**, **chat snapshot**, and history.
    - Decide: **Refund buyer**, **Release to seller**, or other configured outcomes.
    - Always include a **reason**; this is written to audit.
  - **Withdrawal Watchtower** tab:
    - Monitor payouts: pending, retry queued, paid, failed.
    - Approve / Reject payouts with reasons.
    - Spot high‑value payouts quickly.

- `Users`:
  - Read‑only dossier for: balances, order history, disputes.

- `Overview`:
  - GMV, net revenue, escrow balances, helpful as a sanity check.

**Your responsibilities**
- Ensure **money flows** are correct and auditable:
  - Decisions on disputes align with policy and evidence.
  - Payout approvals reflect real balances and no fraud.
  - Keep notes and reasons precise for future audits.

---

## 5. Support (Tickets & Diagnostics)

**Who**: Customer support / Success.

**Core pages**
- `Support`:
  - **Ticket list**:
    - Search and filter by status/assignee.
  - **Ticket workspace**:
    - Read full conversation (customer + support messages).
    - Reply as support (responses go to the app/user).
    - Resolve/close tickets when done.
    - Use **Order diagnostics** panel (when available) to see orders linked to a ticket.

- `Users`:
  - Read‑only overview to understand a user’s context (recent orders, disputes, account status).

- `Observability`:
  - When a user reports “something is broken”, check for recent **error** events tied to their user_id or source.

**Your responsibilities**
- Resolve user issues quickly and accurately:
  - Use **diagnostics** and **observability** to avoid guessing.
  - Provide clear, empathetic explanations to users.
  - Escalate to Moderation or Finance when decisions affect safety or money.

---

## 6. Content (Broadcasts & Banners)

**Who**: Growth / Marketing / CMO.

**Core pages**
- `Content`:
  - **Broadcasts**:
    - Compose title + message and select **segment** (All / Sellers / Buyers).
    - Preview the push notification on the right.
    - Confirm via the modal before sending; once sent it cannot be undone.
  - **Banners**:
    - View all current in‑app banners (hero/billboard images).
    - Add new banners with **title + image URL**.
    - Remove banners that are outdated or incorrect.

- **Audit Log**:
  - Verify which broadcasts and banners went out, when, and by whom.

**Your responsibilities**
- Communicate clearly and carefully:
  - Avoid spam; keep broadcasts relevant and timely.
  - Double‑check links and images in banners (especially promos).
  - Coordinate with Support when campaigns may drive ticket spikes.

---

## 7. Analyst (Read‑only)

**Who**: Data / Strategy / External auditor.

**Core access**
- `Overview`:
  - Read high‑level metrics and intervention trends.
- `Users`, `Moderation`, `Finance`, `Support`, `Content`:
  - Read‑only access to lists and detail views (no actions).
- `Audit Log`:
  - Full visibility into admin actions for reporting and analysis.
- `Observability`:
  - Inspect trends in errors/warnings and correlate to incidents.

**Your responsibilities**
- Provide **independent insight**:
  - Spot risky patterns in interventions, disputes, payouts, or abuse reports.
  - Help define better policies based on real history.

---

## 8. Operational best practices

- **Always use reasons**  
  Every destructive action should have a clear, short reason. This is your future self’s memory.

- **Prefer staging for experiments**  
  Test new flows and bulk actions in staging using seeded data before touching production.

- **Feature flags (staging-first)**  
  Use **Feature Flags** in the sidebar for `spotlight_enabled`, `buyer_follow_enabled`, `index_header_motion_v2`, and other `feature_flags` rows. Always validate on staging first, ramp rollout gradually (1% → 5% → 20%), and require an operator reason (logged as last changed by in Audit Log). Ranking v2 kill switches remain on **Experiments**. Full promote path + parity export: repo `docs/FEATURE_FLAG_STAGING_PROD_PARITY.md` (#108).

- **Use the command palette and shortcuts**  
  They exist to keep response times low, especially during incidents.

- **When in doubt, escalate**  
  - Money at risk → involve **Finance** and **Super Admin**.
  - Safety / abuse → involve **Moderator** and **Super Admin**.
  - Platform outages → involve **Engineering** and check **Observability**.

---

## 9. App features → Admin control (full control map)

Use this to find where to control or inspect everything that exists in the app.

| App feature | Where in admin | What you can do |
|-------------|----------------|------------------|
| **Orders** | **Transaction Ops** (Orders) | Search by UUID or Paystack ref; view status, chat, fulfillment. **Mark as paid** when Paystack callback failed; **Force status** (COMPLETED/CANCELLED) with reason. Browse stuck queues via **Payment incidents**. |
| **Stuck payments** | **Payment incidents** | List webhook failures + orders stuck in `AWAITING_PAYMENT` without pasting a UUID. |
| **Payments / Escrow** | **Finance** + Overview **Escrow health** | View escrow balance, GMV, revenue. Resolve disputes (refund / release). |
| **Payouts** | **Finance** → Withdrawal Watchtower | Approve or reject seller payouts; see pending/paid/failed. |
| **Bookings / services** | **Bookings** | Force status, dispute chat, clawback context. |
| **Ads (seller Boost)** | **Ad Campaigns** | Global **ads_enabled** kill switch on the desk; approve / reject / pause / **resume** / end; issue unused credits; seller logos. Reporting desk for spend. |
| **House ads** | **House Ads** | Publish Discover/Home banners; activate / pause / end with confirm. Requires `ads_enabled`. |
| **Feature flags** | **Feature Flags** (+ Ads desk for ads) | Toggle product flags with reason; ads gate also on Ads desk for Super Admin. |
| **Support tickets** | **Support** | List tickets, open thread, **reply** as support, **resolve** or close. Search by order UUID or Paystack ref in ticket context. |
| **Merchant verification (KYC)** | **Moderation** | Queue of verification requests with profile logos; **approve** or **reject**; syncs to profile so seller can post. |
| **Reels / Stories / Comments** | **Reels**, **Stories**, **Comments**, **Report Inbox** | Moderate social surfaces and reports. |
| **Users** | **Users** | Search by email/slug; open **dossier**: profile, status, verification, **phone verification (Termii)**, subscription, orders count, **curations count**, disputes, support tickets. Suspend/activate/ban (role-dependent). |
| **Broadcasts & Banners** | **Content** | Send push broadcasts (segment: All/Sellers/Buyers). Create/remove in‑app banners. |
| **Observability (errors)** | **Observability** | Recent app/admin events (info/warn/error/critical). Edge functions (e.g. paystack-webhook, cart-nudge) log failures here; use when debugging “something broke” or after function/cron failures. |
| **Audit** | **Audit** | All admin actions (orders, payouts, support, verification, settings, staff, ads). Filter and export. |
| **Settings** | **Settings** (or Super Admin → System) | Maintenance mode, min app version (force update), **support phone**. |
| **Staff & roles** | **Super Admin** | Invite staff (moderator, finance, support, content, analyst); suspend/activate; sessions and revoke. |

**App features with no dedicated admin tab (use Users or existing pages):**

- **Curation hubs** — `/dashboard/curations`: list buyer hubs from completed purchases, open public preview, hide from profile (admin override), or mark featured. User dossier curations count deep-links here.
- **Loyalty program** — `/dashboard/loyalty`: platform max reward %, list loyalty-enabled sellers, per-seller caps; matches mobile seller Store Rewards (1/2/5%).
- **Reels / Stories** — Dedicated **Reels** / **Stories** desks plus Report Inbox; use Users dossier for account-level actions.
- **Wishlist / Likes** — User-owned data; no admin action needed unless part of a user investigation (dossier).
- **Loyalty / Store Coins** — **Loyalty** desk + Finance/Orders money view; Ads desk issues Boost credits as Store Coins.
- **Blocked users** — User-level setting; view in User dossier if needed for support/safety.
- **Follow-stores onboarding** — Controlled via Feature Flags / onboarding analytics desks.

For **Paystack callback failures**: use **Transaction Ops** → search order → **Mark as paid (Paystack reference)**. See repo doc `store-link-mobile/docs/PAYSTACK_CALLBACK_FAILURE.md`.

---

## 10. Disaster recovery (payments & payouts)

**Where:** Overview → **Disaster recovery** panel (also `docs/DISASTER_RECOVERY_RUNBOOK.md`).

| Incident | Severity | One-click desk |
|----------|----------|----------------|
| Customer paid, order stuck `AWAITING_PAYMENT` | SEV-3 | **Transaction Ops** → Mark as paid |
| Webhook down / error spike | SEV-1 | **Payment incidents** + **Observability** + reconcile in Transaction Ops |
| Mass seller payouts stuck | SEV-2 | **Finance** + confirm `payout-processor` cron (OPS_DEPLOY_AND_CRON) |

**Rules of thumb**

- Prefer **Mark as paid** with a real Paystack reference over force-complete.
- During a webhook outage, reconcile high-value / VIP orders first while engineering restores the function.
- Payout queues need a live cron + **service_role** JWT — anon keys often 401.
- Service 30/70 money lives in `service_order_payouts`; product payouts need `COMPLETED` orders.

Cross-links: Payment Incidents desk, `PAYSTACK_CALLBACK_FAILURE.md`, `OPS_DEPLOY_AND_CRON.md`.

