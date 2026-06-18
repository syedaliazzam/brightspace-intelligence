import crypto from "crypto";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generatePassword } from "@/lib/generatePassword";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function getTableColumns(tableName, tx = prisma) {
  const rows = await tx.$queryRaw`
    SELECT
      column_name,
      is_nullable,
      column_default,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
  `;

  return rows.reduce((accumulator, row) => {
    accumulator[row.column_name] = {
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default,
      dataType: row.data_type,
      udtName: row.udt_name,
    };
    return accumulator;
  }, {});
}

function getValueSql(columnMeta, value) {
  if (!columnMeta || value === null || typeof value === "undefined") {
    return Prisma.sql`${value ?? null}`;
  }
  if (columnMeta.udtName === "uuid") {
    return Prisma.sql`${value}::uuid`;
  }
  if (columnMeta.dataType === "USER-DEFINED" && columnMeta.udtName) {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.udtName)}`;
  }
  if (columnMeta.dataType === "json" || columnMeta.dataType === "jsonb") {
    return Prisma.sql`${value}::${Prisma.raw(columnMeta.dataType)}`;
  }
  return Prisma.sql`${value}`;
}

function addColumn(columns, values, columnMap, name, value) {
  columns.push(Prisma.raw(`"${name}"`));
  values.push(getValueSql(columnMap[name], value));
}

function ensureSupportedRequiredColumns(tableName, columns, supportedColumns) {
  const missing = Object.entries(columns)
    .filter(
      ([columnName, meta]) =>
        !meta.nullable && !meta.defaultValue && !supportedColumns.has(columnName)
    )
    .map(([columnName]) => columnName);

  if (missing.length) {
    throw new Error(
      `${tableName} requires unsupported columns: ${missing.join(", ")}.`
    );
  }
}

async function getRoleId(roleName, tx) {
  const [row] = await tx.$queryRaw`
    SELECT id::text AS id
    FROM roles
    WHERE LOWER(name) = ${roleName}
    LIMIT 1
  `;
  if (!row?.id) {
    throw new Error(`Role not found: ${roleName}`);
  }
  return row.id;
}

function splitName(fullName) {
  const parts = normalizeText(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

async function insertAuditLog(
  actorUserId,
  targetId,
  action,
  description,
  metadata = {},
  tx = prisma,
  options = {}
) {
  const columns = await getTableColumns("audit_logs", tx);
  if (!Object.keys(columns).length) return;

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();
  const entityType = options.entityType || "registration_leads";
  const entityId = options.entityId || targetId;

  if (columns.id) { addColumn(insertColumns, insertValues, columns, "id", crypto.randomUUID()); supportedColumns.add("id"); }
  if (columns.actor_user_id) { addColumn(insertColumns, insertValues, columns, "actor_user_id", actorUserId); supportedColumns.add("actor_user_id"); }
  if (columns.target_user_id) { addColumn(insertColumns, insertValues, columns, "target_user_id", targetId); supportedColumns.add("target_user_id"); }
  if (columns.entity_type) { addColumn(insertColumns, insertValues, columns, "entity_type", entityType); supportedColumns.add("entity_type"); }
  if (columns.entity_id) { addColumn(insertColumns, insertValues, columns, "entity_id", entityId); supportedColumns.add("entity_id"); }
  if (columns.action) { addColumn(insertColumns, insertValues, columns, "action", action); supportedColumns.add("action"); }
  if (columns.description) { addColumn(insertColumns, insertValues, columns, "description", description); supportedColumns.add("description"); }
  if (columns.metadata) { addColumn(insertColumns, insertValues, columns, "metadata", JSON.stringify(metadata)); supportedColumns.add("metadata"); }
  if (columns.meta) { addColumn(insertColumns, insertValues, columns, "meta", JSON.stringify(metadata)); supportedColumns.add("meta"); }

  ensureSupportedRequiredColumns("audit_logs", columns, supportedColumns);

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO audit_logs (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

async function insertFeeVerification(payload, tx) {
  const columns = await getTableColumns("fee_verifications", tx);
  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();
  const verificationId = crypto.randomUUID();

  if (columns.id) { addColumn(insertColumns, insertValues, columns, "id", verificationId); supportedColumns.add("id"); }
  if (columns.fee_submission_id) { addColumn(insertColumns, insertValues, columns, "fee_submission_id", payload.feeSubmissionId); supportedColumns.add("fee_submission_id"); }
  if (columns.fee_voucher_id) { addColumn(insertColumns, insertValues, columns, "fee_voucher_id", payload.feeVoucherId); supportedColumns.add("fee_voucher_id"); }
  if (columns.registration_lead_id) { addColumn(insertColumns, insertValues, columns, "registration_lead_id", payload.registrationLeadId); supportedColumns.add("registration_lead_id"); }
  if (columns.verified_by_user_id) { addColumn(insertColumns, insertValues, columns, "verified_by_user_id", payload.verifiedByUserId); supportedColumns.add("verified_by_user_id"); }
  if (columns.status) { addColumn(insertColumns, insertValues, columns, "status", payload.status); supportedColumns.add("status"); }
  if (columns.rejection_reason) { addColumn(insertColumns, insertValues, columns, "rejection_reason", payload.rejectionReason || null); supportedColumns.add("rejection_reason"); }
  if (columns.notes) { addColumn(insertColumns, insertValues, columns, "notes", payload.notes || null); supportedColumns.add("notes"); }
  if (columns.verified_at) { addColumn(insertColumns, insertValues, columns, "verified_at", new Date().toISOString()); supportedColumns.add("verified_at"); }

  ensureSupportedRequiredColumns("fee_verifications", columns, supportedColumns);

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO fee_verifications (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

async function findExistingUser({ email, phone, roleName }, tx) {
  const conditions = [];
  if (email) conditions.push(Prisma.sql`LOWER(u.email) = ${email.toLowerCase()}`);
  if (phone) conditions.push(Prisma.sql`u.phone = ${phone}`);
  if (!conditions.length) return null;

  const [user] = await tx.$queryRaw(
    Prisma.sql`
      SELECT u.id::text AS id, LOWER(r.name) AS role_name
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE ${Prisma.join(conditions, Prisma.sql` OR `)}
      LIMIT 1
    `
  );
  return user?.id && user.role_name === roleName ? user : null;
}

async function createUser({ roleId, fullName, email, phone, passwordHash }, tx) {
  const columns = await getTableColumns("users", tx);
  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();
  const userId = crypto.randomUUID();
  const { firstName, lastName } = splitName(fullName);

  if (columns.id) { addColumn(insertColumns, insertValues, columns, "id", userId); supportedColumns.add("id"); }
  if (columns.role_id) { addColumn(insertColumns, insertValues, columns, "role_id", roleId); supportedColumns.add("role_id"); }
  if (columns.full_name) { addColumn(insertColumns, insertValues, columns, "full_name", fullName); supportedColumns.add("full_name"); }
  if (columns.email) { addColumn(insertColumns, insertValues, columns, "email", email || null); supportedColumns.add("email"); }
  if (columns.phone) { addColumn(insertColumns, insertValues, columns, "phone", phone || null); supportedColumns.add("phone"); }
  if (columns.password_hash) { addColumn(insertColumns, insertValues, columns, "password_hash", passwordHash); supportedColumns.add("password_hash"); }
  if (columns.status) { addColumn(insertColumns, insertValues, columns, "status", "active"); supportedColumns.add("status"); }
  if (columns.must_change_password) { addColumn(insertColumns, insertValues, columns, "must_change_password", true); supportedColumns.add("must_change_password"); }
  if (columns.name) { addColumn(insertColumns, insertValues, columns, "name", fullName); supportedColumns.add("name"); }
  if (columns.first_name) { addColumn(insertColumns, insertValues, columns, "first_name", firstName); supportedColumns.add("first_name"); }
  if (columns.last_name) { addColumn(insertColumns, insertValues, columns, "last_name", lastName); supportedColumns.add("last_name"); }

  ensureSupportedRequiredColumns("users", columns, supportedColumns);

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO users (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
  return userId;
}

async function createProfile(tableName, payload, tx) {
  const columns = await getTableColumns(tableName, tx);
  if (!Object.keys(columns).length) return;

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();
  const { firstName, lastName } = splitName(payload.fullName);

  if (columns.id) { addColumn(insertColumns, insertValues, columns, "id", crypto.randomUUID()); supportedColumns.add("id"); }
  if (columns.user_id) { addColumn(insertColumns, insertValues, columns, "user_id", payload.userId); supportedColumns.add("user_id"); }
  if (columns.full_name) { addColumn(insertColumns, insertValues, columns, "full_name", payload.fullName); supportedColumns.add("full_name"); }
  if (columns.name) { addColumn(insertColumns, insertValues, columns, "name", payload.fullName); supportedColumns.add("name"); }
  if (columns.first_name) { addColumn(insertColumns, insertValues, columns, "first_name", firstName); supportedColumns.add("first_name"); }
  if (columns.last_name) { addColumn(insertColumns, insertValues, columns, "last_name", lastName); supportedColumns.add("last_name"); }
  if (columns.email) { addColumn(insertColumns, insertValues, columns, "email", payload.email || null); supportedColumns.add("email"); }
  if (columns.phone) { addColumn(insertColumns, insertValues, columns, "phone", payload.phone || null); supportedColumns.add("phone"); }
  if (columns.status) { addColumn(insertColumns, insertValues, columns, "status", "active"); supportedColumns.add("status"); }
  if (columns.class_level) { addColumn(insertColumns, insertValues, columns, "class_level", payload.classLevel || null); supportedColumns.add("class_level"); }
  if (columns.address) { addColumn(insertColumns, insertValues, columns, "address", payload.address || null); supportedColumns.add("address"); }
  if (columns.city) { addColumn(insertColumns, insertValues, columns, "city", payload.city || null); supportedColumns.add("city"); }
  if (columns.student_age) { addColumn(insertColumns, insertValues, columns, "student_age", payload.studentAge || null); supportedColumns.add("student_age"); }
  if (columns.registration_lead_id) { addColumn(insertColumns, insertValues, columns, "registration_lead_id", payload.registrationLeadId || null); supportedColumns.add("registration_lead_id"); }

  ensureSupportedRequiredColumns(tableName, columns, supportedColumns);

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO ${Prisma.raw(`"${tableName}"`)} (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

async function createStudentParentLink(studentId, parentId, tx) {
  const columns = await getTableColumns("student_parents", tx);
  if (!Object.keys(columns).length) return;

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();

  if (columns.id) { addColumn(insertColumns, insertValues, columns, "id", crypto.randomUUID()); supportedColumns.add("id"); }
  if (columns.student_id) { addColumn(insertColumns, insertValues, columns, "student_id", studentId); supportedColumns.add("student_id"); }
  if (columns.parent_id) { addColumn(insertColumns, insertValues, columns, "parent_id", parentId); supportedColumns.add("parent_id"); }
  if (columns.is_primary) { addColumn(insertColumns, insertValues, columns, "is_primary", true); supportedColumns.add("is_primary"); }

  ensureSupportedRequiredColumns("student_parents", columns, supportedColumns);

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO student_parents (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

async function insertCredentialDispatchLog(payload, tx) {
  const columns = await getTableColumns("credential_dispatch_logs", tx);
  if (!Object.keys(columns).length) return;

  const insertColumns = [];
  const insertValues = [];
  const supportedColumns = new Set();

  if (columns.id) { addColumn(insertColumns, insertValues, columns, "id", crypto.randomUUID()); supportedColumns.add("id"); }
  if (columns.user_id) { addColumn(insertColumns, insertValues, columns, "user_id", payload.userId); supportedColumns.add("user_id"); }
  if (columns.channel) { addColumn(insertColumns, insertValues, columns, "channel", payload.channel); supportedColumns.add("channel"); }
  if (columns.recipient) { addColumn(insertColumns, insertValues, columns, "recipient", payload.recipient || null); supportedColumns.add("recipient"); }
  if (columns.status) { addColumn(insertColumns, insertValues, columns, "status", payload.status); supportedColumns.add("status"); }
  if (columns.dispatch_status) { addColumn(insertColumns, insertValues, columns, "dispatch_status", payload.status); supportedColumns.add("dispatch_status"); }
  if (columns.message) { addColumn(insertColumns, insertValues, columns, "message", payload.message); supportedColumns.add("message"); }
  if (columns.metadata) { addColumn(insertColumns, insertValues, columns, "metadata", JSON.stringify(payload.metadata || {})); supportedColumns.add("metadata"); }
  if (columns.meta) { addColumn(insertColumns, insertValues, columns, "meta", JSON.stringify(payload.metadata || {})); supportedColumns.add("meta"); }
  if (columns.notes) { addColumn(insertColumns, insertValues, columns, "notes", payload.message || null); supportedColumns.add("notes"); }

  ensureSupportedRequiredColumns("credential_dispatch_logs", columns, supportedColumns);

  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO credential_dispatch_logs (${Prisma.join(insertColumns, ", ")})
      VALUES (${Prisma.join(insertValues, ", ")})
    `
  );
}

