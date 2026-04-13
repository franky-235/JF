"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Mail, Phone, RefreshCw, Pencil, Trash2 } from "lucide-react";
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

const avatarColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

export default function CustomersClient({ customers: initial }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initial);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

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
      setCustomers((prev) => prev.map((c) => c.id === editCustomer.id ? { ...c, ...form, company: form.company || null, email: form.email || null, phone: form.phone || null, notes: form.notes || null } : c));
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

  async function handleHubSpotSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/hubspot/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync fehlgeschlagen");
      router.refresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Kunden</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{customers.length} Kunden verwaltet</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleHubSpotSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-accent transition disabled:opacity-50 font-medium"
            style={{ borderColor: "#f97316", color: "#f97316" }}
          >
            <span className="font-bold text-xs">H</span>
            {syncing ? "Syncing..." : "HubSpot"}
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition font-medium"
          >
            <Plus className="w-4 h-4" /> Neuer Kunde
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Suche nach Name, Firma oder E-Mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kunde</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kontakt</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">HubSpot</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Erstellt</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                  Keine Kunden gefunden.
                </td>
              </tr>
            )}
            {filtered.map((c, i) => {
              const color = avatarColors[i % avatarColors.length];
              return (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white shrink-0"
                        style={{ background: color }}
                      >
                        {c.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        {c.company && <p className="text-xs text-muted-foreground">{c.company}</p>}
                        {(c.projectCount ?? 0) > 0 && (
                          <p className="text-xs text-primary">{c.projectCount} Projekt{(c.projectCount ?? 0) > 1 ? "e" : ""}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="space-y-0.5">
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          <span>{c.email}</span>
                        </div>
                      )}
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {!c.email && !c.phone && <span className="text-muted-foreground">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {c.hubspot_id ? (
                      <span className="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded-full font-medium">
                        Verknüpft
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground">
                    {format(new Date(c.created_at), "d. MMM yyyy", { locale: de })}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-5">{editCustomer ? "Kunde bearbeiten" : "Neuer Kunde"}</h2>
            <div className="space-y-4">
              {([
                { key: "name", label: "Name *", placeholder: "Max Mustermann", type: "text" },
                { key: "company", label: "Firma", placeholder: "Muster GmbH", type: "text" },
                { key: "email", label: "E-Mail", placeholder: "max@firma.de", type: "email" },
                { key: "phone", label: "Telefon", placeholder: "+49 123 456789", type: "tel" },
              ] as const).map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1.5">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium mb-1.5">Notizen</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optionale Notizen..."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 border rounded-lg text-sm hover:bg-accent transition">Abbrechen</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition disabled:opacity-50">
                {saving ? "Speichern..." : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
