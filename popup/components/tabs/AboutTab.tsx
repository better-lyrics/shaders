import React from "react";
import { shadersIconUrl } from "../icons";

const KAWARP_URL = "https://kawarp.betterlyrics.org/";
const BETTER_LYRICS_URL = "https://betterlyrics.org";
const REPOSITORY_URL = "https://github.com/better-lyrics/shaders";
const DISCORD_URL = "https://discord.gg/UsHE3d5fWF";
const DRAGO_URL = "https://github.com/drago-oo";
const LUCID_URL = "https://github.com/drago-oo/lucid-theme";

export const AboutTab: React.FC = () => (
  <div className="panel">
    <div className="about__hero">
      <img className="about__mark" src={shadersIconUrl} alt="" width={52} height={52} />
      <div className="about__hero-text">
        <h2 className="about__name">Shaders</h2>
        <p className="about__tagline">Animated backgrounds for YouTube Music.</p>
      </div>
    </div>

    <div className="about__section">
      <h3 className="about__heading">What it is</h3>
      <p className="about__body">
        Shaders paints the player with a fluid, warped blur built from the album artwork, and pulses it in time with the
        music. Everything renders locally on your GPU.
      </p>
    </div>

    <div className="about__section">
      <h3 className="about__heading">Kawarp</h3>
      <p className="about__body">
        The renderer behind the effect, built in house by the Better Lyrics team. It reads the artwork directly, so
        there is no colour extraction step and no palette to get wrong.
      </p>
    </div>

    <div className="about__section">
      <h3 className="about__heading">Use it in your own project</h3>
      <p className="about__body">
        Kawarp ships on its own as{" "}
        <a href={KAWARP_URL} target="_blank" rel="noopener noreferrer">
          @kawarp/core
        </a>
        , free to drop into anything. MIT, no dependencies, 6.7 KB gzipped, and about as light as a shader effect gets.
        It is happy running all day behind a music player.
      </p>
    </div>

    <div className="about__section">
      <h3 className="about__heading">Better Lyrics</h3>
      <p className="about__body">
        Optional, but highly recommended to run alongside this. The two are built to sit together.{" "}
        <a href={BETTER_LYRICS_URL} target="_blank" rel="noopener noreferrer">
          Install Better Lyrics
        </a>
        .
      </p>
    </div>

    <div className="about__section">
      <h3 className="about__heading">Open source</h3>
      <p className="about__body">
        GPL v3. Source on{" "}
        <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        . PRs welcome if you spot something to fix.
      </p>
    </div>

    <div className="about__section">
      <h3 className="about__heading">Community</h3>
      <ul className="about__body about__list">
        <li>
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
            Discord
          </a>{" "}
          for questions and chat.
        </li>
        <li>
          <a href={`${REPOSITORY_URL}/issues/new/choose`} target="_blank" rel="noopener noreferrer">
            File an issue
          </a>{" "}
          if something is broken.
        </li>
      </ul>
    </div>

    <div className="about__section">
      <h3 className="about__heading">Made by</h3>
      <p className="about__body">
        <a href="https://boidu.dev" target="_blank" rel="noopener noreferrer">
          Boidu
        </a>
        , with thanks to everyone in the Better Lyrics community who has tested it and reported bugs. Thanks to{" "}
        <a href={DRAGO_URL} target="_blank" rel="noopener noreferrer">
          Drago
        </a>{" "}
        for letting us port the delicious bits of{" "}
        <a href={LUCID_URL} target="_blank" rel="noopener noreferrer">
          Lucid
        </a>
        , their Better Lyrics theme, over to the browse pages.
      </p>
    </div>
  </div>
);
