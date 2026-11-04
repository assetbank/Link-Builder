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
    const panels = document.querySelectorAll(".tab-panel");
    const tabButtons = document.querySelectorAll(".tab-btn");

    setTimeout(handleInputChange, 0);

    function handleInputChange() {
        generateLink();
    }

    function switchToTab(index) {
        panels.forEach((panel, i) => {
            panel.classList.toggle('active', i === index);
            panel.hidden = i !== index;
            tabButtons[i].classList.toggle('active', i === index);
            tabButtons[i].setAttribute('aria-selected', String(i === index));
            tabButtons[i].tabIndex = i === index ? 0 : -1;
        });
        handleInputChange();
    }

    tabButtons.forEach((btn, index) => {
        btn.addEventListener('click', () => switchToTab(index));
        btn.addEventListener('keydown', event => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % tabButtons.length;
            else if (event.key === 'ArrowLeft') next = (index + tabButtons.length - 1) % tabButtons.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = tabButtons.length - 1;
            else return;
            event.preventDefault();
            switchToTab(next);
            tabButtons[next].focus();
        });
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
            this.setAttribute("aria-pressed", String(this.classList.contains("selected")));
            handleInputChange();
        });
    });

    let nextFieldId = 0;
    const rowSettings = {
        metaproperty: { labels: ['Metaproperty', 'Option'], icons: ['sliders', 'option'], help: 'metaproperty-help' },
        tag: { labels: ['Tag', 'Tag'], icons: ['tag', 'tag'], help: 'tag-help' },
        keyword: { labels: ['Keyword'], icons: ['search'] }
    };

    function createRow(kind, number, values = []) {
        const settings = rowSettings[kind];
        const row = document.createElement('div');
        row.className = `form-group ${kind}-row`;
        settings.labels.forEach((name, i) => {
            const label = document.createElement('label');
            label.className = 'field';
            const caption = document.createElement('span');
            caption.className = 'field-label';
            caption.textContent = `${name} ${kind === 'tag' ? number + i : number}`;
            const input = document.createElement('input');
            input.type = 'text';
            input.id = `added-field-${++nextFieldId}`;
            input.placeholder = caption.textContent;
            input.value = values[i] ?? '';
            input.autocomplete = 'off';
            input.spellcheck = false;
            if (settings.help) input.setAttribute('aria-describedby', settings.help);
            label.htmlFor = input.id;
            input.addEventListener('input', generateLink);
            const control = document.createElement('span');
            control.className = 'input-wrap';
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('class', 'field-icon icon');
            icon.setAttribute('viewBox', '0 0 24 24');
            icon.setAttribute('aria-hidden', 'true');
            icon.setAttribute('focusable', 'false');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', `/builder-icons.svg#${settings.icons[i]}`);
            icon.appendChild(use);
            control.append(icon, input);
            label.append(caption, control);
            row.appendChild(label);
        });
        if (kind !== 'keyword') {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'delete-row-btn';
            button.textContent = '×';
            row.appendChild(button);
        }
        return row;
    }

    function updateDeleteButtons(containerId, rowClass) {
        const kind = rowClass.replace('-row', '');
        const rows = document.querySelectorAll(`#${containerId} .${rowClass}`);
        rows.forEach((row, i) => {
            const number = kind === 'tag' ? i * 2 + 1 : i + 1;
            row.querySelectorAll('.field-label').forEach((label, j) => {
                label.textContent = `${rowSettings[kind].labels[j]} ${kind === 'tag' ? number + j : number}`;
                label.parentElement.querySelector('input').placeholder = label.textContent;
            });
            const btn = row.querySelector('.delete-row-btn');
            if (btn) {
                btn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
                btn.disabled = rows.length === 1;
                const name = kind === 'tag' ? `Remove tags ${number} and ${number + 1}` : `Remove metaproperty ${number}`;
                btn.title = name;
                btn.setAttribute('aria-label', name);
            }
        });
    }

    for (const kind of ['metaproperty', 'tag']) {
        const containerId = kind === 'metaproperty' ? 'metaproperty-rows' : 'tag-rows';
        const rowClass = `${kind}-row`;
        const container = document.getElementById(containerId);
        updateDeleteButtons(containerId, rowClass);
        container.addEventListener('click', event => {
            const button = event.target.closest('.delete-row-btn');
            if (!button) return;
            const rows = [...container.querySelectorAll(`.${rowClass}`)];
            if (rows.length <= 1) return;
            const row = button.closest(`.${rowClass}`);
            const index = rows.indexOf(row);
            row.remove();
            updateDeleteButtons(containerId, rowClass);
            generateLink();
            const remaining = container.querySelectorAll(`.${rowClass}`);
            remaining[Math.min(index, remaining.length - 1)].querySelector('input').focus();
        });
        document.getElementById(`add-${kind}-btn`).addEventListener('click', () => {
            const count = container.querySelectorAll(`.${rowClass}`).length;
            const row = createRow(kind, kind === 'tag' ? count * 2 + 1 : count + 1);
            container.appendChild(row);
            updateDeleteButtons(containerId, rowClass);
            row.querySelector('input').focus();
        });
    }

    document.getElementById('add-keyword-btn').addEventListener('click', () => {
        const container = document.getElementById('keyword-rows');
        const row = createRow('keyword', container.querySelectorAll('.keyword-row').length + 1);
        container.appendChild(row);
        row.querySelector('input').focus();
    });

    const outputStates = new WeakMap();
    document.querySelectorAll('.generated-link-container').forEach(section => {
        const state = { revision: 0, timer: null };
        outputStates.set(section, state);
        const button = section.querySelector('.copy-link-btn');
        const feedback = section.querySelector('.copy-status');
        button.addEventListener('click', async () => {
            const link = section.querySelector('.output-container a');
            if (!link) return;
            const revision = ++state.revision;
            clearTimeout(state.timer);
            button.disabled = true;
            try {
                await navigator.clipboard.writeText(link.href);
                if (revision !== state.revision) return;
                button.querySelector('.button-label').textContent = 'Copied';
                feedback.textContent = 'Link copied to clipboard.';
                state.timer = setTimeout(() => {
                    button.querySelector('.button-label').textContent = 'Copy link';
                    feedback.textContent = '';
                }, 2000);
            } catch {
                if (revision !== state.revision) return;
                feedback.textContent = 'Could not copy. Select the URL above and copy it manually.';
            } finally {
                if (revision === state.revision) button.disabled = false;
            }
        });
    });

    function updateOutputActions(el, url) {
        const section = el.closest('.generated-link-container');
        const state = outputStates.get(section);
        state.revision++;
        clearTimeout(state.timer);
        const button = section.querySelector('.copy-link-btn');
        button.disabled = !url;
        button.querySelector('.button-label').textContent = 'Copy link';
        section.querySelector('.copy-status').textContent = '';
        const open = section.querySelector('.open-link');
        open.hidden = !url;
        if (url) open.href = url;
        else open.removeAttribute('href');
    }

    function setEmpty(el, msg) {
        el.textContent = msg;
        el.className = 'empty-state';
        updateOutputActions(el, null);
    }

    function setLink(el, url) {
        el.replaceChildren();
        el.className = '';
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = url;
        el.appendChild(a);
        updateOutputActions(el, url);
    }

    function setURLError(msg) {
        const input = document.getElementById('baseURL');
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', 'portal-help baseURL-error');
        let error = document.getElementById('baseURL-error');
        if (!error) {
            error = document.createElement('p');
            error.id = 'baseURL-error';
            error.className = 'field-error';
            input.closest('.baseURL-container').appendChild(error);
        }
        error.textContent = msg;
    }

    function clearURLError() {
        const input = document.getElementById('baseURL');
        input.removeAttribute('aria-invalid');
        input.setAttribute('aria-describedby', 'portal-help');
        document.getElementById('baseURL-error')?.remove();
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
        let hasMetaproperties = false;

        document.querySelectorAll("#metaproperty-rows .metaproperty-row").forEach(function (row) {
            const inputs = row.querySelectorAll("input");
            const field = inputs[0].value.trim();
            const value = inputs[1].value.trim();
            if (field && value) {
                hasMetaproperties = true;
                params.push(`field=metaproperty_${encodeURIComponent(sanitizeDatabaseName(field))}&value=${encodeURIComponent(sanitizeDatabaseName(value))}`);
            }
        });

        document.querySelectorAll("#tag-rows input").forEach(input => {
            const tag = input.value.trim();
            if (tag) {
                params.push(`field=tags&value=${encodeURIComponent(tag)}`);
            }
        });

        // Boolean search may add several text filters. Keep each query intact
        // rather than guessing AND/OR semantics between words.
        const queryInputs = document.querySelectorAll('#keyword-rows input');
        const queries = new Set(Array.from(queryInputs, input => input.value.trim()).filter(Boolean));
        for (const query of queries) {
            params.push(`field=singletext&value=${encodeURIComponent(query)}`);
        }

        const statusButtons = document.querySelectorAll("#status-grid-1 button.selected");
        if (statusButtons.length > 0) {
            statusButtons.forEach(button => {
                const statusParam = button.dataset.statusParam;
                if (statusParam) params.push(statusParam);
            });
        }

        if (params.length === 0) {
            setEmpty(outputElement, "Your generated link will appear here");
            return;
        }

        const endpoint = hasMetaproperties || queries.size > 0 ? 'set' : 'media';
        // Match captured combined searches: each field/value has its own add action.
        // Preserve the established filters-only URL format when no text is supplied.
        const filters = queries.size > 0
            ? params.map(param => `${param}&filterType=add`).join('&')
            : `${params.join('&')}&filterType=add`;
        const generatedLink = `https://${baseURL}/search/${endpoint}/?resetsearch&${filters}`;

        setLink(outputElement, generatedLink);
    }

    // --- UCV (Browse Assets tab) ---

    const ucvOpenBtn = document.getElementById("ucv-open-btn");
    const ucvContainer = document.getElementById("ucv-container");
    const ucvStatus = document.getElementById("ucv-status");
    let pickerSession = null;
    const importStatus = document.getElementById('import-status');

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

    baseURLInput.addEventListener('input', () => {
        closePicker();
        importStatus.hidden = true;
        importStatus.textContent = '';
    });
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

        metaEntries.forEach((entry, i) => {
            metaContainer.appendChild(createRow('metaproperty', i + 1, [entry.field, entry.value]));
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

        tagPairs.forEach((pair, i) => {
            tagContainer.appendChild(createRow('tag', i * 2 + 1, [pair.t1, pair.t2]));
        });

        // Show feedback and switch to panel 1
        updateDeleteButtons("metaproperty-rows", "metaproperty-row");
        updateDeleteButtons("tag-rows", "tag-row");
        importStatus.textContent = `Imported metadata from ${asset.name || 'the selected asset'}. Review the fields below.`;
        importStatus.hidden = false;
        switchToTab(0);
        tabButtons[0].focus();
    }


    // --- end UCV ---

});
