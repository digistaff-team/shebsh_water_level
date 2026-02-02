import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedWaterData } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Extracts water level and change from unstructured text.
 */
export const parseWaterData = async (rawText: string): Promise<ExtractedWaterData> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `
        Analyze the following text which contains water level data for the Shebsh river.
        Extract the current 'water_level' (usually in cm) and the 'change_24h' (change over 24 hours).
        
        Text content:
        """
        ${rawText}
        """
        
        If the change is negative, ensure the number is negative.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            water_level: {
              type: Type.NUMBER,
              description: "The current water level in cm",
            },
            change_24h: {
              type: Type.NUMBER,
              description: "The change in water level over the last 24 hours",
            },
          },
          required: ["water_level", "change_24h"],
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      throw new Error("Gemini returned empty response");
    }

    const data = JSON.parse(jsonText) as ExtractedWaterData;
    return data;

  } catch (error) {
    console.error("Gemini Parse Error:", error);
    throw new Error("Failed to parse water data from text.");
  }
};
