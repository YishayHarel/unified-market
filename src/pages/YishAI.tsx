import AIStockAdvisor from "@/components/AIStockAdvisor";
import MorningBrief from "@/components/ai/MorningBrief";
import { Bot } from "lucide-react";

/**
 * The AI home. The morning brief sits above the chat because it is the thing
 * worth reading before the open without asking anything, and the advisor
 * answers whatever it prompts.
 */
const YishAI = () => {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">YishAI</h1>
          <p className="text-muted-foreground mt-2">
            Analysis of your own portfolio, grounded in your holdings and today's data
          </p>
        </header>

        <MorningBrief />
        <AIStockAdvisor />
      </div>
    </div>
  );
};

export default YishAI;
