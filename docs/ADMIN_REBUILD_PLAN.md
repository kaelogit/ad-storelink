# StoreLink Admin Panel — Full Rebuild Plan

**Goal:** Rebuild the admin panel to **Instagram / TikTok / WhatsApp Business** standard: total control, enterprise security, modern UX, and StoreLink-unique capabilities (escrow, disputes, Nigerian market). Integrate existing audit rules, e2e tests, and observability so everything is manageable from one place.

---

## 1. How This Compares to Big Platforms

| Area | Instagram / TikTok / WhatsApp | Current StoreLink Admin | After Rebuild |
|------|------------------------------|-------------------------|----------------|
| **Look & feel** | Dedicated design system, dark/light, dense data tables, quick filters, keyboard shortcuts | Basic gray forms, simple tables, minimal polish | Design system, side nav, command palette, responsive, accessibility |
| **Control surface** | Users, content, payments, support, safety, appeals, analytics, settings, roles | Users, orders, finance, support, content, settings, staff, audit (limited) | All of that **plus** abuse reports, appeals, content moderation, rate limits, observability, tests |
| **Security** | SSO, 2FA, IP allowlist, session management, audit-everything | Session + role check, audit logs on actions | 2FA, session list/revoke, IP + device log, immutable audit, permission granules |
| **Roles** | Fine-grained (e.g. Analyst, Moderator, Support, Finance, Content) | 5 roles, coarse | Keep 5 + optional **Analyst** (read-only), permission matrix per section |
| **Logs & tests** | Full audit trail, export, link to entity; CI runs tests | Audit log table, e2e tests in repo | **In-panel:** view/filter/export audit log, run e2e smoke from UI (optional), view observability events |

This plan gets StoreLink to “that level” while keeping **StoreLink uniqueness**: escrow, disputes, merchant verification, payouts, support, and Nigerian compliance in one place.

---

## 2. Security Hardening (Do First)

- **2FA for admin_users**  
  - Add `totp_secret`, `totp_enabled` (or use Supabase MFA); enforce for all admins before accessing dashboard.
- **Session & device control**  
  - Store `admin_sessions` (or use Supabase auth sessions): device, IP, last_activity. In Super Admin: “Sessions” tab to list/revoke.
- **API-only writes**  
  - No direct Supabase client writes from the browser for privileged data. All mutations go through `/api/admin/*` with `getApiAdminContext(allowedRoles)` and server-side Supabase. Already partly there; complete the migration.
- **Audit log immutability**  
  - Ensure only server APIs insert into `admin_audit_logs`; add DB trigger to block deletes/updates if needed.
- **Rate limiting & lockout**  
  - Rate limit login and sensitive API routes; lockout after N failed attempts (with unlock via Super Admin or time window).
- **Middleware**  
  - Keep role-based redirects; add optional IP allowlist for Super Admin (env-based).

---

## 3. Roles & Permissions (Refined)

Keep existing roles; add optional **Analyst** and a clear permission matrix.

| Role | Overview | Users | Moderation | Finance | Support | Content | Settings | Staff | Audit |
|------|----------|-------|------------|---------|---------|---------|----------|-------|-------|
| **super_admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **moderator** | ✅ | ✅ suspend/notes | ✅ KYC, reports, appeals | — | ✅ | — | — | — | ✅ (own) |
| **finance** | ✅ | ✅ read | — | ✅ disputes, payouts | — | — | — | — | ✅ (own) |
| **support** | ✅ | ✅ read | — | — | ✅ tickets | — | — | — | ✅ (own) |
| **content** | ✅ | — | — | — | — | ✅ broadcast, banners | — | — | ✅ (own) |
| **analyst** (new) | ✅ read | ✅ read | ✅ read | ✅ read | ✅ read | ✅ read | — | — | ✅ read |

- **Audit:** “Own” = see only own actions; Super Admin sees all. Analyst sees all audit in read-only.
- **Implementation:** Middleware + API `getApiAdminContext(allowedRoles)` stay; add `analyst` to `admin_role` enum and to nav/API checks where “read-only” is allowed.

---

## 4. UX/UI Rebuild (Not “Basic”)

- **Design system**  
  - Tokens: colors (primary/success/danger, etc.), spacing, typography, radii. Dark + light. Use a small set of components (Button, Card, Table, Modal, Badge, Tabs, Toast) so the whole panel feels one product.
- **Layout**  
  - Persistent side nav (collapsible), top bar (search, notifications, profile, logout). Content area with breadcrumbs. No “basic” single-column forms only.
