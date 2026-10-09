import {
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  FileText,
  Home,
  Layers,
  Mail,
  Menu,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { GOOGLE_REGISTRATION_FORM_URL } from "../config/registration";

// Each item scrolls to its section on the Home page.
const navItems = [
  { label: "HOME", href: "#home", icon: Home },
  { label: "ABOUT", href: "#about", icon: CircleUserRound },
  { label: "THEMES", href: "#themes", icon: Layers },
  { label: "FINAL SPRINT", href: "#final-round", icon: ShieldCheck },
  { label: "RULES", href: "#rules", icon: FileText },
  { label: "PRIZES", href: "#prizes", icon: Trophy },
  { label: "SCHEDULE", href: "#schedule", icon: CalendarDays },
  { label: "CONTACT", href: "#contact", icon: Mail },
];

export default function MainNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header className="home-navbar">
      <div className="home-navbar-inner">
        <a className="home-brand" href="#home" aria-label="DEXATHON 2026 home">
          <span className="home-brand-mark" aria-hidden="true"><i className="home-brand-ball"><b /></i></span>
          <span className="home-brand-text">
            <strong>DEXATHON <em>2026</em></strong>
            <small>24-HOUR AI HACKATHON</small>
          </span>
        </a>

        <nav className="home-nav-links" aria-label="Home sections">
          {navItems.map(({ label, href, icon: Icon }) => (
            <a href={href} key={label}><Icon size={15} /><span>{label}</span></a>
          ))}
        </nav>

        <a className="home-register" href={GOOGLE_REGISTRATION_FORM_URL} target="_blank" rel="noopener noreferrer">REGISTER NOW <ChevronRight size={17} /></a>

        <button
          type="button"
          className="home-menu-button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="home-mobile-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen ? (
        <nav id="home-mobile-menu" className="home-mobile-menu" aria-label="Mobile navigation">
          {navItems.map(({ label, href, icon: Icon }) => (
            <a href={href} key={label} onClick={() => setMenuOpen(false)}><Icon size={15} /><span>{label}</span></a>
          ))}
          <a className="home-mobile-register" href={GOOGLE_REGISTRATION_FORM_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>REGISTER NOW <ChevronRight size={17} /></a>
        </nav>
      ) : null}
    </header>
  );
}
