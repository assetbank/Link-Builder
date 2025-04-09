
function sanitizeDatabaseName(input) {
    return input.replace(/[^a-zA-Z0-9-]/g, "_");
}

document.addEventListener("DOMContentLoaded", function () {
    // ✅ Highlight active nav item
    const currentPage = window.location.pathname.split("/").pop();
    document.querySelectorAll(".nav a").forEach(link => link.classList.remove("active"));
    if (currentPage === "" || currentPage === "index.html") {
        document.querySelector('a[href="index.html"]').classList.add("active");
    } else if (currentPage === "terms.html") {
        document.querySelector('a[href="terms.html"]').classList.add("active");
    }

    // ✅ Portal container switching
    let currentContainer = 0;
    const containers = document.querySelectorAll(".container");
    const switchButtons = document.querySelectorAll(".switch-btn");
    let storedBaseURL = "";

    containers[currentContainer].classList.add("active");

    function handleInputChange() {
        if (currentContainer === 0) {
            generateLink();
        } else {
            generateKeywordLink();
        }
    }

    // ✅ Base URL sync with localStorage + validation
    const baseURLInputs = document.querySelectorAll("#baseURL");
    if (baseURLInputs.length > 0) {
        const storedBaseURL = localStorage.getItem("baseURL");
        if (storedBaseURL) {
            baseURLInputs.forEach(input => input.value = storedBaseURL);
        }

        baseURLInputs.forEach(input => {
            input.addEventListener("input", function () {
                localStorage.setItem("baseURL", input.value.trim());
            });

            input.addEventListener("blur", function () {
                const value = input.value.trim();
                const validPattern = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){2,}$/;
                if (value.length > 0 && !validPattern.test(value)) {
                    input.style.border = "1px solid red";
                } else {
                    input.style.border = "1px solid #D1D5DB";
                }
            });

            input.addEventListener("focus", function () {
                input.style.border = "1px solid #D1D5DB";
            });
        });
    }

    window.addEventListener("storage", function (event) {
        if (event.key === "baseURL") {
            baseURLInputs.forEach(input => input.value = event.newValue || "");
        }
    });

    // ✅ Input event listeners for live link updating
    document.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", handleInputChange);
    });

    // ✅ Status action buttons
    document.querySelectorAll(".button-grid button").forEach(button => {
        button.addEventListener("click", function () {
            this.classList.toggle("selected");
            handleInputChange();
        });
    });

    // ✅ Container switch button
    switchButtons.forEach(button => {
        button.addEventListener("click", function () {
            const currentBaseURLInput = containers[currentContainer].querySelector("#baseURL");
            if (currentBaseURLInput) {
                storedBaseURL = currentBaseURLInput.value;
            }

            containers[currentContainer].classList.remove("active");
            currentContainer = (currentContainer + 1) % containers.length;
            containers[currentContainer].classList.add("active");

            const newBaseURLInput = containers[currentContainer].querySelector("#baseURL");
            if (newBaseURLInput) {
                newBaseURLInput.value = storedBaseURL;
            }

            handleInputChange();
        });
    });

    // ✅ Copy link functionality
    document.querySelectorAll(".fas.fa-copy").forEach(copyIcon => {
        copyIcon.addEventListener("click", function () {
            const outputContainer = this.closest(".output-container");
            const outputElement = outputContainer.querySelector("p");
            const linkElement = outputElement.querySelector("a");

            if (linkElement) {
                const link = linkElement.href;
                navigator.clipboard.writeText(link).then(() => {
                    this.classList.remove("fa-copy");
                    this.classList.add("fa-check");
                    this.style.color = "#28a745";

                    setTimeout(() => {
                        this.classList.remove("fa-check");
                        this.classList.add("fa-copy");
                        this.style.color = "";
                    }, 1500);
                }).catch(err => {
                    console.error("Failed to copy: ", err);
                });
            } else {
                console.error("No link available to copy.");
            }
        });
    });

    handleInputChange();
});

// ✅ Generate link based on container 1 inputs
function generateLink() {
    const baseURL = document.querySelector("#container1 #baseURL").value.trim();
    const outputElement = document.getElementById("output");

    if (!baseURL) {
        outputElement.innerText = "Please enter your portal's URL.";
        return;
    }

    const params = [];
    let hasValidInput = false;

    for (let i = 1; i <= 4; i++) {
        const field = document.getElementById(`field${i}`).value.trim();
        const value = document.getElementById(`value${i}`).value.trim();
        if (field && value) {
            hasValidInput = true;
            params.push(`field=metaproperty_${encodeURIComponent(sanitizeDatabaseName(field))}&value=${encodeURIComponent(sanitizeDatabaseName(value))}`);
        }

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

    outputElement.innerHTML = `<a href="${generatedLink}" target="_blank">${generatedLink}</a>`;
}

// ✅ Generate link based on keywords + status actions
function generateKeywordLink() {
    const baseURL = document.querySelector("#container2 #baseURL").value.trim();
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

    outputElement.innerHTML = `<a href="${generatedLink}" target="_blank">${generatedLink}</a>`;
}
