import { Fragment, useEffect, useState } from "react";
import {
  ActionForm,
  BrandLink,
  EmptyState,
  MaterialCards,
  StatusBadge,
  formatDateTime,
  formatMoney,
  formatWeight,
  labels,
  postAction,
  viewUrl,
} from "../ui/shared.jsx";
import {
  Bell,
  CalendarDays,
  ChartColumn,
  CircleQuestionMark,
  ClipboardList,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Settings,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { SiteLink } from "../ui/Link.jsx";
import { Dashboard } from "./Dashboard.jsx";
import { RoundDetail, RoundForm } from "./Rounds.jsx";
import { BookingForm } from "./BookingForm.jsx";
import { BookingDetail } from "./BookingDetail.jsx";
import { Reports } from "./Reports.jsx";
import { Management, Profile } from "./Management.jsx";
function Workspace({ initial, view, id }) {
  let [state, setState] = useState(initial),
    [menuOpen, setMenuOpen] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [reversed, setReversed] = useState(false),
    [statusFilter, setStatusFilter] = useState(""),
    [refreshError, setRefreshError] = useState("");
  async function refreshState() {
    let S = await fetch("/api/state", {
      cache: "no-store",
    });
    if (!S.ok) throw Error("โหลดข้อมูลล่าสุดไม่ได้");
    let B = await S.json();
    if (!B.user) {
      location.assign("/?roles=1");
      return;
    }
    setState(B);
    setRefreshError("");
  }
  useEffect(() => {
    let S = () => {
        document.visibilityState === "visible" &&
          refreshState().catch(() =>
            setRefreshError("โหลดข้อมูลล่าสุดไม่ได้ กำลังลองอีกครั้ง"),
          );
      },
      B = setInterval(S, 3500);
    window.addEventListener("focus", S);
    return () => {
      clearInterval(B);
      window.removeEventListener("focus", S);
    };
  }, []);
  async function submitAction(S, B = {}) {
    let $e = await postAction(S, B);
    await refreshState();
    return $e;
  }
  let role = state.user.role,
    canManage = ["admin", "community"].includes(role),
    isSeller = role === "seller",
    navigation = [
      ["home", "ภาพรวม", LayoutDashboard],
      ...(isSeller ? [["new", "จองขายวัสดุ", Plus]] : []),
      ["rounds", "รอบรับซื้อ", CalendarDays],
      ["bookings", isSeller ? "รายการของฉัน" : "รายการขาย", ClipboardList],
      ["materials", "ราคาและวิธีคัดแยก", Leaf],
      ["reports", "รายงาน", ChartColumn],
      ...(isSeller ? [] : [["fees", "ค่าบริการ", Receipt]]),
      ...(canManage ? [["manage", "จัดการข้อมูล", Settings]] : []),
      ["disputes", "ข้อพิพาท", TriangleAlert],
      ["notices", "แจ้งเตือน", Bell],
      ["profile", "ข้อมูลส่วนตัว", UserRound],
      ["help", "ช่วยเหลือ", CircleQuestionMark],
    ],
    selectedBooking = state.bookings.find((S) => S.id === id),
    selectedRound = state.rounds.find((S) => S.id === id),
    heading = String(
      navigation.find((S) => S[0] === view)?.[1] ||
        {
          booking: "รายละเอียดรายการ",
          round: "รายละเอียดรอบ",
          print: "ใบสรุปการซื้อขาย",
          invoice: "ใบเรียกเก็บค่าบริการ",
          edit: "แก้ไขคำขอขาย",
          create: "สร้างรอบรับซื้อ",
        }[view] ||
        "พื้นที่ของฉัน",
    ),
    showingRounds = view === "rounds",
    records = showingRounds
      ? state.rounds.map((S) => ({
          id: S.id,
          name: S.name,
          info:
            formatDateTime(S.startAt) + " · " + formatWeight(S.grams) + " กก.",
          status: S.status,
        }))
      : state.bookings
          .filter((S) => view !== "disputes" || S.disputes.length)
          .map((S) => ({
            id: S.id,
            name: S.code,
            info: S.sellerName + " · ฿" + formatMoney(S.estimated),
            status: S.status,
          })),
    visibleRecords = records.filter(
      (S) =>
        (!statusFilter || S.status === statusFilter) &&
        (S.name + S.info).toLowerCase().includes(search.toLowerCase()),
    );
  reversed && visibleRecords.reverse();
  let recordList = (
    <section className="panel">
      <div className="tools">
        <input
          aria-label="ค้นหารายการ"
          placeholder="ค้นหารายการ…"
          value={search}
          onChange={(S) => {
            setSearch(S.target.value);
            setPage(0);
          }}
        />
        <select
          aria-label="กรองสถานะ"
          value={statusFilter}
          onChange={(S) => {
            setStatusFilter(S.target.value);
            setPage(0);
          }}
        >
          <option value="">ทุกสถานะ</option>
          {[...new Set(records.map((S) => S.status))].map((S) => (
            <option value={S} key={S}>
              {labels[S]}
            </option>
          ))}
        </select>
        <button className="secondary" onClick={() => setReversed(!reversed)}>
          สลับลำดับ
        </button>
      </div>
      {visibleRecords.slice(page * 10, page * 10 + 10).map((S) => (
        <SiteLink
          prefetch={false}
          className="datarow"
          href={viewUrl(showingRounds ? "round" : "booking", S.id)}
          key={S.id}
        >
          <span>
            <strong>{S.name}</strong>
            <small>{S.info}</small>
          </span>
          <StatusBadge value={S.status} />
        </SiteLink>
      ))}
      {!visibleRecords.length && (
        <EmptyState>ยังไม่มีรายการที่ตรงกับเงื่อนไข</EmptyState>
      )}
      {visibleRecords.length > 10 && (
        <div className="actions">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            ก่อนหน้า
          </button>
          <span>
            {"หน้า "}
            {page + 1}
          </span>
          <button
            disabled={(page + 1) * 10 >= visibleRecords.length}
            onClick={() => setPage(page + 1)}
          >
            ถัดไป
          </button>
        </div>
      )}
    </section>
  );
  return (
    <div className="shell">
      <aside
        id="workspace-menu"
        className={"sidebar " + (menuOpen ? "visible" : "")}
      >
        <BrandLink />
        <nav>
          {navigation.map(([S, B, $e]) => {
            let NavIcon = $e;
            return (
              <SiteLink
                prefetch={false}
                onClick={() => setMenuOpen(false)}
                aria-current={view === S ? "page" : void 0}
                className={view === S ? "active" : ""}
                href={viewUrl(String(S))}
                key={String(S)}
              >
                <NavIcon size={18} />
                {String(B)}
              </SiteLink>
            );
          })}
        </nav>
        <button
          onClick={async () => {
            await postAction("logout");
            location.assign("/?roles=1");
          }}
        >
          <LogOut size={17} />
          ออกจากระบบ
        </button>
      </aside>
      <main className="desk">
        <header className="deskhead">
          <button
            aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนูเพิ่มเติม"}
            aria-expanded={menuOpen}
            aria-controls="workspace-menu"
            className="mobilemenu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={18} />
            {" เมนู"}
          </button>
          <span>
            {labels[role]}
            {" · "}
            {state.user.name}
          </span>
          {state.demo && <span className="soft">ข้อมูลสาธิต</span>}
        </header>
        <h1>{heading}</h1>
        {refreshError && <p role="alert">{refreshError}</p>}
        {view === "home" && (
          <Fragment>
            <Dashboard state={state} />
            <div className="metrics">
              <div className="metric">
                รอบรับซื้อ<b>{state.rounds.length}</b>
              </div>
              <div className="metric">
                รายการขาย<b>{state.bookings.length}</b>
              </div>
              <div className="metric">
                {isSeller ? "ยอดรับเงินจริง" : "รายการที่จบแล้ว"}
                <b>
                  {isSeller
                    ? "฿" +
                      formatMoney(
                        state.bookings.reduce(
                          (S, B) => S + (B.receipt ? B.payment.amount : 0),
                          0,
                        ),
                      )
                    : state.bookings.filter((S) => S.receipt).length}
                </b>
              </div>
            </div>
            <h2>รายการล่าสุด</h2>
            {recordList}
          </Fragment>
        )}
        {["bookings", "disputes", "rounds"].includes(view) && (
          <Fragment>
            {showingRounds && canManage && (
              <SiteLink
                prefetch={false}
                className="primary"
                href={viewUrl("create")}
              >
                สร้างรอบรับซื้อ
              </SiteLink>
            )}
            {recordList}
            <a download={true} className="secondary" href="/api/export">
              ดาวน์โหลด CSV
            </a>
          </Fragment>
        )}
        {view === "create" && canManage && (
          <section className="panel">
            <RoundForm s={state} post={submitAction} />
          </section>
        )}
        {view === "round" && (
          <RoundDetail s={state} r={selectedRound} post={submitAction} />
        )}
        {["new", "edit"].includes(view) && (
          <BookingForm
            s={state}
            post={submitAction}
            old={view === "edit" ? selectedBooking : void 0}
            initialRound={id}
          />
        )}
        {["booking", "print"].includes(view) && (
          <BookingDetail
            s={state}
            b={selectedBooking}
            post={submitAction}
            print={view === "print"}
          />
        )}
        {["reports", "fees", "invoice"].includes(view) && (
          <Reports
            s={state}
            post={submitAction}
            fees={view === "fees"}
            documentId={view === "invoice" ? id : 0}
          />
        )}
        {view === "materials" && (
          <Fragment>
            <p>
              ราคาอ้างอิง{state.demo ? "สำหรับสาธิต" : ""}
              {" · "}
              {
                state.communities.find((S) => S.id === state.user.communityId)
                  ?.guide
              }
            </p>
            <MaterialCards s={state} />
          </Fragment>
        )}
        {view === "profile" && <Profile s={state} post={submitAction} />}
        {view === "manage" && <Management s={state} post={submitAction} />}
        {view === "notices" && (
          <section className="panel">
            {state.notices.length ? (
              state.notices.map((S) => (
                <div className="datarow" key={S.id}>
                  {S.message}
                  <small>
                    {formatDateTime(S.at)}
                    {" · "}
                    {S.seen ? "อ่านแล้ว" : "ใหม่"}
                  </small>
                </div>
              ))
            ) : (
              <EmptyState>ยังไม่มีการแจ้งเตือน</EmptyState>
            )}
            {state.notices.some((S) => !S.seen) && (
              <ActionForm
                label="ทำเครื่องหมายว่าอ่านทั้งหมด"
                submit={() => submitAction("read")}
              />
            )}
          </section>
        )}
        {view === "help" && (
          <section className="panel">
            <h2>วิธีใช้งาน</h2>
            <p>
              ลูกบ้านเลือกวัสดุและจองรอบ ร้านตอบรับงานและผู้ดูแลยืนยันนัด
              เมื่อถึงจุดรับให้แสดงรหัสนัด ตรวจผลชั่ง และยืนยันเมื่อได้รับเงินจริง
            </p>
            <SiteLink prefetch={false} className="under" href="/#help">
              อ่านคำถามที่พบบ่อย
            </SiteLink>
          </section>
        )}
      </main>
      <nav className="bottomnav" aria-label="ทางลัดบนมือถือ">
        {navigation
          .filter(([S]) =>
            [
              "home",
              isSeller ? "new" : "rounds",
              "bookings",
              "profile",
            ].includes(String(S)),
          )
          .map(([S, B, $e]) => {
            let NavIcon = $e;
            return (
              <SiteLink
                prefetch={false}
                href={viewUrl(String(S))}
                aria-current={view === S ? "page" : void 0}
                onClick={() => setMenuOpen(false)}
                key={String(S)}
              >
                <NavIcon size={21} />
                <span>
                  {S === "home"
                    ? "หน้าหลัก"
                    : S === "profile"
                      ? "บัญชี"
                      : String(B)}
                </span>
              </SiteLink>
            );
          })}
      </nav>
    </div>
  );
}
export { Workspace };
