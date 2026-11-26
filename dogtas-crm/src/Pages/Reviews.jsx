
import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const API = "/api/reviews";

export default function Reviews({ token }) {
  const [reviews, setReviews] = useState([]);
  const [branches, setBranches] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedType, setGeneratedType] = useState("");
  const [generatedName, setGeneratedName] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const qrRef = useRef(null);

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.message || `خطأ في الطلب (${response.status})`
      );
    }

    return data;
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [reviewData, branchData, customerData] =
        await Promise.all([
          request(API),
          request("/api/branches"),
          request("/api/customers"),
        ]);

      setReviews(
        Array.isArray(reviewData.reviews)
          ? reviewData.reviews
          : []
      );

      setBranches(
        Array.isArray(branchData.branches)
          ? branchData.branches
          : []
      );

      setCustomers(
        Array.isArray(customerData.customers)
          ? customerData.customers
          : []
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createLink(type) {
    const id =
      type === "branch"
        ? Number(branchId)
        : Number(customerId);

    if (!id) {
      setMessage(
        type === "branch"
          ? "اختاري الفرع أولاً"
          : "اختاري الزبون أولاً"
      );
      return;
    }

    setMessage("");
    setGeneratedLink("");
    setGeneratedType("");
    setGeneratedName("");
    setCreating(true);

    try {
      const data = await request(
        `${API}/links/${type}`,
        {
          method: "POST",
          body: JSON.stringify(
            type === "branch"
              ? { branch_id: id }
              : { customer_id: id }
          ),
        }
      );

      const url = new URL(
        data.path,
        window.location.origin
      ).href;

      setGeneratedLink(url);
      setGeneratedType(type);

      if (type === "branch") {
        const selected = branches.find(
          (item) => Number(item.id) === id
        );

        setGeneratedName(
          selected?.name || "الفرع"
        );
      } else {
        const selected = customers.find(
          (item) => Number(item.id) === id
        );

        setGeneratedName(
          selected?.full_name ||
            selected?.name ||
            `زبون ${id}`
        );
      }

      setMessage(
        "تم إنشاء الرابط بنجاح. احتفظي فيه لأنه لا يمكن استرجاعه لاحقاً."
      );
    } catch (error) {
      setMessage(error.message);
    } finally {
      setCreating(false);
    }
  }

  async function changeStatus(id, status) {
    try {
      await request(`${API}/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      setReviews((items) =>
        items.map((item) =>
          item.id === id
            ? { ...item, status }
            : item
        )
      );

      setMessage("تم تحديث حالة التقييم");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        generatedLink
      );

      setMessage("تم نسخ الرابط");
    } catch {
      setMessage(
        "تعذر النسخ التلقائي، انسخي الرابط من الحقل"
      );
    }
  }

  function downloadQR() {
    const canvas =
      qrRef.current?.querySelector("canvas");

    if (!canvas) {
      setMessage("تعذر العثور على QR Code");
      return;
    }

    try {
      const image = canvas.toDataURL("image/png");

      const download = document.createElement("a");
      download.href = image;

      const safeName = generatedName
        .replace(/[\\/:*?"<>|]/g, "-")
        .trim();

      download.download =
        `Dogtas-QR-${safeName || "review"}.png`;

      document.body.appendChild(download);
      download.click();
      download.remove();

      setMessage("تم تجهيز صورة QR للتحميل");
    } catch {
      setMessage("تعذر تحميل QR Code");
    }
  }

  const sectionStyle = {
    background: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    border: "1px solid #e5ded3",
  };

  const fieldStyle = {
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
    width: "100%",
    maxWidth: 460,
    margin: "10px 0",
    boxSizing: "border-box",
  };

  return (
    <div dir="rtl">
      <h2>⭐ تقييمات الزبائن</h2>

      <p>
        إنشاء روابط التقييم ومراجعة آراء العملاء
      </p>

      {message && (
        <p
          role="status"
          style={{ color: "#6b4d2e" }}
        >
          {message}
        </p>
      )}

      {/* Branch review link */}
      <section style={sectionStyle}>
        <h3>رابط تقييم عام للفرع</h3>

        <p>
          مناسب لطباعته كرمز QR داخل صالة العرض
          بعد نشر صفحة التقييم على الإنترنت.
        </p>

        <select
          style={fieldStyle}
          value={branchId}
          onChange={(e) =>
            setBranchId(e.target.value)
          }
        >
          <option value="">
            اختاري الفرع
          </option>

          {branches.map((branch) => (
            <option
              key={branch.id}
              value={branch.id}
            >
              {branch.name}
            </option>
          ))}
        </select>

        <div>
          <button
            className="crm-btn"
            type="button"
            disabled={creating}
            onClick={() => createLink("branch")}
          >
            {creating
              ? "جاري الإنشاء..."
              : "إنشاء رابط الفرع"}
          </button>
        </div>
      </section>

      {/* Private customer link */}
      <section style={sectionStyle}>
        <h3>رابط تقييم خاص لزبون</h3>

        <p>
          الرابط مخصص للزبون ويُستخدم مرة واحدة.
        </p>

        <select
          style={fieldStyle}
          value={customerId}
          onChange={(e) =>
            setCustomerId(e.target.value)
          }
        >
          <option value="">
            اختاري الزبون
          </option>

          {customers.map((customer) => (
            <option
              key={customer.id}
              value={customer.id}
            >
              {customer.full_name ||
                customer.name ||
                `زبون #${customer.id}`}
              {" — "}
              {customer.branch}
            </option>
          ))}
        </select>

        <div>
          <button
            className="crm-btn"
            type="button"
            disabled={creating}
            onClick={() => createLink("customer")}
          >
            {creating
              ? "جاري الإنشاء..."
              : "إنشاء رابط الزبون"}
          </button>
        </div>
      </section>

      {/* Generated link and QR */}
      {generatedLink && (
        <section style={sectionStyle}>
          <h3>الرابط الجديد</h3>

          <p>
            {generatedType === "branch"
              ? `رابط تقييم فرع ${generatedName}`
              : `رابط تقييم خاص بالزبون ${generatedName}`}
          </p>

          <input
            aria-label="رابط التقييم"
            readOnly
            value={generatedLink}
            style={fieldStyle}
            onFocus={(e) =>
              e.target.select()
            }
          />

          <div>
            <button
              className="crm-btn secondary"
              type="button"
              onClick={copyLink}
            >
              نسخ الرابط
            </button>
          </div>

          <div
            style={{
              textAlign: "center",
              marginTop: 25,
              padding: 20,
              background: "#f7f3ee",
              borderRadius: 12,
            }}
          >
            <h2
              style={{
                color: "#493a2b",
                marginBottom: 5,
              }}
            >
              DOĞTAŞ
            </h2>

            <h3>
              {generatedType === "branch"
                ? `فرع ${generatedName}`
                : "تقييم خاص للزبون"}
            </h3>

            <p>قيّم تجربتك معنا</p>

            <div
              ref={qrRef}
              style={{
                display: "inline-block",
                background: "#fff",
                padding: 14,
                borderRadius: 12,
              }}
            >
              <QRCodeCanvas
                value={generatedLink}
                size={220}
                level="H"
                marginSize={2}
                bgColor="#ffffff"
                fgColor="#493a2b"
              />
            </div>

            <p
              style={{
                fontSize: 13,
                color: "#786b5d",
              }}
            >
              امسح الكود لفتح صفحة التقييم
            </p>

            <button
              className="crm-btn"
              type="button"
              onClick={downloadQR}
            >
              تحميل QR Code
            </button>
          </div>

          <p
            style={{
              marginTop: 15,
              fontSize: 13,
              color: "#a16207",
            }}
          >
            تنبيه: الرابط الحالي يعمل على جهازك فقط
            إذا كان عنوانه localhost. لا تطبعي
            الكود للاستخدام العام قبل نشر صفحة
            التقييم على رابط متاح للزبائن.
          </p>
        </section>
      )}

      {/* Incoming reviews */}
      <section style={sectionStyle}>
        <h3>التقييمات الواردة</h3>

        <button
          className="crm-btn secondary"
          type="button"
          onClick={loadData}
          disabled={loading}
        >
          {loading
            ? "جاري التحميل..."
            : "تحديث التقييمات"}
        </button>

        <div
          className="table-wrap"
          style={{ marginTop: 14 }}
        >
          <table>
            <thead>
              <tr>
                <th>الزبون</th>
                <th>الفرع</th>
                <th>الخدمة</th>
                <th>الموظف</th>
                <th>التوصيل</th>
                <th>التعليق</th>
                <th>الحالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>

            <tbody>
              {reviews.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    لا توجد تقييمات حالياً
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      {review.customer_name}
                    </td>

                    <td>
                      {review.branch_name ||
                        review.branch ||
                        review.branch_id ||
                        "—"}
                    </td>

                    <td>
                      {review.service_rating ?? "—"} ⭐
                    </td>

                    <td>
                      {review.employee_rating ?? "—"}
                    </td>

                    <td>
                      {review.delivery_rating ?? "—"}
                    </td>

                    <td>
                      {review.comment || "—"}
                    </td>

                    <td>
                      {review.status}
                    </td>

                    <td>
                      <button
                        type="button"
                        onClick={() =>
                          changeStatus(
                            review.id,
                            "approved"
                          )
                        }
                      >
                        موافقة
                      </button>
                      {" "}
                      <button
                        type="button"
                        onClick={() =>
                          changeStatus(
                            review.id,
                            "rejected"
                          )
                        }
                      >
                        رفض
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
