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
      STRATEGIC INSIGHT RULES (CRITICAL - This must be specific and actionable):

      Focus on a "Sector-Level Outlook" for ${topic}.
      The 'title' should be: "Sector Strategic Outlook: ${topic}".

      'insight' MUST contain ALL of the following:

      1. EXPOSURE MAPPING (First 1-2 sentences):
         - Identify which specific policy categories from the data create the most exposure
         - Name the categories explicitly (e.g., "Regulatory compliance", "Tax treatment", "Permitting")
         - State whether exposure is growing, stable, or shifting

      2. COMPETITIVE POSITIONING (Next 1-2 sentences):
         - How does the current policy trajectory advantage or disadvantage different players?
         - Who gains leverage? Who faces margin pressure? Who must adapt fastest?
         - Be specific about market position implications

      3. STRATEGIC WINDOW (Final 1-2 sentences):
         - What is the timeline for action? (e.g., "Before Q3 rulemaking", "Ahead of legislative session")
         - What capability or relationship should be built NOW?
         - What's the cost of waiting vs. acting early?

      QUALITY CHECK:
      - Does this read like a McKinsey partner briefing a C-suite, NOT a news summary?
      - Are there specific categories, timelines, and competitive dynamics named?
      - Would a Government Affairs VP forward this to their CEO? If not, rewrite.

      AVOID: Generic statements like "companies should monitor developments" or "policy changes may impact operations"
    `;

    if (prospectName) {
      insightContext = `
      STRATEGIC INSIGHT RULES - PROSPECT PERSONALIZATION (CRITICAL - This must be company-specific and actionable):

      This briefing is for: ${prospectName} (${prospectDomain || 'N/A'}).
      The 'title' MUST be: "Strategic Impact: ${prospectName}".

      'insight' MUST contain ALL of the following, SPECIFIC to ${prospectName}:

      1. DIRECT EXPOSURE (First 1-2 sentences):
         - Which specific policy categories from the data directly affect ${prospectName}'s operations?
         - Name the categories explicitly (e.g., "Regulatory compliance costs", "Permitting delays", "Tax treatment changes")
         - Quantify exposure direction: Is it increasing, decreasing, or shifting?
         - Example: "${prospectName}'s exposure to [category] is intensifying as [X] states advance [type of policy]."

      2. COMPETITIVE IMPACT (Next 1-2 sentences):
         - How does the policy trajectory affect ${prospectName} relative to competitors?
         - Does this create first-mover advantage, compliance burden, or market access risk?
         - Be specific: Who gains? Who loses? Where does ${prospectName} sit?
         - Example: "While [competitor type] faces [burden], ${prospectName}'s [characteristic] positions it to [advantage/disadvantage]."

      3. ACTION WINDOW (Final 1-2 sentences):
         - What specific action should ${prospectName} take and by when?
         - What relationship, capability, or positioning should be built NOW?
         - What's the cost of waiting vs. acting before policy finalizes?
         - Example: "${prospectName} should [specific action] before [deadline/event] to [specific outcome]."

      QUALITY CHECK - Ask yourself before finalizing:
      - Is ${prospectName} named at least twice in the insight?
      - Are there specific policy categories tied to specific business impacts?
      - Is there a clear timeline or trigger event mentioned?
      - Would ${prospectName}'s Head of Government Affairs forward this to their CEO? If not, rewrite.

      STRICT PROHIBITION:
      - Do NOT write generic statements that could apply to any company
      - Do NOT use phrases like "companies in this space", "organizations should monitor", or "stakeholders may be affected"
      - Every sentence must be about ${prospectName} specifically
      `;
    }

    const blufInstructions = `
      BLUF SECTION RULES (CRITICAL - This is decision-support intelligence, not a summary):

      BOTTOM LINE UP FRONT (bluf.intro):
      - Write 1-2 sentences explaining the core strategic shift happening
      - Focus on direction of change, policy momentum, regulatory risk, or economic leverage
      - Must answer: "What's changing and why should leadership care?"
      - Do NOT just describe the topic - explain what's SHIFTING

      PULSE OBSERVATIONS (bluf.bullets):
      - Provide at least 3 bullets describing patterns or trajectories, NOT single bills
      - Each bullet MUST follow this formula: [Policy/Market Shift] → [Likely Consequence] → [Why This Matters]
      - Make them: forward-looking, cross-state when possible, about power/money/regulation/public pressure
      - AVOID: generic "monitor this" language, single-state trivia (unless signaling a bigger wave)
      - A Head of Government Affairs must find each bullet actionable

      STRATEGIC ACTIONS (bluf.actions):
      - Provide exactly 3 numbered actions
      - Each action must be: Specific + Proactive + Tied to a Policy Risk or Opportunity
      - Each must answer: What should the company do? What risk/opportunity does this address? Why act before policy is finalized?
      - AVOID: vague actions like "stay informed", "consider evaluating", or "continue monitoring"
      - Each action should clearly connect to one of the pulse observations

      QUALITY FILTER (Apply before finalizing):
      - Would a Head of Government Affairs find this actionable?
      - Does each bullet describe a trend, not a news event?
      - Does each action clearly connect to a pulse observation?
      - If not, rewrite.
    `;

    const forcingFunctionInstructions = `
      MARKET CATALYST / FORCING FUNCTION RULES:
      This is NOT signals, observations, or actions. This is STRUCTURAL GRAVITY.
      These are large external forces that shape everything else - whether policymakers act intentionally or not.

      Think: Technology shifts, Resource constraints, Demographic changes, Infrastructure limits, Capital flows, Geopolitical competition.
      These forces would exist even if no legislation had yet been introduced.

      MENTAL MODEL: "If policymakers did nothing, what external force would still push this issue onto their agenda?" That's your catalyst.

      - 'what' (MARKET CATALYST): One bold headline sentence describing the core structural shift.
        Format: "What is growing/accelerating/expanding → in what domain"
        Example tone: "Rapid expansion of X is increasing pressure on Y systems."

      - 'forecast' (FORECAST SPECTRUM): Exactly 3 short bullets describing likely second-order effects.
        Each follows: [Structural Force] → [System Response or Constraint]
        These are inevitable reactions from markets, infrastructure, or governments.
        Think: Cost pressure, Resource bottlenecks, Public scrutiny, Regulatory catch-up, Political attention.
        NOT predictions about bills. Keep them short and directional.

      - 'why' (INTELLIGENCE SYNTHESIS): 1-2 sentences explaining why this structural force pulls the company into policy and regulatory conversations.
        Explain: Why the company becomes visible, Why scrutiny or influence grows, Why it becomes part of the debate.
        Not tactical. Not advice. Just strategic positioning.

      DO NOT: Mention specific bills, Recommend actions, List policies, Rehash trends from other sections.
      If no clear structural catalyst exists in the data, omit this section entirely.
    `;

    const signalsInstructions = `
      STRATEGIC SIGNALS RULES:
      Signals are slow-moving structural forces that shape policy behavior across states. This section explains WHY the landscape is changing.

      Generate 3-5 signal clusters. Each signal must have:
      - 'title': Short category label (2-4 words) naming the force (e.g., "Infrastructure Strain", "Budget Pressure", "Regulatory Acceleration")
      - 'activity': One sentence describing the underlying shift or tension
      - 'developments': 2-3 bullets describing patterns, each following: [Policy Pressure / Political Momentum / Economic Force] → [Why It's Growing]

      WHAT COUNTS AS A SIGNAL:
      - Infrastructure strain, budget shortfalls, industry expansion, political pressure, legal precedents, technology adoption curves, public sentiment shifts
      - If a development would still matter even if a specific bill died, it's a signal

      WRITING STYLE:
      Write like a geopolitical or macroeconomic analyst. Focus on systems, incentives, and constraints.
      Use phrases like "growing pressure," "increasing scrutiny," "accelerating competition," "emerging tension"

      AVOID:
      - Mentioning specific companies unless they symbolize a broader trend
      - Recommending actions (that's for Strategic Actions)
      - Summarizing individual articles
      - Single-state signals unless nationally significant
    `;

    const prompt = `
      ${systemPrompt || ''}

      You are a state policy intelligence analyst preparing a decision-support brief for a Fortune 500 government affairs team.
      Generate a professional high-level intelligence briefing for the ${topic} industry.
      Target Audience: State-level government relations leaders and corporate strategy teams.
      Focus Context: ${context || 'General industry monitoring.'}

      ${blufInstructions}

      ${forcingFunctionInstructions}

      ${signalsInstructions}

      ${insightContext}

      REGIONAL DATA RULES:
      - 'state': Full state name in uppercase (e.g., "PENNSYLVANIA").
      - 'status': A short 2-3 word strategic status label (e.g., "ACTIVE LEGISLATION", "REGULATORY REVIEW", "MONITORING"). Do NOT put long headlines or sentences here.
      - 'impact': The core analysis of what is happening in that state and what it means for the future. Use citations [n].

      WATCH LIST RULES:
      - The watchList should contain a MIX of: emerging policy topics, specific bill numbers, key stakeholders/companies, regulatory bodies, and states with high activity.
      - Each item MUST include brief context (5-10 words) explaining WHY it's on the watch list.
      - Format: "[Entity/Topic] - [Why it matters]"
      - Example items: "Gov. Shapiro - Pushing voucher expansion", "HB 1234 - Could set national precedent", "TX Testing Reform - Compliance deadline Q2", "NEA - Mobilizing against budget cuts"
      - Do NOT use bare names without context.

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