document.addEventListener("DOMContentLoaded", () => {
    const reportBtn = document.getElementById("generate-report-btn");
    const backBtn = document.getElementById("back-to-table-btn");

    const searchControls = document.getElementById("search-controls");
    const booksTable = document.getElementById("books-table");
    const reportContainer = document.getElementById("reading-stats-container");

    reportBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        document.getElementById("save-btn").disabled = true; // Disable Save button

        // Show loader
        document.getElementById("loading-overlay").classList.remove("hidden");

        // Hide table and controls
        searchControls.classList.add("hidden");
        booksTable.classList.add("hidden");

        // Show report section and back button
        reportContainer.classList.remove("hidden");
        backBtn.classList.remove("hidden");

        // Hide the report button
        reportBtn.classList.add("hidden");

        try {
            await generateReadingStats();
        } catch (err) {
            console.error("Error generating stats:", err);
            alert("Failed to load stats. Please try again.");
        }

        // Hide loader
        document.getElementById("loading-overlay").classList.add("hidden");
    });


    backBtn.addEventListener("click", () => {
        // Show table and controls
        searchControls.classList.remove("hidden");
        booksTable.classList.remove("hidden");

        // Hide report section
        reportContainer.classList.add("hidden");

        // Show report button again
        reportBtn.classList.remove("hidden");

        // Hide the back button
        backBtn.classList.add("hidden");
    });
});


async function generateReadingStats() {
    const tableRef = document.getElementById("reading-stats-table");
    const summaryDiv = document.getElementById("reading-summary");
    tableRef.innerHTML = "";
    summaryDiv.innerHTML = "";

    const currentUser = firebase.auth().currentUser;
    const snapshot = await db.collection("books").where("userId", "==", currentUser.uid).get();

    //const snapshot = await db.collection("books").get();
    const data = snapshot.docs.map(doc => doc.data());

    const currentYear = new Date().getFullYear();
    const statusCounts = {};
    const completedByYearMonth = {};

    let readingCount = 0, completedCount = 0;

    data.forEach(book => {
        const status = book.status || "Unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        if (status === "Reading") readingCount++;
        if (status === "Completed") completedCount++;

        if (status === "Completed" && book.completedDate) {
            const date = book.completedDate.toDate ? book.completedDate.toDate() : new Date(book.completedDate);
            const year = date.getFullYear();
            const month = date.getMonth(); // 0-11

            if (!completedByYearMonth[year]) completedByYearMonth[year] = Array(12).fill(0);
            completedByYearMonth[year][month]++;
        }
    });

    // Summary row
    summaryDiv.innerHTML = `
    <div class="summary-row">
        <p><strong>Currently Reading:</strong> ${readingCount}</p>
        <p><strong>Total Completed:</strong> ${completedCount}</p>
    </div>
    `;

    // Yearly completed books table
    const tableHTML = buildCompletedBooksTable(completedByYearMonth);
    tableRef.innerHTML = tableHTML;

    drawStatusBarChart(statusCounts);
    drawMonthlyLineChart(completedByYearMonth);

    const readingDurations = calculateMonthlyReadingDurations(data);
    renderReadingDurationTable(readingDurations);
    drawReadingDurationChart(readingDurations);
}

function drawStatusBarChart(data) {
    if (window.statusBarChart && typeof window.statusBarChart.destroy === 'function') {
        window.statusBarChart.destroy();
    }

    const ctx = document.getElementById("statusBarChart").getContext("2d");
    window.statusBarChart = new Chart(ctx, {
    type: "bar",
    data: {
        labels: Object.keys(data),
        datasets: [{
        label: "Books by Status",
        data: Object.values(data),
        backgroundColor: "rgba(75, 192, 192, 0.6)"
        }]
    },
    options: {
        responsive: true,
        plugins: {
        legend: { display: false },
        title: {
            display: true,
            text: "Books by Status"
        }
        }
    }
    });
}

let monthlyLineChart;
function drawMonthlyLineChart(completedByYearMonth) {
  const canvas = document.getElementById("monthlyLineChart");
  if (!canvas) {
    console.warn("monthlyLineChart canvas not found.");
    return;
  }

  const ctx = canvas.getContext("2d");

  if (monthlyLineChart && typeof monthlyLineChart.destroy === 'function') {
    monthlyLineChart.destroy();
  }

  const datasets = Object.entries(completedByYearMonth).map(([year, counts]) => {
    const safeCounts = Array.isArray(counts)
      ? counts.map(c => (typeof c === "number" && !isNaN(c) ? c : 0))
      : Array(12).fill(0);

    return {
      label: year,
      data: safeCounts,
      fill: false,
      borderColor: getRandomColor(),
      tension: 0.1
    };
  });

  if (datasets.length === 0) {
    console.warn("No valid data to render monthly line chart.");
    return;
  }

  monthlyLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      datasets: datasets
    },
    options: {
      responsive: false,
      animation: false,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Completed Books Per Month by Year' }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}


function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
    return color;
}

