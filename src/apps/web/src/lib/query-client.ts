import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toastApiError } from "@/lib/toast-api-error";

export const createQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.state.data !== undefined) return;
        toastApiError(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 2000,
        retry: 1,
      },
      mutations: {
        onError: (error) => {
          toastApiError(error);
        },
      },
    },
  });
