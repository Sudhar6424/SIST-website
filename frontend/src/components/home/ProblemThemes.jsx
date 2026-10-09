import { ArrowRight, Cpu, Globe, HeartPulse, Leaf, Lightbulb, ShieldCheck } from "lucide-react";
import { GOOGLE_REGISTRATION_FORM_URL } from "../../config/registration";

const themes = [
  {
    label: "UNRESTRICTED BREAKTHROUGH IDEAS",
    title: "OPEN INNOVATION",
    description: "Tackle real-world challenges across diverse domains. Formulate unconventional solutions, creative problem solving, and interdisciplinary high-impact prototypes.",
    icon: Lightbulb,
    tone: "orange",
  },
  {
    label: "DECENTRALIZED TRUST & DEFENSE",
    title: "BLOCKCHAIN & CYBERSECURITY",
    description: "Build next-generation cryptographic verification systems, zero-trust cybersecurity architectures, decentralized apps (dApps), smart contracts, and identity protection tools.",
    icon: ShieldCheck,
    tone: "cyan",
  },
  {
    label: "MEDTECH & CLINICAL INTELLIGENCE",
    title: "HEALTHCARE",
    description: "Innovate digital healthcare solutions, assistive technologies, patient monitoring algorithms, diagnostic assistance, and telemedicine workflows for modern care.",
    icon: HeartPulse,
    tone: "red",
  },
  {
    label: "INTELLIGENT SYSTEMS & GENAI",
    title: "AI & MACHINE LEARNING",
    description: "Develop advanced predictive models, generative AI applications, computer vision, natural language intelligence, and automated decision-making engines.",
    icon: Cpu,
    tone: "cyan",
  },
  {
    label: "GREEN TECH & CLIMATE ACTION",
    title: "SUSTAINABILITY DEVELOPMENT",
    description: "Create impactful solutions aligned with UN Sustainable Development Goals: renewable energy tracking, carbon footprint reduction, smart waste management, and conservation.",
    icon: Leaf,
    tone: "green",
  },
  {
    label: "MODERN FINANCE & EDUCATION TECH",
    title: "FINTECH & EDTECH",
    description: "Engineer financial accessibility tools, secure digital payment ecosystems, interactive educational platforms, digital learning tools, and intelligent financial technology.",
    icon: Globe,
    tone: "orange",
  },
];

export default function ProblemThemes() {
  return (
    <section className="home-dark-section home-themes" id="themes">
      <div className="home-section-inner">
        <header className="home-center-heading">
          <span className="home-pill"><i />COMPETITION DOMAINS</span>
          <h2>PROBLEM STATEMENT <em>THEMES.</em></h2>
          <p>Choose your challenge track. Formulate your solution around one of the six official DEXATHON 2026 innovation domains and prepare your Round 1 PPT.</p>
        </header>

        <div className="home-themes-grid">
          {themes.map(({ label, title, description, icon: Icon, tone }, index) => {
            const number = String(index + 1).padStart(2, "0");
            return (
              <article className={`home-theme-card is-${tone}`} key={title}>
                <div className="home-theme-top">
                  <b>[{number}]</b>
                  <span className="home-theme-icon"><Icon size={18} /></span>
                </div>
                <small>{label}</small>
                <h3>{title}</h3>
                <p>{description}</p>
                <footer>
                  <span>MISSION TRACK {number}</span>
                  <strong>SELECTABLE</strong>
                </footer>
              </article>
            );
          })}
        </div>

        <div className="home-themes-cta">
          <div>
            <strong>READY TO CHOOSE YOUR DOMAIN?</strong>
            <p>Register your team of 4–6 members and submit your Round 1 PPT abstract before 20 October 2026.</p>
          </div>
          <a href={GOOGLE_REGISTRATION_FORM_URL} target="_blank" rel="noopener noreferrer" className="home-cta-button">REGISTER YOUR TEAM NOW <ArrowRight size={16} /></a>
        </div>
      </div>
    </section>
  );
}
