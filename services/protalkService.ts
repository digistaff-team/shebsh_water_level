import { PROTALK_API_URL, PROTALK_CHAT_ID, TARGET_URL } from '../constants';
import { ProTalkResponse, ExtractedWaterData } from '../types';

const protalkBotToken = import.meta.env.VITE_PROTALK_BOT_TOKEN;
const protalkBotId = import.meta.env.VITE_PROTALK_BOT_ID;

const assertProTalkConfig = (): void => {
  if (!protalkBotToken || !protalkBotId) {
    throw new Error(
      'ProTalk config missing: set VITE_PROTALK_BOT_TOKEN and VITE_PROTALK_BOT_ID in .env.local'
    );
  }
};

/**
 * Clears the chat context by sending /clear command.
 */
const clearChatContext = async (): Promise<void> => {
  if (!protalkBotToken || !protalkBotId) {
    return;
  }

  const payload = {
    bot_id: protalkBotId,
    chat_id: PROTALK_CHAT_ID,
    message: '/clear',
  };

  try {
    await fetch(`${PROTALK_API_URL}/ask/${protalkBotToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Small delay to let context clear complete on the remote side.
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch (error) {
    console.warn('Failed to clear context, continuing anyway:', error);
  }
};

/**
 * Sends a command to the ProTalk bot to scrape the target URL using function #18.
 */
export const fetchRawTextFromUrl = async (): Promise<string> => {
  assertProTalkConfig();
  await clearChatContext();

  // Keep prompt ASCII-only to avoid encoding issues in external APIs.
  const message =
    `Run function #18 get_text_from_url for ${TARGET_URL}. ` +
    'Extract the current river water level and 24-hour change from the page. ' +
    'Return exactly this format: "Water level: XXX cm. 24h change: YYY cm." ' +
    'Where XXX and YYY are numbers (can be negative and decimal).';

  const payload = {
    bot_id: protalkBotId,
    chat_id: PROTALK_CHAT_ID,
    message,
  };

  try {
    const response = await fetch(`${PROTALK_API_URL}/ask/${protalkBotToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('ProTalk API: Unauthorized (check token)');
      }
      if (response.status === 400) {
        throw new Error(`ProTalk API: Bad Request${errorBody ? ` - ${errorBody}` : ''}`);
      }
      throw new Error(
        `ProTalk API Error ${response.status}: ${errorBody || response.statusText || 'Unknown error'}`
      );
    }

    const data: ProTalkResponse = await response.json();
    if (!data || typeof data.done !== 'string' || !data.done.trim()) {
      throw new Error('ProTalk API: Empty or unexpected response payload');
    }

    return data.done;
  } catch (error) {
    console.error('ProTalk Service Error:', error);
    throw error;
  }
};

/**
 * Extracts water level and change from unstructured text received from ProTalk.
 * Supports negative numbers and decimal values.
 */
export const parseProTalkRawText = (rawText: string): ExtractedWaterData => {
  const text = rawText.replace(/\u00A0/g, ' ').trim();
  const numbersWithUnit = [
    ...text.matchAll(/(-?\d+(?:[.,]\d+)?)\s*(?:cm|\u0441\u043c)\.?/giu),
  ];

  console.log('Raw text:', rawText);
  console.log('Found numbers:', numbersWithUnit.map((m) => m[1]));

  if (numbersWithUnit.length < 2) {
    const justNumbers = [...text.matchAll(/(-?\d+(?:[.,]\d+)?)/g)];
    console.log('All numbers in text:', justNumbers.map((m) => m[1]));

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

  console.log('Parsed successfully:', { water_level, change_24h });
  return { water_level, change_24h };
};