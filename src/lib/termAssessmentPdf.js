import { jsPDF } from "jspdf";
import { getAreaChartData } from "@/components/assessments/PizzaPieChart";

/**
 * Returns the canonical term/assessment display name (preferring template_name / assessment_name over legacy generic term fallback).
 */
export function getAssessmentDisplayTerm(item) {
  if (!item) return "Term Assessment";
  const tName = String(item.template_name || "").trim();
  if (tName && tName !== "Custom Assessment") {
    return tName;
  }
  const aName = String(item.assessment_name || "").trim();
  if (aName && aName !== "Custom Assessment") {
    return aName;
  }
  return String(item.term || "").trim() || "Term Assessment";
}

function formatScore(rawScore) {
  const num = Number(rawScore);
  if (isNaN(num)) return "0%";
  if (num > 0 && num <= 1) {
    return `${Math.round(num * 100)}%`;
  }
  return `${Math.round(num)}%`;
}

/**
 * Draws a rounded rectangle path (supports single radius or [tl, tr, br, bl] array).
 */
function roundRectPath(ctx, x, y, w, h, radii) {
  const r = Array.isArray(radii)
    ? radii
    : [radii, radii, radii, radii];
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr > 0) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - br);
  if (br > 0) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + bl, y + h);
  if (bl > 0) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + tl);
  if (tl > 0) ctx.quadraticCurveTo(x, y, x + tl, y);
  else ctx.lineTo(x, y);
  ctx.closePath();
}

/**
 * Draws text whose ACTUAL VISIBLE INK (actualBoundingBoxAscent + actualBoundingBoxDescent)
 * is mathematically dead-centered vertically around `centerY`!
 * Guarantees exact equal top and bottom padding regardless of font metrics.
 */
function drawOpticalText(ctx, text, x, centerY, align = "left", letterSpacing = 0) {
  const str = String(text ?? "");
  ctx.save();
  ctx.textBaseline = "alphabetic";
  if (letterSpacing > 0 && "letterSpacing" in ctx) {
    ctx.letterSpacing = `${letterSpacing}px`;
  }
  const m = ctx.measureText(str);
  const ascent = typeof m.actualBoundingBoxAscent === "number" ? m.actualBoundingBoxAscent : 0;
  const descent = typeof m.actualBoundingBoxDescent === "number" ? m.actualBoundingBoxDescent : 0;

  let drawY = centerY;
  if (ascent > 0 || descent > 0) {
    drawY = centerY + (ascent - descent) / 2;
  } else {
    ctx.textBaseline = "middle";
  }

  ctx.textAlign = align;
  ctx.fillText(str, x, drawY);
  ctx.restore();
}

/**
 * Word-wraps text cleanly to fit within maxWidth using ctx.measureText.
 */
function wrapTextLines(ctx, text, maxWidth) {
  const raw = String(text ?? "").trim();
  if (!raw) return [];
  const paragraphs = raw.split(/\r?\n/);
  const lines = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const testLine = `${currentLine} ${words[i]}`;
      if (ctx.measureText(testLine).width <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
  }
  return lines;
}

function drawGraduationCapIcon(ctx, cx, cy, size = 24, color = "#0D5C48") {
  ctx.save();
  const s = size / 24;
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Top mortarboard diamond
  ctx.beginPath();
  ctx.moveTo(2, 10);
  ctx.lineTo(12, 5);
  ctx.lineTo(22, 10);
  ctx.lineTo(12, 15);
  ctx.closePath();
  ctx.stroke();

  // Tassel line
  ctx.beginPath();
  ctx.moveTo(22, 10);
  ctx.lineTo(22, 16);
  ctx.stroke();

  // Base cap
  ctx.beginPath();
  ctx.moveTo(6, 12);
  ctx.lineTo(6, 17);
  ctx.bezierCurveTo(9, 20, 15, 20, 18, 17);
  ctx.lineTo(18, 12);
  ctx.stroke();

  ctx.restore();
}

