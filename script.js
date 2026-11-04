import { validPortal, metadataOnly, matchesMessage } from './picker-common.mjs';

function sanitizeDatabaseName(input) {
    return input.replace(/[^a-zA-Z0-9.-]/g, "_");
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
    return validPortal(value);
}

document.addEventListener("DOMContentLoaded", function () {
    let currentPanel = 0;
    const panels = document.querySelectorAll(".tab-panel");
    const tabButtons = document.querySelectorAll(".tab-btn");

    setTimeout(handleInputChange, 0);

    function handleInputChange() {
        if (currentPanel === 0) {
            generateLink();
        } else if (currentPanel === 1) {
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

    function updateDeleteButtons(containerId, rowClass) {
        const rows = document.querySelectorAll(`#${containerId} .${rowClass}`);
        rows.forEach(row => {
            const btn = row.querySelector(".delete-row-btn");
            if (btn) btn.style.visibility = rows.length > 1 ? "visible" : "hidden";
        });
    }

    function renumberRows(containerId, rowClass, placeholderFn) {
        const rows = document.querySelectorAll(`#${containerId} .${rowClass}`);
        rows.forEach((row, i) => {
            const inputs = row.querySelectorAll("input");
            placeholderFn(inputs, i + 1);
        });
    }

    updateDeleteButtons("metaproperty-rows", "metaproperty-row");
    updateDeleteButtons("tag-rows", "tag-row");

    document.getElementById("metaproperty-rows").addEventListener("click", function (e) {
        if (e.target.classList.contains("delete-row-btn")) {
            const rows = document.querySelectorAll("#metaproperty-rows .metaproperty-row");
            if (rows.length > 1) {
                e.target.closest(".metaproperty-row").remove();
                generateLink();
                updateDeleteButtons("metaproperty-rows", "metaproperty-row");
                renumberRows("metaproperty-rows", "metaproperty-row", (inputs, n) => {
                    if (!inputs[0].value) inputs[0].placeholder = `🔧 Metaproperty ${n}`;
                    if (!inputs[1].value) inputs[1].placeholder = `📋 Option ${n}`;
                });
            }
        }
    });

    document.getElementById("add-metaproperty-btn").addEventListener("click", function () {
        const rows = document.querySelectorAll("#metaproperty-rows .metaproperty-row");
        const n = rows.length + 1;
        const row = document.createElement("div");
        row.className = "form-group metaproperty-row";
        row.innerHTML = `<div><input type="text" placeholder="🔧 Metaproperty ${n}"></div><div><input type="text" placeholder="📋 Option ${n}"></div><button type="button" class="delete-row-btn" title="Remove row">×</button>`;
        row.querySelectorAll("input").forEach(input => input.addEventListener("input", generateLink));
        document.getElementById("metaproperty-rows").appendChild(row);
        updateDeleteButtons("metaproperty-rows", "metaproperty-row");
    });

    document.getElementById("tag-rows").addEventListener("click", function (e) {
        if (e.target.classList.contains("delete-row-btn")) {
            const rows = document.querySelectorAll("#tag-rows .tag-row");
            if (rows.length > 1) {
                e.target.closest(".tag-row").remove();
                generateLink();
                updateDeleteButtons("tag-rows", "tag-row");
                renumberRows("tag-rows", "tag-row", (inputs, n) => {
                    const base = (n - 1) * 2 + 1;
                    if (!inputs[0].value) inputs[0].placeholder = `🏷️ Tag ${base}`;
                    if (!inputs[1].value) inputs[1].placeholder = `🏷️ Tag ${base + 1}`;
                });
            }
        }
    });

    document.getElementById("add-tag-btn").addEventListener("click", function () {
        const rows = document.querySelectorAll("#tag-rows .tag-row");
        const n = rows.length * 2 + 1;
        const row = document.createElement("div");
        row.className = "form-group tag-row";
        row.innerHTML = `<div><input type="text" placeholder="🏷️ Tag ${n}"></div><div><input type="text" placeholder="🏷️ Tag ${n + 1}"></div><button type="button" class="delete-row-btn" title="Remove row">×</button>`;
        row.querySelectorAll("input").forEach(input => input.addEventListener("input", generateLink));
        document.getElementById("tag-rows").appendChild(row);
        updateDeleteButtons("tag-rows", "tag-row");
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

    // --- UCV (Browse Assets tab) ---

    const ucvOpenBtn = document.getElementById("ucv-open-btn");
    const ucvContainer = document.getElementById("ucv-container");
    const ucvStatus = document.getElementById("ucv-status");
    let pickerSession = null;

    function closePicker(message = '') {
        if (pickerSession) {
            clearTimeout(pickerSession.timeout);
            pickerSession.frame.contentWindow?.postMessage({
                channel: 'link-builder-picker', request: pickerSession.request, type: 'close'
            }, location.origin);
            pickerSession.frame.remove();
            pickerSession = null;
        }
        ucvContainer.replaceChildren();
        ucvContainer.classList.remove('active');
        ucvOpenBtn.textContent = 'Open Asset Browser';
        ucvStatus.textContent = message;
        try {
            for (const key of ['cvrt', 'cvad', 'cvp']) localStorage.removeItem(key);
        } catch { /* Browser storage may be disabled. */ }
    }

    baseURLInput.addEventListener('input', () => closePicker());
    window.addEventListener('pagehide', () => closePicker());
    window.addEventListener('message', event => {
        const session = pickerSession;
        if (!session || !matchesMessage(event, session.frame.contentWindow, location.origin, session.request)) return;
        if (baseURLInput.value.trim() !== session.domain) { closePicker(); return; }
        if (event.data.type === 'ready') {
            ucvStatus.textContent = 'Connection ends when you close the browser or select an asset.';
        } else if (event.data.type === 'selected') {
            try {
                const asset = metadataOnly(event.data.asset);
                closePicker();
                populateFromAsset(asset);
            } catch {
                closePicker('The asset metadata could not be imported. Please enter the fields manually.');
            }
        } else if (event.data.type === 'closed') {
            closePicker('Disconnected.');
        } else if (event.data.type === 'expired') {
            closePicker('Your connection expired. Open the asset browser to reconnect.');
        } else if (event.data.type === 'error') {
            closePicker('The asset could not be imported. Please enter its metadata manually.');
        }
    });

    function updateUCVButton() {
        const domain = document.getElementById("baseURL").value.trim();
        const valid = isValidDomain(domain);
        ucvOpenBtn.disabled = !valid;
        if (!valid && document.getElementById("baseURL").value.trim() !== "") {
            document.getElementById("ucv-prompt-text").textContent = "Please enter a valid Portal URL above first.";
        } else if (!valid) {
            document.getElementById("ucv-prompt-text").innerHTML = "Enter your Portal URL above, then click <strong>Open Asset Browser</strong>.";
        } else {
            document.getElementById("ucv-prompt-text").innerHTML = "Click <strong>Open Asset Browser</strong> to browse your portal and import asset metadata.";
        }
    }

    baseURLInput.addEventListener("input", updateUCVButton);
    updateUCVButton();

    ucvOpenBtn.addEventListener('click', () => {
        if (pickerSession) { closePicker('Disconnected.'); return; }
        const domain = baseURLInput.value.trim();
        if (!isValidDomain(domain)) return;
        const request = crypto.randomUUID();
        const frame = document.createElement('iframe');
        frame.title = 'Bynder asset browser';
        frame.referrerPolicy = 'no-referrer';
        // Separate document for complete teardown and a portal-specific CSP.
        // This is same-origin and is NOT claimed as an isolation boundary.
        frame.src = `/picker.html#${new URLSearchParams({ portal: domain, request })}`;
        pickerSession = { frame, domain, request, timeout: setTimeout(() => {
            closePicker('Your connection expired. Open the asset browser to reconnect.');
        }, 15 * 60 * 1000) };
        ucvContainer.replaceChildren(frame);
        ucvContainer.classList.add('active');
        ucvOpenBtn.textContent = 'Close & Disconnect';
        ucvStatus.textContent = 'Opening asset browser…';
    });

    function populateFromAsset(asset) {
        // Clear existing metaproperty and tag fields
        const metaContainer = document.getElementById("metaproperty-rows");
        const tagContainer = document.getElementById("tag-rows");
        metaContainer.innerHTML = "";
        tagContainer.innerHTML = "";

        // Populate metaproperties
        // Default UCV response: flat object keyed by metaproperty ID with { name, options:[{name}] }
        // GraphQL assetFieldSelection response: { nodes: [{name, options:[{name}]}] }
        let metaSource = [];
        if (asset.metaproperties) {
            if (Array.isArray(asset.metaproperties.nodes)) {
                metaSource = asset.metaproperties.nodes;
            } else if (typeof asset.metaproperties === "object") {
                metaSource = Object.values(asset.metaproperties);
            }
        }
        const metaEntries = [];
        metaSource.forEach(function (mp) {
            if (mp.options && mp.options.length > 0) {
                mp.options.forEach(function (opt) {
                    const optName = typeof opt === "string" ? opt : opt.name;
                    metaEntries.push({ field: mp.name, value: optName });
                });
            }
        });

        if (metaEntries.length === 0) {
            metaEntries.push({ field: "", value: "" });
        }

        metaEntries.forEach(function (entry, i) {
            const row = document.createElement("div");
            row.className = "form-group metaproperty-row";
            row.innerHTML = `<div><input type="text" placeholder="🔧 Metaproperty ${i + 1}" ></div><div><input type="text" placeholder="📋 Option ${i + 1}" ></div><button type="button" class="delete-row-btn" title="Remove row">×</button>`;
            row.querySelectorAll("input").forEach(input => input.addEventListener("input", generateLink));
            row.querySelectorAll("input")[0].value = entry.field;
            row.querySelectorAll("input")[1].value = entry.value;
            metaContainer.appendChild(row);
        });

        // Populate tags — may be an array of strings or an object keyed by tag
        const rawTags = asset.tags || [];
        const tags = Array.isArray(rawTags) ? rawTags : Object.keys(rawTags);
        const tagPairs = [];
        for (let i = 0; i < tags.length; i += 2) {
            tagPairs.push({ t1: tags[i] || "", t2: tags[i + 1] || "" });
        }
        if (tagPairs.length === 0) {
            tagPairs.push({ t1: "", t2: "" });
        }

        tagPairs.forEach(function (pair, i) {
            const n = i * 2 + 1;
            const row = document.createElement("div");
            row.className = "form-group tag-row";
            row.innerHTML = `<div><input type="text" placeholder="🏷️ Tag ${n}" ></div><div><input type="text" placeholder="🏷️ Tag ${n + 1}" ></div><button type="button" class="delete-row-btn" title="Remove row">×</button>`;
            row.querySelectorAll("input").forEach(input => input.addEventListener("input", generateLink));
            row.querySelectorAll("input")[0].value = pair.t1;
            row.querySelectorAll("input")[1].value = pair.t2;
            tagContainer.appendChild(row);
        });

        // Show feedback and switch to panel 1
        updateDeleteButtons("metaproperty-rows", "metaproperty-row");
        updateDeleteButtons("tag-rows", "tag-row");
        ucvStatus.textContent = `Imported: ${asset.name || asset.databaseId}`;
        switchToTab(0);
    }


    // --- end UCV ---

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
