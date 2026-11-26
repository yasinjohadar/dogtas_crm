
const express = require("express");
const db = require("./db");
const { verifyToken } = require("./auth");

const router = express.Router();

const BRANCHES = ["حلب", "دمشق", "إدلب"];
const ROLES = ["admin", "branch_manager", "sales", "followup"];
const STAFF = ["sales", "followup"];

const SALE_STATUSES = ["قيد التفاوض", "تم البيع", "ملغي"];

const PAYMENT_STATUSES = [
  "تم دفع المبلغ كامل",
  "لم يتم دفع المبلغ كامل"
];

const PRODUCT_TYPES = [
  "غرفة نوم",
  "غرفة جلوس",
  "غرفة سفرة",
  "كنب",
  "طاولة",
  "كرسي",
  "خزانة",
  "مفروشات أخرى"
];

router.use(verifyToken);

// Check user permissions
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
      !ROLES.includes(user.role)
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
        message: "Invalid user branch"
      });
    }

    if (STAFF.includes(user.role)) {
      if (
        !Number.isSafeInteger(Number(user.employee_id)) ||
        Number(user.employee_id) <= 0
      ) {
        return res.status(403).json({
          success: false,
          message: "Employee account is not linked"
        });
      }

      const [employees] = await db.execute(
        `SELECT branch, status
         FROM employees
         WHERE id = ?
         LIMIT 1`,
        [user.employee_id]
      );

      if (
        !employees.length ||
        employees[0].branch !== user.branch ||
        employees[0].status !== "نشط"
      ) {
        return res.status(403).json({
          success: false,
          message: "Invalid employee account"
        });
      }
    }

    req.crmUser = user;
    next();

  } catch (error) {
    console.error("Sales authorization:", error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

const validId = (id) =>
  Number.isSafeInteger(Number(id)) && Number(id) > 0;

const validDate = (date) => {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return false;
  }

  const parsed = Date.parse(date);

  return (
    Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === date
  );
};

// Validate sale information
function validateSale(body) {
  if (!body || typeof body !== "object") {
    return "Invalid sale data";
  }

  if (
    !validId(body.customerId) ||
    !validId(body.employeeId)
  ) {
    return "Invalid customer or employee";
  }

  if (!BRANCHES.includes(body.branch)) {
    return "Invalid branch";
  }

  if (!PRODUCT_TYPES.includes(body.productType)) {
    return "Invalid product type";
  }

  if (
    typeof body.modelName !== "string" ||
    !body.modelName.trim() ||
    body.modelName.length > 255
  ) {
    return "Invalid model name";
  }

  const quantity = Number(body.quantity);

  if (
    !Number.isSafeInteger(quantity) ||
    quantity < 1
  ) {
    return "Invalid quantity";
  }

  if (!validDate(body.saleDate)) {
    return "Invalid sale date";
  }

  if (
    !SALE_STATUSES.includes(body.saleStatus) ||
    !PAYMENT_STATUSES.includes(body.paymentStatus)
  ) {
    return "Invalid sale or payment status";
  }

  if (
    body.notes != null &&
    (
      typeof body.notes !== "string" ||
      body.notes.length > 10000
    )
  ) {
    return "Invalid notes";
  }

  return null;
}

// Check sale permissions
function canAccessSale(user, sale) {
  if (user.role === "admin") {
    return true;
  }

  if (sale.branch !== user.branch) {
    return false;
  }

  if (user.role === "branch_manager") {
    return true;
  }

  return (
    Number(sale.employee_id) ===
    Number(user.employee_id)
  );
}

// Validate customer and employee
async function checkRelations(connection, body, user) {
  const [customers] = await connection.execute(
    `SELECT id, branch, employee_id
     FROM customers
     WHERE id = ?
     LIMIT 1`,
    [Number(body.customerId)]
  );

  if (
    !customers.length ||
    customers[0].branch !== body.branch
  ) {
    return "Customer must belong to this branch";
  }

  // Staff can only sell to their assigned customers
  if (
    STAFF.includes(user.role) &&
    Number(customers[0].employee_id) !==
      Number(user.employee_id)
  ) {
    return "Customer is not assigned to this employee";
  }

  const [employees] = await connection.execute(
    `SELECT id, branch, status
     FROM employees
     WHERE id = ?
     LIMIT 1`,
    [Number(body.employeeId)]
  );

  if (
    !employees.length ||
    employees[0].branch !== body.branch ||
    employees[0].status !== "نشط"
  ) {
    return "Employee must be active in this branch";
  }

  return null;
}

// Update customer status when sale is completed
async function updateCustomerAfterSale(
  connection,
  customerId,
  branch,
  saleStatus
) {
  if (saleStatus !== "تم البيع") {
    return;
  }

  await connection.execute(
    `UPDATE customers
     SET status = ?
     WHERE id = ? AND branch = ?`,
    ["تم الشراء", Number(customerId), branch]
  );
}

// GET sales
router.get("/", async (req, res) => {
  try {
    const user = req.crmUser;

    let sql = `
      SELECT
        s.id,
        s.customer_id AS customerId,
        s.branch,
        s.employee_id AS employeeId,
        s.product_type AS productType,
        s.model_name AS modelName,
        s.quantity,
        DATE_FORMAT(s.sale_date, '%Y-%m-%d') AS saleDate,
        s.sale_status AS saleStatus,
        s.payment_status AS paymentStatus,
        s.notes,
        s.created_at AS createdAt,
        c.full_name AS customerName,
        e.name AS employeeName
      FROM sales s
      JOIN customers c ON c.id = s.customer_id
      JOIN employees e ON e.id = s.employee_id
    `;

    const params = [];

    if (user.role === "branch_manager") {
      sql += " WHERE s.branch = ?";
      params.push(user.branch);
    } else if (STAFF.includes(user.role)) {
      sql += " WHERE s.branch = ? AND s.employee_id = ?";
      params.push(
        user.branch,
        Number(user.employee_id)
      );
    }

    sql += " ORDER BY s.id DESC";

    const [sales] = await db.execute(sql, params);

    return res.json({
      success: true,
      sales
    });

  } catch (error) {
    console.error("Get sales:", error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// POST - Create new sale
router.post("/", async (req, res) => {
  let connection;

  try {
    const user = req.crmUser;
    const body = { ...req.body };

    const error = validateSale(body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    if (
      user.role !== "admin" &&
      body.branch !== user.branch
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied for branch"
      });
    }

    if (
      STAFF.includes(user.role) &&
      Number(body.employeeId) !==
        Number(user.employee_id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You can only create your own sales"
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const relationError = await checkRelations(
      connection,
      body,
      user
    );

    if (relationError) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: relationError
      });
    }

    const [result] = await connection.execute(
      `INSERT INTO sales (
        customer_id,
        branch,
        employee_id,
        product_type,
        model_name,
        quantity,
        sale_date,
        sale_status,
        payment_status,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(body.customerId),
        body.branch,
        Number(body.employeeId),
        body.productType,
        body.modelName.trim(),
        Number(body.quantity),
        body.saleDate,
        body.saleStatus,
        body.paymentStatus,
        body.notes || ""
      ]
    );

    // Automatically update customer status
    await updateCustomerAfterSale(
      connection,
      body.customerId,
      body.branch,
      body.saleStatus
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      id: result.insertId,
      message: "Sale created successfully"
    });

  } catch (error) {
    if (connection) {
      await connection.rollback().catch(console.error);
    }

    console.error("Create sale:", error);

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

// PUT - Update sale
router.put("/:id", async (req, res) => {
  let connection;

  try {
    const user = req.crmUser;
    const id = Number(req.params.id);

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID"
      });
    }

    const error = validateSale(req.body);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.execute(
      `SELECT *
       FROM sales
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    if (!canAccessSale(user, rows[0])) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (
      user.role !== "admin" &&
      req.body.branch !== user.branch
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "Invalid target branch"
      });
    }

    if (
      STAFF.includes(user.role) &&
      Number(req.body.employeeId) !==
        Number(user.employee_id)
    ) {
      await connection.rollback();

      return res.status(403).json({
        success: false,
        message: "Cannot reassign sale"
      });
    }

    const relationError = await checkRelations(
      connection,
      req.body,
      user
    );

    if (relationError) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: relationError
      });
    }

    const body = req.body;

    await connection.execute(
      `UPDATE sales SET
        customer_id = ?,
        branch = ?,
        employee_id = ?,
        product_type = ?,
        model_name = ?,
        quantity = ?,
        sale_date = ?,
        sale_status = ?,
        payment_status = ?,
        notes = ?
       WHERE id = ?`,
      [
        Number(body.customerId),
        body.branch,
        Number(body.employeeId),
        body.productType,
        body.modelName.trim(),
        Number(body.quantity),
        body.saleDate,
        body.saleStatus,
        body.paymentStatus,
        body.notes || "",
        id
      ]
    );

    // Automatically update customer status
    await updateCustomerAfterSale(
      connection,
      body.customerId,
      body.branch,
      body.saleStatus
    );

    await connection.commit();

    return res.json({
      success: true,
      message: "Sale updated successfully"
    });

  } catch (error) {
    if (connection) {
      await connection.rollback().catch(console.error);
    }

    console.error("Update sale:", error);

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

// DELETE - Delete sale
router.delete("/:id", async (req, res) => {
  try {
    const user = req.crmUser;
    const id = Number(req.params.id);

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sale ID"
      });
    }

    if (
      !["admin", "branch_manager"].includes(user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: "Only managers can delete sales"
      });
    }

    const [rows] = await db.execute(
      `SELECT *
       FROM sales
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Sale not found"
      });
    }

    if (!canAccessSale(user, rows[0])) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    await db.execute(
      "DELETE FROM sales WHERE id = ?",
      [id]
    );

    return res.json({
      success: true,
      message: "Sale deleted"
    });

  } catch (error) {
    console.error("Delete sale:", error);

    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;
