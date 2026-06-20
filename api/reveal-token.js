export default function handler(req, res) {
  res.status(200).json({ token: process.env.SMARTSHEET_TOKEN || 'NOT_FOUND' });
}