/**
 * WomenCare Tracker UI Controller
 * Manages full interactive tracker state, DOM rendering, views, and PHP/SQLite sync
 */

const STORAGE_KEY = "period-tracker-data";
const USER_ID_KEY = "period-tracker-user-id";
const API_URL = "api/user.php";

function getOrInitUserId() {
  if (typeof Auth !== 'undefined' && Auth.getUser && Auth.getUser()) {
    return Auth.getUser().userId;
  }
  return null;
}

window.addEventListener('wc-auth-changed', async (e) => {
  await loadData();
  if (typeof window._pendingAuthSuccess === 'function') {
    const fn = window._pendingAuthSuccess;
    window._pendingAuthSuccess = null;
    fn();
  } else {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      if (appData.cycles && appData.cycles.length > 0) {
        currentView = "dashboard";
      } else {
        currentView = "onboard-1";
      }
    } else {
      currentView = "dashboard";
    }
    renderTracker();
  }
});

let appData = {
  onboarded: false,
  profile: {},
  cycles: [],
  symptomLogs: [],
  lifestyleLogs: []
};

function getViewFromLocation() {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (v) return v.toLowerCase();
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash && ["dashboard", "history", "symptoms", "ovulation", "ayurveda", "record", "today", "privacy"].includes(hash)) {
      return hash;
    }
  } catch (e) {}
  return "dashboard";
}

let currentView = getViewFromLocation();
let draftProfile = {};
let draftCycle = {};
let draftSymptoms = {};
let draftConcern = "";
let editingCycle = null;
let calendarMonthOffset = 0;
let saveStatus = "idle"; // idle, saving, success, error

async function loadData() {
  // If user is not logged in, do not load or expose local cycle logs
  if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
    appData = {
      onboarded: false,
      profile: {},
      cycles: [],
      symptomLogs: [],
      lifestyleLogs: []
    };
    return;
  }

  const uid = getOrInitUserId();
  if (!uid) return;

  // Load from User-scoped LocalStorage first
  try {
    const local = localStorage.getItem(`${STORAGE_KEY}_${uid}`) || localStorage.getItem(STORAGE_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && typeof parsed === 'object') {
        appData = parsed;
      }
    }
  } catch (e) {
    console.warn("LocalStorage load failed:", e);
  }

  // Then attempt backend sync
  try {
    const res = await fetch(`${API_URL}?userId=${uid}`);
    if (res.ok) {
      const json = await res.json();
      if (json && typeof json === 'object') {
        appData = json;
        try {
          localStorage.setItem(`${STORAGE_KEY}_${uid}`, JSON.stringify(appData));
        } catch (err) {}
      }
    }
  } catch (e) {
    console.warn("Backend API sync skipped:", e);
  }
}

async function persistData(nextData) {
  // Disallow saving if user is not authenticated
  if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
    Auth.openModal('signin', 'Please sign in or create a free account to save your cycle records.');
    return;
  }

  const uid = getOrInitUserId();
  if (!uid) {
    Auth.openModal('signin', 'Please sign in to save your cycle data.');
    return;
  }

  appData = nextData;
  showSaveIndicator("saving");

  // User-scoped LocalStorage backup
  try {
    localStorage.setItem(`${STORAGE_KEY}_${uid}`, JSON.stringify(appData));
  } catch (e) {}

  // Sync to PHP SQLite backend
  try {
    const res = await fetch(`${API_URL}?userId=${uid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(appData)
    });
    if (res.ok) {
      showSaveIndicator("success");
    } else {
      showSaveIndicator("error");
    }
  } catch (e) {
    console.warn("Backend sync failed:", e);
    showSaveIndicator("error");
  }
}

function showSaveIndicator(status) {
  saveStatus = status;
  let toast = document.getElementById("wc-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "wc-toast";
    toast.className = "fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-xs font-bold z-50 transition-all shadow-lg text-white pointer-events-none";
    document.body.appendChild(toast);
  }

  if (status === "saving") {
    toast.className = "fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-xs font-bold z-50 bg-[#3B2531] text-white shadow-lg flex items-center gap-2";
    toast.innerHTML = `${getIcon('refresh', 14, '#ffffff')} Saving changes...`;
    toast.style.display = "flex";
  } else if (status === "success") {
    toast.className = "fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-xs font-bold z-50 bg-[#7FAE8C] text-white shadow-lg flex items-center gap-2";
    toast.innerHTML = `${getIcon('check', 14, '#ffffff')} Saved successfully`;
    setTimeout(() => { if (saveStatus === "success") toast.style.display = "none"; }, 2500);
  } else if (status === "error") {
    toast.className = "fixed bottom-20 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-xs font-bold z-50 bg-[#C1436A] text-white shadow-lg flex items-center gap-2";
    toast.innerHTML = `${getIcon('info', 14, '#ffffff')} Saved locally (offline)`;
    setTimeout(() => { if (saveStatus === "error") toast.style.display = "none"; }, 3000);
  }
}

function navigateTo(view) {
  // If user is not logged in and tries to access private cycle tracker views:
  if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
    const isPublic = (view === "ovulation" || view === "ayurveda" || view === "privacy");
    if (!isPublic) {
      window._pendingAuthSuccess = () => { navigateTo(view); };
      Auth.openModal('signin', 'Please sign in or create an account to access the Cycle Tracker.');
      currentView = "dashboard";
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("view");
        window.history.pushState({ view: "dashboard" }, "", url.toString());
      } catch (e) {}
      renderTracker();
      return;
    }
  }

  currentView = view;
  try {
    const url = new URL(window.location.href);
    if (view === "dashboard") {
      url.searchParams.delete("view");
    } else {
      url.searchParams.set("view", view);
    }
    window.history.pushState({ view }, "", url.toString());
  } catch (e) {}
  window.scrollTo({ top: 0, behavior: "smooth" });
  renderTracker();
}

window.addEventListener("popstate", (e) => {
  if (e.state && e.state.view) {
    currentView = e.state.view;
  } else {
    currentView = getViewFromLocation();
  }
  renderTracker();
});

function loadSampleCycles() {
  if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
    Auth.openModal('signin', 'Please sign in or create an account to load cycle predictions.');
    return;
  }

  const cycle1Start = addDays(todayISO(), -56);
  const cycle1End = addDays(cycle1Start, 5);
  const cycle2Start = addDays(todayISO(), -28);
  const cycle2End = addDays(cycle2Start, 4);
  const cycle3Start = todayISO();

  persistData({
    ...appData,
    onboarded: true,
    cycles: [
      { id: 1, start: cycle1Start, end: cycle1End, periodDuration: 5, cycleLengthEstimate: 28, regularity: "Regular" },
      { id: 2, start: cycle2Start, end: cycle2End, periodDuration: 4, cycleLengthEstimate: 28, regularity: "Regular" },
      { id: 3, start: cycle3Start, end: null, periodDuration: 5, cycleLengthEstimate: 28, regularity: "Regular" }
    ]
  });
  navigateTo("dashboard");
}

function renderTracker() {
  const container = document.getElementById("tracker-root");
  if (!container) return;

  // Unauthenticated Guard: User must sign in for cycle tracking features
  const isLoggedIn = (typeof Auth !== 'undefined') && Auth.isLoggedIn();

  if (!isLoggedIn) {
    // Only standalone educational calculators are accessible publicly
    if (currentView === "ovulation") {
      container.innerHTML = renderOvulationPage(null);
      setupOvulationPageEvents();
      renderAllIcons();
      return;
    }
    if (currentView === "ayurveda") {
      container.innerHTML = renderAyurvedaPage();
      setupAyurvedaPageEvents();
      renderAllIcons();
      return;
    }
    if (currentView === "privacy") {
      container.innerHTML = renderPrivacyPage();
      setupPrivacyPageEvents();
      renderAllIcons();
      return;
    }

    // Default for unauthenticated users: Sign-In Protected Landing Gate
    container.innerHTML = renderAuthGateLanding();
    setupAuthGateEvents();
    renderAllIcons();
    return;
  }

  // Authenticated user: Load computed insights
  const insights = (appData.cycles && appData.cycles.length) ? computeInsights(appData.cycles) : null;

  // Direct Feature Tool Views (Accessible directly from URLs or footer links)
  if (currentView === "ovulation") {
    container.innerHTML = renderOvulationPage(insights);
    setupOvulationPageEvents();
    renderAllIcons();
    return;
  }
  if (currentView === "history") {
    container.innerHTML = renderHistoryPage();
    setupHistoryPageEvents();
    renderAllIcons();
    return;
  }
  if (currentView === "symptoms") {
    container.innerHTML = renderSymptomTracker(false);
    setupSymptomTrackerEvents((selected, concern) => {
      const list = Object.entries(selected).map(([key, severity]) => ({ key, severity }));
      const newLog = { date: todayISO(), symptoms: list, concern: concern || "" };
      persistData({ ...appData, symptomLogs: [...(appData.symptomLogs || []), newLog] });
      navigateTo("dashboard");
    }, false);
    renderAllIcons();
    return;
  }
  if (currentView === "ayurveda") {
    container.innerHTML = renderAyurvedaPage();
    setupAyurvedaPageEvents();
    renderAllIcons();
    return;
  }
  if (currentView === "record") {
    container.innerHTML = renderPeriodForm("Log Period", "Record your recent cycle to keep predictions accurate.", {}, "Save Period");
    setupPeriodFormEvents((period) => {
      const nextId = (appData.cycles && appData.cycles.length) ? Math.max(...appData.cycles.map(c => c.id || 1)) + 1 : 1;
      const newCycle = { id: nextId, ...period };
      persistData({ ...appData, onboarded: true, cycles: [...(appData.cycles || []), newCycle] });
      navigateTo("dashboard");
    });
    renderAllIcons();
    return;
  }
  if (currentView === "today") {
    container.innerHTML = renderUpdateToday(insights);
    setupUpdateTodayEvents((formData) => {
      const newLog = { date: todayISO(), ...formData };
      persistData({ ...appData, lifestyleLogs: [...(appData.lifestyleLogs || []), newLog] });
      navigateTo("dashboard");
    });
    renderAllIcons();
    return;
  }
  if (currentView === "privacy") {
    container.innerHTML = renderPrivacyPage();
    setupPrivacyPageEvents();
    renderAllIcons();
    return;
  }

  // Onboarding Routing (When logged-in user hasn't recorded cycles yet)
  if (!appData.onboarded || !appData.cycles || appData.cycles.length === 0) {
    if (currentView === "onboard-2") {
      container.innerHTML = renderPeriodForm("Tell Us About Your Period", "A few dates help us predict your cycle window accurately.", draftCycle, "Continue to Symptoms");
      setupPeriodFormEvents((data) => {
        draftCycle = data;
        navigateTo("onboard-3");
      });
      renderAllIcons();
      return;
    } else if (currentView === "onboard-3") {
      container.innerHTML = renderSymptomTracker(true);
      setupSymptomTrackerEvents((symptoms, concern) => {
        draftSymptoms = symptoms;
        draftConcern = concern;
        navigateTo("onboard-4");
      }, true);
      renderAllIcons();
      return;
    } else if (currentView === "onboard-4") {
      container.innerHTML = renderOnboardingResults();
      setupOnboardingResultsEvents();
      renderAllIcons();
      return;
    } else {
      // Default step for new user: Setup Cycle Profile
      container.innerHTML = renderOnboardingProfile();
      setupOnboardingProfileEvents();
      renderAllIcons();
      return;
    }
  }

  // Dashboard (Authenticated & Onboarded user)
  container.innerHTML = renderDashboard(insights);
  setupDashboardEvents();
  renderAllIcons();
}

/* ==========================================================================
   VIEW TEMPLATES
   ========================================================================== */

function renderAuthGateLanding() {
  return `
    <div class="max-w-xl mx-auto pt-4 sm:pt-6 pb-12 px-4 text-center">
      
      <!-- Brand Logo Header -->
      <div class="mb-5 flex justify-center">
        <div class="px-5 py-3 bg-white rounded-2xl shadow-xs border border-pink-100 flex items-center justify-center hover:scale-105 transition-transform">
          <img src="assets/images/Firefly.png" alt="WOmenCare Logo" class="h-10 sm:h-12 w-auto object-contain">
        </div>
      </div>

      <!-- Trust Badge -->
      <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-pink-100/90 text-pink-700 mb-3 border border-pink-200/80 shadow-2xs">
        <span data-icon="lock" data-size="13" data-color="#C1436A"></span>
        <span>Secure & Private Cycle Tracker</span>
      </div>

      <h1 class="text-2xl sm:text-3xl font-bold font-serif text-[#3B2531] mb-2 leading-tight">
        Private & Intelligent Menstrual Care
      </h1>
      <p class="text-xs sm:text-sm text-[#8A6575] max-w-md mx-auto mb-7 leading-relaxed">
        Sign in to unlock personalized cycle predictions, multi-month calendar forecasting, ovulation detection, and secure cloud sync.
      </p>

      <!-- Primary Action Cards (Proper Icon + Title Row & Balanced Content) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-7">
        
        <!-- Sign In Card -->
        <button type="button" id="btn-gate-signin" class="wc-card p-5 sm:p-6 text-left rounded-3xl transition-all duration-200 group cursor-pointer bg-gradient-to-br from-[#DD5C82] via-[#C1436A] to-[#9E284D] text-white shadow-md hover:shadow-xl hover:-translate-y-0.5 border border-pink-300/30 flex flex-col justify-between">
          <div class="w-full text-left">
            <div class="flex items-center gap-3.5 mb-3.5 text-left">
              <div class="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm text-white flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                <span data-icon="logIn" data-size="20" data-color="#ffffff"></span>
              </div>
              <div class="text-left">
                <span class="inline-block text-[10px] uppercase font-bold tracking-wider text-pink-100 bg-white/15 px-2 py-0.5 rounded-full mb-1">Returning User</span>
                <h3 class="font-bold text-base sm:text-lg text-white font-serif leading-tight">Sign In to Tracker</h3>
              </div>
            </div>
            <p class="text-xs text-white/85 leading-relaxed text-left">
              Already have an account? Sync your cycles and health diary instantly across all devices.
            </p>
          </div>
          
          <div class="w-full mt-5 pt-3.5 border-t border-white/20 flex items-center justify-between text-xs font-bold text-white">
            <span>Access My Dashboard</span>
            <span class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-all">
              <span data-icon="chevronRight" data-size="14" data-color="#ffffff"></span>
            </span>
          </div>
        </button>

        <!-- Create Free Account Card -->
        <button type="button" id="btn-gate-register" class="wc-card p-5 sm:p-6 text-left rounded-3xl transition-all duration-200 group cursor-pointer bg-white border-2 border-pink-200 text-[#3B2531] shadow-xs hover:shadow-xl hover:-translate-y-0.5 hover:border-pink-400 flex flex-col justify-between">
          <div class="w-full text-left">
            <div class="flex items-center gap-3.5 mb-3.5 text-left">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-50 to-rose-100 text-pink-700 flex items-center justify-center shrink-0 border border-pink-200/60 shadow-2xs group-hover:scale-105 transition-transform">
                <span data-icon="userPlus" data-size="20" data-color="#C1436A"></span>
              </div>
              <div class="text-left">
                <span class="inline-block text-[10px] uppercase font-bold tracking-wider text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full mb-1 border border-pink-100">100% Free & Private</span>
                <h3 class="font-bold text-base sm:text-lg text-[#3B2531] group-hover:text-pink-600 transition-colors font-serif leading-tight">Create Free Account</h3>
              </div>
            </div>
            <p class="text-xs text-[#8A6575] leading-relaxed text-left">
              New to WOmenCare? Setup your cycle profile in less than 1 minute with smart predictions.
            </p>
          </div>

          <div class="w-full mt-5 pt-3.5 border-t border-pink-100 flex items-center justify-between text-xs font-bold text-pink-600">
            <span>Get Started Free</span>
            <span class="w-6 h-6 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center group-hover:translate-x-1 group-hover:bg-pink-600 group-hover:text-white transition-all">
              <span data-icon="chevronRight" data-size="14" data-color="#DD5C82"></span>
            </span>
          </div>
        </button>

      </div>

      <!-- Feature Grid -->
      <div class="wc-card p-5 sm:p-6 text-left space-y-4 mb-6 bg-white/95 shadow-xs">
        <h3 class="font-serif font-bold text-sm text-[#3B2531] uppercase tracking-wider text-center sm:text-left">
          What You Get With WOmenCare Tracker
        </h3>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-pink-100">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center shrink-0 mt-0.5">
              <span data-icon="calendar" data-size="16" data-color="#DD5C82"></span>
            </div>
            <div>
              <h4 class="font-bold text-xs text-[#3B2531]">Multi-Month Forecast</h4>
              <p class="text-[11px] text-[#8A6575]">Browse current & upcoming cycle windows up to 12 months ahead.</p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
              <span data-icon="sparkles" data-size="16" data-color="#C1436A"></span>
            </div>
            <div>
              <h4 class="font-bold text-xs text-[#3B2531]">Ovulation & Fertile Windows</h4>
              <p class="text-[11px] text-[#8A6575]">Precise phase detection for natural family planning.</p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
              <span data-icon="activity" data-size="16" data-color="#7A5C82"></span>
            </div>
            <div>
              <h4 class="font-bold text-xs text-[#3B2531]">Symptom & Mood Diary</h4>
              <p class="text-[11px] text-[#8A6575]">Log cramps, flow, energy, and sleep with severity ratings.</p>
            </div>
          </div>

          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <span data-icon="shield" data-size="16" data-color="#059669"></span>
            </div>
            <div>
              <h4 class="font-bold text-xs text-[#3B2531]">End-to-End Privacy</h4>
              <p class="text-[11px] text-[#8A6575]">Zero ads, zero data selling. Your health logs are strictly private.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Educational Alternative Navigation -->
      <div class="p-4 rounded-2xl bg-pink-50/70 border border-pink-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
        <div>
          <div class="font-bold text-xs text-[#3B2531]">Want to explore before signing in?</div>
          <div class="text-[11px] text-[#8A6575]">Read our curated menstrual guides and wellness tips.</div>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <button id="btn-gate-ovul" class="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-[#5A3C4A] border border-pink-200 hover:border-pink-400 transition-colors shadow-2xs">
            Quick Ovulation Tool
          </button>
          <a href="period-tips.html" class="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-pink-600 text-white hover:bg-pink-700 transition-colors text-center shadow-2xs">
            Period Guide
          </a>
        </div>
      </div>

    </div>
  `;
}

function setupAuthGateEvents() {
  document.getElementById("btn-gate-signin")?.addEventListener("click", () => {
    Auth.openModal('signin', 'Sign in to access your secure Cycle Tracker.');
  });
  document.getElementById("btn-gate-register")?.addEventListener("click", () => {
    Auth.openModal('register');
  });
  document.getElementById("btn-gate-ovul")?.addEventListener("click", () => {
    navigateTo("ovulation");
  });
}

function renderWelcomeLanding() {
  return renderAuthGateLanding();
}

function setupWelcomeLandingEvents() {
  setupAuthGateEvents();
}

function renderOnboardingProfile() {
  return `
    <div class="max-w-md mx-auto pt-1 pb-6 px-4">
      <div class="text-center mb-5">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pink-100 text-pink-700 mb-2">
          ${getIcon('user', 14)} Step 1 of 3
        </span>
        <h2 class="text-2xl font-bold font-serif text-[#3B2531]">Let's Get to Know Your Cycle</h2>
        <p class="text-xs text-[#8A6575] mt-1">A few details help us calibrate accurate predictions. Only age is required.</p>
      </div>

      <div class="wc-card p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Nickname (Optional)</label>
          <input type="text" id="prof-nickname" class="wc-input" placeholder="What should we call you?" value="${draftProfile.nickname || ''}">
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Age <span class="text-pink-600">*</span></label>
          <input type="number" id="prof-age" class="wc-input" placeholder="e.g. 24" min="8" max="70" value="${draftProfile.age || ''}">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Weight (kg)</label>
            <input type="number" id="prof-weight" class="wc-input" placeholder="e.g. 55" value="${draftProfile.weight || ''}">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Height (cm)</label>
            <input type="number" id="prof-height" class="wc-input" placeholder="e.g. 165" value="${draftProfile.height || ''}">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Daily Water Intake (L)</label>
          <input type="number" step="0.1" id="prof-water" class="wc-input" placeholder="e.g. 2.0" value="${draftProfile.water || ''}">
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Dietary Habit</label>
          <div class="flex flex-wrap gap-2" id="prof-diet-chips">
            ${["Vegetarian", "Non-Vegetarian", "Vegan", "Other"].map(d => `
              <button type="button" class="wc-chip ${draftProfile.diet === d ? 'active' : ''}" data-val="${d}">${d}</button>
            `).join('')}
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Activity Level</label>
          <div class="flex flex-wrap gap-2" id="prof-activity-chips">
            ${["Low", "Moderate", "High"].map(a => `
              <button type="button" class="wc-chip ${draftProfile.activity === a ? 'active' : ''}" data-val="${a}">${a}</button>
            `).join('')}
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Average Sleep (Hours/Night)</label>
          <input type="number" step="0.5" id="prof-sleep" class="wc-input" placeholder="e.g. 7.5" value="${draftProfile.sleep || ''}">
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Typical Stress Level</label>
          <div class="flex flex-wrap gap-2" id="prof-stress-chips">
            ${["Low", "Moderate", "High"].map(s => `
              <button type="button" class="wc-chip ${draftProfile.stress === s ? 'active' : ''}" data-val="${s}">${s}</button>
            `).join('')}
          </div>
        </div>

        <div id="prof-error" class="text-xs font-bold text-red-600 hidden"></div>

        <button id="btn-prof-continue" class="w-full wc-btn-primary mt-6">
          Continue to Period Details ${getIcon('arrowRight', 18, '#ffffff')}
        </button>
      </div>
    </div>
  `;
}

function setupOnboardingProfileEvents() {
  function setupChipGroup(containerId, stateKey) {
    document.querySelectorAll(`#${containerId} .wc-chip`).forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(`#${containerId} .wc-chip`).forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        draftProfile[stateKey] = chip.getAttribute('data-val');
      });
    });
  }

  setupChipGroup("prof-diet-chips", "diet");
  setupChipGroup("prof-activity-chips", "activity");
  setupChipGroup("prof-stress-chips", "stress");

  document.getElementById("btn-prof-continue")?.addEventListener("click", () => {
    if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
      Auth.openModal('signin', 'Please sign in or create an account to calibrate your cycle profile.');
      return;
    }

    const age = parseInt(document.getElementById("prof-age").value, 10);
    const errEl = document.getElementById("prof-error");

    if (!age || isNaN(age) || age < 8 || age > 70) {
      errEl.textContent = "Please enter a valid age between 8 and 70.";
      errEl.classList.remove("hidden");
      return;
    }

    draftProfile.nickname = document.getElementById("prof-nickname").value.trim();
    draftProfile.age = age;
    draftProfile.weight = parseFloat(document.getElementById("prof-weight").value) || null;
    draftProfile.height = parseFloat(document.getElementById("prof-height").value) || null;
    draftProfile.water = parseFloat(document.getElementById("prof-water").value) || null;
    draftProfile.sleep = parseFloat(document.getElementById("prof-sleep").value) || null;

    navigateTo("onboard-2");
  });
}

