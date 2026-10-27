import { ExternalLink, Film, MessageCircleHeart, Music, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError, type VisitKitContent } from "../api";
import { Keepsake } from "../art/keepsake";
import { Envelope } from "../art/scenes";
import { Notice } from "../components/Notice";
import { appleMusicSearch, youTubeSearch } from "../listen";

const HEADINGS: Record<VisitKitContent["language"], { title: string; songs: string; film: string; talk: string }> = {
  en: { title: "Before your visit", songs: "Three songs to play", film: "A film from their youth", talk: "Things to talk about" },
  hi: { title: "मुलाक़ात से पहले", songs: "बजाने के लिए तीन गाने", film: "उनकी जवानी की एक फ़िल्म", talk: "बात करने के लिए" },
  es: { title: "Antes de su visita", songs: "Tres canciones para escuchar", film: "Una película de su juventud", talk: "Temas de conversación" },
};

/** The kit itself: used for the public page and the preview. Large type, printable, no names. */
export function KitView({ content }: { content: VisitKitContent }) {
  const words = HEADINGS[content.language];
  return (
    <div className="kit" lang={content.language}>
      <section aria-labelledby="kit-songs">
        <h2 id="kit-songs">
          <Music aria-hidden="true" size={26} /> {words.songs}
        </h2>
        <ol className="kit-songs">
          {content.songs.map((song) => (
            <li key={song.artist}>
              <span className="kit-sleeve" aria-hidden="true">
                <Keepsake kind="music" seed={song.artist} year={null} />
              </span>
              <span className="kit-song-name">{song.song ? `“${song.song}”` : song.artist}</span>
              {song.song && <span className="kit-song-artist">{song.artist}</span>}
              <span className="listen kit-listen">
                <a href={appleMusicSearch(`${song.song ?? ""} ${song.artist}`.trim())} target="_blank" rel="noreferrer">
                  Apple Music <ExternalLink aria-hidden="true" size={14} />
                  <span className="visually-hidden">(opens in a new tab)</span>
                </a>
                <a href={youTubeSearch(`${song.song ?? ""} ${song.artist}`.trim())} target="_blank" rel="noreferrer">
                  YouTube <ExternalLink aria-hidden="true" size={14} />
                  <span className="visually-hidden">(opens in a new tab)</span>
                </a>
              </span>
            </li>
          ))}
        </ol>
      </section>
      {content.film && (
        <section aria-labelledby="kit-film">
          <h2 id="kit-film">
            <Film aria-hidden="true" size={26} /> {words.film}
          </h2>
          <div className="kit-film-row">
            <span className="kit-sleeve" aria-hidden="true">
              <Keepsake kind="films" seed={content.film.name} year={content.film.year ?? null} />
            </span>
            <p className="kit-film">
              {content.film.name}
              {content.film.year ? ` (${content.film.year})` : ""}
            </p>
          </div>
          {content.film.lowerConfidence && (
            <Notice tone="caution">
              <p>Lower confidence: this film was inferred from their music.</p>
            </Notice>
          )}
        </section>
      )}
      <section aria-labelledby="kit-talk">
        <h2 id="kit-talk">
          <MessageCircleHeart aria-hidden="true" size={26} /> {words.talk}
        </h2>
        <ul className="kit-starters">
          {content.starters.map((starter) => (
            <li key={starter.about + starter.text}>
              <p className="kit-starter-text">{starter.text}</p>
              {starter.tag && (
                <p className="kit-starter-source" lang="en">
                  About {starter.about}. Qloo describes it as “{starter.tag}”.
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>
      <p className="kit-tip" lang="en">
        Tip: let them lead. If a song doesn't land, move on gently; there's no need to test what they remember.
      </p>
    </div>
  );
}

export function PublicVisitKit({ token }: { token: string }) {
  const [kit, setKit] = useState<{ content: VisitKitContent; expiresAt: string }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    api
      .visitKit(token)
      .then(setKit)
      .catch((caught) =>
        setError(caught instanceof ApiError && caught.status === 404 ? "This Visit Kit has expired or was turned off. Ask the person who shared it for a new link." : "We couldn't load this Visit Kit. Please try again."),
      );
  }, [token]);

  if (error)
    return (
      <div className="stack">
        <div className="empty-art-wrap">
          <Envelope />
        </div>
        <h1>Visit Kit unavailable</h1>
        <Notice tone="info">
          <p>{error}</p>
        </Notice>
      </div>
    );
  if (!kit) return <p role="status">Loading…</p>;
  const words = HEADINGS[kit.content.language];
  return (
    <div className="stack">
      <div className="page-hero">
        <div>
          <h1 lang={kit.content.language}>{words.title}</h1>
          <p className="lede">
            Picked from their youth, {kit.content.youth.start}–{kit.content.youth.end}, using what they loved.
          </p>
          <button className="btn btn-quiet no-print" onClick={() => window.print()}>
            <Printer aria-hidden="true" size={20} /> Print
          </button>
        </div>
        <div className="page-hero-art no-print">
          <Envelope />
        </div>
      </div>
      <KitView content={kit.content} />
      <p className="hint">This private page expires on {new Date(kit.expiresAt).toLocaleDateString()}.</p>
    </div>
  );
}
