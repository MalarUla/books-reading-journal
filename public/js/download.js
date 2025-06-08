// download.js
import { writeFile, utils } from "https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs";

// Utility to format date
function getFormattedDate() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Fetch books for current user
async function fetchBooksData() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) throw new Error("User not logged in");

    const snapshot = await firebase.firestore()
        .collection("books")
        .where("userId", "==", currentUser.uid)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Fetch audit logs for current user
async function fetchAuditData() {
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) throw new Error("User not logged in");

    const snapshot = await firebase.firestore()
        .collection("audit")
        .where("userId", "==", currentUser.uid)
        .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function getReportData() {
    const statsTableContainer = document.getElementById("reading-stats-table");
    const durationTableContainer = document.getElementById("reading-duration-table");

    const statsTable = statsTableContainer?.querySelector("table");
    const durationTable = durationTableContainer?.querySelector("table");

    const result = [];

    // Handle reading stats table
    if (statsTable && statsTable.rows.length > 0) {
        result.push(["Completed Books By Month"]);
        const statRows = Array.from(statsTable.rows).map(row =>
            Array.from(row.cells).map(cell => cell.innerText.trim())
        );
        result.push(...statRows);
        result.push([]); // blank line
    }

    // Handle reading duration table
    if (durationTable && durationTable.rows.length > 0) {
        result.push(["Monthly Reading Durations"]);
        const durationRows = Array.from(durationTable.rows).map(row =>
            Array.from(row.cells).map(cell => cell.innerText.trim())
        );
        result.push(...durationRows);
    }

    // Handle no data case
    if (result.length === 0) {
        return [["No report data available"]];
    }

    return result;
}

// Download handlers
async function downloadXLSX() {
    try {
        const wb = utils.book_new();

        const books = await fetchBooksData();
        const report = getReportData();
        if (!Array.isArray(report) || !Array.isArray(report[0])) {
           throw new Error("Report data is not a valid 2D array");
        }

        if (books.length > 0) {
            const booksSheet = utils.json_to_sheet(books);
            utils.book_append_sheet(wb, booksSheet, "Books Table");
        }

        if (report.length > 0) {
            const reportSheet = utils.aoa_to_sheet(report);
            utils.book_append_sheet(wb, reportSheet, "Report Summary");
        }

        writeFile(wb, `Books_${getFormattedDate()}.xlsx`);
    } catch (err) {
        console.error("Failed to download XLSX:", err);
        alert("Failed to download XLSX: " + err.message);
    }
}

async function downloadCSVBooks() {
    try {
        const books = await fetchBooksData();
        const ws = utils.json_to_sheet(books);
        const csv = utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: "text/csv" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Books_${getFormattedDate()}.csv`;
        a.click();
    } catch (err) {
        console.error("Failed to download Books CSV:", err);
        alert("Failed to download Books CSV: " + err.message);
    }
}

async function downloadAuditCSV() {
    try {
        const audit = await fetchAuditData();
        const ws = utils.json_to_sheet(audit);
        const csv = utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: "text/csv" });

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `Audit_${getFormattedDate()}.csv`;
        a.click();
    } catch (err) {
        console.error("Failed to download Audit CSV:", err);
        alert("Failed to download Audit CSV: " + err.message);
    }
}

function downloadPDF() {
    const container = document.getElementById("reading-stats-container");
    if (!container) return;

    const wasHidden = container.classList.contains("hidden");
    if (wasHidden) container.classList.remove("hidden");

    const opt = {
        margin:       0.5,
        filename:     `Report_${getFormattedDate()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(container).save().then(() => {
        if (wasHidden) container.classList.add("hidden");
    });
}


function refreshGoogleSheetData() {
    fetch('/refresh-google-sheet', { method: 'POST' })
        .then(res => res.json())
        .then(data => alert('Google Sheet refreshed'))
        .catch(err => {
            console.error('Error refreshing Google Sheet:', err);
            alert('Error refreshing sheet: ' + err.message);
        });
}

// Attach all download menu events after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const iconBtn = document.getElementById('download-icon');
    const optionsBox = document.getElementById('download-options');

    if (iconBtn && optionsBox) {
        iconBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log("Download icon clicked");
            optionsBox.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            optionsBox.classList.add('hidden');
        });

        optionsBox.addEventListener('click', e => e.stopPropagation());
    }

    document.getElementById('download-xlsx')?.addEventListener('click', downloadXLSX);
    document.getElementById('download-csv')?.addEventListener('click', downloadCSVBooks);
    document.getElementById('download-audit-csv')?.addEventListener('click', downloadAuditCSV);
    document.getElementById('download-pdf')?.addEventListener('click', downloadPDF);
    document.getElementById('refresh-google-sheet')?.addEventListener('click', refreshGoogleSheetData);
});
