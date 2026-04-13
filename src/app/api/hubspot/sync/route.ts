import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchHubSpotContacts, mapContactToCustomer } from "@/lib/hubspot";

export async function POST() {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN nicht konfiguriert." }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let synced = 0;
  let after: string | undefined;

  try {
    do {
      const response = await fetchHubSpotContacts(after);

      if (response.results.length > 0) {
        const records = response.results.map(mapContactToCustomer);
        const { error } = await supabase.from("customers").upsert(records, { onConflict: "hubspot_id", ignoreDuplicates: false });
        if (error) throw error;
        synced += records.length;
      }

      after = response.paging?.next?.after;
    } while (after);

    return NextResponse.json({ synced });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Sync fehlgeschlagen." }, { status: 500 });
  }
}
