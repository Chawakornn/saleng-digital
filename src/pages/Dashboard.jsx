import { formatDateTime, viewUrl } from "../ui/shared.jsx";
import { ArrowRight, CalendarDays } from "lucide-react";
import { SiteLink } from "../ui/Link.jsx";
function Dashboard({ state }) {
  let t = state.user.role,
    a = "จัดการรอบรับซื้อ",
    r = "ดูเวลานัด จุดรวมวัสดุ และร้านที่ตอบรับในแต่ละรอบ",
    n = "ดูรอบรับซื้อ",
    o = viewUrl("rounds");
  if (t === "seller") {
    let u = [
        "AWAITING_SELLER_ACCEPTANCE",
        "PAYMENT_REPORTED",
        "CONFIRMED",
        "BOOKED",
        "CHECKED_IN",
        "ACCEPTED",
      ]
        .map((s) => state.bookings.find((c) => c.status === s))
        .find(Boolean),
      l = u
        ? state.rounds.find((s) => s.id === u.roundId)
        : state.rounds
            .filter(
              (s) =>
                s.status === "OPEN" &&
                Date.parse(s.cutoff) > state.serverTime &&
                s.count < s.maxBookings &&
                s.grams < s.capacity,
            )
            .sort((s, c) => s.startAt.localeCompare(c.startAt))[0];
    a = u
      ? {
          AWAITING_SELLER_ACCEPTANCE: "ร้านส่งผลชั่งให้ตรวจแล้ว",
          PAYMENT_REPORTED: "ร้านแจ้งว่าจ่ายเงินแล้ว",
          CONFIRMED: "เตรียมวัสดุไปตามนัด",
          BOOKED: "จองแล้ว รอชุมชนยืนยันนัด",
          CHECKED_IN: "เช็กอินแล้ว รอผลชั่ง",
          ACCEPTED: "ตกลงยอดแล้ว รอร้านจ่ายเงิน",
        }[u.status] || "นัดรับวัสดุของคุณ"
      : l
        ? "รอบถัดไปในชุมชน"
        : "ยังไม่มีรอบเปิดจอง";
    r = l
      ? [
          formatDateTime(l.startAt),
          state.points.find((s) => s.id === l.pointId)?.name,
          u?.code,
        ]
          .filter(Boolean)
          .join(" · ")
      : "ดูราคาและวิธีเตรียมวัสดุไว้สำหรับรอบถัดไป";
    n = u
      ? {
          CONFIRMED: "เปิดรหัสนัดและ QR",
          AWAITING_SELLER_ACCEPTANCE: "ตรวจน้ำหนักและยอดขาย",
          PAYMENT_REPORTED: "ตรวจรายการจ่ายเงิน",
        }[u.status] || "ดูรายการของฉัน"
      : l
        ? "จองขายวัสดุรอบนี้"
        : "ดูราคาวัสดุ";
    o = u
      ? viewUrl("booking", u.id)
      : l
        ? viewUrl("new", l.id)
        : viewUrl("materials");
  } else
    t === "buyer"
      ? ((a = "งานรับซื้อของร้าน"),
        (r = "เปิดรอบเพื่อดูจุดนัด รายการที่ต้องชั่ง และบันทึกการจ่าย"))
      : t === "admin" &&
        state.bookings.some((i) => i.status === "DISPUTED") &&
        ((a = "มีรายการที่รอแก้ปัญหา"),
        (r = "ตรวจคำแจ้งจากผู้ขายและประวัติผลชั่งก่อนบันทึกผล"),
        (o = viewUrl("disputes")),
        (n = "ดูข้อพิพาท"));
  return (
    <section className="next-action">
      <CalendarDays aria-hidden="true" />
      <div>
        <h2>{a}</h2>
        <p>{r}</p>
        <SiteLink prefetch={false} className="primary" href={o}>
          {n}
          <ArrowRight size={18} />
        </SiteLink>
      </div>
    </section>
  );
}
export { Dashboard };
