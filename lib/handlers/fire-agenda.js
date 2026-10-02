// lib/handlers/fire-agenda.js — POST /api/fire/agenda-task
// Fires the Anthropic scheduled task trig_01F5EvtLs1eh9X2MdRNqt7HN for a specific EventId
// This replaces the old Context Request + Poller flow for on-demand agenda generation.
import { setCors, handleOptions } from '../auth.js';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';
const SCHEDULED_TASK_ID = 'trig_01F5EvtLs1eh9X2MdRNqt7HN';

export default async function handler(req, res) {
  setCors(res);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const body = req.body || {};
    const eventId = body.eventId || '';
    const meetingSubject = body.meetingSubject || '';
    const meetingTime = body.meetingTime || '';

    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
    }

    // Fire the scheduled task with event context as input
    const payload = {
      params: {
        eventId,
        meetingSubject,
        meetingTime,
        triggeredBy: 'luci-prep-tab',
        triggeredAt: new Date().toISOString(),
      },
    };

    const response = await fetch(
      `${ANTHROPIC_BASE}/scheduled_tasks/${SCHEDULED_TASK_ID}/trigger`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic trigger failed:', response.status, errBody);
      return res.status(502).json({
        error: `Anthropic task trigger returned ${response.status}`,
        detail: errBody.substring(0, 500),
      });
    }

    const result = await response.json();
    console.log(`Agenda task fired for event ${eventId} (${meetingSubject})`);

    return res.json({
      success: true,
      message: `Agenda generation triggered for "${meetingSubject}". The scheduled task will produce it.`,
      taskId: SCHEDULED_TASK_ID,
      result,
    });

  } catch (err) {
    console.error('fire-agenda error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}