
const express = require("express");
const db = require("./db");
const { verifyToken } = require("./auth");

const router = express.Router();

const BRANCHES = ["حلب", "دمشق", "إدلب"];
const ROLES = [
  "موظف مبيعات",
  "مدير فرع",
  "مدير النظام",
  "موظف متابعة"
];
const STATUSES = ["نشط", "غير نشط"];

router.use(verifyToken);

// Check current user permissions from MySQL
router.use(async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, role, branch, is_active
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );

    const user = rows[0];

    if (
      !user ||
      Number(user.is_active) !== 1 ||
      !["admin", "branch_manager", "sales", "followup"]
        .includes(user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (
      user.role !== "admin" &&
      !BRANCHES.includes(user.branch)
    ) {
      return res.status(403).json({
        success: false,
        message: "User branch is not configured"
      });
    }

    req.crmUser = user;
    next();
  } catch (error) {
    console.error("Employee auth error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Get employees
router.get("/", async (req, res) => {
  try {
    const user = req.crmUser;

    const [rows] = user.role === "admin"
      ? await db.execute(
          `SELECT id, legacy_id AS legacyId,
                  name, phone, branch, role,
                  status, notes
           FROM employees ORDER BY id DESC`
        )
      : await db.execute(
          `SELECT id, legacy_id AS legacyId,
                  name, phone, branch, role,
                  status, notes
           FROM employees
           WHERE branch = ?
           ORDER BY id DESC`,
          [user.branch]
        );

    res.json({
      success: true,
      employees: rows
    });
  } catch (error) {
    console.error("Get employees error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Add employee
router.post("/", async (req, res) => {
  try {
    const user = req.crmUser;

    if (!["admin", "branch_manager"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const {
      name, phone, branch, role,
      status, notes = "", legacyId = null
    } = req.body || {};

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 150 ||
      typeof phone !== "string" ||
      !phone.trim() ||
      phone.length > 30 ||
      !BRANCHES.includes(branch) ||
      !ROLES.includes(role) ||
      !STATUSES.includes(status) ||
      typeof notes !== "string" ||
      notes.length > 10000 ||
      (
        legacyId !== null &&
        (
          typeof legacyId !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            .test(legacyId)
        )
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee data"
      });
    }

    if (user.role !== "admin" && user.branch !== branch) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this branch"
      });
    }

    // Only admin may create management records
    if (
      user.role !== "admin" &&
      ["مدير فرع", "مدير النظام"].includes(role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this role"
      });
    }

    const [result] = await db.execute(
      `INSERT INTO employees
       (legacy_id, name, phone, branch, role, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        legacyId,
        name.trim(),
        phone.trim(),
        branch,
        role,
        status,
        notes
      ]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      message: "Employee created"
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "Employee already imported"
      });
    }

    console.error("Create employee error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* Update employee in MySQL */
router.put("/:id", async (req, res) => {
  try {
    const user = req.crmUser;
    const employeeId = Number(req.params.id);

    // Check ID
    if (
      !Number.isSafeInteger(employeeId) ||
      employeeId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID"
      });
    }

    // Only admin and branch manager can edit
    if (!["admin", "branch_manager"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const {
      name,
      phone,
      branch,
      role,
      status,
      notes = ""
    } = req.body || {};

    // Validate submitted data
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 150 ||
      typeof phone !== "string" ||
      !phone.trim() ||
      phone.length > 30 ||
      !BRANCHES.includes(branch) ||
      !ROLES.includes(role) ||
      !STATUSES.includes(status) ||
      typeof notes !== "string" ||
      notes.length > 10000
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee data"
      });
    }

    // Find existing employee
    const [rows] = await db.execute(
      `SELECT id, branch, role
       FROM employees
       WHERE id = ?
       LIMIT 1`,
      [employeeId]
    );

    const employee = rows[0];

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Protect branches and management roles
    if (
      user.role !== "admin" &&
      (
        employee.branch !== user.branch ||
        branch !== user.branch ||
        ["مدير فرع", "مدير النظام"].includes(employee.role) ||
        ["مدير فرع", "مدير النظام"].includes(role)
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this employee"
      });
    }

    // Update employee
    const [result] = await db.execute(
      `UPDATE employees
       SET name = ?,
           phone = ?,
           branch = ?,
           role = ?,
           status = ?,
           notes = ?
       WHERE id = ?`,
      [
        name.trim(),
        phone.trim(),
        branch,
        role,
        status,
        notes,
        employeeId
      ]
    );

    return res.json({
      success: true,
      message: "Employee updated",
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error("Update employee error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* Delete employee safely */
router.delete("/:id", async (req, res) => {
  try {
    const user = req.crmUser;
    const employeeId = Number(req.params.id);

    // Only admin and branch manager can delete
    if (!["admin", "branch_manager"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (
      !Number.isSafeInteger(employeeId) ||
      employeeId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID"
      });
    }

    // Find employee
    const [rows] = await db.execute(
      `SELECT id, branch, role
       FROM employees
       WHERE id = ?
       LIMIT 1`,
      [employeeId]
    );

    const employee = rows[0];

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found"
      });
    }

    // Branch managers cannot delete management records
    if (
      user.role !== "admin" &&
      (
        employee.branch !== user.branch ||
        ["مدير فرع", "مدير النظام"].includes(employee.role)
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this employee"
      });
    }

    // Prevent deleting employees linked to customers
    const [linkedRows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM customers
       WHERE employee_id = ?`,
      [employeeId]
    );

    if (Number(linkedRows[0].total) > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete employee linked to customers"
      });
    }

    // Prevent deleting employees with login accounts
    const [accountRows] = await db.execute(
      `SELECT id
       FROM users
       WHERE employee_id = ?
       LIMIT 1`,
      [employeeId]
    );

    if (accountRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete employee with a login account"
      });
    }

    // Delete employee
    await db.execute(
      `DELETE FROM employees WHERE id = ?`,
      [employeeId]
    );

    return res.json({
      success: true,
      message: "Employee deleted"
    });
  } catch (error) {
    console.error("Delete employee error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;
