import { socketUrl } from "./env";

const SESSION_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export type SessionLookupResponse = {
  roomId: string;
  participantCount: number;
  activeFileId: string;
  openTabCount: number;
  previewVisible: boolean;
  theme: string;
};

export type SessionCreateResponse = {
  roomId: string;
  createdRoom: boolean;
  participantCount: number;
  createdAt: string;
};

export type SessionImportResponse = {
  roomId: string;
  importedFileCount: number;
  importedFolderCount: number;
  skippedCount: number;
  openedFilePath: string | null;
};

function sessionApiUrl(path: string) {
  return `${socketUrl.replace(/\/$/, "")}${path}`;
}

async function parseResponse<T>(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; ok?: boolean })
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error ?? "The session service returned an unexpected response.",
    );
  }

  if (!payload) {
    throw new Error("The session service returned an empty response.");
  }

  return payload as T;
}

export function normalizeSessionCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function isValidSessionCode(value: string) {
  return SESSION_CODE_PATTERN.test(normalizeSessionCode(value));
}

export function buildDevSessionUrl(sessionCode: string) {
  return `/dev/${encodeURIComponent(normalizeSessionCode(sessionCode))}`;
}

export function buildSessionInviteUrl(sessionCode: string, origin?: string) {
  const sessionPath = buildDevSessionUrl(sessionCode);
  const normalizedOrigin =
    origin?.trim().replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");

  return normalizedOrigin ? `${normalizedOrigin}${sessionPath}` : sessionPath;
}

export function formatSessionCodeForDisplay(sessionCode: string) {
  return normalizeSessionCode(sessionCode);
}

export async function createSession() {
  const response = await fetch(sessionApiUrl("/sessions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return parseResponse<SessionCreateResponse>(response);
}

export async function lookupSession(sessionCode: string) {
  const normalizedSessionCode = normalizeSessionCode(sessionCode);

  if (!isValidSessionCode(normalizedSessionCode)) {
    throw new Error("Session codes use 6 uppercase letters or numbers.");
  }

  const response = await fetch(
    sessionApiUrl(`/sessions/${encodeURIComponent(normalizedSessionCode)}`),
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  return parseResponse<SessionLookupResponse>(response);
}

export async function uploadSessionProjectZip(
  sessionCode: string,
  file: File,
  onProgress?: (progress: number) => void,
) {
  const normalizedSessionCode = normalizeSessionCode(sessionCode);

  if (!isValidSessionCode(normalizedSessionCode)) {
    throw new Error("Session codes use 6 uppercase letters or numbers.");
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("Upload a .zip archive to import a project.");
  }

  const formData = new FormData();
  formData.append("archive", file);

  return new Promise<SessionImportResponse>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(
      "POST",
      sessionApiUrl(`/sessions/${encodeURIComponent(normalizedSessionCode)}/import`),
    );
    request.responseType = "json";

    request.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) {
        return;
      }

      onProgress(Math.max(0, Math.min(100, Math.round((event.loaded / event.total) * 100))));
    };

    request.onload = () => {
      const payload =
        request.response && typeof request.response === "object"
          ? request.response
          : (() => {
              try {
                return JSON.parse(request.responseText) as
                  | (SessionImportResponse & { error?: string; ok?: boolean })
                  | null;
              } catch {
                return null;
              }
            })();

      if (request.status >= 200 && request.status < 300 && payload) {
        resolve(payload as SessionImportResponse);
        return;
      }

      reject(
        new Error(
          payload?.error ?? "The project import service returned an unexpected response.",
        ),
      );
    };

    request.onerror = () => {
      reject(new Error("Unable to upload the ZIP archive right now."));
    };

    request.onabort = () => {
      reject(new Error("The ZIP upload was cancelled."));
    };

    request.send(formData);
  });
}
