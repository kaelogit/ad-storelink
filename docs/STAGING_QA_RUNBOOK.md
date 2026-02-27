# Staging Runtime QA Runbook

This checklist is for full runtime QA before production release.

## Prerequisites

- Staging environment points to staging Supabase project.
- Test admin users exist for each role:
  - `super_admin`
  - `moderator`
  - `finance`
  - `support`
  - `content`
- Seed data exists for orders, disputes, payouts, support tickets, KYC requests.

## Route And Role Access Matrix

- `super_admin` can access all dashboard modules.
- `moderator` can access `overview`, `moderator`, `support`.
- `finance` can access `overview`, `finance`.
- `support` can access `overview`, `support`.
- `content` can access `overview`, `content`.
- Access to restricted modules must redirect to `/dashboard/unauthorized`.

## Critical Workflow QA

### Auth and Session

- Login success and failure paths.
- Login redirect behavior for authenticated sessions.
- Logout returns to `/login`.

### Users and Moderation

- Search users and open dossier.
- Suspend user with reason through secured endpoint.
- Reactivate user with reason.
- KYC approve/reject updates reflected in profile and logs.

### Orders and Finance

- Lookup order by id/reference.
- Force complete/cancel with reason category and note.
- Verify terminal orders cannot be transitioned.
- Verify idempotent retries do not duplicate actions.
- Dispute verdict path updates both dispute and order status.
- Payout approve/reject path works and blocks finalized payouts.

### Support

- Open ticket conversation.
- Send admin reply (status transitions to `PENDING`).
- Resolve ticket (status transitions to `RESOLVED`).

### Content

- Send broadcast successfully.
- Create and delete banner through secured API.

### Dashboard Analytics

- Intervention trends render with `24h`, `7d`, `30d` windows.
- Category aggregation matches recent audit log actions.

## Pass/Fail Criteria

- No unauthorized access bypasses.
- No privileged browser writes remain.
- No unhandled runtime error pages during normal flows.
- All audit logs include action + category/reason where required.
- Lint and contract checks pass.
