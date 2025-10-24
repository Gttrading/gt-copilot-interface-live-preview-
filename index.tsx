import { showRenderVisualizer, hideRenderVisualizer } from "./components/RenderVisualizer.tsx";
// FIX: Correct import path casing to match filename 'GTBrain.tsx'.
import { gtBrain } from './components/GTBrain.tsx';
import * as GTChat from './components/GTChat.tsx';
// FIX: Correct import path to use GTHamburgerMenu.tsx implementation instead of placeholder.
import { initHamburgerMenu } from "./components/GTHamburgerMenu.tsx";
import * as GTAuth from './components/GTAuth.tsx';

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
const memoryPromptContainer = document.getElementById('memory-prompt-container') as HTMLDivElement;
const uploadBtn = document.getElementById('upload-btn') as HTMLButtonElement;
const fileUploadInput = document.getElementById('file-upload-input') as HTMLInputElement;
const userDisplay = document.getElementById('user-display') as HTMLDivElement;


// Header buttons
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const downloadProjectBtn = document.getElementById('download-project-btn') as HTMLButtonElement;
const githubBtn = document.getElementById('github-btn') as HTMLButtonElement;
const deployBtn = document.getElementById('deploy-btn') as HTMLButtonElement;
const shareBtn = document.getElementById('share-btn') as HTMLButtonElement;
const apiKeyBtn = document.getElementById('api-key-btn') as HTMLButtonElement;

// ------- Data Structures for Persistent Memory -------
interface Revision {
    id: string;
    timestamp: string;
    content: string;
    description: string;
}

interface ProjectData {
    revisions: Revision[];
}


// ------- File Manager (Client-Side Simulated Backend) -------
const FileManager = (() => {
    const MANIFEST_KEY = 'GT_PROJECTS_MANIFEST';
    const getProjectKey = (name: string) => `GT_PROJECT__${name}`;
    const MAX_PROJECT_SIZE = 5 * 1024 * 1024; // 5 MB

    interface ProjectManifest {
        [name: string]: { timestamp: string; };
    }

    function sanitizeName(name: string): string {
        let baseName = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
        return baseName.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'Untitled';
    }

    function getManifest(): ProjectManifest {
        const raw = localStorage.getItem(MANIFEST_KEY);
        return raw ? JSON.parse(raw) : {};
    }

    function saveManifest(manifest: ProjectManifest) {
        localStorage.setItem(MANIFEST_KEY, JSON.stringify(manifest));
    }

    return {
        async save(name: string, content: string): Promise<{ ok: boolean, message: string, finalName: string }> {
            const finalName = sanitizeName(name);
            if (content.length > MAX_PROJECT_SIZE) {
                return { ok: false, message: 'Project size exceeds 5MB limit.', finalName };
            }

            const manifest = getManifest();
            manifest[finalName] = { timestamp: new Date().toISOString() };
            
            localStorage.setItem(getProjectKey(finalName), content);
            saveManifest(manifest);
            
            return { ok: true, message: `Project '${finalName}' saved.`, finalName };
        },

        async list(): Promise<{ name: string, timestamp: string }[]> {
            const manifest = getManifest();
            return Object.entries(manifest)
                .map(([name, data]) => ({ name, timestamp: data.timestamp }))
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        },

        async open(name: string): Promise<{ name: string, projectData: ProjectData | null, timestamp: string }> {
            const manifest = getManifest();
            const projectDataFromManifest = manifest[name];
            if (!projectDataFromManifest) throw new Error("Project not found.");
            
            const rawContent = localStorage.getItem(getProjectKey(name));
            let projectData: ProjectData | null = null;

            if (rawContent) {
                try {
                    // Try parsing as the new ProjectData format
                    const parsed = JSON.parse(rawContent);
                    if (parsed && Array.isArray(parsed.revisions)) {
                        projectData = parsed;
                    }
                } catch (e) {
                    // If parsing fails, it's likely the old string format.
                    console.log(`Migrating old project format for: ${name}`);
                    projectData = {
                        revisions: [{
                            id: crypto.randomUUID(),
                            timestamp: new Date().toISOString(),
                            content: rawContent,
                            description: "Imported from old format"
                        }]
                    };
                    // Persist the new format immediately
                    await this.save(name, JSON.stringify(projectData));
                }
            }
            return { name, projectData, timestamp: projectDataFromManifest.timestamp };
        },

        async delete(name: string): Promise<{ ok: boolean, message: string }> {
            const manifest = getManifest();
            if (!manifest[name]) return { ok: false, message: "Project not found." };
            
            delete manifest[name];
            localStorage.removeItem(getProjectKey(name));
            saveManifest(manifest);
            return { ok: true, message: `Project '${name}' deleted.` };
        },
    };
})();


// ------- Project State Management -------
let currentProject: {
    name: string;
    isDirty: boolean;
    data: ProjectData;
} = {
    name: 'Untitled Project',
    isDirty: false,
    data: { revisions: [] },
};

function updateCurrentProject(name: string, isDirty = false) {
    currentProject.name = name;
    currentProject.isDirty = isDirty;
    const titleEl = document.querySelector('.header-title');
    if (titleEl) {
        titleEl.textContent = `GT Pilot Hub - ${name}${isDirty ? '*' : ''}`;
    }
}

