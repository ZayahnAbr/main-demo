/* ==========================================================================
   Siza Platform 
   ========================================================================== */

// import firebase modules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  serverTimestamp,
  getDoc,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  where,
  updateDoc,
  deleteDoc,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  linkWithCredential,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-storage.js";



/* ==================================================================
   Firebase Configuration
   ================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyB81g5mgAVn3iC9LM2JrM8EkAADsv7RqEo",
  authDomain: "siza-platform.firebaseapp.com",
  projectId: "siza-platform",
  storageBucket: "siza-platform.firebasestorage.app",
  messagingSenderId: "1019647938747",
  appId: "1:1019647938747:web:5e2bf5f8f8b6fa11d7599e",
  measurementId: "G-WB4MVXMLSH"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();



import { setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
setPersistence(auth, browserLocalPersistence).catch(()=>{});


/* ==================================================================
   Small helpers
   ================================================================== */
const $ = (sel) => document.querySelector(sel); 
const qs = (id) => document.getElementById(id);
const param = (name) => new URLSearchParams(location.search).get(name);
const DEFAULT_AVATAR = "https://cdn.jsdelivr.net/gh/alohe/avatars/png/vibrent_6.png";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("sizaUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function storeUserLocally(user) {
  const prev = getStoredUser();
  // If switching accounts, replace; otherwise merge.
  if (!prev || prev.id !== user.id) {
    localStorage.setItem("sizaUser", JSON.stringify(user));
  } else {
    localStorage.setItem("sizaUser", JSON.stringify({ ...prev, ...user }));
  }
}

async function fetchUserData(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("Error fetching user data:", err);
    return null;
  }
}

function blockSensitive(text) {
  if (!text) return "";

  // Lowercase and normalize spaces.
  let t = text.toLowerCase().replace(/\s+/g, "");

  // Convert "dot" into ".".
  t = t.replace(/dot/g, ".");

  // Convert "at" into "@".
  t = t.replace(/\bat\b/g, "@");

  // Now run simple checks.
  if (/@\w+\.\w+/.test(t)) return "(hidden email)";
  if (/\d{8,}/.test(t)) return "(hidden number)";

  return text; // return original (so we don't mangle normal words)
}



/* ------------------------------------------------------------------
   Global Loader Helpers
   ------------------------------------------------------------------ */
function ensureGlobalLoader() {
  if (document.getElementById("appLoader")) return;
  const el = document.createElement("div");
  el.id = "appLoader";
  el.innerHTML = '<div class="spinner" aria-label="Loading"></div>';
  document.body.appendChild(el);
}
function showGlobalLoader(on = true) {
  ensureGlobalLoader();
  const el = document.getElementById("appLoader");
  if (el) el.style.display = on ? "grid" : "none";
}

/* ------------------------------------------------------------------
   Button Loading Wrapper
   ------------------------------------------------------------------ */
async function withButtonLoading(btn, fn) {
  if (btn) { btn.classList.add("is-loading"); btn.disabled = true; }
  try {
    showGlobalLoader(true);
    return await fn();
  } finally {
    showGlobalLoader(false);
    if (btn) { btn.classList.remove("is-loading"); btn.disabled = false; }
  }
}

// --- Toast shim for ES modules: use global if present, else define minimal ---.
const showToast = (window.showToast) || function (message, ms = 3200) {
  let t = document.getElementById("inlineToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "inlineToast";
    Object.assign(t.style, {
      position: "fixed", left: "50%", top: "18px", transform: "translateX(-50%)",
      background: "#111", color: "#fff", padding: "10px 14px", borderRadius: "10px",
      zIndex: 99999, boxShadow: "0 6px 18px rgba(0,0,0,.25)", maxWidth: "90vw", textAlign: "center"
    });
    document.body.appendChild(t);
  }
  t.textContent = String(message || "Something went wrong. Please try again.");
  t.style.display = "block";
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (t.style.display = "none"), ms);
};

// --- email validator (front-end gate; stricter than HTML5) ---.
function isValidEmail(email) {
  const v = String(email || "").trim();
  // must contain one @, at least one dot after @, and a 2+ char TLD.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}


// --- NAV: highlight current page ---.
function highlightCurrentNav() {
  // normalize current filename (index.html by default)
  const path = location.pathname || "/";
  let here = path.split("/").pop();
  if (!here || here === "/") here = "index.html";
  here = here.toLowerCase();

  // helper for robust filename extraction from hrefs.
  const getFile = (href) => {
    if (!href) return "";
    // ignore anchors and javascript links.
    if (href.startsWith("#") || href.startsWith("javascript:")) return "";
    try {
      // handle absolute/relative.
      const u = new URL(href, location.origin);
      let f = u.pathname.split("/").pop() || "index.html";
      return f.toLowerCase();
    } catch {
      // fallback for bare relative strings.
      const cleaned = href.split("?")[0].split("#")[0];
      let f = cleaned.split("/").pop() || "index.html";
      return f.toLowerCase();
    }
  };

  // clear + apply.
  document.querySelectorAll('header a[href], .site-nav a[href]').forEach(a => {
    a.classList.remove("active");
    const file = getFile(a.getAttribute("href"));
    if (file && file === here) {
      a.classList.add("active");
    }
  });
}

// call as early as nav exists.
document.addEventListener("DOMContentLoaded", () => {
  highlightCurrentNav(); // <-- independent of auth
});

// Message redaction utilities.

/* ==================================================================
   ENHANCED FILTERING WITH SEARCH FUNCTIONALITY
   ================================================================== */
/* -------------------------
   FILTER + SEARCH FOR INVESTOR DASHBOARD
-------------------------- */

async function filterAndSearchPitches(selectedIndustries = [], searchTerm = "") {
  const grid = document.getElementById("pitchGrid");
  if (!grid) return;

  grid.innerHTML = `<div class="card">Loading pitches…</div>`;
  
  try {
    let snap;

    // If "All" is selected or no industries checked, show all pitches
    if (selectedIndustries.length === 0 || selectedIndustries.includes("All")) {
      const qRef = query(collection(db, "testPitches"), orderBy("timestamp", "desc"));
      snap = await getDocs(qRef);
    } else {
      const qRef = query(
        collection(db, "testPitches"),
        where("industries", "array-contains-any", selectedIndustries),
        orderBy("timestamp", "desc")
      );
      snap = await getDocs(qRef);
    }

    if (snap.empty) {
      grid.innerHTML = `<div class="card">No pitches found.</div>`;
      return;
    }

    // Convert snapshot to array of pitches
    let pitches = [];
    snap.forEach(docSnap => {
      pitches.push({ id: docSnap.id, data: docSnap.data() });
    });

    // Apply search filter if search term exists
    if (searchTerm && searchTerm.trim() !== "") {
      const searchLower = searchTerm.toLowerCase();
      pitches = pitches.filter(({ data: p }) => {
        const fields = [
          p.title || p.pitchTitle || "",
          p.shortPitch || p.description || "",
          Array.isArray(p.industries) ? p.industries.join(" ") : (p.industry || ""),
          p.financialProjections || p.projections || "",
          p.businessModel || "",
          p.targetMarket || "",
          p.companyName || ""
        ];
        return fields.some(f => f.toLowerCase().includes(searchLower));
      });
    }

    // Render pitches
    grid.innerHTML = "";
    pitches.forEach(({ id: pid, data: p }) => {
      const title = p.title || p.pitchTitle || "Untitled Pitch";
      const desc = p.shortPitch || p.description || "No description provided";
      const fin = p.financialProjections || p.projections || "N/A";
      const industries = Array.isArray(p.industries) ? p.industries.join(", ") : (p.industry || "Not specified");

      const card = document.createElement("div");
      card.className = "idea-card";
      card.innerHTML = `
        <h3>${escapeHtml(title)}</h3>
        <p><strong>Industries:</strong> ${escapeHtml(industries)}</p>
        <p><strong>Description:</strong> ${escapeHtml(desc)}</p>
        <p><strong>Financial Projections:</strong> ${escapeHtml(fin)}</p>
        <button class="btn view-pitch-btn" data-pitch-id="${pid}">View Pitch</button>
      `;
      grid.appendChild(card);
    });

    // Wire up View Pitch buttons
    grid.querySelectorAll(".view-pitch-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const pitchId = btn.dataset.pitchId;
        window.location.href = `pitch-details.html?id=${pitchId}`;
      });
    });
