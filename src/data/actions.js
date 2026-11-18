import {
  execute,
  getRecord,
  insert,
  notifyUser,
  nowIso,
  queryAll,
  queryOne,
  randomBytes,
  requireBookingAccess,
  requireCondition,
  requireRole,
  requireRoundAccess,
  transaction,
  writeAudit,
} from "./database.js";
import { z } from "zod";
function applyManagementAction(user, payload, action) {
  if (action === "profile") {
    execute(
      "UPDATE User SET name=? WHERE id=?",
      requiredText(payload.name, 80),
      user.id,
    );
    return {
      id: user.id,
    };
  }
  if (action === "read") {
    execute("UPDATE Notice SET seen=1 WHERE userId=?", user.id);
    return {
      id: user.id,
    };
  }
  if (action === "buyerProfile" || action === "applyBuyer") {
    requireRole(user, ...(action === "applyBuyer" ? ["seller"] : ["buyer"]));
    let r = requiredText(payload.shop, 100),
      n = requiredText(payload.vehicle, 100),
      o = positiveId(payload.capacity),
      i = requiredText(payload.area, 150);
    execute(
      "INSERT INTO Buyer(userId,shop,vehicle,capacity,area,approved) VALUES(?,?,?,?,?,0) ON CONFLICT(userId) DO UPDATE SET shop=excluded.shop,vehicle=excluded.vehicle,capacity=excluded.capacity,area=excluded.area",
      user.id,
      r,
      n,
      o,
      i,
    );
    return {
      id: user.id,
    };
  }
  if (action === "user") {
    requireRole(user, "admin");
    let r = getRecord("User", positiveId(payload.userId));
    requireCondition(r.id !== user.id, "แก้สิทธิ์บัญชีของตนเองไม่ได้");
    let n = z
      .enum(["admin", "buyer", "seller", "community"])
      .parse(payload.role);
    requireCondition(
      !!getRecord("Community", positiveId(payload.communityId)).active,
      "ชุมชนถูกระงับ",
    );
    n === "buyer" &&
      requireCondition(
        queryOne("SELECT id FROM Buyer WHERE userId=?", r.id),
        "ต้องมีคำขอสมัครร้านก่อน",
      );
    let o = z.boolean().parse(payload.active) ? 1 : 0;
    execute(
      "UPDATE User SET role=?,communityId=?,active=? WHERE id=?",
      n,
      positiveId(payload.communityId),
      o,
      r.id,
    );
    execute(
      "UPDATE Buyer SET approved=? WHERE userId=?",
      n === "buyer" && o ? 1 : 0,
      r.id,
    );
    execute("DELETE FROM Session WHERE userId=?", r.id);
    notifyUser(Number(r.id), "มีการปรับสิทธิ์บัญชีของคุณ");
    return {
      id: Number(r.id),
    };
  }
  if (action === "member") {
    requireRole(user, "community");
    let r = getRecord("User", positiveId(payload.userId));
    requireCondition(
      r.communityId === user.communityId && r.role === "seller",
      "จัดการได้เฉพาะลูกบ้านในชุมชน",
      403,
    );
    execute(
      "UPDATE User SET active=? WHERE id=?",
      z.boolean().parse(payload.active) ? 1 : 0,
      r.id,
    );
    execute("DELETE FROM Session WHERE userId=?", r.id);
    return {
      id: Number(r.id),
    };
  }
  if (action === "community") {
    requireRole(user, "admin", "community");
    let r = payload.communityId ? positiveId(payload.communityId) : 0;
    requireCondition(
      user.role === "admin" || user.communityId === r,
      "ไม่มีสิทธิ์ดูแลชุมชนนี้",
      403,
    );
    let n = requiredText(payload.name, 100),
      o = requiredText(payload.address),
      i = optionalText(payload.guide);
    return r
      ? (getRecord("Community", r),
        execute(
          "UPDATE Community SET name=?,address=?,guide=? WHERE id=?",
          n,
          o,
          i,
          r,
        ),
        {
          id: r,
        })
      : {
          id: insert("Community", {
            name: n,
            address: o,
            guide: i,
          }),
        };
  }
  if (action === "point") {
    requireRole(user, "admin", "community");
    let r = positiveId(payload.communityId);
    requireRoundAccess(user, {
      communityId: r,
    });
    getRecord("Community", r);
    let n = requiredText(payload.name, 100),
      o = requiredText(payload.address);
    if (payload.pointId) {
      let i = getRecord("Point", positiveId(payload.pointId));
      requireCondition(i.communityId === r, "จุดรับอยู่คนละชุมชน");
      execute(
        "UPDATE Point SET name=?,address=?,active=? WHERE id=?",
        n,
        o,
        payload.active === false ? 0 : 1,
        i.id,
      );
      return {
        id: Number(i.id),
      };
    }
    return {
      id: insert("Point", {
        communityId: r,
        name: n,
        address: o,
      }),
    };
  }
  if (action === "material") {
    requireRole(user, "admin");
    let r = requiredText(payload.name, 100),
      n = requiredText(payload.guide),
      o;
    payload.materialId
      ? ((o = positiveId(payload.materialId)),
        getRecord("Material", o),
        execute(
          "UPDATE Material SET name=?,guide=?,active=? WHERE id=?",
          r,
          n,
          payload.active === false ? 0 : 1,
          o,
        ))
      : (o = insert("Material", {
          name: r,
          guide: n,
          art: "paper",
        }));
    insert("Price", {
      materialId: o,
      price: nonnegativeInt(payload.price, 1000000),
      updated: nowIso(),
    });
    return {
      id: o,
    };
  }
  if (action === "round") {
    requireRole(user, "community", "admin");
    let r = positiveId(payload.communityId);
    requireRoundAccess(user, {
      communityId: r,
    });
    let n = getRecord("Point", positiveId(payload.pointId));
    requireCondition(n.communityId === r && n.active, "จุดรับไม่อยู่ในชุมชน");
    let o = isoDate(payload.startAt),
      i = isoDate(payload.endAt),
      u = isoDate(payload.cutoff),
      l = positiveId(payload.capacity),
      s = nonnegativeInt(payload.minimum),
      c = positiveId(payload.maxBookings),
      f = requiredText(payload.name, 120);
    if (
      (requireCondition(u <= o && o < i && s <= l, "ตรวจสอบช่วงเวลาและความจุ"),
      payload.roundId)
    ) {
      let d = getRecord("Round", positiveId(payload.roundId));
      requireRoundAccess(user, d);
      requireCondition(
        d.communityId === r &&
          ["OPEN", "DRAFT", "CONFIRMED", "IN_PROGRESS"].includes(
            String(d.status),
          ),
        "แก้ไขรอบนี้ไม่ได้",
      );
      let m = requiredText(payload.reason);
      requireCondition(
        l >= bookedGrams(Number(d.id)) &&
          c >=
            Number(
              queryOne(
                "SELECT COUNT(*) n FROM Booking WHERE roundId=? AND " +
                  activeBookingFilter,
                d.id,
              )?.n,
            ),
        "ความจุต่ำกว่ายอดจอง",
      );
      execute(
        "UPDATE Round SET pointId=?,name=?,startAt=?,endAt=?,cutoff=?,capacity=?,minimum=?,maxBookings=?,reason=? WHERE id=?",
        n.id,
        f,
        o,
        i,
        u,
        l,
        s,
        c,
        m,
        d.id,
      );
      return {
        id: Number(d.id),
      };
    }
    requireCondition(u > nowIso(), "กำหนดเวลาปิดรับในอนาคต");
    return {
      id: insert("Round", {
        communityId: r,
        pointId: n.id,
        name: f,
        startAt: o,
        endAt: i,
        cutoff: u,
        capacity: l,
        maxBookings: c,
        minimum: s,
        status: payload.draft === true ? "DRAFT" : "OPEN",
        created: nowIso(),
      }),
    };
  }
  if (action === "survey") {
    requireRole(user, "community", "buyer");
    let r = getRecord("Round", positiveId(payload.roundId));
    requireRoundAccess(user, r);
    execute(
      "INSERT INTO Survey(roundId,userId,amount,note,at) VALUES(?,?,?,?,?) ON CONFLICT(roundId,userId) DO UPDATE SET amount=excluded.amount,note=excluded.note,at=excluded.at",
      r.id,
      user.id,
      nonnegativeInt(payload.amount),
      optionalText(payload.note),
      nowIso(),
    );
    return {
      id: Number(r.id),
    };
  }
  if (
    [
      "open",
      "invite",
      "destination",
      "economics",
      "cost",
      "agreement",
    ].includes(action)
  ) {
    let r = getRecord("Round", positiveId(payload.roundId));
    if (
      (requireRoundAccess(user, r),
      action === "open" &&
        (requireRole(user, "community", "admin"),
        requireCondition(
          r.status === "DRAFT" && String(r.cutoff) > nowIso(),
          "เปิดรอบนี้ไม่ได้",
        ),
        execute("UPDATE Round SET status='OPEN' WHERE id=?", r.id)),
      action === "invite")
    ) {
      requireRole(user, "community", "admin");
      requireCondition(r.status === "OPEN" && !r.buyerId, "รอบมีร้านตอบรับแล้ว");
      let n = positiveId(payload.buyerId);
      requireCondition(
        queryOne(
          "SELECT b.id FROM Buyer b JOIN User u ON u.id=b.userId WHERE b.userId=? AND b.approved=1 AND u.active=1 AND u.communityId=?",
          n,
          r.communityId,
        ),
        "ร้านไม่ได้รับอนุมัติในพื้นที่",
      );
      execute("UPDATE Round SET invitedId=? WHERE id=?", n, r.id);
      notifyUser(n, "ได้รับเชิญเข้ารอบ " + r.name);
    }
    if (action === "economics" || action === "destination")
      if (
        (requireRole(user, "buyer"),
        requireCondition(
          ["IN_PROGRESS", "COMPLETED"].includes(String(r.status)),
          "รอบยังไม่เริ่มรับซื้อ",
        ),
        action === "economics")
      )
        execute(
          "INSERT INTO Economics(roundId,resale,trip,other) VALUES(?,?,?,?) ON CONFLICT(roundId) DO UPDATE SET resale=excluded.resale,trip=excluded.trip,other=excluded.other",
          r.id,
          nonnegativeInt(payload.resale),
          nonnegativeInt(payload.trip),
          nonnegativeInt(payload.other),
        );
      else {
        let n = z
          .array(z.record(z.string(), z.unknown()))
          .min(1)
          .max(50)
          .parse(payload.items);
        requireCondition(
          new Set(n.map((o) => o.materialId)).size === n.length,
          "ประเภทวัสดุซ้ำ",
        );
        for (let o of n) {
          let i = positiveId(o.materialId),
            u = nonnegativeInt(o.grams),
            l = nonnegativeInt(o.rejected),
            s = optionalText(o.reason),
            c = Number(
              queryOne(
                "SELECT SUM(w.grams) g FROM Payment p JOIN Booking b ON b.id=p.bookingId JOIN WeighItem w ON w.revisionId=p.revisionId WHERE b.roundId=? AND w.materialId=?",
                r.id,
                i,
              )?.g ?? 0,
            );
          requireCondition(c > 0 && u + l <= c, "น้ำหนักปลายทางเกินยอดรับซื้อ");
          requireCondition(!l || s, "กรุณาระบุสาเหตุคัดทิ้ง");
          execute(
            "INSERT INTO Destination(roundId,materialId,grams,rejected,reason,at) VALUES(?,?,?,?,?,?) ON CONFLICT(roundId,materialId) DO UPDATE SET grams=excluded.grams,rejected=excluded.rejected,reason=excluded.reason,at=excluded.at",
            r.id,
            i,
            u,
            l,
            s,
            nowIso(),
          );
        }
      }
    if (
      (action === "cost" &&
        (requireRole(user, "admin"),
        execute(
          "INSERT INTO PlatformCost(roundId,estimate,actual) VALUES(?,?,?) ON CONFLICT(roundId) DO UPDATE SET estimate=excluded.estimate,actual=excluded.actual",
          r.id,
          nonnegativeInt(payload.estimate),
          payload.actual == null ? null : nonnegativeInt(payload.actual),
        )),
      action === "agreement")
    ) {
      requireRole(user, "admin");
      let n = z.enum(["community", "buyer"]).parse(payload.payer);
      requireCondition(
        !queryOne(
          "SELECT id FROM Agreement WHERE roundId=? AND payer=?",
          r.id,
          n,
        ),
        "มีข้อตกลงฝั่งนี้แล้ว",
      );
      insert("Agreement", {
        roundId: r.id,
        payer: n,
        amount: nonnegativeInt(payload.amount),
        triggerText: requiredText(payload.triggerText),
      });
    }
    return {
      id: Number(r.id),
    };
  }
  if (action === "issue" || action === "settle") {
    requireRole(user, "admin");
    let r = getRecord("Agreement", positiveId(payload.agreementId)),
      n = queryOne("SELECT * FROM Charge WHERE agreementId=?", r.id);
    action === "issue"
      ? (requireCondition(!n, "ออกใบเรียกเก็บแล้ว"),
        insert("Charge", {
          agreementId: r.id,
          issued: nowIso(),
        }))
      : (requireCondition(n && !n.paid, "ไม่มีใบเรียกเก็บค้างชำระ"),
        execute("UPDATE Charge SET paid=? WHERE id=?", nowIso(), n.id));
    return {
      id: Number(r.id),
    };
  }
  requireCondition(false, "ไม่พบการดำเนินการ", 400);
}
var nonnegativeInt = (e, t = 1000000000) =>
    z.number().int().min(0).max(t).parse(e),
  positiveId = (e) => z.number().int().positive().parse(e),
  requiredText = (e, t = 500) => z.string().trim().min(1).max(t).parse(e),
  optionalText = (e, t = 500) =>
    e === void 0 || e === "" ? "" : requiredText(e, t),
  isoDate = (e) =>
    z
      .string()
      .datetime({
        offset: true,
      })
      .transform((t) => new Date(t).toISOString())
      .parse(e);
