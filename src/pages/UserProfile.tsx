import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  User, 
  UserPlus, 
  UserMinus, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Calendar,
  Users,
  Target,
  ArrowLeft
} from "lucide-react";

interface UserProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

interface UserPick {
  id: string;
  symbol: string;
  pick_type: string;
  reasoning: string;
  target_price: number | null;
  confidence_level: number;
  likes_count: number;
  created_at: string;
}

interface UserStats {
  totalPicks: number;
  followers: number;
  following: number;
}

const UserProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [picks, setPicks] = useState<UserPick[]>([]);
  const [stats, setStats] = useState<UserStats>({ totalPicks: 0, followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchPicks();
      fetchStats();
      if (currentUser) {
        checkFollowStatus();
      }
    }
  }, [userId, currentUser]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPicks = async () => {
    try {
      const { data, error } = await supabase
        .from('social_picks')
        .select('*')
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPicks(data || []);
    } catch (error) {
      console.error('Error fetching picks:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Get picks count
      const { count: picksCount } = await supabase
        .from('social_picks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_public', true);

      // Get followers count
      const { count: followersCount } = await supabase
        .from('social_follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);

      // Get following count
      const { count: followingCount } = await supabase
        .from('social_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);

      setStats({
        totalPicks: picksCount || 0,
        followers: followersCount || 0,
        following: followingCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const checkFollowStatus = async () => {
    if (!currentUser) return;
    
    try {
      const { data } = await supabase
        .from('social_follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', userId)
        .single();

      setIsFollowing(!!data);
    } catch (error) {
      // Not following
      setIsFollowing(false);
    }
  };

  const toggleFollow = async () => {
    if (!currentUser) {
      toast({ title: "Please sign in to follow users", variant: "destructive" });
      return;
    }

    try {
      if (isFollowing) {
        await supabase
          .from('social_follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId);
        
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: prev.followers - 1 }));
        toast({ title: "Unfollowed" });
      } else {
        await supabase
          .from('social_follows')
          .insert({ follower_id: currentUser.id, following_id: userId });
        
        setIsFollowing(true);
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
        toast({ title: "Following!" });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({ title: "Failed to update follow status", variant: "destructive" });
    }
  };

  const getPickTypeIcon = (pickType: string) => {
    switch (pickType) {
      case 'buy': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'sell': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'hold': return <Eye className="h-4 w-4 text-blue-500" />;
      default: return <Eye className="h-4 w-4" />;
    }
  };

  const getConfidenceStars = (level: number) => {
    return '★'.repeat(level) + '☆'.repeat(5 - level);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 pb-24 flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-6 pb-24">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="text-center py-12">
          <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-xl font-semibold">User not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {/* Profile Header */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{profile.display_name || 'Anonymous Trader'}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Joined {new Date(profile.created_at).toLocaleDateString()}
                </p>
                
                {currentUser && currentUser.id !== userId && (
                  <Button 
                    onClick={toggleFollow}
                    variant={isFollowing ? "outline" : "default"}
                    className="mt-3"
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4 mr-2" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.totalPicks}</div>
                <div className="text-sm text-muted-foreground">Picks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.followers}</div>
                <div className="text-sm text-muted-foreground">Followers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.following}</div>
                <div className="text-sm text-muted-foreground">Following</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Picks */}
        <Card>
          <CardHeader>
            <CardTitle>Stock Picks</CardTitle>
          </CardHeader>
          <CardContent>
            {picks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No public picks yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {picks.map((pick) => (
                  <Card key={pick.id} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        {getPickTypeIcon(pick.pick_type)}
                        <Badge variant={pick.pick_type === 'buy' ? 'default' : pick.pick_type === 'sell' ? 'destructive' : 'secondary'}>
                          {pick.pick_type.toUpperCase()}
                        </Badge>
                        <span className="font-bold text-lg">{pick.symbol}</span>
                        {pick.target_price && (
                          <span className="text-sm text-muted-foreground">
                            Target: ${pick.target_price}
                          </span>
                        )}
                      </div>
                      <p className="text-sm mb-2">{pick.reasoning}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Confidence: {getConfidenceStars(pick.confidence_level)}</span>
                        <span>{new Date(pick.created_at).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserProfilePage;
