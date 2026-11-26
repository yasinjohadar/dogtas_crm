
const express = require("express");
const db = require("./db");
const { verifyToken, allowRoles } = require("./auth");

const router = express.Router();

router.use(verifyToken);

// Get branches
router.get("/", async (req, res) => {
  try {
    const isAdmin = req.user.role === "admin";

    let sql = `
      SELECT
        b.id,
        b.name,
        b.address,
        b.phone,
        b.manager_user_id AS managerUserId,
        b.is_active AS isActive,
        u.full_name AS managerName,
        u.username AS managerUsername
      FROM branches b
      LEFT JOIN users u
        ON u.id = b.manager_user_id
    `;

    const params = [];

    if (!isAdmin) {
      const [users] = await db.execute(
        "SELECT branch FROM users WHERE id = ? LIMIT 1",
        [req.user.id]
      );

      const branchName = users[0]?.branch;

      if (!branchName) {
        return res.json({
          success: true,
          branches: []
        });
      }

      sql += " WHERE b.name = ?";
      params.push(branchName);
    }

    sql += " ORDER BY b.id ASC";

    const [rows] = await db.execute(sql, params);

    return res.json({
      success: true,
      branches: rows
    });
  } catch (error) {
    console.error("Get branches error:", error.message);

    return res.status(500).json({
      success: false,
      message: "تعذر تحميل الفروع"
    });
  }
});

// Get eligible branch managers - admin only
router.get(
  "/managers",
  allowRoles("admin"),
  async (req, res) => {
    try {
      const [rows] = await db.execute(
        `SELECT id, full_name, username, branch
         FROM users
         WHERE role = 'branch_manager'
           AND is_active = 1
         ORDER BY full_name ASC, id ASC`
      );

      return res.json({
        success: true,
        managers: rows
      });
    } catch (error) {
      console.error("Get managers error:", error.message);

      return res.status(500).json({
        success: false,
        message: "تعذر تحميل قائمة المدراء"
      });
    }
  }
);

// Add branch - admin only
router.post(
  "/",
  allowRoles("admin"),
  async (req, res) => {
    try {
      const { name, address, phone } = req.body || {};

      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "يرجى إدخال اسم فرع صحيح"
        });
      }

      if (
        (address != null &&
          typeof address !== "string") ||
        (phone != null &&
          typeof phone !== "string") ||
        (address && address.length > 255) ||
        (phone && phone.length > 30)
      ) {
        return res.status(400).json({
          success: false,
          message: "بيانات العنوان أو الهاتف غير صحيحة"
        });
      }

      const [result] = await db.execute(
        `INSERT INTO branches (name, address, phone)
         VALUES (?, ?, ?)`,
        [
          name.trim(),
          address?.trim() || null,
          phone?.trim() || null
        ]
      );

      return res.status(201).json({
        success: true,
        message: "تمت إضافة الفرع بنجاح",
        id: result.insertId
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({
          success: false,
          message: "اسم الفرع موجود مسبقاً"
        });
      }

      console.error("Add branch error:", error.message);

      return res.status(500).json({
        success: false,
        message: "تعذرت إضافة الفرع"
      });
    }
  }
);

// Update branch - admin only
router.put(
  "/:id",
  allowRoles("admin"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!Number.isSafeInteger(id) || id <= 0) {
        return res.status(400).json({
          success: false,
          message: "رقم الفرع غير صحيح"
        });
      }

      const {
        address,
        phone,
        isActive,
        managerUserId
      } = req.body || {};

      if (
        (address != null &&
          typeof address !== "string") ||
        (phone != null &&
          typeof phone !== "string") ||
        (address && address.length > 255) ||
        (phone && phone.length > 30) ||
        (isActive !== undefined &&
          typeof isActive !== "boolean")
      ) {
        return res.status(400).json({
          success: false,
          message: "بيانات الفرع غير صحيحة"
        });
      }

      const [existing] = await db.execute(
        "SELECT id, name FROM branches WHERE id = ?",
        [id]
      );

      if (!existing.length) {
        return res.status(404).json({
          success: false,
          message: "الفرع غير موجود"
        });
      }

      const branch = existing[0];

      const updates = [];
      const values = [];

      if (address !== undefined) {
        updates.push("address = ?");
        values.push(address?.trim() || null);
      }

      if (phone !== undefined) {
        updates.push("phone = ?");
        values.push(phone?.trim() || null);
      }

      if (isActive !== undefined) {
        updates.push("is_active = ?");
        values.push(isActive ? 1 : 0);
      }

      if (managerUserId !== undefined) {
        if (managerUserId === null) {
          updates.push("manager_user_id = ?");
          values.push(null);
        } else {
          if (
            typeof managerUserId !== "number" ||
            !Number.isSafeInteger(managerUserId) ||
            managerUserId <= 0
          ) {
            return res.status(400).json({
              success: false,
              message: "رقم المدير غير صحيح"
            });
          }

          const [managers] = await db.execute(
            `SELECT id
             FROM users
             WHERE id = ?
               AND role = 'branch_manager'
               AND branch = ?
               AND is_active = 1
             LIMIT 1`,
            [managerUserId, branch.name]
          );

          if (!managers.length) {
            return res.status(400).json({
              success: false,
              message:
                "المدير غير نشط أو غير مرتبط بهذا الفرع"
            });
          }

          const [assigned] = await db.execute(
            `SELECT id
             FROM branches
             WHERE manager_user_id = ?
               AND id <> ?
             LIMIT 1`,
            [managerUserId, id]
          );

          if (assigned.length) {
            return res.status(409).json({
              success: false,
              message:
                "هذا المدير معيّن لفرع آخر بالفعل"
            });
          }

          updates.push("manager_user_id = ?");
          values.push(managerUserId);
        }
      }

      if (!updates.length) {
        return res.status(400).json({
          success: false,
          message: "لا توجد بيانات للتعديل"
        });
      }

      values.push(id);

      await db.execute(
        `UPDATE branches
         SET ${updates.join(", ")}
         WHERE id = ?`,
        values
      );

      return res.json({
        success: true,
        message: "تم تحديث بيانات الفرع بنجاح"
      });
    } catch (error) {
      console.error("Update branch error:", error.message);

      return res.status(500).json({
        success: false,
        message: "تعذر تحديث بيانات الفرع"
      });
    }
  }
);

module.exports = router;
