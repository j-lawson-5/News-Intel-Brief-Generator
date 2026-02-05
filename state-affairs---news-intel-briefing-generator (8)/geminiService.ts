import { GoogleGenAI, Type } from "@google/genai";
import { BriefingContent, Article } from "./types";

export const BRIEFING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    bluf: {
      type: Type.OBJECT,
      properties: {
        intro: { type: Type.STRING },
        bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        actions: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["intro", "bullets", "actions"]
    },
    forcingFunction: {
      type: Type.OBJECT,
      properties: {
        what: { type: Type.STRING },
        forecast: { type: Type.ARRAY, items: { type: Type.STRING } },
        why: { type: Type.STRING }
      },
      required: ["what", "forecast", "why"]
    },
    signals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          activity: { type: Type.STRING },
          developments: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "activity", "developments"]
      }
    },
    regional: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          state: { type: Type.STRING },
          status: { type: Type.STRING },
          impact: { type: Type.STRING }
        },
        required: ["state", "status", "impact"]
      }
    },
    watchList: { type: Type.ARRAY, items: { type: Type.STRING } },
    sources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING }
        },
        required: ["title", "url"]
      }
    },
    strategicInsight: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        insight: { type: Type.STRING }
      },
      required: ["title", "insight"]
    }
  },
  required: ["bluf", "signals", "regional", "watchList", "sources", "strategicInsight"]
};

/**
 * Utility to clean AI response text which might contain markdown code blocks.
 */
function cleanJsonResponse(text: string): string {
  if (!text) return "";
  // Strip markdown code blocks if they exist
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned;
}

export async function generateBriefingContent(
  topic: string,
  context: string,
  articles: Article[],
  prospectName?: string,
  prospectDomain?: string,
  systemPrompt?: string
): Promise<BriefingContent> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const articleContext = articles.map((a, idx) => {
      const base = `Reference Item #${idx + 1}: [${a.state}] Category: ${a.category} | Headline: ${a.title}`;
      const summaryText = a.summary ? `\n  Summary: ${a.summary}` : '';
      return `${base}${summaryText} (${a.url})`;
    }).join('\n');

    let insightContext = `
      STRATEGIC INSIGHT INSTRUCTIONS:
      Focus on a "Sector-Level Outlook" for ${topic}. 
      Use the provided 'Category' labels in the data to identify which sub-sectors are most volatile.
      The 'title' should be: "Sector Strategic Outlook: ${topic}". 
    `;

    if (prospectName) {
      insightContext = `
      PROSPECT PERSONALIZATION:
      The briefing is for: ${prospectName} (${prospectDomain || 'N/A'}).
      The 'title' MUST be: "Strategic Impact: ${prospectName}".
      Explain how policy shifts in specific categories (e.g. Regulatory, Tax) impact this company.
      `;
    }

    const prompt = `
      ${systemPrompt || ''}

      Generate a professional high-level intelligence briefing for the ${topic} industry.
      Target Audience: State-level government relations leaders.
      Focus Context: ${context || 'General industry monitoring.'}

      ${insightContext}

      REGIONAL DATA RULES:
      - 'state': Full state name in uppercase (e.g., "PENNSYLVANIA").
      - 'status': A short 2-3 word strategic status label (e.g., "ACTIVE LEGISLATION", "REGULATORY REVIEW", "MONITORING"). Do NOT put long headlines or sentences here.
      - 'impact': The core analysis of what is happening in that state and what it means for the future. Use citations [n].

      WATCH LIST RULES:
      - The watchList should contain a MIX of: emerging policy topics, specific bill numbers, key stakeholders/companies, regulatory bodies, and states with high activity.
      - Example items: "HB 1234 - School Choice Expansion", "DEI Legislation Wave", "Teacher Shortage Crisis", "Gov. Shapiro", "Texas STAAR Testing Reform"
      - Do NOT make it just a list of state names. Include diverse strategic intelligence targets.

      SOURCE SELECTION RULES:
      - Include ALL articles that have material impact on Corporate Government Relations teams or Lobbyists
      - Prioritize: regulatory changes, compliance deadlines, legislative votes, enforcement actions, budget implications
      - Do NOT limit sources to an arbitrary number - include every article that informed your analysis
      - Each source in the 'sources' array must be cited at least once with [n] notation in the briefing text

      CRITICAL CITATION & CREDIBILITY RULES:
      1. USE SIMPLE FOOTNOTES: Citations must be simple numbers like [1], [2], [3] - NOT [ID:1] or any other format.
      2. MAPPING: These numbers correspond to the 1-indexed position in the 'sources' array you generate.
      3. BIBLIOGRAPHY: The 'sources' array should contain the articles you actually referenced.
      4. Do NOT use the [ID:n] format from the input data - convert to simple [n] format.
      
      CRITICAL "INTEL TRANSLATION" PRINCIPLE:
      DO NOT represent the past as the core insight. Your task is to perform INTEL TRANSLATION: take historical news and legislative data and translate them into what they mean for the FUTURE (impact, risks, and strategic trajectory).
      
      STRICT PROHIBITION: Do not use current or previous calendar years (e.g., "2024", "2023") in titles or summaries as if they are "current news". 
      Instead of "2024 Election Cycle", use "Upcoming Regulatory Environment" or "Post-Cycle Compliance Trajectory". 
      Translate all past events into their Future significance.

      Data:
      ${articleContext}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: BRIEFING_SCHEMA,
      }
    });

    const resultText = cleanJsonResponse(response.text || "");
    if (!resultText) throw new Error("Empty response from model.");
    
    try {
      const parsedContent = JSON.parse(resultText) as BriefingContent;
      if (parsedContent.forcingFunction && (!parsedContent.forcingFunction.what || parsedContent.forcingFunction.what.trim() === "")) {
        delete parsedContent.forcingFunction;
      }
      return parsedContent;
    } catch (parseError) {
      console.error("[Gemini Service] JSON Parse Error. Raw Text:", resultText);
      throw parseError;
    }
  } catch (error) {
    console.error('[Gemini Service] Critical generation failure:', error);
    throw error;
  }
}

export async function tuneBriefingSection(
  sectionName: string,
  currentData: any,
  tuningPrompt: string,
  schema: any
): Promise<any> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Rewrite the "${sectionName}" section based on feedback. 
    
    STRICT RULE: Only use past information to translate into future impact or trajectory. Maintain a professional, predictive tone.
    DO NOT mention past years (e.g. 2024) as headlines; describe the future impact resulting from them.
    
    FOOTNOTE RULE: Maintain the [n] citation style throughout the text. Use simple [1], [2] format only.

    REGIONAL DATA RULES (if applicable):
    - Keep 'status' short (2-3 words).
    
    CURRENT DATA:
    ${JSON.stringify(currentData, null, 2)}
    
    USER FEEDBACK:
    "${tuningPrompt}"

    If editing signals, ensure 'activity' remains 1-2 sentences of strategic subtext/trajectory.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: schema,
    }
  });

  const resultText = cleanJsonResponse(response.text || "");
  if (!resultText) throw new Error("Tuning failed.");
  
  try {
    return JSON.parse(resultText);
  } catch (parseError) {
    console.error("[Gemini Service] Tuning JSON Parse Error. Raw Text:", resultText);
    throw parseError;
  }
}