//Render cards (after data is ready)
    grid.innerHTML = "";
    pitches.forEach(({ id: pid, data: p }) => {
      grid.appendChild(createInvestorCard(pid, p)); // <- uses the video-in-square + amount pill card
    });

    // 6) If you gate with NDA, rebind modal here
    if (typeof setupNDAModal === "function") setupNDAModal(grid);
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="card">Could not load pitches: ${err.message}</div>`;
  }
}

/* -------------------------
   SETUP CHECKBOX FILTERS + SEARCH (Investor Dashboard)
-------------------------- */
function setupFilters() {
  const filterContainer = document.getElementById('industryFilters');
  const checkboxes = filterContainer ? Array.from(filterContainer.querySelectorAll('input[type="checkbox"]')) : [];
  const searchInput = document.getElementById('pitchSearch');
  const pitchGrid = document.getElementById('pitchGrid');

  // Debounce helper
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Get selected industries
  function getSelectedIndustries() {
    if (!checkboxes.length) return []; // No checkboxes on this page
    const checked = checkboxes.filter(cb => cb.checked).map(cb => cb.value.trim());
    if (checked.length === 0) {
      const allCb = checkboxes.find(cb => cb.value === "All");
      if (allCb) allCb.checked = true;
      return ["All"];
    }
    return checked;
  }

  // Update the grid with current filters
  function updateGrid() {
    if (!pitchGrid) return; // Only update if grid exists
    const selectedIndustries = getSelectedIndustries();
    const searchTerm = searchInput ? searchInput.value.trim() : "";
    filterAndSearchPitches(selectedIndustries, searchTerm);
  }

  // Debounced version to prevent rapid rebuilds
  const debouncedUpdateGrid = debounce(updateGrid, 150);

  // Checkbox change events
  if (checkboxes.length) {
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        if (cb.value === "All" && cb.checked) {
          // Uncheck all others if "All" selected
          checkboxes.forEach(other => { if (other.value !== "All") other.checked = false; });
        } else if (cb.value !== "All" && cb.checked) {
          // Uncheck "All" if any other selected
          const allCb = checkboxes.find(c => c.value === "All");
          if (allCb) allCb.checked = false;
        } else if (checkboxes.every(c => !c.checked)) {
          // If all unchecked, select "All"
          const allCb = checkboxes.find(c => c.value === "All");
          if (allCb) allCb.checked = true;
        }
        debouncedUpdateGrid();
      });
    });
  }

  // Search input event
  if (searchInput) {
    searchInput.addEventListener('input', debouncedUpdateGrid);
  }

  // Initial grid load
  if (pitchGrid) debouncedUpdateGrid();
}

/* -------------------------
   CALL SETUP ON PAGE LOAD
-------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  const hasFilters = document.getElementById('industryFilters');
  const hasSearch = document.getElementById('pitchSearch');
  
  if (hasFilters || hasSearch) {
    setupFilters();
  }
}
);
/*=====SEE MORE/HIDE BUTTON=====*/ 

document.addEventListener('DOMContentLoaded', () => {
  const showMoreBtn = document.getElementById('showMoreBtn');
  const hideBtn = document.getElementById('hideBtn');
  const hiddenIndustries = document.querySelectorAll('#entIndustry .checkbox-item.hidden');

  // Show hidden checkboxes
  if (showMoreBtn && hiddenIndustries.length) {
    showMoreBtn.addEventListener('click', (e) => {
      e.preventDefault(); // ← Prevents form submission
      hiddenIndustries.forEach(cb => cb.classList.remove('hidden'));
      showMoreBtn.classList.add('hidden'); // hide "See More"
      hideBtn.classList.remove('hidden');   // show "Hide"
    });
  }

  // Hide checkboxes again
  if (hideBtn) {
    hideBtn.addEventListener('click', (e) => {
      e.preventDefault(); // ← Prevents form submission
      hiddenIndustries.forEach(cb => cb.classList.add('hidden'));
      hideBtn.classList.add('hidden');      // hide "Hide" button
      showMoreBtn.classList.remove('hidden'); // show "See More" again
    });
  }
});





/* -------------------------
   HTML ESCAPE HELPER
-------------------------- */
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


/* -------------------------
   CALL SETUP ON PAGE LOAD
-------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  const hasFilters = document.getElementById('industryFilters');
  const hasSearch = document.getElementById('pitchSearch');

  // Only run setupFilters if the investor grid exists
  if ((hasFilters || hasSearch) && document.getElementById('pitchGrid')) {
    setupFilters();
  }

  // Load entrepreneur pitches if on entrepreneur dashboard
  if (location.pathname.endsWith("entrepreneur-dashboard.html")) {
    loadMyPitches();
  }
});


/* ==================================================================
   FIRST-CLASS AVATAR SUPPORT
   ================================================================== */
function applyAvatarImages(userLike) {
  // Navbar avatar: rendered only when a custom profile image is available.
  const navAvatar = qs("navAvatar");
  if (navAvatar) {
    if (userLike?.profilePic) {
      navAvatar.src = userLike.profilePic;
      navAvatar.alt = (userLike?.name || "User") + " avatar";
      navAvatar.style.display = "inline-block";
    } else {
      navAvatar.style.display = "none";
    }
  }
  // Any .profile-img element on the page (skips elements marked data-static).
  document.querySelectorAll("img.profile-img").forEach((img) => {
    if (img.dataset.static === "true") return;
    img.src = userLike?.profilePic || DEFAULT_AVATAR;
  });
}

/* ==================================================================
   Cloudinary (free) uploads
   ================================================================== */
const CLOUDINARY_CLOUD_NAME = "dahy3ud0y";//"dxjnbf2ds";        // ✅ your cloud name
const CLOUDINARY_UPLOAD_PRESET = "siza_unsigned"; // ✅ your unsigned preset


async function uploadToCloudinary(file, folder = "siza/resources") {
  if (!file) return null;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary config missing (cloud name / unsigned preset).");
  }
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  form.append("folder", folder);


  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error("Cloudinary upload failed: " + (txt || res.status));
  }
  const data = await res.json();
  return data.secure_url; // public HTTPS URL
}


/* ==================================================================
   Auth functions
   ================================================================== */
// Implementation note:
async function saveUserToFirestore(user) {
  const userDoc = {
    name: user.name || "User",
    email: user.email,
    accountType: (user.accountType || "unknown").toLowerCase(),
    plan: user.plan || "basic",
    goldVerified: !!user.goldVerified,
    profileComplete: !!user.profileComplete,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, "users", user.id), userDoc, { merge: true });
}



document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("signupEmail");
  if (el) {
    el.type = "email";                       // HTML5 email keyboard + built-in checks
    el.autocomplete = "email";
    el.inputMode = "email";
    el.pattern = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$"; // Browser-level constraint
  }
});



// Implementation note:
async function signup(email, password, name, accountType) {
 // at the very top of async function signup(email, password, name, accountType) {.
if (!isValidEmail(email)) {
  showToast("Please enter a valid email address.");
  return null; // IMPORTANT: don't call Firebase; signal failure to caller
}

 
  const role = String(document.getElementById("accountType")?.value || accountType || "unknown").toLowerCase();

  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  try { await updateProfile(user, { displayName: name }); } catch {}

  const userData = {
    id: user.uid,
    name: name || user.displayName || "User",
    email: user.email || email,
    accountType: role,              // always lowercase
    profileComplete: false,
    plan: "basic",
    goldVerified: false,
    createdAt: serverTimestamp(),
  };

  await saveUserToFirestore(userData);  // MERGE (safe)
  storeUserLocally(userData);
  updateNavForUser(userData, /*optimistic*/ true);

  if (role === "investor")       window.location.href = "edit-investor.html";
  else if (role === "entrepreneur") window.location.href = "edit-entrepreneur.html";
  else                           window.location.href = "index.html";

  return user;
}


// Implementation note:
async function login(email, password) {
  if (!email || !password) {
    showToast("Please enter both email and password.");
    return;
  }

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;


    let userData = await fetchUserData(user.uid);
    if (!userData) {
      await setDoc(doc(db, "users", user.uid), {
        name: user.displayName || "User",
        email: user.email || email,
        profileComplete: false,
        plan: "basic",
        goldVerified: false,
        createdAt: serverTimestamp(),
      }, { merge: true });
      userData = await fetchUserData(user.uid);
    }

  // Normalize role; fix casing in DB if needed.
  let role = String(userData?.accountType || "").toLowerCase().trim();
  if (userData?.accountType && userData.accountType !== role) {
    await updateDoc(doc(db, "users", user.uid), { accountType: role });
  }

  const storeData = {
    id: user.uid,
    name: userData?.name || user.displayName || "User",
    email: user.email,
    accountType: role || "unknown",
    profileComplete: !!userData?.profileComplete,
    bio: userData?.bio || "",
    focus: userData?.focus || "",
    location: userData?.location || "",
    budget: userData?.budget || "",
    industry: userData?.industry || "",
    website: userData?.website || "",
    pitchTitle: userData?.pitchTitle || "",
    fundingGoal: userData?.fundingGoal || "",
    profilePic: userData?.profilePic || "",
    plan: userData?.plan || "basic",
    goldVerified: !!userData?.goldVerified,
  };

  storeUserLocally(storeData);
  updateNavForUser(storeData, /*optimistic*/ true);

  // Redirect by role + completion.
  if (role === "investor") {
    window.location.href = storeData.profileComplete ? "investor-dashboard.html" : "edit-investor.html";
  } else if (role === "entrepreneur") {
    window.location.href = storeData.profileComplete ? "entrepreneur-dashboard.html" : "edit-entrepreneur.html";
  } else {
    alert("Please finish sign up and pick Investor or Entrepreneur.");
    window.location.href = "index.html";
  }

  // Login form
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const emailEl = document.getElementById("loginEmail");
    const passEl  = document.getElementById("loginPassword");
    const email   = (emailEl?.value || "").trim();
    const password= passEl?.value || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast("Please enter a valid email address."); return; }
    if (!password) { showToast("Password is required."); return; }
    const userData = await login(email, password);
    if (!userData) return; // stop on failed login
    // ...redirects...
  });
} // no else/log

// Google sign-in
const googleSignInBtn = document.getElementById("googleSignInBtn");
if (googleSignInBtn) {
  googleSignInBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await signInWithGoogle();
  });
} // no else/log


  return storeData;
} catch (err) {
  const messages = {
    "auth/invalid-credential":    "Incorrect email or password. Please try again.",
    "auth/wrong-password":        "Incorrect password. Please try again.",
    "auth/user-not-found":        "No account found with that email. Please sign up first.",
    "auth/invalid-email":         "Please enter a valid email address.",
    "auth/too-many-requests":     "Too many attempts. Try again later.",
    "auth/network-request-failed":"Network error. Check your connection and try again.",
    "auth/user-disabled":         "This account has been disabled."
  };
  showToast(messages[err?.code] || "Incorrect email or password. Please try again.");
  return null; // IMPORTANT: stop the flow so downstream code doesn't run
}


}



// Implementation note:
async function signInWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const ref = doc(db, "users", user.uid);
  let snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      name: user.displayName || "User",
      email: user.email || "",
      accountType: "unknown",
      profileComplete: false,
      plan: "basic",
      goldVerified: false,
      createdAt: serverTimestamp(),
    }, { merge: true });
    snap = await getDoc(ref);
  }

  const data = snap.data();
  const role = String(data?.accountType || "unknown").toLowerCase();
  const cache = { id: user.uid, ...data, accountType: role };
  storeUserLocally(cache);
  updateNavForUser(cache, /*optimistic*/ true);

  if (role === "investor")       window.location.href = cache.profileComplete ? "investor-dashboard.html" : "edit-investor.html";
  else if (role === "entrepreneur") window.location.href = cache.profileComplete ? "entrepreneur-dashboard.html" : "edit-entrepreneur.html";
  else                             window.location.href = "index.html";

  return cache;
}


async function logout() {
  try { await signOut(auth); } catch {}
  localStorage.removeItem("sizaUser");
  window.location.replace("index.html");
}

/* ==================================================================
   Writers (Cloudinary)
   ================================================================== */
async function saveProfile(userId, data, files = {}) {
  const updateData = { profileComplete: true, ...data };

  for (const [key, file] of Object.entries(files)) {
    if (file instanceof File) {
      const url = await uploadToCloudinary(file, `siza/${key}/${userId}`);
      updateData[key] = url;
    }
  }

  await setDoc(doc(db, "users", userId), updateData, { merge: true });

  const cached = getStoredUser() || { id: userId };
  const merged = { ...cached, ...updateData, id: userId };
  storeUserLocally(merged);
  applyAvatarImages(merged);

  return updateData;
}

async function submitPitch(data, files = {}) {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("You must be logged in to submit a pitch.");

  const user = getStoredUser(); // for name/email display
  const pitchData = {
    ...data,
    entrepreneurID: fbUser.uid,         // use Auth UID here
    author: user?.name || fbUser.email,
    email: user?.email || fbUser.email,
    timestamp: serverTimestamp(),
  };

  // ... your Cloudinary uploads ...
  await addDoc(collection(db, "testPitches"), pitchData);
}

// Simple redaction patterns (emails, phone numbers, URLs, WhatsApp references).
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}\b/gi;
const URL_RE   = /\bhttps?:\/\/[^\s]+|\bwww\.[^\s]+/gi;
const WA_RE    = /\b(whatsapp|wa\.me|chat\.whatsapp\.com)\b[^\s]*/gi;
const CONTACT_PLACEHOLDER = "(hidden—share after milestone 1)";

function normalizeForScan(s="") {
  return s.replace(/\u200B|\u200C|\u200D|\u2060/g, "").replace(/[．｡。]/g, ".").replace(/\s+/g, " ");
}

function redactContact(text) {
  const norm = normalizeForScan(text || "");
  const redacted = norm
    .replace(EMAIL_RE, CONTACT_PLACEHOLDER)
    .replace(PHONE_RE, CONTACT_PLACEHOLDER)
    .replace(URL_RE,  CONTACT_PLACEHOLDER)
    .replace(WA_RE,   CONTACT_PLACEHOLDER);
  return { text: redacted, changed: redacted !== norm };
}

/* ==================================================================
   NDA record (optional)
   ================================================================== */
async function acceptNDA(pitchId) {
  const user = getStoredUser();
  if (!user) throw new Error("You must be logged in to accept the NDA.");
  await addDoc(collection(db, "ndaAcceptances"), {
    investorId: user.id,
    pitchId,
    email: user.email,
    acceptedAt: serverTimestamp(),
  });
}

/* ==================================================================
   Messaging System
   ================================================================== */
// Handle contact button click.
async function handleContactEntrepreneur() {
  console.log("Contact button clicked!");
  
  const user = getStoredUser();
  if (!user || user.accountType !== "investor") {
    alert("You need to be logged in as an investor to contact entrepreneurs.");
    return;
  }
  
  const pitchId = new URLSearchParams(location.search).get("id");
  if (!pitchId) {
    alert("Pitch information not found.");
    return;
  }
  
  try {
    const pitchDoc = await getDoc(doc(db, "testPitches", pitchId));
    if (!pitchDoc.exists()) {
      alert("Pitch not found.");
      return;
    }
    
    const pitchData = pitchDoc.data();
    const entrepreneurId = pitchData.entrepreneurID;
    
    if (!entrepreneurId) {
      alert("Entrepreneur information not available.");
      return;
    }
    
    const conversationId = await getOrCreateConversation(
      user.id, 
      entrepreneurId, 
      pitchId
    );
    
    window.location.href = `chat.html?conversation=${conversationId}`;
  } catch (error) {
    console.error("Error initiating conversation:", error);
    alert("Failed to start conversation. Please try again.");
  }
}
/**
 * Create or get a conversation between two users
 */
async function getOrCreateConversation(investorId, entrepreneurId, pitchId) {
  try {
    // Check if conversation already exists.
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", investorId),
      where("pitchId", "==", pitchId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      // Return existing conversation.
      return querySnapshot.docs[0].id;
    }
    
    // Create new conversation.
    const conversationData = {
      participants: [investorId, entrepreneurId],
      pitchId: pitchId,
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessage: "Conversation started"
    };
    
    const docRef = await addDoc(collection(db, "conversations"), conversationData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating/getting conversation:", error);
    throw error;
  }
}

/**
 * Send a message to a conversation
 */
async function sendMessage(conversationId, senderId, messageText) {
  try {
    if (!messageText.trim()) return;

    // Sanitize the message.
    const safeText = blockSensitive(messageText.trim());

    // Add message to messages subcollection.
    const messageData = {
      senderId: senderId,
      text: safeText, // use the cleaned text
      timestamp: serverTimestamp(),
      read: false
    };

    await addDoc(
      collection(db, "conversations", conversationId, "messages"),
      messageData
    );

    // ✅ Update conversation with sanitized last message.
    await updateDoc(doc(db, "conversations", conversationId), {
      lastMessage: safeText,
      lastMessageAt: serverTimestamp()
    });

    console.log("Message sent and conversation updated:", safeText);
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}


/**
 * Set up real-time listener for messages in a conversation
 */
function listenToMessages(conversationId, callback) {
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("timestamp", "asc")
  );
  
  return onSnapshot(q, (snapshot) => {
    const messages = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    callback(messages);
  });
}

/**
 * Get conversation details
 */
async function getConversation(conversationId) {
  try {
    const docSnap = await getDoc(doc(db, "conversations", conversationId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      throw new Error("Conversation not found");
    }
  } catch (error) {
    console.error("Error getting conversation:", error);
    throw error;
  }
}

/**
 * Get user's conversations
 */
async function getUserConversations(userId) {
  try {
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", userId),
      orderBy("lastMessageAt", "desc")
    );
    
    const querySnapshot = await getDocs(q);
    const conversations = [];
    
    querySnapshot.forEach((doc) => {
      conversations.push({ id: doc.id, ...doc.data() });
    });
    
    return conversations;
  } catch (error) {
    console.error("Error getting user conversations:", error);
    throw error;
  }
}

/**
 * Mark messages as read
 */
async function markMessagesAsRead(conversationId, userId) {
  try {
    // Get all unread messages from this conversation that aren't sent by the user.
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      where("senderId", "!=", userId),
      where("read", "==", false)
    );
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    querySnapshot.forEach((doc) => {
      const messageRef = doc.ref;
      batch.update(messageRef, { read: true });
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
}

/* ==================================================================
   Messages Page Functions
   ================================================================== */

// Load user's conversations for messages page.
async function loadUserConversations() {
  const conversationsContainer = document.getElementById("conversationsList");
  if (!conversationsContainer) {
    console.log("Not on messages page, skipping conversations load");
    return;
  }
  
  const user = getStoredUser();
  if (!user) {
    conversationsContainer.innerHTML = "";
    document.getElementById("loginPrompt").style.display = "block";
    return;
  }
  
  try {
    showGlobalLoader(true);
    console.log("Loading conversations for user:", user.id);
    const conversations = await getUserConversations(user.id);
    console.log("Found conversations:", conversations);
    
    if (conversations.length === 0) {
      conversationsContainer.innerHTML = "<p>No messages yet. When investors contact you about your pitches, conversations will appear here.</p>";
      return;
    }
    
    conversationsContainer.innerHTML = "";
    
    for (const convo of conversations) {
      try {
        // Get the other participant's info.
        const otherParticipantId = convo.participants.find(id => id !== user.id);
        const otherUser = await fetchUserData(otherParticipantId);
        const otherUserName = otherUser?.name || "Unknown User";
        
        const convoElement = document.createElement("div");
        convoElement.className = "conversation-item";
        convoElement.innerHTML = `
          <div class="conversation-preview">
            <div>
              <strong>${otherUserName}</strong>
              <p class="message-preview">${convo.lastMessage || "No messages yet"}</p>
            </div>
            <button class="btn open-chat-btn" data-conversation-id="${convo.id}">Open Chat</button>
          </div>
        `;
        conversationsContainer.appendChild(convoElement);
      } catch (userError) {
        console.error("Error loading user data for conversation:", userError);
        // Still show the conversation even if user data fails.
        const convoElement = document.createElement("div");
        convoElement.className = "conversation-item";
        convoElement.innerHTML = `
          <div class="conversation-preview">
            <div>
              <strong>Unknown User</strong>
              <p class="message-preview">${convo.lastMessage || "No messages yet"}</p>
            </div>
            <button class="btn" onclick="openChat('${convo.id}')">Open Chat</button>
          </div>
        `;
        conversationsContainer.appendChild(convoElement);
      }
    }
    // ... after all conversation items are created ...

    // ADD EVENT LISTENERS TO ALL OPEN CHAT BUTTONS.
    setTimeout(() => {
      const openChatButtons = document.querySelectorAll('.open-chat-btn');
      console.log("Found", openChatButtons.length, "chat buttons to add listeners to");
      
      openChatButtons.forEach(button => {
        button.addEventListener('click', function() {
          const conversationId = this.getAttribute('data-conversation-id');
          console.log("Opening chat:", conversationId);
          window.location.href = `chat.html?conversation=${conversationId}`;
        });
      });
    }, 100);
    } catch (error) {
      console.error("Error loading conversations:", error);
      conversationsContainer.innerHTML = `
        <p>Error loading messages. Please try again.</p>
        <p>Error details: ${error.message}</p>
        <button class="btn" onclick="loadUserConversations()">Retry</button>
      `;
    } finally {
      showGlobalLoader(false);
    }
}

// Function to open chat.
function openChat(conversationId) {
  window.location.href = `chat.html?conversation=${conversationId}`;
}

// Update message badge in navbar.
async function updateMessageBadge() {
  const user = getStoredUser();
  if (!user) return;
  
  try {
    const conversations = await getUserConversations(user.id);
    let unreadCount = 0;
    
    // Simple unread count - you can enhance this later.
    conversations.forEach(convo => {
      if (convo.lastMessage) unreadCount++; // Basic implementation
    });
    
    const badge = document.getElementById("messageBadge");
    if (badge) {
      badge.textContent = unreadCount > 0 ? unreadCount : "";
      badge.style.display = unreadCount > 0 ? "inline-block" : "none";
    }
  } catch (error) {
    console.error("Error updating message badge:", error);
  }
}

/* ==================================================================
   Forum Functions (LIKE SYSTEM)
   ================================================================== */

// Create a new post.
async function createPost(title, content) {
  try {
    const user = getStoredUser();
    if (!user) throw new Error("Please log in to post");
    
    const postData = {
      title: title.trim(),
      content: content.trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: serverTimestamp(),
      likes: 0,          // CHANGED: Now using "likes" instead of upvotes/downvotes
      commentCount: 0,
      likedBy: []        // NEW: Track who liked the post
    };
    
    const docRef = await addDoc(collection(db, "posts"), postData);
    console.log("Post created with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error creating post:", error);
    throw error;
  }
}

// Get all posts.
async function getAllPosts() {
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const posts = [];
    
    querySnapshot.forEach((doc) => {
      posts.push({ id: doc.id, ...doc.data() });
    });
    
    return posts;
  } catch (error) {
    console.error("Error getting posts:", error);
    throw error;
  }
}
 
// Like/Unlike a post.
async function likePost(postId) {
  try {
    const user = getStoredUser();
    if (!user) {
      alert("Please log in to like posts");
      return;
    }
    
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      alert("Post not found");
      return;
    }
    
    const postData = postSnap.data();
    const alreadyLiked = postData.likedBy && postData.likedBy.includes(user.id);
    
    if (alreadyLiked) {
      // Unlike the post.
      await updateDoc(postRef, {
        likes: increment(-1),
        likedBy: arrayRemove(user.id)
      });
      console.log("Post unliked:", postId);
      
      // Update UI immediately - turn button gray.
      updateLikeButtonUI(postId, false);
      
    } else {
      // Like the post.
      await updateDoc(postRef, {
        likes: increment(1),
        likedBy: arrayUnion(user.id)
      });
      console.log("Post liked:", postId);
      
      // Update UI immediately - turn button red.
      updateLikeButtonUI(postId, true);
    }
    
    // Refresh the posts after a short delay to show updated counts.
    setTimeout(() => {
      loadForumPosts();
    }, 500);
    
  } catch (error) {
    console.error("Error liking post:", error);
    alert("Error: " + error.message);
  }
}

// Update like button UI without refreshing whole page.
function updateLikeButtonUI(postId, isLiked) {
  const likeButton = document.querySelector(`.like-btn[data-post-id="${postId}"]`);
  const likeCount = document.querySelector(`.like-btn[data-post-id="${postId}"] + .like-count`);
  
  if (likeButton) {
    if (isLiked) {
      likeButton.classList.add('liked');
      likeButton.style.color = '#e74c3c'; // Red
    } else {
      likeButton.classList.remove('liked');
      likeButton.style.color = '#6c757d'; // Gray
    }
  }
  
  // Update count immediately.
  if (likeCount) {
    const currentCount = parseInt(likeCount.textContent) || 0;
    likeCount.textContent = isLiked ? currentCount + 1 : currentCount - 1;
  }
}

// Add comment to post.
async function addComment(postId, content) {
  try {
    const user = getStoredUser();
    if (!user) throw new Error("Please log in to comment");
    
    const commentData = {
      postId: postId,
      content: content.trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: serverTimestamp(),
      likes: 0  // CHANGED: comments also use likes now
    };
    
    // Add comment.
    await addDoc(collection(db, "comments"), commentData);
    
    // Update post comment count.
    const postRef = doc(db, "posts", postId);
    await updateDoc(postRef, {
      commentCount: increment(1)
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    throw error;
  }
}

// Get comments for a post.
async function getComments(postId) {
  try {
    const q = query(
      collection(db, "comments"), 
      where("postId", "==", postId),
      orderBy("createdAt", "asc")
    );
    const querySnapshot = await getDocs(q);
    const comments = [];
    
    querySnapshot.forEach((doc) => {
      comments.push({ id: doc.id, ...doc.data() });
    });
    
    return comments;
  } catch (error) {
    console.error("Error getting comments:", error);
    throw error;
  }
}

// Load forum posts.
async function loadForumPosts() {
  try {
    const postsContainer = document.getElementById("postsContainer");
    if (!postsContainer) return;
    
    const posts = await getAllPosts();
    const user = getStoredUser();
    
    if (posts.length === 0) {
      postsContainer.innerHTML = "<p>No posts yet. Be the first to post!</p>";
      return;
    }
    
    postsContainer.innerHTML = "";
    
    for (const post of posts) {
      const isLiked = user && post.likedBy && post.likedBy.includes(user.id);
      
      const postElement = document.createElement("div");
      postElement.className = "forum-card";
      postElement.innerHTML = `
      <div class="post-header">
        <div class="post-content">
          <h3>${post.title}</h3>
          <p>${post.content}</p>
          <small>Posted by ${post.authorName} • ${formatDate(post.createdAt)}</small>
          <div class="comment-section">
            <button class="show-comments-btn" data-post-id="${post.id}">
              Comments (${post.commentCount || 0})
            </button>
            <div id="comments-${post.id}" style="display: none; margin-top: 10px;">
              <!-- Comments will be loaded here -->
            </div>
          </div>
        </div>
        <div class="like-buttons">
          <button class="like-btn ${isLiked ? 'liked' : ''}" data-post-id="${post.id}" 
        style="${isLiked ? 'color: #e74c3c' : 'color: #6c757d'}">
          ❤️
        </button>
          <span class="like-count">${post.likes || 0}</span>
        </div>
      </div>
    `;
      postsContainer.appendChild(postElement);
    }
    
    // ADD EVENT LISTENERS AFTER ALL POSTS ARE CREATED.
    setTimeout(() => {
      // Like buttons.
      const likeButtons = document.querySelectorAll('.like-btn');
      likeButtons.forEach(button => {
        button.addEventListener('click', function() {
          const postId = this.getAttribute('data-post-id');
          console.log("Liking post:", postId);
          likePost(postId);
        });
      });
      
      // Show comments buttons.
      const commentButtons = document.querySelectorAll('.show-comments-btn');
      commentButtons.forEach(button => {
        button.addEventListener('click', function() {
          const postId = this.getAttribute('data-post-id');
          console.log("Showing comments for post:", postId);
          showComments(postId);
        });
      });
      
      console.log("Added event listeners to", likeButtons.length + commentButtons.length, "buttons");
    }, 100);
    
  } catch (error) {
    console.error("Error loading forum posts:", error);
    const postsContainer = document.getElementById("postsContainer");
    if (postsContainer) {
      postsContainer.innerHTML = `<p>Error loading posts: ${error.message}</p>`;
    }
  }
}

// Format date helper.
function formatDate(timestamp) {
  if (!timestamp) return "Unknown date";
  const date = timestamp.toDate();
  return date.toLocaleDateString();
}

/* ==================================================================
   Forum UI functions
   ================================================================== */

// Show/hide comments.
async function showComments(postId) {
  const commentsContainer = document.getElementById(`comments-${postId}`);
  if (!commentsContainer) return;
  
  if (commentsContainer.style.display === "none") {
    // Load comments.
    try {
      commentsContainer.innerHTML = "Loading comments...";
      const comments = await getComments(postId);
      
      commentsContainer.innerHTML = "";
      comments.forEach(comment => {
        const commentElement = document.createElement("div");
        commentElement.className = "comment";
        commentElement.innerHTML = `
          <strong>${comment.authorName}</strong>
          <p>${comment.content}</p>
          <small>${formatDate(comment.createdAt)}</small>
        `;
        commentsContainer.appendChild(commentElement);
      });
      
      // Add comment form.
      const commentForm = document.createElement("div");
      commentForm.innerHTML = `
        <textarea id="comment-${postId}" placeholder="Add a comment..." style="width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px;"></textarea>
        <button class="btn submit-comment-btn" data-post-id="${postId}">Post Comment</button>
      `;
      commentsContainer.appendChild(commentForm);
      
      // Add event listener to comment button.
      const submitBtn = commentForm.querySelector('.submit-comment-btn');
      submitBtn.addEventListener('click', function() {
        const postId = this.getAttribute('data-post-id');
        submitComment(postId);
      });
      
    } catch (error) {
      commentsContainer.innerHTML = `<p>Error loading comments: ${error.message}</p>`;
    }
    
    commentsContainer.style.display = "block";
  } else {
    commentsContainer.style.display = "none";
  }
}

// Submit comment.
async function submitComment(postId) {
  const commentInput = document.getElementById(`comment-${postId}`);
  const content = commentInput.value.trim();
  
  if (!content) {
    alert("Please enter a comment");
    return;
  }
  
  try {
    await addComment(postId, content);
    commentInput.value = "";
    alert("Comment posted!");
    showComments(postId); // Reload comments
  } catch (error) {
    alert("Error posting comment: " + error.message);
  }
}

/* ==================================================================
   RESOURCE FUNCTIONS
   ================================================================== */

// Upload a resource.
async function uploadResource(data, file) {
  const fbUser = auth.currentUser;
  if (!fbUser) throw new Error("You must be logged in to upload a resource.");

  const user = getStoredUser();
  const resourceData = {
    ...data,
    authorId: fbUser.uid,
    authorName: user?.name || fbUser.email,
    timestamp: serverTimestamp(),
    downloadCount: 0
  };

  // Upload file to Cloudinary.
  if (file) {
    const fileUrl = await uploadToCloudinary(file, "siza/resources");
    resourceData.fileUrl = fileUrl;
    resourceData.fileName = file.name;
    resourceData.fileType = file.type;
  }

  await addDoc(collection(db, "resources"), resourceData);
}

// Load resources into grid.
async function loadResourcesIntoGrid() {
  const grid = qs("resourcesGrid");
  if (!grid) return;

  grid.innerHTML = `<div class="card">Loading resources…</div>`;
  try {
    const qRef = query(collection(db, "resources"), orderBy("timestamp", "desc"));
    const snap = await getDocs(qRef);

    if (snap.empty) {
      grid.innerHTML = `<div class="card">No resources uploaded yet.</div>`;
      return;
    }

    grid.innerHTML = "";
    snap.forEach((docSnap) => {
      const r = docSnap.data();
      const rid = docSnap.id;

      const card = document.createElement("div");
      card.className = "card resource-card";
      
      // Determine icon based on file type.
      let fileIcon = "📄"; // default
      if (r.fileType) {
        if (r.fileType.includes("pdf")) fileIcon = "📕";
        else if (r.fileType.includes("word") || r.fileType.includes("document")) fileIcon = "📘";
        else if (r.fileType.includes("presentation") || r.fileType.includes("powerpoint")) fileIcon = "📊";
        else if (r.fileType.includes("sheet") || r.fileType.includes("excel")) fileIcon = "📈";
        else if (r.fileType.includes("text")) fileIcon = "📝";
      }
      
      card.innerHTML = `
        <div class="resource-thumbnail">
          <span style="font-size: 3rem;">${fileIcon}</span>
        </div>
        <div class="resource-content">
          <h3 class="resource-title">${r.title || "Untitled Resource"}</h3>
          <p class="resource-description">${r.description || "No description provided."}</p>
          <div class="resource-meta">
            <span class="resource-author">By ${r.authorName || "Unknown"}</span>
            <span>${r.downloadCount || 0} downloads</span>
          </div>
        </div>
        <div class="resource-actions" style="padding: 0 1rem 1rem;">
          <a href="${r.fileUrl}" target="_blank" class="btn-download" data-resource-id="${rid}">Download</a>
        </div>
      `;
      grid.appendChild(card);
    });

    // Add download tracking with the new tab approach.
    grid.querySelectorAll(".btn-download").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.preventDefault(); // Stop the immediate link following
        const resourceId = btn.dataset.resourceId;
        const fileUrl = btn.href;
        
        await incrementDownloadCount(resourceId); // Record the download
        window.open(fileUrl, '_blank'); // Open in new tab
      });
    });
  } catch (err) {
    console.error("Error loading resources:", err);
    grid.innerHTML = `<div class="card">Could not load resources.</div>`;
  }
}

// Increment download count.
async function incrementDownloadCount(resourceId) {
  try {
    const resourceRef = doc(db, "resources", resourceId);
    const resourceSnap = await getDoc(resourceRef);
    
    if (resourceSnap.exists()) {
      const currentCount = resourceSnap.data().downloadCount || 0;
      await setDoc(resourceRef, { downloadCount: currentCount + 1 }, { merge: true });
    }
  } catch (err) {
    console.error("Error updating download count:", err);
  }
}

// Wire resource form.
function wireResourceForm() {
  const form = qs("resourceForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || form.querySelector('button[type="submit"]');
    const user = getStoredUser();
    if (!user) return alert("Please log in first.");

    const title = qs("resourceTitle").value.trim();
    const description = qs("resourceDescription").value.trim();
    const file = qs("resourceFile").files[0];

    if (!title || !description || !file) {
      return alert("Please fill in all fields and select a file.");
    }

    const data = {
      title,
      description
    };

    try {
      await withButtonLoading(btn, () => uploadResource(data, file));
      alert("Resource uploaded successfully!");
      form.reset();
      loadResourcesIntoGrid(); // Refresh the grid
    } catch (err) {
      console.error(err);
      alert("Could not upload resource: " + (err?.message || err));
    }
  });
}
/* ==================================================================
   Route guard
   ================================================================== */
// Replace requireAuth with this (safer):
function requireAuth(roles = []) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { localStorage.removeItem("sizaUser"); window.location.href = "index.html"; return; }

    const data = (await fetchUserData(user.uid)) || getStoredUser();
    const role = String(data?.accountType || "unknown").toLowerCase();

    if (role === "unknown") {
      alert("Please finish sign up and pick Investor or Entrepreneur.");
      window.location.href = "index.html";
      return;
    }

    if (roles.length && !roles.includes(role)) {
      const dest = role === "investor" ? "investor-dashboard.html" : "entrepreneur-dashboard.html";
      alert("You do not have access to this page. Redirecting to your dashboard.");
      window.location.href = dest;
    }
  });
}


/* ==================================================================
   Render helpers
   ================================================================== */
function setText(id, value, fallback = "—") {
  const el = qs(id);
  if (el) el.textContent = value || fallback;
}
function setSrc(id, url, fallback = "") {
  const el = qs(id);
  if (!el) return;
  el.src = url || fallback || el.src || DEFAULT_AVATAR;
}
function fileLink(id, url, label) {
  const el = qs(id);
  if (!el) return;
  el.innerHTML = url ? `<a href="${url}" target="_blank" rel="noopener">${label || "Open"}</a>` : "—";
}
function show(el, on = true) {
  if (el) el.style.display = on ? "" : "none";
}
async function loadUserDoc(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    const cached = getStoredUser();
    if (cached && cached.id === uid) return cached;
    throw e;
  }
}
function showSkeleton(on) {
  const sk = $(".profile-skeleton");
  const main = $(".profile-main");
  show(sk, !!on);
  show(main, !on);
}

/* ==================================================================
   Navbar links + avatar
   ================================================================== */
function updateNavForUser(u, optimistic = false) {
  const navDashboard = document.getElementById("nav-dashboard");
  const navProfile   = document.getElementById("nav-profile");
  const navEdit      = document.getElementById("nav-edit");
  const navAdmin     = document.getElementById("nav-admin");
  const navLogout    = document.getElementById("nav-logout");
  const navLogin     = document.getElementById("nav-login"); // may not exist
  const navAvatar    = document.getElementById("navAvatar"); // optional

  const show = (el, on = true) => { if (el) el.style.display = on ? "" : "none"; };
  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const onIndex = here === "index.html";

  // Always hide Login on non-index pages immediately (even during optimistic phase)
  if (navLogin && !onIndex) show(navLogin, false);

  // While waiting for auth restore, render nothing else yet.
  if (!u && optimistic) return;

  if (!u) {
    // Logged OUT.
    show(navDashboard, false);
    show(navProfile,   false);
    show(navEdit,      false);
    show(navAdmin,     false);
    show(navLogout,    false);
    if (navAvatar) show(navAvatar, false);

    // Show Login only on index (if present)
    if (navLogin) show(navLogin, onIndex);
    return;
  }

  // Logged IN.
  const role = String(u.accountType || "unknown").toLowerCase();
  const isInvestor = role === "investor";

  const dashUrl = isInvestor ? "investor-dashboard.html"     : "entrepreneur-dashboard.html";
  const viewUrl = isInvestor ? "investor.html"                : "entrepreneur.html";
  const editUrl = isInvestor ? "edit-investor.html"           : "edit-entrepreneur.html";

  // Hide Login when signed in.
  if (navLogin) show(navLogin, false);

  // Admin link (only for admin)
  if (navAdmin) {
    if (role === "admin") {
      navAdmin.href = `admin-dashboard.html?uid=${encodeURIComponent(u.id)}`;
      show(navAdmin, true);
    } else {
      show(navAdmin, false);
    }
  }

  // Dashboard link.
  if (navDashboard) {
    navDashboard.href = `${dashUrl}?uid=${encodeURIComponent(u.id)}`;
    show(navDashboard, true);
  }

  // Profile + Edit links depend on profileComplete.
  if (navProfile) {
    if (u.profileComplete) {
      navProfile.textContent = "My Profile";
      navProfile.href = `${viewUrl}?uid=${encodeURIComponent(u.id)}`;
      show(navProfile, true);

      if (navEdit) {
        navEdit.href = `${editUrl}?uid=${encodeURIComponent(u.id)}`;
        show(navEdit, true);
      }
    } else {
      navProfile.textContent = "Finish Profile";
      navProfile.href = `${editUrl}?uid=${encodeURIComponent(u.id)}`;
      show(navProfile, true);

      if (navEdit) show(navEdit, false);
    }
  }

  // Logout visible when signed in.
  show(navLogout, true);

  // Optional avatar.
  if (navAvatar) {
    if (u.profilePic) {
      navAvatar.src = u.profilePic;
      show(navAvatar, true);
    } else {
      show(navAvatar, false);
    }
  }

  // Highlight current page link.
  document.querySelectorAll("header a[href]").forEach(a => {
    a.classList.remove("active");
    const file = (a.getAttribute("href") || "").split("/").pop().toLowerCase();
    if (file && file === here) a.classList.add("active");
  });

  // If you have a global applyAvatarImages helper, call it safely.
  if (typeof applyAvatarImages === "function") applyAvatarImages(u);
}

// ===== Avatar dropdown =====
window.avatarDropdown = function () {
  const wrap = document.querySelector('[data-avatar-menu]');
  if (!wrap) return;

  const btn  = wrap.querySelector('.avatar-btn');
  const menu = wrap.querySelector('.menu');

  function close() {
    wrap.classList.remove('open');
    btn?.setAttribute('aria-expanded', 'false');
  }

  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowOpen = !wrap.classList.contains('open');
    wrap.classList.toggle('open', nowOpen);
    btn.setAttribute('aria-expanded', nowOpen ? 'true' : 'false');
  });

  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
};

// run it after the DOM is ready
document.addEventListener('DOMContentLoaded', window.avatarDropdown);


/* ==================================================================
   Investor dashboard grid - Shows ALL pitches
   ================================================================== */
async function loadPitchesIntoGrid() {
  console.log("Starting loadPitchesIntoGrid()");
  
  // Wait a moment for the page to fully load.
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const grid = document.getElementById("pitchGrid"); 
  if (!grid) {
    console.error("pitchGrid element not found!");
    console.log("Available elements:", document.querySelectorAll("[id*='Grid'], [id*='grid']"));
    return;
  }
  console.log("Found pitchGrid element");

  grid.innerHTML = `<div class="card">Loading pitches…</div>`;
  
  try {
    const qRef = query(collection(db, "testPitches"), orderBy("timestamp", "desc"));
    const snap = await getDocs(qRef);

    if (snap.empty) {
      grid.innerHTML = `<div class="card">No pitches submitted yet.</div>`;
      return;
    }

    grid.innerHTML = ""; // Clear loading message
    
    // Add each pitch to the grid.
    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const pid = docSnap.id;

      const title = p.title || p.pitchTitle || "Untitled Pitch";
      const desc  = p.shortPitch || p.description || "No short description provided.";
      const fin   = p.financialProjections || p.projections || "N/A";
      const industry = p.industry || "Not specified";

      const card = document.createElement("div");
      card.className = "idea-card";
      card.innerHTML = `
        <h3>${escapeHtml(title)}</h3>
        <p><strong>Industry:</strong> ${escapeHtml(industry)}</p>
        <p><strong>Description:</strong> ${escapeHtml(desc)}</p>
        <p><strong>Financial Projections:</strong> ${escapeHtml(fin)}</p>
        ${p.pitchDeck ? `<p><a class="btn" href="${p.pitchDeck}" target="_blank" rel="noopener">Open Deck</a></p>` : ""}
        <button class="btn view-pitch-btn" data-pitch-id="${pid}">View Pitch</button>
      `;
      
      grid.appendChild(card);
    });

    console.log("Cards added, setting up NDA modal...");
    
    // Set up NDA modal.
    setupNDAModal(grid);
    
  } catch (err) {
    console.error("Error loading pitches:", err);
    grid.innerHTML = `<div class="card">Could not load pitches: ${err.message}</div>`;
  }
}
function setupNDAModal(grid) {
  const modal = document.getElementById("ndaModal");
  if (!modal) {
    console.error("NDA modal not found!");
    // Fallback: direct redirect.
    grid.querySelectorAll(".view-pitch-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const pitchId = btn.dataset.pitchId;
        window.location.href = `pitch-details.html?id=${pitchId}`;
      });
    });
    return;
  }

  console.log("Setting up NDA modal");
  
  let selectedPitchId = null;

  // ------- helpers -------
  const toast = (m) => (window.showToast ? window.showToast(m) : alert(m));
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

  // Robust signature check (works with plain <canvas> or SignaturePad)
  function isCanvasSigned(canvas) {
    try {
      if (!canvas) return false;

      // If you have a lib with isEmpty(), prefer that
      if (window.signaturePad && typeof window.signaturePad.isEmpty === "function") {
        return !window.signaturePad.isEmpty();
      }

      // Ensure canvas has a real drawing buffer (handle CSS scaling)
      const w = canvas.width  || Math.round(canvas.getBoundingClientRect().width);
      const h = canvas.height || Math.round(canvas.getBoundingClientRect().height);
      if (!w || !h) return false;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return false;

      // If the canvas element's internal size is 0, try resizing snapshot
      // (keeps UI intact; only for detection)
      const tmp = document.createElement("canvas");
      tmp.width = w; tmp.height = h;
      const tctx = tmp.getContext("2d");
      tctx.drawImage(canvas, 0, 0, w, h);

      const { data } = tctx.getImageData(0, 0, w, h);
      // Consider "signed" if any pixel is not fully transparent and not pure white
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (a !== 0 && !(r === 255 && g === 255 && b === 255)) {
          return true;
        }
      }
      return false;
    } catch {
      // If anything goes wrong, fall back to data-signed flag
      return !!(canvas && canvas.getAttribute && canvas.getAttribute("data-signed") && canvas.getAttribute("data-signed") !== "false");
    }
  }

  // Validate full name + signature + checkbox inside modal
  function validateNDA(modalRoot) {
    const nameEl =
      modalRoot.querySelector("#ndaFullName") ||
      modalRoot.querySelector("#ndaName") ||
      modalRoot.querySelector('input[name="ndaFullName"]') ||
      modalRoot.querySelector('input[type="text"]');

    const agreeEl =
      modalRoot.querySelector("#ndaAgree") ||
      modalRoot.querySelector('input[name="ndaAgree"]');

    const sigCanvas =
      modalRoot.querySelector("#ndaCanvas") ||
      modalRoot.querySelector("#signaturePad") ||
      modalRoot.querySelector("canvas");

    let ok = true;

    // Name required (min 2 chars)
    const nameVal = String(nameEl?.value || "").trim();
    clearFieldError(nameEl);
    if (nameVal.length < 2) {
      ok = false;
      fieldError(nameEl, "Please type your full name.");
    }

    // Must tick checkbox if present
    if (agreeEl) {
      clearFieldError(agreeEl);
      if (!agreeEl.checked) {
        ok = false;
        fieldError(agreeEl, "Please agree to the NDA to continue.");
      }
    }

    // Signature required if a signature control exists
    if (sigCanvas) {
      const signed = isCanvasSigned(sigCanvas);
      if (!signed) {
        ok = false;
        fieldError(sigCanvas, "Please draw your signature.");
      } else {
        clearFieldError(sigCanvas);
      }
    }

    if (!ok) toast("Please complete all NDA fields.");
    return ok;
  }

  // ------- Accept button (strict) -------
  const acceptBtn = document.getElementById("acceptNDA");
  if (acceptBtn) {
    // Remove old listeners.
    acceptBtn.replaceWith(acceptBtn.cloneNode(true));
    const newAcceptBtn = document.getElementById("acceptNDA");

    newAcceptBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!selectedPitchId) return;

      // 1) Require full name + signature (+ checkbox)
      if (!validateNDA(modal)) return;

      // 2) Enforce investor daily limit (if guard is available)
      if (typeof window.guardDailyPitchReviews === "function") {
        const ok = await window.guardDailyPitchReviews(selectedPitchId);
        if (!ok) return; // toast already shown
      }

      // 3) Persist NDA acceptance if your app exposes it
      try {
        if (typeof window.acceptNDA === "function") {
          await window.acceptNDA(selectedPitchId);
        }
      } catch (err) {
        console.error("[acceptNDA]", err);
        toast("Could not record NDA acceptance. Please try again.");
        return;
      }

      console.log("NDA accepted for pitch:", selectedPitchId);
      modal.style.display = "none";
      window.location.href = `pitch-details.html?id=${selectedPitchId}`;
    });
  }

  // ------- Decline button -------
  const declineBtn = document.getElementById("declineNDA");
  if (declineBtn) {
    declineBtn.replaceWith(declineBtn.cloneNode(true));
    const newDeclineBtn = document.getElementById("declineNDA");

    newDeclineBtn.addEventListener("click", () => {
      console.log("NDA declined");
      modal.style.display = "none";
      selectedPitchId = null;
    });
  }

  // ------- View Pitch buttons -> open modal -------
  const viewButtons = grid.querySelectorAll(".view-pitch-btn");
  console.log("Found", viewButtons.length, "view pitch buttons");

  viewButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      selectedPitchId = btn.dataset.pitchId;
      console.log("Showing NDA modal for pitch:", selectedPitchId);
      // Clear prior errors when reopening
      modal.querySelectorAll(".field-error").forEach(el => (el.textContent = ""));
      modal.querySelectorAll("[aria-invalid='true']").forEach(el => el.removeAttribute("aria-invalid"));
      modal.style.display = "flex";
    });
  });

  console.log("NDA modal setup complete");
}

/* ------------------------------------------------------------------
   Investor daily full-pitch view limit (2/day) — global guard
   Protects: clicks + location.assign/replace to pitch-details.html
   ------------------------------------------------------------------ */
(function installPitchViewLimit() {
  if (window._pitchLimitInstalled) return;
  window._pitchLimitInstalled = true;

  if (typeof window.db !== "object") return; // Firebase not ready → no-op
  const DAILY_LIMIT = 2;

  function todayKey() {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  async function getTodaysReviewCount(investorId) {
    const qRef = query(
      collection(db, "pitchReviews"),
      where("investorId", "==", investorId),
      where("day", "==", todayKey())
    );
    const snap = await getDocs(qRef);
    return snap.size;
  }

  async function recordPitchReview(investorId, pitchId) {
    await addDoc(collection(db, "pitchReviews"), {
      investorId,
      pitchId,
      day: todayKey(),
      at: serverTimestamp()
    });
  }

  // Expose so NDA handler can call it too
  window.guardDailyPitchReviews = async function(pitchId) {
    try {
      const user = (typeof getStoredUser === "function") ? getStoredUser() : null;
      if (!user || String(user.accountType||"").toLowerCase() !== "investor") return true;
      const count = await getTodaysReviewCount(user.id);
      if (count >= DAILY_LIMIT) {
        showToast(`Daily limit reached. You can view ${DAILY_LIMIT} full pitches per day.`);
        return false;
      }
      await recordPitchReview(user.id, pitchId);
      return true;
    } catch (e) {
      console.error("Pitch limit check failed:", e);
      return true; // fail-open to avoid locking out users on transient errors
    }
  };

  // Helper to extract id from a URL: .../pitch-details.html?id=XYZ
  function getPitchIdFromHref(href) {
    try {
      const u = new URL(href, location.origin);
      if (!/pitch-details\.html$/i.test(u.pathname)) return null;
      return u.searchParams.get("id");
    } catch { return null; }
  }

  // Intercept UI clicks to pitch-details links
  document.addEventListener("click", async (e) => {
    const link = e.target.closest("a[href]");
    if (!link) return;
    const pid = getPitchIdFromHref(link.getAttribute("href") || "");
    if (!pid) return;
    e.preventDefault();
    const ok = await window.guardDailyPitchReviews(pid);
    if (ok) window.location.href = link.href;
  }, true);

  // Intercept programmatic redirects
  const _assign = window.location.assign.bind(window.location);
  const _replace = window.location.replace.bind(window.location);
  window.location.assign = async function(href) {
    const pid = getPitchIdFromHref(String(href || ""));
    if (pid) {
      const ok = await window.guardDailyPitchReviews(pid);
      if (!ok) return;
    }
    _assign(href);
  };
  window.location.replace = async function(href) {
    const pid = getPitchIdFromHref(String(href || ""));
    if (pid) {
      const ok = await window.guardDailyPitchReviews(pid);
      if (!ok) return;
    }
    _replace(href);
  };
})();




/* ==================================================================
   Entrepreneur dashboard - Shows only YOUR pitches
   ================================================================== */
async function loadMyPitches() {
  const grid = document.getElementById("myPitchesGrid"); 
  if (!grid) return;

  const user = getStoredUser(); 
  if (!user) {
    grid.innerHTML = `<div class="card">Please log in to see your pitches.</div>`;
    return;
  }

  grid.innerHTML = `<div class="card">Loading your pitches…</div>`;
  
  try {
    console.log("Loading pitches for entrepreneur:", user.id);

    // Get only YOUR pitches.
    const qRef = query(
      collection(db, "testPitches"),
      where("entrepreneurID", "==", user.id), // Only get pitches with YOUR ID
      orderBy("timestamp", "desc") // Newest first
    );
    
    const snap = await getDocs(qRef);
    console.log("Found", snap.size, "pitches for entrepreneur");

    if (snap.empty) {
      grid.innerHTML = `<div class="card">You haven't submitted any pitches yet.</div>`;
      return;
    }

    grid.innerHTML = ""; // Clear the "loading" message

    // For each of YOUR pitches...
    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const pid = docSnap.id;

      const title = p.title || p.pitchTitle || "Untitled Pitch";
      const desc  = p.shortPitch || p.description || "No short description provided.";
      const fin   = p.financialProjections || p.projections || "N/A";
      const industry = p.industry || "Not specified";

      // Create a card for YOUR pitch.
      const card = document.createElement("div");
      card.className = "idea-card";
      card.innerHTML = `
        <h3>${title}</h3>
        <p><strong>Industry:</strong> ${industry}</p>
        <p><strong>Description:</strong> ${desc}</p>
        <p><strong>Financial Projections:</strong> ${fin}</p>
        ${p.pitchDeck ? `<p><a class="btn" href="${p.pitchDeck}" target="_blank" rel="noopener">Open Deck</a></p>` : ""}
        <p><small>Submitted on: ${p.timestamp?.toDate().toLocaleDateString() || "Unknown date"}</small></p>
        <button class="btn edit-pitch-btn" data-pitch-id="${pid}">Edit Pitch</button>
      `;
      
      // Put YOUR card on YOUR grid.
      grid.appendChild(card);
    });

    // Make the "Edit Pitch" buttons work.
    grid.querySelectorAll(".edit-pitch-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const pitchId = btn.dataset.pitchId;
        window.location.href = `edit-pitch.html?id=${pitchId}`;
      });
    });
    
  } catch (err) {
    console.error("Error loading entrepreneur pitches:", err);
    grid.innerHTML = `
      <div class="card">
        <p>Could not load your pitches.</p>
        <p>Error: ${err.message}</p>
        <button class="btn" onclick="loadMyPitches()">Try Again</button>
      </div>
    `;
  }
}

