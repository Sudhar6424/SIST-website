import { ArrowRight, CircleCheck, Clock3 } from "lucide-react";
import { GOOGLE_REGISTRATION_FORM_URL } from "../../config/registration";

const plans = [
  {
    badge: "NOW OPEN",
    stage: "ENTRY FEES",
    price: "₹300",
    unit: "/ TEAM",
    text: "Flat fee per team. Grants complete entry to Abstract PPT evaluation (Round 1) and Prototype submission (Round 2).",
    points: ["Team Size: 4–6 Members", "PPT Abstract Evaluation by Jury", "Prototype Submission Access (Round 2)", "E-Certificates for all Round 1 & 2 Participants"],
    tone: "orange",
  },
  {
    badge: "FOR FINALISTS",
    stage: "FINAL ROUND",
    price: "₹250",
    unit: "/ person",
    text: "Payable only after qualifying through Rounds 1 & 2 to confirm your physical finalist slot at Sathyabama campus.",
    points: ["Team Size: 4–6 Members", "24-Hour Physical Hackathon at Indoor Auditorium", "Food, Midnight Snacks & Accommodation Provided", "Physical Certificates for Final-Round Qualified Teams"],
    tone: "cyan",
  },
];

export default function JoinMission() {
  return (
    <section className="home-dark-section home-join" id="register">
      <div className="home-section-inner">
        <header className="home-center-heading">
          <span className="home-pill"><i />OFFICIAL REGISTRATION PORTAL</span>
          <h2>JOIN THE <em>MISSION.</em></h2>
          <p>Register your team for Round 1 &amp; Round 2. Progress through the competition and qualify for the prestigious 24-hour on-campus hackathon at Sathyabama.</p>
        </header>

        <div className="home-join-grid">
          {plans.map((plan) => (
            <article className={`home-plan-card is-${plan.tone}`} key={plan.stage}>
              <div className="home-plan-top">
                <span>{plan.badge}</span>
                <b>{plan.stage}</b>
              </div>
              <p className="home-plan-price"><strong>{plan.price}</strong> {plan.unit}</p>
              <p>{plan.text}</p>
              <ul>
                {plan.points.map((point) => <li key={point}><CircleCheck size={14} /> {point}</li>)}
              </ul>
            </article>
          ))}
        </div>

        <div className="home-join-bar">
          <p><Clock3 size={15} /> Round 1 Registration &amp; PPT Deadline: <strong>20 October 2026, 11:00 PM IST</strong></p>
          <a href={GOOGLE_REGISTRATION_FORM_URL} target="_blank" rel="noopener noreferrer" className="home-cta-button">REGISTER YOUR TEAM <ArrowRight size={16} /></a>
        </div>
      </div>
    </section>
  );
}
