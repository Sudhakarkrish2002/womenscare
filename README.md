# WOmenCare - Period Tracker & Women's Health Platform

A comprehensive, responsive menstrual health platform and intelligent cycle tracking web application built with:
- **Brand & Visuals**: Custom 3D WOmenCare brand logo (`assets/images/Firefly.png`).
- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS, and clean vector SVG icons.
- **Backend**: Native PHP 8.4 REST API with PDO.
- **Database**: SQLite (`database/womencare.sqlite`), self-contained with automatic table initialization.

---

## 🚀 How to Run Locally

You can launch the entire project instantly using PHP's built-in web server:

```bash
cd "/Users/sudhakarn/Documents/Full Stack Development/WomensCare"
php -S localhost:8000
```

Now open your browser and visit:
👉 **[http://localhost:8000/](http://localhost:8000/)** (Home Page)
👉 **[http://localhost:8000/tracker.html](http://localhost:8000/tracker.html)** (Period & Ovulation Tracker App)

---

## 📁 Project Structure

```
WomensCare/
├── assets/
│   └── images/
│       └── Firefly.png     # Official WOmenCare brand logo
├── api/
│   ├── config.php          # PDO SQLite connection & auto-table creation
│   ├── user.php            # REST API (GET, POST, DELETE) for user cycles, symptoms & logs
│   └── health.php          # Health check endpoint
├── database/
│   └── womencare.sqlite    # SQLite database file
├── assets/
│   ├── css/
│   │   └── style.css       # Design tokens, custom animations, cards & typography
│   ├── js/
│   │   ├── icons.js        # Professional SVG icons library (replaces all emojis)
│   │   ├── tracker-engine.js# Mathematical forecasting, weighted cycle averages & wellness inference
│   │   ├── tracker-ui.js   # Tracker UI controller (Onboarding, Ring, Calendar, Symptoms, History)
│   │   └── main.js         # Mobile responsive navigation & active link handlers
│   └── images/             # High-res product photography & hero banner
├── index.html              # Home page
├── tracker.html            # Period Tracker Web App
├── period-tips.html        # Period Care Tips & Pain Management
├── nutrition.html          # Food & Nutrition During Menstruation
├── essentials.html         # Menstrual Product Essentials & Buying Guide
├── mental-wellness.html    # Mental Wellness, PMDD & 5 Gentle Yoga Poses
└── hygiene.html            # CDC-aligned Hygiene Guidelines & Tampon Safety
```

---

## ✨ Features Included

1. **Responsive for All Devices**:
   - Designed mobile-first with touch-friendly cards and bottom navigation.
   - Beautifully adapts to Tablets, iPads, Laptops, and Desktops.
2. **Interactive Period Tracker**:
   - 4-step guided onboarding (Age, cycle regularity, symptoms).
   - SVG Animated Cycle Ring showing cycle day progress.
   - Mathematical cycle prediction window ($\pm 2$ to $6$ days) & confidence score %.
   - Interactive Month Calendar with period, predicted, and window highlights.
   - 11+ clinical symptom sliders with 1–10 severity rating.
   - Daily lifestyle check-in (sleep, water, stress, exercise, illness, travel).
   - Cycle history with edit modal to adjust past dates/durations.
   - 1-click private data reset.
3. **Professional Iconography**:
   - All emojis replaced with crisp, accessible vector SVG icons.
4. **Dual Persistence Layer**:
   - Connects to PHP + SQLite REST API.
   - Automatically falls back to browser `localStorage` if offline.
