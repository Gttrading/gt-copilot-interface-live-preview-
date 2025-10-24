import { GoogleGenAI } from "@google/genai";

// ------- DOM refs -------
const app = document.getElementById('app') as HTMLDivElement;
const collapseBtn = document.getElementById('collapseBtn') as HTMLButtonElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const codeEditor = document.getElementById('code-editor') as HTMLTextAreaElement;
const previewFrame = document.getElementById('preview-frame') as HTMLIFrameElement;
const readAloudCb = document.getElementById('read-aloud-checkbox') as HTMLInputElement;
const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
const updatesDiv = document.getElementById('updates') as HTMLDivElement;
const pageContainer = document.getElementById('page-container') as HTMLDivElement;
const snapshotBannerContainer = document.getElementById('snapshot-banner-container') as HTMLDivElement;

// Header buttons
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const downloadProjectBtn = document.getElementById('download-project-btn') as HTMLButtonElement;
const githubBtn = document.getElementById('github-btn') as HTMLButtonElement;
const deployBtn = document.getElementById('deploy-btn') as HTMLButtonElement;
const shareBtn = document.getElementById('share-btn') as HTMLButtonElement;
const apiKeyBtn = document.getElementById('api-key-btn') as HTMLButtonElement;


// ------- Toasts & Modals -------
function showToast(message: string) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 1500);
}

function showShareModal(shareUrl: string) {
    const container = document.getElementById('modal-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="modal-overlay visible" id="share-modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Share Link</h2>
                    <button class="modal-close-btn" id="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Anyone with this link can view a snapshot of your code.</p>
                    <input type="text" class="gt-input" readonly value="${shareUrl}" id="share-url-input"/>
                </div>
                <div class="modal-footer">
                    <button class="gt-button" id="copy-share-url-btn">Copy Link</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modal-close')?.addEventListener('click', () => container.innerHTML = '');
    document.getElementById('share-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) container.innerHTML = '';
    });
    document.getElementById('copy-share-url-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast('Share link copied!');
            container.innerHTML = '';
        });
    });
}


// ------- Collapse toggle -------
collapseBtn?.addEventListener('click', () => app.classList.toggle('collapsed'));

// ------- Typewriter suggestions -------
const suggestions = [
    "Build a trading monitor dashboard for GT Copilot.",
    "Create a 3D animated zoom chart interface.",
    "Design a pro-style indicator panel with alerts.",
    "Make a clean landing page with a hero chart."
];
let sIndex = 0;
async function typeSuggestion(text: string) {
    if (!promptInput) return;
    promptInput.placeholder = "";
    for (let i = 0; i <= text.length; i++) {
        promptInput.placeholder = text.slice(0, i);
        await new Promise(r => setTimeout(r, 18));
    }
    await new Promise(r => setTimeout(r, 1000));
}
(async function cycle() {
    while (promptInput) {
        await typeSuggestion("Describe what to build…");
        if (suggestions.length > 0) {
            await typeSuggestion(suggestions[sIndex % suggestions.length]);
            sIndex++;
        }
    }
})();

function updatePreview() { 
    if (previewFrame) {
        previewFrame.srcdoc = codeEditor.value; 
    }
}

// ------- Speech -------
function speakSummary(summaryText: string) {
    if (!readAloudCb || !volumeSlider || !readAloudCb.checked || !summaryText) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(summaryText);
    u.volume = parseFloat(volumeSlider.value);
    window.speechSynthesis.speak(u);
}

// ------- Log updates -------
function logUpdate(message: string) {
    if (!updatesDiv) return;
    const p = document.createElement('p');
    const time = new Date().toLocaleTimeString();
    p.textContent = `[${time}] ${message}`;
    updatesDiv.appendChild(p);
    updatesDiv.scrollTop = updatesDiv.scrollHeight;
}

