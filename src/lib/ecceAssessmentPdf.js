import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export function mainHeadingForSection(section) {
  const key = String(section?.key || "");
  if (["listening", "speaking", "reading", "writing"].includes(key)) return "Language Development";
  if (key === "health_hygiene") return "Hygiene & Health";
  if (key === "physical_development") return "Physical Development";
  if (key === "social_emotional") return "Social & Emotional Development";
  if (key === "environment_science") return "Science & Environment";
  if (key === "mathematical_development") return "Mathematical Development";
  return section?.title_en || "Assessment";
}

export function responseKey(section, criterion) {
  return `${section.key}:${criterion.order}`;
}

export function pairCriteria(criteria = []) {
  const pairs = [];
  for (let index = 0; index < criteria.length; index += 2) {
    pairs.push([criteria[index], criteria[index + 1] || null]);
  }
  return pairs;
}

export function getSectionCriteria(section) {
  return Array.isArray(section?.criteria) ? section.criteria : [];
}

export function labelForSectionCriterion(section, criterion) {
  if (!criterion) return "";
  return criterion.label_ur || criterion.label_en || criterion.key || "";
}

export function renderPairRow(section, item, [c1, c2], isSectionUrdu) {
  const key1 = c1 ? responseKey(section, c1) : null;
  const resp1 = key1 ? item.responses?.[key1] || {} : {};
  const lbl1 = c1 ? labelForSectionCriterion(section, c1) : "";
  const isUrdu1 = c1?.language === "ur" || /[\u0600-\u06FF]/.test(lbl1);

  const key2 = c2 ? responseKey(section, c2) : null;
  const resp2 = key2 ? item.responses?.[key2] || {} : {};
  const lbl2 = c2 ? labelForSectionCriterion(section, c2) : "";
  const isUrdu2 = c2?.language === "ur" || /[\u0600-\u06FF]/.test(lbl2);

  if (isSectionUrdu) {
    return `
      <div class="flex-row">
        <div class="cell-rating">${resp1.ft || "-"}</div>
        <div class="cell-rating">${resp1.mt || "-"}</div>
        <div class="cell-criteria ${isUrdu1 ? "urdu" : ""}" ${isUrdu1 ? 'dir="rtl"' : ""}>${lbl1 || "-"}</div>
        <div class="cell-rating">${c2 ? (resp2.ft || "-") : ""}</div>
        <div class="cell-rating">${c2 ? (resp2.mt || "-") : ""}</div>
        <div class="cell-criteria cell-last ${isUrdu2 ? "urdu" : ""}" ${isUrdu2 ? 'dir="rtl"' : ""}>${lbl2 || (c2 ? "-" : "")}</div>
      </div>
    `;
  }

  return `
    <div class="flex-row">
      <div class="cell-criteria">${lbl1 || "-"}</div>
      <div class="cell-rating">${resp1.mt || "-"}</div>
      <div class="cell-rating">${resp1.ft || "-"}</div>
      <div class="cell-criteria">${lbl2 || (c2 ? "-" : "")}</div>
      <div class="cell-rating">${c2 ? (resp2.mt || "-") : ""}</div>
      <div class="cell-rating cell-last">${c2 ? (resp2.ft || "-") : ""}</div>
    </div>
  `;
}

