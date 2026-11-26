
import { useState, useEffect, useCallback } from "react";

const emptyEmployee = {
  name: "",
  phone: "",
  branch: "حلب",
  role: "موظف مبيعات",
  status: "نشط",
  notes: "",
};

const branches = ["حلب", "دمشق", "إدلب"];

function Employees({ branch = "", token }) {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyEmployee);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const canManage = ["admin", "branch_manager"].includes(currentUser?.role);
  const isBranchManager = currentUser?.role === "branch_manager";
  const ownBranch = typeof currentUser?.branch === "string" ? currentUser.branch.trim() : "";
  const validManagerBranch = branches.includes(ownBranch);
  const canEditEmployee = (employee) => canManage && (
    currentUser?.role === "admin" ||
    (employee.branch === ownBranch && !["مدير فرع", "مدير النظام"].includes(employee.role))
  );
  const [accounts, setAccounts] = useState([]);
  const [accountEmployee, setAccountEmployee] = useState(null);
  const [accountForm, setAccountForm] = useState({ username: "", password: "" });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountError, setAccountError] = useState("");

  // Load employees from MySQL
  const loadEmployees = useCallback(async () => {
    if (!token) {
      setEmployees([]);
      setError("يرجى تسجيل الدخول من جديد");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/employees", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "فشل تحميل الموظفين"
        );
      }

      if (!Array.isArray(data.employees)) {
        throw new Error("استجابة الموظفين غير صحيحة");
      }

      setEmployees(data.employees);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Load on page open
  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Read permissions and assigned branch from the server, not from the UI filter.
  const loadAccounts = useCallback(async () => {
    setCurrentUser(null);
    setIsAdmin(false);
    setAccounts([]);
    if (!token) {
      setAccountError("يرجى تسجيل الدخول من جديد");
      return;
    }

    try {
      const meResponse = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const me = await meResponse.json();
      if (!meResponse.ok || !me.success || !me.user) {
        throw new Error(me.message || "تعذر تحميل صلاحيات الحساب");
      }

      const user = {
        ...me.user,
        branch: typeof me.user.branch === "string" ? me.user.branch.trim() : "",
      };
      setCurrentUser(user);

      if (user.role === "branch_manager" && !branches.includes(user.branch)) {
        setAccountError("فرع مدير الفرع غير محدد في الحساب. يرجى مراجعة الأدمن.");
        return;
      }

      setAccountError("");
      if (user.role !== "admin") return;

      setIsAdmin(true);
      try {
        const response = await fetch("/api/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.users)) {
          throw new Error(data.message || "تعذر تحميل حسابات الدخول");
        }
        setAccounts(data.users);
      } catch (err) {
        // Account list failure must not erase a verified admin session.
        setAccountError(err.message || "تعذر تحميل حسابات الدخول");
      }
    } catch (err) {
      setCurrentUser(null);
      setIsAdmin(false);
      setAccounts([]);
      setAccountError(err.message || "تعذر تحميل صلاحيات الحساب");
    }
  }, [token]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const openAccount = (employee) => {
    setAccountEmployee(employee);
    setAccountForm({ username: "", password: "" });
    setAccountError("");
  };

  const createAccount = async (event) => {
    event.preventDefault();
    if (!accountEmployee || accountSaving) return;
    setAccountSaving(true);
    setAccountError("");
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          employee_id: Number(accountEmployee.id),
          username: accountForm.username.trim(),
          password: accountForm.password,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "فشل إنشاء حساب الدخول");
      }
      setAccountEmployee(null);
      setAccountForm({ username: "", password: "" });
      await loadAccounts();
      alert("تم إنشاء حساب دخول الموظف بنجاح");
    } catch (err) {
      setAccountError(err.message);
    } finally {
      setAccountSaving(false);
    }
  };

  // Search and branch filter
  const filteredEmployees = employees.filter((employee) => {
    const matchesBranch = isBranchManager
      ? employee.branch === ownBranch
      : (!branch || employee.branch === branch);

    const query = search.trim().toLowerCase();

    const matchesSearch =
      employee.name.toLowerCase().includes(query) ||
      employee.phone.includes(query) ||
      employee.role.toLowerCase().includes(query);

    return matchesBranch && matchesSearch;
  });

  // Open add employee form
const openAdd = () => {
  if (!canManage) return;
  if (isBranchManager && !validManagerBranch) {
    alert("فرع حساب مدير الفرع غير محدد. يرجى مراجعة الأدمن لتحديد الفرع في حساب الدخول.");
    return;
  }
  setEditingId(null);
  setForm({
    ...emptyEmployee,
    branch: isBranchManager ? ownBranch : (branches.includes(branch) ? branch : "حلب"),
  });
  setIsOpen(true);
};

