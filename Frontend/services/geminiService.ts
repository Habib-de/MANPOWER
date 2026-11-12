// Frontend/services/geminiService.ts

const PROXY_URL = process.env.EXPO_PUBLIC_GEMINI_PROXY_URL || '';

export interface InvestmentContext {
  totalContributions: number;
  totalInvested: number;
  portfolioValue: number;
  portfolioReturn: number;
  activeInvestments: number;
  riskLevel: string;
  recentTransactions: any[];
  availableBalance: number;
  groupName: string;
}

export interface InvestmentRecommendation {
  type: string;
  suggestion: string;
  reasoning: string;
  riskScore: number;
  expectedReturn: number;
}

const callGemini = async (prompt: string): Promise<string> => {
  if (!PROXY_URL) throw new Error("Missing EXPO_PUBLIC_GEMINI_PROXY_URL in .env");

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Proxy error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const getGeminiModel = () => {
  return { generateContent: (prompt: string) => callGemini(prompt) };
};

export const getInvestmentAdvice = async (
  userQuery: string,
  context: InvestmentContext
): Promise<string> => {
  try {
    const prompt = `
You are an AI Investment Advisor for a Sacco/Group investment platform called MANPOWER.

## User Context:
- Total Contributions: KES ${context.totalContributions.toLocaleString()}
- Total Invested: KES ${context.totalInvested.toLocaleString()}
- Current Portfolio Value: KES ${context.portfolioValue.toLocaleString()}
- Portfolio Return: ${context.portfolioReturn.toFixed(2)}%
- Active Investments: ${context.activeInvestments}
- Current Risk Level: ${context.riskLevel}
- Available Balance: KES ${context.availableBalance.toLocaleString()}
- Group: ${context.groupName}

## User Question:
"${userQuery}"

## Instructions:
Provide clear, actionable investment advice based on the user's context. 
- Be specific about amounts in KES
- Consider their risk profile
- Suggest diversification strategies
- Mention specific investment types
- Keep response concise (max 200 words)
- Use bullet points for clarity
- Include a confidence level (High/Medium/Low)

## Response:
`;
    return await callGemini(prompt);
  } catch (error) {
    console.error('Gemini API Error:', error);
    return 'I apologize, but I am unable to provide investment advice at the moment. Please try again later.';
  }
};

export const getInvestmentRecommendations = async (
  context: InvestmentContext
): Promise<InvestmentRecommendation[]> => {
  try {
    const prompt = `
You are an AI Investment Advisor for a Sacco/Group investment platform.

## User Context:
- Total Contributions: KES ${context.totalContributions.toLocaleString()}
- Total Invested: KES ${context.totalInvested.toLocaleString()}
- Portfolio Value: KES ${context.portfolioValue.toLocaleString()}
- Portfolio Return: ${context.portfolioReturn.toFixed(2)}%
- Active Investments: ${context.activeInvestments}
- Risk Level: ${context.riskLevel}
- Available Balance: KES ${context.availableBalance.toLocaleString()}

## Task:
Generate 3 investment recommendations tailored to this user.

Return ONLY a JSON array with this exact structure:
[
  {
    "type": "STOCKS | BONDS | REAL_ESTATE | MUTUAL_FUNDS | FIXED_DEPOSIT | BUSINESS",
    "suggestion": "Brief suggestion title",
    "reasoning": "Detailed reasoning",
    "riskScore": 1-10,
    "expectedReturn": 5.5
  }
]

## Response (JSON only):
`;
    const text = await callGemini(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  } catch (error) {
    console.error('Gemini API Error:', error);
    return [];
  }
};