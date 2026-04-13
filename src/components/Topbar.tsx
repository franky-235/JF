"use client";

import { Bell, Search, X } from "lucide-react";
import { useState } from "react";
import type { Profile } from "@/types";

export default function Topbar({ profile }: { profile: Profile | null }) {
  const [searchValue, setSearchValue] = useState("");

  const avatarColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  const colorIndex = profile?.full_name
    ? profile.full_name.charCodeAt(0) % avatarColors.length
    : 0;
  const avatarColor = avatarColors[colorIndex];

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0">
      {/* Search */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Suchen..."
          className="pl-9 pr-8 py-1.5 text-sm bg-muted/60 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
        />
        {searchValue && (
          <button
            onClick={() => setSearchValue("")}
            className="absolute right-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Notification bell */}
        <button className="relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{ background: "#22d3ee" }}
          />
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm text-white"
            style={{ background: avatarColor }}
          >
            {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium leading-none">
              {profile?.full_name?.split(" ")[0] || "Benutzer"}
            </p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5">
              {profile?.role ?? "member"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
