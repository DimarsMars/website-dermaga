const PDFDocument = require('pdfkit');

/**
 * Generate a PDF document from activity log entries.
 * @param {object[]} logs - Array of activity log entries
 * @param {object} options - PDF options
 * @param {string} [options.title] - Document title
 * @param {string} [options.startDate] - Filter start date (for display)
 * @param {string} [options.endDate] - Filter end date (for display)
 * @returns {PDFDocument} A readable stream of the PDF document
 */
function generateActivityPDF(logs, options = {}) {
  const { title = 'Activity Log Report', startDate, endDate } = options;

  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  // Title
  doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.5);

  // Date range subtitle
  if (startDate || endDate) {
    const rangeText = `Period: ${startDate || 'All'} — ${endDate || 'Now'}`;
    doc.fontSize(10).font('Helvetica').text(rangeText, { align: 'center' });
  }

  // Generated timestamp
  doc.fontSize(8).font('Helvetica')
    .text(`Generated: ${new Date().toISOString()}`, { align: 'center' });
  doc.moveDown(1);

  // Table header
  const tableTop = doc.y;
  const colWidths = { no: 30, date: 120, user: 80, type: 100, desc: 185 };
  const startX = 40;

  // Draw header row
  doc.fontSize(9).font('Helvetica-Bold');
  let x = startX;
  doc.text('No', x, tableTop, { width: colWidths.no });
  x += colWidths.no;
  doc.text('Date/Time', x, tableTop, { width: colWidths.date });
  x += colWidths.date;
  doc.text('User', x, tableTop, { width: colWidths.user });
  x += colWidths.user;
  doc.text('Activity', x, tableTop, { width: colWidths.type });
  x += colWidths.type;
  doc.text('Description', x, tableTop, { width: colWidths.desc });

  // Header underline
  doc.moveDown(0.5);
  doc.moveTo(startX, doc.y).lineTo(startX + 515, doc.y).stroke();
  doc.moveDown(0.3);

  // Table rows
  doc.font('Helvetica').fontSize(8);

  logs.forEach((log, index) => {
    // Check if we need a new page
    if (doc.y > 750) {
      doc.addPage();
      doc.y = 40;
    }

    const rowY = doc.y;
    x = startX;

    doc.text(String(index + 1), x, rowY, { width: colWidths.no });
    x += colWidths.no;

    const dateStr = log.date_time
      ? new Date(log.date_time).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })
      : '-';
    doc.text(dateStr, x, rowY, { width: colWidths.date });
    x += colWidths.date;

    doc.text(`${log.user_type} #${log.id_user}`, x, rowY, { width: colWidths.user });
    x += colWidths.user;

    doc.text(log.activity_type || '-', x, rowY, { width: colWidths.type });
    x += colWidths.type;

    doc.text(log.keterangan || '-', x, rowY, { width: colWidths.desc });

    doc.moveDown(0.8);
  });

  // Footer
  doc.moveDown(1);
  doc.fontSize(8).font('Helvetica')
    .text(`Total entries: ${logs.length}`, startX, doc.y);

  doc.end();

  return doc;
}

/**
 * Generate a PDF document from booking history entries.
 * @param {object[]} bookings - Array of booking records
 * @param {object} options - PDF options
 * @param {string} [options.title] - Document title
 * @param {string} [options.startDate] - Filter start date (for display)
 * @param {string} [options.endDate] - Filter end date (for display)
 * @returns {PDFDocument} A readable stream of the PDF document
 */
function generateBookingPDF(bookings, options = {}) {
  const { title = 'Booking History Report', startDate, endDate } = options;

  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });

  // Title
  doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown(0.3);

  // Date range subtitle
  if (startDate || endDate) {
    const formatDate = (d) => {
      if (!d) return '-';
      return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    };
    const rangeText = `Periode: ${formatDate(startDate)} — ${formatDate(endDate)}`;
    doc.fontSize(9).font('Helvetica').text(rangeText, { align: 'center' });
  }

  // Generated timestamp
  doc.fontSize(7).font('Helvetica')
    .text(`Dicetak: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' })}`, { align: 'center' });
  doc.moveDown(0.8);

  // Table header
  const tableTop = doc.y;
  const startX = 30;
  const colWidths = { no: 25, kapal: 110, loa: 40, posisi: 70, etaIn: 100, etdOut: 100, status: 65, agen: 110, ket: 132 };

  // Draw header row
  doc.fontSize(8).font('Helvetica-Bold');
  let x = startX;
  doc.text('No', x, tableTop, { width: colWidths.no });
  x += colWidths.no;
  doc.text('Nama Kapal', x, tableTop, { width: colWidths.kapal });
  x += colWidths.kapal;
  doc.text('LOA', x, tableTop, { width: colWidths.loa });
  x += colWidths.loa;
  doc.text('Posisi (m)', x, tableTop, { width: colWidths.posisi });
  x += colWidths.posisi;
  doc.text('ETA/IN', x, tableTop, { width: colWidths.etaIn });
  x += colWidths.etaIn;
  doc.text('ETD/OUT', x, tableTop, { width: colWidths.etdOut });
  x += colWidths.etdOut;
  doc.text('Status', x, tableTop, { width: colWidths.status });
  x += colWidths.status;
  doc.text('Agen', x, tableTop, { width: colWidths.agen });
  x += colWidths.agen;
  doc.text('Keterangan', x, tableTop, { width: colWidths.ket });

  // Header underline
  doc.moveDown(0.5);
  doc.moveTo(startX, doc.y).lineTo(startX + 752, doc.y).stroke();
  doc.moveDown(0.3);

  // Table rows
  doc.font('Helvetica').fontSize(7);

  bookings.forEach((booking, index) => {
    // Check if we need a new page
    if (doc.y > 520) {
      doc.addPage();
      doc.y = 30;
    }

    const rowY = doc.y;
    x = startX;

    doc.text(String(index + 1), x, rowY, { width: colWidths.no });
    x += colWidths.no;

    doc.text(booking.nama_kapal || '-', x, rowY, { width: colWidths.kapal });
    x += colWidths.kapal;

    doc.text(booking.loa ? String(booking.loa) : '-', x, rowY, { width: colWidths.loa });
    x += colWidths.loa;

    const posisi = booking.pos_start != null && booking.pos_end != null
      ? `${booking.pos_start} - ${booking.pos_end}`
      : '-';
    doc.text(posisi, x, rowY, { width: colWidths.posisi });
    x += colWidths.posisi;

    const etaIn = booking.eta_in
      ? new Date(booking.eta_in).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-';
    doc.text(etaIn, x, rowY, { width: colWidths.etaIn });
    x += colWidths.etaIn;

    const etdOut = booking.etd_out
      ? new Date(booking.etd_out).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-';
    doc.text(etdOut, x, rowY, { width: colWidths.etdOut });
    x += colWidths.etdOut;

    doc.text((booking.status_request || 'pending').toUpperCase(), x, rowY, { width: colWidths.status });
    x += colWidths.status;

    doc.text(booking.agency_name || '-', x, rowY, { width: colWidths.agen });
    x += colWidths.agen;

    doc.text(booking.keterangan || '-', x, rowY, { width: colWidths.ket });

    doc.moveDown(0.8);
  });

  // Footer
  doc.moveDown(1);
  doc.fontSize(8).font('Helvetica')
    .text(`Total: ${bookings.length} booking`, startX, doc.y);

  doc.end();

  return doc;
}

module.exports = { generateActivityPDF, generateBookingPDF };
