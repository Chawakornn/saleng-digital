import { useState } from "react";
import {
  ActionForm,
  EmptyState,
  formatDateTime,
  formatMoney,
  formatWeight,
  viewUrl,
} from "../ui/shared.jsx";
import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import { SiteLink } from "../ui/Link.jsx";
async function uploadAttachment(file, bookingId, kind) {
  let form = new FormData();
  form.set("bookingId", String(bookingId));
  form.set("kind", kind);
  form.set("file", file);
  let response = await fetch("/api/image", {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw Error((await response.json()).error);
}
function BookingForm({
  s: state,
  post: submitAction,
  old: existingBooking,
  initialRound,
}) {
  let [step, setStep] = useState(1),
    [weights, setWeights] = useState(
      Object.fromEntries(
        (existingBooking?.items || []).map((_) => [
          _.materialId,
          String(_.grams / 1000),
        ]),
      ),
    ),
    [note, setNote] = useState(existingBooking?.note || ""),
    [attachment, setAttachment] = useState(null),
    [savedId, setSavedId] = useState(null),
    [error, setError] = useState(""),
    availableRounds = state.rounds
      .filter(
        (_) =>
          _.status === "OPEN" &&
          Date.parse(_.cutoff) > state.serverTime &&
          (!existingBooking || _.id === existingBooking.roundId),
      )
      .sort((_, O) => _.startAt.localeCompare(O.startAt)),
    [roundId, setRoundId] = useState(
      existingBooking?.roundId ||
        availableRounds.find((_) => _.id === initialRound)?.id ||
        availableRounds[0]?.id ||
        0,
    ),
    selectedRound = availableRounds.find((_) => _.id === roundId),
    items = state.materials
      .filter((_) => Number(weights[_.id]) > 0)
      .map((_) => ({
        materialId: _.id,
        name: _.name,
        grams: Math.round(Number(weights[_.id]) * 1000),
        price: _.price,
      })),
    estimatedAmount = items.reduce(
      (_, O) => _ + Math.floor((O.grams * O.price + 500) / 1000),
      0,
    ),
    totalGrams = items.reduce((_, O) => _ + O.grams, 0);
  return state.user?.role !== "seller" ? (
    <EmptyState>การจองวัสดุเปิดให้บัญชีผู้ขาย</EmptyState>
  ) : availableRounds.length ? (
    <div className="wizard">
      <div className="stepbar">
        {["เลือกวัสดุ", "เลือกรอบนัด", "ตรวจคำขอ"].map((_, O) => (
          <span
            aria-current={step === O + 1 ? "step" : void 0}
            className={O + 1 <= step ? "current" : ""}
            key={_}
          >
            <b>{O + 1 < step ? <Check size={14} /> : O + 1}</b>
            {_}
          </span>
        ))}
      </div>
      {step === 1 && (
        <form
          className="panel form"
          onSubmit={(_) => {
            if ((_.preventDefault(), !items.length)) {
              setError("กรุณาระบุน้ำหนักอย่างน้อยหนึ่งประเภท");
              return;
            }
            setError("");
            setStep(2);
          }}
        >
          <h2>วัสดุที่ต้องการขาย</h2>
          <p>ระบุน้ำหนักประมาณการเฉพาะประเภทที่นำมาขาย</p>
          {state.materials.map((_) => (
            <label className="weightrow" key={_.id}>
              <img src={"/art/" + _.art + ".svg"} alt="" />
              <span>
                {_.name}
                <small>
                  ฿{formatMoney(_.price)}
                  {" / กก."}
                </small>
              </span>
              <input
                type="number"
                name={"grams-" + _.id}
                step=".001"
                min="0"
                max="100000"
                placeholder="0.000"
                value={weights[_.id] || ""}
                onChange={(O) =>
                  setWeights({
                    ...weights,
                    [_.id]: O.target.value,
                  })
                }
              />
              <small>กก.</small>
            </label>
          ))}
          <div className="summary">
            <span>
              {"เลือกแล้ว "}
              {items.length}
              {" ประเภท · "}
              {formatWeight(totalGrams)}
              {" กก."}
            </span>
            <strong>ประมาณ ฿{formatMoney(estimatedAmount)}</strong>
          </div>
          <label>
            หมายเหตุ (ถ้ามี)
            <textarea
              value={note}
              onChange={(_) => setNote(_.target.value)}
              maxLength={500}
            />
          </label>
          <label>
            รูปวัสดุ (ถ้ามี)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(_) => setAttachment(_.target.files?.[0] || null)}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary">
            {"ถัดไป เลือกรอบ "}
            <ArrowRight size={16} />
          </button>
        </form>
      )}
      {step === 2 && (
        <div className="panel form">
          <h2>เลือกรอบรับซื้อ</h2>
          <p>
            ชุมชน{state.communities[0]?.name}
            {" · เวลาไทย"}
          </p>
          {availableRounds.map((_) => (
            <label className="radiocard" key={_.id}>
              <input
                type="radio"
                name="round"
                checked={roundId === _.id}
                onChange={() => setRoundId(_.id)}
              />
              <span>
                <strong>{_.name}</strong>
                <small>
                  {formatDateTime(_.startAt)}
                  {" · "}
                  {state.points.find((O) => O.id === _.pointId)?.name}
                </small>
                <small>
                  {"ปิดจอง "}
                  {formatDateTime(_.cutoff)}
                  {" · เหลือ "}
                  {formatWeight(_.capacity - _.grams)}
                  {" กก."}
                </small>
              </span>
            </label>
          ))}
          <div className="notice">
            ตรวจยอดจากน้ำหนักและราคาจริงอีกครั้งก่อนตกลงขาย ร้านจ่ายเงินให้คุณโดยตรง
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => setStep(1)}>
              ย้อนกลับ
            </button>
            <button className="primary" onClick={() => setStep(3)}>
              {"ตรวจคำขอขาย "}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
      {step === 3 && selectedRound && (
        <div className="panel">
          <h2>ตรวจคำขอก่อนจอง</h2>
          <p>
            {selectedRound.name}
            {" · "}
            {formatDateTime(selectedRound.startAt)}
          </p>
          <p>
            {state.points.find((_) => _.id === selectedRound.pointId)?.address}
          </p>
          {items.map((_) => (
            <div className="datarow" key={_.materialId}>
              <span>{_.name}</span>
              <strong>
                {formatWeight(_.grams)}
                {" กก."}
              </strong>
            </div>
          ))}
          <div className="summary">
            <span>
              {"ยอดประมาณการ · "}
              {formatWeight(totalGrams)}
              {" กก."}
            </span>
            <b>฿{formatMoney(estimatedAmount)}</b>
          </div>
          <p>ยอดสุทธิขึ้นอยู่กับผลชั่งและราคาที่คุณตกลงกับร้าน</p>
          {note && (
            <p>
              {"หมายเหตุ "}
              {note}
            </p>
          )}
          <ActionForm
            label={
              savedId
                ? "ลองแนบรูปอีกครั้ง"
                : existingBooking
                  ? "บันทึกการแก้ไข"
                  : "ยืนยันจองรอบ"
            }
            submit={async () => {
              let _ =
                savedId ??
                (
                  await submitAction(existingBooking ? "editBooking" : "book", {
                    bookingId: existingBooking?.id,
                    roundId,
                    items,
                    note,
                  })
                ).id;
              setSavedId(_);
              attachment && (await uploadAttachment(attachment, _, "material"));
              window.location.assign(viewUrl("booking", _));
            }}
          />
          {savedId ? (
            <SiteLink
              prefetch={false}
              className="under"
              href={viewUrl("booking", savedId)}
            >
              เปิดรายการที่บันทึกแล้ว
            </SiteLink>
          ) : (
            <button className="textlink" onClick={() => setStep(2)}>
              <ChevronLeft size={15} />
              {" ย้อนกลับ"}
            </button>
          )}
        </div>
      )}
    </div>
  ) : (
    <EmptyState>ยังไม่มีรอบเปิดรับจองในชุมชนของคุณ</EmptyState>
  );
}
export { uploadAttachment, BookingForm };
