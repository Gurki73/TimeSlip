// Declare variables for each rule component
let W = '', T = '', A = '', G = '', D = '', E = '';
let w = '', t = '', a = '', g = '', d = '';

export function updateHumanRule(id, string) {
    // Update the appropriate rule part
    switch (id[0]) {
        case 'W': W = string; break;
        case 'T': T = string; break;
        case 'A': A = string; break;
        case 'G': G = string; break;
        case 'D': D = string; break;
        case 'E': E = string; break;
        case 'w': w = string; break;
        case 't': t = string; break;
        case 'a': a = string; break;
        case 'g': g = string; break;
        case 'd': d = string; break;
        default:
            console.warn(`Unrecognized rule ID: ${id}`);
            return;
    }

    // Rewrite the human-readable rule after an update
    writeHumanRule();
}

function writeHumanRule() {
    const humanTextField = document.getElementById('typing-text');

    // Construct the human-readable text
    const humanText = `
        ${W} ${T} ${A} ${G} ${D} ${E}
        ${w} ${t} ${a} ${g} ${d}
    `.trim().replace(/\s+/g, ' '); // Clean up extra spaces

    // Apply the text to the HTML element
    humanTextField.innerHTML = humanText || '&gt; <span class="blinking-cursor noto">🏗️</span>';

    // Optionally add a CSS animation for revealing text
    applyTypingEffect(humanTextField);
}

function applyTypingEffect(element) {
    const text = element.textContent; // Get the current content
    element.textContent = ''; // Clear it for the typing effect

    // Simulate typing one character at a time
    let i = 0;
    const typingSpeed = 50; // Adjust speed as needed (ms per character)
    const interval = setInterval(() => {
        element.textContent += text[i];
        i++;
        if (i >= text.length) clearInterval(interval);
    }, typingSpeed);
}
