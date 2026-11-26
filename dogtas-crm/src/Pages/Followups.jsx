
import { useState, useEffect } from "react";

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Followups({ branch = "", token }) {
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [historyCustomerId, setHistoryCustomerId] =
    useState(null);

  const today = getToday();

  useEffect(() => {
    if (!token) {
      setCustomers([]);
      setEmployees([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/customers", {
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store",
          signal: controller.signal
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "تعذر تحميل العملاء"
          );
        }

        setCustomers(
          Array.isArray(data.customers)
            ? data.customers.map((customer) => ({
                ...customer,
                followupHistory: Array.isArray(
                  customer.followupHistory
                )
                  ? customer.followupHistory
                  : []
              }))
            : []
        );

        // Employee names are optional.
        // Customer access is enforced by the backend.
        try {
          const employeeResponse = await fetch(
            "/api/employees",
            {
              headers: {
                Authorization: `Bearer ${token}`
              },
              signal: controller.signal
            }
          );

          if (employeeResponse.ok) {
            const employeeData =
              await employeeResponse.json();

            const list = Array.isArray(employeeData)
              ? employeeData
              : employeeData.employees;

            setEmployees(
              Array.isArray(list) ? list : []
            );
          }
        } catch (employeeError) {
          if (employeeError.name === "AbortError") {
            throw employeeError;
          }
          setEmployees([]);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
          setCustomers([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => controller.abort();
  }, [token]);

  const getEmployeeName = (id) => {
    if (!id) return "غير محدد";

    const employee = employees.find(
      (item) => String(item.id) === String(id)
    );

    return employee?.name ||
      employee?.full_name ||
      `موظف #${id}`;
  };

  const getDateStatus = (customer) => {
    if (
      ["تم الشراء", "خسرنا الزبون"].includes(
        customer.status
      )
    ) {
      return "مغلق";
    }

    if (!customer.nextDate) return "بدون موعد";
    if (customer.nextDate < today) return "متأخرة";
    if (customer.nextDate === today) return "اليوم";
    return "قادمة";
  };

  const filteredCustomers = customers.filter(
    (customer) => {
      if (branch && customer.branch !== branch) {
        return false;
      }

      const query = search.trim().toLowerCase();

      const matchesSearch = [
        customer.name,
        customer.phone,
        customer.product,
        getEmployeeName(customer.employeeId)
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );

      const dateStatus = getDateStatus(customer);

      const matchesFilter =
        filter === "all" ||
        (filter === "due" &&
          ["متأخرة", "اليوم"].includes(dateStatus)) ||
        (filter === "upcoming" &&
          dateStatus === "قادمة") ||
        (filter === "no-date" &&
          dateStatus === "بدون موعد") ||
        (filter === "closed" &&
          dateStatus === "مغلق");

      return matchesSearch && matchesFilter;
    }
  );

  const openFollowup = (customer) => {
    setSelected(customer);
    setResult("");
    setNextDate(customer.nextDate || "");
    setError("");
  };

  const saveFollowup = async (event) => {
    event.preventDefault();

    if (!selected || !result || saving) return;

    const isClosed = [
      "تم الشراء",
      "غير مهتم"
    ].includes(result);

    if (!isClosed && !nextDate) {
      alert("يرجى تحديد موعد المتابعة القادمة");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/customers/${selected.id}/followups`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            result,
            nextDate: isClosed ? "" : nextDate
          })
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "فشل حفظ المتابعة"
        );
      }

      setCustomers((previous) =>
        previous.map((customer) =>
          customer.id === selected.id
            ? {
                ...customer,
                status: data.status,
                nextDate: data.nextDate,
                followupHistory:
                  data.followupHistory
              }
            : customer
        )
      );

      setSelected(null);
      setResult("");
      setNextDate("");
      alert("تم حفظ المتابعة بنجاح");
    } catch (err) {
      setError(err.message);
      alert(`تعذر حفظ المتابعة: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const historyCustomer = customers.find(
    (customer) =>
      String(customer.id) ===
      String(historyCustomerId)
  );

  return (
    <div>
      {error && (
        <p style={{ color: "crimson" }}>
          {error}
        </p>
      )}

      <section className="card">
        <div className="customers-toolbar">
          <input
            type="search"
            placeholder="ابحث باسم العميل أو الهاتف أو الموظف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">
              جميع المتابعات
            </option>
            <option value="due">
              المستحقة والمتأخرة
            </option>
            <option value="upcoming">
              القادمة
            </option>
            <option value="no-date">
              بدون موعد
            </option>
            <option value="closed">
              المغلقة
            </option>
          </select>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>العميل</th>
                <th>الهاتف</th>
                <th>الفرع</th>
                <th>الموظف المسؤول</th>
                <th>المنتج</th>
                <th>الموعد</th>
                <th>حالة المتابعة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="empty">
                    جاري تحميل المتابعات...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty">
                    لا توجد متابعات مطابقة
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.branch}</td>
                    <td>
                      {getEmployeeName(
                        customer.employeeId
                      )}
                    </td>
                    <td>{customer.product}</td>
                    <td>{customer.nextDate || "—"}</td>
                    <td>
                      <span className="crm-status">
                        {getDateStatus(customer)}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap"
                        }}
                      >
                        <button
                          type="button"
                          className="crm-btn"
                          onClick={() =>
                            openFollowup(customer)
                          }
                        >
                          تسجيل متابعة
                        </button>

                        <button
                          type="button"
                          className="crm-btn secondary"
                          onClick={() =>
                            setHistoryCustomerId(
                              customer.id
                            )
                          }
                        >
                          سجل المتابعات
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="crm-modal-overlay">
          <div className="crm-modal">
            <h2>
              تسجيل متابعة: {selected.name}
            </h2>

            <form onSubmit={saveFollowup}>
              <div className="crm-form-grid">
                <label>
                  نتيجة المتابعة *
                  <select
                    value={result}
                    onChange={(e) =>
                      setResult(e.target.value)
                    }
                    required
                  >
                    <option value="">
                      اختاري النتيجة
                    </option>
                    <option value="بحاجة لمتابعة">
                      بحاجة لمتابعة
                    </option>
                    <option value="تم الشراء">
                      تم الشراء
                    </option>
                    <option value="غير مهتم">
                      غير مهتم
                    </option>
                  </select>
                </label>

                <label>
                  موعد المتابعة القادمة
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) =>
                      setNextDate(e.target.value)
                    }
                    disabled={
                      result === "تم الشراء" ||
                      result === "غير مهتم"
                    }
                    required={
                      result === "بحاجة لمتابعة"
                    }
                  />
                </label>
              </div>

              <div className="crm-modal-actions">
                <button
                  type="submit"
                  className="crm-btn"
                  disabled={saving}
                >
                  {saving
                    ? "جاري الحفظ..."
                    : "حفظ المتابعة"}
                </button>

                <button
                  type="button"
                  className="crm-btn secondary"
                  disabled={saving}
                  onClick={() => setSelected(null)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyCustomer && (
        <div className="crm-modal-overlay">
          <div className="crm-modal">
            <h2>
              سجل متابعات: {historyCustomer.name}
            </h2>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>تاريخ التواصل</th>
                    <th>نتيجة المتابعة</th>
                    <th>الموظف المسؤول</th>
                    <th>الموعد التالي</th>
                  </tr>
                </thead>

                <tbody>
                  {!historyCustomer.followupHistory?.length ? (
                    <tr>
                      <td
                        colSpan="4"
                        className="empty"
                      >
                        لا توجد متابعات مسجلة بعد
                      </td>
                    </tr>
                  ) : (
                    [
                      ...historyCustomer.followupHistory
                    ]
                      .reverse()
                      .map((item) => (
                        <tr key={item.id}>
                          <td>
                            {new Date(
                              item.date
                            ).toLocaleString("ar-SY")}
                          </td>
                          <td>{item.result}</td>
                          <td>
                            {getEmployeeName(
                              item.employeeId
                            )}
                          </td>
                          <td>
                            {item.nextDate || "—"}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="crm-modal-actions">
              <button
                type="button"
                className="crm-btn secondary"
                onClick={() =>
                  setHistoryCustomerId(null)
                }
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Followups;
