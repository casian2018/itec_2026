import { DockerExecutionService } from "./docker-execution-service.js";

export class CExecutionService extends DockerExecutionService {
  constructor() {
    super({
      id: "c-runner",
      label: "C compiler/runner",
      runtime: "c",
      supportedExtensions: [".c"],
      image: "gcc:13-bookworm",
      entryFileName: "main.c",
      command: [
        "sh",
        "-lc",
        "cp /workspace/main.c /tmp/main.c && gcc -std=c11 -O2 /tmp/main.c -o /tmp/app && /tmp/app",
      ],
    });
  }
}
