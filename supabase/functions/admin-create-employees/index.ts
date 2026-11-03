import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ error: "Backend service configuration missing" }, 500);

  const authHeader = req.headers.get("Authorization") || "";
  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await callerClient.auth.getUser();
  if (authError || !user) return json({ error: "Login required" }, 401);

  const adminClient = createClient(url, serviceKey);
  const { data: callerProfile, error: profileError } = await adminClient
    .from("profiles").select("role,active").eq("id", user.id).maybeSingle();
  if (profileError || callerProfile?.role !== "RSM" || callerProfile?.active !== true) {
    return json({ error: "Only an active RSM can create employee accounts" }, 403);
  }

  let body: { employees?: Array<{ employee_id: string; full_name: string; password: string; role: string; area_id?: string | null }> };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const employees = body.employees || [];
  if (!Array.isArray(employees) || employees.length < 1 || employees.length > 200) return json({ error: "Upload 1 to 200 employees per batch" }, 400);

  const results: Array<{ employee_id: string; status: string; message?: string }> = [];
  for (const item of employees) {
    const employeeId = String(item.employee_id || "").trim();
    const fullName = String(item.full_name || "").trim();
    const password = String(item.password || "");
    const role = String(item.role || "").trim().toUpperCase();
    const areaId = item.area_id || null;
    if (!employeeId || !fullName || password.length < 8 || !["ASM", "SO"].includes(role)) {
      results.push({ employee_id: employeeId || "unknown", status: "failed", message: "Invalid ID/name/password/role" });
      continue;
    }
    const email = employeeId + "@login.tk-sales.internal";
    const { data: existing } = await adminClient.from("profiles").select("id").eq("employee_id", employeeId).maybeSingle();
    if (existing) {
      results.push({ employee_id: employeeId, status: "duplicate", message: "Employee ID already exists" });
      continue;
    }
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { employee_id: employeeId, full_name: fullName, role }
    });
    if (createError || !created.user) {
      results.push({ employee_id: employeeId, status: "failed", message: createError?.message || "Auth user creation failed" });
      continue;
    }
    const { error: insertError } = await adminClient.from("profiles").insert({
      id: created.user.id, employee_id: employeeId, full_name: fullName, role, area_id: areaId, active: true
    });
    if (insertError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      results.push({ employee_id: employeeId, status: "failed", message: "Profile insert failed: " + insertError.message });
      continue;
    }
    results.push({ employee_id: employeeId, status: "created" });
  }
  const createdCount = results.filter(r => r.status === "created").length;
  return json({ message: `${createdCount} জন কর্মীর অ্যাকাউন্ট তৈরি হয়েছে; duplicate/failed রেকর্ড ফলাফলে দেখুন।`, results });
});
