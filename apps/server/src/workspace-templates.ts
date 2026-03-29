import type { WorkspaceTemplateKind } from "./types.js";

type WorkspaceTemplateFile = {
  path: string;
  content: string;
};

type WorkspaceTemplateDefinition = {
  label: string;
  files: WorkspaceTemplateFile[];
};

const TEMPLATE_DEFINITIONS: Record<WorkspaceTemplateKind, WorkspaceTemplateDefinition> = {
  "python-starter": {
    label: "Python starter",
    files: [
      {
        path: "main.py",
        content: [
          "def main() -> None:",
          '    print("Hello from iTECify Python starter")',
          "",
          "",
          'if __name__ == "__main__":',
          "    main()",
        ].join("\n"),
      },
      {
        path: "README.md",
        content: [
          "# Python Starter",
          "",
          "Run:",
          "",
          "```bash",
          "python main.py",
          "```",
        ].join("\n"),
      },
    ],
  },
  "cpp-starter": {
    label: "C++ starter",
    files: [
      {
        path: "main.cpp",
        content: [
          "#include <iostream>",
          "",
          "int main() {",
          '  std::cout << "Hello from iTECify C++ starter" << std::endl;',
          "  return 0;",
          "}",
        ].join("\n"),
      },
      {
        path: "README.md",
        content: [
          "# C++ Starter",
          "",
          "This workspace starts with a single `main.cpp` file ready to compile and run.",
        ].join("\n"),
      },
    ],
  },
  "html-css-starter": {
    label: "HTML/CSS starter",
    files: [
      {
        path: "index.html",
        content: [
          "<!doctype html>",
          '<html lang="en">',
          "  <head>",
          '    <meta charset="UTF-8" />',
          '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
          "    <title>iTECify Starter</title>",
          '    <link rel="stylesheet" href="style.css" />',
          "  </head>",
          "  <body>",
          '    <main class="page">',
          "      <section class=\"card\">",
          "        <p class=\"eyebrow\">iTECify</p>",
          "        <h1>Browser IDE starter</h1>",
          "        <p>Edit the files and watch live preview update instantly.</p>",
          '        <button id="cta">Open the session</button>',
          "      </section>",
          "    </main>",
          '    <script src="script.js"></script>',
          "  </body>",
          "</html>",
        ].join("\n"),
      },
      {
        path: "style.css",
        content: [
          ":root {",
          "  color-scheme: dark;",
          "  --bg: #0f1117;",
          "  --panel: #181b23;",
          "  --text: #edf2ff;",
          "  --muted: #94a3b8;",
          "  --accent: #7c9dff;",
          "}",
          "",
          "* { box-sizing: border-box; }",
          "body {",
          "  margin: 0;",
          "  min-height: 100vh;",
          "  display: grid;",
          "  place-items: center;",
          "  background: radial-gradient(circle at top, #1c2230, var(--bg));",
          "  color: var(--text);",
          "  font-family: Inter, system-ui, sans-serif;",
          "}",
          ".page { padding: 32px; }",
          ".card {",
          "  max-width: 560px;",
          "  padding: 32px;",
          "  border: 1px solid rgba(255,255,255,0.08);",
          "  background: rgba(24, 27, 35, 0.92);",
          "  box-shadow: 0 20px 50px rgba(0,0,0,0.35);",
          "}",
          ".eyebrow {",
          "  margin: 0 0 12px;",
          "  color: var(--accent);",
          "  text-transform: uppercase;",
          "  letter-spacing: 0.12em;",
          "  font-size: 12px;",
          "}",
          "#cta {",
          "  margin-top: 16px;",
          "  border: none;",
          "  padding: 12px 16px;",
          "  background: var(--accent);",
          "  color: #101421;",
          "  font-weight: 700;",
          "  cursor: pointer;",
          "}",
        ].join("\n"),
      },
      {
        path: "script.js",
        content: [
          'const button = document.getElementById("cta");',
          "",
          "if (button) {",
          '  button.addEventListener("click", () => {',
          '    button.textContent = "Session ready";',
          "  });",
          "}",
        ].join("\n"),
      },
    ],
  },
  "readme-starter": {
    label: "README starter",
    files: [
      {
        path: "README.md",
        content: [
          "# Project Title",
          "",
          "## Overview",
          "",
          "Short project description.",
          "",
          "## Getting Started",
          "",
          "1. Install dependencies",
          "2. Run the project",
          "",
          "## Files",
          "",
          "- `src/` main application code",
          "- `README.md` project notes",
        ].join("\n"),
      },
    ],
  },
  "json-config-starter": {
    label: "JSON config starter",
    files: [
      {
        path: "config.json",
        content: JSON.stringify(
          {
            appName: "itecify-demo",
            environment: "development",
            featureFlags: {
              livePreview: true,
              sharedTerminal: true,
            },
          },
          null,
          2,
        ),
      },
    ],
  },
};

export function getWorkspaceTemplate(kind: WorkspaceTemplateKind) {
  return TEMPLATE_DEFINITIONS[kind];
}
