
import { useEffect, useState } from "react";

const ROLE_LABELS = {
  admin: "مدير النظام",
  employee: "موظف عام",
  branch_manager: "مدير فرع",
  sales: "موظف مبيعات",
  followup: "موظف متابعة",
};

const EDITABLE_ROLES = [
  "sales",
  "followup",
  "branch_manager",
];

export default function Users({ token, branch = "" }) {
  const [users, setUsers] = useState([]);
  const filteredUsers = branch
    ? users.filter((user) => user.branch === branch)
    : users;
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState("");

  const [selectedRoleUser, setSelectedRoleUser] = useState(null);
  const [newRole, setNewRole] = useState("");

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setLoading(true);

      try {
        const response = await fetch("/api/users", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "تعذر تحميل الحسابات"
          );
        }

        if (!cancelled) {
          setUsers(data.users || []);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (token) loadUsers();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function changePassword(event) {
    event.preventDefault();

    if (
      !selectedUser ||
      password.length < 12 ||
      new TextEncoder().encode(password).length > 72
    ) {
      setMessage(
        "كلمة المرور لازم تكون 12 حرف على الأقل وما تتجاوز 72 بايت"
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/users/${selectedUser.id}/password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "فشل تغيير كلمة المرور"
        );
      }

      setPassword("");
      setSelectedUser(null);
      setMessage(
        "تم تغيير كلمة المرور وإلغاء الجلسات القديمة بنجاح"
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(user) {
    const active = Number(user.is_active) === 1;
    const newStatus = !active;

    const confirmed = window.confirm(
      newStatus
        ? `هل تريدين تفعيل حساب ${user.full_name}؟`
        : `هل تريدين تعطيل حساب ${user.full_name}؟ سيتم إلغاء جلساته الحالية.`
    );

    if (!confirmed) return;

    setUpdatingId(user.id);
    setMessage("");

    try {
      const response = await fetch(
        `/api/users/${user.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            is_active: newStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "فشل تحديث حالة الحساب"
        );
      }

      setUsers((previous) =>
        previous.map((item) =>
          item.id === user.id
            ? {
                ...item,
                is_active: newStatus ? 1 : 0,
              }
            : item
        )
      );

      setMessage(
        newStatus
          ? `تم تفعيل حساب ${user.full_name} بنجاح`
          : `تم تعطيل حساب ${user.full_name} وإلغاء جلساته بنجاح`
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function changeRole(event) {
    event.preventDefault();

    if (
      !selectedRoleUser ||
      !EDITABLE_ROLES.includes(newRole)
    ) {
      setMessage("اختاري صلاحية صحيحة");
      return;
    }

    if (selectedRoleUser.role === newRole) {
      setMessage("الموظف عنده نفس الصلاحية حالياً");
      return;
    }

    const confirmed = window.confirm(
      `هل تريدين تغيير صلاحية ${selectedRoleUser.full_name} إلى ${ROLE_LABELS[newRole]}؟ سيتم إلغاء جلساته القديمة.`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/users/${selectedRoleUser.id}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            role: newRole,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "فشل تعديل الصلاحية"
        );
      }

      setUsers((previous) =>
        previous.map((item) =>
          item.id === selectedRoleUser.id
            ? { ...item, role: newRole }
            : item
        )
      );

      setMessage(
        `تم تغيير صلاحية ${selectedRoleUser.full_name} إلى ${ROLE_LABELS[newRole]} بنجاح`
      );

      setSelectedRoleUser(null);
      setNewRole("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" dir="rtl">
      <h2>إدارة حسابات الموظفين</h2>

      <p>
        إدارة الصلاحيات، تغيير كلمات المرور،
        وتفعيل أو تعطيل الحسابات
      </p>

      {message && (
        <p role="status">{message}</p>
      )}

      {loading ? (
        <p>جارٍ تحميل الحسابات...</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>اسم المستخدم</th>
                <th>الفرع</th>
                <th>الصلاحية</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.map((user) => {
                const active =
                  Number(user.is_active) === 1;

                const canEditRole =
                  user.role !== "admin" &&
                  Boolean(user.employee_id);

                return (
                  <tr key={user.id}>
                    <td>{user.full_name}</td>
                    <td>{user.username}</td>
                    <td>{user.branch || "—"}</td>

                    <td>
                      {ROLE_LABELS[user.role] || user.role}
                    </td>

                    <td>
                      <span
                        style={{
                          color: active
                            ? "#15803d"
                            : "#dc2626",
                          fontWeight: 600,
                        }}
                      >
                        {active ? "نشط" : "غير نشط"}
                      </span>
                    </td>

                    <td>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          type="button"
                          className="crm-btn secondary"
                          disabled={saving || updatingId !== null}
                          onClick={() => {
                            setSelectedUser(user);
                            setSelectedRoleUser(null);
                            setPassword("");
                            setMessage("");
                          }}
                        >
                          تغيير كلمة المرور
                        </button>

                        <button
                          type="button"
                          className="crm-btn secondary"
                          disabled={saving || updatingId !== null}
                          onClick={() => changeStatus(user)}
                          style={{
                            background: active
                              ? "#fee2e2"
                              : "#dcfce7",
                            color: active
                              ? "#991b1b"
                              : "#166534",
                            border: "none",
                          }}
                        >
                          {updatingId === user.id
                            ? "جارٍ التحديث..."
                            : active
                            ? "تعطيل الحساب"
                            : "تفعيل الحساب"}
                        </button>

                        {canEditRole && (
                          <button
                            type="button"
                            className="crm-btn secondary"
                            disabled={saving || updatingId !== null}
                            onClick={() => {
                              setSelectedRoleUser(user);
                              setNewRole(user.role);
                              setSelectedUser(null);
                              setPassword("");
                              setMessage("");
                            }}
                          >
                            تعديل الصلاحية
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <p className="empty">لا يوجد مستخدمون في هذا الفرع.</p>
          )}
        </div>
      )}

      {selectedRoleUser && (
        <form
          onSubmit={changeRole}
          style={{ marginTop: 24 }}
        >
          <h3>
            تعديل صلاحية: {selectedRoleUser.full_name}
          </h3>

          <p>
            الصلاحية الحالية:{" "}
            <strong>
              {ROLE_LABELS[selectedRoleUser.role] ||
                selectedRoleUser.role}
            </strong>
          </p>

          <select
            value={newRole}
            onChange={(event) =>
              setNewRole(event.target.value)
            }
            required
            style={{
              padding: 12,
              border: "1px solid #E5D9C9",
              borderRadius: 8,
              width: "100%",
              maxWidth: 360,
              marginBottom: 12,
            }}
          >
            {!EDITABLE_ROLES.includes(newRole) && (
              <option value="" disabled>
                اختاري الصلاحية الجديدة
              </option>
            )}

            {EDITABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              className="crm-btn"
              disabled={
                saving ||
                newRole === selectedRoleUser.role
              }
            >
              {saving
                ? "جارٍ الحفظ..."
                : "حفظ الصلاحية"}
            </button>

            <button
              type="button"
              className="crm-btn secondary"
              disabled={saving}
              onClick={() => {
                setSelectedRoleUser(null);
                setNewRole("");
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {selectedUser && (
        <form
          onSubmit={changePassword}
          style={{ marginTop: 24 }}
        >
          <h3>
            تغيير كلمة مرور: {selectedUser.full_name}
          </h3>

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="كلمة المرور الجديدة"
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
            style={{
              padding: 12,
              border: "1px solid #E5D9C9",
              borderRadius: 8,
              marginBottom: 12,
              width: "100%",
              maxWidth: 360,
              boxSizing: "border-box",
            }}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              className="crm-btn"
              disabled={saving}
            >
              {saving
                ? "جارٍ الحفظ..."
                : "حفظ كلمة المرور"}
            </button>

            <button
              type="button"
              className="crm-btn secondary"
              disabled={saving}
              onClick={() => {
                setSelectedUser(null);
                setPassword("");
              }}
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
