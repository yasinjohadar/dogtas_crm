
const express = require("express");
const db = require("./db");
const { verifyToken } = require("./auth");
const { randomUUID } = require("crypto");

const router = express.Router();

const BRANCHES = ["حلب", "دمشق", "إدلب"];

const READ_ROLES = [
  "admin",
  "branch_manager",
  "sales",
  "followup"
];

const STAFF_ROLES = ["sales", "followup"];
const MANAGER_ROLES = ["admin", "branch_manager"];

const FOLLOWUP_RESULTS = [
  "بحاجة لمتابعة",
  "تم الشراء",
  "غير مهتم"
];

router.use(verifyToken);

// Load user permissions from MySQL
router.use(async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, role, branch, employee_id, is_active
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [req.user.id]
    );

    const user = rows[0];

    if (
      !user ||
      Number(user.is_active) !== 1 ||
      !READ_ROLES.includes(user.role)
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

    if (STAFF_ROLES.includes(user.role)) {
      const employeeId = Number(user.employee_id);

      if (
        !Number.isSafeInteger(employeeId) ||
        employeeId <= 0
      ) {
        return res.status(403).json({
          success: false,
          message: "Employee account is not linked"
        });
      }

      const [employees] = await db.execute(
        `SELECT id, branch, status
         FROM employees
         WHERE id = ?
         LIMIT 1`,
        [employeeId]
      );

      if (
        !employees.length ||
        employees[0].branch !== user.branch ||
        employees[0].status !== "نشط"
      ) {
        return res.status(403).json({
          success: false,
          message: "Employee account is not valid"
        });
      }
    }

    req.crmUser = user;
    next();

  } catch (error) {
    console.error(
      "Customer authorization error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

function canAccessBranch(user, branch) {
  return user.role === "admin" || user.branch === branch;
}

function isStaff(user) {
  return STAFF_ROLES.includes(user.role);
}

function isManager(user) {
  return MANAGER_ROLES.includes(user.role);
}

function validId(value) {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0;
}

function validDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const timestamp = Date.parse(value);

  return (
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

async function validateCustomer(body, existingStatus = null) {
  const {
    name,
    phone,
    branch,
    product,
    status,
    employeeId,
    nextDate,
    notes
  } = body || {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 150 ||
    typeof phone !== "string" ||
    !phone.trim() ||
    phone.length > 30
  ) {
    return "Invalid customer name or phone";
  }

  if (!BRANCHES.includes(branch)) {
    return "Invalid branch";
  }

  if (
    typeof status !== "string" ||
    !status.trim() ||
    status.length > 100
  ) {
    return "Invalid customer status";
  }

  const [statusRows] = await db.execute(
    `SELECT is_active
     FROM customer_statuses
     WHERE name = ?
     LIMIT 1`,
    [status]
  );

  if (!statusRows.length) {
    return "Customer status does not exist";
  }

  // Allow keeping an inactive status already assigned.
  if (
    Number(statusRows[0].is_active) !== 1 &&
    status !== existingStatus
  ) {
    return "Customer status is inactive";
  }

  if (
    typeof product !== "string" ||
    product.length > 255 ||
    typeof notes !== "string" ||
    notes.length > 10000
  ) {
    return "Invalid product or notes";
  }

  if (
    employeeId !== "" &&
    employeeId !== null &&
    employeeId !== undefined &&
    !validId(employeeId)
  ) {
    return "Invalid employee ID";
  }

  if (nextDate && !validDate(nextDate)) {
    return "Invalid follow-up date";
  }

  return null;
}

async function validateAssignedEmployee(employeeId, branch) {
  if (
    employeeId === "" ||
    employeeId === null ||
    employeeId === undefined
  ) {
    return null;
  }

  const [rows] = await db.execute(
    `SELECT id, branch, status
     FROM employees
     WHERE id = ?
     LIMIT 1`,
    [Number(employeeId)]
  );

  const employee = rows[0];

  if (!employee) {
    return "Employee not found";
  }

  if (employee.branch !== branch) {
    return "Employee must belong to the same branch";
  }

  if (employee.status !== "نشط") {
    return "Employee is not active";
  }

  return null;
}

const CUSTOMER_FIELDS = `
  id,
  full_name AS name,
  phone,
  branch,
  product,
  status,
  employee_id AS employeeId,
  DATE_FORMAT(next_date, '%Y-%m-%d') AS nextDate,
  notes,
  followup_history AS followupHistory
`;

// GET customers
router.get("/", async (req, res) => {
  try {
    const user = req.crmUser;

    let sql = `
      SELECT ${CUSTOMER_FIELDS}
      FROM customers
    `;

    let params = [];

    if (user.role === "branch_manager") {
      sql += " WHERE branch = ?";
      params = [user.branch];
    } else if (isStaff(user)) {
      sql += " WHERE branch = ? AND employee_id = ?";
      params = [
        user.branch,
        Number(user.employee_id)
      ];
    } else if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    sql += " ORDER BY id DESC";

    const [rows] = await db.execute(sql, params);

    const customers = rows.map((customer) => {
      let history = [];

      try {
        const parsed = customer.followupHistory;

        if (Array.isArray(parsed)) {
          history = parsed;
        } else if (
          typeof parsed === "string" &&
          parsed.trim()
        ) {
          const decoded = JSON.parse(parsed);
          history = Array.isArray(decoded) ? decoded : [];
        }
      } catch {
        history = [];
      }

      return {
        ...customer,
        followupHistory: history
      };
    });

    return res.json({
      success: true,
      customers
    });

  } catch (error) {
    console.error("Get customers error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// POST: Add customer
router.post("/", async (req, res) => {
  try {
    const user = req.crmUser;
    const error = await validateCustomer(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    const {
      name,
      phone,
      branch,
      product,
      status,
      employeeId,
      nextDate,
      notes
    } = req.body;

    if (!canAccessBranch(user, branch)) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this branch"
      });
    }

    const assignedEmployeeId = isStaff(user)
      ? Number(user.employee_id)
      : employeeId;

    const employeeError = await validateAssignedEmployee(
      assignedEmployeeId,
      branch
    );

    if (employeeError) {
      return res.status(400).json({
        success: false,
        message: employeeError
      });
    }

    const [result] = await db.execute(
      `INSERT INTO customers
       (
         full_name,
         phone,
         branch,
         product,
         status,
         employee_id,
         next_date,
         notes
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        phone.trim(),
        branch,
        product,
        status,
        assignedEmployeeId
          ? Number(assignedEmployeeId)
          : null,
        nextDate || null,
        notes
      ]
    );

    return res.status(201).json({
      success: true,
      id: result.insertId,
      message: "Customer created"
    });

  } catch (error) {
    console.error("Create customer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// POST: Save customer follow-up
router.post("/:id/followups", async (req, res) => {
  let connection;

  try {
    const user = req.crmUser;
    const id = Number(req.params.id);

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const { result, nextDate } = req.body || {};

    if (!FOLLOWUP_RESULTS.includes(result)) {
      return res.status(400).json({
        success: false,
        message: "Invalid follow-up result"
      });
    }

    const isClosed = [
      "تم الشراء",
      "غير مهتم"
    ].includes(result);

    if (!isClosed && !validDate(nextDate)) {
      return res.status(400).json({
        success: false,
        message: "Valid next date is required"
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT id, branch, employee_id,
              status, followup_history
       FROM customers
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const customer = rows[0];

    const allowed =
      canAccessBranch(user, customer.branch) &&
      (
        !isStaff(user) ||
        Number(customer.employee_id) ===
          Number(user.employee_id)
      );

    if (!allowed) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "You cannot follow up this customer"
      });
    }

    let history = [];

    try {
      const saved = customer.followup_history;

      if (Array.isArray(saved)) {
        history = saved;
      } else if (
        typeof saved === "string" &&
        saved.trim()
      ) {
        const parsed = JSON.parse(saved);
        history = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Existing follow-up history is invalid"
      });
    }

    const newStatus =
      result === "تم الشراء"
        ? "تم الشراء"
        : result === "غير مهتم"
          ? "خسرنا الزبون"
          : "بحاجة لمتابعة";

    const savedNextDate = isClosed ? null : nextDate;

    const historyItem = {
      id: randomUUID(),
      date: new Date().toISOString(),
      result,
      employeeId: user.employee_id || null,
      userId: user.id,
      nextDate: savedNextDate || ""
    };

    const updatedHistory = [
      ...history,
      historyItem
    ];

    await connection.execute(
      `UPDATE customers
       SET status = ?,
           next_date = ?,
           followup_history = ?
       WHERE id = ?`,
      [
        newStatus,
        savedNextDate,
        JSON.stringify(updatedHistory),
        id
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Follow-up saved",
      status: newStatus,
      nextDate: savedNextDate || "",
      followupHistory: updatedHistory
    });

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error(
      "Save follow-up error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Server error"
    });

  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// PUT: Update customer
router.put("/:id", async (req, res) => {
  try {
    const user = req.crmUser;
    const id = Number(req.params.id);

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const [existing] = await db.execute(
      `SELECT branch, employee_id, status
       FROM customers
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!existing.length) {
      return res.status(404).json({
        success: false,
        message: "Customer not found"
      });
    }

    const customer = existing[0];

    if (
      !canAccessBranch(user, customer.branch) ||
      !canAccessBranch(user, req.body.branch)
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this branch"
      });
    }

    if (isStaff(user)) {
      if (
        Number(customer.employee_id) !==
          Number(user.employee_id) ||
        req.body.branch !== customer.branch ||
        (
          req.body.employeeId !== "" &&
          req.body.employeeId !== null &&
          req.body.employeeId !== undefined &&
          Number(req.body.employeeId) !==
            Number(user.employee_id)
        )
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only edit your own customers"
        });
      }
    }

    const error = await validateCustomer(
      req.body,
      customer.status
    );

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    const {
      name,
      phone,
      branch,
      product,
      status,
      employeeId,
      nextDate,
      notes
    } = req.body;

    const assignedEmployeeId = isStaff(user)
      ? Number(user.employee_id)
      : employeeId;

    const employeeError = await validateAssignedEmployee(
      assignedEmployeeId,
      branch
    );

    if (employeeError) {
      return res.status(400).json({
        success: false,
        message: employeeError
      });
    }

    const [result] = await db.execute(
      `UPDATE customers
       SET full_name = ?,
           phone = ?,
           branch = ?,
           product = ?,
           status = ?,
           employee_id = ?,
           next_date = ?,
           notes = ?
       WHERE id = ?
         AND (
           ? = 'admin'
           OR (
             branch = ?
             AND (
               ? = 'branch_manager'
               OR employee_id = ?
             )
           )
         )`,
      [
        name.trim(),
        phone.trim(),
        branch,
        product,
        status,
        assignedEmployeeId
          ? Number(assignedEmployeeId)
          : null,
        nextDate || null,
        notes,
        id,
        user.role,
        user.branch || "",
        user.role,
        Number(user.employee_id) || 0
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(403).json({
        success: false,
        message: "Customer update not permitted"
      });
    }

    return res.json({
      success: true,
      message: "Customer updated"
    });

  } catch (error) {
    console.error("Update customer error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// DELETE: Managers only
router.delete("/:id", async (req, res) => {
  try {
    const user = req.crmUser;

    if (!isManager(user)) {
      return res.status(403).json({
        success: false,
        message: "Only managers can delete customers"
      });
    }

    const id = Number(req.params.id);

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID"
      });
    }

    const [result] = await db.execute(
      user.role === "admin"
        ? `DELETE FROM customers WHERE id = ?`
        : `DELETE FROM customers
           WHERE id = ? AND branch = ?`,
      user.role === "admin"
        ? [id]
        : [id, user.branch]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found or access denied"
      });
    }

    return res.json({
      success: true,
      message: "Customer deleted"
    });

  } catch (error) {
    console.error(
      "Delete customer error:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;
