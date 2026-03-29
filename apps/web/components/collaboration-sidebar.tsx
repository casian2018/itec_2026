"use client";

import { useState } from "react";
import { SharedChatPanel } from "./shared-chat-panel";
import { ItecifySidebarPresence } from "./itecify-workspace-chrome";
import { SessionActivityPanel } from "./session-activity-panel";
import { SpotifyPlayer } from "./spotify-player";
import {
  type ChatMessage,
  type Participant,
  type RemoteCursor,
  type SessionActivityEvent,
} from "@/lib/socket";

type CollaborationSidebarProps = {
  messages: ChatMessage[];
  participants: Participant[];
  activity: SessionActivityEvent[];
  currentUserId: string;
  onSendMessage: (content: string) => void;
  canSend: boolean;
  currentUserName: string;
  currentUserSocketId: string | null;
  workspaceFiles: { id: string; name: string }[];
  remoteCursors: RemoteCursor[];
};

type Tab = "chat" | "participants" | "activity";

export function CollaborationSidebar({
  messages,
  participants,
  activity,
  currentUserId,
  onSendMessage,
  canSend,
  currentUserName,
  currentUserSocketId,
  workspaceFiles,
  remoteCursors,
}: CollaborationSidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--sidebar-bg)]">
      <div className="flex-shrink-0 border-b border-[var(--line)]">
        <div className="flex h-[34px]">
          <TabButton
            label="Chat"
            isActive={activeTab === "chat"}
            onClick={() => setActiveTab("chat")}
          />
          <TabButton
            label={`Participants (${participants.length})`}
            isActive={activeTab === "participants"}
            onClick={() => setActiveTab("participants")}
          />
          <TabButton
            label="Activity"
            isActive={activeTab === "activity"}
            onClick={() => setActiveTab("activity")}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeTab === "chat" && (
          <SharedChatPanel
            messages={messages}
            canSend={canSend}
            currentUserId={currentUserId}
            onSend={onSendMessage}
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
      <div className="flex-shrink-0 border-t border-[var(--line)] p-2">
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
