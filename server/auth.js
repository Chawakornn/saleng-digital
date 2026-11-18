import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  execute,
  insert,
  queryOne,
  requireCondition,
  transaction,
} from "./database.js";

const derive = promisify(scrypt);
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
const saltBytes = 16,
  keyBytes = 64;
const lifetime = 7 * 86400;
const cookieName = "__Host-saleng";
const cookie = (value, seconds) =>
  `${cookieName}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`;
export const clearCookie = () => cookie("", 0);
export function sessionHash(req) {
  const entry = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="));
  const token = entry?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? digest(token) : null;
}
export async function identity(hash) {
  if (!hash) return null;
  return await queryOne(
    `SELECT u.id,u.username,u.name,u.role,u.communityId,v.revision
    FROM Session s JOIN User u ON u.id=s.userId CROSS JOIN AppVersion v
    WHERE s.token=? AND s.expires>? AND u.active=1 AND v.id=1`,
    hash,
    new Date().toISOString(),
  );
}
async function limited(key, max) {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - 15 * 60000).toISOString();
  const attempt = await queryOne(
    `INSERT INTO LoginAttempt(key,attempts,since) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN since < ? THEN 1 ELSE attempts+1 END,
    since=CASE WHEN since < ? THEN excluded.since ELSE since END RETURNING attempts`,
    digest(key),
    now,
    cutoff,
    cutoff,
  );
  requireCondition(attempt.attempts <= max, "ลองหลายครั้งแล้ว กรุณารอ 15 นาที", 429);
}
const passwordKey = (password, salt) =>
  derive(password, salt, keyBytes, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
export async function authenticate(body, ip) {
  const signup = body.action === "register";
  requireCondition(signup || body.action === "login", "ไม่พบคำสั่ง", 400);
  const username = String(body.username || "")
    .trim()
    .normalize("NFKC")
    .toLowerCase();
  requireCondition(
    /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_.-]{2,39}$/u.test(username),
    "ใช้ชื่อผู้ใช้ 3–40 ตัว เช่น mali.01",
    400,
  );
  const { password } = body;
  requireCondition(
    typeof password === "string" &&
      password.length >= 1 &&
      Buffer.byteLength(password) <= 256,
    "กรุณาตรวจรหัสผ่าน",
    400,
  );
  await limited((signup ? "signup:" : "login:") + ip, signup ? 15 : 90);
  let encoded, name;
  if (signup) {
    name = String(body.name || "").trim();
    requireCondition(
      name.length >= 1 && name.length <= 80,
      "ระบุชื่อที่แสดง 1–80 ตัว",
      400,
    );
    requireCondition(password.length >= 8, "ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร", 400);
    const salt = randomBytes(saltBytes).toString("hex");
    encoded = salt + ":" + (await passwordKey(password, salt)).toString("hex");
  } else {
    await limited("account:" + username, 20);
    const found = await queryOne(
      "SELECT passwordHash,active FROM User WHERE username=?",
      username,
    );
    const [salt, hash] = (
      found?.passwordHash || "0".repeat(32) + ":" + "0".repeat(128)
    ).split(":");
    const key = await passwordKey(password, salt);
    requireCondition(
      found?.active &&
        hash.length === 128 &&
        timingSafeEqual(key, Buffer.from(hash, "hex")),
      "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      401,
    );
    encoded = found.passwordHash;
  }
  return transaction(async () => {
    let id;
    if (signup) {
      requireCondition(
        !(await queryOne("SELECT id FROM User WHERE username=?", username)),
        "ชื่อผู้ใช้นี้ถูกใช้แล้ว",
        409,
      );
      id = await insert("User", {
        username,
        name,
        passwordHash: encoded,
        role: "seller",
        communityId: 1,
      });
    } else {
      const found = await queryOne(
        "SELECT id FROM User WHERE username=? AND active=1 AND passwordHash=?",
        username,
        encoded,
      );
      requireCondition(found, "กรุณาเข้าสู่ระบบอีกครั้ง", 401);
      id = found.id;
      await execute(
        "DELETE FROM LoginAttempt WHERE key=?",
        digest("account:" + username),
      );
    }
    const token = randomBytes(32).toString("hex");
    await execute(
      "DELETE FROM Session WHERE expires<=?",
      new Date().toISOString(),
    );
    await execute(
      "DELETE FROM LoginAttempt WHERE since<?",
      new Date(Date.now() - 86400000).toISOString(),
    );
    await insert("Session", {
      token: digest(token),
      userId: id,
      expires: new Date(Date.now() + lifetime * 1000).toISOString(),
    });
    return cookie(token, lifetime);
  });
}
