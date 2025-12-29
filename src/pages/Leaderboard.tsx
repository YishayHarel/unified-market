import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  Trophy, 
  Medal, 
  Award, 
  TrendingUp, 
  Users,
  Target,
  User
} from "lucide-react";

interface LeaderboardUser {
  user_id: string;
  display_name: string;
  picks_count: number;
  followers_count: number;
  total_likes: number;
}

const Leaderboard = () => {
  const navigate = useNavigate();
  const [topByPicks, setTopByPicks] = useState<LeaderboardUser[]>([]);
  const [topByFollowers, setTopByFollowers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const fetchLeaderboards = async () => {
    try {
      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      if (!profiles) return;

      // Get picks counts per user
      const { data: picksData } = await supabase
        .from('social_picks')
        .select('user_id, likes_count')
        .eq('is_public', true);

      // Get followers counts per user
      const { data: followsData } = await supabase
        .from('social_follows')
        .select('following_id');

      // Aggregate data
      const userStats = new Map<string, { picks: number; likes: number; followers: number }>();

      profiles.forEach(p => {
        userStats.set(p.user_id, { picks: 0, likes: 0, followers: 0 });
      });

      picksData?.forEach(pick => {
        const current = userStats.get(pick.user_id) || { picks: 0, likes: 0, followers: 0 };
        userStats.set(pick.user_id, {
          ...current,
          picks: current.picks + 1,
          likes: current.likes + (pick.likes_count || 0)
        });
      });

      followsData?.forEach(follow => {
        const current = userStats.get(follow.following_id) || { picks: 0, likes: 0, followers: 0 };
        userStats.set(follow.following_id, {
          ...current,
          followers: current.followers + 1
        });
      });

      // Build leaderboard data
      const leaderboardData: LeaderboardUser[] = profiles.map(p => ({
        user_id: p.user_id,
        display_name: p.display_name || 'Anonymous',
        picks_count: userStats.get(p.user_id)?.picks || 0,
        followers_count: userStats.get(p.user_id)?.followers || 0,
        total_likes: userStats.get(p.user_id)?.likes || 0
      }));

      // Sort by picks
      const byPicks = [...leaderboardData]
        .filter(u => u.picks_count > 0)
        .sort((a, b) => b.picks_count - a.picks_count)
        .slice(0, 20);

      // Sort by followers
      const byFollowers = [...leaderboardData]
        .filter(u => u.followers_count > 0)
        .sort((a, b) => b.followers_count - a.followers_count)
        .slice(0, 20);

      setTopByPicks(byPicks);
      setTopByFollowers(byFollowers);
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

  const LeaderboardList = ({ users, metric }: { users: LeaderboardUser[]; metric: 'picks' | 'followers' }) => (
    <div className="space-y-2">
      {users.map((user, index) => (
        <Card 
          key={user.user_id} 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => navigate(`/profile/${user.user_id}`)}
        >
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-4">
              <div className="w-8 flex justify-center">
                {getRankIcon(index + 1)}
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">{user.display_name}</div>
                <div className="text-sm text-muted-foreground">
                  {metric === 'picks' ? (
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {user.picks_count} picks • {user.total_likes} likes
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {user.followers_count} followers
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="secondary">
                {metric === 'picks' ? user.picks_count : user.followers_count}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
      {users.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No traders on the leaderboard yet</p>
          <p className="text-sm">Start sharing picks to climb the ranks!</p>
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
          <p className="text-muted-foreground mt-2">Top traders in the community</p>
        </header>

        <Tabs defaultValue="picks" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="picks" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Most Active
            </TabsTrigger>
            <TabsTrigger value="followers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Most Followed
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="picks" className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <LeaderboardList users={topByPicks} metric="picks" />
            )}
          </TabsContent>
          
          <TabsContent value="followers" className="mt-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <LeaderboardList users={topByFollowers} metric="followers" />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Leaderboard;
