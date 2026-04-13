"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import { UserPlus, Shield, UsersRound, X, Mail, User, Check, Pencil } from "lucide-react";

const avatarColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

interface Props {
  profiles: Profile[];
  currentProfile: Profile | null;
  currentEmail: string | null;
}

export default function TeamClient({ profiles: initial, currentProfile, currentEmail }: Props) {
  const [profiles, setProfiles] = useState(initial);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Profile editing
  const [editingName, setEditingName] = useState(false);
  const [firstName, setFirstName] = useState(currentProfile?.full_name?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(currentProfile?.full_name?.split(" ").slice(1).join(" ") ?? "");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const isAdmin = currentProfile?.role === "admin";
  const maxSeats = 10;
  const isFull = profiles.length >= maxSeats;

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setInviteMsg({ text: `Einladung an ${inviteEmail} gesendet!`, ok: true });
      setInviteEmail("");
    } catch (e: any) {
      setInviteMsg({ text: `Fehler: ${e.message}`, ok: false });
    } finally {
      setInviting(false);
    }
  }

  async function handleSaveName() {
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!fullName || !currentProfile) return;
    setSavingName(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", currentProfile.id);
    setProfiles((prev) =>
      prev.map((p) => p.id === currentProfile.id ? { ...p, full_name: fullName } : p)
    );
    setSavingName(false);
    setEditingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2500);
  }

  async function handleRoleToggle(profile: Profile) {
    const newRole = profile.role === "admin" ? "member" : "admin";
    const supabase = createClient();
    await supabase.from("profiles").update({ role: newRole }).eq("id", profile.id);
    setProfiles((prev) => prev.map((p) => p.id === profile.id ? { ...p, role: newRole } : p));
  }

  const myProfile = profiles.find((p) => p.id === currentProfile?.id);

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{profiles.length}/{maxSeats} Teammitglieder</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowInviteModal(true); setInviteMsg(null); setInviteEmail(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <UserPlus className="w-4 h-4" />
            Mitglied einladen
          </button>
        )}
      </div>

      {/* Capacity bar */}
      <div className="bg-card border rounded-xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <UsersRound className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Benutzerkapazität</p>
            <p className="text-xs text-muted-foreground">{profiles.length} / {maxSeats} Plätze belegt</p>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${(profiles.length / maxSeats) * 100}%` }}
          />
        </div>
      </div>

      {/* My Profile */}
      <div className="bg-card border rounded-xl mb-4">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Mein Profil</h2>
          {nameSaved && (
            <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600">
              <Check className="w-3 h-3" /> Gespeichert
            </span>
          )}
        </div>
        <div className="px-5 py-4 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg shrink-0"
            style={{ background: avatarColors[0] }}
          >
            {([firstName, lastName].filter(Boolean).join(" ") || currentProfile?.full_name || "?")?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            {editingName ? (
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    placeholder="Vorname"
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  />
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                    placeholder="Nachname"
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    {savingName ? "..." : "Speichern"}
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="px-3 py-1.5 border rounded-lg text-xs hover:bg-accent transition"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div>
                  <p className="font-medium text-sm">
                    {myProfile?.full_name || currentProfile?.full_name || "(kein Name)"}
                  </p>
                  {currentEmail && (
                    <p className="text-xs text-muted-foreground">{currentEmail}</p>
                  )}
                  <p className="text-xs text-muted-foreground capitalize">{currentProfile?.role}</p>
                </div>
                <button
                  onClick={() => {
                    const name = currentProfile?.full_name ?? "";
                    setFirstName(name.split(" ")[0] ?? "");
                    setLastName(name.split(" ").slice(1).join(" ") ?? "");
                    setEditingName(true);
                  }}
                  className="ml-2 p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition"
                  title="Name bearbeiten"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team members */}
      <div className="bg-card border rounded-xl">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Teammitglieder</h2>
        </div>
        <div className="divide-y">
          {profiles.map((p, i) => {
            const color = avatarColors[i % avatarColors.length];
            const isMe = p.id === currentProfile?.id;
            return (
              <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white shrink-0"
                    style={{ background: color }}
                  >
                    {p.full_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {p.full_name || "(kein Name)"}
                      {isMe && <span className="ml-2 text-xs text-muted-foreground">(Du)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{p.role}</p>
                  </div>
                </div>
                {isAdmin && !isMe && (
                  <button
                    onClick={() => handleRoleToggle(p)}
                    className="text-xs px-3 py-1.5 border rounded-lg hover:bg-accent transition-colors"
                  >
                    {p.role === "admin" ? "Zu Member" : "Zu Admin"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Mitglied einladen</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-5">
              Eine Einladung wird per E-Mail verschickt. Das neue Mitglied erhält einen Link zur Registrierung.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">E-Mail-Adresse</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="kollegin@firma.de"
                  disabled={isFull}
                  className="w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>
              {isFull && (
                <p className="text-xs text-amber-600 mt-1.5">Maximale Teamgröße ({maxSeats}) erreicht.</p>
              )}
            </div>

            {inviteMsg && (
              <div className={`px-4 py-3 rounded-xl text-sm mb-4 ${inviteMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {inviteMsg.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 py-2.5 border rounded-xl text-sm hover:bg-accent transition"
              >
                Schließen
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || isFull || !inviteEmail.trim()}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                {inviting ? "Senden..." : "Einladung senden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
