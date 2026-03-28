import { ProtectedRoute } from "@/components/protected-route";
import { DevWorkspaceEntry } from "@/components/dev-workspace-entry";

export default function DevPage() {
  return (
    <ProtectedRoute>
      <DevWorkspaceEntry />
    </ProtectedRoute>
  );
}
