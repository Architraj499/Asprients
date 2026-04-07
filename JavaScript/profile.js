// profile.js

import { auth, db } from "./universal.js";

import { onAuthStateChanged } from
"https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import { doc, getDoc, updateDoc } from
"https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { collection, getDocs, query, orderBy } 
from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

async function loadActivity() {
  if (!currentUserId) return;

  const q = query(
    collection(db, "users", currentUserId, "activity"),
    orderBy("time", "desc")
  );

  const snap = await getDocs(q);

  const container = document.getElementById("activityList");
  if (!container) return;

  container.innerHTML = "";

  snap.forEach(doc => {
    const d = doc.data();

    const div = document.createElement("div");
    div.style.marginBottom = "10px";

    const time = d.time?.toDate().toLocaleTimeString() || "";

    div.innerHTML = `
      <b>${d.type === "lecture" ? "📺 Lecture" : "🧠 Mock"}</b><br>
      ${d.title}<br>
      <small>${d.date} • ${time}</small>
      <hr>
    `;

    container.appendChild(div);
  });
}
/* ---------- TIME FORMAT ---------- */

function formatTime(sec = 0) {

  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  return `${h}h ${m}m ${s}s`;

}


/* ---------- DATE HELPERS ---------- */

function todayStr() {
  return new Date().toISOString().slice(0,10);
}

function dayDiff(d1,d2){

  const a = new Date(d1);
  const b = new Date(d2);

  return Math.round((a-b)/(1000*60*60*24));

}


/* ---------- COURSE PROGRESS ---------- */
function getCourseProgress(course){

  let subjects = [];

  if(course==="Boards"){
    subjects = [
      "Accountancy",
      "Business Studies",
      "Economics",
      "English",
      "Hindi"
    ];
  }

  if(course==="CUET"){
    subjects = [
      "Accountancy",
      "Business Studies",
      "Economics",
      "English",
      "General Aptitude Test"
    ];
  }

  if(course==="CA Foundation"){
    subjects = [
      "Accounting",
      "Business Economics",
      "Quantative Aptitude",
      "Business Law"
    ];
  }

  let totalPercent = 0;

  subjects.forEach(sub=>{

    const key="progress_"+course+"_"+sub;
    const value=localStorage.getItem(key);

    // ❗ agar value nahi hai → usse 100 maan
    totalPercent += value ? Number(value) : 0;

  });

  // ❗ total subjects se divide hoga (count se nahi)
  return Math.round(totalPercent / subjects.length);

}


/* ---------- SUBJECT PROGRESS ---------- */

function getSubjectProgress(course,subject){

  const key="progress_"+course+"_"+subject;

  const value=localStorage.getItem(key);

  return value ? Number(value) : 0;

}


function renderSubjects(course, subjects, containerId){

  const container = document.getElementById(containerId);

  if(!container) return;

  container.innerHTML = "";

  // ===== COURSE PROGRESS =====
  const coursePercent = getCourseProgress(course);

  const courseRow = document.createElement("div");
  courseRow.className = "course-row";

  courseRow.innerHTML = `
    <div class="course-name">${course}</div>

    <div class="subject-bar">
      <i style="width:${coursePercent}%"></i>
    </div>

    <div class="subject-percent">${coursePercent}%</div>
  `;

  container.appendChild(courseRow);


  // ===== SUBJECT PROGRESS =====
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


/* ---------- AUTH LOAD ---------- */

onAuthStateChanged(auth,async(user)=>{

  if(!user){

    location.href="index.html";
    return;

  }

  const snap=await getDoc(doc(db,"users",user.uid));

  if(!snap.exists()) return;

  const d=snap.data();



  /* ---------- STREAK ---------- */

  const today=todayStr();

  let streak=d.streakCount||0;

  let last=d.lastActiveDate;

  if(!last){

    streak=1;

  }

  else{

    const diff=dayDiff(today,last);

    if(diff===1) streak+=1;

    else if(diff>1) streak=1;

  }

  if(last!==today){

    await updateDoc(doc(db,"users",user.uid),{

      streakCount:streak,
      lastActiveDate:today

    });

  }

  document.getElementById("streakCount").innerText=streak;



  /* ---------- COURSE PROGRESS RING ---------- */

  const boardsProgress=getCourseProgress("Boards");

  animateProgress(boardsProgress);



  /* ---------- SUBJECT BARS ---------- */

  renderSubjects(
    "Boards",
    ["Accountancy","Business Studies","Economics","English","Hindi","Enterprenaurship"],
    "boardsSubjects"
  );

  renderSubjects(
    "CUET",
    ["Accountancy","Business Studies","Economics","English","General Aptitude Test"],
    "cuetSubjects"
  );

  renderSubjects(
    "CA Foundation",
    ["Accounting","Business Economics","Quantative Aptitude","Business Law"],
    "caSubjects"
  );



  /* ---------- USER INFO ---------- */

  document.getElementById("profileName").innerText=d.fullname||"Student";

  document.getElementById("profileEmail").innerText=user.email;

  document.getElementById("siteTime").innerText=formatTime(d.totalSiteSeconds);

  document.getElementById("lectureTime").innerText=formatTime(d.totalLectureSeconds);

  document.getElementById("nameInput").value=d.fullname||"";

});



/* ---------- PROFILE UPDATE ---------- */

document.getElementById("saveNameBtn").onclick=async()=>{

  const name=document.getElementById("nameInput").value.trim();

  if(name.length<2){

    alert("Name too short");
    return;

  }

  const user=auth.currentUser;

  await updateDoc(doc(db,"users",user.uid),{

    fullname:name

  });

  document.getElementById("profileName").innerText=name;

  localStorage.setItem("fullname",name);

  alert("Profile updated");

};



/* ---------- PROGRESS RING ---------- */

let currentPercent=0;

function animateProgress(target,duration=900){

  const ring=document.getElementById("progressRing");

  const text=document.getElementById("coursePercent");

  if(!ring||!text) return;

  const start=currentPercent;

  const diff=target-start;

  const startTime=performance.now();

  function easeOut(t){

    return 1-Math.pow(1-t,3);

  }

  function update(now){

    const t=Math.min((now-startTime)/duration,1);

    const value=Math.round(start+diff*easeOut(t));

    ring.style.setProperty("--percent",value);

    text.textContent=value+"%";

    if(t<1) requestAnimationFrame(update);

    else currentPercent=target;

  }

  requestAnimationFrame(update);

}
document.getElementById("boardsBar").style.width =
getCourseProgress("Boards") + "%";

document.getElementById("cuetBar").style.width =
getCourseProgress("CUET") + "%";

document.getElementById("caBar").style.width =
getCourseProgress("CA Foundation") + "%";