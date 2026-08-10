"use client";

import { Bell, Search, Menu, X, CheckCircle2, Clock, AlertCircle, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/types";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const avatarColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const notifications = [
  {
    id: 1,
    type: "success" as const,
    title: "Aufgabe abgeschlossen",
    message: "Website Redesign wurde als erledigt markiert",
    time: "Vor 5 Minuten",
    icon: CheckCircle2,
  },
  {
    id: 2,
    type: "warning" as const,
    title: "Frist läuft bald ab",
    message: "Mobile App Development - Deadline in 2 Tagen",
    time: "Vor 1 Stunde",
    icon: Clock,
  },
  {
    id: 3,
    type: "info" as const,
    title: "Neuer Kommentar",
    message: "Sarah hat einen Kommentar zu API Integration hinterlassen",
    time: "Vor 3 Stunden",
    icon: AlertCircle,
  },
];

const colorMap = {
  success: "text-emerald-500 bg-emerald-50",
  warning: "text-amber-500 bg-amber-50",
  info: "text-slate-600 bg-slate-100",
};

export default function Topbar({
  profile,
  sidebarOpen,
  onSidebarToggle,
}: {
  profile: Profile | null;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const colorIndex = profile?.full_name ? profile.full_name.charCodeAt(0) % avatarColors.length : 0;
  const avatarColor = avatarColors[colorIndex];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    if (notificationsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notificationsOpen]);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0 relative">
      {/* Sidebar toggle */}
      {onSidebarToggle && (
        <button
          onClick={onSidebarToggle}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}

      {/* Search */}
      <div className="flex-1 flex items-center gap-3">
        <div className="relative max-w-xs w-full hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Suchen..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-700 placeholder-slate-400 border border-transparent focus:outline-none focus:bg-white transition-all"
            onFocus={(e) => {
              e.target.style.borderColor = "#00ffff";
              e.target.style.boxShadow = "0 0 0 2px #00ffff30";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "transparent";
              e.target.style.boxShadow = "";
            }}
          />
        </div>
      </div>

      {/* Bell */}
      <div className="relative" ref={notificationRef}>
        <button
          onClick={() => setNotificationsOpen((v) => !v)}
          className="relative text-slate-400 hover:text-slate-600 transition-colors p-2"
        >
          <Bell className="w-5 h-5" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: "#00ffff" }}
          />
        </button>

        {/* Notifications dropdown */}
        {notificationsOpen && (
          <div className="absolute top-12 right-0 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Benachrichtigungen</h3>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium text-black"
                style={{ backgroundColor: "#00ffff" }}
              >
                {notifications.length} Neu
              </span>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notif) => {
                const Icon = notif.icon;
                return (
                  <div
                    key={notif.id}
                    className="p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0 cursor-pointer group"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[notif.type]}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-slate-800 mb-0.5">{notif.title}</h4>
                        <p className="text-sm text-slate-500 mb-1">{notif.message}</p>
                        <span className="text-xs text-slate-400">{notif.time}</span>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <button
                className="w-full text-sm font-medium py-2 hover:bg-white rounded-lg transition-colors"
                style={{ color: "#00aaaa" }}
              >
                Alle als gelesen markieren
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User */}
      {profile && (
        <button
          onClick={() => router.push("/profile")}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: avatarColor }}
          >
            {getInitials(profile.full_name || "?")}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-sm font-medium text-slate-700 group-hover:text-[#009999] transition-colors">
              {profile.full_name?.split(" ")[0] || "Benutzer"}
            </div>
            <div className="text-xs text-slate-400 capitalize">{profile.role ?? "member"}</div>
          </div>
        </button>
      )}
    </header>
  );
}
