import { useState } from "react";
import { ArrowRight, Download, Eye, EyeOff, LoaderCircle } from "lucide-react";

const legacyKeys = (storage) =>
  Object.keys(storage).filter(
    (key) =>
      key === "saleng-role" ||
      key === "saleng-showcase-db-1" ||
      key.startsWith("saleng-image-"),
  );

export function Login() {
  const [signup, setSignup] = useState(
    new URLSearchParams(location.search).has("register"),
  );
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState(() =>
    [sessionStorage, localStorage].some((s) => legacyKeys(s).length),
  );
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          action: signup ? "register" : "login",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "กรุณาลองอีกครั้ง");
      location.replace("/?view=home");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจอินเทอร์เน็ต"
          : err.message,
      );
      setBusy(false);
    }
  }
  function clearLegacy() {
    if (!window.confirm("ลบรายการและรูปจากซาเล้งรุ่นสาธิตในเครื่องนี้อย่างถาวรหรือไม่?"))
      return;
    for (const store of [sessionStorage, localStorage])
      for (const key of legacyKeys(store)) store.removeItem(key);
    setLegacy(false);
  }
  return (
    <div className="account-screen">
      <header className="account-bar">
        <a className="account-brand" href="/">
          <img src="/icon.svg" alt="" width="36" height="36" />
          Trash 2 cash
        </a>
        {!window.SalengAndroid && (
          <a
            className="app-download"
            href="/downloads/saleng-digital.apk"
            download
          >
            <Download size={16} />
            ดาวน์โหลด APK
          </a>
        )}
      </header>
      <main className="account-grid">
        <section className="account-story">
          <div>
            <h2>นัดขายรีไซเคิล</h2>
            <p>เลือกรอบนัดกับร้านรับซื้อในชุมชน</p>
          </div>
          <img src="/art/hero.svg" alt="ซาเล้งบรรทุกวัสดุรีไซเคิลหน้าจุดนัดรับในชุมชน" />
        </section>
        <section className="account-form">
          <h1>{signup ? "สร้างบัญชี" : "เข้าสู่ระบบ"}</h1>
          <p>
            {signup ? "เริ่มต้นในบทบาทผู้ขายวัสดุ" : "เปิดรายการนัดและติดตามยอดขายของคุณ"}
          </p>
          <form onSubmit={submit} key={signup ? "register" : "login"}>
            {signup && (
              <label>
                ชื่อที่แสดง
                <input
                  name="name"
                  autoComplete="nickname"
                  required
                  maxLength={80}
                  placeholder="เช่น มะลิ"
                />
              </label>
            )}
            <label>
              ชื่อผู้ใช้
              <input
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={3}
                maxLength={40}
                placeholder="เช่น mali.01"
              />
            </label>
            <label>
              รหัสผ่าน
              <span className="secret-field">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  required
                  minLength={signup ? 8 : 1}
                  maxLength={128}
                  autoComplete={signup ? "new-password" : "current-password"}
                  placeholder={signup ? "อย่างน้อย 8 ตัวอักษร" : "กรอกรหัสผ่าน"}
                />
                <button
                  type="button"
                  aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button disabled={busy} className="primary account-submit">
              {signup ? "สร้างบัญชี" : "เข้าสู่ระบบ"}
              {busy ? (
                <LoaderCircle className="spinner" size={18} />
              ) : (
                <ArrowRight size={19} />
              )}
            </button>
          </form>
          <p className="switch-account">
            {signup ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชี?"}{" "}
            <button
              disabled={busy}
              onClick={() => {
                setSignup(!signup);
                setVisible(false);
                setError("");
              }}
            >
              {signup ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
            </button>
          </p>
          {legacy && (
            <button className="legacy-clear" onClick={clearLegacy}>
              ล้างข้อมูลสาธิตเดิมในเครื่องนี้
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
