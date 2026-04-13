"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import { UserPlus, Shield, User } from "lucide-react";

interface Props {
  profiles: Profile[];
  currentProfile: Profile | null;
  currentUserId: string;
}

export default function SettingsClient({ profiles: initial, currentProfile, currentUserId }: Props) {
  const [profiles, setProfiles] = useState(initial);
  const [name, setName] = useState(currentProfile?.full_name ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  const isAdmin = currentProfile?.role === "admin";

  async function handleSaveProfile() {
    if (!name.trim()) return;
    setSavingProfile(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", currentUserId);
    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg("");
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setInviteMsg(`Einladung an ${inviteEmail} gesendet.`);
      setInviteEmail("");
    } catch (e: any) {
      setInviteMsg(`Fehler: ${e.message}`);
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleToggle(profile: Profile) {
    const newRole = profile.role === "admin" ? "member" : "admin";
    const supabase = createClient();
    await supabase.from("profiles").update({ role: newRole }).eq("id", profile.id);
    setProfiles((prev) => prev.map((p) => p.id === profile.id ? { ...p, role: newRole } : p));
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Einstellungen</h1>

      {/* Own Profile */}
      <section className="bg-card border rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <User className="w-4 h-4" /> Mein Profil
        </h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1.5">Anzeigename</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Dein Name"
            />
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50"
          >
            {profileSaved ? "Gespeichert!" : savingProfile ? "..." : "Speichern"}
          </button>
        </div>
      </section>

      {/* Team */}
      <section className="bg-card border rounded-xl p-6 mb-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Team ({profiles.length}/10)
        </h2>
        <div className="divide-y">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-sm">
                  {p.full_name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-medium">{p.full_name || "(kein Name)"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{p.role}</p>
                </div>
              </div>
              {isAdmin && p.id !== currentUserId && (
                <button
                  onClick={() => handleRoleToggle(p)}
                  className="text-xs px-3 py-1.5 border rounded-lg hover:bg-accent transition"
                >
                  {p.role === "admin" ? "Zu Member" : "Zu Admin"}
                </button>
              )}
              {p.id === currentUserId && (
                <span className="text-xs text-muted-foreground">Du</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Invite */}
      {isAdmin && (
        <section className="bg-card border rounded-xl p-6">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Benutzer einladen
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Lade neue Teammitglieder per E-Mail ein. (Maximal 10 Benutzer)
          </p>
          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              placeholder="email@firma.de"
              disabled={profiles.length >= 10}
              className="flex-1 px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={handleInvite}
              disabled={inviting || profiles.length >= 10}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {inviting ? "Senden..." : "Einladen"}
            </button>
          </div>
          {profiles.length >= 10 && (
            <p className="text-sm text-amber-600 mt-2">Maximale Teamgröße (10) erreicht.</p>
          )}
          {inviteMsg && (
            <p className={`text-sm mt-2 ${inviteMsg.startsWith("Fehler") ? "text-destructive" : "text-emerald-600"}`}>
              {inviteMsg}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