export function renderSectionChunk(section, item, chunkPairs, isContinuation = false) {
  if (!chunkPairs || !chunkPairs.length) return "";
  const mainHeading = mainHeadingForSection(section);
  const isSectionUrdu = section.key !== "mathematical_development";
  const thCriteria = isSectionUrdu ? "جائزے کے اہداف" : "Assessment Criteria";

  const rows = chunkPairs.map((pair) => renderPairRow(section, item, pair, isSectionUrdu)).join("");

  const subHeadingEn = section.title_en || "";
  const subHeadingUr = section.title_ur || "";
  const isLanguageSec = ["listening", "speaking", "reading", "writing"].includes(section.key);

  let subHeadingHtml = "";
  if (isLanguageSec) {
    subHeadingHtml = `<bdi dir="ltr">(${subHeadingEn})</bdi> ${subHeadingUr ? `<span class="head-slash">/</span> <bdi dir="rtl" class="urdu-sub">${subHeadingUr}</bdi>` : ""}`;
  } else if (subHeadingUr) {
    subHeadingHtml = `<bdi dir="rtl" class="urdu-sub">${subHeadingUr}</bdi>`;
  } else if (subHeadingEn && subHeadingEn !== mainHeading) {
    subHeadingHtml = `<bdi dir="ltr">(${subHeadingEn})</bdi>`;
  }

  const displayHeading = isContinuation ? `${mainHeading} (Continued)` : mainHeading;

  return `
    <div class="section-card">
      <div class="section-title-wrap">
        <span class="section-main-heading">${displayHeading}</span>
        ${subHeadingHtml ? `<div class="section-sub-heading">${subHeadingHtml}</div>` : ""}
      </div>
      <div class="flex-table">
        ${isSectionUrdu ? `
          <div class="flex-row flex-head">
            <div class="cell-rating cell-head">FT</div>
            <div class="cell-rating cell-head">MT</div>
            <div class="cell-criteria cell-head urdu" dir="rtl" style="text-align: right; justify-content: flex-start;"><bdi dir="rtl">${thCriteria}</bdi></div>
            <div class="cell-rating cell-head">FT</div>
            <div class="cell-rating cell-head">MT</div>
            <div class="cell-criteria cell-head cell-last urdu" dir="rtl" style="text-align: right; justify-content: flex-start;"><bdi dir="rtl">${thCriteria}</bdi></div>
          </div>
        ` : `
          <div class="flex-row flex-head">
            <div class="cell-criteria cell-head" style="text-align: left; justify-content: flex-start;">Assessment Criteria</div>
            <div class="cell-rating cell-head">MT</div>
            <div class="cell-rating cell-head">FT</div>
            <div class="cell-criteria cell-head" style="text-align: left; justify-content: flex-start;">Assessment Criteria</div>
            <div class="cell-rating cell-head">MT</div>
            <div class="cell-rating cell-head cell-last">FT</div>
          </div>
        `}
        <div class="flex-body">
          ${rows}
        </div>
      </div>
    </div>
  `;
}

export function renderSectionCard(section, item) {
  const criteria = getSectionCriteria(section);
  const pairs = pairCriteria(criteria);
  return renderSectionChunk(section, item, pairs, false);
}

