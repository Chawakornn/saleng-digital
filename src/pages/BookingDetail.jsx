import { Fragment, useState } from "react";
import {
  ActionForm,
  EmptyState,
  FormField,
  StatusBadge,
  formatDateTime,
  formatMoney,
  formatWeight,
  labels,
  moneyField,
  parseBangkokInput,
  readScaledNumber,
  readText,
  toBangkokInput,
  viewUrl,
  weightField,
} from "../ui/shared.jsx";
import { SiteLink } from "../ui/Link.jsx";
import { uploadAttachment } from "./BookingForm.jsx";
function BookingDetail({
  s: state,
  b: booking,
  post: submitAction,
  print = false,
}) {
  let [n, o] = useState("cash");
  const [expandedImage, setExpandedImage] = useState(null);
  if (!booking) return <EmptyState>ไม่พบรายการในบัญชีของคุณ</EmptyState>;
  let i = state.user.role,
    u = state.rounds.find((d) => d.id === booking.roundId),
    l = booking.revisions.at(-1),
    s = (d, m = {}) =>
      submitAction(d, {
        bookingId: booking.id,
        ...m,
      }),
    c = (d) => state.materials.find((m) => m.id === d)?.name || "วัสดุ #" + d,
    f =
      booking.status === "BOOKED" &&
      u &&
      Date.parse(u.cutoff) > state.serverTime;
  return (
    <section className="detail">
      <div className="panel">
        <div className="sectionhead">
          <div>
            <span className="eyebrow">รหัสนัดรับวัสดุ</span>
            <h2>{booking.code}</h2>
          </div>
          <StatusBadge value={booking.status} />
        </div>
        <p>
          {booking.sellerName}
          {" · "}
          {u?.name}
          {" · "}
          {u && formatDateTime(u.startAt)}
        </p>
        <p>{state.points.find((d) => d.id === u?.pointId)?.address}</p>
        <div className="datarow">
          <strong>รายการวัสดุที่จอง</strong>
          <span>น้ำหนักประมาณการ</span>
        </div>
        {booking.items.map((d) => (
          <div className="datarow" key={d.id}>
            <span>
              {c(d.materialId)}{" "}
              <small>
                ฿{formatMoney(d.price)}
                {" / กก."}
              </small>
            </span>
            <b>
              {formatWeight(d.grams)}
              {" กก."}
            </b>
          </div>
        ))}
        <p>
          ยอดประมาณการ ฿{formatMoney(booking.estimated)}{" "}
          {booking.note && " · " + booking.note}
        </p>
        {!print && i === "seller" && (
          <details open={booking.status === "CONFIRMED"} className="apptqr">
            <summary>แสดง QR สำหรับเช็กอิน</summary>
            <img
              className="qr"
              alt={"รหัสนัด " + booking.code}
              src={window.showcaseQR(booking.code)}
            />
          </details>
        )}
      </div>
      {booking.revisions.map((d) => (
        <div className="panel" key={d.id}>
          <span className="eyebrow">
            {"ผลชั่งครั้งที่ "}
            {d.number}
          </span>
          <h3>ผลชั่งและราคาที่ร้านเสนอ</h3>
          {d.items.map((m) => (
            <div className="datarow" key={m.id}>
              <span>
                {c(m.materialId)}
                <small>
                  {"จอง "}
                  {formatWeight(
                    booking.items.find((g) => g.materialId === m.materialId)
                      ?.grams ?? 0,
                  )}
                  {" กก. · ชั่งจริง "}
                  {formatWeight(m.grams)}
                  {" กก. × ฿"}
                  {formatMoney(m.price)}
                  {" / กก. "}
                  {m.reason && " · " + m.reason}
                </small>
              </span>
              <b>฿{formatMoney(m.amount)}</b>
            </div>
          ))}
          <div className="summary">
            <span>รวมหลังชั่ง</span>
            <b>฿{formatMoney(d.total)}</b>
          </div>
          <small>
            {formatDateTime(d.at)} {d.reason && " · " + d.reason}{" "}
            {d.acceptance &&
              (d.acceptance.revoked
                ? " · ยกเลิกการยืนยันรุ่นเดิม"
                : " · ผู้ขายยืนยันแล้ว")}
          </small>
        </div>
      ))}
      {booking.payment && (
        <div className="panel">
          <h3>บันทึกการจ่ายตรง</h3>
          <p>
            {booking.payment.method === "cash" ? "เงินสด" : "โอนเงิน"}
            {" · ฿"}
            {formatMoney(booking.payment.amount)}
            {" · "}
            {formatDateTime(booking.payment.paidAt)} {booking.payment.reference}
          </p>
          <strong>
            {booking.receipt
              ? "ผู้ขายยืนยันได้รับเงินแล้ว"
              : "ร้านแจ้งว่าจ่ายแล้ว รอผู้ขายยืนยัน"}
          </strong>
        </div>
      )}
      {booking.disputes.map((d) => (
        <div className="panel" key={d.id}>
          <h3>ข้อพิพาท</h3>
          <p>
            {d.reason}
            {" · "}
            {formatDateTime(d.opened)}
          </p>
          {d.resolution && (
            <p>
              {"ผลการแก้ไข "}
              {d.resolution}
              {" · เจ้าหน้าที่ #"}
              {d.handlerId}
            </p>
          )}
        </div>
      ))}
      {!!booking.attachments.length && (
        <div className="panel">
          <h3>รูปประกอบรายการ</h3>
          <div className="actions">
            {booking.attachments.map((d) => (
              <SiteLink
                prefetch={false}
                href={window.showcaseImage(d.id)}
                target="_blank"
                rel="noreferrer"
                onClick={
                  window.SalengAndroid
                    ? (event) => {
                        event.preventDefault();
                        setExpandedImage(expandedImage === d.id ? null : d.id);
                      }
                    : undefined
                }
                key={d.id}
              >
                <img
                  className={
                    expandedImage === d.id ? "expanded-attachment" : "thumb"
                  }
                  alt={d.kind === "proof" ? "หลักฐานจากร้าน" : "ภาพวัสดุ"}
                  src={window.showcaseImage(d.id)}
                />
              </SiteLink>
            ))}
          </div>
        </div>
      )}
      {!print && (
        <div className="oper">
          {i === "seller" && f && (
            <SiteLink
              prefetch={false}
              href={viewUrl("edit", booking.id)}
              className="secondary"
            >
              แก้ไขคำขอขาย
            </SiteLink>
          )}
          {i === "seller" &&
            ["BOOKED", "CONFIRMED"].includes(booking.status) &&
            u &&
            Date.parse(u.cutoff) > state.serverTime && (
              <ActionForm
                label="ยกเลิกคำขอขาย"
                secondary={true}
                confirm="ยกเลิกนัดนี้และคืนพื้นที่ในรอบหรือไม่"
                submit={() => s("cancel")}
              />
            )}
          {i === "buyer" && booking.status === "CONFIRMED" && (
            <div className="panel">
              <h3>เช็กอินผู้ขาย</h3>
              <ActionForm
                label="เช็กอิน"
                submit={(d) =>
                  s("checkin", {
                    code: readText(d, "code"),
                  })
                }
              >
                <FormField name="code" label="รหัสนัดจากผู้ขาย" />
              </ActionForm>
              {u && state.serverTime > Date.parse(u.endAt) && (
                <ActionForm
                  label="บันทึกไม่มาตามนัด"
                  confirm="ยืนยันว่าผู้ขายไม่มาตามนัดหรือไม่"
                  submit={() => s("noShow")}
                />
              )}
            </div>
          )}
          {i === "buyer" &&
            ["CHECKED_IN", "AWAITING_SELLER_ACCEPTANCE", "ACCEPTED"].includes(
              booking.status,
            ) && (
              <div className="panel">
                <h3>{l ? "แก้ไขผลชั่ง" : "บันทึกผลชั่งจริง"}</h3>
                <ActionForm
                  label="ส่งผลชั่งให้ผู้ขาย"
                  submit={(d) =>
                    s("weigh", {
                      version: booking.version,
                      reason: readText(d, "reason"),
                      items: booking.items.map((m) => ({
                        materialId: m.materialId,
                        grams: readScaledNumber(d, "weight" + m.id, 1000),
                        price: readScaledNumber(d, "price" + m.id, 100),
                        reason: readText(d, "why" + m.id),
                      })),
                    })
                  }
                  key={booking.version}
                >
                  {booking.items.map((d) => {
                    let m = l?.items.find((g) => g.materialId === d.materialId);
                    return (
                      <fieldset key={d.id}>
                        <legend>{c(d.materialId)}</legend>
                        <div className="cols">
                          {weightField(
                            "weight" + d.id,
                            "น้ำหนักที่รับจริง",
                            m?.grams ?? d.grams,
                          )}
                          {moneyField(
                            "price" + d.id,
                            "ราคาต่อกิโลกรัม",
                            m?.price ?? d.price,
                          )}
                        </div>
                        <FormField
                          name={"why" + d.id}
                          label="เหตุผลหากไม่รับวัสดุ"
                          required={false}
                        />
                      </fieldset>
                    );
                  })}
                  {l && <FormField name="reason" label="เหตุผลแก้ไขผลชั่ง" />}
                </ActionForm>
              </div>
            )}
          {i === "seller" &&
            l &&
            booking.status === "AWAITING_SELLER_ACCEPTANCE" && (
              <ActionForm
                label="ยืนยันยอดขาย"
                confirm={"ตกลงขายที่ยอด ฿" + formatMoney(l.total) + " หรือไม่"}
                submit={() =>
                  s("accept", {
                    revisionId: l.id,
                  })
                }
              />
            )}
          {i === "buyer" && l && booking.status === "ACCEPTED" && (
            <div className="panel">
              <h3>แจ้งจ่ายเงินให้ผู้ขาย</h3>
              <ActionForm
                label="บันทึกการจ่ายตรง"
                confirm="ตรวจยอดและจ่ายเงินให้ผู้ขายแล้วหรือไม่"
                submit={(d) =>
                  s("pay", {
                    revisionId: l.id,
                    method: n,
                    reference: readText(d, "reference"),
                    paidAt: parseBangkokInput(d, "paidAt"),
                  })
                }
              >
                <label>
                  วิธีจ่าย
                  <select
                    name="method"
                    value={n}
                    onChange={(d) => o(d.target.value)}
                  >
                    <option value="cash">เงินสด</option>
                    <option value="transfer">โอนเงิน</option>
                  </select>
                </label>
                <FormField
                  name="paidAt"
                  type="datetime-local"
                  label="เวลาจ่าย (ประเทศไทย)"
                  value={toBangkokInput(new Date().toISOString())}
                />
                <FormField
                  name="reference"
                  label="เลขอ้างอิง"
                  required={n === "transfer"}
                />
              </ActionForm>
            </div>
          )}
          {i === "seller" && booking.status === "PAYMENT_REPORTED" && (
            <ActionForm
              label="ยืนยันได้รับเงินแล้ว"
              confirm="คุณได้รับเงินครบตามยอดแล้วใช่หรือไม่"
              submit={() => s("receive")}
            />
          )}
          {i === "seller" &&
            [
              "AWAITING_SELLER_ACCEPTANCE",
              "ACCEPTED",
              "PAYMENT_REPORTED",
            ].includes(booking.status) && (
              <details className="panel">
                <summary>ปฏิเสธยอดหรือแจ้งปัญหา</summary>
                <ActionForm
                  label="เปิดข้อพิพาท"
                  confirm="ส่งเรื่องให้แอดมินติดตามหรือไม่"
                  submit={(d) =>
                    s("dispute", {
                      reason: readText(d, "reason"),
                    })
                  }
                >
                  <FormField name="reason" label="รายละเอียดปัญหา" />
                </ActionForm>
              </details>
            )}
          {i === "admin" && booking.status === "DISPUTED" && (
            <div className="panel">
              <ActionForm
                label="บันทึกผลแก้ไขข้อพิพาท"
                confirm="ส่งรายการกลับให้เจ้าของบัญชีตรวจต่อหรือไม่"
                submit={(d) =>
                  s("resolve", {
                    reason: readText(d, "reason"),
                  })
                }
              >
                <FormField name="reason" label="ผลการตรวจและเหตุผล" />
              </ActionForm>
            </div>
          )}
          {((i === "buyer" && booking.status === "PAYMENT_REPORTED") ||
            (i === "seller" && f)) && (
            <details className="panel">
              <summary>
                {i === "buyer" ? "แนบหลักฐานการจ่าย" : "แนบรูปวัสดุ"}
              </summary>
              <ActionForm
                label="อัปโหลดรูป"
                submit={async (d) => {
                  await uploadAttachment(
                    d.get("file"),
                    booking.id,
                    i === "buyer" ? "proof" : "material",
                  );
                  window.location.reload();
                }}
              >
                <label>
                  ภาพ JPEG, PNG หรือ WebP ไม่เกิน 4 MB
                  <input
                    name="file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required={true}
                  />
                </label>
              </ActionForm>
            </details>
          )}
        </div>
      )}
      <div className="panel">
        <h3>ประวัติรายการ</h3>
        <ol className="timeline">
          {booking.events.map((d) => (
            <li key={d.id}>
              <strong>{labels[d.status]}</strong>
              <small>
                {formatDateTime(d.at)}
                {" · "}
                {d.note}
              </small>
            </li>
          ))}
        </ol>
      </div>
      {print ? (
        <Fragment>
          <p>บันทึกซื้อขายวัสดุรีไซเคิลสำหรับเก็บเป็นหลักฐาน ไม่ใช่ใบกำกับภาษี</p>
          <button className="primary noprint" onClick={() => window.print()}>
            พิมพ์ / บันทึก PDF
          </button>
        </Fragment>
      ) : (
        <SiteLink
          prefetch={false}
          className="secondary"
          href={viewUrl("print", booking.id)}
        >
          เปิดใบสรุปสำหรับพิมพ์
        </SiteLink>
      )}
    </section>
  );
}
export { BookingDetail };
