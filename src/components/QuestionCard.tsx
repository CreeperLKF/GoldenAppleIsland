import { useEffect, useRef, useState } from "react";
import type { HookEvent } from "../types/events";
import { badgeClass } from "../types/events";

interface QuestionCardProps {
  event: HookEvent;
  resolving: boolean;
  onSubmit: (answer: string) => void;
  onSkip: () => void;
}

function extractQuestion(event: HookEvent): string {
  const input = event.tool_input;
  if (typeof input.question === "string") return input.question;
  if (typeof input.prompt === "string") return input.prompt;
  for (const val of Object.values(input)) {
    if (typeof val === "string" && val.length > 10) return val;
  }
  return "Claude is asking a question";
}

function formatAgo(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "just now";
  const secs = Math.max(0, Math.round((now - t) / 1000));
  if (secs < 2) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

export default function QuestionCard({ event, resolving, onSubmit, onSkip }: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!resolving) inputRef.current?.focus();
  }, [resolving]);

  const question = extractQuestion(event);

  const handleSubmit = () => {
    if (answer.trim().length === 0) return;
    onSubmit(answer.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <article
      className="card-enter overflow-hidden bg-[var(--bg-surface)] transition-all ease-in"
      style={{
        borderRadius: 6,
        border: "0.5px solid var(--border)",
        marginLeft: 8,
        marginRight: 8,
        marginTop: 6,
        marginBottom: 6,
        opacity: resolving ? 0 : 1,
        maxHeight: resolving ? 0 : 500,
        transitionDuration: "200ms",
      }}
    >
      <div style={{ padding: "10px 12px" }}>
        <div className="flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded font-semibold ${badgeClass("Question")}`}
            style={{ height: 20, padding: "2px 8px", fontSize: 11, borderRadius: 4 }}
          >
            Question
          </span>
          <span className="text-[var(--text-tertiary)]" style={{ fontSize: 11 }}>
            {formatAgo(event.timestamp, now)}
          </span>
        </div>

        <div
          className="text-[var(--text-primary)] mt-2"
          style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}
        >
          {question}
        </div>

        <textarea
          ref={inputRef}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your answer..."
          className="w-full mt-2 rounded resize-none"
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            padding: "8px 10px",
            minHeight: 60,
            maxHeight: 120,
            background: "var(--input-bg)",
            border: "0.5px solid var(--input-border)",
            color: "var(--input-text)",
            outline: "none",
          }}
        />

        <div className="text-[var(--text-tertiary)] mt-1" style={{ fontSize: 11 }}>
          Ctrl+Enter to submit
        </div>
      </div>

      <div className="flex" style={{ borderTop: "0.5px solid var(--border)" }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={answer.trim().length === 0}
          className="flex-1 h-9 font-semibold bg-[var(--approve-bg)] text-[var(--approve-text)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontSize: 13, borderRight: "0.5px solid var(--border)" }}
        >
          Submit
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 h-9 font-semibold bg-[var(--deny-bg)] text-[var(--deny-text)] transition-[filter,transform] hover:brightness-95 active:scale-[0.98]"
          style={{ fontSize: 13 }}
        >
          Skip
        </button>
      </div>
    </article>
  );
}
