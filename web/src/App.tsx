import { useEffect, useState } from "react";
import type { Person } from "./api";
import { Layout } from "./components/Layout";
import { navigate, usePath } from "./router";
import { Demo } from "./screens/Demo";
import { Intake } from "./screens/Intake";
import { Landing } from "./screens/Landing";
import { MemoryBoxScreen } from "./screens/MemoryBox";

// The current person survives a page refresh in this tab only. It holds no names, and
// storage can be unavailable (private windows), so every access is guarded.
const STORAGE_KEY = "encore.person";
function loadPerson(): Person | undefined {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Person) : undefined;
  } catch {
    return undefined;
  }
}
function savePerson(person: Person): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(person));
  } catch {
    // Nothing to do: the app still works for this page view.
  }
}

export function App() {
  const path = usePath();
  const [person, setPerson] = useState<Person | undefined>(loadPerson);

  const openBox = (next: Person) => {
    setPerson(next);
    savePerson(next);
    navigate("/box");
  };

  useEffect(() => {
    if (path === "/box" && !person) navigate("/");
  }, [path, person]);

  useEffect(() => {
    const titles: Record<string, string> = { "/start": "Tell us about them", "/demo": "Demo care home", "/box": "Their Memory Box" };
    document.title = titles[path] ? `${titles[path]} · Encore` : "Encore";
  }, [path]);

  let screen;
  if (path === "/start") screen = <Intake onDone={openBox} />;
  else if (path === "/demo") screen = <Demo onOpen={openBox} />;
  else if (path === "/box" && person) screen = <MemoryBoxScreen person={person} />;
  else screen = <Landing />;

  return <Layout>{screen}</Layout>;
}
