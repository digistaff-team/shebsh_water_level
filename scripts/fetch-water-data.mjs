// Called once per day by .github/workflows/update-history.yml.
// Fetches the current Shebsh river water level via ProTalk and appends a
// new record to public/history.json. The workflow then commits the file
// so it ships with the next Vercel deploy.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TARGET_URL = 'https://allrivers.info/gauge/shebsh-grigoryevskaya/waterlevel';
const PROTALK_EU_API_URL = 'https://eu1.api.pro-talk.ru/api/v1.0';
const HISTORY_PATH = 'public/history.json';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

const token = process.env.PROTALK_BOT_TOKEN;
const botId = Number(process.env.PROTALK_BOT_ID);

if (!token || !botId) {
  console.error('Missing PROTALK_BOT_TOKEN or PROTALK_BOT_ID env');
  process.exit(1);
}

const message =
  `Run function #18 get_text_from_url for ${TARGET_URL}. ` +
  'Extract the current river water level and 24-hour change from the page. ' +
  'Return exactly this format: "Water level: XXX cm. 24h change: YYY cm." ' +
  'Where XXX and YYY are numbers (can be negative and decimal).';

const botChatId = `shebsh_cron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

console.log('[1] send_message_async…');
const sendRes = await fetch(`${PROTALK_EU_API_URL}/send_message_async`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bot_id: botId, bot_token: token, bot_chat_id: botChatId, message }),
});
if (!sendRes.ok) {
  console.error(`send_message_async failed: ${sendRes.status} ${await sendRes.text()}`);
  process.exit(1);
}

console.log('[2] polling get_last_reply…');
const deadline = Date.now() + POLL_TIMEOUT_MS;
let reply;
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  const pollRes = await fetch(`${PROTALK_EU_API_URL}/get_last_reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bot_id: botId, bot_token: token, bot_chat_id: botChatId }),
  });
  if (!pollRes.ok) continue;
  const data = await pollRes.json().catch(() => null);
  const r = typeof data?.message === 'string' ? data.message.trim() : '';
  if (r) { reply = r; break; }
}

if (!reply) {
  console.error('No reply within timeout');
  process.exit(1);
}
console.log('[3] reply:', reply);

const numbers = [...reply.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(?:cm|см)\.?/giu)];
if (numbers.length < 2) {
  console.error('Could not parse numbers from reply:', reply);
  process.exit(1);
}
const water_level = parseFloat(numbers[0][1].replace(',', '.'));
const change_24h = parseFloat(numbers[1][1].replace(',', '.'));
if (!Number.isFinite(water_level) || !Number.isFinite(change_24h)) {
  console.error('Parsed non-finite numbers');
  process.exit(1);
}
const trend = change_24h > 0 ? 'RISING' : change_24h < 0 ? 'FALLING' : 'STABLE';

let history = [];
if (existsSync(HISTORY_PATH)) {
  try {
    const parsed = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
    if (Array.isArray(parsed)) history = parsed;
  } catch (e) {
    console.warn('Could not parse existing history, starting fresh:', e.message);
  }
}

const id = history.reduce((m, r) => Math.max(m, r.id ?? 0), 0) + 1;
const record = { id, water_level, change_24h, trend, created_at: new Date().toISOString() };
history.push(record);

writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
console.log('[4] appended:', record);
console.log(`[5] history now has ${history.length} records`);
