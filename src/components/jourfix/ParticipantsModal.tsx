"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { Profile } from "@/types";

interface Props {
  title: string;
  subtitle?: string;
  profiles: Profile[];
  initialSelectedIds: string[];
  onConfirm: (selectedIds: string[]) => void | Promise<void>;
  onCancel: () => void;
}

export default function ParticipantsModal({ title, subtitle, profiles, initialSelectedIds, onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    setSaving(true);
    await onConfirm([...selected]);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onCancel}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        {subtitle && <p className="text-sm text-slate-500 mb-4">{subtitle}</p>}

        <div className="max-h-72 overflow-y-auto space-y-1 mt-3">
          {profiles.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="w-4 h-4 rounded border-slate-300"
                style={{ accentColor: "#00ffff" }}
              />
              <span className="text-sm text-slate-700">{p.full_name || "(kein Name)"}</span>
            </label>
          ))}
          {profiles.length === 0 && (
            <p className="text-sm text-slate-400 px-3 py-2">Keine Teammitglieder gefunden.</p>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 px-4 py-2 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: "#00ffff", color: "#000000" }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
