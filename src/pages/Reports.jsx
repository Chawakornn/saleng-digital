import { Fragment, useState } from "react";
import {
  ActionForm,
  EmptyState,
  FormField,
  formatDateTime,
  formatMoney,
  formatWeight,
  moneyField,
  readScaledNumber,
  readText,
  viewUrl,
} from "../ui/shared.jsx";
import { SiteLink } from "../ui/Link.jsx";
function netRevenue(e, t) {
  return e.economics && t
    ? e.economics.resale -
        e.paid.reduce((a, r) => a + r.amount, 0) -
        e.economics.trip -
        e.economics.other -
        e.agreements
          .filter((a) => a.payer === "buyer")
          .reduce((a, r) => a + r.amount, 0)
    : null;
}
function Reports({
  s: state,
  post: submitAction,
  fees = false,
  documentId = 0,
}) {
  let n = state.user.role,
    o = n === "admin",
    i = n === "buyer",
    [u, l] = useState(""),
    [s, c] = useState(""),
    f = (S) => new Date(Date.parse(S) + 7 * 3600000).toISOString().slice(0, 10),
    d = state.rounds
      .filter((S) => (!u || f(S.startAt) >= u) && (!s || f(S.startAt) <= s))
      .sort((S, B) => S.startAt.localeCompare(B.startAt)),
    m = state.bookings.filter((S) => d.some((B) => B.id === S.roundId)),
    g = m.filter((S) => S.receipt),
    y = g.reduce((S, B) => S + (B.payment?.amount || 0), 0),
    L = d.flatMap((S) => S.agreements),
    h = L.reduce((S, B) => S + B.amount, 0),
    p = L.filter((S) => S.charge).reduce((S, B) => S + B.amount, 0),
    v = L.filter((S) => S.charge?.paid).reduce((S, B) => S + B.amount, 0),
    b = d.reduce((S, B) => S + (B.costs?.estimate || 0), 0),
    A = d.reduce((S, B) => S + (B.costs?.actual || 0), 0),
    z = d.filter((S) => S.status === "COMPLETED"),
    _ = z.length > 0 && z.every((S) => S.costs?.actual != null),
    O = m.filter(
      (S) =>
        !["CANCELLED", "BOOKED"].includes(S.status) &&
        Date.parse(d.find((B) => B.id === S.roundId).endAt) <= state.serverTime,
    ),
    Ee = O.filter((S) => {
      let B = d.find((nt) => nt.id === S.roundId),
        $e = S.events.find((nt) => nt.status === "CHECKED_IN");
      return $e && $e.at >= B.startAt && $e.at <= B.endAt;
    }).length,
    X = d.flatMap((S) => S.destination).reduce((S, B) => S + B.grams, 0),
    ht = m.filter(
      (S) => S.payment && S.revisions.at(-1)?.items.some((B) => B.grams > 0),
    ),
    Ua = ht.filter((S) => {
      let B = d.find(($e) => $e.id === S.roundId);
      return S.revisions
        .at(-1)
        .items.filter(($e) => $e.grams > 0)
        .every(($e) => {
          let nt = B.destination.find((Kr) => Kr.materialId === $e.materialId),
            J = B.paid.find((Kr) => Kr.materialId === $e.materialId);
          return nt && J && nt.grams + nt.rejected === J.grams;
        });
    }).length;
  if (documentId) {
    let S = state.rounds.find(($e) =>
        $e.agreements.some((nt) => nt.id === documentId),
      ),
      B = S?.agreements.find(($e) => $e.id === documentId);
    return B?.charge ? (
      <div className="panel">
        <h2>ใบเรียกเก็บค่าบริการ #{B.charge.id}</h2>
        <p>
          {S?.name}
          {" · "}
          {formatDateTime(B.charge.issued)}
        </p>
        <p>
          {B.payer === "buyer" ? "ค่าจับคู่งานจากร้าน" : "ค่าจัดรอบจากชุมชน"}
          {" · "}
          {B.triggerText}
        </p>
        <h2>฿{formatMoney(B.amount)}</h2>
        <p>
          {B.charge.paid
            ? "รับชำระแล้ว " + formatDateTime(B.charge.paid)
            : "รอรับชำระ"}
        </p>
        <p>บันทึกค่าบริการ ไม่ใช่ใบกำกับภาษี</p>
        <button className="primary noprint" onClick={() => window.print()}>
          พิมพ์ / บันทึก PDF
        </button>
      </div>
    ) : (
      <EmptyState>ไม่พบเอกสารในบัญชีของคุณ</EmptyState>
    );
  }
  let Ra = (S, B) => (
    <div className="metric" key={S}>
      <small>{S}</small>
      <b>{B}</b>
    </div>
  );
  return (
    <div className="detail">
      <div className="panel datefilter">
        <label>
          วันนัดตั้งแต่
          <input type="date" value={u} onChange={(S) => l(S.target.value)} />
        </label>
        <label>
          ถึงวันที่
          <input type="date" value={s} onChange={(S) => c(S.target.value)} />
        </label>
        <small>
          {d.length
            ? "ช่วงวันนัด " + f(d[0].startAt) + " ถึง " + f(d.at(-1).startAt)
            : "ยังไม่มีรอบในช่วงนี้"}
        </small>
      </div>
      {n === "seller" ? (
        <Fragment>
          <div className="metrics">
            {Ra("ยอดรับเงินจริง", "฿" + formatMoney(y))}
            {Ra(
              "น้ำหนักที่ขายจริง",
              formatWeight(
                g.reduce(
                  (S, B) =>
                    S +
                    B.revisions
                      .at(-1)
                      .items.reduce(($e, nt) => $e + nt.grams, 0),
                  0,
                ),
              ) + " กก.",
            )}
            {Ra("รายการจบแล้ว", String(g.length))}
          </div>
          <a download={true} className="secondary" href="/api/export">
            ดาวน์โหลดประวัติ CSV
          </a>
        </Fragment>
      ) : (
        <Fragment>
          {(o || fees) && (
            <div className="metrics">
              {Ra("ค่าบริการที่ตกลง", "฿" + formatMoney(h))}
              {Ra("เรียกเก็บแล้ว", "฿" + formatMoney(p))}
              {Ra("รับชำระแล้ว", "฿" + formatMoney(v))}
            </div>
          )}
          {o && !fees && (
            <section className="panel">
              <h3>รายได้และต้นทุนแพลตฟอร์ม</h3>
              <p>
                ต้นทุนดูแลรอบประมาณการ ฿{formatMoney(b)}
                {" · ต้นทุนจริงที่บันทึก ฿"}
                {formatMoney(A)}
              </p>
              <p>
                {"ส่วนเกินก่อนต้นทุนประจำและภาษีของรอบที่ปิดแล้ว "}
                <strong>
                  {_
                    ? "฿" +
                      formatMoney(
                        z.reduce(
                          (S, B) =>
                            S +
                            B.agreements
                              .filter(($e) => $e.charge?.paid)
                              .reduce(($e, nt) => $e + nt.amount, 0) -
                            B.costs.actual,
                          0,
                        ),
                      )
                    : "ยังคำนวณไม่ได้"}
                </strong>
              </p>
              <small>
                สมมติฐานสำหรับทดลองหนึ่งรอบ · ค่าจัดรอบ 150 − ต้นทุน 90 = 60 บาท
              </small>
            </section>
          )}
          {!fees && (
            <section className="panel">
              <h3>ติดตามผลการทดลอง</h3>
              <p>
                {"น้ำหนักปลายทางรับจริง "}
                {X
                  ? formatWeight(X) + " กก."
                  : d.some((S) => S.destination.length)
                    ? "0 กก."
                    : "รอบันทึก"}
              </p>
              <p>
                {"รายการที่บันทึกปลายทางครบ "}
                {ht.length
                  ? Ua + " / " + ht.length + " รายการ"
                  : "ยังไม่มีรายการซื้อ"}{" "}
                <small>นับเมื่อมีผลรับและคัดทิ้งครบทั้งน้ำหนักของทุกประเภทในรอบ</small>
              </p>
              <p>
                {"มาตามนัด "}
                {O.length
                  ? Ee + " / " + O.length + " รายการ"
                  : "ยังไม่มีรายการถึงกำหนด"}{" "}
                <small>เช็กอินระหว่างเวลาเริ่มและสิ้นสุดรอบ นับเฉพาะนัดที่สิ้นสุดแล้ว</small>
              </p>
            </section>
          )}
          {d.map((S) => {
            let B = m
                .filter((J) => J.roundId === S.id)
                .every((J) =>
                  ["COMPLETED", "NO_SHOW", "CANCELLED"].includes(J.status),
                ),
              $e = netRevenue(S, B),
              nt = S.buyerId === state.user.id;
            return (
              <section className="panel" key={S.id}>
                <span className="eyebrow">{formatDateTime(S.startAt)}</span>
                <h3>
                  <SiteLink prefetch={false} href={viewUrl("round", S.id)}>
                    {S.name}
                  </SiteLink>
                </h3>
                {!fees && (o || (i && nt)) && (
                  <Fragment>
                    <div className="datarow">
                      <span>เงินซื้อวัสดุตามบันทึกจ่าย</span>
                      <b>
                        ฿
                        {formatMoney(
                          S.paid.reduce((J, Kr) => J + Kr.amount, 0),
                        )}
                      </b>
                    </div>
                    <div className="datarow">
                      <span>รายรับขายต่อ / ค่าเที่ยว / ต้นทุนอื่น</span>
                      <b>
                        {S.economics
                          ? [
                              S.economics.resale,
                              S.economics.trip,
                              S.economics.other,
                            ]
                              .map((J) => "฿" + formatMoney(J))
                              .join(" / ")
                          : "รอบันทึก"}
                      </b>
                    </div>
                    <div className="datarow">
                      <span>ค่าบริการที่ร้านตกลง</span>
                      <b>
                        ฿
                        {formatMoney(
                          S.agreements
                            .filter((J) => J.payer === "buyer")
                            .reduce((J, Kr) => J + Kr.amount, 0),
                        )}
                      </b>
                    </div>
                    <div className="summary">
                      <span>ส่วนเกินต่อเที่ยวของร้าน</span>
                      <b>
                        {$e === null ? "ยังคำนวณไม่ได้" : "฿" + formatMoney($e)}
                      </b>
                    </div>
                  </Fragment>
                )}
                {fees && (
                  <Fragment>
                    {!S.agreements.length && <p>ยังไม่มีข้อตกลงค่าบริการ</p>}
                    {S.agreements.map((J) => (
                      <div className="subpanel" key={J.id}>
                        <b>
                          {J.payer === "community"
                            ? "ค่าจัดรอบจากชุมชน"
                            : "ค่าจับคู่งานจากร้าน"}
                          {" ฿"}
                          {formatMoney(J.amount)}
                        </b>
                        <p>
                          {J.triggerText}
                          {" · "}
                          {J.charge?.paid
                            ? "รับชำระแล้ว"
                            : J.charge
                              ? "ออกใบเรียกเก็บแล้ว"
                              : "ตกลงแล้ว"}
                        </p>
                        {J.charge && (
                          <SiteLink
                            prefetch={false}
                            className="under"
                            href={viewUrl("invoice", J.id)}
                          >
                            เปิดใบเรียกเก็บ
                          </SiteLink>
                        )}
                        {o && !J.charge?.paid && (
                          <ActionForm
                            label={J.charge ? "บันทึกรับชำระ" : "ออกใบเรียกเก็บ"}
                            confirm="ยืนยันตามข้อตกลงนี้หรือไม่"
                            submit={() =>
                              submitAction(J.charge ? "settle" : "issue", {
                                agreementId: J.id,
                              })
                            }
                          />
                        )}
                      </div>
                    ))}
                    {o && (
                      <Fragment>
                        <details>
                          <summary>เพิ่มข้อตกลงค่าบริการ</summary>
                          <ActionForm
                            label="บันทึกข้อตกลง"
                            submit={(J) =>
                              submitAction("agreement", {
                                roundId: S.id,
                                payer: readText(J, "payer"),
                                amount: readScaledNumber(J, "amount", 100),
                                triggerText: readText(J, "triggerText"),
                              })
                            }
                          >
                            <label>
                              ผู้จ่าย
                              <select name="payer">
                                <option value="community">
                                  ชุมชน · ค่าจัดรอบ
                                </option>
                                <option value="buyer">ร้าน · ค่าจับคู่งาน</option>
                              </select>
                            </label>
                            {moneyField("amount", "ยอดที่ตกลง")}
                            <FormField
                              name="triggerText"
                              label="ตกลงเรียกเก็บเมื่อใด"
                            />
                          </ActionForm>
                        </details>
                        <details>
                          <summary>ต้นทุนดูแลรอบ</summary>
                          <ActionForm
                            label="บันทึกต้นทุน"
                            submit={(J) =>
                              submitAction("cost", {
                                roundId: S.id,
                                estimate: readScaledNumber(J, "estimate", 100),
                                actual: readText(J, "actual")
                                  ? readScaledNumber(J, "actual", 100)
                                  : null,
                              })
                            }
                          >
                            {moneyField(
                              "estimate",
                              "ต้นทุนประมาณการ",
                              S.costs?.estimate,
                            )}
                            <FormField
                              type="number"
                              name="actual"
                              label="ต้นทุนจริง (บาท เมื่อทราบ)"
                              step=".01"
                              required={false}
                              value={
                                S.costs?.actual != null
                                  ? S.costs.actual / 100
                                  : void 0
                              }
                            />
                          </ActionForm>
                        </details>
                      </Fragment>
                    )}
                  </Fragment>
                )}
                {!o && (n === "community" || nt) && (
                  <details>
                    <summary>ตอบความพร้อมจ่ายค่าบริการ</summary>
                    <ActionForm
                      label="บันทึกคำตอบ"
                      submit={(J) =>
                        submitAction("survey", {
                          roundId: S.id,
                          amount: readScaledNumber(J, "amount", 100),
                          note: readText(J, "note"),
                        })
                      }
                    >
                      {moneyField("amount", "จำนวนที่พร้อมจ่ายต่อรอบ")}
                      <FormField
                        name="note"
                        label="ความเห็นเพิ่มเติม"
                        required={false}
                      />
                    </ActionForm>
                  </details>
                )}
                {o &&
                  S.surveys.map((J) => (
                    <p key={J.id}>
                      คำตอบความพร้อมจ่าย #{J.userId}
                      {" · ฿"}
                      {formatMoney(J.amount)}
                      {" · "}
                      {J.note}
                    </p>
                  ))}
              </section>
            );
          })}
        </Fragment>
      )}
    </div>
  );
}
export { Reports };
