-- Fix news_sentiment to be owner-only (sensitive investment data)
DROP POLICY IF EXISTS "Authenticated users can view news sentiment" ON public.news_sentiment;

CREATE POLICY "Users can view their own sentiment"
ON public.news_sentiment
FOR SELECT
USING (auth.uid() = user_id);