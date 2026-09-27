// Frontend/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

// ⚠️ REPLACE THIS WITH YOUR NEW API KEY (NEVER SHARE IT PUBLICLY!)
// Get your API key from https://makersuite.google.com/app/apikey
const API_KEY = 'AQ.Ab8RN6L8Umueq6dKBG92fMMLLFzOFUqKvo_oVsdPjO5eRs2dGg';
const genAI = new GoogleGenerativeAI(API_KEY);

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

// ✅ ADD THIS FUNCTION - It allows other files to use the Gemini model
export const getGeminiModel = () => {
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
};

export const getInvestmentAdvice = async (
  userQuery: string,
  context: InvestmentContext
): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
- Mention specific investment types (Stocks, Bonds, Real Estate, Mutual Funds, Fixed Deposit)
- Keep response concise (max 200 words)
- Use bullet points for clarity
- Include a confidence level (High/Medium/Low)

## Response:
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API Error:', error);
    return 'I apologize, but I am unable to provide investment advice at the moment. Please try again later.';
  }
};

export const getInvestmentRecommendations = async (
  context: InvestmentContext
): Promise<InvestmentRecommendation[]> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (parseError) {
      console.error('Failed to parse recommendations:', parseError);
      return [];
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    return [];
  }
};