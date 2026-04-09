// profile.js

import { auth, db } from "./universal.js";

import { onAuthStateChanged } from
"https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* =========================================================
   GLOBALS
========================================================= */
let currentUserId = null;

/* =========================================================
   TIME FORMAT
========================================================= */
function formatTime(sec = 0) {
  sec = Number(sec) || 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${h}h ${m}m ${s}s`;
}

/* =========================================================
   DATE HELPERS
========================================================= */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function dayDiff(d1, d2) {
  const a = new Date(d1);
  const b = new Date(d2);
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

/* =========================================================
   SUBJECT LISTS
========================================================= */
function getSubjectsByCourse(course) {
  if (course === "Boards") {
    return [
      "Accountancy",
      "Business Studies",
      "Economics",
      "English",
      "Hindi",
      "Entrepreneurship"
    ];
  }

  if (course === "CUET") {
    return [
      "Accountancy",
      "Business Studies",
      "Economics",
      "English",
      "General Aptitude Test"
    ];
  }

  if (course === "CA Foundation") {
    return [
      "Accounting",
      "Business Economics",
      "Quantative Aptitude",
      "Business Law"
    ];
  }

  return [];
}

/* =========================================================
   COURSE PROGRESS
========================================================= */
function getSubjectProgress(course, subject) {
  const key = `progress_${course}_${subject}`;
  const value = localStorage.getItem(key);
  return value ? Number(value) : 0;
}

function getCourseProgress(course) {
  const subjects = getSubjectsByCourse(course);
  if (!subjects.length) return 0;

  let totalPercent = 0;

  subjects.forEach(sub => {
    totalPercent += getSubjectProgress(course, sub);
  });

  return Math.round(totalPercent / subjects.length);
}

/* =========================================================
   RENDER SUBJECTS
========================================================= */
function renderSubjects(course, subjects, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  subjects.forEach(sub => {
    const percent = getSubjectProgress(course, sub);

    const row = document.createElement("div");
    row.className = "subject-row";

    row.innerHTML = `
      <div class="subject-name">${sub}</div>
      <div class="subject-bar">
        <i style="width:${percent}%"></i>
      </div>
      <div class="subject-percent">${percent}%</div>
    `;

    container.appendChild(row);
  });
}

/* =========================================================
   COURSE BARS
========================================================= */
function renderCourseBars() {
  const boardsBar = document.getElementById("boardsBar");
  const cuetBar = document.getElementById("cuetBar");
  const caBar = document.getElementById("caBar");

  if (boardsBar) boardsBar.style.width = getCourseProgress("Boards") + "%";
  if (cuetBar) cuetBar.style.width = getCourseProgress("CUET") + "%";
  if (caBar) caBar.style.width = getCourseProgress("CA Foundation") + "%";
}

/* =========================================================
   ACTIVITY HISTORY
========================================================= */
async function loadActivity() {
  if (!currentUserId) return;

  const container = document.getElementById("activityList");
  if (!container) return;

  container.innerHTML = `<div class="activity-item">Loading activity...</div>`;

  try {
    const q = query(
      collection(db, "users", currentUserId, "activity"),
      orderBy("time", "desc")
    );

    const snap = await getDocs(q);

    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = `
        <div class="activity-item">No activity yet.</div>
      `;
      return;
    }

    snap.forEach(docSnap => {
      const d = docSnap.data();

      const div = document.createElement("div");
      div.className = "activity-item";

      const time = d.time?.toDate
        ? d.time.toDate().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          })
        : "";

      const icon =
        d.type === "lecture" ? "📺" :
        d.type === "mock" ? "🧠" :
        d.type === "note" ? "📝" :
        "📌";

      div.innerHTML = `
        <strong>${icon} ${d.type ? d.type.charAt(0).toUpperCase() + d.type.slice(1) : "Activity"}</strong><br>
        <span>${d.title || "Untitled Activity"}</span><br>
        <small>${d.date || ""} ${time ? "• " + time : ""}</small>
      `;

      container.appendChild(div);
    });

  } catch (error) {
    console.error("Error loading activity:", error);
    container.innerHTML = `
      <div class="activity-item">Failed to load activity.</div>
    `;
  }
}

/* =========================================================
   AVATAR (LOCAL PREVIEW)
========================================================= */
function setupAvatarUpload() {
  const avatarBox = document.getElementById("avatarBox");
  const avatarInput = document.getElementById("avatarInput");
  const avatarImg = document.getElementById("avatarImg");

  if (!avatarBox || !avatarInput || !avatarImg) return;

  const savedAvatar = localStorage.getItem("profileAvatar");
  if (savedAvatar) {
    avatarImg.src = savedAvatar;
  }

  avatarBox.addEventListener("click", () => {
    avatarInput.click();
  });

  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose a valid image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const imageData = e.target.result;
      avatarImg.src = imageData;
      localStorage.setItem("profileAvatar", imageData);
    };
    reader.readAsDataURL(file);
  });
}

/* =========================================================
   PROFILE UPDATE
========================================================= */
function setupProfileUpdate() {
  const saveBtn = document.getElementById("saveNameBtn");
  const nameInput = document.getElementById("nameInput");
  const profileName = document.getElementById("profileName");

  if (!saveBtn || !nameInput || !profileName) return;

  saveBtn.onclick = async () => {
    const name = nameInput.value.trim();

    if (name.length < 2) {
      alert("Name too short");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
      await updateDoc(doc(db, "users", user.uid), {
        fullname: name
      });

      profileName.innerText = name;
      localStorage.setItem("fullname", name);

      const usernameDisplay = document.getElementById("usernameDisplay");
      if (usernameDisplay) usernameDisplay.innerText = name;

      alert("Profile updated successfully");
    } catch (error) {
      console.error("Profile update failed:", error);
      alert("Failed to update profile");
    }
  };
}

/* =========================================================
   MAIN AUTH LOAD
========================================================= */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  currentUserId = user.uid;

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) return;

    const d = snap.data();

    /* ---------- USER INFO ---------- */
    const profileName = document.getElementById("profileName");
    const profileEmail = document.getElementById("profileEmail");
    const siteTime = document.getElementById("siteTime");
    const lectureTime = document.getElementById("lectureTime");
    const nameInput = document.getElementById("nameInput");
    const usernameDisplay = document.getElementById("usernameDisplay");

    if (profileName) profileName.innerText = d.fullname || "Student";
    if (profileEmail) profileEmail.innerText = user.email || "—";
    if (siteTime) siteTime.innerText = formatTime(d.totalSiteSeconds);
    if (lectureTime) lectureTime.innerText = formatTime(d.totalLectureSeconds);
    if (nameInput) nameInput.value = d.fullname || "";
    if (usernameDisplay) usernameDisplay.innerText = d.fullname || "User";

    /* ---------- STREAK ---------- */
    const today = todayStr();
    let streak = d.streakCount || 0;
    let last = d.lastActiveDate;

    if (!last) {
      streak = 1;
    } else {
      const diff = dayDiff(today, last);

      if (diff === 1) streak += 1;
      else if (diff > 1) streak = 1;
    }

    if (last !== today) {
      await updateDoc(userRef, {
        streakCount: streak,
        lastActiveDate: today
      });
    }

    const streakCount = document.getElementById("streakCount");
    if (streakCount) streakCount.innerText = streak;

    /* ---------- SUBJECT BARS ---------- */
    renderSubjects(
      "Boards",
      getSubjectsByCourse("Boards"),
      "boardsSubjects"
    );

    renderSubjects(
      "CUET",
      getSubjectsByCourse("CUET"),
      "cuetSubjects"
    );

    renderSubjects(
      "CA Foundation",
      getSubjectsByCourse("CA Foundation"),
      "caSubjects"
    );

    /* ---------- COURSE BARS ---------- */
    renderCourseBars();

    /* ---------- ACTIVITY ---------- */
    await loadActivity();

    /* ---------- AVATAR ---------- */
    setupAvatarUpload();

    /* ---------- PROFILE UPDATE ---------- */
    setupProfileUpdate();

  } catch (error) {
    console.error("Error loading profile:", error);
    alert("Failed to load profile.");
  }
});