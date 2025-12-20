
/* --------------------------------------------------------------------------
   RuleChecker – Save-Time Sanity Checks
   --------------------------------------------------------------------------
   Responsibilities:
   - Normalize raw rule blocks (main + secondary)
   - Detect contradictions
   - Detect redundancies / unnecessary complexity
   - Detect impossible or empty conditions
   - Validate exception logic (E)
   - Return result summary for UI + disable Save button if errors exist

   This file purposely does NOT modify UI directly except one exported helper.
   UI calls runSanityChecks() after each change or before save confirmation.
-------------------------------------------------------------------------- */

/* ==========================================================================
   1) ENUMS
   ========================================================================== */

export const RuleState = Object.freeze({
    OK: { label: "ok", icon: "✅", action: "pass" },
    WARNING: { label: "warning", icon: "⚠️", action: "warn" },
    ERROR: { label: "error", icon: "❌", action: "error" },
    PLACEHOLDER: { label: "placeholder", icon: "🧩", action: "warn" },
    REDUNDANT: { label: "redundant", icon: "♻️", action: "warn" },
    INCOMPLETE: { label: "incomplete", icon: "⚠️", action: "error" },
    CONTRADICTION: { label: "contradiction", icon: "❌", action: "error" }
});

export const CompareResult = Object.freeze({
    IDENTICAL: "identical",
    SUBSET: "subset",
    SUPERSET: "superset",
    PARTIAL: "partial",
    DISJOINT: "disjoint",
    OPPOSITE: "opposite",
    ONE_EMPTY: "one-empty",
    IGNORE: "ignore"
});

/* ==========================================================================
   2) NORMALIZER
   Converts flow-wizard raw block choices into normalized canonical rules:
   Example normalized rule:
   {
      timeframe: ["fri"],
      repeats: "every",
      role: ["chef"],
      min: 1, max: null,
      dependency: "present",
      exception: "none"
   }
   ========================================================================== */

function normalizeRule(ruleObj) {
    if (!ruleObj) return null;

    return {
        T: ruleObj.T?.id ?? "T0",
        W: ruleObj.W?.id ?? "W0",
        A: ruleObj.A?.id ?? "A1",
        G: ruleObj.G?.id ?? "G0",
        D: ruleObj.D?.id ?? "D0",
        E: ruleObj.E?.id ?? "E0",

        // numeric details
        number1: ruleObj.number1 ?? null,
        number2: ruleObj.number2 ?? null,

        // optional indices/arrays
        timeframeEntries: ruleObj.T?.indices ?? [],
        roleEntries: ruleObj.G?.indices ?? [],
        dependencyEntries: ruleObj.D?.indices ?? []
    };
}

/* ==========================================================================
   3) COMPARISON HELPERS
   ========================================================================== */

function compareSets(a, b) {
    if ((!a || a.length === 0) && (!b || b.length === 0)) {
        return CompareResult.IGNORE;
    }
    if (!a || a.length === 0 || !b || b.length === 0) {
        return CompareResult.ONE_EMPTY;
    }

    const A = new Set(a);
    const B = new Set(b);

    const intersection = [...A].filter(x => B.has(x));

    if (intersection.length === 0) return CompareResult.DISJOINT;
    if (intersection.length === A.size && intersection.length === B.size) {
        return CompareResult.IDENTICAL;
    }
    if (intersection.length === A.size) return CompareResult.SUBSET;
    if (intersection.length === B.size) return CompareResult.SUPERSET;

    return CompareResult.PARTIAL;
}

function compareAmounts(ruleA, ruleB) {
    const aMin = ruleA.number1 ?? 0;
    const aMax = ruleA.number2 ?? Infinity;

    const bMin = ruleB.number1 ?? 0;
    const bMax = ruleB.number2 ?? Infinity;

    // direct contradiction
    if (aMax < bMin || bMax < aMin) {
        return CompareResult.OPPOSITE;
    }

    // identical
    if (aMin === bMin && aMax === bMax) return CompareResult.IDENTICAL;

    // one is tighter constraint
    if (aMin >= bMin && aMax <= bMax) return CompareResult.SUBSET;
    if (bMin >= aMin && bMax <= aMax) return CompareResult.SUPERSET;

    return CompareResult.PARTIAL;
}

/* ==========================================================================
   4) CONTRADICTION DETECTOR
   ========================================================================== */

function detectContradictions(main, second) {
    const issues = [];

    // --- timeframe conflicts ---
    const tfCompare = compareSets(main.timeframeEntries, second.timeframeEntries);
    if (tfCompare === CompareResult.DISJOINT && main.T !== "T0" && second.T !== "T0") {
        // ok — different timeframes is NOT a contradiction
    }

    // --- amount clash (max < min) ---
    const amountCompare = compareAmounts(main, second);
    if (amountCompare === CompareResult.OPPOSITE) {
        issues.push({
            type: RuleState.CONTRADICTION,
            message: "Widerspruch: Mengenangaben schließen sich aus (min/max zu weit auseinander)."
        });
    }

    // dependency example:
    if ((main.D === "D0" && second.D === "D1") ||
        (main.D === "D1" && second.D === "D0")) {
        issues.push({
            type: RuleState.CONTRADICTION,
            message: "Widerspruch: Anwesenheit vs. Abwesenheit."
        });
    }

    return issues;
}

