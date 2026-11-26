
import { useCallback, useEffect, useState } from "react";

const branches = ["حلب", "دمشق", "إدلب"];

const productTypes = [
  "غرفة نوم",
  "غرفة جلوس",
  "غرفة سفرة",
  "كنب",
  "طاولة",
  "كرسي",
  "خزانة",
  "مفروشات أخرى"
];

const saleStatuses = [
  "قيد التفاوض",
  "تم البيع",
  "ملغي"
];

const paymentStatuses = [
  "تم دفع المبلغ كامل",
  "لم يتم دفع المبلغ كامل"
];

function listFromResponse(data, key) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.[key]) ? data[key] : [];
}

function normalizeSale(item) {
  return {
    ...item,
    customerId: item.customerId ?? item.customer_id ?? "",
    employeeId: item.employeeId ?? item.employee_id ?? "",
    productType: item.productType ?? item.product_type ?? "",
    modelName: item.modelName ?? item.model_name ?? "",
    saleDate: String(item.saleDate ?? item.sale_date ?? "").slice(0, 10),
    saleStatus: item.saleStatus ?? item.sale_status ?? "تم البيع",
    paymentStatus: item.paymentStatus ?? item.payment_status ?? "لم يتم دفع المبلغ كامل",
    customerName: item.customerName ?? item.customer_name ?? "",
    employeeName: item.employeeName ?? item.employee_name ?? ""
  };
}

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function emptyForm() {
  return {
    customerId: "",
    branch: "",
    employeeId: "",
    productType: "",
    modelName: "",
    quantity: 1,
    saleDate: getToday(),
    saleStatus: "تم البيع",
    paymentStatus: "لم يتم دفع المبلغ كامل",
    notes: ""
  };
}