// ------- Snapshot / Revision Management -------
function addRevision(content: string, description: string, markDirty: boolean = true): boolean {
    const lastRevision = currentProject.data.revisions.length > 0 
        ? currentProject.data.revisions[currentProject.data.revisions.length - 1] 
        : null;
        
    if (lastRevision && lastRevision.content === content) {
        return false; // No change, no new revision
    }

    const newRevision: Revision = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        content,
        description,
    };
    currentProject.data.revisions.push(newRevision);

    if (markDirty) {
        updateCurrentProject(currentProject.name, true);
    }
    
    showToast(`Snapshot created: ${description.substring(0, 40)}`);
    return true;
}

function deleteRevision(revisionId: string): boolean {
    const initialLength = currentProject.data.revisions.length;
    const revisionToDelete = currentProject.data.revisions.find(r => r.id === revisionId);

    if (currentProject.data.revisions.length <= 1 && revisionToDelete) {
        showToast('Cannot delete the only revision.');
        return false;
    }

    currentProject.data.revisions = currentProject.data.revisions.filter(r => r.id !== revisionId);
    const success = currentProject.data.revisions.length < initialLength;

    if (success) {
        const isDeletingActiveCode = codeEditor.value === revisionToDelete?.content;
        if (isDeletingActiveCode) {
            const newLatestRevision = currentProject.data.revisions[currentProject.data.revisions.length - 1];
            if (newLatestRevision) {
                codeEditor.value = newLatestRevision.content;
                updatePreview();
            }
        }
        updateCurrentProject(currentProject.name, true);
        showToast('Revision deleted.');
    }
    return success;
}

function restoreRevision(revisionId: string): boolean {
    const revisionToRestore = currentProject.data.revisions.find(r => r.id === revisionId);
    if (!revisionToRestore) {
        showToast('Error: Revision not found.');
        return false;
    }
    
    codeEditor.value = revisionToRestore.content;
    updatePreview();
    
    const lastSavedRevision = currentProject.data.revisions.length > 0 ? currentProject.data.revisions[currentProject.data.revisions.length - 1] : null;
    const isDirty = lastSavedRevision ? lastSavedRevision.content !== revisionToRestore.content : true;

    updateCurrentProject(currentProject.name, isDirty);
    showToast('Snapshot restored.');
    return true;
}


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
    }, 3000);
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

function showSaveAsModal() {
    const container = document.getElementById('modal-container');
    if (!container) return;
    
    container.innerHTML = `
        <div class="modal-overlay visible" id="save-as-modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Save As</h2>
                    <button class="modal-close-btn" id="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Enter a name for your project.</p>
                    <div class="form-group">
                         <label for="save-as-name">Project Name</label>
                         <input type="text" id="save-as-name" class="gt-input" placeholder="my-awesome-app" value="${currentProject.name === 'Untitled Project' ? '' : currentProject.name}">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="gt-button" id="confirm-save-as-btn">Save</button>
                </div>
            </div>
        </div>
    `;
    
    const input = document.getElementById('save-as-name') as HTMLInputElement;
    input?.focus();

    const close = () => container.innerHTML = '';
    document.getElementById('modal-close')?.addEventListener('click', close);
    document.getElementById('save-as-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) close();
    });
    document.getElementById('confirm-save-as-btn')?.addEventListener('click', async () => {
        const filename = input.value.trim() || 'Untitled Project';
        const success = await performSave(filename);
        if (success) {
            close();
        }
    });
}

async function showOpenProjectModal() {
    const container = document.getElementById('modal-container');
    if (!container) return;

    const renderList = async () => {
        const projects = await FileManager.list();
        const listHTML = projects.length > 0 ? projects.map(p => `
            <li class="project-list-item" data-project-name="${p.name}">
                <div class="project-info">
                    <span class="project-name">${p.name}</span>
                    <span class="project-timestamp">Last saved: ${new Date(p.timestamp).toLocaleString()}</span>
                </div>
                <div class="project-actions">
                    <button class="gt-button" data-action="open">Open</button>
                    <button class="gt-button secondary" data-action="delete">Delete</button>
                </div>
            </li>
        `).join('') : '<li>No saved projects found.</li>';

        container.innerHTML = `
            <div class="modal-overlay visible" id="open-project-modal-overlay">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2 class="modal-title">Open Project</h2>
                        <button class="modal-close-btn" id="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <ul class="project-list">${listHTML}</ul>
                    </div>
                </div>
            </div>
        `;

        const close = () => container.innerHTML = '';
        document.getElementById('modal-close')?.addEventListener('click', close);
        document.getElementById('open-project-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) close();
        });

        container.querySelector('.project-list')?.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const action = target.dataset.action;
            const item = target.closest('.project-list-item') as HTMLLIElement;
            if (!action || !item) return;

            const projectName = item.dataset.projectName!;

            if (action === 'open') {
                try {
                    const { name, projectData } = await FileManager.open(projectName);
                    if (projectData) {
                        currentProject = { name, data: projectData, isDirty: false };
                        const latestContent = projectData.revisions.length > 0
                            ? projectData.revisions[projectData.revisions.length - 1].content
                            : '';
                        codeEditor.value = latestContent;
                        updatePreview();
                        updateCurrentProject(name, false);
                        localStorage.removeItem('gt_pilot_snapshot');
                        showToast(`Opened '${name}'`);
                        close();
                    } else {
                        throw new Error(`Could not load data for project '${name}'. It may be corrupt.`);
                    }
                } catch (err) {
                    showToast((err as Error).message);
                }
            } else if (action === 'delete') {
                if (confirm(`Are you sure you want to delete "${projectName}"? This cannot be undone.`)) {
                    const result = await FileManager.delete(projectName);
                    showToast(result.message);
                    if (result.ok) {
                        renderList(); // Re-render the list after deletion
                        if (currentProject.name === projectName) {
                            newProject();
                        }
                    }
                }
            }
        });
    };

    renderList();
}


