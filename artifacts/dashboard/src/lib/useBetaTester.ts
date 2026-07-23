/**
 * Beta Testers utilities for the React dashboard
 *
 * Hook to check beta tester status and access features
 */
import { useQuery } from "@tanstack/react-query";

export interface BetaTesterStatus {
  userId: string;
  isBetaTester: boolean;
  features: {
    canAccessBetaPanel: boolean;
    canAccessBetaFeatures: boolean;
    canUseBetaCommands: boolean;
    betaFeaturesEnabled: string[];
  };
}

/**
 * Hook to fetch current user's beta tester status
 */
export function useBetaTesterStatus() {
  return useQuery<BetaTesterStatus>({
    queryKey: ["beta", "status"],
    queryFn: async () => {
      const res = await fetch("/api/beta/status");
      if (!res.ok) {
        throw new Error("Failed to fetch beta tester status");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch available beta features
 */
export function useBetaFeatures() {
  return useQuery({
    queryKey: ["beta", "features"],
    queryFn: async () => {
      const res = await fetch("/api/beta/features");
      if (!res.ok) {
        throw new Error("Failed to fetch beta features");
      }
      return res.json();
    },
    enabled: true, // Always fetch
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Hook to access beta tester panel
 */
export function useBetaPanel() {
  return useQuery({
    queryKey: ["beta", "panel"],
    queryFn: async () => {
      const res = await fetch("/api/beta/panel");
      if (!res.ok) {
        throw new Error("Failed to fetch beta panel");
      }
      return res.json();
    },
    enabled: true,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Send feedback to the beta testing program
 */
export async function submitBetaFeedback(
  title: string,
  description: string,
  type: "bug" | "feature" | "suggestion" | "general" = "general",
) {
  const res = await fetch("/api/beta/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, type }),
  });

  if (!res.ok) {
    throw new Error("Failed to submit feedback");
  }

  return res.json();
}

/**
 * Component helper: Check if user has access to beta feature
 */
export function hasBetaAccess(status: BetaTesterStatus | undefined): boolean {
  return status?.isBetaTester ?? false;
}

/**
 * Component helper: Check if specific feature is enabled
 */
export function isBetaFeatureEnabled(
  status: BetaTesterStatus | undefined,
  feature: string,
): boolean {
  return (
    status?.features?.betaFeaturesEnabled?.includes(feature) ?? false
  );
}

/**
 * Component helper: Guard rendering for beta features
 */
export function BetaFeatureGuard({
  children,
  fallback = null,
  status,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  status: BetaTesterStatus | undefined;
}) {
  if (!hasBetaAccess(status)) {
    return fallback;
  }

  return <>{children}</>;
}

/**
 * Component helper: Show loading state for beta features
 */
export function BetaFeatureLoader({
  isLoading,
  children,
}: {
  isLoading: boolean;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin mb-2">⚙️</div>
          <p className="text-sm text-gray-500">Cargando feature beta...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
