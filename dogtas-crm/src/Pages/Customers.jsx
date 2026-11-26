import { useCallback, useEffect, useState } from "react";


const products = ["غرفة نوم", "غرفة جلوس", "كنب", "غرفة سفرة", "طاولة", "كرسي", "مفروشات أخرى"];
const branches = ["حلب", "دمشق", "إدلب"];

const emptyCustomer = {
  name: "", phone: "", branch: "حلب", product: "غرفة نوم",
  status: "جديد", employeeId: "", nextDate: "", notes: "",
};

async function readApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("السيرفر لم يُرجع JSON. تأكدي من تشغيل Backend وإعدادات API.");
  }
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || `فشل الطلب (${response.status})`);
  }
  return data;
}

function Customers({ branch = "", token }) {
  const [customers, setCustomers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [statusesError, setStatusesError] = useState("");
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyCustomer);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [userError, setUserError] = useState("");
  const isStaff = ["sales", "followup"].includes(currentUser?.role);
  const isManager = ["admin", "branch_manager"].includes(currentUser?.role);
  const ownBranch = currentUser?.branch || "";
  const ownEmployeeId = currentUser?.employee_id;
  const canEditCustomer = (customer) => {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    if (customer.branch !== ownBranch) return false;
    if (currentUser.role === "branch_manager") return true;
    return isStaff && ownEmployeeId != null &&
      String(customer.employeeId) === String(ownEmployeeId);
  };
  const canDeleteCustomer = (customer) =>
    isManager && (currentUser.role === "admin" || customer.branch === ownBranch);

  useEffect(() => {
    let active = true;
    setCurrentUser(null);
    setUserError("");
    if (!token) return;
    (async () => {
      try {
        const response = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiResponse(response);
        if (!data.user) throw new Error("تعذر تحميل بيانات الحساب");
        if (active) setCurrentUser(data.user);
      } catch (err) {
        if (active) setUserError(err.message || "تعذر تحميل صلاحيات الحساب");
      }
    })();
    return () => { active = false; };
  }, [token]);

  const loadData = useCallback(async () => {
    if (!token) {
      setCustomers([]);
      setEmployees([]);
      setStatuses([]);
      setError("يرجى تسجيل الدخول من جديد");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [customersResponse, employeesResponse, statusesResponse] = await Promise.all([
        fetch("/api/customers", { headers }),
        fetch("/api/employees", { headers }),
        fetch("/api/customer-statuses", { headers, cache: "no-store" }),
      ]);
      const [customerData, employeeData, statusData] = await Promise.all([
        readApiResponse(customersResponse),
        readApiResponse(employeesResponse),
        readApiResponse(statusesResponse),
      ]);
      if (!Array.isArray(customerData.customers) || !Array.isArray(employeeData.employees) || !Array.isArray(statusData.statuses)) {
        throw new Error("بيانات السيرفر غير صحيحة");
      }
      setCustomers(customerData.customers);
      setEmployees(employeeData.employees);
      setStatuses(statusData.statuses);
      setStatusesError("");
    } catch (err) {
      setError(err.message || "تعذر تحميل البيانات");
      setStatusesError("تعذر تحميل حالات العملاء");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const getEmployeeName = (employeeId) => {
    if (employeeId === null || employeeId === undefined || employeeId === "") return "غير محدد";
    const employee = employees.find((item) => String(item.id) === String(employeeId));
    return employee?.name || "موظف غير موجود";
  };

  const filteredCustomers = customers.filter((customer) => {
    if (branch && customer.branch !== branch) return false;
    const query = search.trim().toLowerCase();
    return [customer.name, customer.phone, customer.product, getEmployeeName(customer.employeeId)]
      .some((value) => String(value || "").toLowerCase().includes(query));
  });

  const activeStatuses = statuses.filter((item) => Number(item.is_active) === 1);
  const statusOptions = activeStatuses.map((item) => item.name);
  const currentStatusInactive = editingId !== null && form.status && !statusOptions.includes(form.status);

  const availableEmployees = employees.filter((employee) =>
    employee.status === "نشط" && employee.branch === form.branch
  );

  const openAdd = () => {
  console.log("currentUser:", currentUser);
  console.log("isStaff:", isStaff);
  console.log("ownEmployeeId:", ownEmployeeId);
  console.log("ownBranch:", ownBranch);

  if (!currentUser || (isStaff && !ownEmployeeId)) {
    alert("بيانات حساب الموظف ناقصة. افحصي Console.");
    return;
  }

  if (activeStatuses.length === 0) {
    alert("ما في حالات عملاء نشطة متاحة.");
    return;
  }
  setEditingId(null);

  setForm({
    ...emptyCustomer,
    branch:
      currentUser.role === "admin"
        ? (branches.includes(branch) ? branch : "حلب")
        : ownBranch,
    employeeId: isStaff ? String(ownEmployeeId) : "",
    status: statusOptions.includes(emptyCustomer.status) ? emptyCustomer.status : statusOptions[0],
  });

  setIsOpen(true);
};

  const openEdit = (customer) => {
    if (!canEditCustomer(customer)) return;
    setEditingId(customer.id);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      branch: customer.branch || "حلب",
      product: customer.product || "غرفة نوم",
      status: customer.status || "جديد",
      employeeId: customer.employeeId == null ? "" : String(customer.employeeId),
      nextDate: customer.nextDate ? String(customer.nextDate).slice(0, 10) : "",
      notes: customer.notes || "",
    });
    setIsOpen(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === "branch" && currentUser?.role !== "admin") return;
    if (name === "employeeId" && isStaff) return;
    setForm((previous) => ({
      ...previous,
      [name]: value,
      ...(name === "branch" ? { employeeId: "" } : {}),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || !currentUser) return;
    if (editingId !== null) {
      const existing = customers.find((item) => item.id === editingId);
      if (!existing || !canEditCustomer(existing)) return;
    }
    const previousCustomer = editingId !== null ? customers.find((item) => item.id === editingId) : null;
    if (!statusOptions.includes(form.status) && !(previousCustomer && previousCustomer.status === form.status)) {
      alert("حالة العميل غير متاحة. حدّثي الصفحة واختاري حالة نشطة.");
      return;
    }
    if (!form.name.trim() || !form.phone.trim()) {
      alert("يرجى إدخال اسم العميل ورقم الهاتف");
      return;
    }
    if (!token) { alert("يرجى تسجيل الدخول من جديد"); return; }

    if (isStaff && (
      !ownEmployeeId || form.branch !== ownBranch ||
      String(form.employeeId) !== String(ownEmployeeId)
    )) {
      alert("لا يمكن تغيير الفرع أو الموظف المسؤول");
      return;
    }
    if (form.employeeId !== "") {
      const selectedEmployee = employees.find((item) => String(item.id) === String(form.employeeId));
      if (!selectedEmployee || selectedEmployee.branch !== form.branch || selectedEmployee.status !== "نشط") {
        alert("يرجى اختيار موظف نشط من نفس فرع العميل");
        return;
      }
    }

    setSaving(true);
    try {
      const isEditing = editingId !== null;
      const response = await fetch(isEditing ? `/api/customers/${editingId}` : "/api/customers", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(), phone: form.phone.trim(), branch: form.branch,
          product: form.product, status: form.status,
          employeeId: form.employeeId === "" ? null : Number(form.employeeId),
          nextDate: form.nextDate || "", notes: form.notes || "",
        }),
      });
      await readApiResponse(response);
      setIsOpen(false);
      setEditingId(null);
      setForm(emptyCustomer);
      await loadData();
      alert(isEditing ? "تم تعديل العميل في MySQL بنجاح" : "تمت إضافة العميل إلى MySQL بنجاح");
    } catch (err) {
      alert(`خطأ في الحفظ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteCustomer = async (customer) => {
    if (deletingId !== null || !canDeleteCustomer(customer)) return;
    if (!window.confirm(`هل تريدين حذف العميل «${customer.name}» نهائياً من MySQL؟`)) return;
    setDeletingId(customer.id);
    try {
      const response = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      await readApiResponse(response);
      await loadData();
      alert("تم حذف العميل بنجاح");
    } catch (err) {
      alert(`تعذر حذف العميل: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <section className="card">
        <div className="customers-toolbar">
          <button type="button" className="crm-btn secondary" onClick={loadData} disabled={loading}>
            تحديث العملاء
          </button>
          <input type="search" placeholder="ابحث بالاسم أو الهاتف أو المنتج أو الموظف..."
            value={search} onChange={(event) => setSearch(event.target.value)} />
          <button type="button" className="crm-btn" onClick={openAdd}
            disabled={!token || !currentUser || (isStaff && !ownEmployeeId)}>
            + إضافة عميل
          </button>
        </div>

        {userError && <p role="alert" style={{ color: "#b91c1c" }}>{userError}</p>}
        {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
        {statusesError && !error && <p role="alert" style={{ color: "#b91c1c" }}>{statusesError}</p>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>اسم العميل</th><th>الهاتف</th><th>الفرع</th>
                <th>الموظف المسؤول</th><th>المنتج</th><th>الحالة</th>
                <th>المتابعة القادمة</th><th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="empty">جاري تحميل العملاء...</td></tr>
              ) : error ? (
                <tr><td colSpan="8" className="empty">تعذر تحميل العملاء. اضغطي تحديث العملاء للمحاولة مجدداً.</td></tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan="8" className="empty">لا يوجد عملاء بعد</td></tr>
              ) : filteredCustomers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.phone}</td>
                  <td>{customer.branch}</td>
                  <td>{getEmployeeName(customer.employeeId)}</td>
                  <td>{customer.product}</td>
                  <td><span className="crm-status">{customer.status}</span></td>
                  <td>{customer.nextDate || "—"}</td>
                  <td>
                    {canEditCustomer(customer) && (
                      <button type="button" className="crm-btn secondary" onClick={() => openEdit(customer)}>
                        تعديل
                      </button>
                    )}{" "}
                    {canDeleteCustomer(customer) && (
                      <button type="button" className="crm-btn danger"
                        disabled={deletingId !== null}
                        onClick={() => deleteCustomer(customer)}>
                        {deletingId === customer.id ? "جاري الحذف..." : "حذف"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isOpen && (
        <div className="crm-modal-overlay">
          <div className="crm-modal">
            <h2>{editingId !== null ? "تعديل العميل" : "إضافة عميل جديد"}</h2>
            <form onSubmit={handleSubmit}>
              <div className="crm-form-grid">
                <label>اسم العميل *
                  <input name="name" value={form.name} onChange={handleChange} maxLength={150} required />
                </label>
                <label>رقم الهاتف *
                  <input name="phone" type="tel" value={form.phone} onChange={handleChange} maxLength={100} required />
                </label>
                <label>الفرع
                  <select name="branch" value={form.branch} onChange={handleChange}
                    disabled={currentUser?.role !== "admin"}>
                    {branches.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>الموظف المسؤول
                  <select name="employeeId" value={form.employeeId} onChange={handleChange}
                    disabled={isStaff}>
                    <option value="">بدون موظف مسؤول</option>
                    {availableEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.name}</option>
                    ))}
                    {form.employeeId && !availableEmployees.some((item) => String(item.id) === String(form.employeeId)) && (
                      <option value={form.employeeId} disabled>{getEmployeeName(form.employeeId)} (غير متاح)</option>
                    )}
                  </select>
                </label>
                <label>المنتج
                  <select name="product" value={form.product} onChange={handleChange}>
                    {products.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>حالة العميل
                  <select name="status" value={form.status} onChange={handleChange}>
                    {activeStatuses.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                    {currentStatusInactive && (
                      <option value={form.status}>{form.status} (حالة سابقة غير نشطة)</option>
                    )}
                  </select>
                </label>
                <label>المتابعة القادمة
                  <input type="date" name="nextDate" value={form.nextDate} onChange={handleChange} />
                </label>
                <label className="full">ملاحظات
                  <textarea name="notes" value={form.notes} onChange={handleChange} maxLength={10000} />
                </label>
              </div>
              <div className="crm-modal-actions">
                <button type="submit" className="crm-btn" disabled={saving}>
                  {saving ? "جاري الحفظ..." : "حفظ البيانات"}
                </button>
                <button type="button" className="crm-btn secondary"
                  onClick={() => setIsOpen(false)} disabled={saving}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