- **Data density**  
  - Tables: sort, filter, column visibility, pagination or virtual scroll. Key metrics on overview as cards + small charts.
- **Actions**  
  - Primary actions obvious; destructive (suspend, reject) behind confirmation modal with reason. Toast on success/error.
- **Command palette (optional)**  
  - `Ctrl+K` / `Cmd+K`: jump to “Users”, “Order #…”, “Dispute #…”, “Audit log”.
- **Accessibility**  
  - ARIA, focus order, keyboard nav. Critical for “enterprise” feel.
- **Responsive**  
  - Desktop-first but usable on tablet for support/moderation on the go.

---

## 5. Feature Expansion (Total Control)

### 5.1 Overview (Dashboard)

- **Metrics cards:** DAU/MAU, GMV (today/7d/30d), revenue (escrow fee + subscriptions), active disputes, open tickets, pending KYC, pending payouts.
- **Charts:** Revenue over time (existing RPC), orders by status, signups over time.
- **Intervention trends:** Keep current “intervention logs by category” from `admin_audit_logs`.
- **Shortcuts:** Deep links to “Pending KYC”, “Open disputes”, “Unresolved tickets”, “Pending payouts”.

### 5.2 Users (Full Control)

- **List:** Search by email/slug/phone, filters (status, plan, verification, created range). Columns: avatar, name, slug, email, plan, status, verification, balance, orders count, last active.
- **User dossier (single view):**  
  - Profile, account status, verification, subscription, balances.  
  - Orders (summary), disputes (as buyer/seller), support tickets, abuse reports (as reporter/subject), moderation cases, suspension appeals.  
  - Actions: Suspend / Activate / Ban, add note (to `admin_user_notes`), view full audit for this user.
- **Account status:** Suspend/activate with mandatory reason (stored in audit); optional in-app notification.

### 5.3 Moderation (KYC + Safety)

- **KYC (current):** List of `merchant_verifications` with filters; approve/reject with profile sync (already done).
- **Abuse reports (new):** Table from `abuse_reports`: reporter, subject, type, status, created. Link to subject’s user dossier; “Create moderation case” or “Dismiss” with note.
- **Moderation cases (new):** List `moderation_cases` with subject, status, created. Open case view: abuse reports linked, timeline, actions (close, warn, escalate to suspend).
- **Suspension appeals (new):** List `suspension_appeals`: user, status, created. View appeal text + evidence; Approve (reactivate) / Reject with admin note (to `admin_notes`). Audit log entry.

### 5.4 Finance (Escrow, Disputes, Payouts)

- **Disputes:** List with filters (status, date). Case view: order, buyer/seller, chat snapshot, evidence. Verdict: refund buyer / release to seller / partial, with reason (audit). Already partly there; unify UI.
- **Payouts:** List pending/retry_queued/paid/failed. Approve / Reject with reason (audit). Show linked order and seller.
- **Orders:** Search by ID/buyer/seller. Order detail: items, status, payments, timeline. **Force status** (e.g. complete/cancel) with reason (staging only or with safeguard). All actions via API only, with audit.

### 5.5 Support

- **Ticket list:** Status, assignee, created, last message. Filters and search.
- **Ticket detail:** Thread of messages (from `support_messages` + ticket subject/message). Reply as support (API already writes to `support_messages`); resolve/close. Assign to self/other (if `assigned_to` used).

### 5.6 Content

- **Broadcasts:** Compose, segment (ALL / sellers / etc.), schedule (if supported), send. Log to audit.
- **Banners:** List; add/edit/delete (image URL, title, link, order). Audit.

### 5.7 System Settings (Super Admin)

- **App settings:** Maintenance mode, min version iOS/Android, support phone. Already in API; form + confirmation for maintenance.
- **Optional:** Feature flags (e.g. “new_home_feed”) stored in `app_settings` or a small table, toggled here.

### 5.8 Super Admin (Staff)

- **Staff list:** Invite (email + role), activate/suspend, view last login + IP. Already there; tighten UI and add “Sessions” (revoke) if you add session table.
- **Audit log (Black Box):**  
  - Filters: date range, action type, admin email, target_id.  
  - Export CSV (server route that streams from `admin_audit_logs`).  
  - Each row link to “View entity” (user dossier, order, dispute, ticket) when applicable.

### 5.9 Observability & Tests (In-Panel)