/* ==================================================================
   ADMIN DASHBOARD FUNCTIONS
   ================================================================== */

// Check if user is admin.
async function isUserAdmin(uid) {
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists() && userDoc.data().accountType === "admin";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Get all users (for admin to manage)
async function getAllUsers() {
  try {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    const users = [];
    
    querySnapshot.forEach((doc) => {
      users.push({ 
        id: doc.id, 
        ...doc.data(),
        // Ensure all required fields exist.
        name: doc.data().name || "Unknown",
        email: doc.data().email || "No email",
        accountType: doc.data().accountType || "unknown",
        profileComplete: doc.data().profileComplete || false,
        createdAt: doc.data().createdAt || null
      });
    });
    
    return users;
  } catch (error) {
    console.error("Error getting users:", error);
    return []; // Return empty array instead of throwing error
  }
}

// Get system statistics.
async function getSystemStats() {
  try {
    // Get user counts.
    const usersSnapshot = await getDocs(collection(db, "users"));
    const totalUsers = usersSnapshot.size;
    
    const entrepreneursSnapshot = await getDocs(
      query(collection(db, "users"), where("accountType", "==", "entrepreneur"))
    );
    const totalEntrepreneurs = entrepreneursSnapshot.size;
    
    const investorsSnapshot = await getDocs(
      query(collection(db, "users"), where("accountType", "==", "investor"))
    );
    const totalInvestors = investorsSnapshot.size;
    
    // Get pitch counts.
    const pitchesSnapshot = await getDocs(collection(db, "testPitches"));
    const totalPitches = pitchesSnapshot.size;
    
    // Get resource counts.
    const resourcesSnapshot = await getDocs(collection(db, "resources"));
    const totalResources = resourcesSnapshot.size;
    
    // Get forum post counts.
    const postsSnapshot = await getDocs(collection(db, "posts"));
    const totalPosts = postsSnapshot.size;
    
    return {
      totalUsers,
      totalEntrepreneurs,
      totalInvestors,
      totalPitches,
      totalResources,
      totalPosts,
      timestamp: new Date().toLocaleString()
    };
  } catch (error) {
    console.error("Error getting system stats:", error);
    throw error;
  }
}

// Update user role (admin function)
async function updateUserRole(userId, newRole) {
  try {
    await updateDoc(doc(db, "users", userId), {
      accountType: newRole
    });
    return true;
  } catch (error) {
    console.error("Error updating user role:", error);
    throw error;
  }
}

// Delete user (admin function)
async function deleteUser(userId) {
  try {
    await deleteDoc(doc(db, "users", userId));
    return true;
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}

// Delete pitch (admin function)
async function deletePitch(pitchId) {
  try {
    await deleteDoc(doc(db, "testPitches", pitchId));
    return true;
  } catch (error) {
    console.error("Error deleting pitch:", error);
    throw error;
  }
}

// Delete forum post (admin function)
async function deleteForumPost(postId) {
  try {
    await deleteDoc(doc(db, "posts", postId));
    return true;
  } catch (error) {
    console.error("Error deleting forum post:", error);
    throw error;
  }
}

// Delete resource (admin function)
async function deleteResource(resourceId) {
  try {
    await deleteDoc(doc(db, "resources", resourceId));
    return true;
  } catch (error) {
    console.error("Error deleting resource:", error);
    throw error;
  }
}

// Load admin dashboard.
async function loadAdminDashboard() {
  const user = getStoredUser();
  
  // Check admin status first.
  if (!user || !(await isUserAdmin(user.id))) {
    alert("Admin access required");
    window.location.href = "index.html";
    return;
  }
  
  try {
    showGlobalLoader(true);
    
    // Get all data.
    const users = await getAllUsers();
    const stats = await getSystemStats();
    const pitchesSnapshot = await getDocs(collection(db, "testPitches"));
    const postsSnapshot = await getDocs(collection(db, "posts"));
    const resourcesSnapshot = await getDocs(collection(db, "resources"));
    
    // Update UI.
    updateStatsDisplay(stats);
    loadUsersTable(users);
    loadRecentActivity(pitchesSnapshot, postsSnapshot, resourcesSnapshot);
    
  } catch (error) {
    console.error("Error:", error);
    alert("Error loading dashboard: " + error.message);
  } finally {
    showGlobalLoader(false);
  }
}

// Update statistics display.
function updateStatsDisplay(stats) {
  setText("totalUsers", stats.totalUsers);
  setText("totalEntrepreneurs", stats.totalEntrepreneurs);
  setText("totalInvestors", stats.totalInvestors);
  setText("totalPitches", stats.totalPitches);
  setText("totalResources", stats.totalResources);
  setText("totalPosts", stats.totalPosts);
  setText("lastUpdated", stats.timestamp);
}

// Load users table.
function loadUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  
  tbody.innerHTML = "";
  
  users.forEach(user => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${user.name || "N/A"}</td>
      <td>${user.email || "N/A"}</td>
      <td>
        <select class="role-select" data-user-id="${user.id}">
          <option value="entrepreneur" ${user.accountType === 'entrepreneur' ? 'selected' : ''}>Entrepreneur</option>
          <option value="investor" ${user.accountType === 'investor' ? 'selected' : ''}>Investor</option>
          <option value="admin" ${user.accountType === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
      </td>
      <td>${user.profileComplete ? 'Yes' : 'No'}</td>
      <td>${user.createdAt?.toDate?.().toLocaleDateString() || 'N/A'}</td>
      <td>
        <button class="btn btn-small btn-danger delete-user-btn" data-user-id="${user.id}">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  
  // Add event listeners.
  addAdminEventListeners();
}

// Load recent activity.
function loadRecentActivity(pitchesSnapshot, postsSnapshot, resourcesSnapshot) {
  console.log("Loading recent activity...");
  console.log("Pitches snapshot:", pitchesSnapshot);
  console.log("Posts snapshot:", postsSnapshot);
  console.log("Resources snapshot:", resourcesSnapshot);
  
  // Load recent pitches.
  const pitchesContainer = document.getElementById("recentPitches");
  if (pitchesContainer) {
    pitchesContainer.innerHTML = "";
    
    // Check if we have valid snapshot data.
    if (pitchesSnapshot && pitchesSnapshot.docs && Array.isArray(pitchesSnapshot.docs)) {
      console.log("Found", pitchesSnapshot.docs.length, "pitches");
      
      // Take only the first 5 most recent pitches.
      const recentPitches = pitchesSnapshot.docs.slice(0, 5);
      
      if (recentPitches.length === 0) {
        pitchesContainer.innerHTML = "<p>No pitches found.</p>";
      } else {
        recentPitches.forEach((doc, index) => {
          const pitch = doc.data();
          console.log("Processing pitch:", pitch);
          
          const item = document.createElement("div");
          item.className = "activity-item";
          item.innerHTML = `
            <div style="flex: 1;">
              <strong>${pitch.title || pitch.pitchTitle || "Untitled Pitch"}</strong>
              <br>
              <small>by ${pitch.author || pitch.email || "Unknown"} • 
              ${pitch.timestamp?.toDate ? pitch.timestamp.toDate().toLocaleDateString() : 'Recent'}</small>
            </div>
            <button class="btn btn-small btn-danger delete-pitch-btn" data-pitch-id="${doc.id}">Delete</button>
          `;
          pitchesContainer.appendChild(item);
        });
      }
    } else {
      console.error("Invalid pitches snapshot structure");
      pitchesContainer.innerHTML = "<p>Error loading pitches.</p>";
    }
    
    // Add delete listeners for pitches.
    setTimeout(() => {
      document.querySelectorAll('.delete-pitch-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
          const pitchId = this.dataset.pitchId;
          if (confirm("Are you sure you want to delete this pitch?")) {
            try {
              await deletePitch(pitchId);
              alert("Pitch deleted successfully!");
              loadAdminDashboard(); // Refresh the dashboard
            } catch (error) {
              alert("Error deleting pitch: " + error.message);
            }
          }
        });
      });
    }, 100);
  }
  
  // You can add similar sections for posts and resources here.
  const postsContainer = document.getElementById("recentPosts");
  const resourcesContainer = document.getElementById("recentResources");
  
  // Add posts section if container exists.
  if (postsContainer) {
    postsContainer.innerHTML = "<p>Posts section coming soon...</p>";
  }
  
  // Add resources section if container exists.
  if (resourcesContainer) {
    resourcesContainer.innerHTML = "<p>Resources section coming soon...</p>";
  }
}

