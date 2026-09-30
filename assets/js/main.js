/**
 * WomenCare Main Website Controller
 * Manages responsive interactions, FAQ accordions, and page-specific enhancements
 */

function initMainPageBehaviors() {
  // Interactive FAQ Accordions
  document.querySelectorAll(".wc-accordion-header").forEach(btn => {
    // Avoid double attaching
    if (btn.hasAttribute("data-accordion-bound")) return;
    btn.setAttribute("data-accordion-bound", "true");

    btn.addEventListener("click", () => {
      const content = btn.nextElementSibling;
      const icon = btn.querySelector("[data-accordion-icon]");
      if (content) {
        const isOpen = !content.classList.contains("hidden");
        if (isOpen) {
          content.classList.add("hidden");
          if (icon) icon.style.transform = "rotate(0deg)";
        } else {
          content.classList.remove("hidden");
          if (icon) icon.style.transform = "rotate(180deg)";
        }
      }
    });
  });

  // Re-run icons and auth
  if (typeof renderAllIcons === 'function') {
    renderAllIcons();
  }

  if (typeof Auth !== 'undefined' && Auth.renderAuthUI) {
    Auth.renderAuthUI();
  }
}

window.initMainPageBehaviors = initMainPageBehaviors;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initMainPageBehaviors);
} else {
  initMainPageBehaviors();
}
