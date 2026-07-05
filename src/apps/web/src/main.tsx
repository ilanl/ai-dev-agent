import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TicketsPage } from "@/features/tickets/tickets-page";
import { createQueryClient } from "@/lib/query-client";
import "@/styles/globals.css";

const queryClient = createQueryClient();

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TicketsPage />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
);
