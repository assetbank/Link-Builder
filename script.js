function sanitizeDatabaseName(input) {
    return input.replace(/[^a-zA-Z0-9-]/g, "_");
}

function sanitizeBaseURL(input) {
    let url = input.trim();
    // Strip protocol
    url = url.replace(/^https?:\/\//i, "");
    // Strip everything from the first slash onwards
    url = url.replace(/\/.*$/, "");
    // Strip query strings or fragments that sneak in without a slash
    url = url.replace(/[?#].*$/, "");
    return url;
}

function isValidDomain(value) {
    // Must have at least one dot, no spaces, only valid domain characters
    return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
}

document.addEventListener("DOMContentLoaded", function () {
    let currentPanel = 0;
    const panels = document.querySelectorAll(".tab-panel");
    const tabButtons = document.querySelectorAll(".tab-btn");

    setTimeout(handleInputChange, 0);

    function handleInputChange() {
        if (currentPanel === 0) {
            generateLink();
        } else {
            generateKeywordLink();
        }
    }

    function switchToTab(index) {
        panels[currentPanel].classList.remove("active");
        tabButtons[currentPanel].classList.remove("active");
        currentPanel = index;
        panels[currentPanel].classList.add("active");
        tabButtons[currentPanel].classList.add("active");
        handleInputChange();
    }

    tabButtons.forEach((btn, index) => {
        btn.addEventListener("click", () => switchToTab(index));
    });

    const baseURLInput = document.getElementById("baseURL");

    baseURLInput.addEventListener("input", function () {
        const sanitized = sanitizeBaseURL(this.value);
        if (sanitized !== this.value) {
            this.value = sanitized;
        }
        handleInputChange();
    });

    document.querySelectorAll("input:not(#baseURL)").forEach(input => {
        input.addEventListener("input", handleInputChange);
    });

    document.querySelectorAll(".button-grid button").forEach(button => {
        button.addEventListener("click", function () {
            this.classList.toggle("selected");
            handleInputChange();
        });
    });

    document.getElementById("add-metaproperty-btn").addEventListener("click", function () {
        const rows = document.querySelectorAll("#metaproperty-rows .metaproperty-row");
        const n = rows.length + 1;
        const row = document.createElement("div");
        row.className = "form-group metaproperty-row";
        row.innerHTML = `<div><input type="text" placeholder="🔧 Metaproperty ${n}"></div><div><input type="text" placeholder="📋 Option ${n}"></div>`;
        row.querySelectorAll("input").forEach(input => input.addEventListener("input", generateLink));
        document.getElementById("metaproperty-rows").appendChild(row);
    });

    document.getElementById("add-tag-btn").addEventListener("click", function () {
        const rows = document.querySelectorAll("#tag-rows .tag-row");
        const n = rows.length * 2 + 1;
        const row = document.createElement("div");
        row.className = "form-group tag-row";
        row.innerHTML = `<div><input type="text" placeholder="🏷️ Tag ${n}"></div><div><input type="text" placeholder="🏷️ Tag ${n + 1}"></div>`;
        row.querySelectorAll("input").forEach(input => input.addEventListener("input", generateLink));
        document.getElementById("tag-rows").appendChild(row);
    });

    document.getElementById("add-keyword-btn").addEventListener("click", function () {
        const rows = document.querySelectorAll("#keyword-rows .keyword-row");
        const n = rows.length + 1;
        const row = document.createElement("div");
        row.className = "form-group keyword-row";
        row.innerHTML = `<input type="text" placeholder="🔑 Keyword ${n}">`;
        row.querySelector("input").addEventListener("input", generateKeywordLink);
        document.getElementById("keyword-rows").appendChild(row);
    });

    document.querySelectorAll(".output-container").forEach(box => {
        box.addEventListener("click", function () {
            const p = this.querySelector("p");
            const linkElement = p.querySelector("a");

            if (!linkElement) return;

            navigator.clipboard.writeText(linkElement.href).then(() => {
                const original = p.innerHTML;
                p.innerHTML = "Copied!";
                p.className = "copied-state";

                setTimeout(() => {
                    p.innerHTML = original;
                    p.className = "";
                }, 1200);
            }).catch(err => {
                console.error("Failed to copy link: ", err);
            });
        });
    });

    function setEmpty(el, msg) {
        el.innerHTML = msg;
        el.className = "empty-state";
    }

    function setLink(el, url) {
        el.innerHTML = "";
        el.className = "";
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = url;
        el.appendChild(a);
    }

    function setURLError(msg) {
        const input = document.getElementById("baseURL");
        input.style.borderColor = "#ef4444";
        input.style.boxShadow = "0 0 0 3px rgba(239,68,68,0.1)";
        let err = document.getElementById("baseURL-error");
        if (!err) {
            err = document.createElement("p");
            err.id = "baseURL-error";
            err.style.cssText = "color:#ef4444;font-size:12px;margin:4px 0 0;font-family:'Inter',sans-serif;text-align:center;";
            input.parentNode.insertBefore(err, input.nextSibling);
        }
        err.textContent = msg;
    }

    function clearURLError() {
        const input = document.getElementById("baseURL");
        input.style.borderColor = "";
        input.style.boxShadow = "";
        const err = document.getElementById("baseURL-error");
        if (err) err.remove();
    }

    function generateLink() {
        const baseURL = document.getElementById("baseURL").value.trim();
        const outputElement = document.getElementById("output");

        if (!baseURL) {
            clearURLError();
            setEmpty(outputElement, "Your generated link will appear here");
            return;
        }

        if (!isValidDomain(baseURL)) {
            setURLError("Please enter a valid domain, e.g. dam.bynder.com");
            setEmpty(outputElement, "Your generated link will appear here");
            return;
        }

        clearURLError();

        const params = [];
        let hasValidInput = false;

        document.querySelectorAll("#metaproperty-rows .metaproperty-row").forEach(function (row) {
            const inputs = row.querySelectorAll("input");
            const field = inputs[0].value.trim();
            const value = inputs[1].value.trim();
            if (field && value) {
                hasValidInput = true;
                params.push(`field=metaproperty_${encodeURIComponent(sanitizeDatabaseName(field))}&value=${encodeURIComponent(sanitizeDatabaseName(value))}`);
            }
        });

        document.querySelectorAll("#tag-rows input").forEach(input => {
            const tag = input.value.trim();
            if (tag) {
                hasValidInput = true;
                params.push(`field=tags&value=${encodeURIComponent(tag)}`);
            }
        });

        const statusButtons = document.querySelectorAll("#status-grid-1 button.selected");
        if (statusButtons.length > 0) {
            hasValidInput = true;
            statusButtons.forEach(button => {
                const statusParam = button.dataset.statusParam;
                if (statusParam) params.push(statusParam);
            });
        }

        if (!hasValidInput) {
            setEmpty(outputElement, "Your generated link will appear here");
            return;
        }

        const generatedLink = params.some(p => p.includes("metaproperty_"))
            ? `https://${baseURL}/search/set/?resetsearch&${params.join("&")}&filterType=add`
            : `https://${baseURL}/search/media/?resetsearch&${params.join("&")}&filterType=add`;

        setLink(outputElement, generatedLink);
    }

    function generateKeywordLink() {
        const baseURL = document.getElementById("baseURL").value.trim();
        const outputElement = document.getElementById("output2");

        if (!baseURL) {
            clearURLError();
            setEmpty(outputElement, "Your generated link will appear here");
            return;
        }

        if (!isValidDomain(baseURL)) {
            setURLError("Please enter a valid domain, e.g. dam.bynder.com");
            setEmpty(outputElement, "Your generated link will appear here");
            return;
        }

        clearURLError();

        const keywords = new Set();
        let hasValidInput = false;

        document.querySelectorAll("#keyword-rows input").forEach(input => {
            const keyword = input.value.trim();
            if (keyword) {
                hasValidInput = true;
                keywords.add(encodeURIComponent(keyword));
            }
        });

        const keywordParams = Array.from(keywords).map(keyword => `field=text&value=${keyword}`);

        const statusButtons = document.querySelectorAll("#status-grid-2 button.selected");
        if (statusButtons.length > 0) {
            hasValidInput = true;
            statusButtons.forEach(button => {
                const statusParam = button.dataset.statusParam;
                if (statusParam) keywordParams.push(statusParam);
            });
        }

        if (!hasValidInput) {
            setEmpty(outputElement, "Your generated link will appear here");
            return;
        }

        const generatedLink = `https://${baseURL}/search/set/?resetsearch&${keywordParams.join("&")}&filterType=add`;

        setLink(outputElement, generatedLink);
    }
});