// Add event listeners for admin actions.
function addAdminEventListeners() {
  // Role change listeners.
  document.querySelectorAll('.role-select').forEach(select => {
    select.addEventListener('change', async function() {
      const userId = this.dataset.userId;
      const newRole = this.value;
      
      try {
        await updateUserRole(userId, newRole);
        alert("User role updated successfully!");
      } catch (error) {
        alert("Error updating role: " + error.message);
        // Reset to original value.
        this.value = this.dataset.originalValue;
      }
    });
  });
  
  // Delete user listeners.
  document.querySelectorAll('.delete-user-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const userId = this.dataset.userId;
      
      if (confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
        try {
          await deleteUser(userId);
          alert("User deleted successfully!");
          loadAdminDashboard(); // Refresh the dashboard
        } catch (error) {
          alert("Error deleting user: " + error.message);
        }
      }
    });
  });
  
  // Delete pitch listeners.
  document.querySelectorAll('.delete-pitch-btn').forEach(btn => {
    btn.addEventListener('click', async function() {
      const pitchId = this.dataset.pitchId;
      
      if (confirm("Are you sure you want to delete this pitch?")) {
        try {
          await deletePitch(pitchId);
          alert("Pitch deleted successfully!");
          loadAdminDashboard(); // Refresh the dashboard
        } catch (error) {
          alert("Error deleting pitch: " + error.message);
        }
      }
    });
  });
}

