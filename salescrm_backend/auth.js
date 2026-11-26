
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("./db");

// Verify JWT and its database session
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token is missing"
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"]
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }

  if (
    !decoded ||
    !Number.isInteger(decoded.id) ||
    typeof decoded.role !== "string" ||
    !Number.isInteger(decoded.token_version)
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }

  try {
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const [rows] = await db.execute(
      `SELECT
         u.id,
         u.role,
         u.token_version,
         u.is_active,
         s.id AS session_id
       FROM users u
       INNER JOIN user_sessions s
         ON s.user_id = u.id
       WHERE u.id = ?
         AND s.token_hash = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > UTC_TIMESTAMP()
       LIMIT 1`,
      [decoded.id, tokenHash]
    );

    const user = rows[0];

    if (
      !user ||
      Number(user.is_active) !== 1 ||
      user.role !== decoded.role ||
      Number(user.token_version) !== decoded.token_version
    ) {
      return res.status(401).json({
        success: false,
        message: "Session revoked or account inactive"
      });
    }

    req.user = {
      id: decoded.id,
      role: user.role,
      sessionId: user.session_id
    };

    next();
  } catch (error) {
    console.error("Session verification error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify session"
    });
  }
}

// Restrict access based on user role
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    next();
  };
}

module.exports = {
  verifyToken,
  allowRoles
};
