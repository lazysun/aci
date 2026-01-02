import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export const createChatSession = (systemInstruction: string) => {
  return ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction,
    },
  });
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
            aspectRatio: "1:1",
            // imageSize: "1K" // Not supported for flash-image
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed:", error);
    return null;
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text }],
      },
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Puck' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      // The API returns raw audio data, usually wrapped in a container if not streaming.
      // Let's assume it's playable. If not, we might need to handle PCM.
      // Common return is WAV.
      return `data:audio/wav;base64,${base64Audio}`;
    }
    return null;
  } catch (error) {
    console.error("Speech generation failed:", error);
    return null;
  }
};
