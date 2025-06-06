let table;
document.addEventListener('DOMContentLoaded', () => {
    table = new Tabulator("#books-table", {
        layout: "fitColumns",
        movableColumns: true,
        reactiveData: true,
        selectable: true,
        rowSelectable: function(row) {
            return row.getData().status !== "Completed";
        },
        rowFormatter: function(row) {
            const data = row.getData();
            const el = row.getElement();

            el.classList.remove(
                "status-reading",
                "status-completed",
                "status-yet-to-start",
                "status-paused",
                "status-waiting",
                "status-not-interested"
            );

            switch (data.status) {
                case "Reading":
                    el.classList.add("status-reading");
                    break;
                case "Completed":
                    el.classList.add("status-completed");
                    break;
                case "Yet to Start":
                    el.classList.add("status-yet-to-start");
                    break;
                case "Paused":
                    el.classList.add("status-paused");
                    break;
                case "Waiting":
                    el.classList.add("status-waiting");
                    break;
                case "Not Interested":
                    el.classList.add("status-not-interested");
                    break;
            }
        },
        columns: [
            {
                formatter: (cell) => {
                    const rowData = cell.getRow().getData();
                    const checked = cell.getRow().isSelected() ? "checked" : "";
                    const disabled = rowData.status === "Completed" && !changedRowsMap.has(rowData.id) ? "disabled" : "";
                    return `<input type="checkbox" ${checked} ${disabled} style="pointer-events: none;">`;
                },
                titleFormatter: () => '<input type="checkbox" disabled>',
                hozAlign: "center",
                headerSort: false,
                width: 50,
                cellClick: (e, cell) => {
                    const data = cell.getRow().getData();
                    if (data.status !== "Completed") {
                        cell.getRow().toggleSelect();
                    }
                }
            },
            { title: "Series Name", field: "seriesName", editor: "input", editable: isEditable },
            { title: "Book Name", field: "bookName", editor: "input", editable: isEditable },
            { title: "Author", field: "author", editor: "input", editable: isEditable },
            { title: "Genre", field: "genre", editor: "input", editable: isEditable },
            { title: "Sub-Genre", field: "subGenre", editor: "input", editable: isEditable },
            {
                title: "Reading Status",
                field: "status",
                editor: "list",
                editorParams: {
                    values: ["Reading", "Completed", "Paused", "Yet to Start", "Waiting", "Not Interested"],
                    autocomplete: false,
                    clearable: false
                },
                editable: isEditable
            },
            { title: "Started Date", field: "startedDate", editor: dateEditor, formatter: formatFirestoreTimestamp, editable: isEditable },
            { title: "Completed Date", field: "completedDate", editor: dateEditor, formatter: formatFirestoreTimestamp, editable: isEditable },
            { title: "Paused Date", field: "pausedDate", editor: dateEditor, formatter: formatFirestoreTimestamp, editable: isEditable },
            { title: "Resumed Date", field: "resumedDate", editor: dateEditor, formatter: formatFirestoreTimestamp, editable: isEditable },
            { title: "Stopped Date", field: "stoppedDate", editor: dateEditor, formatter: formatFirestoreTimestamp, editable: isEditable },
            { title: "Entry Date", field: "entryDate", formatter: formatFirestoreTimestamp },
        ],
        height: "500px",
        placeholder: "No books to display.",

        cellEdited: async (cell) => {
            const data = cell.getRow().getData();
            const docId = data.id;
            const field = cell.getField();
            const oldValue = cell.getOldValue();

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split("T")[0];

            if (field === "status") {
                const prevStatus = oldValue;
                const newStatus = data.status;

                if (newStatus === "Reading") {
                    if (!data.startedDate) data.startedDate = todayStr;
                    if (prevStatus === "Paused") {
                        data.resumedDate = todayStr;
                    }
                }

                if (newStatus === "Completed") {
                    if (!data.startedDate) data.startedDate = todayStr;
                    if (!data.completedDate) data.completedDate = todayStr;
                    
                    // 🔽 TEMPORARY FLAG TO ALLOW EDITING BEFORE SAVE
                    cell.getRow().update({ _transitionalCompleted: true });

                }

                if (newStatus === "Paused") {
                    if (!data.startedDate) data.startedDate = todayStr;
                    if (!data.pausedDate) data.pausedDate = todayStr;
                }

                if (newStatus === "Not Interested") {
                    data.stoppedDate = todayStr;
                }
                cell.getRow().update(data);
                
                // ⬇️ ADD THIS to re-render checkbox cell
                const checkboxCell = cell.getRow().getCell("");
                if (checkboxCell) {
                    checkboxCell.getElement().innerHTML = checkboxCell.getColumn().getDefinition().formatter(checkboxCell);
                }

            }

            const started = data.startedDate ? new Date(data.startedDate) : null;
            const completed = data.completedDate ? new Date(data.completedDate) : null;
            const paused = data.pausedDate ? new Date(data.pausedDate) : null;
            const resumed = data.resumedDate ? new Date(data.resumedDate) : null;

            let validationError = false;

            if (completed && started && completed < started) {
                alert("Completed date cannot be before Started date.");
                data.completedDate = "";
                validationError = true;
            }
            if (paused && started && paused < started) {
                alert("Paused date cannot be before Started date.");
                data.pausedDate = "";
                validationError = true;
            }
            if (resumed && paused && resumed < paused) {
                alert("Resumed date cannot be before Paused date.");
                data.resumedDate = "";
                validationError = true;
            }

            // Re-apply corrected data to table
            if (validationError) {
                cell.getRow().update(data);
                return;
            }

            const jsonOriginal = originalDataMap.get(docId);
            const normalized = normalize(data);
            const jsonUpdated = JSON.stringify(normalized);

            if (jsonOriginal !== jsonUpdated) {
                changedRowsMap.set(docId, { ...data });
                document.getElementById("save-btn").disabled = false;
            } else {
                changedRowsMap.delete(docId);
                if (changedRowsMap.size === 0) {
                    document.getElementById("save-btn").disabled = true;
                }
            }
            
            try {
                const { id, ...bookData } = data;
                await db.collection("books").doc(docId).set(bookData);
            } catch (err) {
                alert("Error updating document: " + err.message);
            }
        }
    });

    function normalize(obj) {
        const clone = structuredClone(obj);
        for (const key in clone) {
            if (clone[key]?.toDate) {
                clone[key] = clone[key].toDate().toISOString();
            } else if (clone[key] instanceof Date) {
                clone[key] = clone[key].toISOString();
            }
        }
        return clone;
    }

    function isEditable(cell) {
        const rowData = cell.getRow().getData();
        return rowData.status !== "Completed" || rowData._transitionalCompleted === true;
    }

    function dateEditor(cell, onRendered, success, cancel) {
        const value = cell.getValue();
        const input = document.createElement("input");
        input.type = "date";

        // Set max date to today to prevent future selection
        const today = new Date().toISOString().split("T")[0];
        input.max = today;

        // Convert Firestore Timestamp or Date to YYYY-MM-DD
        if (value?.toDate) {
            const date = value.toDate();
            input.value = date.toISOString().split("T")[0];
        } else if (value instanceof Date) {
            input.value = value.toISOString().split("T")[0];
        } else if (typeof value === "string" || typeof value === "number") {
            const date = new Date(value);
            input.value = date.toISOString().split("T")[0];
        }

        input.style.width = "100%";
        input.style.boxSizing = "border-box";

        onRendered(() => input.focus());

        input.addEventListener("change", () => {
            const newDate = input.value ? new Date(input.value) : null;
            success(newDate ? firebase.firestore.Timestamp.fromDate(newDate) : null);
        });

        input.addEventListener("blur", () => {
            cancel();
        });

        return input;
    }


    function dateInput(cell, onRendered, success, cancel) {
        const cellValue = cell.getValue();
        const input = document.createElement("input");
        input.setAttribute("type", "date");
        input.style.padding = "3px";
        input.style.width = "100%";
        input.value = cellValue || "";

        onRendered(() => {
            input.focus();
            input.style.height = "100%";
        });

        input.addEventListener("change", () => success(input.value));
        input.addEventListener("blur", () => success(input.value));
        input.addEventListener("keydown", (e) => {
            if (e.keyCode === 13) success(input.value);
            if (e.keyCode === 27) cancel();
        });

        return input;
    }

    const saveBtn = document.getElementById("save-btn");
    const saveStatus = document.getElementById("save-status");
    let changedRows = new Set();
    let originalDataMap = new Map();
    let changedRowsMap = new Map();

    // Load from Firestore
    async function loadBooks() {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            console.warn("User not logged in. Cannot load books.");
            return;
        }

        const snapshot = await db.collection("books").where("userId", "==", currentUser.uid).get();

        const books = snapshot.docs.map(doc => {
            const book = { id: doc.id, ...doc.data() };
            originalDataMap.set(book.id, JSON.stringify(normalize(book)));
            return book;
        });

          const statusPriority = {
            "Reading": 1,
            "Paused": 2,
            "Yet to Start": 3,
            "Waiting": 4,
            "Completed": 5,
            "Not Interested": 6
        };

        books.sort((a, b) => {
            const aPriority = statusPriority[a.status] || 99;
            const bPriority = statusPriority[b.status] || 99;
            return aPriority - bPriority;
        });

        table.setData(books);
    }

    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            loadBooks(); // ✅ call here only after auth is ready
        } else {
            console.warn("User not logged in. Cannot load books.");
        }
    });

    table.on("cellEditing", function (cell) {
        const rowData = cell.getRow().getData();

        if (rowData.status === "Completed" && !rowData._transitionalCompleted) {
            // Prevent edit
            return false;
        }
    });


    // Enable save button on edit and check the row's checkbox
    table.on("cellEdited", function (cell) {
        const row = cell.getRow();
        const rowData = row.getData();
        const field = cell.getField();

        // Automatically check the row
        row.update({ selected: true });

        if (rowData.id) {
            changedRows.add(rowData.id);
        }

        // === Highlight Required Dates Based on Status ===
        if (field === "status") {
            highlightRequiredDateCells(row);
            
            // Allow editing until Save
            row.getElement().classList.remove("row-disabled");
            row.getCells().forEach(cell => {
                cell.getElement().classList.remove("non-editable");
            });
        }


        // === Validate Date Relationships ===
        validateDateDependencies(row);
        
        saveBtn.disabled = false;
    });

    function validateDateDependencies(row) {
        const data = row.getData();
        let validationError = false;

        const started = data.startedDate ? new Date(data.startedDate) : null;
        const completed = data.completedDate ? new Date(data.completedDate) : null;
        const paused = data.pausedDate ? new Date(data.pausedDate) : null;
        const resumed = data.resumedDate ? new Date(data.resumedDate) : null;

        if (completed && started && completed < started) {
            showToast("❌ Completed date cannot be before Started date.");
            row.update({ completedDate: "" });
            validationError = true;
        }
        if (paused && started && paused < started) {
            showToast("❌ Paused date cannot be before Started date.");
            row.update({ pausedDate: "" });
            validationError = true;
        }
        if (resumed && paused && resumed < paused) {
            showToast("❌ Resumed date cannot be before Paused date.");
            row.update({ resumedDate: "" });
            validationError = true;
        }

        return !validationError;
    }

    function highlightRequiredDateCells(row) {
        const rowData = row.getData();
        const el = row.getElement();
        const status = rowData.status;

        const dateFields = {
            Completed: ["startedDate", "completedDate"],
            Reading: ["startedDate"],
            Paused: ["startedDate", "pausedDate"],
            "Not Interested": ["stoppedDate"],
        };

        // Remove any previous highlights
        el.querySelectorAll("td").forEach((td) => {
            td.classList.remove("highlight-missing");
        });

        // Create a fresh Date instance to auto-fill
        const today = new Date();
        const updateData = {};

        if (dateFields[status]) {
            dateFields[status].forEach((field) => {
                const fieldValue = rowData[field];
                // Check for blank or invalid date
                if (!fieldValue) {
                    updateData[field] = today.toISOString();
                    // Add visual highlight
                    const cell = row.getCell(field);
                    if (cell) {
                        const td = cell.getElement();
                        td.classList.add("highlight-missing");
                    }
                }
            });

            // ✅ Add transitional flag ONLY for Completed
            if (status === "Completed") {
                updateData._transitionalCompleted = true;
            }

            if (Object.keys(updateData).length > 0) {
                row.update(updateData); // triggers redraw and updates internal state
            }
        }
    }

    // Save button click handler
    saveBtn.addEventListener("click", async () => {
        if (changedRows.size === 0 || saveBtn.disabled) return;

        // Clear previous highlights
        table.getRows().forEach(row => {
            row.getElement().querySelectorAll("td").forEach(td => {
                td.classList.remove("highlight-missing");
            });
        });

        // === VALIDATION START ===
        let hasError = false;

        changedRows.forEach((id) => {
            const row = table.getRow(id);
            const data = row.getData();
            const status = data.status;

            const requiredFieldsByStatus = {
                "Completed": ["startedDate", "completedDate"],
                "Reading": ["startedDate"],
                "Paused": ["startedDate", "pausedDate"],
                "Not Interested": ["stoppedDate"],
            };

            const requiredFields = requiredFieldsByStatus[status];
            if (requiredFields) {
                requiredFields.forEach((field) => {
                    const cell = row.getCell(field);
                    const value = data[field];

                    // Highlight only if missing
                    if (!value || String(value).trim() === "") {
                        if (cell) cell.getElement().classList.add("highlight-missing");
                        hasError = true;
                    } else {
                        if (cell) cell.getElement().classList.remove("highlight-missing");
                    }
                });
            }
        });

        if (hasError) {
            saveStatus.innerText = "❌ Fill all required date fields!";
            showToast("Please fill all required date fields based on the selected status before saving.");
            return;
        }
        // === VALIDATION END ===

        // Disable button and show saving...
        saveBtn.disabled = true;
        saveStatus.innerText = "⏳ Saving...";

        const updates = {};
        changedRows.forEach((id) => {
            const rowData = table.getRow(id).getData();
            updates[id] = { ...rowData };
            delete updates[id].selected; // Optionally exclude 'selected' from DB
        });

        try {
            const batch = firebase.firestore().batch();
            const booksRef = firebase.firestore().collection("books"); // adjust if your collection is named differently

            for (const id in updates) {
                const cleanData = { ...updates[id] };
                delete cleanData._transitionalCompleted; // remove before saving

                const docRef = booksRef.doc(id);
                batch.set(docRef, updates[id], { merge: true });
            }

            await batch.commit();

            Object.entries(updates).forEach(([id, rowData]) => {
                const row = table.getRow(id);
                if (row) {
                    // Clean up flag
                    row.update({ _transitionalCompleted: false });

                    if (rowData.status === "Completed" && rowData.completedDate && String(rowData.completedDate).trim() !== "") {
                        row.getElement().classList.add("completed-row");
                        row.getCells().forEach(cell => {
                            cell.getElement().classList.add("non-editable");
                        });
                    }
                }
            });

            // Reset UI after success
            changedRows.clear();
            saveStatus.innerText = "✅ Changes saved!";
            setTimeout(() => {
                saveStatus.innerText = "";
            }, 3000);
        } catch (error) {
            console.error("Error saving data:", error);
            saveStatus.innerText = "❌ Save failed!";
        } finally {
            saveBtn.disabled = true;
            updateRowEditability();
        }
    });

    function updateRowEditability() {
        table.getRows().forEach((row) => {
            const data = row.getData();
            const element = row.getElement();

            if (data.status === "Completed" && !changedRows.has(data.id)) {
                element.classList.add("row-disabled");
                row.getCells().forEach(cell => {
                    cell.getElement().classList.add("non-editable");
                });
            } else {
                element.classList.remove("row-disabled");
                row.getCells().forEach(cell => {
                    cell.getElement().classList.remove("non-editable");
                });
            }
        });
    }

    // Manage dynamic form behavior
    const statusSelect = document.getElementById("status");
    const startedDateInput = document.getElementById("startedDate");
    const completedDateInput = document.getElementById("completedDate");
    const startDateContainer = document.getElementById("startDateContainer");
    const completedDateContainer = document.getElementById("completedDateContainer");
    const dateFields = document.getElementById("dateFields");
    const today = new Date().toLocaleDateString("en-CA");

    function updateDateFields() {
        const status = statusSelect.value;

        startDateContainer.classList.add("hidden");
        completedDateContainer.classList.add("hidden");
        dateFields.classList.add("hidden");

        startedDateInput.value = "";
        completedDateInput.value = "";
        startedDateInput.removeAttribute("required");
        completedDateInput.removeAttribute("required");

        if (status === "Reading") {
            startDateContainer.classList.remove("hidden");
            dateFields.classList.remove("hidden");
            startedDateInput.value = today;
            startedDateInput.max = today;
            startedDateInput.required = true;
        } else if (status === "Completed") {
            startDateContainer.classList.remove("hidden");
            completedDateContainer.classList.remove("hidden");
            dateFields.classList.remove("hidden");
            startedDateInput.value = today;
            completedDateInput.value = today;
            startedDateInput.max = today;
            completedDateInput.max = today;
            startedDateInput.required = true;
            completedDateInput.required = true;
        }
    }

    statusSelect.addEventListener("change", updateDateFields);
    updateDateFields(); // Run once on load

    document.getElementById("search-btn").addEventListener("click", () => {
        document.getElementById("save-btn").disabled = true; // Disable Save button
        const s = id => document.getElementById(id).value.toLowerCase();
        const status = document.getElementById("search-status").value;
        table.setFilter(row => {
            const d = row;
            return (!s("search-series") || (d.seriesName || "").toLowerCase().includes(s("search-series")))
            && (!s("search-book") || (d.bookName || "").toLowerCase().includes(s("search-book")))
            && (!s("search-author") || (d.author || "").toLowerCase().includes(s("search-author")))
            && (!status || d.status === status);
        });
    });

    document.getElementById("reset-btn").addEventListener("click", () => {
        document.getElementById("save-btn").disabled = true; // Disable Save button
        ["search-series", "search-book", "search-author", "search-status"].forEach(id => document.getElementById(id).value = "");
        table.clearFilter();
        loadBooks();
    });

    const bookNamesContainer = document.getElementById("bookNamesContainer");
    const bookCountInput = document.getElementById("bookCount");
    let bookCount = parseInt(bookCountInput.value);

    const updateBookNameFields = () => {
        bookNamesContainer.innerHTML = '';
        for (let i = 1; i <= bookCount; i++) {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "bookNameInput";
            input.placeholder = `Book Name ${i}`;
            input.required = true;
            bookNamesContainer.appendChild(input);
        }
    };

    document.getElementById("increaseCount").addEventListener("click", () => {
        const countInput = document.getElementById('bookCount');
        const container = document.getElementById('bookNamesContainer');
        let count = parseInt(countInput.value);
        count++;
        countInput.value = count;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'bookNameInput';
        input.placeholder = `Book Name ${count}`;
        input.required = true;
        container.appendChild(input);
    });

    document.getElementById("decreaseCount").addEventListener("click", () => {
        const countInput = document.getElementById('bookCount');
        const container = document.getElementById('bookNamesContainer');
        let count = parseInt(countInput.value);
        if (count > 1) {
            count--;
            countInput.value = count;

            // Remove last book input
            const inputs = container.querySelectorAll('.bookNameInput');
            if (inputs.length > 1) {
                container.removeChild(inputs[inputs.length - 1]);
            }
        }
    });
    updateBookNameFields(); // Initial call on load

    //Fetch book details from series name
    document.getElementById('seriesName').addEventListener('blur', async () => {
        const seriesName = document.getElementById('seriesName').value.trim();
        if (!seriesName) return;

        try {
            const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(seriesName)}`);
            const data = await response.json();

            if (data.docs.length > 0) {
                // Filter docs with same series/work key
                const mainWorkKey = data.docs[0].key; // usually in form "/works/OLxxxxW"
                const author = data.docs[0].author_name ? data.docs[0].author_name[0] : '';
                const genre = data.docs[0].subject ? data.docs[0].subject.slice(0, 2).join(', ') : '';

                const relatedTitles = data.docs
                    .filter(doc => doc.author_name && doc.author_name[0] === author && doc.title.toLowerCase().includes(seriesName.toLowerCase()))
                    .map(doc => doc.title);

                const uniqueTitles = [...new Set(relatedTitles)];

                // Fill author, genre, etc.
                document.getElementById('author').value = author;
                document.getElementById('genre').value = genre;
                document.getElementById('subGenre').value = ''; // optional
                document.getElementById('bookCount').value = uniqueTitles.length;

                // Populate book name inputs
                const container = document.getElementById('bookNamesContainer');
                container.innerHTML = '';
                uniqueTitles.forEach((title, index) => {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.className = 'bookNameInput';
                    input.placeholder = `Book Name ${index + 1}`;
                    input.required = true;
                    input.value = title;
                    container.appendChild(input);
                });

            } else {
                showToast("No matching series found.");
            }

        } catch (error) {
            showToast("Failed to fetch series info:", error);
        }
    });

    // Add New Book
    document.getElementById("newBookForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const get = id => document.getElementById(id).value;

        const toTimestamp = id => {
            const val = get(id);
            if (!val) return null;

            const [year, month, day] = val.split('-').map(Number);
            const localDate = new Date(year, month - 1, day); // month is 0-indexed
            return firebase.firestore.Timestamp.fromDate(localDate);
        };

        const status = get("status");
        const startedDateVal = get("startedDate");
        const completedDateVal = get("completedDate");

        // Basic date validation
        const todayDate = new Date();
        const startedDate = startedDateVal ? new Date(startedDateVal) : null;
        const completedDate = completedDateVal ? new Date(completedDateVal) : null;

        if (startedDate && startedDate > todayDate) {
            showToast("Starting date cannot be in the future.", "error");
            return;
        }
        if (completedDate && completedDate > todayDate) {
            showToast("Completed date cannot be in the future.", "error");
            return;
        }
        if (startedDate && completedDate && startedDate > completedDate) {
            showToast("Starting date cannot be after completed date.", "error");
            return;
        }

        // Common fields
        const seriesName = get("seriesName");
        const author = get("author");
        const genre = get("genre");
        const subGenre = get("subGenre");
        const startedTS = toTimestamp("startedDate");
        const completedTS = toTimestamp("completedDate");
        const entryDate = firebase.firestore.Timestamp.now();

        // Get all book names
        const bookNameInputs = document.querySelectorAll(".bookNameInput");
        const bookNames = Array.from(bookNameInputs).map(input => input.value.trim());

        // ✅ Duplicate book name check within form (case-insensitive)
        const nameMap = {};
        let hasFormDupes = false;
        bookNameInputs.forEach(input => input.classList.remove("error-highlight"));

        bookNames.forEach((name, idx) => {
            const key = name.toLowerCase();
            if (!name) return;
            nameMap[key] = (nameMap[key] || []);
            nameMap[key].push(idx);
        });

        for (const key in nameMap) {
            if (nameMap[key].length > 1) {
                hasFormDupes = true;
                nameMap[key].forEach(idx => bookNameInputs[idx].classList.add("error-highlight"));
            }
        }

        if (hasFormDupes) {
            showToast("Duplicate book names found within the form. Please correct them.", "warning");
            return;
        }

        if (bookNames.filter(name => !!name).length === 0) {
            showToast("Please enter at least one book name.", "error");
            return;
        }

        // ✅ Check against existing entries in Firestore
        const currentUser = firebase.auth().currentUser;
        const allBooksSnapshot = await db.collection("books").where("userId", "==", currentUser.uid).get();
        const existingBooks = allBooksSnapshot.docs.map(doc => doc.data());

        const toKey = (series, book, author) => `${series?.toLowerCase()}|${book?.toLowerCase()}|${author?.toLowerCase()}`;

        const existingKeys = new Set(existingBooks.map(b => toKey(b.seriesName, b.bookName, b.author)));

        const batch = db.batch();
        let addedCount = 0;
        

        bookNames.forEach((bookName, idx) => {
            if (!bookName) return;

            const key = toKey(seriesName, bookName, author);
            if (existingKeys.has(key)) {
                showToast(`"${bookName}" by ${author} in series "${seriesName}" already exists.`, "warning");
                bookNameInputs[idx].classList.add("error-highlight");
                return;
            }

            const book = {
                seriesName,
                bookName,
                author,
                genre,
                subGenre,
                status,
                startedDate: startedTS,
                completedDate: completedTS,
                pausedDate: null,
                resumedDate: null,
                stoppedDate: null,
                entryDate,
                userId: currentUser?.uid || null,
                userEmail: currentUser?.email || null,
            };

            // Auto-fill dates based on status
            if (status === "Reading" && !book.startedDate) book.startedDate = entryDate;
            if (status === "Completed") {
                if (!book.startedDate) book.startedDate = entryDate;
                if (!book.completedDate) book.completedDate = entryDate;
            }
            if (status === "Paused") {
                if (!book.startedDate) book.startedDate = entryDate;
                book.pausedDate = entryDate;
            }
            if (status === "Not Interested") book.stoppedDate = entryDate;

            const docRef = db.collection("books").doc();
            batch.set(docRef, book);
            addedCount++;
        });

        if (addedCount === 0) return;

        try {
            await batch.commit();
            showToast(`${addedCount} book(s) added successfully!`, "success");

            e.target.reset();
            bookCount = 1;
            document.getElementById("bookCount").value = 1;
            updateBookNameFields();
            loadBooks();
        } catch (err) {
            console.error("Batch insert failed:", err);
            // Handle known Firestore session/channel error
            if (err.message?.includes("channel") || err.code === 400) {
                showToast("Temporary network issue or Firestore session error. Please retry.", "error");
            } else {
                showToast("Batch insert failed:" + err.message, "error");
            }
        }
    });
});

function formatFirestoreTimestamp(cell) {
    const value = cell.getValue();
    if (!value) return '';

    let date;
    // Handle Firestore timestamp object
    if (value.toDate) {
        date = value.toDate();
    } else if (typeof value === 'string' || typeof value === 'number') {
        date = new Date(value);
    } else {
        return '';
    }

    if (isNaN(date)) return '';

    // Format to MM/DD/YYYY, HH:MM AM/PM
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    const container = document.getElementById('toastContainer');
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000); // Remove after 4 seconds
}



