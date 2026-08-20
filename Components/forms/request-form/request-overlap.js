// Components\forms\request-form\request-overlap.js 

export function renderRequestOverlaps({
    container,
    requests = [],
    employees = [],
    start,
    end,
    currentRequestId
}) {
    if (!container) return;
    console.log(container, requests, employees, start, end, currentRequestId);
    // No complete request range yet → no overlap information
    if (!start || !end) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = ' hello world';
}
