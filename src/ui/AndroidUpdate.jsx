import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, X } from "lucide-react";

const downloadLink =
  "https://saleng-digital.vercel.app/downloads/saleng-digital.apk";
const deferKey = "trash2cash-update-later";
const checkEvent = "trash2cash-check-update";

export function CheckAndroidUpdate() {
  if (!window.SalengAndroid) return null;
  return (
    <button
      type="button"
      className="secondary"
      onClick={() => window.dispatchEvent(new Event(checkEvent))}
    >
      ตรวจอัปเดตแอป
    </button>
  );
}

export function AndroidUpdate() {
  const bridge = window.SalengAndroid;
  const [release, setRelease] = useState(null);
  const [step, setStep] = useState("offer");
  const [message, setMessage] = useState("");
  const lastVersion = useRef(0);

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false,
      checking = false,
      userRequested = false;
    const controller = new AbortController();
    async function check(event) {
      if (event?.type === checkEvent) userRequested = true;
      if (document.hidden || checking) return;
      checking = true;
      try {
        const response = await fetch("/downloads/android-release.json", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        const next = await response.json();
        if (
          !Number.isSafeInteger(next.versionCode) ||
          next.versionCode < 1 ||
          typeof next.versionName !== "string"
        )
          throw Error();
        if (cancelled) return;
        const installed =
          typeof bridge.getVersionCode === "function"
            ? bridge.getVersionCode()
            : 0;
        if (userRequested) sessionStorage.removeItem(deferKey);
        const deferred =
          sessionStorage.getItem(deferKey) === String(next.versionCode);
        if (installed >= next.versionCode || deferred) {
          setRelease(null);
          if (userRequested) setMessage("คุณใช้แอปรุ่นล่าสุดแล้ว");
        } else {
          if (lastVersion.current !== next.versionCode || userRequested)
            setStep("offer");
          lastVersion.current = next.versionCode;
          setRelease(next);
          setMessage("");
        }
      } catch {
        if (!cancelled && userRequested)
          setMessage("ตรวจอัปเดตไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
      } finally {
        checking = false;
        userRequested = false;
      }
    }
    check();
    const timer = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener(checkEvent, check);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener(checkEvent, check);
    };
  }, [bridge]);

  if (!release && !message) return null;
  function dismiss() {
    if (release) sessionStorage.setItem(deferKey, String(release.versionCode));
    setRelease(null);
    setMessage("");
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(downloadLink);
      setStep("copied");
    } catch {
      setStep("manual");
    }
  }
  function update() {
    if (typeof bridge.downloadUpdate !== "function") {
      void copyLink();
      return;
    }
    const outcome = bridge.downloadUpdate(release.versionCode);
    if (outcome === "current") {
      setRelease(null);
      setMessage("คุณใช้แอปรุ่นล่าสุดแล้ว");
    } else if (outcome === "queued" || outcome === "browser") setStep(outcome);
    else void copyLink();
  }
  return (
    <aside className="android-update" aria-label="อัปเดตแอป">
      <ArrowDownToLine size={20} aria-hidden="true" />
      <div aria-live="polite">
        <strong>{release ? "มีอัปเดต " + release.versionName : message}</strong>
        {release && step === "queued" && (
          <p>เริ่มดาวน์โหลดแล้ว เมื่อเสร็จให้เปิดไฟล์ APK แล้วแตะ “อัปเดต”</p>
        )}
        {release && step === "browser" && (
          <p>เปิดไฟล์ที่ดาวน์โหลดในเบราว์เซอร์ แล้วแตะ “อัปเดต”</p>
        )}
        {release && (step === "manual" || step === "copied") && (
          <>
            <p>
              {step === "copied"
                ? "คัดลอกลิงก์แล้ว เปิด Chrome แล้ววางลิงก์เพื่อดาวน์โหลด"
                : "เปิด Chrome แล้วพิมพ์ saleng-digital.vercel.app จากนั้นแตะดาวน์โหลด APK"}
            </p>
            <p>เปิดไฟล์ที่โหลดเสร็จ แล้วแตะ “อัปเดต”</p>
          </>
        )}
      </div>
      {release && step === "offer" && (
        <button className="primary" onClick={update}>
          อัปเดต
        </button>
      )}
      {release && step === "queued" && (
        <button className="primary" onClick={() => bridge.openDownloads()}>
          เปิดดาวน์โหลด
        </button>
      )}
      <button
        className="update-later"
        aria-label="ปิดแจ้งเตือนอัปเดต"
        onClick={dismiss}
      >
        <X size={18} />
      </button>
    </aside>
  );
}