export function renderSubjectPerfTable(item, term) {
  const remarks = item.responses?.__remarks || {};
  const signatures = item.responses?.__signatures || {};
  const subjectPerf = Array.isArray(item.subject_performance) ? item.subject_performance : [];
  if (!subjectPerf.length) return "";

  const subjectRows = subjectPerf.map((row) => {
    const rawSubj = row.subject === "دینی" ? "فہمِ دین" : (row.subject || "-");
    const isUrdu = rawSubj.includes("دین") || /[\u0600-\u06FF]/.test(rawSubj);
    const perfVal = row.performance || row.midPerformance || row.finalPerformance || "-";
    return `
      <div class="subj-subrow">
        <div class="subj-name ${isUrdu ? "urdu" : ""}" ${isUrdu ? 'dir="rtl"' : ""}>${rawSubj}</div>
        <div class="subj-perf">${perfVal}</div>
      </div>
    `;
  }).join("");

  return `
    <div class="section-card">
      <div class="section-title-wrap">
        <span class="section-main-heading">Subject Wise Performance</span>
        <span class="section-sub-heading">(${term})</span>
      </div>
      <div class="flex-table">
        <div class="flex-row flex-head" style="align-items: stretch;">
          <div style="width: 32%; display: flex; border-right: 1px solid #D8CCB0;">
            <div style="width: 56.25%;" class="cell-head-center">Subjects</div>
            <div style="width: 43.75%; border-right: none;" class="cell-head-center">Performance</div>
          </div>
          <div style="width: 68%; display: flex; flex-direction: column;">
            <div style="width: 100%; border-bottom: 1px solid #D8CCB0; padding: 6px 0 12px 0;" class="cell-head-center">Remarks</div>
            <div style="width: 100%; display: flex; flex: 1;">
              <div style="width: 33.33%; border-right: 1px solid #D8CCB0;" class="cell-head-center">Teacher</div>
              <div style="width: 33.33%; border-right: 1px solid #D8CCB0;" class="cell-head-center">Principal</div>
              <div style="width: 33.34%; border-right: none;" class="cell-head-center cell-last">Parents</div>
            </div>
          </div>
        </div>
        <div class="flex-row" style="align-items: stretch;">
          <div style="width: 32%; display: flex; flex-direction: column; border-right: 1px solid #D8CCB0;">
            ${subjectRows}
          </div>
          <div style="width: 22.66%; border-right: 1px solid #D8CCB0;" class="cell-remarks">${remarks.teacher || item.teacher_remarks || "—"}</div>
          <div style="width: 22.66%; border-right: 1px solid #D8CCB0;" class="cell-remarks">${remarks.principal || "—"}</div>
          <div style="width: 22.66%;" class="cell-remarks cell-last">${remarks.parents || "—"}</div>
        </div>
        <div class="flex-row sig-row" style="min-height: 38px;">
          <div style="width: 32%;" class="sig-label">Name &amp; Signature</div>
          <div style="width: 22.66%;" class="sig-cell">${signatures.teacher || "—"}</div>
          <div style="width: 22.66%;" class="sig-cell">${signatures.principal || "—"}</div>
          <div style="width: 22.66%;" class="sig-cell cell-last">${signatures.parents || "—"}</div>
        </div>
      </div>
    </div>
  `;
}

export function renderRatingKey() {
  return `
    <div class="rating-key-box">
      <p class="rating-key-title">Rating Key</p>
      <div class="rating-key-grid">
        <div class="rating-key-item">
          <p class="rating-key-code">A+</p>
          <p class="rating-key-desc">Excellent / Always</p>
        </div>
        <div class="rating-key-item">
          <p class="rating-key-code">A</p>
          <p class="rating-key-desc">Good / Mostly</p>
        </div>
        <div class="rating-key-item">
          <p class="rating-key-code">B</p>
          <p class="rating-key-desc">Average / Needs Improvement</p>
        </div>
        <div class="rating-key-item">
          <p class="rating-key-code">C</p>
          <p class="rating-key-desc">Below Average / Special Attention</p>
        </div>
        <div class="rating-key-item">
          <p class="rating-key-code">NA</p>
          <p class="rating-key-desc">Not Observed</p>
        </div>
      </div>
    </div>
  `;
}

export function renderFooterNote() {
  return `
    <div class="report-footer">
      Basis of ECCE Assessment / EDI / Azeem Siddiqui / azeemedi@gmail.com / 0333 218 54 71 / Ash-Shajar-25th July 2026
    </div>
  `;
}

