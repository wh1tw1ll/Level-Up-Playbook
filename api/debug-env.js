// Temporary debug endpoint — DELETE AFTER USE
export default function handler(req, res) {
  const pw = process.env.SITE_PASSWORD;
  res.json({
    SITE_PASSWORD_set: typeof pw !== 'undefined',
    SITE_PASSWORD_length: pw ? pw.length : 0,
    SITE_PASSWORD_startsWith: pw ? pw.substring(0,2) : null,
    SITE_PASSWORD_endsWith: pw ? pw.substring(pw.length-2) : null,
    SITE_PASSWORD_ExactMatch_lupd2023: pw === 'lupd2023'
  });
}