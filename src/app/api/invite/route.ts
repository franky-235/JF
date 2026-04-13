import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "E-Mail erforderlich." }, { status: 400 });

  // Verify current user is admin
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Nur Admins können Benutzer einladen." }, { status: 403 });

  // Check team size
  const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  if ((count ?? 0) >= 10) return NextResponse.json({ error: "Maximale Teamgröße erreicht." }, { status: 400 });

  // Use service role to invite
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminSupabase.auth.admin.inviteUserByEmail(email);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