// Expose modal and revision functions to be called from other components
(window as any).showSaveAsModal = showSaveAsModal;
(window as any).showOpenProjectModal = showOpenProjectModal;
(window as any).deleteRevision = deleteRevision;
(window as any).restoreRevision = restoreRevision;

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
    p.className = 'update-message';
    const time = new Date().toLocaleTimeString();
    p.textContent = `[${time}] ${message}`;
    updatesDiv.appendChild(p);
    updatesDiv.scrollTop = updatesDiv.scrollHeight;
}

// ------- Generation logic -------
let longPressTimer: number;
let isLongPress = false;
let isListening = false;

// FIX: Cast window to 'any' to access non-standard SpeechRecognition properties without TypeScript errors.
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
let recognition: any;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        promptInput.value = transcript;
    };

    recognition.onerror = (event: any) => {
        showToast(`Voice recognition error: ${event.error}`);
        console.error('Speech recognition error', event);
    };
    
    recognition.onstart = () => {
        isListening = true;
        generateBtn.classList.add('listening');
        if(navigator.vibrate) navigator.vibrate(50);
    };

    recognition.onend = () => {
        isListening = false;
        generateBtn.classList.remove('listening');
    };
}

const handlePressStart = () => {
  isLongPress = false;
  longPressTimer = window.setTimeout(() => {
    isLongPress = true;
    if (recognition && !isListening) {
        try {
            recognition.start();
        } catch (e) {
            console.error("Error starting recognition:", e);
            showToast("Could not start voice recognition.");
        }
    } else if (!recognition) {
        showToast("Voice recognition not supported in this browser.");
    }
  }, 1000);
};

const handlePressEnd = () => {
  clearTimeout(longPressTimer);
};

generateBtn?.addEventListener('mousedown', handlePressStart);
generateBtn?.addEventListener('mouseup', handlePressEnd);
generateBtn?.addEventListener('touchstart', handlePressStart, { passive: true });
generateBtn?.addEventListener('touchend', handlePressEnd);

