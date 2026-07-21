import { jsPDF } from "jspdf";
import type { Sop } from "@/lib/sop-schema";
import { exportFilename } from "@/lib/export-sop-json";

const margin = 18;
const pageWidth = 215.9;
const pageHeight = 279.4;
const contentWidth = pageWidth - margin * 2;
const footerTop = pageHeight - 14;

export function exportSopPdf(sop: Sop): void {
  const pdf = new jsPDF({ unit: "mm", format: "letter", orientation: "portrait" });
  let y = 22;

  const addPage = () => { pdf.addPage(); y = 22; };
  const ensureSpace = (height: number) => { if (y + height > footerTop) addPage(); };
  const linesFor = (text: string, width = contentWidth): string[] => pdf.splitTextToSize(text, width) as string[];
  const addText = (text: string, options: { size?: number; color?: [number, number, number]; bold?: boolean; indent?: number; after?: number } = {}) => {
    const size = options.size ?? 10;
    const indent = options.indent ?? 0;
    const lines = linesFor(text, contentWidth - indent);
    const lineHeight = size * 0.42;
    ensureSpace(lines.length * lineHeight + (options.after ?? 2));
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(options.color ?? [41, 49, 61]));
    pdf.text(lines, margin + indent, y);
    y += lines.length * lineHeight + (options.after ?? 2);
  };
  const addHeading = (text: string) => { ensureSpace(14); y += 3; addText(text, { size: 14, color: [46, 116, 181], bold: true, after: 4 }); };
  const addBullet = (text: string, marker = "•") => { const lines = linesFor(text, contentWidth - 8); const height = lines.length * 4.2 + 2; ensureSpace(height); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(41, 49, 61); pdf.text(marker, margin + 1, y); pdf.text(lines, margin + 7, y); y += height; };

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(46, 116, 181);
  pdf.text("PROCESSFORGE AI  /  STANDARD OPERATING PROCEDURE", margin, y);
  y += 10;
  addText(sop.title, { size: 23, color: [31, 77, 120], bold: true, after: 7 });

  const meta = [["DOCUMENT ID", sop.documentId], ["VERSION", sop.version], ["READINESS", `${sop.readinessScore}%`], ["ESTIMATED TIME", sop.estimatedCompletionTime]] as const;
  const cellWidth = contentWidth / 4;
  const metaHeight = 18;
  ensureSpace(metaHeight + 5);
  meta.forEach(([label, value], index) => {
    const x = margin + index * cellWidth;
    pdf.setFillColor(231, 246, 239);
    pdf.setDrawColor(215, 222, 232);
    pdf.rect(x, y, cellWidth, metaHeight, "FD");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(6.5); pdf.setTextColor(102, 112, 133); pdf.text(label, x + 2.5, y + 5);
    pdf.setFontSize(8.5); pdf.setTextColor(31, 77, 120); pdf.text(linesFor(value, cellWidth - 5).slice(0, 2), x + 2.5, y + 10);
  });
  y += metaHeight + 3;

  addHeading("1. Purpose"); addText(sop.purpose);
  addHeading("2. Scope"); addText(sop.scope);
  addHeading("3. Roles and responsibilities");
  sop.roles.forEach((role) => { ensureSpace(12); addText(role.role, { bold: true, color: [31, 77, 120], after: 1 }); addText(role.responsibility, { indent: 3, after: 3 }); });
  addHeading("4. Prerequisites"); sop.prerequisites.forEach((item) => addBullet(item));
  addHeading("5. Procedure");
  sop.procedureSteps.forEach((step) => {
    ensureSpace(20);
    addText(`${step.stepNumber}. ${step.title}`, { size: 11, color: [31, 77, 120], bold: true, after: 2 });
    addText(step.instruction, { indent: 4, after: 2 });
    addText(`Owner: ${step.owner}   |   Evidence: ${step.evidence}`, { size: 8.5, color: [80, 91, 108], indent: 4, after: 4 });
  });
  addHeading("6. Escalation rules"); sop.escalationRules.forEach((item) => addBullet(item));
  addHeading("7. Quality-control checklist"); sop.qualityChecklist.forEach((item) => addBullet(item, "[ ]"));
  addHeading("8. Training quiz");
  sop.trainingQuiz.forEach((quiz, index) => {
    ensureSpace(18);
    addText(`${index + 1}. ${quiz.question}`, { bold: true, color: [31, 77, 120], after: 2 });
    quiz.options.forEach((option) => addBullet(option));
    addText(`Correct answer: ${quiz.correctAnswer}`, { size: 9, bold: true, indent: 4, after: 4 });
  });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(215, 222, 232);
    pdf.line(margin, 13, pageWidth - margin, 13);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setTextColor(46, 116, 181); pdf.text("PROCESSFORGE AI", margin, 9);
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(102, 112, 133); pdf.text(sop.documentId, pageWidth - margin, 9, { align: "right" });
    pdf.line(margin, footerTop + 3, pageWidth - margin, footerTop + 3);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  pdf.save(exportFilename(sop.documentId, "pdf"));
}
