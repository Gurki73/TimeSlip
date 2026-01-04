// Components/customDatePicker/customDatePicker.js

export function createDateRangePicker(config) {
  const {
    startButton,
    endButton,
    startInput,
    endInput,
    previewStart,
    previewEnd,
    previewDuration,
    onChange
  } = config;

  const startBtn = document.querySelector(startButton);
  const endBtn = document.querySelector(endButton);
  const startEl = document.querySelector(startInput);
  const endEl = document.querySelector(endInput);
  const previewS = document.querySelector(previewStart);
  const previewE = document.querySelector(previewEnd);
  const previewD = document.querySelector(previewDuration);

  if (!startBtn || !endBtn || !startEl || !endEl) {
    throw new Error("DateRangePicker: missing required elements");
  }

  // ─────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────

  function isISO(dateStr) {
    return typeof dateStr === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function format(dateStr, type = "default") {
    if (!isISO(dateStr)) return "--.--.--";

    const [y, m, d] = dateStr.split("-");

    switch (type) {
      case "year":
        return `${d}.${m}.${y}`;
      case "employee":
        return `${d}.${m}-${y}`;
      default:
        return `${Number(d)}.${Number(m)}.${y.slice(2)}`;
    }
  }

  function calcDuration(a, b) {
    if (!isISO(a) || !isISO(b)) return "?";

    const [ay, am, ad] = a.split("-").map(Number);
    const [by, bm, bd] = b.split("-").map(Number);

    const startUTC = Date.UTC(ay, am - 1, ad);
    const endUTC = Date.UTC(by, bm - 1, bd);

    const days = (endUTC - startUTC) / 86400000;
    return days >= 0 ? days + 1 : "?";
  }

  // ─────────────────────────────────────────────
  // Preview update (NO side effects)
  // ─────────────────────────────────────────────

  function updatePreview() {
    const isEmployeePicker = previewS?.id?.includes("employee");
    const fmtType = isEmployeePicker ? "employee" : "year";

    if (previewS) previewS.textContent = format(startEl.value, fmtType);
    if (previewE) previewE.textContent = format(endEl.value, fmtType);

    if (previewD) {
      previewD.textContent = calcDuration(startEl.value, endEl.value);
    }
  }

  // ─────────────────────────────────────────────
  // Safe picker opening (CRITICAL)
  // ─────────────────────────────────────────────

  function openPickerSafe(inputEl, fallbackValue) {
    if (!isISO(inputEl.value)) {
      inputEl.value = fallbackValue;
    }

    // DO NOT touch preview here
    // DO NOT call focus after showPicker

    if (inputEl.showPicker) {
      inputEl.showPicker();
    } else {
      inputEl.focus();
    }
  }

  // ─────────────────────────────────────────────
  // Button handlers (focus-safe)
  // ─────────────────────────────────────────────

  function onStartClick(e) {
    e.preventDefault();
    openPickerSafe(startEl, todayISO());
  }

  function onEndClick(e) {
    e.preventDefault();
    openPickerSafe(
      endEl,
      isISO(startEl.value) ? startEl.value : todayISO()
    );
  }

  startBtn.addEventListener("mousedown", e => e.preventDefault());
  startBtn.addEventListener("click", onStartClick);

  endBtn.addEventListener("mousedown", e => e.preventDefault());
  endBtn.addEventListener("click", onEndClick);

  // ─────────────────────────────────────────────
  // Input change handlers (single source of truth)
  // ─────────────────────────────────────────────

  startEl.addEventListener("change", () => {
    // Keep values sane, but do NOT touch min/max while picker is open
    if (
      isISO(startEl.value) &&
      isISO(endEl.value) &&
      endEl.value < startEl.value
    ) {
      endEl.value = startEl.value;
    }

    updatePreview();
    onChange?.(startEl.value, endEl.value);
  });

  endEl.addEventListener("change", () => {
    if (
      isISO(startEl.value) &&
      isISO(endEl.value) &&
      startEl.value > endEl.value
    ) {
      startEl.value = endEl.value;
    }

    updatePreview();
    onChange?.(startEl.value, endEl.value);
  });

  // Initial render
  updatePreview();

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  return {
    update: updatePreview,
    getStart: () => startEl.value,
    getEnd: () => endEl.value,
    setStart: (v) => {
      startEl.value = v;
      updatePreview();
    },
    setEnd: (v) => {
      endEl.value = v;
      updatePreview();
    }
  };
}
