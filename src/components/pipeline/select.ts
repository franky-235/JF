/** Select für Kundenpunkte inkl. Jourfix-Wochen und verknüpfter Board-Aufgabe (server- und clientseitig nutzbar). */
export const CUSTOMER_ITEM_SELECT = "*, jourfix_tasks(id, week_id), linked_task:tasks(id, title, project_id)";
