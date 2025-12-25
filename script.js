document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "team2_submissions";
  const CLIENT_KEY = "team2_clientId";
  const ADMIN_PW_KEY = "team2_admin_pw";
  const ADMIN_SESSION = "team2_admin_session";
  const form = document.getElementById("memberForm");
  const submissionsEl = document.getElementById("submissions");
  const adminBtn = document.getElementById("adminBtn");
  const adminLogout = document.getElementById("adminLogout");
  const adminIndicator = document.getElementById("adminIndicator");

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

  // admin helpers
  function isAdmin() {
    return sessionStorage.getItem(ADMIN_SESSION) === "1";
  }

  async function hashPassword(pw) {
    const enc = new TextEncoder();
    const data = enc.encode(pw);
    const hash = await crypto.subtle.digest("SHA-256", data);
    // convert to hex
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function updateAdminUI() {
    if (isAdmin()) {
      adminLogout.style.display = "";
      adminBtn.style.display = "none";
      adminIndicator.style.display = "";
    } else {
      adminLogout.style.display = "none";
      adminBtn.style.display = "";
      adminIndicator.style.display = "none";
    }
  }

  // admin button logic: if no password set, create one; otherwise prompt to login
  adminBtn &&
    adminBtn.addEventListener("click", async () => {
      try {
        const stored = localStorage.getItem(ADMIN_PW_KEY);
        if (!stored) {
          const p1 = prompt(
            "Chưa có mật khẩu admin. Vui lòng tạo mật khẩu admin:"
          );
          if (!p1) return alert("Mật khẩu không được rỗng.");
          const p2 = prompt("Xác nhận mật khẩu admin:");
          if (p1 !== p2) return alert("Mật khẩu không khớp.");
          const h = await hashPassword(p1);
          localStorage.setItem(ADMIN_PW_KEY, h);
          sessionStorage.setItem(ADMIN_SESSION, "1");
          updateAdminUI();
          renderAll();
          return alert("Mật khẩu admin đã được tạo và bạn đã đăng nhập.");
        }

        const attempt = prompt("Nhập mật khẩu admin:");
        if (!attempt) return;
        const h2 = await hashPassword(attempt);
        if (h2 === stored) {
          sessionStorage.setItem(ADMIN_SESSION, "1");
          updateAdminUI();
          renderAll();
          alert("Đăng nhập admin thành công.");
        } else {
          alert("Mật khẩu không đúng.");
        }
      } catch (e) {
        console.error("Admin action failed", e);
        alert("Lỗi khi xử lý admin.");
      }
    });

  adminLogout &&
    adminLogout.addEventListener("click", () => {
      sessionStorage.removeItem(ADMIN_SESSION);
      updateAdminUI();
      renderAll();
    });

  // set UI on startup
  updateAdminUI();

  function loadList() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Failed to load submissions", e);
      return [];
    }
  }

  function saveList(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

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

  function renderAll() {
    const list = loadList();
    submissionsEl.innerHTML = "";
    if (!list.length) {
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
        btn.addEventListener("click", () => {
          if (!confirm("Bạn có chắc muốn xóa bản ghi này?")) return;
          const newList = loadList().filter((i) => i.id !== item.id);
          saveList(newList);
          renderAll();
        });
        li.appendChild(btn);
      }
      ul.appendChild(li);
    });

    submissionsEl.appendChild(ul);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const entry = {};
    for (const [k, v] of fd.entries()) entry[k] = v;
    entry.id = Date.now();

    const list = loadList();
    list.unshift(entry); // newest first
    saveList(list);

    renderAll();
    form.reset();
  });

  // initial render
  renderAll();
});
