import { Suspense } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { DevWorkspaceEntry } from "@/components/dev-workspace-entry";

export default async function DevSessionPage({
  params,
}: {
  params: Promise<{ sessionCode: string }>;
}) {
  const { sessionCode } = await params;

  return (
    <div className="h-[100dvh] overflow-hidden">
      <Suspense fallback={null}>
        <ProtectedRoute>
          <DevWorkspaceEntry sessionCode={sessionCode} />
        </ProtectedRoute>
      </Suspense>
    </div>
  );
}
