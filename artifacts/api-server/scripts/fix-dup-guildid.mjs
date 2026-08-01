import fs from "node:fs";

const f = "src/bot/events/serverLogs.ts";
let s = fs.readFileSync(f, "utf8");

// Remove consecutive duplicate guildId: lines
s = s.replace(
  /(\n\s*guildId:\s*[^,\n]+,)\s*\1/g,
  "$1",
);

fs.writeFileSync(f, s);
console.log("fixed duplicates");
console.log("guildId count", (s.match(/guildId:/g) || []).length);
