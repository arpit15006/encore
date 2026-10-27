import { Film, Loader2, Music, Star, Tv } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { api, ApiError, type DemoResident, type FavoriteKind } from "../api";
import { Stage } from "../art/scenes";
import { PlaceStamp } from "../art/stamps";
import { Notice } from "../components/Notice";
import { Reveal, Tilt } from "../motion";
import { navigate } from "../router";

const KIND_ICON: Record<FavoriteKind, typeof Music> = { music: Music, film: Film, tv: Tv, star: Star, book: Star };
const KIND_LABEL: Record<FavoriteKind, string> = { music: "Music", film: "Film", tv: "TV show", star: "Star", book: "Book" };

export function Demo() {
  const [residents, setResidents] = useState<DemoResident[]>();
  const [opening, setOpening] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api
      .demoResidents()
      .then(setResidents)
      .catch((caught) => setError(caught instanceof ApiError ? caught.message : "Something went wrong."));
  }, []);

  async function open(id: string) {
    setOpening(id);
    try {
      // Each visitor works on a private copy, so reactions never change what the next visitor sees.
      const copy = await api.copyDemo(id);
      navigate(`/r/${copy.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong.");
      setOpening(undefined);
    }
  }

  return (
    <>
      <h1>A demo care home</h1>
      <p className="lede">
        Six fictional residents from six cultures. Each has a few favorites a family might mention. Open any of them to see how different their
        Memory Boxes are; your reactions only change your own copy.
      </p>
      {error && (
        <Notice tone="error">
          <p>{error}</p>
        </Notice>
      )}
      {!residents && !error && <p role="status">Loading residents…</p>}
      {residents && (
        <ul className="cards cards-two">
          {residents.map((resident, index) => {
            const place = resident.grewUp.split(",")[0];
            return (
              <Tilt as="li" key={resident.id} className="door resident" style={{ "--i": index } as CSSProperties}>
                <div className="resident-top">
                  <div className="resident-stamp">
                    <PlaceStamp place={resident.grewUp} tilt={index % 2 ? 3 : -3} />
                  </div>
                  <div>
                    <h2 className="resident-title">Grew up in {place}</h2>
                    <p className="resident-meta">Born {resident.birthYear}</p>
                  </div>
                </div>
                <ul className="resident-favorites" aria-label="Favorites">
                  {resident.favorites.map((favorite) => {
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
                <button className="btn btn-primary" onClick={() => open(resident.id)} disabled={opening !== undefined} aria-label={`Open Memory Box for the resident who grew up in ${place}`}>
                  {opening === resident.id ? <Loader2 className="spin" aria-hidden="true" size={20} /> : null}
                  Open Memory Box
                </button>
              </Tilt>
            );
          })}
        </ul>
      )}
      <Reveal as="section" className="form-section" style={{ marginTop: "var(--space-6)" }} aria-labelledby="group-door">
        <div className="section-art">
          <Stage />
        </div>
        <h2 id="group-door">Planning a sing-along for all six?</h2>
        <p>Encore can plan one setlist for a visiting musician so every resident gets songs that are theirs.</p>
        <button className="btn btn-quiet" onClick={() => navigate("/group")}>
          See the group setlist
        </button>
      </Reveal>
    </>
  );
}
