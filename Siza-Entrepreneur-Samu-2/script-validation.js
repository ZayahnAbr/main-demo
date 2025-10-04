/* ==========================================================================
   Siza Platform — Validation & Error Handling 

/* ------------------------------------------------------------------
   Toast (Centralized, Reusable)
   ------------------------------------------------------------------ */
function showToast(message, ms = 3200) {
  let t = document.getElementById("inlineToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "inlineToast";
    Object.assign(t.style, {
      position: "fixed",
      left: "50%",
      top: "18px",
      transform: "translateX(-50%)",
      background: "#111",
      color: "#fff",
      padding: "10px 14px",
      borderRadius: "10px",
      zIndex: 99999,
      boxShadow: "0 6px 18px rgba(0,0,0,.25)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      maxWidth: "90vw",
      textAlign: "center",
      lineHeight: 1.25
    });
    document.body.appendChild(t);
  }
  t.textContent = String(message || "Something went wrong. Please try again.");
  t.style.display = "block";
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => (t.style.display = "none"), ms);
}

/* Optional: Route any remaining alert() calls through the toast for a consistent, non-blocking user experience. */
if (!window._alertPatched) {
  const _alert = window.alert;
  window.alert = (m) => showToast(m);
  window._alertPatched = true;
}

/* ------------------------------------------------------------------
   Validation Helpers
   ------------------------------------------------------------------ */
const isEmail   = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || ""));
const hasMin    = (v, n) => String(v || "").trim().length >= n;
const hasMax    = (v, n) => String(v || "").trim().length <= n;
const between   = (v, a, b) => hasMin(v, a) && hasMax(v, b);

function fieldError(el, msg) {
  if (!el) return;
  el.setAttribute("aria-invalid", "true");
  const holder = el.closest(".field") || el.parentElement || el;
  let err = holder.querySelector(".field-error");
  if (!err) {
    err = document.createElement("div");
    err.className = "field-error";
    Object.assign(err.style, { color:"#b00020", fontSize:"0.9rem", marginTop:"6px" });
    holder.appendChild(err);
  }
  err.textContent = msg;
}
function clearFieldError(el) {
  if (!el) return;
  el.removeAttribute("aria-invalid");
  const holder = el.closest(".field") || el.parentElement || el;
  const err = holder && holder.querySelector(".field-error");
  if (err) err.textContent = "";
}
function validate(el, ok, msg) {
  if (ok) { clearFieldError(el); return true; }
  fieldError(el, msg); return false;
}

/* ------------------------------------------------------------------
   Form Wiring (Skips Gracefully If Elements Are Absent)
   ------------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  // Login form.
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      const email = document.getElementById("loginEmail");
      const pass  = document.getElementById("loginPassword");
      let ok = true;
      ok &= validate(email, isEmail(email?.value), "Enter a valid email.");
      ok &= validate(pass,  hasMin(pass?.value, 1), "Password is required.");
      if (!ok) e.preventDefault();
    });
  }

  // Signup form.
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      const name  = document.getElementById("signupName");
      const email = document.getElementById("signupEmail");
      const pass  = document.getElementById("signupPassword");
      const type  = document.getElementById("accountType");
      let ok = true;
      ok &= validate(name,  hasMin(name?.value, 2), "Please enter your name.");
      ok &= validate(email, isEmail(email?.value), "Enter a valid email.");
      ok &= validate(pass,  between(pass?.value, 8, 128), "Password must be 8–128 chars.");
      ok &= validate(type,  ["investor","entrepreneur","admin"].includes(String(type?.value||"").toLowerCase()), "Select an account type.");
      if (!ok) e.preventDefault();
    });
  }

  // Pitch form.
  const pitchForm = document.getElementById("pitchForm");
  if (pitchForm) {
    pitchForm.addEventListener("submit", (e) => {
      const title = document.getElementById("pitchTitle") || document.getElementById("title");
      const desc  = document.getElementById("shortPitch") || document.getElementById("description");
      const industry = document.getElementById("industry");
      const goal  = document.getElementById("fundingGoal");

      let ok = true;
      ok &= validate(title, between(title?.value, 3, 120), "Title: 3–120 chars.");
      ok &= validate(desc,  between(desc?.value, 20, 2000), "Description: 20–2000 chars.");
      ok &= validate(industry, hasMin(industry?.value, 2), "Select/enter industry.");
      if (goal && goal.value && Number(goal.value) < 0) { ok = false; fieldError(goal, "Funding goal must be ≥ 0."); }
      if (!ok) e.preventDefault();
    });
  }

  // Resource form.
  const resForm = document.getElementById("resourceForm");
  if (resForm) {
    resForm.addEventListener("submit", (e) => {
      const title = document.getElementById("resourceTitle");
      const desc  = document.getElementById("resourceDescription");
      const file  = document.getElementById("resourceFile");
      let ok = true;
      ok &= validate(title, between(title?.value, 3, 120), "Title: 3–120 chars.");
      ok &= validate(desc,  between(desc?.value, 10, 2000), "Description: 10–2000 chars.");
      ok &= validate(file,  !!file?.files?.[0], "Please choose a file.");
      if (!ok) e.preventDefault();
    });
  }

  // Chat form.
  const chatForm = document.getElementById("chatForm");
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      const msg = document.getElementById("chatMessage") || chatForm.querySelector("textarea, input[type='text']");
      const ok  = validate(msg, between(msg?.value, 1, 2000), "Message required (max 2000 chars).");
      if (!ok) e.preventDefault();
    });
  }

  // Link hygiene: validate external links (optional safety).
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    if (a.target === "_blank" && !/^https?:\/\//i.test(href)) {
      e.preventDefault();
      showToast("Invalid link.");
    }
  });
});

/* ------------------------------------------------------------------
   Firebase Error Mapping (Overrides Default Warnings)
   ------------------------------------------------------------------ */