function renderPeriodForm(title, subtitle, initial = {}, submitLabel = "Save Period") {
  return `
    <div class="max-w-md mx-auto pt-1 pb-6 px-4">
      <div class="flex items-center gap-3 mb-4">
        <button id="btn-form-back" class="md:hidden p-2 rounded-xl bg-white border border-[#F5DCE4] text-[#5A3C4A] hover:bg-pink-50 cursor-pointer">
          ${getIcon('chevronLeft', 20)}
        </button>
        <div>
          <h2 class="text-2xl font-bold font-serif text-[#3B2531]">${title}</h2>
          ${subtitle ? `<p class="text-xs text-[#8A6575]">${subtitle}</p>` : ''}
        </div>
      </div>

      <div class="wc-card p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Period Start Date <span class="text-pink-600">*</span></label>
          <input type="date" id="cycle-start" class="wc-input" max="${todayISO()}" value="${initial.start || ''}">
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Period End Date (Optional)</label>
          <input type="date" id="cycle-end" class="wc-input" max="${todayISO()}" value="${initial.end || ''}">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Bleeding Days <span class="text-pink-600">*</span></label>
            <input type="number" id="cycle-period-dur" class="wc-input" placeholder="e.g. 5" min="2" max="15" value="${initial.periodDuration || 5}">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Avg Cycle Length <span class="text-pink-600">*</span></label>
            <input type="number" id="cycle-len-est" class="wc-input" placeholder="e.g. 28" min="15" max="60" value="${initial.cycleDuration || 28}">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Cycle Regularity</label>
          <div class="flex flex-wrap gap-2" id="cycle-regularity-chips">
            ${["Regular", "Sometimes irregular", "Usually irregular", "Don't know"].map(r => `
              <button type="button" class="wc-chip ${initial.regularity === r ? 'active' : ''}" data-val="${r}">${r}</button>
            `).join('')}
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Ovulation Date (Optional)</label>
          <input type="date" id="cycle-ovulation" class="wc-input" max="${todayISO()}" value="${initial.ovulationDate || ''}">
        </div>

        <div id="flow-by-day-container" class="space-y-3 pt-2 border-t border-[#F5DCE4]">
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider">Daily Flow Intensity</label>
          <div id="flow-days-list" class="space-y-2"></div>
        </div>

        <div id="cycle-error" class="text-xs font-bold text-red-600 hidden"></div>

        <button id="btn-cycle-submit" class="w-full wc-btn-primary mt-6">
          ${submitLabel} ${getIcon('arrowRight', 18, '#ffffff')}
        </button>
      </div>
    </div>
  `;
}

function setupPeriodFormEvents(onComplete) {
  let selectedRegularity = "Regular";
  let flowByDay = {};

  document.querySelectorAll("#cycle-regularity-chips .wc-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll("#cycle-regularity-chips .wc-chip").forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedRegularity = chip.getAttribute('data-val');
    });
  });

  const startInput = document.getElementById("cycle-start");
  const endInput = document.getElementById("cycle-end");
  const durInput = document.getElementById("cycle-period-dur");
  const flowList = document.getElementById("flow-days-list");

  function refreshFlowList() {
    const start = startInput.value;
    const dur = parseInt(durInput.value, 10) || 5;
    if (!start) {
      flowList.innerHTML = `<p class="text-xs text-gray-400 italic">Select a start date to log daily flow levels.</p>`;
      return;
    }
    const days = [];
    for (let i = 0; i < dur; i++) {
      days.push(addDays(start, i));
    }
    flowList.innerHTML = days.map(iso => `
      <div class="flex items-center justify-between text-xs py-1 border-b border-pink-50">
        <span class="font-bold text-[#5A3C4A]">${fmtShort(iso)}</span>
        <div class="flex gap-1" data-date="${iso}">
          ${FLOW_LEVELS.map(f => `
            <button type="button" class="px-2 py-1 rounded text-[11px] font-semibold border ${flowByDay[iso] === f ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-600 border-gray-200'}" data-flow="${f}">
              ${f}
            </button>
          `).join('')}
        </div>
      </div>
    `).join('');

    flowList.querySelectorAll('[data-flow]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        const date = e.target.parentElement.getAttribute('data-date');
        const flow = e.target.getAttribute('data-flow');
        flowByDay[date] = flow;
        refreshFlowList();
      });
    });
  }

  startInput.addEventListener("change", refreshFlowList);
  durInput.addEventListener("input", refreshFlowList);
  refreshFlowList();

  document.getElementById("btn-form-back")?.addEventListener("click", () => {
    if (!appData.onboarded) navigateTo("onboard-1");
    else navigateTo("dashboard");
  });

  document.getElementById("btn-cycle-submit")?.addEventListener("click", () => {
    if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
      Auth.openModal('signin', 'Please sign in or create an account to record your period.');
      return;
    }

    const start = startInput.value;
    const end = endInput.value || null;
    const periodDuration = parseInt(durInput.value, 10);
    const cycleDuration = parseInt(document.getElementById("cycle-len-est").value, 10);
    const errEl = document.getElementById("cycle-error");

    if (!start) {
      errEl.textContent = "Please choose a period start date.";
      errEl.classList.remove("hidden");
      return;
    }
    if (!periodDuration || periodDuration < 2 || periodDuration > 15) {
      errEl.textContent = "Please enter bleeding duration between 2 and 15 days.";
      errEl.classList.remove("hidden");
      return;
    }
    if (!cycleDuration || cycleDuration < 15 || cycleDuration > 60) {
      errEl.textContent = "Please enter average cycle duration between 15 and 60 days.";
      errEl.classList.remove("hidden");
      return;
    }

    onComplete({
      start,
      end,
      periodDuration,
      cycleDuration,
      regularity: selectedRegularity,
      ovulationDate: document.getElementById("cycle-ovulation").value || null,
      flowByDay
    });
  });
}

function renderSymptomTracker(isOnboarding = false) {
  return `
    <div class="max-w-md mx-auto pt-1 pb-6 px-4">
      <div class="flex items-center gap-3 mb-4">
        <button id="btn-symp-back" class="md:hidden p-2 rounded-xl bg-white border border-[#F5DCE4] text-[#5A3C4A] hover:bg-pink-50 cursor-pointer">
          ${getIcon('chevronLeft', 20)}
        </button>
        <div>
          <h2 class="text-2xl font-bold font-serif text-[#3B2531]">Log Symptoms</h2>
          <p class="text-xs text-[#8A6575]">Track how your body feels today with severity indicators.</p>
        </div>
      </div>

      <div class="wc-card p-6 space-y-5">
        <div class="space-y-4">
          ${SYMPTOM_LIST.map(s => `
            <div class="border-b border-[#F5DCE4] pb-3" data-symptom="${s.key}">
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-2 text-sm font-bold text-[#3B2531]">
                  ${getIcon(s.icon, 18, '#DD5C82')}
                  <span>${s.label}</span>
                </div>
                <span class="text-xs font-bold text-pink-600 symp-val">None</span>
              </div>
              <input type="range" min="0" max="10" value="0" class="w-full accent-pink-600 symp-slider cursor-pointer">
            </div>
          `).join('')}
        </div>

        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-2">Does anything feel unusual today?</label>
          <div class="space-y-2" id="concern-chips">
            ${[
              "No, I feel normal",
              "Something feels a little different",
              "I'm concerned about my symptoms",
              "My symptoms feel severe"
            ].map((c, i) => `
              <button type="button" class="w-full text-left p-3 rounded-xl border border-[#F5DCE4] text-xs font-semibold text-[#5A3C4A] hover:border-pink-400 ${i === 0 ? 'bg-pink-50 border-pink-400 font-bold' : 'bg-white'}" data-concern="${c}">
                ${c}
              </button>
            `).join('')}
          </div>
        </div>

        <button id="btn-symp-save" class="w-full wc-btn-primary mt-6">
          ${isOnboarding ? 'Continue to Results' : 'Save Symptoms'} ${getIcon('arrowRight', 18, '#ffffff')}
        </button>
      </div>
    </div>
  `;
}

function setupSymptomTrackerEvents(onComplete) {
  const selectedSymptoms = {};
  let selectedConcern = "No, I feel normal";

  document.querySelectorAll("[data-symptom]").forEach(row => {
    const key = row.getAttribute("data-symptom");
    const slider = row.querySelector(".symp-slider");
    const label = row.querySelector(".symp-val");

    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      if (val === 0) {
        label.textContent = "None";
        delete selectedSymptoms[key];
      } else {
        label.textContent = `${val}/10`;
        selectedSymptoms[key] = val;
      }
    });
  });

  document.querySelectorAll("#concern-chips button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#concern-chips button").forEach(b => {
        b.classList.remove('bg-pink-50', 'border-pink-400', 'font-bold');
        b.classList.add('bg-white');
      });
      btn.classList.add('bg-pink-50', 'border-pink-400', 'font-bold');
      selectedConcern = btn.getAttribute("data-concern");
    });
  });

  document.getElementById("btn-symp-back")?.addEventListener("click", () => {
    if (currentView === "symptoms") {
      navigateTo("dashboard");
    } else if (!appData.onboarded) {
      navigateTo("onboard-2");
    } else {
      navigateTo("dashboard");
    }
  });

  document.getElementById("btn-symp-save")?.addEventListener("click", () => {
    if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
      Auth.openModal('signin', 'Please sign in or create an account to record your symptoms.');
      return;
    }
    onComplete(selectedSymptoms, selectedConcern);
  });
}

