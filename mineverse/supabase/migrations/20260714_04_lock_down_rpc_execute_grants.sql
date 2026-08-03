-- Migration 04: Restrict Phase 2 RPCs to the service role.
--
-- PostgREST exposes every public-schema function at /rest/v1/rpc/<name>, and
-- Postgres grants EXECUTE to PUBLIC by default. That made mutate_team_resources,
-- craft_team_item, and the Dev 5 operations callable with the publishable anon
-- key -- any attendee could mint resources or resolve a PvP match, bypassing the
-- deny-all RLS model these tables rely on. Server routes use the service role,
-- so anon/authenticated need no EXECUTE at all.

revoke execute on function public.mutate_team_resources(uuid, jsonb, text, text, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.craft_team_item(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.dev4_resource_snapshot(integer, integer, integer, integer, integer, integer, integer) from public, anon, authenticated;

revoke execute on function public.start_pvp_match(uuid, text) from public, anon, authenticated;
revoke execute on function public.resolve_pvp_match(uuid, text) from public, anon, authenticated;
revoke execute on function public.void_pvp_match(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.apply_manual_adjustment(uuid, jsonb, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.record_offline_result(uuid, integer, text, jsonb, text, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.enforce_pvp_match_pair() from public, anon, authenticated;

-- Pin search_path on functions created without one (prevents search_path hijacking
-- of a SECURITY DEFINER body).
alter function public.dev4_resource_snapshot(integer, integer, integer, integer, integer, integer, integer)
    set search_path = public, pg_temp;
alter function public.mutate_team_resources(uuid, jsonb, text, text, uuid, text, text, text)
    set search_path = public, pg_temp;
alter function public.craft_team_item(uuid, text, uuid)
    set search_path = public, pg_temp;
alter function public.update_updated_at_column()
    set search_path = public, pg_temp;
alter function public.sync_payment_verification()
    set search_path = public, pg_temp;
alter function public.generate_team_code()
    set search_path = public, pg_temp;
