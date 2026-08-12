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
    const { metadata = {}, lines = [], pdfLayout = 'dual', pdfTitle = '', sourceLanguage = 'English / Hindi', targetLang = 'or', summary = {} } = data;

    const isEnglishTarget = targetLang === 'en';

    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      bufferPages: true
    });

    doc.pipe(stream);

    // Colors
    const primaryColor = isEnglishTarget ? '#1e3a8a' : '#0f766e'; // Blue for English, Teal for Odia
    const secondaryColor = isEnglishTarget ? '#2563eb' : '#0d9488';
    const speakerColor = '#b45309'; // Amber 700
    const darkTextColor = '#1e293b'; // Slate 800
    const mutedTextColor = '#64748b'; // Slate 500
    const borderColor = '#e2e8f0';

    // ----------------------------------------------------
    // PAGE 1: COVER PAGE
    // ----------------------------------------------------
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a'); // Midnight dark cover background

    // Center Banner
    doc.rect(0, doc.page.height / 3.2, doc.page.width, 140).fill(primaryColor);

    const titleText = pdfTitle || metadata.title || 'YouTube Video Dialogue';
    doc.fillColor('#ffffff');
    if (!isEnglishTarget && containsOdia(titleText)) {
      doc.font(fontOdiaBold).fontSize(20)
         .text(sanitizeTextForOdiaPdf(titleText), 50, doc.page.height / 3 + 10, { align: 'center', width: doc.page.width - 100 });
    } else {
      doc.font('Helvetica-Bold').fontSize(20)
         .text(sanitizeAsciiOnly(titleText), 50, doc.page.height / 3 + 10, { align: 'center', width: doc.page.width - 100 });
    }

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#99f6e4')
       .text(isEnglishTarget ? 'SUMMARY & TRANSCRIPT DOCUMENT' : 'ସାରାଂଶ ଏବଂ ସଂଳାପ ଦସ୍ତାବିଜ୍', 50, doc.page.height / 3 + 95, { align: 'center' });

    // Cover Meta Details
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(10);
    const metaY = doc.page.height - 180;
    doc.text(`Channel: ${sanitizeAsciiOnly(metadata.author || 'N/A')}`, 50, metaY, { align: 'center' });
    doc.text(`Original Language: ${sanitizeAsciiOnly(sourceLanguage)}  |  Target Language: ${isEnglishTarget ? 'English' : 'Odia (ଓଡ଼ିଆ)'}`, 50, metaY + 18, { align: 'center' });
    doc.text(`Generated On: ${new Date().toLocaleString('en-IN', { dateStyle: 'full' })}`, 50, metaY + 36, { align: 'center' });

    // ----------------------------------------------------
    // PAGE 2: EXECUTIVE SUMMARY
    // ----------------------------------------------------
    doc.addPage();
    doc.y = 50;

    // Header banner on inner pages
    doc.rect(0, 0, doc.page.width, 10).fill(primaryColor);
    doc.moveDown(1.5);

    // Section title
    doc.font(isEnglishTarget ? 'Helvetica-Bold' : fontOdiaBold).fontSize(18).fillColor(primaryColor)
       .text(isEnglishTarget ? 'Executive Summary' : 'କାର୍ଯ୍ୟନିର୍ବାହୀ ସାରାଂଶ');
    doc.moveDown(0.5);

    // Overview
    doc.font(isEnglishTarget ? 'Helvetica-Bold' : fontOdiaBold).fontSize(12).fillColor(darkTextColor)
       .text(isEnglishTarget ? 'Overview' : 'ସଂକ୍ଷିପ୍ତ ବିବରଣୀ');
    doc.moveDown(0.2);
    
    const overviewStr = summary.overview || (isEnglishTarget ? 'No overview available.' : 'କୌଣସି ବିବରଣୀ ଉପଲବ୍ଧ ନାହିଁ।');
    doc.font(isEnglishTarget ? 'Helvetica' : fontOdiaReg).fontSize(10).fillColor(darkTextColor)
       .text(isEnglishTarget ? sanitizeAsciiOnly(overviewStr) : sanitizeTextForOdiaPdf(overviewStr), { align: 'justify', lineGap: 3 });
    doc.moveDown(1.2);

    // Key Points
    doc.font(isEnglishTarget ? 'Helvetica-Bold' : fontOdiaBold).fontSize(12).fillColor(darkTextColor)
       .text(isEnglishTarget ? 'Key Points' : 'ପ୍ରମୁଖ ବିଷୟବସ୍ତୁ');
    doc.moveDown(0.4);

    const keyPointsList = summary.keyPoints || [];
    if (keyPointsList.length === 0) {
      keyPointsList.push(isEnglishTarget ? 'Detailed timeline transcription is appended in the following pages.' : 'ସଂଳାପର ସମ୍ପୂର୍ଣ୍ଣ ବିବରଣୀ ପରବର୍ତ୍ତୀ ପୃଷ୍ଠାଗୁଡ଼ିକରେ ପ୍ରଦାନ କରାଯାଇଛି।');
    }
    keyPointsList.forEach(pt => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(secondaryColor).text('  •  ', { continued: true });
      doc.font(isEnglishTarget ? 'Helvetica' : fontOdiaReg).fontSize(10).fillColor(darkTextColor)
         .text(isEnglishTarget ? sanitizeAsciiOnly(pt) : sanitizeTextForOdiaPdf(pt), { lineGap: 2 });
      doc.moveDown(0.3);
    });
    doc.moveDown(0.8);

    // Main Takeaways
    doc.font(isEnglishTarget ? 'Helvetica-Bold' : fontOdiaBold).fontSize(12).fillColor(darkTextColor)
       .text(isEnglishTarget ? 'Main Takeaways' : 'ମୁଖ୍ୟ ପ୍ରସଙ୍ଗ ଏବଂ ଶିକ୍ଷା');
    doc.moveDown(0.4);

    const takeawaysList = summary.takeaways || [];
    if (takeawaysList.length === 0) {
      takeawaysList.push(isEnglishTarget ? 'Dialogue flow and details are preserved.' : 'ସଂଳାପ ପ୍ରବାହ ଏବଂ ତଥ୍ୟ ସଂରକ୍ଷିତ ରହିଛି।');
    }
    takeawaysList.forEach(tk => {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(secondaryColor).text('  ✔  ', { continued: true });
      doc.font(isEnglishTarget ? 'Helvetica' : fontOdiaReg).fontSize(10).fillColor(darkTextColor)
         .text(isEnglishTarget ? sanitizeAsciiOnly(tk) : sanitizeTextForOdiaPdf(tk), { lineGap: 2 });
      doc.moveDown(0.3);
    });

    // ----------------------------------------------------
    // FOLLOWING PAGES: CLEANED DIALOGUE CONTENT BY SECTIONS
    // ----------------------------------------------------
    const sections = summary.sections || [{ title: isEnglishTarget ? 'Dialogue Content' : 'ସଂଳାପ ବିବରଣୀ', lines }];

    sections.forEach((sec, secIdx) => {
      doc.addPage();
      doc.y = 50;

      // Section top banner
      doc.rect(0, 0, doc.page.width, 10).fill(secondaryColor);
      doc.moveDown(1.5);

      // Section title
      doc.font(isEnglishTarget ? 'Helvetica-Bold' : fontOdiaBold).fontSize(14).fillColor(primaryColor)
         .text(sanitizeAsciiOnly(sec.title || `Chapter ${secIdx + 1}`));
      doc.moveDown(0.8);

      if (pdfLayout === 'monologue') {
        sec.lines.forEach((line) => {
          if (doc.y > doc.page.height - 65) {
            doc.addPage();
            doc.y = 50;
          }

          doc.font('Helvetica-Bold').fontSize(9).fillColor(speakerColor).text(`[${line.startFormatted}] ${sanitizeAsciiOnly(line.speaker || 'Speaker 1')}: `, { continued: true });
          
          if (isEnglishTarget) {
            const txt = sanitizeAsciiOnly(line.odiaText || line.text || '');
            doc.font('Helvetica').fontSize(11).fillColor(darkTextColor).text(txt, { lineGap: 2 });
          } else {
            const odiaTxt = sanitizeTextForOdiaPdf(line.odiaText || line.text || '');
            doc.font(fontOdiaReg).fontSize(11).fillColor(darkTextColor).text(odiaTxt, { lineGap: 2 });
          }
          doc.moveDown(0.5);
        });
      } else {
        // Table Timeline Layout
        sec.lines.forEach((line, index) => {
          if (doc.y > doc.page.height - 95) {
            doc.addPage();
            doc.y = 50;
          }

          const itemTop = doc.y;
          const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
          const cardHeight = pdfLayout === 'dual' ? 62 : 50;

          doc.rect(40, itemTop, doc.page.width - 80, cardHeight).fill(bg);

          // Timestamp Pill
          doc.roundedRect(48, itemTop + 8, 65, 18, 3).fill('#e0f2fe');
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#0369a1')
             .text(line.startFormatted || '00:00', 48, itemTop + 13, { width: 65, align: 'center' });

          // Speaker Tag
          doc.font('Helvetica-Bold').fontSize(9).fillColor(speakerColor)
             .text(sanitizeAsciiOnly(line.speaker || 'Speaker 1'), 125, itemTop + 8);

          if (pdfLayout === 'odia_only') {
            if (isEnglishTarget) {
              const txt = sanitizeAsciiOnly(line.odiaText || line.text || '');
              doc.font('Helvetica').fontSize(11).fillColor(darkTextColor)
                 .text(txt, 125, itemTop + 22, { width: doc.page.width - 175 });
            } else {
              const odiaTxt = sanitizeTextForOdiaPdf(line.odiaText || line.text || '');
              doc.font(fontOdiaReg).fontSize(11).fillColor(darkTextColor)
                 .text(odiaTxt, 125, itemTop + 22, { width: doc.page.width - 175 });
            }
          } else {
            const colWidth = (doc.page.width - 180) / 2;
            const origText = line.text || '';

            if (containsOdia(origText)) {
              doc.font(fontOdiaReg).fontSize(9).fillColor(mutedTextColor)
                 .text(sanitizeTextForOdiaPdf(origText).substring(0, 150), 125, itemTop + 22, { width: colWidth, height: 35 });
            } else {
              doc.font('Helvetica').fontSize(9).fillColor(mutedTextColor)
                 .text(sanitizeAsciiOnly(origText).substring(0, 150), 125, itemTop + 22, { width: colWidth, height: 35 });
            }

            if (isEnglishTarget) {
              const txt = sanitizeAsciiOnly(line.odiaText || '').substring(0, 150);
              doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor)
                 .text(txt, 130 + colWidth, itemTop + 22, { width: colWidth, height: 35 });
            } else {
              const odiaTxt = sanitizeTextForOdiaPdf(line.odiaText || '').substring(0, 150);
              doc.font(fontOdiaBold).fontSize(10).fillColor(primaryColor)
                 .text(odiaTxt, 130 + colWidth, itemTop + 22, { width: colWidth, height: 35 });
            }
          }

          doc.y = itemTop + cardHeight + 4;
        });
      }
    });

    // Page Numbers Footer on pages 2+
    const range = doc.bufferedPageRange();
    for (let i = range.start + 1; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor(mutedTextColor)
         .text(`YouTube Transcriber  •  ${isEnglishTarget ? 'English Dialogue' : 'Odia Dialogue'}  •  Page ${i + 1} of ${range.count}`, 40, doc.page.height - 25, {
           width: doc.page.width - 80,
           align: 'center'
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
