"use client";

import { useState } from "react";
import { User2, Mail, Lock, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const avatarColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function ProfileClient({
  profile: initialProfile,
  email,
}: {
  profile: Profile | null;
  email: string | null;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const colorIndex = profile?.full_name ? profile.full_name.charCodeAt(0) % avatarColors.length : 0;
  const avatarColor = avatarColors[colorIndex];

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("profiles")
      .update({ full_name: form.full_name })
      .eq("id", profile.id)
      .select()
      .single();
    if (error) {
      setMessage({ type: "error", text: "Fehler beim Speichern" });
    } else {
      setProfile(data);
      setEditing(false);
      setMessage({ type: "success", text: "Profil erfolgreich aktualisiert" });
    }
    setSaving(false);
  };

  const handleResetPassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "Passwörter stimmen nicht überein" });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setMessage({ type: "error", text: "Passwort muss mindestens 6 Zeichen lang sein" });
      return;
    }
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
    if (error) {
      setMessage({ type: "error", text: "Fehler beim Zurücksetzen des Passworts" });
    } else {
      setMessage({ type: "success", text: "Passwort erfolgreich zurückgesetzt" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    }
    setSaving(false);
  };

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Benutzerprofil</h1>
        <p className="text-slate-500 mt-1">Verwalte deine persönlichen Informationen</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div
          className="h-32 relative"
          style={{ background: "linear-gradient(135deg, #283737 0%, #565656 100%)" }}
        >
          <div className="absolute -bottom-12 left-6">
            <div
              className="w-24 h-24 rounded-full border-4 border-white flex items-center justify-center text-white text-2xl font-bold shadow-lg"
              style={{ backgroundColor: avatarColor }}
            >
              {getInitials(profile.full_name || "?")}
            </div>
          </div>
        </div>

        <div className="pt-16 pb-6 px-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{profile.full_name}</h2>
              <p className="text-sm text-slate-500">{email}</p>
              <span
                className={`inline-block mt-2 text-xs px-2 py-1 rounded-full font-medium ${
                  profile.role === "admin" ? "text-black" : "bg-slate-100 text-slate-600"
                }`}
                style={profile.role === "admin" ? { backgroundColor: "#00ffff" } : {}}
              >
                {profile.role === "admin" ? "Administrator" : "Mitglied"}
              </span>
            </div>
            {!editing && (
              <button
                onClick={() => {
                  setForm({ full_name: profile.full_name || "" });
                  setEditing(true);
                }}
                className="px-4 py-2 text-sm rounded-lg font-semibold transition-colors"
                style={{ backgroundColor: "#00ffff", color: "#000000" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00e5e5")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00ffff")}
              >
                Bearbeiten
              </button>
            )}
          </div>

          {editing && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <div className="relative">
                  <User2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none"
                    onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff50")}
                    onBlur={(e) => (e.target.style.boxShadow = "")}
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-Mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none bg-slate-50"
                    value={email || ""}
                    disabled
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">E-Mail kann nicht geändert werden</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Abbrechen
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
                  style={{ backgroundColor: "#00ffff", color: "#000000" }}
                  onMouseEnter={(e) => !saving && ((e.currentTarget as HTMLElement).style.backgroundColor = "#00e5e5")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00ffff")}
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Speichert..." : "Speichern"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Reset */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-1">Passwort zurücksetzen</h3>
        <p className="text-sm text-slate-500 mb-4">Ändere dein Passwort für mehr Sicherheit</p>

        <div className="space-y-4">
          {[
            { key: "currentPassword", label: "Aktuelles Passwort", placeholder: "••••••••" },
            { key: "newPassword", label: "Neues Passwort", placeholder: "••••••••" },
            { key: "confirmPassword", label: "Neues Passwort bestätigen", placeholder: "••••••••" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none"
                  onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff50")}
                  onBlur={(e) => (e.target.style.boxShadow = "")}
                  value={passwordForm[key as keyof typeof passwordForm]}
                  onChange={(e) => setPasswordForm({ ...passwordForm, [key]: e.target.value })}
                  placeholder={placeholder}
                />
              </div>
            </div>
          ))}

          <button
            onClick={handleResetPassword}
            disabled={
              saving ||
              !passwordForm.currentPassword ||
              !passwordForm.newPassword ||
              !passwordForm.confirmPassword
            }
            className="w-full px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            style={{ backgroundColor: "#283737", color: "#ffffff" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#1a2626")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#283737")}
          >
            {saving ? "Wird zurückgesetzt..." : "Passwort zurücksetzen"}
          </button>
        </div>
      </div>
    </div>
  );
}
