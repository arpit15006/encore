import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import type { ReactNode } from "react";

const ICONS = { caution: AlertTriangle, error: CircleAlert, info: Info };

/** Status message that never relies on color alone: icon plus words. */
export function Notice({ tone, children }: { tone: keyof typeof ICONS; children: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : undefined}>
      <Icon aria-hidden="true" size={22} />
      <div>{children}</div>
    </div>
  );
}
