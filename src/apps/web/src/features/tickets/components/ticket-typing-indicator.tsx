import { Bot } from "@/components/icons";

export const TicketTypingIndicator = () => (
  <div className="flex items-center gap-2">
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
      <Bot className="size-3 text-muted-foreground" />
    </div>
    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted-foreground opacity-60 animate-bounce-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  </div>
);
