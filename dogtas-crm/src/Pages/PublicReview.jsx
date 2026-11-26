
import { useEffect, useState } from "react";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  border: "1px solid #d8cbbb",
  borderRadius: 9,
  font: "inherit",
};

const cardStyle = {
  maxWidth: 560,
  margin: "45px auto",
  padding: 26,
  background: "#fff",
  borderRadius: 16,
  boxShadow: "0 8px 30px #00000012",
};

function StarRating({ title, value, onChange, required = false }) {
  return (
    <div style={{ margin: "18px 0" }}>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        {title} {required ? "*" : "(اختياري)"}
      </div>

      <div
        role="group"
        aria-label={title}
        style={{ display: "flex", gap: 9, flexWrap: "wrap" }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} من 5`}
            aria-pressed={value === n}
            onClick={() =>
              onChange(value === n && !required ? null : n)
            }
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 3,
              fontSize: 34,
              color:
                n <= (value || 0) ? "#d6a53e" : "#d3d3d3",
            }}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PublicReview() {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceRating, setServiceRating] = useState(0);
  const [employeeRating, setEmployeeRating] = useState(null);
  const [deliveryRating, setDeliveryRating] = useState(null);
  const [comment, setComment] = useState("");

  const token = window.location.pathname.match(
    /^\/review\/([a-f0-9]{64})\/?$/
  )?.[1];

  useEffect(() => {
    if (!token) {
      setError("رابط التقييم غير صالح");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadLink() {
      try {
        const response = await fetch(
          `/api/reviews/public/${token}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "تعذر فتح رابط التقييم"
          );
        }

        setLink(data.link);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(
            err.message || "حدث خطأ في الاتصال"
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadLink();

    return () => controller.abort();
  }, [token]);

  async function submit(e) {
    e.preventDefault();

    if (sending) return;

    if (link?.type === "branch" && !name.trim()) {
      setError("الرجاء كتابة الاسم");
      return;
    }

    if (!serviceRating) {
      setError("الرجاء تقييم الخدمة بالنجوم");
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await fetch(
        `/api/reviews/public/${token}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer_name:
              link?.type === "branch"
                ? name.trim()
                : undefined,
            customer_phone:
              link?.type === "branch"
                ? phone.trim()
                : undefined,
            service_rating: serviceRating,
            employee_rating: employeeRating,
            delivery_rating: deliveryRating,
            comment: comment.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "تعذر إرسال التقييم"
        );
      }

      setDone(true);
    } catch (err) {
      setError(
        err.message || "حدث خطأ، حاولي مرة أخرى"
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f7f3ee",
        padding: "18px",
        fontFamily: "Tahoma, Arial, sans-serif",
        color: "#493a2b",
      }}
    >
      <section style={cardStyle}>
        <div
          style={{
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <h1 style={{ marginBottom: 8 }}>
            DOĞTAŞ
          </h1>

          <h2
            style={{
              fontSize: 22,
              marginBottom: 8,
            }}
          >
            تقييم تجربتك معنا
          </h2>

          {link?.branch && (
            <p>فرع {link.branch}</p>
          )}
        </div>

        {loading ? (
          <p>جاري التحقق من رابط التقييم...</p>
        ) : done ? (
          <div
            role="status"
            style={{
              textAlign: "center",
              padding: "25px 0",
            }}
          >
            <div style={{ fontSize: 46 }}>✓</div>
            <h3>شكراً لإرسال تقييمك!</h3>
            <p>
              تم استلام رأيك بنجاح، وهو بانتظار المراجعة.
            </p>
          </div>
        ) : !link ? (
          <p
            role="alert"
            style={{ color: "#b42318" }}
          >
            {error || "الرابط غير متاح"}
          </p>
        ) : (
          <form onSubmit={submit}>
            <p>
              رأيك بيساعدنا نحسّن خدماتنا.
              التقييم من نجمة إلى خمس نجوم.
            </p>

            {link.type === "branch" && (
              <>
                <label
                  style={{
                    display: "block",
                    marginBottom: 12,
                  }}
                >
                  الاسم *
                  <input
                    style={{
                      ...fieldStyle,
                      marginTop: 6,
                    }}
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    maxLength={150}
                    required
                    placeholder="اسمك"
                  />
                </label>

                <label
                  style={{
                    display: "block",
                    marginBottom: 12,
                  }}
                >
                  رقم الهاتف (اختياري)
                  <input
                    style={{
                      ...fieldStyle,
                      marginTop: 6,
                    }}
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value)
                    }
                    maxLength={30}
                    type="tel"
                    placeholder="رقم الهاتف"
                  />
                </label>
              </>
            )}

            {link.type === "customer" && (
              <p>
                هذا رابط تقييم خاص بك.
                سيتم ربط التقييم بملفك دون عرض بياناتك الشخصية.
              </p>
            )}

            <StarRating
              title="تقييم الخدمة"
              value={serviceRating}
              onChange={setServiceRating}
              required
            />

            <StarRating
              title="تقييم الموظف"
              value={employeeRating}
              onChange={setEmployeeRating}
            />

            <StarRating
              title="تقييم التوصيل والتركيب"
              value={deliveryRating}
              onChange={setDeliveryRating}
            />

            <label
              style={{
                display: "block",
                margin: "18px 0",
              }}
            >
              ملاحظاتك (اختياري)
              <textarea
                style={{
                  ...fieldStyle,
                  marginTop: 6,
                  minHeight: 100,
                  resize: "vertical",
                }}
                value={comment}
                onChange={(e) =>
                  setComment(e.target.value)
                }
                maxLength={3000}
                placeholder="خبرنا عن تجربتك..."
              />
            </label>

            {error && (
              <p
                role="alert"
                style={{ color: "#b42318" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={sending}
              style={{
                width: "100%",
                padding: 14,
                background: "#493a2b",
                color: "white",
                border: 0,
                borderRadius: 9,
                fontSize: 16,
                cursor: sending
                  ? "wait"
                  : "pointer",
              }}
            >
              {sending
                ? "جاري الإرسال..."
                : "إرسال التقييم"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
