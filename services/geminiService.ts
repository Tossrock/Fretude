import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const getCoachTip = async (recentMistakes: string[], score: number): Promise<string> => {
  const ai = getClient();
  if (!ai) {
    return "Great job practicing! Consistent repetition is key to mastering the fretboard.";
  }

  try {
    const mistakesStr = recentMistakes.length > 0 
      ? `The student struggled with these notes: ${recentMistakes.join(", ")}.` 
      : "The student played perfectly.";

    const prompt = `
      You are an encouraging classical guitar teacher. 
      A student just finished a fretboard identification session with a score of ${score}.
      ${mistakesStr}
      
      Provide a short, 2-sentence tip or encouragement. 
      If they made mistakes, explain a mnemonic or pattern to help remember those specific notes on the fretboard (EADGBE standard tuning).
      Keep it brief and friendly.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Keep practicing, you're doing great!";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Keep practicing! Memorization takes time and patience.";
  }
};
