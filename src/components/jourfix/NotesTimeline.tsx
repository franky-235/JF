"use client";

import { useState } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Gavel, Loader2, MessageSquareText, Pencil, PlusCircle, Trash2 } from "lucide-react";
import type { JourfixNote, JourfixTask, JourfixWeek, Profile } from "@/types";
import Avatar from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { weekNumber } from "./utils";

type NoteKind = JourfixNote["kind"];

export const noteKindMeta: Record<NoteKind, { label: string; icon: typeof Gavel; dot: string; badge: string }> = {
  note: { label: "Notiz", icon: MessageSquareText, dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600" },
  decision: { label: "Beschluss", icon: Gavel, dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
};

interface Props {
  task: JourfixTask;
  notes: JourfixNote[];
  profiles: Profile[];
  weeks: JourfixWeek[];
  currentUserId: string | null;
  isAdmin: boolean;
  onAdd: (kind: NoteKind, content: string) => Promise<boolean>;
  onUpdate: (noteId: string, content: string) => void;
  onDelete: (note: JourfixNote) => void;
}

function formatDateTime(iso: string) {
  return format(new Date(iso), "dd.MM.yyyy", { locale: de });
}

/** Chronologischer Verlauf: Aufgabe angelegt → Notizen/Beschlüsse, darunter Eingabe für neue Einträge. */
export default function NotesTimeline({ task, notes, profiles, weeks, currentUserId, isAdmin, onAdd, onUpdate, onDelete }: Props) {
  const creator = profiles.find((p) => p.id === task.created_by) ?? null;
  const weekStartById = new Map(weeks.map((w) => [w.id, w.week_start]));

  return (
    <div className="pt-3">
      <ol className="relative">
        <span className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200" aria-hidden />

        <li className="relative pl-6 pb-3">
          <span className="absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full border-2 border-slate-300 bg-white" aria-hidden />
          <p className="text-xs text-slate-500">
            <span className="font-medium text-slate-700">Aufgabe angelegt</span> am {formatDateTime(task.thread_created_at)}
            {creator && <> · {creator.full_name}</>}
          </p>
        </li>

        {notes.map((note) => (
          <NoteEntry
            key={note.id}
            note={note}
            author={profiles.find((p) => p.id === note.author_id) ?? null}
            weekStart={note.week_id ? weekStartById.get(note.week_id) : undefined}
            canEdit={isAdmin || (!!currentUserId && note.author_id === currentUserId)}
            onUpdate={(content) => onUpdate(note.id, content)}
            onDelete={() => onDelete(note)}
          />
        ))}
      </ol>

      <Composer onAdd={onAdd} />
    </div>
  );
}

function NoteEntry({
  note,
  author,
  weekStart,
  canEdit,
  onUpdate,
  onDelete,
}: {
  note: JourfixNote;
  author: Profile | null;
  weekStart?: string;
  canEdit: boolean;
  onUpdate: (content: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const meta = noteKindMeta[note.kind];

  function save() {
    const next = content.trim();
    setEditing(false);
    if (!next) { setContent(note.content); return; }
    if (next !== note.content) onUpdate(next);
  }

  return (
    <li className="group/note relative pl-6 pb-3">
      <span className={cn("absolute left-0 top-1.5 w-[11px] h-[11px] rounded-full ring-2 ring-white", meta.dot)} aria-hidden />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium", meta.badge)}>
          <meta.icon className="w-3 h-3" /> {meta.label}
        </span>
        <span className="font-medium text-slate-700">am {formatDateTime(note.created_at)}</span>
        {weekStart && <span className="text-slate-400">KW {weekNumber(weekStart)}</span>}
        {author && (
          <span className="flex items-center gap-1 text-slate-500">
            <Avatar name={author.full_name || "?"} avatarUrl={author.avatar_url} size={16} />
            {author.full_name}
          </span>
        )}
        {note.updated_at.slice(0, 16) !== note.created_at.slice(0, 16) && <span className="text-slate-400 italic">bearbeitet</span>}
        {canEdit && !editing && (
          <span className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/note:opacity-100 focus-within:opacity-100">
            <button onClick={() => setEditing(true)} className="p-1 rounded text-slate-400 hover:text-slate-700" aria-label="Eintrag bearbeiten">
              <Pencil className="w-3 h-3" />
            </button>
            <button onClick={onDelete} className="p-1 rounded text-slate-400 hover:text-red-600" aria-label="Eintrag löschen">
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>
      {editing ? (
        <textarea
          autoFocus
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") { setContent(note.content); setEditing(false); }
          }}
          rows={3}
          className="mt-1.5 w-full px-2.5 py-2 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
      ) : (
        <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap break-words">{note.content}</p>
      )}
    </li>
  );
}

function Composer({ onAdd }: { onAdd: (kind: NoteKind, content: string) => Promise<boolean> }) {
  const [kind, setKind] = useState<NoteKind>("note");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!content.trim() || saving) return;
    setSaving(true);
    const ok = await onAdd(kind, content.trim());
    setSaving(false);
    if (ok) setContent("");
  }

  return (
    <div className="mt-1 ml-6 rounded-lg border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-ring">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && submit()}
        placeholder={kind === "decision" ? "Beschluss festhalten…" : "Neue Notiz…"}
        rows={2}
        className="w-full px-2.5 py-2 text-sm bg-transparent rounded-t-lg focus:outline-none resize-y"
      />
      <div className="flex items-center gap-2 px-2 py-1.5 border-t border-slate-100">
        <div className="flex items-center rounded-md border border-slate-200 overflow-hidden" role="radiogroup" aria-label="Art des Eintrags">
          {(Object.keys(noteKindMeta) as NoteKind[]).map((k) => {
            const M = noteKindMeta[k];
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs border-l border-slate-200 first:border-l-0",
                  kind === k ? cn(M.badge, "font-medium") : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <M.icon className="w-3 h-3" /> {M.label}
              </button>
            );
          })}
        </div>
        <span className="hidden sm:inline text-[11px] text-slate-400">⌘/Strg + Enter</span>
        <button
          onClick={submit}
          disabled={!content.trim() || saving}
          className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
          Eintragen
        </button>
      </div>
    </div>
  );
}
