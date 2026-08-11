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
    const { metadata = {}, lines = [], pdfLayout = 'dual', pdfTitle = '', sourceLanguage = 'English / Hindi', targetLang = 'or' } = data;

    const isEnglishTarget = targetLang === 'en';

    const doc = new PDFDocument({
      margin: 40,
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

    // Banner Header
    doc.rect(0, 0, doc.page.width, 95).fill(primaryColor);

    if (isEnglishTarget) {
      doc.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff')
         .text('YouTube Video English Dialogue Transcript', 40, 20, { align: 'left' });
    } else {
      doc.font(fontOdiaBold).fontSize(20).fillColor('#ffffff')
         .text('ୟୁଟ୍ୟୁବ୍ ଭିଡିଓ ସମ୍ପୂର୍ଣ୍ଣ ଓଡ଼ିଆ ସଂଳାପ', 40, 20, { align: 'left' });
    }

    doc.font('Helvetica').fontSize(10).fillColor('#ccfbf1')
       .text(isEnglishTarget ? 'Complete YouTube Dialogue Transcript in English' : 'Complete YouTube Dialogue Transcript in Natural Odia', 40, 48);

    doc.font('Helvetica').fontSize(9).fillColor('#99f6e4')
       .text(`Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}`, 40, 68);

    doc.y = 115;

    // Metadata Card Box
    doc.rect(40, doc.y, doc.page.width - 80, 95).fillAndStroke('#f8fafc', borderColor);

    const metaTop = doc.y + 12;
    const rawTitle = pdfTitle || metadata.title || 'YouTube Video Dialogue';

    if (!isEnglishTarget && containsOdia(rawTitle)) {
      const cleanOdiaTitle = sanitizeTextForOdiaPdf(rawTitle).substring(0, 120);
      doc.font(fontOdiaBold).fontSize(11).fillColor(darkTextColor)
         .text(cleanOdiaTitle, 52, metaTop, { width: doc.page.width - 104, height: 24 });
    } else {
      const cleanAsciiTitle = sanitizeAsciiOnly(rawTitle).substring(0, 120);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(darkTextColor)
         .text(cleanAsciiTitle, 52, metaTop, { width: doc.page.width - 104, height: 24 });
    }

    doc.font('Helvetica').fontSize(10).fillColor(mutedTextColor);
    doc.text(`Channel: ${sanitizeAsciiOnly(metadata.author || 'N/A')}  |  Duration: ${metadata.durationFormatted || 'N/A'}  |  Dialogue: ${lines.length} Lines`, 52, metaTop + 26);
    doc.text(`Original Language: ${sanitizeAsciiOnly(sourceLanguage)}  |  Target: ${isEnglishTarget ? 'English' : 'Odia (ଓଡ଼ିଆ)'}`, 52, metaTop + 44);
    
    doc.font('Helvetica').fontSize(9).fillColor(secondaryColor)
       .text(`Link: ${sanitizeAsciiOnly(metadata.url || 'N/A')}`, 52, metaTop + 64, { width: doc.page.width - 104, underline: true });

    doc.y = 230;

    // Section Heading
    if (isEnglishTarget) {
      doc.font('Helvetica-Bold').fontSize(14).fillColor(primaryColor)
         .text(pdfLayout === 'monologue' ? 'Full English Dialogue Transcript' : 'English Dialogue Timeline', 40, doc.y);
    } else {
      doc.font(fontOdiaBold).fontSize(14).fillColor(primaryColor)
         .text(pdfLayout === 'monologue' ? 'ଓଡ଼ିଆ ସମ୍ପୂର୍ଣ୍ଣ ସଂଳାପ (Full Odia Dialogue)' : 'ଓଡ଼ିଆ ସଂଳାପ ଓ ବକ୍ତା ସମୟ ସୂଚୀ (Speaker Timeline Dialogue)', 40, doc.y);
    }

    doc.moveDown(0.6);

    if (pdfLayout === 'monologue') {
      // Continuous Monologue Paragraphs
      lines.forEach((line) => {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
          doc.y = 40;
        }

        doc.font('Helvetica-Bold').fontSize(9).fillColor(speakerColor).text(`[${line.startFormatted}] ${sanitizeAsciiOnly(line.speaker || 'Speaker 1')}: `, { continued: true });
        
        if (isEnglishTarget) {
          const txt = sanitizeAsciiOnly(line.odiaText || line.text || '');
          doc.font('Helvetica').fontSize(11).fillColor(darkTextColor).text(txt);
        } else {
          const odiaTxt = sanitizeTextForOdiaPdf(line.odiaText || line.text || '');
          doc.font(fontOdiaReg).fontSize(11).fillColor(darkTextColor).text(odiaTxt);
        }
        doc.moveDown(0.5);
      });
    } else {
      // Timeline Table Layout
      lines.forEach((line, index) => {
        if (doc.y > doc.page.height - 90) {
          doc.addPage();
          doc.y = 40;
        }

        const itemTop = doc.y;
        const bg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        const cardHeight = pdfLayout === 'dual' ? 62 : 50;

        doc.rect(40, itemTop, doc.page.width - 80, cardHeight).fill(bg);

        // Timestamp Pill in Helvetica-Bold
        doc.roundedRect(48, itemTop + 8, 65, 18, 3).fill('#e0f2fe');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0369a1')
           .text(line.startFormatted || '00:00', 48, itemTop + 13, { width: 65, align: 'center' });

        // Speaker Tag in Helvetica-Bold
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

    // Page Numbers Footer in Helvetica
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
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
