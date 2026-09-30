"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, Search, X } from "lucide-react";
import type { Profile } from "@/types";
import Avatar from "@/components/Avatar";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  profiles: Profile[];
  initialSelectedIds: string[];
  confirmLabel?: string;
  onConfirm: (selectedIds: string[]) => void | Promise<void>;
  onCancel: () => void;
}

export default function ParticipantsModal({
  title,
  subtitle,
  profiles,
  initialSelectedIds,
  confirmLabel = "Übernehmen",
  onConfirm,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = profiles.filter((p) => (p.full_name || "").toLowerCase().includes(query.toLowerCase()));
  const allSelected = profiles.length > 0 && profiles.every((p) => selected.has(p.id));

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
    <Dialog.Root open onOpenChange={(open) => !open && !saving && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl focus:outline-none flex flex-col max-h-[85vh]">
          <div className="px-6 pt-5 pb-4 border-b border-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-lg font-semibold text-slate-800">{title}</Dialog.Title>
                {subtitle && <Dialog.Description className="text-sm text-slate-500 mt-0.5">{subtitle}</Dialog.Description>}
              </div>
              <Dialog.Close className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100" aria-label="Schließen">
                <X className="w-4 h-4" />
              </Dialog.Close>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Mitglied suchen…"
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <button
                onClick={() => setSelected(allSelected ? new Set() : new Set(profiles.map((p) => p.id)))}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap"
              >
                {allSelected ? "Keine" : "Alle"}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {filtered.map((p) => {
              const isSel = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  role="checkbox"
                  aria-checked={isSel}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                    isSel ? "bg-cyan-50" : "hover:bg-slate-50"
                  )}
                >
                  <Avatar name={p.full_name || "?"} avatarUrl={p.avatar_url} size={28} />
                  <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">{p.full_name || "(kein Name)"}</span>
                  <span
                    className={cn(
                      "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0",
                      isSel ? "bg-primary border-primary text-primary-foreground" : "border-slate-300"
                    )}
                  >
                    {isSel && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-slate-400 px-3 py-4 text-center">Keine Teammitglieder gefunden.</p>
            )}
          </div>

          <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-100">
            <span className="text-xs text-slate-500 mr-auto">{selected.size} ausgewählt</span>
            <button onClick={onCancel} className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              Abbrechen
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg font-semibold flex items-center gap-2 bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
