"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Film, Heart, Search, Clapperboard, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useFavorites } from "@/components/AppProviders";

const links = [
  { href: "/", label: "Discover", Icon: Clapperboard },
  { href: "/browse", label: "Browse", Icon: Film },
  { href: "/favorites", label: "My list", Icon: Heart },
  { href: "/about", label: "About", Icon: Info },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { favorites } = useFavorites();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  function submitSearch(event) {
    event.preventDefault();
    const search = query.trim().slice(0, 100);
    router.push(search ? `/search?query=${encodeURIComponent(search)}` : "/");
    setMenuOpen(false);
  }

  return (
    <>
      <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true"><Film size={19} strokeWidth={2.2} /></span>
          <span>Movie Verse</span>
        </Link>
        <nav className="side-nav" id="primary-navigation" aria-label="Main navigation">
          <p className="nav-heading">Your cinema</p>
          {links.map(({ href, label, Icon }) => (
            <Link
              aria-current={pathname === href ? "page" : undefined}
              className={`nav-link${pathname === href ? " nav-link-active" : ""}`}
              href={href}
              key={href}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {href === "/favorites" && favorites.length > 0 ? (
                <span className="nav-count">{favorites.length}</span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="ticket-note">
            <span className="ticket-perforation" aria-hidden="true" />
            <p>Every film opens a different world.</p>
          </div>
          <span className="sidebar-credit">A little more wonder, one story at a time.</span>
        </div>
      </aside>
      {menuOpen ? (
        <button
          aria-label="Close navigation menu"
          className="sidebar-scrim"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <header className="topbar">
        <button
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span /><span />
        </button>
        <form className="top-search" onSubmit={submitSearch} role="search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="Search movies"
            autoComplete="off"
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search movie titles..."
            type="search"
            value={query}
          />
          <kbd>Enter</kbd>
        </form>
        <Link className="topbar-list" href="/favorites" aria-label={`My list, ${favorites.length} saved movies`}>
          <Heart size={18} aria-hidden="true" />
          <span>My list</span>
          {favorites.length ? <span className="topbar-count">{favorites.length}</span> : null}
        </Link>
      </header>
    </>
  );
}
