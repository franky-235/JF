"use client";

import dynamic from "next/dynamic";
import type { TaskColumn, Task, Profile } from "@/types";

const KanbanBoard = dynamic(() => import("./KanbanBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
      Board wird geladen…
    </div>
  ),
});

interface Props {
  columns: (TaskColumn & { tasks: (Task & { profiles: Profile | null })[] })[];
  projectId: string;
  profiles: Profile[];
}

export default function KanbanBoardClient(props: Props) {
  return <KanbanBoard {...props} />;
}
