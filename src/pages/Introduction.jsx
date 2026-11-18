import { Fragment, useState } from "react";
import { BrandLink, Footer, MaterialCards } from "../ui/shared.jsx";
import { SiteLink } from "../ui/Link.jsx";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  MapPin,
  Menu,
  Scale,
  Wallet,
  X,
} from "lucide-react";
function LandingHeader({ signed = false }) {
  let [t, a] = useState(false);
  return (
    <header className="topbar">
      <div className="wrap nav">
        <BrandLink />
        <nav className={t ? "show" : ""} aria-label="เมนูหลัก">
          <SiteLink prefetch={false} href="/#prices">
            ราคาวัสดุ
          </SiteLink>
          <SiteLink prefetch={false} href="/#how">
            วิธีใช้งาน
          </SiteLink>
          <SiteLink prefetch={false} href="/#help">
            คำถามที่พบบ่อย
          </SiteLink>
        </nav>
        <SiteLink
          prefetch={false}
          className="login"
          href={signed ? "/app" : "/login"}
        >
          {signed ? "พื้นที่ของฉัน" : "เข้าสู่ระบบ"} <ArrowUpRight size={16} />
        </SiteLink>
        <button
          className="mobilemenu"
          aria-label="เปิดหรือปิดเมนู"
          onClick={() => a(!t)}
        >
          {t ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
function Introduction({ state, signed }) {
  return (
    <Fragment>
      <LandingHeader signed={signed} />
      <main className="wrap landing">
        <section className="hero">
          <div className="herocopy">
            <span className="kicker">
              <i />
              {" Trash 2 cash"}
            </span>
            <h1>
              นัดขายรีไซเคิล
              <br />
              <span>ใกล้บ้านคุณ</span>
            </h1>
            <p>
              เลือกรอบรับซื้อ นำวัสดุมาที่จุดนัดในชุมชน
              <br />
              ตรวจน้ำหนักและยอดเงินก่อนตกลงขาย
            </p>
            <div className="actions">
              <SiteLink
                prefetch={false}
                className="primary"
                href={signed ? "/app?view=new" : "/login?register=1"}
              >
                {"เริ่มขายวัสดุ "}
                <ArrowRight size={18} />
              </SiteLink>
              <SiteLink prefetch={false} className="textlink" href="#how">
                {"ดูวิธีใช้งาน "}
                <ArrowDown size={15} />
              </SiteLink>
            </div>
          </div>
          <div className="heroart">
            <img
              src="/art/hero.svg"
              alt="ซาเล้งสีเขียวบรรทุกวัสดุรีไซเคิลมารับซื้อหน้าชุมชน"
            />
          </div>
        </section>
        <div className="benefits">
          <span>
            <MapPin />
            จุดรับใกล้บ้าน
          </span>
          <span>
            <Scale />
            ตรวจยอดตามน้ำหนักจริง
          </span>
          <span>
            <Wallet />
            รับเงินตรงจากร้าน
          </span>
        </div>
        <section className="section" id="prices">
          <div className="sectionhead">
            <div>
              <span className="eyebrow">
                <i />
                {" ราคาต่อกิโลกรัม"}
              </span>
              <h2>ราคาอ้างอิงวัสดุ</h2>
              <p>เลือกวัสดุเพื่อดูวิธีคัดแยกและเตรียมก่อนขาย</p>
            </div>
            <span className="soft">
              <i />
              {state.demo ? "ราคาอ้างอิงสำหรับสาธิต" : "ราคาอ้างอิง"}
            </span>
          </div>
          <MaterialCards s={state} />
        </section>
        <section className="section" id="how">
          <span className="eyebrow">
            <i />
            {" วิธีใช้งาน"}
          </span>
          <h2>ขายรีไซเคิลในชุมชน</h2>
          <div className="steps">
            {[
              [
                CalendarDays,
                "จองรอบรับซื้อ",
                "เลือกวัสดุ ระบุน้ำหนักคร่าว ๆ แล้วเลือกจุดรวมใกล้บ้าน",
              ],
              [Scale, "ตรวจผลชั่ง", "นำวัสดุไปที่จุดนัด แสดงรหัส และตรวจราคาแยกตามวัสดุ"],
              [
                CheckCheck,
                "ยืนยันรับเงิน",
                "ตกลงยอดหลังชั่ง รับเงินจากร้านโดยตรง แล้วกดยืนยัน",
              ],
            ].map(([StepIcon, r, n], o) => (
              <article key={o}>
                <StepIcon size={26} />
                <small>0{o + 1}</small>
                <h3>{String(r)}</h3>
                <p>{String(n)}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="section faq" id="help">
          <div>
            <span className="eyebrow">
              <i />
              {" ศูนย์ช่วยเหลือ"}
            </span>
            <h2>คำถามที่พบบ่อย</h2>
          </div>
          <div>
            {[
              [
                "ยอดประมาณการต่างจากยอดรับเงินจริงอย่างไร",
                "ราคาอ้างอิงใช้ประเมินก่อนจอง ร้านจะชั่งจริงและส่งราคาของแต่ละวัสดุให้คุณตรวจและตกลงก่อนจ่าย",
              ],
              [
                "ต้องเตรียมวัสดุอย่างไร",
                "แยกชนิด ทำความสะอาด และผึ่งให้แห้ง ดูรายละเอียดของแต่ละประเภทที่การ์ดราคาวัสดุ",
              ],
              [
                "หากยอดเงินไม่ตรงต้องทำอย่างไร",
                "เปิดรายการขาย เลือกแจ้งปัญหา พร้อมบอกเหตุผล แอดมินจะติดตามและบันทึกผลให้ตรวจได้",
              ],
            ].map(([a, r]) => (
              <details key={a}>
                <summary>{a}</summary>
                <p>{r}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </Fragment>
  );
}
export { Introduction };
