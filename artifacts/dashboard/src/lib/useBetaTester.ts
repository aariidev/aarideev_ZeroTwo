/**
 * Hooks y helpers del programa beta (dashboard).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export type BetaFeatureItem = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  locked?: boolean;
};

export type BetaTesterStatus = {
  userId: string;
  isBetaTester: boolean;
  isOwner: boolean;
  version: string;
  testerCount: number;
  features: {
    canAccessBetaPanel: boolean;
    canAccessBetaFeatures: boolean;
    canUseBetaCommands: boolean;
    betaFeaturesEnabled: string[];
  };
  featureList: BetaFeatureItem[];
};

export type BetaFeaturesResponse = {
  isBetaTester: boolean;
  count: number;
  features: BetaFeatureItem[];
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error || res.statusText), {
      status: res.status,
      code: body.code,
    });
  }
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw Object.assign(new Error(data.error || res.statusText), {
      status: res.status,
      code: data.code,
    });
  }
  return res.json() as Promise<T>;
}

export function useBetaTesterStatus() {
  return useQuery<BetaTesterStatus>({
    queryKey: ["beta", "status"],
    queryFn: () => apiGet<BetaTesterStatus>("/api/beta/status"),
    staleTime: 60_000,
    retry: 1,
  });
}

export function useBetaFeatures() {
  return useQuery<BetaFeaturesResponse>({
    queryKey: ["beta", "features"],
    queryFn: () => apiGet<BetaFeaturesResponse>("/api/beta/features"),
    staleTime: 120_000,
    retry: 1,
  });
}

export function useBetaManageList(enabled: boolean) {
  return useQuery<{ betatesters: string[]; count: number }>({
    queryKey: ["beta", "manage", "list"],
    queryFn: async () => {
      const data = await apiPost<{
        betatesters: string[];
        count: number;
      }>("/api/beta/manage", { action: "list" });
      return { betatesters: data.betatesters, count: data.count };
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useBetaFeedbackList(enabled: boolean) {
  return useQuery<{
    items: Array<{
      id: string;
      userId: string;
      username?: string;
      title: string;
      description: string;
      type: string;
      submittedAt: string;
    }>;
    count: number;
  }>({
    queryKey: ["beta", "feedback", "list"],
    queryFn: () => apiGet("/api/beta/feedback"),
    enabled,
    staleTime: 20_000,
  });
}

export async function submitBetaFeedback(
  title: string,
  description: string,
  type: "bug" | "feature" | "suggestion" | "general" = "general",
) {
  return apiPost("/api/beta/feedback", { title, description, type });
}

export async function manageBetaTester(
  action: "add" | "remove",
  targetUserId: string,
) {
  return apiPost<{
    success: boolean;
    betatesters: string[];
    already?: boolean;
    wasPresent?: boolean;
    onlyEnv?: boolean;
  }>("/api/beta/manage", { action, targetUserId });
}

export function useInvalidateBeta() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["beta"] });
  };
}
