import { DockerExecutionService } from "./docker-execution-service.js";

export class CppExecutionService extends DockerExecutionService {
  constructor() {
    super({
      id: "cpp-runner",
      label: "C++ compiler/runner",
      runtime: "cpp",
      supportedExtensions: [".cpp"],
      image: "gcc:13-bookworm",
      entryFileName: "main.cpp",
      command: [
        "sh",
        "-lc",
        "cp /workspace/main.cpp /tmp/main.cpp && g++ -std=c++17 -O2 /tmp/main.cpp -o /tmp/app && /tmp/app",
      ],
    });
  }
}
