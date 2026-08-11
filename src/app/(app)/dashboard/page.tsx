import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Clock, AlertTriangle, ListTodo, ArrowRight, Calendar, Building2, TrendingUp, User2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import DashboardChart from "./DashboardChart";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Guten Morgen";
  if (hour < 18) return "Guten Tag";
  return "Guten Abend";
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: profile },
    { data: allTasksRaw },
    { data: projects },
    { data: myTasksRaw },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, role, id").eq("id", user!.id).single(),
    supabase.from("tasks").select("id, column_id, due_date, assignee_id, project_id, task_columns(title)"),
    supabase
      .from("projects")
      .select("id, name, status, color, customers(name), members:project_members(user_id)")
      .order("updated_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority, task_columns(title), projects(name, color)")
      .eq("assignee_id", user!.id)
      .limit(10),
  ]);

  const tasks = allTasksRaw ?? [];
  const totalTasks = tasks.length;

  const isDone = (t: any) => {
    const title = (t.task_columns?.title ?? "").toLowerCase();
    return title.includes("erledigt") || title.includes("done");
  };
  const isInProgress = (t: any) => {
    const title = (t.task_columns?.title ?? "").toLowerCase();
    return title.includes("bearbeitung") || title.includes("arbeit") || title.includes("progress");
  };

  const doneTasks = tasks.filter(isDone).length;
  const inProgressTasks = tasks.filter(isInProgress).length;
  const reviewTasks = tasks.filter((t: any) => (t.task_columns?.title ?? "").toLowerCase().includes("review")).length;
  const todoTasks = tasks.filter((t: any) => {
    const title = (t.task_columns?.title ?? "").toLowerCase();
    return title.includes("to do") || title === "todo";
  }).length;
  const backlogTasks = tasks.filter((t: any) => (t.task_columns?.title ?? "").toLowerCase().includes("backlog")).length;
  const overdueTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && !isDone(t)).length;
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const today = format(new Date(), "EEEE, d. MMMM", { locale: de });
  const firstName = profile?.full_name?.split(" ")[0] || "Team";

  const avatarColors = ["#6366f1", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
  const colorIndex = profile?.full_name ? profile.full_name.charCodeAt(0) % avatarColors.length : 0;
  const avatarColor = avatarColors[colorIndex];

  const chartData = [
    { name: "Backlog", value: backlogTasks, color: "#94A3B8" },
    { name: "To Do", value: todoTasks, color: "#60A5FA" },
    { name: "In Arbeit", value: inProgressTasks, color: "#F59E0B" },
    { name: "Review", value: reviewTasks, color: "#A78BFA" },
    { name: "Erledigt", value: doneTasks, color: "#10B981" },
  ];

  const myTasks = myTasksRaw ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      {/* Hero Banner */}
      <div
        className="relative rounded-2xl overflow-hidden p-8 shadow-xl"
        style={{ background: "linear-gradient(135deg, #010707 0%, #565656 100%)" }}
      >
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(0, 255, 255, 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(0, 200, 200, 0.1) 0%, transparent 50%)",
            }}
          />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Image src="/logo.svg" alt="nerds" width={130} height={40} className="brightness-0 invert" />
            <div className="h-12 w-px bg-slate-600" />
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">
                {getGreeting()}, {firstName}! 👋
              </h1>
              <p className="text-slate-300">
                Hier ist deine Übersicht für heute – {today}
              </p>
            </div>
          </div>
          {profile && (
            <div
              className="hidden lg:flex items-center gap-4 rounded-xl p-4 border border-white/20"
              style={{ backgroundColor: "rgba(0,0,0,0.2)", backdropFilter: "blur(8px)" }}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg"
                style={{ backgroundColor: avatarColor }}
              >
                {getInitials(profile.full_name || "?")}
              </div>
              <div>
                <div className="text-white font-semibold">{profile.full_name}</div>
                <div className="text-slate-300 text-sm capitalize">
                  {profile.role === "admin" ? "Administrator" : "Mitglied"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gesamt Aufgaben" value={totalTasks} icon={<ListTodo className="w-5 h-5" />} colorClass="cyan" />
        <StatCard label="Erledigt" value={doneTasks} icon={<CheckCircle2 className="w-5 h-5" />} colorClass="emerald" sub={`${completionPct}% abgeschlossen`} />
        <StatCard label="In Bearbeitung" value={inProgressTasks} icon={<Clock className="w-5 h-5" />} colorClass="amber" />
        <StatCard label="Überfällig" value={overdueTasks} icon={<AlertTriangle className="w-5 h-5" />} colorClass="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: "#00aaaa" }} />
            Aufgaben nach Status
          </h2>
          <DashboardChart data={chartData} />
        </div>

        {/* My Tasks */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <User2 className="w-4 h-4" style={{ color: "#00aaaa" }} />
              Meine Aufgaben ({myTasks.length})
            </h2>
            <Link href="/board" className="text-xs flex items-center gap-1" style={{ color: "#00aaaa" }}>
              Alle anzeigen <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {myTasks.slice(0, 5).map((task: any) => {
              const projectColor = (task.projects as any)?.color || "#94A3B8";
              const projectName = (task.projects as any)?.name;
              const isOverdue = task.due_date && new Date(task.due_date) < new Date();
              const priorityColors: Record<string, string> = {
                low: "bg-emerald-50 text-emerald-600",
                medium: "bg-amber-50 text-amber-600",
                high: "bg-red-50 text-red-600",
              };
              const priorityLabels: Record<string, string> = {
                low: "Niedrig",
                medium: "Mittel",
                high: "Hoch",
              };
              return (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{task.title}</div>
                    <div className="text-xs text-slate-400">{projectName}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority] || "bg-slate-100 text-slate-500"}`}>
                    {priorityLabels[task.priority] || task.priority}
                  </span>
                  {task.due_date && (
                    <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500" : "text-slate-400"}`}>
                      <Calendar className="w-3 h-3" />
                      {format(new Date(task.due_date), "d. MMM", { locale: de })}
                    </div>
                  )}
                </div>
              );
            })}
            {myTasks.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm">Keine offenen Aufgaben 🎉</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Projects */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">Projekte Übersicht</h2>
          <Link href="/projects" className="text-xs flex items-center gap-1" style={{ color: "#00aaaa" }}>
            Alle Projekte <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(projects ?? []).slice(0, 6).map((project: any) => {
            const customer = project.customers;
            const statusColors: Record<string, string> = {
              active: "bg-emerald-100 text-emerald-700",
              completed: "bg-slate-100 text-slate-600",
              archived: "bg-gray-100 text-gray-600",
            };
            const statusLabels: Record<string, string> = {
              active: "Aktiv",
              completed: "Abgeschlossen",
              archived: "Archiviert",
            };
            const color = project.color || "#6366f1";
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}/board`}
                className="p-4 rounded-xl border border-slate-200 hover:border-[#00ffff]/50 transition-colors cursor-pointer group block"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{project.name}</h3>
                    {customer?.name && (
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">{customer.name}</span>
                      </div>
                    )}
                    <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full ${statusColors[project.status] || "bg-slate-100 text-slate-600"}`}>
                      {statusLabels[project.status] || project.status}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
          {(projects ?? []).length === 0 && (
            <p className="text-sm text-slate-400 col-span-3 py-4">
              Noch keine Projekte.{" "}
              <Link href="/projects" className="underline" style={{ color: "#00aaaa" }}>Erstes Projekt erstellen</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  colorClass,
  sub,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: "cyan" | "emerald" | "amber" | "red";
  sub?: string;
}) {
  const styles: Record<string, { bg: string; color: string; iconStyle?: React.CSSProperties }> = {
    cyan: { bg: "", color: "text-black", iconStyle: { backgroundColor: "#00ffff", color: "#000000" } },
    emerald: { bg: "bg-emerald-50", color: "text-emerald-600" },
    amber: { bg: "bg-amber-50", color: "text-amber-600" },
    red: { bg: "bg-red-50", color: "text-red-600" },
  };
  const s = styles[colorClass];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <div
          className={`p-2 rounded-lg ${s.bg} ${s.color}`}
          style={s.iconStyle}
        >
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}