function mapAuthError(err) {
  const code = String(err?.code || "");
  const table = {
    "auth/invalid-email":         "Please enter a valid email address.",
    "auth/user-not-found":        "No account found with that email. Please sign up first.",
    "auth/wrong-password":        "Incorrect password. Please try again.",
    "auth/invalid-credential":    "Incorrect email or password. Please try again.",
    "auth/too-many-requests":     "Too many attempts. Try again later.",
    "auth/network-request-failed":"Network error. Check your connection and try again.",
    "auth/user-disabled":         "This account has been disabled.",
    "auth/email-already-in-use":  "That email is already registered. Try logging in.",
    "auth/weak-password":         "Password is too weak. Use at least 8 characters.",
    "auth/popup-closed-by-user":  "Sign-in was cancelled.",
    "auth/cancelled-popup-request":"Another sign-in is in progress. Try again.",
    "auth/popup-blocked":         "Your browser blocked the sign-in popup."
  };
  return table[code] || "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------------
   Global Guards for Uncaught Errors
   ------------------------------------------------------------------ */
window.addEventListener("error", () => showToast("Something went wrong. Please try again."));
window.addEventListener("unhandledrejection", (e) => showToast(mapAuthError(e.reason || {})));

/* ------------------------------------------------------------------
   Non-Invasive Wrappers Around Auth Functions
   ------------------------------------------------------------------ */
/* If your original functions throw, users still see YOUR message. */
(function wrapAuth() {
  // login(email, password)
  if (typeof window.login === "function") {
    const _login = window.login;
    window.login = async function(...args) {
      // Lightweight upfront validation to avoid unnecessary network calls.
      const [email, password] = args;
      if (!isEmail(email))  { showToast("Enter a valid email."); return null; }
      if (!hasMin(password,1)) { showToast("Password is required."); return null; }

      try {
        return await _login.apply(this, args);
      } catch (err) {
        console.error("[login]", err);
        showToast(mapAuthError(err));
        return null;
      }
    };
  }

  // signup(email, password, name, accountType)
  if (typeof window.signup === "function") {
    const _signup = window.signup;
    window.signup = async function(...args) {
      const [email, password, name, accountType] = args;
      if (!isEmail(email))                { showToast("Enter a valid email."); return null; }
      if (!between(password, 8, 128))     { showToast("Password must be 8–128 chars."); return null; }
      if (!hasMin(name, 2))               { showToast("Please enter your name."); return null; }
      if (!["investor","entrepreneur","admin"].includes(String(accountType || document.getElementById("accountType")?.value || "").toLowerCase())) {
        showToast("Select an account type."); return null;
      }
      try {
        return await _signup.apply(this, args);
      } catch (err) {
        console.error("[signup]", err);
        showToast(mapAuthError(err));
        return null;
      }
    };
  }

  // signInWithGoogle()
  if (typeof window.signInWithGoogle === "function") {
    const _g = window.signInWithGoogle;
    window.signInWithGoogle = async function(...args) {
      try {
        return await _g.apply(this, args);
      } catch (err) {
        console.error("[google-signin]", err);
        showToast(mapAuthError(err));
        return null;
      }
    };
  }
})();

/* ------------------------------------------------------------------
   Global Helper Exposure (for ES Modules)
   ------------------------------------------------------------------ */
(function ensureGlobals(){
  if (typeof showToast === "function" && !window.showToast) window.showToast = showToast;
  if (typeof mapAuthError === "function" && !window.mapAuthError) window.mapAuthError = mapAuthError;
  if (typeof login === "function" && !window.login) window.login = login;
  if (typeof signup === "function" && !window.signup) window.signup = signup;
  if (typeof signInWithGoogle === "function" && !window.signInWithGoogle) window.signInWithGoogle = signInWithGoogle;
})();
/* ------------------------------------------------------------------
   Runtime Error Mapping (Non‑Firebase)
   ------------------------------------------------------------------ */
function mapRuntimeError(err) {
  const msg = String(err?.message || "");
  // Common null/undefined read pattern.
  if (/Cannot read properties of null/i.test(msg) && /accountType/i.test(msg)) {
    return "Incorrect email or password. Please try again.";
  }
  if (/Cannot read properties of undefined/i.test(msg) && /accountType/i.test(msg)) {
    return "Incorrect email or password. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------------
   Global Guards: Convert Uncaught Errors/Promises Into Toasts
   ------------------------------------------------------------------ */
window.addEventListener("error", (e) => {
  // Prefer Firebase mapping if there is an auth code; otherwise runtime mapping.
  const friendly = (e.error && e.error.code) ? mapAuthError(e.error) : mapRuntimeError(e.error || e);
  showToast(friendly);
});

window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason || {};
  const friendly = r.code ? mapAuthError(r) : mapRuntimeError(r);
  showToast(friendly);
});
/* ------------------------------------------------------------------
   Hardening: updateNavForUser (Null‑Safe)
   ------------------------------------------------------------------ */
(function patchUpdateNavForUser(){
  if (typeof window.updateNavForUser !== "function") return;
  const _orig = window.updateNavForUser;
  window.updateNavForUser = function(u, optimistic = false) {
    // If no user and not in an "optimistic" phase, just do nothing.
    if (!u && !optimistic) return;
    try {
      return _orig.call(this, u, optimistic);
    } catch (err) {
      // If it was the classic "accountType" null/undefined read, show nice message.
      if (/accountType/i.test(String(err?.message || ""))) {
        showToast("Incorrect email or password. Please try again.");
        return;
      }
      // Anything else: generic friendly fallback.
      showToast("Something went wrong. Please try again.");
      console.error("[updateNavForUser]", err);
    }
  };
})();
/* ---- Friendly error mapping for runtime (non-Firebase) errors ---- */
function mapRuntimeError(err) {
  const m = String(err?.message || "");
  if (/Cannot read properties of null/i.test(m) && /accountType/i.test(m)) {
    return "Incorrect email or password. Please try again.";
  }
  if (/Cannot read properties of undefined/i.test(m) && /accountType/i.test(m)) {
    return "Incorrect email or password. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

/* ------------------------------------------------------------------
   Hardening: Ensure login() Never Throws (Always Toasts)
   ------------------------------------------------------------------ */
(function hardenLogin(){
  if (typeof window.login !== "function") return;
  const _login = window.login;
  window.login = async function(email, password){
    try {
      const res = await _login(email, password);
      // If underlying login already handled an error, it returns null.
      return res || null;
    } catch (err) {
      // As a final safety (e.g., unexpected runtime), show mapped toast and swallow.
      const msg = (err && err.code) ? mapAuthError?.(err) : mapRuntimeError(err);
      showToast(msg || "Incorrect email or password. Please try again.");
      return null;
    }
  };
})();

/* ------------------------------------------------------------------
   Hardening: updateNavForUser is Null‑Safe on Failed Login
   ------------------------------------------------------------------ */
(function patchUpdateNavForUser(){
  if (typeof window.updateNavForUser !== "function") return;
  const _orig = window.updateNavForUser;
  window.updateNavForUser = function(u, optimistic=false){
    if (!u && !optimistic) return; // quietly no-op when no user
    try { return _orig.call(this, u, optimistic); }
    catch (err) {
      const msg = (err && err.code) ? mapAuthError?.(err) : mapRuntimeError(err);
      showToast(msg || "Something went wrong. Please try again.");
      // swallow so UI doesn’t crash.
      return;
    }
  };
})();

/* ------------------------------------------------------------------
   Global Guards: Convert Any Uncaught Error/Rejection Into Toasts
   ------------------------------------------------------------------ */
window.addEventListener("error", (e) => {
  const friendly = (e.error && e.error.code) ? mapAuthError?.(e.error) : mapRuntimeError(e.error || e);
  showToast(friendly);
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason || {};
  const friendly = r.code ? mapAuthError?.(r) : mapRuntimeError(r);
  showToast(friendly);
});