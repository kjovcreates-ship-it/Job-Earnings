// ── Firebase Imports ────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── 🔧 PASTE YOUR FIREBASE CONFIG HERE ──────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyByrrAl0TtCdinZkuCqoDjRx97niRQWv5Q",
  authDomain:        "job-earnings-4871a.firebaseapp.com",
  projectId:         "job-earnings-4871a",
  storageBucket:     "job-earnings-4871a.firebasestorage.app",
  messagingSenderId: "459548048021",
  appId:             "1:459548048021:web:7339d69059438cde40399c",
};
// ────────────────────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State ────────────────────────────────────────────────────────────────────
let currentUser = null;
let allEarnings = [];
let editingId   = null;
let activeTab   = "company";

// ── DOM References ───────────────────────────────────────────────────────────
const authScreen     = document.getElementById("auth-screen");
const appScreen      = document.getElementById("app-screen");
const authEmail      = document.getElementById("auth-email");
const authPass       = document.getElementById("auth-pass");
const authError      = document.getElementById("auth-error");
const modal          = document.getElementById("modal");
const modalTitle     = document.getElementById("modal-title");
const earningsList   = document.getElementById("earnings-list");
const filterCompany  = document.getElementById("filter-company");
const filterMonth    = document.getElementById("filter-month");

const fCompany = document.getElementById("f-company");
const fDate    = document.getElementById("f-date");
const fAmount  = document.getElementById("f-amount");
const fStatus  = document.getElementById("f-status");
const fNotes   = document.getElementById("f-notes");
const btnSave  = document.getElementById("btn-save");

// ── Auth State Listener ──────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    showApp();
    loadEarnings();
  } else {
    showAuth();
  }
});

// ── Auth Event Listeners ─────────────────────────────────────────────────────
document.getElementById("btn-login").addEventListener("click", handleLogin);
document.getElementById("btn-register").addEventListener("click", handleRegister);
document.getElementById("btn-logout").addEventListener("click", handleLogout);

authPass.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});

async function handleLogin() {
  setAuthError("");
  try {
    await signInWithEmailAndPassword(auth, authEmail.value, authPass.value);
  } catch (e) {
    setAuthError(friendlyError(e.code));
  }
}

async function handleRegister() {
  setAuthError("");
  try {
    await createUserWithEmailAndPassword(auth, authEmail.value, authPass.value);
  } catch (e) {
    setAuthError(friendlyError(e.code));
  }
}

async function handleLogout() {
  await signOut(auth);
}

// ── Load Earnings ────────────────────────────────────────────────────────────
async function loadEarnings() {
  const q = query(
    collection(db, "earnings"),
    where("uid", "==", currentUser.uid),
    orderBy("date", "desc")
  );
  const snap = await getDocs(q);
  allEarnings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  render();
}

// ── Modal Controls ───────────────────────────────────────────────────────────
document.getElementById("btn-open-add").addEventListener("click", openAddModal);
document.getElementById("btn-close-modal").addEventListener("click", closeModal);
document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
btnSave.addEventListener("click", saveEarning);

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

function openAddModal() {
  editingId = null;
  clearForm();
  modalTitle.textContent = "Add Earning";
  modal.classList.add("show");
}

function closeModal() {
  modal.classList.remove("show");
  clearForm();
}

function clearForm() {
  fCompany.value = "";
  fDate.value    = "";
  fAmount.value  = "";
  fStatus.value  = "paid";
  fNotes.value   = "";
}

// ── Save Earning ─────────────────────────────────────────────────────────────
async function saveEarning() {
  const data = {
    uid:     currentUser.uid,
    company: fCompany.value.trim(),
    date:    fDate.value,
    amount:  parseFloat(fAmount.value) || 0,
    status:  fStatus.value,
    notes:   fNotes.value.trim(),
  };

  if (!data.company || !data.date || !data.amount) {
    alert("Company, date, and amount are required.");
    return;
  }

  setSaveLoading(true);
  try {
    if (editingId) {
      await updateDoc(doc(db, "earnings", editingId), data);
    } else {
      await addDoc(collection(db, "earnings"), data);
    }
    closeModal();
    await loadEarnings();
  } catch (e) {
    alert("Error saving: " + e.message);
  }
  setSaveLoading(false);
}

// ── Edit & Delete ────────────────────────────────────────────────────────────
function editEarning(id) {
  editingId = id;
  const entry = allEarnings.find((x) => x.id === id);
  if (!entry) return;

  fCompany.value = entry.company;
  fDate.value    = entry.date;
  fAmount.value  = entry.amount;
  fStatus.value  = entry.status;
  fNotes.value   = entry.notes || "";

  modalTitle.textContent = "Edit Earning";
  modal.classList.add("show");
}

async function deleteEarning(id) {
  if (!confirm("Delete this earning?")) return;
  await deleteDoc(doc(db, "earnings", id));
  await loadEarnings();
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === activeTab)
    );
    render();
  });
});

