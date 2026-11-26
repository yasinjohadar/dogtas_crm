
const express = require("express");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");
const db = require("./db");
const { verifyToken } = require("./auth");

const router = express.Router();

const tokenHash = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const newToken = () =>
  crypto.randomBytes(32).toString("hex");
const getEncryptionKey = () => {
  const hex = process.env.REVIEW_TOKEN_ENCRYPTION_KEY;

  if (!hex || !/^[a-f0-9]{64}$/i.test(hex)) {
    throw new Error("Invalid REVIEW_TOKEN_ENCRYPTION_KEY");
  }

  return Buffer.from(hex, "hex");
};

const encryptToken = (token) => {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    iv
  );

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex")
  ].join(":");
};

const decryptToken = (value) => {
  const [ivHex, tagHex, dataHex] = value.split(":");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex")
  );

  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final()
  ]).toString("utf8");
};
const isId = (value) =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;

const validRating = (value, optional = false) =>
  (optional &&
    (value === null || value === undefined || value === "")) ||
  (Number.isInteger(value) && value >= 1 && value <= 5);

// حماية طلبات التقييم العامة
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "محاولات كثيرة، يرجى المحاولة لاحقاً",
  },
});

// فحص خدمة التقييمات
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Reviews API is working",
  });
});

// التحقق من رابط تقييم عام
router.get("/public/:token", publicLimiter, async (req, res) => {
  try {
    const token = req.params.token;

    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(404).json({
        success: false,
        message: "الرابط غير صالح",
      });
    }

    const [rows] = await db.execute(
      `SELECT
         rl.id,
         rl.link_type,
         rl.customer_id,
         rl.is_active,
         rl.expires_at,
         rl.max_uses,
         rl.use_count,
         b.name AS branch_name,
         b.is_active AS branch_active
       FROM review_links rl
       JOIN branches b ON b.id = rl.branch_id
       WHERE rl.token_hash = ?
       LIMIT 1`,
      [tokenHash(token)]
    );

    const link = rows[0];

    if (
      !link ||
      !Number(link.is_active) ||
      !Number(link.branch_active) ||
      (link.expires_at &&
        new Date(link.expires_at) <= new Date()) ||
      (link.max_uses !== null &&
        link.use_count >= link.max_uses)
    ) {
      return res.status(404).json({
        success: false,
        message: "الرابط غير متاح أو منتهي الصلاحية",
      });
    }

    return res.json({
      success: true,
      link: {
        type: link.link_type,
        branch: link.branch_name,
      },
    });
  } catch (error) {
    console.error("Review public link error:", error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم",
    });
  }
});

// إرسال تقييم من الزبون
router.post("/public/:token", publicLimiter, async (req, res) => {
  const token = req.params.token;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(404).json({
      success: false,
      message: "الرابط غير صالح",
    });
  }

  const {
    customer_name,
    customer_phone,
    service_rating,
    employee_rating,
    delivery_rating,
    comment,
  } = req.body || {};

  if (
    !validRating(service_rating) ||
    !validRating(employee_rating, true) ||
    !validRating(delivery_rating, true) ||
    (customer_name !== undefined &&
      (typeof customer_name !== "string" ||
        customer_name.trim().length > 150)) ||
    (customer_phone !== undefined &&
      customer_phone !== null &&
      (typeof customer_phone !== "string" ||
        customer_phone.length > 30)) ||
    (comment !== undefined &&
      comment !== null &&
      (typeof comment !== "string" ||
        comment.length > 3000))
  ) {
    return res.status(400).json({
      success: false,
      message: "بيانات التقييم غير صالحة",
    });
  }

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT
         rl.*,
         b.is_active AS branch_active
       FROM review_links rl
       JOIN branches b ON b.id = rl.branch_id
       WHERE rl.token_hash = ?
       FOR UPDATE`,
      [tokenHash(token)]
    );

    const link = rows[0];

    if (
      !link ||
      !Number(link.is_active) ||
      !Number(link.branch_active) ||
      (link.expires_at &&
        new Date(link.expires_at) <= new Date()) ||
      (link.max_uses !== null &&
        link.use_count >= link.max_uses)
    ) {
      await connection.rollback();

      return res.status(410).json({
        success: false,
        message: "الرابط غير متاح أو تم استخدامه",
      });
    }

    let name =
      typeof customer_name === "string"
        ? customer_name.trim()
        : "";

    let phone =
      typeof customer_phone === "string"
        ? customer_phone.trim()
        : null;

    let employeeId = null;

    if (link.link_type === "customer") {
      const [customers] = await connection.execute(
        `SELECT full_name, phone, employee_id
         FROM customers
         WHERE id = ?
         LIMIT 1`,
        [link.customer_id]
      );

      if (!customers.length) {
        await connection.rollback();

        return res.status(410).json({
          success: false,
          message: "بيانات الزبون غير متاحة",
        });
      }

      name = customers[0].full_name;
      phone = customers[0].phone;
      employeeId = customers[0].employee_id;
    } else if (!name) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "اسم الزبون مطلوب",
      });
    }

    await connection.execute(
      `INSERT INTO customer_reviews
       (
         customer_id,
         branch_id,
         employee_id,
         customer_name,
         customer_phone,
         service_rating,
         employee_rating,
         delivery_rating,
         comment,
         review_source,
         review_link_id,
         status
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'customer', ?, 'pending')`,
      [
        link.customer_id,
        link.branch_id,
        employeeId,
        name,
        phone,
        service_rating,
        employee_rating ?? null,
        delivery_rating ?? null,
        typeof comment === "string" ? comment.trim() : null,
        link.id,
      ]
    );

    await connection.execute(
      `UPDATE review_links
       SET use_count = use_count + 1
       WHERE id = ?`,
      [link.id]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "شكراً لك، تم استلام تقييمك",
    });
  } catch (error) {
    if (connection) {
      await connection.rollback().catch(() => {});
    }

    console.error("Submit review error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذّر حفظ التقييم",
    });
  } finally {
    if (connection) connection.release();
  }
});

// جميع المسارات التالية للمدير العام فقط
router.use(verifyToken);

router.use(async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT role, is_active
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    if (
      !rows.length ||
      rows[0].role !== "admin" ||
      Number(rows[0].is_active) !== 1
    ) {
      return res.status(403).json({
        success: false,
        message: "غير مصرح لك بإدارة روابط التقييم",
      });
    }

    next();
  } catch (error) {
    console.error("Review admin auth error:", error);

    return res.status(500).json({
      success: false,
      message: "حدث خطأ في الخادم",
    });
  }
});

// عرض روابط تقييم الفروع المحفوظة
router.get("/links/branches", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         rl.id,
         rl.branch_id,
         b.name AS branch_name,
         rl.is_active,
         rl.use_count,
         rl.created_at
       FROM review_links rl
       JOIN branches b ON b.id = rl.branch_id
       WHERE rl.link_type = 'branch'
       ORDER BY rl.branch_id, rl.id`
    );

    return res.json({
      success: true,
      links: rows,
    });
  } catch (error) {
    console.error("List branch links error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذّر تحميل روابط الفروع",
    });
  }
});

