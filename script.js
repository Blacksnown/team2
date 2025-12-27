document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "team2_submissions";
  const CLIENT_KEY = "team2_clientId";
  const ADMIN_SESSION = "team2_admin_session";
  const DEVICE_NAME_KEY = "team2_device_name";
  const form = document.getElementById("memberForm");
  const submissionsEl = document.getElementById("submissions");
  const deviceNameDisplay = document.getElementById("deviceNameDisplay");

  // Ensure each browser/user has a persistent client id so we can mark ownership
  function getClientId() {
    try {
      let id = localStorage.getItem(CLIENT_KEY);
      if (!id) {
        id = Date.now() + "-" + Math.random().toString(36).slice(2, 9);
        localStorage.setItem(CLIENT_KEY, id);
      }
      return id;
    } catch (e) {
      console.error("Failed to read/write client id", e);
      return null;
    }
  }
  const CLIENT_ID = getClientId();
  function loadList() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load submissions", e);
      return [];
    }
  }

  // flags used by isAdmin; declare early to avoid TDZ when isAdmin is called
  let useFirestore = false;
  let remoteAdmin = null;

  // isAdmin will be resolved later; when Firestore is enabled we use remote admin doc,
  // otherwise fall back to local session flag. (session flag set after Firestore init)
  function isAdmin() {
    if (useFirestore) {
      return remoteAdmin && remoteAdmin.adminId === CLIENT_ID;
    }
    return sessionStorage.getItem(ADMIN_SESSION) === "1";
  }

  // device name helpers
  function getDeviceName() {
    try {
      let name = localStorage.getItem(DEVICE_NAME_KEY);
      if (!name) {
        // create a short friendly name from client id
        name =
          "Device-" +
          (CLIENT_ID
            ? CLIENT_ID.slice(-6)
            : Math.random().toString(36).slice(2, 8));
        localStorage.setItem(DEVICE_NAME_KEY, name);
      }
      return name;
    } catch (e) {
      console.error("Failed to read/write device name", e);
      return null;
    }
  }
  const DEVICE_NAME = getDeviceName();
  // deviceNameDisplay will be updated after admin state is known (remote or local)

  // Firebase / Firestore integration (optional)
  let db = null;
  let adminRef = null;
  try {
    if (typeof FIREBASE_CONFIG !== "undefined" && FIREBASE_CONFIG) {
      // firebase compat SDK loaded from CDN in index.html
      try {
        firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.firestore();
        useFirestore = true;
        adminRef = db.collection("meta").doc("admin");
      } catch (e) {
        console.warn("Firebase init failed, falling back to localStorage", e);
        useFirestore = false;
      }
    }
  } catch (e) {
    // FIREBASE_CONFIG not defined or firebase SDK not loaded
  }

  // If Firestore is not used, mark this device admin locally
  if (!useFirestore) {
    try {
      sessionStorage.setItem(ADMIN_SESSION, "1");
    } catch (e) {
      console.error("Could not set admin session", e);
    }
  }

  // Local (device-only) admin keys
  const LOCAL_ADMIN_PW_KEY = "team2_local_admin_pw"; // stores hashed pw
  const LOCAL_ADMIN_SESSION = "team2_local_admin_session"; // session flag while logged in

  async function hashPassword(pw) {
    const enc = new TextEncoder();
    const data = enc.encode(pw);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function localAdminExists() {
    try {
      return !!localStorage.getItem(LOCAL_ADMIN_PW_KEY);
    } catch (e) {
      return false;
    }
  }

  function isLocalAdminLoggedIn() {
    return sessionStorage.getItem(LOCAL_ADMIN_SESSION) === "1";
  }

  async function setLocalAdmin() {
    const p1 = prompt("Tạo mật khẩu admin (cục bộ) — nhớ giữ an toàn:");
    if (!p1) return alert("Mật khẩu không được rỗng.");
    const p2 = prompt("Xác nhận mật khẩu:");
    if (p1 !== p2) return alert("Mật khẩu không khớp.");
    const h = await hashPassword(p1);
    localStorage.setItem(LOCAL_ADMIN_PW_KEY, h);
    sessionStorage.setItem(LOCAL_ADMIN_SESSION, "1");
    updateLocalAdminUI();
    alert(
      "Mật khẩu admin được tạo và bạn đã đăng nhập (chỉ trên thiết bị này)."
    );
  }

  async function loginLocalAdmin() {
    const stored = localStorage.getItem(LOCAL_ADMIN_PW_KEY);
    if (!stored) return alert("Chưa có mật khẩu admin trên thiết bị này.");
    const attempt = prompt("Nhập mật khẩu admin (cục bộ):");
    if (!attempt) return;
    const h = await hashPassword(attempt);
    if (h === stored) {
      sessionStorage.setItem(LOCAL_ADMIN_SESSION, "1");
      updateLocalAdminUI();
      alert("Đăng nhập admin thành công (cục bộ).");
    } else {
      alert("Mật khẩu không đúng.");
    }
  }

  function logoutLocalAdmin() {
    sessionStorage.removeItem(LOCAL_ADMIN_SESSION);
    updateLocalAdminUI();
  }

  function updateLocalAdminUI() {
    const setBtn = document.getElementById("setLocalAdminBtn");
    const loginBtn = document.getElementById("loginLocalAdminBtn");
    const logoutBtn = document.getElementById("logoutLocalAdminBtn");
    const indicator = document.getElementById("localAdminIndicator");
    const deviceNameEl = document.getElementById("deviceNameDisplay");

    const exists = localAdminExists();
    const logged = isLocalAdminLoggedIn();

    if (exists) {
      if (setBtn) setBtn.style.display = "none";
      if (logged) {
        if (loginBtn) loginBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "";
        if (indicator) indicator.style.display = "";
        if (deviceNameEl) {
          deviceNameEl.style.display = "";
          deviceNameEl.textContent = `Thiết bị: ${DEVICE_NAME}`;
        }
      } else {
        if (loginBtn) loginBtn.style.display = "";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (indicator) indicator.style.display = "none";
        if (deviceNameEl) deviceNameEl.style.display = "none";
      }
    } else {
      // no local admin yet
      if (setBtn) setBtn.style.display = "";
      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "none";
      if (indicator) indicator.style.display = "none";
      if (deviceNameEl) deviceNameEl.style.display = "none";
    }
  }

  // wire local admin buttons
  const setLocalBtn = document.getElementById("setLocalAdminBtn");
  if (setLocalBtn) setLocalBtn.addEventListener("click", () => setLocalAdmin());
  const loginLocalBtn = document.getElementById("loginLocalAdminBtn");
  if (loginLocalBtn)
    loginLocalBtn.addEventListener("click", () => loginLocalAdmin());
  const logoutLocalBtn = document.getElementById("logoutLocalAdminBtn");
  if (logoutLocalBtn)
    logoutLocalBtn.addEventListener("click", () => logoutLocalAdmin());

  function saveList(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  // Admin helpers when using Firestore
  function updateAdminUIFromRemote() {
    const currentAdminDisplay = document.getElementById("currentAdminDisplay");
    const claimBtn = document.getElementById("claimAdminBtn");
    const deviceNameEl = document.getElementById("deviceNameDisplay");
    const adminArea = document.querySelector(".admin-area");
    if (!useFirestore || !adminRef) {
      // No Firestore: keep local-admin behavior visible on this device
      if (adminArea) adminArea.style.display = "";
      if (currentAdminDisplay)
        currentAdminDisplay.textContent = "Quản trị: (local)";
      if (claimBtn) claimBtn.style.display = "none";
      if (deviceNameEl) {
        deviceNameEl.style.display = "";
        deviceNameEl.textContent = `Thiết bị: ${DEVICE_NAME}`;
      }
      updateLocalAdminUI();
      return;
    }
    if (remoteAdmin && remoteAdmin.adminId) {
      // There is a remote admin. Only the admin device should show admin UI.
      if (remoteAdmin.adminId === CLIENT_ID) {
        // this device is the admin — show admin area and device name
        if (adminArea) adminArea.style.display = "";
        if (currentAdminDisplay)
          currentAdminDisplay.textContent = `Quản trị: ${
            remoteAdmin.adminName || remoteAdmin.adminId
          }`;
        if (claimBtn) claimBtn.style.display = "none";
        if (deviceNameEl) {
          deviceNameEl.style.display = "";
          deviceNameEl.textContent = `Thiết bị: ${DEVICE_NAME}`;
        }
        // allow local admin UI on the admin device if desired
        updateLocalAdminUI();
      } else {
        // not the admin: hide entire admin area so other devices don't show admin controls
        if (adminArea) adminArea.style.display = "none";
      }
    } else {
      // No admin set yet — only allow claiming from devices that have local admin
      // This prevents other devices from seeing the claim button.
      const canClaim = localAdminExists() || isLocalAdminLoggedIn();
      if (canClaim) {
        if (adminArea) adminArea.style.display = "";
        if (currentAdminDisplay)
          currentAdminDisplay.textContent = "Quản trị: (chưa có)";
        if (claimBtn) claimBtn.style.display = "";
      } else {
        // hide admin area completely on devices that cannot claim
        if (adminArea) adminArea.style.display = "none";
      }
      if (deviceNameEl) deviceNameEl.style.display = "none";
    }
  }

  async function claimAdmin() {
    if (!adminRef || !db) return alert("Không thể kết nối tới Firestore.");
    try {
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(adminRef);
        if (doc.exists && doc.data() && doc.data().adminId) {
          throw new Error("Đã có admin khác.");
        }
        tx.set(adminRef, { adminId: CLIENT_ID, adminName: DEVICE_NAME });
      });
      alert("Thiết bị đã được đặt làm admin.");
    } catch (e) {
      alert("Không thể đặt admin: " + (e.message || e));
    }
  }

  if (useFirestore && adminRef) {
    // listen admin doc
    adminRef.onSnapshot(
      (doc) => {
        const data = doc.exists ? doc.data() : null;
        remoteAdmin = data
          ? { adminId: data.adminId, adminName: data.adminName }
          : null;
        updateAdminUIFromRemote();
      },
      (err) => console.error("adminRef onSnapshot error", err)
    );
    // attach claim button
    const claimBtnEl = document.getElementById("claimAdminBtn");
    if (claimBtnEl) claimBtnEl.addEventListener("click", claimAdmin);
  }

  // Update UI now (covers both local and remote cases)
  updateAdminUIFromRemote();

  function escapeHtml(s) {
    return String(s || "").replace(
      /[&<>",']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c])
    );
  }

  // Validate form data. Returns { ok: boolean, errors: string[], invalidIds: string[] }
  function validateForm(fd) {
    const errors = [];
    const invalid = [];

    const name = (fd.get("name") || "").toString().trim();
    const gender = (fd.get("gender") || "").toString().trim();
    const date = (fd.get("date") || "").toString().trim();
    const address = (fd.get("address") || "").toString().trim();
    const face = (fd.get("face") || "").toString().trim();
    const phone = (fd.get("phone") || "").toString().trim();
    const subject = (fd.get("subject") || "").toString().trim();

    if (!name || name.length < 2) {
      errors.push("Họ và tên phải có ít nhất 2 ký tự.");
      invalid.push("name");
    }

    if (!subject) {
      errors.push("Vui lòng chọn Tổ hợp.");
      invalid.push("subject");
    }

    if (!address) {
      errors.push("Địa chỉ không được để trống.");
      invalid.push("address");
    }

    if (phone) {
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 9 || digits.length > 15) {
        errors.push("Số điện thoại không hợp lệ (9-15 chữ số).");
        invalid.push("phone");
      }
    } else {
      errors.push("Số điện thoại là bắt buộc.");
      invalid.push("phone");
    }

    if (date) {
      const d = new Date(date);
      const now = new Date();
      if (isNaN(d.getTime())) {
        errors.push("Ngày sinh không hợp lệ.");
        invalid.push("date");
      } else if (d > now) {
        errors.push("Ngày sinh không thể lớn hơn ngày hiện tại.");
        invalid.push("date");
      }
    }

    if (face) {
      const lower = face.toLowerCase();
      if (!lower.includes("facebook") && !/^https?:\/\//.test(face)) {
        errors.push('Facebook phải là đường dẫn hoặc chứa "facebook".');
        invalid.push("face");
      }
    }

    // Ensure gender is one of allowed values
    if (gender && !["male", "female", "other"].includes(gender)) {
      errors.push("Giới tính không hợp lệ.");
      invalid.push("gender");
    }

    return { ok: errors.length === 0, errors, invalidIds: invalid };
  }

  function showFormErrors(result) {
    const container = document.getElementById("formErrors");
    // clear previous highlights
    ["name", "gender", "date", "address", "face", "phone", "subject"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.remove("invalid");
      }
    );

    if (!container) return;
    if (result.ok) {
      container.innerHTML = "";
      return;
    }
    const ul = document.createElement("ul");
    result.errors.forEach((msg) => {
      const li = document.createElement("li");
      li.textContent = msg;
      ul.appendChild(li);
    });
    container.innerHTML = "";
    container.appendChild(ul);

    // highlight invalid fields
    result.invalidIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add("invalid");
    });
  }

  // Render a given list of items (local or remote)
  function renderList(list) {
    submissionsEl.innerHTML = "";
    if (!list || !list.length) {
      submissionsEl.innerHTML = "<p>Chưa có hồ sơ nào.</p>";
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "submission-list";

    list.forEach((item) => {
      const li = document.createElement("li");
      li.className = "submission-item";

      li.innerHTML = `
        <div class="entry-header"><strong>${escapeHtml(
          item.name
        )}</strong> — <em>${escapeHtml(item.subject)}</em></div>
        <div>Giới tính: ${escapeHtml(
          item.gender || ""
        )} | Ngày sinh: ${escapeHtml(item.date || "")}</div>
        <div>Địa chỉ: ${escapeHtml(item.address || "")}</div>
        <div>Facebook: ${escapeHtml(item.face || "")} | SĐT: ${escapeHtml(
        item.phone || ""
      )}</div>
      `;

      // Only admin can delete entries
      if (isAdmin()) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Xóa";
        btn.addEventListener("click", async () => {
          if (!confirm("Bạn có chắc muốn xóa bản ghi này?")) return;
          try {
            if (useFirestore && db) {
              // item.id is firestore doc id
              await db.collection("submissions").doc(item.id).delete();
            } else {
              const newList = loadList().filter((i) => i.id !== item.id);
              saveList(newList);
              renderList(newList);
            }
          } catch (e) {
            console.error("Delete failed", e);
            alert("Xóa thất bại.");
          }
        });
        li.appendChild(btn);
      }
      // Show owner name only to admin
      if (isAdmin() && item.ownerName) {
        const ownerDiv = document.createElement("div");
        ownerDiv.className = "owner-name";
        ownerDiv.textContent = `Đăng bởi: ${item.ownerName}`;
        li.appendChild(ownerDiv);
      }
      ul.appendChild(li);
    });

    submissionsEl.appendChild(ul);
  }

  // Firestore listener
  async function listenRemote() {
    if (!db) return;
    try {
      db.collection("submissions")
        .orderBy("createdAt", "desc")
        .onSnapshot(
          (snapshot) => {
            const list = snapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name || "",
                gender: data.gender || "",
                date: data.date || "",
                address: data.address || "",
                face: data.face || "",
                phone: data.phone || "",
                subject: data.subject || "",
                owner: data.owner || "",
                ownerName: data.ownerName || "",
                createdAt: data.createdAt ? data.createdAt.toDate() : null,
              };
            });
            renderList(list);
          },
          (err) => console.error("Firestore onSnapshot error", err)
        );
    } catch (e) {
      console.error("listenRemote failed", e);
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const valid = validateForm(fd);
    showFormErrors(valid);
    if (!valid.ok) return; // don't save if invalid
    const entry = {};
    for (const [k, v] of fd.entries()) entry[k] = v;
    entry.id = Date.now();
    // ownership metadata
    entry.owner = CLIENT_ID;
    entry.ownerName = DEVICE_NAME;

    if (useFirestore && db) {
      try {
        await db.collection("submissions").add({
          ...entry,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        // Firestore listener will update the UI
      } catch (e) {
        console.error("Failed to save to Firestore", e);
        // fallback to local
        const list = loadList();
        list.unshift(entry);
        saveList(list);
        renderList(list);
      }
    } else {
      const list = loadList();
      list.unshift(entry); // newest first
      saveList(list);
      renderList(list);
    }
    form.reset();
  });

  // initial render
  if (useFirestore && db) {
    // start realtime listener
    listenRemote();
  } else {
    // local only
    renderList(loadList());
  }
});
