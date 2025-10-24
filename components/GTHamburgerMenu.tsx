import { gtBrain } from './GTBrain.tsx';
import { showRevisionCenter } from './GTRevisionCenter.tsx';
import * as GTAuth from './GTAuth.tsx';

const hubId = 'hamburger-hub';
const collapseBtnId = 'collapseBtn';
const body = document.body;
let app: HTMLDivElement | null = null;
let hub: HTMLDivElement | null = null;

const VIEW_STATE_KEY = 'GT_ACTIVE_VIEW';
const MEMORY_STATE_KEY = 'GT_MEMORY';

interface InitParams {
    toastFn: (msg: string) => void;
    appEl: HTMLDivElement;
    fileManager: any; // Simplified type for the FileManager object
    newProjectFn: () => void;
    saveProjectFn: () => void;
    showSaveAsModalFn: () => void;
    showOpenProjectModalFn: () => void;
    getCurrentProject: () => any;
}

let currentParams: InitParams;

const views = [
    { id: 'gt-pilot', name: 'GT-Pilot (mainframe)' },
    { id: 'gt-designer', name: 'GT-Pilot Designer' },
    { id: 'gt-updates', name: 'GT Update Dept' },
    { id: 'gt-revision-center', name: 'Revision Center' },
    { id: 'gt-code-mirror', name: '</> Code Mirror' },
    { id: 'gt-account', name: 'Account' },
    { id: 'gt-terminal', name: 'Terminal' },
    { id: 'theme-glass', name: 'GT Glass Theme' },
    { id: 'theme-blue', name: 'GT Blue Theme' },
];