/* ==========================================================================
   5) REDUNDANCY CHECK
   ========================================================================== */

function detectRedundancy(main, second) {
    const redundancies = [];

    // identical conditions = unnecessary secondary block
    if (
        main.T === second.T &&
        main.W === second.W &&
        main.A === second.A &&
        main.G === second.G &&
        main.D === second.D
    ) {
        redundancies.push({
            type: RuleState.REDUNDANT,
            message: "Nebenbedingung ist identisch — redundant."
        });
    }

    return redundancies;
}

/* ==========================================================================
   6) EXCEPTION LOGIC CHECK
   ========================================================================== */

function validateException(main, second) {
    if (!second || !main) return [];

    const issues = [];

    switch (main.E) {
        case "E0": // no exception
            return [];
        case "E2": // OR
            // no contradiction, OR can combine disjoint
            return [];
        case "E3": // ABER (if secondary true → main invalid)
        case "E4": // AUSSER (similar semantics)
            // detect if secondary *always* overlaps main → impossible rule
            const tf = compareSets(main.timeframeEntries, second.timeframeEntries);
            if (tf === CompareResult.IDENTICAL) {
                issues.push({
                    type: RuleState.WARNING,
                    message: "Warnung: Ausnahme wirkt identisch — könnte Regel immer ungültig machen."
                });
            }
            return issues;
        case "E5": // limitation: “not more than”
        case "E6": // limitation: “not less than”
            // numeric logic handled by amount comparator
            return [];
        default:
            return [];
    }
}

/* ==========================================================================
   7) INCOMPLETE / MISSING CHECKS
   ========================================================================== */

function detectMissing(main) {
    const issues = [];

    if (main.G === "G0") {
        issues.push({ type: RuleState.INCOMPLETE, message: "Aufgabe/Gruppe fehlt." });
    }
    if (main.D === "D0" && main.G === "G0") {
        issues.push({ type: RuleState.INCOMPLETE, message: "Abhängigkeit ohne Aufgabe." });
    }
    if (main.T === "T0") {
        issues.push({ type: RuleState.INCOMPLETE, message: "Zeitraum fehlt." });
    }

    return issues;
}

export function initVisibilityChecker() {
    console.log("initVisibilityChecker");
}

export function resetRule() {
    console.log("resetRule");
}

/* ==========================================================================
   8) MAIN ENTRY POINT
   ========================================================================== */

export function runSanityChecks(ruleForEditing) {
    const main = normalizeRule(ruleForEditing);
    const secondary = ruleForEditing.e && ruleForEditing.e !== "E0"
        ? normalizeRule({
            T: ruleForEditing.t,
            W: ruleForEditing.w,
            A: ruleForEditing.a,
            G: ruleForEditing.g,
            D: ruleForEditing.d,
            number1: ruleForEditing.number1,
            number2: ruleForEditing.number2
        })
        : null;

    const errors = [];
    const warnings = [];

    // missing / incomplete
    detectMissing(main).forEach(e => {
        if (e.type.action === "error") errors.push(e); else warnings.push(e);
    });

    // contradictions main <-> secondary
    if (secondary) {
        detectContradictions(main, secondary).forEach(e => {
            if (e.type.action === "error") errors.push(e); else warnings.push(e);
        });

        detectRedundancy(main, secondary).forEach(e => warnings.push(e));

        validateException(main, secondary).forEach(e => {
            if (e.type.action === "error") errors.push(e); else warnings.push(e);
        });
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        normalized: { main, secondary }
    };
}

/* ==========================================================================
   9) SAVE BUTTON INTEGRATION
   ========================================================================== */

export function updateSaveButton(checkResult) {
    const saveBtn = document.getElementById("save-rule-button");
    if (!saveBtn) return;

    saveBtn.disabled = !checkResult.ok;
}

export function resolveConditionLimits(
    condition,
    roleCountsByRoleId
) {
    let _lowerLimit = 0;
    let _upperLimit = Infinity;

    const originalLowerLimit = condition.lowerLimit;
    const originalUpperLimit = condition.upperLimit;

    switch (condition.ratioType) {

        case 'WorkloadSumCheck': // AND + NEEDS
            // sum reference roles
            let total = 0;
            condition.referenceRoles.forEach(role => {
                total += roleCountsByRoleId(role);
            });

            // apply amount modifiers (placeholder logic)
            _lowerLimit = Math.floor(originalLowerLimit / total);
            _upperLimit = Math.ceil(originalUpperLimit / total);
            break;

        case 'PresenceRequirementCheck': // OR + NEEDS
            // presence-based: reference count > 0 triggers minimum
            break;

        case 'CapacityCheck': // AND + HELPS
            // combined support defines max subject capacity
            break;

        case 'SupervisionCheck': // OR + HELPS
            // sum of support roles defines supervision pool
            break;
    }

    return {
        lowerLimit: _lowerLimit,
        upperLimit: _upperLimit
    };
}
