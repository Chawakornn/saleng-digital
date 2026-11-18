import { SiteLink } from "./Link.jsx";
import { ArrowUpRight, Leaf, Recycle } from "lucide-react";
import { useEffect, useState, useRef } from "react";
var labels = {
    DRAFT: "ฉบับร่าง",
    OPEN: "เปิดรับจอง",
    BOOKED: "จองแล้ว",
    CONFIRMED: "ยืนยันนัดแล้ว",
    IN_PROGRESS: "กำลังรับซื้อ",
    CHECKED_IN: "เช็กอินแล้ว",
    AWAITING_SELLER_ACCEPTANCE: "รอตรวจผลชั่ง",
    ACCEPTED: "ผู้ขายตกลงยอดแล้ว",
    PAYMENT_REPORTED: "ร้านแจ้งว่าจ่ายแล้ว",
    COMPLETED: "เสร็จสิ้น",
    DISPUTED: "มีข้อพิพาท",
    CANCELLED: "ยกเลิกแล้ว",
    NO_SHOW: "ไม่มาตามนัด",
    seller: "ผู้ขายวัสดุ",
    buyer: "ร้านรับซื้อ",
    admin: "แอดมินแพลตฟอร์ม",
    community: "ผู้ดูแลชุมชน",
  },
  formatMoney = (e) =>
    (e / 100).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  formatWeight = (e) =>
    (e / 1000).toLocaleString("th-TH", {
      maximumFractionDigits: 3,
    }),
  formatDateTime = (e) =>
    new Date(e).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  formatDate = (e) =>
    new Date(e).toLocaleDateString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "numeric",
      month: "short",
    });
var viewUrl = (e, t) => "/?view=" + e + (t ? "&id=" + t : "");
async function postAction(action, payload = {}) {
  let response = await fetch("/api/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        action,
      }),
    }),
    result = await response.json();
  if (!response.ok) throw Error(result.error || "ทำรายการไม่ได้");
  return result;
}
function BrandLink() {
  return (
    <SiteLink prefetch={false} className="brand" href="/">
      <img src="/icon.svg" alt="" />
      <span>
        ซาเล้งดิจิทัล<small>TRASH TO CASH</small>
      </span>
    </SiteLink>
  );
}
function StatusBadge({ value }) {
  return (
    <span
      className={
        "badge " +
        (["DISPUTED", "CANCELLED", "NO_SHOW"].includes(value) ? "bad" : "")
      }
    >
      <i />
      {labels[value] || value}
    </span>
  );
}
function EmptyState({ children }) {
  return (
    <div className="empty">
      <Leaf size={23} />
      <p>{children}</p>
    </div>
  );
}
function MaterialCards({ s: state }) {
  return (
    <div className="matgrid">
      {state.materials.map((t) => (
        <details className="material" key={t.id}>
          <summary>
            <span className={"matart " + t.art}>
              <img src={"/art/" + t.art + ".svg"} alt="" />
            </span>
            <span className="matmain">
              <strong>{t.name}</strong>
              <span className="price">
                ฿{formatMoney(t.price)} <small>/ กก.</small>
              </span>
            </span>
            <ArrowUpRight size={16} />
          </summary>
          <p>{t.guide}</p>
          <small>
            {"ปรับราคา "}
            {formatDate(t.updated)}
          </small>
        </details>
      ))}
    </div>
  );
}
function ActionForm({ children, submit, label, confirm, secondary = false }) {
  let [submitting, setSubmitting] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [confirming, setConfirming] = useState(false),
    pending = useRef(false),
    pendingForm = useRef(null),
    dialog = useRef(null);
  useEffect(() => {
    confirming && dialog.current?.showModal();
  }, [confirming]);
  async function saveForm(p) {
    if (!pending.current) {
      pending.current = true;
      setSubmitting(true);
      setError("");
      setSaved(false);
      try {
        await submit(p);
        setSaved(true);
      } catch (v) {
        setError(v instanceof Error ? v.message : "บันทึกไม่สำเร็จ");
      } finally {
        pending.current = false;
        setSubmitting(false);
      }
    }
  }
  function handleSubmit(p) {
    p.preventDefault();
    let v = new FormData(p.currentTarget);
    confirm ? ((pendingForm.current = v), setConfirming(true)) : saveForm(v);
  }
  return (
    <form onSubmit={handleSubmit} className="form">
      {children}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="success" role="status">
          บันทึกเรียบร้อยแล้ว
        </p>
      )}
      <button
        type="submit"
        className={secondary ? "secondary" : "primary"}
        disabled={submitting}
      >
        {submitting ? "กำลังบันทึก…" : label}
      </button>
      {confirming && (
        <dialog ref={dialog} onCancel={() => setConfirming(false)}>
          <h3>{confirm}</h3>
          <div className="actions">
            <button
              type="button"
              className="secondary"
              autoFocus={true}
              onClick={() => setConfirming(false)}
            >
              กลับไปตรวจ
            </button>
            <button
              className="primary"
              type="button"
              onClick={() => {
                setConfirming(false);
                pendingForm.current && saveForm(pendingForm.current);
              }}
            >
              ยืนยัน
            </button>
          </div>
        </dialog>
      )}
    </form>
  );
}
function FormField({
  name,
  label,
  type = "text",
  value,
  required = true,
  min,
  max,
  step,
  placeholder,
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        min={min ?? (type === "number" ? 0 : void 0)}
        max={max}
        step={step}
        placeholder={placeholder}
      />
    </label>
  );
}
var readText = (e, t) => String(e.get(t) ?? "").trim(),
  readScaledNumber = (e, t, a = 1) => Math.round(Number(readText(e, t)) * a),
  moneyField = (e, t, a) => (
    <FormField
      name={e}
      label={t + " (บาท)"}
      type="number"
      step=".01"
      value={a === void 0 ? void 0 : a / 100}
    />
  ),
  weightField = (e, t, a) => (
    <FormField
      name={e}
      label={t + " (กก.)"}
      type="number"
      step=".001"
      value={a === void 0 ? void 0 : a / 1000}
    />
  ),
  toBangkokInput = (e) =>
    new Date(new Date(e).getTime() + 7 * 3600000).toISOString().slice(0, 16),
  parseBangkokInput = (e, t) =>
    new Date(readText(e, t) + ":00+07:00").toISOString();
function Footer() {
  return (
    <footer>
      <div className="wrap foot">
        <BrandLink />
        <span>
          <Recycle size={15} />
          {" นัดขายรีไซเคิลใกล้บ้าน ตรวจยอดก่อนขาย"}
        </span>
      </div>
    </footer>
  );
}
export {
  EmptyState,
  formatMoney,
  formatWeight,
  formatDateTime,
  ActionForm,
  viewUrl,
  StatusBadge,
  readText,
  FormField,
  readScaledNumber,
  weightField,
  moneyField,
  parseBangkokInput,
  toBangkokInput,
  labels,
  postAction,
  BrandLink,
  MaterialCards,
  Footer,
};
