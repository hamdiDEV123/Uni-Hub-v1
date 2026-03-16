import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const targets = ["src/backend", "src/pages", "src/components", "src/lib"];
const failOnMatch = process.argv.includes("--fail-on-match");
const include = /\.(ts|tsx)$/;
const regex = /\bas never\b/g;

function walk(dir, out = []) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (include.test(fullPath)) out.push(fullPath);
  }

  return out;
}

const files = targets.flatMap((dir) => walk(join(root, dir)));
const rows = [];
let total = 0;

for (const file of files) {
  const content = readFileSync(file, "utf8");
  const matches = content.match(regex);
  const count = matches?.length ?? 0;
  if (count > 0) {
    total += count;
    rows.push({ file: relative(root, file), count });
  }
}

if (rows.length === 0) {
  console.log("✅ No `as never` usages found in target folders.");
  process.exit(0);
}

console.log("`as never` usage report:");
for (const row of rows.sort((a, b) => b.count - a.count)) {
  console.log(`- ${row.file}: ${row.count}`);
}
console.log(`\nTotal matches: ${total}`);

if (failOnMatch) {
  process.exit(1);
}
