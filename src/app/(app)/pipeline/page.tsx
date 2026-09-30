import { startOfWeek, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import PipelineClient, { type PipelineCustomer } from "@/components/pipeline/PipelineClient";
import { CUSTOMER_ITEM_SELECT } from "@/components/pipeline/select";
import type { Profile } from "@/types";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; view?: string }>;
}) {
  const { customer, view } = await searchParams;
  const supabase = await createClient();
  const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const [{ data: customers }, { data: profiles }, { data: projects }, { data: currentWeek }] = await Promise.all([
    supabase.from("customers").select(`*, customer_items(${CUSTOMER_ITEM_SELECT})`).order("name"),
    supabase.from("profiles").select("*"),
    supabase.from("projects").select("id, name, task_columns(id, title, position)").order("name"),
    supabase.from("jourfix_weeks").select("id").eq("week_start", currentWeekStart).maybeSingle(),
  ]);

  return (
    <PipelineClient
      customers={(customers ?? []) as unknown as PipelineCustomer[]}
      profiles={(profiles ?? []) as Profile[]}
      projects={(projects ?? []) as { id: string; name: string; task_columns: { id: string; title: string; position: number }[] }[]}
      currentWeekId={currentWeek?.id ?? null}
      initialCustomerId={customer ?? null}
      initialView={view === "list" ? "list" : "kanban"}
    />
  );
}
