// Detector rules for engineered-FOMO mechanics.
// Naming follows the FTC staff report "Bringing Dark Patterns to Light" (Sept 2022,
// Appendix A) where a regulatory name exists; stages follow the FOMOENGINE loop:
//   1 Signal · 2 Proof · 3 Cascade · 4 Amplify · 5 Money · 6 Validate
// Every rule is a pure regex — same input, same verdict, every time.

export interface Rule {
  id: string;
  name: string;
  stage: 1 | 2 | 3 | 4 | 5 | 6;
  bias: string;
  weight: number; // contribution per hit
  cap: number; // max counted hits (dampens pages that repeat one widget 50x)
  patterns: RegExp[];
  ref: string;
}

export const RULES: Rule[] = [
  {
    id: "baseless-countdown",
    name: "Countdown Timer",
    stage: 1,
    bias: "loss aversion / manufactured urgency",
    weight: 14,
    cap: 3,
    patterns: [
      /\b(ends?|expires?|closes?|left)\s+in[:\s]+\d{1,2}\s*[:hms]/i,
      /\b(offer|sale|deal|price)\b[^.\n]{0,50}\b\d{1,2}:\d{2}(:\d{2})?\b/i,
      /\bcountdown\b/i,
      /data-(countdown|timer|expires)/i,
      /\b(hurry|quick)[^.\n]{0,30}\b(ends?|expires?)\b/i,
    ],
    ref: "FTC 2022 App. A — 'Baseless Countdown Timer'; CMA OCA: resetting clocks measurably raise CTR/purchase",
  },
  {
    id: "false-low-stock",
    name: "Low Stock Message",
    stage: 1,
    bias: "loss aversion / scarcity",
    weight: 12,
    cap: 4,
    patterns: [
      /\bonly\s+\d+\s+(left|remaining|in\s+stock|available|seats?|rooms?|spots?|tickets?)\b/i,
      /\b(low|limited)\s+(stock|availability)\b/i,
      /\bselling\s+(out\s+)?fast\b/i,
      /\bwhile\s+(supplies|stocks?|they)\s+last\b/i,
      /\balmost\s+(gone|sold\s*out|full)\b/i,
      /\b\d+\s+(rooms?|seats?|spots?)\s+left\b/i,
    ],
    ref: "FTC 2022 App. A — 'False Low Stock Message'; Mathur et al. 2019 found these fabricated at scale",
  },
  {
    id: "false-activity",
    name: "Activity Message",
    stage: 2,
    bias: "social proof / conformity",
    weight: 13,
    cap: 3,
    patterns: [
      /\b\d+\s+(other\s+)?(people|users|customers|guests|shoppers)\s+(are\s+)?(viewing|looking|watching|browsing|shopping)\b/i,
      /\b(viewed|booked|bought|purchased|ordered)\s+\d+[\d,]*\s+times\s+(today|this|in\s+the\s+last)\b/i,
      /\bsomeone\s+(in\s+[\w\s]+\s+)?(just\s+)?(bought|purchased|booked|signed\s+up|subscribed)\b/i,
      /\blast\s+(booked|purchased|bought)\s+\d+\s+(minutes?|hours?)\s+ago\b/i,
    ],
    ref: "FTC 2022 App. A — 'False Activity Messages' ('24 other people are viewing this listing'); 22 vendors sell these as turnkey widgets (Mathur 2019)",
  },
  {
    id: "high-demand",
    name: "High Demand Claim",
    stage: 2,
    bias: "social proof / mimetic desire",
    weight: 9,
    cap: 3,
    patterns: [
      /\bin\s+(high|hot)\s+demand\b/i,
      /\bpopular\s+(right\s+now|choice|pick)\b/i,
      /\bmost\s+(wanted|requested)\b/i,
      /\bdemand\s+is\s+(high|surging|soaring)\b/i,
    ],
    ref: "FTC 2022 App. A — 'False High Demand'; CMA hotel-booking enforcement (2019)",
  },
  {
    id: "urgency-lexicon",
    name: "Loss-Framed Urgency Copy",
    stage: 1,
    bias: "loss aversion / reference-point framing",
    weight: 6,
    cap: 5,
    patterns: [
      /\b(last\s+chance|final\s+(hours?|days?|call)|act\s+(now|fast|today)|limited[-\s]time|ending\s+soon|expires\s+(today|tonight|soon)|now\s+or\s+never)\b/i,
      /\bdon'?t\s+(miss(\s+out)?|wait|sleep\s+on)\b/i,
      /\bbefore\s+it'?s\s+(too\s+late|gone)\b/i,
      /\bmiss(ing)?\s+out\b/i,
    ],
    ref: "Kahneman & Tversky 1979: reference points are externally settable; not acting is made to feel like loss",
  },
  {
    id: "drop-scarcity",
    name: "Engineered Drop / Gated Access",
    stage: 1,
    bias: "engineered scarcity / mimetic rivalry",
    weight: 8,
    cap: 4,
    patterns: [
      /\b(exclusive|limited)\s+(drop|release|edition|run|batch)\b/i,
      /\b(waitlist|wait\s+list|invite[-\s]only|early\s+access|members?[-\s]only)\b/i,
      /\bnever\s+(restocked|coming\s+back)\b/i,
      /\bonce\s+(it'?s|they'?re)\s+gone\b/i,
      /\braffle\b[^.\n]{0,40}\b(win|entry|enter)\b/i,
    ],
    ref: "Supreme's 600→400 doctrine (Jebbia 2009); Nike SNKRS met ~7% of $1.69B demand (leak, 2021)",
  },
  {
    id: "trending-signal",
    name: "Trending / Ranking Badge",
    stage: 4,
    bias: "cascade amplification — displayed popularity manufactures demand",
    weight: 7,
    cap: 4,
    patterns: [
      /\b(trending|going\s+viral|viral\s+(right\s+)?now)\b/i,
      /\b(best\s*seller|bestselling|top\s+rated|most\s+popular)\b/i,
      /#\s?\d+\s+(in|on)\s+\w/i,
      /\bas\s+seen\s+on\b/i,
      /\bcharting\b/i,
    ],
    ref: "Salganik/Watts 2006: visible rankings create hits; inverted (false) rankings became self-fulfilling (2008)",
  },
  {
    id: "join-the-crowd",
    name: "Crowd-Size Appeal",
    stage: 3,
    bias: "information cascade / conformity (d=0.89)",
    weight: 8,
    cap: 4,
    patterns: [
      /\bjoin\s+(over\s+)?\d[\d,.]*\s*(k|m|million|thousand)?\+?\s+(others|members|users|subscribers|customers|traders|readers|founders)\b/i,
      /\beveryone\s+(is|'s)\s+(talking\s+about|using|buying|switching|building)\b/i,
      /\btrusted\s+by\s+\d[\d,.]*/i,
      /\b\d[\d,.]*\s*(k|m|million)?\+?\s+(five[-\s]star|5[-\s]star)\s+reviews\b/i,
    ],
    ref: "BHW cascade math: mass convergence is near-zero evidence of quality (0.5133 vs 0.51)",
  },
  {
    id: "gains-proof",
    name: "Visible Gains / Results Proof",
    stage: 2,
    bias: "social proof of profits (GameStop mechanism)",
    weight: 9,
    cap: 3,
    patterns: [
      /\b(made|earned|turned)\s+\$?\d[\d,.]*(k|m)?\s+(in|into|within|last)\b/i,
      /\b\d{2,4}%\s+(gains?|returns?|profit|roi|apy)\b/i,
      /\b(to\s+the\s+moon|10x|100x)\b/i,
      /\bscreenshot\s+of\s+(gains?|profits?)\b/i,
    ],
    ref: "Klein 2021 (Finance Research Letters): posted gains of early investors triggered FOMO inflows",
  },
  {
    id: "platform-shift-fear",
    name: "Don't-Get-Left-Behind Narrative",
    stage: 5,
    bias: "reputational herding / share-the-blame",
    weight: 10,
    cap: 4,
    patterns: [
      /\b(can'?t|cannot)\s+afford\s+to\s+(miss|ignore|sit\s+out)\b/i,
      /\b(get\s+)?left\s+behind\b/i,
      /\b(arms|spending)\s+race\b/i,
      /\bnext\s+big\s+thing\b/i,
      /\bplatform\s+shift\b/i,
      /\bwindow\s+(is\s+)?closing\b/i,
      /\bearly\s+(adopters?|movers?)\s+(win|advantage|get)\b/i,
      /\bif\s+you'?re\s+not\s+(using|building|investing)\b/i,
    ],
    ref: "Scharfstein & Stein 1990: conventional failure is survivable, missing the wave is not — so everyone piles in",
  },
  {
    id: "validation-headline",
    name: "Record-Numbers-As-Proof",
    stage: 6,
    bias: "narrative contagion (Shiller) — headlines as new signal",
    weight: 7,
    cap: 4,
    patterns: [
      /\brecord\s+(spending|investment|quarter|adoption|demand|sales|highs?)\b/i,
      /\b(skeptics?|bears?|doubters?)\s+(are\s+)?(wrong|missing|in\s+denial|garbage)\b/i,
      /\bbear\s+(thesis|case)\s+is\b/i,
      /\bfastest[-\s]growing\b/i,
      /\bunprecedented\s+(demand|growth|adoption)\b/i,
    ],
    ref: "Stage-6 tell: the size of the bet becomes the argument for the bet; skeptics ridiculed, not refuted",
  },
];

export const STAGE_NAMES: Record<number, string> = {
  1: "Signal",
  2: "Proof",
  3: "Cascade",
  4: "Amplify",
  5: "Money",
  6: "Validate",
};
