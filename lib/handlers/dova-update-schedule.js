// lib/handlers/dova-update-schedule.js — Replace Sheet 05 with PDF master schedule data
import { SMARTSHEET_TOKEN, fetchWithRetry } from './dova.js';

const SHEET_ID = '6248192067719044';

const SCHEDULE_DATA = [
  { id: 'M-001', desc: 'DOVA ARENA (Project Total)', start: '2026-06-15', finish: '2028-05-16', phase: 'Project', pred: '', dur: '502d' },
  // === PREDEVELOPMENT ===
  { id: 'M-002', desc: 'Level Up Onboarding', start: '2026-06-15', finish: '2026-06-24', phase: 'Predevelopment', pred: '', dur: '8d' },
  { id: 'M-003', desc: 'Level Up Project Plan Presentation', start: '2026-06-24', finish: '2026-06-24', phase: 'Predevelopment', pred: 'M-002', dur: '0' },
  // === DESIGN ===
  { id: 'M-004', desc: 'Conceptual / Programming Complete', start: '2026-06-15', finish: '2026-06-15', phase: 'Design', pred: '', dur: '0' },
  { id: 'M-005', desc: 'SD Release / LNTP Executed', start: '2026-06-26', finish: '2026-06-26', phase: 'Design', pred: 'M-003', dur: '0' },
  { id: 'M-006', desc: 'Schematic Progress', start: '2026-06-26', finish: '2026-07-30', phase: 'Design', pred: 'M-005', dur: '25d' },
  { id: 'M-007', desc: 'Concrete vs. Steel Superstructure Decision', start: '2026-06-26', finish: '2026-07-07', phase: 'Design', pred: 'M-005', dur: '8d' },
  { id: 'M-008', desc: 'Schematic 100% Package Release', start: '2026-07-30', finish: '2026-07-30', phase: 'Design', pred: 'M-006', dur: '0' },
  { id: 'M-009', desc: 'SD Page Flip', start: '2026-07-31', finish: '2026-08-04', phase: 'Design', pred: 'M-008', dur: '3d' },
  { id: 'M-010', desc: 'Updated Contractor Pricing, Procurement Log & Schedule (SD)', start: '2026-07-31', finish: '2026-08-11', phase: 'Design', pred: 'M-008', dur: '8d' },
  { id: 'M-011', desc: 'Project Delivery Method / Procurement Evaluation (SD)', start: '2026-08-12', finish: '2026-08-13', phase: 'Design', pred: 'M-010', dur: '2d' },
  { id: 'M-012', desc: 'Design Development (DD) Phase', start: '2026-07-31', finish: '2026-10-27', phase: 'Design', pred: 'M-008', dur: '63d' },
  { id: 'M-013', desc: '50% DD Contractor Updated Pricing, Procurement Log & Schedule', start: '2026-09-15', finish: '2026-09-21', phase: 'Design', pred: 'M-012', dur: '5d' },
  { id: 'M-014', desc: '100% DD Package Release', start: '2026-10-15', finish: '2026-10-15', phase: 'Design', pred: 'M-012', dur: '0' },
  { id: 'M-015', desc: '100% DD Page Flip', start: '2026-10-16', finish: '2026-10-19', phase: 'Design', pred: 'M-014', dur: '2d' },
  { id: 'M-016', desc: '100% DD Contractor Updated Pricing, Procurement Log & Schedule', start: '2026-10-16', finish: '2026-10-27', phase: 'Design', pred: 'M-014', dur: '8d' },
  { id: 'M-017', desc: 'Project Delivery Method / Procurement Evaluation (DD)', start: '2026-10-28', finish: '2026-10-29', phase: 'Design', pred: 'M-016', dur: '2d' },
  { id: 'M-018', desc: 'Construction Documents (CD) Phase', start: '2026-10-16', finish: '2027-01-28', phase: 'Design', pred: 'M-014', dur: '75d' },
  { id: 'M-019', desc: '50% CD Page Flip', start: '2026-11-27', finish: '2026-11-30', phase: 'Design', pred: 'M-018', dur: '2d' },
  { id: 'M-020', desc: '50% CD GMP Deliverable', start: '2026-12-24', finish: '2026-12-24', phase: 'Design', pred: 'M-018', dur: '0' },
  { id: 'M-021', desc: 'GMP Review + Negotiation', start: '2026-12-25', finish: '2027-01-14', phase: 'Design', pred: 'M-020', dur: '15d' },
  { id: 'M-022', desc: 'GMP Execution', start: '2027-01-14', finish: '2027-01-14', phase: 'Design', pred: 'M-021', dur: '0' },
  // === PERMITTING ===
  { id: 'M-023', desc: 'Permitting & AHJ Approvals Phase', start: '2026-06-29', finish: '2027-03-04', phase: 'Permitting', pred: '', dur: '179d' },
  { id: 'M-024', desc: 'AHJ + Permitting Strategy / Matrix Validation / Pre-Application Meetings', start: '2026-06-29', finish: '2026-07-24', phase: 'Permitting', pred: '', dur: '20d' },
  { id: 'M-025', desc: 'Early Site / Civil / Grading / Utility Permit', start: '2026-08-14', finish: '2026-09-17', phase: 'Permitting', pred: 'M-010', dur: '25d' },
  { id: 'M-026', desc: 'Foundations Permit', start: '2026-09-11', finish: '2026-10-15', phase: 'Permitting', pred: 'M-012', dur: '25d' },
  { id: 'M-027', desc: 'Superstructure / Seating Bowl Permit', start: '2026-10-19', finish: '2026-11-20', phase: 'Permitting', pred: 'M-015', dur: '25d' },
  { id: 'M-028', desc: 'Full Building Permit', start: '2027-01-29', finish: '2027-03-04', phase: 'Permitting', pred: 'M-022', dur: '25d' },
  // === CONSTRUCTION ===
  { id: 'M-029', desc: 'Construction + TCO Phase', start: '2026-09-18', finish: '2028-03-21', phase: 'Construction', pred: '', dur: '393d' },
  { id: 'M-030', desc: 'Site Preparation & Utilities', start: '2026-09-18', finish: '2026-10-15', phase: 'Construction', pred: 'M-025', dur: '20d' },
  { id: 'M-031', desc: 'Substructure', start: '2026-10-16', finish: '2026-11-26', phase: 'Construction', pred: 'M-026', dur: '30d' },
  { id: 'M-032', desc: 'Superstructure & Seating Bowl', start: '2026-11-27', finish: '2027-07-29', phase: 'Construction', pred: 'M-031, M-027', dur: '175d' },
  { id: 'M-033', desc: 'Building Enclosure', start: '2027-04-02', finish: '2027-10-07', phase: 'Construction', pred: 'M-028, M-032', dur: '135d' },
  { id: 'M-034', desc: 'MEP Core / Vertical Transportation / IT-AV Rooms', start: '2027-07-16', finish: '2028-01-27', phase: 'Construction', pred: 'M-028, M-032', dur: '140d' },
  { id: 'M-035', desc: 'Interior Buildout', start: '2027-07-16', finish: '2028-02-24', phase: 'Construction', pred: 'M-028, M-032', dur: '160d' },
  { id: 'M-036', desc: 'Fixed Seating / Rails / Bowl Finishes', start: '2027-11-01', finish: '2028-03-03', phase: 'Construction', pred: 'M-032', dur: '90d' },
  { id: 'M-037', desc: 'Final Sitework', start: '2028-01-15', finish: '2028-03-16', phase: 'Construction', pred: '', dur: '45d' },
  { id: 'M-038', desc: 'FF&E, Start-Up, Testing & Commissioning', start: '2028-02-10', finish: '2028-03-15', phase: 'Construction', pred: '', dur: '25d' },
  { id: 'M-039', desc: 'Life Safety / AHJ Inspections / TCO Readiness', start: '2028-02-10', finish: '2028-03-15', phase: 'Construction', pred: '', dur: '25d' },
  { id: 'M-040', desc: 'Substantial Completion / TCO', start: '2028-03-15', finish: '2028-03-15', phase: 'Construction', pred: 'M-038, M-039', dur: '0' },
  { id: 'M-041', desc: 'Event Ready', start: '2028-03-15', finish: '2028-03-21', phase: 'Construction', pred: 'M-040', dur: '5d' },
  // === CLOSEOUT ===
  { id: 'M-042', desc: 'Final Completion Phase', start: '2028-03-15', finish: '2028-05-16', phase: 'Closeout', pred: 'M-040', dur: '45d' },
  { id: 'M-043', desc: 'Punch / Closeout', start: '2028-03-15', finish: '2028-05-16', phase: 'Closeout', pred: 'M-040', dur: '45d' },
  { id: 'M-044', desc: 'Final Certificate of Occupancy', start: '2028-03-15', finish: '2028-04-18', phase: 'Closeout', pred: 'M-040', dur: '25d' },
];

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Get current sheet structure (column IDs)
    const sheet = await fetchWithRetry(
      `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}`,
      { headers: { Authorization: `Bearer ${SMARTSHEET_TOKEN}` } }
    );

    // Build column map
    const colMap = {};
    (sheet.columns || []).forEach(c => { colMap[c.title] = c.id; });

    console.log('Column map:', JSON.stringify(colMap));

    // Delete ALL existing rows
    const existingRowIds = (sheet.rows || []).map(r => r.id);
    if (existingRowIds.length > 0) {
      console.log(`Deleting ${existingRowIds.length} existing rows...`);
      await fetchWithRetry(
        `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/rows?ids=${existingRowIds.join(',')}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${SMARTSHEET_TOKEN}` } }
      );
    }

    // Add new schedule rows
    const rows = SCHEDULE_DATA.map(entry => {
      const cells = [
        { columnId: colMap['Milestone ID'], value: entry.id },
        { columnId: colMap['Description'], value: entry.desc },
        { columnId: colMap['Planned Start'], value: entry.start },
        { columnId: colMap['Planned Finish'], value: entry.finish },
        { columnId: colMap['Phase'], value: entry.phase },
      ];
      if (colMap['Predecessor']) {
        cells.push({ columnId: colMap['Predecessor'], value: entry.pred || '' });
      }
      if (colMap['Responsibility']) {
        cells.push({ columnId: colMap['Responsibility'], value: '' });
      }
      return { cells };
    });

    console.log(`Adding ${rows.length} new schedule rows...`);
    
    // Add rows in batches of 50 (Smartsheet limit)
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await fetchWithRetry(
        `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}/rows`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SMARTSHEET_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ rows: batch })
        }
      );
    }

    res.json({
      ok: true,
      message: 'Schedule updated successfully from PDF master schedule',
      rowsAdded: rows.length,
      rowsDeleted: existingRowIds.length
    });
  } catch (e) {
    console.error('Schedule update error:', e.message);
    res.status(500).json({ error: true, message: e.message });
  }
}