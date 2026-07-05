import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export type ApprovalResult = "approved" | "rejected";

export async function promptApproval(options: {
  title: string;
  body: string;
  prompt?: string;
}): Promise<ApprovalResult> {
  console.log(`\n=== ${options.title} ===\n`);
  console.log(options.body);

  const rl = createInterface({ input, output });
  const answer = await rl.question(
    options.prompt ?? "\nApprove? [y/N]: "
  );
  rl.close();

  const normalized = answer.trim().toLowerCase();
  return normalized === "y" || normalized === "yes" ? "approved" : "rejected";
}

export async function promptAnswer(question: string): Promise<string> {
  console.log(`\n=== QUESTION ===\n`);
  console.log(question);

  const rl = createInterface({ input, output });
  const answer = await rl.question("\nYour answer: ");
  rl.close();

  return answer.trim();
}
