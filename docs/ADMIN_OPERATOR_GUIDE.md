## StoreLink Admin – Role-Based Operator Guide

This guide explains how each admin role should use the new panel day‑to‑day. It assumes you already have access to the admin and can log in.

---

## 1. Common concepts (all roles)

- **Navigation**
  - Left sidebar is your home base: sections for Overview, Users, Moderation, Finance, Support, Content, Settings, Super Admin (where allowed).
  - The top header shows the current section name.

- **Command palette**
  - Press **Ctrl+K / Cmd+K** anywhere to open the command palette.
  - Start typing to jump quickly to: Users, Moderation, Finance, Support, Content, Audit Log, Observability, Super Admin, Settings.

- **Audit log**
  - Every sensitive action (suspensions, KYC decisions, disputes, payouts, settings changes, staff changes, broadcasts, banners) is logged.
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

- **Use the command palette and shortcuts**  
  They exist to keep response times low, especially during incidents.

- **When in doubt, escalate**  
  - Money at risk → involve **Finance** and **Super Admin**.
  - Safety / abuse → involve **Moderator** and **Super Admin**.
  - Platform outages → involve **Engineering** and check **Observability**.