function Sales({ branch = "", token }) {
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(data.message || `فشل الطلب (${response.status})`);
    }
    return data;
  }, [token]);

  const loadSales = useCallback(async () => {
    const data = await request("/api/sales");
    setSales(listFromResponse(data, "sales").map(normalizeSale));
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [salesData, customersData, meData] = await Promise.all([
          request("/api/sales"),
          request("/api/customers"),
          request("/api/me")
        ]);
        if (cancelled) return;
        setSales(listFromResponse(salesData, "sales").map(normalizeSale));
        setCustomers(listFromResponse(customersData, "customers"));
        setCurrentUser(meData.user || null);
        try {
          const employeesData = await request("/api/employees");
          if (!cancelled) setEmployees(listFromResponse(employeesData, "employees"));
        } catch {
          // Some roles may not have permission to list all employees.
          if (!cancelled) setEmployees([]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (token) load();
    else {
      setLoading(false);
      setError("يرجى تسجيل الدخول مجدداً");
    }
    return () => { cancelled = true; };
  }, [token, request]);

  const staffRole = ["sales", "followup"].includes(currentUser?.role);
  const userBranch = currentUser?.role === "admin" ? "" : (currentUser?.branch || "");
  const fixedBranch = userBranch || branch;

  const getCustomer = (id) =>
    customers.find((item) => String(item.id) === String(id));

  const getEmployee = (id) =>
    employees.find((item) => String(item.id) === String(id));

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const availableCustomers = customers.filter((customer) =>
    (!form.branch || customer.branch === form.branch) &&
    (!staffRole || String(customer.employeeId ?? customer.employee_id) === String(currentUser?.employee_id))
  );

  const availableEmployees = employees.filter((employee) =>
    (!form.branch || employee.branch === form.branch) &&
    (employee.status === "نشط" || Number(employee.is_active) === 1) &&
    (!staffRole || String(employee.id) === String(currentUser?.employee_id))
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...emptyForm(),
      branch: fixedBranch || "",
      employeeId: staffRole ? (currentUser?.employee_id || "") : ""
    });
    setShowModal(true);
  };

  const openEdit = (sale) => {
    setEditingId(sale.id);
    setForm({
      customerId: sale.customerId || "",
      branch: sale.branch || "",
      employeeId: sale.employeeId || "",
      productType: sale.productType || "",
      modelName: sale.modelName || "",
      quantity: sale.quantity || 1,
      saleDate: sale.saleDate || getToday(),
      saleStatus: sale.saleStatus || "تم البيع",
      paymentStatus: sale.paymentStatus || "لم يتم دفع المبلغ كامل",
      notes: sale.notes || ""
    });
    setShowModal(true);
  };

  const saveSale = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.customerId || !form.branch || !form.employeeId ||
        !form.productType || !form.modelName.trim() || !form.saleDate) {
      alert("يرجى تعبئة جميع الحقول المطلوبة");
      return;
    }
    const selectedCustomer = getCustomer(form.customerId);
    if (!selectedCustomer || selectedCustomer.branch !== form.branch) {
      alert("يرجى اختيار عميل من نفس الفرع");
      return;
    }
    const selectedEmployee = getEmployee(form.employeeId);
    if (selectedEmployee && selectedEmployee.branch !== form.branch) {
      alert("يرجى اختيار موظف من نفس الفرع");
      return;
    }
    const quantity = Number(form.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      alert("الكمية يجب أن تكون عدداً صحيحاً أكبر من صفر");
      return;
    }
    const payload = {
      customerId: Number(form.customerId),
      branch: form.branch,
      employeeId: Number(form.employeeId),
      productType: form.productType,
      modelName: form.modelName.trim(),
      quantity,
      saleDate: form.saleDate,
      saleStatus: form.saleStatus,
      paymentStatus: form.paymentStatus,
      notes: form.notes
    };
    setSaving(true);
    try {
      await request(editingId !== null ? `/api/sales/${editingId}` : "/api/sales", {
        method: editingId !== null ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
      await loadSales();
      setShowModal(false);
      setEditingId(null);
      setError("");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSale = async (id) => {
    if (!window.confirm("هل أنت متأكدة من حذف عملية البيع؟")) return;
    try {
      await request(`/api/sales/${id}`, { method: "DELETE" });
      await loadSales();
      setError("");
    } catch (err) {
      alert(err.message);
    }
  };

  const visibleSales = sales.filter((sale) => !branch || sale.branch === branch);
  const filteredSales = visibleSales.filter((sale) => {
    if (paymentFilter !== "all" && sale.paymentStatus !== paymentFilter) return false;
    const customerName = sale.customerName || getCustomer(sale.customerId)?.name || "";
    const employeeName = sale.employeeName || getEmployee(sale.employeeId)?.name || "";
    const query = search.trim().toLowerCase();
    return [customerName, employeeName, sale.branch, sale.productType,
      sale.modelName, sale.saleStatus].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );
  });

  const completedPayments = visibleSales.filter(
    (sale) => sale.paymentStatus === "تم دفع المبلغ كامل"
  ).length;
  const incompletePayments = visibleSales.length - completedPayments;

  return (
    <div>
      {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
      {loading && <p>جاري تحميل المبيعات...</p>}
      {/* Statistics */}
      <div className="stats">
        <div className="card stat">
          <small>إجمالي عمليات البيع</small>
          <strong>{visibleSales.length}</strong>
        </div>

        <div className="card stat">
          <small>تم دفع المبلغ كامل</small>
          <strong>{completedPayments}</strong>
        </div>

        <div className="card stat">
          <small>الدفع غير مكتمل</small>
          <strong>{incompletePayments}</strong>
        </div>
      </div>

      {/* Sales table */}
      <section className="card">
        <div className="customers-toolbar">
          <input
            type="search"
            placeholder="ابحث عن عميل أو موديل أو موظف..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <select
            value={paymentFilter}
            onChange={(event) =>
              setPaymentFilter(event.target.value)
            }
          >
            <option value="all">جميع حالات الدفع</option>
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="crm-btn"
            onClick={openAdd}
            disabled={loading || !!error}
          >
            + إضافة عملية بيع
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>العميل</th>
                <th>الفرع</th>
                <th>الموظف</th>
                <th>نوع الأثاث</th>
                <th>اسم الموديل</th>
                <th>الكمية</th>
                <th>تاريخ البيع</th>
                <th>حالة البيع</th>
                <th>حالة الدفع</th>
                <th>الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty">
                    لا توجد عمليات بيع مسجلة
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      {sale.customerName || getCustomer(sale.customerId)?.name ||
                        "عميل غير موجود"}
                    </td>

                    <td>{sale.branch}</td>

                    <td>
                      {sale.employeeName || getEmployee(sale.employeeId)?.name ||
                        "موظف غير موجود"}
                    </td>

                    <td>{sale.productType}</td>
                    <td>{sale.modelName}</td>
                    <td>{sale.quantity}</td>
                    <td>{sale.saleDate}</td>

                    <td>
                      <span className="crm-status">
                        {sale.saleStatus}
                      </span>
                    </td>

                    <td>
                      <span className="crm-status">
                        {sale.paymentStatus}
                      </span>
                    </td>

                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px"
                        }}
                      >
                        <button
                          type="button"
                          className="crm-btn secondary"
                          onClick={() => openEdit(sale)}
                        >
                          تعديل
                        </button>

                        {!staffRole && <button
                          type="button"
                          className="crm-btn danger"
                          onClick={() => deleteSale(sale.id)}
                        >
                          حذف
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="crm-modal-overlay">
          <div className="crm-modal">
            <h2>
              {editingId !== null
                ? "تعديل عملية البيع"
                : "إضافة عملية بيع جديدة"}
            </h2>

            <form onSubmit={saveSale}>
              <div className="crm-form-grid">
                <label>
                  الفرع *
                  <select
                    value={form.branch}
                    onChange={(event) => {
                      setForm((previous) => ({
                        ...previous,
                        branch: event.target.value,
                        customerId: "",
                        employeeId: staffRole ? (currentUser?.employee_id || "") : ""
                      }));
                    }}
                    required
                  >
                    <option value="">اختاري الفرع</option>

                    {(fixedBranch ? [fixedBranch] : branches).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  اسم العميل *
                  <select
                    value={form.customerId}
                    onChange={(event) =>
                      updateField(
                        "customerId",
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">اختاري العميل</option>

                    {availableCustomers.map((customer) => (
                      <option
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  الموظف المسؤول *
                  <select
                    value={form.employeeId}
                    onChange={(event) =>
                      updateField(
                        "employeeId",
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">اختاري الموظف</option>

                    {staffRole && currentUser?.employee_id && !availableEmployees.some(
                      (employee) => String(employee.id) === String(currentUser.employee_id)
                    ) && (
                      <option value={currentUser.employee_id}>
                        {currentUser.full_name || "الموظف الحالي"}
                      </option>
                    )}
                    {availableEmployees.map((employee) => (
                      <option
                        key={employee.id}
                        value={employee.id}
                      >
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  نوع الأثاث *
                  <select
                    value={form.productType}
                    onChange={(event) =>
                      updateField(
                        "productType",
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">اختاري النوع</option>

                    {productTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  اسم الموديل *
                  <input
                    type="text"
                    placeholder="مثلاً اسم غرفة النوم"
                    value={form.modelName}
                    onChange={(event) =>
                      updateField(
                        "modelName",
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                <label>
                  الكمية *
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.quantity}
                    onChange={(event) =>
                      updateField(
                        "quantity",
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                <label>
                  تاريخ البيع *
                  <input
                    type="date"
                    value={form.saleDate}
                    onChange={(event) =>
                      updateField(
                        "saleDate",
                        event.target.value
                      )
                    }
                    required
                  />
                </label>

                <label>
                  حالة البيع *
                  <select
                    value={form.saleStatus}
                    onChange={(event) =>
                      updateField(
                        "saleStatus",
                        event.target.value
                      )
                    }
                  >
                    {saleStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  حالة الدفع *
                  <select
                    value={form.paymentStatus}
                    onChange={(event) =>
                      updateField(
                        "paymentStatus",
                        event.target.value
                      )
                    }
                  >
                    {paymentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="full">
                  ملاحظات
                  <textarea
                    rows="3"
                    placeholder="تفاصيل إضافية..."
                    value={form.notes}
                    onChange={(event) =>
                      updateField(
                        "notes",
                        event.target.value
                      )
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
                  {saving ? "جاري الحفظ..." : "حفظ عملية البيع"}
                </button>

                <button
                  type="button"
                  className="crm-btn secondary"
                  onClick={() => setShowModal(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sales;

