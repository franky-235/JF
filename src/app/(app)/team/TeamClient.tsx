"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import { UserPlus, Crown, User, Mail, Building, X, Check, Pencil, Loader2 } from "lucide-react";

const avatarColors = [
  "#6366f1", "#0EA5E9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
  "#f97316", "#84cc16",
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

interface Props {
  profiles: Profile[];
  currentProfile: Profile | null;
  currentEmail: string | null;
}

export default function TeamClient({ profiles: initial, currentProfile, currentEmail }: Props) {
  const [profiles, setProfiles] = useState(initial);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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

  async function handleSaveName(profileId: string) {
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!fullName) return;
    setSavingName(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", profileId);
    setProfiles((prev) => prev.map((p) => p.id === profileId ? { ...p, full_name: fullName } : p));
    setSavingName(false);
    setEditingId(null);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2500);
  }

  async function handleRoleToggle(profile: Profile) {
    const newRole = profile.role === "admin" ? "member" : "admin";
    const supabase = createClient();
    await supabase.from("profiles").update({ role: newRole }).eq("id", profile.id);
    setProfiles((prev) => prev.map((p) => p.id === profile.id ? { ...p, role: newRole } : p));
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Team</h1>
          <p className="text-sm text-slate-500">{profiles.length}/{maxSeats} Teammitglieder</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowInviteModal(true); setInviteMsg(null); setInviteEmail(""); }}
            disabled={isFull}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#00ffff", color: "#000000" }}
            onMouseEnter={(e) => !isFull && ((e.currentTarget as HTMLElement).style.backgroundColor = "#00e5e5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00ffff")}
          >
            <UserPlus className="w-4 h-4" />
            Mitglied einladen
          </button>
        )}
      </div>

      {/* Capacity bar */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 flex-shrink-0">
          <User className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-indigo-800">Benutzerkapazität</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-48 h-2 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${(profiles.length / maxSeats) * 100}%` }}
              />
            </div>
            <span className="text-xs text-indigo-600 font-medium">{profiles.length} / {maxSeats} Plätze belegt</span>
          </div>
        </div>
        {nameSaved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600 ml-auto">
            <Check className="w-3 h-3" /> Gespeichert
          </span>
        )}
      </div>

      {/* Grid of member cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((p, i) => {
          const color = avatarColors[i % avatarColors.length];
          const isMe = p.id === currentProfile?.id;
          const isEditing = editingId === p.id;

          return (
            <div
              key={p.id}
              className={`bg-white rounded-xl border-2 p-5 transition-all ${
                isMe ? "border-indigo-200 bg-indigo-50/30" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: color }}
                >
                  {getInitials(p.full_name || "?")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{p.full_name || "(kein Name)"}</h3>
                    {isMe && (
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">Ich</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {p.role === "admin" ? (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                        <Crown className="w-3 h-3" /> Administrator
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        <User className="w-3 h-3" /> Mitglied
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Edit name form */}
              {isEditing ? (
                <div className="mb-4 space-y-2">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(p.id); if (e.key === "Escape") setEditingId(null); }}
                      placeholder="Vorname"
                      className="flex-1 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(p.id); if (e.key === "Escape") setEditingId(null); }}
                      placeholder="Nachname"
                      className="flex-1 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveName(p.id)} disabled={savingName} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">
                      {savingName ? "..." : "Speichern"}
                    </button>
                    <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 border rounded-lg text-xs hover:bg-slate-50">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                    <span className="truncate">{isMe ? currentEmail : "(nicht sichtbar)"}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              {isAdmin && (
                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  {isMe && (
                    <button
                      onClick={() => {
                        setFirstName(p.full_name?.split(" ")[0] ?? "");
                        setLastName(p.full_name?.split(" ").slice(1).join(" ") ?? "");
                        setEditingId(p.id);
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Pencil className="w-3 h-3" /> Name bearbeiten
                    </button>
                  )}
                  {!isMe && (
                    <button
                      onClick={() => handleRoleToggle(p)}
                      className="flex-1 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      {p.role === "admin" ? "Zu Member" : "Zu Admin"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800">Mitglied einladen</h2>
              <button onClick={() => setShowInviteModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-5">
              Eine Einladung wird per E-Mail verschickt. Das neue Mitglied erhält einen Link zur Registrierung.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-Mail-Adresse</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  autoFocus
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="kollegin@firma.de"
                  disabled={isFull}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none disabled:opacity-50"
                  onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff50")}
                  onBlur={(e) => (e.target.style.boxShadow = "")}
                />
              </div>
              {isFull && <p className="text-xs text-amber-600 mt-1.5">Maximale Teamgröße ({maxSeats}) erreicht.</p>}
            </div>

            {inviteMsg && (
              <div className={`px-4 py-3 rounded-xl text-sm mb-4 ${inviteMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {inviteMsg.text}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowInviteModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition">
                Schließen
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting || isFull || !inviteEmail.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: "#00ffff", color: "#000000" }}
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {inviting ? "Senden..." : "Einladung senden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
