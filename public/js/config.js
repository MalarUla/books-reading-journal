// config.js
window.AppStrings = {
  statuses: [
    "Reading",
    "Completed",
    "Yet to Start",
    "Paused",
    "Waiting",
    "Not Interested"
  ],
  placeholders: {
    seriesName: "Series Name",
    author: "Author",
    genre: "Genre",
    subGenre: "Sub-Genre",
    bookName: (index) => `Book Name ${index}`,
    searchSeries: "Series Name",
    searchBook: "Book Name",
    searchAuthor: "Author"
  },
  labels: {
    status: "Reading Status",
    startingDate: "Starting Date",
    completedDate: "Completed Date",
    numberOfBooks: "Number of Books:"
  },
  buttons: {
    addBooks: "📚 Add Book(s)",
    search: "🔍 Search",
    reset: "♻️ Reset",
    generateReport: "📊 Reading Stats Report",
    saveChanges: "💾 Save Changes",
    logout: "⏻ Logout",
    backToTable: "← Back to Books Table",
    downloadXLSX: "Download XLSX",
    downloadCSV: "Download CSV (Books)",
    downloadAuditCSV: "Download CSV (Audit)",
    downloadPDF: "Download PDF",
    refreshGoogleSheet: "Refresh Google Sheet"
  },
  messages: {
    loading: "Loading report, please wait..."
  },
  firestore: {
    booksCollection: "books",
    auditCollection: "audit"
  },
  download: {
    sheetNames: {
      books: "Books Table",
      report: "Report Summary"
    },
    filenames: {
      booksCSV: () => `Books_${AppUtils.getFormattedDate()}.csv`,
      auditCSV: () => `Audit_${AppUtils.getFormattedDate()}.csv`,
      xlsx: () => `Books_${AppUtils.getFormattedDate()}.xlsx`,
      pdf: () => `Report_${AppUtils.getFormattedDate()}.pdf`
    }
  },
  alerts: {
    xlsxFail: "Failed to download XLSX",
    csvBooksFail: "Failed to download Books CSV",
    csvAuditFail: "Failed to download Audit CSV",
    pdfFail: "Failed to download PDF",
    sheetFail: "Error refreshing Google Sheet",
    sheetSuccess: "Google Sheet refreshed"
  },
};

// Optional utilities
window.AppUtils = {
  getFormattedDate: function () {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
};