function formatRecentTimestamp(isoString: string): string {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd} | ${hh}:${min}`;
    } catch (e) {
        return 'Invalid Date';
    }
}

function applyTheme(themeId: string) {
    body.classList.remove('theme-glass', 'theme-blue');
    if (themeId === 'theme-glass') {
        body.classList.add('theme-glass');
    } else if (themeId === 'theme-blue') {
        body.classList.add('theme-blue');
    }
}

function handleViewSelection(viewId: string, toastFn: (msg: string) => void) {
    const currentView = localStorage.getItem(VIEW_STATE_KEY) || 'gt-pilot';

    toggleHub(false);

    if (!viewId.startsWith('theme-')) {
        localStorage.setItem(VIEW_STATE_KEY, viewId);
        hub?.querySelectorAll('.hub-item').forEach(item => {
            if (!(item as HTMLElement).dataset.viewId?.startsWith('theme-')) {
                item.classList.remove('active');
            }
        });
        hub?.querySelector(`[data-view-id="${viewId}"]`)?.classList.add('active');
    }

    if (viewId === 'gt-pilot') {
        if (!app?.classList.contains('collapsed')) {
            app?.classList.add('collapsed');
        }
        applyTheme('default');
        window.location.hash = '#/';
    } else if (viewId === 'gt-designer' || viewId === 'gt-updates') {
        if (app?.classList.contains('collapsed')) {
            app.classList.remove('collapsed');
        }
        const targetId = viewId === 'gt-designer' ? 'editor-scroll-section' : 'updates-scroll-section';
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
        
        if(currentView !== viewId) {
             const viewName = viewId === 'gt-designer' ? 'Designer' : 'Update Dept.';
             toastFn(`Switched to ${viewName}`);
        }
    } else if (viewId === 'gt-revision-center') {
        const project = currentParams.getCurrentProject();
        const uploadedFiles = gtBrain.getUploadedFiles();
        showRevisionCenter(project, uploadedFiles);
    } else if (viewId === 'gt-code-mirror') {
        window.location.hash = '#/code-mirror';
    } else if (viewId === 'gt-terminal') {
        window.location.hash = '#/terminal';
    } else if (viewId === 'gt-account') {
        if (GTAuth.isLoggedIn()) {
            if (confirm('Are you sure you want to log out?')) {
                GTAuth.logout();
                toastFn('You have been logged out.');
                window.location.reload();
            }
        } else {
            // Reloading is the simplest way to trigger the login modal via startup logic
            window.location.reload();
        }
    } else if (viewId.startsWith('theme-')) {
        const themeName = hub?.querySelector(`[data-view-id="${viewId}"]`)?.textContent || 'Selected Theme';
        app?.classList.add('is-changing');
        setTimeout(() => {
            applyTheme(viewId);
            toastFn(`Theme changed: ${themeName.replace('GT ', '').replace(' Theme', '')}`);
            setTimeout(() => app?.classList.remove('is-changing'), 50);
        }, 400);

        localStorage.setItem(VIEW_STATE_KEY, currentView);
        hub?.querySelectorAll('.hub-item').forEach(item => item.classList.remove('active'));
        hub?.querySelector(`[data-view-id="${currentView}"]`)?.classList.add('active');
    }
}

function toggleMemory(e: Event, toastFn: (msg: string) => void) {
    const isEnabled = (e.target as HTMLInputElement).checked;
    localStorage.setItem(MEMORY_STATE_KEY, isEnabled ? 'on' : 'off');
    gtBrain.setMemory(isEnabled);
    
    const label = hub?.querySelector('.memory-toggle-label');
    if (label) {
        label.textContent = `Awareness ${isEnabled ? 'ON' : 'OFF'}`;
    }
    toastFn(`Awareness ${isEnabled ? 'ON' : 'OFF'}`);
}

async function renderHub(params: InitParams) {
    const { toastFn, fileManager, newProjectFn, saveProjectFn, showSaveAsModalFn, showOpenProjectModalFn } = params;
    if (!hub) return;
    const initialView = localStorage.getItem(VIEW_STATE_KEY) || 'gt-pilot';
    const initialMemory = localStorage.getItem(MEMORY_STATE_KEY) !== 'off';
    const isLoggedIn = GTAuth.isLoggedIn();

    const recentFiles = await fileManager.list();
    const recentFilesHTML = recentFiles.length > 0
        ? recentFiles.slice(0, 5).map(file => `
            <div class="hub-dropdown-item recent-project-item" data-action="open-recent" data-name="${file.name}">
                <div class="recent-project-details">
                    <span class="recent-project-name">${file.name}</span>
                    <span class="recent-project-timestamp">🕓 ${formatRecentTimestamp(file.timestamp)}</span>
                </div>
                <button class="recent-project-delete-btn" data-action="delete-recent" data-name="${file.name}">🗑️</button>
            </div>`).join('')
        : '<div class="hub-dropdown-item" style="color: var(--ink-secondary); cursor: default;">No recent projects yet 🫗</div>';

    const fileMenuHTML = `
        <li class="hub-item hub-dropdown-container" data-view-id="gt-file-menu">
            <span>🗂️ File</span>
            <div class="hub-dropdown-menu">
                <div class="hub-dropdown-item" data-action="file-new">
                    <span>New Project</span>
                    <span class="hub-dropdown-shortcut">Ctrl+N</span>
                </div>
                <div class="hub-dropdown-separator"></div>
                <div class="hub-dropdown-item" data-action="file-save">
                    <span>Save</span>
                    <span class="hub-dropdown-shortcut">Ctrl+S</span>
                </div>
                <div class="hub-dropdown-item" data-action="file-save-as">
                    <span>Save As...</span>
                    <span class="hub-dropdown-shortcut">Ctrl+Shift+S</span>
                </div>
                <div class="hub-dropdown-separator"></div>
                <div class="hub-dropdown-item" data-action="file-open-project">
                    <span>Open Project...</span>
                </div>
                <div class="hub-dropdown-item hub-dropdown-submenu-container">
                    <span>Open Recent</span>
                    <span class="submenu-arrow">▶</span>
                    <div class="hub-dropdown-menu hub-dropdown-submenu">${recentFilesHTML}</div>
                </div>
                 <div class="hub-dropdown-separator"></div>
                <div class="hub-dropdown-item" data-action="file-close-project">
                    <span>Close Project</span>
                </div>
            </div>
        </li>
    `;

    const viewItems = views.map(view => {
        if (view.id === 'gt-account') {
            view.name = isLoggedIn ? '➡️ Logout' : '👤 Account';
        }
        return `<li class="hub-item ${view.id === initialView ? 'active' : ''}" data-view-id="${view.id}">${view.name}</li>`;
    }).join('');

    hub.innerHTML = `
        <ul class="hub-list">
            ${fileMenuHTML}
            <div class="hub-separator"></div>
            ${viewItems}
            <div class="hub-separator"></div>
            <li class="hub-item" data-view-id="gt-memory-toggle">
                <div class="memory-toggle-container">
                    <span class="memory-toggle-label">Awareness ${initialMemory ? 'ON' : 'OFF'}</span>
                    <label class="memory-toggle-switch">
                        <input type="checkbox" id="memory-toggle-checkbox" ${initialMemory ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
            </li>
        </ul>
    `;
    
    applyTheme(initialView);
    gtBrain.setMemory(initialMemory);

    const newHub = hub.cloneNode(true) as HTMLDivElement;
    hub.parentNode!.replaceChild(newHub, hub);
    hub = newHub;

    hub.querySelectorAll('.hub-item[data-view-id]').forEach(item => {
        const viewId = (item as HTMLElement).dataset.viewId;
        if (viewId && viewId !== 'gt-memory-toggle' && viewId !== 'gt-file-menu') {
            item.addEventListener('click', () => handleViewSelection(viewId, toastFn));
        }
    });
    
    hub.querySelector('.hub-dropdown-menu')?.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest('[data-action]') as HTMLElement;
        if (!item) return;

        e.stopPropagation();

        const action = item.dataset.action;
        const projectName = item.dataset.name;
        let shouldCloseHub = true;

        switch(action) {
            case 'file-new': newProjectFn(); break;
            case 'file-save': saveProjectFn(); break;
            case 'file-save-as': showSaveAsModalFn(); break;
            case 'file-open-project': showOpenProjectModalFn(); break;
            case 'file-close-project': newProjectFn(); break; // Same as new for now
            case 'open-recent':
                if (projectName) {
                    try {
                        const project = await fileManager.open(projectName);
                        const editor = document.getElementById('code-editor') as HTMLTextAreaElement;
                        const preview = document.getElementById('preview-frame') as HTMLIFrameElement;
                        const titleEl = document.querySelector('.header-title');
                        
                        editor.value = project.content || '';
                        if (preview) preview.srcdoc = editor.value;
                        if (titleEl) titleEl.textContent = `GT Pilot Hub - ${project.name}`;
                        
                        toastFn(`Opened '${project.name}'`);
                    } catch (err) {
                        toastFn((err as Error).message);
                    }
                }
                break;
             case 'delete-recent':
                shouldCloseHub = false; // Keep menu open
                if (projectName && confirm(`Are you sure you want to delete "${projectName}"? This cannot be undone.`)) {
                    const result = await fileManager.delete(projectName);
                    toastFn(result.message);
                    
                    if (result.ok) {
                        const currentProjectName = document.querySelector('.header-title')?.textContent?.replace('GT Pilot Hub - ', '').replace('*', '').trim();
                        if (currentProjectName === projectName) {
                            newProjectFn();
                        }
                        await renderHub(params); // Re-render the menu to update the list
                    }
                }
                break;
            default: shouldCloseHub = false;
        }
        
        if (shouldCloseHub) toggleHub(false);
    });

    document.getElementById('memory-toggle-checkbox')?.addEventListener('change', (e) => toggleMemory(e, toastFn));
}

function toggleHub(forceState?: boolean) {
    if (!hub) return;
    const isVisible = hub.classList.contains('visible');
    hub.classList.toggle('visible', forceState !== undefined ? forceState : !isVisible);
}

function handleClickOutside(event: MouseEvent) {
    const collapseBtn = document.getElementById(collapseBtnId);
    if (hub?.classList.contains('visible') && !hub.contains(event.target as Node) && !collapseBtn?.contains(event.target as Node)) {
        toggleHub(false);
    }
}

export function initHamburgerMenu(params: InitParams) {
    const collapseBtn = document.getElementById(collapseBtnId);
    hub = document.getElementById(hubId) as HTMLDivElement;
    app = params.appEl;
    currentParams = params;

    if (!collapseBtn || !hub) return;

    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHub();
    });

    document.addEventListener('click', handleClickOutside);
    
    renderHub(params);
}