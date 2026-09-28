// ── Firebase Imports ────────────────────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
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


// ── Firebase Config ─────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyByrrAl0TtCdinZkuCqoDjRx97niRQWv5Q",
  authDomain:        "job-earnings-4871a.firebaseapp.com",
  projectId:         "job-earnings-4871a",
  storageBucket:     "job-earnings-4871a.firebasestorage.app",
  messagingSenderId: "459548048021",
  appId:             "1:459548048021:web:7339d69059438cde40399c",
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ── State ───────────────────────────────────────────────────────────────────
let currentUser = null;
let allEarnings = [];
let allClients = [];

let editingId = null;
let activeTab = "all";

let reopenEarningModalAfterClient = false;


// ── DOM References ──────────────────────────────────────────────────────────
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");

const authEmail = document.getElementById("auth-email");
const authPass = document.getElementById("auth-pass");
const authError = document.getElementById("auth-error");
const rememberMe = document.getElementById("remember-me");

const modal = document.getElementById("modal");
const clientModal = document.getElementById("client-modal");

const modalTitle = document.getElementById("modal-title");
const earningsList = document.getElementById("earnings-list");

const filterCompany = document.getElementById("filter-company");
const filterMonth = document.getElementById("filter-month");

const fCompany = document.getElementById("f-company");
const fDate = document.getElementById("f-date");
const fAmount = document.getElementById("f-amount");
const fStatus = document.getElementById("f-status");
const fNotes = document.getElementById("f-notes");

const fClientName = document.getElementById("f-client-name");

const btnSave = document.getElementById("btn-save");
const btnSaveClient = document.getElementById("btn-save-client");


// ── Auth State Listener ─────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {

  currentUser = user;

  if (user) {

    showApp();

    await loadEarnings();
    await loadClients();

  } else {

    allEarnings = [];
    allClients = [];

    showAuth();

  }

});


// ── Authentication ──────────────────────────────────────────────────────────
document
  .getElementById("btn-login")
  .addEventListener("click", handleLogin);

document
  .getElementById("btn-register")
  .addEventListener("click", handleRegister);

document
  .getElementById("btn-logout")
  .addEventListener("click", handleLogout);


authPass.addEventListener("keydown", (e) => {

  if (e.key === "Enter") {
    handleLogin();
  }

});


async function setChosenPersistence() {

  const persistence = rememberMe.checked
    ? browserLocalPersistence
    : browserSessionPersistence;

  await setPersistence(auth, persistence);

}


async function handleLogin() {

  setAuthError("");

  try {

    await setChosenPersistence();

    await signInWithEmailAndPassword(
      auth,
      authEmail.value.trim(),
      authPass.value
    );

  } catch (e) {

    setAuthError(friendlyError(e.code));

  }

}


async function handleRegister() {

  setAuthError("");

  try {

    await setChosenPersistence();

    await createUserWithEmailAndPassword(
      auth,
      authEmail.value.trim(),
      authPass.value
    );

  } catch (e) {

    setAuthError(friendlyError(e.code));

  }

}


async function handleLogout() {

  await signOut(auth);

}


// ── Load Earnings ───────────────────────────────────────────────────────────
async function loadEarnings() {

  if (!currentUser) return;

  try {

    const q = query(
      collection(db, "earnings"),
      where("uid", "==", currentUser.uid),
      orderBy("date", "desc")
    );

    const snap = await getDocs(q);

    allEarnings = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    render();

  } catch (e) {

    console.error("Error loading earnings:", e);

    earningsList.innerHTML = `
      <div class="empty-state">
        Could not load earnings. Please refresh and try again.
      </div>
    `;

  }

}


// ── Load Clients ────────────────────────────────────────────────────────────
async function loadClients() {

  if (!currentUser) return;

  try {

    const q = query(
      collection(db, "clients"),
      where("uid", "==", currentUser.uid)
    );

    const snap = await getDocs(q);

    allClients = snap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    // Add existing company names from your old earnings to the dropdown.
    // This does NOT modify or delete any old earning.
    mergeExistingEarningCompanies();

    sortClients();
    populateClientDropdowns();

  } catch (e) {

    console.error("Error loading clients:", e);

    // Even if the clients collection fails,
    // your old earnings can still populate the dropdown.
    allClients = [];

    mergeExistingEarningCompanies();
    sortClients();
    populateClientDropdowns();

  }

}


