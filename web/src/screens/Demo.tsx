import { Film, Music, Star, Tv } from "lucide-react";
import type { FavoriteKind, Person } from "../api";
import { DEMO_RESIDENTS } from "../demo";

const KIND_ICON: Record<FavoriteKind, typeof Music> = { music: Music, film: Film, tv: Tv, star: Star, book: Star };
const KIND_LABEL: Record<FavoriteKind, string> = { music: "Music", film: "Film", tv: "TV show", star: "Star", book: "Book" };

export function Demo({ onOpen }: { onOpen: (person: Person) => void }) {
  return (
    <>
      <h1>A demo care home</h1>
      <p className="lede">
        These residents are fictional. Each has three favorites a family might mention. Open any of them to see how different their
        Memory Boxes are.
      </p>
      <ul className="cards cards-two">
        {DEMO_RESIDENTS.map((resident) => (
          <li key={resident.id} className="door resident">
            <div>
              <h2 className="resident-title">Grew up in {resident.person.grewUp?.split(",")[0]}</h2>
              <p className="resident-meta">Born {resident.person.birthYear}</p>
            </div>
            <ul className="resident-favorites" aria-label="Favorites">
              {resident.person.favorites.map((favorite) => {
                const Icon = KIND_ICON[favorite.kind];
                return (
                  <li key={favorite.entityId}>
                    <Icon aria-hidden="true" size={18} />
                    <span className="visually-hidden">{KIND_LABEL[favorite.kind]}: </span>
                    {favorite.name}
                  </li>
                );
              })}
            </ul>
            <button
              className="btn btn-primary"
              onClick={() => onOpen(resident.person)}
              aria-label={`Open Memory Box for the resident who grew up in ${resident.person.grewUp?.split(",")[0]}`}
            >
              Open Memory Box
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
