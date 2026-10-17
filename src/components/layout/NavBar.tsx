import { useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { useAuthStore } from "@/lib/store/auth.store";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserResponseDto } from "@/types/user";

/** Topbar account menu: user name + role badge + Change Password / Logout. */
export function Navbar({ user }: { user: UserResponseDto }) {
  const navigate = useNavigate();
  const clearSession = useAuthStore((state) => state.clearSession);

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex items-center gap-2">
      <div className="hidden items-center gap-2 sm:flex">
        <span className="text-sm font-medium">{user.name}</span>
        <Badge variant="secondary">{user.role}</Badge>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Account menu"
        >
          <Settings className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="sm:hidden">
              {user.name}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/settings/password")}>
              Change Password
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOut className="size-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
