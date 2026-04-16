import { useEffect, useRef, useState } from "react";
import type { HookEvent } from "../types/events";
import CategoryTag from "./ui/CategoryTag";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { formatAgo } from "../lib/format";

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

export default function QuestionCard({ event, resolving, onSubmit, onSkip }: QuestionCardProps) {
  const [answer, setAnswer] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => { if (!resolving) inputRef.current?.focus(); }, [resolving]);

  const question = extractQuestion(event);

  const submit = () => {
    if (answer.trim().length === 0) return;
    onSubmit(answer.trim());
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <article
      className="card-enter"
      style={{
        background: "var(--bg-surface)",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius-md)",
        borderLeft: "3px solid var(--cat-question)",
        marginLeft: 10, marginRight: 10, marginTop: 8, overflow: "hidden",
        opacity: resolving ? 0 : 1,
        maxHeight: resolving ? 0 : 560,
        transition: "opacity 160ms, max-height 160ms",
      }}
    >
      <div style={{ padding: "10px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <CategoryTag category="Question" />
          <span
            className="tabular"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-mono-xs)",
              color: "var(--text-tertiary)",
            }}
          >
            {formatAgo(event.timestamp, now)}
          </span>
        </div>

        <div style={{
          fontSize: "var(--fs-title)",
          lineHeight: "var(--lh-title)",
          fontWeight: 500,
          color: "var(--text-primary)",
        }}>
          {question}
        </div>

        <div style={{ position: "relative", marginTop: 10 }}>
          <textarea
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type your answer…"
            style={{
              width: "100%",
              minHeight: 64,
              maxHeight: 140,
              padding: "8px 10px 20px",
              fontFamily: "var(--font-ui)",
              fontSize: "var(--fs-body)",
              lineHeight: "var(--lh-body)",
              color: "var(--text-primary)",
              background: "var(--bg-subtle)",
              border: "0.5px solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              resize: "none",
              outline: "none",
            }}
          />
          <span
            aria-hidden
            style={{
              position: "absolute",
              right: 10, bottom: 6,
              display: "inline-flex", alignItems: "center", gap: 2,
              fontSize: 10, color: "var(--text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <Icon name="kbd-return" size={10} /> ⏎
          </span>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        padding: "8px 12px",
        borderTop: "0.5px solid var(--border)",
      }}>
        <Button
          variant="primary"
          onClick={submit}
          disabled={answer.trim().length === 0}
          style={{ justifyContent: "center" }}
        >
          Submit
        </Button>
        <Button
          variant="secondary"
          tone="danger"
          onClick={onSkip}
          style={{ justifyContent: "center" }}
        >
          Skip
        </Button>
      </div>
    </article>
  );
}
