import type { Person } from "./api";

export interface DemoResident {
  id: string;
  label: string;
  person: Person;
}

/** Fictional residents of a demo care home. Their favorites are already confirmed Qloo entities. */
export const DEMO_RESIDENTS: DemoResident[] = [
  {
    id: "mumbai-1940",
    label: "Grew up in Mumbai, born 1940",
    person: {
      birthYear: 1940,
      grewUp: "Mumbai, India",
      favorites: [
        { entityId: "D32E8668-E3B1-4919-BFA5-6870900EAC80", name: "Lata Mangeshkar", kind: "music" },
        { entityId: "3233A07F-2448-4E67-B5D2-7141E0870A8D", name: "Mohammed Rafi", kind: "music" },
        { entityId: "23E081CF-CEFB-4E12-8337-867F25F5D1FC", name: "Mughal-E-Azam", kind: "film" },
      ],
    },
  },
  {
    id: "san-antonio-1948",
    label: "Grew up in San Antonio, born 1948",
    person: {
      birthYear: 1948,
      grewUp: "San Antonio, Texas",
      favorites: [
        { entityId: "D4248DCF-581B-4FD5-BE66-B265E327AE16", name: "Vicente Fernández", kind: "music" },
        { entityId: "94DBCBF3-D830-4ED5-9F55-467DA9686C9B", name: "Javier Solís", kind: "music" },
        { entityId: "22F69F5C-353D-445B-84B5-56B425D3A763", name: "Bonanza", kind: "tv" },
      ],
    },
  },
  {
    id: "dublin-1938",
    label: "Grew up in Dublin, born 1938",
    person: {
      birthYear: 1938,
      grewUp: "Dublin, Ireland",
      favorites: [
        { entityId: "6A8ED78D-DD44-4224-BC03-6C14A28F33AA", name: "The Clancy Brothers", kind: "music" },
        { entityId: "97966857-92D0-4779-8DBF-EDB85BFB0B79", name: "Bing Crosby", kind: "music" },
        { entityId: "E6C46705-4145-482D-8704-0DB3CA429343", name: "The Quiet Man", kind: "film" },
      ],
    },
  },
  {
    id: "detroit-1945",
    label: "Grew up in Detroit, born 1945",
    person: {
      birthYear: 1945,
      grewUp: "Detroit, Michigan",
      favorites: [
        { entityId: "689CFC2A-A743-4CCB-998F-808A68880612", name: "The Supremes", kind: "music" },
        { entityId: "7C7B2D3A-FE7E-4507-8D00-183671B5177D", name: "Marvin Gaye", kind: "music" },
        { entityId: "390B498B-C4E9-4057-B5D0-66EB9D3B226B", name: "In the Heat of the Night", kind: "film" },
      ],
    },
  },
];
