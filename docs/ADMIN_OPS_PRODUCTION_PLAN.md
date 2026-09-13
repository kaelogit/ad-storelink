# StoreLink Admin — Production Ops Console Plan

**Status:** Phase 0–2b complete · gap polish applied 2026-09-14  
**Ads posture:** Keep `ads_enabled` **OFF** until go-live (Ads desk launch-hold banner).

## Gap polish (this pass)
- Moderator: analyst write actions gated; business KYC claim + bulk + SLA age
- Calendar: local-date bucketing; clearer Send / Cancel announcement / Close modal
- Finance: product dispute buyer/seller logos
- Ads: bulk resume; Transaction Ops subtitle clarified
- Queue counts: soft `warnings[]` when an RPC fails

## Apply migrations (if not already)
1. `20261111120000_ad_campaign_admin_resume.sql`
2. `20261111130000_admin_queue_assignments_and_scheduled_announcements.sql`
