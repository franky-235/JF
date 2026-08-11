"use client";

import { useState } from "react";
import {
  Plus, Search, Mail, Phone, Pencil, Trash2, X, Loader2,
  ChevronDown, ChevronRight, FolderOpen
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/types";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface Props {
  customers: (Customer & { projectCount?: number })[];
}

interface CustomerForm {
  name: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: CustomerForm = { name: "", company: "", email: "", phone: "", notes: "" };

export default function CustomersClient({ customers: initial }: Props) {
  const [customers, setCustomers] = useState(initial);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = customers.filter((c) =>
    [c.name, c.company, c.email].some((v) =>
      v?.toLowerCase().includes(search.toLowerCase())
    )
  );

  function openCreate() {
    setEditCustomer(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEdit(c: Customer) {
    setEditCustomer(c);
    setForm({ name: c.name, company: c.company ?? "", email: c.email ?? "", phone: c.phone ?? "", notes: c.notes ?? "" });
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name ist erforderlich."); return; }
    setSaving(true);
    const supabase = createClient();

    if (editCustomer) {
      const { error } = await supabase.from("customers").update({
        name: form.name, company: form.company || null, email: form.email || null,
        phone: form.phone || null, notes: form.notes || null,
      }).eq("id", editCustomer.id);
      if (error) { setError(error.message); setSaving(false); return; }
      setCustomers((prev) => prev.map((c) => c.id === editCustomer.id
        ? { ...c, name: form.name, company: form.company || null, email: form.email || null, phone: form.phone || null, notes: form.notes || null }
        : c));
    } else {
      const { data, error } = await supabase.from("customers").insert({
        name: form.name, company: form.company || null, email: form.email || null,
        phone: form.phone || null, notes: form.notes || null,
      }).select().single();
      if (error) { setError(error.message); setSaving(false); return; }
      setCustomers((prev) => [data, ...prev]);
    }
    setSaving(false);
    setShowModal(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Kunden wirklich löschen?")) return;
    const supabase = createClient();
    await supabase.from("customers").delete().eq("id", id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Kunden</h1>
          <p className="text-sm text-slate-500">{customers.length} Kunden verwaltet</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: "#00ffff", color: "#000000" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00e5e5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "#00ffff")}
          >
            <Plus className="w-4 h-4" /> Neuer Kunde
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Suche nach Name, Firma oder E-Mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
          onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff30")}
          onBlur={(e) => (e.target.style.boxShadow = "")}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kunde</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Kontakt</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Erstellt</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <>
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {(c.projectCount ?? 0) > 0 ? (
                        <button
                          onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                          className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                        >
                          {expandedId === c.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      ) : (
                        <div className="w-4" />
                      )}
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold text-sm flex-shrink-0"
                        style={{ backgroundColor: "#00ffff20", color: "#007777" }}
                      >
                        {(c.company || c.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{c.name}</div>
                        {c.company && <div className="text-xs text-slate-400">{c.company}</div>}
                        {(c.projectCount ?? 0) > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <FolderOpen className="w-3 h-3" style={{ color: "#00aaaa" }} />
                            <span className="text-xs font-medium" style={{ color: "#009999" }}>
                              {c.projectCount} {c.projectCount === 1 ? "Projekt" : "Projekte"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="space-y-0.5">
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Mail className="w-3 h-3" />{c.email}
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Phone className="w-3 h-3" />{c.phone}
                        </div>
                      )}
                      {!c.email && !c.phone && <span className="text-slate-400 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 hidden lg:table-cell">
                    {format(new Date(c.created_at), "d. MMM yyyy", { locale: de })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#00aaaa")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "")}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandedId === c.id && (c.projectCount ?? 0) > 0 && (
                  <tr key={`${c.id}-expanded`}>
                    <td colSpan={4} className="px-4 py-3 bg-slate-50/50">
                      <div className="pl-10">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Verknüpfte Projekte</div>
                        <p className="text-xs text-slate-400">Projekte werden in der Projektübersicht angezeigt.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-slate-400 text-sm">
                  Keine Kunden gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-800">
                {editCustomer ? "Kunde bearbeiten" : "Neuer Kunde"}
              </h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <Field label="Firma *" value={form.company} onChange={(v) => setForm({ ...form, company: v })} />
              </div>
              <Field label="E-Mail *" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Notizen</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none resize-none"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 text-sm rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: "#00ffff", color: "#000000" }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
      <input
        type={type}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px #00ffff30")}
        onBlur={(e) => (e.target.style.boxShadow = "")}
      />
    </div>
  );
}
