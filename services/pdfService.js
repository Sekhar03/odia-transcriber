const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

function getFontPath(filename) {
  const rootPath = path.join(process.cwd(), 'fonts', filename);
  if (fs.existsSync(rootPath)) return rootPath;
  const relPath = path.join(__dirname, '../fonts', filename);
  if (fs.existsSync(relPath)) return relPath;
  return rootPath;
}

const fontOdiaReg = getFontPath('NotoSansOriya-Regular.ttf');
const fontOdiaBold = getFontPath('NotoSansOriya-Bold.ttf');

function containsOdia(str) {
  return /[\u0B00-\u0B7F]/.test(str || '');
}

function sanitizeTextForOdiaPdf(text) {
  if (!text) return '';
  let str = String(text);

  str = str.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
           .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
           .replace(/\u2026/g, '...')
           .replace(/[\u2013\u2014]/g, '-')
           .replace(/\u20B9/g, 'Rs.')
           .replace(/[♪♫★✓✔▪►]/g, '')
           .replace(/\|\|\|?/g, ' ');

  const devanagariMap = {
    'मध्य प्रदेश': 'ମଧ୍ୟପ୍ରଦେଶ',
    'उत्तर प्रदेश': 'ଉତ୍ତରପ୍ରଦେଶ',
    'राजस्थान': 'ରାଜସ୍ଥାନ',
    'दिल्ली': 'ଦିଲ୍ଲୀ',
    'हरियाणा': 'ହରିୟାଣା',
    'पंजाब': 'ପଞ୍ଜାବ',
    'गुजरात': 'ଗୁଜରାଟ',
    'महाराष्ट्र': 'ମହାରାଷ୍ଟ୍ର',
    'बिहार': 'ବିହାର',
    'प्रशंसा': '',
    'संगीत': ''
  };

  Object.keys(devanagariMap).forEach(k => {
    str = str.replace(new RegExp(k, 'g'), devanagariMap[k]);
  });

  str = str.replace(/[\u0900-\u097F]/g, '');
  str = str.replace(/[\u2000-\u206F\u20A0-\u20CF\uFEFF]/g, '');
  str = str.replace(/[^\u0B00-\u0B7F\x20-\x7E]/g, '');

  return str.replace(/\s+/g, ' ').trim();
}

function sanitizeAsciiOnly(text) {
  if (!text) return '';
  return String(text).replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, ' ').trim();
}

function createOdiaPDF(data, stream) {
  try {
    const { metadata = {}, lines = [], pdfLayout = 'monologue', pdfTitle = '', sourceLanguage = 'English / Hindi', targetLang = 'or', summary = {} } = data;

    const isEnglishTarget = targetLang === 'en';

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true
    });

    doc.pipe(stream);

    // Colors
    const primaryColor = '#0f172a'; // Black text
    const categoryColor = '#10b981'; // Green category (emerald)
    const darkTextColor = '#1e293b'; // Slate 800
    const mutedTextColor = '#64748b'; // Slate 500
    const borderColor = '#cbd5e1';

    // ----------------------------------------------------
    // PAGE 1: START DIRECTLY WITH TITLE
    // ----------------------------------------------------
    doc.y = 50;

    // Green Category Label
    doc.font('Helvetica-Bold').fontSize(9).fillColor(categoryColor)
       .text('AUDIO TRANSLATION', { characterSpacing: 1 });
    doc.moveDown(0.5);

    // Document Title
    const titleText = pdfTitle || metadata.title || 'YouTube Video Dialogue';
    if (!isEnglishTarget && containsOdia(titleText)) {
      doc.font(fontOdiaBold).fontSize(20).fillColor(primaryColor)
         .text(sanitizeTextForOdiaPdf(titleText), { lineGap: 4 });
    } else {
      doc.font('Helvetica-Bold').fontSize(20).fillColor(primaryColor)
         .text(sanitizeAsciiOnly(titleText).toUpperCase(), { lineGap: 4 });
    }
    doc.moveDown(1.5);

    const sections = summary.sections || [{ title: isEnglishTarget ? 'Dialogue Content' : 'ସଂଳାପ ବିବରଣୀ', lines }];

    // Continuous Monologue Paragraphs Layout (Used for all outputs)
    sections.forEach((sec) => {
      // Merge all lines in this section into a continuous text block
      const mergedText = sec.lines.map(line => {
        return isEnglishTarget
          ? sanitizeAsciiOnly(line.odiaText || line.text || '')
          : sanitizeTextForOdiaPdf(line.odiaText || line.text || '');
      }).join(' ');

      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        doc.y = 50;
      }

      // Render as a clean, wrapped paragraph
      doc.font(isEnglishTarget ? 'Helvetica' : fontOdiaReg).fontSize(10.5).fillColor(darkTextColor)
         .text(mergedText, { align: 'justify', lineGap: 4 });
      doc.moveDown(1.2);
    });

    // Page Numbers & Dividers Footer
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      
      // Draw horizontal line
      doc.moveTo(50, doc.page.height - 45)
         .lineTo(doc.page.width - 50, doc.page.height - 45)
         .lineWidth(0.5)
         .strokeColor(borderColor)
         .stroke();
         
      // Get clean source language label (e.g. "Hindi" or "English")
      let srcLabel = 'Hindi';
      if (sourceLanguage) {
        const firstPart = sourceLanguage.split('/')[0].trim();
        if (firstPart) {
          srcLabel = firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
        }
      }
      const footerLabel = `${srcLabel} Audio Translation`;
      
      doc.font('Helvetica').fontSize(8).fillColor(mutedTextColor)
         .text(footerLabel, 50, doc.page.height - 35, { align: 'left' });
         
      // Right side text: "Page X of Y"
      doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - 150, doc.page.height - 35, {
        width: 100,
        align: 'right'
      });
    }

    doc.end();
  } catch (err) {
    console.error('PDF Document creation error:', err.message);
    if (!stream.headersSent) {
      try {
        stream.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
      } catch (e) {}
    }
  }
}

module.exports = {
  createOdiaPDF,
  sanitizeTextForOdiaPdf
};
