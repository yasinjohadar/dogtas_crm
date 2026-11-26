
import { useState, useEffect } from "react";
import "./App.css";

import Customers from "./Pages/Customers";
import Employees from "./Pages/Employees";
import Followups from "./Pages/Followups";
import Sales from "./Pages/Sales";
import Reports from "./Pages/Reports";
import Login from "./Pages/Login";
import Users from "./Pages/Users";
import Settings from "./Pages/Settings";
import Reviews from "./Pages/Reviews";
import PublicReview from "./Pages/PublicReview";

const menu = [
  { id: "dashboard", icon: "▦", label: "لوحة التحكم" },
  { id: "customers", icon: "♙", label: "العملاء" },
  { id: "employees", icon: "♧", label: "الموظفون" },
  { id: "followups", icon: "◷", label: "المتابعات" },
  { id: "sales", icon: "▣", label: "المبيعات" },
  { id: "reports", icon: "▥", label: "التقارير" },
  { id: "users", icon: "👤", label: "إدارة المستخدمين" },
  { id: "reviews", icon: "⭐", label: "تقييمات الزبائن" },
  { id: "settings", icon: "⚙", label: "الإعدادات" },
];

const branches = ["حلب", "دمشق", "إدلب"];

const statuses = [
  "جديد",
  "مهتم جداً",
  "بحاجة لمتابعة",
  "تم الشراء",
  "خسرنا الزبون",
];

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function App() {
  const [session, setSession] = useState(null);
  const [sessionNotice, setSessionNotice] = useState("");
  useEffect(() => {
  if (!session?.token) return;

  fetch("/api/customer-statuses", {
    headers: {
      Authorization: `Bearer ${session.token}`,
    },
  })
    .then((res) => res.json())
    .then((data) => {
      console.log("Customer statuses:", data);
    })
    .catch((error) => {
      console.error("Statuses error:", error);
    });
}, [session?.token]);
  const [page, setPage] = useState("dashboard");
  const [branch, setBranch] = useState("");

  const [customers, setCustomers] = useState([]);
  const [dashboardLoading, setDashboardLoading] =
    useState(false);
  const [dashboardError, setDashboardError] =
    useState("");

  const handleLogin = (loginData) => {
    setSessionNotice("");
    setSession(loginData);
    setPage("dashboard");
    setBranch("");
    setCustomers([]);
  };

  const handleLogout = () => {
    setSession(null);
    setPage("dashboard");
    setBranch("");
    setCustomers([]);
    setDashboardError("");
  };

  // Verify the session on login, every 15 seconds, and when returning to the tab.
  // A revoked or expired session is rejected by /api/me with HTTP 401.
  useEffect(() => {
    if (!session?.token) return;

    let active = true;
    let checking = false;
    const controller = new AbortController();

    const checkSession = async () => {
      if (!active || checking) return;
      checking = true;
      try {
        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${session.token}` },
          cache: "no-store",
          signal: controller.signal,
        });

        if (active && response.status === 401) {
          setSessionNotice("انتهت جلسة الدخول أو تم تسجيل خروجك من جهاز آخر. يرجى تسجيل الدخول مجدداً.");
          setSession(null);
          setPage("dashboard");
          setBranch("");
          setCustomers([]);
          setDashboardError("");
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          console.warn("Session check unavailable:", error);
        }
      } finally {
        checking = false;
      }
    };

    checkSession();
    const intervalId = setInterval(checkSession, 15000);
    const onFocus = () => checkSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkSession();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      controller.abort();
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [session?.token]);

  // Load dashboard customers from MySQL
  useEffect(() => {
    if (page !== "dashboard" || !session?.token) {
      return;
    }

    const controller = new AbortController();

    const fetchDashboardCustomers = async () => {
      setDashboardLoading(true);
      setDashboardError("");
      setCustomers([]);

      try {
        const response = await fetch(
          "/api/customers",
          {
            headers: {
              Authorization: `Bearer ${session.token}`,
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message ||
              "تعذر تحميل بيانات لوحة التحكم"
          );
        }

        if (!controller.signal.aborted) {
          setCustomers(
            Array.isArray(data.customers)
              ? data.customers
              : []
          );
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error(
            "Dashboard error:",
            error
          );
          setDashboardError(error.message);
          setCustomers([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setDashboardLoading(false);
        }
      }
    };

    fetchDashboardCustomers();

    return () => controller.abort();
  }, [page, session?.token]);

  const currentPage =
    menu.find((item) => item.id === page) ||
    menu[0];

  const visibleCustomers = customers.filter(
    (customer) =>
      !branch || customer.branch === branch
  );

  const today = getToday();

  const dueCustomers = visibleCustomers.filter(
    (customer) =>
      customer.nextDate &&
      customer.nextDate <= today &&
      !["تم الشراء", "خسرنا الزبون"].includes(
        customer.status
      )
  );

  const upcomingCustomers =
    visibleCustomers.filter(
      (customer) =>
        customer.nextDate &&
        customer.nextDate > today &&
        !["تم الشراء", "خسرنا الزبون"].includes(
          customer.status
        )
    );

  const purchasedCustomers =
    visibleCustomers.filter(
      (customer) =>
        customer.status === "تم الشراء"
    );

  const visibleBranches =
    session?.user?.role === "admin"
      ? branches
      : branches.filter(
          (item) =>
            item === session?.user?.branch
        );

  // Public customer review page: no CRM login required
  if (window.location.pathname.startsWith("/review/")) {
    return <PublicReview />;
  }

  if (!session) {
    return (
      <>
        {sessionNotice && (
          <div role="alert" dir="rtl" style={{ padding: "12px 18px", background: "#fff4e5", color: "#7c3f00", textAlign: "center" }}>
            {sessionNotice}
          </div>
        )}
        <Login onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="crm" dir="rtl">
      {/* Sidebar */}
      <aside className="sidebar">
        <div
          style={{
            textAlign: "center",
            padding: "12px 8px 24px",
            marginBottom: "18px",
            borderBottom: "1px solid #D9C9B4",
          }}
        >
          <img
            src="/logor.jpeg"
            alt="Doğtaş Logo"
            style={{
              display: "block",
              width: "110px",
              maxWidth: "100%",
              height: "auto",
              objectFit: "contain",
              borderRadius: "10px",
              margin: "0 auto 12px",
            }}
          />

          <h2
            style={{
              fontSize: "18px",
              color: "#493A2B",
              margin: 0,
            }}
          >
            DOĞTAŞ CRM
          </h2>

          <p
            style={{
              fontSize: "11px",
              color: "#786B5D",
              marginTop: "6px",
            }}
          >
            نظام إدارة العملاء والمبيعات
          </p>
        </div>

        {/* Navigation */}
        <nav>
          {menu
            .filter(
              (item) =>
                item.id !== "users" ||
                session.user?.role === "admin"
            )
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  page === item.id
                    ? "active"
                    : ""
                }
                onClick={() => setPage(item.id)}
              >
                <span className="menu-icon">
                  {item.icon}
                </span>

                <span className="menu-label">
                  {item.label}
                </span>
              </button>
            ))}
        </nav>

        <p className="sidebar-footer">
          Doğtaş Syria • CRM
        </p>
      </aside>

      {/* Main */}
      <main className="main">
        {/* Top bar */}
        <header className="topbar">
          <div>
            <h1>{currentPage.label}</h1>
            <p>
              إدارة الفروع والعملاء والمتابعات
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              {session.user?.full_name ||
                session.user?.username ||
                "مستخدم"}
            </span>

            {/* Branch filter */}
            <select
              value={branch}
              onChange={(event) =>
                setBranch(event.target.value)
              }
            >
              <option value="">
                جميع الفروع
              </option>

              {visibleBranches.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="crm-btn secondary"
              onClick={handleLogout}
            >
              تسجيل الخروج
            </button>
          </div>
        </header>

        {/* Dashboard */}
        {page === "dashboard" ? (
          <>
            {dashboardLoading && (
              <p>جاري تحميل بيانات لوحة التحكم...</p>
            )}

            {dashboardError && (
              <p style={{ color: "crimson" }}>
                {dashboardError}
              </p>
            )}

            {!dashboardLoading &&
              !dashboardError && (
                <>
                  {/* Statistics */}
                  <div className="stats">
                    <div className="card stat">
                      <small>
                        إجمالي العملاء
                      </small>
                      <strong>
                        {visibleCustomers.length}
                      </strong>
                    </div>

                    <div className="card stat">
                      <small>
                        العملاء الذين اشتروا
                      </small>
                      <strong>
                        {purchasedCustomers.length}
                      </strong>
                    </div>

                    <div className="card stat">
                      <small>
                        المتابعات المستحقة
                      </small>
                      <strong>
                        {dueCustomers.length}
                      </strong>
                    </div>

                    <div className="card stat">
                      <small>
                        المتابعات القادمة
                      </small>
                      <strong>
                        {upcomingCustomers.length}
                      </strong>
                    </div>

                    <div className="card stat">
                      <small>
                        العملاء المهتمون جداً
                      </small>
                      <strong>
                        {
                          visibleCustomers.filter(
                            (customer) =>
                              customer.status ===
                              "مهتم جداً"
                          ).length
                        }
                      </strong>
                    </div>
                  </div>

                  <div className="dashboard-grid">
                    {/* Customer statuses */}
                    <section className="card">
                      <h3>حالات العملاء</h3>

                      {statuses.map((status) => {
                        const count =
                          visibleCustomers.filter(
                            (customer) =>
                              customer.status ===
                              status
                          ).length;

                        const percentage =
                          visibleCustomers.length
                            ? (count /
                                visibleCustomers.length) *
                              100
                            : 0;

                        return (
                          <div
                            className="crm-chart-row"
                            key={status}
                          >
                            <span>
                              {status}
                            </span>

                            <div className="crm-chart-track">
                              <div
                                className="crm-chart-fill"
                                style={{
                                  width: `${percentage}%`,
                                }}
                              />
                            </div>

                            <strong>
                              {count}
                            </strong>
                          </div>
                        );
                      })}
                    </section>

                    {/* Due followups */}
                    <section className="card">
                      <h3>
                        المتابعات المستحقة
                      </h3>

                      {dueCustomers.length === 0 ? (
                        <p className="empty">
                          لا توجد متابعات مستحقة
                        </p>
                      ) : (
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>العميل</th>
                                <th>الموعد</th>
                              </tr>
                            </thead>

                            <tbody>
                              {dueCustomers.map(
                                (customer) => (
                                  <tr
                                    key={customer.id}
                                  >
                                    <td>
                                      {customer.name}
                                    </td>
                                    <td>
                                      {customer.nextDate}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </div>

                  {/* Upcoming followups */}
                  <section className="card">
                    <h3>
                      المتابعات القادمة
                    </h3>

                    {upcomingCustomers.length === 0 ? (
                      <p className="empty">
                        لا توجد متابعات قادمة
                      </p>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>العميل</th>
                              <th>الفرع</th>
                              <th>
                                الموعد القادم
                              </th>
                            </tr>
                          </thead>

                          <tbody>
                            {[...upcomingCustomers]
                              .sort((a, b) =>
                                a.nextDate.localeCompare(
                                  b.nextDate
                                )
                              )
                              .map((customer) => (
                                <tr
                                  key={customer.id}
                                >
                                  <td>
                                    {customer.name}
                                  </td>
                                  <td>
                                    {customer.branch}
                                  </td>
                                  <td>
                                    {customer.nextDate}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* Branch comparison */}
                  <section className="card">
                    <h3>مقارنة الفروع</h3>

                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>الفرع</th>
                            <th>العملاء</th>
                            <th>تم الشراء</th>
                            <th>
                              بحاجة لمتابعة
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {visibleBranches
                            .filter(
                              (item) =>
                                !branch ||
                                item === branch
                            )
                            .map((item) => {
                              const branchCustomers =
                                customers.filter(
                                  (customer) =>
                                    customer.branch ===
                                    item
                                );

                              return (
                                <tr key={item}>
                                  <td>{item}</td>

                                  <td>
                                    {
                                      branchCustomers.length
                                    }
                                  </td>

                                  <td>
                                    {
                                      branchCustomers.filter(
                                        (customer) =>
                                          customer.status ===
                                          "تم الشراء"
                                      ).length
                                    }
                                  </td>

                                  <td>
                                    {
                                      branchCustomers.filter(
                                        (customer) =>
                                          customer.status ===
                                          "بحاجة لمتابعة"
                                      ).length
                                    }
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
          </>
        ) : page === "customers" ? (
          <Customers
            branch={branch}
            token={session.token}
          />
        ) : page === "employees" ? (
          <Employees
            branch={branch}
            token={session.token}
          />
        ) : page === "followups" ? (
          <Followups
            branch={branch}
            token={session.token}
          />
        ) : page === "sales" ? (
          <Sales
            branch={branch}
            token={session.token}
          />
        ) : page === "reports" ? (
          <Reports
            branch={branch}
            token={session.token}
          />
        ) : page === "users" &&
          session.user?.role === "admin" ? (
<Users
  token={session.token}
  branch={branch}
/>        ) : page === "reviews" &&
          session.user?.role === "admin" ? (
          <Reviews token={session.token} />
        ) : page === "settings" ? (
          <Settings token={session.token} user={session.user} />
        ) : (
          <section className="card">
            <h3>{currentPage.label}</h3>

            <p className="empty">
              رح نضيف محتوى هالقسم
              بالخطوات الجاية.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
