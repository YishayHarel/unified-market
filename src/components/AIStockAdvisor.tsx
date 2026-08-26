import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, User, Loader2 } from "lucide-react";
import { useAIFunction } from "@/hooks/useAIFunction";
import AIStateNotice from "@/components/ai/AIStateNotice";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AdvisorResponse {
  response?: string;
  message?: string;
}

/** Openers that demonstrate what the advisor can see about the reader. */
const SUGGESTIONS = [
  "How is my portfolio doing?",
  "What's my biggest concentration risk?",
  "Any news on my holdings today?",
];

const AIStockAdvisor = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const { invoke, loading, error } = useAIFunction<AdvisorResponse>("ai-stock-advisor");
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;

    // Send the history as it was before this turn — the backend appends the new
    // question itself, so including it here would duplicate it.
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");

    const result = await invoke({ message: question, conversationHistory: history });
    const reply = result?.response ?? result?.message;
    if (reply) {
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    }
  }

  // A failure before the first exchange replaces the panel; later on it appears
  // beneath the conversation so the history is not thrown away.
  const showNoticeOnly = error && messages.length === 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          YishAI Stock Advisor
        </CardTitle>
        <CardDescription>
          Answers from your own holdings, cost basis and today's headlines
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {showNoticeOnly ? (
          <AIStateNotice error={error} />
        ) : (
          <>
            <div className="space-y-4 max-h-[26rem] overflow-y-auto pr-1">
              {messages.length === 0 && !loading && (
                <div className="text-center py-8 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Ask about your positions, risk, or what moved today.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
                >
                  {message.role === "assistant" && (
                    <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 text-sm max-w-[80%] whitespace-pre-wrap ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.role === "user" && (
                    <div className="shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="rounded-lg px-3 py-2 bg-muted flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Reading your portfolio…
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {error && <AIStateNotice error={error} />}

            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your portfolio…"
                disabled={loading}
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AIStockAdvisor;
