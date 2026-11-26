
import { useEffect, useState } from "react";

const branches = ["حلب", "دمشق", "إدلب"];

function normalizeSale(item) {
  return {
    ...item,
    employeeId: item.employeeId ?? item.employee_id ?? "",
    employeeName: item.employeeName ?? item.employee_name ?? "",
    productType: item.productType ?? item.product_type ?? "",
    saleDate: String(item.saleDate ?? item.sale_date ?? "").slice(0, 10),
    saleStatus: item.saleStatus ?? item.sale_status ?? "",
    paymentStatus: item.paymentStatus ?? item.payment_status ?? ""
  };
}

function Reports({ branch = "", token }) {
  const [sales, setSales] = useState([]);
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadReports() {
      setLoading(true);
      setError("");
      setSales([]);

      if (!token) {
        setError("يرجى تسجيل الدخول لعرض التقارير");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/sales", {
          headers: {
            Authorization: `Bearer ${token}`
          },
          signal: controller.signal
        });

        const data = await response.json();

        if (!response.ok || data.success === false) {
          throw new Error(
            data.message || "تعذّر تحميل التقارير"
          );
        }

        if (!Array.isArray(data.sales)) {
          throw new Error("استجابة المبيعات غير متوقعة");
        }

        setSales(data.sales.map(normalizeSale));
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err.message || "حدث خطأ أثناء تحميل التقارير"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => controller.abort();
  }, [token]);

  // Filter by branch and month
  const filteredSales = sales.filter(
    (sale) =>
      (!branch || sale.branch === branch) &&
      (!month || sale.saleDate.startsWith(month))
  );

  const confirmedSales = filteredSales.filter(
    (sale) => sale.saleStatus === "تم البيع"
  );

  const totalSales = filteredSales.length;

  const negotiating = filteredSales.filter(
    (sale) => sale.saleStatus === "قيد التفاوض"
  ).length;

  const cancelled = filteredSales.filter(
    (sale) => sale.saleStatus === "ملغي"
  ).length;

  const fullyPaid = confirmedSales.filter(
    (sale) =>
      sale.paymentStatus === "تم دفع المبلغ كامل"
  ).length;

  const notFullyPaid = confirmedSales.filter(
    (sale) =>
      sale.paymentStatus !== "تم دفع المبلغ كامل"
  ).length;

  const totalPieces = confirmedSales.reduce(
    (sum, sale) =>
      sum + Number(sale.quantity || 0),
    0
  );

  // Branch statistics
  const branchStats = branches
    .filter((item) => !branch || item === branch)
    .map((item) => {
      const branchSales = filteredSales.filter(
        (sale) => sale.branch === item
      );

      return {
        name: item,
        total: branchSales.length,
        confirmed: branchSales.filter(
          (sale) => sale.saleStatus === "تم البيع"
        ).length,
        negotiating: branchSales.filter(
          (sale) => sale.saleStatus === "قيد التفاوض"
        ).length,
        cancelled: branchSales.filter(
          (sale) => sale.saleStatus === "ملغي"
        ).length
      };
    });

  // Employee statistics from permitted sales
  const employeeMap = new Map();

  filteredSales.forEach((sale) => {
    const id = String(sale.employeeId);
    const key = `${sale.branch}:${id}`;

    if (!employeeMap.has(key)) {
      employeeMap.set(key, {
        id: key,
        name: sale.employeeName || `موظف #${id}`,
        branch: sale.branch,
        total: 0,
        confirmed: 0
      });
    }

    const item = employeeMap.get(key);

    item.total += 1;

    if (sale.saleStatus === "تم البيع") {
      item.confirmed += 1;
    }
  });

  const employeeStats = [...employeeMap.values()]
    .sort((a, b) => b.confirmed - a.confirmed);

  // Product statistics
  const productCounts = {};

  confirmedSales.forEach((sale) => {
    const type = sale.productType || "غير محدد";

    productCounts[type] =
      (productCounts[type] || 0) +
      Number(sale.quantity || 0);
  });

  const productStats = Object.entries(productCounts)
    .map(([name, count]) => ({
      name,
      count
    }))
    .sort((a, b) => b.count - a.count);

  const maxProductCount = Math.max(
    1,
    ...productStats.map((item) => item.count)
  );

  return (
    <div>
      {/* Report filters */}
      <section className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
            flexWrap: "wrap"
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 8px" }}>
              تقارير المبيعات
            </h3>

            <p
              style={{
                margin: 0,
                color: "#64748b"
              }}
            >
              إحصائيات الفروع والموظفين والمنتجات
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap"
            }}
          >
            <label
              htmlFor="report-month"
              style={{ fontWeight: "600" }}
            >
              الشهر
            </label>

            <input
              id="report-month"
              type="month"
              value={month}
              onChange={(event) =>
                setMonth(event.target.value)
              }
              style={{
                padding: "10px",
                border: "1px solid #dbe2eb",
                borderRadius: "8px",
                background: "#ffffff",
                minHeight: "42px",
                width: "180px",
                boxSizing: "border-box"
              }}
            />

            <button
              type="button"
              className="crm-btn secondary"
              onClick={() => setMonth("")}
            >
              جميع الأشهر
            </button>
          </div>
        </div>
      </section>

      {/* Loading and errors */}
      {loading && (
        <section className="card">
          <p>جارٍ تحميل التقارير...</p>
        </section>
      )}

      {error && (
        <section className="card">
          <p
            role="alert"
            style={{ color: "#b91c1c" }}
          >
            {error}
          </p>
        </section>
      )}

      {!loading && !error && (
        <>
          {/* Summary cards */}
          <div className="stats">
            <div className="card stat">
              <small>إجمالي سجلات المبيعات</small>
              <strong>{totalSales}</strong>
            </div>

            <div className="card stat">
              <small>عمليات البيع المكتملة</small>
              <strong>{confirmedSales.length}</strong>
            </div>

            <div className="card stat">
              <small>قيد التفاوض</small>
              <strong>{negotiating}</strong>
            </div>

            <div className="card stat">
              <small>العمليات الملغية</small>
              <strong>{cancelled}</strong>
            </div>

            <div className="card stat">
              <small>القطع المباعة</small>
              <strong>{totalPieces}</strong>
            </div>
          </div>

          {/* Branch reports */}
          <section className="card">
            <h3>مقارنة مبيعات الفروع</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الفرع</th>
                    <th>إجمالي العمليات</th>
                    <th>تم البيع</th>
                    <th>قيد التفاوض</th>
                    <th>ملغي</th>
                  </tr>
                </thead>

                <tbody>
                  {branchStats.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.total}</td>
                      <td>{item.confirmed}</td>
                      <td>{item.negotiating}</td>
                      <td>{item.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Employee reports */}
          <section className="card">
            <h3>أداء الموظفين</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>الموظف</th>
                    <th>الفرع</th>
                    <th>إجمالي العمليات</th>
                    <th>تم البيع</th>
                  </tr>
                </thead>

                <tbody>
                  {employeeStats.length === 0 ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="empty"
                      >
                        لا توجد عمليات مسجلة للموظفين
                        ضمن الفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    employeeStats.map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td>{item.branch}</td>
                        <td>{item.total}</td>
                        <td>{item.confirmed}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Product reports */}
          <section className="card">
            <h3>أكثر أنواع الأثاث مبيعاً</h3>

            {productStats.length === 0 ? (
              <p className="empty">
                لا توجد مبيعات مكتملة ضمن الفترة المحددة
              </p>
            ) : (
              productStats.map((item) => (
                <div
                  className="crm-chart-row"
                  key={item.name}
                >
                  <span>{item.name}</span>

                  <div className="crm-chart-track">
                    <div
                      className="crm-chart-fill"
                      style={{
                        width: `${
                          (item.count / maxProductCount) * 100
                        }%`
                      }}
                    />
                  </div>

                  <strong>{item.count}</strong>
                </div>
              ))
            )}
          </section>

          {/* Payment status */}
          <section className="card">
            <h3>حالة الدفع للمبيعات المكتملة</h3>

            <div className="stats">
              <div className="card stat">
                <small>تم دفع المبلغ كامل</small>
                <strong>{fullyPaid}</strong>
              </div>

              <div className="card stat">
                <small>لم يتم دفع المبلغ كامل</small>
                <strong>{notFullyPaid}</strong>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default Reports;
