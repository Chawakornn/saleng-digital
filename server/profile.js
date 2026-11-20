import { execute, queryOne, requireCondition } from "./database.js";

export async function privateProfile(id) {
  if (!(await queryOne("SELECT 1 FROM sqlite_master WHERE type='table' AND name='AccountProfile'"))) return {};
  return (await queryOne("SELECT address,phone,avatar FROM AccountProfile WHERE userId=?", id)) || {};
}

export async function savePrivateProfile(id, payload) {
  const fields = [];
  const values = [];
  for (const [key, limit] of [["address",500], ["phone",32], ["avatar",160000]]) {
    if (!(key in payload)) continue;
    const value = payload[key];
    requireCondition(typeof value === "string" && value.length <= limit, "ข้อมูลส่วนตัวยาวเกินกำหนด", 400);
    if (key === "avatar" && value) {
      requireCondition(/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value), "รูปโปรไฟล์ไม่ถูกต้อง", 400);
    }
    fields.push(key);
    values.push(value.trim());
  }
  if (!fields.length) return;
  await execute("CREATE TABLE IF NOT EXISTS AccountProfile (userId INTEGER PRIMARY KEY REFERENCES User(id), address TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '')");
  await execute(`INSERT INTO AccountProfile(userId,${fields.join(",")}) VALUES(?,${fields.map(()=>"?").join(",")})
    ON CONFLICT(userId) DO UPDATE SET ${fields.map(k=>k+"=excluded."+k).join(",")}`, id, ...values);
}
