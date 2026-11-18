import { execute, insert, nowIso, queryOne, transaction } from "./database.js";
import { applyAction } from "./actions.js";
var seedDatabase = () => transaction(insertDemoRecords);
function insertDemoRecords() {
  if (queryOne("SELECT id FROM Audit WHERE action='seed.v1'")) return;
  let e = "synthetic",
    t = ["บ้านในสวน", "ริมคลองสีเขียว"].map((u, l) =>
      insert("Community", {
        name: u,
        address: l ? "ถนนริมคลอง เขตชุมชนสมมติ" : "ซอยสวนร่วมใจ กรุงเทพฯ (ที่อยู่สาธิต)",
        guide: "ล้างให้สะอาด ผึ่งให้แห้ง และแยกชนิดก่อนนำมาที่จุดรับ",
      }),
    ),
    a = t.map((u) =>
      insert("Point", {
        name: "ลานอาคารกลาง",
        address: "ชั้น 1 ข้างทางเข้าลานจอดจักรยาน",
        communityId: u,
      }),
    ),
    r = {};
  for (let [u, l, s, c] of [
    ["seller", "มะลิ ใจดี", "seller", 0],
    ["buyer", "ร้านลุงชัยรีไซเคิล", "buyer", 0],
    ["community", "อร ผู้ดูแลชุมชน", "community", 0],
    ["admin", "นที ผู้ดูแลระบบ", "admin", 0],
    ["buyer2", "ร้านวงศ์วนรีไซเคิล", "buyer", 0],
    ["seller2", "ต้น ริมคลอง", "seller", 1],
    ["community2", "นวล ริมคลอง", "community", 1],
  ]) {
    let f = u + "@trashtocash.example",
      d = t[c],
      m = insert("User", {
        name: l,
        email: f,
        password: e,
        role: s,
        communityId: d,
        demo: 1,
      });
    r[u] = {
      name: l,
      email: f,
      id: m,
      role: s,
      communityId: d,
    };
    s === "buyer" &&
      insert("Buyer", {
        userId: m,
        shop: l,
        vehicle: "รถกระบะตู้โปร่ง",
        capacity: 800000,
        area: "บ้านในสวน",
        approved: 1,
      });
  }
  let n = [
      ["ขวดพลาสติก PET", "pet", 850, "เทของเหลวให้หมด แยกฝา และบีบขวดให้แบน"],
      ["กระดาษลัง", "cardboard", 420, "แกะเทปกาว พับให้แบนและมัดรวมกัน"],
      ["กระป๋องอะลูมิเนียม", "aluminum", 4800, "ล้างคราบเครื่องดื่ม ผึ่งแห้ง และบีบให้เล็กลง"],
      ["กระดาษขาวดำ", "paper", 600, "แยกกระดาษเคลือบและนำลวดเย็บออก"],
      ["ขวดแก้ว", "glass", 150, "แยกสีและถอดฝา หลีกเลี่ยงเศษแก้วแตก"],
      ["เหล็ก", "steel", 700, "แยกโลหะต่างชนิด เก็บปลายคมให้ปลอดภัย"],
    ].map(([u, l, s, c]) => {
      let f = insert("Material", {
        name: u,
        art: l,
        guide: c,
      });
      insert("Price", {
        materialId: f,
        price: s,
        updated: nowIso(),
      });
      return f;
    }),
    o = (u, l) => {
      let s = new Date(Date.now() + u * 86400000);
      s.setUTCHours(l, 0, 0, 0);
      return s.toISOString();
    };
  function i(u, l, s = 0) {
    return insert("Round", {
      name: u,
      communityId: t[s],
      pointId: a[s],
      startAt: o(l, 2),
      endAt: o(l, 6),
      cutoff: o(l - 1, 12),
      capacity: 300000,
      maxBookings: 35,
      minimum: 15000,
      status: "OPEN",
      created: nowIso(),
    });
  }
  i("นัดรับรีไซเคิลประจำสัปดาห์", 3);
  i("รอบเช้าวันชุมชนสีเขียว", 9);
  i("นัดรับรีไซเคิลริมคลอง", 5, 1);
  for (let [u, l] of ["COMPLETED", "DISPUTED"].entries()) {
    let s = i(u ? "รอบติดตามผลชั่ง" : "รอบรับซื้อที่ผ่านมา", -2 - u);
    execute(
      "UPDATE Round SET status=?,buyerId=? WHERE id=?",
      u ? "IN_PROGRESS" : "COMPLETED",
      r.buyer.id,
      s,
    );
    let c = (y) =>
        new Date(new Date(o(-2 - u, 2)).getTime() + y * 60000).toISOString(),
      f = insert("Booking", {
        roundId: s,
        sellerId: r.seller.id,
        code: "TC-DEMO000" + (u + 1),
        status: l,
        note: "ตัวอย่างสำหรับการเรียนรู้",
        version: u ? 5 : 8,
        created: c(-2000),
      }),
      d = n[0];
    insert("BookingItem", {
      bookingId: f,
      materialId: d,
      grams: 3000,
      price: 850,
    });
    let m = insert("Revision", {
      bookingId: f,
      actorId: r.buyer.id,
      number: 1,
      total: 2550,
      reason: "",
      at: c(4),
    });
    insert("WeighItem", {
      revisionId: m,
      materialId: d,
      grams: 3000,
      price: 850,
      amount: 2550,
      reason: "",
    });
    let g = [
      ["BOOKED", "seller", -2000],
      ["CONFIRMED", "community", -900],
      ["CHECKED_IN", "buyer", 1],
      ["AWAITING_SELLER_ACCEPTANCE", "buyer", 4],
    ];
    if (u)
      (insert("Dispute", {
        bookingId: f,
        openerId: r.seller.id,
        prior: "AWAITING_SELLER_ACCEPTANCE",
        reason: "ขอให้ช่วยตรวจน้ำหนักอีกครั้ง",
        opened: c(6),
      }),
        g.push(["DISPUTED", "seller", 6]));
    else {
      insert("Acceptance", {
        revisionId: m,
        sellerId: r.seller.id,
        at: c(6),
      });
      let y = insert("Payment", {
        bookingId: f,
        revisionId: m,
        amount: 2550,
        method: "cash",
        reference: "",
        paidAt: c(8),
        actorId: r.buyer.id,
        recorded: c(8),
      });
      insert("Receipt", {
        paymentId: y,
        sellerId: r.seller.id,
        at: c(10),
      });
      g.push(
        ["ACCEPTED", "seller", 6],
        ["PAYMENT_REPORTED", "buyer", 8],
        ["COMPLETED", "seller", 10],
      );
    }
    for (let [y, L, h] of g)
      insert("Event", {
        bookingId: f,
        actorId: r[L].id,
        status: y,
        note: "ข้อมูลสาธิต",
        at: c(h),
      });
  }
  insert("Audit", {
    actorId: null,
    action: "seed.v1",
    subject: "local",
    note: "ข้อมูลสาธิต",
    at: nowIso(),
  });
}
function seedDemoTransactions() {
  let e = (u) =>
      queryOne(
        "SELECT id,name,email,role,communityId FROM User WHERE email=?",
        u + "@trashtocash.example",
      ),
    t = e("admin"),
    a = e("buyer"),
    r = e("seller"),
    n = queryOne("SELECT id FROM Round WHERE status='COMPLETED'").id;
  applyAction(t, {
    action: "agreement",
    roundId: n,
    payer: "community",
    amount: 15000,
    triggerText: "เมื่อสิ้นสุดรอบรับซื้อ",
  });
  let o = queryOne("SELECT id FROM Agreement WHERE roundId=?", n).id;
  applyAction(t, {
    action: "issue",
    agreementId: o,
  });
  applyAction(t, {
    action: "settle",
    agreementId: o,
  });
  applyAction(t, {
    action: "cost",
    roundId: n,
    estimate: 9000,
    actual: 9000,
  });
  applyAction(a, {
    action: "destination",
    roundId: n,
    items: [
      {
        materialId: 1,
        grams: 2900,
        rejected: 100,
        reason: "คัดสิ่งปนเปื้อน",
      },
    ],
  });
  applyAction(a, {
    action: "economics",
    roundId: n,
    resale: 4800,
    trip: 1000,
    other: 200,
  });
  let i = queryOne(
    "SELECT id FROM Round WHERE communityId=? AND status='OPEN' ORDER BY startAt LIMIT 1",
    r.communityId,
  ).id;
  applyAction(r, {
    action: "book",
    roundId: i,
    items: [
      {
        materialId: 1,
        grams: 2500,
      },
      {
        materialId: 2,
        grams: 5000,
      },
    ],
    note: "รายการนัดตัวอย่าง",
  });
}
export { seedDatabase, seedDemoTransactions };
