import QRCode from "qrcode";
import { createRoot } from "react-dom/client";
import {
  getRecord,
  insert,
  queryOne,
  requireBookingAccess,
  requireCondition,
} from "./data/database.js";
import { formatMoney, labels } from "./ui/shared.jsx";
import { loadState } from "./data/state.js";
import { applyAction } from "./data/actions.js";
import { seedDatabase, seedDemoTransactions } from "./data/seed.js";
import { Fragment } from "react";
import { Introduction } from "./pages/Introduction.jsx";
import { Workspace } from "./pages/Workspace.jsx";

const android = import.meta.env.MODE === "android" ? window.SalengAndroid : null;
const demoStorage = android ? localStorage : sessionStorage;
if (android) window.print = () => android.printPage();

if (import.meta.env.PROD && !android && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  });
}

var nativeFetch = window.fetch.bind(window),
  root = createRoot(document.getElementById("root")),
  roles = ["seller", "buyer", "community", "admin"],
  params = new URLSearchParams(location.search),
  databaseKey = "saleng-showcase-db-1",
  sqlite;
function persistDatabase() {
  let bytes = sqlite.export(),
    encoded = "";
  for (let a = 0; a < bytes.length; a += 10000)
    encoded += String.fromCharCode(...bytes.subarray(a, a + 10000));
  demoStorage.setItem(databaseKey, btoa(encoded));
  sqlite.run("PRAGMA foreign_keys=ON");
}
function currentUser() {
  let role = demoStorage.getItem("saleng-role") || "seller";
  return queryOne(
    "SELECT id,name,email,role,communityId FROM User WHERE email=?",
    role + "@trashtocash.example",
  );
}
function switchRole(role) {
  demoStorage.setItem("saleng-role", role);
  location.href = "/?view=home";
}
function RoleSwitcher() {
  return (
    <aside className="showcase-tools" aria-label="เปลี่ยนมุมมอง">
      <label>
        {"ดูเว็บในบทบาท "}
        <select
          value={demoStorage.getItem("saleng-role") || "seller"}
          onChange={(e) => switchRole(e.target.value)}
        >
          {roles.map((e) => (
            <option value={e} key={e}>
              {labels[e]}
            </option>
          ))}
        </select>
      </label>
      <a href="/?intro=1">หน้าแนะนำเว็บ</a>
      {!android && <a href="/downloads/saleng-digital.apk" download>ดาวน์โหลด APK สำหรับ Android</a>}
    </aside>
  );
}
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
window.showcaseImage = (e) => demoStorage.getItem("saleng-image-" + e) || "";
async function storeImage(form) {
  let user = currentUser(),
    booking = getRecord("Booking", Number(form.get("bookingId")));
  requireBookingAccess(user, booking);
  let kind = form.get("kind"),
    file = form.get("file");
  requireCondition(
    (kind === "material" &&
      user.role === "seller" &&
      booking.status === "BOOKED") ||
      (kind === "proof" &&
        user.role === "buyer" &&
        booking.status === "PAYMENT_REPORTED"),
    "แนบไม่ได้ในสถานะนี้",
  );
  requireCondition(
    file instanceof File &&
      file.size <= 4194304 &&
      ["image/png", "image/jpeg", "image/webp"].includes(file.type),
    "เลือกรูป JPEG, PNG หรือ WebP ไม่เกิน 4 MB",
  );
  let bitmap = await createImageBitmap(file),
    scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let id = insert("Attachment", {
    actorId: user.id,
    bookingId: booking.id,
    kind,
    file: "showcase",
    mime: "image/webp",
    at: new Date().toISOString(),
  });
  demoStorage.setItem(
    "saleng-image-" + id,
    canvas.toDataURL("image/webp", 0.65),
  );
  return {
    id,
  };
}
window.fetch = async (e, t = {}) => {
  try {
    if (e === "/api/state") return Response.json(loadState(currentUser()));
    if (e === "/api/action") {
      let a = JSON.parse(t.body);
      if (a.action === "logout") {
        demoStorage.removeItem("saleng-role");
        return Response.json({});
      }
      let r = applyAction(currentUser(), a);
      persistDatabase();
      return Response.json(r);
    }
    if (e === "/api/image" && t.method === "POST") {
      let a = await storeImage(t.body);
      persistDatabase();
      return Response.json(a);
    }
    return nativeFetch(e, t);
  } catch (a) {
    return Response.json(
      {
        error: a.name === "ZodError" ? "กรุณาตรวจข้อมูลอีกครั้ง" : a.message,
      },
      {
        status: 400,
      },
    );
  }
};
document.addEventListener("click", (e) => {
  let t = e.target.closest("a");
  if (!t || !t.pathname.startsWith("/api/export")) return;
  e.preventDefault();
  let a = loadState(currentUser()),
    r = Number(new URL(t.href).searchParams.get("roundId")),
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
  let o = n.map((u) =>
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
    ).join("\r\n");
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
  let SQL = await window.initSqlJs(),
    saved = demoStorage.getItem(databaseKey);
  sqlite = new SQL.Database(
    saved ? Uint8Array.from(atob(saved), (a) => a.charCodeAt(0)) : void 0,
  );
  window.showcaseDb = {
    exec: (a) => sqlite.run(a),
    prepare: (a) => ({
      all: (...r) => {
        let n = sqlite.prepare(a);
        try {
          n.bind(r);
          let o = [];
          for (; n.step();) o.push(n.getAsObject());
          return o;
        } finally {
          n.free();
        }
      },
      run: (...r) => (
        sqlite.run(a, r),
        {
          lastInsertRowid: sqlite.exec("SELECT last_insert_rowid()")[0]
            .values[0][0],
          changes: sqlite.getRowsModified(),
        }
      ),
    }),
  };
  sqlite.run("PRAGMA foreign_keys=ON");
  saved ||
    (sqlite.run(await (await nativeFetch("/schema.sql")).text()),
    seedDatabase(),
    seedDemoTransactions(),
    persistDatabase());
  root.render(
    <Fragment>
      <RoleSwitcher />
      {params.has("roles") ? (
        <main className="wrap section">
          <h1>เลือกบทบาทที่ต้องการดู</h1>
          <div className="actions">
            {roles.map((a) => (
              <button className="primary" onClick={() => switchRole(a)} key={a}>
                {labels[a]}
              </button>
            ))}
          </div>
        </main>
      ) : params.has("intro") ? (
        <Introduction state={loadState(null)} signed={true} />
      ) : (
        <Workspace
          initial={loadState(currentUser())}
          view={params.get("view") || "home"}
          id={Number(params.get("id")) || 0}
        />
      )}
    </Fragment>,
  );
}
startApp().catch(() =>
  root.render(
    <main className="wrap section">
      <h1>โหลดข้อมูลตัวอย่างไม่ได้</h1>
      <button
        onClick={() => {
          demoStorage.removeItem(databaseKey);
          location.reload();
        }}
      >
        โหลดข้อมูลตัวอย่างใหม่
      </button>
    </main>,
  ),
);
