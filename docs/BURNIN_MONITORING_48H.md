# 24-48h Burn-in Monitoring

Use this after deploying to staging snapshot or canary production.

## Monitoring Window

- Minimum: 24 hours
- Recommended: 48 hours

## Primary Signals

- `admin_audit_logs` volume by action type.
- `log_observability_event` error events from admin.
- Endpoint error rates for:
  - `/api/admin/orders/force-status`
  - `/api/admin/disputes/verdict`
  - `/api/admin/payouts/decision`
  - `/api/admin/support/reply`
  - `/api/admin/support/resolve`
  - `/api/admin/users/account-status`
  - `/api/admin/staff/invite`
  - `/api/admin/staff/status`
  - `/api/admin/content/banners`

## SQL Checks

Run periodically in Supabase SQL editor.

```sql
-- Error events in last 48h
select
  created_at,
  payload
from observability_events
where event_type = 'admin_runtime_error'
  and created_at >= now() - interval '48 hours'
order by created_at desc;
```

```sql
-- Intervention actions in last 48h
select
  action_type,
  count(*) as total
from admin_audit_logs
where created_at >= now() - interval '48 hours'
  and action_type in (
    'ORDER_INTERVENTION',
    'DISPUTE_VERDICT',
    'PAYOUT_APPROVE',
    'PAYOUT_REJECT'
  )
group by action_type
order by total desc;
```

```sql
-- Idempotency duplicates sanity check (same idempotency token repeated)
select
  regexp_match(details, 'idem:([a-zA-Z0-9\\-]+)') as idem_token,
  count(*) as duplicate_count
from admin_audit_logs
where details ilike '%idem:%'
  and created_at >= now() - interval '48 hours'
group by idem_token
having count(*) > 1;
```

## Alert Threshold Guidance

- Any runtime error spike (>5 in 1 hour) blocks promotion.
- Any unauthorized 2xx response from protected admin APIs blocks promotion.
- Any duplicate privileged mutation caused by retries blocks promotion.

## Promotion Gate

Promote only when:

- No critical errors for 24-48h.
- All critical workflows pass.
- Audit and category trends match expected operational volume.
