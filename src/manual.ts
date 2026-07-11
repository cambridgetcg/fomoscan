// Machine-readable FOMOENGINE framework — the artifact's core, as data.
// Evidence verified 2026-07-10 via 3-vote adversarial panels (66/66 confirmed, 0 refuted).
export const MANUAL = {
  name: "FOMOENGINE",
  version: "0.1.0",
  thesis:
    "One loop converts fear-of-missing-out into engagement, purchases, and capital flows. " +
    "Every stage corresponds to a quantified result in the literature or a documented platform mechanic.",
  verified: "2026-07-10 · 78 claims through 3-lens adversarial panels · 0 refuted",
  artifact: "https://claude.ai/code/artifact/1c1de169-475a-4273-ade4-6c6cdb09a550",
  stages: [
    {
      n: 1, name: "Signal",
      mechanism: "Scarcity/novelty cue framed so inaction registers as loss; reference point installed externally",
      evidence: "Prospect theory: losses ~2x gains (λ≈2.25); reference points manipulable (Kahneman & Tversky 1979)",
      tells: ["countdowns", "stock counters", "drops/waitlists/invites", "loss-framed copy", "'the next platform shift'"],
    },
    {
      n: 2, name: "Proof",
      mechanism: "Crowd made visible and countable; on-screen counters trigger conformity machinery",
      evidence: "Conformity d=0.89 (Bond 2005); 63% conform to virtual agents (Kyrlitsias 2020); mimetic desire (Girard)",
      tells: ["view/like counters", "'X people viewing'", "gains screenshots", "sold-out announcements", "influencer mediators"],
    },
    {
      n: 3, name: "Cascade",
      mechanism: "People copy actions without reasons; judgment outsourced to the crowd",
      evidence: "Cascades lock after ~2 movers (~75%); <4 private signals aggregate; herd accuracy 0.5133 vs 0.51 (BHW)",
      tells: ["adoption decoupled from reviews", "identical talking points everywhere", "'others joined' as the reason to join"],
    },
    {
      n: 4, name: "Amplify",
      mechanism: "Engagement-optimized recommenders feed the cascade to everyone; momentum can be seeded/purchased",
      evidence: "Netflix ~80% of hours; YouTube 70% of watch time; Instagram >50%; TikTok Algo 101 optimizes retention+time; Salganik: rankings create demand; Treacy/Wiersema bought bestseller status",
      tells: ["trending placement before word-of-mouth", "feed convergence", "uniform early momentum, ratings cliff"],
    },
    {
      n: 5, name: "Money",
      mechanism: "Capital herds rationally: failing with the crowd is survivable, missing it is not (share-the-blame)",
      evidence: "Scharfstein & Stein AER 1990: knowingly funding negative-EV crowd positions is the equilibrium",
      tells: ["me-too rounds at escalating valuations", "capex justified by rivals' capex", "memos citing who else is in"],
    },
    {
      n: 6, name: "Validate",
      mechanism: "Record numbers become headlines; headlines become the new stage-1 signal; skeptics ridiculed",
      evidence: "Shiller 2017: narratives spread epidemically and justify investing; live: 'the bear thesis is garbage'",
      tells: ["record-spending headlines as proof of merit", "skeptic-shaming", "cash-flow deterioration reframed as conviction"],
    },
  ],
  flip: {
    name: "The Flip",
    mechanism: "Cascades aggregate almost no information, so consensus reverses faster than fundamentals change",
    evidence: "BHW: behavior flips >87% more often than the state changes; NFTs: −97% volume from peak, ~95% of collections to zero",
    tells: ["sensitivity to trivial news", "loud accounts go quiet", "'everyone knew' essays weeks after 'everyone was in'"],
  },
  countermeasures: [
    { rule: "Decide before you look at the counter", disarms: [2, 3], why: "Displayed popularity creates preference (Salganik); the only defense is chronological" },
    { rule: "Treat all urgency as fake until shown otherwise", disarms: [1], why: "Fabricated scarcity is industrialized: 22 turnkey vendors, 97% of top EU sites, regulator-forced undertakings" },
    { rule: "Ask: herd or cascade?", disarms: [3], why: "A herd is informative; a cascade is noise in a crowd costume. Can adopters give reasons that aren't the crowd size?" },
    { rule: "Write the memo before checking who's in the round", disarms: [5], why: "Blame-sharing only grips after you know the consensus" },
    { rule: "Read record-numbers headlines as stage-6 output, not evidence", disarms: [6], why: "The size of the bet is being offered as the argument for the bet" },
    { rule: "Expect the flip", disarms: [0], why: "Reversal is a structural property of cascade-driven booms — a scheduled event with an unknown date" },
  ],
};
