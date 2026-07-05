import { toast } from "sonner";
import { formatApiError } from "./api-error";

export const toastApiError = (error: unknown): void => {
  toast.error(formatApiError(error));
};
