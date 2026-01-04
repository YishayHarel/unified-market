-- Create dedicated extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move common extensions from public to extensions schema
-- Note: We recreate them in the new schema as ALTER EXTENSION SET SCHEMA can have issues

-- Drop and recreate uuid-ossp in extensions schema
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- Drop and recreate pgcrypto in extensions schema  
DROP EXTENSION IF EXISTS "pgcrypto" CASCADE;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;

-- Grant usage on extensions schema to authenticated and anon roles
GRANT USAGE ON SCHEMA extensions TO authenticated, anon, service_role;

-- Update search_path to include extensions schema
ALTER DATABASE postgres SET search_path TO public, extensions;