generateBtn?.addEventListener('click', async (e) => {
    if (isLongPress) {
        e.preventDefault();
        return;
    }

    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert("Please enter a description of what to build.");
        return;
    }

    // --- Autonomous Capability Check (Example) ---
    if (prompt.includes('yfinance') || prompt.includes('stock data')) {
        const result = await gtBrain.ensureCapabilities(['py:yfinance>=0.2.0']);
        if (!result.ok) {
            showToast(`Install failed: ${result.reason}. See Terminal (logId: ${result.logId})`);
            return;
        }
        if (result.installed.length > 0) {
            showToast(`Installed: ${result.installed.join(', ')}`);
        }
    }
    // --- End Capability Check ---

    showRenderVisualizer();
    const visualizerContainer = document.getElementById('render-visualizer-container');
    if (!visualizerContainer) return;
    
    GTChat.showChatInterface(visualizerContainer);
    GTChat.addGTMessage();

    updatesDiv.innerHTML = "";
    generateBtn.disabled = true;

    try {
        const responseStream = await gtBrain.sendMessageStream(prompt);
        let buffer = "";
        let inCodeBlock = false;
        let fullChatText = "";
        let isFirstCodeChunk = true;
        let finalCode = "";

        for await (const chunk of responseStream) {
            const textChunk = chunk.text;
            buffer += textChunk;
            
            let continueProcessing = true;
            while(continueProcessing) {
                if (inCodeBlock) {
                    const endMarker = buffer.indexOf('```');
                    if (endMarker !== -1) {
                        const codeChunk = buffer.substring(0, endMarker);
                        finalCode += codeChunk;
                        buffer = buffer.substring(endMarker + 3);
                        inCodeBlock = false;
                    } else {
                        finalCode += buffer;
                        buffer = "";
                        continueProcessing = false;
                    }
                } else {
                    const startMarker = buffer.indexOf('```html');
                    if (startMarker !== -1) {
                        const textBeforeCode = buffer.substring(0, startMarker);
                        GTChat.updateStreamingMessage(textBeforeCode);
                        fullChatText += textBeforeCode;
                        buffer = buffer.substring(startMarker + 7); 
                        inCodeBlock = true;
                        if(isFirstCodeChunk) {
                            finalCode = codeEditor.value; // Start with existing code for iterative changes
                            isFirstCodeChunk = false;
                        }
                    } else {
                        GTChat.updateStreamingMessage(buffer);
                        fullChatText += buffer;
                        buffer = "";
                        continueProcessing = false;
                    }
                }
            }
        }
        
        if (finalCode) {
            codeEditor.value = finalCode;
            updatePreview();
        }

        GTChat.finalizeMessage();
        gtBrain.addToHistory(prompt, fullChatText);
        const cleanedText = fullChatText.replace(/✅/g, 'OK.').replace(/[*#`]/g, '');
        speakSummary(cleanedText);

        const shortPrompt = prompt.length > 50 ? prompt.substring(0, 47) + '...' : prompt;
        addRevision(codeEditor.value, `AI: ${shortPrompt}`);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        GTChat.updateStreamingMessage(`\n\n❌ An error occurred: ${errorMessage}`);
        GTChat.finalizeMessage();
        alert(`An error occurred during generation. Please check the console for details.\n${errorMessage}`);
    } finally {
        generateBtn.disabled = false;
        logUpdate("🎉 Generation finished. Ready for new prompt.");
        
        if (codeEditor.value.trim()) {
            localStorage.setItem('gt_pilot_snapshot', JSON.stringify({
                timestamp: new Date().toISOString(),
                content: codeEditor.value
            }));
        }

        setTimeout(() => {
            hideRenderVisualizer();
            GTChat.hideChatInterface();
        }, 2500);
    }
});

// ------- File & Snapshot Logic -------
function newProject() {
    if (currentProject.isDirty && !confirm("You have unsaved changes. Are you sure you want to start a new project?")) {
        return;
    }
    codeEditor.value = '';
    updatePreview();
    currentProject = {
        name: 'Untitled Project',
        isDirty: false,
        data: { revisions: [] },
    };
    updateCurrentProject('Untitled Project', false);
    localStorage.removeItem('gt_pilot_snapshot');
    showToast('New project started.');
}

async function performSave(projectName: string): Promise<boolean> {
    // Check for unsaved manual edits and create a revision for them.
    const lastRevision = currentProject.data.revisions.length > 0 
        ? currentProject.data.revisions[currentProject.data.revisions.length - 1] 
        : null;
        
    if (codeEditor.value.trim() && (!lastRevision || lastRevision.content !== codeEditor.value)) {
        const desc = lastRevision ? "Manual edit" : "Initial creation";
        addRevision(codeEditor.value, desc, false);
    }
    
    // FIX: The `sanitizeName` function is scoped within `FileManager` and not accessible here.
    // The `FileManager.save` method handles sanitization internally, so we pass `projectName` directly.
    const result = await FileManager.save(projectName, JSON.stringify(currentProject.data));
    
    if (result.ok) {
        updateCurrentProject(result.finalName, false);
        localStorage.removeItem('gt_pilot_snapshot');
        showToast(result.message);
        return true;
    } else {
        showToast(`Error: ${result.message}`);
        return false;
    }
}

async function saveProject() {
    if (currentProject.name === 'Untitled Project' || currentProject.name === 'Restored Snapshot') {
        showSaveAsModal();
    } else {
        await performSave(currentProject.name);
    }
}

function showRestoreBanner() {
    const snapshotRaw = localStorage.getItem('gt_pilot_snapshot');
    if (!snapshotRaw) return;
    
    const banner = document.createElement('div');
    banner.className = 'snapshot-banner';
    banner.innerHTML = `
        <span>Restore last temp snapshot? (This will be removed)</span>
        <div>
            <button class="gt-button" id="restore-btn">Restore</button>
            <button class="gt-button secondary" id="dismiss-banner-btn">Dismiss</button>
        </div>
    `;
    snapshotBannerContainer.appendChild(banner);

    const dismiss = () => {
        banner.remove();
        localStorage.removeItem('gt_pilot_snapshot');
    };

    document.getElementById('restore-btn')?.addEventListener('click', () => {
        const snapshot = JSON.parse(snapshotRaw);
        codeEditor.value = snapshot.content;
        updatePreview();
        
        currentProject = {
            name: 'Restored Snapshot',
            isDirty: true,
            data: {
                revisions: [{
                    id: crypto.randomUUID(),
                    timestamp: snapshot.timestamp,
                    content: snapshot.content,
                    description: "Restored from temporary snapshot"
                }]
            }
        };
        updateCurrentProject('Restored Snapshot', true);
        showToast('Snapshot restored. Save it as a project.');
        dismiss();
    });
    document.getElementById('dismiss-banner-btn')?.addEventListener('click', dismiss);
}

saveBtn?.addEventListener('click', saveProject);

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
    const filename = `${currentProject.name.replace(/ /g, '_')}-${formattedDate}.html`;
    const blob = new Blob([code], { type: 'text/html' });
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
const routes: { [key: string]: () => void } = {
    '#/integrations/github': renderGitHubPage,
    '#/deploy': renderDeployPage,
    '#/settings/api-keys': renderApiKeysPage,
    '#/terminal': renderTerminalPage,
    '#/code-mirror': renderCodeMirrorPage,
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
            
            // Create a new project state for the shared code
            newProject(); // Clear existing state first
            addRevision(decoded, "Loaded from shared link", true);
            updateCurrentProject('Shared Project', true);

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

function renderTerminalPage() {
    renderPage('GT Terminal', `
        <div class="terminal-container">
            <pre id="terminal-output" class="terminal-output"></pre>
            <div class="terminal-input-bar">
                <span class="terminal-prompt-static">&gt;</span>
                <textarea id="terminal-input" class="gt-input" placeholder="Enter command (e.g., 'help')..." autocomplete="off" spellcheck="false" rows="1"></textarea>
                <button id="run-command-btn" class="gt-button">Run</button>
            </div>
        </div>
    `);
    
    const outputEl = document.getElementById('terminal-output') as HTMLPreElement;
    const inputEl = document.getElementById('terminal-input') as HTMLTextAreaElement;
    const runBtn = document.getElementById('run-command-btn') as HTMLButtonElement;

    if (!outputEl || !inputEl || !runBtn) return;

    inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = (inputEl.scrollHeight) + 'px';
    });
    
    const commandHistory: string[] = [];
    let historyIndex = -1;

    const appendOutput = (text: string, className?: string) => {
        const line = document.createElement('div');
        line.innerHTML = text; 
        if (className) line.className = className;
        outputEl.appendChild(line);
        outputEl.scrollTop = outputEl.scrollHeight;
    };

    const executeCommand = async (command: string) => {
        if (!command.trim()) return;

        appendOutput(`<span class="terminal-prompt">&gt;</span> ${command.replace(/</g, "&lt;").replace(/>/g, "&gt;")}`);
        commandHistory.unshift(command);
        historyIndex = -1;

        runBtn.disabled = true;
        inputEl.disabled = true;

        const result = await gtBrain.executeTerminalCommand(command);
        result.outputLines.forEach(line => appendOutput(line.text, line.className));

        runBtn.disabled = false;
        inputEl.disabled = false;
        inputEl.focus();
        inputEl.style.height = 'auto';
    };

    const run = () => {
        const command = inputEl.value;
        inputEl.value = '';
        executeCommand(command);
    };

    runBtn.addEventListener('click', run);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            run();
        } else if (e.key === 'ArrowUp' && inputEl.selectionStart === 0) {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                inputEl.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown' && inputEl.selectionStart === inputEl.value.length) {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                inputEl.value = commandHistory[historyIndex];
            } else {
                 historyIndex = -1;
                 inputEl.value = '';
            }
        }
    });
    
    appendOutput('GT-Terminal v1.3 connected to GT-Brain Sandbox.');
    appendOutput('Type <span class="terminal-cmd">\'help\'</span> for a list of available commands.');
    appendOutput('');
    inputEl.focus();
}

