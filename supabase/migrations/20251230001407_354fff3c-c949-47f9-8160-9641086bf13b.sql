-- Allow authenticated users to create stock channels
CREATE POLICY "Authenticated users can create stock channels" 
ON public.discussion_channels 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND channel_type = 'stock');