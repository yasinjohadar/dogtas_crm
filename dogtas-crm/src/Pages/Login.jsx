
import { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const colors = {
    cream: "#FAF7F2",
    beige: "#EDE3D4",
    gold: "#B08A4A",
    goldDark: "#89672F",
    brown: "#493A2B",
    muted: "#786B5D",
    border: "#E5D9C9"
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.token) {
        throw new Error(
          response.status === 429
            ? "محاولات كثيرة. انتظري 15 دقيقة."
            : response.status === 401
            ? "اسم المستخدم أو كلمة المرور غير صحيحة"
            : data.message || "تعذر تسجيل الدخول"
        );
      }

      onLogin({
        token: data.token,
        user: data.user
      });
    } catch (err) {
      setError(err.message || "تعذر الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "13px 15px",
    marginTop: "9px",
    border: `1px solid ${colors.border}`,
    borderRadius: "10px",
    background: "#FFFFFF",
    color: colors.brown,
    boxSizing: "border-box",
    fontSize: "14px",
    outlineColor: colors.gold
  };

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.cream,
        padding: "24px",
        fontFamily: "Tahoma, Arial, sans-serif"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#FFFFFF",
          padding: "clamp(24px, 5vw, 42px)",
          borderRadius: "22px",
          border: `1px solid ${colors.border}`,
          boxShadow: "0 14px 45px rgba(73,58,43,0.09)"
        }}
      >
        
{/* Branding */}
<div
  style={{
    textAlign: "center",
    marginBottom: "30px"
  }}
>
  <img
    src="/logor.jpeg"
    alt="Doğtaş Logo"
    style={{
      display: "block",
      width: "190px",
      maxWidth: "100%",
      height: "auto",
      objectFit: "contain",
      margin: "0 auto 20px",
      borderRadius: "8px"
    }}
  />

  <h1
    style={{
      color: colors.brown,
      fontSize: "27px",
      margin: "0 0 8px",
      fontWeight: "bold",
      letterSpacing: "0.5px"
    }}
  >
    DOĞTAŞ CRM
  </h1>

  <p
    style={{
      color: colors.muted,
      fontSize: "13px",
      margin: 0
    }}
  >
    نظام إدارة العملاء والمبيعات
  </p>
</div>


        <div
          style={{
            height: "1px",
            background: colors.border,
            marginBottom: "28px"
          }}
        />

        <h2
          style={{
            color: colors.brown,
            fontSize: "21px",
            margin: "0 0 8px"
          }}
        >
          تسجيل الدخول
        </h2>

        <p
          style={{
            color: colors.muted,
            fontSize: "13px",
            margin: "0 0 25px"
          }}
        >
          أدخلي بيانات حسابك للوصول إلى النظام
        </p>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <label
            style={{
              display: "block",
              marginBottom: "19px",
              color: colors.brown,
              fontSize: "13px",
              fontWeight: "bold"
            }}
          >
            اسم المستخدم

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="أدخلي اسم المستخدم"
              required
              style={inputStyle}
            />
          </label>

          {/* Password */}
          <label
            style={{
              display: "block",
              marginBottom: "22px",
              color: colors.brown,
              fontSize: "13px",
              fontWeight: "bold"
            }}
          >
            كلمة المرور

            <div
              style={{
                position: "relative",
                marginTop: "9px"
              }}
            >
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="أدخلي كلمة المرور"
                required
                style={{
                  ...inputStyle,
                  marginTop: 0,
                  paddingLeft: "62px"
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={
                  showPassword
                    ? "إخفاء كلمة المرور"
                    : "إظهار كلمة المرور"
                }
                aria-pressed={showPassword}
                title={
                  showPassword
                    ? "إخفاء كلمة المرور"
                    : "إظهار كلمة المرور"
                }
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  color: colors.goldDark,
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: "bold",
                  padding: "6px"
                }}
              >
                {showPassword ? "إخفاء" : "👁 إظهار"}
              </button>
            </div>
          </label>

          {/* Error */}
          {error && (
            <p
              role="alert"
              style={{
                color: "#A13E38",
                background: "#FFF2EF",
                padding: "12px",
                borderRadius: "10px",
                fontSize: "13px",
                marginBottom: "18px"
              }}
            >
              {error}
            </p>
          )}

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading
                ? colors.goldDark
                : colors.gold,
              color: "#FFFFFF",
              border: "none",
              borderRadius: "10px",
              cursor: loading ? "wait" : "pointer",
              fontSize: "15px",
              fontWeight: "bold",
              transition: "background 0.2s"
            }}
          >
            {loading
              ? "جارٍ تسجيل الدخول..."
              : "تسجيل الدخول"}
          </button>
        </form>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            marginTop: "30px",
            marginBottom: 0,
            paddingTop: "20px",
            borderTop: `1px solid ${colors.border}`,
            color: colors.muted,
            fontSize: "12px"
          }}
        >
          Doğtaş Syria © 2026
        </p>
      </div>
      
    </div>
    
  );
  
}


export default Login;
