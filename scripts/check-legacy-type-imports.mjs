import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "/Users/javadreamer/Develop/Nextjs/fit-hub/apps/mobile";
const forbidden = ["/types/supabase", "types/supabase"];
const bad = [];

function walk(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) {
      continue;
    }
    const text = readFileSync(full, "utf8");
    if (forbidden.some((term) => text.includes(term))) {
      bad.push(full);
    }
  }
}

if (!statSync(root, { throwIfNoEntry: false })) {
  console.log("mobile workspace not found, skip");
  process.exit(0);
}

walk(root);

if (bad.length > 0) {
  console.error("Forbidden legacy type imports found:");
  bad.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log("No forbidden legacy type imports detected.");
