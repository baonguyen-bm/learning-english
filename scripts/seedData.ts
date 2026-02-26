import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import missions from "../data/missions.json";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log(`Seeding ${missions.length} missions...`);

  for (const mission of missions) {
    const { error } = await supabase
      .from("missions")
      .upsert(mission, { onConflict: "day_number" });

    if (error) {
      console.error(`Error seeding Day ${mission.day_number}:`, error.message);
    } else {
      console.log(`  ✓ Day ${mission.day_number}: ${mission.title}`);
    }
  }

  console.log("Done.");
}

seed();
