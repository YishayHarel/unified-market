import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Rate limiting storage
interface RateLimit {
  count: number;
  resetTime: number;
}

const rateLimits = new Map<string, RateLimit>();

/**
 * Simple in-memory rate limiter
 */
function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 1000 // 1 minute
): { allowed: boolean; resetTime: number; remaining: number } {
  const now = Date.now();
  const limit = rateLimits.get(identifier);

  if (!limit || now > limit.resetTime) {
    // Create new rate limit window
    rateLimits.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return {
      allowed: true,
      resetTime: now + windowMs,
      remaining: maxRequests - 1
    };
  }

  if (limit.count >= maxRequests) {
    return {
      allowed: false,
      resetTime: limit.resetTime,
      remaining: 0
    };
  }

  // Increment count
  limit.count++;
  rateLimits.set(identifier, limit);

  return {
    allowed: true,
    resetTime: limit.resetTime,
    remaining: maxRequests - limit.count
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('AI Stock Advisor function started');
    
    // Initialize Supabase client for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("User not authenticated");
    }

    console.log('User authenticated:', userData.user.email);

    console.log('User authenticated, proceeding with free AI access');

    // Rate limiting: 10 requests per minute per user
    const rateLimit = checkRateLimit(`ai_advisor_${userData.user.id}`, 10, 60 * 1000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later.",
          resetTime: rateLimit.resetTime 
        }), 
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Rate limit check passed. Remaining requests: ${rateLimit.remaining}`);

    // Get the user's message
    const { message } = await req.json();
    if (!message) {
      throw new Error("Message is required");
    }

    console.log('Processing message:', message);

    // Get Google Gemini API key
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Google Gemini API key not configured');
    }

    // Call Google Gemini API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are YishAI, an expert stock market advisor AI created specifically for detailed financial analysis. Provide comprehensive, accurate, and actionable stock market advice with deep insights. Focus on:

                DETAILED ANALYSIS:
                - Technical analysis with specific indicators (RSI, MACD, Moving Averages, etc.)
                - Fundamental analysis including P/E ratios, revenue growth, debt levels
                - Market trends and sector analysis with specific data points
                - Risk assessment with quantified metrics when possible
                - Portfolio recommendations with allocation percentages
                - Earnings analysis and forward-looking projections
                - Competitor comparisons and market positioning
                - Economic factors and their impact on specific stocks/sectors

                RESPONSE FORMAT:
                - Start with a clear executive summary
                - Use bullet points for key insights
                - Include specific numbers, percentages, and timeframes
                - Provide both bullish and bearish perspectives
                - End with clear action items or recommendations

                CURRENT MARKET CONTEXT:
                Consider recent market volatility, interest rate environment, inflation trends, and sector rotations in your analysis.

                Always include appropriate disclaimers about investment risks and remind users that this is for educational purposes only.

                User Question: ${message}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 2000,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Google Gemini API error:', errorData);
      
      // Handle specific Gemini API errors with user-friendly messages
      if (response.status === 429) {
        throw new Error("The AI service is experiencing high demand. Please try again in a few moments.");
      } else if (response.status === 401) {
        throw new Error("AI service authentication error. Please check your API key.");
      } else if (response.status === 403) {
        throw new Error("AI service access denied. Please check your API key permissions.");
      } else if (response.status >= 500) {
        throw new Error("The AI service is temporarily down. Please try again later.");
      } else {
        throw new Error(`AI service error (${response.status}). Please try again later.`);
      }
    }

    const data = await response.json();
    console.log('Gemini API response:', JSON.stringify(data));
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response from AI service");
    }
    
    const aiResponse = data.candidates[0].content.parts[0].text;

    console.log('AI response generated successfully');

    return new Response(
      JSON.stringify({ response: aiResponse }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in AI Stock Advisor function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});