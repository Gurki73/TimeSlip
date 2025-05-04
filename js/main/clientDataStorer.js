
function parseToCSV(data) {
    const header = 'Holiday Name,Start Date,End Date\n';
    const rows = data.map(holiday => {
        const name = holiday.name.map(n => n.text).join(', '); // Falls mehrere Namen vorhanden sind
        return `${name},${holiday.startDate},${holiday.endDate}`;
    }).join('\n');

    return header + rows;
}