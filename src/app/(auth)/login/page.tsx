"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Benutzer nicht gefunden");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #010707 0%, #565656 100%)" }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.svg"
              alt="nerds logo"
              width={160}
              height={50}
              priority
              className="brightness-0 invert"
            />
          </div>
          <p className="text-slate-300">Melde dich an um fortzufahren</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-slate-800 mb-6">Anmelden</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">E-Mail</label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.de"
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none"
                  onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff50")}
                  onBlur={(e) => (e.target.style.boxShadow = "")}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Passwort</label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none"
                  onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff50")}
                  onBlur={(e) => (e.target.style.boxShadow = "")}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#00ffff", color: "#000000" }}
              onMouseEnter={(e) => !loading && ((e.currentTarget as HTMLElement).style.backgroundColor = "#00e5e5")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00ffff")}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Anmeldung läuft...
                </>
              ) : (
                <>
                  Anmelden
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-500 text-center">
              Noch kein Zugang? Bitte kontaktiere deinen Administrator.
            </p>
          </div>
        </div>

        <p className="text-center text-slate-400 text-sm mt-6">
          © 2026 Entreprenerds – Projektmanagement Tool
        </p>
      </div>
    </div>
  );
}
