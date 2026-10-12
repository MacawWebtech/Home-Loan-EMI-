/* ==========================================================================
   Ledgerline — dashboard.js
   Client + admin dashboard behaviour: sidebar, skeleton loaders, upload UI,
   booking slots, messages, kanban pipeline, charts, repayment schedule.
   All data here is demo data. Search for "TODO (backend)" to wire an API.
   ========================================================================== */
"use strict";

(() => {
  const LL = (window.LL = window.LL || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (v) => (LL.money ? LL.money.format(v) : String(v));
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     1. SIDEBAR (mobile off-canvas)
     ------------------------------------------------------------------ */
  const Sidebar = {
    init() {
      const side = $(".ll-sidebar");
      const backdrop = $(".ll-side-backdrop");
      if (!side) return;
      const toggles = $$("[data-side-toggle]");
      const set = (open) => {
        side.classList.toggle("is-open", open);
        backdrop?.classList.toggle("is-open", open);
        toggles.forEach((t) => t.setAttribute("aria-expanded", String(open)));
        if (open) $("a", side)?.focus();
      };
      toggles.forEach((t) => t.addEventListener("click", () => set(!side.classList.contains("is-open"))));
      backdrop?.addEventListener("click", () => set(false));
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && side.classList.contains("is-open")) set(false);
      });
    },
  };

  /* ------------------------------------------------------------------
     2. SKELETON LOADERS
     Wrap a widget in [data-load] containing [data-skeleton] + [data-skeleton-target].
     TODO (backend): replace the timeout with your fetch() and add .is-loaded on resolve.
     ------------------------------------------------------------------ */
  const Skeletons = {
    init() {
      $$("[data-load]").forEach((el, i) => {
        el.setAttribute("aria-busy", "true");
        setTimeout(
          () => {
            el.classList.add("is-loaded");
            el.setAttribute("aria-busy", "false");
            $$("[data-count]", el).forEach((c) => LL.countUp?.(c));
          },
          reduced() ? 0 : 650 + i * 120,
        );
      });
    },
  };

  /* ------------------------------------------------------------------
     3. BAR CHARTS + SPARKLINES
     ------------------------------------------------------------------ */
  const Charts = {
    init() {
      $$("[data-bars]").forEach((wrap) => {
        const vals = wrap.dataset.bars.split(",").map(Number);
        const labels = (wrap.dataset.labels || "").split(",");
        const max = Math.max(...vals);
        wrap.innerHTML = vals
          .map(
            (v, i) =>
              `<div><span class="ll-bar${i === vals.length - 1 ? " is-hi" : ""}" style="block-size:0" data-h="${(v / max) * 100}" title="${labels[i] || ""}: ${v}"></span><small>${labels[i] || ""}</small></div>`,
          )
          .join("");
        wrap.setAttribute("role", "img");
        requestAnimationFrame(() =>
          setTimeout(
            () =>
              $$(".ll-bar", wrap).forEach((b) => {
                b.style.blockSize = `${b.dataset.h}%`;
              }),
            300,
          ),
        );
      });
      $$("[data-spark]").forEach((svg) => {
        const vals = svg.dataset.spark.split(",").map(Number);
        const W = 120,
          H = 36,
          max = Math.max(...vals),
          min = Math.min(...vals);
        const pts = vals.map((v, i) => [
          (i / (vals.length - 1)) * W,
          H - 3 - ((v - min) / (max - min || 1)) * (H - 6),
        ]);
        const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        svg.setAttribute("preserveAspectRatio", "none");
        svg.innerHTML = `<path class="ll-spark-fill" d="${d} L${W},${H} L0,${H} Z"/><path d="${d}"/>`;
      });
    },
  };

  /* ------------------------------------------------------------------
     4. DOCUMENT UPLOAD (drag & drop UI, simulated progress)
     TODO (backend): POST files to your storage endpoint inside upload().
     ------------------------------------------------------------------ */
  const Upload = {
    init() {
      $$("[data-dropzone]").forEach((zone) => {
        const input = $('input[type="file"]', zone.parentElement) || $('input[type="file"]');
        const list = document.getElementById(zone.dataset.dropzone);
        const open = () => input?.click();
        zone.addEventListener("click", open);
        zone.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        });
        ["dragenter", "dragover"].forEach((ev) =>
          zone.addEventListener(ev, (e) => {
            e.preventDefault();
            zone.classList.add("is-drag");
          }),
        );
        ["dragleave", "drop"].forEach((ev) =>
          zone.addEventListener(ev, (e) => {
            e.preventDefault();
            zone.classList.remove("is-drag");
          }),
        );
        zone.addEventListener("drop", (e) => this.handle(e.dataTransfer.files, list));
        input?.addEventListener("change", () => {
          this.handle(input.files, list);
          input.value = "";
        });
      });
      // "Upload" buttons on checklist rows pick a file for that row
      $$("[data-upload-row]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const row = btn.closest(".ll-doc-row");
          const picker = document.createElement("input");
          picker.type = "file";
          picker.accept = ".pdf,.jpg,.jpeg,.png";
          picker.addEventListener("change", () => {
            if (picker.files[0]) this.markRow(row, picker.files[0]);
          });
          picker.click();
        }),
      );
    },
    markRow(row, file) {
      const chip = $(".ll-badge", row);
      const small = $(".ll-doc-meta small", row);
      chip.className = "ll-badge is-info";
      chip.innerHTML = '<i class="bi bi-arrow-repeat" aria-hidden="true"></i> Uploading';
      setTimeout(() => {
        chip.className = "ll-badge is-warning";
        chip.innerHTML = '<i class="bi bi-hourglass-split" aria-hidden="true"></i> In review';
        if (small) small.textContent = `${file.name} · ${(file.size / 1024).toFixed(0)} KB · just now`;
        this.updateProgress();
        LL.toast?.(`${file.name} uploaded — we'll review it within 1 working day.`);
      }, 1100);
    },
    handle(files, list) {
      if (!list) return;
      Array.from(files).forEach((file) => {
        const okType = /\.(pdf|jpe?g|png)$/i.test(file.name);
        const okSize = file.size <= 10 * 1024 * 1024;
        const row = document.createElement("div");
        row.className = "ll-doc-row";
        row.innerHTML = `<div class="ll-doc-icon"><i class="bi bi-file-earmark-text" aria-hidden="true"></i></div>
          <div class="ll-doc-meta"><strong></strong><small></small><div class="progress mt-2" role="progressbar" aria-label="Upload progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="progress-bar" style="inline-size:0"></div></div></div>
          <span class="ll-badge is-info">Uploading</span>`;
        $("strong", row).textContent = file.name;
        $("small", row).textContent = `${(file.size / 1024).toFixed(0)} KB`;
        list.prepend(row);
        const chip = $(".ll-badge", row);
        const bar = $(".progress-bar", row);
        const prog = $(".progress", row);
        if (!okType || !okSize) {
          prog.remove();
          chip.className = "ll-badge is-danger";
          chip.innerHTML = '<i class="bi bi-x-circle" aria-hidden="true"></i> Rejected';
          $("small", row).textContent = !okType
            ? "Only PDF, JPG or PNG files are accepted."
            : "This file is over 10 MB — please compress it.";
          return;
        }
        let p = 0;
        const t = setInterval(
          () => {
            p = Math.min(100, p + 12 + Math.random() * 18);
            bar.style.inlineSize = `${p}%`;
            prog.setAttribute("aria-valuenow", String(Math.round(p)));
            if (p >= 100) {
              clearInterval(t);
              prog.remove();
              chip.className = "ll-badge is-warning";
              chip.innerHTML = '<i class="bi bi-hourglass-split" aria-hidden="true"></i> In review';
            }
          },
          reduced() ? 20 : 180,
        );
      });
    },
    updateProgress() {
      const rows = $$("[data-checklist] .ll-doc-row");
      if (!rows.length) return;
      const done = rows.filter(
        (r) =>
          !$(".ll-badge", r).classList.contains("is-neutral") &&
          !$(".ll-badge", r).classList.contains("is-danger"),
      ).length;
      const pct = Math.round((done / rows.length) * 100);
      $$("[data-doc-progress]").forEach((el) => {
        el.style.inlineSize = `${pct}%`;
        el.parentElement.setAttribute("aria-valuenow", String(pct));
      });
      $$("[data-doc-progress-label]").forEach((el) => {
        el.textContent = `${done} of ${rows.length} submitted`;
      });
    },
  };

  /* ------------------------------------------------------------------
     5. CONSULTATION BOOKING (month grid + time slots)
     TODO (integration): swap for Calendly / Cal.com embed if preferred:
       <div class="calendly-inline-widget" data-url="https://calendly.com/YOUR"></div>
     ------------------------------------------------------------------ */
  const Booking = {
    init() {
      const cal = $("[data-booking-cal]");
      if (!cal) return;
      const slotsWrap = $("[data-booking-slots]");
      const label = $("[data-booking-label]");
      const summary = $("[data-booking-summary]");
      const confirm = $("[data-booking-confirm]");
      const monthLabel = $("[data-booking-month]");
      let view = new Date();
      view.setDate(1);
      let chosenDay = null,
        chosenSlot = null;
      const times = ["10:00", "10:30", "11:30", "12:00", "14:00", "15:00", "16:30", "17:30"];
      const busy = (d, t) => (d.getDate() * 7 + t.length + parseInt(t, 10)) % 5 === 0;

      const renderSlots = () => {
        if (!chosenDay) {
          slotsWrap.innerHTML = '<p class="mb-0">Pick a date to see open times.</p>';
          return;
        }
        label.textContent = chosenDay.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        slotsWrap.innerHTML = times
          .map(
            (t) =>
              `<button type="button" class="ll-slot" aria-pressed="false" ${busy(chosenDay, t) ? 'disabled aria-label="' + t + ' booked"' : ""}>${t}</button>`,
          )
          .join("");
        $$(".ll-slot", slotsWrap).forEach((b) =>
          b.addEventListener("click", () => {
            $$(".ll-slot", slotsWrap).forEach((x) => x.setAttribute("aria-pressed", "false"));
            b.setAttribute("aria-pressed", "true");
            chosenSlot = b.textContent;
            summary.textContent = `${label.textContent} at ${chosenSlot} IST · 30 min video call`;
            confirm.disabled = false;
          }),
        );
      };

      const render = () => {
        const y = view.getFullYear(),
          m = view.getMonth();
        monthLabel.textContent = view.toLocaleDateString(undefined, { month: "long", year: "numeric" });
        const first = (new Date(y, m, 1).getDay() + 6) % 7; // Monday start
        const days = new Date(y, m + 1, 0).getDate();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let html = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
          .map((d) => `<div class="ll-cal-dow" aria-hidden="true">${d}</div>`)
          .join("");
        for (let i = 0; i < first; i++) html += "<span></span>";
        for (let d = 1; d <= days; d++) {
          const date = new Date(y, m, d);
          const off = date < today || date.getDay() === 0;
          const pressed = chosenDay && date.getTime() === chosenDay.getTime();
          html += `<button type="button" data-day="${d}" ${off ? "disabled" : 'class="has-slots"'} aria-pressed="${pressed ? "true" : "false"}" aria-label="${date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${off ? ", unavailable" : ", slots open"}">${d}</button>`;
        }
        cal.innerHTML = html;
        $$("button[data-day]:not(:disabled)", cal).forEach((b) =>
          b.addEventListener("click", () => {
            chosenDay = new Date(y, m, parseInt(b.dataset.day, 10));
            chosenSlot = null;
            confirm.disabled = true;
            summary.textContent = "Now choose a time.";
            $$("button[data-day]", cal).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            renderSlots();
          }),
        );
      };
      $("[data-booking-prev]")?.addEventListener("click", () => {
        view.setMonth(view.getMonth() - 1);
        render();
      });
      $("[data-booking-next]")?.addEventListener("click", () => {
        view.setMonth(view.getMonth() + 1);
        render();
      });
      confirm?.addEventListener("click", () => {
        if (!chosenDay || !chosenSlot) return;
        const list = $("[data-booking-list]");
        if (list) {
          const li = document.createElement("li");
          li.className = "ll-doc-row";
          li.innerHTML = `<div class="ll-doc-icon"><i class="bi bi-camera-video" aria-hidden="true"></i></div><div class="ll-doc-meta"><strong>Advisor consultation</strong><small></small></div><span class="ll-badge is-success"><i class="bi bi-check-circle" aria-hidden="true"></i> Confirmed</span>`;
          $("small", li).textContent =
            `${chosenDay.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${chosenSlot} IST · Priya Raman`;
          list.prepend(li);
        }
        LL.toast?.("Consultation booked — a calendar invite is on its way.");
        confirm.disabled = true;
      });
      render();
      renderSlots();
    },
  };

  /* ------------------------------------------------------------------
     6. MESSAGES (switch thread, send)
     TODO (backend): connect to your messaging API / websocket.
     ------------------------------------------------------------------ */
  const Messages = {
    init() {
      const list = $("[data-msg-list]");
      if (!list) return;
      const head = $("[data-thread-name]");
      const role = $("[data-thread-role]");
      const body = $("[data-thread-body]");
      const threads = JSON.parse($("#ll-thread-data")?.textContent || "{}");
      const paint = (id) => {
        const t = threads[id];
        if (!t) return;
        head.textContent = t.name;
        role.textContent = t.role;
        body.innerHTML = t.msgs
          .map(
            (m) =>
              `<div class="ll-bubble ${m.out ? "is-out" : "is-in"}"><span></span><time>${m.time}</time></div>`,
          )
          .join("");
        $$(".ll-bubble span", body).forEach((s, i) => {
          s.textContent = t.msgs[i].text;
        });
        body.scrollTop = body.scrollHeight;
      };
      $$(".ll-msg-item", list).forEach((item) =>
        item.addEventListener("click", () => {
          $$(".ll-msg-item", list).forEach((x) => x.setAttribute("aria-current", String(x === item)));
          $(".ll-badge", item)?.remove();
          paint(item.dataset.thread);
        }),
      );
      const form = $("[data-thread-form]");
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = $("input, textarea", form);
        const text = input.value.trim();
        if (!text) {
          input.focus();
          return;
        }
        const b = document.createElement("div");
        b.className = "ll-bubble is-out";
        b.innerHTML = "<span></span><time>Just now</time>";
        $("span", b).textContent = text;
        body.appendChild(b);
        input.value = "";
        body.scrollTop = body.scrollHeight;
      });
      const first = $('.ll-msg-item[aria-current="true"]', list) || $(".ll-msg-item", list);
      if (first) paint(first.dataset.thread);
    },
  };

  /* ------------------------------------------------------------------
     7. KANBAN PIPELINE (drag & drop + keyboard: focus card, ← / → to move)
     ------------------------------------------------------------------ */
  const Kanban = {
    init() {
      const board = $("[data-kanban]");
      if (!board) return;
      const cols = $$(".ll-kcol-list", board);
      const live = $("[data-kanban-live]");
      const recount = () =>
        $$(".ll-kcol", board).forEach((c) => {
          $(".ll-kcol-count", c).textContent = String($$(".ll-kcard", c).length);
        });
      const announce = (card, col) => {
        if (live)
          live.textContent = `${$("strong", card).textContent} moved to ${col.closest(".ll-kcol").dataset.stage}`;
      };
      let dragging = null;
      $$(".ll-kcard", board).forEach((card) => {
        card.setAttribute("draggable", "true");
        card.setAttribute("tabindex", "0");
        card.addEventListener("dragstart", (e) => {
          dragging = card;
          card.classList.add("is-dragging");
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", "");
        });
        card.addEventListener("dragend", () => {
          card.classList.remove("is-dragging");
          dragging = null;
          cols.forEach((c) => c.classList.remove("is-over"));
        });
        card.addEventListener("keydown", (e) => {
          const dir = document.documentElement.dir === "rtl" ? -1 : 1;
          let delta = 0;
          if (e.key === "ArrowRight") delta = dir;
          else if (e.key === "ArrowLeft") delta = -dir;
          else return;
          e.preventDefault();
          const idx = cols.indexOf(card.parentElement);
          const target = cols[idx + delta];
          if (!target) return;
          target.prepend(card);
          card.focus();
          recount();
          announce(card, target);
        });
      });
      cols.forEach((col) => {
        col.addEventListener("dragover", (e) => {
          e.preventDefault();
          col.classList.add("is-over");
        });
        col.addEventListener("dragleave", () => col.classList.remove("is-over"));
        col.addEventListener("drop", (e) => {
          e.preventDefault();
          col.classList.remove("is-over");
          if (!dragging) return;
          const after = $$(".ll-kcard:not(.is-dragging)", col).find(
            (c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2,
          );
          if (after) col.insertBefore(dragging, after);
          else col.appendChild(dragging);
          recount();
          announce(dragging, col);
        });
      });
      recount();
    },
  };

  /* ------------------------------------------------------------------
     8. TABLE SEARCH / FILTER (leads & users)
     ------------------------------------------------------------------ */
  const TableFilter = {
    init() {
      $$("[data-table-filter]").forEach((input) => {
        const table = document.getElementById(input.dataset.tableFilter);
        const status = $(`[data-table-status="${input.dataset.tableFilter}"]`);
        const countEl = $(`[data-table-count="${input.dataset.tableFilter}"]`);
        const apply = () => {
          const q = input.value.toLowerCase();
          const s = status ? status.value : "";
          let n = 0;
          $$("tbody tr", table).forEach((tr) => {
            const ok = (!q || tr.textContent.toLowerCase().includes(q)) && (!s || tr.dataset.status === s);
            tr.hidden = !ok;
            if (ok) n++;
          });
          if (countEl) countEl.textContent = `${n} shown`;
        };
        input.addEventListener("input", apply);
        status?.addEventListener("change", apply);
        apply();
      });
      // Select-all checkboxes
      $$("[data-select-all]").forEach((all) => {
        const table = document.getElementById(all.dataset.selectAll);
        all.addEventListener("change", () =>
          $$('tbody input[type="checkbox"]', table).forEach((c) => {
            if (!c.closest("tr").hidden) c.checked = all.checked;
          }),
        );
      });
    },
  };

  /* ------------------------------------------------------------------
     9. CLIENT REPAYMENT SCHEDULE (uses calculator.js)
     ------------------------------------------------------------------ */
  const Repayment = {
    init() {
      const root = $("[data-repayment]");
      if (!root || !LL.calc) return;
      // TODO (backend): load the client's sanctioned loan terms here
      const P = parseFloat(root.dataset.principal),
        rate = parseFloat(root.dataset.rate),
        n = parseInt(root.dataset.months, 10);
      const paid = parseInt(root.dataset.paid, 10);
      const s = LL.calc.schedule(P, rate, n);
      const tbody = $("[data-amort-body]", root);
      let mode = "yearly";
      const draw = () => LL.renderAmortTable(tbody, s.rows, mode);
      $$("[data-amort-mode]", root).forEach((b) =>
        b.addEventListener("click", () => {
          mode = b.dataset.amortMode;
          $$("[data-amort-mode]", root).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          draw();
        }),
      );
      draw();
      LL.drawAmortChart($('[data-chart="amort"]', root), LL.calc.yearly(s.rows), P);
      const bal = s.rows[paid - 1]?.balance ?? P;
      const interestPaid = s.rows.slice(0, paid).reduce((a, r) => a + r.interest, 0);
      const set = (k, v) =>
        $$(`[data-out="${k}"]`, root).forEach((el) => {
          el.textContent = v;
        });
      set("emi", fmt(s.emi));
      set("balance", fmt(bal));
      set("interest-paid", fmt(interestPaid));
      set("remaining", `${n - paid} months`);
      set("total-interest", fmt(s.totalInterest));
      set("total", fmt(P + s.totalInterest));
      set("progress", `${Math.round(((P - bal) / P) * 100)}%`);
      const pb = $("[data-repay-progress]", root);
      if (pb) pb.style.inlineSize = `${((P - bal) / P) * 100}%`;
    },
  };

  /* ------------------------------------------------------------------
     10. SETTINGS (save buttons, toggles)
     ------------------------------------------------------------------ */
  const Settings = {
    init() {
      $$("[data-save-toast]").forEach((b) =>
        b.addEventListener("click", () => LL.toast?.(b.dataset.saveToast)),
      );
    },
  };

  const boot = () => {
    Sidebar.init();
    Skeletons.init();
    Charts.init();
    Upload.init();
    Booking.init();
    Messages.init();
    Kanban.init();
    TableFilter.init();
    Repayment.init();
    Settings.init();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
