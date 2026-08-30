-- Make community content readable without an account.
--
-- Discussions, the leaderboard and Bull/Bear tallies were all gated behind
-- auth.uid() IS NOT NULL, while the pages showing them are publicly routable.
-- The result read as an empty product: "No posts in this channel yet" when
-- posts existed, and "No activity on the leaderboard" when there was activity.
-- A visitor could not tell the community was there, which is the opposite of
-- what a forum is for.
--
-- Writing still requires an account: only the read policies change here.
-- Display names become publicly visible, which is the accepted trade for a
-- readable forum.

-- Discussion posts and replies.
drop policy if exists "Posts are viewable by authenticated users" on public.discussion_posts;
drop policy if exists "Discussion posts are publicly readable" on public.discussion_posts;
create policy "Discussion posts are publicly readable"
  on public.discussion_posts for select using (true);

drop policy if exists "Replies are viewable by authenticated users" on public.discussion_replies;
drop policy if exists "Discussion replies are publicly readable" on public.discussion_replies;
create policy "Discussion replies are publicly readable"
  on public.discussion_replies for select using (true);

-- Like counts, so a visitor sees engagement rather than zeros.
drop policy if exists "Likes are viewable by authenticated users" on public.discussion_post_likes;
drop policy if exists "Post likes are publicly readable" on public.discussion_post_likes;
create policy "Post likes are publicly readable"
  on public.discussion_post_likes for select using (true);

drop policy if exists "Reply likes are viewable by authenticated users" on public.discussion_reply_likes;
drop policy if exists "Reply likes are publicly readable" on public.discussion_reply_likes;
create policy "Reply likes are publicly readable"
  on public.discussion_reply_likes for select using (true);

-- Author names for posts and the leaderboard. profiles holds only a display
-- name and avatar; account email lives in auth.users and stays private.
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
drop policy if exists "Profiles are publicly readable" on public.profiles;
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

-- Shared picks and the follow graph, which the social page presents as public.
drop policy if exists "Picks are viewable by authenticated users" on public.social_picks;
drop policy if exists "Social picks are publicly readable" on public.social_picks;
create policy "Social picks are publicly readable"
  on public.social_picks for select using (true);

drop policy if exists "Follows are viewable by authenticated users" on public.social_follows;
drop policy if exists "Social follows are publicly readable" on public.social_follows;
create policy "Social follows are publicly readable"
  on public.social_follows for select using (true);

-- Bull/Bear tallies on news. The aggregate was already shown to everyone via
-- the edge function's service-role read; this lets the client show it too.
drop policy if exists "Sentiment is viewable by authenticated users" on public.news_sentiment;
drop policy if exists "News sentiment is publicly readable" on public.news_sentiment;
create policy "News sentiment is publicly readable"
  on public.news_sentiment for select using (true);
