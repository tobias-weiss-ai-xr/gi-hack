import { useMutation } from "@tanstack/react-query";
import { apiPost } from "./api";

export function useAskAI() {
  return useMutation({
    mutationFn: async (params: { prompt: string; useGraphContext?: boolean }) => {
      const res = await apiPost<{ answer: string }>("/api/ai/ask", params);
      if (!res.ok) throw new Error(res.error.message);
      return res.data;
    },
  });
}
