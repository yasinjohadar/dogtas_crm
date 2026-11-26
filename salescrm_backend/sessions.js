
const express = require("express");
const db = require("./db");
const { verifyToken } = require("./auth");

const router = express.Router();

router.use(verifyToken);

// List active sessions
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         id,
         device_info,
         ip_address,
         created_at,
         expires_at
       FROM user_sessions
       WHERE user_id = ?
         AND revoked_at IS NULL
         AND expires_at > UTC_TIMESTAMP()
       ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      sessions: rows.map((session) => ({
        ...session,
        is_current:
          Number(session.id) === Number(req.user.sessionId)
      }))
    });
  } catch (error) {
    console.error("List sessions error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذر تحميل الجلسات"
    });
  }
});

// Revoke one session
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: "رقم الجلسة غير صالح"
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE user_sessions
       SET revoked_at = UTC_TIMESTAMP()
       WHERE id = ?
         AND user_id = ?
         AND revoked_at IS NULL`,
      [id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "الجلسة غير موجودة أو ملغاة"
      });
    }

    return res.json({
      success: true,
      message: "تم إلغاء الجلسة بنجاح"
    });
  } catch (error) {
    console.error("Revoke session error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذر إلغاء الجلسة"
    });
  }
});

// Revoke all sessions
router.delete("/", async (req, res) => {
  try {
    await db.execute(
      `UPDATE user_sessions
       SET revoked_at = UTC_TIMESTAMP()
       WHERE user_id = ?
         AND revoked_at IS NULL`,
      [req.user.id]
    );

    return res.json({
      success: true,
      message: "تم تسجيل الخروج من جميع الأجهزة"
    });
  } catch (error) {
    console.error("Revoke all sessions error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذر إلغاء الجلسات"
    });
  }
});

module.exports = router;