// ── Filters ──────────────────────────────────────────────────────────────────
filterCompany.addEventListener("input", render);
filterMonth.addEventListener("input", render);

document.getElementById("btn-clear-filter").addEventListener("click", () => {
  filterCompany.value = "";
  filterMonth.value   = "";
  render();
});

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  let data = [...allEarnings];

  if (filterCompany.value) {
    data = data.filter((e) =>
      e.company.toLowerCase().includes(filterCompany.value.toLowerCase())
    );
  }
  if (filterMonth.value) {
    data = data.filter((e) => e.date.startsWith(filterMonth.value));
  }

  updateSummaryBar(data);

  if (activeTab === "company") renderByCompany(data);
  else renderByMonth(data);
}

function updateSummaryBar(data) {
  const total = data.reduce((s, e) => s + (e.amount || 0), 0);
  const paid  = data.filter((e) => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const pend  = data.filter((e) => e.status === "pending").reduce((s, e) => s + e.amount, 0);

  document.getElementById("sum-total").textContent = fmt(total);
  document.getElementById("sum-paid").textContent  = fmt(paid);
  document.getElementById("sum-pend").textContent  = fmt(pend);
  document.getElementById("sum-count").textContent = data.length;
}

function renderByCompany(data) {
  const groups = {};
  data.forEach((e) => {
    if (!groups[e.company]) groups[e.company] = [];
    groups[e.company].push(e);
  });

  earningsList.innerHTML = "";
  if (!Object.keys(groups).length) { emptyState(); return; }

  Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([company, items]) => {
      const total = items.reduce((s, e) => s + e.amount, 0);
      const sub   = `${items.length} entr${items.length === 1 ? "y" : "ies"} · ${fmt(total)} total`;
      earningsList.appendChild(makeGroup(company, sub, items));
    });
}

function renderByMonth(data) {
  const groups = {};
  data.forEach((e) => {
    const key = e.date.slice(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  earningsList.innerHTML = "";
  if (!Object.keys(groups).length) { emptyState(); return; }

  Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([month, items]) => {
      const total = items.reduce((s, e) => s + e.amount, 0);
      const label = new Date(month + "-01").toLocaleDateString("en-PH", {
        month: "long",
        year: "numeric",
      });
      const sub = `${items.length} entr${items.length === 1 ? "y" : "ies"} · ${fmt(total)} total`;
      earningsList.appendChild(makeGroup(label, sub, items));
    });
}

// ── Build Group DOM ──────────────────────────────────────────────────────────
function makeGroup(title, subtitle, items) {
  const section = document.createElement("div");
  section.className = "group-section";

  const header = document.createElement("div");
  header.className = "group-header";
  header.innerHTML = `
    <span class="group-title">${esc(title)}</span>
    <span class="group-sub">${subtitle}</span>
  `;
  section.appendChild(header);

  items
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((e) => {
      const row = document.createElement("div");
      row.className = "entry-row";
      row.innerHTML = `
        <div class="entry-left">
          <span class="entry-company">${esc(e.company)}</span>
          <span class="entry-date">${formatDate(e.date)}</span>
          ${e.notes ? `<span class="entry-notes">${esc(e.notes)}</span>` : ""}
        </div>
        <div class="entry-right">
          <span class="entry-amount">${fmt(e.amount)}</span>
          <span class="badge ${e.status}">${e.status}</span>
          <div class="entry-actions">
            <button class="btn-icon" title="Edit">✏️</button>
            <button class="btn-icon" title="Delete">🗑️</button>
          </div>
        </div>
      `;

      row.querySelector("[title='Edit']").addEventListener("click", () => editEarning(e.id));
      row.querySelector("[title='Delete']").addEventListener("click", () => deleteEarning(e.id));

      section.appendChild(row);
    });

  return section;
}

function emptyState() {
  earningsList.innerHTML = `<div class="empty-state">No earnings found. Add your first one!</div>`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) {
  return "₱" + Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function setAuthError(msg) {
  authError.textContent = msg;
}

function setSaveLoading(on) {
  btnSave.textContent = on ? "Saving…" : "Save";
  btnSave.disabled    = on;
}

function showApp() {
  authScreen.style.display = "none";
  appScreen.style.display  = "block";
}

function showAuth() {
  authScreen.style.display = "flex";
  appScreen.style.display  = "none";
}

function friendlyError(code) {
  const map = {
    "auth/user-not-found":      "No account with that email.",
    "auth/wrong-password":      "Incorrect password.",
    "auth/email-already-in-use":"Email already registered.",
    "auth/weak-password":       "Password must be at least 6 characters.",
    "auth/invalid-email":       "Invalid email address.",
    "auth/invalid-credential":  "Incorrect email or password.",
  };
  return map[code] || "Something went wrong. Try again.";
}
