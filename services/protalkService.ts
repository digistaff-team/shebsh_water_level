import { PROTALK_API_URL, PROTALK_CHAT_ID, TARGET_URL } from '../constants';
import { ProTalkResponse, ExtractedWaterData } from '../types';

const protalkBotToken = import.meta.env.VITE_PROTALK_BOT_TOKEN;
const protalkBotId = import.meta.env.VITE_PROTALK_BOT_ID;

/**
 * Sends a command to the ProTalk bot to scrape the target URL using function #18.
 */
export const fetchRawTextFromUrl = async (): Promise<string> => {
  // Обновленный промпт для получения корректного формата
  const message = `Запусти функцию №18 'get_text_from_url', прочитай со страницы ${TARGET_URL} сведения о текущем уровне воды и изменении уровня за прошедшие 24 часа и верни СТРОГО в формате: 'Уровень воды: XXX см. Изменение за 24 часа: YYY см.' (где XXX и YYY - числа с возможным знаком минус и дробной частью)`;

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
 * Supports negative numbers and decimal values.
 */
export const parseProTalkRawText = (rawText: string): ExtractedWaterData => {
  // Regex для "Уровень воды: -XXX.XX см" (с учетом минуса и дробной части)
  const waterLevelMatch = rawText.match(/Уровень воды:\s*(-?\d+(?:[.,]\d+)?)\s*c?м/i);
  
  // Regex для "Изменение за 24 часа: [+-]YYY.YY см" (с учетом знака и дробной части)
  const change24hMatch = rawText.match(/(?:Изменение|Изменение за 24 часа):\s*([+-]?\d+(?:[.,]\d+)?)\s*c?м/i);

  if (!waterLevelMatch || !change24hMatch) {
    console.error("Raw text for parsing:", rawText);
    throw new Error(
      "Could not parse water level or 24h change from ProTalk raw text. " +
      "Expected format: 'Уровень воды: XXX см. Изменение за 24 часа: YYY см.' " +
      "Received: " + rawText
    );
  }

  // Заменяем запятую на точку для корректного парсинга
  const water_level = parseFloat(waterLevelMatch[1].replace(',', '.'));
  const change_24h = parseFloat(change24hMatch[1].replace(',', '.'));

  if (isNaN(water_level) || isNaN(change_24h)) {
    console.error("Parsed values - Water Level:", water_level, "Change 24h:", change_24h);
    throw new Error(
      `Parsed values are not valid numbers. Water Level: ${waterLevelMatch[1]}, Change: ${change24hMatch[1]}`
    );
  }

  return { water_level, change_24h };
};
