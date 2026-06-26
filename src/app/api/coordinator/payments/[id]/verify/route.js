import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAppUrl, sendEmail } from "@/lib/email";
import { normalizeClassLevel } from "@/lib/academicCatalog";
import prisma from "@/lib/prisma";

const ALLOWED_ROLES = new Set(["admin", "coordinator"]);
const TRANSACTION_OPTIONS = { maxWait: 10000, timeout: 30000 };

function json(message, status = 200, extra = {}) {
  return NextResponse.json({ message, ...extra }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
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

function sanitizeCredentialPart(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildParentPassword(parentName, registrationNumber) {
  return `${sanitizeCredentialPart(parentName)}${sanitizeCredentialPart(registrationNumber)}`;
}

function buildStudentPassword(studentName, registrationNumber) {
  const { firstName } = splitName(studentName);
  return `${sanitizeCredentialPart(firstName)}${sanitizeCredentialPart(registrationNumber)}`;
}

function buildStudentUsername(studentName, classLevel, registrationNumber) {
  const parts = [
    sanitizeCredentialPart(studentName),
    sanitizeCredentialPart(classLevel),
    sanitizeCredentialPart(registrationNumber),
  ].filter(Boolean);

  return parts.join(".");
}

function buildCredentialsEmailBodies({
  parentName,
  parentEmail,
  parentPhone,
  parentPassword,
  studentName,
  studentUsername,
  studentPassword,
  loginUrl,
}) {
  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:24px;">
        <h2 style="margin:0 0 16px;">Login Credentials Created</h2>
        <div style="display:grid;gap:16px;">
          <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 10px;">Parent Login</h3>
            <p style="margin:4px 0;"><strong>Name:</strong> ${parentName || "-"}</p>
            <p style="margin:4px 0;"><strong>Email:</strong> ${parentEmail || "-"}</p>
            <p style="margin:4px 0;"><strong>Phone:</strong> ${parentPhone || "-"}</p>
            <p style="margin:4px 0;"><strong>Temporary Password:</strong> ${parentPassword || "-"}</p>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:14px;padding:16px;">
            <h3 style="margin:0 0 10px;">Student Login</h3>
            <p style="margin:4px 0;"><strong>Name:</strong> ${studentName || "-"}</p>
            <p style="margin:4px 0;"><strong>Username:</strong> ${studentUsername || "-"}</p>
            <p style="margin:4px 0;"><strong>Temporary Password:</strong> ${studentPassword || "-"}</p>
          </div>
          <div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:14px;padding:16px;">
            <p style="margin:0 0 8px;"><strong>Login Page:</strong></p>
            <a href="${loginUrl}" style="color:#2563eb;text-decoration:none;">${loginUrl}</a>
          </div>
        </div>
      </div>
    </div>
  `;

  const text = `
Login Credentials Created

Parent Login
Name: ${parentName || "-"}
Email: ${parentEmail || "-"}
Phone: ${parentPhone || "-"}
Temporary Password: ${parentPassword || "-"}

Student Login
Name: ${studentName || "-"}
Username: ${studentUsername || "-"}
Temporary Password: ${studentPassword || "-"}

Login Page:
${loginUrl}
`.trim();

  return { html, text };
}

async function insertCredentialsMessage({
  paymentId,
  recipientEmail,
  subject,
  body,
  bodyText,
  createdBy,
  tx,
}) {
  const messageId = crypto.randomUUID();

  await tx.$executeRaw`
    INSERT INTO outbound_messages (
      id,
      message_type,
      related_entity_type,
      related_entity_id,
      recipient_email,
      subject,
      body,
      body_text,
      sent_status,
      created_by,
      created_at,
      updated_at
    )
    VALUES (
      ${messageId}::uuid,
      'payment_credentials',
      'payment',
      ${paymentId}::uuid,
      ${recipientEmail},
      ${subject},
      ${body},
      ${bodyText},
      'pending',
      CAST(${createdBy || null} AS uuid),
      NOW(),
      NOW()
    )
  `;

  return {
    id: messageId,
    recipient_email: recipientEmail,
    subject,
    body_html: body,
    body_text: bodyText,
    sent_status: "pending",
  };
}

function getClassCode(classLevel) {
  const normalized = normalizeClassLevel(classLevel);
  const codes = {
    "Pre-Nursery": "PN",
    Nursery: "NUR",
    "KG-1": "KG1",
    "KG-2": "KG2",
  };

  if (!normalized || !codes[normalized]) {
    throw new Error("Invalid class level for roll number generation.");
  }

  return codes[normalized];
}

async function generateNextRollNo(classLevel, tx) {
  const classCode = getClassCode(classLevel);

  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${`student-roll:${classCode}`}))
  `;

  const [row] = await tx.$queryRaw`
    SELECT COALESCE(MAX(SUBSTRING(admission_no FROM '[0-9]+$')::int), 0)::int AS last_no
    FROM student_profiles
    WHERE admission_no LIKE ${`${classCode}-%`}
      AND admission_no ~ ${`^${classCode}-[0-9]+$`}
  `;

  return `${classCode}-${String(Number(row?.last_no || 0) + 1).padStart(4, "0")}`;
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
  const auditId = crypto.randomUUID();
  const entityType = options.entityType || "registration_leads";
  const entityId = options.entityId || targetId;

  await tx.$executeRaw`
    INSERT INTO audit_logs (
      id,
      actor_user_id,
      entity_type,
      entity_id,
      action
    )
    VALUES (
      ${auditId}::uuid,
      ${actorUserId}::uuid,
      ${entityType},
      ${entityId}::uuid,
      ${action}
    )
  `;
}

async function insertFeeVerification(payload, tx) {
  const verificationId = crypto.randomUUID();

  await tx.$executeRaw`
    INSERT INTO fee_verifications (
      id,
      fee_submission_id,
      verified_by,
      verified_at
    )
    VALUES (
      ${verificationId}::uuid,
      ${payload.feeSubmissionId}::uuid,
      ${payload.verifiedByUserId}::uuid,
      NOW()
    )
  `;
}


async function findExistingUser({ email, phone, roleName }, tx) {
  if (!email && !phone) return null;

  const normalizedRole = normalizeText(roleName).toLowerCase();
  const normalizedEmail = normalizeText(email).toLowerCase();

  const [parentUser] = email && phone
    ? await tx.$queryRaw`
        SELECT u.id::text AS id, LOWER(r.name) AS role_name
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE LOWER(r.name) = ${normalizedRole}
          AND (
            LOWER(u.email) = ${normalizedEmail}
            OR u.phone = ${phone}
          )
        LIMIT 1
      `
    : email
      ? await tx.$queryRaw`
          SELECT u.id::text AS id, LOWER(r.name) AS role_name
          FROM users u
          INNER JOIN roles r ON r.id = u.role_id
          WHERE LOWER(r.name) = ${normalizedRole}
            AND LOWER(u.email) = ${normalizedEmail}
          LIMIT 1
        `
      : await tx.$queryRaw`
          SELECT u.id::text AS id, LOWER(r.name) AS role_name
          FROM users u
          INNER JOIN roles r ON r.id = u.role_id
          WHERE LOWER(r.name) = ${normalizedRole}
            AND u.phone = ${phone}
          LIMIT 1
        `;

  if (parentUser?.id) return parentUser;

  const [anyUser] = email && phone
    ? await tx.$queryRaw`
        SELECT u.id::text AS id, LOWER(r.name) AS role_name
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE LOWER(u.email) = ${normalizedEmail}
           OR u.phone = ${phone}
        LIMIT 1
      `
    : email
      ? await tx.$queryRaw`
          SELECT u.id::text AS id, LOWER(r.name) AS role_name
          FROM users u
          LEFT JOIN roles r ON r.id = u.role_id
          WHERE LOWER(u.email) = ${normalizedEmail}
          LIMIT 1
        `
      : await tx.$queryRaw`
          SELECT u.id::text AS id, LOWER(r.name) AS role_name
          FROM users u
          LEFT JOIN roles r ON r.id = u.role_id
          WHERE u.phone = ${phone}
          LIMIT 1
        `;

  if (anyUser?.id) {
    throw new Error(
      `A user with this ${email ? "email" : "phone"} already exists${anyUser.role_name ? ` as ${anyUser.role_name}` : ""}.`
    );
  }

  return null;
}

async function createUser({ roleId, fullName, username, email, phone, passwordHash }, tx) {
  const userId = crypto.randomUUID();

  await tx.$executeRaw`
    INSERT INTO users (
      id,
      role_id,
      full_name,
      username,
      email,
      phone,
      password_hash,
      status,
      must_change_password
    )
    VALUES (
      ${userId}::uuid,
      ${roleId}::uuid,
      ${fullName},
      ${username || null},
      ${email || null},
      ${phone || null},
      ${passwordHash},
      'active'::user_status,
      true
    )
  `;

  return userId;
}

async function createUniqueStudentUsername({ studentName, classLevel, registrationNumber }, tx) {
  const baseUsername = buildStudentUsername(studentName, classLevel, registrationNumber);
  const safeBase = baseUsername || sanitizeCredentialPart(registrationNumber) || crypto.randomBytes(3).toString("hex");

  const [existing] = await tx.$queryRaw`
    SELECT username
    FROM users
    WHERE LOWER(username) LIKE ${`${safeBase.toLowerCase()}%`}
    ORDER BY username DESC NULLS LAST
    LIMIT 1
  `;

  if (!existing?.username) {
    return safeBase;
  }

  const suffix = sanitizeCredentialPart(registrationNumber) || crypto.randomBytes(2).toString("hex");
  return `${safeBase}.${suffix}`;
}

async function createProfile(tableName, payload, tx) {
  const profileId = crypto.randomUUID();

  if (tableName === "parent_profiles") {
    await tx.$executeRaw`
      INSERT INTO parent_profiles (
        id,
        user_id,
        relation
      )
      VALUES (
        ${profileId}::uuid,
        ${payload.userId}::uuid,
        ${payload.relation || "parent"}
      )
    `;

    return profileId;
  }

  if (tableName === "student_profiles") {
    await tx.$executeRaw`
      INSERT INTO student_profiles (
        id,
        user_id,
        admission_no,
        age,
        grade_level,
        status
      )
      VALUES (
        ${profileId}::uuid,
        ${payload.userId}::uuid,
        ${payload.admissionNo || null},
        ${payload.studentAge ? Number(payload.studentAge) : null},
        ${payload.classLevel || null},
        'active'::user_status
      )
    `;

    return profileId;
  }

  return null;
}

async function createStudentParentLink(studentId, parentId, tx) {
  await tx.$executeRaw`
    INSERT INTO student_parents (
      id,
      student_id,
      parent_id,
      is_primary
    )
    VALUES (
      ${crypto.randomUUID()}::uuid,
      ${studentId}::uuid,
      ${parentId}::uuid,
      true
    )
  `;
}

async function createEnrollmentForStudent(studentProfileId, registrationLeadId, classLevel, tx) {
  const normalizedClassLevel = normalizeClassLevel(classLevel);

  if (!normalizedClassLevel) {
    throw new Error("Registration class_level is invalid. Allowed values: Pre-Nursery, Nursery, KG-1, KG-2.");
  }

  const [course] = await tx.$queryRaw`
    SELECT id::text AS id
    FROM courses
    WHERE class_level = ${normalizedClassLevel}
      AND COALESCE(status, 'active'::user_status) = 'active'::user_status
    LIMIT 1
  `;

  if (!course?.id) {
    throw new Error(`Class not found for class_level: ${normalizedClassLevel}. Run prisma/seed-academic.sql.`);
  }

  const enrollmentId = crypto.randomUUID();

  await tx.$executeRaw`
    INSERT INTO enrollments (
      id,
      student_id,
      course_id,
      registration_id,
      start_date,
      status,
      created_at,
      updated_at
    )
    VALUES (
      ${enrollmentId}::uuid,
      ${studentProfileId}::uuid,
      ${course.id}::uuid,
      ${registrationLeadId}::uuid,
      CURRENT_DATE,
      'active',
      NOW(),
      NOW()
    )
    ON CONFLICT (student_id, course_id) DO NOTHING
  `;

  return enrollmentId;
}

async function insertCredentialDispatchLog(payload, tx) {
  await tx.$executeRaw`
    INSERT INTO credential_dispatch_logs (
      id,
      registration_id,
      sent_to_email,
      sent_to_phone,
      channel,
      status,
      error_message,
      created_at
    )
    VALUES (
      ${crypto.randomUUID()}::uuid,
      ${payload.metadata?.registrationLeadId || null}::uuid,
      ${payload.channel?.includes("email") ? payload.recipient || null : null},
      ${payload.channel?.includes("email") ? null : payload.recipient || null},
      ${payload.channel},
      ${payload.status},
      ${payload.message || null},
      NOW()
    )
  `;
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
      rl.age AS student_age
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
      }, TRANSACTION_OPTIONS);

      if (submission.email) {
        try {
          const portalUrl = getAppUrl()
            ? `${getAppUrl().replace(/\/+$/, "")}/login`
            : "http://localhost:3000/login";
          await sendEmail({
            to: submission.email,
            subject: "Payment rejected",
            text: `Your payment submission for voucher ${submission.voucher_no} was rejected.\n\nReason: ${rejectionReason}\n\nPlease contact support if you need help.\n\nLogin: ${portalUrl}`,
            html: `<div style="font-family:Arial,sans-serif;color:#0f172a;"><h2>Payment Rejected</h2><p>Your payment submission for voucher <strong>${submission.voucher_no}</strong> was rejected.</p><p><strong>Reason:</strong> ${rejectionReason}</p><p>Please contact support if you need help.</p><p><a href="${portalUrl}">Open LMS</a></p></div>`,
          });
        } catch (emailError) {
          console.error("SendGrid payment rejection email failed:", emailError);
        }
      }
      return json("Payment rejected.", 200);
    }

    // APPROVE FLOW
    const studentRollNo = await generateNextRollNo(submission.class_level, prisma);
    const parentTemporaryPassword = buildParentPassword(
      submission.parent_name || `${submission.student_name} Parent`,
      studentRollNo
    );
    const studentTemporaryPassword = buildStudentPassword(
      submission.student_name,
      studentRollNo
    );
    const [parentPasswordHash, studentPasswordHash] = await Promise.all([
      parentTemporaryPassword,
      studentTemporaryPassword
    ]);
    const parentContactEmail =
      submission.email || submission.parent_email || submission.parentEmail || "";
    const parentContactPhone =
      submission.phone || submission.parent_phone || submission.parentPhone || "";
    let studentLoginUsername = "";
    let parentLogin = parentContactEmail || parentContactPhone || "";

    const transactionResult = await prisma.$transaction(async (tx) => {
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

      const existingParent = await findExistingUser({
        email: parentContactEmail,
        phone: parentContactPhone,
        roleName: "parent",
      }, tx);


      let parentUserId = existingParent?.id || null;
      let parentProfileId = null;


      if (!existingParent) {
        parentUserId = await createUser({
          roleId: parentRoleId,
          fullName: submission.parent_name || `${submission.student_name} Parent`,
          email: parentContactEmail,
          phone: parentContactPhone,
          passwordHash: parentPasswordHash,
        }, tx);

        parentProfileId = await createProfile("parent_profiles", {
          userId: parentUserId,
          fullName: submission.parent_name || `${submission.student_name} Parent`,
          email: parentContactEmail,
          phone: parentContactPhone,
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
      else {
        const [existingParentRecord] = await tx.$queryRaw`
          SELECT email, phone
          FROM users
          WHERE id = ${parentUserId}::uuid
          LIMIT 1
        `;

        const [emailConflict] = parentContactEmail
          ? await tx.$queryRaw`
              SELECT id::text AS id
              FROM users
              WHERE id <> ${parentUserId}::uuid
                AND LOWER(email) = ${parentContactEmail.toLowerCase()}
              LIMIT 1
            `
          : [null];

        const [phoneConflict] = parentContactPhone
          ? await tx.$queryRaw`
              SELECT id::text AS id
              FROM users
              WHERE id <> ${parentUserId}::uuid
                AND phone = ${parentContactPhone}
              LIMIT 1
            `
          : [null];

        const safeParentEmail = emailConflict
          ? existingParentRecord?.email || null
          : parentContactEmail || existingParentRecord?.email || null;
        const safeParentPhone = phoneConflict
          ? existingParentRecord?.phone || null
          : parentContactPhone || existingParentRecord?.phone || null;

        await tx.$executeRaw`
          UPDATE users
          SET
            password_hash = ${parentPasswordHash},
            email = ${safeParentEmail},
            phone = ${safeParentPhone},
            status = 'active'::user_status,
            must_change_password = TRUE,
            updated_at = NOW()
          WHERE id = ${parentUserId}::uuid
        `;

        const [parentProfile] = await tx.$queryRaw`
          SELECT id::text AS id
          FROM parent_profiles
          WHERE user_id = ${parentUserId}::uuid
          LIMIT 1
        `;
        parentProfileId = parentProfile?.id || null;

        if (!parentProfileId) {
          parentProfileId = await createProfile("parent_profiles", {
            userId: parentUserId,
            fullName: submission.parent_name || `${submission.student_name} Parent`,
            email: parentContactEmail,
            phone: parentContactPhone,
            registrationLeadId: submission.registration_lead_id,
          }, tx);
        }
      }

      studentLoginUsername = await createUniqueStudentUsername({
        studentName: submission.student_name,
        classLevel: submission.class_level,
        registrationNumber: studentRollNo,
      }, tx);

      const studentUserId = await createUser({
        roleId: studentRoleId,
        fullName: submission.student_name,
        username: studentLoginUsername,
        email: null,
        phone: null,
        passwordHash: studentPasswordHash,
      }, tx);

      const studentProfileId = await createProfile("student_profiles", {
        userId: studentUserId,
        fullName: submission.student_name,
        email: null,
        phone: null,
        admissionNo: studentRollNo,
        classLevel: submission.class_level,
        address: submission.address,
        city: submission.city,
        studentAge: submission.student_age,
        registrationLeadId: submission.registration_lead_id,
      }, tx);
      await createStudentParentLink(studentProfileId, parentProfileId, tx);
      await createEnrollmentForStudent(
        studentProfileId,
        submission.registration_lead_id,
        submission.class_level,
        tx
      );
      await tx.$executeRaw`
        UPDATE fee_vouchers
        SET student_id = ${studentProfileId}::uuid
        WHERE id = ${submission.fee_voucher_id || submission.voucher_id}::uuid
      `;
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
        channel: parentContactEmail ? "sendgrid_email" : "whatsapp_placeholder",
        recipient: parentContactEmail || parentContactPhone || null,
        status: "pending_manual_dispatch",
        message: "Parent credentials queued for SendGrid dispatch.",
        metadata: { registrationLeadId: submission.registration_lead_id, voucherNo: submission.voucher_no },
      }, tx);

      await insertCredentialDispatchLog({
        userId: studentUserId,
        channel: parentContactEmail ? "sendgrid_email_parent_delivery" : "parent_delivery_placeholder",
        recipient: parentContactEmail || parentContactPhone || null,
        status: "pending_manual_dispatch",
        message: "Student credentials queued for parent delivery.",
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

      const loginUrl = `${getAppUrl().replace(/\/+$/, "")}/login`;
      const { html: credentialsHtml, text: credentialsText } = buildCredentialsEmailBodies({
        parentName: submission.parent_name || "Parent",
        parentEmail: parentContactEmail,
        parentPhone: parentContactPhone,
        parentPassword: parentTemporaryPassword,
        studentName: submission.student_name,
        studentUsername: studentLoginUsername,
        studentPassword: studentTemporaryPassword,
        loginUrl,
      });

      const credentialsMessage = await insertCredentialsMessage({
        paymentId: submission.id,
        recipientEmail: parentContactEmail || parentContactPhone || "",
        subject: "Your LMS access credentials",
        body: credentialsHtml,
        bodyText: credentialsText,
        createdBy: session.user.id,
        tx,
      });

      return {
        parentUserId,
        studentUserId,
        credentialsMessage,
        credentialsHtml,
        credentialsText,
        loginUrl,
      };
    }, TRANSACTION_OPTIONS);

    let credentialsEmail = null;
    let credentialsEmailSent = false;
    let credentialsSendError = "";

    if (parentContactEmail) {
      try {
        const portalUrl = getAppUrl()
          ? `${getAppUrl().replace(/\/+$/, "")}/login`
          : "http://localhost:3000/login";
        const { html, text } = buildCredentialsEmailBodies({
          parentName: submission.parent_name || "Parent",
          parentEmail: parentContactEmail,
          parentPhone: parentContactPhone,
          parentPassword: parentTemporaryPassword,
          studentName: submission.student_name,
          studentUsername: studentLoginUsername,
          studentPassword: studentTemporaryPassword,
          loginUrl: portalUrl,
        });

        await sendEmail({
          to: parentContactEmail,
          subject: "Your LMS access credentials",
          text,
          html,
        });
        credentialsEmailSent = true;
        credentialsEmail = {
          id: transactionResult?.credentialsMessage?.id || crypto.randomUUID(),
          recipient_email: parentContactEmail,
          subject: "Your LMS access credentials",
          body_html: html,
          body_text: text,
          sent_status: "sent",
          parent_phone: parentContactPhone || "",
        };
        if (transactionResult?.credentialsMessage?.id) {
          await prisma.$executeRaw`
            UPDATE outbound_messages
            SET sent_status = 'sent',
                sent_at = NOW(),
                updated_at = NOW()
            WHERE id = ${transactionResult.credentialsMessage.id}::uuid
          `;
        }
      } catch (emailError) {
        console.error("SendGrid credential email failed:", emailError);
        credentialsSendError =
          emailError instanceof Error ? emailError.message : "Credentials email failed to send.";
        credentialsEmail = {
          id: transactionResult?.credentialsMessage?.id || crypto.randomUUID(),
          recipient_email: parentContactEmail,
          subject: "Your LMS access credentials",
          body_html: "",
          body_text: `Login Credentials Created\n\nParent Login\nName: ${submission.parent_name || "Parent"}\nEmail: ${parentContactEmail || "-"}\nPhone: ${parentContactPhone || "-"}\nTemporary Password: ${parentTemporaryPassword}\n\nStudent Login\nName: ${submission.student_name}\nUsername: ${studentLoginUsername}\nTemporary Password: ${studentTemporaryPassword}\n\nLogin Page:\n${getAppUrl().replace(/\/+$/, "")}/login`,
          sent_status: "failed",
          parent_phone: parentContactPhone || "",
        };
        if (transactionResult?.credentialsMessage?.id) {
          await prisma.$executeRaw`
            UPDATE outbound_messages
            SET sent_status = 'failed',
                updated_at = NOW()
            WHERE id = ${transactionResult.credentialsMessage.id}::uuid
          `;
        }
      }
    }

    return json(
      credentialsEmailSent
        ? "Payment approved and credentials sent successfully."
        : "Payment approved, but credentials email failed to send.",
      200,
      {
        success: true,
        credentials_email: credentialsEmail || null,
        ...(credentialsEmailSent ? {} : { email_error: credentialsSendError || "Failed to send credentials email." }),
      }
    );
  } catch (error) {
    return json(
      error instanceof Error ? error.message : "Unable to verify payment.",
      500
    );
  }
}
