import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

export const exportToDocx = (content: string) => {
  // Create a new document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: content,
                size: 24, // 12pt
              }),
            ],
          }),
        ],
      },
    ],
  });

  // Generate and save the document
  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, "transcript.docx");
  });
};
