import { useEffect } from "react";
import { Layout } from "./components/Layout";
import { TourBar } from "./components/TourBar";
import { match, useLocation } from "./router";
import { CompareScreen } from "./screens/Compare";
import { Demo } from "./screens/Demo";
import { EvaluationScreen } from "./screens/Evaluation";
import { GroupScreen } from "./screens/Group";
import { Intake } from "./screens/Intake";
import { Landing } from "./screens/Landing";
import { MemoryBoxScreen } from "./screens/MemoryBox";
import { PublicVisitKit } from "./screens/VisitKit";
import { VisitKitManager } from "./screens/VisitKitManager";

const TITLES: Array<[RegExp, string]> = [
  [/^\/start/, "Tell us about them"],
  [/^\/demo/, "Demo care home"],
  [/^\/group/, "Group session setlist"],
  [/^\/evaluation/, "How we tested Encore"],
  [/^\/kit\//, "Visit Kit"],
  [/^\/r\/[^/]+\/compare/, "Comparison"],
  [/^\/r\/[^/]+\/visit-kit/, "Family Visit Kit"],
  [/^\/r\//, "Their Memory Box"],
];

function Screen({ path, tourStep }: { path: string; tourStep: number }) {
  let params: Record<string, string> | undefined;
  if (path === "/start") return <Intake />;
  if (path === "/demo") return <Demo />;
  if (path === "/group") return <GroupScreen />;
  if (path === "/evaluation") return <EvaluationScreen />;
  if ((params = match("/kit/:token", path))) return <PublicVisitKit token={params.token!} />;
  if ((params = match("/r/:id/compare", path))) return <CompareScreen residentId={params.id!} />;
  if ((params = match("/r/:id/visit-kit", path))) return <VisitKitManager residentId={params.id!} />;
  if ((params = match("/r/:id", path))) return <MemoryBoxScreen key={params.id} residentId={params.id!} openTrace={tourStep === 3} />;
  return <Landing />;
}

export function App() {
  const { path, search } = useLocation();
  const tourStep = Number(search.get("tour") ?? 0);

  useEffect(() => {
    const title = TITLES.find(([pattern]) => pattern.test(path))?.[1];
    document.title = title ? `${title} · Encore` : "Encore";
  }, [path]);

  return (
    <Layout>
      <Screen path={path} tourStep={tourStep} />
      {tourStep > 0 && <TourBar step={tourStep} />}
    </Layout>
  );
}
