import QRCode from "qrcode";
import { createRoot } from "react-dom/client";
import { formatMoney, labels } from "./ui/shared.jsx";
import { Login } from "./pages/Login.jsx";
import { Introduction } from "./pages/Introduction.jsx";
import { Workspace } from "./pages/Workspace.jsx";
import "./account.css";

const root = createRoot(document.getElementById("root"));
const params = new URLSearchParams(location.search);
const android = window.SalengAndroid;
if (android) window.print = () => android.printPage();
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(console.error),
  );
}
async function readState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw Error("connection");
  return response.json();
}
window.showcaseImage = (id) => "/api/image?id=" + encodeURIComponent(id);
window.showcaseQR = (e) => {
  let t = QRCode.create(e).modules,
    a = "";
  for (let r = 0; r < t.size; r++)
    for (let n = 0; n < t.size; n++)
      t.get(r, n) && (a += "M" + n + " " + r + "h1v1h-1z");
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ' +
        (t.size + 8) +
        " " +
        (t.size + 8) +
        '"><rect x="-4" y="-4" width="100%" height="100%" fill="white"/><path d="' +
        a +
        '"/></svg>',
    )
  );
};
document.addEventListener("click", async (e) => {
  let t = e.target.closest("a");
  if (!t || !t.pathname.startsWith("/api/export")) return;
  e.preventDefault();
  let a;
  try {
    a = await readState();
    if (!a.user) {
      location.replace("/");
      return;
    }
  } catch {
    window.alert("ยังดาวน์โหลดไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
    return;
  }
  let r = Number(new URL(t.href).searchParams.get("roundId")),
    n = [
      [
        "รหัสนัด",
        "รอบ",
        "สถานะ",
        "วัสดุ",
        "น้ำหนักจอง (กก.)",
        "น้ำหนักชั่ง (กก.)",
        "ยอดชั่ง (บาท)",
        "รับเงินจริง (บาท)",
      ],
    ];
  for (let u of a.bookings.filter((l) => !r || l.roundId === r))
    for (let l of u.items) {
      let s = u.revisions
        .at(-1)
        ?.items.find((c) => c.materialId === l.materialId);
      n.push([
        u.code,
        a.rounds.find((c) => c.id === u.roundId)?.name,
        labels[u.status],
        a.materials.find((c) => c.id === l.materialId)?.name,
        l.grams / 1000,
        s ? s.grams / 1000 : "",
        s ? formatMoney(s.amount) : "",
        s && u.receipt ? formatMoney(s.amount) : "",
      ]);
    }
  let o = n
    .map((u) =>
      u
        .map(
          (l) =>
            '"' +
            String(l ?? "")
              .replace(/^([\s]*[=+@-])/, "'$1")
              .replaceAll('"', '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
  if (android) {
    android.saveCsv("\uFEFF" + o);
    return;
  }
  let i = document.createElement("a");
  i.href = URL.createObjectURL(
    new Blob(["﻿", o], {
      type: "text/csv;charset=utf-8",
    }),
  );
  i.download = "รายการขาย.csv";
  i.click();
  setTimeout(() => URL.revokeObjectURL(i.href), 2000);
});
async function startApp() {
  try {
    const state = await readState();
    if (params.has("intro")) {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw Error("connection");
      root.render(
        <Introduction state={await response.json()} signed={!!state.user} />,
      );
    } else if (state.user) {
      root.render(
        <Workspace
          initial={state}
          view={params.get("view") || "home"}
          id={Number(params.get("id")) || 0}
        />,
      );
    } else {
      root.render(<Login />);
    }
  } catch {
    root.render(
      <main className="connection-state">
        <img src="/icon.svg" width="48" alt="" />
        <h1>เชื่อมต่อไม่ได้</h1>
        <p>ตรวจสัญญาณอินเทอร์เน็ตเพื่อเปิดบัญชีของคุณ</p>
        <button className="primary" onClick={startApp}>
          ลองอีกครั้ง
        </button>
      </main>,
    );
  }
}
startApp();
