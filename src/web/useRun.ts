import { useEffect, useState } from "react";
import { api } from "./api.js";
import type { Run, RunEvent, Approval } from "../shared/types.js";
export function useRun(runId: string | null, onChange: () => void) {
  const [detail, setDetail] = useState<{
    run: Run;
    events: RunEvent[];
    approvals: Approval[];
  } | null>(null);
  useEffect(() => {
    if (!runId) {
      setDetail(null);
      return;
    }
    setDetail(null);
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () =>
      api(`/runs/${runId}`)
        .then((data) => {
          if (!closed) setDetail(data);
        })
        .catch(() => {});
    void refresh();
    const source = new EventSource(`/api/runs/${runId}/events`);
    source.addEventListener("clinic", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as RunEvent;
      setDetail((current) =>
        current
          ? {
              ...current,
              events: current.events.some((e) => e.id === event.id)
                ? current.events
                : [...current.events, event],
            }
          : current,
      );
      if (event.type !== "message") {
        clearTimeout(timer);
        timer = setTimeout(() => {
          void refresh();
          onChange();
        }, 150);
      }
    });
    return () => {
      closed = true;
      source.close();
      clearTimeout(timer);
    };
  }, [runId, onChange]);
  return detail;
}
