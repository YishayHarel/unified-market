-- Create table for reply likes (posts already have discussion_post_likes)
CREATE TABLE public.discussion_reply_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reply_id UUID NOT NULL REFERENCES public.discussion_replies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(reply_id, user_id)
);

-- Enable RLS
ALTER TABLE public.discussion_reply_likes ENABLE ROW LEVEL SECURITY;

-- Policies for reply likes
CREATE POLICY "Anyone can view reply likes" 
  ON public.discussion_reply_likes FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can like replies" 
  ON public.discussion_reply_likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike replies" 
  ON public.discussion_reply_likes FOR DELETE 
  USING (auth.uid() = user_id);

-- Enable realtime for discussion tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_replies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_reply_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.news_sentiment;

-- Set REPLICA IDENTITY FULL for complete row data in realtime
ALTER TABLE public.discussion_posts REPLICA IDENTITY FULL;
ALTER TABLE public.discussion_replies REPLICA IDENTITY FULL;
ALTER TABLE public.discussion_post_likes REPLICA IDENTITY FULL;
ALTER TABLE public.discussion_reply_likes REPLICA IDENTITY FULL;
ALTER TABLE public.news_sentiment REPLICA IDENTITY FULL;