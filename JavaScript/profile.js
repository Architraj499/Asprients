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

import { getStorage, ref, uploadBytes, getDownloadURL } 
from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const storage = getStorage();

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
      // "General Aptitude Test"
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
let firestoreSubjectProgress = {};

function getSubjectProgress(course, subject) {
  if (
    firestoreSubjectProgress?.[course] &&
    firestoreSubjectProgress[course]?.[subject] !== undefined
  ) {
    return firestoreSubjectProgress[course][subject];
  }

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
  const boards = getCourseProgress("Boards");
  const cuet = getCourseProgress("CUET");
  const ca = getCourseProgress("CA Foundation");

  const boardsBar = document.getElementById("boardsBar");
  const cuetBar = document.getElementById("cuetBar");
  const caBar = document.getElementById("caBar");

  const boardsPercent = document.getElementById("boardsPercent");
  const cuetPercent = document.getElementById("cuetPercent");
  const caPercent = document.getElementById("caPercent");

  if (boardsBar) boardsBar.style.width = boards + "%";
  if (cuetBar) cuetBar.style.width = cuet + "%";
  if (caBar) caBar.style.width = ca + "%";

  if (boardsPercent) boardsPercent.innerText = boards + "%";
  if (cuetPercent) cuetPercent.innerText = cuet + "%";
  if (caPercent) caPercent.innerText = ca + "%";
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
      container.innerHTML = `<div class="activity-item">No activity yet.</div>`;
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
        d.type === "mock_generate" ? "🧠" :
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
    container.innerHTML = `<div class="activity-item">Failed to load activity.</div>`;
  }
}

/* =========================================================
   🔥 AVATAR (FIXED)
========================================================= */
function setupAvatarUpload(userId) {
  const avatarBox = document.getElementById("avatarBox");
  const avatarInput = document.getElementById("avatarInput");
  const avatarImg = document.getElementById("avatarImg");

  if (!avatarBox || !avatarInput || !avatarImg) return;

  avatarBox.onclick = () => {
    avatarInput.click();
  };

  avatarInput.onchange = async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Select a valid image");
      return;
    }

    if (file.size > 1024 * 1024) {
      alert("Max 1MB allowed");
      return;
    }

    try {
      const storageRef = ref(storage, `profilePics/${userId}`);

      await uploadBytes(storageRef, file);

      const url = await getDownloadURL(storageRef);

      await updateDoc(doc(db, "users", userId), {
        profilePic: url
      });

      avatarImg.src = url;

    } catch (err) {
      console.error("Avatar upload error:", err);
      alert("Upload failed");
    }
  };
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

    if (d.subjectProgress) {
      firestoreSubjectProgress = d.subjectProgress;
    }

    // 🔥 avatar load
    const avatarImg = document.getElementById("avatarImg");
    if (d.profilePic && avatarImg) {
      avatarImg.src = d.profilePic;
    }

    /* ---------- USER INFO ---------- */
    document.getElementById("profileName").innerText = d.fullname || "Student";
    document.getElementById("profileEmail").innerText = user.email || "—";
    document.getElementById("siteTime").innerText = formatTime(d.totalSiteSeconds);
    document.getElementById("lectureTime").innerText = formatTime(d.totalLectureSeconds);
    document.getElementById("nameInput").value = d.fullname || "";
    document.getElementById("usernameDisplay").innerText = d.fullname || "User";

    /* ---------- STREAK ---------- */
    const today = todayStr();
    let streak = d.streakCount || 0;
    let last = d.lastActiveDate;

    if (!last) streak = 1;
    else {
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

    document.getElementById("streakCount").innerText = streak;

    renderSubjects("Boards", getSubjectsByCourse("Boards"), "boardsSubjects");
    renderSubjects("CUET", getSubjectsByCourse("CUET"), "cuetSubjects");
    renderSubjects("CA Foundation", getSubjectsByCourse("CA Foundation"), "caSubjects");

    renderCourseBars();
    await loadActivity();

    setupAvatarUpload(user.uid);
    setupProfileUpdate();

  } catch (error) {
    console.error("Error loading profile:", error);
    alert("Failed to load profile.");
  }
});