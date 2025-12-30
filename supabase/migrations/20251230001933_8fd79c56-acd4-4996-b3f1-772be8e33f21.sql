-- Create news sentiment table for bull/bear votes and comments
CREATE TABLE public.news_sentiment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  news_url TEXT NOT NULL,
  news_title TEXT NOT NULL,
  user_id UUID NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('bull', 'bear')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(news_url, user_id)
);

-- Enable RLS
ALTER TABLE public.news_sentiment ENABLE ROW LEVEL SECURITY;

-- Anyone can view sentiment (for percentage calculations)
CREATE POLICY "Anyone can view news sentiment" 
ON public.news_sentiment 
FOR SELECT 
USING (true);

-- Authenticated users can add their sentiment
CREATE POLICY "Authenticated users can add sentiment" 
ON public.news_sentiment 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own sentiment
CREATE POLICY "Users can update their own sentiment" 
ON public.news_sentiment 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own sentiment
CREATE POLICY "Users can delete their own sentiment" 
ON public.news_sentiment 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_news_sentiment_updated_at
BEFORE UPDATE ON public.news_sentiment
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();