import { cn } from "@/lib/utils";
import { avatarTone, issueInitials } from "../lib/ticket-row.utils";

type TicketAvatarProps = {
  issueKey: string;
  size?: "sm" | "md";
  className?: string;
};

const sizeClass = {
  sm: "size-6 text-xs",
  md: "size-7 text-xs",
} as const;

export const TicketAvatar = ({
  issueKey,
  size = "md",
  className,
}: TicketAvatarProps) => (
  <div
    className={cn(
      "flex shrink-0 items-center justify-center rounded-full font-semibold",
      sizeClass[size],
      avatarTone(issueKey),
      className,
    )}
  >
    {issueInitials(issueKey)}
  </div>
);
