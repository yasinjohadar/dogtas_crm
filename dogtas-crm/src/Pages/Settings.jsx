import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import CustomerStatusSettings from "./CustomerStatusSettings";
const sections = [
  { id: "profile", title: "الملف الشخصي", icon: "👤" },
  { id: "branches", title: "إعدادات الفروع", icon: "🏢" },
  { id: "users", title: "المستخدمون والصلاحيات", icon: "👥" },
  { id: "ratings", title: "تقييم الزبائن", icon: "⭐" },
  { id: "statuses", title: "حالات العملاء", icon: "📋" },
  { id: "security", title: "الأمان", icon: "🔒" },
];

const roleNames = {
  admin: "المدير العام",
  branch_manager: "مدير فرع",
  sales: "موظف مبيعات",
  followup: "موظف متابعة",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  border: "1px solid #d9c9b4",
  borderRadius: "8px",
  boxSizing: "border-box",
  marginTop: "6px",
};


const branchButtonStyle = {
  padding: "10px 18px",
  borderRadius: "9px",
  border: "1px solid #bda47c",
  background: "#a88b55",
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
};

function BranchSettings({ token, isAdmin }) {
  const [branches, setBranches] = useState([]);
  const [managers, setManagers] = useState([]);
  const [managersError, setManagersError] = useState("");
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [branchError, setBranchError] = useState("");
  const [branchMessage, setBranchMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: "", address: "", phone: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ address: "", phone: "", isActive: true, managerUserId: null });

  const loadBranches = async (signal) => {
    const response = await fetch("/api/branches", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal,
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || "تعذر تحميل الفروع");
    }
    return data.branches || [];
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoadingBranches(true);
    setBranchError("");
    if (!token) {
      setLoadingBranches(false);
      setBranchError("يرجى تسجيل الدخول");
      return () => controller.abort();
    }
    loadBranches(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setBranches(items);
      })
      .catch((error) => {
        if (error.name !== "AbortError") setBranchError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBranches(false);
      });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token || !isAdmin) {
      setManagers([]);
      return;
    }
    const controller = new AbortController();
    setManagersError("");
    fetch("/api/branches/managers", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "تعذر تحميل المدراء");
        }
        return data.managers || [];
      })
      .then((items) => { if (!controller.signal.aborted) setManagers(items); })
      .catch((error) => {
        if (error.name !== "AbortError") setManagersError(error.message);
      });
    return () => controller.abort();
  }, [token, isAdmin]);

  const refreshBranches = async () => {
    const items = await loadBranches();
    setBranches(items);
  };

  const addBranch = async (event) => {
    event.preventDefault();
    if (!isAdmin || busy) return;
    setBusy(true);
    setBranchError("");
    setBranchMessage("");
    try {
      const response = await fetch("/api/branches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newBranch),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "فشلت إضافة الفرع");
      await refreshBranches();
      setNewBranch({ name: "", address: "", phone: "" });
      setShowAdd(false);
      setBranchMessage("تمت إضافة الفرع بنجاح");
    } catch (error) {
      setBranchError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (branch) => {
    setBranchError("");
    setBranchMessage("");
    setEditingId(branch.id);
    setEditForm({
      address: branch.address || "",
      phone: branch.phone || "",
      isActive: Boolean(Number(branch.isActive)),
      managerUserId: branch.managerUserId == null ? null : Number(branch.managerUserId),
    });
  };

  const saveBranch = async (event) => {
    event.preventDefault();
    if (!isAdmin || busy || editingId === null) return;
    setBusy(true);
    setBranchError("");
    setBranchMessage("");
    try {
      const response = await fetch(`/api/branches/${editingId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "فشل تعديل الفرع");
      await refreshBranches();
      setEditingId(null);
      setBranchMessage("تم حفظ بيانات الفرع بنجاح");
    } catch (error) {
      setBranchError(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <p style={{ color: "#64748b", margin: 0 }}>إدارة بيانات فروع Doğtaş المرتبطة بقاعدة البيانات</p>
        {isAdmin && (
          <button type="button" style={branchButtonStyle} onClick={() => { setShowAdd(!showAdd); setBranchError(""); }}>
            {showAdd ? "إلغاء الإضافة" : "+ إضافة فرع جديد"}
          </button>
        )}
      </div>

      {branchError && <p role="alert" style={{ color: "#b91c1c" }}>{branchError}</p>}
      {branchMessage && <p role="status" style={{ color: "#15803d" }}>{branchMessage}</p>}

      {isAdmin && showAdd && (
        <form onSubmit={addBranch} style={{ padding: "18px", background: "#faf7f2", border: "1px solid #e5d8c7", borderRadius: "12px", display: "grid", gap: "12px" }}>
          <h4 style={{ margin: 0 }}>إضافة فرع</h4>
          <label>اسم الفرع
            <input style={inputStyle} maxLength={100} required value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} placeholder="مثلاً: اللاذقية" />
          </label>
          <label>العنوان
            <input style={inputStyle} maxLength={255} value={newBranch.address} onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })} placeholder="عنوان الفرع" />
          </label>
          <label>رقم الهاتف
            <input style={inputStyle} maxLength={30} type="tel" value={newBranch.phone} onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })} placeholder="رقم الهاتف" />
          </label>
          <div><button type="submit" style={branchButtonStyle} disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ الفرع"}</button></div>
        </form>
      )}

      {loadingBranches ? (
        <p>جارٍ تحميل الفروع...</p>
      ) : branches.length === 0 ? (
        <p style={{ color: "#64748b" }}>لا توجد فروع متاحة للعرض.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px" }}>
          {branches.map((branch) => (
            <article key={branch.id} style={{ border: "1px solid #e5d8c7", borderRadius: "12px", padding: "18px", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <h4 style={{ margin: 0 }}>🏢 {branch.name}</h4>
                <span style={{ color: Number(branch.isActive) === 1 ? "#15803d" : "#b91c1c", fontSize: "13px" }}>
                  {Number(branch.isActive) === 1 ? "● نشط" : "● غير نشط"}
                </span>
              </div>
              {editingId === branch.id && isAdmin ? (
                <form onSubmit={saveBranch} style={{ display: "grid", gap: "12px", marginTop: "16px" }}>
                  <label>العنوان
                    <input style={inputStyle} maxLength={255} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                  </label>
                  <label>رقم الهاتف
                    <input style={inputStyle} type="tel" maxLength={30} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  </label>
                  <label>المدير المسؤول
                    <select
                      style={inputStyle}
                      value={editForm.managerUserId ?? ""}
                      onChange={(e) => setEditForm({
                        ...editForm,
                        managerUserId: e.target.value === "" ? null : Number(e.target.value),
                      })}
                    >
                      <option value="">بدون مدير</option>
                      {managers
                        .filter((manager) => manager.branch === branch.name)
                        .map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.full_name} ({manager.username})
                          </option>
                        ))}
                    </select>
                  </label>
                  {managersError && <p role="alert" style={{ color: "#b91c1c" }}>{managersError}</p>}
                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                    الفرع نشط
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="submit" style={branchButtonStyle} disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button>
                    <button type="button" disabled={busy} onClick={() => setEditingId(null)}>إلغاء</button>
                  </div>
                </form>
              ) : (
                <div style={{ marginTop: "14px", lineHeight: 2 }}>
                  <div><strong>العنوان:</strong> {branch.address || "غير محدد"}</div>
                  <div><strong>الهاتف:</strong> {branch.phone || "غير محدد"}</div>
                  <div><strong>المدير المسؤول:</strong> {branch.managerName || "غير معيّن"}</div>
                  {isAdmin && (
                    <button type="button" style={{ ...branchButtonStyle, marginTop: "12px" }} onClick={() => startEdit(branch)}>
                      تعديل البيانات
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {isAdmin && <p style={{ color: "#64748b", fontSize: "13px" }}>ملاحظة: تعطيل الفرع يغيّر حالته في جدول الفروع فقط، ولا يمنع دخول موظفيه تلقائياً. يمكن تعيين مدير نشط مرتبط بنفس الفرع. الحذف وإعادة التسمية رح نضيفهما لاحقاً.</p>}
    </div>
  );
}


function UserSettings({ token, isAdmin }) {
  const [accounts, setAccounts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ employee_id: "", username: "", password: "" });
  const [resetId, setResetId] = useState(null);
  const [resetPassword, setResetPassword] = useState("");

  const api = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.message || `فشل الطلب (${response.status})`);
    return data;
  };

  const loadUsers = async () => {
    const data = await api("/api/users");
    setAccounts(Array.isArray(data.users) ? data.users : []);
  };

  useEffect(() => {
    if (!token || !isAdmin) { setLoadingUsers(false); return; }
    let active = true;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch("/api/users", { headers, cache: "no-store" }).then(async r => {
        const d = await r.json();
        if (!r.ok || !d.success) throw new Error(d.message || "تعذر تحميل المستخدمين");
        return d.users || [];
      }),
      fetch("/api/employees", { headers, cache: "no-store" })
        .then(async r => {
          const d = await r.json();
          return r.ok && d.success && Array.isArray(d.employees) ? d.employees : [];
        }).catch(() => []),
    ]).then(([users, staff]) => {
      if (active) { setAccounts(users); setEmployees(staff); }
    }).catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoadingUsers(false); });
    return () => { active = false; };
  }, [token, isAdmin]);

  const execute = async (id, url, method, payload, successText) => {
    setBusyId(id); setError(""); setNotice("");
    try {
      await api(url, { method, body: JSON.stringify(payload) });
      await loadUsers();
      setNotice(successText);
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setBusyId(null); }
  };

  const createAccount = async (event) => {
    event.preventDefault();
    const employee_id = Number(createForm.employee_id);
    if (!Number.isSafeInteger(employee_id) || employee_id <= 0) {
      setError("اختاري موظفاً من القائمة"); return;
    }
    if (createForm.password.length < 12 || new TextEncoder().encode(createForm.password).length > 72) {
      setError("كلمة المرور لازم تكون 12 حرفاً على الأقل وبحد أقصى 72 بايت"); return;
    }
    const ok = await execute("create", "/api/users", "POST", {
      employee_id, username: createForm.username.trim(), password: createForm.password,
    }, "تم إنشاء حساب الموظف بنجاح");
    if (ok) { setCreateForm({ employee_id: "", username: "", password: "" }); setShowCreate(false); }
  };

  const eligibleEmployees = employees.filter(e =>
    e.status === "نشط" &&
    ["موظف مبيعات", "مدير فرع", "موظف متابعة"].includes(e.role) &&
    !accounts.some(u => Number(u.employee_id) === Number(e.id))
  );

  if (!isAdmin) return <p style={{ color: "#b91c1c" }}>إدارة المستخدمين متاحة للمدير العام فقط.</p>;
  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <p style={{ margin: 0, color: "#64748b" }}>إدارة حسابات دخول موظفي Doğtaş وصلاحياتهم</p>
        <button type="button" style={branchButtonStyle} onClick={() => { setShowCreate(v => !v); setError(""); }}>
          {showCreate ? "إلغاء" : "+ إنشاء حساب موظف"}
        </button>
      </div>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#15803d" }}>{notice}</p>}
      {showCreate && (
        <form onSubmit={createAccount} style={{ display: "grid", gap: "12px", padding: "18px", background: "#faf7f2", border: "1px solid #e5d8c7", borderRadius: "12px" }}>
          <h4 style={{ margin: 0 }}>إنشاء حساب دخول لموظف موجود</h4>
          <label>الموظف
            <select style={inputStyle} required value={createForm.employee_id} onChange={e => setCreateForm({ ...createForm, employee_id: e.target.value })}>
              <option value="">اختاري الموظف</option>
              {eligibleEmployees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.branch} — {e.role}</option>)}
            </select>
          </label>
          {eligibleEmployees.length === 0 && <p style={{ color: "#64748b" }}>ما في موظفين نشطين مؤهلين بدون حساب، أو تعذّر تحميل قائمة الموظفين. تأكدي من قسم الموظفين.</p>}
          <label>اسم المستخدم
            <input style={inputStyle} required minLength={3} maxLength={50} pattern="[A-Za-z0-9._-]{3,50}" autoComplete="off" value={createForm.username} onChange={e => setCreateForm({ ...createForm, username: e.target.value })} placeholder="username" />
          </label>
          <label>كلمة المرور المؤقتة (12 حرفاً على الأقل)
            <input style={inputStyle} type="password" minLength={12} required autoComplete="new-password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} />
          </label>
          <div><button type="submit" style={branchButtonStyle} disabled={busyId !== null || eligibleEmployees.length === 0}>{busyId === "create" ? "جارٍ الإنشاء..." : "إنشاء الحساب"}</button></div>
        </form>
      )}
      {loadingUsers ? <p>جارٍ تحميل المستخدمين...</p> : accounts.length === 0 ? <p>لا توجد حسابات للعرض.</p> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "730px", textAlign: "right" }}>
            <thead><tr style={{ background: "#faf7f2" }}>
              { ["المستخدم", "اسم الدخول", "الفرع", "الصلاحية", "الحالة", "إجراءات"].map(h => <th key={h} style={{ padding: "12px", borderBottom: "1px solid #e5d8c7" }}>{h}</th>) }
            </tr></thead>
            <tbody>{accounts.map(account => {
              const isAdminAccount = account.role === "admin";
              const inactive = Number(account.is_active) !== 1;
              const working = busyId !== null;
              return <tr key={account.id}>
                <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>{account.full_name || account.employee_name || "—"}</td>
                <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>{account.username}</td>
                <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>{account.branch || "جميع الفروع"}</td>
                <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>
                  {isAdminAccount || !account.employee_id ? (roleNames[account.role] || account.role) : (
                    <select aria-label={`صلاحية ${account.username}`} style={{ ...inputStyle, marginTop: 0, minWidth: "130px" }} value={account.role}
                      disabled={working} onChange={async e => {
                        const role = e.target.value;
                        if (!window.confirm(`تأكيد تغيير صلاحية ${account.username} إلى ${roleNames[role]}؟`)) return;
                        await execute(account.id, `/api/users/${account.id}/role`, "PATCH", { role }, "تم تحديث الصلاحية. قد يحتاج المستخدم لتسجيل الدخول مجدداً.");
                      }}>
                      <option value="sales">موظف مبيعات</option>
                      <option value="followup">موظف متابعة</option>
                      <option value="branch_manager">مدير فرع</option>
                    </select>
                  )}
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid #eee", color: inactive ? "#b91c1c" : "#15803d" }}>{inactive ? "معطّل" : "نشط"}</td>
                <td style={{ padding: "12px", borderBottom: "1px solid #eee" }}>
                  <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                    <button type="button" disabled={working} onClick={() => { setResetId(account.id); setResetPassword(""); setError(""); }}>إعادة كلمة المرور</button>
                    {!isAdminAccount && <button type="button" disabled={working} onClick={async () => {
                      if (!window.confirm(`${inactive ? "تفعيل" : "تعطيل"} حساب ${account.username}؟`)) return;
                      await execute(account.id, `/api/users/${account.id}/status`, "PATCH", { is_active: inactive }, inactive ? "تم تفعيل الحساب" : "تم تعطيل الحساب");
                    }}>{inactive ? "تفعيل" : "تعطيل"}</button>}
                  </div>
                  {resetId === account.id && <form onSubmit={async e => {
                    e.preventDefault();
                    if (resetPassword.length < 12 || new TextEncoder().encode(resetPassword).length > 72) { setError("كلمة المرور يجب أن تكون 12 حرفاً على الأقل وألا تتجاوز 72 بايت"); return; }
                    if (!window.confirm(`تغيير كلمة مرور ${account.username} وإلغاء جلساته السابقة؟`)) return;
                    const ok = await execute(account.id, `/api/users/${account.id}/password`, "PATCH", { password: resetPassword }, "تم تحديث كلمة المرور وإلغاء الجلسات السابقة");
                    if (ok) { setResetId(null); setResetPassword(""); }
                  }} style={{ display: "grid", gap: "7px", marginTop: "8px" }}>
                    <input type="password" style={inputStyle} autoComplete="new-password" minLength={12} required placeholder="كلمة مرور جديدة" value={resetPassword} onChange={e => setResetPassword(e.target.value)} />
                    <div style={{ display: "flex", gap: "6px" }}><button type="submit" disabled={working}>حفظ</button><button type="button" onClick={() => { setResetId(null); setResetPassword(""); }}>إلغاء</button></div>
                  </form>}
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
      <p style={{ color: "#64748b", fontSize: "13px" }}>ملاحظة: تغيير صلاحية مدير فرع لا يزيل تعيينه تلقائياً من إعدادات الفروع. راجعي مدير الفرع بعد تغيير الدور. إضافة الحسابات تتطلب موظفاً مسجلاً ونشطاً.</p>
    </div>
  );
}


function RatingSettings({ token, isAdmin }) {
  const STORAGE_KEY = "dogtas_review_branch_links_v1";
  const [branches, setBranches] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [savedLinks, setSavedLinks] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
    } catch { return {}; }
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const qrRef = useRef(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    fetch("/api/branches", {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || data.success === false) {
          throw new Error(data.message || "تعذر تحميل الفروع");
        }
        return Array.isArray(data.branches) ? data.branches : [];
      })
      .then((items) => {
        if (controller.signal.aborted) return;
        setBranches(items);
        // Restore the original Aleppo link already tested by the user.
        // The stored value is only a token path, so the origin can change after deployment.
   
      })
      .catch((error) => {
        if (error.name !== "AbortError") setMessage(error.message);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLinks)); }
    catch { /* Storage may be disabled; keep the link in component state. */ }
  }, [savedLinks]);

  const selectedBranch = branches.find((b) => String(b.id) === selectedId);
  const storedPath = savedLinks[selectedId] || "";
  const link = storedPath ? new URL(storedPath, window.location.origin).href : "";

  async function createBranchLink() {
    if (!selectedId || busy || storedPath) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/reviews/links/branch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ branch_id: Number(selectedId) }),
      });
      const data = await response.json();
      if (!response.ok || data.success === false || !data.path) {
        throw new Error(data.message || "تعذر إنشاء رابط التقييم");
      }
      setSavedLinks((previous) => ({ ...previous, [selectedId]: data.path }));
      setMessage("تم حفظ رابط الفرع على هذا المتصفح. لا تعيدي إنشاءه.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveExistingLinks() {
    if (!token || !isAdmin || busy) return;

    setBusy(true);
    setMessage("");

    try {
      const entries = Object.entries(savedLinks);
      if (!entries.length) throw new Error("ما في روابط محفوظة بالمتصفح");

      let saved = 0;
      for (const [branchId, path] of entries) {
        const tokenValue = typeof path === "string" ? path.split("/").pop() : "";
        if (!/^[a-f0-9]{64}$/.test(tokenValue)) {
          throw new Error(`رابط الفرع ${branchId} غير صالح`);
        }

        const response = await fetch("/api/reviews/links/branch/save-existing", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            branch_id: Number(branchId),
            token: tokenValue,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(`فشل حفظ رابط الفرع ${branchId}: ${data.message || "خطأ غير معروف"}`);
        }
        saved++;
      }
      setMessage(`تم حفظ ${saved} روابط بشكل مشفّر في قاعدة البيانات`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadQR() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.href = canvas.toDataURL("image/png");
    anchor.download = `dogtas-review-${selectedId}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ color: "#64748b", margin: 0 }}>
        رابط وQR ثابتان لكل فرع على هذا المتصفح. التقييمات الواردة موجودة في صفحة «تقييمات الزبائن».
      </p>
      {!isAdmin ? (
        <p>إدارة روابط التقييم متاحة للمدير العام فقط.</p>
      ) : (
        <div style={{ padding: 18, background: "#faf7f2", borderRadius: 12, border: "1px solid #e5d8c7" }}>
          <h4>رابط تقييم الفرع</h4>
          {loading ? <p>جارٍ تحميل الفروع...</p> : (
            <>
              <select style={inputStyle} value={selectedId} onChange={(e) => {
                setSelectedId(e.target.value);
                setMessage("");
              }}>
                <option value="">اختاري الفرع</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {selectedId && !storedPath && (
                <button type="button" style={{ ...branchButtonStyle, marginTop: 12 }} disabled={busy} onClick={createBranchLink}>
                  {busy ? "جارٍ الإنشاء..." : "إنشاء رابط وQR للفرع لأول مرة"}
                </button>
              )}
            </>
          )}
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              style={branchButtonStyle}
              disabled={busy || !token || Object.keys(savedLinks).length === 0}
              onClick={saveExistingLinks}
            >
              {busy ? "جارٍ حفظ الروابط..." : "حفظ روابط QR الحالية في قاعدة البيانات"}
            </button>
          </div>
          {message && <p role="status">{message}</p>}
          {link && (
            <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
              <strong>رابط تقييم {selectedBranch?.name || "الفرع"} المحفوظ</strong>
              <input style={inputStyle} readOnly value={link} onFocus={(e) => e.target.select()} aria-label="رابط تقييم الفرع" />
              <div>
                <button type="button" onClick={async () => {
                  try { await navigator.clipboard.writeText(link); setMessage("تم نسخ الرابط"); }
                  catch { setMessage("انسخي الرابط من الحقل أعلاه"); }
                }}>نسخ الرابط</button>
              </div>
              <div ref={qrRef} style={{ width: "fit-content", background: "white", padding: 12, borderRadius: 10 }}>
                <QRCodeCanvas value={link} size={220} level="H" marginSize={2} />
              </div>
              <div><button type="button" style={branchButtonStyle} onClick={downloadQR}>تحميل QR كصورة</button></div>
              <p style={{ color: "#a16207", fontSize: 13 }}>
                هذا الرابط محفوظ على نفس المتصفح فقط، وليس بعد في قاعدة البيانات. إذا كان عنوانه localhost فلن يعمل من موبايلات الزبائن. بعد النشر يجب إعادة تحميل QR بالرابط العام قبل طباعته.
              </p>
            </div>
          )}
        </div>
      )}
      <p style={{ color: "#64748b", fontSize: 13 }}>
        تفعيل التقييمات وصلاحيات عرضها تحتاج إعدادات Backend محفوظة في قاعدة البيانات؛ لم نفعّلها بعد.
      </p>
    </div>
  );
}

function SecuritySettings({ profile, onOpenPassword, token }) {
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [sessionsMessage, setSessionsMessage] = useState("");
  const [busySession, setBusySession] = useState(null);

  const loadSessions = async (signal) => {
    if (!token) {
      setSessions([]);
      setLoadingSessions(false);
      setSessionsError("يرجى تسجيل الدخول");
      return;
    }
    setLoadingSessions(true);
    setSessionsError("");
    try {
      const response = await fetch("/api/sessions", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "تعذر تحميل الجلسات");
      }
      if (!signal?.aborted) setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (error) {
      if (error.name !== "AbortError") setSessionsError(error.message);
    } finally {
      if (!signal?.aborted) setLoadingSessions(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    loadSessions(controller.signal);
    return () => controller.abort();
  }, [token]);

  const revokeSessions = async (id = null) => {
    const isAll = id === null;
    const current = isAll || sessions.some((s) => Number(s.id) === Number(id) && s.is_current);
    const confirmation = isAll
      ? "تأكيد تسجيل الخروج من جميع الأجهزة، بما فيها هذا الجهاز؟"
      : current
        ? "تأكيد تسجيل الخروج من هذا الجهاز؟"
        : "تأكيد تسجيل الخروج من الجهاز المحدد؟";
    if (!window.confirm(confirmation)) return;

    setBusySession(isAll ? "all" : id);
    setSessionsError("");
    setSessionsMessage("");
    try {
      const response = await fetch(isAll ? "/api/sessions" : `/api/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "تعذر تسجيل الخروج من الجهاز");
      }
      if (current) {
        // The revoked JWT can no longer access protected API endpoints.
        // The existing application's logout flow should clear the stored token.
        setSessions([]);
        setSessionsMessage("تم إلغاء جلسة هذا الجهاز. سجّلي الخروج من النظام ثم ادخلي من جديد.");
      } else {
        setSessions((previous) => previous.filter((s) => Number(s.id) !== Number(id)));
        setSessionsMessage("تم إلغاء الجلسة بنجاح");
      }
    } catch (error) {
      setSessionsError(error.message);
    } finally {
      setBusySession(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return "غير محدد";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("ar-SY");
  };

  const items = [
    { title: "حسابك الحالي", detail: profile?.username || "غير متاح" },
    { title: "صلاحية الحساب", detail: roleNames[profile?.role] || profile?.role || "غير محددة" },
    { title: "الفرع", detail: profile?.branch || (profile?.role === "admin" ? "جميع الفروع" : "غير محدد") },
  ];

  return (
    <div style={{ display: "grid", gap: 18, maxWidth: 740 }}>
      <p style={{ margin: 0, color: "#64748b" }}>
        إعدادات حماية حسابك في نظام Doğtaş CRM.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        {items.map((item) => (
          <div key={item.title} style={{ padding: 16, background: "#faf7f2", border: "1px solid #e5d8c7", borderRadius: 10 }}>
            <div style={{ color: "#64748b", fontSize: 13 }}>{item.title}</div>
            <strong style={{ display: "block", marginTop: 8 }}>{item.detail}</strong>
          </div>
        ))}
      </div>
      <div style={{ padding: 18, border: "1px solid #e5d8c7", borderRadius: 12 }}>
        <h4 style={{ marginTop: 0 }}>🔑 كلمة المرور</h4>
        <p style={{ color: "#64748b" }}>لتغيير كلمة المرور، استخدمي النموذج الموجود في الملف الشخصي.</p>
        <button type="button" className="crm-btn" onClick={onOpenPassword}>
          الانتقال لتغيير كلمة المرور
        </button>
      </div>
      <div style={{ padding: 18, border: "1px solid #e5d8c7", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <h4 style={{ margin: 0 }}>💻 الأجهزة والجلسات النشطة</h4>
          <button type="button" disabled={loadingSessions || busySession !== null} onClick={() => loadSessions()}>
            تحديث القائمة
          </button>
        </div>
        <p style={{ color: "#64748b", fontSize: 13 }}>
          الجلسات المسجّلة دخولاً على حسابك فقط. قد يظهر اسم المتصفح بدلاً من اسم الجهاز.
        </p>
        {sessionsError && <p role="alert" style={{ color: "#b91c1c" }}>{sessionsError}</p>}
        {sessionsMessage && <p role="status" style={{ color: "#15803d" }}>{sessionsMessage}</p>}
        {loadingSessions ? <p>جارٍ تحميل الجلسات...</p> : sessions.length === 0 ? (
          <p style={{ color: "#64748b" }}>لا توجد جلسات نشطة للعرض.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {sessions.map((session) => (
              <div key={session.id} style={{ padding: 14, borderRadius: 10, border: "1px solid #e5d8c7", background: session.is_current ? "#f0f7f3" : "#faf7f2" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                    <strong>🖥️ {session.device_info || "جهاز غير معروف"}</strong>
                    {session.is_current && <span style={{ color: "#15803d", marginRight: 8, fontSize: 13 }}>● هذا الجهاز</span>}
                    <div style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>عنوان IP: {session.ip_address || "غير متاح"}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>تاريخ الدخول: {formatDate(session.created_at)}</div>
                    <div style={{ color: "#64748b", fontSize: 13 }}>انتهاء الجلسة: {formatDate(session.expires_at)}</div>
                  </div>
                  <button type="button" disabled={busySession !== null} onClick={() => revokeSessions(session.id)} style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #b91c1c", color: "#b91c1c", background: "#fff", cursor: "pointer" }}>
                    {busySession === session.id ? "جارٍ الإلغاء..." : "تسجيل خروج"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <button type="button" disabled={busySession !== null || loadingSessions || sessions.length === 0} onClick={() => revokeSessions()} style={{ marginTop: 16, padding: "11px 16px", borderRadius: 9, border: "1px solid #b91c1c", color: "#fff", background: "#b91c1c", cursor: "pointer" }}>
          {busySession === "all" ? "جارٍ تسجيل الخروج..." : "تسجيل الخروج من جميع الأجهزة"}
        </button>
      </div>
      <div style={{ padding: 18, border: "1px solid #e5d8c7", borderRadius: 12 }}>
        <h4 style={{ marginTop: 0 }}>🛡️ نصائح لحماية الحساب</h4>
        <ul style={{ lineHeight: 2, marginBottom: 0 }}>
          <li>استخدمي كلمة مرور طويلة وفريدة، ولا تشاركيها مع أي موظف.</li>
          <li>لا تحفظي كلمات المرور في ملفات المشروع أو داخل الكود.</li>
          <li>سجّلي الخروج من الأجهزة المشتركة بعد انتهاء العمل.</li>
          <li>استخدمي اتصال HTTPS عند نشر النظام على الإنترنت.</li>
        </ul>
      </div>
      <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
        إدارة الجلسات مفعّلة، أما التحقق بخطوتين فلم يتم تفعيله بعد.
      </p>
    </div>
  );
}

function Settings({ token, user }) {
  const [activeSection, setActiveSection] = useState("profile");
  const [profile, setProfile] = useState(user || null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setLoading(true);
      setProfileError("");

      try {
        const response = await fetch("/api/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "تعذر تحميل الملف الشخصي"
          );
        }

        setProfile(data.user);
      } catch (error) {
        if (error.name !== "AbortError") {
          setProfileError(error.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    if (token) {
      loadProfile();
    } else {
      setLoading(false);
      setProfileError("يرجى تسجيل الدخول");
    }

    return () => controller.abort();
  }, [token]);

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setMessage("كلمتا المرور الجديدتان غير متطابقتين");
      return;
    }

    if (
      newPassword.length < 12 ||
      new TextEncoder().encode(newPassword).length > 72
    ) {
      setMessage(
        "كلمة المرور الجديدة يجب أن تكون 12 حرفاً على الأقل وألا تتجاوز 72 بايت"
      );
      return;
    }

    if (currentPassword === newPassword) {
      setMessage("كلمة المرور الجديدة يجب أن تختلف عن الحالية");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "فشل تغيير كلمة المرور"
        );
      }

      setSuccess(true);
      setMessage(
        "تم تغيير كلمة المرور بنجاح. سجّل خروجك وادخل بكلمة المرور الجديدة."
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const currentSection = sections.find(
    (section) => section.id === activeSection
  );

  return (
    <div dir="rtl">
      <section className="card">
        <h2>⚙️ إعدادات النظام</h2>
        <p>إدارة الحساب والفروع والصلاحيات وإعدادات CRM</p>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginTop: "20px",
        }}
      >
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            style={{
              padding: "16px",
              borderRadius: "12px",
              border:
                activeSection === section.id
                  ? "2px solid #234b78"
                  : "1px solid #ddd",
              background:
                activeSection === section.id
                  ? "#eaf2ff"
                  : "#fff",
              color: "#23364d",
              cursor: "pointer",
              fontSize: "15px",
              fontWeight: "600",
              textAlign: "right",
            }}
          >
            {section.icon} {section.title}
          </button>
        ))}
      </div>

      <section className="card" style={{ marginTop: "20px" }}>
        <h3>
          {currentSection.icon} {currentSection.title}
        </h3>

        {activeSection === "profile" ? (
          <div style={{ maxWidth: "650px" }}>
            <h4>معلومات الحساب</h4>

            {loading && <p>جارٍ تحميل بيانات الحساب...</p>}

            {profileError && (
              <p role="alert" style={{ color: "crimson" }}>
                {profileError}
              </p>
            )}

            {!loading && !profileError && profile && (
              <div
                style={{
                  display: "grid",
                  gap: "14px",
                  marginBottom: "28px",
                }}
              >
                <div>
                  <strong>الاسم الكامل</strong>
                  <div style={inputStyle}>
                    {profile.full_name || "غير محدد"}
                  </div>
                </div>

                <div>
                  <strong>اسم المستخدم</strong>
                  <div style={inputStyle}>
                    {profile.username}
                  </div>
                </div>

                <div>
                  <strong>الدور الوظيفي</strong>
                  <div style={inputStyle}>
                    {roleNames[profile.role] || profile.role}
                  </div>
                </div>

                <div>
                  <strong>الفرع</strong>
                  <div style={inputStyle}>
                    {profile.branch ||
                      (profile.role === "admin"
                        ? "جميع الفروع"
                        : "غير محدد")}
                  </div>
                </div>
              </div>
            )}

            <hr style={{ borderColor: "#eee" }} />

            <h4>🔐 تغيير كلمة المرور</h4>
            <p style={{ color: "#64748b" }}>
              لحماية حسابك، أدخل كلمة المرور الحالية ثم
              كلمة مرور جديدة.
            </p>

            <form onSubmit={changePassword}>
              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="currentPassword">
                  كلمة المرور الحالية
                </label>
                <input
                  id="currentPassword"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) =>
                    setCurrentPassword(e.target.value)
                  }
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="newPassword">
                  كلمة المرور الجديدة
                </label>
                <input
                  id="newPassword"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(e.target.value)
                  }
                  style={inputStyle}
                  minLength={12}
                  required
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="confirmPassword">
                  تأكيد كلمة المرور الجديدة
                </label>
                <input
                  id="confirmPassword"
                  type={showPasswords ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  style={inputStyle}
                  required
                />
              </div>

              <label
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <input
                  type="checkbox"
                  checked={showPasswords}
                  onChange={(e) =>
                    setShowPasswords(e.target.checked)
                  }
                />
                إظهار كلمات المرور
              </label>

              {message && (
                <p
                  role="status"
                  style={{
                    color: success ? "#15803d" : "#b91c1c",
                    marginBottom: "14px",
                  }}
                >
                  {message}
                </p>
              )}

              <button
                className="crm-btn"
                type="submit"
                disabled={saving || !token || success}
              >
                {saving
                  ? "جارٍ الحفظ..."
                  : success
                  ? "تم تغيير كلمة المرور"
                  : "حفظ كلمة المرور الجديدة"}
              </button>
            </form>
      
</div>
) : activeSection === "branches" ? (
  <BranchSettings
    token={token}
    isAdmin={(profile?.role || user?.role) === "admin"}
  />
) : activeSection === "users" ? (
  <UserSettings
    token={token}
    isAdmin={(profile?.role || user?.role) === "admin"}
  />
) : activeSection === "ratings" ? (
  <RatingSettings
    token={token}
    isAdmin={(profile?.role || user?.role) === "admin"}
  />
) : activeSection === "statuses" ? (
  <CustomerStatusSettings
    token={token}
    isAdmin={(profile?.role || user?.role) === "admin"}
  />
) : activeSection === "security" ? (
  <SecuritySettings
    profile={profile || user}
    token={token}
    onOpenPassword={() => setActiveSection("profile")}
  />
) : (
  <p style={{ color: "#64748b" }}>هذا القسم غير متاح حالياً.</p>
)}
</section>
</div>
);


}

export default Settings;
