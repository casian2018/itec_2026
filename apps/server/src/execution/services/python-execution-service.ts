import { DockerExecutionService } from "./docker-execution-service.js";

export class PythonExecutionService extends DockerExecutionService {
  constructor() {
    super({
      id: "python-runner",
      label: "Python runner",
      runtime: "python",
      supportedExtensions: [".py"],
      image: "python:3.11-alpine",
      entryFileName: "main.py",
      command: ["python", "main.py"],
    });
  }
}
