document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "team2_submissions";
  const form = document.getElementById("memberForm");
  const submissionsEl = document.getElementById("submissions");

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

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Xóa";
      btn.addEventListener("click", () => {
        const newList = loadList().filter((i) => i.id !== item.id);
        saveList(newList);
        renderAll();
      });

      li.appendChild(btn);
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
