// ✅ Function to sanitize and extract the base portal URL
function sanitizeBaseURL(url) {
    if (!url) return "";

    // Remove protocol (http or https)
    url = url.replace(/^(https?:\/\/)/, "");
    
    // Remove everything after the first "/" (if exists)
    url = url.split("/")[0];

    // Extract domain using regex to match text.text.text format
    const match = url.match(/([a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z]+)/);
    return match ? match[0] : url; // Return extracted domain or original input
}

function sanitizeDatabaseName(input) {
    return input.replace(/[^a-zA-Z0-9-]/g, "_"); // Replace invalid characters with "_"
}

document.addEventListener("DOMContentLoaded", function () {
    // Fix navigation active class dynamically
    let currentPage = window.location.pathname.split("/").pop();

    document.querySelectorAll(".nav a").forEach(link => link.classList.remove("active"));

    if (currentPage === "" || currentPage === "index.html") {
        document.querySelector('a[href="index.html"]').classList.add("active");
    } else if (currentPage === "terms.html") {
        document.querySelector('a[href="terms.html"]').classList.add("active");
    }
});

document.addEventListener("DOMContentLoaded", function () {
    let currentContainer = 0;
    const containers = document.querySelectorAll(".container");
    const switchButtons = document.querySelectorAll(".switch-btn");
    let storedBaseURL = ""; // Store baseURL value when switching

    containers[currentContainer].classList.add("active");

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

            handleInputChange(); // Ensures the link updates on switch
        });
    });

    handleInputChange();
});

function generateLink() {
    const baseURL = sanitizeBaseURL(document.querySelector("#container1 #baseURL").value.trim());
    const outputElement = document.getElementById("output");

    if (!baseURL) {
        outputElement.innerText = "Please enter your portal's URL.";
        return;
    }

    const params = [];

    for (let i = 1; i <= 4; i++) {
        const field = document.getElementById(`field${i}`).value.trim();
        const value = document.getElementById(`value${i}`).value.trim();
        if (field && value) {
            params.push(`field=metaproperty_${encodeURIComponent(sanitizeDatabaseName(field))}&value=${encodeURIComponent(sanitizeDatabaseName(value))}`);
        }
        const tag = document.getElementById(`tag${i}`).value.trim();
        if (tag) {
            params.push(`field=tags&value=${encodeURIComponent(tag)}`);
        }
    }

    if (params.length === 0) {
        outputElement.innerText = "Please enter at least one metaproperty & option or tag.";
        return;
    }

    const generatedLink = params.some(p => p.includes("metaproperty_"))
        ? `https://${baseURL}/search/set/?resetsearch&${params.join("&")}&filterType=add&filterkey=savedFilters`
        : `https://${baseURL}/search/media/?${params.join("&")}&filterType=add`;

    outputElement.innerHTML = `<a href="${generatedLink}" target="_blank">${generatedLink}</a>`;
}

function generateKeywordLink() {
    const baseURL = sanitizeBaseURL(document.querySelector("#container2 #baseURL").value.trim());
    const outputElement = document.getElementById("output2");

    if (!baseURL) {
        outputElement.innerText = "Please enter your portal's URL.";
        return;
    }

    const keywords = new Set();

    for (let i = 1; i <= 4; i++) {
        const keyword = document.getElementById(`keyword${i}`)?.value.trim();
        if (keyword) {
            keywords.add(encodeURIComponent(keyword));
        }
    }

    if (keywords.size === 0) {
        outputElement.innerText = "Please enter at least one keyword.";
        return;
    }

    const keywordParams = Array.from(keywords).map(keyword => `field=text&value=${keyword}`);
    const generatedLink = `https://${baseURL}/search/set/?resetsearch&${keywordParams.join("&")}&filterType=add&filterKey=`;

    outputElement.innerHTML = `<a href="${generatedLink}" target="_blank">${generatedLink}</a>`;
}

