import { PROTALK_API_URL, PROTALK_BOT_TOKEN, PROTALK_BOT_ID, PROTALK_CHAT_ID, TARGET_URL } from '../constants';
import { ProTalkResponse } from '../types';

/**
 * Sends a command to the ProTalk bot to scrape the target URL using function #18.
 */
export const fetchRawTextFromUrl = async (): Promise<string> => {
  // Construct the prompt to force the bot to use function #18
  const message = `Используй функцию №18 'get_text_from_url', чтобы получить весь текстовый контент со страницы ${TARGET_URL}. Верни полученный текст.`;

  const payload = {
    bot_id: PROTALK_BOT_ID,
    chat_id: PROTALK_CHAT_ID,
    message: message
  };

  try {
    const response = await fetch(`${PROTALK_API_URL}/ask/${PROTALK_BOT_TOKEN}`, {
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
