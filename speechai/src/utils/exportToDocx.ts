import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import { saveAs } from "file-saver";

export const exportToDocx = (content: string) => {
  // Get current date and time for the document header
  const now = new Date();
  const formattedDate = now.toLocaleDateString();
  const formattedTime = now.toLocaleTimeString();
  
  // Split content by double newlines to create paragraphs
  const paragraphs = content.split(/\n\s*\n/);
  
  // Create document with proper formatting
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              right: 1000,
              bottom: 1000,
              left: 1000,
            },
          },
        },
        children: [
          // Document title
          new Paragraph({
            text: "Case Register Document",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 200,
            },
          }),
          
          // Date and time
          new Paragraph({
            text: `Generated on: ${formattedDate} at ${formattedTime}`,
            alignment: AlignmentType.RIGHT,
            spacing: {
              after: 400,
            },
          }),
          
          // Separator line
          new Paragraph({
            text: "",
            border: {
              bottom: {
                color: "#CCCCCC",
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
            spacing: {
              after: 400,
            },
          }),
          
          // Content paragraphs
          ...paragraphs.map(para => 
            new Paragraph({
              children: [
                new TextRun({
                  text: para.trim(),
                  size: 24, // 12pt
                }),
              ],
              spacing: {
                after: 240, // Space after each paragraph
              },
            })
          ),
        ],
      },
    ],
  });

  // Generate and save the document with timestamp in filename
  Packer.toBlob(doc).then((blob) => {
    const timestamp = now.toISOString().replace(/[:.]/g, "-").substring(0, 19);
    saveAs(blob, `case-register-${timestamp}.docx`);
  });
};
