import { useEffect, useState } from "react";
import { api, ApiError, type ResidentView } from "./api";

/** Loads one resident (anonymous: birth year, places, favorites). */
export function useResident(id: string) {
  const [view, setView] = useState<ResidentView>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api
      .resident(id)
      .then((result) => !cancelled && setView(result))
      .catch((caught) => !cancelled && setError(caught instanceof ApiError ? caught.message : "Something went wrong."));
    return () => {
      cancelled = true;
    };
  }, [id, version]);
  return { view, error, reload: () => setVersion((n) => n + 1) };
}
