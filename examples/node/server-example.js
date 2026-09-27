// examples/node/server-example.js
// Minimal Express server demonstrating supabase-js usage (Node/Express)

require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = express();
app.use(express.json());

app.get('/todos', async (req, res) => {
  try {
    const { data, error } = await supabase.from('todos').select('*').limit(50);
    if (error) return res.status(500).json({ error });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});

app.post('/todos', async (req, res) => {
  try {
    const { name, description, owner } = req.body;
    const { data, error } = await supabase.from('todos').insert([{ name, description, owner }]).select().single();
    if (error) return res.status(500).json({ error });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || err });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Example server listening on http://localhost:${port}`));
