import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";

const context = new AsyncLocalStorage();
let client;
export function database() {
  if (context.getStore()) return context.getStore();
  client ??= createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return client;
}
async function queryAll(sql, ...args) {
  return (await database().execute({ sql, args })).rows.map((row) => ({
    ...row,
  }));
}
async function queryOne(sql, ...args) {
  return (await queryAll(sql, ...args))[0];
}
function execute(sql, ...args) {
  return database().execute({ sql, args });
}
async function insert(table, record) {
  const columns = Object.keys(record);
  const result = await execute(
    'INSERT INTO "' +
      table +
      '" (' +
      columns.join(",") +
      ") VALUES (" +
      columns.map(() => "?").join(",") +
      ")",
    ...Object.values(record),
  );
  return Number(result.lastInsertRowid);
}
async function transaction(operation, mode = "write") {
  if (context.getStore()) return operation();
  const tx = await database().transaction(mode);
  try {
    const result = await context.run(tx, operation);
    await tx.commit();
    return result;
  } finally {
    tx.close();
  }
}
var DomainError = class extends Error {
  code;
  constructor(t, a = 409) {
    super(t);
    this.code = a;
  }
};
function requireCondition(condition, message, code = 409) {
  if (!condition) throw new DomainError(message, code);
}
var nowIso = () => new Date().toISOString(),
  writeAudit = (e, t, a, r = "") =>
    insert("Audit", {
      actorId: e.id,
      action: t,
      subject: a,
      note: r,
      at: nowIso(),
    }),
  notifyUser = (e, t) =>
    insert("Notice", {
      userId: e,
      message: t,
      at: nowIso(),
    });
function requireRole(user, ...roles) {
  requireCondition(roles.includes(user.role), "ไม่มีสิทธิ์ทำรายการนี้", 403);
}
function requireRoundAccess(user, round) {
  requireCondition(
    user.role === "admin" ||
      (user.role === "buyer"
        ? round.buyerId === user.id
        : user.communityId === round.communityId),
    "อยู่นอกพื้นที่ที่ได้รับมอบหมาย",
    403,
  );
}
async function getRecord(table, id) {
  let record = await queryOne('SELECT * FROM "' + table + '" WHERE id=?', id);
  requireCondition(record, "ไม่พบข้อมูล", 404);
  return record;
}
async function requireBookingAccess(user, booking) {
  user.role === "seller"
    ? requireCondition(booking.sellerId === user.id, "ไม่พบรายการของคุณ", 403)
    : requireRoundAccess(
        user,
        await getRecord("Round", Number(booking.roundId)),
      );
}
export {
  execute,
  requireRole,
  getRecord,
  requireCondition,
  queryOne,
  notifyUser,
  insert,
  requireRoundAccess,
  nowIso,
  requireBookingAccess,
  randomBytes,
  queryAll,
  transaction,
  writeAudit,
};
