"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let setPendingGlobal: ((p: Pending | null) => void) | null = null;

/** Zeigt einen Bestätigungsdialog. Erfordert einen gemounteten <ConfirmHost />. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setPendingGlobal) {
      resolve(window.confirm(options.title));
      return;
    }
    setPendingGlobal({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    setPendingGlobal = setPending;
    return () => {
      setPendingGlobal = null;
    };
  }, []);

  function close(ok: boolean) {
    pending?.resolve(ok);
    setPending(null);
  }

  return (
    <Dialog.Root open={!!pending} onOpenChange={(open) => !open && close(false)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-2xl focus:outline-none">
          <div className="flex gap-3">
            {pending?.destructive && (
              <div className="w-9 h-9 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-slate-800">{pending?.title}</Dialog.Title>
              {pending?.description && (
                <Dialog.Description className="mt-1 text-sm text-slate-500">{pending.description}</Dialog.Description>
              )}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => close(false)}
              className="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
            >
              Abbrechen
            </button>
            <button
              autoFocus
              onClick={() => close(true)}
              className={cn(
                "px-4 py-2 text-sm rounded-lg font-semibold",
                pending?.destructive ? "bg-red-500 text-white hover:bg-red-600" : "bg-primary text-primary-foreground hover:opacity-90"
              )}
            >
              {pending?.confirmLabel ?? "Bestätigen"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
