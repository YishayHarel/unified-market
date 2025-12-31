import { Home, Calendar, Newspaper, TrendingUp, Bot, Settings, Users, BarChart3, MessageSquare, DollarSign } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const navigationItems = [
  { name: "Home", path: "/", icon: Home },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Markets", path: "/markets", icon: TrendingUp },
  { name: "Earnings", path: "/earnings", icon: Calendar },
  { name: "Dividends", path: "/dividends", icon: DollarSign },
  { name: "News", path: "/news", icon: Newspaper },
  { name: "Discussions", path: "/discussions", icon: MessageSquare },
  { name: "Social", path: "/social", icon: Users },
  { name: "YishAI", path: "/yishai", icon: Bot },
  { name: "Settings", path: "/settings", icon: Settings },
];

const BottomNavigation = () => {
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <ScrollArea className="w-full">
        <div className="flex items-center px-2 py-2 gap-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex flex-col items-center py-2 px-3 rounded-lg transition-colors min-w-[60px] shrink-0",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon size={20} />
                <span className="text-xs mt-1 whitespace-nowrap">{item.name}</span>
              </Link>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};

export default BottomNavigation;