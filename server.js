const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const CS_KEY = process.env.CLEARSTREAM_API_KEY;
const PCO_ID = process.env.PCO_APP_ID;
const PCO_SECRET = process.env.PCO_SECRET;
const CS_BASE = 'https://api.getclearstream.com/v1';
const PCO_BASE = 'https://api.planningcenteronline.com/people/v2';
const csH = () => ({ 'X-Api-Key': CS_KEY, 'Accept': 'application/json' });
const pcoH = () => ({ 'Authorization': 'Basic ' + Buffer.from(PCO_ID+':'+PCO_SECRET).toString('base64'), 'Accept': 'application/json' });

// Persist people to disk so they survive restarts
const DATA_FILE = path.join('/tmp', 'tbt_people.json');

function loadPeople() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      console.log('Loaded', parsed.people.length, 'people from disk');
      return parsed;
    }
  } catch(e) { console.log('Could not load people from disk:', e.message); }
  return { people: [], lastSync: null };
}

function savePeople(people, lastSync) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ people, lastSync }));
  } catch(e) { console.log('Could not save people to disk:', e.message); }
}

let { people: sharedPeople, lastSync } = loadPeople();

app.get('/', (req, res) => res.json({ status: 'TBT Prayer Server v3', time: new Date().toISOString(), people: sharedPeople.length }));

app.get('/people', (req, res) => res.json({ people: sharedPeople, count: sharedPeople.length, lastSync }));

app.post('/people', (req, res) => {
  const { people } = req.body;
  if (!Array.isArray(people)) return res.status(400).json({ error: 'people must be an array' });
  sharedPeople = people;
  lastSync = new Date().toISOString();
  savePeople(sharedPeople, lastSync);
  res.json({ ok: true, count: sharedPeople.length, lastSync });
});

app.patch('/people/:id', (req, res) => {
  const { id } = req.params;
  const idx = sharedPeople.findIndex(p => p.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  sharedPeople[idx] = { ...sharedPeople[idx], ...req.body, id };
  savePeople(sharedPeople, lastSync);
  res.json({ ok: true, person: sharedPeople[idx] });
});

app.get('/cs/subscribers', async (req, res) => {
  try {
    const { list_id, page = 1 } = req.query;
    const url = list_id
      ? CS_BASE + '/lists/' + list_id + '/subscribers?page=' + page
      : CS_BASE + '/subscribers?page=' + page;
    res.json(await (await fetch(url, { headers: csH() })).json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/cs/lists', async (req, res) => {
  try { res.json(await (await fetch(CS_BASE + '/lists?per_page=50', { headers: csH() })).json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/pco/lists', async (req, res) => {
  try { res.json(await (await fetch(PCO_BASE + '/lists?per_page=50', { headers: pcoH() })).json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/pco/list/:id/people', async (req, res) => {
  try {
    const { per_page = 100, offset = 0 } = req.query;
    res.json(await (await fetch(PCO_BASE + '/lists/' + req.params.id + '/people?per_page=' + per_page + '&offset=' + offset, { headers: pcoH() })).json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('TBT Prayer Server v3 on port ' + PORT));
