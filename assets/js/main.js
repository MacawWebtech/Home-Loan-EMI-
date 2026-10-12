/* ==========================================================================
   Ledgerline — main.js
   Site-wide behaviour: config & money formatting, theme, RTL, header,
   tooltips, scroll reveal, count-up, form validation, small UI widgets.

   Written as plain ES6+ (classic script, no bundler) so the template works
   when opened straight from disk (file://). Each section is a small module
   object on the shared `window.LL` namespace.
   ========================================================================== */
"use strict";

(() => {
  /* ------------------------------------------------------------------
     1. CONFIG
     switch currency here — one place for the whole site.
     Examples:
       { locale: 'en-IN', currency: 'INR' }  → ₹12,34,567  (lakh grouping)
       { locale: 'en-US', currency: 'USD' }  → $1,234,567
       { locale: 'ar-AE', currency: 'AED' }  → د.إ.‏ 1,234,567
     `shortUnits: 'indian'` shows L / Cr; 'western' shows K / M.
     ------------------------------------------------------------------ */
  const CONFIG = Object.assign(
    {
      locale: "en-IN",
      currency: "INR",
      shortUnits: "indian",
      storageKeys: { theme: "ll-theme", dir: "ll-dir" },
      // Bootstrap file names swapped on the #bs-css <link> when toggling LTR/RTL
      bootstrapLtr: "bootstrap.min.css",
      bootstrapRtl: "bootstrap.rtl.min.css",
    },
    window.LL_CONFIG || {},
  );

  const LL = (window.LL = window.LL || {});
  LL.config = CONFIG;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  LL.$ = $;
  LL.$$ = $$;

  const store = {
    get(k) {
      try {
        return localStorage.getItem(k);
      } catch (e) {
        return null;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch (e) {
        /* storage unavailable */
      }
    },
  };

  /* ------------------------------------------------------------------
     2. MONEY FORMATTING
     ------------------------------------------------------------------ */
  const moneyFmt = new Intl.NumberFormat(CONFIG.locale, {
    style: "currency",
    currency: CONFIG.currency,
    maximumFractionDigits: 0,
  });
  const numFmt = new Intl.NumberFormat(CONFIG.locale, { maximumFractionDigits: 0 });
  const symbol = (moneyFmt.formatToParts(0).find((p) => p.type === "currency") || { value: "" }).value;

  LL.money = {
    symbol,
    format: (v) => moneyFmt.format(Math.round(v || 0)),
    number: (v) => numFmt.format(Math.round(v || 0)),
    /** Compact: 50,00,000 → ₹50 L ; 2,50,00,000 → ₹2.5 Cr */
    short(v) {
      const n = Math.abs(v);
      const trim = (x) => (Math.round(x * 100) / 100).toString().replace(/\.0+$/, "");
      if (CONFIG.shortUnits === "indian") {
        if (n >= 1e7) return `${symbol}${trim(v / 1e7)} Cr`;
        if (n >= 1e5) return `${symbol}${trim(v / 1e5)} L`;
        if (n >= 1e3) return `${symbol}${trim(v / 1e3)} K`;
      } else {
        if (n >= 1e9) return `${symbol}${trim(v / 1e9)}B`;
        if (n >= 1e6) return `${symbol}${trim(v / 1e6)}M`;
        if (n >= 1e3) return `${symbol}${trim(v / 1e3)}K`;
      }
      return moneyFmt.format(Math.round(v));
    },
  };

  /** Render every [data-money="1234"] element using the config currency */
  const renderStaticMoney = () => {
    $$("[data-money]").forEach((el) => {
      const v = parseFloat(el.dataset.money);
      if (Number.isNaN(v)) return;
      el.textContent = el.dataset.moneyShort !== undefined ? LL.money.short(v) : LL.money.format(v);
    });
    $$("[data-currency-symbol]").forEach((el) => {
      el.textContent = symbol;
    });
  };

  /* ------------------------------------------------------------------
     3. THEME (light / dark, system preference + saved choice)
     ------------------------------------------------------------------ */
  const Theme = {
    current() {
      return document.documentElement.getAttribute("data-theme") || "light";
    },
    apply(t) {
      document.documentElement.setAttribute("data-theme", t);
      $$("[data-theme-toggle]").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(t === "dark"));
        btn.setAttribute("aria-label", t === "dark" ? "Switch to light mode" : "Switch to dark mode");
        const i = $("i", btn);
        if (i) i.className = t === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
      });
    },
    init() {
      const saved = store.get(CONFIG.storageKeys.theme);
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      this.apply(saved || (mq.matches ? "dark" : "light"));
      mq.addEventListener?.("change", (e) => {
        if (!store.get(CONFIG.storageKeys.theme)) this.apply(e.matches ? "dark" : "light");
      });
      $$("[data-theme-toggle]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const next = this.current() === "dark" ? "light" : "dark";
          store.set(CONFIG.storageKeys.theme, next);
          this.apply(next);
        }),
      );
    },
  };

  /* ------------------------------------------------------------------
     4. RTL toggle (swaps Bootstrap build, persists choice)
     ------------------------------------------------------------------ */
  const Direction = {
    apply(dir) {
      const html = document.documentElement;
      html.setAttribute("dir", dir);
      const bs = $("#bs-css");
      if (bs) {
        const href = bs.getAttribute("href");
        const want =
          dir === "rtl"
            ? href.replace(CONFIG.bootstrapLtr, CONFIG.bootstrapRtl)
            : href.replace(CONFIG.bootstrapRtl, CONFIG.bootstrapLtr);
        if (href !== want) {
          bs.removeAttribute("integrity");
          bs.setAttribute("href", want);
        }
      }
      $$("[data-rtl-toggle]").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(dir === "rtl"));
        btn.setAttribute(
          "aria-label",
          dir === "rtl" ? "Switch to left-to-right layout" : "Switch to right-to-left layout",
        );
      });
    },
    init() {
      const saved = store.get(CONFIG.storageKeys.dir);
      this.apply(saved || document.documentElement.getAttribute("dir") || "ltr");
      $$("[data-rtl-toggle]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const next = document.documentElement.getAttribute("dir") === "rtl" ? "ltr" : "rtl";
          store.set(CONFIG.storageKeys.dir, next);
          this.apply(next);
        }),
      );
    },
  };

  /* ------------------------------------------------------------------
     5. HEADER: scrolled state, active link, back-to-top
     ------------------------------------------------------------------ */
  const Header = {
    init() {
      const header = $(".ll-header");
      const toTop = $(".ll-to-top");
      const onScroll = () => {
        const y = window.scrollY;
        header?.classList.toggle("is-scrolled", y > 8);
        toTop?.classList.toggle("is-visible", y > 700);
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      toTop?.addEventListener("click", () =>
        window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }),
      );

      // Close mobile menu after choosing an in-page link
      $$('.ll-header .navbar-collapse a[href^="#"]').forEach((a) =>
        a.addEventListener("click", () => {
          const c = $(".ll-header .navbar-collapse.show");
          if (c && window.bootstrap) window.bootstrap.Collapse.getOrCreateInstance(c).hide();
        }),
      );
    },
  };

  /* ------------------------------------------------------------------
     6. TOOLTIPS (jargon terms: EMI, LTV, CIBIL…)
     ------------------------------------------------------------------ */
  const Tooltips = {
    init() {
      if (!window.bootstrap) return;
      $$('[data-bs-toggle="tooltip"]').forEach((el) => {
        window.bootstrap.Tooltip.getOrCreateInstance(el, { trigger: "hover focus" });
      });
    },
  };

  /* ------------------------------------------------------------------
     7. SCROLL REVEAL + COUNT-UP
     ------------------------------------------------------------------ */
  const countUp = (el) => {
    if (el.dataset.counted) return;
    el.dataset.counted = "1";
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    const prefix = el.dataset.prefix === "currency" ? symbol : el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const asMoney = el.dataset.countMoney !== undefined;
    const render = (v) => {
      const body = asMoney ? LL.money.number(v) : v.toFixed(decimals);
      el.textContent = `${prefix}${body}${suffix}`;
    };
    if (prefersReducedMotion()) {
      render(target);
      return;
    }
    const dur = 1400;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      render(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else render(target);
    };
    requestAnimationFrame(tick);
  };
  LL.countUp = countUp;

  const Reveal = {
    init() {
      const els = $$(".ll-reveal");
      const counters = $$("[data-count]");
      if (!("IntersectionObserver" in window)) {
        els.forEach((e) => e.classList.add("is-visible"));
        counters.forEach(countUp);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const t = entry.target;
            if (t.matches("[data-count]")) countUp(t);
            else t.classList.add("is-visible");
            io.unobserve(t);
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
      );
      els.forEach((e) => io.observe(e));
      counters.forEach((e) => io.observe(e));
    },
  };

  /* ------------------------------------------------------------------
     8. FORM VALIDATION (friendly inline messages)
     Add `data-validate` to a <form>. Each field may carry
     data-msg-required / data-msg-type / data-msg-pattern / data-msg-match.
     TODO (integration): set the form's action to Formspree / Netlify.
       Formspree:  action="https://formspree.io/f/YOUR_ID" method="POST"
       Netlify:    add  data-netlify="true" name="contact"
     ------------------------------------------------------------------ */
  const messages = {
    valueMissing: "Please fill in this field.",
    typeMismatchEmail: "That email doesn't look right — try name@example.com.",
    typeMismatch: "Please check the format.",
    patternMismatch: "Please check the format.",
    tooShort: (n) => `Please use at least ${n} characters.`,
    rangeUnderflow: (n) => `Please enter ${n} or more.`,
    rangeOverflow: (n) => `Please enter ${n} or less.`,
    match: "These don't match yet.",
    checkbox: "Please tick this box to continue.",
  };

  const fieldError = (field) => {
    const v = field.validity;
    if (field.dataset.match) {
      const other = document.getElementById(field.dataset.match);
      if (other && field.value !== other.value) return field.dataset.msgMatch || messages.match;
    }
    if (v.valid) return "";
    if (v.valueMissing)
      return field.type === "checkbox"
        ? field.dataset.msgRequired || messages.checkbox
        : field.dataset.msgRequired || messages.valueMissing;
    if (v.typeMismatch)
      return (
        field.dataset.msgType || (field.type === "email" ? messages.typeMismatchEmail : messages.typeMismatch)
      );
    if (v.patternMismatch) return field.dataset.msgPattern || messages.patternMismatch;
    if (v.tooShort) return messages.tooShort(field.minLength);
    if (v.rangeUnderflow) return messages.rangeUnderflow(field.min);
    if (v.rangeOverflow) return messages.rangeOverflow(field.max);
    return field.validationMessage;
  };

  const showFieldState = (field) => {
    const msg = fieldError(field);
    let fb = field.id ? document.getElementById(`${field.id}-error`) : null;
    if (!fb) {
      fb = document.createElement("div");
      fb.className = "invalid-feedback";
      if (field.id) fb.id = `${field.id}-error`;
      const host = field.closest(".input-group, .position-relative, .form-check") || field;
      host.insertAdjacentElement("afterend", fb);
    }
    fb.textContent = msg;
    fb.style.display = msg ? "block" : "none";
    field.classList.toggle("is-invalid", !!msg);
    field.classList.toggle("is-valid", !msg && field.type !== "checkbox" && field.value !== "");
    field.setAttribute("aria-invalid", String(!!msg));
    if (field.id) {
      const ids = new Set((field.getAttribute("aria-describedby") || "").split(" ").filter(Boolean));
      ids.add(fb.id);
      field.setAttribute("aria-describedby", Array.from(ids).join(" "));
    }
    return !msg;
  };

  const Forms = {
    init() {
      $$("form[data-validate]").forEach((form) => {
        form.setAttribute("novalidate", "");
        const fields = $$("input, select, textarea", form).filter(
          (f) => !["hidden", "submit", "button"].includes(f.type),
        );
        fields.forEach((f) => {
          f.addEventListener("blur", () => {
            if (f.value !== "" || f.dataset.touched) showFieldState(f);
            f.dataset.touched = "1";
          });
          f.addEventListener("input", () => {
            if (f.classList.contains("is-invalid")) showFieldState(f);
          });
          f.addEventListener("change", () => {
            if (f.type === "checkbox" || f.tagName === "SELECT") showFieldState(f);
          });
        });
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const results = fields.map(showFieldState);
          const firstBad = fields[results.indexOf(false)];
          if (firstBad) {
            firstBad.focus();
            return;
          }
          // TODO (integration): remove preventDefault branch below and let the form POST to your provider.
          const btn = $('[type="submit"]', form);
          const label = btn ? btn.innerHTML : "";
          if (btn) {
            btn.disabled = true;
            btn.innerHTML =
              '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Sending…';
          }
          setTimeout(() => {
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = label;
            }
            const ok =
              form.querySelector(".ll-form-success") || document.getElementById(form.dataset.success || "");
            if (ok) {
              ok.classList.add("is-visible");
              ok.focus?.();
            }
            LL.toast(form.dataset.toast || "Thanks — we've received your details.");
            if (form.dataset.redirect) {
              window.location.href = form.dataset.redirect;
              return;
            }
            form.reset();
            fields.forEach((f) => {
              f.classList.remove("is-valid", "is-invalid");
              delete f.dataset.touched;
            });
          }, 700);
        });
      });
    },
  };

  /* ------------------------------------------------------------------
     9. TOAST
     ------------------------------------------------------------------ */
  LL.toast = (text) => {
    let wrap = $(".ll-toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "ll-toast-wrap";
      wrap.setAttribute("role", "status");
      wrap.setAttribute("aria-live", "polite");
      document.body.appendChild(wrap);
    }
    const t = document.createElement("div");
    t.className = "ll-toast";
    t.innerHTML = '<i class="bi bi-check-circle-fill" aria-hidden="true"></i><span></span>';
    t.querySelector("span").textContent = text;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3800);
  };

  /* ------------------------------------------------------------------
     10. SMALL WIDGETS
     ------------------------------------------------------------------ */
  const Widgets = {
    passwords() {
      $$("[data-pw-toggle]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const input = document.getElementById(btn.dataset.pwToggle);
          if (!input) return;
          const show = input.type === "password";
          input.type = show ? "text" : "password";
          btn.setAttribute("aria-pressed", String(show));
          btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
          btn.querySelector("i").className = show ? "bi bi-eye-slash" : "bi bi-eye";
        }),
      );
      $$("[data-pw-meter]").forEach((meter) => {
        const input = document.getElementById(meter.dataset.pwMeter);
        const label = document.getElementById(`${meter.dataset.pwMeter}-strength`);
        const bars = $$("span", meter);
        const colors = ["var(--ll-danger)", "var(--ll-warning)", "var(--ll-accent)", "var(--ll-success)"];
        const names = ["Too weak", "Fair", "Good", "Strong"];
        input?.addEventListener("input", () => {
          const v = input.value;
          let s = 0;
          if (v.length >= 8) s++;
          if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
          if (/\d/.test(v)) s++;
          if (/[^A-Za-z0-9]/.test(v) && v.length >= 10) s++;
          bars.forEach((b, i) => {
            b.style.background = i < s ? colors[Math.max(0, s - 1)] : "";
          });
          if (label) label.textContent = v ? `Strength: ${names[Math.max(0, s - 1)]}` : "";
        });
      });
    },
    segToggle() {
      // Pricing billing toggle: [data-seg] group of buttons with data-value
      $$("[data-seg]").forEach((group) => {
        const buttons = $$("button", group);
        buttons.forEach((b) =>
          b.addEventListener("click", () => {
            buttons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
            const mode = b.dataset.value;
            $$("[data-price-monthly]").forEach((el) => {
              const v = parseFloat(mode === "yearly" ? el.dataset.priceYearly : el.dataset.priceMonthly);
              el.textContent = LL.money.format(v);
            });
            $$("[data-price-period]").forEach((el) => {
              el.textContent = mode === "yearly" ? "/ year" : "/ month";
            });
          }),
        );
      });
    },
    blogFilter() {
      const grid = $("[data-blog-grid]");
      if (!grid) return;
      const chips = $$("[data-filter]");
      const search = $("[data-blog-search]");
      const empty = $("[data-blog-empty]");
      const count = $("[data-blog-count]");
      let cat = "all";
      const apply = () => {
        const q = (search?.value || "").trim().toLowerCase();
        let shown = 0;
        $$("[data-cat]", grid).forEach((card) => {
          const okCat = cat === "all" || card.dataset.cat === cat;
          const okQ = !q || card.textContent.toLowerCase().includes(q);
          const ok = okCat && okQ;
          card.hidden = !ok;
          if (ok) shown++;
        });
        if (empty) empty.hidden = shown !== 0;
        if (count) count.textContent = `${shown} article${shown === 1 ? "" : "s"}`;
      };
      chips.forEach((c) =>
        c.addEventListener("click", () => {
          cat = c.dataset.filter;
          chips.forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
          apply();
        }),
      );
      search?.addEventListener("input", apply);
      $("[data-blog-search-form]")?.addEventListener("submit", (e) => {
        e.preventDefault();
        apply();
      });
      apply();
    },
    countdown() {
      const el = $("[data-countdown]");
      if (!el) return;
      // set launch date via data-countdown="2026-12-31T09:00:00+05:30"
      const target = new Date(el.dataset.countdown).getTime();
      const parts = {
        d: $('[data-cd="d"]', el),
        h: $('[data-cd="h"]', el),
        m: $('[data-cd="m"]', el),
        s: $('[data-cd="s"]', el),
      };
      const pad = (n) => String(n).padStart(2, "0");
      const tick = () => {
        const diff = Math.max(0, target - Date.now());
        const d = Math.floor(diff / 864e5),
          h = Math.floor(diff / 36e5) % 24,
          m = Math.floor(diff / 6e4) % 60,
          s = Math.floor(diff / 1e3) % 60;
        parts.d.textContent = pad(d);
        parts.h.textContent = pad(h);
        parts.m.textContent = pad(m);
        parts.s.textContent = pad(s);
      };
      tick();
      setInterval(tick, 1000);
    },
    year() {
      $$("[data-year]").forEach((el) => {
        el.textContent = String(new Date().getFullYear());
      });
    },
    shareCopy() {
      $$("[data-copy-link]").forEach((b) =>
        b.addEventListener("click", () => {
          navigator.clipboard
            ?.writeText(window.location.href)
            .then(() => LL.toast("Link copied to clipboard"));
        }),
      );
    },
    showcase() {
      // Portal showcase tabs: click or arrow keys switch the phone screen (WAI-ARIA tabs pattern)
      $$("[data-showcase]").forEach((list) => {
        const tabs = $$('[role="tab"]', list);
        const select = (tab, focus) => {
          tabs.forEach((t) => {
            const on = t === tab;
            t.setAttribute("aria-selected", String(on));
            t.tabIndex = on ? 0 : -1;
            const pane = document.getElementById(t.getAttribute("aria-controls"));
            if (pane) pane.hidden = !on;
          });
          if (focus) tab.focus();
        };
        tabs.forEach((t, i) => {
          t.addEventListener("click", () => select(t));
          t.addEventListener("keydown", (e) => {
            const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
            if (e.key in keys) {
              e.preventDefault();
              select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], true);
            }
            if (e.key === "Home") {
              e.preventDefault();
              select(tabs[0], true);
            }
            if (e.key === "End") {
              e.preventDefault();
              select(tabs[tabs.length - 1], true);
            }
          });
        });
      });
    },
    init() {
      this.passwords();
      this.segToggle();
      this.blogFilter();
      this.countdown();
      this.year();
      this.shareCopy();
      this.showcase();
    },
  };

  /* ------------------------------------------------------------------
     11. BOOT
     ------------------------------------------------------------------ */
  LL.Theme = Theme;
  LL.Direction = Direction;
  const boot = () => {
    document.documentElement.classList.remove("no-js");
    Theme.init();
    Direction.init();
    renderStaticMoney();
    Header.init();
    Tooltips.init();
    Reveal.init();
    Forms.init();
    // Home menu: open on hover for mouse users (click / keyboard / touch use the normal dropdown)
    (function () {
      const li = $(".ll-home-menu");
      if (!li || !window.bootstrap) return;
      const toggle = $(".dropdown-toggle", li),
        mq = window.matchMedia("(min-width: 1200px) and (hover: hover)");
      const dd = () => window.bootstrap.Dropdown.getOrCreateInstance(toggle);
      let t;
      li.addEventListener("mouseenter", () => {
        if (!mq.matches) return;
        clearTimeout(t);
        dd().show();
      });
      li.addEventListener("mouseleave", () => {
        if (!mq.matches) return;
        t = setTimeout(() => dd().hide(), 120);
      });
      toggle.addEventListener(
        "click",
        (e) => {
          if (!mq.matches) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          window.location.href = toggle.getAttribute("href");
        },
        true,
      );
    })();
    // Social sign-in buttons (demo). TODO (integration): replace with your Google / Apple OAuth flow.
    $$("[data-social]").forEach((btn) =>
      btn.addEventListener("click", () => {
        btn.disabled = true;
        LL.toast("Connecting to " + btn.dataset.social + "…");
        setTimeout(() => {
          window.location.href = btn.dataset.redirect || "client-dashboard.html";
        }, 700);
      }),
    );
    Widgets.init();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* One-card-at-a-time slider (tablet + mobile); CSS only activates it below 1024px */
(function () {
  const init = () =>
    document.querySelectorAll("[data-ll-snap]").forEach((track) => {
      const slides = Array.from(track.children);
      if (slides.length < 2) return;
      const nav = document.createElement("div");
      nav.className = "ll-snap-nav";
      nav.innerHTML =
        '<button type="button" class="ll-snap-btn" data-dir="-1" aria-label="Previous card"><i class="bi bi-arrow-left" aria-hidden="true"></i></button>' +
        '<div class="ll-snap-dots">' +
        slides
          .map(
            (_, i) =>
              '<button type="button" class="ll-snap-dot" aria-label="Go to card ' + (i + 1) + '"></button>',
          )
          .join("") +
        "</div>" +
        '<button type="button" class="ll-snap-btn" data-dir="1" aria-label="Next card"><i class="bi bi-arrow-right" aria-hidden="true"></i></button>';
      track.insertAdjacentElement("afterend", nav);
      const [prev, next] = nav.querySelectorAll(".ll-snap-btn");
      const dots = Array.from(nav.querySelectorAll(".ll-snap-dot"));
      const current = () => {
        const x = Math.abs(track.scrollLeft),
          r = track.getBoundingClientRect();
        let best = 0,
          d = Infinity;
        slides.forEach((s, i) => {
          const o = Math.abs(s.getBoundingClientRect().left - r.left);
          if (o < d) {
            d = o;
            best = i;
          }
        });
        return best;
      };
      const update = () => {
        const i = current();
        dots.forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
        prev.disabled = i === 0;
        next.disabled = i === slides.length - 1;
      };
      const go = (i) => {
        const s = slides[Math.max(0, Math.min(slides.length - 1, i))];
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const left = s.offsetLeft - track.offsetLeft;
        track.scrollTo({
          left: (getComputedStyle(track).direction === "rtl" ? -1 : 1) * Math.abs(left),
          behavior: reduce ? "auto" : "smooth",
        });
      };
      prev.addEventListener("click", () => go(current() - 1));
      next.addEventListener("click", () => go(current() + 1));
      dots.forEach((b, i) => b.addEventListener("click", () => go(i)));
      track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
      window.addEventListener("resize", update);
      update();
    });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
