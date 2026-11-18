import {
  authenticate,
  clearCookie,
  digest,
  identity,
  sessionHash,
} from "../server/auth.js";
import { applyAction } from "../server/actions.js";
import { loadState } from "../server/state.js";
import {
  execute,
  getRecord,
  insert,
  queryOne,
  requireBookingAccess,
  requireCondition,
  transaction,
  writeAudit,
} from "../server/database.js";

async function jsonBody(req) {
  requireCondition(
    (req.headers["content-type"] || "").split(";")[0] === "application/json",
    "ต้องส่งข้อมูล JSON",
    415,
  );
  let input = req.body;
  if (input === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      requireCondition(size <= 900000, "ไฟล์ใหญ่เกินไป", 413);
      chunks.push(chunk);
    }
    input = Buffer.concat(chunks).toString("utf8");
  }
  if (typeof input === "string" || Buffer.isBuffer(input)) {
    try {
      input = JSON.parse(input.toString());
    } catch {
      requireCondition(false, "รูปแบบข้อมูลไม่ถูกต้อง", 400);
    }
  }
  requireCondition(
    input && typeof input === "object" && !Array.isArray(input),
    "รูปแบบข้อมูลไม่ถูกต้อง",
    400,
  );
  return input;
}
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}
async function activeUser(hash) {
  const current = await identity(hash);
  requireCondition(current, "กรุณาเข้าสู่ระบบ", 401);
  return current;
}
export default async function handler(req, res) {
  const url = new URL(req.url, "https://saleng-digital.vercel.app");
  const route = url.pathname.split("/").pop();
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "Cookie");
  try {
    const hash = sessionHash(req);
    if (req.method === "GET" && route === "catalog") {
      const { materials, communities } = await transaction(
        () => loadState(null),
        "read",
      );
      return json(res, 200, { materials, communities, demo: false });
    }
    if (req.method === "GET" && route === "state") {
      if (!hash) return json(res, 200, { user: null });
      if (url.searchParams.has("since")) {
        const current = await identity(hash);
        if (!current) return json(res, 200, { user: null });
        if (
          url.searchParams.get("since") ===
          current.id + "-" + current.revision
        )
          return json(res, 200, { unchanged: true, serverTime: Date.now() });
      }
      const data = await transaction(async () => {
        const user = await identity(hash);
        if (!user) return { user: null };
        const version = user.id + "-" + user.revision;
        delete user.revision;
        return {
          ...(await loadState(user)),
          version,
          canClaimOwner:
            user.role !== "admin" &&
            !!(await queryOne("SELECT id FROM OwnerSetup WHERE id=1")),
        };
      }, "read");
      return json(res, 200, data);
    }
    if (req.method === "GET" && route === "image") {
      const image = await transaction(async () => {
        const user = await activeUser(hash);
        const row = await getRecord(
          "Attachment",
          Number(url.searchParams.get("id")),
        );
        await requireBookingAccess(
          user,
          await getRecord("Booking", row.bookingId),
        );
        requireCondition(
          user.role !== "community" || row.kind === "material",
          "ไม่พบภาพ",
          404,
        );
        return row.file;
      }, "read");
      res.setHeader("Content-Type", "image/webp");
      return res.end(Buffer.from(image, "base64"));
    }
    requireCondition(
      req.method === "POST" && ["auth", "action", "image"].includes(route),
      "ไม่พบหน้าที่ขอ",
      404,
    );
    const origin = req.headers.origin;
    requireCondition(
      !origin || new URL(origin).host === req.headers.host,
      "ไม่อนุญาตคำขอ",
      403,
    );
    const body = await jsonBody(req);
    if (route === "auth") {
      const ip = String(
        req.headers["x-vercel-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "local",
      ).split(",")[0];
      res.setHeader("Set-Cookie", await authenticate(body, ip));
      return json(res, 200, { ok: true });
    }
    if (route === "action" && body.action === "logout") {
      if (hash) await execute("DELETE FROM Session WHERE token=?", hash);
      res.setHeader("Set-Cookie", clearCookie());
      return json(res, 200, { ok: true });
    }
    const result = await transaction(async () => {
      const user = await activeUser(hash);
      if (route === "image") {
        const booking = await getRecord("Booking", Number(body.bookingId));
        await requireBookingAccess(user, booking);
        requireCondition(
          (body.kind === "material" &&
            user.role === "seller" &&
            booking.status === "BOOKED") ||
            (body.kind === "proof" &&
              user.role === "buyer" &&
              booking.status === "PAYMENT_REPORTED"),
          "แนบภาพไม่ได้ในสถานะนี้",
          403,
        );
        requireCondition(
          typeof body.data === "string" && body.data.length <= 800000,
          "ไฟล์ภาพใหญ่เกินไป",
          413,
        );
        const bytes = Buffer.from(body.data, "base64");
        requireCondition(
          bytes.length >= 16 &&
            bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP",
          "ต้องเป็นภาพ WebP",
          400,
        );
        return {
          id: await insert("Attachment", {
            bookingId: booking.id,
            actorId: user.id,
            kind: body.kind,
            file: bytes.toString("base64"),
            mime: "image/webp",
            at: new Date().toISOString(),
          }),
        };
      }
      if (body.action === "claimOwner") {
        const removed = await execute(
          "DELETE FROM OwnerSetup WHERE id=1 AND digest=?",
          digest(String(body.code || "").trim()),
        );
        requireCondition(
          removed.rowsAffected === 1,
          "รหัสไม่ถูกต้องหรือเคยใช้แล้ว",
          403,
        );
        await execute("UPDATE User SET role='admin' WHERE id=?", user.id);
        await writeAudit(user, "claimOwner", String(user.id));
        return { ok: true };
      }
      return applyAction(user, body);
    });
    return json(res, 200, result);
  } catch (error) {
    const status =
      Number.isInteger(error.code) && error.code >= 400 && error.code < 500
        ? error.code
        : error.name === "ZodError"
          ? 400
          : 500;
    if (status === 500)
      console.error(
        "Saleng API",
        route,
        error.name,
        error.code || "server_error",
      );
    return json(res, status, {
      error:
        status === 500
          ? "เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง"
          : error.name === "ZodError"
            ? "กรุณาตรวจข้อมูลอีกครั้ง"
            : error.message,
    });
  }
}
