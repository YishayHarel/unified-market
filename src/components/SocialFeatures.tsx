import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Heart, 
  MessageCircle, 
  UserPlus,
  UserMinus,
  User,
  MessageSquare,
  Clock
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface FollowedUser {
  user_id: string;
  display_name: string;
  posts_count: number;
  replies_count: number;
  followers_count: number;
}

interface ActivityItem {
  id: string;
  type: 'post' | 'reply';
  user_id: string;
  author_name: string;
  title?: string;
  content: string;
  likes_count: number;
  created_at: string;
  channel_name?: string;
}

const SocialFeatures = () => {
  const [following, setFollowing] = useState<FollowedUser[]>([]);
  const [followers, setFollowers] = useState<FollowedUser[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FollowedUser[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchFollowing();
      fetchFollowers();
    }
  }, [user]);

  useEffect(() => {
    if (followingIds.size > 0) {
      fetchFollowingActivity();
    }
  }, [followingIds]);

  const fetchFollowing = async () => {
    if (!user) return;
    try {
      // Get who I'm following
      const { data: followsData } = await supabase
        .from('social_follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingUserIds = followsData?.map(f => f.following_id) || [];
      setFollowingIds(new Set(followingUserIds));

      if (followingUserIds.length === 0) {
        setFollowing([]);
        return;
      }

      // Get profiles and stats for followed users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', followingUserIds);

      // Get post counts
      const { data: posts } = await supabase
        .from('discussion_posts')
        .select('user_id')
        .in('user_id', followingUserIds);

      // Get reply counts
      const { data: replies } = await supabase
        .from('discussion_replies')
        .select('user_id')
        .in('user_id', followingUserIds);

      // Get follower counts
      const { data: allFollows } = await supabase
        .from('social_follows')
        .select('following_id')
        .in('following_id', followingUserIds);

      // Aggregate stats
      const stats = new Map<string, { posts: number; replies: number; followers: number }>();
      followingUserIds.forEach(id => stats.set(id, { posts: 0, replies: 0, followers: 0 }));

      posts?.forEach(p => {
        const s = stats.get(p.user_id);
        if (s) s.posts++;
      });

      replies?.forEach(r => {
        const s = stats.get(r.user_id);
        if (s) s.replies++;
      });

      allFollows?.forEach(f => {
        const s = stats.get(f.following_id);
        if (s) s.followers++;
      });

      const followingData: FollowedUser[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        display_name: p.display_name || 'Anonymous',
        posts_count: stats.get(p.user_id)?.posts || 0,
        replies_count: stats.get(p.user_id)?.replies || 0,
        followers_count: stats.get(p.user_id)?.followers || 0
      }));

      setFollowing(followingData);
    } catch (error) {
      console.error('Error fetching following:', error);
    }
  };

  const fetchFollowers = async () => {
    if (!user) return;
    try {
      const { data: followsData } = await supabase
        .from('social_follows')
        .select('follower_id')
        .eq('following_id', user.id);

      const followerIds = followsData?.map(f => f.follower_id) || [];

      if (followerIds.length === 0) {
        setFollowers([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', followerIds);

      const followersData: FollowedUser[] = (profiles || []).map(p => ({
        user_id: p.user_id,
        display_name: p.display_name || 'Anonymous',
        posts_count: 0,
        replies_count: 0,
        followers_count: 0
      }));

      setFollowers(followersData);
    } catch (error) {
      console.error('Error fetching followers:', error);
    }
  };

  const fetchFollowingActivity = async () => {
    if (followingIds.size === 0) return;

    try {
      const userIds = Array.from(followingIds);

      // Fetch recent posts from followed users
      const { data: postsData } = await supabase
        .from('discussion_posts')
        .select('id, user_id, title, content, likes_count, created_at, channel_id')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch recent replies from followed users
      const { data: repliesData } = await supabase
        .from('discussion_replies')
        .select('id, user_id, content, likes_count, created_at, post_id')
        .in('user_id', userIds)
        .order('created_at', { ascending: false })
        .limit(20);

      // Get author names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name || 'Anonymous']) || []);

      const activityItems: ActivityItem[] = [
        ...(postsData || []).map(p => ({
          id: p.id,
          type: 'post' as const,
          user_id: p.user_id,
          author_name: profileMap.get(p.user_id) || 'Anonymous',
          title: p.title,
          content: p.content,
          likes_count: p.likes_count,
          created_at: p.created_at
        })),
        ...(repliesData || []).map(r => ({
          id: r.id,
          type: 'reply' as const,
          user_id: r.user_id,
          author_name: profileMap.get(r.user_id) || 'Anonymous',
          content: r.content,
          likes_count: r.likes_count,
          created_at: r.created_at
        }))
      ];

      // Sort by date
      activityItems.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setActivity(activityItems.slice(0, 30));
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .ilike('display_name', `%${searchQuery}%`)
        .neq('user_id', user?.id || '')
        .limit(10);

      if (error) throw error;

      const results: FollowedUser[] = (data || []).map(u => ({
        user_id: u.user_id,
        display_name: u.display_name || 'Anonymous',
        posts_count: 0,
        replies_count: 0,
        followers_count: 0
      }));

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFollow = async (userId: string) => {
    if (!user) return;

    const isCurrentlyFollowing = followingIds.has(userId);

    try {
      if (isCurrentlyFollowing) {
        await supabase
          .from('social_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        setFollowingIds(prev => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        setFollowing(prev => prev.filter(u => u.user_id !== userId));
      } else {
        await supabase
          .from('social_follows')
          .insert({ follower_id: user.id, following_id: userId });

        setFollowingIds(prev => new Set(prev).add(userId));
      }

      // Update search results
      setSearchResults(prev => prev.filter(u => u.user_id !== userId));

      toast({
        title: isCurrentlyFollowing ? "Unfollowed" : "Following",
        description: isCurrentlyFollowing ? "You unfollowed this user" : "You're now following this user"
      });

      if (!isCurrentlyFollowing) {
        fetchFollowing();
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({ title: "Error", description: "Failed to update follow", variant: "destructive" });
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Please sign in to access social features.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Find Traders to Follow
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
            />
            <Button onClick={searchUsers} disabled={loading}>
              Search
            </Button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((u) => (
                <Card key={u.user_id}>
                  <CardContent className="py-3 px-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium">{u.display_name}</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => toggleFollow(u.user_id)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Follow
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs for Following/Followers/Activity */}
      <Tabs defaultValue="activity" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="activity">
            <MessageSquare className="h-4 w-4 mr-2" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="following">
            Following ({following.length})
          </TabsTrigger>
          <TabsTrigger value="followers">
            Followers ({followers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-4 space-y-3">
          {activity.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No activity from people you follow yet.</p>
                <p className="text-sm">Follow traders to see their posts and replies here!</p>
              </CardContent>
            </Card>
          ) : (
            activity.map((item) => (
              <Card key={`${item.type}-${item.id}`} className="hover:bg-muted/50 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{item.author_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {item.type === 'post' ? 'Posted' : 'Replied'}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimeAgo(item.created_at)}
                        </span>
                      </div>
                      {item.title && (
                        <h4 className="font-medium mb-1">{item.title}</h4>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {item.likes_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="following" className="mt-4 space-y-2">
          {following.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>You're not following anyone yet.</p>
                <p className="text-sm">Search for traders above to start following!</p>
              </CardContent>
            </Card>
          ) : (
            following.map((u) => (
              <Card key={u.user_id}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">{u.display_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.posts_count} posts • {u.replies_count} replies • {u.followers_count} followers
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleFollow(u.user_id)}
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Unfollow
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="followers" className="mt-4 space-y-2">
          {followers.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No followers yet.</p>
                <p className="text-sm">Share great insights in discussions to grow your following!</p>
              </CardContent>
            </Card>
          ) : (
            followers.map((u) => (
              <Card key={u.user_id}>
                <CardContent className="py-3 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="font-semibold">{u.display_name}</div>
                  </div>
                  {!followingIds.has(u.user_id) && (
                    <Button
                      size="sm"
                      onClick={() => toggleFollow(u.user_id)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Follow Back
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SocialFeatures;