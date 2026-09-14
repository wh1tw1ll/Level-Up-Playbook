// api/logo.js — Serves the Level Up logo image
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const filePath = path.join(process.cwd(), 'public', 'assets', 'level-up-logo.png');
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'logo not found' });
    return;
  }
  const img = fs.readFileSync(filePath);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(img);
}