export function generateAssessmentPagesHtml(item, sections = []) {
  const studentInfo = item.responses?.__studentInfo || {};
  const studentName = studentInfo.studentName || item.student_name || "-";
  const fatherName = studentInfo.fatherName || item.father_name || "-";
  const className = studentInfo.className || item.class_name || "-";
  const rollNo = studentInfo.rollNo || item.admission_no || "-";
  const age = studentInfo.age || item.age || "-";
  const academicYear = studentInfo.academicYear || item.academic_year || "-";
  const term = studentInfo.term || item.term || "-";
  const td = studentInfo.attendanceTd || item.attendance?.total || "-";
  const pd = studentInfo.attendancePd || item.attendance?.present || "-";

  const photoUrl = item.profile_picture_url ||
    (studentInfo.picturePath && (/^https?:\/\//i.test(studentInfo.picturePath) || studentInfo.picturePath.startsWith("data:") || studentInfo.picturePath.startsWith("blob:")) ? studentInfo.picturePath : "") ||
    (studentInfo.picturePath ? `/api/file-preview?path=${encodeURIComponent(studentInfo.picturePath)}` : "") ||
    (item.profile_picture_path && (/^https?:\/\//i.test(item.profile_picture_path) || item.profile_picture_path.startsWith("data:") || item.profile_picture_path.startsWith("blob:")) ? item.profile_picture_path : "") ||
    (item.profile_picture_path ? `/api/file-preview?path=${encodeURIComponent(item.profile_picture_path)}` : "");

  const headerCard = `
    <div class="header-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h1 class="school-title">Ash-Shajrah Learning Hub</h1>
          <p class="doc-title">Early Childhood Care &amp; Education (ECCE) Assessment Report</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:12px; font-weight:800; color:#E4C766;">${term || "Assessment"}</p>
          <p style="font-size:11px; color:#FFFFFF99;">Academic Year: ${academicYear}</p>
        </div>
      </div>
    </div>
  `;

  const infoCard = `
    <div class="info-card">
      ${photoUrl ? `
        <div class="photo-box">
          <img src="${photoUrl}" alt="${studentName}" class="photo-img" crossOrigin="anonymous" />
        </div>
      ` : ""}
      <div class="info-grid">
        <div class="info-row"><span class="info-label">Student's Name:</span><span class="info-value">${studentName}</span></div>
        <div class="info-row"><span class="info-label">Father's Name:</span><span class="info-value">${fatherName}</span></div>
        <div class="info-row"><span class="info-label">Class / Section:</span><span class="info-value">${className}</span></div>
        <div class="info-row"><span class="info-label">Roll / Admission #:</span><span class="info-value">${rollNo}</span></div>
        <div class="info-row"><span class="info-label">Date of Birth / Age:</span><span class="info-value">${age}</span></div>
        <div class="info-row"><span class="info-label">Academic Year / Term:</span><span class="info-value">${academicYear} | ${term}</span></div>
        <div class="info-row"><span class="info-label">Attendance (${term}):</span><span class="info-value">TD: ${td} | PD: ${pd}</span></div>
        <div class="info-row"><span class="info-label">Status:</span><span class="info-value">${item.status || "COMPLETED"}</span></div>
      </div>
    </div>
  `;

  // Height budget per A4 page in CSS px (page max content without overflow)
  const PAGE_BUDGET = 1000;
  const SECTION_OVERHEAD = 85; // Card title wrap, table header with bottom padding, margins
  const ROW_HEIGHT = 38; // Row height with 13px bottom padding inside cells
  const CLOSING_BLOCKS_HEIGHT = 360; // Subject table (~200) + Rating key (~135) + Footer (~25)

  const pages = [];
  let currentPage = [];
  let currentHeight = 0;

  // Initialize Page 1 with header and student info card
  currentPage.push(headerCard);
  currentPage.push(infoCard);
  currentHeight = 270;

  const validSections = Array.isArray(sections) ? sections : [];

  for (const section of validSections) {
    const criteria = getSectionCriteria(section);
    const pairs = pairCriteria(criteria);
    if (!pairs.length) continue;

    let pairIdx = 0;
    let isContinuation = false;

    while (pairIdx < pairs.length) {
      let spaceLeft = PAGE_BUDGET - currentHeight;

      // If not enough room on current page for overhead + at least 1 row, wrap to new page
      if (spaceLeft < SECTION_OVERHEAD + ROW_HEIGHT + 5) {
        pages.push(currentPage);
        currentPage = [];
        currentHeight = 0;
        spaceLeft = PAGE_BUDGET;
      }

      // Calculate how many rows fit in current remaining page budget
      const maxRowsCanFit = Math.max(1, Math.floor((spaceLeft - SECTION_OVERHEAD) / ROW_HEIGHT));
      const remainingRowsCount = pairs.length - pairIdx;
      let countToTake = Math.min(maxRowsCanFit, remainingRowsCount);

      // Avoid leaving an isolated single orphan row on next page if space allows slight flex
      if (remainingRowsCount - countToTake === 1 && countToTake > 1) {
        if (spaceLeft >= SECTION_OVERHEAD + (remainingRowsCount * ROW_HEIGHT) - 15) {
          countToTake = remainingRowsCount;
        } else {
          countToTake = countToTake - 1;
        }
      }

      const chunkPairs = pairs.slice(pairIdx, pairIdx + countToTake);
      const chunkHtml = renderSectionChunk(section, item, chunkPairs, isContinuation);

      currentPage.push(chunkHtml);
      currentHeight += SECTION_OVERHEAD + (chunkPairs.length * ROW_HEIGHT);

      pairIdx += countToTake;
      isContinuation = true;

      // If more rows remain in this section, wrap to a new page
      if (pairIdx < pairs.length) {
        pages.push(currentPage);
        currentPage = [];
        currentHeight = 0;
      }
    }
  }

  // Position closing blocks (Subject Performance Table, Rating Key, Footer Note)
  const subjectPerfHtml = renderSubjectPerfTable(item, term);
  const ratingKeyHtml = renderRatingKey();
  const footerNoteHtml = renderFooterNote();

  const closingHtml = `
    ${subjectPerfHtml}
    ${ratingKeyHtml}
    ${footerNoteHtml}
  `;

  if (PAGE_BUDGET - currentHeight >= CLOSING_BLOCKS_HEIGHT - 25) {
    currentPage.push(closingHtml);
  } else {
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    currentPage = [closingHtml];
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  const pagesHtml = pages.map((pageElements, index) => `
    <div class="pdf-page" id="pdf-page-${index + 1}">
      ${pageElements.join("\n")}
    </div>
  `);

  const styles = `
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700;800&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Noto+Naskh+Arabic:wght@400;600;700;800&family=Amiri:wght@400;700&display=swap');

      * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
      
      body {
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #063F32;
        background: #FAF7F0;
        -webkit-font-smoothing: antialiased;
      }

      .pdf-page {
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #063F32;
        background: #FAF7F0;
        padding: 16px 22px;
        line-height: 1.35;
        width: 800px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
      }

      .header-card { background: linear-gradient(135deg, #0F4C3A 0%, #0B3D30 100%); color: white; border-radius: 12px; padding: 15px 18px 36px 18px; margin-bottom: 10px; box-shadow: 0 4px 14px rgba(15,76,58,0.18); }
      .school-title { font-size: 21px; font-weight: 900; color: #F7E7A9; line-height: 1.25; }
      .doc-title { font-size: 14px; font-weight: 800; margin-top: 6px; color: #FFFFFF; line-height: 1.35; }
      
      .info-card { background: #FFFFFF; border: 1.5px solid rgba(45, 138, 106, 0.22); border-radius: 12px; padding: 12px 16px; margin-bottom: 10px; display: flex; flex-direction: row; align-items: center; gap: 18px; box-shadow: 0 2px 10px rgba(6,63,50,0.04); }
      .photo-box { width: 124px; height: 142px; border: 2.5px solid #0F4C3A; border-radius: 10px; overflow: hidden; flex-shrink: 0; background: #EFECE4; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
      .photo-img { width: 100%; height: 100%; object-fit: contain; display: block; background: #FFFFFF; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; font-size: 11.5px; flex: 1; }
      .info-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #D8CCB0; padding-bottom: 8px; padding-top: 2px; }
      .info-label { font-weight: 700; color: #0F4C3A; }
      .info-value { font-weight: 600; color: #245C4F; }

      .section-card { background: #FFFFFF; border: 1.5px solid #D8CCB0; border-radius: 10px; padding: 12px 14px 10px 14px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(6,63,50,0.04); }
      .section-title-wrap { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; width: 100%; }
      .section-main-heading { font-size: 13.5px; font-weight: 900; color: #063F32; text-align: left; white-space: nowrap; flex-shrink: 0; }
      .section-sub-heading { font-size: 12px; font-weight: 700; color: #245C4F; text-align: right; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; direction: ltr; }
      .head-slash { color: #8F8165; font-weight: 600; margin: 0 3px; }
      .urdu-sub { font-family: 'Noto Naskh Arabic', 'Amiri', 'Segoe UI', Tahoma, serif; direction: rtl; font-size: 13px; word-spacing: 0.05em; display: inline-block; unicode-bidi: isolate; }

      .flex-table { width: 100%; border: 1.5px solid #D8CCB0; border-radius: 8px; overflow: hidden; background: #FFFFFF; display: flex; flex-direction: column; margin-top: 2px; }
      .flex-row { display: flex; flex-direction: row; align-items: stretch; border-bottom: 1px solid #D8CCB0; min-height: 36px; width: 100%; box-sizing: border-box; }
      .flex-row:last-child { border-bottom: none; }
      .flex-head { background: #ECE5D4; font-weight: 800; color: #0F4C3A; min-height: 32px; }
      .cell-head { background: #ECE5D4 !important; color: #0F4C3A !important; font-weight: 800 !important; font-size: 11px !important; padding-bottom: 12px !important; }
      .cell-head-center { display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 800; font-size: 11px; color: #0F4C3A; background: #ECE5D4; border-right: 1px solid #D8CCB0; padding: 6px 4px 13px 4px; box-sizing: border-box; }
      .cell-criteria.cell-head.urdu { word-spacing: 0.06em !important; font-size: 11.5px !important; }
      
      .cell-rating { width: 7%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 800; font-size: 11.5px; color: #0F4C3A; background: #FFFDF8; border-right: 1px solid #D8CCB0; padding: 5px 2px 13px 2px; box-sizing: border-box; }
      .cell-criteria { width: 36%; flex-grow: 1; display: flex; align-items: center; color: #063F32; font-weight: 600; font-size: 11px; line-height: 1.35; padding: 5px 8px 13px 8px; border-right: 1px solid #D8CCB0; box-sizing: border-box; word-break: break-word; overflow-wrap: break-word; }
      .cell-criteria.urdu { font-family: 'Noto Naskh Arabic', 'Amiri', 'Segoe UI', Tahoma, sans-serif !important; direction: rtl; text-align: right; justify-content: flex-start; font-size: 11.5px; line-height: 1.45; padding: 5px 10px 13px 10px; word-spacing: 0.05em; letter-spacing: normal; }
      .cell-last { border-right: none !important; }

      .subj-subrow { display: flex; flex-direction: row; align-items: stretch; border-bottom: 1px solid #D8CCB0; flex: 1; min-height: 32px; }
      .subj-subrow:last-child { border-bottom: none; }
      .subj-name { width: 56.25%; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 700; font-size: 11px; background: #FFFDF8; border-right: 1px solid #D8CCB0; padding: 5px 4px 13px 4px; color: #063F32; box-sizing: border-box; }
      .subj-name.urdu { font-family: 'Noto Naskh Arabic', 'Amiri', Tahoma, serif !important; direction: rtl; font-size: 12px; word-spacing: 0.05em; }
      .subj-perf { width: 43.75%; display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 800; font-size: 11.5px; color: #0F4C3A; background: #FFFDF8; padding: 5px 4px 13px 4px; box-sizing: border-box; }
      .cell-remarks { display: flex; align-items: flex-start; text-align: left; padding: 10px 12px 24px 12px; font-size: 10.5px; color: #245C4F; line-height: 1.4; word-break: break-word; white-space: pre-wrap; box-sizing: border-box; }

      .sig-row { background: #ECE5D4; }
      .sig-label { display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; color: #0F4C3A; background: #ECE5D4; border-right: 1px solid #D8CCB0; padding: 6px 4px 13px 4px; box-sizing: border-box; }
      .sig-cell { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #063F32; background: #FFFDF8; border-right: 1px solid #D8CCB0; padding: 6px 4px 13px 4px; box-sizing: border-box; }

      .rating-key-box { background: #FFF8E4; border: 1.5px solid rgba(199, 154, 59, 0.4); border-radius: 10px; padding: 14px 16px 20px 16px; margin-top: 12px; box-sizing: border-box; }
      .rating-key-title { font-size: 11px; font-weight: 900; letter-spacing: 0.12em; text-transform: uppercase; color: #0F4C3A; margin-bottom: 12px; text-align: left; }
      .rating-key-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; text-align: center; }
      .rating-key-item { background: #FFFFFF; border: 1px solid rgba(199, 154, 59, 0.3); border-radius: 6px; padding: 10px 6px 18px 6px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .rating-key-code { font-weight: 900; color: #0F4C3A; font-size: 13px; line-height: 1.2; }
      .rating-key-desc { font-size: 9.5px; color: #245C4F; margin-top: 5px; line-height: 1.3; font-weight: 600; text-align: center; }

      .report-footer { background: transparent; border: none; padding: 10px 0 2px 0; margin-top: 8px; text-align: center; font-size: 9.5px; font-weight: 600; color: #0F4C3A; letter-spacing: 0.02em; }
    </style>
  `;

  return {
    pagesHtml,
    styles,
  };
}

export function generateAssessmentHtml(item, sections) {
  const { pagesHtml, styles } = generateAssessmentPagesHtml(item, sections);
  return `
    <div class="report-root">
      ${styles}
      ${pagesHtml.join("")}
    </div>
  `;
}

export async function downloadAssessmentPdf(item, sections) {
  const { pagesHtml, styles } = generateAssessmentPagesHtml(item, sections);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0px";
  iframe.style.width = "860px";
  iframe.style.height = "1300px";
  iframe.style.border = "none";
  iframe.style.zIndex = "-99999";
  iframe.style.opacity = "1";
  iframe.style.visibility = "visible";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head>${styles}</head><body style="margin:0;padding:0;background:#FAF7F0;">${pagesHtml.join("")}</body></html>`);
    doc.close();

    if (iframe.contentWindow?.document?.fonts?.ready) {
      await iframe.contentWindow.document.fonts.ready;
      try {
        await Promise.all([
          iframe.contentWindow.document.fonts.load("400 12px 'Noto Naskh Arabic'"),
          iframe.contentWindow.document.fonts.load("600 12px 'Noto Naskh Arabic'"),
          iframe.contentWindow.document.fonts.load("700 12px 'Noto Naskh Arabic'"),
          iframe.contentWindow.document.fonts.load("400 12px 'Outfit'"),
          iframe.contentWindow.document.fonts.load("600 12px 'Outfit'"),
          iframe.contentWindow.document.fonts.load("700 12px 'Outfit'"),
          iframe.contentWindow.document.fonts.load("800 12px 'Outfit'"),
          iframe.contentWindow.document.fonts.load("900 12px 'Outfit'"),
        ]);
      } catch {
        // Fallback gracefully
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 800));

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    const pdfPageWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();

    const pageElements = doc.querySelectorAll(".pdf-page");

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i];
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#FAF7F0",
        width: 800,
        windowWidth: 800,
      });

      if (i > 0) {
        pdf.addPage();
      }

      pdf.setFillColor(250, 247, 240);
      pdf.rect(0, 0, pdfPageWidth, pdfPageHeight, "F");

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const imgHeight = (canvas.height * pdfPageWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, pdfPageWidth, Math.min(imgHeight, pdfPageHeight), undefined, "FAST");
    }

    const studentInfo = item.responses?.__studentInfo || {};
    const studentName = studentInfo.studentName || item.student_name || "Student";
    const term = studentInfo.term || item.term || "Assessment";
    const cleanName = String(studentName).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    const cleanTerm = String(term).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `ECCE_Assessment_${cleanName}_${cleanTerm}.pdf`;

    pdf.save(fileName);
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}
