import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Function to generate a minimal Excel file manually
async function exportToExcel(csvFiles) {
    const zip = new JSZip();

    // [Content_Types].xml
    const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    </Types>`;
    zip.file("[Content_Types].xml", contentTypes);

    // _rels/.rels
    const rels = `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
    </Relationships>`;
    zip.file("_rels/.rels", rels);

    // xl/workbook.xml
    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheets>
            <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
        </sheets>
    </workbook>`;
    zip.file("xl/workbook.xml", workbook);

    // xl/worksheets/sheet1.xml
    const sheetData = csvFiles[0].data.map((row, i) => `
        <row r="${i + 1}">
            ${row.map((cell, j) => `<c r="${String.fromCharCode(65 + j)}${i + 1}" t="inlineStr"><is><t>${cell}</t></is></c>`).join('')}
            </row>`).join('');

    const sheet = `<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <sheetData>${sheetData}</sheetData>
    </worksheet>`;
    zip.file("xl/worksheets/sheet1.xml", sheet);

    // Create the zip file
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "exported_data.xlsx");
}

export { exportToExcel };