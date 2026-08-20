// Components\forms\request-form\request-overlap.js

function rangesOverlap(startA, endA, startB, endB) {
    return startA <= endB && endA >= startB;
}

function getEmployeeForRequest(request, employees) {
    return employees.find(
        employee => employee.id === request.employeeID
    );
}

export function renderRequestOverlaps({
    requests = [],
    employees = [],
    start,
    end,
    currentRequestId
}) {
    const warningContainer =
        document.querySelector('.request-form-warn');

    if (!warningContainer) {
        console.error(
            "🟣 renderRequestOverlaps: warning container not found"
        );
        return;
    }

    if (!start || !end) return;

    const overlappingRequests = requests.filter(request => {
        // Don't show the request currently being edited
        if (currentRequestId && request.id === currentRequestId) {
            return false;
        }

        // Ignore incomplete requests
        if (!request.start || !request.end) {
            return false;
        }

        return rangesOverlap(
            start,
            end,
            request.start,
            request.end
        );
    });

    console.log(
        "🟣 overlapping requests:",
        overlappingRequests
    );

    const statusGroups = {
        pending: [],
        approved: [],
        rejected: []
    };

    for (const request of overlappingRequests) {
        const employee = getEmployeeForRequest(
            request,
            employees
        );

        if (!employee) {
            console.warn(
                "🟣 Overlap: employee not found:",
                request.employeeID
            );
            continue;
        }

        if (!statusGroups[request.status]) {
            continue;
        }

        statusGroups[request.status].push(employee);
    }

    // Nothing overlaps → nothing to show
    if (
        statusGroups.pending.length === 0 &&
        statusGroups.approved.length === 0 &&
        statusGroups.rejected.length === 0
    ) {
        return;
    }

    const container = document.createElement('div');
    container.id = 'request-overlaps';
    container.className = 'request-overlaps noto';

    const renderGroup = (icon, employees) => {
        if (!employees.length) return '';

        return `
        <div class="request-overlap-group">
            <span class="request-overlap-status">${icon}</span>
            <span class="request-overlap-employees">
                ${employees
                .map(employee => `
                    <span
                        title="${employee.name}"
                        class="employee-emoji request-overlap-employee noto"
                        data-role="${employee.mainRoleIndex}"
                    >${employee.personalEmoji}</span>
                `)
                .join('')}
            </span>
        </div>
    `;
    };

    container.innerHTML = `
        --------------------------------
        <div class="request-overlap-title">
            Andere Anträge in diesem Zeitraum
        </div> <br>

        ${renderGroup('⏳ ausstehend:', statusGroups.pending)}
        ${renderGroup('✅ genehmigt :', statusGroups.approved)}
        ${renderGroup('❌ abgelehnt :', statusGroups.rejected)}
    `;

    warningContainer.appendChild(container);
}