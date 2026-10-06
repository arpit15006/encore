import { ChevronDown, EyeOff, ShieldCheck } from "lucide-react";
import type { Favorite, LoggedRequest } from "../api";

const NEVER_SENT = ["Names", "Health or diagnoses", "Reactions", "Care notes", "Addresses", "Care home name"];

const TOOL_LABELS: Record<string, string> = {
  insights: "Taste request",
  qloo_describe: "Name lookup",
};

function describeRequest(request: LoggedRequest, favorites: Favorite[]): string {
  const args = request.args;
  if (request.tool === "insights") {
    const type = String(args.type ?? "");
    const ids = Array.isArray(args.signals) ? (args.signals as string[]) : [];
    const names = ids.map((id) => favorites.find((favorite) => favorite.entityId === id)?.name ?? "an unknown ID").join(", ");
    const params = (args.params ?? {}) as Record<string, unknown>;
    const years =
      params["filter.release_year.min"] != null ? ` released ${String(params["filter.release_year.min"])}–${String(params["filter.release_year.max"])}` : "";
    return `${type.replace("_", " ")}s${years} that fans of ${names} enjoy`;
  }
  if (request.tool === "qloo_describe") return `Find "${String(args.entity)}" (${String(args.type)})`;
  return request.tool;
}

/**
 * Shows exactly what was sent to Qloo for this view. It is built only from the server's request
 * log, so it can never drift from what actually happened.
 */
export function WhatQlooSees({ requests, favorites }: { requests: LoggedRequest[]; favorites: Favorite[] }) {
  return (
    <details className="qloo-sees">
      <summary>
        <ShieldCheck aria-hidden="true" size={22} />
        What Qloo sees: {requests.length} {requests.length === 1 ? "request" : "requests"}, no personal details
        <ChevronDown className="chevron" aria-hidden="true" size={22} />
      </summary>
      <div className="qloo-sees-body">
        <p>These are the exact requests sent for this page, read from Encore's request log.</p>
        <ol className="sent-list">
          {requests.map((request, index) => (
            <li key={index} className="sent-item">
              <strong>{TOOL_LABELS[request.tool] ?? request.tool}:</strong> {describeRequest(request, favorites)}
              {request.cacheHit ? " (answered from Encore's cache, so Qloo wasn't contacted again)" : ""}
              <pre>{JSON.stringify(request.args, null, 2)}</pre>
            </li>
          ))}
        </ol>
        <p>
          <EyeOff aria-hidden="true" size={18} style={{ verticalAlign: "-3px" }} /> Never sent to Qloo:
        </p>
        <ul className="never-sent">
          {NEVER_SENT.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
