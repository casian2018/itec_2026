"use client";

import { useState } from "react";
import { SharedChatPanel } from "./shared-chat-panel";
import { ItecifySidebarPresence } from "./itecify-workspace-chrome";
import { SessionActivityPanel } from "./session-activity-panel";
import { AiSuggestionsPanel } from "./ai-suggestions-panel";
import { SpotifyPlayer } from "./spotify-player";
import { FocusTimer } from "./focus-timer";
import {
  type AiBlock,
  type ChatMessage,
  type Participant,
  type RemoteCursor,
  type SessionActivityEvent,
} from "@/lib/socket";

type CollaborationSidebarProps = {
  messages: ChatMessage[];
  privateMessages: ChatMessage[];
  aiBlocks: AiBlock[];
  activity: SessionActivityEvent[];
  participants: Participant[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  onSendPrivateMessage: (content: string) => void;
  onAcceptAiBlock: (blockId: string) => void;
  onRejectAiBlock: (blockId: string) => void;
  aiBlockLoading: boolean;
  aiBlockErrorMessage: string | null;
  canSend: boolean;
  currentUserName: string;
  currentUserSocketId: string | null;
  workspaceFiles: { id: string; name: string }[];
  remoteCursors: RemoteCursor[];
};

type Tab = "shared-chat" | "private-ai" | "session-ai" | "participants" | "activity";

export function CollaborationSidebar({
  messages,
  privateMessages,
  aiBlocks,
  aiBlockLoading,
  aiBlockErrorMessage,
  activity,
  participants,
  currentUserId,
  onSendMessage,
  onSendPrivateMessage,
  onAcceptAiBlock,
  onRejectAiBlock,
  canSend,
  currentUserName,
  currentUserSocketId,
  workspaceFiles,
  remoteCursors,
}: CollaborationSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("shared-chat");

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
      <div className="flex-shrink-0 border-b border-[var(--line)]">
        <div className="flex h-[34px] overflow-x-auto">
          <TabButton label="Chat" isActive={activeTab === "shared-chat"} onClick={() => setActiveTab("shared-chat")} />
          <TabButton label="Private AI" isActive={activeTab === "private-ai"} onClick={() => setActiveTab("private-ai")} />
          <TabButton label="Session AI" isActive={activeTab === "session-ai"} onClick={() => setActiveTab("session-ai")} />
          <TabButton label={`Participants (${participants.length})`} isActive={activeTab === "participants"} onClick={() => setActiveTab("participants")} />
          <TabButton label="Activity" isActive={activeTab === "activity"} onClick={() => setActiveTab("activity")} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "shared-chat" && (
          <SharedChatPanel
            messages={messages}
            canSend={canSend}
            currentUserId={currentUserId}
            onSend={onSendMessage}
          />
        )}

        {activeTab === "private-ai" && (
          <div className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
            <div className="border-b border-[var(--line)] px-3 py-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--text-primary)]">
                Private AI Chat
              </h2>
              <p className="mt-2 text-[12px] leading-5 text-[var(--text-muted)]">
                Private thread with the assistant. Only your messages and private responses appear here.
              </p>
            </div>
            <SharedChatPanel
              messages={privateMessages}
              canSend={canSend}
              currentUserId={currentUserId}
              onSend={onSendPrivateMessage}
            />
          </div>
        )}

        {activeTab === "session-ai" && (
          <AiSuggestionsPanel
            blocks={aiBlocks}
            isLoading={aiBlockLoading}
            errorMessage={aiBlockErrorMessage}
            onAccept={onAcceptAiBlock}
            onReject={onRejectAiBlock}
          />
        )}

        {activeTab === "participants" && (
          <ItecifySidebarPresence
            participants={participants}
            currentUserName={currentUserName}
            currentUserSocketId={currentUserSocketId}
            workspaceFiles={workspaceFiles}
            remoteCursors={remoteCursors}
          />
        )}

        {activeTab === "activity" && <SessionActivityPanel entries={activity} />}
      </div>
      <div className="flex-shrink-0 border-t border-[var(--line)] p-2 space-y-2">
        <FocusTimer />
        <SpotifyPlayer />
      </div>
    </div>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-1 py-2 text-center text-[10.5px] font-medium transition-colors border-b-2 ${
        isActive
          ? "border-[var(--accent)] bg-[var(--editor-tab-active-bg)] text-[var(--text-primary)]"
          : "border-transparent text-[var(--text-muted)] hover:bg-[var(--editor-tab-hover-bg)]"
      }`}
    >
      {label}
    </button>
  );
}
