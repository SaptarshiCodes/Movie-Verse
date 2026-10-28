import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty-page">
      <p className="empty-mark">404</p>
      <h1>This film is off the reel.</h1>
      <p>We couldn’t find that page. It may have moved or the address may be wrong.</p>
      <Link className="button button-light" href="/">Back to discovery</Link>
    </section>
  );
}