/* ==================================================================
   Pitch details renderer
   ================================================================== */
async function renderPitchDetailsIfNeeded() {
  if (!location.pathname.endsWith("pitch-details.html")) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return alert("Missing pitch id.");

  try {
    const snap = await getDoc(doc(db, "testPitches", id));
    if (!snap.exists()) return alert("Pitch not found.");

    const p = snap.data();

    const title = p.title || p.pitchTitle || "Untitled Pitch";
    const desc  = p.shortPitch || p.description || "—";
    const fin   = p.financialProjections || p.projections || "—";

    setText("pdTitle", title);
    setText("pdAuthor", p.author || "—");
    setText("pdEmail", p.email || "—");
    setText("pdDesc", desc);
    setText("pdProjections", fin);
    setText("pdIndustry", p.industry || "—");
    setText("pdFunding", p.fundingGoal || "—");
    fileLink("pdDeck", p.pitchDeck, "Open Deck");

    const vwrap = qs("pdVideoWrap");
    const vsrc  = qs("pdVideoSrc");
    if (p.pitchVideo && vwrap && vsrc) {
      vsrc.src = p.pitchVideo;
      vwrap.style.display = "";
    } else if (vwrap) {
      vwrap.style.display = "none";
    }


const contactBtnContainer = document.getElementById("contactBtnContainer");
if (contactBtnContainer) {
  const user = getStoredUser();
  if (user && user.accountType === "investor") {
    contactBtnContainer.innerHTML = `
      <button id="contactEntrepreneur" class="btn">Contact Entrepreneur</button>
    `;
    
    // Add event listener after creating the button.
    setTimeout(() => {
      const contactBtn = document.getElementById("contactEntrepreneur");
      if (contactBtn) {
        contactBtn.addEventListener("click", async function() {
          console.log("Contact button clicked via event listener!");
          
          const user = getStoredUser();
          if (!user || user.accountType !== "investor") {
            alert("You need to be logged in as an investor to contact entrepreneurs.");
            return;
          }
          
          const pitchId = new URLSearchParams(location.search).get("id");
          if (!pitchId) {
            alert("Pitch information not found.");
            return;
          }
          
          try {
            console.log("Fetching pitch:", pitchId);
            const pitchDoc = await getDoc(doc(db, "testPitches", pitchId));
            if (!pitchDoc.exists()) {
              alert("Pitch not found.");
              return;
            }
            
            const pitchData = pitchDoc.data();
            console.log("Pitch data:", pitchData);
            const entrepreneurId = pitchData.entrepreneurID;
            
            if (!entrepreneurId) {
              alert("Entrepreneur information not available.");
              return;
            }
            
            console.log("Creating conversation with entrepreneur:", entrepreneurId);
            const conversationId = await getOrCreateConversation(
              user.id, 
              entrepreneurId, 
              pitchId
            );
            
            console.log("Redirecting to chat with conversation:", conversationId);
            window.location.href = `chat.html?conversation=${conversationId}`;
          } catch (error) {
            console.error("Error initiating conversation:", error);
            alert("Failed to start conversation. Please try again. Error: " + error.message);
          }
        });
      }
    }, 100);
  }
}

  } catch (e) {
    console.error(e);
    alert("Could not load pitch details.");
  }
}



/* ==================================================================
   Auth/UI helpers for index
   ================================================================== */
const isIndexPage = () =>
  location.pathname.endsWith("/") ||
  location.pathname.endsWith("/index.html") ||
  location.pathname === "/index.html";

