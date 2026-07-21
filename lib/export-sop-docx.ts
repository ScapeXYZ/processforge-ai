import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import type { Sop } from "@/lib/sop-schema";
import { downloadBlob, exportFilename } from "@/lib/export-sop-json";

const blue = "2E74B5";
const navy = "1F4D78";
const muted = "667085";
const paleBlue = "E8EEF5";
const paleGreen = "E7F6EF";
const border = { style: BorderStyle.SINGLE, size: 1, color: "D7DEE8" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

export async function exportSopDocx(sop: Sop): Promise<void> {
  const document = new Document({
    creator: "ProcessForge AI",
    title: sop.title,
    description: `Standard operating procedure ${sop.documentId}`,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22, color: "243142" }, paragraph: { spacing: { after: 120, line: 300 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { font: "Calibri", size: 56, bold: true, color: navy }, paragraph: { spacing: { before: 0, after: 200 }, keepNext: true } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Calibri", size: 32, bold: true, color: blue }, paragraph: { spacing: { before: 360, after: 200 }, keepNext: true, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: "Calibri", size: 26, bold: true, color: blue }, paragraph: { spacing: { before: 280, after: 140 }, keepNext: true, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: "sop-bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 80, line: 300 } } } }] },
        { reference: "sop-numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 }, spacing: { after: 80, line: 300 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 } } },
      headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D7DEE8" } }, spacing: { after: 80 }, children: [new TextRun({ text: "PROCESSFORGE AI", bold: true, size: 18, color: blue }), new TextRun({ text: `   |   ${sop.documentId}`, size: 18, color: muted })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Page ", size: 18, color: muted }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: muted })] })] }) },
      children: buildDocument(sop),
    }],
  });

  const blob = await Packer.toBlob(document);
  downloadBlob(blob, exportFilename(sop.documentId, "docx"));
}

function buildDocument(sop: Sop): Array<Paragraph | Table> {
  return [
    new Paragraph({ spacing: { before: 360, after: 80 }, children: [new TextRun({ text: "STANDARD OPERATING PROCEDURE", bold: true, size: 20, color: blue, characterSpacing: 30 })] }),
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(sop.title)] }),
    metadataTable(sop),
    heading("1. Purpose"),
    body(sop.purpose),
    heading("2. Scope"),
    body(sop.scope),
    heading("3. Roles and responsibilities"),
    rolesTable(sop),
    heading("4. Prerequisites"),
    ...bullets(sop.prerequisites),
    heading("5. Procedure"),
    ...sop.procedureSteps.flatMap((step) => [
      new Paragraph({ heading: HeadingLevel.HEADING_2, numbering: { reference: "sop-numbers", level: 0 }, children: [new TextRun(step.title)] }),
      body(step.instruction),
      new Paragraph({ shading: { type: ShadingType.CLEAR, fill: "F6F8FA" }, indent: { left: 240, right: 240 }, spacing: { before: 40, after: 160 }, children: [new TextRun({ text: "Owner: ", bold: true, color: navy }), new TextRun(step.owner), new TextRun({ text: "   Evidence: ", bold: true, color: navy }), new TextRun(step.evidence)] }),
    ]),
    heading("6. Escalation rules"),
    ...bullets(sop.escalationRules),
    heading("7. Quality-control checklist"),
    ...sop.qualityChecklist.map((item) => new Paragraph({ numbering: { reference: "sop-bullets", level: 0 }, children: [new TextRun({ text: "Check: ", bold: true, color: blue }), new TextRun(item)] })),
    heading("8. Training quiz"),
    ...sop.trainingQuiz.flatMap((quiz, index) => [
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`${index + 1}. ${quiz.question}`)] }),
      ...quiz.options.map((option) => new Paragraph({ numbering: { reference: "sop-bullets", level: 0 }, children: [new TextRun(option)] })),
      new Paragraph({ spacing: { before: 40, after: 160 }, children: [new TextRun({ text: "Correct answer: ", bold: true, color: blue }), new TextRun(quiz.correctAnswer)] }),
    ]),
    heading("9. Source Notes"),
    new Paragraph({ children: [new TextRun({ text: "Knowledge sources: ", bold: true, color: blue }), new TextRun(sop.knowledgeSources.documentNames.length > 0 ? sop.knowledgeSources.documentNames.join(", ") : "None selected")] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Important assumptions")] }),
    ...bullets(sop.knowledgeSources.sourceNotes.importantAssumptions.length > 0 ? sop.knowledgeSources.sourceNotes.importantAssumptions : ["No material assumptions recorded"]),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Missing information")] }),
    ...bullets(sop.knowledgeSources.sourceNotes.missingInformation.length > 0 ? sop.knowledgeSources.sourceNotes.missingInformation : ["No missing information recorded"]),
    new Paragraph({ children: [new TextRun({ text: "General best practices added: ", bold: true, color: blue }), new TextRun(sop.knowledgeSources.sourceNotes.generalBestPracticesAdded ? "Yes" : "No")] }),
  ];
}

function heading(text: string): Paragraph {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(text)] });
}

function body(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun(text)] });
}

function bullets(items: string[]): Paragraph[] {
  return items.map((item) => new Paragraph({ numbering: { reference: "sop-bullets", level: 0 }, children: [new TextRun(item)] }));
}

function metadataTable(sop: Sop): Table {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    columnWidths: [1872, 1872, 1872, 1872, 1872],
    rows: [new TableRow({ children: [metadataCell("Document ID", sop.documentId, 1872), metadataCell("Version", sop.version, 1872), metadataCell("Input quality", `${sop.inputReadinessScore}%`, 1872), metadataCell("SOP readiness", `${sop.documentReadinessScore}%`, 1872), metadataCell("Estimated time", sop.estimatedCompletionTime, 1872)] })],
  });
}

function metadataCell(label: string, value: string, width: number): TableCell {
  return new TableCell({ width: { size: width, type: WidthType.DXA }, borders: cellBorders, shading: { type: ShadingType.CLEAR, fill: paleGreen }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: label.toUpperCase(), bold: true, size: 15, color: muted })] }), new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: value, bold: true, size: 18, color: navy })] })] });
}

function rolesTable(sop: Sop): Table {
  const headerCell = (text: string, width: number) => new TableCell({ width: { size: width, type: WidthType.DXA }, borders: cellBorders, shading: { type: ShadingType.CLEAR, fill: paleBlue }, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: navy })] })] });
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2700, 6660],
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    rows: [
      new TableRow({ tableHeader: true, children: [headerCell("Role", 2700), headerCell("Responsibility", 6660)] }),
      ...sop.roles.map((item) => new TableRow({ children: [new TableCell({ width: { size: 2700, type: WidthType.DXA }, borders: cellBorders, verticalAlign: VerticalAlign.CENTER, children: [new Paragraph({ children: [new TextRun({ text: item.role, bold: true })] })] }), new TableCell({ width: { size: 6660, type: WidthType.DXA }, borders: cellBorders, verticalAlign: VerticalAlign.CENTER, children: [body(item.responsibility)] })] })),
    ],
  });
}
