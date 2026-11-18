import { queryAll, queryOne } from "./database.js";
import { priceForGrams } from "./actions.js";
var rows = (e, ...t) => queryAll(e, ...t),
  firstRow = (e, ...t) => rows(e, ...t)[0] ?? null;
function loadState(user) {
  let materials = rows(
      `SELECT m.*,p.price,p.updated FROM Material m JOIN Price p ON p.id=(SELECT MAX(id) FROM Price WHERE materialId=m.id) ${user?.role === "admin" ? "" : "WHERE m.active=1"} ORDER BY m.id`,
    ),
    communities = rows(
      "SELECT * FROM Community WHERE active=1" +
        (!user || user.role === "admin" ? "" : " AND id=?"),
      ...(!user || user.role === "admin" ? [] : [user.communityId]),
    ),
    role = user?.role,
    points = user
      ? rows(
          "SELECT * FROM Point" +
            (role === "admin" ? "" : " WHERE communityId=?"),
          ...(role === "admin" ? [] : [user.communityId]),
        )
      : [],
    roundFilter =
      role === "admin"
        ? "1"
        : role === "buyer"
          ? "(buyerId=? OR (communityId=? AND status='OPEN' AND buyerId IS NULL AND (invitedId IS NULL OR invitedId=?)))"
          : "communityId=?",
    roundParameters =
      !user || role === "admin"
        ? []
        : role === "buyer"
          ? [user.id, user.communityId, user.id]
          : [user.communityId],
    rounds = (
      user
        ? rows(
            "SELECT * FROM Round WHERE " +
              roundFilter +
              " ORDER BY startAt DESC",
            ...roundParameters,
          )
        : []
    ).map((d) => {
      let m = rows(
          "SELECT i.materialId,SUM(i.grams) grams,SUM(CAST((i.grams*i.price+500)/1000 AS INTEGER)) estimated FROM BookingItem i JOIN Booking b ON b.id=i.bookingId WHERE b.roundId=? AND b.status NOT IN ('CANCELLED','NO_SHOW') GROUP BY i.materialId",
          d.id,
        ),
        g = Number(
          queryOne(
            "SELECT count(*) n FROM Booking WHERE roundId=? AND status NOT IN ('CANCELLED','NO_SHOW')",
            d.id,
          )?.n,
        ),
        y = role === "admin" || role === "community",
        L = role === "buyer" && d.buyerId === user?.id,
        h =
          role === "seller"
            ? []
            : rows(
                "SELECT * FROM Agreement WHERE roundId=?" +
                  (role === "admin" ? "" : " AND payer=?"),
                d.id,
                ...(role === "admin"
                  ? []
                  : [role === "buyer" ? "buyer" : "community"]),
              ).map((v) => ({
                ...v,
                charge: firstRow(
                  "SELECT * FROM Charge WHERE agreementId=?",
                  v.id,
                ),
              })),
        p =
          L || y
            ? rows(
                "SELECT w.materialId,SUM(w.grams) grams,SUM(w.amount) amount FROM Payment p JOIN Booking b ON b.id=p.bookingId JOIN WeighItem w ON w.revisionId=p.revisionId WHERE b.roundId=? GROUP BY w.materialId",
                d.id,
              )
            : [];
      return {
        ...d,
        count: g,
        totals: m,
        grams: m.reduce((v, b) => v + b.grams, 0),
        agreements: h,
        paid: p,
        estimate:
          role === "buyer"
            ? firstRow(
                "SELECT * FROM Estimate WHERE roundId=? AND userId=?",
                d.id,
                user.id,
              )
            : null,
        economics:
          L || role === "admin"
            ? firstRow("SELECT * FROM Economics WHERE roundId=?", d.id)
            : null,
        destination:
          L || y ? rows("SELECT * FROM Destination WHERE roundId=?", d.id) : [],
        costs:
          role === "admin"
            ? firstRow("SELECT * FROM PlatformCost WHERE roundId=?", d.id)
            : null,
        surveys:
          role === "admin"
            ? rows("SELECT * FROM Survey WHERE roundId=?", d.id)
            : [],
      };
    }),
    bookings = (
      user
        ? rows(
            "SELECT b.*,u.name sellerName FROM Booking b JOIN Round r ON r.id=b.roundId JOIN User u ON u.id=b.sellerId WHERE " +
              (role === "admin"
                ? "1"
                : role === "buyer"
                  ? "r.buyerId=?"
                  : role === "seller"
                    ? "b.sellerId=?"
                    : "r.communityId=?") +
              " ORDER BY b.id DESC",
            ...(role === "admin"
              ? []
              : [role === "community" ? user.communityId : user.id]),
          )
        : []
    ).map((d) => {
      let m = rows("SELECT * FROM BookingItem WHERE bookingId=?", d.id),
        g = rows(
          "SELECT * FROM Revision WHERE bookingId=? ORDER BY number",
          d.id,
        ).map((h) => ({
          ...h,
          items: rows("SELECT * FROM WeighItem WHERE revisionId=?", h.id),
          acceptance: firstRow(
            "SELECT * FROM Acceptance WHERE revisionId=?",
            h.id,
          ),
        })),
        y = firstRow("SELECT * FROM Payment WHERE bookingId=?", d.id),
        L = rows(
          "SELECT id,kind,at FROM Attachment WHERE bookingId=?" +
            (role === "community" ? " AND kind='material'" : ""),
          d.id,
        );
      return {
        ...d,
        items: m,
        revisions: g,
        payment: y,
        receipt: y
          ? firstRow("SELECT * FROM Receipt WHERE paymentId=?", y.id)
          : null,
        attachments: L,
        estimated: m.reduce((h, p) => h + priceForGrams(p.grams, p.price), 0),
        events: rows("SELECT * FROM Event WHERE bookingId=? ORDER BY id", d.id),
        disputes: rows(
          "SELECT * FROM Dispute WHERE bookingId=? ORDER BY id",
          d.id,
        ),
      };
    }),
    users =
      user && (role === "community" || role === "admin")
        ? rows(
            "SELECT id,email,name,role,communityId,active,demo FROM User" +
              (role === "community" ? " WHERE communityId=?" : ""),
            ...(role === "community" ? [user.communityId] : []),
          )
        : [],
    buyers = user
      ? rows(
          "SELECT b.* FROM Buyer b JOIN User u ON u.id=b.userId WHERE " +
            (role === "admin"
              ? "1"
              : role === "community"
                ? "u.communityId=? AND b.approved=1"
                : "b.userId=?"),
          ...(role === "admin"
            ? []
            : [role === "community" ? user.communityId : user.id]),
        )
      : [];
  return {
    serverTime: Date.now(),
    user,
    demo: true,
    communities,
    materials,
    points,
    rounds,
    bookings,
    users,
    buyers,
    notices: user
      ? rows(
          "SELECT * FROM Notice WHERE userId=? ORDER BY id DESC LIMIT 100",
          user.id,
        )
      : [],
    audit:
      role === "admin"
        ? rows("SELECT * FROM Audit ORDER BY id DESC LIMIT 150")
        : [],
  };
}
export { loadState };