function setAuthUI(u, { skipRedirect = false } = {}) {
  const authSection = document.getElementById("auth");
  const navLogin    = document.getElementById("nav-login");

  if (u) {
    if (authSection) authSection.style.display = "none";
    if (navLogin)    navLogin.style.display    = "none";
    updateNavForUser(u);
    applyAvatarImages(u);

    if (!skipRedirect && isIndexPage() && (window.auth?.currentUser)) {
  const dash = u.accountType === "investor"
    ? "investor-dashboard.html"
    : "entrepreneur-dashboard.html";
  window.location.replace(`${dash}?uid=${encodeURIComponent(u.id)}`);
}

  } else {
    if (authSection) authSection.style.display = "";
    if (navLogin)    navLogin.style.display    = "";

    ["nav-dashboard","nav-profile","nav-edit","nav-logout"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    applyAvatarImages(null);
  }
}

async function ensureAccountType(u) {
  let type = (u?.accountType || "").toLowerCase();
  const valid = (t) => t === "investor" || t === "entrepreneur";

  if (!valid(type)) {
    type = (prompt("Are you an 'investor' or 'entrepreneur'?") || "").toLowerCase().trim();
    if (!valid(type)) {
      alert("Please choose either 'investor' or 'entrepreneur' to continue.");
      throw new Error("Account type not chosen");
    }
    await setDoc(doc(db, "users", u.id), { accountType: type }, { merge: true });
    u = { ...u, accountType: type };
    storeUserLocally(u);
  }
  return { userLike: u, type };
}

/* ==================================================================
   DOMContentLoaded – wire up
   ================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Greeting.
  const usernameSpan = qs("username");
  if (usernameSpan) usernameSpan.textContent = getStoredUser()?.name || "Guest";
  applyAvatarImages(getStoredUser());

  // Initial UI (no redirect from cache)
  setAuthUI(getStoredUser(), { skipRedirect: true });

  // Auth state sync.
  onAuthStateChanged(auth, async (fbUser) => {
  if (!fbUser) {
    // Check if we have temporary user data from navigation.
    const tempUserData = localStorage.getItem("tempUserData");
    if (tempUserData) {
      try {
        console.log("Restoring user from temp navigation data");
        const user = JSON.parse(tempUserData);
        storeUserLocally(user);
        if (usernameSpan) usernameSpan.textContent = user.name;
        setAuthUI(user);
        localStorage.removeItem("tempUserData");
        return;
      } catch (error) {
        console.error("Error restoring temp user:", error);
      }
    }
    
    // No user found.
    localStorage.removeItem("sizaUser");
    if (usernameSpan) usernameSpan.textContent = "Guest";
    setAuthUI(null);
    return;
  }
  
  // User is authenticated with Firebase.
  const userData = await fetchUserData(fbUser.uid);
  const merged = {
    id: fbUser.uid,
    name: userData?.name || fbUser.displayName || "User",
    email: fbUser.email,
    ...userData,
  };
  storeUserLocally(merged);
  if (usernameSpan) usernameSpan.textContent = merged.name;
  setAuthUI(merged); // may redirect from index → dashboard
});

  // Logout.
  qs("nav-logout")?.addEventListener("click", async (e) => {
    e.preventDefault();
    await logout();
  });

  // Guards.
  if (location.pathname.endsWith("entrepreneur-dashboard.html")) requireAuth(["entrepreneur"]);
  if (location.pathname.endsWith("investor-dashboard.html"))     requireAuth(["investor"]);

  // -------- Auth forms (index.html) --------.
 // -------- FIXED LOGIN FORM (result-checked, no throwing) --------.
const loginForm = document.getElementById("loginForm");
console.log("Login form element:", loginForm);

if (loginForm) {
  console.log("Setting up login form listener...");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("=== LOGIN FORM SUBMITTED ===");

    const emailEl = document.getElementById("loginEmail");
    const passEl  = document.getElementById("loginPassword");
    const email   = (emailEl?.value || "").trim();
    const password= passEl?.value || "";

    // basic front-end checks (showToast is provided by script.validation.js)
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk)  { showToast("Please enter a valid email address."); return; }
    if (!password) { showToast("Password is required.");               return; }

    const btn = loginForm.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = "Logging in..."; }

    // IMPORTANT: login() already shows a friendly toast and returns null on failure.
    const userData = await login(email, password);

    if (btn) { btn.disabled = false; btn.textContent = "Login"; }

    // If login failed, STOP here (prevents 'reading accountType' on null)
    if (!userData) return;

    // Success path (defensive reads)
    const role = String(userData.accountType || "").toLowerCase();
    const uid  = userData.id;

    if (role === "admin") {
      window.location.href = `admin-dashboard.html?uid=${uid}`;
      return;
    }

    if (!userData.profileComplete) {
      window.location.href = (role === "investor")
        ? `edit-investor.html?uid=${uid}`
        : `edit-entrepreneur.html?uid=${uid}`;
      return;
    }

    window.location.href = (role === "investor")
      ? `investor-dashboard.html?uid=${uid}`
      : `entrepreneur-dashboard.html?uid=${uid}`;
  });
} else {
  console.error("❌ LOGIN FORM NOT FOUND! Check your HTML ID");
}



  // Fix Google sign-in button.
const googleSignInBtn = document.getElementById("googleSignInBtn");
if (googleSignInBtn) {
  console.log("Setting up Google sign-in button...");
  
  googleSignInBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const btn = e.currentTarget;
    
    try {
    // Show loading state.
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Connecting...";
    
    console.log("Google button clicked");
    const userData = await signInWithGoogle();
    console.log("Google sign-in successful, user data:", userData);
    
    // Check for admin FIRST.
    if (userData.accountType === "admin") {
        console.log("Redirecting admin user to admin dashboard");
        window.location.href = `admin-dashboard.html?uid=${userData.id}`;
    } else if (userData.accountType === "unknown") {
        // Only ask for account type if not admin.
        try {
            const result = await ensureAccountType(userData);
            window.location.href = result.type === "investor"
                ? `edit-investor.html?uid=${userData.id}`
                : `edit-entrepreneur.html?uid=${userData.id}`;
        } catch (error) {
            console.log("User cancelled account type selection");
        }
    } else if (!userData.profileComplete) {
        console.log("Redirecting to profile completion");
        const redirectUrl = userData.accountType === "investor"
            ? `edit-investor.html?uid=${userData.id}`
            : `edit-entrepreneur.html?uid=${userData.id}`;
        window.location.href = redirectUrl;
    } else {
        console.log("Redirecting to dashboard");
        const redirectUrl = userData.accountType === "investor"
            ? `investor-dashboard.html?uid=${userData.id}`
            : `entrepreneur-dashboard.html?uid=${userData.id}`;
        window.location.href = redirectUrl;
    }
    
} catch (error) {
    console.error("Google sign-in handler error:", error);
    alert("Google sign-in failed: " + error.message);
} finally {
    // Reset button state.
    btn.disabled = false;
    btn.textContent = "Continue with Google";
}
  });
} else {
  console.log("Google sign-in button not found");
}

  const signupForm = qs("signupForm");
  signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("Signup form submitted!");
  
  const btn = e.submitter || signupForm.querySelector('button[type="submit"]');
  
  await withButtonLoading(btn, async () => {
    const name = qs("signupName").value.trim();
    const email = qs("signupEmail").value.trim();
    const password = qs("signupPassword").value.trim();
    const accountType = qs("accountType")?.value;
    
    console.log("🔍 Form values:", { name, email, accountType });
    
    // Check if all fields are filled.
    if (!name || !email || !password || !accountType) {
      alert("Please fill in all fields.");
      return;
    }
    
    try {
      console.log("Starting signup process...");
      const user = await signup(email, password, name, accountType);
      console.log("Signup successful! Redirecting...");
      
      // Redirect based on account type.
      if (accountType === "investor") {
        window.location.href = `edit-investor.html?uid=${user.uid}`;
      } else if (accountType === "entrepreneur") {
        window.location.href = `edit-entrepreneur.html?uid=${user.uid}`;
      } else {
        window.location.href = `edit-entrepreneur.html?uid=${user.uid}`;
      }
      
    } catch (error) {
      console.error("Signup failed:", error);
    }
  });
});

  // -------- Edit Investor page --------.
  const invForm = qs("editInvestorForm");
  if (invForm) {
    const user = getStoredUser();

    const nameEl = qs("editName");
    const bioEl = qs("editBio");
    const focusEl = qs("editFocus");
    const locationEl = qs("editLocation");
    const budgetEl = qs("editBudget");
    const picInput = qs("profile-pic");
    const preview = qs("profilePreview");

    if (user) {
      nameEl.value = user.name || "";
      bioEl.value = user.bio || "";
      if (focusEl) focusEl.value = user.focus || "";
      locationEl.value = user.location || "";
      budgetEl.value = user.budget || "";
      if (user.profilePic && preview) preview.src = user.profilePic;
      applyAvatarImages(user);
    }

    picInput?.addEventListener("change", (e) => {
      if (preview && e.target.files[0]) preview.src = URL.createObjectURL(e.target.files[0]);
    });

    invForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.submitter || invForm.querySelector('button[type="submit"]');
      await withButtonLoading(btn, async () => {
        if (!user) { alert("User not logged in"); return; }

        const data = {
          name: nameEl.value.trim(),
          bio: bioEl.value.trim(),
          focus: focusEl?.value || "",
          location: locationEl.value.trim(),
          budget: budgetEl.value.trim(),
          accountType: "investor",
        };
        const files = { profilePic: picInput?.files?.[0] || null };

        await saveProfile(user.id, data, files);
        window.location.href = `profile-complete.html?role=investor&uid=${encodeURIComponent(user.id)}`;
      });
    });
  }

  // -------- Edit Entrepreneur page --------.
  const entForm = qs("editEntrepreneurForm");
  if (entForm) {
    const user = getStoredUser();

    const nameEl = qs("entName");
    const bioEl = qs("entBio");
    const industryEl = qs("entIndustry");
    const locationEl = qs("entLocation");
    const websiteEl = qs("entWebsite");
    const pitchTitleEl = qs("entPitchTitle");
    const fundingEl = qs("entFundingGoal");

    const picInput = qs("entProfilePic");
    const deckInput = qs("entPitchDeck");
    const videoInput = qs("entPitchVideo");
    const preview = qs("entProfilePreview");

    if (user) {
      nameEl.value = user.name || "";
      bioEl.value = user.bio || "";
      industryEl.value = user.industry || "";
      locationEl.value = user.location || "";
      websiteEl.value = user.website || "";
      if (user.profilePic && preview) preview.src = user.profilePic;
      applyAvatarImages(user);
    }

    picInput?.addEventListener("change", (e) => {
      if (preview && e.target.files[0]) preview.src = URL.createObjectURL(e.target.files[0]);
    });

    entForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.submitter || entForm.querySelector('button[type="submit"]');
      await withButtonLoading(btn, async () => {
        if (!user) { alert("User not logged in"); return; }

        const data = {
          name: nameEl.value.trim(),
          bio: bioEl.value.trim(),
          industry: industryEl.value,
          location: locationEl.value.trim(),
          website: websiteEl.value.trim(),
          pitchTitle: pitchTitleEl.value.trim(),
          fundingGoal: fundingEl.value.trim(),
          accountType: "entrepreneur",
        };

        const files = {
          profilePic: picInput?.files?.[0] || null,
          pitchDeck:  deckInput?.files?.[0] || null,
          pitchVideo: videoInput?.files?.[0] || null,
        };

        await saveProfile(user.id, data, files);
        window.location.href = `profile-complete.html?role=entrepreneur&uid=${encodeURIComponent(user.id)}`;
      });
    });
  }

  // -------- Dynamic profile pages --------.
  (async function renderProfileIfNeeded() {
    const type = document.body?.dataset?.profile; // "investor" | "entrepreneur"
    if (!type) return;

    try {
      showSkeleton(true);
      let uid = param("uid") || getStoredUser()?.id;
      if (!uid) {
        alert("Please log in to view this profile.");
        window.location.href = "index.html";
        return;
      }

      const data = await loadUserDoc(uid);
      if (!data) { alert("Profile not found."); return; }

      // Common header.
      setText("profName", data.name || "Unknown");
      setText("profLocation", data.location);
      setText("profRole", data.accountType === "investor" ? "Investor" : "Entrepreneur");
      setSrc("profAvatar", data.profilePic, DEFAULT_AVATAR);
      const badge = qs("goldBadge");
      if (badge) badge.style.display = data.goldVerified ? "" : "none";

      if (type === "entrepreneur") {
        setText("bizIdea", data.pitchTitle || data.bio);
        setText("bizDesc", data.bio);
        setText("bizIndustry", data.industry);
        setText("bizFunding", data.fundingGoal);
        fileLink("docDeck", data.pitchDeck, "Pitch Deck");
        fileLink("docPlan", data.businessPlanURL, "Business Plan");
        fileLink("docForecast", data.financialForecastURL, "Financial Forecast");

        const videoWrap = qs("videoWrap");
        const srcEl = qs("pitchVideoSrc");
        if (data.pitchVideo && srcEl && videoWrap) {
          srcEl.src = data.pitchVideo;
          videoWrap.style.display = "";
        } else if (videoWrap) {
          videoWrap.style.display = "none";
        }
      } else {
        setText("invFocus", data.focus);
        setText("invBudget", data.budget);
        setText("invBio", data.bio);
      }

      applyAvatarImages({ profilePic: data.profilePic, name: data.name });
    } catch (e) {
      console.error(e);
      alert("Could not load profile.");
    } finally {
      showSkeleton(false);
    }
  })();

    // Pages:
  renderPitchDetailsIfNeeded();
  wirePitchForm();
  wireChatUI();
  setupFilters();

// pitch//.
  function wirePitchForm() {
  const form = document.getElementById("pitchForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = getStoredUser();
    if (!user) { alert("You must be logged in to pitch."); return; }

    const pitchData = {
      entrepreneurID: user.id,
      title: form.title.value,
      description: form.description.value,
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db, "testPitches"), pitchData);
    alert("Pitch submitted!");
    form.reset();
  });
}


  // INVESTOR PAGE - Load all pitches for investors.
  if (location.pathname.endsWith("investor-dashboard.html")) {
    loadPitchesIntoGrid(); // ← This loads ALL pitches for investors
    setupFilters();        // ← This sets up the filter functionality
  }

  // ENTREPRENEUR DASHBOARD - Load only entrepreneur's own pitches.
  if (location.pathname.endsWith("entrepreneur-dashboard.html")) {
    loadMyPitches(); // ← This loads only the entrepreneur's own pitches
  }
  // ADMIN DASHBOARD.
  if (location.pathname.endsWith("admin-dashboard.html")) {
    loadAdminDashboard();
    
    // Refresh stats every 30 seconds.
    setInterval(async () => {
      try {
        const stats = await getSystemStats();
        updateStatsDisplay(stats);
      } catch (error) {
        console.error("Error refreshing stats:", error);
      }
    }, 30000);
  }

  // Load resources if on resources page.
  if (location.pathname.endsWith("resources.html")) {
    loadResourcesIntoGrid();
    wireResourceForm();
  }
  // Messages functionality.
  if (location.pathname.endsWith("messages.html")) {
    loadUserConversations();
  }
  updateMessageBadge();
  // Forum functionality.
if (location.pathname.endsWith("forum.html")) {
  loadForumPosts();
  
  // Create post button.
  const createPostBtn = document.getElementById("createPostBtn");
  const createPostModal = document.getElementById("createPostModal");
  const createPostForm = document.getElementById("createPostForm");
  
  if (createPostBtn) {
    createPostBtn.addEventListener("click", function() {
      const user = getStoredUser();
      if (!user) {
        alert("Please log in to create a post");
        return;
      }
      createPostModal.style.display = "flex";
    });
  }
  
  if (createPostForm) {
    createPostForm.addEventListener("submit", async function(e) {
      e.preventDefault();
      const title = document.getElementById("postTitle").value;
      const content = document.getElementById("postContent").value;
      
      try {
        await createPost(title, content);
        createPostModal.style.display = "none";
        createPostForm.reset();
        alert("Post created successfully!");
        loadForumPosts(); // Reload posts
      } catch (error) {
        alert("Error creating post: " + error.message);
      }
    });
  }
}

});

/* ===============================
   Deal Room (WebRTC via Firestore)
   =============================== */

// UI elements (resolved at runtime)
let drCreateBtn, drJoinForm, drJoinInput, drCopyBtn, drRoomWrap, drRoomIdEl;
let drHangupBtn, drToggleMicBtn, drToggleCamBtn, drLocalVideo, drRemoteVideo;

// PeerConnection + media.
let drPC = null;
let drLocalStream = null;
let drRemoteStream = null;

// Firestore refs + unsubscribers.
let drRoomRef = null;
let drUnsubs = []; // onSnapshot unsub functions

const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302'] }];

async function drRequireSignedIn() {
  return new Promise(resolve => {
    const stop = onAuthStateChanged(auth, (u) => {
      stop();
      if (!u) {
        alert("Please sign in to use the Deal Room.");
        window.location.href = "index.html";
      } else {
        resolve(u);
      }
    });
  });
}

async function drInitMedia() {
  if (drLocalStream) return drLocalStream;
  try {
    drLocalStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    drLocalVideo.srcObject = drLocalStream;
    return drLocalStream;
  } catch (e) {
    console.error(e);
    alert("Camera/Mic permission is required.");
    throw e;
  }
}

function drCreatePC() {
  drPC = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Local → send tracks.
  drLocalStream.getTracks().forEach(t => drPC.addTrack(t, drLocalStream));

  // Remote → receive tracks.
  drRemoteStream = new MediaStream();
  drRemoteVideo.srcObject = drRemoteStream;
  drPC.ontrack = (evt) => {
    evt.streams[0].getTracks().forEach(t => drRemoteStream.addTrack(t));
  };

  drPC.oniceconnectionstatechange = () => {
    // console.log('ICE state:', drPC.iceConnectionState);.
    if (['disconnected','failed','closed'].includes(drPC.iceConnectionState)) {
      // optional cleanup.
    }
  };
}

function drSetButtons(onCall) {
  drHangupBtn.style.display = onCall ? "" : "none";
  drToggleMicBtn.style.display = onCall ? "" : "none";
  drToggleCamBtn.style.display = onCall ? "" : "none";
}

async function drCreateRoom() {
  await drRequireSignedIn();
  await drInitMedia();
  drCreatePC();

  // Create room doc.
  const user = getStoredUser();
  drRoomRef = await addDoc(collection(db, "rooms"), {
    createdBy: user?.id || auth.currentUser.uid,
    createdAt: serverTimestamp()
  });

  // Local ICE candidates → offerCandidates.
  const offerCands = collection(drRoomRef, "offerCandidates");
  drPC.onicecandidate = (evt) => {
    if (evt.candidate) addDoc(offerCands, evt.candidate.toJSON()).catch(console.error);
  };

  // Create & store offer.
  const offer = await drPC.createOffer();
  await drPC.setLocalDescription(offer);
  await setDoc(drRoomRef, { offer: { type: offer.type, sdp: offer.sdp } }, { merge: true });

  // Listen for answer on room doc.
  const unsubAns = onSnapshot(drRoomRef, async (snap) => {
    const data = snap.data();
    if (!drPC.currentRemoteDescription && data?.answer) {
      await drPC.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });
  drUnsubs.push(unsubAns);

  // Listen for remote ICE from answerCandidates.
  const answerCands = collection(drRoomRef, "answerCandidates");
  const unsubAC = onSnapshot(answerCands, (snap) => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        drPC.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(console.error);
      }
    });
  });
  drUnsubs.push(unsubAC);

  // Show room id.
  drRoomIdEl.textContent = drRoomRef.id;
  drRoomWrap.style.display = "";
  drSetButtons(true);
}

