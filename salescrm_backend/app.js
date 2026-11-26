
require("dotenv").config();

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { rateLimit } = require("express-rate-limit");

const db = require("./db");
const { verifyToken, allowRoles } = require("./auth");

// API routes
const customersRoutes = require("./customers");
const employeesRoutes = require("./employees");
const usersRoutes = require("./users");
const salesRoutes = require("./sales");
const branchesRoutes = require("./branches");
const reviewsRoutes = require("./reviews");
const customerStatusesRoutes = require("./customerStatuses");
const sessionsRoutes = require("./sessions");

const app = express();

// Behind Coolify reverse proxy (Traefik): use real client IP
app.set("trust proxy", 1);

// Parse JSON requests
app.use(express.json({ limit: "10kb" }));

// Check JWT secret
if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing");
}

// Login rate limiter
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Try again shortly."
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Dogtas CRM Backend"
  });
});

// Login API
app.post("/api/login", loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required"
      });
    }

    // Find user
    const [rows] = await db.execute(
      `SELECT
        id,
        full_name,
        username,
        password_hash,
        role,
        is_active,
        token_version
       FROM users
       WHERE username = ?
       LIMIT 1`,
      [username.trim()]
    );

    const user = rows[0];

    // Verify password
    const validPassword = user
      ? await bcrypt.compare(
          password,
          user.password_hash
        )
      : false;

    // Reject invalid or inactive accounts
    if (
      !user ||
      !validPassword ||
      Number(user.is_active) !== 1
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Generate a unique JWT for every login
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        token_version: Number(user.token_version),
        jti: crypto.randomUUID()
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
        algorithm: "HS256"
      }
    );

    // Create a SHA-256 fingerprint of the JWT
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // Read expiration time from signed JWT
    const decodedToken = jwt.decode(token);

    if (
      !decodedToken ||
      !Number.isInteger(decodedToken.exp)
    ) {
      throw new Error("Unable to determine token expiration");
    }

    const expiresAt = new Date(decodedToken.exp * 1000);

    // Store expiration in MySQL as UTC
    const expiresAtSql = expiresAt
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // Save the login session
    await db.execute(
      `INSERT INTO user_sessions
       (
         user_id,
         token_hash,
         device_info,
         ip_address,
         expires_at
       )
       VALUES (?, ?, ?, ?, ?)`,
      [
        user.id,
        tokenHash,
        req.get("user-agent")?.slice(0, 255) || null,
        req.ip?.slice(0, 45) || null,
        expiresAtSql
      ]
    );

    // Login response
    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Protected route: current user
app.get("/api/me", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
        id,
        full_name,
        username,
        role,
        branch,
        employee_id,
        is_active
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    const user = rows[0];

    if (!user || Number(user.is_active) !== 1) {
      return res.status(401).json({
        success: false,
        message: "User account is inactive or unavailable"
      });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
        branch: user.branch,
        employee_id: user.employee_id
      }
    });

  } catch (error) {
    console.error("Current user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Password change rate limiter
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "محاولات كثيرة، يرجى المحاولة لاحقاً"
  }
});

// Change current user's password
app.put(
  "/api/change-password",
  verifyToken,
  passwordLimiter,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};

      if (
        typeof currentPassword !== "string" ||
        typeof newPassword !== "string" ||
        !currentPassword ||
        newPassword.length < 12 ||
        Buffer.byteLength(newPassword, "utf8") > 72
      ) {
        return res.status(400).json({
          success: false,
          message: "كلمة المرور الجديدة يجب أن تكون بين 12 حرفاً و72 بايت"
        });
      }

      if (currentPassword === newPassword) {
        return res.status(400).json({
          success: false,
          message: "كلمة المرور الجديدة يجب أن تختلف عن الحالية"
        });
      }

      const [rows] = await db.execute(
        `SELECT id, password_hash, is_active
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [req.user.id]
      );

      const user = rows[0];

      if (!user || Number(user.is_active) !== 1) {
        return res.status(401).json({
          success: false,
          message: "الحساب غير متاح"
        });
      }

      const isValid = await bcrypt.compare(
        currentPassword,
        user.password_hash
      );

      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: "كلمة المرور الحالية غير صحيحة"
        });
      }

      const newHash = await bcrypt.hash(newPassword, 12);

      await db.execute(
        `UPDATE users
         SET password_hash = ?,
             token_version = COALESCE(token_version, 0) + 1
         WHERE id = ?`,
        [newHash, user.id]
      );

      // Revoke previously stored sessions
      await db.execute(
        `UPDATE user_sessions
         SET revoked_at = UTC_TIMESTAMP()
         WHERE user_id = ?
           AND revoked_at IS NULL`,
        [user.id]
      );

      return res.json({
        success: true,
        message: "تم تغيير كلمة المرور. يرجى تسجيل الدخول مجدداً"
      });

    } catch (error) {
      console.error("Change password error:", error.message);

      return res.status(500).json({
        success: false,
        message: "حدث خطأ أثناء تغيير كلمة المرور"
      });
    }
  }
);

// Protected route: admin only
app.get(
  "/api/admin",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT id, role, is_active
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [req.user.id]
      );

      const user = rows[0];

      if (
        !user ||
        Number(user.is_active) !== 1 ||
        user.role !== "admin"
      ) {
        return res.status(403).json({
          success: false,
          message: "Access denied"
        });
      }

      return res.json({
        success: true,
        message: "Welcome Admin",
        user: {
          id: user.id,
          role: user.role
        }
      });

    } catch (error) {
      console.error("Admin route error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }
);

// Customers API
app.use("/api/customers", customersRoutes);

// Employees API
app.use("/api/employees", employeesRoutes);

// Employee login accounts API
app.use("/api/users", usersRoutes);

// Sales API
app.use("/api/sales", salesRoutes);

// Branches API
app.use("/api/branches", branchesRoutes);

// Reviews API
app.use("/api/reviews", reviewsRoutes);

// Customer statuses API
app.use("/api/customer-statuses", customerStatusesRoutes);

// Sessions API
if (typeof sessionsRoutes !== "function") {
  throw new TypeError(
    "sessions.js must export an Express router using module.exports = router"
  );
}

app.use("/api/sessions", sessionsRoutes);

// Serve React frontend
const frontendPath = path.join(__dirname, "public");

app.use(express.static(frontendPath));

// Return JSON for unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found"
  });
});

// React SPA fallback
app.get("/{*path}", (req, res) => {
  res.sendFile(
    path.join(frontendPath, "index.html")
  );
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Dogtas CRM Backend started");
});
