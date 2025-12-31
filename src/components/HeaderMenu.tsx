import { MoreVertical, TrendingUp, Calendar, Newspaper, Users, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const menuItems = [
  { name: "Markets", path: "/markets", icon: TrendingUp },
  { name: "Earnings", path: "/earnings", icon: Calendar },
  { name: "News", path: "/news", icon: Newspaper },
  { name: "Social", path: "/social", icon: Users },
];

const HeaderMenu = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <MoreVertical className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.name} asChild>
              <Link to={item.path} className="flex items-center gap-2 cursor-pointer">
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default HeaderMenu;
