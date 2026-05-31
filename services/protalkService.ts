import { PROTALK_EU_API_URL, TARGET_URL } from '../constants';
import { ExtractedWaterData } from '../types';

const protalkBotToken = import.meta.env.VITE_PROTALK_BOT_TOKEN;
const protalkBotId = Number(import.meta.env.VITE_PROTALK_BOT_ID);

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

const assertProTalkConfig = (): void => {
  if (!protalkBotToken || !protalkBotId) {
    throw new Error(
      'ProTalk config missing: set VITE_PROTALK_BOT_TOKEN and VITE_PROTALK_BOT_ID in .env.local'
    );
  }
};

/**
 * Asks the ProTalk bot to scrape TARGET_URL using async submit + polling.
 * Calls `onStatus` to report stage transitions so the UI can show progress.
 */
export const fetchRawTextFromUrl = async (
  onStatus?: (status: string) => void
): Promise<string> => {
  assertProTalkConfig();

  // Keep prompt ASCII-only to avoid encoding issues in external APIs.
  const message =
    `Run function #18 get_text_from_url for ${TARGET_URL}. ` +
    'Extract the current river water level and 24-hour change from the page. ' +
    'Return exactly this format: "Water level: XXX cm. 24h change: YYY cm." ' +
    'Where XXX and YYY are numbers (can be negative and decimal).';

  // Unique chat_id per request — no shared history, no /clear needed.
  const botChatId = `shebsh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  onStatus?.('Отправка запроса…');
  const sendRes = await fetch(`${PROTALK_EU_API_URL}/send_message_async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bot_id: protalkBotId,
      bot_token: protalkBotToken,
      bot_chat_id: botChatId,
      message,
    }),
  });

  if (!sendRes.ok) {
    const body = await sendRes.text().catch(() => '');
    if (sendRes.status === 401) throw new Error('ProTalk API: Unauthorized (check token)');
    throw new Error(`ProTalk send_message_async ${sendRes.status}: ${body || sendRes.statusText}`);
  }

  onStatus?.('Ждём ответ ИИ…');
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${PROTALK_EU_API_URL}/get_last_reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: protalkBotId,
        bot_token: protalkBotToken,
        bot_chat_id: botChatId,
      }),
    });

    if (!pollRes.ok) continue;
    const data = await pollRes.json().catch(() => null);
    const reply = typeof data?.message === 'string' ? data.message.trim() : '';
    if (reply) return reply;
  }

  throw new Error(`ProTalk: бот не ответил за ${POLL_TIMEOUT_MS / 1000} секунд`);
};

/**
 * Extracts water level and change from unstructured text received from ProTalk.
 * Supports negative numbers and decimal values.
 */
export const parseProTalkRawText = (rawText: string): ExtractedWaterData => {
  const text = rawText.replace(/ /g, ' ').trim();
  const numbersWithUnit = [
    ...text.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(?:cm|см)\.?/giu),
  ];

  if (numbersWithUnit.length < 2) {
    const justNumbers = [...text.matchAll(/(-?\d+(?:[.,]\d+)?)/g)];
    throw new Error(
      `Could not find enough numeric values with "cm/см". Found: ${numbersWithUnit.length}. ` +
        `All numbers found: ${justNumbers.map((m) => m[1]).join(', ')}. ` +
        `Text: ${rawText}`
    );
  }

  const water_level = parseFloat(numbersWithUnit[0][1].replace(',', '.'));
  const change_24h = parseFloat(numbersWithUnit[1][1].replace(',', '.'));

  if (isNaN(water_level) || isNaN(change_24h)) {
    throw new Error(
      `Failed to parse numbers. Water level: ${numbersWithUnit[0][1]}, Change: ${numbersWithUnit[1][1]}`
    );
  }

  return { water_level, change_24h };
};
