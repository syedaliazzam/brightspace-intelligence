import { NextResponse } from "next/server";
import { normalizeClassLevel } from "@/lib/academicCatalog";
import { sendEmail } from "@/lib/email";
import prisma from "@/lib/prisma";

function json(success, message, status) {
  return NextResponse.json({ success, message }, { status });
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeDate(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const studentName = normalizeText(body?.student_name);
    const parentName = normalizeText(body?.parent_name);
    const parentRelation = normalizeText(body?.parent_relation);
    const email = normalizeText(body?.email).toLowerCase();
    const phone = normalizeText(body?.phone);
    const cityCountry = normalizeText(body?.city_country);
    const gender = normalizeText(body?.gender);
    const dateOfBirth = normalizeDate(body?.date_of_birth);
    const currentSchool = normalizeText(body?.current_school);
    const age = Number(normalizeText(body?.age));
    const requestedClassLevel = normalizeText(body?.class_level);
    const normalizedClassLevel = normalizeClassLevel(body?.class_level);
    const classLevel = normalizedClassLevel || requestedClassLevel;
    const applyingForOther = normalizeText(body?.applying_for_other);
    const interestReason = normalizeText(body?.interest_reason);
    const hearAboutSource = normalizeText(body?.hear_about_source);
    const hearAboutOther = normalizeText(body?.hear_about_other);
    const notes = normalizeText(body?.notes);
    const leadToken = normalizeText(body?.leadToken);

    if (!studentName) return json(false, "Student name is required.", 400);
    if (!parentName) return json(false, "Parent name is required.", 400);
    if (!parentRelation) return json(false, "Parent relation is required.", 400);
    if (email && !isValidEmail(email)) return json(false, "Please enter a valid email address.", 400);
    if (!phone) return json(false, "Phone is required.", 400);
    if (!cityCountry) return json(false, "City and country are required.", 400);
    if (!gender) return json(false, "Gender is required.", 400);
    if (!dateOfBirth) return json(false, "Date of birth is required.", 400);
    if (!Number.isFinite(age) || age < 0) return json(false, "Student age must be a valid number.", 400);
    if (!classLevel) return json(false, "Class level is required.", 400);
    if (!interestReason) return json(false, "Please share why you are interested in Ash-Shajarah.", 400);
    if (!hearAboutSource) return json(false, "Please share how you heard about Ash-Shajarah.", 400);

    if (leadToken) {
      const [linkedLead] = await prisma.$queryRaw`
        SELECT
          id::text AS id,
          status::text AS status,
          registration_lead_id::text AS registration_lead_id
        FROM interested_students
        WHERE registration_token = ${leadToken}
        LIMIT 1
      `;

      if (linkedLead?.status === "registered" && linkedLead?.registration_lead_id) {
        return json(true, "Registration already completed.", 200);
      }
    }

    const [createdLead] = await prisma.$queryRaw`
      INSERT INTO registration_leads (
        student_name,
        parent_name,
        parent_relation,
        email,
        phone,
        age,
        class_level,
        city_country,
        gender,
        date_of_birth,
        current_school,
        applying_for_other,
        interest_reason,
        hear_about_source,
        hear_about_other,
        notes,
        source,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${studentName},
        ${parentName},
        ${parentRelation},
        ${email || null},
        ${phone},
        ${age},
        ${classLevel},
        ${cityCountry},
        ${gender},
        ${dateOfBirth}::date,
        ${currentSchool || null},
        ${applyingForOther || null},
        ${interestReason},
        ${hearAboutSource},
        ${hearAboutOther || null},
        ${notes || null},
        ${"website_registration"},
        CAST(${"new_lead"} AS registration_status),
        NOW(),
        NOW()
      )
      RETURNING id::text AS id
    `;

    if (createdLead?.id) {
      const interestedStudent = leadToken
        ? (await prisma.$queryRaw`
            SELECT
              student_name,
              parent_name,
              email,
              phone
            FROM interested_students
            WHERE registration_token = ${leadToken}
            LIMIT 1
          `)[0]
        : {
            student_name: studentName,
            parent_name: parentName,
            email,
            phone,
          };

      const [coordinator] = await prisma.$queryRaw`
        SELECT
          u.email,
          u.full_name
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE LOWER(r.name) = 'coordinator'
          AND LOWER(u.status::text) = 'active'
          AND COALESCE(NULLIF(TRIM(u.email), ''), '') <> ''
        ORDER BY u.created_at ASC NULLS LAST, u.id ASC
        LIMIT 1
      `;

      if (leadToken) {
        await prisma.$executeRaw`
          DELETE FROM interested_students
          WHERE registration_token = ${leadToken}
        `;
      }

      if (interestedStudent?.email) {
        const parentSubject = `Registration form submitted for ${studentName}`;
        const parentText = `Assalamualaikum ${parentName},

Your child has been successfully submitted the registration form.

Student: ${studentName}
Parent: ${parentName}
Email: ${email || "Not provided"}
Phone: ${phone}
Class Level: ${classLevel}
Status: submitted

Our team will contact you regarding admissions, parent orientation sessions, and future updates, In Sha Allah.`;
        const parentHtml = `
          <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
            <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
              <p style="margin:0 0 12px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#0284c7;font-weight:700;">Registration form submitted</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Assalamualaikum <strong>${parentName}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Thank you for your interest in Ash-Shajarah - The Learning Hub.</p>
              <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#f8fafc;font-size:14px;line-height:1.8;">
                <div><strong>Student:</strong> ${studentName}</div>
                <div><strong>Parent:</strong> ${parentName}</div>
                <div><strong>Email:</strong> ${email || "Not provided"}</div>
                <div><strong>Phone:</strong> ${phone}</div>
                <div><strong>Class Level:</strong> ${classLevel}</div>
                <div><strong>Status:</strong> submitted</div>
              </div>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Our team will contact you regarding admissions, parent orientation sessions, and future updates, In Sha Allah.</p>
            </div>
          </div>
        `;

        await sendEmail({
          to: interestedStudent.email,
          subject: parentSubject,
          html: parentHtml,
          text: parentText,
        });
      }

      if (coordinator?.email) {
        const coordinatorSubject = `Student submitted a registration form: ${studentName}`;
        const coordinatorText = `Assalamualaikum ${coordinator?.full_name || "Coordinator"},

A student has been successfully submitted the registration form.

Student: ${studentName}
Parent: ${parentName}
Email: ${email || "Not provided"}
Phone: ${phone}
Class Level: ${classLevel}
Gender: ${gender}
City & Country: ${cityCountry}
Status: submitted

Lead token: ${leadToken}`;
        const coordinatorHtml = `
          <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
            <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:24px;">
              <p style="margin:0 0 12px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#0284c7;font-weight:700;">Student submitted a registration form</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Assalamualaikum <strong>${coordinator?.full_name || "Coordinator"}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">A student has been successfully submitted the registration form.</p>
              <div style="border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#f8fafc;font-size:14px;line-height:1.8;">
                <div><strong>Student:</strong> ${studentName}</div>
                <div><strong>Parent:</strong> ${parentName}</div>
                <div><strong>Email:</strong> ${email || "Not provided"}</div>
                <div><strong>Phone:</strong> ${phone}</div>
                <div><strong>Class Level:</strong> ${classLevel}</div>
                <div><strong>Gender:</strong> ${gender}</div>
                <div><strong>City & Country:</strong> ${cityCountry}</div>
                <div><strong>Status:</strong> submitted</div>
              </div>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Lead token: ${leadToken || "N/A"}</p>
            </div>
          </div>
        `;

        await sendEmail({
          to: coordinator.email,
          subject: coordinatorSubject,
          html: coordinatorHtml,
          text: coordinatorText,
        });
      }
    }

    return json(true, "Thank you for your interest in Ash-Shajarah - The Learning Hub. Our team will contact you regarding admissions, parent orientation sessions, and future updates, In Sha Allah.", 201);
  } catch (error) {
    return json(false, error instanceof Error ? error.message : "Unable to submit registration.", 500);
  }
}