// Basic HTML syntax highlighter
function syntaxHighlight(html: string): string {
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return html.replace(/(?!--|["'])(\b\w+)=(".*?"|'.*?'|[^ >]+)/g, '<span class="cm-attr-name">$1</span>=<span class="cm-attr-val">$2</span>')
        .replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="cm-tag">$2</span>')
        .replace(/(&lt;!--.*?--&gt;)/g, '<span class="cm-comment">$1</span>');
}

function renderCodeMirrorPage() {
    const code = codeEditor.value;
    // This is a hardcoded snapshot of metadata.json as file access isn't available.
    const metadataContent = `{
  "name": "Copy of GT-PILOT-INTERFACE v 2.4 ✨️",
  "description": "GT Pilot is the core AI-driven interface of the GT Hub ecosystem — a smart, developer-ready workspace designed to visually render, edit, and generate applications in real-time.\\nIt serves as the hands-on cockpit where traders, builders, and innovators interact directly with GT’s AI systems to design, preview, and deploy modular components for the broader GT Hub.\\nFrom UI generation to live logic assembly, GT Pilot acts as the creative engine that turns natural-language ideas into fully functional app experiences — all within one sleek, GT-branded interface.",
  "requestFramePermissions": [
    "microphone"
  ]
}`;

    renderPage('Code Mirror', `
        <div class="code-mirror-container">
            <div class="code-mirror-tabs">
                <button class="cm-tab" data-tab="preview">Preview</button>
                <button class="cm-tab active" data-tab="code">Code</button>
                <button class="cm-tab" data-tab="metadata">Metadata</button>
                <button class="cm-tab" data-tab="settings">Settings</button>
            </div>
            <div class="code-mirror-content">
                <div class="cm-panel active" data-panel="code">
                    <pre class="code-viewer-pre"><code class="language-html">${syntaxHighlight(code)}</code></pre>
                </div>
                <div class="cm-panel" data-panel="metadata">
                    <pre class="code-viewer-pre"><code class="language-json">${metadataContent}</code></pre>
                </div>
                <div class="cm-panel" data-panel="settings">
                    <div class="gt-card" style="margin-top: 20px;">
                        <h3>Settings</h3>
                        <p>No settings available for this view yet.</p>
                    </div>
                </div>
            </div>
        </div>
    `);

    const tabsContainer = pageContainer.querySelector('.code-mirror-tabs');
    const panelsContainer = pageContainer.querySelector('.code-mirror-content');

    tabsContainer?.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('cm-tab')) return;

        const tabName = target.dataset.tab;
        if (tabName === 'preview') {
            window.location.hash = '#/';
            return;
        }

        tabsContainer.querySelectorAll('.cm-tab').forEach(t => t.classList.remove('active'));
        target.classList.add('active');

        panelsContainer?.querySelectorAll('.cm-panel').forEach(p => {
            (p as HTMLElement).classList.remove('active');
            if ((p as HTMLElement).dataset.panel === tabName) {
                (p as HTMLElement).classList.add('active');
            }
        });
    });
}