// ── Existing Companies Compatibility ────────────────────────────────────────
function mergeExistingEarningCompanies() {

  const existingNames = new Set(
    allClients.map((client) =>
      client.name.toLowerCase()
    )
  );


  allEarnings.forEach((earning) => {

    const name = String(earning.company || "").trim();

    if (!name) return;


    if (!existingNames.has(name.toLowerCase())) {

      allClients.push({
        id: null,
        name,
        uid: currentUser.uid,
        legacy: true
      });

      existingNames.add(name.toLowerCase());

    }

  });

}


function sortClients() {

  allClients.sort((a, b) =>
    a.name.localeCompare(b.name)
  );

}


function populateClientDropdowns() {

  const currentFormValue = fCompany.value;
  const currentFilterValue = filterCompany.value;


  fCompany.innerHTML = `
    <option value="">Select a client</option>
  `;

  filterCompany.innerHTML = `
    <option value="">All clients</option>
  `;


  allClients.forEach((client) => {

    const option = document.createElement("option");

    option.value = client.name;
    option.textContent = client.name;

    fCompany.appendChild(option);


    const filterOption = document.createElement("option");

    filterOption.value = client.name;
    filterOption.textContent = client.name;

    filterCompany.appendChild(filterOption);

  });


  if (
    [...fCompany.options].some(
      (option) => option.value === currentFormValue
    )
  ) {
    fCompany.value = currentFormValue;
  }


  if (
    [...filterCompany.options].some(
      (option) => option.value === currentFilterValue
    )
  ) {
    filterCompany.value = currentFilterValue;
  }

}


// ── Client Modal ─────────────────────────────────────────────────────────────
document
  .getElementById("btn-open-client")
  .addEventListener("click", () => {
    reopenEarningModalAfterClient = false;
    openClientModal();
  });


document
  .getElementById("btn-add-client-from-earning")
  .addEventListener("click", () => {

    reopenEarningModalAfterClient = true;

    modal.classList.remove("show");

    openClientModal();

  });


document
  .getElementById("btn-close-client")
  .addEventListener("click", closeClientModal);

document
  .getElementById("btn-cancel-client")
  .addEventListener("click", closeClientModal);

btnSaveClient.addEventListener("click", saveClient);


clientModal.addEventListener("click", (e) => {

  if (e.target === clientModal) {
    closeClientModal();
  }

});


fClientName.addEventListener("keydown", (e) => {

  if (e.key === "Enter") {
    saveClient();
  }

});


function openClientModal() {

  fClientName.value = "";

  clientModal.classList.add("show");

  setTimeout(() => {
    fClientName.focus();
  }, 50);

}


function closeClientModal() {

  clientModal.classList.remove("show");

  fClientName.value = "";


  if (reopenEarningModalAfterClient) {

    reopenEarningModalAfterClient = false;

    modal.classList.add("show");

  }

}


async function saveClient() {

  const name = fClientName.value.trim();


  if (!name) {

    alert("Enter a client or company name.");

    return;

  }


  const duplicate = allClients.some(
    (client) =>
      client.name.toLowerCase() === name.toLowerCase()
  );


  if (duplicate) {

    alert("That client already exists.");

    return;

  }


  btnSaveClient.disabled = true;
  btnSaveClient.textContent = "Adding…";


  try {

    const data = {
      uid: currentUser.uid,
      name
    };


    const docRef = await addDoc(
      collection(db, "clients"),
      data
    );


    allClients.push({
      id: docRef.id,
      ...data
    });


    sortClients();
    populateClientDropdowns();


    // Automatically select newly created client.
    fCompany.value = name;


    clientModal.classList.remove("show");
    fClientName.value = "";


    if (reopenEarningModalAfterClient) {

      reopenEarningModalAfterClient = false;

      modal.classList.add("show");

    }


  } catch (e) {

    alert("Error adding client: " + e.message);

  } finally {

    btnSaveClient.disabled = false;
    btnSaveClient.textContent = "Add Client";

  }

}


