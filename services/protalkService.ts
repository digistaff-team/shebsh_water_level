import { PROTALK_API_URL, PROTALK_CHAT_ID, TARGET_URL } from '../constants';
import { ProTalkResponse, ExtractedWaterData } from '../types';

const protalkBotToken = import.meta.env.VITE_PROTALK_BOT_TOKEN;
const protalkBotId = import.meta.env.VITE_PROTALK_BOT_ID;

/**
 * Sends a command to the ProTalk bot to scrape the target URL using function #18.
 */
export const fetchRawTextFromUrl = async (): Promise<string> => {
  // Construct the prompt to force the bot to use function #18
  const message = `Используй функцию №18 'get_text_from_url', чтобы получить весь текстовый контент со страницы ${TARGET_URL}. Верни полученный текст.`;

  const payload = {
    bot_id: protalkBotId,
    chat_id: PROTALK_CHAT_ID,
    message: message
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
        if (response.status === 401) throw new Error("ProTalk API: Unauthorized (Check Token)");
        if (response.status === 400) throw new Error("ProTalk API: Bad Request");
        throw new Error(`ProTalk API Error: ${response.statusText}`);
    }

    const data: ProTalkResponse = await response.json();
    return data.done;

  } catch (error) {
    console.error("ProTalk Service Error:", error);
    throw error;
  }
};

/**
 * Extracts water level and change from unstructured text received from ProTalk.
 */
export const parseProTalkRawText = (rawText: string): ExtractedWaterData => {
  // Regex to find "Уровень воды: XXX см"
  const waterLevelMatch = rawText.match(/Уровень воды:\s*(\d+)\s*см/i);
  // Regex to find "Изменение за 24 часа: [+-]YYY см" or "Изменение: [+-]YYY см"
  const change24hMatch = rawText.match(/(?:Изменение|Изменение за 24 часа):\s*([+-]?\d+)\s*см/i);

  if (!waterLevelMatch || !change24hMatch) {
    console.error("Raw text for parsing:", rawText);
    throw new Error("Could not parse water level or 24h change from ProTalk raw text. Expected format: 'Уровень воды: XXX см. Изменение за 24 часа: YYY см.'");
  }

  const water_level = parseInt(waterLevelMatch[1], 10);
  const change_24h = parseInt(change24hMatch[1], 10);

  if (isNaN(water_level) || isNaN(change_24h)) {
    console.error("Parsed values - Water Level:", water_level, "Change 24h:", change_24h);
    throw new Error("Parsed values are not valid numbers from ProTalk raw text.");
  }

  return { water_level, change_24h };
};