async function drJoinRoom(roomId) {
  const roomDoc = await getDoc(doc(db, "rooms", roomId));
  if (!roomDoc.exists()) return alert("Room not found.");

  await drRequireSignedIn();
  await drInitMedia();
  drCreatePC();

  const roomData = roomDoc.data();

  // Local ICE → answerCandidates.
  const roomRef = doc(db, "rooms", roomId);
  drRoomRef = roomRef;
  await setDoc(roomRef, { joinedBy: auth.currentUser.uid }, { merge: true });

  const answerCands = collection(roomRef, "answerCandidates");
  drPC.onicecandidate = (evt) => {
    if (evt.candidate) addDoc(answerCands, evt.candidate.toJSON()).catch(console.error);
  };

  // Set remote offer.
  if (!roomData.offer) {
    alert("Room has no offer yet.");
    return;
  }
  await drPC.setRemoteDescription(new RTCSessionDescription(roomData.offer));

  // Create & push answer.
  const answer = await drPC.createAnswer();
  await drPC.setLocalDescription(answer);
  await setDoc(roomRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });

  // Listen for remote ICE from offerCandidates.
  const offerCands = collection(roomRef, "offerCandidates");
  const unsubOC = onSnapshot(offerCands, (snap) => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') {
        drPC.addIceCandidate(new RTCIceCandidate(change.doc.data())).catch(console.error);
      }
    });
  });
  drUnsubs.push(unsubOC);

  // Reflect room id in UI.
  drRoomIdEl.textContent = roomId;
  drRoomWrap.style.display = "";
  drSetButtons(true);
}

async function drHangUp() {
  try {
    drUnsubs.forEach(u => { try { u(); } catch {} });
    drUnsubs = [];
    if (drPC) { drPC.close(); drPC = null; }

    if (drLocalStream) {
      drLocalStream.getTracks().forEach(t => t.stop());
      drLocalStream = null;
    }
    if (drRemoteVideo) drRemoteVideo.srcObject = null;
    if (drLocalVideo)  drLocalVideo.srcObject = null;
  } finally {
    drSetButtons(false);
  }
}

function drToggleMic() {
  const enabled = drLocalStream?.getAudioTracks().some(t => t.enabled);
  drLocalStream?.getAudioTracks().forEach(t => t.enabled = !enabled);
  drToggleMicBtn.textContent = enabled ? "Unmute Mic" : "Mute Mic";
  drToggleMicBtn.classList.toggle("muted", enabled);
}

function drToggleCam() {
  const enabled = drLocalStream?.getVideoTracks().some(t => t.enabled);
  drLocalStream?.getVideoTracks().forEach(t => t.enabled = !enabled);
  drToggleCamBtn.textContent = enabled ? "Turn Camera On" : "Turn Camera Off";
  drToggleCamBtn.classList.toggle("muted", enabled);
}

// Wire UI if we're on deal-room.html.
function wireDealRoomUIIfNeeded() {
  if (!location.pathname.endsWith("deal-room.html")) return;

  // pull elements.
  drCreateBtn     = document.getElementById("drCreate");
  drJoinForm      = document.getElementById("drJoinForm");
  drJoinInput     = document.getElementById("drJoinId");
  drCopyBtn       = document.getElementById("drCopy");
  drRoomWrap      = document.getElementById("drRoom");
  drRoomIdEl      = document.getElementById("drRoomId");
  drHangupBtn     = document.getElementById("drHangup");
  drToggleMicBtn  = document.getElementById("drToggleMic");
  drToggleCamBtn  = document.getElementById("drToggleCam");
  drLocalVideo    = document.getElementById("drLocal");
  drRemoteVideo   = document.getElementById("drRemote");

  // events.
  drCreateBtn?.addEventListener("click", drCreateRoom);
  drJoinForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = (drJoinInput.value || "").trim();
    if (!id) return;
    await drJoinRoom(id);
  });
  drCopyBtn?.addEventListener("click", async () => {
    const id = drRoomIdEl?.textContent || "";
    if (!id) return;
    try { await navigator.clipboard.writeText(id); alert("Room ID copied"); } catch {}
  });
  drHangupBtn?.addEventListener("click", drHangUp);
  drToggleMicBtn?.addEventListener("click", drToggleMic);
  drToggleCamBtn?.addEventListener("click", drToggleCam);

  // auth gate (optional but recommended)
  requireAuth(); // or requireAuth(['investor','entrepreneur'])
}
// Wire up contact button and chat functionality.
function wireChatUI() { 
  // CHAT PAGE FUNCTIONALITY.
  if (location.pathname.endsWith("chat.html")) {
    const conversationId = new URLSearchParams(location.search).get("conversation");
    if (!conversationId) {
      alert("No conversation specified.");
      window.location.href = "investor-dashboard.html";
      return;
    }
    
    const user = getStoredUser();
    if (!user) {
      alert("You need to be logged in to access messages.");
      window.location.href = "index.html";
      return;
    }
    
    let unsubscribeMessages = null;
    
    // Load conversation and messages.
    async function loadChat() {
      try {
        // Get conversation details.
        const conversation = await getConversation(conversationId);
        
        // Find the other participant.
        const otherParticipantId = conversation.participants.find(
          id => id !== user.id
        );
        
        if (!otherParticipantId) {
          alert("Conversation error: participant not found.");
          window.location.href = "investor-dashboard.html";
          return;
        }
        
        // Get other participant's details.
        const otherUser = await fetchUserData(otherParticipantId);
        document.getElementById("chatWithName").textContent = `Chat with ${otherUser?.name || "Unknown User"}`;
        
        // Set up real-time message listener.
        unsubscribeMessages = listenToMessages(conversationId, (messages) => {
          const messagesContainer = document.getElementById("chatMessages");
          messagesContainer.innerHTML = "";
          
          messages.forEach(message => {
            const messageEl = document.createElement("div");
            messageEl.classList.add("message");
            messageEl.classList.add(
              message.senderId === user.id ? "sent" : "received"
            );
            
            const time = message.timestamp?.toDate 
              ? message.timestamp.toDate().toLocaleTimeString() 
              : new Date().toLocaleTimeString();
            
            messageEl.innerHTML = `
              <div>${message.text}</div>
              <div class="message-time">${time}</div>
            `;
            
            messagesContainer.appendChild(messageEl);
          });
          
          // Scroll to bottom.
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          
          // Mark messages as read.
          if (messages.some(m => m.senderId !== user.id && !m.read)) {
            markMessagesAsRead(conversationId, user.id);
          }
        });
        
        // Set up message sending.
        const messageInput = document.getElementById("messageInput");
        const sendButton = document.getElementById("sendMessageBtn");
        
        sendButton.addEventListener("click", async () => {
          const message = messageInput.value.trim();
          if (!message) return;
          
          sendButton.disabled = true;
          try {
            await sendMessage(conversationId, user.id, message);
            messageInput.value = "";
          } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message. Please try again.");
          } finally {
            sendButton.disabled = false;
          }
        });
        
        // Send message on Enter key.
        messageInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            sendButton.click();
          }
        });
        
        // Back button.
        document.getElementById("backToPitch").addEventListener("click", () => {
          if (unsubscribeMessages) unsubscribeMessages();
          window.history.back();
        });
      } catch (error) {
        console.error("Error loading chat:", error);
        alert("Failed to load conversation.");
        window.location.href = "investor-dashboard.html";
      }
    }
    
    loadChat();
  }
}

// Add this to your DOMContentLoaded event listener.
// document.addEventListener("DOMContentLoaded", function() {.
  // ... your existing DOMContentLoaded code ...
  
  // Add this line at the end of the function.
 // wireChatUI();.
// });.

// call after your existing DOMContentLoaded wiring.
document.addEventListener("DOMContentLoaded", wireDealRoomUIIfNeeded);

// Keep nav in sync with current user.
document.addEventListener("DOMContentLoaded", () => {
  updateNavForUser(getStoredUser());

  const out = document.getElementById("nav-logout");
  if (out) {
    out.addEventListener("click", async (e) => {
      e.preventDefault();
      try { await signOut(auth); } catch {}
      localStorage.removeItem("sizaUser");
      window.location.replace("index.html");
    });
  }
});

// Add (or adjust) these two blocks near the bottom of your file:

// a) On first paint, render nav using cached user to avoid "Login" flicker.
document.addEventListener("DOMContentLoaded", () => {
  updateNavForUser(getStoredUser(), /*optimistic*/ true);
  // (Keep your existing page wiring here)
});

// b) When Auth state resolves, fetch fresh user doc, cache it, and update nav for real.
onAuthStateChanged(auth, async (fbUser) => {
  if (!fbUser) {
    localStorage.removeItem("sizaUser");
    updateNavForUser(null);
    return;
  }
  const snap = await getDoc(doc(db, "users", fbUser.uid)).catch(() => null);
  const data = snap && snap.exists() ? snap.data() : {};
  const cached = { id: fbUser.uid, ...data, accountType: String(data?.accountType || "unknown").toLowerCase() };
  localStorage.setItem("sizaUser", JSON.stringify(cached));
  updateNavForUser(cached);
});


// Also refresh nav when Firebase auth state changes.
onAuthStateChanged(auth, async (fbUser) => {
  if (!fbUser) {
    localStorage.removeItem("sizaUser");
    updateNavForUser(null);
    return;
  }
  // Re-fetch to keep local cache fresh.
  const snap = await getDoc(doc(db, "users", fbUser.uid)).catch(() => null);
  const data = snap && snap.exists() ? snap.data() : {};
  const cached = { id: fbUser.uid, ...data, accountType: String(data?.accountType || "unknown").toLowerCase() };
  localStorage.setItem("sizaUser", JSON.stringify(cached));
  updateNavForUser(cached);
});

/* ------------------------------------------------------------------
   Global Guards (Quiet + Filtered)
   - Install once, ignore benign load errors (favicon/ads/CSS, extensions)
   - Toast only for real app errors or Firebase auth codes
   ------------------------------------------------------------------ */
(function installGlobalErrorGuards() {
  if (window._globalErrorGuardsInstalled) return;
  window._globalErrorGuardsInstalled = true;

  const BENIGN_PATTERNS = [
    /favicon\.ico/i,
    /manifest\.json/i,
    /chrome-extension:\/\//i,
    /moz-extension:\/\//i,
    /net::ERR_BLOCKED_BY_CLIENT/i,
    /ResizeObserver loop limit exceeded/i,
    /ResizeObserver loop completed with undelivered notifications/i,
    /Loading CSS chunk/i,
  ];

  function isResourceError(evt) {
    const t = evt && evt.target;
    if (!t || !t.tagName) return false;
    const tag = t.tagName.toUpperCase();
    return tag === "IMG" || tag === "LINK" || tag === "SCRIPT" || tag === "VIDEO" || tag === "AUDIO";
  }

  function looksBenign(errOrMsg) {
    const msg = String(errOrMsg && (errOrMsg.message || errOrMsg) || "");
    return BENIGN_PATTERNS.some((re) => re.test(msg));
  }

  function fromOurAppStack(err) {
    const st = String(err && err.stack || "");
    // Only consider errors that originate from our app files
    return /script\.js|script\.validation\.js/i.test(st);
  }

  function toastIfMeaningful(err) {
    // Prefer Firebase mapping when available
    if (err && err.code && String(err.code).startsWith("auth/")) {
      showToast(mapAuthError(err));
      return;
    }
    // Ignore non-auth benign noise or external stack origins
    if (looksBenign(err) || !fromOurAppStack(err)) {
      // Keep console for developers, but no user toast
      console.debug("[benign]", err);
      return;
    }
    // Fall back to runtime mapper if you keep one; else generic
    const msg = (window.mapRuntimeError ? window.mapRuntimeError(err) : "Something went wrong. Please try again.");
    showToast(msg);
  }

  window.addEventListener("error", (e) => {
    // Ignore resource load errors (missing favicon, blocked assets, etc.)
    if (isResourceError(e) || looksBenign(e.error || e.message)) {
      console.debug("[resource/benign]", e);
      return;
    }
    toastIfMeaningful(e.error || e);
  });

  window.addEventListener("unhandledrejection", (e) => {
    const r = e && e.reason;
    if (!r || looksBenign(r)) {
      console.debug("[promise/benign]", r);
      return;
    }
    toastIfMeaningful(r);
  });
})();

/* ========================================================================== 
   MERGE BLOCK (paste at the very bottom of script.js)
   - Non-invasive: only adds functions if they don't already exist.
   - Adds samuscript helpers + daily investor pitch limit (2/day).
   ========================================================================== */

