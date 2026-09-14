// Demo data seeder — run with:
//   node --env-file=.env.local scripts/seed.mjs
//
// Creates 1 admin, 20 demo users, 30 positions, and a handful of sample
// selections (made through the real select_position() RPC, not a raw
// INSERT, so it also exercises the atomic-locking code path).
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
const DEPARTMENTS = ["กอง 1", "กอง 2", "กอง 3", "กอง 4", "กอง 5"];
const DIVISIONS = ["กลุ่มงานอำนวยการ", "กลุ่มงานปฏิบัติการ", "กลุ่มงานสนับสนุน"];
const LOCATIONS = ["กรุงเทพฯ", "เชียงใหม่", "ขอนแก่น", "สงขลา", "ชลบุรี", "นครราชสีมา"];

function positionCode(deptIndex, seq) {
  const letter = String.fromCharCode("A".charCodeAt(0) + deptIndex);
  return `${letter}-${String(seq).padStart(3, "0")}`;
}

async function ensureUser({ email, firstName, lastName, userCode, batch, classYear, groupName }) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      user_code: userCode,
      batch,
      class_year: classYear,
      group_name: groupName,
    },
  });

  if (error) {
    if (error.message?.toLowerCase().includes("already registered")) {
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
    userCode: "ADMIN-001",
    batch: "-",
    classYear: "-",
    groupName: "-",
  });

  // Promote the admin profile to role=admin.
  const { data: adminAuthUser } = await admin.auth.admin.listUsers();
  const adminUser = adminAuthUser.users.find((u) => u.email === "admin@position-system.demo");
  if (adminUser) {
    await admin.from("profiles").update({ role: "admin" }).eq("user_id", adminUser.id);
  }

  console.log("2) Creating 20 demo users...");
  const demoUsers = [];
  for (let i = 1; i <= 20; i++) {
    const email = `user${String(i).padStart(2, "0")}@position-system.demo`;
    const user = await ensureUser({
      email,
      firstName: `ผู้ใช้`,
      lastName: `ทดสอบ${i}`,
      userCode: `U-${String(i).padStart(4, "0")}`,
      batch: "รุ่นที่ 30",
      classYear: `ปี ${((i - 1) % 4) + 1}`,
      groupName: `กลุ่ม ${((i - 1) % 3) + 1}`,
    });
    demoUsers.push({ email, user });
  }

  console.log("3) Creating 30 positions...");
  const positions = [];
  for (let i = 0; i < 30; i++) {
    const deptIndex = i % DEPARTMENTS.length;
    const code = positionCode(deptIndex, Math.floor(i / DEPARTMENTS.length) + 1);
    const { data, error } = await admin
      .from("positions")
      .upsert(
        {
          position_code: code,
          department: DEPARTMENTS[deptIndex],
          division: DIVISIONS[i % DIVISIONS.length],
          location: LOCATIONS[i % LOCATIONS.length],
          description: `ตำแหน่งปฏิบัติงาน ${code}`,
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

  console.log("4) Opening the system (LIVE) so demo selections can be made...");
  await admin.from("system_settings").select("id").limit(1).maybeSingle().then(async ({ data }) => {
    if (data) {
      await admin.from("system_settings").update({ system_status: "live" }).eq("id", data.id);
    } else {
      await admin.from("system_settings").insert({ system_status: "live" });
    }
  });

  console.log("5) Making 8 sample selections through the real select_position() RPC...");
  const anon = createClient(url, anonKey);
  for (let i = 0; i < 8; i++) {
    const { email } = demoUsers[i];
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

  console.log("6) Resetting system status to WAITING (demo default)...");
  await admin.from("system_settings").select("id").limit(1).maybeSingle().then(async ({ data }) => {
    if (data) {
      await admin
        .from("system_settings")
        .update({ system_status: "waiting", open_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
        .eq("id", data.id);
    }
  });

  console.log("\nDone. Demo login: user01@position-system.demo / Demo1234!");
  console.log("Admin login: admin@position-system.demo / Demo1234!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
