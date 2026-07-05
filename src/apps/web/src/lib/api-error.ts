import axios from "axios";
import { ZodError } from "zod";

export const formatApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    if (error.code === "ERR_NETWORK" || !error.response) {
      return "Network error — could not reach the API. Check that agentd is running and API_BASE_URL is correct.";
    }

    const body = error.response.data;
    if (body && typeof body === "object" && "error" in body) {
      const message = (body as { error?: unknown }).error;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }

    const status = error.response.status;
    const statusText = error.response.statusText?.trim();
    if (statusText) {
      return `Request failed (${status} ${statusText})`;
    }
    return `Request failed (${status})`;
  }

  if (error instanceof ZodError) {
    return "Unexpected API response format";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong";
};
