import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  Trophy, 
  Medal, 
  Award, 
  MessageSquare,
  Users,
  Heart,
  User,
  TrendingUp
} from "lucide-react";

interface LeaderboardUser {
  user_id: string;
  display_name: string;
  posts_count: number;
  replies_count: number;
  likes_received: number;
  engagement_score: number;
}

const Leaderboard = () => {
  const navigate = useNavigate();
  const [topByEngagement, setTopByEngagement] = useState<LeaderboardUser[]>([]);
  const [topByPosts, setTopByPosts] = useState<LeaderboardUser[]>([]);
  const [topByLikes, setTopByLikes] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const fetchLeaderboards = async () => {
    try {
      // Get all profiles (public data)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      if (!profiles) return;

      // Get posts counts and likes per user (public)
      const { data: postsData } = await supabase
        .from('discussion_posts')
        .select('user_id, likes_count');

      // Get replies counts and likes per user (public)
      const { data: repliesData } = await supabase
        .from('discussion_replies')
        .select('user_id, likes_count');

      // Aggregate data - only public activity
      const userStats = new Map<string, { posts: number; replies: number; likes: number }>();

      profiles.forEach(p => {
        userStats.set(p.user_id, { posts: 0, replies: 0, likes: 0 });
      });

      postsData?.forEach(post => {
        const current = userStats.get(post.user_id) || { posts: 0, replies: 0, likes: 0 };
        userStats.set(post.user_id, {
          ...current,
          posts: current.posts + 1,
          likes: current.likes + (post.likes_count || 0)
        });
      });

      repliesData?.forEach(reply => {
        const current = userStats.get(reply.user_id) || { posts: 0, replies: 0, likes: 0 };
        userStats.set(reply.user_id, {
          ...current,
          replies: current.replies + 1,
          likes: current.likes + (reply.likes_count || 0)
        });
      });

      // Build leaderboard data
      const leaderboardData: LeaderboardUser[] = profiles.map(p => {
        const stats = userStats.get(p.user_id) || { posts: 0, replies: 0, likes: 0 };
        // Engagement score: posts worth 3, replies worth 1, likes received worth 2
        const engagementScore = (stats.posts * 3) + (stats.replies * 1) + (stats.likes * 2);
        return {
          user_id: p.user_id,
          display_name: p.display_name || 'Anonymous',
          posts_count: stats.posts,
          replies_count: stats.replies,
          likes_received: stats.likes,
          engagement_score: engagementScore
        };
      });

      // Filter out users with no activity
      const activeUsers = leaderboardData.filter(u => u.engagement_score > 0);

      // Sort by engagement
      const byEngagement = [...activeUsers]
        .sort((a, b) => b.engagement_score - a.engagement_score)
        .slice(0, 20);

      // Sort by posts
      const byPosts = [...activeUsers]
        .filter(u => u.posts_count > 0)
        .sort((a, b) => b.posts_count - a.posts_count)
        .slice(0, 20);

      // Sort by likes received
      const byLikes = [...activeUsers]
        .filter(u => u.likes_received > 0)
        .sort((a, b) => b.likes_received - a.likes_received)
        .slice(0, 20);

      setTopByEngagement(byEngagement);
      setTopByPosts(byPosts);
      setTopByLikes(byLikes);
    } catch (error) {
      console.error('Error fetching leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2: return <Medal className="h-5 w-5 text-gray-400" />;
      case 3: return <Award className="h-5 w-5 text-amber-600" />;
      default: return <span className="w-5 text-center font-bold text-muted-foreground">{rank}</span>;
    }
  };

  const LeaderboardList = ({ 
    users, 
    metric 
  }: { 
    users: LeaderboardUser[]; 
    metric: 'engagement' | 'posts' | 'likes' 
  }) => (
    <div className="space-y-2">
      {users.map((user, index) => (
        <Card 
          key={user.user_id} 
          className="hover:bg-muted/50 transition-colors"
        >
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-4">
              <div className="w-8 flex justify-center">
                {getRankIcon(index + 1)}
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{user.display_name}</div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {user.posts_count} posts
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {user.replies_count} replies
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {user.likes_received} likes
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {metric === 'engagement' && user.engagement_score}
                {metric === 'posts' && user.posts_count}
                {metric === 'likes' && user.likes_received}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      {users.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No activity on the leaderboard yet</p>
          <p className="text-sm">Start posting in discussions to climb the ranks!</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2">Top contributors in the community</p>
          <p className="text-xs text-muted-foreground mt-1">Based on public posts, replies, and likes received</p>
        </header>

        <Tabs defaultValue="engagement" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="engagement" className="flex items-center gap-1 text-xs sm:text-sm">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Top</span> Engaged
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-1 text-xs sm:text-sm">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Most</span> Posts
            </TabsTrigger>
            <TabsTrigger value="likes" className="flex items-center gap-1 text-xs sm:text-sm">
              <Heart className="h-4 w-4" />
              <span className="hidden sm:inline">Most</span> Liked
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="engagement" className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <LeaderboardList users={topByEngagement} metric="engagement" />
            )}
          </TabsContent>
          
          <TabsContent value="posts" className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <LeaderboardList users={topByPosts} metric="posts" />
            )}
          </TabsContent>
          
          <TabsContent value="likes" className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <LeaderboardList users={topByLikes} metric="likes" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Leaderboard;