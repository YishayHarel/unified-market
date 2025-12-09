-- Create table to track AI usage per user per day
CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  call_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, usage_date)
);

-- Enable RLS
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view their own usage"
ON public.ai_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can insert their own usage"
ON public.ai_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage
CREATE POLICY "Users can update their own usage"
ON public.ai_usage
FOR UPDATE
USING (auth.uid() = user_id);

-- Function to check and increment AI usage (returns true if allowed, false if limit exceeded)
CREATE OR REPLACE FUNCTION public.check_ai_usage(p_user_id uuid, p_daily_limit integer DEFAULT 0)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
BEGIN
  -- Insert or update usage for today
  INSERT INTO public.ai_usage (user_id, usage_date, call_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET 
    call_count = ai_usage.call_count + 1,
    updated_at = now()
  RETURNING call_count INTO current_count;
  
  -- Check if within limit
  IF current_count > p_daily_limit THEN
    -- Rollback the increment
    UPDATE public.ai_usage 
    SET call_count = call_count - 1, updated_at = now()
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;