function drawAwardIcon(ctx, cx, cy, size = 14, color = "#0D5C48") {
  ctx.save();
  const s = size / 24;
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.arc(12, 8, 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(8.21, 13.89);
  ctx.lineTo(7, 23);
  ctx.lineTo(12, 20);
  ctx.lineTo(17, 23);
  ctx.lineTo(15.79, 13.88);
  ctx.stroke();

  ctx.restore();
}

function drawPizzaChartOnCanvas(ctx, skills = [], cx, cy, diameter = 128) {
  const { chartData } = getAreaChartData(skills);
  const radius = diameter / 2 - 4;
  const validItems = chartData.filter((d) => Number(d.value) > 0);
  const total = validItems.reduce((acc, item) => acc + Number(item.value), 0);

  if (total === 0 || validItems.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#F3F4F6";
    ctx.fill();
    ctx.font = `600 11px ${ctx.__fontFamily}`;
    ctx.fillStyle = "#9CA3AF";
    drawOpticalText(ctx, "No data", cx, cy, "center");
    return;
  }

  if (validItems.length === 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = validItems[0].color || "#10B981";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
    return;
  }

  let runningAngle = -Math.PI / 2;
  for (const item of validItems) {
    const val = Number(item.value);
    const angle = (val / total) * 2 * Math.PI;
    const startAngle = runningAngle;
    const endAngle = runningAngle + angle;
    runningAngle = endAngle;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = item.color || "#10B981";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#FFFFFF";
    ctx.stroke();
  }
}

function drawPill(ctx, text, rightOrCenterX, centerY, {
  align = "right",
  font,
  textColor,
  bgColor,
  borderColor,
  height = 26,
  padX = 12,
}) {
  ctx.save();
  ctx.font = font;
  const textW = ctx.measureText(text).width;
  const pillW = Math.ceil(textW + padX * 2);
  const pillX =
    align === "right"
      ? rightOrCenterX - pillW
      : align === "center"
        ? rightOrCenterX - pillW / 2
        : rightOrCenterX;
  const pillY = centerY - height / 2;

  roundRectPath(ctx, pillX, pillY, pillW, height, height / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  ctx.fillStyle = textColor;
  drawOpticalText(ctx, text, pillX + pillW / 2, centerY, "center");
  ctx.restore();
  return pillW;
}

/**
 * Generates crisp High-DPI Canvas pages matching the exact Term Assessment UI styles,
 * with mathematically exact optical text centering (zero html2canvas baseline bugs).
 */
export function renderTermAssessmentCanvases(item, scale = 2.5) {
  const PAGE_W = 800;
  const PAGE_H = 1131; // Standard A4 ratio
  const MARGIN_X = 24;
  const MARGIN_TOP = 22;
  const CARD_W = PAGE_W - MARGIN_X * 2; // 752px
  const INNER_PAD_X = 24;
  const CONTENT_W = CARD_W - INNER_PAD_X * 2; // 704px
  const FOOTER_Y = PAGE_H - 22;
  const MAX_CARD_BOTTOM = FOOTER_Y - 22;

  const fontFamily =
    typeof window !== "undefined" && typeof document !== "undefined" && document.body
      ? window.getComputedStyle(document.body).fontFamily || "system-ui, -apple-system, sans-serif"
      : "system-ui, -apple-system, sans-serif";

  const studentName = item.student_name || "Student";
  const fatherName = item.father_name || "";
  const className = item.class_name || "";
  const rollNo = item.admission_no || "";
  const academicYear = item.academic_year || "Current Year";
  const term = getAssessmentDisplayTerm(item);
  const teacherRemarks = String(item.teacher_remarks || "").trim();

  const records = Array.isArray(item.records)
    ? item.records
    : typeof item.records === "string"
      ? JSON.parse(item.records || "[]")
      : [];

  const totalSkillsCount = records.reduce((acc, area) => acc + (area.skills?.length || 0), 0);

  // Offscreen helper context for deterministic text measurement before painting
  const measureCanvas = document.createElement("canvas");
  measureCanvas.width = 10;
  measureCanvas.height = 10;
  const mCtx = measureCanvas.getContext("2d");
  mCtx.__fontFamily = fontFamily;

  // --- Step 1: Pre-compute Pizza Card Legend Layouts & Chart Row Heights ---
  const GRID_GAP = 14;
  const PIZZA_CARD_W = (CONTENT_W - GRID_GAP) / 2; // 345px
  const PIZZA_INNER_W = PIZZA_CARD_W - 28; // 317px

  const preparedAreas = records.map((area) => {
    const skills = area.skills || [];
    const { chartData } = getAreaChartData(skills);

    // Measure wrapped title lines cleanly using full card inner width
    mCtx.font = `800 12.5px ${fontFamily}`;
    const titleLines = wrapTextLines(mCtx, area.area_name, PIZZA_INNER_W);

    // Layout legend items into centered horizontal rows
    const legendRows = [];
    let currentRow = [];
    let currentRowW = 0;
    const ITEM_GAP = 10;

    for (const s of chartData) {
      mCtx.font = `500 9.5px ${fontFamily}`;
      const labelPart = `${s.label} `;
      const labelW = mCtx.measureText(labelPart).width;
      mCtx.font = `700 9.5px ${fontFamily}`;
      const valPart = `(${s.value}%)`;
      const valW = mCtx.measureText(valPart).width;
      mCtx.font = `400 8.8px ${fontFamily}`;
      const obsPart = s.observation ? ` [${s.observation}]` : "";
      const obsW = obsPart ? mCtx.measureText(obsPart).width : 0;

      const swatchW = 14;
      const swatchGap = 5;
      const totalItemW = swatchW + swatchGap + labelW + valW + obsW;

      const neededW = currentRow.length === 0 ? totalItemW : currentRowW + ITEM_GAP + totalItemW;
      if (currentRow.length > 0 && neededW > PIZZA_INNER_W) {
        legendRows.push({ items: currentRow, width: currentRowW });
        currentRow = [];
        currentRowW = 0;
      }

      currentRow.push({
        color: s.color,
        labelPart,
        labelW,
        valPart,
        valW,
        obsPart,
        obsW,
        totalItemW,
      });
      currentRowW = currentRow.length === 1 ? totalItemW : currentRowW + ITEM_GAP + totalItemW;
    }
    if (currentRow.length > 0) {
      legendRows.push({ items: currentRow, width: currentRowW });
    }

    const headerH = Math.max(32, titleLines.length * 16 + 15);
    const legendH = Math.max(24, legendRows.length * 17);

    return {
      area,
      skills,
      titleLines,
      legendRows,
      headerH,
      legendH,
    };
  });

  // Pair prepared areas into 2-column rows
  const chartRows = [];
  for (let i = 0; i < preparedAreas.length; i += 2) {
    const pair = preparedAreas.slice(i, i + 2);
    const maxHeaderH = Math.max(...pair.map((p) => p.headerH));
    const maxLegendH = Math.max(...pair.map((p) => p.legendH));
    // Card height = top pad (14) + header + divider gap (10+10) + legend + chart gap (10) + pie (128) + bottom pad (14)
    const rowCardH = 14 + maxHeaderH + 18 + maxLegendH + 10 + 128 + 14;
    chartRows.push({
      pair,
      maxHeaderH,
      maxLegendH,
      rowCardH,
    });
  }

  // --- Step 2: Pre-compute Evaluation Table Rows ---
  const COL_AREA_W = 166;
  const COL_SKILL_W = 294;
  const COL_SCORE_W = 92;
  const COL_OBS_W = 152;

  const flatSkills = records.flatMap((area) =>
    (area.skills || []).map((skill, sIdx) => {
      mCtx.font = `700 11px ${fontFamily}`;
      const areaLines = wrapTextLines(mCtx, area.area_name, COL_AREA_W - 24);
      mCtx.font = `500 11px ${fontFamily}`;
      const skillLines = wrapTextLines(mCtx, skill.skill_name, COL_SKILL_W - 24);
      const maxLines = Math.max(1, skillLines.length, sIdx === 0 ? areaLines.length : 1);
      const rowH = Math.max(38, maxLines * 16 + 18);

      return {
        areaName: area.area_name,
        areaLines,
        isFirstInArea: sIdx === 0,
        skillLines,
        scoreText: formatScore(skill.score),
        observation: String(skill.observation || "").trim() || "Observed",
        rowH,
      };
    })
  );

  // Measure remarks card height
  let remarksLines = [];
  let remarksCardH = 0;
  if (teacherRemarks) {
    mCtx.font = `400 11.5px ${fontFamily}`;
    remarksLines = wrapTextLines(mCtx, teacherRemarks, CONTENT_W - 36);
    remarksCardH = 16 + 18 + 6 + remarksLines.length * 18 + 15;
  }

  // --- Step 3: Allocate Pages Cleanly ---
  const pagesPlan = [];
  const HEADER_FULL_H = 102;
  const HEADER_COMPACT_H = 72;
  const SECTION_PAD_TOP = 22;
  const SECTION_PAD_BOT = 22;
  const SECTION_HEADER_H = 44;

  // Allocate Chart Rows across initial page(s)
  if (chartRows.length > 0) {
    let idx = 0;
    while (idx < chartRows.length) {
      const isFirst = pagesPlan.length === 0;
      const hdrH = isFirst ? HEADER_FULL_H : HEADER_COMPACT_H;
      let usedH = MARGIN_TOP + hdrH + SECTION_PAD_TOP + SECTION_HEADER_H;

      const takenChartRows = [];
      while (idx < chartRows.length) {
        const nextRow = chartRows[idx];
        const gap = takenChartRows.length > 0 ? GRID_GAP : 0;
        if (usedH + gap + nextRow.rowCardH + SECTION_PAD_BOT <= MAX_CARD_BOTTOM || takenChartRows.length === 0) {
          takenChartRows.push(nextRow);
          usedH += gap + nextRow.rowCardH;
          idx++;
        } else {
          break;
        }
      }

      pagesPlan.push({
        type: "charts",
        isCompactHeader: !isFirst,
        isContinuation: idx > takenChartRows.length,
        chartRows: takenChartRows,
        usedH: usedH + SECTION_PAD_BOT,
        tableRows: [],
        includeRemarks: false,
      });
    }
  } else {
    pagesPlan.push({
      type: "empty",
      isCompactHeader: false,
      chartRows: [],
      usedH: MARGIN_TOP + HEADER_FULL_H,
      tableRows: [],
      includeRemarks: false,
    });
  }

  // Check if Detailed Evaluation table can fit on the last chart page OR starts on next page
  const TABLE_THEAD_H = 38;
  const TABLE_BORDER_H = 3;

  let skillIdx = 0;
  let lastPage = pagesPlan[pagesPlan.length - 1];

  // Try to fit entire evaluation section on the same page if assessment is small
  const totalTableH = flatSkills.reduce((s, r) => s + r.rowH, 0) + TABLE_THEAD_H + TABLE_BORDER_H;
  const evalFullNeededH = SECTION_PAD_TOP + SECTION_HEADER_H + totalTableH + (remarksCardH ? 16 + remarksCardH : 0) + SECTION_PAD_BOT;

  if (lastPage.usedH + evalFullNeededH <= MAX_CARD_BOTTOM) {
    lastPage.tableRows = flatSkills;
    lastPage.includeRemarks = Boolean(teacherRemarks);
    lastPage.isTableContinuation = false;
  } else {
    // Place Evaluation Table cleanly on subsequent page(s)
    while (skillIdx < flatSkills.length || (skillIdx === 0 && flatSkills.length === 0)) {
      const hdrH = HEADER_COMPACT_H;
      let usedH = MARGIN_TOP + hdrH + SECTION_PAD_TOP + SECTION_HEADER_H + TABLE_THEAD_H + TABLE_BORDER_H;
      const takenRows = [];

      while (skillIdx < flatSkills.length) {
        const nextSkill = flatSkills[skillIdx];
        if (usedH + nextSkill.rowH + SECTION_PAD_BOT <= MAX_CARD_BOTTOM || takenRows.length === 0) {
          takenRows.push(nextSkill);
          usedH += nextSkill.rowH;
          skillIdx++;
        } else {
          break;
        }
      }

      const isAllSkillsDone = skillIdx >= flatSkills.length;
      let includeRemarksHere = false;
      if (isAllSkillsDone && teacherRemarks) {
        if (usedH + 16 + remarksCardH + SECTION_PAD_BOT <= MAX_CARD_BOTTOM) {
          includeRemarksHere = true;
          usedH += 16 + remarksCardH;
        }
      }

      pagesPlan.push({
        type: "table",
        isCompactHeader: true,
        isTableContinuation: pagesPlan.some((p) => p.tableRows.length > 0),
        chartRows: [],
        tableRows: takenRows,
        includeRemarks: includeRemarksHere,
      });

      // If all skills done but remarks didn't fit on this page, add remarks page
      if (isAllSkillsDone && teacherRemarks && !includeRemarksHere) {
        pagesPlan.push({
          type: "remarks",
          isCompactHeader: true,
          chartRows: [],
          tableRows: [],
          includeRemarks: true,
        });
      }

      if (flatSkills.length === 0) break;
    }
  }

  // --- Step 4: Render Each Page onto a High-DPI Canvas ---
  const totalPages = pagesPlan.length;
  const canvases = [];

  for (let pIdx = 0; pIdx < pagesPlan.length; pIdx++) {
    const plan = pagesPlan[pIdx];
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(PAGE_W * scale);
    canvas.height = Math.round(PAGE_H * scale);
    const ctx = canvas.getContext("2d");
    ctx.__fontFamily = fontFamily;
    ctx.scale(scale, scale);

    // 1. Page Background
    ctx.fillStyle = "#FAF7F0";
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // Compute exact Card Height for this page
    const hdrH = plan.isCompactHeader ? HEADER_COMPACT_H : HEADER_FULL_H;
    let cardContentH = hdrH;

    if (plan.chartRows.length > 0) {
      const gridTotalH =
        plan.chartRows.reduce((sum, r) => sum + r.rowCardH, 0) +
        Math.max(0, plan.chartRows.length - 1) * GRID_GAP;
      cardContentH += SECTION_PAD_TOP + SECTION_HEADER_H + gridTotalH + SECTION_PAD_BOT;
    }

    if (plan.tableRows.length > 0) {
      const tblH = plan.tableRows.reduce((s, r) => s + r.rowH, 0) + TABLE_THEAD_H + TABLE_BORDER_H;
      cardContentH += SECTION_PAD_TOP + SECTION_HEADER_H + tblH + (plan.includeRemarks && remarksCardH ? 16 + remarksCardH : 0) + SECTION_PAD_BOT;
    } else if (plan.includeRemarks && remarksCardH) {
      cardContentH += SECTION_PAD_TOP + remarksCardH + SECTION_PAD_BOT;
    }

    const cardX = MARGIN_X;
    const cardY = MARGIN_TOP;

    // 2. Outer Card Shadow & Fill
    ctx.save();
    ctx.shadowColor = "rgba(13, 59, 46, 0.08)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    roundRectPath(ctx, cardX, cardY, CARD_W, cardContentH, 24);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();

    // Clip card contents cleanly to rounded 24px corners
    ctx.save();
    roundRectPath(ctx, cardX, cardY, CARD_W, cardContentH, 24);
    ctx.clip();

    let cursorY = cardY;

    // --- Draw Profile Header (Ash-Shajrah Forest Green Gradient Theme) ---
    const hdrGrad = ctx.createLinearGradient(cardX, cursorY, cardX + CARD_W, cursorY + hdrH);
    hdrGrad.addColorStop(0, "#0D3B2E");
    hdrGrad.addColorStop(1, "#0D5C48");
    ctx.fillStyle = hdrGrad;
    ctx.fillRect(cardX, cursorY, CARD_W, hdrH);

    const hdrCenterY = cursorY + hdrH / 2;
    const contentLeftX = cardX + INNER_PAD_X;
    const contentRightX = cardX + CARD_W - INNER_PAD_X;

    // Graduation Cap Glass Box
    const gradBoxSize = plan.isCompactHeader ? 42 : 52;
    const gradBoxY = hdrCenterY - gradBoxSize / 2;
    roundRectPath(ctx, contentLeftX, gradBoxY, gradBoxSize, gradBoxSize, 14);
    ctx.fillStyle = "rgba(255, 245, 214, 0.12)";
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(228, 199, 102, 0.35)";
    ctx.stroke();
    drawGraduationCapIcon(
      ctx,
      contentLeftX + gradBoxSize / 2,
      hdrCenterY,
      plan.isCompactHeader ? 22 : 25,
      "#E4C766"
    );

    // Student Name, Gold Eyebrow & Meta Row
    const textX = contentLeftX + gradBoxSize + 16;
    const nameFontSize = plan.isCompactHeader ? 17 : 22;

    if (!plan.isCompactHeader) {
      ctx.font = `800 9px ${fontFamily}`;
      ctx.fillStyle = "#E4C766";
      drawOpticalText(ctx, "TERM ASSESSMENT REPORT", textX, hdrCenterY - 22, "left", 1.8);

      ctx.font = `800 ${nameFontSize}px ${fontFamily}`;
      ctx.fillStyle = "#FAF7F0";
      drawOpticalText(ctx, studentName, textX, hdrCenterY - 1, "left");
    } else {
      ctx.font = `800 ${nameFontSize}px ${fontFamily}`;
      ctx.fillStyle = "#FAF7F0";
      drawOpticalText(ctx, studentName, textX, hdrCenterY - 9, "left");
    }

    const metaY = plan.isCompactHeader ? hdrCenterY + 11 : hdrCenterY + 21;
    let metaX = textX;
    const metaParts = [];
    if (className) metaParts.push(["Class: ", className]);
    if (rollNo) metaParts.push(["Roll No: ", rollNo]);
    if (!plan.isCompactHeader && fatherName) metaParts.push(["Father: ", fatherName]);

    for (const [label, val] of metaParts) {
      ctx.font = `400 11.5px ${fontFamily}`;
      ctx.fillStyle = "#CBE7DA";
      drawOpticalText(ctx, label, metaX, metaY, "left");
      metaX += ctx.measureText(label).width;

      ctx.font = `700 11.5px ${fontFamily}`;
      ctx.fillStyle = "#FFFFFF";
      drawOpticalText(ctx, val, metaX, metaY, "left");
      metaX += ctx.measureText(val).width + 14;
    }

    // Assessment Term Glass Badge Card (Right)
    const termTitle = "ASSESSMENT TERM";
    const termVal = `${term} (${academicYear})`;
    ctx.font = `700 9px ${fontFamily}`;
    const termTitleW = ctx.measureText(termTitle).width + 18;
    ctx.font = `700 12.5px ${fontFamily}`;
    const termValW = ctx.measureText(termVal).width;
    const termBoxW = Math.max(termTitleW, termValW) + 32;
    const termBoxH = plan.isCompactHeader ? 46 : 52;
    const termBoxX = contentRightX - termBoxW;
    const termBoxY = hdrCenterY - termBoxH / 2;

    roundRectPath(ctx, termBoxX, termBoxY, termBoxW, termBoxH, 14);
    ctx.fillStyle = "rgba(250, 247, 240, 0.12)";
    ctx.fill();
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(228, 199, 102, 0.35)";
    ctx.stroke();

    ctx.font = `700 9px ${fontFamily}`;
    ctx.fillStyle = "#E4C766";
    drawOpticalText(ctx, termTitle, termBoxX + 16, hdrCenterY - 8.5, "left", 1.2);

    ctx.font = `700 12.5px ${fontFamily}`;
    ctx.fillStyle = "#FAF7F0";
    drawOpticalText(ctx, termVal, termBoxX + 16, hdrCenterY + 9, "left");

    cursorY += hdrH;

    // Header Bottom Gold Divider
    ctx.beginPath();
    ctx.moveTo(cardX, cursorY);
    ctx.lineTo(cardX + CARD_W, cursorY);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(228, 199, 102, 0.4)";
    ctx.stroke();

    // --- Draw Charts Section ---
    if (plan.chartRows.length > 0) {
      cursorY += SECTION_PAD_TOP;

      const hdrBarCenterY = cursorY + 16;
      ctx.font = `800 9.5px ${fontFamily}`;
      ctx.fillStyle = "#C9A227";
      drawOpticalText(ctx, "PERFORMANCE VISUALIZATION", contentLeftX, hdrBarCenterY - 9, "left", 1.6);

      ctx.font = `800 16px ${fontFamily}`;
      ctx.fillStyle = "#063F32";
      const vizTitle = `Learning Areas Performance Breakdown${plan.isContinuation ? " (Continued)" : ""}`;
      drawOpticalText(ctx, vizTitle, contentLeftX, hdrBarCenterY + 9, "left");

      drawPill(
        ctx,
        `${records.length} ${records.length === 1 ? "Subject" : "Subjects"}`,
        contentRightX,
        hdrBarCenterY,
        {
          align: "right",
          font: `700 11px ${fontFamily}`,
          textColor: "#0D5C48",
          bgColor: "#FFFFFF",
          borderColor: "rgba(45, 138, 106, 0.22)",
          height: 28,
          padX: 14,
        }
      );

      cursorY += SECTION_HEADER_H;

      for (let rIdx = 0; rIdx < plan.chartRows.length; rIdx++) {
        const row = plan.chartRows[rIdx];
        if (rIdx > 0) cursorY += GRID_GAP;

        for (let cIdx = 0; cIdx < row.pair.length; cIdx++) {
          const card = row.pair[cIdx];
          const pX = contentLeftX + cIdx * (PIZZA_CARD_W + GRID_GAP);
          const pY = cursorY;

          // Pizza Card Outline
          roundRectPath(ctx, pX, pY, PIZZA_CARD_W, row.rowCardH, 16);
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.lineWidth = 1.1;
          ctx.strokeStyle = "rgba(45, 138, 106, 0.16)";
          ctx.stroke();

          const pLeft = pX + 14;
          const pRight = pX + PIZZA_CARD_W - 14;

          // Area Title & Outcomes Subtitle
          const titleLineH = 15;
          const titleTotalH = card.titleLines.length * titleLineH + 14;
          let tY = pY + 14 + (row.maxHeaderH - 8 - titleTotalH) / 2 + 5;
          ctx.font = `800 12.5px ${fontFamily}`;
          ctx.fillStyle = "#063F32";
          for (const line of card.titleLines) {
            drawOpticalText(ctx, line, pLeft, tY, "left");
            tY += titleLineH;
          }
          ctx.font = `400 10px ${fontFamily}`;
          ctx.fillStyle = "#527A6E";
          drawOpticalText(
            ctx,
            `${card.skills.length} ${card.skills.length === 1 ? "Outcome" : "Outcomes"}`,
            pLeft,
            tY + 1,
            "left"
          );

          // Header Divider Line
          const divY = pY + 14 + row.maxHeaderH + 2;
          ctx.beginPath();
          ctx.moveTo(pLeft, divY);
          ctx.lineTo(pRight, divY);
          ctx.lineWidth = 1;
          ctx.strokeStyle = "#F1EADC";
          ctx.stroke();

          // Legend Rows (Top-aligned consistently across cards!)
          let legY = divY + 16;
          const ITEM_GAP = 10;
          for (const legRow of card.legendRows) {
            let lx = pX + (PIZZA_CARD_W - legRow.width) / 2;
            for (const itemPart of legRow.items) {
              // Colored Swatch vertically dead-centered at legY!
              roundRectPath(ctx, lx, legY - 3.5, 14, 7, 2);
              ctx.fillStyle = itemPart.color;
              ctx.fill();
              lx += 14 + 5;

              // Label + Value + Observation on single optical baseline!
              ctx.font = `500 9.5px ${fontFamily}`;
              ctx.fillStyle = "#245C4F";
              drawOpticalText(ctx, itemPart.labelPart, lx, legY, "left");
              lx += itemPart.labelW;

              ctx.font = `700 9.5px ${fontFamily}`;
              ctx.fillStyle = "#063F32";
              drawOpticalText(ctx, itemPart.valPart, lx, legY, "left");
              lx += itemPart.valW;

              if (itemPart.obsPart) {
                ctx.font = `400 8.8px ${fontFamily}`;
                ctx.fillStyle = "#718096";
                drawOpticalText(ctx, itemPart.obsPart, lx, legY, "left");
                lx += itemPart.obsW;
              }
              lx += ITEM_GAP;
            }
            legY += 17;
          }

          // Solid 2D Pizza Pie Chart anchored cleanly to bottom of card!
          const pieCenterY = pY + row.rowCardH - 14 - 64;
          drawPizzaChartOnCanvas(ctx, card.skills, pX + PIZZA_CARD_W / 2, pieCenterY, 128);
        }

        cursorY += row.rowCardH;
      }

      cursorY += SECTION_PAD_BOT;
    }

    // --- Draw Detailed Evaluation Table Section ---
    if (plan.tableRows.length > 0) {
      if (plan.chartRows.length > 0) {
        ctx.beginPath();
        ctx.moveTo(cardX, cursorY);
        ctx.lineTo(cardX + CARD_W, cursorY);
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = "rgba(45, 138, 106, 0.14)";
        ctx.stroke();
      }

      cursorY += SECTION_PAD_TOP;

      const evalBarCenterY = cursorY + 16;
      ctx.font = `800 9.5px ${fontFamily}`;
      ctx.fillStyle = "#C9A227";
      drawOpticalText(ctx, "DETAILED EVALUATION", contentLeftX, evalBarCenterY - 9, "left", 1.6);

      ctx.font = `800 16px ${fontFamily}`;
      ctx.fillStyle = "#063F32";
      const evalTitle = `Outcomes & Teacher Observations${plan.isTableContinuation ? " (Continued)" : ""}`;
      drawOpticalText(ctx, evalTitle, contentLeftX, evalBarCenterY + 9, "left");

      drawPill(
        ctx,
        `${totalSkillsCount} ${totalSkillsCount === 1 ? "Outcome" : "Outcomes"}`,
        contentRightX,
        evalBarCenterY,
        {
          align: "right",
          font: `700 11px ${fontFamily}`,
          textColor: "#0D5C48",
          bgColor: "#FFFFFF",
          borderColor: "rgba(45, 138, 106, 0.22)",
          height: 28,
          padX: 14,
        }
      );

      cursorY += SECTION_HEADER_H;

      const tblX = contentLeftX;
      const tblY = cursorY;
      const tblH = plan.tableRows.reduce((s, r) => s + r.rowH, 0) + TABLE_THEAD_H;

      // Clip Table inside Rounded Box
      ctx.save();
      roundRectPath(ctx, tblX, tblY, CONTENT_W, tblH, 16);
      ctx.clip();

      // Table Header Gradient Fill
      const grad = ctx.createLinearGradient(0, tblY, 0, tblY + TABLE_THEAD_H);
      grad.addColorStop(0, "#FAF7F0");
      grad.addColorStop(1, "#F1EADC");
      ctx.fillStyle = grad;
      ctx.fillRect(tblX, tblY, CONTENT_W, TABLE_THEAD_H);

      const thCenterY = tblY + TABLE_THEAD_H / 2;
      ctx.font = `800 9.5px ${fontFamily}`;
      ctx.fillStyle = "#0D5C48";
      drawOpticalText(ctx, "LEARNING AREA", tblX + 14, thCenterY, "left", 1.0);
      drawOpticalText(ctx, "SKILL / LEARNING OUTCOME", tblX + COL_AREA_W + 14, thCenterY, "left", 1.0);
      drawOpticalText(
        ctx,
        "SCORE (%)",
        tblX + COL_AREA_W + COL_SKILL_W + COL_SCORE_W / 2,
        thCenterY,
        "center",
        1.0
      );
      drawOpticalText(
        ctx,
        "TEACHER OBSERVATION",
        tblX + COL_AREA_W + COL_SKILL_W + COL_SCORE_W + COL_OBS_W / 2,
        thCenterY,
        "center",
        1.0
      );

      // Header bottom divider
      let rY = tblY + TABLE_THEAD_H;
      ctx.beginPath();
      ctx.moveTo(tblX, rY);
      ctx.lineTo(tblX + CONTENT_W, rY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(45, 138, 106, 0.14)";
      ctx.stroke();

      // Table Rows
      for (let rIdx = 0; rIdx < plan.tableRows.length; rIdx++) {
        const row = plan.tableRows[rIdx];
        const rowCenterY = rY + row.rowH / 2;

        // Area Name (shown on first skill in area OR first row on continuation page)
        if (row.isFirstInArea || rIdx === 0) {
          ctx.font = `700 11px ${fontFamily}`;
          ctx.fillStyle = "#063F32";
          const lineCount = row.areaLines.length;
          let ay = rowCenterY - ((lineCount - 1) * 16) / 2;
          for (let li = 0; li < lineCount; li++) {
            const text =
              li === lineCount - 1 && rIdx === 0 && !row.isFirstInArea
                ? `${row.areaLines[li]} (cont.)`
                : row.areaLines[li];
            drawOpticalText(ctx, text, tblX + 14, ay, "left");
            ay += 16;
          }
        }

        // Skill Name
        ctx.font = `500 11px ${fontFamily}`;
        ctx.fillStyle = "#245C4F";
        let sy = rowCenterY - ((row.skillLines.length - 1) * 16) / 2;
        for (const sLine of row.skillLines) {
          drawOpticalText(ctx, sLine, tblX + COL_AREA_W + 14, sy, "left");
          sy += 16;
        }

        // Score (%)
        ctx.font = `700 11px ${fontFamily}`;
        ctx.fillStyle = "#0D5C48";
        drawOpticalText(
          ctx,
          row.scoreText,
          tblX + COL_AREA_W + COL_SKILL_W + COL_SCORE_W / 2,
          rowCenterY,
          "center"
        );

        // Observation Pill Badge (Dead-centered inside row and pill!)
        const obsLower = row.observation.toLowerCase();
        const isAch = obsLower.includes("achieve");
        const isDev = obsLower.includes("develop");

        drawPill(
          ctx,
          row.observation,
          tblX + COL_AREA_W + COL_SKILL_W + COL_SCORE_W + COL_OBS_W / 2,
          rowCenterY,
          {
            align: "center",
            font: `700 10px ${fontFamily}`,
            textColor: isAch ? "#0D5C48" : isDev ? "#7A5E2B" : "#063F32",
            bgColor: isAch ? "#EAF6EF" : isDev ? "#F1EADC" : "#FAF7F0",
            borderColor: isAch
              ? "rgba(13, 92, 72, 0.2)"
              : isDev
                ? "rgba(122, 94, 43, 0.24)"
                : "rgba(45, 138, 106, 0.16)",
            height: 24,
            padX: 11,
          }
        );

        rY += row.rowH;
        if (rIdx < plan.tableRows.length - 1) {
          ctx.beginPath();
          ctx.moveTo(tblX, rY);
          ctx.lineTo(tblX + CONTENT_W, rY);
          ctx.lineWidth = 1;
          ctx.strokeStyle = "#F1EADC";
          ctx.stroke();
        }
      }

      ctx.restore(); // End table clip

      // Table Outer Border
      roundRectPath(ctx, tblX, tblY, CONTENT_W, tblH, 16);
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "rgba(45, 138, 106, 0.18)";
      ctx.stroke();

      cursorY += tblH;

      if (plan.includeRemarks && remarksCardH > 0) {
        cursorY += 16;
      } else {
        cursorY += SECTION_PAD_BOT;
      }
    } else if (plan.includeRemarks && remarksCardH > 0) {
      cursorY += SECTION_PAD_TOP;
    }

    // --- Draw Teacher Remarks Card ---
    if (plan.includeRemarks && remarksCardH > 0) {
      roundRectPath(ctx, contentLeftX, cursorY, CONTENT_W, remarksCardH, 16);
      ctx.fillStyle = "#FFFAEC";
      ctx.fill();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "rgba(228, 199, 102, 0.55)";
      ctx.stroke();

      const remHdrCenterY = cursorY + 16 + 7;
      drawAwardIcon(ctx, contentLeftX + 18 + 7, remHdrCenterY, 14, "#0D5C48");

      ctx.font = `800 10px ${fontFamily}`;
      ctx.fillStyle = "#0D5C48";
      drawOpticalText(
        ctx,
        "TEACHER OBSERVATIONS & REMARKS",
        contentLeftX + 18 + 20,
        remHdrCenterY,
        "left",
        1.2
      );

      let remBodyY = remHdrCenterY + 18;
      ctx.font = `400 11.5px ${fontFamily}`;
      ctx.fillStyle = "#245C4F";
      for (const rLine of remarksLines) {
        drawOpticalText(ctx, rLine, contentLeftX + 18, remBodyY, "left");
        remBodyY += 18;
      }
    }

    ctx.restore(); // End card clip

    // Card Outer Border
    roundRectPath(ctx, cardX, cardY, CARD_W, cardContentH, 24);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = "rgba(45, 138, 106, 0.18)";
    ctx.stroke();

    // 3. Draw Page Footer neatly positioned at bottom of A4 page
    ctx.font = `600 9.5px ${fontFamily}`;
    ctx.fillStyle = "#0D5C48";
    drawOpticalText(
      ctx,
      `Ash-Shajrah Learning Hub • ${term} • Page ${pIdx + 1} of ${totalPages}`,
      PAGE_W / 2,
      FOOTER_Y,
      "center"
    );

    canvases.push(canvas);
  }

  return canvases;
}

export async function downloadTermAssessmentPdf(item) {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Fallback gracefully
    }
  }

  const canvases = renderTermAssessmentCanvases(item, 2.5);

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pdfPageWidth = pdf.internal.pageSize.getWidth();
  const pdfPageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i];
    if (i > 0) {
      pdf.addPage();
    }

    pdf.setFillColor(250, 247, 240);
    pdf.rect(0, 0, pdfPageWidth, pdfPageHeight, "F");

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    pdf.addImage(imgData, "JPEG", 0, 0, pdfPageWidth, pdfPageHeight, undefined, "FAST");
  }

  const studentName = item.student_name || "Student";
  const term = getAssessmentDisplayTerm(item);
  const cleanName = String(studentName).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanTerm = String(term).trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Term_Assessment_${cleanName}_${cleanTerm}.pdf`;

  pdf.save(fileName);
}