// ── Earning Modal ───────────────────────────────────────────────────────────
document
  .getElementById("btn-open-add")
  .addEventListener("click", openAddModal);

document
  .getElementById("btn-close-modal")
  .addEventListener("click", closeModal);

document
  .getElementById("btn-cancel-modal")
  .addEventListener("click", closeModal);

btnSave.addEventListener("click", saveEarning);


modal.addEventListener("click", (e) => {

  if (e.target === modal) {
    closeModal();
  }

});


function openAddModal() {

  editingId = null;

  clearForm();

  modalTitle.textContent = "Add Earning";

  modal.classList.add("show");

}


function closeModal() {

  modal.classList.remove("show");

  editingId = null;

  clearForm();

}


function clearForm() {

  fCompany.value = "";
  fDate.value = "";
  fAmount.value = "";
  fStatus.value = "paid";
  fNotes.value = "";

}


// ── Save Earning ────────────────────────────────────────────────────────────
async function saveEarning() {

  const data = {

    uid: currentUser.uid,

    company: fCompany.value,

    date: fDate.value,

    amount: parseFloat(fAmount.value) || 0,

    status: fStatus.value,

    notes: fNotes.value.trim()

  };


  if (
    !data.company ||
    !data.date ||
    data.amount <= 0
  ) {

    alert("Client, date, and amount are required.");

    return;

  }


  setSaveLoading(true);


  try {

    if (editingId) {

      await updateDoc(
        doc(db, "earnings", editingId),
        data
      );

    } else {

      await addDoc(
        collection(db, "earnings"),
        data
      );

    }


    closeModal();

    await loadEarnings();

    // Ensures old/new client names stay available.
    await loadClients();


  } catch (e) {

    alert("Error saving: " + e.message);

  } finally {

    setSaveLoading(false);

  }

}


// ── Edit & Delete ───────────────────────────────────────────────────────────
function editEarning(id) {

  editingId = id;

  const entry = allEarnings.find(
    (x) => x.id === id
  );


  if (!entry) return;


  // Compatibility in case an old earning has a company
  // that isn't currently in the dropdown.
  const optionExists = [...fCompany.options].some(
    (option) => option.value === entry.company
  );


  if (!optionExists && entry.company) {

    const option = document.createElement("option");

    option.value = entry.company;
    option.textContent = entry.company;

    fCompany.appendChild(option);

  }


  fCompany.value = entry.company;
  fDate.value = entry.date;
  fAmount.value = entry.amount;
  fStatus.value = entry.status;
  fNotes.value = entry.notes || "";


  modalTitle.textContent = "Edit Earning";

  modal.classList.add("show");

}


async function deleteEarning(id) {

  if (!confirm("Delete this earning?")) {
    return;
  }


  try {

    await deleteDoc(
      doc(db, "earnings", id)
    );

    await loadEarnings();

  } catch (e) {

    alert("Error deleting earning: " + e.message);

  }

}


// ── Tabs ────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) => {

  btn.addEventListener("click", () => {

    activeTab = btn.dataset.tab;


    document.querySelectorAll(".tab-btn").forEach((b) => {

      b.classList.toggle(
        "active",
        b.dataset.tab === activeTab
      );

    });


    render();

  });

});


// ── Filters ─────────────────────────────────────────────────────────────────
filterCompany.addEventListener("change", render);
filterMonth.addEventListener("input", render);


document
  .getElementById("btn-clear-filter")
  .addEventListener("click", () => {

    filterCompany.value = "";
    filterMonth.value = "";

    render();

  });


// ── Render ──────────────────────────────────────────────────────────────────
function render() {

  let data = [...allEarnings];


  if (filterCompany.value) {

    data = data.filter(
      (e) => e.company === filterCompany.value
    );

  }


  if (filterMonth.value) {

    data = data.filter(
      (e) => e.date.startsWith(filterMonth.value)
    );

  }


  updateSummaryBar(data);


  if (activeTab === "all") {

    renderAll(data);

  } else if (activeTab === "company") {

    renderByCompany(data);

  } else {

    renderByMonth(data);

  }

}