/* ---------- Safe toast fallback (uses your global if present) ---------- */
(function ensureToast(){
  if (typeof window.showToast === "function") return;
  window.showToast = function(message, ms = 3200) {
    let t = document.getElementById("inlineToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "inlineToast";
      Object.assign(t.style, {
        position:"fixed", left:"50%", top:"18px", transform:"translateX(-50%)",
        background:"#111", color:"#fff", padding:"10px 14px", borderRadius:"10px",
        zIndex:99999, boxShadow:"0 6px 18px rgba(0,0,0,.25)", maxWidth:"90vw", textAlign:"center",
        fontFamily:"system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif"
      });
      document.body.appendChild(t);
    }
    t.textContent = String(message || "Something went wrong. Please try again.");
    t.style.display = "block";
    clearTimeout(window.showToast._t);
    window.showToast._t = setTimeout(() => (t.style.display = "none"), ms);
  };
})();

/* ========================================================================== 
   samuscript helpers (only added if missing)
   ========================================================================== */

// Parse YouTube URLs -> { id, start }
if (typeof window.parseYouTube !== "function") {
  window.parseYouTube = function(url){
    try {
      const u = new URL(String(url||"").trim());
      let id = null, start = 0;
      const t = u.searchParams.get("t") || u.searchParams.get("start");
      if (t) {
        const m = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
        start = m ? (Number(m[1]||0)*3600 + Number(m[2]||0)*60 + Number(m[3]||0)) : (Number(t)||0);
      }
      if (u.hostname.includes("youtu.be"))        id = u.pathname.split("/").filter(Boolean)[0];
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2] || u.pathname.split("/")[1];
      else if (u.searchParams.get("v"))           id = u.searchParams.get("v");
      else if (u.pathname.startsWith("/embed/"))  id = u.pathname.split("/")[2];
      if (!id || id.length < 6) return null;
      return { id, start };
    } catch { return null; }
  };
}

// Initials + currency helpers
if (typeof window.initialsFromName !== "function") {
  window.initialsFromName = function(name=""){
    return name.trim().split(/\s+/).map(s=>s[0]).slice(0,2).join("").toUpperCase() || "S";
  };
}
if (typeof window.formatZAR !== "function") {
  window.formatZAR = function(n){
    if (typeof n === "string") return n;
    if (typeof n !== "number") return "";
    if (n >= 1_000_000) return `R${(n/1_000_000).toFixed(1).replace(/\.0$/,"")}m`;
    if (n >= 1_000)     return `R${(n/1_000).toFixed(0)}k`;
    return `R${n}`;
  };
}

// Build embed from a pitch record
if (typeof window.toEmbedFromPitch !== "function") {
  window.toEmbedFromPitch = function(p){
    if (p?.video?.provider === "youtube" && p.video?.id) {
      const qs = p.video.start ? `?start=${p.video.start}` : "";
      return { kind:"yt", src:`https://www.youtube-nocookie.com/embed/${p.video.id}${qs}` };
    }
    if (p?.pitchVideo)  return { kind:"mp4", src:p.pitchVideo };
    if (p?.videoUrl)    return { kind:"mp4", src:p.videoUrl };
    if (p?.coverImage || p?.image || p?.imageUrl) return { kind:"img", src: p.coverImage || p.image || p.imageUrl };
    return null;
  };
}

// Render locked media thumbnail/initials
if (typeof window.mountLockedMedia !== "function") {
  window.mountLockedMedia = function(container, embed, initials="S"){
    container.innerHTML = "";
    const box = document.createElement("div");
    box.className = "locked-media";
    box.style.cssText = "position:relative;aspect-ratio:16/9;background:#0f172a;border-radius:16px;display:grid;place-items:center;overflow:hidden";
    if (embed?.kind === "img") {
      const img = new Image();
      img.src = embed.src;
      img.alt = "Cover image";
      img.style.maxWidth = "100%";
      img.style.maxHeight = "100%";
      box.appendChild(img);
    } else {
      const badge = document.createElement("div");
      badge.textContent = initials || "S";
      badge.style.cssText = "width:64px;height:64px;border-radius:50%;display:grid;place-items:center;font-weight:700;background:#1f2937;color:#fff;font-size:22px";
      box.appendChild(badge);
    }
    const lock = document.createElement("div");
    lock.textContent = "Preview locked — open pitch to view";
    lock.style.cssText = "position:absolute;bottom:8px;left:8px;right:8px;background:rgba(15,23,42,.7);color:#e5e7eb;padding:6px 10px;border-radius:10px;font-size:12px";
    box.appendChild(lock);
    container.appendChild(box);
  };
}

// Create slick investor card
if (typeof window.createInvestorCard !== "function") {
  window.createInvestorCard = function(pid, p){
    const title    = p.title || p.pitchTitle || "Untitled Pitch";
    const founder  = p.author || p.founderName || p.founder || "";
    const industry = Array.isArray(p.industries) ? p.industries.join(", ") : (p.industry || "");
    const desc     = p.shortPitch || p.description || "";
    const amount   = p.fundingGoal || p.amount || p.raiseTarget || p.targetAmount || null;

    const card = document.createElement("article");
    card.className = "card";

    const media = document.createElement("div");
    media.className = "card-media";
    const embed = window.toEmbedFromPitch(p);
    const initials = (founder || title).split(/\s+/).map(s=>s[0]).slice(0,2).join("").toUpperCase();
    window.mountLockedMedia(media, embed, initials);
    card.appendChild(media);

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `
      <h3 class="card-title">${title}</h3>
      <p class="card-sub">${industry || "&mdash;"}</p>
      <p class="card-desc">${desc}</p>
      <div class="card-actions">
        ${amount ? `<span class="pill pill-amount">${window.formatZAR(Number(amount)||0)}</span>` : ""}
        <button class="btn view-pitch-btn" data-pitch-id="${pid}">View Pitch</button>
      </div>
    `;
    card.appendChild(body);
    return card;
  };
}

// Render entrepreneur’s own pitches (idempotent)
if (typeof window.loadMyPitches !== "function") {
  window.loadMyPitches = async function(){
    const grid = document.getElementById("myPitchesGrid");
    if (!grid) return;
    grid.innerHTML = `<div class="card">Loading your pitches…</div>`;
    try {
      const user = (typeof getStoredUser === "function") ? getStoredUser() : null;
      if (!user || !user.id) {
        grid.innerHTML = `<div class="card">Could not identify user.</div>`;
        return;
      }
      const qRef = query(
        collection(db, "testPitches"),
        where("entrepreneurID", "==", user.id),
        orderBy("timestamp", "desc")
      );
      const snap = await getDocs(qRef);
      if (snap.empty) {
        grid.innerHTML = `<div class="card">You haven't submitted any pitches yet.</div>`;
        return;
      }
      grid.innerHTML = "";
      snap.forEach(docSnap => {
        const p = docSnap.data();
        const pid = docSnap.id;
        grid.appendChild(window.createInvestorCard(pid, p));
      });
      grid.querySelectorAll(".view-pitch-btn").forEach(btn => {
        btn.addEventListener("click", e => {
          e.preventDefault();
          const pitchId = btn.dataset.pitchId;
          window.location.href = `pitch-details.html?id=${pitchId}`;
        });
      });
    } catch (err) {
      console.error("Error loading your pitches:", err);
      grid.innerHTML = `<div class="card">Could not load your pitches: ${err.message}</div>`;
    }
  };
}

/* ========================================================================== 
   Investor daily full-pitch view limit (2/day) — Firestore-backed
   Intercepts:
   - Clicks on .view-pitch-btn and <a href="pitch-details.html?id=...">
   - Programmatic redirects via location.assign/replace
   ========================================================================== */

(function pitchViewLimit(){
  // Needs Firebase globals (db, addDoc, collection, query, where, getDocs, serverTimestamp)
  if (typeof window.db !== "object") return;

  const DAILY_LIMIT = 2;

  function todayKey() {
    const d = new Date();
    // YYYY-MM-DD (local)
    return d.toISOString().slice(0,10);
  }

  async function getTodaysReviewCount(investorId) {
    const qRef = query(
      collection(db, "pitchReviews"),
      where("investorId", "==", investorId),
      where("day", "==", todayKey())
    );
    const snap = await getDocs(qRef);
    return snap.size;
  }

  async function recordPitchReview(investorId, pitchId) {
    await addDoc(collection(db, "pitchReviews"), {
      investorId,
      pitchId,
      day: todayKey(),
      at: serverTimestamp()
    });
  }

  async function guardDailyPitchReviews(pitchId) {
    try {
      const user = (typeof getStoredUser === "function") ? getStoredUser() : null;
      if (!user || String(user.accountType||"").toLowerCase() !== "investor") return true; // not an investor
      const count = await getTodaysReviewCount(user.id);
      if (count >= DAILY_LIMIT) {
        showToast(`Daily limit reached. You can view ${DAILY_LIMIT} full pitches per day.`);
        return false;
      }
      await recordPitchReview(user.id, pitchId);
      return true;
    } catch (e) {
      console.error("Pitch limit check failed:", e);
      // Fail-open so you don’t block legit users due to transient network issues
      return true;
    }
  }

  function getPitchIdFromHref(href){
    try {
      const u = new URL(href, location.origin);
      if (!/pitch-details\.html$/i.test(u.pathname)) return null;
      return u.searchParams.get("id");
    } catch { return null; }
  }

  // Intercept UI clicks
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".view-pitch-btn");
    const link = e.target.closest("a[href]");
    let targetHref = null, pid = null;

    if (btn && btn.dataset.pitchId) {
      pid = btn.dataset.pitchId;
      targetHref = `pitch-details.html?id=${pid}`;
    } else if (link) {
      targetHref = link.getAttribute("href");
      pid = getPitchIdFromHref(targetHref);
    }

    if (!targetHref || !pid) return;

    e.preventDefault();
    const ok = await guardDailyPitchReviews(pid);
    if (ok) window.location.href = targetHref;
  }, true);

  // Intercept programmatic redirects
  const _assign = window.location.assign.bind(window.location);
  const _replace = window.location.replace.bind(window.location);

  window.location.assign = async function(href){
    const pid = getPitchIdFromHref(String(href||""));
    if (pid) {
      const ok = await guardDailyPitchReviews(pid);
      if (!ok) return;
    }
    _assign(href);
  };
  window.location.replace = async function(href){
    const pid = getPitchIdFromHref(String(href||""));
    if (pid) {
      const ok = await guardDailyPitchReviews(pid);
      if (!ok) return;
    }
    _replace(href);
  };
})();
// --- Entrepreneur register wiring (non-invasive) ---
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("entrepreneurRegisterForm");
  if (!form) return; // not on this page

  const nameEl = document.getElementById("name");
  const emailEl = document.getElementById("email");
  const passEl  = document.getElementById("password");
  const typeEl  = document.getElementById("accountType"); // hidden = "entrepreneur"

  // Strong password: 8–128 chars, at least one letter, one number, one symbol
  const PW_RULE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.submitter || form.querySelector('button[type="submit"]');

    const name = (nameEl?.value || "").trim();
    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";
    const accountType = (typeEl?.value || "entrepreneur").toLowerCase();

    // Front-end validation (uses your isValidEmail from script.js)
    if (!name || name.length < 2) {
      showToast("Please enter your full name.");
      nameEl?.focus();
      return;
    }
    if (!isValidEmail(email)) {
      showToast("Please enter a valid email address.");
      emailEl?.focus();
      return;
    }
    if (!PW_RULE.test(password)) {
      showToast("Password must be 8–128 chars and include letters, a number, and a symbol.");
      passEl?.focus();
      return;
    }

    // Call your existing signup function (already defined in script.js)
    await withButtonLoading(btn, async () => {
      const user = await signup(email, password, name, accountType);
      // signup() handles redirects; if it returns null, it already showed a toast
      return user;
    });
  });
});
/* ------------------------------------------------------------
   Wire up the "Submit a Pitch" form (idempotent + resilient)
   - Works with #pitchForm or #submitPitchForm
   - Collects title, short/long pitch, industries, goal
   - Supports YouTube URL (ytUrl) and image input (pitchImage|pfImage|entPitchImage)
   - Uses your existing submitPitch(data, files) writer
   ------------------------------------------------------------ */
(function wirePitchFormOnce() {
  if (window._pitchFormWired) return;
  window._pitchFormWired = true;

  const $ = (id) => document.getElementById(id);
  const el = (ids) => ids.map($).find(Boolean);

  // Support both IDs people used in different pages
  const form = $("pitchForm") || $("submitPitchForm");
  if (!form) {
    console.debug("[pitch] form not found (expected #pitchForm or #submitPitchForm).");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Button state helper
    const btn = e.submitter || form.querySelector('button[type="submit"]');
    const setBusy = (on) => {
      if (!btn) return;
      btn.disabled = !!on;
      btn.dataset._orig = btn.dataset._orig || btn.textContent;
      btn.textContent = on ? "Submitting…" : btn.dataset._orig;
    };

    // --- Gather inputs (be tolerant to alternate IDs) ---
    const titleEl = $("pitchTitle") || $("title");
    const shortEl = $("shortPitch") || $("summary");
    const longEl  = $("description") || $("longPitch") || $("pitchDescription");
    const projEl  = $("financialProjections") || $("projections");
    const fundingEl = $("fundingGoal") || $("raiseTarget");

    // Industries: either from checkbox grid (#entIndustry .checkbox-item.selected)
    // or a single <select id="industry">
    let industries = [];
    const industrySelect = $("industry");
    if (industrySelect && industrySelect.value) {
      industries = [industrySelect.value.trim()];
    } else {
      const selected = document.querySelectorAll("#entIndustry .checkbox-item.selected");
      industries = Array.from(selected).map(x => (x.dataset.value || x.textContent || "").trim()).filter(Boolean);
    }

    const data = {
      title: (titleEl?.value || "").trim(),
      shortPitch: (shortEl?.value || "").trim(),
      description: (longEl?.value || "").trim(),
      financialProjections: (projEl?.value || "").trim(),
      industries,                     // store array
      fundingGoal: (fundingEl?.value || "").trim(),
    };

    // Basic validation (friendly + minimal)
    if (!data.title)  { (window.showToast||alert)("Please add a pitch title."); return; }
    if (!data.description) { (window.showToast||alert)("Please add a detailed description."); return; }
    if (!data.shortPitch) data.shortPitch = "—";

    // Optional YouTube parsing
    const ytVal = ( $("ytUrl")?.value || "" ).trim();
    if (ytVal && typeof window.parseYouTube === "function") {
      const parsed = window.parseYouTube(ytVal);
      if (parsed) {
        data.video = {
          provider: "youtube",
          id: parsed.id,
          start: parsed.start || 0,
          url: ytVal
        };
      }
    }

    // Optional image
    const imageIn = el(["pitchImage","pfImage","entPitchImage"]);
    const files = { image: imageIn?.files?.[0] || null };

    try {
      setBusy(true);
      // Prefer your withButtonLoading helper if present
      if (typeof window.withButtonLoading === "function") {
        await withButtonLoading(btn, () => submitPitch(data, files));
      } else {
        await submitPitch(data, files);
      }

      // Success UX
      (window.showToast||alert)("Pitch submitted successfully!");
      form.reset();
      // clear any “selected” tags
      document.querySelectorAll("#entIndustry .checkbox-item.selected")
        .forEach(n => n.classList.remove("selected"));

      // If you have a success page, redirect:
      if (location.pathname.endsWith("submit-pitch.html") || location.pathname.endsWith("entrepreneur-dashboard.html")) {
        try { window.location.href = "pitch-success.html"; } catch {}
      }

      // If a grid is present on the page, refresh it
      if (document.getElementById("pitchGrid") && typeof window.loadPitchesIntoGrid === "function") {
        await window.loadPitchesIntoGrid();
      }
    } catch (err) {
      console.error("[pitch] submit failed:", err);
      (window.showToast||alert)("Could not submit pitch: " + (err?.message || err));
    } finally {
      setBusy(false);
    }
  });
})();