// ------- Generation logic -------
generateBtn?.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert("Please enter a description of what to build.");
        return;
    }
    codeEditor.value = "";
    updatesDiv.innerHTML = "";
    generateBtn.disabled = true;
    logUpdate(`🧠 Prompt sent: "${prompt}"`);
    try {
        logUpdate("⏳ Initializing AI...");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        logUpdate("🚀 Generating code...");
        const generationPrompt = `You are an expert web developer specializing in creating single, self-contained HTML files with vanilla JavaScript and CSS. Based on the user's request, generate a complete HTML file. The HTML file should include all necessary CSS and JavaScript within the same file. Do not use any external libraries unless explicitly asked.

**Default Layout Heuristics:**
For any generated component like a landing page hero or key section, if the user prompt does not specify a particular alignment (e.g., "left-aligned," "asymmetrical"), you MUST implement a centered layout by default.
- **What to center:** Stack the primary elements (headline, subtext, CTA button) vertically.
- **How to center:** All stacked elements must share the same central vertical axis. The entire block should be perfectly centered horizontally in the viewport.
- **Spacing:** Use clean, professional vertical spacing between elements to maintain a clear visual hierarchy.
- **Responsiveness:** Ensure this centered layout is fully responsive and maintains its integrity on mobile, tablet, and desktop screens without any horizontal drift or uneven gutters.
- **When to override:** Only generate an asymmetrical or non-centered layout if the user explicitly asks for it.

Your entire response must be ONLY the code, wrapped in a single markdown block like \`\`\`html ... \`\`\`. Do not include any other text, titles, or explanations before or after the code block.

User request: ${prompt}`;
        const responseStream = await ai.models.generateContentStream({ model: "gemini-2.5-pro", contents: generationPrompt });
        let fullCode = "";
        for await (const chunk of responseStream) {
            fullCode += chunk.text;
            codeEditor.value = fullCode.replace(/^```html\n?|```$/g, '');
            updatePreview();
        }
        logUpdate("✅ Code generation complete.");
        logUpdate("✍️ Generating summary...");
        const summaryPrompt = `Briefly summarize what the following HTML code does in a single, short, conversational sentence. Code: ${codeEditor.value}`;
        const summaryResponse = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: summaryPrompt });
        const summaryText = summaryResponse.text.trim();
        // FIX: Added backticks to correctly form the template literal string.
        logUpdate(`💡 Summary: ${summaryText}`);
        speakSummary(summaryText);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        logUpdate(`❌ An error occurred: ${errorMessage}`);
        alert(`An error occurred during generation. Please check the console for details.\n${errorMessage}`);
    } finally {
        generateBtn.disabled = false;
        logUpdate("🎉 Generation finished. Ready for new prompt.");
    }
});

// ------- Snapshot Logic -------
function saveSnapshot() {
    const snapshot = {
        timestamp: new Date().toISOString(),
        content: codeEditor.value,
    };
    localStorage.setItem('gt_pilot_snapshot', JSON.stringify(snapshot));
    showToast('✓ Saved');
}

function showRestoreBanner() {
    const snapshotRaw = localStorage.getItem('gt_pilot_snapshot');
    if (!snapshotRaw) return;
    
    const banner = document.createElement('div');
    banner.className = 'snapshot-banner';
    banner.innerHTML = `
        <span>Restore last snapshot?</span>
        <div>
            <button class="gt-button" id="restore-btn">Restore</button>
            <button class="gt-button secondary" id="dismiss-banner-btn">Dismiss</button>
        </div>
    `;
    snapshotBannerContainer.appendChild(banner);

    document.getElementById('restore-btn')?.addEventListener('click', () => {
        const snapshot = JSON.parse(snapshotRaw);
        codeEditor.value = snapshot.content;
        updatePreview();
        showToast('Snapshot restored.');
        banner.remove();
    });
    document.getElementById('dismiss-banner-btn')?.addEventListener('click', () => banner.remove());
}

saveBtn?.addEventListener('click', saveSnapshot);

