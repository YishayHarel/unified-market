import { Home, Calendar, DollarSign, Newspaper, TrendingUp, Bot, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navigationItems = [
  { name: "Home", path: "/", icon: Home },
  { name: "Earnings", path: "/earnings", icon: Calendar },
  { name: "Dividends", path: "/dividends", icon: DollarSign },
  { name: "News", path: "/news", icon: Newspaper },
  { name: "Markets", path: "/markets", icon: TrendingUp },
  { name: "YishAI", path: "/yishai", icon: Bot },
  { name: "Settings", path: "/settings", icon: Settings },
];

const BottomNavigation = () => {
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-2 z-50">
      <div className="flex justify-around items-center max-w-md mx-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.name}
              to={item.path}
              className={cn(
                "flex flex-col items-center py-2 px-3 rounded-lg transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={20} />
              <span className="text-xs mt-1">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation;