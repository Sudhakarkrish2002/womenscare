/**
 * WomenCare Unified Navigation, Footer & Seamless Instant Page Router
 * Ensures 100% identical, professional, responsive navbar and footer across all pages
 * Provides instant, zero-buffering SPA page transitions with background pre-fetching
 */

const NAV_LINKS = [
  { href: "index.html", label: "Home", icon: "home" },
  { href: "tracker.html", label: "Cycle Tracker", icon: "activity" },
  { href: "period-tips.html", label: "Period Tips", icon: "droplet" },
  { href: "nutrition.html", label: "Nutrition", icon: "apple" },
  { href: "essentials.html", label: "Essentials", icon: "package" },
  { href: "mental-wellness.html", label: "Wellness", icon: "heart" },
  { href: "hygiene.html", label: "Hygiene", icon: "shield" }
];

// In-Memory Page Cache for Instant Transitions
const pageCache = new Map();

function getCurrentPageName(urlStr = window.location.href) {
  try {
    const url = new URL(urlStr, window.location.href);
    const path = url.pathname.split("/").pop();
    return (!path || path === "") ? "index.html" : path;
  } catch (e) {
    return "index.html";
  }
}

function renderMobileNavLinks(activePage) {
  return NAV_LINKS.map((item, idx) => {
    const isActive = (item.href === activePage) || (activePage === "" && item.href === "index.html");
    const isOddLast = (idx === NAV_LINKS.length - 1) && (NAV_LINKS.length % 2 !== 0);
    const colSpanClass = isOddLast ? "sm:col-span-2" : "";
    const bgClass = isActive 
      ? "bg-gradient-to-r from-pink-500 to-rose-600 text-white font-bold shadow-xs" 
      : "text-[#5A3C4A] hover:bg-pink-50 border border-transparent hover:border-pink-100 font-semibold";
    const iconColor = isActive ? "#ffffff" : "#DD5C82";
    const iconBg = isActive ? "bg-white/20 text-white" : "bg-pink-50 text-pink-600";

    return `
      <a href="${item.href}" data-page="${item.href}" class="wc-mobile-link flex items-center justify-between py-2.5 px-3.5 rounded-xl text-sm transition-all ${colSpanClass} ${bgClass}">
        <span class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center">
            <span data-icon="${item.icon}" data-size="16" data-color="${iconColor}"></span>
          </span>
          <span>${item.label}</span>
        </span>
        ${isActive ? '<span class="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active</span>' : ''}
      </a>
    `;
  }).join("");
}

function renderUnifiedHeader() {
  const currentPath = getCurrentPageName();

  const desktopNavHtml = NAV_LINKS.map(item => {
    const isActive = (item.href === currentPath) || (currentPath === "" && item.href === "index.html");
    const activeClass = isActive ? "active font-bold shadow-xs" : "text-[#5A3C4A] hover:text-pink-700";
    return `
      <a href="${item.href}" data-page="${item.href}" class="wc-nav-link ${activeClass} flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-[13px] py-1.5 px-3 sm:px-3.5 rounded-full transition-all">
        <span data-icon="${item.icon}" data-size="14" data-color="${isActive ? '#ffffff' : '#DD5C82'}"></span>
        <span>${item.label}</span>
      </a>
    `;
  }).join("");

  const mobileNavHtml = renderMobileNavLinks(currentPath);

  return `
    <div id="wc-top-loader"></div>
    <header id="site-header" class="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#F5DCE4] shadow-xs">
      <div class="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-16 sm:h-[68px] flex items-center justify-between">
        
        <!-- Brand Logo (FAR LEFT END) -->
        <a href="index.html" data-page="index.html" class="flex items-center gap-2 text-decoration-none group shrink-0 transition-transform active:scale-95" aria-label="WOmenCare Home">
          <img src="assets/images/Firefly.png" alt="WOmenCare Logo" class="h-7 sm:h-8 w-auto object-contain drop-shadow-xs group-hover:scale-105 transition-all">
        </a>

        <!-- Desktop Navigation Menu (CENTER PILL) - Visible on lg+ screens -->
        <nav class="hidden lg:flex items-center gap-1 bg-[#FFF6F8]/90 p-1.5 rounded-full border border-pink-100 mx-auto shadow-2xs">
          ${desktopNavHtml}
        </nav>

        <!-- Right Action Slots (FAR RIGHT END) -->
        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <!-- Auth Slot (Sign In / User Avatar Dropdown) -->
          <div class="wc-auth-nav-slot"></div>

          <!-- Primary CTA Button -->
          <a href="tracker.html" data-page="tracker.html" class="hidden md:inline-flex wc-btn-primary text-xs sm:text-sm py-2 px-3.5 shadow-xs whitespace-nowrap font-bold">
            <span data-icon="calendar" data-size="14" data-color="#ffffff"></span>
            <span>Track Cycle</span>
          </a>

          <!-- Hamburger Toggle (Mobile & Tablet <1024px) -->
          <button id="mobile-menu-btn" class="lg:hidden w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-pink-50/90 hover:bg-pink-100 border border-pink-200 text-pink-700 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95" aria-label="Toggle Navigation">
            <span data-icon="menu" data-size="18"></span>
          </button>
        </div>

      </div>

      <!-- Mobile / Tablet Navigation Dropdown (FULL-WIDTH MEGA DRAWER <1024px) -->
      <div id="mobile-menu" class="hidden lg:hidden w-full bg-white/98 backdrop-blur-lg border-b border-[#F5DCE4] px-4 sm:px-6 lg:px-8 py-4 shadow-xl animate-fade-in transition-all">
        <div class="max-w-3xl mx-auto space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${mobileNavHtml}
          </div>
          <div class="wc-mobile-auth-slot"></div>
        </div>
      </div>
    </header>
  `;
}

function renderUnifiedFooter() {
  return `
    <footer id="site-footer" class="bg-white border-t border-[#F5DCE4] pt-10 sm:pt-14 pb-12 sm:pb-16 mt-12 sm:mt-16 w-full">
      <div class="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 pb-8 sm:pb-10 border-b border-pink-100">
          
          <!-- Col 1: Brand Info -->
          <div class="md:col-span-1 lg:col-span-4 space-y-3.5">
            <a href="index.html" data-page="index.html" class="inline-block group" aria-label="WOmenCare Home">
              <img src="assets/images/Firefly.png" alt="WOmenCare Logo" class="h-8 sm:h-9 w-auto object-contain drop-shadow-xs group-hover:scale-105 transition-all">
            </a>
            <p class="text-xs sm:text-sm text-[#5A3C4A] leading-relaxed max-w-sm">
              Empowering women worldwide with intelligent cycle predictions, clinical wellness insights, Ayurvedic comfort routines, and compassionate menstrual health resources.
            </p>
            <div class="flex flex-wrap gap-2 pt-1">
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-pink-700 bg-pink-50 px-2.5 py-0.5 rounded-full border border-pink-100">
                <span data-icon="shield" data-size="12" data-color="#DD5C82"></span> 100% Private
              </span>
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                <span data-icon="check" data-size="12" data-color="#059669"></span> Clinical Backed
              </span>
            </div>
          </div>

          <!-- Col 2: Care & Support (Positioned next to Brand on Tablet, Col 3 on Desktop) -->
          <div class="md:col-span-1 lg:col-span-4 lg:order-last space-y-3">
            <h4 class="text-xs font-bold tracking-wider uppercase text-pink-700 flex items-center gap-1.5">
              <span data-icon="heart" data-size="13" data-color="#DD5C82"></span>
              <span>Care & Support</span>
            </h4>
            <div class="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-pink-50/80 via-white to-rose-50/50 border border-pink-100 space-y-2.5 shadow-2xs">
              <div class="space-y-2">
                <a href="tel:1091" class="flex items-center justify-between p-2.5 rounded-xl bg-white border border-pink-100/90 hover:border-pink-300 hover:bg-pink-50/70 transition-all text-[#3B2531] group shadow-2xs">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-8 h-8 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                      <span data-icon="phone" data-size="14" data-color="#DD5C82"></span>
                    </span>
                    <div class="min-w-0 leading-tight">
                      <div class="text-[11px] text-[#8A6575] font-semibold">Women Support</div>
                      <div class="text-xs font-bold text-pink-700">1091 <span class="text-[10px] text-gray-500 font-normal">(Toll-Free)</span></div>
                    </div>
                  </div>
                  <span class="text-[11px] text-pink-600 font-bold bg-pink-50 group-hover:bg-pink-100 px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap flex items-center gap-1">
                    <span>Call</span>
                    <span class="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                  </span>
                </a>
                <a href="tel:08046110007" class="flex items-center justify-between p-2.5 rounded-xl bg-white border border-pink-100/90 hover:border-pink-300 hover:bg-pink-50/70 transition-all text-[#3B2531] group shadow-2xs">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <span data-icon="heart" data-size="14" data-color="#7A5C82"></span>
                    </span>
                    <div class="min-w-0 leading-tight">
                      <div class="text-[11px] text-[#8A6575] font-semibold">Mental Health</div>
                      <div class="text-xs font-bold text-purple-700">080-46110007</div>
                    </div>
                  </div>
                  <span class="text-[11px] text-pink-600 font-bold bg-pink-50 group-hover:bg-pink-100 px-2.5 py-1 rounded-lg transition-all shrink-0 whitespace-nowrap flex items-center gap-1">
                    <span>Call</span>
                    <span class="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
                  </span>
                </a>
              </div>
              <p class="text-[10px] text-[#8A6575] leading-relaxed pt-2 border-t border-pink-100">
                <strong>Medical Disclaimer:</strong> For awareness only; not a substitute for clinical medical diagnosis.
              </p>
            </div>
          </div>

          <!-- Cols 3 & 4: Platform & Knowledge Hub (2-Column Grid on Mobile and Tablet) -->
          <div class="md:col-span-2 lg:col-span-4 grid grid-cols-2 gap-4 sm:gap-6">
            <!-- Platform & Tools -->
            <div class="space-y-3">
              <h4 class="text-xs font-bold tracking-wider uppercase text-pink-700 flex items-center gap-1.5">
                <span data-icon="activity" data-size="13" data-color="#DD5C82"></span>
                <span>Platform</span>
              </h4>
              <ul class="space-y-2 text-xs sm:text-sm text-[#5A3C4A]">
                <li><a href="tracker.html?view=dashboard" class="hover:text-pink-600 transition-colors block py-0.5">Cycle Tracker</a></li>
                <li><a href="tracker.html?view=ovulation" class="hover:text-pink-600 transition-colors block py-0.5">Ovulation Calc</a></li>
                <li><a href="tracker.html?view=symptoms" class="hover:text-pink-600 transition-colors block py-0.5">Symptom Logger</a></li>
                <li><a href="tracker.html?view=history" class="hover:text-pink-600 transition-colors block py-0.5">Cycle History</a></li>
                <li><a href="tracker.html?view=ayurveda" class="hover:text-pink-600 transition-colors block py-0.5">Ayurvedic Care</a></li>
              </ul>
            </div>

            <!-- Knowledge Hub -->
            <div class="space-y-3">
              <h4 class="text-xs font-bold tracking-wider uppercase text-pink-700 flex items-center gap-1.5">
                <span data-icon="bookOpen" data-size="13" data-color="#DD5C82"></span>
                <span>Knowledge</span>
              </h4>
              <ul class="space-y-2 text-xs sm:text-sm text-[#5A3C4A]">
                <li><a href="period-tips.html" data-page="period-tips.html" class="hover:text-pink-600 transition-colors block py-0.5">Period Tips</a></li>
                <li><a href="nutrition.html" data-page="nutrition.html" class="hover:text-pink-600 transition-colors block py-0.5">Food & Diet</a></li>
                <li><a href="essentials.html" data-page="essentials.html" class="hover:text-pink-600 transition-colors block py-0.5">Essentials</a></li>
                <li><a href="mental-wellness.html" data-page="mental-wellness.html" class="hover:text-pink-600 transition-colors block py-0.5">Wellness Yoga</a></li>
                <li><a href="hygiene.html" data-page="hygiene.html" class="hover:text-pink-600 transition-colors block py-0.5">Hygiene Guide</a></li>
              </ul>
            </div>
          </div>

        </div>

        <!-- Bottom Bar -->
        <div class="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8A6575] text-center sm:text-left">
          <p>&copy; 2026 WOmenCare Inc. All rights reserved.</p>
          <div class="flex flex-wrap items-center justify-center gap-4 text-[11px] sm:text-xs">
            <a href="hygiene.html" data-page="hygiene.html" class="hover:text-pink-600 transition-colors">Privacy & Safety</a>
            <span class="text-pink-200 hidden sm:inline">&bull;</span>
            <a href="period-tips.html" data-page="period-tips.html" class="hover:text-pink-600 transition-colors">Medical Policy</a>
            <span class="text-pink-200 hidden sm:inline">&bull;</span>
            <a href="essentials.html" data-page="essentials.html" class="hover:text-pink-600 transition-colors">Essentials</a>
            <span class="text-pink-200 hidden sm:inline">&bull;</span>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSczaHwdclpGOYHeDipnvxU9Ffp5q8fQMyhBnkg1Ap38XXHSOQ/viewform" target="_blank" rel="noopener noreferrer" data-no-spa class="hover:text-pink-600 font-semibold text-pink-700 transition-colors flex items-center gap-1">
              <span>Share Feedback</span>
              <span data-icon="externalLink" data-size="11"></span>
            </a>
          </div>
          <p class="text-[11px] text-pink-400 font-medium">Crafted with care for women's health</p>
        </div>
      </div>
    </footer>
  `;
}

function updateActiveNavLinks(targetUrl) {
  const activePage = getCurrentPageName(targetUrl);

  document.querySelectorAll(".wc-nav-link").forEach(link => {
    const page = link.getAttribute("data-page") || link.getAttribute("href");
    const isActive = (page === activePage) || (activePage === "" && page === "index.html");
    if (isActive) {
      link.className = "wc-nav-link active font-bold shadow-xs flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-[13px] py-1.5 px-3 sm:px-3.5 rounded-full transition-all";
      const icon = link.querySelector("[data-icon]");
      if (icon) icon.setAttribute("data-color", "#ffffff");
    } else {
      link.className = "wc-nav-link text-[#5A3C4A] hover:text-pink-700 flex items-center gap-1.5 whitespace-nowrap text-xs sm:text-[13px] py-1.5 px-3 sm:px-3.5 rounded-full transition-all";
      const icon = link.querySelector("[data-icon]");
      if (icon) icon.setAttribute("data-color", "#DD5C82");
    }
  });

  const mobileNavContainer = document.querySelector("#mobile-menu .grid");
  if (mobileNavContainer) {
    mobileNavContainer.innerHTML = renderMobileNavLinks(activePage);
  }

  if (typeof renderAllIcons === 'function') {
    renderAllIcons();
  }
}

// Top Loading Progress Bar Controller
let loaderTimeout = null;
function showTopLoader() {
  const loader = document.getElementById("wc-top-loader");
  if (!loader) return;
  clearTimeout(loaderTimeout);
  loader.style.opacity = "1";
  loader.style.width = "30%";
  loaderTimeout = setTimeout(() => {
    loader.style.width = "75%";
  }, 100);
}

function hideTopLoader() {
  const loader = document.getElementById("wc-top-loader");
  if (!loader) return;
  clearTimeout(loaderTimeout);
  loader.style.width = "100%";
  setTimeout(() => {
    loader.style.opacity = "0";
    setTimeout(() => {
      loader.style.width = "0%";
    }, 200);
  }, 120);
}

function normalizePath(urlStr) {
  try {
    const u = new URL(urlStr, window.location.href);
    let p = u.pathname;
    if (p.endsWith("/")) p += "index.html";
    return p;
  } catch (e) {
    return urlStr;
  }
}

function cacheCurrentPage() {
  const cleanUrl = normalizePath(window.location.href);
  const contentContainer = document.getElementById("app-content-container") || document.querySelector("main") || document.body;
  if (contentContainer) {
    pageCache.set(cleanUrl, {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      contentHtml: contentContainer.innerHTML
    });
  }
}

// Background Page Prefetcher
async function prefetchPage(urlStr) {
  try {
    const cleanUrl = normalizePath(urlStr);
    if (pageCache.has(cleanUrl)) return pageCache.get(cleanUrl);

    const res = await fetch(cleanUrl);
    if (!res.ok) return null;
    const htmlText = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    const contentContainer = doc.getElementById("app-content-container") || doc.querySelector("main") || doc.body;
    const data = {
      title: doc.title,
      description: doc.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      contentHtml: contentContainer ? contentContainer.innerHTML : "",
      rawDoc: doc
    };

    pageCache.set(cleanUrl, data);
    return data;
  } catch (e) {
    return null;
  }
}

function prefetchAllSitePages() {
  cacheCurrentPage();
  const prefetchList = NAV_LINKS.map(item => item.href);
  prefetchList.forEach(page => {
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => prefetchPage(page));
    } else {
      setTimeout(() => prefetchPage(page), 250);
    }
  });
}

// Seamless Router: Smooth Page Switcher
let isNavigating = false;
async function navigateToPage(urlStr, isPopState = false) {
  if (isNavigating) return;

  const targetUrl = new URL(urlStr, window.location.href);
  const currentUrl = new URL(window.location.href);

  // If navigating to the exact same URL (same pathname and search)
  if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search && !isPopState) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Handle in-page tracker view switching if staying on tracker.html
  if (targetUrl.pathname.includes("tracker.html") && currentUrl.pathname.includes("tracker.html")) {
    const targetView = targetUrl.searchParams.get("view") || "dashboard";
    if (typeof navigateTo === "function") {
      if (!isPopState) history.pushState(null, '', targetUrl.href);
      navigateTo(targetView);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
  }

  isNavigating = true;
  showTopLoader();

  // Instant visual feedback on navbar
  updateActiveNavLinks(targetUrl.href);

  // Close mobile menu immediately if open
  const mobileMenu = document.getElementById("mobile-menu");
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
    mobileMenu.classList.add("hidden");
    if (mobileMenuBtn) {
      mobileMenuBtn.setAttribute("aria-expanded", "false");
      mobileMenuBtn.classList.remove("bg-pink-100", "text-pink-800");
      mobileMenuBtn.innerHTML = '<span data-icon="menu" data-size="18"></span>';
    }
  }

  const container = document.getElementById("app-content-container") || document.querySelector("main");

  // Fetch page data (instant from cache or network)
  const normPath = normalizePath(targetUrl.href);
  let pageData = pageCache.get(normPath);
  if (!pageData) {
    pageData = await prefetchPage(targetUrl.href);
  }

  if (!pageData || !pageData.contentHtml) {
    // Fallback to normal navigation if fetch failed
    window.location.href = targetUrl.href;
    return;
  }

  // Smooth cross-fade transition
  if (container) {
    container.classList.add("page-leaving");
  }

  // Short 100ms delay for smooth fade out
  await new Promise(r => setTimeout(r, 90));

  // Swap content
  if (container) {
    container.innerHTML = pageData.contentHtml;
  }

  // Update Page Title and Meta
  if (pageData.title) document.title = pageData.title;
  if (pageData.description) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", pageData.description);
  }

  // Update URL state
  if (!isPopState) {
    history.pushState(null, '', targetUrl.href);
  }

  // Reset scroll to top instantaneously
  window.scrollTo(0, 0);

  // Animate fade-in
  if (container) {
    container.classList.remove("page-leaving");
    container.classList.add("page-entering");
    setTimeout(() => {
      container.classList.remove("page-entering");
    }, 120);
  }

  hideTopLoader();
  isNavigating = false;

  // Post-Navigation Lifecycle Initialization
  runPostNavigation(targetUrl);
}

// Post-Navigation Lifecycle Handler
function runPostNavigation(targetUrl) {
  // Re-run icons
  if (typeof renderAllIcons === 'function') {
    renderAllIcons();
  }

  // Re-run Auth
  if (window.Auth && typeof window.Auth.renderAuthUI === 'function') {
    window.Auth.renderAuthUI();
  }

  // Re-run Main UI features (accordions, video listeners)
  if (typeof window.initMainPageBehaviors === 'function') {
    window.initMainPageBehaviors();
  }

  // If on tracker.html, initialize tracker
  if (targetUrl.pathname.includes("tracker.html")) {
    if (typeof window.initTracker === 'function') {
      window.initTracker();
    } else if (typeof renderTracker === 'function') {
      renderTracker();
    }
  }
}