function buildCompletedBooksTable(data) {
    let html = `
    <h3 style="margin-top:2rem;">Completed Books By Month</h3>
    <table class="styled-report-table">
        <thead>
        <tr>
            <th>Year</th>${["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                            .map(m => `<th>${m}</th>`).join('')}
            <th>Total</th>
        </tr>
        </thead>
        <tbody>
    `;

    for (const year in data) {
        const monthlyCounts = data[year];
        const total = monthlyCounts.reduce((sum, val) => sum + val, 0);

        html += `<tr><td>${year}</td>`;
        monthlyCounts.forEach(val => {
            const displayVal = val === 0 ? `<span style="color:red;">0</span>` : val;
            html += `<td>${displayVal}</td>`;
        });
        html += `<td><strong>${total}</strong></td></tr>`;
    }

    html += "</tbody></table>";
    return html;
}


function calculateMonthlyReadingDurations(data) {
    const durationsByYearMonth = {}; // { 2025: [0, 0, ..., 0] }

    const today = new Date();

    data.forEach(book => {
        const status = book.status || "";
        const start = getDate(book.startedDate);
        const paused = getDate(book.pausedDate);
        const resumed = getDate(book.resumedDate);
        const completed = getDate(book.completedDate);
        const stopped = getDate(book.stoppedDate);

        let from = null;
        let to = null;

        if (status === "Reading") {
            if (resumed && paused) {
                from = start;
                to = today;
            } else if (paused) {
                from = start;
                to = paused;
            } else {
                from = start;
                to = today;
            }
        } else if (status === "Paused") {
            if (paused && start) {
                from = start;
                to = paused;
            }
        } else if (status === "Completed") {
            if (resumed && paused) {
                from = start;
                to = completed;
            } else if (completed && start) {
                from = start;
                to = completed;
            }
        } else if (status === "Not Interested") {
            if (resumed && paused) {
                from = start;
                to = stopped;
            } else if (paused && start) {
                from = start;
                to = paused;
            } else if (stopped && start) {
                from = start;
                to = stopped;
            }
        }

        if (!from || !to || to < from) return;

        const current = new Date(from);
        current.setHours(0, 0, 0, 0);
        const end = new Date(to);
        end.setHours(0, 0, 0, 0);

        while (current <= end) {
            const year = current.getFullYear();
            const month = current.getMonth(); // 0-11

            if (!durationsByYearMonth[year]) {
                durationsByYearMonth[year] = Array(12).fill(0);
            }

            // Cap monthly days at actual month length
            const maxDays = new Date(year, month + 1, 0).getDate();
            if (durationsByYearMonth[year][month] < maxDays) {
                durationsByYearMonth[year][month]++;
            }

            current.setDate(current.getDate() + 1);
        }
    });

    return durationsByYearMonth;
}

function getDate(dateField) {
    if (!dateField) return null;
    return typeof dateField.toDate === "function" ? dateField.toDate() : new Date(dateField);
}

function getDaysDiff(date1, date2) {
    if (!(date1 instanceof Date) || !(date2 instanceof Date)) return 0;
    const diffTime = date1 - date2;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function renderReadingDurationTable(durationsByYearMonth) {
    const tableDiv = document.getElementById("reading-duration-table");
    let html = `
    <h3 style="margin-top:2rem;">Read Days Per Month</h3>
    <table class="styled-report-table">
        <thead>
        <tr>
            <th>Year</th>${["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                            .map(m => `<th>${m}</th>`).join('')}
            <th>Total</th>
        </tr>
        </thead>
        <tbody>
    `;

    for (const year in durationsByYearMonth) {
        const monthlyDurations = durationsByYearMonth[year];
        const total = monthlyDurations.reduce((sum, val) => sum + val, 0);

        html += `<tr><td>${year}</td>`;
        monthlyDurations.forEach(val => {
            const displayVal = val === 0 ? `<span style="color:red;">0</span>` : val;
            html += `<td>${displayVal}</td>`;
        });
        html += `<td><strong>${total}</strong></td></tr>`;
    }

    html += "</tbody></table>";
    tableDiv.innerHTML = html;
}

let readingDurationChart;
function drawReadingDurationChart(durationData) {
  const ctx = document.getElementById("readingDurationChart").getContext("2d");

  if (readingDurationChart) readingDurationChart.destroy();

  const datasets = Object.entries(durationData).map(([year, durations]) => ({
    label: year,
    data: durations,
    backgroundColor: getRandomColor(),
    borderWidth: 1
  }));

  readingDurationChart = new Chart(ctx, {
    type: "bar",
    data: {
        labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        datasets: datasets
    },
    options: {
        responsive: false,
        plugins: {
        title: {
            display: true,
            text: "Read Days Per Month by Year"
        },
        legend: {
            position: 'bottom'
        }
        },
        scales: {
        y: { beginAtZero: true, title: { display: true, text: 'Days' } }
        }
    }
  });
}

