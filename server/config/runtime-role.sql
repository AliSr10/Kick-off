-- Optional production hardening, run AFTER db:migrate as the database owner.
-- First create a dedicated LOGIN role named kickoff_app with a strong password,
-- no ownership, no administrative attributes and no privileged memberships.
-- This script grants access; it does not create/change passwords or revoke other roles.
DO $$
DECLARE app_role TEXT := 'kickoff_app';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    RAISE EXCEPTION 'Create the dedicated kickoff_app login role first.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role AND (rolsuper OR rolcreatedb OR rolcreaterole))
    OR EXISTS (SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba WHERE d.datname = current_database() AND r.rolname = app_role)
    OR EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member WHERE r.rolname = app_role) THEN
    RAISE EXCEPTION 'The application role must not own the database, administer roles, or belong to other roles.';
  END IF;
  IF NOT has_database_privilege(app_role, current_database(), 'CONNECT') THEN
    RAISE EXCEPTION 'Grant CONNECT on this database to kickoff_app as its owner, then run this script again.';
  END IF;
  IF has_schema_privilege(app_role, 'public', 'CREATE') THEN
    RAISE EXCEPTION 'The application role can create objects in public. Review schema/PUBLIC privileges before granting runtime access.';
  END IF;
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.users TO %I', app_role);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations, public.standing_bookings, public.session TO %I', app_role);
  EXECUTE format('GRANT INSERT ON public.audit_log TO %I', app_role);
  EXECUTE format('GRANT SELECT ON public.schema_migrations TO %I', app_role);
  EXECUTE format('GRANT USAGE ON SEQUENCE public.users_id_seq, public.standing_bookings_id_seq, public.audit_log_id_seq TO %I', app_role);
END $$;
