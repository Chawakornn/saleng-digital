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
import { Fragment } from "react";
import { CheckAndroidUpdate } from "../ui/AndroidUpdate.jsx";
import { UserRound } from "lucide-react";
function Profile({ s: state, post: submitAction, logoutControl }) {
  let a = state.user,
    r = state.buyers.find((n) => n.userId === a.id);
  return (
    <div className="detail">
      <section className="panel">
        <div className="profile-identity">
          <UserRound size={24} aria-hidden="true" />
          <div>
            <h2>{a.name}</h2>
            <p>
              @{a.username} · {labels[a.role]}
            </p>
          </div>
        </div>
        <ActionForm
          label="บันทึกข้อมูลส่วนตัว"
          submit={(n) =>
            submitAction("profile", {
              name: readText(n, "name"),
            })
          }
        >
          <FormField name="name" label="ชื่อที่ใช้ติดต่อ" value={a.name} />
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