// ── Summary ─────────────────────────────────────────────────────────────────
function updateSummaryBar(data) {

  const total = data.reduce(
    (sum, entry) => sum + Number(entry.amount || 0),
    0
  );


  const paid = data
    .filter((entry) => entry.status === "paid")
    .reduce(
      (sum, entry) => sum + Number(entry.amount || 0),
      0
    );


  const pending = data
    .filter((entry) => entry.status === "pending")
    .reduce(
      (sum, entry) => sum + Number(entry.amount || 0),
      0
    );


  document.getElementById("sum-total").textContent = fmt(total);
  document.getElementById("sum-paid").textContent = fmt(paid);
  document.getElementById("sum-pend").textContent = fmt(pending);
  document.getElementById("sum-count").textContent = data.length;

}


// ── All View ────────────────────────────────────────────────────────────────
function renderAll(data) {

  earningsList.innerHTML = "";


  if (!data.length) {

    emptyState();

    return;

  }


  const sorted = [...data].sort(
    (a, b) => b.date.localeCompare(a.date)
  );


  const groups = {};


  sorted.forEach((entry) => {

    const month = entry.date.slice(0, 7);

    if (!groups[month]) {
      groups[month] = [];
    }

    groups[month].push(entry);

  });


  Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([month, items]) => {

      const total = items.reduce(
        (sum, entry) => sum + Number(entry.amount || 0),
        0
      );


      const label = formatMonth(month);


      earningsList.appendChild(
        makeGroup(
          label,
          `${items.length} ${items.length === 1 ? "entry" : "entries"} · ${fmt(total)} total`,
          items
        )
      );

    });

}


// ── By Client ───────────────────────────────────────────────────────────────
function renderByCompany(data) {

  const groups = {};


  data.forEach((entry) => {

    if (!groups[entry.company]) {
      groups[entry.company] = [];
    }

    groups[entry.company].push(entry);

  });


  earningsList.innerHTML = "";


  if (!Object.keys(groups).length) {

    emptyState();

    return;

  }


  Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([company, items]) => {

      const total = items.reduce(
        (sum, entry) => sum + Number(entry.amount || 0),
        0
      );


      const paid = items
        .filter((entry) => entry.status === "paid")
        .reduce(
          (sum, entry) => sum + Number(entry.amount || 0),
          0
        );


      const pending = items
        .filter((entry) => entry.status === "pending")
        .reduce(
          (sum, entry) => sum + Number(entry.amount || 0),
          0
        );


      let subtitle =
        `${items.length} ${items.length === 1 ? "entry" : "entries"} · ${fmt(total)} total`;


      if (pending > 0) {

        subtitle += ` · ${fmt(pending)} pending`;

      } else if (paid > 0) {

        subtitle += ` · all paid`;

      }


      earningsList.appendChild(
        makeGroup(
          company,
          subtitle,
          items
        )
      );

    });

}


// ── By Month ────────────────────────────────────────────────────────────────
function renderByMonth(data) {

  const groups = {};


  data.forEach((entry) => {

    const key = entry.date.slice(0, 7);

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(entry);

  });


  earningsList.innerHTML = "";


  if (!Object.keys(groups).length) {

    emptyState();

    return;

  }


  Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([month, items]) => {

      const total = items.reduce(
        (sum, entry) => sum + Number(entry.amount || 0),
        0
      );


      earningsList.appendChild(
        makeGroup(
          formatMonth(month),
          `${items.length} ${items.length === 1 ? "entry" : "entries"} · ${fmt(total)} total`,
          items
        )
      );

    });

}


