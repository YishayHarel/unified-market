-- Move pg_net extension to extensions schema
DROP EXTENSION IF EXISTS "pg_net" CASCADE;
CREATE EXTENSION IF NOT EXISTS "pg_net" SCHEMA extensions;