import { api } from "./api";
import { navigate } from "./router";

/** The 90-second guided tour, through one fictional resident who grew up in Mumbai. */
export const TOUR_DEMO = "mumbai-1940";
const KEY = "encore.tourResident";

export interface TourStep {
  title: string;
  text: string;
  path: (residentId: string) => string;
}

export const TOUR: TourStep[] = [
  {
    title: "The problem",
    text: "Same favorites, three systems. A naive use of Qloo erases her culture; Encore keeps it.",
    path: (id) => `/r/${id}/compare?tour=1`,
  },
  {
    title: "Her Memory Box",
    text: "Music, films and TV from her youth, each showing Qloo's evidence apart from Encore's reading. Try a reaction button.",
    path: (id) => `/r/${id}?tour=2`,
  },
  {
    title: "Learning from reactions",
    text: "\"Lit up\" pins a pick and teaches Qloo more; \"distressed\" removes it for good. Open \"How Encore decided\" to see why.",
    path: (id) => `/r/${id}?tour=3#trace`,
  },
  {
    title: "A Visit Kit for family",
    text: "A private link with songs and conversation starters built from Qloo's tags, in English, Hindi or Spanish.",
    path: (id) => `/r/${id}/visit-kit?tour=4`,
  },
  {
    title: "Tested on real people",
    text: "We hid real people's lifetime favorites and checked who found them: a plain AI model, naive Qloo, or Encore.",
    path: () => `/evaluation?tour=5`,
  },
];

function read(): string | undefined {
  try {
    return sessionStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function save(id: string): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // The tour still works for this page view.
  }
}

/** Starts (or resumes) the tour with a private copy of the demo resident. */
export async function startTour(): Promise<void> {
  let id = read();
  if (!id) {
    id = (await api.copyDemo(TOUR_DEMO)).id;
    save(id);
  }
  navigate(TOUR[0]!.path(id));
}

export async function goToStep(step: number): Promise<void> {
  const id = read() ?? (await api.copyDemo(TOUR_DEMO)).id;
  save(id);
  const target = TOUR[step - 1];
  if (target) navigate(target.path(id));
}
