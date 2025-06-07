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
    backToTable: "← Back to Books Table"
  },
  messages: {
    loading: "Loading report, please wait..."
  }
};
