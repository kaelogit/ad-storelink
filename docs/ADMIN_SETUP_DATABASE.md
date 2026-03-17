# Admin panel – database setup

The admin panel (admin-storelink) uses the **same Supabase project** as the main app. These migrations must be applied to that project so Super Admin and session features work.

## Required migrations (run in order)

Run these in the **Supabase SQL Editor** (or via `supabase db push` from the repo that contains the migrations).

1. **`admin_sessions` table + analyst role**  
   File: `store-link-mobile/supabase/migrations/20260228000001_admin_sessions_analyst_audit_index.sql`  
   - Creates `public.admin_sessions` (used by Super Admin → Sessions tab).  
   - Adds `analyst` to `admin_role` enum.  
   - Adds index on `admin_audit_logs`.

2. **`admin_users` last login + update policy**  
   File: `store-link-mobile/supabase/migrations/20260228000007_admin_users_last_login_and_update_policy.sql`  
   - Adds `last_login` and `last_login_ip` to `admin_users` (shown in Staff list).  
   - Allows admins to update their own row (used by the record-login API).

## After running

- **Staff list** “Session Info” will show last login date and IP after each admin signs in.
- **Sessions** tab will list active admin sessions; new logins are recorded automatically.
- If you see “Could not find the table 'public.admin_sessions'”, run migration (1) above.
