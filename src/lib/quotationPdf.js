const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const settings = require('./settings');

function money(n) {
  return Number(n).toFixed(2);
}

function trimNum(n) {
  const s = Number(n).toFixed(2);
  return s.replace(/\.?0+$/, '') || '0';
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Renders the quotation as a PDF into the given writable stream (e.g. an Express response).
function renderQuotationPdf(quotation, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(stream);

  const brandDark = '#082744';
  const brandBlue = '#0071bc';
  const muted = '#64748b';
  const lineColor = '#e2e8f0';

  const logoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');

  // ---- header ----
  const topY = doc.y;
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, 40, topY, { height: 32 }); } catch (e) { /* ignore bad image */ }
  }
  doc.font('Helvetica').fontSize(9).fillColor(muted)
    .text(settings.get('address', 'Level 2, 88 Hunter St, Newcastle NSW 2300'), 40, topY + 40, { width: 300 })
    .text(`${settings.get('phone', '1300 123 456')} · ${settings.get('email', 'hello@eliteshiningcleaning.com.au')}`, { width: 300 })
    .text(`ABN ${settings.get('abn', '12 345 678 901')}`, { width: 300 });

  doc.font('Helvetica-Bold').fontSize(20).fillColor(brandDark)
    .text('QUOTATION', 300, topY, { width: 255, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000')
    .text(quotation.quote_number, 300, topY + 26, { width: 255, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(muted)
    .text(`Issued: ${formatDate(quotation.created_at)}`, 300, topY + 40, { width: 255, align: 'right' });
  if (quotation.valid_until) {
    doc.text(`Valid until: ${formatDate(quotation.valid_until)}`, 300, topY + 52, { width: 255, align: 'right' });
  }

  doc.moveDown(3);
  let y = topY + 80;
  doc.strokeColor(lineColor).lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
  y += 20;

  // ---- quote for ----
  doc.font('Helvetica-Bold').fontSize(9).fillColor(brandBlue).text('QUOTE FOR', 40, y);
  y += 14;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000000').text(quotation.client_name, 40, y);
  y += 15;
  doc.font('Helvetica').fontSize(10).fillColor('#334155');
  if (quotation.client_address) { doc.text(quotation.client_address, 40, y); y += 13; }
  if (quotation.client_phone) { doc.text(quotation.client_phone, 40, y); y += 13; }
  if (quotation.client_email) { doc.text(quotation.client_email, 40, y); y += 13; }
  if (quotation.service_type) {
    doc.font('Helvetica').fontSize(10).fillColor(muted).text('Service: ', 40, y, { continued: true });
    doc.font('Helvetica-Bold').fillColor('#000000').text(quotation.service_type);
    y += 15;
  }

  y += 15;

  // ---- items table ----
  const colX = { desc: 40, qty: 330, price: 400, amount: 475 };
  const tableRight = 555;

  doc.rect(40, y, tableRight - 40, 22).fill(brandDark);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
  doc.text('Description', colX.desc + 8, y + 6);
  doc.text('Qty', colX.qty, y + 6, { width: 60, align: 'right' });
  doc.text('Unit Price', colX.price, y + 6, { width: 65, align: 'right' });
  doc.text('Amount', colX.amount, y + 6, { width: 72, align: 'right' });
  y += 22;

  doc.font('Helvetica').fontSize(9.5).fillColor('#1e293b');
  quotation.line_items.forEach((item) => {
    const rowH = 22;
    doc.text(item.description, colX.desc + 8, y + 6, { width: colX.qty - colX.desc - 16 });
    doc.text(trimNum(item.quantity), colX.qty, y + 6, { width: 60, align: 'right' });
    doc.text(`$${money(item.unit_price)}`, colX.price, y + 6, { width: 65, align: 'right' });
    doc.text(`$${money(Number(item.quantity) * Number(item.unit_price))}`, colX.amount, y + 6, { width: 72, align: 'right' });
    doc.strokeColor(lineColor).moveTo(40, y + rowH).lineTo(tableRight, y + rowH).stroke();
    y += rowH;
  });

  if (quotation.discount_amount > 0) {
    doc.font('Helvetica').fontSize(9.5).fillColor(muted);
    doc.text('Subtotal', colX.desc + 8, y + 6, { width: colX.amount - colX.desc - 16, align: 'right' });
    doc.text(`$${money(quotation.subtotal)}`, colX.amount, y + 6, { width: 72, align: 'right' });
    y += 20;

    const discountLabel = quotation.discount_type === 'percentage'
      ? `Discount (${trimNum(quotation.discount_value)}%)`
      : `Discount ($${money(quotation.discount_value)})`;
    doc.text(discountLabel, colX.desc + 8, y + 6, { width: colX.amount - colX.desc - 16, align: 'right' });
    doc.fillColor('#dc2626').text(`-$${money(quotation.discount_amount)}`, colX.amount, y + 6, { width: 72, align: 'right' });
    y += 20;
  }

  doc.rect(40, y, tableRight - 40, 26).fill('#eff8ff');
  doc.font('Helvetica-Bold').fontSize(11).fillColor(brandDark);
  doc.text('Total', colX.desc + 8, y + 7, { width: colX.amount - colX.desc - 16, align: 'right' });
  doc.text(`$${money(quotation.total)}`, colX.amount, y + 7, { width: 72, align: 'right' });
  y += 40;

  if (quotation.notes) {
    doc.rect(40, y, tableRight - 40, 60).fillAndStroke('#f8fafc', lineColor);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(brandBlue).text('NOTES', 52, y + 10);
    doc.font('Helvetica').fontSize(9.5).fillColor('#475569').text(quotation.notes, 52, y + 22, { width: tableRight - 40 - 24 });
    y += 75;
  }

  doc.font('Helvetica').fontSize(8.5).fillColor('#94a3b8')
    .text(
      `Thank you for choosing ${settings.get('business_name', 'Elite Shining Cleaning')}. This quotation is an estimate and may be subject to change after an on-site assessment.`,
      40, 780, { width: tableRight - 40, align: 'center' }
    );

  doc.end();
}

module.exports = { renderQuotationPdf };
