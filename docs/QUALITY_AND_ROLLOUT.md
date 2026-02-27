# Quality, Validation, and Rollout

## Validation Gates

- Run `npm run lint` in `admin-storelink`.
- Run `npm run test:contracts` in `admin-storelink`.
- Run `npm run test:e2e` in `admin-storelink`.
- Verify login and all dashboard role routes:
  - super admin: all sections
  - moderator: moderation + support + overview
  - finance: finance + overview
  - support: support + overview
  - content: content + overview

## Critical Smoke Paths

- Auth: login -> dashboard redirect -> logout.
- Users: search user -> open dossier -> suspend/activate.
- Orders: query order -> force complete/cancel (staging only).
- Finance: open dispute -> verdict action -> payout approve/reject.
- Support: open ticket -> send reply -> resolve ticket.
- Content: send broadcast -> create/delete banner.
- Settings: maintenance mode + min version update.

## Controlled Breaking Change Rollout

1. Apply migration in staging.
2. Run mobile/web/admin compatibility smoke tests.
3. Deploy admin first.
4. Deploy mobile/web compatibility patch.
5. Monitor `log_observability_event` stream.
6. Rollback by reverting migration and redeploying last stable admin/web/mobile builds.

## References

- Runtime QA: `docs/STAGING_QA_RUNBOOK.md`
- Burn-in monitoring: `docs/BURNIN_MONITORING_48H.md`