function renderOnboardingResults() {
  const firstCycle = {
    id: 1,
    start: draftCycle.start,
    end: draftCycle.end || null,
    periodDuration: draftCycle.periodDuration,
    cycleLengthEstimate: draftCycle.cycleDuration,
    regularity: draftCycle.regularity,
    ovulationDate: draftCycle.ovulationDate || null,
    flowByDay: draftCycle.flowByDay || {},
  };
  const insights = computeInsights([firstCycle]);

  return `
    <div class="max-w-md mx-auto pt-1 pb-6 px-4 text-center">
      <div class="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
        ${getIcon('check', 28, '#7FAE8C')}
      </div>
      <h2 class="text-2xl font-bold font-serif text-[#3B2531]">You're All Set!</h2>
      <p class="text-xs text-[#8A6575] mt-1 mb-5">Here is your calibrated cycle forecast based on your input.</p>

      <div class="wc-card p-6 text-left space-y-4 mb-6">
        <div class="flex justify-between items-center border-b border-[#F5DCE4] pb-3">
          <span class="text-xs font-bold text-[#8A6575] uppercase">Next Estimated Period</span>
          <span class="font-bold text-pink-700 font-serif text-lg">${fmtLong(insights.nextStart)}</span>
        </div>
        <div class="flex justify-between items-center border-b border-[#F5DCE4] pb-3">
          <span class="text-xs font-bold text-[#8A6575] uppercase">Expected Window</span>
          <span class="font-semibold text-sm text-[#3B2531]">${fmtShort(insights.windowStart)} – ${fmtShort(insights.windowEnd)}</span>
        </div>
        <div class="flex justify-between items-center border-b border-[#F5DCE4] pb-3">
          <span class="text-xs font-bold text-[#8A6575] uppercase">Cycle Length</span>
          <span class="font-semibold text-sm text-[#3B2531]">${Math.round(insights.avgLen)} days</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-xs font-bold text-[#8A6575] uppercase">Bleeding Duration</span>
          <span class="font-semibold text-sm text-[#3B2531]">~${insights.avgPeriod} days</span>
        </div>
      </div>

      <button id="btn-finish-onboarding" class="w-full wc-btn-primary">
        Go to Dashboard ${getIcon('arrowRight', 18, '#ffffff')}
      </button>
    </div>
  `;
}

function setupOnboardingResultsEvents() {
  document.getElementById("btn-finish-onboarding")?.addEventListener("click", () => {
    if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
      Auth.openModal('signin', 'Please sign in or create an account to save your cycle profile.');
      return;
    }
    const firstCycle = {
      id: 1,
      start: draftCycle.start,
      end: draftCycle.end || null,
      periodDuration: draftCycle.periodDuration,
      cycleLengthEstimate: draftCycle.cycleDuration,
      regularity: draftCycle.regularity,
      ovulationDate: draftCycle.ovulationDate || null,
      flowByDay: draftCycle.flowByDay || {},
    };
    const sympList = Object.entries(draftSymptoms).map(([key, severity]) => ({ key, severity }));

    persistData({
      onboarded: true,
      profile: draftProfile,
      cycles: [firstCycle],
      symptomLogs: sympList.length ? [{ date: todayISO(), symptoms: sympList, concern: draftConcern }] : [],
      lifestyleLogs: []
    });

    navigateTo("dashboard");
  });
}

