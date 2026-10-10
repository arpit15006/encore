import type { Favorite } from "./memoryBox.js";

export interface DemoResident {
  id: string;
  label: string;
  birthYear: number;
  grewUp: string;
  /** Where they live now; only the naive-Qloo comparison column uses it. */
  livesIn: string;
  favorites: Favorite[];
}

/**
 * Fictional residents of a demo care home, from six cultures. Every favorite is an exact Qloo
 * match confirmed in advance. Visitors get their own copy, so one visitor's reactions never
 * change what the next visitor sees.
 */
export const DEMO_RESIDENTS: DemoResident[] = [
  {
    id: "mumbai-1940",
    label: "Grew up in Mumbai, born 1940",
    birthYear: 1940,
    grewUp: "Mumbai, India",
    livesIn: "Edison, New Jersey",
    favorites: [
      { entityId: "D32E8668-E3B1-4919-BFA5-6870900EAC80", name: "Lata Mangeshkar", kind: "music" },
      { entityId: "3233A07F-2448-4E67-B5D2-7141E0870A8D", name: "Mohammed Rafi", kind: "music" },
      { entityId: "23E081CF-CEFB-4E12-8337-867F25F5D1FC", name: "Mughal-E-Azam", kind: "film" },
    ],
  },
  {
    id: "san-antonio-1948",
    label: "Grew up in San Antonio, born 1948",
    birthYear: 1948,
    grewUp: "San Antonio, Texas",
    livesIn: "San Antonio, Texas",
    favorites: [
      { entityId: "D4248DCF-581B-4FD5-BE66-B265E327AE16", name: "Vicente Fernández", kind: "music" },
      { entityId: "94DBCBF3-D830-4ED5-9F55-467DA9686C9B", name: "Javier Solís", kind: "music" },
      { entityId: "22F69F5C-353D-445B-84B5-56B425D3A763", name: "Bonanza", kind: "tv" },
    ],
  },
  {
    id: "dublin-1938",
    label: "Grew up in Dublin, born 1938",
    birthYear: 1938,
    grewUp: "Dublin, Ireland",
    livesIn: "Boston, Massachusetts",
    favorites: [
      { entityId: "6A8ED78D-DD44-4224-BC03-6C14A28F33AA", name: "The Clancy Brothers", kind: "music" },
      { entityId: "97966857-92D0-4779-8DBF-EDB85BFB0B79", name: "Bing Crosby", kind: "music" },
      { entityId: "E6C46705-4145-482D-8704-0DB3CA429343", name: "The Quiet Man", kind: "film" },
    ],
  },
  {
    id: "detroit-1945",
    label: "Grew up in Detroit, born 1945",
    birthYear: 1945,
    grewUp: "Detroit, Michigan",
    livesIn: "Detroit, Michigan",
    favorites: [
      { entityId: "689CFC2A-A743-4CCB-998F-808A68880612", name: "The Supremes", kind: "music" },
      { entityId: "7C7B2D3A-FE7E-4507-8D00-183671B5177D", name: "Marvin Gaye", kind: "music" },
      { entityId: "390B498B-C4E9-4057-B5D0-66EB9D3B226B", name: "In the Heat of the Night", kind: "film" },
    ],
  },
  {
    id: "kingston-1944",
    label: "Grew up in Kingston, born 1944",
    birthYear: 1944,
    grewUp: "Kingston, Jamaica",
    livesIn: "London, England",
    favorites: [
      { entityId: "C5C4624E-0EFE-44CF-A752-EA8116444CF1", name: "Toots and The Maytals", kind: "music" },
      { entityId: "860988CC-714D-4505-BEF8-0B919300A24C", name: "Jimmy Cliff", kind: "music" },
      { entityId: "787D5402-9AAB-48B5-8A85-BDC6D6A0F6E9", name: "The Harder They Come", kind: "film" },
    ],
  },
  {
    id: "lagos-1946",
    label: "Grew up in Lagos, born 1946",
    birthYear: 1946,
    grewUp: "Lagos, Nigeria",
    livesIn: "Houston, Texas",
    favorites: [
      { entityId: "679CEADA-31C3-4A06-99D0-D7384D6693BF", name: "Fela Kuti", kind: "music" },
      { entityId: "A4FDA6D5-1E8B-41B1-9DC5-B1408F79904C", name: "Ebenezer Obey", kind: "music" },
    ],
  },
];

export const demoResident = (id: string) => DEMO_RESIDENTS.find((resident) => resident.id === id);
