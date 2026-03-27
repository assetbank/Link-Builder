function sanitizeDatabaseName(input) {
    return input.replace(/[^a-zA-Z0-9-]/g, "_"); // Replace invalid characters with "_"
}

function stripProtocol(url) {
    return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

// Header hide-on-scroll
(function () {
    let lastScrollY = window.scrollY;
    const header = document.querySelector(".header");
    if (header) {
        window.addEventListener("scroll", () => {
            if (window.scrollY > lastScrollY) {
                header.classList.add("hidden");
            } else {
                header.classList.remove("hidden");
            }
            lastScrollY = window.scrollY;
        });
    }
})();

document.addEventListener("DOMContentLoaded", function () {
    // Fix navigation active class dynamically
    const pathname = window.location.pathname;

    document.querySelectorAll(".nav a").forEach(link => link.classList.remove("active"));

    if (pathname === "/" || pathname === "/index.html" || pathname.endsWith("/Link-Builder/") || pathname.endsWith("/Link-Builder/index.html")) {
        const homeLink = document.getElementById("nav-home");
        if (homeLink) homeLink.classList.add("active");
    } else if (pathname.startsWith("/terms")) {
        const termsLink = document.getElementById("nav-terms");
        if (termsLink) termsLink.classList.add("active");
    }

    let currentContainer = 0;
    const containers = document.querySelectorAll(".container");
    const switchButtons = document.querySelectorAll(".switch-btn");
    let storedBaseURL = "";

    containers[currentContainer].classList.add("active");
    // Ensure the first link or placeholder is displayed correctly
    setTimeout(handleInputChange, 0);

    function handleInputChange() {
        if (currentContainer === 0) {
            generateLink();
        } else {
            generateKeywordLink();
        }
    }

    document.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", handleInputChange);
    });

    const addMetapropBtn = document.getElementById("add-metaproperty-btn");
    if (addMetapropBtn) {
        addMetapropBtn.addEventListener("click", function () {
            const rows = document.querySelectorAll("#metaproperty-rows .metaproperty-row");
            const nextNum = rows.length + 1;
            const row = document.createElement("div");
            row.className = "form-group metaproperty-row";
            row.innerHTML = `
                <div><input type="text" placeholder="🔧 Metaproperty ${nextNum}"></div>
                <div><input type="text" placeholder="📋 Option ${nextNum}"></div>
            `;
            row.querySelectorAll("input").forEach(input => {
                input.addEventListener("input", handleInputChange);
            });
            document.getElementById("metaproperty-rows").appendChild(row);
        });
    }

    document.querySelectorAll(".button-grid button").forEach(button => {
        button.addEventListener("click", function () {
            this.classList.toggle("selected");
            handleInputChange();
        });
    });

    function getBaseURLInput(containerIndex) {
        return containerIndex === 0
            ? document.getElementById("baseURL")
            : document.getElementById("baseURL2");
    }

    switchButtons.forEach(button => {
        button.addEventListener("click", function () {
            const currentBaseURLInput = getBaseURLInput(currentContainer);
            if (currentBaseURLInput) {
                storedBaseURL = currentBaseURLInput.value;
            }

            containers[currentContainer].classList.remove("active");
            currentContainer = (currentContainer + 1) % containers.length;
            containers[currentContainer].classList.add("active");

            const newBaseURLInput = getBaseURLInput(currentContainer);
            if (newBaseURLInput) {
                newBaseURLInput.value = storedBaseURL;
            }

            handleInputChange();
        });
    });

    function generateLink() {
        const rawURL = document.getElementById("baseURL").value.trim();
        const baseURL = stripProtocol(rawURL);
        const outputElement = document.getElementById("output");

        if (!baseURL) {
            outputElement.innerText = "Please enter your portal's URL.";
            return;
        }

        const params = [];
        let hasValidInput = false;

        document.querySelectorAll("#metaproperty-rows .metaproperty-row").forEach(row => {
            const inputs = row.querySelectorAll("input");
            const field = inputs[0].value.trim();
            const value = inputs[1].value.trim();
            if (field && value) {
                hasValidInput = true;
                params.push(`field=metaproperty_${encodeURIComponent(sanitizeDatabaseName(field))}&value=${encodeURIComponent(sanitizeDatabaseName(value))}`);
            }
        });

        for (let i = 1; i <= 4; i++) {
            const tag = document.getElementById(`tag${i}`).value.trim();
            if (tag) {
                hasValidInput = true;
                params.push(`field=tags&value=${encodeURIComponent(tag)}`);
            }
        }

        const statusButtons = document.querySelectorAll("#container1 .button-grid button.selected");
        if (statusButtons.length > 0) {
            hasValidInput = true;
            statusButtons.forEach(button => {
                const statusParam = button.dataset.statusParam;
                if (statusParam) {
                    params.push(statusParam);
                }
            });
        }

        if (!hasValidInput) {
            outputElement.innerText = "Please enter at least one metaproperty & option, a tag, or select a status action.";
            return;
        }

        const generatedLink = params.some(p => p.includes("metaproperty_"))
            ? `https://${baseURL}/search/set/?resetsearch&${params.join("&")}&filterType=add`
            : `https://${baseURL}/search/media/?resetsearch&${params.join("&")}&filterType=add`;

        outputElement.innerHTML = "";
        const linkEl = document.createElement("a");
        linkEl.href = generatedLink;
        linkEl.target = "_blank";
        linkEl.rel = "noopener noreferrer";
        linkEl.textContent = generatedLink;
        outputElement.appendChild(linkEl);
    }

    function generateKeywordLink() {
        const rawURL = document.getElementById("baseURL2").value.trim();
        const baseURL = stripProtocol(rawURL);
        const outputElement = document.getElementById("output2");

        if (!baseURL) {
            outputElement.innerText = "Please enter your portal's URL.";
            return;
        }

        const keywords = new Set();
        let hasValidInput = false;

        for (let i = 1; i <= 4; i++) {
            const keyword = document.getElementById(`keyword${i}`)?.value.trim();
            if (keyword) {
                hasValidInput = true;
                keywords.add(encodeURIComponent(keyword));
            }
        }

        const keywordParams = Array.from(keywords).map(keyword => `field=text&value=${keyword}`);

        const statusButtons = document.querySelectorAll("#container2 .button-grid button.selected");
        if (statusButtons.length > 0) {
            hasValidInput = true;
            statusButtons.forEach(button => {
                const statusParam = button.dataset.statusParam;
                if (statusParam) {
                    keywordParams.push(statusParam);
                }
            });
        }

        if (!hasValidInput) {
            outputElement.innerText = "Please enter at least one keyword or select a status action.";
            return;
        }

        const generatedLink = `https://${baseURL}/search/set/?resetsearch&${keywordParams.join("&")}&filterType=add`;

        outputElement.innerHTML = "";
        const linkEl = document.createElement("a");
        linkEl.href = generatedLink;
        linkEl.target = "_blank";
        linkEl.rel = "noopener noreferrer";
        linkEl.textContent = generatedLink;
        outputElement.appendChild(linkEl);
    }

    document.querySelectorAll(".fas.fa-copy").forEach(copyIcon => {
        copyIcon.addEventListener("click", function () {
            const outputContainer = this.closest(".output-container");
            const outputElement = outputContainer.querySelector("p");
            const linkElement = outputElement.querySelector("a");

            if (linkElement && linkElement.href) {
                navigator.clipboard.writeText(linkElement.href).then(() => {
                    this.classList.remove("fa-copy");
                    this.classList.add("fa-check");
                    this.style.color = "#28a745";

                    setTimeout(() => {
                        this.classList.remove("fa-check");
                        this.classList.add("fa-copy");
                        this.style.color = "";
                    }, 400);
                }).catch(err => {
                    console.error("Failed to copy link: ", err);
                });
            } else {
                console.error("No link available to copy.");
            }
        });
    });
});
