import { Fragment, useState } from "react";
import {
  ActionForm,
  EmptyState,
  FormField,
  StatusBadge,
  formatDateTime,
  formatMoney,
  formatWeight,
  moneyField,
  parseBangkokInput,
  readScaledNumber,
  readText,
  toBangkokInput,
  viewUrl,
  weightField,
} from "../ui/shared.jsx";
import { SiteLink } from "../ui/Link.jsx";
function RoundForm({ s: state, post: submitAction, r: round }) {
  let [r, n] = useState(round?.communityId ?? state.user.communityId),
    o = (i) =>
      toBangkokInput(new Date(state.serverTime + i * 86400000).toISOString());
  return (
    <ActionForm
      label={round ? "บันทึกการแก้รอบ" : "สร้างรอบรับซื้อ"}
      submit={async (i) => {
        let u = await submitAction("round", {
          roundId: round?.id,
          communityId: r,
          pointId: readScaledNumber(i, "pointId"),
          name: readText(i, "name"),
          startAt: parseBangkokInput(i, "startAt"),
          endAt: parseBangkokInput(i, "endAt"),
          cutoff: parseBangkokInput(i, "cutoff"),
          capacity: readScaledNumber(i, "capacity", 1000),
          minimum: readScaledNumber(i, "minimum", 1000),
          maxBookings: readScaledNumber(i, "maxBookings"),
          reason: readText(i, "reason"),
          draft: i.has("draft"),
        });
        window.location.assign(viewUrl("round", u.id));
      }}
    >
      <FormField name="name" label="ชื่อรอบ" value={round?.name} />
      <label>
        ชุมชน
        <select
          disabled={!!round}
          value={r}
          onChange={(i) => n(Number(i.target.value))}
        >
          {state.communities.map((i) => (
            <option value={i.id} key={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        จุดรวมวัสดุ
        <select name="pointId" defaultValue={round?.pointId} required={true}>
          {state.points
            .filter((i) => i.communityId === r && i.active)
            .map((i) => (
              <option value={i.id} key={i.id}>
                {i.name}
              </option>
            ))}
        </select>
      </label>
      <div className="cols">
        <FormField
          type="datetime-local"
          name="startAt"
          label="เริ่มนัด (เวลาไทย)"
          value={round ? toBangkokInput(round.startAt) : o(4)}
        />
        <FormField
          type="datetime-local"
          name="endAt"
          label="สิ้นสุดนัด"
          value={round ? toBangkokInput(round.endAt) : o(4.1)}
        />
        <FormField
          type="datetime-local"
          name="cutoff"
          label="เวลาปิดจอง"
          value={round ? toBangkokInput(round.cutoff) : o(3)}
        />
        {weightField("capacity", "ความจุรอบ", round?.capacity ?? 300000)}
        {weightField("minimum", "น้ำหนักขั้นต่ำ", round?.minimum ?? 10000)}
        <FormField
          name="maxBookings"
          type="number"
          min={1}
          label="จำนวนรายการสูงสุด"
          value={round?.maxBookings ?? 30}
        />
      </div>
      {round ? (
        <FormField name="reason" label="เหตุผลแก้ไขรอบ" />
      ) : (
        <label className="inline">
          <input name="draft" type="checkbox" />
          เก็บเป็นฉบับร่าง
        </label>
      )}
    </ActionForm>
  );
}
function RoundDetail({ s: state, post: submitAction, r: round }) {
  if (!round) return <EmptyState>ไม่พบรอบรับซื้อ</EmptyState>;
  let r = state.user.role,
    n = ["community", "admin"].includes(r),
    o = r === "buyer",
    i = o && round.buyerId === state.user.id,
    u = (f) => state.materials.find((d) => d.id === f)?.name,
    l = (f, d = {}) =>
      submitAction(f, {
        roundId: round.id,
        ...d,
      }),
    s = state.bookings.filter((f) => f.roundId === round.id),
    c = s.reduce(
      (f, d) =>
        f + (d.revisions.at(-1)?.items.reduce((m, g) => m + g.grams, 0) || 0),
      0,
    );
  return (
    <div className="detail">
      <section className="panel">
        <div className="sectionhead">
          <h2>{round.name}</h2>
          <StatusBadge value={round.status} />
        </div>
        <p>
          {formatDateTime(round.startAt)}
          {" – "}
          {formatDateTime(round.endAt)}
          {" · ปิดจอง "}
          {formatDateTime(round.cutoff)}
        </p>
        <p>
          {state.points.find((f) => f.id === round.pointId)?.name}
          {" · "}
          {state.points.find((f) => f.id === round.pointId)?.address}
        </p>
        <div className="summary">
          <span>
            {"น้ำหนักที่จอง "}
            {formatWeight(round.grams)}
            {" / "}
            {formatWeight(round.capacity)}
            {" กก."}
          </span>
          <b>
            {round.count}
            {" / "}
            {round.maxBookings}
            {" รายการ"}
          </b>
        </div>
        <p>
          {"เกณฑ์ขั้นต่ำ "}
          {formatWeight(round.minimum)}
          {" กก. · "}
          {round.buyerId ? "ร้านตอบรับงานแล้ว" : "รอร้านตอบรับ"}
        </p>
        {round.reason && (
          <p>
            {"เหตุผลประกอบ "}
            {round.reason}
          </p>
        )}
        {c > round.capacity && (
          <p className="error">
            น้ำหนักชั่งจริงเกินความจุ เจ้าหน้าที่โปรดปรับรอบและบันทึกเหตุผล
          </p>
        )}
        {round.totals.map((f) => (
          <div className="datarow" key={f.materialId}>
            <span>{u(f.materialId)}</span>
            <b>
              {formatWeight(f.grams)}
              {" กก."}
            </b>
          </div>
        ))}
        {round.agreements.map((f) => (
          <p key={f.id}>
            {f.payer === "buyer" ? "ร้านตกลงค่าจับคู่งาน" : "ชุมชนตกลงค่าจัดรอบ"}
            {" ฿"}
            {formatMoney(f.amount)}
            {" · "}
            {f.triggerText}
          </p>
        ))}
      </section>
      {o && !round.buyerId && round.status === "OPEN" && (
        <div className="panel">
          <h3>ประเมินความคุ้มค่าก่อนรับงาน</h3>
          <ActionForm
            label="คำนวณและบันทึกสมมติฐาน"
            submit={(f) =>
              l("estimate", {
                resale: readScaledNumber(f, "resale", 100),
                trip: readScaledNumber(f, "trip", 100),
                other: readScaledNumber(f, "other", 100),
              })
            }
          >
            {moneyField("resale", "ยอดขายต่อที่คาด", round.estimate?.resale)}
            {moneyField("trip", "ค่าเที่ยว", round.estimate?.trip)}
            {moneyField("other", "ต้นทุนอื่น", round.estimate?.other)}
          </ActionForm>
          {round.estimate && (
            <p>
              ส่วนเกินโดยประมาณ ฿
              {formatMoney(
                round.estimate.resale -
                  round.estimate.trip -
                  round.estimate.other -
                  round.totals.reduce((f, d) => f + d.estimated, 0) -
                  round.agreements.reduce((f, d) => f + d.amount, 0),
              )}
            </p>
          )}
          <div className="actions">
            <ActionForm
              label="รับงานรอบนี้"
              confirm="ตอบรับงานตามเวลานัดและเงื่อนไขที่แสดงหรือไม่"
              submit={() => l("claim")}
            />
            <ActionForm
              label="ปฏิเสธงาน"
              secondary={true}
              submit={() => l("decline")}
            />
          </div>
        </div>
      )}
      {n && round.status === "OPEN" && (
        <div className="panel">
          <h3>จัดร้านเข้ารอบ</h3>
          {round.buyerId ? (
            <ActionForm
              label="ยืนยันรอบรับซื้อ"
              confirm="ยืนยันรอบและแจ้งลูกบ้านทุกคนหรือไม่"
              submit={(f) =>
                l("confirm", {
                  reason: readText(f, "reason"),
                })
              }
            >
              <FormField
                name="reason"
                label="เหตุผลอนุมัติหากต่ำกว่าเกณฑ์"
                required={round.grams < round.minimum}
              />
            </ActionForm>
          ) : (
            <ActionForm
              label="ส่งคำเชิญให้ร้าน"
              submit={(f) =>
                l("invite", {
                  buyerId: readScaledNumber(f, "buyerId"),
                })
              }
            >
              <label>
                ร้านรับซื้อ
                <select name="buyerId" required={true}>
                  {state.buyers
                    .filter(
                      (f) =>
                        f.approved &&
                        state.users.find((d) => d.id === f.userId)
                          ?.communityId === round.communityId,
                    )
                    .map((f) => (
                      <option value={f.userId} key={f.id}>
                        {f.shop}
                      </option>
                    ))}
                </select>
              </label>
            </ActionForm>
          )}
        </div>
      )}
      {n && round.status === "DRAFT" && (
        <ActionForm label="เปิดรับจอง" submit={() => l("open")} />
      )}
      {r === "seller" && round.status === "OPEN" && (
        <SiteLink
          prefetch={false}
          className="primary"
          href={"/?view=new&id=" + round.id}
        >
          จองขายวัสดุ
        </SiteLink>
      )}
      {n && !["COMPLETED", "CANCELLED"].includes(round.status) && (
        <details className="panel">
          <summary>แก้ไขข้อมูลรอบ</summary>
          <RoundForm s={state} post={submitAction} r={round} />
        </details>
      )}
      {n && ["OPEN", "DRAFT", "CONFIRMED"].includes(round.status) && (
        <details className="panel">
          <summary>ยกเลิกรอบ</summary>
          <ActionForm
            label="ยกเลิกรอบรับซื้อ"
            confirm="ยกเลิกรอบและแจ้งผู้ขายทุกรายหรือไม่"
            submit={(f) =>
              l("cancelRound", {
                reason: readText(f, "reason"),
              })
            }
          >
            <FormField name="reason" label="เหตุผลยกเลิก" />
          </ActionForm>
        </details>
      )}
      {(i || n) && (
        <section className="panel">
          <h3>รายการในรอบ</h3>
          {s.length ? (
            s.map((f) => (
              <SiteLink
                prefetch={false}
                className="datarow"
                href={viewUrl("booking", f.id)}
                key={f.id}
              >
                <span>
                  {f.code}
                  {" · "}
                  {f.sellerName}
                </span>
                <StatusBadge value={f.status} />
              </SiteLink>
            ))
          ) : (
            <EmptyState>ยังไม่มีคำขอขาย</EmptyState>
          )}
          <a
            download={true}
            className="under"
            href={"/api/export?roundId=" + round.id}
          >
            ดาวน์โหลดรายการรอบ CSV
          </a>
        </section>
      )}
      {i && ["IN_PROGRESS", "COMPLETED"].includes(round.status) && (
        <Fragment>
          <div className="panel">
            <h3>รับเข้าปลายทาง</h3>
            {round.paid.length ? (
              <ActionForm
                label="บันทึกผลปลายทาง"
                submit={(f) =>
                  l("destination", {
                    items: round.paid
                      .filter((d) => d.grams > 0)
                      .map((d) => ({
                        materialId: d.materialId,
                        grams: readScaledNumber(f, "ok" + d.materialId, 1000),
                        rejected: readScaledNumber(
                          f,
                          "no" + d.materialId,
                          1000,
                        ),
                        reason: readText(f, "why" + d.materialId),
                      })),
                  })
                }
              >
                {round.paid
                  .filter((f) => f.grams > 0)
                  .map((f) => {
                    let d = round.destination.find(
                      (m) => m.materialId === f.materialId,
                    );
                    return (
                      <fieldset key={f.materialId}>
                        <legend>
                          {u(f.materialId)}
                          {" · รับซื้อ "}
                          {formatWeight(f.grams)}
                          {" กก."}
                        </legend>
                        {weightField(
                          "ok" + f.materialId,
                          "ปลายทางรับจริง",
                          d?.grams ?? f.grams,
                        )}
                        {weightField(
                          "no" + f.materialId,
                          "คัดทิ้ง",
                          d?.rejected ?? 0,
                        )}
                        <FormField
                          name={"why" + f.materialId}
                          label="เหตุผลคัดทิ้ง"
                          required={false}
                          value={d?.reason}
                        />
                      </fieldset>
                    );
                  })}
              </ActionForm>
            ) : (
              <EmptyState>รอบันทึกการจ่ายซื้อวัสดุ</EmptyState>
            )}
          </div>
          <div className="panel">
            <h3>ผลขายต่อและต้นทุนจริง</h3>
            <ActionForm
              label="บันทึกผลขายต่อ"
              submit={(f) =>
                l("economics", {
                  resale: readScaledNumber(f, "resale", 100),
                  trip: readScaledNumber(f, "trip", 100),
                  other: readScaledNumber(f, "other", 100),
                })
              }
            >
              {moneyField("resale", "ยอดขายต่อจริง", round.economics?.resale)}
              {moneyField("trip", "ค่าเที่ยวจริง", round.economics?.trip)}
              {moneyField("other", "ต้นทุนอื่นจริง", round.economics?.other)}
            </ActionForm>
          </div>
        </Fragment>
      )}
      {n && ["IN_PROGRESS", "CONFIRMED"].includes(round.status) && (
        <ActionForm
          label="ปิดรอบที่เสร็จแล้ว"
          confirm="ปิดรอบรับซื้อนี้หรือไม่"
          submit={() => l("finishRound")}
        />
      )}
    </div>
  );
}
export { RoundForm, RoundDetail };
