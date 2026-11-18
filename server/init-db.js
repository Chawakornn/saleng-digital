import { randomBytes, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { database, queryAll } from "./database.js";

const output = process.argv[2];
if (!output)
  throw Error("Specify a private output file for your one-time owner code.");
const tables = await queryAll(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%' AND name NOT LIKE '_litestream_%'",
);
if (tables.length)
  throw Error(
    "Database already initialized or contains tables. No changes made.",
  );
const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
const statements = schema
  .split(";")
  .map((value) => value.trim())
  .filter(Boolean);
const code = randomBytes(24).toString("base64url");
const digest = createHash("sha256").update(code).digest("hex");
statements.push(
  "INSERT INTO Community (id,name,address,guide) VALUES (1,'ชุมชนของเรา','','')",
);
for (const [, table] of schema.matchAll(/CREATE TABLE "([A-Za-z]+)"/g)) {
  if (["Session", "LoginAttempt"].includes(table)) continue;
  for (const change of ["INSERT", "UPDATE", "DELETE"]) {
    statements.push(
      `CREATE TRIGGER "version_${table}_${change}" AFTER ${change} ON "${table}" BEGIN UPDATE AppVersion SET revision=revision+1 WHERE id=1; END`,
    );
  }
}
statements.push({
  sql: "INSERT INTO OwnerSetup (id,digest) VALUES (1,?)",
  args: [digest],
});
await writeFile(
  output,
  "รหัสเปิดสิทธิ์ผู้ดูแล Saleng Digital (ใช้ได้ครั้งเดียว)\n\n" +
    code +
    "\n\nสมัครและเข้าสู่บัญชีของคุณ เปิด บัญชี → เปิดสิทธิ์ผู้ดูแล แล้วกรอกรหัสนี้\nเก็บไฟล์นี้เป็นส่วนตัว ผู้ที่มีรหัสสามารถเปิดสิทธิ์ผู้ดูแลคนแรกได้\n",
  { mode: 0o600, flag: "wx" },
);
await database().batch(statements, "write");
console.log(
  "Initialized an empty Saleng Digital database and saved the owner code privately.",
);
