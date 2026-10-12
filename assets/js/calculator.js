/* ==========================================================================
   Ledgerline — calculator.js
   EMI maths + every calculator UI on the site:
     • Hero mini calculator        [data-mini-calc]
     • Full EMI + amortization     [data-calc-form="emi"]
     • Prepayment impact           [data-calc-form="prepay"]
     • Affordability               [data-calc-form="afford"]
     • Balance-transfer savings    [data-calc-form="transfer"]
   Formula: EMI = P × r × (1+r)^n / ((1+r)^n − 1)
            P = principal, r = monthly rate (annual % / 12 / 100), n = months
   ========================================================================== */
"use strict";

(() => {
  const LL = (window.LL = window.LL || {});
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (v) => (LL.money ? LL.money.format(v) : Math.round(v).toLocaleString());
  const short = (v) => (LL.money ? LL.money.short(v) : Math.round(v).toLocaleString());

  /* ------------------------------------------------------------------
     1. CORE MATHS (pure functions — safe to unit test)
     ------------------------------------------------------------------ */
  const Calc = {
    /** Monthly EMI for principal P, annual rate % and n months */
    emi(P, annualRate, n) {
      if (P <= 0 || n <= 0) return 0;
      const r = annualRate / 12 / 100;
      if (r === 0) return P / n;
      const f = Math.pow(1 + r, n);
      return (P * r * f) / (f - 1);
    },

    /** Largest principal a given EMI can service */
    principalFromEmi(E, annualRate, n) {
      if (E <= 0 || n <= 0) return 0;
      const r = annualRate / 12 / 100;
      if (r === 0) return E * n;
      const f = Math.pow(1 + r, n);
      return (E * (f - 1)) / (r * f);
    },

    /**
     * Month-by-month schedule. Supports extra monthly payment and a single
     * lump-sum prepayment at month `lumpMonth`. EMI stays fixed; tenure shrinks.
     */
    schedule(P, annualRate, n, opts = {}) {
      const r = annualRate / 12 / 100;
      const emi = this.emi(P, annualRate, n);
      const extra = opts.extraMonthly || 0;
      const lump = opts.lumpAmount || 0;
      const lumpMonth = opts.lumpMonth || 0;
      const rows = [];
      let bal = P;
      for (let m = 1; m <= n && bal > 0.5; m++) {
        const interest = bal * r;
        let principal = Math.min(emi - interest, bal);
        let paidExtra = 0;
        bal -= principal;
        if (extra > 0 && bal > 0) {
          paidExtra = Math.min(extra, bal);
          bal -= paidExtra;
        }
        if (lump > 0 && m === lumpMonth && bal > 0) {
          const l = Math.min(lump, bal);
          paidExtra += l;
          bal -= l;
        }
        rows.push({
          month: m,
          interest,
          principal: principal + paidExtra,
          payment: interest + principal + paidExtra,
          balance: Math.max(0, bal),
        });
      }
      return { emi, rows, totalInterest: rows.reduce((a, b) => a + b.interest, 0), months: rows.length };
    },

    /** Group a monthly schedule into years */
    yearly(rows) {
      const out = [];
      rows.forEach((row, i) => {
        const y = Math.floor(i / 12);
        if (!out[y]) out[y] = { year: y + 1, interest: 0, principal: 0, payment: 0, balance: 0 };
        out[y].interest += row.interest;
        out[y].principal += row.principal;
        out[y].payment += row.payment;
        out[y].balance = row.balance;
      });
      return out;
    },
  };
  LL.calc = Calc;

  /* ------------------------------------------------------------------
     2. SHARED UI HELPERS
     ------------------------------------------------------------------ */
  /** Paint slider progress fill via CSS custom property */
  const paintRange = (input) => {
    const min = parseFloat(input.min) || 0,
      max = parseFloat(input.max) || 100;
    const pct = ((parseFloat(input.value) - min) / (max - min)) * 100;
    input.style.setProperty("--pct", `${Math.max(0, Math.min(100, pct))}%`);
  };

  /** Human label for a field value, used for slider bubbles + aria-valuetext */
  const labelFor = (kind, v) => {
    switch (kind) {
      case "money":
        return short(v);
      case "rate":
        return `${Number(v).toFixed(2).replace(/0$/, "")}%`;
      case "years":
        return `${v} yr${Number(v) === 1 ? "" : "s"}`;
      case "months":
        return `${v} mo`;
      case "pct":
        return `${v}%`;
      default:
        return String(v);
    }
  };

  /** Bind a form: every [data-k] field (range + number pairs) → read() object */
  const bindForm = (root, onChange) => {
    const fields = $$("[data-k]", root);
    const read = () => {
      const o = {};
      fields.forEach((f) => {
        if (f.type !== "range" || !(f.dataset.k in o)) o[f.dataset.k] = parseFloat(f.value) || 0;
      });
      return o;
    };
    const sync = (src) => {
      const k = src.dataset.k;
      let v = parseFloat(src.value);
      if (Number.isNaN(v)) return;
      fields
        .filter((f) => f.dataset.k === k && f !== src)
        .forEach((f) => {
          const min = parseFloat(f.min),
            max = parseFloat(f.max);
          f.value = f.type === "range" ? Math.min(max, Math.max(min, v)) : v;
        });
      fields
        .filter((f) => f.dataset.k === k && f.type === "range")
        .forEach((r) => {
          paintRange(r);
          r.setAttribute("aria-valuetext", labelFor(r.dataset.kind, r.value));
        });
      $$(`[data-val-for="${k}"]`, root).forEach((el) => {
        el.textContent = labelFor(el.dataset.kind || src.dataset.kind, v);
      });
    };
    fields.forEach((f) => {
      f.addEventListener("input", () => {
        sync(f);
        onChange(read());
      });
      sync(f);
    });
    onChange(read());
    return read;
  };

  const out = (root, key, text) =>
    $$(`[data-out="${key}"]`, root).forEach((el) => {
      el.textContent = text;
    });

  /** Donut: interest share of total payable */
  const paintDonut = (root, principal, interest) => {
    const fg = $(".ll-donut-fg", root);
    if (!fg) return;
    const C = 2 * Math.PI * parseFloat(fg.getAttribute("r"));
    const share = interest / (principal + interest || 1);
    fg.setAttribute("stroke-dasharray", `${(share * C).toFixed(2)} ${C.toFixed(2)}`);
    const label = $(".ll-donut-pct", root);
    if (label) label.textContent = `${Math.round(share * 100)}%`;
    const svg = fg.closest("svg");
    svg?.setAttribute(
      "aria-label",
      `Interest is ${Math.round(share * 100)} percent of the total amount payable`,
    );
  };

  /* ------------------------------------------------------------------
     3. HERO MINI CALCULATOR
     ------------------------------------------------------------------ */
  const initMini = () => {
    $$("[data-mini-calc]").forEach((root) => {
      bindForm(root, ({ amount, rate, tenure }) => {
        const n = tenure * 12;
        const e = Calc.emi(amount, rate, n);
        const total = e * n;
        const interest = total - amount;
        out(root, "emi", fmt(e));
        out(root, "interest", fmt(interest));
        out(root, "total", fmt(total));
        out(root, "principal", fmt(amount));
        paintDonut(root, amount, interest);
        // Pass values to the full calculator link
        const link = $("[data-calc-link]", root);
        if (link) link.href = `${link.dataset.calcLink}?amount=${amount}&rate=${rate}&tenure=${tenure}`;
      });
    });
  };

  /* ------------------------------------------------------------------
     4. CHART (yearly stacked principal/interest + balance line, SVG)
     ------------------------------------------------------------------ */
  const drawChart = (svg, years, P) => {
    if (!svg) return;
    const W = 640,
      H = 260,
      pad = { l: 56, r: 16, t: 14, b: 30 };
    const iw = W - pad.l - pad.r,
      ih = H - pad.t - pad.b;
    const maxPay = Math.max(...years.map((y) => y.payment), 1);
    const bw = iw / years.length;
    const yS = (v) => pad.t + ih - (v / maxPay) * ih;
    const yB = (v) => pad.t + ih - (v / P) * ih;
    let g = "";
    for (let i = 0; i <= 4; i++) {
      const v = (maxPay / 4) * i,
        y = yS(v);
      g += `<line class="ll-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/><text x="${pad.l - 8}" y="${y + 3}" text-anchor="end">${short(v)}</text>`;
    }
    let bars = "";
    const step = Math.ceil(years.length / 10);
    years.forEach((y, i) => {
      const x = pad.l + i * bw + bw * 0.18,
        w = bw * 0.64;
      const hp = (y.principal / maxPay) * ih,
        hi = (y.interest / maxPay) * ih;
      const yp = pad.t + ih - hp;
      bars += `<rect class="ll-bar-p" x="${x.toFixed(1)}" y="${yp.toFixed(1)}" width="${w.toFixed(1)}" height="${hp.toFixed(1)}" rx="2"><title>Year ${y.year}: principal ${fmt(y.principal)}</title></rect>`;
      bars += `<rect class="ll-bar-i" x="${x.toFixed(1)}" y="${(yp - hi).toFixed(1)}" width="${w.toFixed(1)}" height="${hi.toFixed(1)}" rx="2"><title>Year ${y.year}: interest ${fmt(y.interest)}</title></rect>`;
      if (i % step === 0 || i === years.length - 1)
        bars += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 10}" text-anchor="middle">Y${y.year}</text>`;
    });
    const pts = years.map((y, i) => `${(pad.l + i * bw + bw / 2).toFixed(1)},${yB(y.balance).toFixed(1)}`);
    pts.unshift(`${pad.l},${yB(P).toFixed(1)}`);
    const line = `<polyline class="ll-line-bal" points="${pts.join(" ")}"><title>Outstanding balance</title></polyline>`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = `${g}<line class="ll-axis" x1="${pad.l}" x2="${W - pad.r}" y1="${pad.t + ih}" y2="${pad.t + ih}"/>${bars}${line}`;
  };
  LL.drawAmortChart = drawChart;

  /* ------------------------------------------------------------------
     5. AMORTIZATION TABLE (year-wise / month-wise toggle)
     ------------------------------------------------------------------ */
  const renderTable = (tbody, rows, mode) => {
    if (!tbody) return;
    const list = mode === "monthly" ? rows : Calc.yearly(rows);
    const label = (r) => (mode === "monthly" ? `M${r.month}` : `Year ${r.year}`);
    tbody.innerHTML = list
      .map(
        (r) => `<tr>
      <th scope="row" class="ll-num fw-semibold">${label(r)}</th>
      <td class="ll-money">${fmt(r.principal)}</td>
      <td class="ll-money">${fmt(r.interest)}</td>
      <td class="ll-money">${fmt(r.payment)}</td>
      <td class="ll-money">${fmt(r.balance)}</td></tr>`,
      )
      .join("");
  };
  LL.renderAmortTable = renderTable;

  /* ------------------------------------------------------------------
     6. FULL EMI CALCULATOR
     ------------------------------------------------------------------ */
  const initEmiPage = () => {
    const root = $('[data-calc-form="emi"]');
    if (!root) return;
    // Pre-fill from query string (hero calculator hand-off)
    const qs = new URLSearchParams(window.location.search);
    ["amount", "rate", "tenure"].forEach((k) => {
      if (qs.has(k))
        $$(`[data-k="${k}"]`, root).forEach((f) => {
          f.value = qs.get(k);
        });
    });
    let mode = "yearly";
    let last = null;
    const tbody = $("[data-amort-body]");
    const render = ({ amount, rate, tenure }) => {
      const n = Math.round(tenure * 12);
      const s = Calc.schedule(amount, rate, n);
      last = s;
      out(root, "emi", fmt(s.emi));
      out(root, "interest", fmt(s.totalInterest));
      out(root, "total", fmt(amount + s.totalInterest));
      out(root, "principal", fmt(amount));
      out(root, "ratio", `${((s.totalInterest / amount) * 100).toFixed(0)}%`);
      paintDonut(root, amount, s.totalInterest);
      drawChart($('[data-chart="amort"]'), Calc.yearly(s.rows), amount);
      renderTable(tbody, s.rows, mode);
    };
    bindForm(root, render);
    $$("[data-amort-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        mode = b.dataset.amortMode;
        $$("[data-amort-mode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        if (last) renderTable(tbody, last.rows, mode);
      }),
    );
    $("[data-amort-csv]")?.addEventListener("click", () => {
      if (!last) return;
      const lines = [
        "Month,Principal,Interest,Payment,Balance",
        ...last.rows.map((r) =>
          [r.month, r.principal, r.interest, r.payment, r.balance]
            .map((v) => (typeof v === "number" ? v.toFixed(2) : v))
            .join(","),
        ),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "amortization-schedule.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  };

  /* ------------------------------------------------------------------
     7. PREPAYMENT IMPACT
     ------------------------------------------------------------------ */
  const initPrepay = () => {
    const root = $('[data-calc-form="prepay"]');
    if (!root) return;
    bindForm(root, ({ amount, rate, tenure, extra, lump, lumpYear }) => {
      const n = tenure * 12;
      const base = Calc.schedule(amount, rate, n);
      const withPre = Calc.schedule(amount, rate, n, {
        extraMonthly: extra,
        lumpAmount: lump,
        lumpMonth: Math.max(1, lumpYear * 12),
      });
      const saved = base.totalInterest - withPre.totalInterest;
      const monthsCut = base.months - withPre.months;
      out(root, "base-interest", fmt(base.totalInterest));
      out(root, "new-interest", fmt(withPre.totalInterest));
      out(root, "saved", fmt(saved));
      out(root, "months-cut", `${Math.floor(monthsCut / 12)} yr ${monthsCut % 12} mo`);
      out(root, "new-tenure", `${Math.floor(withPre.months / 12)} yr ${withPre.months % 12} mo`);
      out(root, "emi", fmt(base.emi));
      const bar = $("[data-prepay-bar]", root);
      if (bar)
        bar.style.inlineSize = `${Math.max(4, (withPre.totalInterest / (base.totalInterest || 1)) * 100)}%`;
    });
  };

  /* ------------------------------------------------------------------
     8. AFFORDABILITY
     FOIR = fixed obligations to income ratio. Lenders usually cap total
     EMIs at 40–60% of net monthly income. LTV caps the loan at a share of
     the property value (RBI: 90% ≤ ₹30L, 80% ≤ ₹75L, 75% above).
     ------------------------------------------------------------------ */
  const ltvFor = (loan) => (loan <= 3e6 ? 0.9 : loan <= 7.5e6 ? 0.8 : 0.75);
  const initAfford = () => {
    const root = $('[data-calc-form="afford"]');
    if (!root) return;
    bindForm(root, ({ income, existing, rate, tenure, foir, savings }) => {
      const maxEmi = Math.max(0, income * (foir / 100) - existing);
      const loan = Calc.principalFromEmi(maxEmi, rate, tenure * 12);
      const ltv = ltvFor(loan);
      const byLtv = loan / ltv;
      const property = Math.min(byLtv, loan + savings);
      out(root, "max-emi", fmt(maxEmi));
      out(root, "max-loan", fmt(loan));
      out(root, "property", fmt(property));
      out(root, "ltv", `${Math.round(ltv * 100)}%`);
      out(root, "down", fmt(Math.max(0, property - loan)));
      const verdict = $('[data-out="verdict"]', root);
      if (verdict) {
        const ratio = existing / (income || 1);
        verdict.className = `ll-badge ${ratio > 0.3 ? "is-warning" : "is-success"}`;
        verdict.innerHTML =
          ratio > 0.3
            ? '<i class="bi bi-exclamation-triangle" aria-hidden="true"></i> Existing EMIs are high — clearing one could lift your budget'
            : '<i class="bi bi-check-circle" aria-hidden="true"></i> Healthy debt level for most lenders';
      }
    });
  };

  /* ------------------------------------------------------------------
     9. BALANCE TRANSFER SAVINGS
     ------------------------------------------------------------------ */
  const initTransfer = () => {
    const root = $('[data-calc-form="transfer"]');
    if (!root) return;
    bindForm(root, ({ outstanding, oldRate, newRate, remaining, fee }) => {
      const n = remaining * 12;
      const oldE = Calc.emi(outstanding, oldRate, n);
      const newE = Calc.emi(outstanding, newRate, n);
      const feeAmt = outstanding * (fee / 100);
      const net = (oldE - newE) * n - feeAmt;
      const breakEven = oldE - newE > 0 ? Math.ceil(feeAmt / (oldE - newE)) : 0;
      out(root, "old-emi", fmt(oldE));
      out(root, "new-emi", fmt(newE));
      out(root, "monthly-save", fmt(oldE - newE));
      out(root, "fee", fmt(feeAmt));
      out(root, "net", fmt(net));
      out(root, "break-even", breakEven ? `${breakEven} months` : "—");
      const v = $('[data-out="transfer-verdict"]', root);
      if (v) {
        const good = net > 0;
        v.className = `ll-badge ${good ? "is-success" : "is-danger"}`;
        v.innerHTML = good
          ? '<i class="bi bi-check-circle" aria-hidden="true"></i> Switching saves money'
          : '<i class="bi bi-x-circle" aria-hidden="true"></i> Fees outweigh the savings';
      }
    });
  };

  /* ------------------------------------------------------------------
     10. BOOT
     ------------------------------------------------------------------ */
  const boot = () => {
    initMini();
    initEmiPage();
    initPrepay();
    initAfford();
    initTransfer();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