// ── Build Group ─────────────────────────────────────────────────────────────
function makeGroup(title, subtitle, items) {

  const section = document.createElement("div");

  section.className = "group-section";


  const header = document.createElement("div");

  header.className = "group-header";


  const headerText = document.createElement("div");

  headerText.className = "group-header-text";


  const titleElement = document.createElement("span");

  titleElement.className = "group-title";
  titleElement.textContent = title;


  const subtitleElement = document.createElement("span");

  subtitleElement.className = "group-sub";
  subtitleElement.textContent = subtitle;


  headerText.appendChild(titleElement);
  headerText.appendChild(subtitleElement);

  header.appendChild(headerText);

  section.appendChild(header);


  [...items]
    .sort(
      (a, b) => b.date.localeCompare(a.date)
    )
    .forEach((entry) => {

      section.appendChild(
        makeEntryRow(entry)
      );

    });


  return section;

}


// ── Entry Row ───────────────────────────────────────────────────────────────
function makeEntryRow(entry) {

  const row = document.createElement("div");

  row.className = "entry-row";


  const left = document.createElement("div");

  left.className = "entry-left";


  const company = document.createElement("span");

  company.className = "entry-company";
  company.textContent = entry.company;


  const date = document.createElement("span");

  date.className = "entry-date";
  date.textContent = formatDate(entry.date);


  left.appendChild(company);
  left.appendChild(date);


  if (entry.notes) {

    const notes = document.createElement("span");

    notes.className = "entry-notes";
    notes.textContent = entry.notes;

    left.appendChild(notes);

  }


  const right = document.createElement("div");

  right.className = "entry-right";


  const amount = document.createElement("span");

  amount.className = "entry-amount";
  amount.textContent = fmt(entry.amount);


  const badge = document.createElement("span");

  badge.className = `badge ${entry.status}`;
  badge.textContent = entry.status;


  const actions = document.createElement("div");

  actions.className = "entry-actions";


  const editButton = document.createElement("button");

  editButton.className = "btn-icon";
  editButton.type = "button";
  editButton.title = "Edit";
  editButton.setAttribute("aria-label", "Edit earning");
  editButton.textContent = "✏️";

  editButton.addEventListener("click", () => {
    editEarning(entry.id);
  });


  const deleteButton = document.createElement("button");

  deleteButton.className = "btn-icon";
  deleteButton.type = "button";
  deleteButton.title = "Delete";
  deleteButton.setAttribute("aria-label", "Delete earning");
  deleteButton.textContent = "🗑️";

  deleteButton.addEventListener("click", () => {
    deleteEarning(entry.id);
  });


  actions.appendChild(editButton);
  actions.appendChild(deleteButton);


  right.appendChild(amount);
  right.appendChild(badge);
  right.appendChild(actions);


  row.appendChild(left);
  row.appendChild(right);


  return row;

}


// ── Empty State ─────────────────────────────────────────────────────────────
function emptyState() {

  earningsList.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">₱</div>
      <div class="empty-title">No earnings found</div>
      <div class="empty-text">
        Add an earning or change your filters.
      </div>
    </div>
  `;

}


// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(number) {

  return "₱" + Number(number || 0).toLocaleString(
    "en-PH",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );

}


function formatDate(date) {

  return new Date(
    date + "T00:00:00"
  ).toLocaleDateString(
    "en-PH",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );

}


function formatMonth(month) {

  return new Date(
    month + "-01T00:00:00"
  ).toLocaleDateString(
    "en-PH",
    {
      month: "long",
      year: "numeric"
    }
  );

}


function setAuthError(message) {

  authError.textContent = message;

}


function setSaveLoading(on) {

  btnSave.textContent = on
    ? "Saving…"
    : "Save";

  btnSave.disabled = on;

}


function showApp() {

  authScreen.style.display = "none";
  appScreen.style.display = "block";

}


function showAuth() {

  authScreen.style.display = "flex";
  appScreen.style.display = "none";

}


function friendlyError(code) {

  const map = {

    "auth/user-not-found":
      "No account with that email.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/email-already-in-use":
      "Email already registered.",

    "auth/weak-password":
      "Password must be at least 6 characters.",

    "auth/invalid-email":
      "Invalid email address.",

    "auth/invalid-credential":
      "Incorrect email or password.",

    "auth/missing-password":
      "Enter your password.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later."

  };


  return map[code] ||
    "Something went wrong. Try again.";

}