// ------- Header Actions -------
copyBtn?.addEventListener('click', () => {
    const code = codeEditor.value.trim();
    if (!code) {
        showToast('Nothing to copy!');
        return;
    }
    const timestamp = new Date().toLocaleString();
    const contentToCopy = `// GT Pilot Snapshot — ${timestamp}\n// Files: index.html (inline styles & scripts)\n\n${code}`;
    navigator.clipboard.writeText(contentToCopy).then(() => {
        showToast('Copied app to clipboard!');
    });
});

downloadProjectBtn?.addEventListener('click', () => {
    const code = codeEditor.value.trim();
     if (!code) { 
        showToast("There's no code to download!"); 
        return; 
    }
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `gt-pilot-export-${formattedDate}.txt`;
    const blob = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    showToast('Download started.');
});

shareBtn?.addEventListener('click', () => {
    const code = codeEditor.value.trim();
    if (!code) {
        showToast('Nothing to share!');
        return;
    }
    const encodedCode = btoa(encodeURIComponent(code));
    const url = `${window.location.origin}${window.location.pathname}#/shared/${encodedCode}`;
    showShareModal(url);
});


// ------- Client-Side Router -------
const routes = {
    '#/integrations/github': renderGitHubPage,
    '#/deploy': renderDeployPage,
    '#/settings/api-keys': renderApiKeysPage,
};

function handleRouteChange() {
    const hash = window.location.hash || '#/';
    const routeKey = Object.keys(routes).find(r => hash.startsWith(r));

    if (routeKey && routes[routeKey]) {
        app.classList.add('hidden');
        pageContainer.classList.remove('hidden');
        routes[routeKey]();
    } else if (hash.startsWith('#/shared/')) {
        app.classList.remove('hidden');
        pageContainer.classList.add('hidden');
        pageContainer.innerHTML = '';
        try {
            const encoded = hash.split('/shared/')[1];
            const decoded = decodeURIComponent(atob(encoded));
            codeEditor.value = decoded;
            updatePreview();
            showToast('Shared code loaded!');
        } catch (e) {
            showToast('Error loading shared code.');
        }
        window.location.hash = '#/';
    } else {
        app.classList.remove('hidden');
        pageContainer.classList.add('hidden');
        pageContainer.innerHTML = '';
    }
}

githubBtn?.addEventListener('click', () => window.location.hash = '#/integrations/github');
deployBtn?.addEventListener('click', () => window.location.hash = '#/deploy');
apiKeyBtn?.addEventListener('click', () => window.location.hash = '#/settings/api-keys');

pageContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.action === 'closePage') {
        window.location.hash = '#/';
    }
});

// Page Renderers
function renderPage(title: string, content: string) {
    pageContainer.innerHTML = `
        <div class="page-content">
            <header class="page-header">
                <h1 class="page-title">${title}</h1>
                <button class="close-page-btn" data-action="closePage">&times;</button>
            </header>
            ${content}
        </div>
    `;
}

function renderGitHubPage() {
    renderPage('GitHub Integration', `
        <div class="gt-card">
            <div class="form-group">
                <label for="gh-alias">Alias / Environment</label>
                <input type="text" id="gh-alias" class="gt-input" placeholder="e.g., Production Account">
            </div>
            <div class="form-group">
                <label for="gh-repo">Repository URL</label>
                <input type="url" id="gh-repo" class="gt-input" placeholder="https://github.com/user/repo">
            </div>
            <div class="form-group">
                <label for="gh-key">API Key</label>
                <input type="password" id="gh-key" class="gt-input" placeholder="••••••••••••••••••••••••••••••••">
            </div>
            <button class="gt-button">Connect</button>
        </div>
    `);
}

function renderDeployPage() {
    renderPage('Deploy App', `
        <div class="gt-card">
            <h3>1. Build Check</h3>
            <p>Status: <span style="color: var(--green);">✓ Ready</span></p>
        </div>
        <div class="gt-card">
            <h3>2. Select Target</h3>
            <p><i>(UI for selecting Static/Cloud/Custom targets will be here)</i></p>
        </div>
        <div class="gt-card">
            <h3>3. Review & Deploy</h3>
            <button class="gt-button" disabled>Deploy</button>
        </div>
    `);
}