const openEdit = (employee) => {
  if (!canEditEmployee(employee)) return;
  setEditingId(employee.id);

  setForm({
    name: employee.name,
    phone: employee.phone,
    branch: employee.branch,
    role: employee.role,
    status: employee.status,
    notes: employee.notes || "",
  });

  setIsOpen(true);
};

  // Update form fields
  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "branch" && isBranchManager) return;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Create or update an employee in MySQL
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || !canManage) return;
    if (isBranchManager && (!validManagerBranch || form.branch !== ownBranch || ["مدير فرع", "مدير النظام"].includes(form.role))) {
      alert("لا يمكن حفظ الموظف: الفرع غير محدد أو البيانات خارج صلاحيات مدير الفرع.");
      return;
    }

    if (!form.name.trim() || !form.phone.trim()) {
      alert("يرجى إدخال اسم الموظف ورقم الهاتف");
      return;
    }
    if (!token) {
      alert("يرجى تسجيل الدخول من جديد");
      return;
    }

    const isEditing = editingId !== null;
    setSaving(true);

    try {
      const response = await fetch(
        isEditing ? `/api/employees/${editingId}` : "/api/employees",
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim(),
            branch: form.branch,
            role: form.role,
            status: form.status,
            notes: form.notes,
          }),
        }
      );

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("السيرفر لم يرجع JSON. تأكدي من تشغيل Node.js ومسار API");
      }
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "فشل حفظ البيانات");
      }

      setIsOpen(false);
      setEditingId(null);
      setForm({ ...emptyEmployee });
      await loadEmployees();
      if (isAdmin) await loadAccounts();
      alert(isEditing
        ? "تم تعديل الموظف في MySQL بنجاح"
        : "تمت إضافة الموظف إلى MySQL بنجاح");
    } catch (err) {
      alert(`خطأ في الحفظ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };


  // Delete an employee only after confirmation and server approval
  const handleDelete = async (employee) => {
    if (deletingId !== null || saving || !canEditEmployee(employee)) return;

    if (!window.confirm(`هل أنتِ متأكدة من حذف الموظف "${employee.name}"؟\nلا يمكن التراجع عن الحذف.`)) {
      return;
    }

    if (!token) {
      alert("يرجى تسجيل الدخول من جديد");
      return;
    }

    setDeletingId(employee.id);

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("السيرفر لم يرجع JSON. تأكدي من تشغيل Node.js ومسار API");
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        if (response.status === 409) {
          throw new Error("لا يمكن حذف هذا الموظف لأنه مرتبط بعملاء في قاعدة البيانات");
        }
        if (response.status === 403) {
          throw new Error("ليس لديك صلاحية حذف هذا الموظف");
        }
        if (response.status === 404) {
          throw new Error("الموظف غير موجود، ربما تم حذفه مسبقاً");
        }
        throw new Error(data.message || "فشل حذف الموظف");
      }

      // Remove the deleted row immediately; refresh from MySQL afterward.
      setEmployees((previous) => previous.filter((item) => item.id !== employee.id));
      await loadEmployees();
      if (isAdmin) await loadAccounts();
      alert("تم حذف الموظف من MySQL بنجاح");
    } catch (err) {
      alert(`خطأ في الحذف: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <section className="card">
        <div className="customers-toolbar">
          <button
            type="button"
            className="crm-btn secondary"
            onClick={() => { loadEmployees(); if (isAdmin) loadAccounts(); }}
            disabled={loading}
          >
            تحديث الموظفين
          </button>

          <input
            type="search"
            placeholder="ابحث باسم الموظف أو الهاتف أو الوظيفة..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          {canManage && (
            <button type="button" className="crm-btn" onClick={openAdd} disabled={isBranchManager && !validManagerBranch}>
              + إضافة موظف
            </button>
          )}
        </div>

        {accountError && (isBranchManager || isAdmin || !currentUser) && (
          <p role="alert" style={{ color: "#b91c1c" }}>{accountError}</p>
        )}

        {error && (
          <p role="alert" style={{ color: "#b91c1c" }}>
            {error}
          </p>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>اسم الموظف</th>
                <th>رقم الهاتف</th>
                <th>الفرع</th>
                <th>الوظيفة</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="empty">
                    جاري تحميل الموظفين...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty">
                    {error
                      ? "تعذر تحميل الموظفين"
                      : "لا يوجد موظفون بعد"}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>{employee.name}</td>
                    <td>{employee.phone}</td>
                    <td>{employee.branch}</td>
                    <td>{employee.role}</td>
                    <td>
                      <span className="crm-status">
                        {employee.status}
                      </span>
                    </td>
                    <td>
                      {canEditEmployee(employee) && (
                        <button type="button" className="crm-btn secondary" onClick={() => openEdit(employee)}>
                          تعديل
                        </button>
                      )}{" "}
                      {isAdmin && (() => {
                        const account = accounts.find(
                          (item) => Number(item.employee_id) === Number(employee.id)
                        );
                        return account ? (
                          <span className="crm-status" title={`اسم المستخدم: ${account.username}`}>
                            حساب: {account.username}
                          </span>
                        ) : employee.status === "نشط" && employee.role !== "مدير النظام" ? (
                          <button
                            type="button"
                            className="crm-btn secondary"
                            onClick={() => openAccount(employee)}
                          >
                            إنشاء حساب دخول
                          </button>
                        ) : null;
                      })()}{" "}
                      {canEditEmployee(employee) && (
                        <button type="button" className="crm-btn danger"
                          onClick={() => handleDelete(employee)}
                          disabled={deletingId !== null || saving}
                          title="حذف الموظف من قاعدة البيانات">
                          {deletingId === employee.id ? "جاري الحذف..." : "حذف"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {accountEmployee && isAdmin && (
        <div className="crm-modal-overlay">
          <div className="crm-modal">
            <h2>إنشاء حساب دخول: {accountEmployee.name}</h2>
            <p>الفرع: {accountEmployee.branch} — الوظيفة: {accountEmployee.role}</p>
            <form onSubmit={createAccount}>
              <div className="crm-form-grid">
                <label>
                  اسم المستخدم *
                  <input
                    autoComplete="off"
                    value={accountForm.username}
                    onChange={(event) => setAccountForm((prev) => ({ ...prev, username: event.target.value }))}
                    minLength={3}
                    maxLength={50}
                    pattern="[a-zA-Z0-9._-]+"
                    title="أحرف إنجليزية وأرقام ونقطة وشرطة فقط"
                    required
                  />
                </label>
                <label>
                  كلمة المرور *
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={accountForm.password}
                    onChange={(event) => setAccountForm((prev) => ({ ...prev, password: event.target.value }))}
                    minLength={12}
                    required
                  />
                </label>
              </div>
              <p>كلمة المرور لازم تكون 12 حرف على الأقل. احتفظي فيها بمكان آمن.</p>
              {accountError && <p role="alert" style={{ color: "#b91c1c" }}>{accountError}</p>}
              <div className="crm-modal-actions">
                <button className="crm-btn" type="submit" disabled={accountSaving}>
                  {accountSaving ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}
                </button>
                <button
                  className="crm-btn secondary"
                  type="button"
                  disabled={accountSaving}
                  onClick={() => { setAccountEmployee(null); setAccountError(""); }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOpen && canManage && (
        <div className="crm-modal-overlay">
          <div className="crm-modal">
            <h2>{editingId !== null ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}</h2>

            <form onSubmit={handleSubmit}>
              <div className="crm-form-grid">
                <label>
                  اسم الموظف *
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    maxLength={150}
                    required
                  />
                </label>

                <label>
                  رقم الهاتف *
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    maxLength={30}
                    required
                  />
                </label>

                <label>
                  الفرع
                  <select
                    name="branch"
                    value={form.branch}
                    onChange={handleChange}
                    disabled={isBranchManager}
                    required
                  >
                    {isBranchManager ? (
                      <option value={ownBranch}>
                        {validManagerBranch ? ownBranch : "الفرع غير محدد في الحساب"}
                      </option>
                    ) : (
                      branches.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))
                    )}
                  </select>
                </label>

                <label>
                  الوظيفة
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                  >
                    <option>موظف مبيعات</option>
                    {!isBranchManager && <option>مدير فرع</option>}
                    {!isBranchManager && <option>مدير النظام</option>}
                    <option>موظف متابعة</option>
                  </select>
                </label>

                <label>
                  الحالة
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option>نشط</option>
                    <option>غير نشط</option>
                  </select>
                </label>

                <label className="full">
                  ملاحظات
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    maxLength={10000}
                  />
                </label>
              </div>

              <div className="crm-modal-actions">
                <button
                  type="submit"
                  className="crm-btn"
                  disabled={saving || (isBranchManager && !validManagerBranch)}
                >
                  {saving
                    ? "جاري الحفظ..."
                    : "حفظ البيانات"}
                </button>

                <button
                  type="button"
                  className="crm-btn secondary"
                  onClick={() => setIsOpen(false)}
                  disabled={saving}
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

export default Employees;
