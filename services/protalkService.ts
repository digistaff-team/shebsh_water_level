import { PROTALK_API_URL, PROTALK_CHAT_ID, TARGET_URL } from '../constants';
import { ProTalkResponse, ExtractedWaterData } from '../types';

const protalkBotToken = import.meta.env.VITE_PROTALK_BOT_TOKEN;
const protalkBotId = import.meta.env.VITE_PROTALK_BOT_ID;

/**
 * Clears the chat context by sending /clear command
 */
const clearChatContext = async (): Promise<void> => {
  const payload = {
    bot_id: protalkBotId,
    chat_id: PROTALK_CHAT_ID,
    message: '/clear'
  };

  try {
    await fetch(`${PROTALK_API_URL}/ask/${protalkBotToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    // Игнорируем ответ - просто ждем небольшую паузу
    await new Promise(resolve => setTimeout(resolve, 500));
    
  } catch (error) {
    console.warn("Failed to clear context, continuing anyway:", error);
    // Не бросаем ошибку - продолжаем работу даже если clear не сработал
  }
};

/**
 * Sends a command to the ProTalk bot to scrape the target URL using function #18.
 */
export const fetchRawTextFromUrl = async (): Promise<string> => {
  // Очищаем контекст перед запросом
  await clearChatContext();
  
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
  // Ищем ВСЕ числа, за которыми следует "см" или "cм" (кириллица или латиница)
  // Используем Unicode для кириллической "с" и латинской "c"
  const allNumbers = [...rawText.matchAll(/(-?\d+(?:[.,]\d+)?)\s*[cс]м\.?/gi)];
  
  console.log("Raw text:", rawText);
  console.log("Found numbers:", allNumbers.map(m => m[1]));
  
  if (allNumbers.length < 2) {
    // Попытка альтернативного парсинга - просто ищем все числа
    const justNumbers = [...rawText.matchAll(/(-?\d+(?:[.,]\d+)?)/g)];
    console.log("All numbers in text:", justNumbers.map(m => m[1]));
    
    throw new Error(
      `Could not find enough numeric values with "см". Found: ${allNumbers.length}. ` +
      `All numbers found: ${justNumbers.map(m => m[1]).join(', ')}. ` +
      `Text: ${rawText}`
    );
  }

  // Первое число - уровень воды, второе - изменение
  const water_level = parseFloat(allNumbers[0][1].replace(',', '.'));
  const change_24h = parseFloat(allNumbers[1][1].replace(',', '.'));

  if (isNaN(water_level) || isNaN(change_24h)) {
    throw new Error(
      `Failed to parse numbers. Water level: ${allNumbers[0][1]}, Change: ${allNumbers[1][1]}`
    );
  }

  console.log("Parsed successfully:", { water_level, change_24h });

  return { water_level, change_24h };
};
