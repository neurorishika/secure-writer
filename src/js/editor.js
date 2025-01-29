document.addEventListener("DOMContentLoaded", () => {
    const homepage = document.getElementById("homepage");
    const editorPage = document.getElementById("editorPage");
    const recentFilesList = document.getElementById("recentFiles");
    const newFileButton = document.getElementById("newFileButton");
    const openFileButton = document.getElementById("openFileButton");
    const homeButton = document.getElementById("homeButton");
    const editorContainer = document.getElementById("editor");

    let quill;
    let recentFiles = JSON.parse(localStorage.getItem("recentFiles")) || [];

    // Initialize Quill.js
    function initializeQuill() {
        if (!quill) {
            quill = new Quill(editorContainer, {
                theme: "bubble",
                placeholder: "Start writing...",
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        ['blockquote'],
                        [{ list: 'bullet' }],
                        [{ indent: '-1' }, { indent: '+1' }],
                        [{ header: [1, 2, 3, 4, 5, 6, false] }],
                        [{ font: [] }],
                        [{ align: [] }],
                        ['clean'],
                    ],
                },
            });
        }
    }

    // Populate Recent Files
    function updateRecentFilesList() {
        recentFilesList.innerHTML = "";
        recentFiles.forEach((file, index) => {
            const li = document.createElement("li");
            li.innerHTML = `<a href="#" data-index="${index}">${file.name} - ${new Date(file.timestamp).toLocaleString()}</a>`;
            recentFilesList.appendChild(li);
        });
    }

    // Add Recent File
    function addRecentFile(name, content) {
        const timestamp = Date.now();
        recentFiles.push({ name, content, timestamp });
        localStorage.setItem("recentFiles", JSON.stringify(recentFiles));
        updateRecentFilesList();
    }

    // Switch Views
    function switchToEditor(file = null) {
        homepage.classList.add("d-none");
        editorPage.classList.remove("d-none");

        initializeQuill();

        if (file) {
            quill.setContents(JSON.parse(file.content));
        }
    }

    function switchToHome() {
        homepage.classList.remove("d-none");
        editorPage.classList.add("d-none");
    }

    // Encrypt File Content
    async function encryptContent(content, password) {
        const enc = new TextEncoder();
        const key = await deriveKey(password);
        const iv = crypto.getRandomValues(new Uint8Array(12)); // Initialization vector

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            enc.encode(content)
        );

        return JSON.stringify({ iv: Array.from(iv), content: Array.from(new Uint8Array(encrypted)) });
    }

    // Decrypt File Content
    async function decryptContent(encryptedContent, password) {
        const { iv, content } = JSON.parse(encryptedContent);
        const key = await deriveKey(password);

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            key,
            new Uint8Array(content)
        );

        const dec = new TextDecoder();
        return dec.decode(decrypted);
    }

    // Derive Key from Password
    async function deriveKey(password) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            enc.encode(password),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: crypto.getRandomValues(new Uint8Array(16)),
                iterations: 100000,
                hash: "SHA-256",
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    // Save Encrypted File
    async function saveToFile(content) {
        const password = prompt("Enter a password to encrypt the file:");

        const encryptedContent = await encryptContent(content, password);

        const options = {
            types: [
                {
                    description: "Secure Writer Files",
                    accept: { "application/json": [".securewriter"] },
                },
            ],
        };

        const handle = await window.showSaveFilePicker(options);
        const writable = await handle.createWritable();
        await writable.write(new Blob([encryptedContent], { type: "application/json" }));
        await writable.close();
        console.log("File saved successfully.");
    }

    // Load Encrypted File
    async function loadFromFile() {
        const [fileHandle] = await window.showOpenFilePicker();
        const file = await fileHandle.getFile();
        const encryptedContent = await file.text();

        const password = prompt("Enter the password to decrypt the file:");

        const content = await decryptContent(encryptedContent, password);

        quill.setContents(JSON.parse(content));
        console.log("File loaded and decrypted successfully.");
    }

    // Save Content Function
    function saveContent() {
        const content = quill.getContents();
        const contentString = JSON.stringify(content);
        saveToFile(contentString);
    }

    // Event Listeners
    newFileButton.addEventListener("click", () => {
        switchToEditor();
    });

    openFileButton.addEventListener("click", async () => {
        await loadFromFile();
        switchToEditor();
    });

    homeButton.addEventListener("click", switchToHome);

    recentFilesList.addEventListener("click", (e) => {
        const index = e.target.dataset.index;
        const file = recentFiles[index];
        if (file) {
            switchToEditor(file);
        }
    });

    document.addEventListener("keydown", (event) => {
        const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
        const isSaveShortcut = (isMac && event.metaKey && event.key.toLowerCase() === "s") ||
                               (!isMac && event.ctrlKey && event.key.toLowerCase() === "s");

        if (isSaveShortcut) {
            event.preventDefault();
            saveContent();
            alert("Content saved manually!");
        }
    });

    // Initial Setup
    updateRecentFilesList();
});
