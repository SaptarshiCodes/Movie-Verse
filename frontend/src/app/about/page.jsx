import Link from "next/link";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <section className="content-page about-page">
      <div className="about-copy">
        <h1>A calmer way to find a film.</h1>
        <p className="lead">
          Movie Verse brings movie discovery and your personal watch list into
          one simple place.
        </p>
        <p>
          Explore what is popular, look through familiar genres, and save a
          title when it catches your eye. Your list stays in this browser, so
          there is no account to create and no viewing history to share.
        </p>
        <p>
          Movie information and artwork are provided by The Movie Database.
          Movie Verse is an independent project and is not endorsed by TMDB.
        </p>
        <Link className="button button-light" href="/">
          Start exploring
        </Link>
      </div>
      <div className="about-art" aria-hidden="true">
        <div className="film-frame">
          <span>Stories</span>
          <span>stay with us.</span>
        </div>
        <div className="film-frame film-frame-offset">
          <span>Find a new</span>
          <span>point of view.</span>
        </div>
      </div>
    </section>
  );
}
