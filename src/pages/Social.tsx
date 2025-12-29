import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import SocialFeatures from "@/components/SocialFeatures";

const Social = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24 space-y-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold">👥 Social Trading</h1>
        <p className="text-muted-foreground mt-2">Connect with traders and share your picks</p>
        <div className="flex justify-center gap-2 mt-4">
          <Button asChild variant="outline">
            <Link to="/leaderboard">
              <Trophy className="h-4 w-4 mr-2" />
              Leaderboard
            </Link>
          </Button>
        </div>
      </header>
      
      <SocialFeatures />
    </div>
  );
};

export default Social;
