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
  function format(date, type = "default") {
    if (!isISO(date)) return "--.--.--";

    const [y, m, d] = date.split("-");

    switch (type) {
      case "year": // full DD.MM.YYYY
        return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`;

      case "employee": // old employee format
        return `${d.padStart(2, "0")}.${m.padStart(2, "0")}-${y}`;

      default: // short D.M.YY
        return `${parseInt(d)}.${parseInt(m)}.${y.slice(2)}`;
    }
  }

  // ---- SAFE DURATION CALC ----
  function calcDuration(a, b) {
    if (!isISO(a) || !isISO(b)) return "?";

    const ms = new Date(b) - new Date(a);
    if (isNaN(ms) || ms < 0) return "?";

    return ms / 86400000 + 1; // inclusive days
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

    onChange?.(startEl.value, endEl.value);
  }

  // ---- BUTTON → SHOW PICKER ----
  startBtn.addEventListener("click", () => {
    if (!isISO(startEl.value)) {
      startEl.value = new Date().toISOString().split("T")[0];
    }
    if (startEl) startEl.showPicker?.() || startEl.focus();
  });

  endBtn.addEventListener("click", () => {
    if (!isISO(endEl.value)) {
      endEl.value = new Date().toISOString().split("T")[0];
    }
    if (endEl) endEl.showPicker?.() || endEl.focus();
  });

  // ---- INPUT CHANGES ----
  startEl.addEventListener("change", updatePreview);
  endEl.addEventListener("change", updatePreview);

  // ---- PUBLIC API ----
  return {
    update: updatePreview,
    getStart: () => startEl.value,
    getEnd: () => endEl.value,
    setStart: (v) => { startEl.value = v; updatePreview(); },
    setEnd: (v) => { endEl.value = v; updatePreview(); }
  };
}
