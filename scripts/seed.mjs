// Demo data seeder — run with:
//   node --env-file=.env.local scripts/seed.mjs
//
// Creates 1 admin, 20 demo users (seniority_order 1-20), the 19 real ภาค 5
// positions, and makes 8 sample selections through the seniority queue
// using the real select_position() RPC (not a raw INSERT), so it exercises
// the actual turn-gate + atomic-locking code path end to end.
//
// Requires SUPABASE_SERVICE_ROLE_KEY — server-side only, never used inside
// the Next.js app itself.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey || !anonKey) {
  console.error(
    "Missing env vars. Run with: node --env-file=.env.local scripts/seed.mjs",
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "Demo1234!";

// ภาค 5 : 19 ตำแหน่ง
const REGION5_STATIONS = [
  { province: "เชียงใหม่", name: "สภ.สันกำแพง" },
  { province: "เชียงใหม่", name: "สถ.แม่โจ้" },
  { province: "เชียงใหม่", name: "สภ.แม่อาย" },
  { province: "เชียงใหม่", name: "สภ.ฝาง" },
  { province: "เชียงใหม่", name: "สภ.แม่แตง" },
  { province: "เชียงใหม่", name: "สภ.โหล่งขอด" },
  { province: "เชียงใหม่", name: "สภ.จอมทอง" },
  { province: "ลำปาง", name: "สภ.แม่พริก" },
  { province: "ลำปาง", name: "สภ.เมืองลำปาง" },
  { province: "ลำปาง", name: "สภ.งาว" },
  { province: "ลำพูน", name: "สภ.นิคมอุตสาหกรรม" },
  { province: "ลำพูน", name: "สภ.ทุ่งหัวช้าง" },
  { province: "น่าน", name: "สภ.เรือง" },
  { province: "เชียงราย", name: "สภ.แม่อ้อ" },
  { province: "เชียงราย", name: "สภ.เกาะช้าง" },
  { province: "เชียงราย", name: "สภ.เชียงของ" },
  { province: "แพร่", name: "สภ.วังชิ้น" },
  { province: "แพร่", name: "สภ.ห้วยม้า" },
  { province: "พะเยา", name: "สภ.แม่กา" },
];

async function ensureUser({ email, firstName, lastName, seniorityOrder }) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      ...(seniorityOrder != null ? { seniority_order: seniorityOrder } : {}),
    },
  });

  if (error) {
    const alreadyExists =
      error.code === "email_exists" ||
      error.status === 422 ||
      /already.*registered|already.*exists/i.test(error.message ?? "");
    if (alreadyExists) {
      console.log(`  (exists) ${email}`);
      return null;
    }
    throw error;
  }
  console.log(`  created ${email}`);
  return created.user;
}

async function main() {
  console.log("1) Creating admin user...");
  await ensureUser({
    email: "admin@position-system.demo",
    firstName: "System",
    lastName: "Administrator",
  });

  // Promote the admin profile to role=admin. Service-role calls bypass RLS
  // entirely and auth.uid() is null in this context, which the
  // protect_privileged_profile_fields trigger (0002 migration) explicitly
  // allows for exactly this kind of backend/seed operation.
  const { data: adminAuthUser } = await admin.auth.admin.listUsers();
  const adminUser = adminAuthUser.users.find((u) => u.email === "admin@position-system.demo");
  if (adminUser) {
    await admin.from("profiles").update({ role: "admin" }).eq("user_id", adminUser.id);
  }

  console.log("2) Creating 20 demo users with seniority_order 1-20...");
  const demoUsers = [];
  for (let i = 1; i <= 20; i++) {
    const email = `user${String(i).padStart(2, "0")}@position-system.demo`;
    await ensureUser({
      email,
      firstName: `เจ้าหน้าที่`,
      lastName: `ทดสอบ${i}`,
      seniorityOrder: i,
    });
    demoUsers.push({ email, seniority: i });
  }

  // Belt-and-suspenders: if any of these accounts already existed from a
  // previous seed run (so the createUser call above was a no-op), make sure
  // their seniority_order still matches.
  for (const { email, seniority } of demoUsers) {
    await admin.from("profiles").update({ seniority_order: seniority }).eq("email", email);
  }

  console.log("3) Creating the 19 real ภาค 5 positions...");
  const positions = [];
  for (let i = 0; i < REGION5_STATIONS.length; i++) {
    const { province, name } = REGION5_STATIONS[i];
    const code = `5-${String(i + 1).padStart(2, "0")}`;
    const { data, error } = await admin
      .from("positions")
      .upsert(
        {
          position_code: code,
          department: "ภาค 5",
          division: province,
          location: name,
          description: `ตำแหน่งปฏิบัติงาน ${name} จังหวัด${province}`,
          capacity: 1,
          status: "available",
        },
        { onConflict: "position_code" },
      )
      .select()
      .single();
    if (error) throw error;
    positions.push(data);
  }
  console.log(`  ${positions.length} positions ready`);

  console.log("4) Opening the system LIVE in seniority-queue mode, starting at seniority_order 1...");
  await admin.from("system_settings").select("id").limit(1).maybeSingle().then(async ({ data }) => {
    const payload = { system_status: "live", selection_mode: "seniority", current_turn_seniority_order: 1 };
    if (data) {
      await admin.from("system_settings").update(payload).eq("id", data.id);
    } else {
      await admin.from("system_settings").insert(payload);
    }
  });

  console.log("5) Making 8 sample selections in seniority order (1 -> 8) through the real select_position() RPC...");
  const anon = createClient(url, anonKey);
  for (let i = 0; i < 8; i++) {
    const { email } = demoUsers[i]; // seniority 1..8, matches current_turn advancing 1 by 1
    const { data: signIn, error: signInError } = await anon.auth.signInWithPassword({
      email,
      password: DEMO_PASSWORD,
    });
    if (signInError || !signIn.session) {
      console.warn(`  skip ${email}: ${signInError?.message}`);
      continue;
    }
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
    });
    const { data: result, error: rpcError } = await client.rpc("select_position", {
      p_position_id: positions[i].id,
    });
    if (rpcError) {
      console.warn(`  ${email} -> RPC error: ${rpcError.message}`);
    } else {
      console.log(`  ${email} -> ${JSON.stringify(result)}`);
    }
    await anon.auth.signOut();
  }

  console.log("6) Resetting system status to WAITING (queue position preserved for the demo)...");
  await admin.from("system_settings").select("id").limit(1).maybeSingle().then(async ({ data }) => {
    if (data) {
      await admin
        .from("system_settings")
        .update({ system_status: "waiting", open_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
        .eq("id", data.id);
    }
  });

  console.log("\nDone. Queue is at seniority_order 9 (user09@position-system.demo) when you flip the system LIVE again.");
  console.log("Demo login: user01@position-system.demo ... user20@position-system.demo / Demo1234!");
  console.log("Admin login: admin@position-system.demo / Demo1234!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
