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

  // ---- HARDENED ISO DATE VALIDATION ----
  function isISO(dateStr) {
    return typeof dateStr === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  }

  // ---- SAFER FORMATTER ----
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

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // ---- SAFE DURATION CALC ----
  function calcDuration(a, b) {
    if (!isISO(a) || !isISO(b)) return "?";

    const [ay, am, ad] = a.split("-").map(Number);
    const [by, bm, bd] = b.split("-").map(Number);

    const startUTC = Date.UTC(ay, am - 1, ad);
    const endUTC = Date.UTC(by, bm - 1, bd);

    const daysBetween = (endUTC - startUTC) / 86400000;

    if (isNaN(daysBetween) || daysBetween < 0) return "?";

    return daysBetween + 1; // inclusive [start, end]
  }

  // ---- UNIFIED PREVIEW UPDATE ----
  function updatePreview() {
    // detect if employee picker
    const isEmployeePicker = previewS.id?.includes("employee");
    const fmtType = isEmployeePicker ? "employee" : "year";

    previewS.textContent = format(startEl.value, fmtType);
    previewE.textContent = format(endEl.value, fmtType);

    if (previewD) {
      previewD.textContent = calcDuration(startEl.value, endEl.value);
    }

    if (isISO(startEl.value) && isISO(endEl.value)) {
      onChange?.(startEl.value, endEl.value);
    }
  }

  // ---- BUTTON → SHOW PICKER ----

  if (!startBtn || !startEl) {
    throw new Error("DateRangePicker: missing required elements");
  }
  startBtn.addEventListener("click", () => {
    if (!isISO(startEl.value)) {
      startEl.value = todayISO();
    }

    updatePreview(); // 👈 ensure preview is fresh

    startEl.showPicker?.() || startEl.focus();
  });

  if (!endBtn || !endEl) {
    throw new Error("DateRangePicker: missing required elements");
  }
  endBtn.addEventListener("click", () => {
    if (!isISO(endEl.value)) {
      endEl.value = isISO(startEl.value) ? startEl.value : todayISO();
    }

    updatePreview(); // 👈 ensure preview is fresh

    endEl.showPicker?.() || endEl.focus();
  });

  // ---- INPUT CHANGES ----
  startEl.addEventListener("change", () => {
    if (isISO(startEl.value)) {
      endEl.min = startEl.value;

      // If end is now invalid, snap it to start
      if (isISO(endEl.value) && endEl.value < startEl.value) {
        endEl.value = startEl.value;
      }
    } else {
      endEl.removeAttribute("min");
    }
    updatePreview();
    onChange?.(startEl.value, endEl.value);
  });

  endEl.addEventListener("change", () => {
    if (isISO(endEl.value)) {
      startEl.max = endEl.value;

      // If start is now invalid, snap it to end
      if (isISO(startEl.value) && startEl.value > endEl.value) {
        startEl.value = endEl.value;
      }
    } else {
      startEl.removeAttribute("max");
    }
    updatePreview();
    onChange?.(startEl.value, endEl.value);
  });

  // ---- PUBLIC API ----
  return {
    update: updatePreview,
    getStart: () => startEl.value,
    getEnd: () => endEl.value,
    setStart: (v) => { startEl.value = v; updatePreview(); },
    setEnd: (v) => { endEl.value = v; updatePreview(); }
  };

  function formatEU(dateStr) {
    if (!isISO(dateStr)) return "--.--.----";

    const date = new Date(dateStr + "T00:00:00"); // avoid timezone shift
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }
}