// التأكد من أن QR تابع للفرع الصحيح
router.post("/links/branch/verify", async (req, res) => {
  const { branch_id, token } = req.body || {};

  if (
    !isId(branch_id) ||
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return res.status(400).json({
      success: false,
      message: "بيانات الرابط غير صالحة",
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT
         rl.id,
         rl.branch_id,
         b.name AS branch_name,
         rl.is_active,
         b.is_active AS branch_active,
         rl.expires_at,
         rl.max_uses,
         rl.use_count
       FROM review_links rl
       JOIN branches b ON b.id = rl.branch_id
       WHERE rl.token_hash = ?
         AND rl.link_type = 'branch'
       LIMIT 1`,
      [tokenHash(token)]
    );

    const link = rows[0];

    if (!link) {
      return res.status(404).json({
        success: false,
        message: "الرابط غير موجود كرابط فرع",
      });
    }

    if (Number(link.branch_id) !== Number(branch_id)) {
      return res.status(409).json({
        success: false,
        message: `الرابط تابع لفرع ${link.branch_name} وليس للفرع المحدد`,
        branch: link.branch_name,
      });
    }

    if (
      !Number(link.is_active) ||
      !Number(link.branch_active) ||
      (link.expires_at &&
        new Date(link.expires_at) <= new Date()) ||
      (link.max_uses !== null &&
        link.use_count >= link.max_uses)
    ) {
      return res.status(410).json({
        success: false,
        message: "الرابط غير مفعّل أو منتهي الصلاحية",
      });
    }

    return res.json({
      success: true,
      link_id: link.id,
      branch_id: link.branch_id,
      branch: link.branch_name,
      path: `/review/${token}`,
    });
  } catch (error) {
    console.error("Verify branch link error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذّر التحقق من الرابط",
    });
  }
});
console.log("SAVE EXISTING ROUTE LOADED");
// حفظ رابط QR موجود مسبقاً بشكل مشفّر
router.post("/links/branch/save-existing", async (req, res) => {
  const { branch_id, token } = req.body || {};

  if (
    !isId(branch_id) ||
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return res.status(400).json({
      success: false,
      message: "بيانات الرابط غير صالحة"
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT id, token_encrypted
       FROM review_links
       WHERE branch_id = ?
         AND link_type = 'branch'
         AND token_hash = ?
         AND is_active = 1
       LIMIT 1`,
      [Number(branch_id), tokenHash(token)]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "الرابط غير موجود أو لا يتبع هذا الفرع"
      });
    }

    if (rows[0].token_encrypted) {
      return res.json({
        success: true,
        message: "الرابط محفوظ مسبقاً"
      });
    }

    await db.execute(
      `UPDATE review_links
       SET token_encrypted = ?
       WHERE id = ? AND token_encrypted IS NULL`,
      [encryptToken(token), rows[0].id]
    );

    return res.json({
      success: true,
      message: "تم حفظ الرابط بشكل مشفّر"
    });
  } catch (error) {
    console.error("Save existing branch link error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذّر حفظ الرابط"
    });
  }
});
// إنشاء رابط تقييم لفرع
router.post("/links/branch", async (req, res) => {
  const { branch_id } = req.body || {};

  if (!isId(branch_id)) {
    return res.status(400).json({
      success: false,
      message: "رقم الفرع غير صالح",
    });
  }

  try {
    const [branches] = await db.execute(
      `SELECT id, name
       FROM branches
       WHERE id = ? AND is_active = 1
       LIMIT 1`,
      [Number(branch_id)]
    );

    if (!branches.length) {
      return res.status(404).json({
        success: false,
        message: "الفرع غير موجود أو غير نشط",
      });
    }

    const token = newToken();

    const [result] = await db.execute(
      `INSERT INTO review_links
       (
         branch_id,
         customer_id,
         link_type,
         token_hash,
         max_uses
       )
       VALUES (?, NULL, 'branch', ?, NULL)`,
      [Number(branch_id), tokenHash(token)]
    );

    return res.status(201).json({
      success: true,
      link_id: result.insertId,
      branch: branches[0].name,
      token,
      path: `/review/${token}`,
      message: "احتفظي بالرابط الآن؛ لا يمكن استرجاع الرمز لاحقاً",
    });
  } catch (error) {
    console.error("Create branch review link error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذّر إنشاء الرابط",
    });
  }
});

