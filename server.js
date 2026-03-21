const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();
app.use(cors());
app.use(express.json());
const CS_KEY = process.env.CLEARSTREAM_API_KEY;
const CS_ACCOUNT = process.env.CLEARSTREAM_ACCOUNT_ID;
const PCO_ID = process.env.PCO_APP_ID;
const PCO_SECRET = process.env.PCO_SECRET;
const CS_BASE = 'https://api.getclearstream.com/v1';
const PCO_BASE = 'https://api.planningcenteronline.com/people/v2';
const csH = () => ({ 'X-Api-Key': CS_KEY, 'Accept': 'application/json' });
const pcoH = () => ({ 'Authorization': 'Basic ' + Buffer.from(PCO_ID+':'+PCO_SECRET).toString('base64'), 'Accept': 'application/json' });
app.get('/', (req, res) => res.json({ status: 'TBT Prayer Server running', time: new Date().toISOString() }));
app.get('/cs/subscribers', async (req, res) => {
  try {
    const { list_id, page=1, per_page=100 } = req.query;
    let url = CS_BASE+'/subscribers?per_page='+per_page+'&page='+page;
    if (list_id) url += '&list_id='+list_id;
    res.json(await (await fetch(url, { headers: csH() })).json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/cs/lists', async (req, res) => {
  try { res.json(await (await fetch(CS_BASE+'/lists?per_page=50', { headers: csH() })).json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/cs/inbox', async (req, res) => {
  try {
    const { per_page=50, page=1 } = req.query;
    res.json(await (await fetch(CS_BASE+'/threads?per_page='+per_page+'&page='+page, { headers: csH() })).json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/pco/lists', async (req, res) => {
  try { res.json(await (await fetch(PCO_BASE+'/lists?per_page=50', { headers: pcoH() })).json()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/pco/list/:id/people', async (req, res) => {
  try {
    const { per_page=100, offset=0 } = req.query;
    res.json(await (await fetch(PCO_BASE+'/lists/'+req.params.id+'/people?per_page='+per_page+'&offset='+offset+'&include=emails', { headers: pcoH() })).json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.get('/sync', async (req, res) => {
  try {
    const { list_id } = req.query;
    let url = CS_BASE+'/subscribers?per_page=100';
    if (list_id) url += '&list_id='+list_id;
    const [subR, threadsR] = await Promise.all([
      fetch(url, { headers: csH() }),
      fetch(CS_BASE+'/threads?per_page=100', { headers: csH() })
    ]);
    const subs = (await subR.json()).data || [];
    const threads = (await threadsR.json()).data || [];
    const msgMap = {};
    threads.forEach(t => {
      const mobile = t.subscriber?.mobile_number || t.mobile_number;
      if (mobile) {
        if (!msgMap[mobile]) msgMap[mobile] = [];
        if (t.latest_message?.body) msgMap[mobile].push({ text: t.latest_message.body, date: t.latest_message.created_at });
      }
    });
    res.json({
      people: subs.map(s => ({
        id: s.id,
        first: s.first || '',
        last: s.last || '',
        mobile: s.mobile_number,
        email: s.email || '',
        lists: (s.lists||[]).map(l => l.name),
        recentMessages: msgMap[s.mobile_number] || []
      })),
      total: subs.length,
      synced_at: new Date().toISOString()
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('TBT Prayer Server on port '+PORT));
