
const express = require("express");
const db = require("./db");
const { verifyToken } = require("./auth");

const router = express.Router();

const PROTECTED_STATUSES = [
  "جديد",
  "بحاجة لمتابعة",
  "تم الشراء",
  "خسرنا الزبون"
];

router.use(verifyToken);

// Verify the account and permissions from MySQL
router.use(async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT role, is_active
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    const user = rows[0];

    if (!user || Number(user.is_active) !== 1) {
      return res.status(403).json({
        success: false,
        message: "الحساب غير مفعل"
      });
    }

    req.statusRole = user.role;
    next();
  } catch (error) {
    console.error("Status authorization error:", error.message);
    res.status(500).json({
      success: false,
      message: "خطأ في السيرفر"
    });
  }
});

// GET - All statuses for settings
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, is_active, sort_order
       FROM customer_statuses
       ORDER BY sort_order, id`
    );

    res.json({ success: true, statuses: rows });
  } catch (error) {
    console.error("Get statuses error:", error.message);
    res.status(500).json({
      success: false,
      message: "تعذر تحميل الحالات"
    });
  }
});

// Only the general manager can modify statuses
router.use((req, res, next) => {
  if (req.statusRole !== "admin") {
    return res.status(403).json({
      success: false,
      message: "هذه العملية للمدير العام فقط"
    });
  }
  next();
});

// POST - Add a status
router.post("/", async (req, res) => {
  const name = req.body?.name?.trim();

  if (typeof name !== "string" || !name || name.length > 100) {
    return res.status(400).json({
      success: false,
      message: "اسم الحالة غير صالح"
    });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO customer_statuses (name, sort_order)
       SELECT ?, COALESCE(MAX(sort_order), 0) + 1
       FROM customer_statuses`,
      [name]
    );

    res.status(201).json({
      success: true,
      id: result.insertId
    });
  } catch (error) {
    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      success: false,
      message: error.code === "ER_DUP_ENTRY"
        ? "هذه الحالة موجودة مسبقاً"
        : "تعذر إضافة الحالة"
    });
  }
});

// PUT - Rename a status
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const name = req.body?.name;

  if (!Number.isSafeInteger(id) || id <= 0 ||
      typeof name !== "string" || !name.trim() ||
      name.trim().length > 100) {
    return res.status(400).json({
      success: false,
      message: "البيانات غير صالحة"
    });
  }

  try {
    const [rows] = await db.execute(
      "SELECT name FROM customer_statuses WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "الحالة غير موجودة"
      });
    }

    if (PROTECTED_STATUSES.includes(rows[0].name)) {
      return res.status(409).json({
        success: false,
        message: "هذه حالة أساسية مرتبطة بالمتابعات ولا يمكن تغيير اسمها"
      });
    }

    // Prevent renaming a status already used by customers.
    const [used] = await db.execute(
      "SELECT COUNT(*) AS total FROM customers WHERE status = ?",
      [rows[0].name]
    );

    if (Number(used[0].total) > 0) {
      return res.status(409).json({
        success: false,
        message: "الحالة مستخدمة عند عملاء. غيّري حالاتهم أولاً."
      });
    }

    await db.execute(
      "UPDATE customer_statuses SET name = ? WHERE id = ?",
      [name.trim(), id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      success: false,
      message: error.code === "ER_DUP_ENTRY"
        ? "الاسم موجود مسبقاً"
        : "تعذر تعديل الحالة"
    });
  }
});

// PATCH - Enable or disable a status
router.patch("/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const active = req.body?.is_active;

  if (!Number.isSafeInteger(id) || id <= 0 ||
      typeof active !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "البيانات غير صالحة"
    });
  }

  try {
    const [rows] = await db.execute(
      "SELECT name FROM customer_statuses WHERE id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "الحالة غير موجودة"
      });
    }

    if (!active && PROTECTED_STATUSES.includes(rows[0].name)) {
      return res.status(409).json({
        success: false,
        message: "لا يمكن تعطيل حالة أساسية مرتبطة بالنظام"
      });
    }

    await db.execute(
      "UPDATE customer_statuses SET is_active = ? WHERE id = ?",
      [active ? 1 : 0, id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "تعذر تغيير حالة التفعيل"
    });
  }
});

module.exports = router;
