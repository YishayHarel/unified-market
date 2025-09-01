-- Fix RLS disabled issue - enable RLS on stocks table that was missing it
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to stocks data (this is market data, should be public)
CREATE POLICY "Allow public read access to stocks" 
ON public.stocks 
FOR SELECT 
USING (true);

-- Fix search path issue for update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER 
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;