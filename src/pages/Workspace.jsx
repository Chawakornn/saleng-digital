import { Fragment, useEffect, useRef, useState } from "react";
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
  ChevronRight,
  Wallet,
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
  X,
} from "lucide-react";
import { SiteLink } from "../ui/Link.jsx";
import { Dashboard } from "./Dashboard.jsx";
import { RoundDetail, RoundForm } from "./Rounds.jsx";
import { BookingForm } from "./BookingForm.jsx";
import { BookingDetail } from "./BookingDetail.jsx";
import { Reports } from "./Reports.jsx";
import { Management, Profile } from "./Management.jsx";
function Workspace({ initial, view: firstView, id: firstId }) {
  const [{ view, id }, setRoute] = useState({ view: firstView, id: firstId });
  const drawer = useRef(null);
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const pageHeading = useRef(null);
  let [state, setState] = useState(initial),
    [menuOpen, setMenuOpen] = useState(false),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(0),
    [reversed, setReversed] = useState(false),
    [statusFilter, setStatusFilter] = useState(""),
    [refreshError, setRefreshError] = useState("");
  const version = useRef(initial.version);
  const latestRequest = useRef(0);
  function readRoute() {
    const params = new URLSearchParams(location.search);
    drawer.current?.close();
    setSearch("");
    setStatusFilter("");
    setPage(0);
    setReversed(false);
    setRoute({
      view: params.get("view") || "home",
      id: Number(params.get("id")) || 0,
    });
  }
  useEffect(() => {
    window.addEventListener("popstate", readRoute);
    const desktop = matchMedia("(min-width:821px)");
    const resize = () => {
      if (desktop.matches) drawer.current?.close();
    };
    desktop.addEventListener("change", resize);
    return () => {
      window.removeEventListener("popstate", readRoute);
      desktop.removeEventListener("change", resize);
    };
  }, []);
  function followView(event) {
    const link = event.target.closest("a[href]");
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target ||
      link.hasAttribute("download")
    )
      return;
    const url = new URL(link.href);
    if (
      url.origin !== location.origin ||
      url.pathname !== "/" ||
      !url.searchParams.has("view")
    )
      return;
    event.preventDefault();
    if (url.href !== location.href) history.pushState(null, "", url);
    readRoute();
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() =>
      pageHeading.current?.focus({ preventScroll: true }),
    );
  }
  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    setLogoutError("");
    try {
      await postAction("logout");
      location.replace("/");
    } catch {
      setLogoutError("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
      setSigningOut(false);
    }
  }
  async function refreshState() {
    const sequence = ++latestRequest.current;
    const response = await fetch(
      "/api/state?since=" + encodeURIComponent(version.current),
      { cache: "no-store" },
    );
    if (!response.ok) throw Error("โหลดข้อมูลล่าสุดไม่ได้");
    const result = await response.json();
    if (sequence !== latestRequest.current) return;
    if (result.unchanged) {
      setState((previous) => ({ ...previous, serverTime: result.serverTime }));
    } else if (!result.user) {
      location.replace("/");
      return;
    } else {
      version.current = result.version;
      setState(result);
    }
    setRefreshError("");
  }
  useEffect(() => {
    let stopped = false,
      timer,
      running = false;
    async function poll() {
      clearTimeout(timer);
      if (stopped || running) return;
      running = true;
      try {
        if (document.visibilityState === "visible") await refreshState();
      } catch {
        if (!stopped) setRefreshError("ยังซิงก์ไม่ได้ กำลังแสดงข้อมูลล่าสุดที่โหลดไว้");
      } finally {
        running = false;
        if (!stopped) timer = setTimeout(poll, 3500);
      }
    }
    timer = setTimeout(poll, 3500);
    window.addEventListener("focus", poll);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("focus", poll);
      document.removeEventListener("visibilitychange", poll);
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
  const logoutControl = (
    <div className="logout-control">
      <button type="button" disabled={signingOut} onClick={logout}>
        <LogOut size={17} />
        {signingOut ? "กำลังออกจากระบบ…" : "ออกจากระบบ"}
      </button>
      {logoutError && <p role="alert">{logoutError}</p>}
    </div>
  );
  const menuLinks = (
    <nav>
      {navigation.map(([S, B, $e]) => {
        let NavIcon = $e;
        return (
          <SiteLink
            prefetch={false}
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
  );
  return (
    <div className="shell" onClick={followView}>
      <aside className="sidebar">
        <BrandLink />
        {menuLinks}
        {logoutControl}
      </aside>
      <dialog
        ref={drawer}
        id="workspace-menu"
        className="menu-drawer"
        aria-label="เมนูหลัก"
        onClose={() => setMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) drawer.current.close();
        }}
      >
        <div className="drawer-content">
          <header>
            <BrandLink />
            <button
              className="drawer-close"
              aria-label="ปิดเมนู"
              onClick={() => drawer.current.close()}
            >
              <X size={21} />
            </button>
          </header>
          {menuLinks}
          {logoutControl}
        </div>
      </dialog>
      <main className="desk" key={view + "-" + id}>
        <header className="deskhead">
          <button
            aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนูเพิ่มเติม"}
            aria-expanded={menuOpen}
            aria-controls="workspace-menu"
            className="mobilemenu"
            onClick={() => {
              drawer.current.showModal();
              setMenuOpen(true);
            }}
          >
            <Menu size={18} />
          </button>
          <strong className="mobile-brand">Trash 2 cash</strong>
          <span className="desk-user">
            {labels[role]}
            {" · "}
            {state.user.name}
          </span>
          <span className={"sync-status" + (refreshError ? " stale" : "")}>
            <i />
            {refreshError ? "รอเชื่อมต่อ" : "ซิงก์อัตโนมัติ"}
          </span>
        </header>
        <h1 ref={pageHeading} tabIndex={-1}>
          {heading}
        </h1>
        {refreshError && <p role="alert">{refreshError}</p>}
        {view === "home" && (
          <Fragment>
            <Dashboard state={state} />
            <nav className="home-shortcuts" aria-label="ทางลัดภาพรวม">
              <SiteLink href={viewUrl("rounds")}>
                <CalendarDays size={20} aria-hidden="true" />
                <span>รอบรับซื้อ<strong>{state.rounds.length}</strong></span>
              </SiteLink>
              <SiteLink href={viewUrl("reports")}>
                <Wallet size={20} aria-hidden="true" />
                <span>{isSeller ? "ยอดรับเงินจริง" : "รายการที่จบแล้ว"}
                  <strong>{isSeller
                    ? "฿" + formatMoney(state.bookings.reduce((sum, booking) =>
                        sum + (booking.receipt ? booking.payment.amount : 0), 0))
                    : state.bookings.filter((booking) => booking.receipt).length}</strong>
                </span>
              </SiteLink>
              <SiteLink className="price-shortcut" href={viewUrl("materials")}>
                <Leaf size={20} aria-hidden="true" />
                <span>เช็กราคาและคำนวณยอดขาย</span>
                <ChevronRight size={17} aria-hidden="true" />
              </SiteLink>
            </nav>
            <section className="home-history">
              <header>
                <h2>รายการขายล่าสุด</h2>
                {state.bookings.length > 0 && (
                  <SiteLink href={viewUrl("bookings")}>ดูทั้งหมด ({state.bookings.length}) <ChevronRight size={15} /></SiteLink>
                )}
              </header>
              {state.bookings.length ? state.bookings.slice(0, 3).map((booking) => (
                <SiteLink className="home-record" href={viewUrl("booking", booking.id)} key={booking.id}>
                  <span><strong>{booking.code}</strong>
                    <small>{isSeller ? (booking.receipt ? "รับเงินแล้ว" : "ยอดประมาณ") : booking.sellerName}
                      {" · ฿"}{formatMoney(booking.receipt ? booking.payment.amount : booking.estimated)}</small>
                  </span>
                  <StatusBadge value={booking.status} />
                  <ChevronRight size={16} aria-hidden="true" />
                </SiteLink>
              )) : (
                <div className="history-empty">
                  <ClipboardList size={24} aria-hidden="true" />
                  <p>ยังไม่มีรายการขาย<small>เมื่อมีการจองครั้งแรก ติดตามสถานะได้ที่นี่</small></p>
                </div>
              )}
            </section>
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
              แตะวัสดุเพื่อคำนวณยอดขายโดยประมาณและดูวิธีคัดแยก{state.demo ? " (ราคาสาธิต)" : ""}{" "}
              {
                state.communities.find((S) => S.id === state.user.communityId)
                  ?.guide
              }
            </p>
            {state.materials.length ? (
              <MaterialCards s={state} estimate />
            ) : (
              <EmptyState>ชุมชนยังไม่ได้เพิ่มวัสดุและราคาอ้างอิง</EmptyState>
            )}
          </Fragment>
        )}
        {view === "profile" && (
          <Profile
            s={state}
            post={submitAction}
            logoutControl={logoutControl}
          />
        )}
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
            <h3>บัญชีและการซิงก์</h3>
            <p>
              เข้าสู่ระบบด้วยชื่อผู้ใช้เดิมบนมือถือหรือคอมเพื่อเปิดรายการของคุณ
              หน้าที่เปิดอยู่ตรวจข้อมูลใหม่ทุกประมาณ 3.5 วินาทีเมื่อเชื่อมต่ออินเทอร์เน็ต
            </p>
            <h3>รอบรับซื้อและการจอง</h3>
            <p>
              ลูกบ้านเลือกวัสดุและจองรอบ ร้านตอบรับงานและผู้ดูแลยืนยันนัด
              เมื่อถึงจุดรับให้แสดงรหัสนัด ตรวจผลชั่ง และยืนยันเมื่อได้รับเงินจริง
            </p>
            <h3>ตั้งค่าชุมชน</h3>
            <p>
              ผู้ดูแลระบบเปิดเมนูจัดการข้อมูลเพื่อเพิ่มจุดรวมวัสดุ ตั้งราคา และกำหนดสิทธิ์สมาชิก
              จากนั้นผู้ดูแลชุมชนเปิดรอบพร้อมระบุวัน เวลา และความจุ ร้านรับซื้อยื่นคำขอได้ในหน้าบัญชี
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
                key={String(S)}
              >
                <NavIcon size={21} />
                <span>
                  {S === "home"
                    ? "หน้าหลัก"
                    : S === "profile"
                      ? "บัญชี"
                      : S === "bookings"
                        ? "รายการขาย"
                        : S === "new"
                          ? "จองขาย"
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
