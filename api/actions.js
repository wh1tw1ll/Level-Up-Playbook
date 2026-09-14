// api/actions.js — Serves public/tasks.html at runtime
import { readFileSync } from 'fs';
import { join } from 'path';
export default function handler(req, res) {
  const html = readFileSync(join(process.cwd(), 'public', 'tasks.html'), 'utf-8');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).send(html);
}