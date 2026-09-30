/**
 * WomenCare Core Cycle Mathematics & Prediction Engine
 * Pure Vanilla JavaScript implementation of cycle statistics, forecasting, and wellness inference
 */

const toISO = (d) => {
  if (typeof d === "string") return d;
  const y = d.getFullYear(),
        m = String(d.getMonth() + 1).padStart(2, "0"),
        day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fromISO = (s) => {
  if (!s) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

const diffDays = (isoA, isoB) => Math.round((fromISO(isoB) - fromISO(isoA)) / 86400000);
const todayISO = () => toISO(new Date());
const fmtLong = (iso) => fromISO(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const fmtShort = (iso) => fromISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
}

function cycleLengthsFromCycles(cycles) {
  if (!cycles || !cycles.length) return { sorted: [], lengths: [] };
  const sorted = [...cycles].sort((a, b) => (a.start < b.start ? -1 : 1));
  const lengths = [];
  for (let i = 1; i < sorted.length; i++) {
    lengths.push(diffDays(sorted[i - 1].start, sorted[i].start));
  }
  return { sorted, lengths };
}

function computeInsights(cycles) {
  if (!cycles || !cycles.length) return null;
  const { sorted, lengths } = cycleLengthsFromCycles(cycles);
  if (sorted.length === 0) return null;

  const last = sorted[sorted.length - 1];
  const periodDurations = sorted.filter(c => c.periodDuration).map(c => Number(c.periodDuration));

  const hasHistory = lengths.length > 0;
  const avgLen = hasHistory ? mean(lengths) : Number(last.cycleLengthEstimate) || 28;
  const medLen = hasHistory ? median(lengths) : avgLen;
  const sd = hasHistory ? stdev(lengths) : 0;
  const minLen = hasHistory ? Math.min(...lengths) : avgLen;
  const maxLen = hasHistory ? Math.max(...lengths) : avgLen;
  const avgPeriod = periodDurations.length ? Math.round(mean(periodDurations)) : Number(last.periodDuration) || 5;

  const currentDay = clamp(diffDays(last.start, todayISO()) + 1, 1, 400);

  // Weight recent cycles more heavily (60% recent vs 40% historical)
  let predictedLen = avgLen;
  if (lengths.length >= 2) {
    const recent = lengths.slice(-3);
    predictedLen = mean(recent) * 0.6 + avgLen * 0.4;
  }
  const nextStart = addDays(last.start, Math.round(predictedLen));
  const windowSpan = Math.max(2, Math.min(6, Math.round(sd) || (lengths.length < 2 ? 5 : 2)));
  const windowStart = addDays(nextStart, -windowSpan);
  const windowEnd = addDays(nextStart, windowSpan);

  let confidence;
  if (lengths.length === 0) {
    confidence = null;
  } else {
    const dataBonus = clamp((lengths.length - 1) * 12, 0, 40);
    const variabilityPenalty = clamp(sd * 5, 0, 45);
    confidence = Math.round(clamp(55 + dataBonus - variabilityPenalty, 35, 96));
  }

  const reliability = lengths.length >= 4 ? "high" : lengths.length >= 2 ? "medium" : "low";

  return {
    sorted, lengths, avgLen, medLen, sd, minLen, maxLen, avgPeriod,
    currentDay, nextStart, windowStart, windowEnd, confidence, reliability,
    last,
  };
}

const SYMPTOM_LIST = [
  { key: "cramps", label: "Cramps & Pelvic Pain", icon: "activity" },
  { key: "headache", label: "Headache / Migraine", icon: "zap" },
  { key: "bloating", label: "Abdominal Bloating", icon: "wind" },
  { key: "fatigue", label: "Fatigue & Low Energy", icon: "moon" },
  { key: "mood", label: "Mood Fluctuations", icon: "smile" },
  { key: "backpain", label: "Lower Back Discomfort", icon: "activity" },
  { key: "tenderness", label: "Breast Tenderness", icon: "heart" },
  { key: "nausea", label: "Nausea & Queasiness", icon: "thermometer" },
  { key: "appetite", label: "Appetite & Food Cravings", icon: "coffee" },
  { key: "acne", label: "Skin Breakouts / Acne", icon: "sparkles" },
  { key: "dizziness", label: "Dizziness or Lightheadedness", icon: "alertTriangle" },
  { key: "other", label: "Other Discomfort", icon: "info" },
];

const FLOW_LEVELS = ["Spotting", "Light", "Medium", "Heavy", "Very Heavy"];

const SYMPTOM_ADVICE = {
  cramps: "A warm compress on the lower abdomen, warm bath, gentle stretching, hydration, and adequate rest can relieve cramps. If pain is severe or worsening, consult a doctor.",
  headache: "Rest in a quiet, dim room, stay well hydrated, and avoid skipping meals. Consult a healthcare provider if severe or persistent.",
  bloating: "Gentle walking, warm chamomile or peppermint tea, and reducing high-sodium meals can ease bloating.",
  fatigue: "Prioritize 8 hours of restorative sleep, regular balanced meals, and light movement.",
  mood: "Slow breathing, meditation, and structured sleep help maintain emotional balance during hormonal shifts.",
  backpain: "Gentle spinal stretches (such as child's pose) and a heating pad applied to the lower back can provide relief.",
  tenderness: "Wear a soft, supportive, non-wired bra and reduce excess caffeine intake.",
  nausea: "Sip warm ginger tea, stay hydrated in small sips, and eat light, bland meals.",
  appetite: "Focus on complex carbohydrates, leafy greens, and protein to stabilize blood sugar.",
  acne: "Maintain a gentle, non-comedogenic skincare routine and avoid touching or picking at blemishes.",
  dizziness: "Sit or lie down immediately, hydrate with electrolyte water, and rest. If it continues or fainting occurs, seek prompt medical care.",
};

const AYURVEDA_ADVICE = {
  cramps: "Warm sesame oil gentle massage and drinking warm water infused with ajwain or ginger.",
  headache: "Warm cumin (jeera) water and rest in a calm, dimly lit atmosphere.",
  bloating: "Warm jeera or ajwain tea and light, freshly cooked warm meals.",
  fatigue: "Warm, nourishing spiced milk with turmeric and adequate afternoon rest.",
  mood: "Pranayama (deep alternate nostril breathing) and gentle meditation.",
  backpain: "Warm herbal compresses and gentle restorative yoga postures.",
  tenderness: "Rest and wearing loose, breathable natural fiber clothing.",
  nausea: "Fresh ginger infused in warm water with a touch of mint.",
  appetite: "Warm, grounding home-cooked meals prepared with digestive spices.",
  acne: "Drinking plenty of pure water and gentle aloe vera soothing care.",
  dizziness: "Immediate rest, hydration with warm fluids, and comfortable reclining.",
};

function deriveWellness(ctx) {
  const urgent = [], medical = [], symptom = [], lifestyle = [], cycle = [], ayurveda = [];
  const symptomMap = {};
  (ctx.symptoms || []).forEach(s => { symptomMap[s.key] = s.severity; });
  const severities = Object.values(symptomMap);
  const maxSeverity = severities.length ? Math.max(...severities) : 0;
  const hasDizziness = "dizziness" in symptomMap;
  const heavyFlow = ctx.heaviestFlow === "Heavy" || ctx.heaviestFlow === "Very Heavy";
  const prolongedBleeding = ctx.periodDuration && ctx.avgPeriod && ctx.periodDuration > ctx.avgPeriod + 3 && ctx.periodDuration >= 8;

  const urgentTriggered = ctx.veryHeavyDays >= 2 || prolongedBleeding || maxSeverity >= 9
    || (hasDizziness && (heavyFlow || maxSeverity >= 8)) || ctx.concern === "severe";

  if (urgentTriggered) {
    urgent.push({ icon: "alertTriangle", text: "Some symptoms you entered may need medical attention. If pain is severe or accompanied by fainting/heavy bleeding, please consult a healthcare provider." });
    medical.push({ icon: "stethoscope", text: "Your health is paramount. Predictions are estimates for wellness awareness and do not replace professional medical evaluations." });
  } else if (heavyFlow) {
    symptom.push({ icon: "droplet", text: "You reported heavier bleeding than usual. Continue tracking your flow. If bleeding requires changing pads every hour or causes weakness, consult a doctor." });
  }

  Object.entries(symptomMap).forEach(([key, severity]) => {
    if (SYMPTOM_ADVICE[key]) {
      if (key === "dizziness" || severity >= 6) {
        symptom.push({ icon: "activity", text: SYMPTOM_ADVICE[key] });
      }
    }
    if (AYURVEDA_ADVICE[key]) {
      ayurveda.push({ icon: "leaf", text: AYURVEDA_ADVICE[key] });
    }
  });

  if (ctx.sleep && ctx.sleep < 7) {
    lifestyle.push({ icon: "moon", text: "Your recorded sleep is under 7 hours. Prioritizing rest helps reduce menstrual fatigue and cramp sensitivity." });
  }
  if (ctx.stress === "High") {
    lifestyle.push({ icon: "sparkles", text: "High stress detected. Gentle breathing exercises and unplugging from screens can promote relaxation." });
    ayurveda.push({ icon: "leaf", text: "Pranayama and quiet meditation are traditional practices that nurture nervous system balance." });
  }
  if (ctx.water && ctx.water < 2) {
    lifestyle.push({ icon: "droplets", text: "Your water intake is below recommended levels. Staying hydrated significantly reduces bloating and headaches." });
  }

  const dedupe = (arr) => arr.filter((a, i, self) => self.findIndex(x => x.text === a.text) === i);

  return {
    urgent: dedupe(urgent).slice(0, 1),
    medical: dedupe(medical).slice(0, 2),
    symptom: dedupe(symptom).slice(0, 4),
    lifestyle: dedupe(lifestyle).slice(0, 3),
    cycle: dedupe(cycle).slice(0, 2),
    ayurveda: dedupe(ayurveda).slice(0, 4),
    hasAnySymptom: Object.keys(symptomMap).length > 0,
  };
}