function setupGlobalNavigationInterceptors() {
  // Global click delegator for seamless internal links
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href) return;

    // Ignore external, anchor-only, mailto, tel, target="_blank", or download links
    if (
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("javascript:") ||
      link.getAttribute("target") === "_blank" ||
      link.hasAttribute("download") ||
      link.hasAttribute("data-no-spa")
    ) {
      return;
    }

    try {
      const targetUrl = new URL(href, window.location.href);
      // Check if internal origin
      if (targetUrl.origin === window.location.origin) {
        e.preventDefault();
        navigateToPage(targetUrl.href);
      }
    } catch (err) {
      // Allow browser default on invalid URLs
    }
  });

  // Pre-fetch on hover or touch start for ultra-low latency
  document.addEventListener("mouseover", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (href && !href.startsWith("#") && !href.startsWith("http") && !href.startsWith("mailto")) {
      prefetchPage(href);
    }
  }, { passive: true });

  document.addEventListener("touchstart", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (href && !href.startsWith("#") && !href.startsWith("http") && !href.startsWith("mailto")) {
      prefetchPage(href);
    }
  }, { passive: true });

  // Handle Browser Back & Forward Buttons
  window.addEventListener("popstate", () => {
    navigateToPage(window.location.href, true);
  });
}

function initNavFooter() {
  // Inject or replace Header
  const headerContainer = document.getElementById("site-header");
  if (headerContainer && !headerContainer.classList.contains("unified-ready")) {
    headerContainer.outerHTML = renderUnifiedHeader();
  }

  // Inject or replace Footer
  const footerContainer = document.getElementById("site-footer");
  if (footerContainer && !footerContainer.classList.contains("unified-ready")) {
    footerContainer.outerHTML = renderUnifiedFooter();
  }

  // Setup Mobile Hamburger Menu
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (mobileMenuBtn && mobileMenu) {
    const updateMenuIcon = (isOpen) => {
      mobileMenuBtn.innerHTML = isOpen 
        ? '<span data-icon="x" data-size="18"></span>' 
        : '<span data-icon="menu" data-size="18"></span>';
      if (typeof renderAllIcons === 'function') {
        renderAllIcons();
      }
    };

    mobileMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpening = mobileMenu.classList.contains("hidden");
      if (isOpening) {
        mobileMenu.classList.remove("hidden");
        mobileMenuBtn.setAttribute("aria-expanded", "true");
        mobileMenuBtn.classList.add("bg-pink-100", "text-pink-800");
        updateMenuIcon(true);
      } else {
        mobileMenu.classList.add("hidden");
        mobileMenuBtn.setAttribute("aria-expanded", "false");
        mobileMenuBtn.classList.remove("bg-pink-100", "text-pink-800");
        updateMenuIcon(false);
      }
    });

    document.addEventListener("click", (e) => {
      if (!mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        if (!mobileMenu.classList.contains("hidden")) {
          mobileMenu.classList.add("hidden");
          mobileMenuBtn.setAttribute("aria-expanded", "false");
          mobileMenuBtn.classList.remove("bg-pink-100", "text-pink-800");
          updateMenuIcon(false);
        }
      }
    });
  }

  // Setup Global Link Interceptors & Prefetching
  setupGlobalNavigationInterceptors();

  // Prefetch other site pages in the background
  prefetchAllSitePages();

  // Trigger Auth UI Rendering
  if (window.Auth && typeof window.Auth.renderAuthUI === 'function') {
    window.Auth.renderAuthUI();
  }

  // Trigger Icons Rendering
  if (typeof renderAllIcons === 'function') {
    renderAllIcons();
  }
}

// Expose navigateToPage globally
window.navigateToPage = navigateToPage;

// Auto-run on DOM ready or immediately if available
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initNavFooter);
} else {
  initNavFooter();
}
