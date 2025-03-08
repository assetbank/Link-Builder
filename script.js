// ✅ Function to sanitize metaproperty names, values, and tags
function sanitizeDatabaseName(input) {
    return input.replace(/[^a-zA-Z0-9-]/g, "_"); // Replace invalid characters with "_"
}

// ✅ Handling container switching and input event listeners

document.addEventListener("DOMContentLoaded", function () {
    let currentContainer = 0;
    const containers = document.querySelectorAll(".container");
    const switchButtons = document.querySelectorAll(".switch-btn");
    let storedBaseURL = ""; // Store baseURL value when switching

    // Ensure the first container is visible initially
    containers[currentContainer].classList.add("active");

    // ✅ Function to handle real-time link generation
    function handleInputChange() {
        if (currentContainer === 0) {
            generateLink();
        } else {
            generateKeywordLink();
        }
    }

    // ✅ Attach event listeners to all input fields for live updates
    document.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", handleInputChange);
    });

    // ✅ Attach event listeners to switch buttons
    switchButtons.forEach(button => {
        button.addEventListener("click", function () {
            // Store the baseURL value before switching
            const currentBaseURLInput = containers[currentContainer].querySelector("#baseURL");
            if (currentBaseURLInput) {
                storedBaseURL = currentBaseURLInput.value;
            }

            // Hide the current container
            containers[currentContainer].classList.remove("active");

            // Switch active container
            currentContainer = (currentContainer + 1) % containers.length;

            // Show the new container
            containers[currentContainer].classList.add("active");

            // Restore the baseURL value in the new container
            const newBaseURLInput = containers[currentContainer].querySelector("#baseURL");
            if (newBaseURLInput) {
                newBaseURLInput.value = storedBaseURL;
            }

            // Generate the correct link based on the active container
            handleInputChange(); // Ensures the link updates on switch
        });
    });

    // ✅ Generate an initial link if fields are prefilled
    handleInputChange();
});

// ✅ Function to generate the link for container1 (metaproperty-based & tag-based)
function generateLink() {
    const baseURL = document.querySelector("#container1 #baseURL").value.trim();
    const outputElement = document.getElementById("output");

    if (!baseURL) {
        outputElement.innerText = "Please enter your portal's URL.";
        return;
    }

    const params = [];

    // ✅ Apply sanitization ONLY to metaproperties (Not tags)
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
        outputElement.innerText = "Please enter at least one metaproperty or tag.";
        return;
    }

    const generatedLink = params.some(p => p.includes("metaproperty_"))
        ? `https://${baseURL}/search/set/?resetsearch&${params.join("&")}&filterType=add&filterkey=savedFilters`
        : `https://${baseURL}/search/media/?${params.join("&")}&filterType=add`;

    outputElement.innerHTML = `<a href="${generatedLink}" target="_blank">${generatedLink}</a>`;
}

// ✅ Function to generate the keyword-based search link
function generateKeywordLink() {
    const baseURL = document.querySelector("#container2 #baseURL").value.trim();
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
    // Attach click event to all copy icons dynamically
    document.querySelectorAll(".fas.fa-copy").forEach(copyIcon => {
        copyIcon.addEventListener("click", function () {
            const outputContainer = this.closest(".output-container"); // Find parent container
            const outputElement = outputContainer.querySelector("p"); // Locate output text
            const linkElement = outputElement.querySelector("a"); // Find the link

            if (linkElement) {
                const link = linkElement.href;
                navigator.clipboard.writeText(link).then(() => {
                    // Change the clicked copy icon to a green checkmark
                    this.classList.remove("fa-copy");
                    this.classList.add("fa-check");
                    this.style.color = "#28a745"; // Green color

                    // Revert back to the copy icon after 1.5 seconds
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
function clearInput(inputId) {
    document.getElementById(inputId).value = "";
}
