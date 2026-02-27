# Storelink Cross-Repo Contract Matrix

This document is the compatibility gate for `admin-storelink`, `store-link-mobile`, and `storelink-web`.

## Core Tables (shared contracts)

- `profiles`: identity, account status, seller flags, subscription plan, verification, balances.
- `products`: listing metadata, pricing, stock, flash-drop fields, seller relation.
- `orders`: lifecycle state machine, escrow/refund/payout linkage, buyer/seller/chat relations.
- `order_items`: itemized order snapshot tied to `orders`.
- `disputes`: dispute state, verdict metadata, timestamps.
- `payouts`: payout requests and processing state.
- `merchant_verifications`: KYC request state + document metadata.
- `support_tickets` and `support_messages`: support lifecycle and conversation threads.
- `admin_users`: admin role and access-state registry.
- `admin_audit_logs`: operator action trail.
- `admin_broadcasts`: content campaigns and delivery metadata.
- `app_settings`: maintenance mode, min version gates, support contact.
- `banners`: marketing creatives displayed in clients.

## Canonical Roles

- `super_admin`
- `moderator`
- `finance`
- `support`
- `content`

## Canonical Workflow Statuses (used across apps)

- Account status: `active`, `suspended`, `banned`, `pending_appeal`
- Order status: `PENDING`, `AWAITING_PAYMENT`, `PAID`, `SHIPPED`, `COMPLETED`, `CANCELLED`, `DISPUTE_OPEN`
- Support ticket status: `OPEN`, `PENDING`, `RESOLVED`, `CLOSED` (case-insensitive mapping required where legacy lowercase exists)
- Payout status: `pending`, `retry_queued`, `paid`, `failed` (legacy values mapped in admin views)

## Admin-Critical RPCs

- `is_admin_user(user_id)`
- `get_admin_dashboard_stats()`
- `get_daily_revenue_chart()`
- `get_user_dossier(p_user_id)`
- `get_order_details(p_query)`
- `get_dispute_dossier(p_dispute_id)`
- `get_finance_overview()`
- `get_user_id_by_email(p_email)`
- `get_ticket_conversation(p_ticket_id)`
- `send_broadcast_notification(p_title, p_message, p_segment)`

## Mobile-Critical RPCs To Preserve

- `place_order_secure(...)`
- `handle_order_action(...)`
- `cancel_order_and_refund(...)`
- `mark_order_as_shipped(...)`
- `finalize_escrow_completion(...)`
- `confirm_payment_success(...)`
- `get_my_inbox()`
- `create_smart_chat(...)`
- `mark_messages_read(...)`
- `toggle_product_like(...)`
- `toggle_wishlist(...)`
- `toggle_comment_like(...)`
- `get_comments_with_merit(...)`
- `get_simple_home_shuffle(...)`
- `get_simple_explore_shuffle()`
- `get_simple_story_shuffle()`

## Edge Functions (operational dependencies)

- `paystack-webhook`
- `payout-processor`
- `refund-processor`
- `subscription-manager`
- `verify-bank`
- `paystack-account-resolve`
- `push-service`

## Known Compatibility Risks Found

- Web sitemap currently maps product URL using `id` but route expects product `slug`.
- Admin had missing unauthorized pages while middleware redirects to those paths.
- Admin had duplicated staff surfaces (`/dashboard/staff` and `/dashboard/super-admin`) with overlapping responsibilities.
- Admin used client-side privileged writes directly from UI in multiple modules.

## Controlled-Breaking-Change Rule

Any breaking contract change must include all four in the same delivery:

1. Contract diff (`before` vs `after`)
2. Supabase migration/RPC update
3. Cross-app compatibility patch (admin/web/mobile)
4. Rollback procedure