// إنشاء رابط تقييم خاص بزبون
router.post("/links/customer", async (req, res) => {
  const { customer_id } = req.body || {};

  if (!isId(customer_id)) {
    return res.status(400).json({
      success: false,
      message: "رقم الزبون غير صالح",
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT
         c.id,
         c.full_name,
         b.id AS branch_id
       FROM customers c
       JOIN branches b
         ON CONVERT(b.name USING utf8mb4)
            COLLATE utf8mb4_unicode_ci =
            CONVERT(c.branch USING utf8mb4)
            COLLATE utf8mb4_unicode_ci
        AND b.is_active = 1
       WHERE c.id = ?
       LIMIT 1`,
      [Number(customer_id)]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "الزبون أو فرعه غير متاح",
      });
    }

    const token = newToken();

    const [result] = await db.execute(
      `INSERT INTO review_links
       (
         branch_id,
         customer_id,
         link_type,
         token_hash,
         expires_at,
         max_uses
       )
       VALUES
       (?, ?, 'customer', ?, DATE_ADD(NOW(), INTERVAL 30 DAY), 1)`,
      [
        rows[0].branch_id,
        Number(customer_id),
        tokenHash(token),
      ]
    );

    return res.status(201).json({
      success: true,
      link_id: result.insertId,
      customer: rows[0].full_name,
      token,
      path: `/review/${token}`,
      message: "الرابط صالح لمدة 30 يوماً ولاستخدام واحد فقط",
    });
  } catch (error) {
    console.error("Create customer review link error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذّر إنشاء الرابط",
    });
  }
});

// عرض جميع تقييمات الزبائن
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         cr.id,
         cr.customer_name,
         cr.service_rating,
         cr.employee_rating,
         cr.delivery_rating,
         cr.comment,
         cr.status,
         cr.created_at,
         b.name AS branch,
         cr.review_link_id
       FROM customer_reviews cr
       LEFT JOIN branches b ON b.id = cr.branch_id
       ORDER BY cr.created_at DESC, cr.id DESC
       LIMIT 200`
    );

    return res.json({
      success: true,
      reviews: rows,
    });
  } catch (error) {
    console.error("List reviews error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذّر تحميل التقييمات",
    });
  }
});

// الموافقة على تقييم أو رفضه
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body || {};

  if (
    !isId(req.params.id) ||
    !["pending", "approved", "rejected"].includes(status)
  ) {
    return res.status(400).json({
      success: false,
      message: "بيانات غير صالحة",
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE customer_reviews
       SET status = ?
       WHERE id = ?`,
      [status, Number(req.params.id)]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "التقييم غير موجود",
      });
    }

    return res.json({
      success: true,
      message: "تم تحديث حالة التقييم",
    });
  } catch (error) {
    console.error("Update review status error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذّر تحديث التقييم",
    });
  }
});

// تعطيل رابط تقييم
router.patch("/links/:id/deactivate", async (req, res) => {
  if (!isId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "رقم الرابط غير صالح",
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE review_links
       SET is_active = 0
       WHERE id = ?`,
      [Number(req.params.id)]
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        success: false,
        message: "الرابط غير موجود",
      });
    }

    return res.json({
      success: true,
      message: "تم تعطيل الرابط",
    });
  } catch (error) {
    console.error("Deactivate review link error:", error);

    return res.status(500).json({
      success: false,
      message: "تعذّر تعطيل الرابط",
    });
  }
});

module.exports = router;