// ------- API Key Manager (Client-Side Simulated Backend) -------
const ApiKeyManager = (() => {
    const KEY_STORAGE_KEY = 'gt_pilot_api_keys';
    const MASTER_KEY_KEY = 'gt_pilot_master_key';
    const ACTIVE_KEY_ID_KEY = 'gt_pilot_active_key_id';

    interface StoredKey { id: string; name: string; iv: string; encryptedKey: string; maskedKey: string; }
    interface ApiKey { id: string; name: string; maskedKey: string; }

    let masterKey: CryptoKey | null = null;

    async function getMasterKey(): Promise<CryptoKey> {
        if (masterKey) return masterKey;
        const storedKey = localStorage.getItem(MASTER_KEY_KEY);
        if (storedKey) {
            try {
                const jwk = JSON.parse(storedKey);
                masterKey = await crypto.subtle.importKey('jwk', jwk, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
                return masterKey;
            } catch (e) { console.error("Failed to import master key, generating a new one.", e); }
        }
        const newKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const jwk = await crypto.subtle.exportKey('jwk', newKey);
        localStorage.setItem(MASTER_KEY_KEY, JSON.stringify(jwk));
        masterKey = newKey;
        return newKey;
    }

    function str2ab(str: string): ArrayBuffer { return new TextEncoder().encode(str); }
    function ab2str(buf: ArrayBuffer): string { return new TextDecoder().decode(buf); }
    function ab2b64(buf: ArrayBuffer): string { let B = ''; for (let i=0;i<new Uint8Array(buf).byteLength;i++) B+=String.fromCharCode(new Uint8Array(buf)[i]); return btoa(B); }
    function b642ab(b64: string): ArrayBuffer { const B=atob(b64),L=B.length,buf=new Uint8Array(L);for(let i=0;i<L;i++)buf[i]=B.charCodeAt(i);return buf.buffer;}

    async function encrypt(key: string): Promise<{ iv: string, encryptedKey: string }> {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const mKey = await getMasterKey();
        const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, mKey, str2ab(key));
        return { iv: ab2b64(iv), encryptedKey: ab2b64(encrypted) };
    }

    async function decrypt(iv: string, encryptedKey: string): Promise<string> {
        const mKey = await getMasterKey();
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b642ab(iv) }, mKey, b642ab(encryptedKey));
        return ab2str(decrypted);
    }

    async function validateKey(key: string): Promise<{ success: boolean, message: string, timing: number }> {
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
        if (key === 'valid-key-for-test') {
            return { success: true, message: "Key validated successfully.", timing: Date.now() - startTime };
        }
        return { success: false, message: "Invalid key — provider rejected the request.", timing: Date.now() - startTime };
    }

    function getStoredKeys(): StoredKey[] { return JSON.parse(localStorage.getItem(KEY_STORAGE_KEY) || '[]'); }
    function saveStoredKeys(keys: StoredKey[]) { localStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(keys)); }

    return {
        async addKey(name: string, key: string): Promise<ApiKey> {
            if (!name || !key) throw new Error("Name and key cannot be empty.");
            const validation = await validateKey(key);
            if (!validation.success) throw new Error(validation.message);

            const keys = getStoredKeys();
            if (keys.some(k => k.name === name)) throw new Error("A key with this name already exists.");

            const { iv, encryptedKey } = await encrypt(key);
            const maskedKey = `${key.slice(0, 3)}...${key.slice(-4)}`;
            const newKey: StoredKey = { id: crypto.randomUUID(), name, iv, encryptedKey, maskedKey };
            keys.push(newKey);
            saveStoredKeys(keys);
            return { id: newKey.id, name: newKey.name, maskedKey: newKey.maskedKey };
        },
        async getKeys(): Promise<ApiKey[]> { return getStoredKeys().map(({ id, name, maskedKey }) => ({ id, name, maskedKey })); },
        async deleteKey(id: string): Promise<void> {
            saveStoredKeys(getStoredKeys().filter(k => k.id !== id));
            if (this.getActiveKeyId() === id) localStorage.removeItem(ACTIVE_KEY_ID_KEY);
        },
        async activateKey(id: string): Promise<void> {
            if (!getStoredKeys().some(k => k.id === id)) throw new Error("Key not found.");
            localStorage.setItem(ACTIVE_KEY_ID_KEY, id);
        },
        getActiveKeyId: (): string | null => localStorage.getItem(ACTIVE_KEY_ID_KEY),
        async pingKey(id: string): Promise<{ status: 'ok' | 'error', message: string, timing: number }> {
            const keyToPing = getStoredKeys().find(k => k.id === id);
            if (!keyToPing) return { status: 'error', message: "Key not found.", timing: 0 };
            try {
                const rawKey = await decrypt(keyToPing.iv, keyToPing.encryptedKey);
                const validation = await validateKey(rawKey);
                return validation.success 
                    ? { status: 'ok', message: `Ping successful (${validation.timing}ms).`, timing: validation.timing }
                    : { status: 'error', message: `Ping failed: ${validation.message}`, timing: validation.timing };
            } catch (e) {
                return { status: 'error', message: `Ping failed: decryption error.`, timing: 0 };
            }
        }
    };
})();

