import {
  ActionForm,
  EmptyState,
  FormField,
  formatDateTime,
  formatMoney,
  labels,
  readScaledNumber,
  readText,
  weightField,
} from "../ui/shared.jsx";
import { Fragment, useRef, useState } from "react";
import { CheckAndroidUpdate } from "../ui/AndroidUpdate.jsx";
import { UserRound } from "lucide-react";
async function profilePhoto(file) {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 8*1024*1024)
    throw Error("เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 8 MB");
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();
    image.src=url;
    await image.decode();
    const side=Math.min(image.naturalWidth,image.naturalHeight);
    const canvas=document.createElement("canvas");
    canvas.width=canvas.height=240;
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="white"; ctx.fillRect(0,0,240,240);
    ctx.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,240,240);
    return canvas.toDataURL("image/jpeg",0.84);
  } finally { URL.revokeObjectURL(url); }
}
function Profile({ s: state, post: submitAction, logoutControl }) {
  const [photo,setPhoto]=useState(undefined);
  const [photoError,setPhotoError]=useState("");
  const [processing,setProcessing]=useState(false);
  const selection=useRef(0);
  let a = state.user,
    r = state.buyers.find((n) => n.userId === a.id);
  return (
    <div className="detail">
      <section className="panel">
        <div className="profile-identity">
          {(photo ?? a.avatar) ? <img className="account-avatar" src={photo ?? a.avatar} alt="รูปโปรไฟล์ของฉัน"/> : <UserRound size={24} aria-hidden="true" />}
          <div>
            <h2>{a.name}</h2>
            <p>
              @{a.username} · {labels[a.role]}
            </p>
          </div>
        </div>
        <ActionForm
          label="บันทึกข้อมูลส่วนตัว"
          submit={async (n) => {
            if(processing || photoError) throw Error(photoError || "กำลังเตรียมรูป");
            const seq=selection.current;
            await submitAction("profile",{name:readText(n,"name"),address:readText(n,"address"),phone:readText(n,"phone"),...(photo===undefined?{}:{avatar:photo})});
            if(seq===selection.current)setPhoto(undefined);
          }}
        >
          <label>เปลี่ยนรูปโปรไฟล์
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{
              const file=e.target.files[0]; e.target.value=""; if(!file)return;
              const seq=++selection.current;
              setProcessing(true);setPhotoError("");
              try {const next=await profilePhoto(file);if(seq===selection.current)setPhoto(next);}
              catch {if(seq===selection.current)setPhotoError("อ่านรูปไม่ได้ กรุณาเลือกรูป JPG, PNG หรือ WebP ไม่เกิน 8 MB");}
              finally {if(seq===selection.current)setProcessing(false);}
            }}/>
          </label>
          {processing && <small role="status">กำลังเตรียมรูป…</small>}
          {photoError && <p role="alert">{photoError}</p>}
          {(photoError || (photo ?? a.avatar)) && <button type="button" className="secondary" onClick={()=>{selection.current++;setPhoto(photoError?undefined:"");setPhotoError("");setProcessing(false);}}>{photoError?"ยกเลิกการเลือกรูป":"ลบรูปโปรไฟล์"}</button>}
          <FormField name="name" label="ชื่อที่ใช้ติดต่อ" value={a.name} />
          <label>เบอร์โทรศัพท์ (ถ้ามี)<input name="phone" type="tel" autoComplete="tel" maxLength={32} defaultValue={a.phone || ""}/></label>
          <label>ที่อยู่ (ถ้ามี)<textarea name="address" autoComplete="street-address" maxLength={500} defaultValue={a.address || ""}/></label>
        </ActionForm>
      </section>
      {!window.SalengAndroid && (
        <a className="secondary" href="/downloads/saleng-digital.apk" download>
          ดาวน์โหลด APK สำหรับ Android
        </a>
      )}
      {state.canClaimOwner && (
        <details className="panel">
          <summary>เปิดสิทธิ์ผู้ดูแล</summary>
          <ActionForm
            label="เปิดสิทธิ์ผู้ดูแล"
            submit={(form) =>
              submitAction("claimOwner", { code: readText(form, "code") })
            }
          >
            <FormField
              name="code"
              label="รหัสส่วนตัวสำหรับเจ้าของระบบ"
              type="password"
            />
          </ActionForm>
        </details>
      )}
      {["seller", "buyer"].includes(a.role) && (
        <details className="panel" open={a.role === "buyer"}>
          <summary>
            {a.role === "buyer"
              ? "ข้อมูลร้านและรถ"
              : r
                ? "คำขอสมัครร้าน · รออนุมัติ"
                : "สมัครเป็นร้านรับซื้อ"}
          </summary>
          <ActionForm
            label={a.role === "buyer" ? "บันทึกร้าน" : "ส่งคำขอให้แอดมิน"}
            submit={(n) =>
              submitAction(a.role === "buyer" ? "buyerProfile" : "applyBuyer", {
                shop: readText(n, "shop"),
                vehicle: readText(n, "vehicle"),
                capacity: readScaledNumber(n, "capacity", 1000),
                area: readText(n, "area"),
              })
            }
          >
            <FormField name="shop" label="ชื่อร้าน" value={r?.shop} />
            <FormField name="vehicle" label="รถที่ใช้" value={r?.vehicle} />
            {weightField("capacity", "ความจุรถ", r?.capacity)}
            <FormField name="area" label="พื้นที่บริการ" value={r?.area} />
          </ActionForm>
        </details>
      )}
      <CheckAndroidUpdate />
      {logoutControl}
    </div>
  );
}
export function MaterialEditor({materials, post: submitAction}) {
  return (
    <section className="panel">
      <h2>จัดการวัสดุและราคากลาง</h2>
      {[null, ...materials].map((r) => (
        <details key={r?.id || 0}>
          <summary>
            {r ? r.name + " · ฿" + formatMoney(r.price) + " / กก." : "＋ เพิ่มวัสดุและราคากลาง"}
          </summary>
          <ActionForm
            label="บันทึกวัสดุและราคา"
            submit={(n) =>
              submitAction("material", {
                materialId: r?.id,
                name: readText(n, "name"),
                guide: readText(n, "guide"),
                price: readScaledNumber(n, "price", 100),
                active: n.has("active"),
              })
            }
          >
            <FormField name="name" label="ชื่อวัสดุ" value={r?.name} />
            <FormField name="guide" label="วิธีเตรียม" value={r?.guide} />
            <FormField name="price" label="ราคากลาง (บาท/กก.)" type="number" min={0} max={10000} step=".01" value={r ? r.price / 100 : undefined} />
            <label className="inline">
              <input
                name="active"
                type="checkbox"
                defaultChecked={r ? !!r.active : true}
              />
              เปิดรับวัสดุ
            </label>
          </ActionForm>
        </details>
      ))}
    </section>
  );
}
function Management({ s: state, post: submitAction }) {
  let a = state.user.role === "admin";
  return !a && state.user.role !== "community" ? (
    <EmptyState>สำหรับผู้ดูแลชุมชน</EmptyState>
  ) : (
    <div className="detail">
      <section className="panel">
        <h2>ชุมชนและจุดรวมวัสดุ</h2>
        {[...state.communities, ...(a ? [null] : [])].map((r) => (
          <details key={r?.id || 0}>
            <summary>{r?.name || "เพิ่มชุมชน"}</summary>
            <ActionForm
              label="บันทึกชุมชน"
              submit={(n) =>
                submitAction("community", {
                  communityId: r?.id,
                  name: readText(n, "name"),
                  address: readText(n, "address"),
                  guide: readText(n, "guide"),
                })
              }
            >
              <FormField name="name" label="ชื่อชุมชน" value={r?.name} />
              <FormField name="address" label="ที่อยู่" value={r?.address} />
              <FormField
                name="guide"
                label="คำแนะนำการเตรียมวัสดุ"
                value={r?.guide}
                required={false}
              />
            </ActionForm>
            {r &&
              [...state.points.filter((n) => n.communityId === r.id), null].map(
                (n) => (
                  <details key={n?.id || 0}>
                    <summary>{n?.name || "เพิ่มจุดรวมวัสดุ"}</summary>
                    <ActionForm
                      label="บันทึกจุดรับ"
                      submit={(o) =>
                        submitAction("point", {
                          communityId: r.id,
                          pointId: n?.id,
                          name: readText(o, "name"),
                          address: readText(o, "address"),
                          active: o.has("active"),
                        })
                      }
                    >
                      <FormField name="name" label="ชื่อจุดรวม" value={n?.name} />
                      <FormField
                        name="address"
                        label="ที่ตั้งและคำอธิบายทาง"
                        value={n?.address}
                      />
                      <label className="inline">
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={n ? !!n.active : true}
                        />
                        เปิดใช้งาน
                      </label>
                    </ActionForm>
                  </details>
                ),
              )}
          </details>
        ))}
      </section>
      <section className="panel">
        <h2>{a ? "บัญชีและการอนุมัติร้าน" : "สมาชิกในชุมชน"}</h2>
        {state.users
          .filter((r) => r.id !== state.user.id && (a || r.role === "seller"))
          .map((r) => (
            <details key={r.id}>
              <summary>
                {r.name}
                {" · "}
                {labels[r.role]} {r.active ? "" : "· ระงับแล้ว"}
              </summary>
              <p>
                {r.username} {state.buyers.find((n) => n.userId === r.id)?.shop}
              </p>
              <ActionForm
                label="บันทึกสิทธิ์บัญชี"
                confirm="ยืนยันการเปลี่ยนสิทธิ์บัญชีนี้หรือไม่"
                submit={(n) =>
                  submitAction(a ? "user" : "member", {
                    userId: r.id,
                    role: readText(n, "role"),
                    communityId: readScaledNumber(n, "communityId"),
                    active: n.has("active"),
                  })
                }
              >
                {a && (
                  <Fragment>
                    <label>
                      บทบาท
                      <select defaultValue={r.role} name="role">
                        {["seller", "buyer", "community", "admin"].map((n) => (
                          <option value={n} key={n}>
                            {labels[n]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      ชุมชนที่ได้รับมอบหมาย
                      <select defaultValue={r.communityId} name="communityId">
                        {state.communities.map((n) => (
                          <option value={n.id} key={n.id}>
                            {n.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </Fragment>
                )}
                <label className="inline">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={!!r.active}
                  />
                  เปิดใช้งานบัญชี
                </label>
              </ActionForm>
            </details>
          ))}
      </section>
      {a && (
        <Fragment>
          <MaterialEditor materials={state.materials} post={submitAction} />
          <section className="panel">
            <h2>ประวัติการดำเนินงาน</h2>
            {state.audit.map((r) => (
              <div className="datarow" key={r.id}>
                <span>
                  {auditLabels[r.action] || r.action}
                  {" · #"}
                  {r.subject}
                  <small>{r.note}</small>
                </span>
                <small>
                  บัญชี #{r.actorId ?? "ระบบ"}
                  {" · "}
                  {formatDateTime(r.at)}
                </small>
              </div>
            ))}
          </section>
        </Fragment>
      )}
    </div>
  );
}
var auditLabels = {
  "seed.v1": "เตรียมข้อมูลสาธิต",
  book: "จองรอบ",
  editBooking: "แก้คำขอ",
  round: "จัดการรอบ",
  confirm: "ยืนยันรอบ",
  claim: "รับงาน",
  weigh: "ส่งผลชั่ง",
  accept: "ยืนยันยอด",
  pay: "แจ้งจ่าย",
  receive: "ยืนยันรับเงิน",
  checkin: "เช็กอิน",
  cancel: "ยกเลิกรายการ",
  resolve: "แก้ข้อพิพาท",
  dispute: "เปิดข้อพิพาท",
  reject: "ปฏิเสธผลชั่ง",
  decline: "ปฏิเสธงาน",
  cost: "บันทึกต้นทุน",
  agreement: "ตกลงค่าบริการ",
  issue: "ออกใบเรียกเก็บ",
  settle: "รับชำระค่าบริการ",
  user: "แก้สิทธิ์",
  member: "จัดการสมาชิก",
  community: "แก้ข้อมูลชุมชน",
  point: "แก้จุดรับ",
  profile: "แก้ข้อมูลส่วนตัว",
  read: "อ่านแจ้งเตือน",
  economics: "บันทึกผลขายต่อ",
  destination: "บันทึกปลายทาง",
  survey: "ตอบความพร้อมจ่าย",
  estimate: "บันทึกประมาณการ",
  invite: "เชิญร้าน",
  finishRound: "ปิดรอบ",
  cancelRound: "ยกเลิกรอบ",
  noShow: "ไม่มาตามนัด",
  open: "เปิดรอบ",
  material: "แก้วัสดุ",
  buyerProfile: "แก้ข้อมูลร้าน",
  applyBuyer: "ส่งคำขอสมัครร้าน",
};
export { Profile, Management };