async function getSubmissionRecord(id, tx = prisma) {
  const [submission] = await tx.$queryRaw`
    SELECT
      fs.id::text AS id,
      fs."status"::text AS submission_status,
      fs.transaction_id,
      fs.paid_amount,
      fs.paid_at,
      fs.proof_file_path,
      fv.id::text AS fee_voucher_id,
      fv.voucher_no,
      fv."status"::text AS voucher_status,
      fv.amount AS voucher_amount,
      rl.id::text AS registration_lead_id,
      rl.student_name,
      rl.parent_name,
      rl.email,
      rl.phone,
      rl.address,
      rl.city,
      rl.class_level,
      rl.student_age
    FROM fee_submissions fs
    INNER JOIN fee_vouchers fv ON fv.id = fs.voucher_id
    INNER JOIN registration_leads rl ON rl.id = fv.registration_id
    WHERE fs.id = ${id}::uuid
    LIMIT 1;
  `;
  return submission;
}

export async function POST(request, { params }) {
  const session = await auth();
  const role = String(session?.user?.role || "").toLowerCase();

  if (!session?.user) return json("Unauthorized.", 401);
  if (!ALLOWED_ROLES.has(role)) return json("Forbidden.", 403);

  try {
    const { id } = await params;
    const body = await request.json();
    const action = normalizeText(body?.action).toLowerCase();
    const rejectionReason = normalizeText(body?.rejectionReason);

    if (!["approve", "reject"].includes(action)) {
      return json("Invalid verification action.", 400);
    }
    if (action === "reject" && !rejectionReason) {
      return json("Rejection reason is required.", 400);
    }

    const submission = await getSubmissionRecord(id);
    if (!submission?.id) return json("Payment submission not found.", 404);

    // 🟢 FIXED: Check matching lowercase state
    if (String(submission.submission_status || "").toLowerCase() !== "pending") {
      return json("Only pending submissions can be verified.", 400);
    }

    if (action === "reject") {
      await prisma.$transaction(async (tx) => {
        // 🟢 FIXED: Corrected broken brackets string parsing
        await tx.$executeRaw`
          UPDATE fee_submissions
          SET status = 'rejected'::fee_submission_status
          WHERE id = ${submission.id}::uuid;
        `;
        await tx.$executeRaw`
          UPDATE fee_vouchers
          SET status = 'rejected'::voucher_status
          WHERE id = ${submission.fee_voucher_id || submission.voucher_id}::uuid;
        `;
        await insertFeeVerification({
          feeSubmissionId: submission.id,
          feeVoucherId: submission.fee_voucher_id || submission.voucher_id,
          registrationLeadId: submission.registration_lead_id,
          verifiedByUserId: session.user.id,
          status: "rejected",
          rejectionReason,
          notes: rejectionReason,
        }, tx);

        await insertAuditLog(
          session.user.id,
          submission.registration_lead_id,
          "payment_rejected",
          `Payment submission ${submission.id} rejected.`,
          { rejectionReason, feeSubmissionId: submission.id },
          tx
        );
      });
      return json("Payment rejected.", 200);
    }

    // APPROVE FLOW
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE fee_submissions
        SET status = 'verified'::fee_submission_status
        WHERE id = ${submission.id}::uuid;
      `;
      await tx.$executeRaw`
        UPDATE fee_vouchers
        SET status = 'verified'::voucher_status
        WHERE id = ${submission.fee_voucher_id || submission.voucher_id}::uuid;
      `;
      await tx.$executeRaw`
        UPDATE registration_leads
        SET status = 'fee_verified'::registration_status
        WHERE id = ${submission.registration_lead_id}::uuid;
      `;

      await insertFeeVerification({
        feeSubmissionId: submission.id,
        feeVoucherId: submission.fee_voucher_id || submission.voucher_id,
        registrationLeadId: submission.registration_lead_id,
        verifiedByUserId: session.user.id,
        status: "verified",
        rejectionReason: null,
        notes: "Payment approved.",
      }, tx);

      await insertAuditLog(
        session.user.id,
        submission.registration_lead_id,
        "payment_verified",
        `Payment submission ${submission.id} verified.`,
        { feeSubmissionId: submission.id, voucherNo: submission.voucher_no },
        tx
      );

      const parentRoleId = await getRoleId("parent", tx);
      const studentRoleId = await getRoleId("student", tx);
      const parentTemporaryPassword = generatePassword();
      const studentTemporaryPassword = generatePassword();
      const parentPasswordHash = await bcrypt.hash(parentTemporaryPassword, 12);
      const studentPasswordHash = await bcrypt.hash(studentTemporaryPassword, 12);

      const existingParent = await findExistingUser({
        email: submission.email,
        phone: submission.phone,
        roleName: "parent",
      }, tx);

      const parentUserId = existingParent?.id || (await createUser({
        roleId: parentRoleId,
        fullName: submission.parent_name || `${submission.student_name} Parent`,
        email: submission.email,
        phone: submission.phone,
        passwordHash: parentPasswordHash,
      }, tx));

      if (!existingParent) {
        await createProfile("parent_profiles", {
          userId: parentUserId,
          fullName: submission.parent_name || `${submission.student_name} Parent`,
          email: submission.email,
          phone: submission.phone,
          registrationLeadId: submission.registration_lead_id,
        }, tx);

        await insertAuditLog(
          session.user.id,
          parentUserId,
          "parent_account_created",
          `Parent account created for registration lead ${submission.registration_lead_id}.`,
          { registrationLeadId: submission.registration_lead_id },
          tx
        );
      }

      const studentUserId = await createUser({
        roleId: studentRoleId,
        fullName: submission.student_name,
        email: null,
        phone: null,
        passwordHash: studentPasswordHash,
      }, tx);

      await createProfile("student_profiles", {
        userId: studentUserId,
        fullName: submission.student_name,
        email: null,
        phone: null,
        classLevel: submission.class_level,
        address: submission.address,
        city: submission.city,
        studentAge: submission.student_age,
        registrationLeadId: submission.registration_lead_id,
      }, tx);

      await createStudentParentLink(studentUserId, parentUserId, tx);

      await insertAuditLog(
        session.user.id,
        studentUserId,
        "student_account_created",
        `Student account created for registration lead ${submission.registration_lead_id}.`,
        { registrationLeadId: submission.registration_lead_id },
        tx
      );

      await tx.$executeRaw`
        UPDATE registration_leads
        SET status = 'access_granted'::registration_status
        WHERE id = ${submission.registration_lead_id}::uuid;
      `;

      await insertCredentialDispatchLog({
        userId: parentUserId,
        channel: submission.email ? "email_placeholder" : "whatsapp_placeholder",
        recipient: submission.email || submission.phone || null,
        status: "pending_manual_dispatch",
        message: "Parent credentials queued for placeholder dispatch.",
        metadata: { registrationLeadId: submission.registration_lead_id, voucherNo: submission.voucher_no },
      }, tx);

      await insertCredentialDispatchLog({
        userId: studentUserId,
        channel: "parent_delivery_placeholder",
        recipient: submission.email || submission.phone || null,
        status: "pending_manual_dispatch",
        message: "Student credentials queued for placeholder dispatch.",
        metadata: { registrationLeadId: submission.registration_lead_id, voucherNo: submission.voucher_no },
      }, tx);

      await insertAuditLog(
        session.user.id,
        submission.registration_lead_id,
        "lms_access_granted",
        `LMS access granted for registration lead ${submission.registration_lead_id}.`,
        { parentUserId, studentUserId },
        tx
      );
    });

    return json("Payment verified and LMS access granted.", 200);
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to verify payment.",
      500
    );
  }
}
