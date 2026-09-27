// server/example-checklists-server.js
// Minimal Express server demonstrating checklist list/create using supabaseClient and helpers.

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { listChecklists, createChecklist } = require('./checklists-api-example');

const app = express();
app.use(bodyParser.json({ limit: '20mb' }));

// GET /checklists?userId=UUID
app.get('/checklists', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const data = await listChecklists(userId);
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err });
  }
});

// POST /checklists
// Body: { id, data, owner, fileBase64?, filename?, contentType? }
app.post('/checklists', async (req, res) => {
  try {
    const { id, data, owner, fileBase64, filename, contentType } = req.body;
    if (!id || !data || !owner) return res.status(400).json({ error: 'id,data,owner required' });

    let file = null;
    if (fileBase64 && filename) {
      const buffer = Buffer.from(fileBase64, 'base64');
      file = { buffer, filename, contentType: contentType || 'application/octet-stream' };
    }

    const result = await createChecklist({ id, data, owner }, file);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || err });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Checklist example server listening on http://localhost:${port}`));