function renderDashboard(insights) {
  if (!insights) {
    return `<div class="max-w-md mx-auto py-12 px-4 text-center text-[#8A6575]">No cycle records found.</div>`;
  }

  const authUser = (typeof Auth !== 'undefined') ? Auth.getUser() : null;
  const nickname = appData.profile?.name?.split(' ')[0] || appData.profile?.nickname || authUser?.name?.split(' ')[0] || "there";
  const lastCycle = insights.last;
  const recentSymptoms = appData.symptomLogs.length ? appData.symptomLogs[appData.symptomLogs.length - 1].symptoms : [];
  const recentLifestyle = appData.lifestyleLogs.length ? appData.lifestyleLogs[appData.lifestyleLogs.length - 1] : {};
  const wellness = deriveWellness({
    symptoms: recentSymptoms,
    lifestyle: recentLifestyle,
    insights,
    heaviestFlow: lastCycle?.flowByDay ? Object.values(lastCycle.flowByDay)[0] : null
  });

  return `
    <div class="max-w-md mx-auto pt-1 pb-6 px-4 space-y-4">
      <!-- Header greeting -->
      <div class="flex items-center justify-between">
        <div>
          <span class="text-xs font-semibold text-pink-600 flex items-center gap-1.5">
            ${getIcon('sparkles', 14, '#DD5C82')} Cycle Day ${insights.currentDay}
          </span>
          <h1 class="text-2xl font-bold font-serif text-[#3B2531]">Welcome, ${nickname}</h1>
        </div>
        <button id="btn-open-privacy" class="p-2 rounded-xl bg-white border border-[#F5DCE4] text-[#8A6575] hover:text-pink-600">
          ${getIcon('shield', 18)}
        </button>
      </div>

      <!-- Cycle Ring Card -->
      <div class="wc-card p-6 text-center">
        <div class="relative w-48 h-48 mx-auto flex items-center justify-center">
          ${renderCycleRingSvg(insights.currentDay, Math.round(insights.avgLen), insights.avgPeriod)}
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-xs uppercase font-bold tracking-wider text-[#8A6575]">Day</span>
            <span class="text-4xl font-bold font-serif text-pink-700">${insights.currentDay}</span>
            <span class="text-xs text-[#5A3C4A] font-semibold mt-0.5">of ${Math.round(insights.avgLen)} days</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-[#F5DCE4] text-center">
          <div>
            <span class="block text-[11px] uppercase font-bold text-[#8A6575]">Next Period</span>
            <span class="font-bold text-sm text-[#3B2531] mt-0.5">${fmtShort(insights.nextStart)}</span>
          </div>
          <div>
            <span class="block text-[11px] uppercase font-bold text-[#8A6575]">Cycle Length</span>
            <span class="font-bold text-sm text-[#3B2531] mt-0.5">${Math.round(insights.avgLen)} days</span>
          </div>
        </div>
      </div>

      <!-- Forecast Card -->
      <div class="wc-card p-5 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm font-bold text-[#3B2531]">
            ${getIcon('calendar', 18, '#DD5C82')}
            <span>Your Next Period</span>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-100 text-pink-700">
            ${insights.confidence ? `${insights.confidence}% confidence` : 'Calibrated'}
          </span>
        </div>
        <div class="text-xl font-bold font-serif text-pink-700">
          Estimated: ${fmtLong(insights.nextStart)}
        </div>
        <p class="text-xs text-[#5A3C4A]">
          Likely window: <strong>${fmtShort(insights.windowStart)} – ${fmtShort(insights.windowEnd)}</strong>
        </p>
        ${insights.confidence ? `
          <div class="w-full bg-[#F5DCE4] h-2 rounded-full overflow-hidden">
            <div class="bg-gradient-to-r from-pink-500 to-pink-700 h-full rounded-full" style="width: ${insights.confidence}%"></div>
          </div>
        ` : ''}
      </div>

      <!-- Quick Action Buttons -->
      <div class="grid grid-cols-2 gap-3">
        <button id="act-log-period" class="wc-card p-4 flex flex-col items-center justify-center gap-2 hover:border-pink-400 transition-all cursor-pointer">
          <div class="w-10 h-10 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
            ${getIcon('droplet', 20, '#DD5C82')}
          </div>
          <span class="text-xs font-bold text-[#3B2531]">Log Period</span>
        </button>

        <button id="act-log-symptoms" class="wc-card p-4 flex flex-col items-center justify-center gap-2 hover:border-pink-400 transition-all cursor-pointer">
          <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
            ${getIcon('activity', 20, '#7A5C82')}
          </div>
          <span class="text-xs font-bold text-[#3B2531]">Track Symptoms</span>
        </button>

        <button id="act-log-today" class="wc-card p-4 flex flex-col items-center justify-center gap-2 hover:border-pink-400 transition-all cursor-pointer">
          <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
            ${getIcon('sparkles', 20, '#E7A94C')}
          </div>
          <span class="text-xs font-bold text-[#3B2531]">Update Today</span>
        </button>

        <button id="act-view-history" class="wc-card p-4 flex flex-col items-center justify-center gap-2 hover:border-pink-400 transition-all cursor-pointer">
          <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
            ${getIcon('barChart', 20, '#7FAE8C')}
          </div>
          <span class="text-xs font-bold text-[#3B2531]">Cycle History</span>
        </button>
      </div>

      <!-- Suggestions & Wellness Alerts -->
      ${wellness.urgent.length || wellness.symptom.length || wellness.lifestyle.length ? `
        <div class="wc-card p-5 space-y-3">
          <div class="flex items-center gap-2 text-sm font-bold text-[#3B2531]">
            ${getIcon('heart', 18, '#DD5C82')}
            <span>Personalized Health Insights</span>
          </div>
          ${wellness.urgent.map(u => `
            <div class="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
              ${getIcon(u.icon, 18, '#DC2626')}
              <span>${u.text}</span>
            </div>
          `).join('')}
          ${wellness.symptom.map(s => `
            <div class="p-3 rounded-xl bg-pink-50 border border-pink-100 text-xs text-[#5A3C4A] flex items-start gap-2.5">
              ${getIcon(s.icon, 18, '#DD5C82')}
              <span>${s.text}</span>
            </div>
          `).join('')}
          ${wellness.lifestyle.map(l => `
            <div class="p-3 rounded-xl bg-purple-50 border border-purple-100 text-xs text-[#5A3C4A] flex items-start gap-2.5">
              ${getIcon(l.icon, 18, '#7A5C82')}
              <span>${l.text}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Ayurvedic Comfort Card -->
      ${wellness.ayurveda.length ? `
        <div class="wc-card p-5 space-y-3 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30">
          <div class="flex items-center gap-2 text-sm font-bold text-[#3B2531]">
            ${getIcon('leaf', 18, '#7FAE8C')}
            <span>Ayurvedic & Comfort Practices</span>
          </div>
          ${wellness.ayurveda.map(a => `
            <div class="p-3 rounded-xl bg-white/80 border border-emerald-100 text-xs text-[#3B2531] flex items-start gap-2.5 shadow-sm">
              ${getIcon('leaf', 16, '#7FAE8C')}
              <span>${a.text}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Interactive Month Calendar -->
      <div class="wc-card p-5 wc-dashboard-calendar-card">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-[#3B2531] flex items-center gap-2">
            ${getIcon('calendar', 18, '#DD5C82')} Cycle Calendar & Predictions
          </h3>
        </div>
        ${renderMonthCalendarHtml(appData.cycles, insights, calendarMonthOffset)}
      </div>

      <!-- Share Feedback Card -->
      <div class="wc-card p-5 sm:p-6 bg-gradient-to-br from-white via-pink-50/50 to-rose-50/40 border border-pink-200/80 shadow-xs relative overflow-hidden">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div class="flex flex-col sm:flex-row items-center sm:items-start gap-3.5">
            <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex items-center justify-center shrink-0 shadow-xs">
              ${getIcon('messageSquare', 22, '#ffffff')}
            </div>
            <div>
              <h4 class="font-serif font-bold text-base sm:text-lg text-[#3B2531]">Share Your Feedback</h4>
              <p class="text-xs text-[#8A6575] mt-0.5 max-w-md leading-relaxed">Help us improve WomenCare with your suggestions, experiences, and feature ideas.</p>
            </div>
          </div>
          <a href="https://docs.google.com/forms/d/e/1FAIpQLSczaHwdclpGOYHeDipnvxU9Ffp5q8fQMyhBnkg1Ap38XXHSOQ/viewform" target="_blank" rel="noopener noreferrer" data-no-spa class="w-full sm:w-auto wc-btn-primary text-xs sm:text-sm py-2.5 px-5 whitespace-nowrap shadow-sm font-bold flex items-center justify-center gap-2 group shrink-0 active:scale-95 transition-all">
            <span>Share Feedback</span>
            <span class="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

function setupDashboardEvents() {
  document.getElementById("act-log-period")?.addEventListener("click", () => navigateTo("record"));
  document.getElementById("act-log-symptoms")?.addEventListener("click", () => navigateTo("symptoms"));
  document.getElementById("act-log-today")?.addEventListener("click", () => navigateTo("today"));
  document.getElementById("act-view-history")?.addEventListener("click", () => navigateTo("history"));
  document.getElementById("btn-open-privacy")?.addEventListener("click", () => navigateTo("privacy"));

  attachCalendarEvents();
}

function attachCalendarEvents() {
  document.getElementById("cal-prev-month")?.addEventListener("click", (e) => {
    e.preventDefault();
    calendarMonthOffset--;
    rerenderDashboardCalendar();
  });
  document.getElementById("cal-next-month")?.addEventListener("click", (e) => {
    e.preventDefault();
    calendarMonthOffset++;
    rerenderDashboardCalendar();
  });
  document.getElementById("cal-jump-current")?.addEventListener("click", (e) => {
    e.preventDefault();
    calendarMonthOffset = 0;
    rerenderDashboardCalendar();
  });
  document.getElementById("cal-jump-next")?.addEventListener("click", (e) => {
    e.preventDefault();
    calendarMonthOffset = 1;
    rerenderDashboardCalendar();
  });
}

function rerenderDashboardCalendar() {
  const card = document.querySelector(".wc-dashboard-calendar-card");
  if (card) {
    const insights = computeInsights(appData.cycles);
    card.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-bold text-[#3B2531] flex items-center gap-2">
          ${getIcon('calendar', 18, '#DD5C82')} Cycle Calendar & Predictions
        </h3>
      </div>
      ${renderMonthCalendarHtml(appData.cycles, insights, calendarMonthOffset)}
    `;
    attachCalendarEvents();
    if (typeof renderAllIcons === 'function') {
      renderAllIcons();
    }
  }
}

function renderCycleRingSvg(currentDay, cycleLen, periodLen) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const progressPct = clamp(currentDay / cycleLen, 0, 1);
  const periodPct = clamp(periodLen / cycleLen, 0, 1);
  const strokeOffset = c * (1 - progressPct);
  const periodStroke = c * periodPct;

  return `
    <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 160 160">
      <circle cx="80" cy="80" r="${r}" stroke="#F5DCE4" stroke-width="12" fill="none" />
      <circle cx="80" cy="80" r="${r}" stroke="#F393AF" stroke-width="12" fill="none"
              stroke-dasharray="${c}" stroke-dashoffset="${c - periodStroke}" stroke-linecap="round" />
      <circle cx="80" cy="80" r="${r}" stroke="#C1436A" stroke-width="12" fill="none"
              stroke-dasharray="${c}" stroke-dashoffset="${strokeOffset}" stroke-linecap="round" />
    </svg>
  `;
}

function getProjectedCycles(prediction, count = 12) {
  if (!prediction || !prediction.nextStart) return [];
  const avgLen = Math.max(20, Math.round(prediction.avgLen) || 28);
  const avgPeriod = Math.max(2, Math.round(prediction.avgPeriod) || 5);
  const windowSpan = Math.max(2, Math.min(6, Math.round(prediction.sd) || (prediction.lengths && prediction.lengths.length < 2 ? 4 : 2)));
  
  const projected = [];
  for (let i = 0; i < count; i++) {
    const start = addDays(prediction.nextStart, i * avgLen);
    const periodEnd = addDays(start, avgPeriod - 1);
    const windowStart = addDays(start, -windowSpan);
    const windowEnd = addDays(start, windowSpan);
    const ovulDay = addDays(start, -14);
    const fertileStart = addDays(ovulDay, -5);
    const fertileEnd = ovulDay;
    projected.push({
      cycleIndex: i + 1,
      start,
      periodEnd,
      windowStart,
      windowEnd,
      ovulDay,
      fertileStart,
      fertileEnd
    });
  }
  return projected;
}

function renderMonthCalendarHtml(cycles, prediction, monthOffset = 0) {
  const today = todayISO();
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = targetDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  
  const projectedCycles = getProjectedCycles(prediction, 12);
  
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  function getDayClassification(day) {
    const iso = toISO(new Date(year, month, day));
    
    // 1. Check logged past cycles
    if (cycles && cycles.length) {
      for (const c of cycles) {
        const end = c.end || (c.periodDuration ? addDays(c.start, Number(c.periodDuration) - 1) : c.start);
        if (iso >= c.start && iso <= end) {
          return { type: "logged-period", label: "Logged Period" };
        }
      }
    }
    
    // 2. Check projected future cycles
    for (const p of projectedCycles) {
      if (iso === p.start) {
        return { type: "predicted-start", label: "Predicted Period Start" };
      }
      if (iso > p.start && iso <= p.periodEnd) {
        return { type: "predicted-period", label: "Predicted Period Flow" };
      }
      if (iso >= p.windowStart && iso <= p.windowEnd) {
        return { type: "predicted-window", label: "Likely Window" };
      }
      if (iso === p.ovulDay) {
        return { type: "predicted-ovul", label: "Estimated Ovulation" };
      }
      if (iso >= p.fertileStart && iso <= p.fertileEnd) {
        return { type: "predicted-fertile", label: "Fertile Window" };
      }
    }
    return null;
  }

  // Find projected events in this month
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const eventsInMonth = projectedCycles.filter(p => 
    p.start.startsWith(monthPrefix) || 
    p.periodEnd.startsWith(monthPrefix) || 
    p.windowStart.startsWith(monthPrefix) || 
    p.windowEnd.startsWith(monthPrefix) || 
    p.ovulDay.startsWith(monthPrefix)
  );

  return `
    <div id="cycle-calendar-root" class="space-y-4">
      <!-- Calendar Controls Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-pink-100">
        <div class="flex items-center gap-2">
          <button id="cal-prev-month" type="button" class="w-8 h-8 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95" aria-label="Previous Month">
            ${getIcon('chevronLeft', 16)}
          </button>
          <h4 class="font-serif font-bold text-base sm:text-lg text-[#3B2531] min-w-[150px]">
            ${monthName}
          </h4>
          <button id="cal-next-month" type="button" class="w-8 h-8 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95" aria-label="Next Month">
            ${getIcon('chevronRight', 16)}
          </button>
        </div>

        <div class="flex items-center gap-1.5 self-start sm:self-auto">
          <button id="cal-jump-current" type="button" class="text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${monthOffset === 0 ? 'bg-pink-600 text-white shadow-xs' : 'bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200/70'}">
            Current Month
          </button>
          <button id="cal-jump-next" type="button" class="text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${monthOffset === 1 ? 'bg-pink-600 text-white shadow-xs' : 'bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200/70'}">
            Next Month 🔮
          </button>
        </div>
      </div>

      <!-- Month Prediction Highlights Card if upcoming -->
      ${eventsInMonth.length ? `
        <div class="p-3.5 rounded-2xl bg-gradient-to-r from-pink-50/90 via-rose-50/50 to-amber-50/60 border border-pink-200/80 space-y-1.5 text-xs animate-fade-in shadow-2xs">
          <div class="font-bold text-pink-800 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              ${getIcon('sparkles', 14, '#9D174D')}
              <span>Forecast for ${monthName}</span>
            </span>
            <span class="text-[10px] uppercase font-extrabold tracking-wider bg-pink-200/80 text-pink-900 px-2 py-0.5 rounded-md">Projected Window</span>
          </div>
          <div class="text-[#5A3C4A] space-y-1 text-[11px] sm:text-xs">
            ${eventsInMonth.map(p => `
              <div>🌸 <strong>Next Period Expected:</strong> <span class="font-bold text-pink-700">${fmtLong(p.start)}</span> (Likely window: <span class="font-semibold text-amber-800">${fmtShort(p.windowStart)} – ${fmtShort(p.windowEnd)}</span>)</div>
              <div>✨ <strong>Fertile Window:</strong> <span class="font-semibold text-purple-700">${fmtShort(p.fertileStart)} – ${fmtShort(p.fertileEnd)}</span> (Peak Ovulation: <strong class="text-purple-800">${fmtShort(p.ovulDay)}</strong>)</div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Day Headers -->
      <div class="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[#8A6575] mb-1">
        ${["S", "M", "T", "W", "T", "F", "S"].map(w => `<div>${w}</div>`).join('')}
      </div>

      <!-- Days Grid -->
      <div class="grid grid-cols-7 gap-1 text-center">
        ${cells.map(day => {
          if (!day) return `<div class="aspect-square"></div>`;
          const iso = toISO(new Date(year, month, day));
          const isToday = iso === today;
          const info = getDayClassification(day);

          let bg = "bg-white/90 hover:bg-pink-50 text-[#3B2531]";
          let ring = isToday ? "ring-2 ring-pink-700 font-bold z-10" : "";
          let badgeText = "";

          if (info) {
            switch (info.type) {
              case "logged-period":
                bg = "bg-gradient-to-tr from-pink-600 to-rose-500 text-white font-bold shadow-xs";
                break;
              case "predicted-start":
                bg = "bg-gradient-to-tr from-rose-500 to-pink-600 text-white font-bold shadow-sm ring-2 ring-pink-300";
                badgeText = "★";
                break;
              case "predicted-period":
                bg = "bg-pink-100/90 text-pink-900 font-bold border border-pink-200";
                break;
              case "predicted-window":
                bg = "bg-amber-100 text-amber-900 font-semibold border border-dashed border-amber-300";
                break;
              case "predicted-ovul":
                bg = "bg-purple-600 text-white font-bold shadow-xs";
                badgeText = "●";
                break;
              case "predicted-fertile":
                bg = "bg-purple-100 text-purple-900 font-semibold border border-purple-200";
                break;
            }
          }

          return `
            <div class="aspect-square relative flex flex-col items-center justify-center rounded-xl text-xs sm:text-sm transition-transform hover:scale-105 cursor-default ${bg} ${ring}">
              <span>${day}</span>
              ${badgeText ? `<span class="text-[8px] absolute bottom-0.5 leading-none opacity-90">${badgeText}</span>` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Interactive Legend -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-pink-100 text-[11px] text-[#5A3C4A] font-semibold">
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-pink-600 inline-block shadow-2xs shrink-0"></span> Logged Period</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-gradient-to-tr from-rose-500 to-pink-600 inline-block ring-2 ring-pink-200 shadow-2xs shrink-0"></span> Predicted Start</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-amber-100 border border-amber-400 inline-block shrink-0"></span> Likely Window</span>
        <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-purple-600 inline-block shadow-2xs shrink-0"></span> Fertile / Ovulation</span>
      </div>
    </div>
  `;
}

function renderUpdateToday(insights) {
  return `
    <div class="max-w-md mx-auto pt-1 pb-6 px-4">
      <div class="flex items-center gap-3 mb-4">
        <button id="btn-today-back" class="md:hidden p-2 rounded-xl bg-white border border-[#F5DCE4] text-[#5A3C4A] hover:bg-pink-50 cursor-pointer">
          ${getIcon('chevronLeft', 20)}
        </button>
        <div>
          <h2 class="text-2xl font-bold font-serif text-[#3B2531]">Update Today's Log</h2>
          <p class="text-xs text-[#8A6575]">Keep your lifestyle factors up to date.</p>
        </div>
      </div>

      <div class="wc-card p-6 space-y-4">
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Sleep (Hours)</label>
          <input type="number" step="0.5" id="today-sleep" class="wc-input" placeholder="e.g. 8">
        </div>
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Stress Level</label>
          <div class="flex flex-wrap gap-2" id="today-stress-chips">
            ${["Low", "Moderate", "High"].map(s => `<button type="button" class="wc-chip" data-val="${s}">${s}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Water Intake (L)</label>
          <input type="number" step="0.1" id="today-water" class="wc-input" placeholder="e.g. 2.2">
        </div>
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Physical Activity</label>
          <div class="flex flex-wrap gap-2" id="today-exercise-chips">
            ${["None", "Light", "Moderate", "Intense"].map(e => `<button type="button" class="wc-chip" data-val="${e}">${e}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Recent Illness or Fever?</label>
          <div class="flex gap-2" id="today-illness-chips">
            ${["No", "Yes"].map(y => `<button type="button" class="wc-chip" data-val="${y}">${y}</button>`).join('')}
          </div>
        </div>
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Major Travel / Timezone Change?</label>
          <div class="flex gap-2" id="today-travel-chips">
            ${["No", "Yes"].map(y => `<button type="button" class="wc-chip" data-val="${y}">${y}</button>`).join('')}
          </div>
        </div>

        <button id="btn-today-save" class="w-full wc-btn-primary mt-6">
          Save Today's Data ${getIcon('check', 18, '#ffffff')}
        </button>
      </div>
    </div>
  `;
}

function setupUpdateTodayEvents(onSave) {
  const formState = {};
  function bindChips(containerId, key) {
    document.querySelectorAll(`#${containerId} .wc-chip`).forEach(c => {
      c.addEventListener("click", () => {
        document.querySelectorAll(`#${containerId} .wc-chip`).forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        formState[key] = c.getAttribute('data-val');
      });
    });
  }
  bindChips("today-stress-chips", "stress");
  bindChips("today-exercise-chips", "exercise");
  bindChips("today-illness-chips", "illness");
  bindChips("today-travel-chips", "travel");

  document.getElementById("btn-today-back")?.addEventListener("click", () => navigateTo("dashboard"));
  document.getElementById("btn-today-save")?.addEventListener("click", () => {
    if (typeof Auth !== 'undefined' && !Auth.isLoggedIn()) {
      Auth.openModal('signin', 'Please sign in or create an account to update today\'s health log.');
      return;
    }
    formState.sleep = parseFloat(document.getElementById("today-sleep").value) || null;
    formState.water = parseFloat(document.getElementById("today-water").value) || null;
    onSave(formState);
  });
}

function renderHistoryPage() {
  const reversed = [...appData.cycles].reverse();
  const totalCycles = appData.cycles.length;
  
  // Calculate average bleeding duration
  const durations = appData.cycles.filter(c => c.periodDuration).map(c => Number(c.periodDuration));
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 5;
  
  // Calculate average cycle length
  const cycleLengths = appData.cycles.filter(c => c.cycleLengthEstimate).map(c => Number(c.cycleLengthEstimate));
  const avgCycleLength = cycleLengths.length ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length) : 28;

  return `
    <div class="max-w-xl mx-auto pt-1 pb-6 px-4 space-y-5">
      <div class="flex items-center gap-3">
        <button id="btn-hist-back" class="md:hidden p-2 rounded-xl bg-white border border-[#F5DCE4] text-[#5A3C4A] hover:bg-pink-50 transition-all cursor-pointer shadow-xs">
          ${getIcon('chevronLeft', 20)}
        </button>
        <div>
          <h2 class="text-2xl sm:text-3xl font-bold font-serif text-[#3B2531]">Cycle History</h2>
          <p class="text-xs sm:text-sm text-[#8A6575]">Review, edit, and manage your recorded menstrual cycles.</p>
        </div>
      </div>

      ${totalCycles === 0 ? `
        <div class="wc-card p-8 text-center space-y-4 border-pink-100 bg-white/90">
          <div class="w-14 h-14 rounded-2xl bg-pink-100 text-pink-600 mx-auto flex items-center justify-center shadow-xs">
            ${getIcon('calendar', 28, '#C1436A')}
          </div>
          <div class="space-y-1">
            <h3 class="font-serif font-bold text-lg text-[#3B2531]">No Cycle Records Yet</h3>
            <p class="text-xs sm:text-sm text-[#8A6575] max-w-sm mx-auto leading-relaxed">
              Log your past or current menstrual cycles to unlock personalized predictions, fertile windows, and health insights.
            </p>
          </div>
          <div class="pt-2 flex justify-center items-center">
            <button id="btn-hist-empty-log" class="wc-btn-primary py-2.5 px-6 text-xs sm:text-sm font-bold flex items-center gap-2">
              ${getIcon('plus', 16, '#ffffff')} Log Your First Period
            </button>
          </div>
        </div>
      ` : `
        <!-- Summary Stats Bar -->
        <div class="grid grid-cols-3 gap-3">
          <div class="wc-card p-3.5 text-center bg-white/80 border-pink-100 shadow-xs">
            <div class="text-[10px] sm:text-[11px] font-bold text-[#8A6575] uppercase tracking-wider">Logged Cycles</div>
            <div class="text-xl sm:text-2xl font-serif font-bold text-[#3B2531] mt-0.5">${totalCycles}</div>
          </div>
          <div class="wc-card p-3.5 text-center bg-white/80 border-pink-100 shadow-xs">
            <div class="text-[10px] sm:text-[11px] font-bold text-[#8A6575] uppercase tracking-wider">Avg Cycle Length</div>
            <div class="text-xl sm:text-2xl font-serif font-bold text-pink-700 mt-0.5">${avgCycleLength}d</div>
          </div>
          <div class="wc-card p-3.5 text-center bg-white/80 border-pink-100 shadow-xs">
            <div class="text-[10px] sm:text-[11px] font-bold text-[#8A6575] uppercase tracking-wider">Bleeding Days</div>
            <div class="text-xl sm:text-2xl font-serif font-bold text-rose-600 mt-0.5">~${avgDuration}d</div>
          </div>
        </div>

        <!-- Section Action Header -->
        <div class="flex items-center justify-between px-1">
          <span class="text-xs font-bold text-[#8A6575] uppercase tracking-wider">Past Cycle Entries</span>
          <button id="btn-hist-add" class="wc-btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-xs">
            ${getIcon('plus', 14, '#ffffff')} Log Period
          </button>
        </div>

        <!-- Cycle Entries List -->
        <div class="space-y-3">
          ${reversed.map((c, idx) => `
            <div class="wc-card p-4 sm:p-5 space-y-3 border-pink-100/90 hover:border-pink-300 transition-all">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-7 h-7 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                    ${getIcon('droplet', 14, '#C1436A')}
                  </div>
                  <span class="font-bold font-serif text-base text-[#3B2531]">Cycle #${reversed.length - idx}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <button class="px-2.5 py-1 rounded-lg text-xs font-bold bg-pink-50 text-pink-700 hover:bg-pink-100 btn-edit-cycle flex items-center gap-1" data-id="${c.id}">
                    ${getIcon('edit', 13)} Edit
                  </button>
                  <button class="p-1 rounded-lg text-xs font-bold text-gray-400 hover:text-red-600 hover:bg-red-50 btn-delete-cycle" data-id="${c.id}" title="Delete cycle">
                    ${getIcon('trash', 14)}
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#5A3C4A] pt-1 border-t border-pink-50">
                <div>
                  <span class="text-[#8A6575]">Dates:</span> 
                  <strong>${fmtLong(c.start)}</strong>${c.end ? ` – <strong>${fmtLong(c.end)}</strong>` : ''}
                </div>
                <div class="flex items-center gap-2">
                  ${c.periodDuration ? `<span><strong>${c.periodDuration}</strong> bleeding days</span>` : ''}
                  ${c.regularity ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-100">${c.regularity}</span>` : ''}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}

      <div id="modal-edit-cycle-root"></div>
    </div>
  `;
}

function setupHistoryPageEvents() {
  document.getElementById("btn-hist-back")?.addEventListener("click", () => navigateTo("dashboard"));
  document.getElementById("btn-hist-empty-log")?.addEventListener("click", () => navigateTo("record"));
  document.getElementById("btn-hist-add")?.addEventListener("click", () => navigateTo("record"));

  document.querySelectorAll(".btn-edit-cycle").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.getAttribute("data-id"), 10);
      const target = appData.cycles.find(c => c.id === id);
      if (target) showEditModal(target);
    });
  });

  document.querySelectorAll(".btn-delete-cycle").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.getAttribute("data-id"), 10);
      if (confirm("Are you sure you want to remove this cycle entry?")) {
        const nextCycles = appData.cycles.filter(c => c.id !== id);
        persistData({ ...appData, cycles: nextCycles });
        renderTracker();
      }
    });
  });
}

function showEditModal(cycle) {
  const modalRoot = document.getElementById("modal-edit-cycle-root");
  modalRoot.innerHTML = `
    <div class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div class="wc-card w-full max-w-sm p-6 space-y-4 bg-white shadow-xl">
        <div class="flex items-center justify-between">
          <h3 class="font-serif font-bold text-lg text-[#3B2531]">Edit Cycle</h3>
          <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600">${getIcon('x', 20)}</button>
        </div>
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase mb-1">Start Date</label>
          <input type="date" id="edit-start" class="wc-input" value="${cycle.start}">
        </div>
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase mb-1">End Date</label>
          <input type="date" id="edit-end" class="wc-input" value="${cycle.end || ''}">
        </div>
        <div>
          <label class="block text-xs font-bold text-[#5A3C4A] uppercase mb-1">Bleeding Days</label>
          <input type="number" id="edit-dur" class="wc-input" value="${cycle.periodDuration || ''}">
        </div>
        <button id="btn-save-edited" class="w-full wc-btn-primary">Save Changes</button>
      </div>
    </div>
  `;

  document.getElementById("btn-close-modal")?.addEventListener("click", () => {
    modalRoot.innerHTML = "";
  });

  document.getElementById("btn-save-edited")?.addEventListener("click", () => {
    const updated = {
      ...cycle,
      start: document.getElementById("edit-start").value,
      end: document.getElementById("edit-end").value || null,
      periodDuration: parseInt(document.getElementById("edit-dur").value, 10) || cycle.periodDuration
    };
    const nextCycles = appData.cycles.map(c => c.id === cycle.id ? updated : c);
    persistData({ ...appData, cycles: nextCycles });
    modalRoot.innerHTML = "";
    navigateTo("history");
  });
}

function renderOvulationPage(insights) {
  // Determine baseline calculation
  const latestCycle = appData.cycles.length ? appData.cycles[appData.cycles.length - 1] : null;
  const baseStart = latestCycle ? latestCycle.start : todayISO();
  const cycleLen = (latestCycle && latestCycle.cycleLengthEstimate) || 28;

  // Ovulation is approximately 14 days before next period
  const nextStart = addDays(baseStart, cycleLen);
  const ovulDay = addDays(baseStart, cycleLen - 14);
  const fertileStart = addDays(ovulDay, -5);
  const fertileEnd = addDays(ovulDay, 1);

  return `
    <div class="max-w-2xl mx-auto pt-1 pb-6 px-4 space-y-5">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <button id="btn-ovul-back" class="md:hidden p-2 rounded-xl bg-white border border-[#F5DCE4] text-[#5A3C4A] hover:bg-pink-50 transition-all cursor-pointer shadow-xs">
          ${getIcon('chevronLeft', 20)}
        </button>
        <div>
          <h2 class="text-2xl sm:text-3xl font-bold font-serif text-[#3B2531]">Ovulation & Fertility Forecast</h2>
          <p class="text-xs sm:text-sm text-[#8A6575]">Track your fertile window, peak conception probability, and cycle phases.</p>
        </div>
      </div>

      <!-- Main Forecast Spotlight Card -->
      <div class="wc-card p-6 sm:p-8 bg-gradient-to-br from-white via-pink-50/40 to-rose-50/60 border border-pink-200/80 shadow-md relative overflow-hidden">
        <div class="absolute -right-8 -bottom-8 opacity-10 text-pink-600 pointer-events-none">
          ${getIcon('flower', 160)}
        </div>

        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div class="space-y-3">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-pink-100/90 text-pink-800 border border-pink-200">
              ${getIcon('sparkles', 13, '#9D174D')} Clinical 14-Day Luteal Phase Model
            </span>
            <h3 class="text-xl sm:text-2xl font-bold font-serif text-[#3B2531]">
              Estimated Peak Ovulation
            </h3>
            <div class="text-3xl sm:text-4xl font-serif font-bold text-pink-700 tracking-tight" id="disp-ovul-date">
              ${fmtLong(ovulDay)}
            </div>
            <p class="text-xs sm:text-sm text-[#5A3C4A] max-w-md leading-relaxed">
              Your 6-day fertile window is predicted from <strong class="text-[#3B2531]" id="disp-fertile-range">${fmtShort(fertileStart)} to ${fmtShort(fertileEnd)}</strong>. Chances of conception are highest on ovulation day and the two preceding days.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <div class="p-3.5 rounded-2xl bg-white/90 border border-pink-100 shadow-xs text-center min-w-[140px]">
              <div class="text-[11px] uppercase font-bold text-[#8A6575] tracking-wider">Conception Chance</div>
              <div class="text-base font-bold text-emerald-700 flex items-center justify-center gap-1 mt-0.5">
                ${getIcon('trendingUp', 16, '#047857')} Peak / High
              </div>
            </div>
            <div class="p-3.5 rounded-2xl bg-white/90 border border-pink-100 shadow-xs text-center min-w-[140px]">
              <div class="text-[11px] uppercase font-bold text-[#8A6575] tracking-wider">Next Period Due</div>
              <div class="text-sm font-bold text-pink-700 mt-0.5" id="disp-next-period">
                ${fmtShort(nextStart)}
              </div>
            </div>
          </div>
        </div>

        <!-- 6-Day Fertile Window Bar -->
        <div class="mt-6 pt-6 border-t border-pink-100/80">
          <div class="text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>6-Day Fertile Window</span>
            <span class="text-[11px] text-pink-600 font-semibold">Peak Day 14</span>
          </div>
          <div class="grid grid-cols-6 gap-1.5 sm:gap-2 text-center" id="disp-fertile-days">
            ${[-5, -4, -3, -2, -1, 0].map(offset => {
              const dIso = addDays(ovulDay, offset);
              const isPeak = offset === 0;
              const isHigh = offset === -1 || offset === -2;
              const bg = isPeak ? 'bg-pink-600 text-white shadow-xs' : (isHigh ? 'bg-pink-100 text-pink-800 font-bold' : 'bg-white/80 text-[#5A3C4A]');
              const label = isPeak ? 'Peak' : (isHigh ? 'High' : 'Medium');
              return `
                <div class="p-2 sm:p-2.5 rounded-xl border border-pink-200/60 ${bg}">
                  <div class="text-[10px] font-bold opacity-80">${fmtShort(dIso).split(' ')[0]}</div>
                  <div class="text-xs sm:text-sm font-bold my-0.5">${dIso.split('-')[2]}</div>
                  <div class="text-[9px] font-semibold uppercase tracking-tight">${label}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Interactive Calculator Tool -->
      <div class="wc-card p-6 space-y-4">
        <div class="flex items-center gap-2 border-b border-pink-100 pb-3">
          <div class="w-8 h-8 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center">
            ${getIcon('calendar', 16, '#C1436A')}
          </div>
          <div>
            <h3 class="text-base font-bold font-serif text-[#3B2531]">Calibrate Prediction for Any Cycle</h3>
            <p class="text-xs text-[#8A6575]">Customize your start date and cycle length to recalibrate the forecast in real time.</p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Last Period Start Date</label>
            <input type="date" id="calc-start-date" class="wc-input" value="${baseStart}">
          </div>
          <div>
            <label class="block text-xs font-bold text-[#5A3C4A] uppercase tracking-wider mb-1.5">Average Cycle Length (Days)</label>
            <input type="number" id="calc-cycle-len" class="wc-input" min="20" max="45" value="${cycleLen}">
          </div>
        </div>

        <button id="btn-recalc-ovul" class="w-full wc-btn-primary py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm">
          ${getIcon('refresh', 16, '#ffffff')} Recalculate Fertile Window
        </button>
      </div>

      <!-- The 4 Menstrual Phases Educational Guide -->
      <div class="wc-card p-6 space-y-4">
        <h3 class="text-base font-bold font-serif text-[#3B2531] flex items-center gap-2">
          ${getIcon('bookOpen', 18, '#DD5C82')} The 4 Biological Cycle Phases
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div class="p-4 rounded-2xl bg-pink-50/50 border border-pink-100 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-pink-700">Phase 1: Menstruation</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-800">Days 1–5</span>
            </div>
            <p class="text-xs text-[#5A3C4A] leading-relaxed">
              Uterine lining sheds. Estrogen and progesterone are at baseline. Rest, replenish iron, and stay hydrated.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-rose-700">Phase 2: Follicular</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">Days 6–13</span>
            </div>
            <p class="text-xs text-[#5A3C4A] leading-relaxed">
              FSH stimulates egg growth; estrogen rises rapidly. Energy, mental sharpness, and endurance peak.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-amber-800">Phase 3: Ovulatory</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">Days 14–16</span>
            </div>
            <p class="text-xs text-[#5A3C4A] leading-relaxed">
              LH surge releases a mature egg into the fallopian tube. 24–48 hour viability window. Peak fertility.
            </p>
          </div>

          <div class="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-purple-700">Phase 4: Luteal</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">Days 17–28</span>
            </div>
            <p class="text-xs text-[#5A3C4A] leading-relaxed">
              Corpus luteum produces progesterone. Focus on magnesium, stress reduction, and healthy complex carbs.
            </p>
          </div>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button id="btn-ovul-to-symptoms" class="wc-btn-secondary p-3 text-xs flex items-center justify-center gap-1.5">
          ${getIcon('activity', 15, '#DD5C82')} Log Symptoms
        </button>
        <button id="btn-ovul-to-history" class="wc-btn-secondary p-3 text-xs flex items-center justify-center gap-1.5">
          ${getIcon('barChart', 15, '#DD5C82')} Cycle History
        </button>
        <button id="btn-ovul-to-ayurveda" class="wc-btn-secondary p-3 text-xs flex items-center justify-center gap-1.5">
          ${getIcon('leaf', 15, '#DD5C82')} Ayurvedic Remedies
        </button>
      </div>
    </div>
  `;
}

function setupOvulationPageEvents() {
  document.getElementById("btn-ovul-back")?.addEventListener("click", () => navigateTo("dashboard"));
  document.getElementById("btn-ovul-to-symptoms")?.addEventListener("click", () => navigateTo("symptoms"));
  document.getElementById("btn-ovul-to-history")?.addEventListener("click", () => navigateTo("history"));
  document.getElementById("btn-ovul-to-ayurveda")?.addEventListener("click", () => navigateTo("ayurveda"));

  document.getElementById("btn-recalc-ovul")?.addEventListener("click", () => {
    const startVal = document.getElementById("calc-start-date")?.value;
    const lenVal = parseInt(document.getElementById("calc-cycle-len")?.value, 10);
    if (!startVal || !lenVal || lenVal < 15 || lenVal > 60) {
      alert("Please enter a valid start date and cycle length (15–60 days).");
      return;
    }
    const nextStart = addDays(startVal, lenVal);
    const ovulDay = addDays(startVal, lenVal - 14);
    const fertileStart = addDays(ovulDay, -5);
    const fertileEnd = addDays(ovulDay, 1);

    const dispOvul = document.getElementById("disp-ovul-date");
    const dispRange = document.getElementById("disp-fertile-range");
    const dispNext = document.getElementById("disp-next-period");
    const dispDays = document.getElementById("disp-fertile-days");

    if (dispOvul) dispOvul.textContent = fmtLong(ovulDay);
    if (dispRange) dispRange.textContent = `${fmtShort(fertileStart)} to ${fmtShort(fertileEnd)}`;
    if (dispNext) dispNext.textContent = fmtShort(nextStart);

    if (dispDays) {
      dispDays.innerHTML = [-5, -4, -3, -2, -1, 0].map(offset => {
        const dIso = addDays(ovulDay, offset);
        const isPeak = offset === 0;
        const isHigh = offset === -1 || offset === -2;
        const bg = isPeak ? 'bg-pink-600 text-white shadow-xs' : (isHigh ? 'bg-pink-100 text-pink-800 font-bold' : 'bg-white/80 text-[#5A3C4A]');
        const label = isPeak ? 'Peak' : (isHigh ? 'High' : 'Medium');
        return `
          <div class="p-2 sm:p-2.5 rounded-xl border border-pink-200/60 ${bg}">
            <div class="text-[10px] font-bold opacity-80">${fmtShort(dIso).split(' ')[0]}</div>
            <div class="text-xs sm:text-sm font-bold my-0.5">${dIso.split('-')[2]}</div>
            <div class="text-[9px] font-semibold uppercase tracking-tight">${label}</div>
          </div>
        `;
      }).join('');
    }
  });
}

const AYURVEDA_REMEDIES = [
  {
    category: "cramps",
    title: "Ajwain & Jaggery Warm Decoction",
    dosha: "Vata Pacifying",
    icon: "coffee",
    ingredients: "1 tsp Ajwain (Carom seeds), 1 tbsp organic jaggery (gud), 1 cup water",
    preparation: "Boil ajwain in water for 5 minutes. Stir in jaggery until melted. Sip warm during acute spasms.",
    benefit: "Ajwain contains thymol which relaxes uterine muscle contractions and relieves gas-induced cramp pain."
  },
  {
    category: "cramps",
    title: "Warm Sesame Oil Abhyanga & Compress",
    dosha: "Apana Vayu Balance",
    icon: "flower",
    ingredients: "Warm organic sesame oil or castor oil, hot water bottle / compress",
    preparation: "Gently massage clockwise over the lower abdomen and sacrum for 5 minutes. Apply warm compress for 15 minutes.",
    benefit: "Grounds erratic Vata flow, enhances local pelvic microcirculation, and eases lower back stiffness."
  },
  {
    category: "bloating",
    title: "CCF Tea (Cumin, Coriander & Fennel)",
    dosha: "Tridoshic Balance",
    icon: "leaf",
    ingredients: "1/2 tsp cumin seeds, 1/2 tsp coriander seeds, 1/2 tsp fennel seeds",
    preparation: "Simmer seeds in 3 cups of water until reduced by half. Strain and drink throughout the day.",
    benefit: "Kindles digestive fire (Agni) without creating excess Pitta heat. Flushes water retention and eases belly tightness."
  },
  {
    category: "bloating",
    title: "Hing (Asafoetida) & Rock Salt Infusion",
    dosha: "Vata / Kapha",
    icon: "sparkles",
    ingredients: "A pinch of roasted hing, 1/4 tsp rock salt (Sendha Namak), 1 glass warm water",
    preparation: "Mix freshly roasted hing in warm water and drink after meals.",
    benefit: "Instantly relieves gas pockets, sluggish gut motility, and abdominal distension."
  },
  {
    category: "fatigue",
    title: "Shatavari Nourishing Elixir",
    dosha: "Pitta / Vata",
    icon: "heart",
    ingredients: "1/2 tsp Shatavari root powder, 1 cup warm milk (or almond milk), pinch of cardamom & saffron",
    preparation: "Whisk warm milk with shatavari and spices. Drink before bedtime.",
    benefit: "Known as the 'Queen of Herbs' in Ayurveda, Shatavari balances female hormonal vitality and replenishes Ojas (vital energy)."
  },
  {
    category: "fatigue",
    title: "Munakka (Soaked Black Raisins) & Figs",
    dosha: "Rakta Dhatu Rebuilding",
    icon: "apple",
    ingredients: "5-6 seeded black raisins, 1 dried fig (anjeer), soaked overnight in water",
    preparation: "Consume first thing in the morning on an empty stomach and drink the soaking water.",
    benefit: "Rich in bioavailable plant iron and minerals, replenishing blood lost during menstrual flow."
  },
  {
    category: "mood",
    title: "Brahmi & Chamomile Evening Brew",
    dosha: "Vata / Pitta",
    icon: "moon",
    ingredients: "1/2 tsp Brahmi leaves or powder, chamomile blossoms, hot water",
    preparation: "Steep for 7 minutes in hot water. Add raw honey once lukewarm.",
    benefit: "Soothes the central nervous system, reduces PMDD irritability, and promotes deep restorative sleep."
  },
  {
    category: "mood",
    title: "Sheetali Cooling Breath & Rose Mist",
    dosha: "Pitta Calming",
    icon: "sun",
    ingredients: "Pure steam-distilled rose water, 10 rounds of Sheetali breath",
    preparation: "Curl tongue like a straw, inhale cool air deeply, exhale through nose. Mist face with rose water.",
    benefit: "Cools internal hormonal heat, dissipates anger, tension headaches, and hot flushes."
  }
];

function renderAyurvedaPage() {
  return `
    <div class="max-w-3xl mx-auto pt-1 pb-6 px-4 space-y-5">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <button id="btn-ayur-back" class="md:hidden p-2 rounded-xl bg-white border border-[#F5DCE4] text-[#5A3C4A] hover:bg-pink-50 transition-all cursor-pointer shadow-xs">
          ${getIcon('chevronLeft', 20)}
        </button>
        <div>
          <h2 class="text-2xl sm:text-3xl font-bold font-serif text-[#3B2531]">Ayurvedic Cycle Comfort</h2>
          <p class="text-xs sm:text-sm text-[#8A6575]">Holistic herbal remedies, dosha alignment, and natural relief routines.</p>
        </div>
      </div>

      <!-- Intro Card -->
      <div class="wc-card p-6 bg-gradient-to-r from-emerald-50/50 via-white to-pink-50/50 border-emerald-100 space-y-2">
        <div class="flex items-center gap-2 text-emerald-800 font-bold text-sm">
          ${getIcon('leaf', 18, '#047857')} Gentle & Time-Tested Menstrual Care
        </div>
        <p class="text-xs sm:text-sm text-[#5A3C4A] leading-relaxed">
          In Ayurveda, the menstrual cycle (Ritu Chakra) is governed primarily by <strong>Vata dosha</strong> (specifically <em>Apana Vayu</em>, the downward flow). Balancing digestion, warmth, and nervous calmness relieves cramps, mood fluctuations, and fatigue naturally.
        </p>
      </div>

      <!-- Category Filter Pills -->
      <div class="flex flex-wrap gap-2" id="ayur-filter-pills">
        <button class="px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ayur-pill active bg-pink-600 text-white border-pink-600 shadow-xs" data-filter="all">All Remedies</button>
        <button class="px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ayur-pill bg-white text-[#5A3C4A] border-pink-200 hover:bg-pink-50" data-filter="cramps">Cramps & Spasms</button>
        <button class="px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ayur-pill bg-white text-[#5A3C4A] border-pink-200 hover:bg-pink-50" data-filter="bloating">Bloating & Digestion</button>
        <button class="px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ayur-pill bg-white text-[#5A3C4A] border-pink-200 hover:bg-pink-50" data-filter="fatigue">Energy & Iron</button>
        <button class="px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ayur-pill bg-white text-[#5A3C4A] border-pink-200 hover:bg-pink-50" data-filter="mood">Mood & Stress</button>
      </div>

      <!-- Remedies Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="ayur-remedies-list">
        ${AYURVEDA_REMEDIES.map(r => `
          <div class="wc-card p-5 space-y-3 border-pink-100 ayur-card" data-category="${r.category}">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                  ${getIcon(r.icon, 16, '#C1436A')}
                </div>
                <h4 class="font-bold font-serif text-sm text-[#3B2531] leading-tight">${r.title}</h4>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 whitespace-nowrap shrink-0">
                ${r.dosha}
              </span>
            </div>

            <div class="text-xs text-[#5A3C4A] space-y-1.5 pt-1 border-t border-pink-50">
              <div><strong class="text-[#3B2531]">Ingredients:</strong> ${r.ingredients}</div>
              <div><strong class="text-[#3B2531]">Method:</strong> ${r.preparation}</div>
              <div class="text-pink-800 bg-pink-50/60 p-2 rounded-lg text-[11px] leading-relaxed">
                <strong>Why it works:</strong> ${r.benefit}
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Bottom Nav Support -->
      <div class="pt-4 flex flex-col sm:flex-row gap-3">
        <button id="btn-ayur-to-symptoms" class="flex-1 wc-btn-secondary p-3 text-xs flex items-center justify-center gap-2">
          ${getIcon('activity', 15, '#DD5C82')} Log Your Symptoms Today
        </button>
        <button id="btn-ayur-to-dashboard" class="flex-1 wc-btn-primary p-3 text-xs flex items-center justify-center gap-2">
          ${getIcon('home', 15, '#ffffff')} Return to Tracker Dashboard
        </button>
      </div>
    </div>
  `;
}

function setupAyurvedaPageEvents() {
  document.getElementById("btn-ayur-back")?.addEventListener("click", () => navigateTo("dashboard"));
  document.getElementById("btn-ayur-to-dashboard")?.addEventListener("click", () => navigateTo("dashboard"));
  document.getElementById("btn-ayur-to-symptoms")?.addEventListener("click", () => navigateTo("symptoms"));

  const pills = document.querySelectorAll(".ayur-pill");
  const cards = document.querySelectorAll(".ayur-card");

  pills.forEach(pill => {
    pill.addEventListener("click", () => {
      pills.forEach(p => {
        p.classList.remove("active", "bg-pink-600", "text-white", "border-pink-600", "shadow-xs");
        p.classList.add("bg-white", "text-[#5A3C4A]", "border-pink-200");
      });
      pill.classList.add("active", "bg-pink-600", "text-white", "border-pink-600", "shadow-xs");
      pill.classList.remove("bg-white", "text-[#5A3C4A]", "border-pink-200");

      const filter = pill.getAttribute("data-filter");
      cards.forEach(card => {
        if (filter === "all" || card.getAttribute("data-category") === filter) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });
    });
  });
}

function renderPrivacyPage() {
  return `
    <div class="max-w-md mx-auto pt-1 pb-6 px-4">
      <div class="flex items-center gap-3 mb-4">
        <button id="btn-priv-back" class="md:hidden p-2 rounded-xl bg-white border border-[#F5DCE4] text-[#5A3C4A] hover:bg-pink-50 cursor-pointer">
          ${getIcon('chevronLeft', 20)}
        </button>
        <div>
          <h2 class="text-2xl font-bold font-serif text-[#3B2531]">Privacy & Data</h2>
          <p class="text-xs text-[#8A6575]">Complete control over your personal cycle data.</p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="wc-card p-6 space-y-3">
          <div class="flex items-center gap-2 text-sm font-bold text-[#3B2531]">
            ${getIcon('shield', 20, '#DD5C82')} Your Information is Private
          </div>
          <p class="text-xs text-[#5A3C4A] leading-relaxed">
            Your menstrual logs and health entries are protected and associated only with your device's unique identifier.
            We never sell, share, or broadcast your personal biological information.
          </p>
        </div>

        <div class="wc-card p-6 space-y-3 border-pink-200">
          <h3 class="font-bold text-sm text-[#3B2531]">Reset Cycle History</h3>
          <p class="text-xs text-[#8A6575] leading-relaxed">
            Permanently delete all recorded cycles, symptoms, and lifestyle entries from this device and database.
          </p>
          <button id="btn-delete-history" class="w-full px-4 py-3 rounded-xl border border-red-300 text-red-700 font-bold text-xs hover:bg-red-50 flex items-center justify-center gap-2">
            ${getIcon('trash', 16, '#DC2626')} Delete My Cycle History
          </button>
        </div>
      </div>
    </div>
  `;
}

function setupPrivacyPageEvents() {
  document.getElementById("btn-priv-back")?.addEventListener("click", () => navigateTo("dashboard"));

  document.getElementById("btn-delete-history")?.addEventListener("click", async () => {
    if (confirm("Are you sure you want to permanently erase your cycle history?")) {
      const uid = getOrInitUserId();
      try {
        await fetch(`${API_URL}?userId=${uid}`, { method: "DELETE" });
      } catch (e) {}

      persistData({
        ...appData,
        cycles: [],
        symptomLogs: [],
        lifestyleLogs: []
      });
      navigateTo("dashboard");
    }
  });
}

window.initTracker = async function() {
  currentView = getViewFromLocation();
  await loadData();
  renderTracker();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("tracker-root")) {
      window.initTracker();
    }
  });
} else {
  if (document.getElementById("tracker-root")) {
    window.initTracker();
  }
}