function renderApiKeysPage() {
    const render = async () => {
        const keys = await ApiKeyManager.getKeys();
        const activeKeyId = ApiKeyManager.getActiveKeyId();

        renderPage('API Key Manager', `
            <div class="gt-card">
                <h3>Add New Key</h3>
                 <p style="color: var(--ink-secondary); font-size: 0.9rem; margin-top: -10px; margin-bottom: 15px;">For testing, use the key: <code>valid-key-for-test</code></p>
                <div class="form-group"><label for="api-name">Name</label><input type="text" id="api-name" class="gt-input" placeholder="e.g., Google Finance API"></div>
                <div class="form-group"><label for="api-value">Key</label><input type="password" id="api-value" class="gt-input" placeholder="Enter your secret key"></div>
                <button class="gt-button" id="add-key-btn">Validate & Add Key</button>
            </div>
            <div class="gt-card">
                <h3>Managed Keys</h3>
                <ul id="keys-list" style="list-style: none; padding: 0;">
                    ${keys.length === 0 ? '<li>No keys saved.</li>' : ''}
                    ${keys.map(key => `
                        <li style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--edge);">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <span style="font-weight: 600;">
                                    ${key.name} ${key.id === activeKeyId ? '<span style="color: var(--green); font-size: 0.8em; font-weight: normal;">(Active)</span>' : ''}
                                </span>
                                <span style="font-family: monospace; color: var(--ink-secondary); font-size: 0.9em;">${key.maskedKey}</span>
                            </div>
                            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                                ${key.id !== activeKeyId ? `<button class="gt-button" data-action="activate" data-key-id="${key.id}">Activate</button>` : ''}
                                <button class="gt-button secondary" data-action="ping" data-key-id="${key.id}">Ping</button>
                                <button class="gt-button secondary" data-action="delete" data-key-id="${key.id}">Delete</button>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `);

        document.getElementById('add-key-btn')?.addEventListener('click', async (e) => {
            const btn = e.target as HTMLButtonElement, nameInput = document.getElementById('api-name') as HTMLInputElement, valueInput = document.getElementById('api-value') as HTMLInputElement;
            if (nameInput.value && valueInput.value) {
                btn.disabled = true; btn.textContent = 'Validating...';
                try {
                    await ApiKeyManager.addKey(nameInput.value, valueInput.value);
                    showToast('✓ Key added successfully!');
                    nameInput.value = ''; valueInput.value = ''; render();
                } catch (error) { showToast((error as Error).message); } 
                finally { btn.disabled = false; btn.textContent = 'Validate & Add Key'; }
            } else { showToast('Please provide both a name and a key.'); }
        });

        document.getElementById('keys-list')?.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement, action = target.dataset.action, keyId = target.dataset.keyId;
            if (!action || !keyId) return;
            switch(action) {
                case 'delete': if (confirm('Are you sure?')) { await ApiKeyManager.deleteKey(keyId); showToast('Key deleted.'); render(); } break;
                case 'activate': await ApiKeyManager.activateKey(keyId); showToast('Key activated.'); render(); break;
                case 'ping':
                    const originalText = target.textContent; target.textContent = 'Pinging...'; (target as HTMLButtonElement).disabled = true;
                    const result = await ApiKeyManager.pingKey(keyId); showToast(result.message);
                    target.textContent = originalText; (target as HTMLButtonElement).disabled = false; break;
            }
        });
    }
    render();
}

function setupTooltipTouchInteractions() {
    const iconButtons = document.querySelectorAll('.icon-btn');
    let touchTimer: number;
    iconButtons.forEach(btn => {
        const tooltip = btn.querySelector('.tooltip') as HTMLElement; if (!tooltip) return;
        const showTooltip = () => tooltip.classList.add('show-on-touch');
        const hideTooltip = () => { clearTimeout(touchTimer); tooltip.classList.remove('show-on-touch'); };
        btn.addEventListener('touchstart', () => { touchTimer = window.setTimeout(showTooltip, 400); }, { passive: true });
        btn.addEventListener('touchend', hideTooltip); btn.addEventListener('touchcancel', hideTooltip);
    });
}

function handleScrollIndicator() {
    const scrollContainer = document.querySelector('.scroll-panel-container'), indicator = document.getElementById('scroll-indicator');
    if (!scrollContainer || !indicator) return;
    const showHideIndicator = () => {
        const canScroll = scrollContainer.scrollHeight > scrollContainer.clientHeight, isAtBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 5;
        indicator.classList.toggle('visible', canScroll && !isAtBottom);
    };
    scrollContainer.addEventListener('scroll', showHideIndicator);
    new ResizeObserver(showHideIndicator).observe(scrollContainer);
    showHideIndicator();
}

// ------- App Initialization & Auth Flow -------
function renderUserDisplay(user: GTAuth.User) {
    if (!userDisplay) return;

    const goldBadgeSVG = user.isAdmin ? `
        <svg class="gt-gold-badge" viewBox="0 0 24 24" aria-label="Admin Badge">
            <defs>
                <radialGradient id="gold-grad" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
                    <stop offset="0%" style="stop-color:#FFD700; stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#B8860B; stop-opacity:1" />
                </radialGradient>
                <filter id="emboss">
                    <feDropShadow dx="0.5" dy="0.5" stdDeviation="0.5" flood-color="#fff" flood-opacity="0.5"/>
                    <feDropShadow dx="-0.5" dy="-0.5" stdDeviation="0.5" flood-color="#000" flood-opacity="0.5"/>
                </filter>
            </defs>
            <circle cx="12" cy="12" r="11" fill="url(#gold-grad)" filter="url(#emboss)" />
            <text x="50%" y="50%" dy=".35em" text-anchor="middle" class="badge-text">G</text>
        </svg>
    ` : '';
    
    userDisplay.innerHTML = `
        ${goldBadgeSVG}
        <span class="username">
            <span class="username-full">${user.name}</span>
            <span class="username-initial">${user.name.charAt(0)}</span>
        </span>
    `;
    userDisplay.style.display = 'flex';
}

function setupUserSession(user: GTAuth.User) {
    gtBrain.setUserContext(user);
    renderUserDisplay(user);
    showToast(`Welcome back, ${user.name}!`);
    
    const lastPrompt = gtBrain.getLastPrompt();
    if(lastPrompt) {
        const promptContainer = document.getElementById('memory-prompt-container');
        if (promptContainer) {
            const promptEl = document.createElement('div');
            promptEl.className = 'memory-prompt';
            promptEl.innerHTML = `<span>Restore last session prompt?</span><div class="buttons"><button class="gt-button" id="restore-prompt-btn">Restore</button><button class="gt-button secondary" id="dismiss-prompt-btn">Dismiss</button></div>`;
            promptContainer.appendChild(promptEl);
            
            const close = () => { promptEl.classList.add('fade-out'); setTimeout(() => promptEl.remove(), 300); };
            document.getElementById('restore-prompt-btn')?.addEventListener('click', () => { promptInput.value = lastPrompt; showToast('Prompt restored from memory.'); close(); });
            document.getElementById('dismiss-prompt-btn')?.addEventListener('click', close);
        }
    }
}

async function initializeApp() {
    const user = GTAuth.getCurrentUser();
    if (user) {
        setupUserSession(user);
    } else {
        GTAuth.showLoginModal((loggedInUser) => {
            setupUserSession(loggedInUser);
        });
    }
}

// ------- Initial Load -------
window.addEventListener('DOMContentLoaded', () => {
    collapseBtn?.addEventListener('click', () => app.classList.toggle('collapsed'));
    initHamburgerMenu({
        toastFn: showToast,
        appEl: app,
        fileManager: FileManager,
        newProjectFn: newProject,
        saveProjectFn: saveProject,
        showSaveAsModalFn: showSaveAsModal,
        showOpenProjectModalFn: showOpenProjectModal,
        getCurrentProject: () => currentProject,
    });
    
    showRestoreBanner();
    handleRouteChange();
    setupTooltipTouchInteractions();
    handleScrollIndicator();
    updateCurrentProject('Untitled Project', false);
    initializeApp();
    
    codeEditor?.addEventListener('input', () => {
        updatePreview();
        if (!currentProject.isDirty) {
            updateCurrentProject(currentProject.name, true);
        }
    });

    uploadBtn?.addEventListener('click', () => {
        fileUploadInput?.click();
    });

    fileUploadInput?.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];
        if (file) {
            gtBrain.addUploadedFile(file);
            showToast("File uploaded successfully — GT can now view it.");
            target.value = ''; // Reset for re-uploading the same file
        }
    });

    window.addEventListener('beforeunload', (e) => {
        gtBrain.backupMemoryLogs();
        gtBrain.backupSandboxState();
        if (currentProject.isDirty) {
            // Save snapshot for unsaved manual changes before leaving.
            if (codeEditor.value.trim()) {
                localStorage.setItem('gt_pilot_snapshot', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    content: codeEditor.value
                }));
            }
            e.preventDefault();
            e.returnValue = ''; // For legacy browsers
            return '';
        } else {
            // Clean up snapshot if work is saved or new/empty.
            localStorage.removeItem('gt_pilot_snapshot');
        }
    });
    
    window.addEventListener('keydown', (e) => {
        const ctrlKey = navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? e.metaKey : e.ctrlKey;
        if (ctrlKey) {
            if (e.key === 's' && e.shiftKey) { e.preventDefault(); showSaveAsModal(); } 
            else if (e.key === 's') { e.preventDefault(); saveProject(); } 
            else if (e.key === 'n') { e.preventDefault(); newProject(); }
        }
    });
});
window.addEventListener('hashchange', handleRouteChange);