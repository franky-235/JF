import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CheckSquare, CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: tasks },
    { data: projects },
    { data: myTasks },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user!.id).single(),
    supabase.from("tasks").select("id, title, column_id, due_date, assignee_id, project_id, task_columns(title)"),
    supabase.from("projects").select("id, name, status, customers(name)").order("updated_at", { ascending: false }).limit(5),
    supabase.from("tasks").select("id, title, due_date, priority, task_columns(title), projects(name)").eq("assignee_id", user!.id).limit(10),
  ]);

  const allTasks = tasks ?? [];
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter((t: any) => t.task_columns?.title?.toLowerCase().includes("erledigt") || t.task_columns?.title?.toLowerCase().includes("done")).length;
  const inProgressTasks = allTasks.filter((t: any) => t.task_columns?.title?.toLowerCase().includes("bearbeitung") || t.task_columns?.title?.toLowerCase().includes("arbeit")).length;
  const overdueTasks = allTasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date()).length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const today = format(new Date(), "EEEE, d. MMMM", { locale: de });
  const firstName = profile?.full_name?.split(" ")[0] || "Team";

  const stats = [
    {
      label: "Gesamt Aufgaben",
      value: totalTasks,
      icon: CheckSquare,
      iconBg: "#22d3ee22",
      iconColor: "#22d3ee",
      sub: null,
    },
    {
      label: "Erledigt",
      value: doneTasks,
      icon: CheckCircle2,
      iconBg: "#10b98122",
      iconColor: "#10b981",
      sub: completionPct > 0 ? `${completionPct}% abgeschlossen` : null,
    },
    {
      label: "In Bearbeitung",
      value: inProgressTasks,
      icon: Clock,
      iconBg: "#f59e0b22",
      iconColor: "#f59e0b",
      sub: null,
    },
    {
      label: "Überfällig",
      value: overdueTasks,
      icon: AlertTriangle,
      iconBg: "#ef444422",
      iconColor: "#ef4444",
      sub: null,
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero greeting card */}
      <div
        className="rounded-2xl p-6 flex items-center justify-between"
        style={{ background: "hsl(240 6% 13%)" }}
      >
        <div className="flex items-center gap-5">
          {/* Logo mark */}
          <div className="text-4xl font-bold leading-none" style={{ color: "#22d3ee" }}>*</div>
          <div className="w-px h-10 bg-white/10" />
          <div>
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()}, {firstName}! 👋
            </h1>
            <p className="text-sm mt-1" style={{ color: "hsl(240 5% 60%)" }}>
              Hier ist deine Übersicht für heute – {today}
            </p>
          </div>
        </div>
        {profile && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "hsl(240 6% 18%)" }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
              style={{ background: "#6366f1" }}
            >
              {profile.full_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{profile.full_name}</p>
              <p className="text-xs" style={{ color: "hsl(240 5% 55%)" }}>
                Administrator • Management
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, iconBg, iconColor, sub }) => (
          <div key={label} className="bg-card border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-3xl font-bold mt-1">{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
              </div>
              <div
                className="p-2.5 rounded-xl"
                style={{ background: iconBg }}
              >
                <Icon className="w-5 h-5" style={{ color: iconColor }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom grid: Meine Aufgaben + Projekte Übersicht */}
      <div className="grid grid-cols-2 gap-4">
        {/* Meine Aufgaben */}
        <div className="bg-card border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold text-sm">Meine Aufgaben ({myTasks?.length ?? 0})</h2>
            <Link href="/board" className="text-xs text-primary hover:underline flex items-center gap-1">
              Alle anzeigen <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y">
            {(!myTasks || myTasks.length === 0) ? (
              <div className="px-5 py-10 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: "#10b981" }} />
                <p className="text-sm text-muted-foreground">Keine offenen Aufgaben 🎉</p>
              </div>
            ) : (
              myTasks.slice(0, 5).map((task: any) => (
                <div key={task.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{(task.projects as any)?.name}</p>
                  </div>
                  {task.due_date && (
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-3 ${
                      new Date(task.due_date) < new Date()
                        ? "bg-red-100 text-red-600"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {format(new Date(task.due_date), "d. MMM", { locale: de })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Projekte Übersicht */}
        <div className="bg-card border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold text-sm">Projekte Übersicht</h2>
            <Link href="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">
              Alle Projekte <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y">
            {(!projects || projects.length === 0) ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Noch keine Projekte.{" "}
                  <Link href="/projects" className="text-primary hover:underline">
                    Erstes Projekt erstellen
                  </Link>
                </p>
              </div>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}/board`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{project.name}</p>
                    {(project.customers as any)?.name && (
                      <p className="text-xs text-muted-foreground">{(project.customers as any).name}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ml-3 ${
                    project.status === "active" ? "bg-emerald-100 text-emerald-700" :
                    project.status === "completed" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {project.status === "active" ? "Aktiv" :
                     project.status === "completed" ? "Abgeschlossen" : "Archiviert"}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
