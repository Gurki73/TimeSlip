export function updateFeedback(message, type = "info", emoji = '➜') {
    const bar = document.getElementById("feedback-console");
    if (!bar) return;

    // Create a container span for one line
    const line = document.createElement("span");
    line.classList.add("line-entry"); // optional for extra styling / scroll-snap

    // Emoji
    const emojiLabel = document.createElement("span");
    emojiLabel.textContent = emoji + " ";
    emojiLabel.classList.add("noto", "small");

    // Append emoji and message to line
    line.appendChild(emojiLabel);
    line.appendChild(document.createTextNode(message));

    // Add line to bar
    bar.appendChild(line);

    // Apply type (info/error)
    bar.className = type;

    // Scroll to bottom
    bar.scrollTop = bar.scrollHeight;
}