function priceForGrams(grams, price) {
  return Number((BigInt(grams) * BigInt(price) + 500n) / 1000n);
}
var activeBookingFilter = "status NOT IN ('CANCELLED','NO_SHOW')";
function bookedGrams(e, t = 0) {
  return Number(
    queryOne(
      "SELECT COALESCE(SUM(i.grams),0) AS g FROM BookingItem i JOIN Booking b ON b.id=i.bookingId WHERE b.roundId=? AND b.id<>? AND b." +
        activeBookingFilter,
      e,
      t,
    )?.g,
  );
}
function parseItems(e) {
  return z.array(z.record(z.string(), z.unknown())).min(1).max(50).parse(e);
}
function requireUniqueMaterials(e) {
  requireCondition(
    new Set(e.map((t) => positiveId(t.materialId))).size === e.length,
    "ประเภทวัสดุซ้ำ",
  );
}
function setBookingStatus(e, t, a, r = "") {
  execute("UPDATE Booking SET status=?,version=version+1 WHERE id=?", a, t.id);
  insert("Event", {
    bookingId: t.id,
    actorId: e.id,
    status: a,
    note: r,
    at: nowIso(),
  });
  notifyUser(
    Number(t.sellerId),
    String(t.code) + " · " + (r || "สถานะรายการเปลี่ยนแล้ว"),
  );
  let n = getRecord("Round", Number(t.roundId)).buyerId;
  n &&
    n !== e.id &&
    notifyUser(Number(n), String(t.code) + " · มีความเคลื่อนไหวใหม่");
}
function requireStatus(e, ...t) {
  requireCondition(
    t.includes(String(e.status)),
    "สถานะรายการเปลี่ยนแล้ว กรุณาตรวจข้อมูลล่าสุด",
  );
}
function requireApprovedBuyer(e) {
  requireRole(e, "buyer");
  requireCondition(
    queryOne("SELECT id FROM Buyer WHERE userId=? AND approved=1", e.id),
    "ร้านยังไม่ได้รับอนุมัติ",
    403,
  );
}
function saveBooking(user, payload, editing) {
  requireRole(user, "seller");
  let r = editing
    ? getRecord("Booking", positiveId(payload.bookingId))
    : void 0;
  r && (requireBookingAccess(user, r), requireStatus(r, "BOOKED"));
  let n = getRecord(
    "Round",
    r ? Number(r.roundId) : positiveId(payload.roundId),
  );
  requireRoundAccess(user, n);
  requireCondition(
    n.status === "OPEN" && String(n.cutoff) > nowIso(),
    "รอบนี้ปิดรับจองแล้ว",
  );
  let o = parseItems(payload.items);
  requireUniqueMaterials(o);
  let i = o.map((f) => {
      let d = getRecord("Material", positiveId(f.materialId));
      requireCondition(d.active, "วัสดุนี้ปิดรับแล้ว");
      let m = queryOne(
        "SELECT price FROM Price WHERE materialId=? ORDER BY id DESC LIMIT 1",
        d.id,
      );
      requireCondition(m, "ยังไม่มีราคาอ้างอิง");
      return {
        materialId: d.id,
        grams: positiveId(f.grams),
        price: m.price,
      };
    }),
    u = Number(
      queryOne(
        "SELECT count(*) AS n FROM Booking WHERE roundId=? AND " +
          activeBookingFilter +
          " AND id<>?",
        n.id,
        r?.id ?? 0,
      )?.n,
    ),
    l = i.reduce((f, d) => f + d.grams, 0);
  requireCondition(
    bookedGrams(Number(n.id), Number(r?.id ?? 0)) + l <= Number(n.capacity) &&
      u < Number(n.maxBookings),
    "ความจุหรือจำนวนรายการของรอบไม่เพียงพอ",
  );
  let s = optionalText(payload.note),
    c = r
      ? Number(r.id)
      : insert("Booking", {
          roundId: n.id,
          sellerId: user.id,
          code: "TC-" + randomBytes(5).toString("hex").toUpperCase(),
          status: "BOOKED",
          note: s,
          created: nowIso(),
        });
  r &&
    (execute("DELETE FROM BookingItem WHERE bookingId=?", c),
    execute("UPDATE Booking SET note=?,version=version+1 WHERE id=?", s, c));
  for (let f of i)
    insert("BookingItem", {
      bookingId: c,
      ...f,
    });
  insert("Event", {
    bookingId: c,
    actorId: user.id,
    status: "BOOKED",
    note: editing ? "แก้ไขคำขอขาย" : "จองพื้นที่ในรอบแล้ว",
    at: nowIso(),
  });
  return {
    id: c,
  };
}
function applyRoundAction(user, payload, action) {
  let round = getRecord("Round", positiveId(payload.roundId));
  if (["claim", "decline", "estimate"].includes(action)) {
    requireApprovedBuyer(user);
    let n = queryOne("SELECT * FROM Buyer WHERE userId=?", user.id);
    if (
      (requireCondition(
        round.status === "OPEN" &&
          !round.buyerId &&
          (!round.invitedId || round.invitedId === user.id) &&
          user.communityId === round.communityId,
        "รอบนี้ไม่เปิดรับร้านของคุณ",
      ),
      action === "estimate")
    )
      execute(
        "INSERT INTO Estimate(roundId,userId,resale,trip,other) VALUES(?,?,?,?,?) ON CONFLICT(roundId,userId) DO UPDATE SET resale=excluded.resale,trip=excluded.trip,other=excluded.other",
        round.id,
        user.id,
        nonnegativeInt(payload.resale),
        nonnegativeInt(payload.trip),
        nonnegativeInt(payload.other),
      );
    else if (action === "decline")
      (execute(
        "INSERT OR REPLACE INTO Decline(roundId,userId,reason,at) VALUES(?,?,?,?)",
        round.id,
        user.id,
        optionalText(payload.reason) || "ไม่สะดวกรับรอบ",
        nowIso(),
      ),
        round.invitedId === user.id &&
          execute("UPDATE Round SET invitedId=NULL WHERE id=?", round.id));
    else {
      requireCondition(
        Number(n.capacity) >= bookedGrams(Number(round.id)),
        "รถมีความจุไม่เพียงพอ",
      );
      execute("UPDATE Round SET buyerId=? WHERE id=?", user.id, round.id);
      for (let o of queryAll(
        "SELECT id FROM User WHERE communityId=? AND role='community'",
        round.communityId,
      ))
        notifyUser(Number(o.id), "ร้านตอบรับรอบ " + round.name);
    }
  } else if (
    (requireRole(user, "community", "admin"),
    requireRoundAccess(user, round),
    action === "confirm")
  ) {
    requireCondition(
      round.status === "OPEN" && round.buyerId,
      "กรุณารอร้านตอบรับก่อนยืนยัน",
    );
    let n = queryOne(
        "SELECT bp.* FROM Buyer bp JOIN User u ON u.id=bp.userId WHERE bp.userId=? AND bp.approved=1 AND u.active=1",
        round.buyerId,
      ),
      o = bookedGrams(Number(round.id));
    requireCondition(
      n && Number(n.capacity) >= o && Number(round.capacity) >= o,
      "ความจุรถหรือรอบไม่เพียงพอ",
    );
    let i = optionalText(payload.reason);
    requireCondition(
      o >= Number(round.minimum) || i,
      "ต้องระบุเหตุผลอนุมัติต่ำกว่าเกณฑ์",
    );
    execute(
      "UPDATE Round SET status='CONFIRMED',reason=? WHERE id=?",
      i,
      round.id,
    );
    for (let u of queryAll(
      "SELECT * FROM Booking WHERE roundId=? AND status='BOOKED'",
      round.id,
    ))
      setBookingStatus(user, u, "CONFIRMED", "ชุมชนยืนยันนัดแล้ว");
  } else if (action === "cancelRound") {
    requireCondition(
      ["OPEN", "CONFIRMED", "DRAFT"].includes(String(round.status)),
      "เริ่มงานแล้ว ยกเลิกทั้งรอบไม่ได้",
    );
    let n = requiredText(payload.reason);
    execute(
      "UPDATE Round SET status='CANCELLED',reason=? WHERE id=?",
      n,
      round.id,
    );
    for (let o of queryAll(
      "SELECT * FROM Booking WHERE roundId=? AND status IN ('BOOKED','CONFIRMED')",
      round.id,
    ))
      setBookingStatus(user, o, "CANCELLED", n);
  } else
    (requireCondition(
      ["CONFIRMED", "IN_PROGRESS"].includes(String(round.status)),
      "ยังปิดรอบไม่ได้",
    ),
      requireCondition(
        !queryOne(
          "SELECT id FROM Booking WHERE roundId=? AND status NOT IN ('CANCELLED','COMPLETED','NO_SHOW')",
          round.id,
        ),
        "ยังมีรายการค้างในรอบ",
      ),
      execute("UPDATE Round SET status='COMPLETED' WHERE id=?", round.id));
  return {
    id: Number(round.id),
  };
}
function applyBookingAction(user, payload, action) {
  let booking = getRecord("Booking", positiveId(payload.bookingId));
  requireBookingAccess(user, booking);
  let n = getRecord("Round", Number(booking.roundId)),
    o = queryOne(
      "SELECT * FROM Revision WHERE bookingId=? ORDER BY number DESC LIMIT 1",
      booking.id,
    );
  if (
    (action === "cancel" &&
      (requireRole(user, "seller"),
      requireStatus(booking, "BOOKED", "CONFIRMED"),
      requireCondition(String(n.cutoff) > nowIso(), "พ้นกำหนดยกเลิก"),
      setBookingStatus(
        user,
        booking,
        "CANCELLED",
        optionalText(payload.reason) || "ผู้ขายยกเลิกนัด",
      )),
    (action === "checkin" || action === "noShow") &&
      (requireApprovedBuyer(user),
      requireStatus(booking, "CONFIRMED"),
      action === "checkin"
        ? requireCondition(
            requiredText(payload.code).toUpperCase() === booking.code,
            "รหัสนัดไม่ถูกต้อง",
          )
        : requireCondition(nowIso() > String(n.endAt), "ยังไม่สิ้นสุดช่วงนัด"),
      execute(
        "UPDATE Round SET status='IN_PROGRESS' WHERE id=? AND status='CONFIRMED'",
        n.id,
      ),
      setBookingStatus(
        user,
        booking,
        action === "checkin" ? "CHECKED_IN" : "NO_SHOW",
        action === "checkin" ? "ร้านตรวจรหัสนัดแล้ว" : "ไม่มาตามนัด",
      )),
    action === "weigh")
  ) {
    requireApprovedBuyer(user);
    requireStatus(
      booking,
      "CHECKED_IN",
      "AWAITING_SELLER_ACCEPTANCE",
      "ACCEPTED",
    );
    requireCondition(
      positiveId(payload.version) === booking.version,
      "ข้อมูลเดิมเปลี่ยนแล้ว",
    );
    let i = parseItems(payload.items);
    requireUniqueMaterials(i);
    let u = queryAll("SELECT * FROM BookingItem WHERE bookingId=?", booking.id);
    requireCondition(
      i.length === u.length &&
        i.every((f) => u.some((d) => d.materialId === f.materialId)),
      "กรุณาระบุผลครบทุกวัสดุ",
    );
    let l = optionalText(payload.reason);
    requireCondition(!o || l, "กรุณาระบุเหตุผลที่แก้ผลชั่ง");
    let s = i.map((f) => {
        let d = nonnegativeInt(f.grams, 100000000),
          m = nonnegativeInt(f.price, 1000000),
          g = optionalText(f.reason);
        requireCondition(d > 0 || g, "กรุณาระบุเหตุผลที่ไม่รับ");
        return {
          materialId: positiveId(f.materialId),
          grams: d,
          price: m,
          amount: priceForGrams(d, m),
          reason: g,
        };
      }),
      c = insert("Revision", {
        bookingId: booking.id,
        actorId: user.id,
        number: Number(o?.number ?? 0) + 1,
        total: s.reduce((f, d) => f + d.amount, 0),
        reason: l,
        at: nowIso(),
      });
    for (let f of s)
      insert("WeighItem", {
        revisionId: c,
        ...f,
      });
    o &&
      execute(
        "UPDATE Acceptance SET revoked=? WHERE revisionId=?",
        nowIso(),
        o.id,
      );
    setBookingStatus(
      user,
      booking,
      "AWAITING_SELLER_ACCEPTANCE",
      l || "ร้านส่งผลชั่งให้ตรวจ",
    );
    return {
      id: Number(booking.id),
      revisionId: c,
    };
  }
  if (
    (action === "accept" &&
      (requireRole(user, "seller"),
      requireStatus(booking, "AWAITING_SELLER_ACCEPTANCE"),
      requireCondition(
        o && o.id === positiveId(payload.revisionId),
        "ผลชั่งรุ่นนี้ถูกแทนที่แล้ว",
      ),
      insert("Acceptance", {
        revisionId: o.id,
        sellerId: user.id,
        at: nowIso(),
      }),
      setBookingStatus(user, booking, "ACCEPTED", "ผู้ขายตกลงยอดซื้อขาย")),
    action === "pay")
  ) {
    requireApprovedBuyer(user);
    requireStatus(booking, "ACCEPTED");
    requireCondition(
      o &&
        o.id === positiveId(payload.revisionId) &&
        queryOne(
          "SELECT id FROM Acceptance WHERE revisionId=? AND revoked IS NULL",
          o.id,
        ),
      "ต้องได้รับการยืนยันผลชั่งล่าสุด",
    );
    let i = z.enum(["cash", "transfer"]).parse(payload.method),
      u = optionalText(payload.reference, 100),
      l = isoDate(payload.paidAt);
    requireCondition(
      l <= new Date(Date.now() + 60000).toISOString(),
      "เวลาจ่ายต้องไม่อยู่ในอนาคต",
    );
    requireCondition(i === "cash" || u, "กรุณาระบุเลขอ้างอิงโอน");
    insert("Payment", {
      bookingId: booking.id,
      revisionId: o.id,
      amount: o.total,
      method: i,
      reference: u,
      paidAt: l,
      actorId: user.id,
      recorded: nowIso(),
    });
    setBookingStatus(user, booking, "PAYMENT_REPORTED", "ร้านแจ้งว่าจ่ายแล้ว");
  }
  if (action === "receive") {
    requireRole(user, "seller");
    requireStatus(booking, "PAYMENT_REPORTED");
    let i = queryOne("SELECT id FROM Payment WHERE bookingId=?", booking.id);
    insert("Receipt", {
      paymentId: i.id,
      sellerId: user.id,
      at: nowIso(),
    });
    setBookingStatus(user, booking, "COMPLETED", "ผู้ขายยืนยันได้รับเงินแล้ว");
  }
  if (action === "dispute" || action === "reject") {
    requireRole(user, "seller");
    requireStatus(
      booking,
      "AWAITING_SELLER_ACCEPTANCE",
      "ACCEPTED",
      "PAYMENT_REPORTED",
    );
    let i = requiredText(payload.reason);
    insert("Dispute", {
      bookingId: booking.id,
      openerId: user.id,
      prior: booking.status,
      reason: i,
      opened: nowIso(),
    });
    setBookingStatus(user, booking, "DISPUTED", i);
    for (let u of queryAll(
      "SELECT id FROM User WHERE role='admin' AND active=1",
    ))
      notifyUser(Number(u.id), "มีข้อพิพาท " + booking.code);
  }
  if (action === "resolve") {
    requireRole(user, "admin");
    requireStatus(booking, "DISPUTED");
    let i = queryOne(
        "SELECT * FROM Dispute WHERE bookingId=? AND closed IS NULL",
        booking.id,
      ),
      u = requiredText(payload.reason);
    execute(
      "UPDATE Dispute SET handlerId=?,resolution=?,closed=? WHERE id=?",
      user.id,
      u,
      nowIso(),
      i.id,
    );
    setBookingStatus(user, booking, String(i.prior), u);
  }
  return {
    id: Number(booking.id),
  };
}
function applyAction(user, payload) {
  let action = requiredText(payload.action, 40);
  return transaction(() => {
    let r;
    action === "book" || action === "editBooking"
      ? (r = saveBooking(user, payload, action === "editBooking"))
      : [
            "claim",
            "confirm",
            "decline",
            "estimate",
            "cancelRound",
            "finishRound",
          ].includes(action)
        ? (r = applyRoundAction(user, payload, action))
        : [
              "cancel",
              "checkin",
              "noShow",
              "weigh",
              "accept",
              "pay",
              "receive",
              "dispute",
              "reject",
              "resolve",
            ].includes(action)
          ? (r = applyBookingAction(user, payload, action))
          : (r = applyManagementAction(user, payload, action));
    writeAudit(user, action, String(r.id), optionalText(payload.reason));
    return r;
  });
}
export { priceForGrams, applyAction };
