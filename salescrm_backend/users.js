
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("./db");
const { verifyToken, allowRoles } = require("./auth");

const router = express.Router();
const BRANCHES = ["حلب", "دمشق", "إدلب"];

router.use(verifyToken);
router.use(allowRoles("admin"));

// Verify the admin account is still active
router.use(async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, role, is_active
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    const admin = rows[0];

    if (
      !admin ||
      admin.role !== "admin" ||
      Number(admin.is_active) !== 1
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    next();
  } catch (error) {
    console.error("Users auth error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// List employee accounts (without passwords)
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.full_name, u.username,
              u.role, u.branch, u.is_active,
              u.employee_id, e.name AS employee_name
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
       ORDER BY u.id DESC`
    );

    res.json({
      success: true,
      users: rows
    });
  } catch (error) {
    console.error("List users error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Create a login account for an existing employee
router.post("/", async (req, res) => {
  try {
    const { employee_id, username, password } = req.body || {};

    if (
      !Number.isSafeInteger(employee_id) ||
      employee_id <= 0 ||
      typeof username !== "string" ||
      !/^[a-zA-Z0-9._-]{3,50}$/.test(username) ||
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid employee ID, username and strong password are required"
      });
    }

    const [employees] = await db.execute(
      `SELECT id, name, branch, role, status
       FROM employees
       WHERE id = ?
       LIMIT 1`,
      [employee_id]
    );

    const employee = employees[0];

    if (!employee || employee.status !== "نشط") {
      return res.status(400).json({
        success: false,
        message: "Employee not found or inactive"
      });
    }

    if (!BRANCHES.includes(employee.branch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee branch"
      });
    }

    const roleMap = {
      "موظف مبيعات": "sales",
      "مدير فرع": "branch_manager",
      "موظف متابعة": "followup"
    };

    const role = roleMap[employee.role];

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Employee role cannot be assigned"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `INSERT INTO users
       (full_name, username, password_hash,
        role, branch, is_active, employee_id)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [
        employee.name,
        username,
        passwordHash,
        role,
        employee.branch,
        employee.id
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Employee login account created",
      user: {
        id: result.insertId,
        employee_id: employee.id,
        full_name: employee.name,
        username,
        role,
        branch: employee.branch
      }
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Username or employee account already exists"
      });
    }

    console.error("Create user error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Admin: Reset employee password and revoke old tokens
router.patch("/:id/password", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { password } = req.body || {};

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 12 characters"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.execute(
      `UPDATE users
       SET password_hash = ?,
           token_version = token_version + 1
       WHERE id = ?`,
      [passwordHash, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.json({
      success: true,
      message: "Password updated and old sessions revoked"
    });
  } catch (error) {
    console.error("Reset password error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Admin: Activate or deactivate a user account
router.patch("/:id/status", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { is_active } = req.body || {};

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    if (typeof is_active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "is_active must be true or false"
      });
    }

    // Prevent admins from disabling their own account
    if (userId === req.user.id && !is_active) {
      return res.status(403).json({
        success: false,
        message: "You cannot deactivate your own account"
      });
    }

    const [result] = await db.execute(
      `UPDATE users
       SET is_active = ?,
           token_version = token_version + 1
       WHERE id = ?`,
      [is_active ? 1 : 0, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.json({
      success: true,
      message: is_active
        ? "Account activated successfully"
        : "Account deactivated successfully"
    });
  } catch (error) {
    console.error("Update user status error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// Admin: Change employee role
router.patch("/:id/role", async (req, res) => {
  const userId = Number(req.params.id);
  const { role } = req.body || {};

  const roleMap = {
    sales: "موظف مبيعات",
    followup: "موظف متابعة",
    branch_manager: "مدير فرع"
  };

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid user ID"
    });
  }

  if (!Object.prototype.hasOwnProperty.call(roleMap, role)) {
    return res.status(400).json({
      success: false,
      message: "Invalid role"
    });
  }

  if (userId === req.user.id) {
    return res.status(403).json({
      success: false,
      message: "Cannot change your own role"
    });
  }

  let connection;

  try {
    connection = await db.getConnection();

    // Keep changes to both tables together
    await connection.beginTransaction();

    const [users] = await connection.execute(
      `SELECT id, role, employee_id
       FROM users
       WHERE id = ?
       FOR UPDATE`,
      [userId]
    );

    const user = users[0];

    if (!user) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.role === "admin" || !user.employee_id) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "Cannot modify this account"
      });
    }

    const [result] = await connection.execute(
      `UPDATE employees
       SET role = ?
       WHERE id = ?`,
      [roleMap[role], user.employee_id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Linked employee not found"
      });
    }

    await connection.execute(
      `UPDATE users
       SET role = ?,
           token_version = token_version + 1
       WHERE id = ?`,
      [role, userId]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Employee role updated successfully",
      role
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError.message);
      }
    }

    console.error("Update role error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });

  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