function renderApiKeysPage() {
    // Basic crypto setup (for demonstration)
    const KEY_STORAGE = 'gt_pilot_keys';
    let keys = JSON.parse(localStorage.getItem(KEY_STORAGE) || '{}');

    const render = () => {
         renderPage('API Key Manager', `
            <div class="gt-card">
                <h3>Add New Key</h3>
                <div class="form-group">
                    <label for="api-name">Name</label>
                    <input type="text" id="api-name" class="gt-input" placeholder="e.g., Gemini API">
                </div>
                <div class="form-group">
                    <label for="api-value">Key</label>
                    <input type="password" id="api-value" class="gt-input" placeholder="Enter your secret key">
                </div>
                <button class="gt-button" id="add-key-btn">Add Key</button>
            </div>
            <div class="gt-card">
                <h3>Managed Keys</h3>
                <ul id="keys-list" style="list-style: none; padding: 0;">
                    ${Object.keys(keys).length === 0 ? '<li>No keys saved.</li>' : ''}
                    ${Object.keys(keys).map(name => `
                        <li style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--edge);">
                            <span>${name}</span>
                            <button class="gt-button secondary" data-key-name="${name}">Delete</button>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `);

        document.getElementById('add-key-btn')?.addEventListener('click', async () => {
            const nameInput = document.getElementById('api-name') as HTMLInputElement;
            const valueInput = document.getElementById('api-value') as HTMLInputElement;
            if (nameInput.value && valueInput.value) {
                // In a real app, use a master key derived from user password
                const masterKey = await crypto.subtle.generateKey({name: "AES-GCM", length: 256}, true, ["encrypt", "decrypt"]);
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const encodedValue = new TextEncoder().encode(valueInput.value);
                const encrypted = await crypto.subtle.encrypt({name: "AES-GCM", iv}, masterKey, encodedValue);

                // For demo, we are not storing the masterKey, so this is not decryptable.
                // A real implementation would manage the masterKey securely.
                keys[nameInput.value] = { iv: Array.from(iv), encrypted: Array.from(new Uint8Array(encrypted)) };
                localStorage.setItem(KEY_STORAGE, JSON.stringify(keys));
                valueInput.value = '';
                nameInput.value = '';
                showToast('Key saved (demo encryption).');
                render();
            }
        });

        document.getElementById('keys-list')?.addEventListener('click', (e) => {
             const target = e.target as HTMLElement;
             if (target.tagName === 'BUTTON' && target.dataset.keyName) {
                 delete keys[target.dataset.keyName];
                 localStorage.setItem(KEY_STORAGE, JSON.stringify(keys));
                 showToast('Key deleted.');
                 render();
             }
        });
    }
    render();
}

function setupTooltipTouchInteractions() {
    const iconButtons = document.querySelectorAll('.icon-btn');
    let touchTimer: number;

    iconButtons.forEach(btn => {
        const tooltip = btn.querySelector('.tooltip') as HTMLElement;
        if (!tooltip) return;

        const showTooltip = () => {
            tooltip.classList.add('show-on-touch');
        };

        const hideTooltip = () => {
            clearTimeout(touchTimer);
            tooltip.classList.remove('show-on-touch');
        };

        btn.addEventListener('touchstart', () => {
            touchTimer = window.setTimeout(showTooltip, 400);
        }, { passive: true });

        btn.addEventListener('touchend', hideTooltip);
        btn.addEventListener('touchcancel', hideTooltip);
    });
}


// ------- Initial Load -------
window.addEventListener('DOMContentLoaded', () => {
    logUpdate("✅ Ready to generate UI. Describe what you want to build.");
    showRestoreBanner();
    handleRouteChange();
    setupTooltipTouchInteractions();
});
window.addEventListener('hashchange', handleRouteChange);