/**
 * WomenCare Authentication System & Modal Controller
 * Provides seamless Sign In, Account Creation, Session Management, and Nav UI updates
 */

const Auth = {
  TOKEN_KEY: 'wc_auth_token',
  USER_KEY: 'wc_current_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  getUser() {
    try {
      const u = localStorage.getItem(this.USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  },

  isLoggedIn() {
    return !!(this.getToken() && this.getUser());
  },

  setSession(user, token) {
    if (token) localStorage.setItem(this.TOKEN_KEY, token);
    if (user) localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.renderAuthUI();
    // Dispatch custom event for tracker to reload if needed
    window.dispatchEvent(new CustomEvent('wc-auth-changed', { detail: { user } }));
  },

  async logout() {
    const token = this.getToken();
    if (token) {
      try {
        await fetch('api/auth.php?action=logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ token })
        });
      } catch (err) {
        console.warn('Logout API notification failed', err);
      }
    }
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.renderAuthUI();
    window.dispatchEvent(new CustomEvent('wc-auth-changed', { detail: { user: null } }));
    
    // If currently on tracker, refresh page or reset to default
    if (window.location.pathname.includes('tracker.html')) {
      window.location.reload();
    }
  },

  async checkSession() {
    const token = this.getToken();
    if (!token) {
      this.renderAuthUI();
      return null;
    }

    try {
      const res = await fetch('api/auth.php?action=me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.user) {
          const updatedUser = { ...this.getUser(), ...data.user };
          localStorage.setItem(this.USER_KEY, JSON.stringify(updatedUser));
          this.renderAuthUI();
          return updatedUser;
        }
      } else {
        // Token expired
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        this.renderAuthUI();
      }
    } catch (e) {
      // Offline fallback: keep existing cached user
      this.renderAuthUI();
    }
    return null;
  },

  openModal(tab = 'signin', message = null) {
    let modal = document.getElementById('wc-auth-modal');
    if (!modal) {
      this.injectModal();
      modal = document.getElementById('wc-auth-modal');
    }
    this.switchTab(tab);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    // Reset or set message
    const errBox = document.getElementById('wc-auth-error');
    if (errBox) {
      if (message) {
        this.showNotice(message);
      } else {
        errBox.classList.add('hidden');
      }
    }
  },

  requireAuth(callback, message = 'Please sign in or create an account to track your cycle and secure your health data.') {
    if (this.isLoggedIn()) {
      if (typeof callback === 'function') callback();
      return true;
    }
    window._pendingAuthSuccess = typeof callback === 'function' ? callback : null;
    this.openModal('signin', message);
    return false;
  },

  closeModal() {
    const modal = document.getElementById('wc-auth-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      document.body.style.overflow = '';
    }
  },

  switchTab(tabName) {
    const signinTab = document.getElementById('tab-btn-signin');
    const registerTab = document.getElementById('tab-btn-register');
    const signinForm = document.getElementById('wc-signin-form');
    const registerForm = document.getElementById('wc-register-form');
    const modalTitle = document.getElementById('wc-auth-modal-title');
    const modalSubtitle = document.getElementById('wc-auth-modal-subtitle');
    const errBox = document.getElementById('wc-auth-error');
    if (errBox && !errBox.hasAttribute('data-persisted-notice')) {
      errBox.classList.add('hidden');
    }

    if (!signinTab || !registerTab) return;

    if (tabName === 'signin') {
      signinTab.className = 'flex-1 py-3 text-sm font-bold text-pink-700 border-b-2 border-pink-600 focus:outline-none transition-colors';
      registerTab.className = 'flex-1 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 border-b-2 border-transparent focus:outline-none transition-colors';
      signinForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      modalTitle.innerText = 'Welcome Back';
      modalSubtitle.innerText = 'Sign in to sync your cycles, symptoms, and health records securely.';
    } else {
      registerTab.className = 'flex-1 py-3 text-sm font-bold text-pink-700 border-b-2 border-pink-600 focus:outline-none transition-colors';
      signinTab.className = 'flex-1 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 border-b-2 border-transparent focus:outline-none transition-colors';
      registerForm.classList.remove('hidden');
      signinForm.classList.add('hidden');
      modalTitle.innerText = 'Create Free Account';
      modalSubtitle.innerText = 'Private, secure menstrual cycle tracking & holistic care.';
    }
  },

  async handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    const btn = document.getElementById('signin-submit-btn');
    const errBox = document.getElementById('wc-auth-error');

    if (!email || !password) {
      this.showError('Please enter both email and password.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> Signing In...`;

    try {
      const res = await fetch('api/auth.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok || data.error) {
        // If user does not exist in the database, automatically route to the Sign Up / Register process
        if (res.status === 404 || data.code === 'USER_NOT_FOUND') {
          this.showNotice('No account found for ' + email + '. Routing you to create a free account...');
          setTimeout(() => {
            this.switchTab('register');
            const regEmail = document.getElementById('register-email');
            if (regEmail) regEmail.value = email;
            const regPass = document.getElementById('register-password');
            if (regPass && password && password.length >= 6) regPass.value = password;
            const regName = document.getElementById('register-name');
            if (regName) regName.focus();
            this.showNotice('No account found for ' + email + '. Please enter your name to complete your free account.');
          }, 500);
          return;
        }
        throw new Error(data.error || 'Failed to sign in. Please try again.');
      }

      this.setSession(data.user, data.user.sessionToken);
      this.showSuccess('Welcome back, ' + (data.user.name || 'Friend') + '!');
      setTimeout(() => {
        this.closeModal();
        if (typeof window._pendingAuthSuccess === 'function') {
          const fn = window._pendingAuthSuccess;
          window._pendingAuthSuccess = null;
          fn();
        }
      }, 700);
    } catch (err) {
      this.showError(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Sign In</span>`;
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const age = parseInt(document.getElementById('register-age').value) || 26;
    const cycleLength = parseInt(document.getElementById('register-cycle-length').value) || 28;
    const btn = document.getElementById('register-submit-btn');

    if (!name) {
      this.showError('Please enter your full name.');
      return;
    }
    if (!email || !email.includes('@')) {
      this.showError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      this.showError('Password must be at least 6 characters.');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> Creating Account...`;

    try {
      const res = await fetch('api/auth.php?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          age,
          cycleLength,
          periodLength: 5,
          regularity: 'Regular (26-32 days)'
        })
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Registration failed.');
      }

      this.setSession(data.user, data.user.sessionToken);
      this.showSuccess('Account created! Welcome to WOmenCare.');
      setTimeout(() => {
        this.closeModal();
        if (typeof window._pendingAuthSuccess === 'function') {
          const fn = window._pendingAuthSuccess;
          window._pendingAuthSuccess = null;
          fn();
        }
      }, 800);
    } catch (err) {
      this.showError(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span>Create Free Account</span>`;
    }
  },

  showError(msg) {
    const errBox = document.getElementById('wc-auth-error');
    if (errBox) {
      errBox.removeAttribute('data-persisted-notice');
      errBox.innerHTML = `<div class="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
        <span class="font-bold">Error:</span> ${msg}
      </div>`;
      errBox.classList.remove('hidden');
    }
  },

  showNotice(msg) {
    const errBox = document.getElementById('wc-auth-error');
    if (errBox) {
      errBox.setAttribute('data-persisted-notice', 'true');
      errBox.innerHTML = `<div class="p-3 rounded-xl bg-pink-50 border border-pink-200 text-pink-800 text-xs flex items-center gap-2 animate-fade-in">
        <span class="font-bold">Notice:</span> ${msg}
      </div>`;
      errBox.classList.remove('hidden');
    }
  },

  showSuccess(msg) {
    const errBox = document.getElementById('wc-auth-error');
    if (errBox) {
      errBox.removeAttribute('data-persisted-notice');
      errBox.innerHTML = `<div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
        <span class="font-bold">Success:</span> ${msg}
      </div>`;
      errBox.classList.remove('hidden');
    }
  },

  injectModal() {
    if (document.getElementById('wc-auth-modal')) return;

    const modalHtml = `
      <div id="wc-auth-modal" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity" role="dialog" aria-modal="true">
        <div class="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-pink-100 overflow-hidden transform transition-all animate-fade-in my-8">
          
          <!-- Top Accent Banner -->
          <div class="bg-gradient-to-r from-pink-500 via-rose-500 to-pink-600 px-6 py-4 text-white flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="bg-white/95 rounded-xl px-2.5 py-1 shadow-xs flex items-center justify-center">
                <img src="assets/images/Firefly.png" alt="WOmenCare Logo" class="h-6 sm:h-7 w-auto object-contain">
              </div>
              <span class="font-serif text-lg sm:text-xl font-bold tracking-tight">Account Portal</span>
            </div>
            <button onclick="Auth.closeModal()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer" aria-label="Close modal">
              <span data-icon="x" data-size="18" data-color="#ffffff"></span>
            </button>
          </div>

          <!-- Header description -->
          <div class="px-6 pt-5 pb-2">
            <h3 id="wc-auth-modal-title" class="font-serif text-2xl font-bold text-[#3B2531]">Welcome Back</h3>
            <p id="wc-auth-modal-subtitle" class="text-xs text-[#8A6575] mt-1">Sign in to sync your cycles and health records securely.</p>
          </div>

          <!-- Tab Bar -->
          <div class="flex border-b border-[#F5DCE4] px-6">
            <button id="tab-btn-signin" onclick="Auth.switchTab('signin')" class="flex-1 py-3 text-sm font-bold text-pink-700 border-b-2 border-pink-600 focus:outline-none transition-colors">
              Sign In
            </button>
            <button id="tab-btn-register" onclick="Auth.switchTab('register')" class="flex-1 py-3 text-sm font-semibold text-gray-500 hover:text-gray-700 border-b-2 border-transparent focus:outline-none transition-colors">
              Create Account
            </button>
          </div>

          <!-- Alert / Error message -->
          <div id="wc-auth-error" class="hidden px-6 pt-4"></div>

          <!-- Modal Body -->
          <div class="p-6">
            
            <!-- Sign In Form -->
            <form id="wc-signin-form" onsubmit="Auth.handleSignIn(event)" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-[#3B2531] mb-1.5 uppercase tracking-wider">Email Address</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <span data-icon="mail" data-size="16"></span>
                  </div>
                  <input type="email" id="signin-email" required placeholder="you@example.com" class="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all">
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#3B2531] mb-1.5 uppercase tracking-wider">Password</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <span data-icon="lock" data-size="16"></span>
                  </div>
                  <input type="password" id="signin-password" required placeholder="••••••••" class="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all">
                  <button type="button" onclick="Auth.togglePasswordVisibility('signin-password')" class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600">
                    <span data-icon="eye" data-size="16"></span>
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between text-xs">
                <label class="flex items-center gap-2 cursor-pointer text-[#5A3C4A]">
                  <input type="checkbox" checked class="rounded text-pink-600 focus:ring-pink-500">
                  <span>Remember me</span>
                </label>
              </div>

              <button type="submit" id="signin-submit-btn" class="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                <span data-icon="logIn" data-size="16" data-color="#ffffff"></span>
                <span>Sign In</span>
              </button>
            </form>

            <!-- Register Form -->
            <form id="wc-register-form" onsubmit="Auth.handleRegister(event)" class="space-y-3.5 hidden">
              <div>
                <label class="block text-xs font-bold text-[#3B2531] mb-1 uppercase tracking-wider">Full Name</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <span data-icon="user" data-size="16"></span>
                  </div>
                  <input type="text" id="register-name" required placeholder="e.g. Priya Nair" class="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all">
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#3B2531] mb-1 uppercase tracking-wider">Email Address</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <span data-icon="mail" data-size="16"></span>
                  </div>
                  <input type="email" id="register-email" required placeholder="priya@example.com" class="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all">
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#3B2531] mb-1 uppercase tracking-wider">Password (Min. 6 characters)</label>
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <span data-icon="lock" data-size="16"></span>
                  </div>
                  <input type="password" id="register-password" required minlength="6" placeholder="Create secure password" class="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100 transition-all">
                  <button type="button" onclick="Auth.togglePasswordVisibility('register-password')" class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600">
                    <span data-icon="eye" data-size="16"></span>
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-bold text-[#3B2531] mb-1 uppercase tracking-wider">Age</label>
                  <input type="number" id="register-age" value="25" min="12" max="65" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100">
                </div>
                <div>
                  <label class="block text-xs font-bold text-[#3B2531] mb-1 uppercase tracking-wider">Avg. Cycle (Days)</label>
                  <input type="number" id="register-cycle-length" value="28" min="20" max="45" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100">
                </div>
              </div>

              <p class="text-[11px] text-[#8A6575] leading-relaxed">
                By registering, your menstrual logs are stored with end-to-end privacy and secure encrypted storage.
              </p>

              <button type="submit" id="register-submit-btn" class="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2">
                <span data-icon="userPlus" data-size="16" data-color="#ffffff"></span>
                <span>Create Free Account</span>
              </button>
            </form>

          </div>

          <!-- Bottom Footer Note -->
          <div class="px-4 sm:px-6 py-3 bg-gradient-to-r from-pink-50/70 via-rose-50/40 to-pink-50/70 border-t border-pink-100/90 flex items-center justify-center gap-2 text-center text-[11px] sm:text-xs font-semibold text-[#6E4B5E]">
            <span class="w-5 h-5 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center shrink-0 shadow-2xs">
              <span data-icon="shield" data-size="12" data-color="#DD5C82"></span>
            </span>
            <span class="whitespace-nowrap">100% Private &bull; HIPAA & GDPR Aligned</span>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if (typeof renderAllIcons === 'function') {
      renderAllIcons();
    }
  },


  togglePasswordVisibility(fieldId) {
    const input = document.getElementById(fieldId);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  },

  toggleUserDropdown(e) {
    if (e) {
      e.stopPropagation();
    }
    const menu = document.getElementById('user-dropdown-menu');
    if (menu) {
      menu.classList.toggle('hidden');
    }
  },

  renderAuthUI() {
    const user = this.getUser();
    const containers = document.querySelectorAll('.wc-auth-nav-slot');
    const mobileContainers = document.querySelectorAll('.wc-mobile-auth-slot');

    containers.forEach(container => {
      if (user) {
        const initial = (user.name || 'U').charAt(0).toUpperCase();
        container.innerHTML = `
          <div class="relative">
            <button id="user-menu-btn" onclick="Auth.toggleUserDropdown(event)" class="flex items-center gap-2.5 py-1.5 px-3 rounded-full bg-pink-50 hover:bg-pink-100/80 border border-pink-200 transition-all text-sm font-semibold text-[#3B2531] cursor-pointer">
              <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-600 to-rose-400 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                ${initial}
              </div>
              <span class="hidden md:inline max-w-[110px] truncate">${user.name.split(' ')[0]}</span>
              <span data-icon="chevronDown" data-size="14" class="text-pink-600 transition-transform"></span>
            </button>

            <!-- Dropdown Menu -->
            <div id="user-dropdown-menu" class="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-pink-100 py-2 hidden z-50 animate-fade-in">
              <div class="px-4 py-2.5 border-b border-gray-100">
                <p class="text-xs text-gray-500">Signed in as</p>
                <p class="text-sm font-bold text-[#3B2531] truncate">${user.name}</p>
                <p class="text-[11px] text-[#8A6575] truncate">${user.email}</p>
              </div>
              <a href="tracker.html" class="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-pink-50 hover:text-pink-700 transition-colors">
                <span data-icon="activity" data-size="15" data-color="#DD5C82"></span>
                My Cycle Dashboard
              </a>
              <a href="period-tips.html" class="flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-pink-50 hover:text-pink-700 transition-colors">
                <span data-icon="bookOpen" data-size="15" data-color="#DD5C82"></span>
                Care Guidelines
              </a>
              <div class="border-t border-gray-100 my-1"></div>
              <button id="auth-signout-btn" onclick="Auth.logout()" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                <span data-icon="logOut" data-size="15" data-color="#DC2626"></span>
                Sign Out
              </button>
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <button onclick="Auth.openModal('signin')" class="wc-btn-ghost text-xs py-2 px-3 sm:px-4 font-bold border border-pink-200 text-pink-700 hover:bg-pink-50 cursor-pointer">
            <span data-icon="user" data-size="14"></span>
            <span>Sign In</span>
          </button>
        `;
      }
    });

    mobileContainers.forEach(container => {
      if (user) {
        const initial = (user.name || 'U').charAt(0).toUpperCase();
        container.innerHTML = `
          <div class="pt-3 border-t border-pink-100/90 mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 bg-gradient-to-r from-pink-50/90 to-rose-50/50 rounded-2xl border border-pink-100/80 shadow-2xs">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-600 to-rose-400 text-white flex items-center justify-center text-sm font-bold shadow-xs shrink-0">
                ${initial}
              </div>
              <div class="leading-tight">
                <p class="text-xs font-bold text-[#3B2531]">${user.name}</p>
                <p class="text-[11px] text-[#8A6575] truncate max-w-[180px] sm:max-w-xs">${user.email}</p>
              </div>
            </div>
            <button id="mobile-logout-btn" onclick="Auth.logout()" class="w-full sm:w-auto py-2 px-4 rounded-xl text-xs font-bold text-red-600 bg-white hover:bg-red-50 border border-red-200/80 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98 shrink-0">
              <span data-icon="logOut" data-size="14" data-color="#DC2626"></span>
              <span>Log Out</span>
            </button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="pt-3 border-t border-pink-100/90 mt-3 flex flex-col sm:flex-row items-center gap-2">
            <button onclick="Auth.openModal('signin')" class="w-full sm:flex-1 py-2.5 rounded-xl border border-pink-200 text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 flex items-center justify-center gap-1.5 transition-all">
              <span data-icon="logIn" data-size="14"></span>
              <span>Sign In</span>
            </button>
            <button onclick="Auth.openModal('register')" class="w-full sm:flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 flex items-center justify-center gap-1.5 shadow-xs transition-all">
              <span data-icon="userPlus" data-size="14" data-color="#ffffff"></span>
              <span>Register</span>
            </button>
          </div>
        `;
      }
    });

    if (typeof renderAllIcons === 'function') {
      renderAllIcons();
    }
  }
};

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  Auth.injectModal();
  Auth.checkSession();
});

document.addEventListener('click', (e) => {
  const menu = document.getElementById('user-dropdown-menu');
  const btn = document.getElementById('user-menu-btn');
  if (menu && !menu.classList.contains('hidden')) {
    if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
      menu.classList.add('hidden');
    }
  }
});