- **Observability (optional):** Page that reads `log_observability_event` (or a view): recent errors, event types. Filter by type, time. Helps support “see what went wrong” without opening Supabase.
- **E2E / smoke (optional):** Button “Run smoke tests” that triggers a job (e.g. GitHub Actions or a serverless function) and shows link to run result. Alternative: just link to CI and document in QUALITY_AND_ROLLOUT.

---

## 6. StoreLink Uniqueness (What Only We Have)

- **Escrow lifecycle:** Order states (PENDING → PAID → SHIPPED → COMPLETED) and “Force status” with clear warnings and audit.
- **Disputes:** Refund / release to seller / partial with reason; full chat and evidence in one view.
- **Merchant verification:** KYC queue with document view (if you store URLs), approve/reject with profile sync.
- **Nigerian context:** Naira, Paystack, support phone; optional “Compliance” section later (e.g. KYC docs retention).

Make these sections the “hero” of the admin: clear, fast, and fully audited.

---

## 7. Technical Architecture (Rebuild)

- **Stack:** Keep Next.js (App Router), Supabase (auth + DB). No direct client writes for privileged data.
- **New structure (suggested):**
  - `src/components/ui/` — design system (Button, Card, Table, Modal, Badge, Tabs, Input, Select).
  - `src/components/admin/` — composed blocks (PageHeader, ActionFeedback, ConfirmActionModal, DataTable, EntityLink).
  - `src/app/dashboard/` — one route per section; layout with side nav + role-based menu.
  - `src/app/api/admin/` — one route per action (e.g. `users/account-status`, `moderation/verification`, `disputes/verdict`). All use `getApiAdminContext(allowedRoles)` and write to `admin_audit_logs`.
- **State:** Server state via fetch in server components or `useQuery` in client; mutations via `fetch` to API routes. No Redux needed.
- **Tests:** Keep Playwright e2e (auth, finance, support, moderation); add tests for new flows (appeals, abuse reports). Contract script stays.

---

## 8. Database / Backend Additions

- **admin_users:** Add `totp_secret`, `totp_enabled` (or rely on Supabase MFA).
- **admin_sessions (optional):** `id`, `admin_id`, `device_info`, `ip`, `last_activity`, `created_at` for “Sessions” tab.
- **admin_audit_logs:** Ensure `action_type`, `target_id`, `details`, `created_at`; add index on `(created_at, action_type)` for fast filter/export.
- **RPCs (if missing):**  
  - List abuse_reports (with reporter/subject profile), list moderation_cases, list suspension_appeals (with user).  
  - Or use direct table select with RLS that allows `is_admin_user(auth.uid())` (already in place for these tables).
- **Export audit:** New API route `GET /api/admin/audit/export?from=...&to=...&action_type=...` returning CSV, protected by Super Admin.

---

## 9. Phased Delivery

| Phase | Focus | Deliverables |
|-------|--------|--------------|
| **1. Security & foundation** | 2FA, API-only writes, audit immutable | 2FA for admins, all mutations via API, middleware + role matrix doc |
| **2. Design system & layout** | UI kit, side nav, dark/light | Tokens, components, new dashboard layout, breadcrumbs |
| **3. Users & moderation** | User dossier, abuse reports, cases, appeals | Users list/dossier, abuse_reports list, moderation_cases list/actions, suspension_appeals list/approve/reject |
| **4. Finance & support** | Disputes, payouts, orders, support | Unified finance UI, support ticket thread, order force-status safeguard |
| **5. Content & settings** | Broadcasts, banners, app settings | Content page polish, settings with confirmations |
| **6. Super Admin & audit** | Staff, audit log, export | Staff + sessions (if any), audit filters + CSV export, observability view (optional) |
| **7. Polish & tests** | E2E, accessibility, runbooks | E2E for new flows, a11y pass, link “Run tests” / runbook from dashboard |

---

## 10. Success Criteria

- **Control:** Every critical entity (user, order, dispute, payout, ticket, report, appeal, KYC) viewable and actionable from the panel with clear audit.
- **Security:** 2FA, no privileged client writes, session visibility, immutable audit, rate limit on login and sensitive APIs.
- **UX:** Design system, consistent layout, tables with sort/filter, confirmations for destructive actions, toasts, accessibility.
- **StoreLink uniqueness:** Escrow, disputes, merchant verification, and payouts are first-class and easy to operate.
- **Logs & tests:** Audit log filterable and exportable; e2e and contracts runnable and documented; optional observability in-panel.

This plan is the blueprint to make the StoreLink admin panel **as capable and polished as TikTok, Instagram, and WhatsApp admin tools**, while staying true to StoreLink’s escrow and Nigerian market focus.
