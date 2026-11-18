function database() {
  return window.showcaseDb;
}
function queryAll(sql, ...parameters) {
  return database()
    .prepare(sql)
    .all(...parameters)
    .map((a) => ({
      ...a,
    }));
}
function queryOne(sql, ...parameters) {
  return queryAll(sql, ...parameters)[0];
}
function execute(sql, ...parameters) {
  return database()
    .prepare(sql)
    .run(...parameters);
}
function insert(table, record) {
  let columns = Object.keys(record);
  return Number(
    execute(
      'INSERT INTO "' +
        table +
        '" (' +
        columns.join(",") +
        ") VALUES (" +
        columns.map(() => "?").join(",") +
        ")",
      ...Object.values(record),
    ).lastInsertRowid,
  );
}
function transaction(operation) {
  let connection = database();
  connection.exec("BEGIN IMMEDIATE");
  try {
    let a = operation();
    connection.exec("COMMIT");
    return a;
  } catch (a) {
    throw (connection.exec("ROLLBACK"), a);
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
function getRecord(table, id) {
  let record = queryOne('SELECT * FROM "' + table + '" WHERE id=?', id);
  requireCondition(record, "ไม่พบข้อมูล", 404);
  return record;
}
function requireBookingAccess(user, booking) {
  user.role === "seller"
    ? requireCondition(booking.sellerId === user.id, "ไม่พบรายการของคุณ", 403)
    : requireRoundAccess(user, getRecord("Round", Number(booking.roundId)));
}
var randomBytes = (e) => ({
  toString: () =>
    Array.from(crypto.getRandomValues(new Uint8Array(e)), (t) =>
      t.toString(16).padStart(2, "0"),
    ).join(""),
});
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
