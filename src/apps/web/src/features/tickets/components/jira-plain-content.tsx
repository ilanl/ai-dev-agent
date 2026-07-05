import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { parseJiraPlain, splitUrls } from "../lib/jira-plain.utils";

type JiraPlainContentProps = {
  content: string;
  className?: string;
};

const InlineValue = ({ value }: { value: string }) => {
  const parts = splitUrls(value);
  if (parts.length === 1 && parts[0]?.type === "text") {
    return <>{value}</>;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.type === "url" ? (
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noreferrer"
            className="break-all text-primary underline-offset-2 hover:underline"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </>
  );
};

export const JiraPlainContent = ({
  content,
  className,
}: JiraPlainContentProps) => {
  const blocks = useMemo(() => parseJiraPlain(content), [content]);

  if (!blocks.length) return null;

  return (
    <ul
      className={cn(
        "list-disc space-y-2 break-words pl-4 text-xs leading-relaxed marker:text-muted-foreground",
        className,
      )}
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <li
              key={index}
              className="list-none -ml-4 pt-1 text-sm font-semibold text-foreground first:pt-0"
            >
              {block.value}
            </li>
          );
        }

        if (block.type === "field") {
          return (
            <li key={index}>
              <span className="font-semibold text-foreground">
                {block.label}:
              </span>{" "}
              <span className="text-foreground/90">
                <InlineValue value={block.value} />
              </span>
            </li>
          );
        }

        return (
          <li key={index} className="text-foreground/90">
            <InlineValue value={block.value} />
          </li>
        );
      })}
    </ul>
  );
};
