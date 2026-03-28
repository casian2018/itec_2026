import { extname } from "node:path";
import type { WorkspaceFileNode } from "../types.js";

export function detectFileExtension(file: Pick<WorkspaceFileNode, "name" | "path">) {
  const extension = extname(file.path || file.name).trim().toLowerCase();
  return extension || null;
}
