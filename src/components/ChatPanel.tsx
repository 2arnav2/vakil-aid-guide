import { useRef, useEffect, type ReactNode } from "react";
import { Bot, UserRound } from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  messages: Message[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDesc?: string;
}

/** Tiny inline formatter for the **bold** markers used by the engine. */
const renderInline = (text: string): ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });

const MessageBody = ({ content }: { content: string }) => (
  <div className="space-y-1.5">
    {content.split("\n").map((line, index) =>
      line.trim() ? (
        <p key={index}>{renderInline(line)}</p>
      ) : (
        <span key={index} className="block h-1.5" />
      ),
    )}
  </div>
);

const TypingIndicator = () => (
  <div className="flex items-start gap-2.5 animate-fade-in max-w-3xl mx-auto w-full">
    <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_14px_hsl(var(--primary)/0.18)]">
      <Bot className="w-3.5 h-3.5 text-primary" />
    </div>
    <div className="rounded-2xl rounded-tl-sm border border-border/60 bg-card/70 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  </div>
);

export const ChatPanel = ({
  messages,
  isLoading,
  emptyTitle = "Describe your legal situation",
  emptyDesc = "Type or speak your issue and Margavidi will identify applicable laws and guide you.",
}: ChatPanelProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-custom space-y-4 px-4 py-4">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-12 animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.14)]">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <p className="font-sans text-foreground/85 text-base font-medium">{emptyTitle}</p>
          <p className="font-sans text-muted-foreground text-xs max-w-xs leading-relaxed">{emptyDesc}</p>
        </div>
      )}

      {messages.map((msg, idx) => (
        <div
          key={msg.id}
          className={`flex gap-2.5 animate-fade-in max-w-3xl mx-auto w-full ${
            msg.role === "user" ? "flex-row-reverse" : "flex-row"
          }`}
          style={{ animationDelay: `${idx * 0.04}s` }}
        >
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              msg.role === "user"
                ? "bg-bubble/20 border border-bubble/40 text-blue-200"
                : "bg-primary/10 border border-primary/30 text-primary shadow-[0_0_14px_hsl(var(--primary)/0.16)]"
            }`}
          >
            {msg.role === "user" ? <UserRound className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
          </div>

          <div
            className={`max-w-[86%] font-sans text-[12.5px] leading-relaxed ${
              msg.role === "user"
                ? "user-bubble px-3.5 py-2.5 rounded-2xl rounded-tr-sm"
                : "text-foreground/90 pt-0.5"
            }`}
          >
            <MessageBody content={msg.content} />
            <div
              className={`text-[9px] mt-1.5 ${
                msg.role === "user" ? "text-blue-100/60 text-right" : "text-muted-foreground/55 text-left"
              }`}
            >
              {msg.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      ))}

      {isLoading && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatPanel;
