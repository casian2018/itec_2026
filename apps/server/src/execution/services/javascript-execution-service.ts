import { DockerExecutionService } from "./docker-execution-service.js";

export class JavaScriptExecutionService extends DockerExecutionService {
  constructor() {
    super({
      id: "javascript-runner",
      label: "JavaScript runner",
      runtime: "javascript",
      supportedExtensions: [".js"],
      image: "node:20-alpine",
      entryFileName: "index.js",
      command: ["node", "index.js"],
    });
  }
}
