
import { useEffect, useState } from "react";

const API = "/api/customer-statuses";

const protectedNames = [
  "جديد",
  "بحاجة لمتابعة",
  "تم الشراء",
  "خسرنا الزبون",
];

export default function CustomerStatusSettings({ token, isAdmin }) {
  const [statuses, setStatuses] = useState([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const request = async (url, method = "GET", body) => {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "حدث خطأ");
    }

    return data;
  };

  const loadStatuses = async () => {
    const data = await request(API);
    setStatuses(data.statuses || []);
  };

  useEffect(() => {
    let active = true;

    if (!token) {
      setLoading(false);
      setError("يرجى تسجيل الدخول");
      return;
    }

    request(API)
      .then((data) => {
        if (active) setStatuses(data.statuses || []);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const execute = async (action, successMessage) => {
    if (busy || !isAdmin) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await action();
      await loadStatuses();
      setMessage(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addStatus = async (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    await execute(async () => {
      await request(API, "POST", { name });
      setNewName("");
    }, "تمت إضافة الحالة بنجاح");
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name) return;

    await execute(async () => {
      await request(`${API}/${editingId}`, "PUT", { name });
      setEditingId(null);
    }, "تم تعديل اسم الحالة");
  };

  const toggleStatus = async (status) => {
    const active = Number(status.is_active) === 1;

    if (!window.confirm(
      `هل تريدين ${active ? "تعطيل" : "تفعيل"} حالة "${status.name}"؟`
    )) return;

    await execute(
      () => request(`${API}/${status.id}/status`, "PATCH", {
        is_active: !active,
      }),
      active ? "تم تعطيل الحالة" : "تم تفعيل الحالة"
    );
  };

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <p style={{ color: "#64748b" }}>
        إدارة حالات العملاء المرتبطة بقاعدة البيانات.
      </p>

      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#15803d" }}>{message}</p>}

      {isAdmin && (
        <form onSubmit={addStatus} style={{
          display: "flex", gap: 10, flexWrap: "wrap",
          padding: 16, background: "#faf7f2",
          borderRadius: 12,
        }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم الحالة الجديدة"
            maxLength={100}
            required
            style={{
              flex: 1, minWidth: 180, padding: 12,
              border: "1px solid #d9c9b4", borderRadius: 8,
            }}
          />
          <button type="submit" disabled={busy}>
            + إضافة حالة
          </button>
        </form>
      )}

      {loading ? (
        <p>جارٍ تحميل الحالات...</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {statuses.map((status) => {
            const active = Number(status.is_active) === 1;
            const protectedStatus = protectedNames.includes(status.name);

            return (
              <div key={status.id} style={{
                border: "1px solid #e5d8c7",
                borderRadius: 10, padding: 14,
                display: "flex", alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap", gap: 12,
              }}>
                {editingId === status.id ? (
                  <form onSubmit={saveEdit} style={{
                    display: "flex", gap: 8, flex: 1,
                  }}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={100}
                      required
                      style={{ flex: 1, padding: 8 }}
                    />
                    <button disabled={busy}>حفظ</button>
                    <button type="button" onClick={() => setEditingId(null)}>
                      إلغاء
                    </button>
                  </form>
                ) : (
                  <>
                    <div>
                      <strong>{status.name}</strong>
                      <span style={{
                        marginRight: 12,
                        color: active ? "#15803d" : "#b91c1c",
                      }}>
                        {active ? "● نشطة" : "● معطّلة"}
                      </span>
                    </div>

                    {isAdmin && (
                      <div style={{ display: "flex", gap: 8 }}>
                        {!protectedStatus && (
                          <button type="button" disabled={busy}
                            onClick={() => {
                              setEditingId(status.id);
                              setEditName(status.name);
                            }}>
                            تعديل
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busy || (protectedStatus && active)}
                          onClick={() => toggleStatus(status)}
                        >
                          {active ? "تعطيل" : "تفعيل"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 13, color: "#64748b" }}>
        الحالات الأساسية المرتبطة بالنظام محمية من التعديل والتعطيل.
        إضافة حالة جديدة هنا لا تجعلها متاحة للعملاء حتى نربط
        صفحة العملاء بالـ API.
      </p>
    </div>
  );
}