document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".fas.fa-copy").forEach(copyIcon => {
        copyIcon.addEventListener("click", function () {
            const outputContainer = this.closest(".output-container"); // Find parent container
            const outputElement = outputContainer.querySelector("p"); // Locate output text
            const linkElement = outputElement.querySelector("a"); // Find the link

            if (linkElement) {
                const link = linkElement.href;
                navigator.clipboard.writeText(link).then(() => {
                    this.classList.remove("fa-copy");
                    this.classList.add("fa-check");
                    this.style.color = "#28a745"; // Green color

                    setTimeout(() => {
                        this.classList.remove("fa-check");
                        this.classList.add("fa-copy");
                        this.style.color = ""; // Reset to default color
                    }, 1500);
                }).catch(err => {
                    console.error("Failed to copy: ", err);
                });
            } else {
                console.error("No link available to copy.");
            }
        });
    });
});

// ✅ Modify the event listener to apply sanitization to ALL baseURL fields
document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("#baseURL").forEach(baseURLInput => {
        baseURLInput.addEventListener("blur", function () {
            this.value = sanitizeBaseURL(this.value);
        });
    });
});

// ✅ Base URL Sync using Local Storage (Ensures baseURL is sanitized immediately)
const baseURLInputs = document.querySelectorAll("#baseURL");
if (baseURLInputs.length > 0) {
    let storedBaseURL = localStorage.getItem("baseURL");

    if (storedBaseURL) {
        storedBaseURL = sanitizeBaseURL(storedBaseURL); // Sanitize immediately
        localStorage.setItem("baseURL", storedBaseURL); // Store sanitized value
        baseURLInputs.forEach(input => input.value = storedBaseURL);
    }

    baseURLInputs.forEach(input => {
        input.addEventListener("input", function () {
            const sanitizedValue = sanitizeBaseURL(input.value.trim());
            localStorage.setItem("baseURL", sanitizedValue); // Store sanitized value
            generateAllPremadeLinks(); // Regenerate all links on change
        });
    });
}


// ✅ Ensure premade links always use sanitized base URL
function updateLink(outputId, path) {
    let baseURL = localStorage.getItem("baseURL") || "";
    baseURL = sanitizeBaseURL(baseURL); // Ensure sanitization before use

    const outputElement = document.getElementById(outputId);

    if (!baseURL) {
        outputElement.innerText = "Please enter your portal's URL.";
        return;
    }

    const fullLink = `https://${baseURL}${path}`;
    outputElement.innerHTML = `<a href="${fullLink}" target="_blank">${fullLink}</a>`;
}


    
// ✅ Functions to generate premade links dynamically
function generateAddedYesterdayLink() {
    updateLink("outputAddedYesterday", "/media/?resetSearch&filterType=add&field=dateCreated&value=lastday");
}

function generateAddedLastWeekLink() {
    updateLink("outputAddedLastWeek", "/media/?resetSearch&filterType=add&field=dateCreated&value=lastweek");
}

function generateWatermarkedAssetsLink() {
    updateLink("outputWatermarkedAssets", "/media/?resetSearch&filterType=add&field=watermark&value=1");
}

function generateArchivedAssetsLink() {
    updateLink("outputArchivedAssets", "/media/?resetSearch&filterType=add&field=archive&value=1");
}

function generatePublicAssetsLink() {
    updateLink("outputPublicAssets", "/media/?resetSearch&filterType=add&field=isPublic&value=1");
}

function generateLimitedUsageAssetsLink() {
    updateLink("outputLimitedUsageAssets", "/media/?resetSearch&filterType=add&field=keyVisual&value=1");
}

function generateSentForReviewLink() {
    updateLink("outputSentForReview", "/media/?resetSearch&filterType=add&field=audit&value=1");
}
function generateActiveAssetsLink() {
    updateLink("outputActiveAssets", "/media/?resetSearch&filterType=add&field=isActive&value=true");
}


// ✅ Function to generate all premade links at once
function generateAllPremadeLinks() {
    generateAddedYesterdayLink();
    generateAddedLastWeekLink();
    generateWatermarkedAssetsLink();
    generateArchivedAssetsLink();
    generatePublicAssetsLink();
    generateLimitedUsageAssetsLink();
    generateSentForReviewLink();
    generateSentForReviewLink();
    generateActiveAssetsLink();
}
