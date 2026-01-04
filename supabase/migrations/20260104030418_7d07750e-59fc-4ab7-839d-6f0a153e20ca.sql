-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create table to store generated morning briefs
CREATE TABLE IF NOT EXISTS public.morning_briefs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brief_data JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.morning_briefs ENABLE ROW LEVEL SECURITY;

-- Users can only view their own briefs
CREATE POLICY "Users can view their own morning briefs"
ON public.morning_briefs
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can insert briefs (for cron job)
CREATE POLICY "Service role can insert briefs"
ON public.morning_briefs
FOR INSERT
WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_morning_briefs_user_date 
ON public.morning_briefs (user_id, generated_at DESC);