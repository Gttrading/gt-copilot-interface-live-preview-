const CONTAINER_ID = 'revision-center-container';
let container: HTMLElement | null = null;
let currentProjectCache: any = null;
let currentRevisionsCache: any[] = [];
let uploadedFilesCache: any[] = [];

function hideRevisionCenter() {
    if (!container) return;
    const overlay = container.querySelector('.revision-center-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
        setTimeout(() => {
            if (container) container.innerHTML = '';
        }, 350);
    } else {
         container.innerHTML = '';
    }
}

function showPreviewModal(content: string) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;
    
    modalContainer.innerHTML = `
        <div class="modal-overlay visible" id="preview-modal-overlay" style="backdrop-filter: blur(12px);">
            <div class="modal-content" style="max-width: 80vw; height: 80vh; display: flex; flex-direction: column; background: rgba(30,30,30,0.7);">
                <div class="modal-header">
                    <h2 class="modal-title">Snapshot Preview</h2>
                    <button class="modal-close-btn" id="modal-close">&times;</button>
                </div>
                <div class="modal-body" style="flex: 1; overflow: hidden; padding: 0;">
                    <pre id="preview-code" style="height: 100%; overflow: auto; background: #1e1e1e; padding: 12px; border-radius: 8px; font-size: 13px; margin: 0; white-space: pre-wrap; word-break: break-all;"></pre>
                </div>
            </div>
        </div>
    `;

    const codeEl = document.getElementById('preview-code') as HTMLPreElement;
    codeEl.textContent = content;

    const close = () => modalContainer.innerHTML = '';
    document.getElementById('modal-close')?.addEventListener('click', close);
    document.getElementById('preview-modal-overlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) close();
    });
}

function renderRevisionList() {
    const listEl = container?.querySelector('#revision-list');
    const actionsEl = container?.querySelector('#revision-actions');
    const selectedId = container?.querySelector('.revision-list-item.active')?.getAttribute('data-id');

    if (!listEl) return;

    if (currentRevisionsCache.length === 0) {
        listEl.innerHTML = `<li class="revision-list-item empty">No matching revisions found.</li>`;
    } else {
        listEl.innerHTML = currentRevisionsCache.map(rev => `
            <li class="revision-list-item ${rev.id === selectedId ? 'active' : ''}" data-id="${rev.id}">
                <div class="revision-item-details">
                    <span class="revision-item-desc">${rev.description.toLowerCase().startsWith('ai:') ? '🤖' : '✍️'} ${rev.description}</span>
                    <span class="revision-item-ts">${new Date(rev.timestamp).toLocaleString()}</span>
                </div>
                <button class="revision-item-delete-btn" data-id="${rev.id}">🗑️</button>
            </li>
        `).join('');
    }

    actionsEl?.classList.toggle('visible', !!selectedId);
}

function handleFilterAndSearch() {
    const searchInput = container?.querySelector('#revision-search') as HTMLInputElement;
    const filterValue = container?.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
    const searchTerm = searchInput.value.toLowerCase();

    currentRevisionsCache = currentProjectCache.data.revisions
        .filter((rev: any) => {
            const desc = rev.description.toLowerCase();
            const typeMatch = filterValue === 'all' ||
                (filterValue === 'ai' && desc.startsWith('ai:')) ||
                (filterValue === 'manual' && !desc.startsWith('ai:'));
            const searchMatch = desc.includes(searchTerm) || rev.timestamp.includes(searchTerm);
            return typeMatch && searchMatch;
        })
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    renderRevisionList();
}

export function showRevisionCenter(project: any, uploadedFiles: any[]) {
    container = document.getElementById(CONTAINER_ID);
    if (!container) {
        console.error('Revision Center container not found!');
        return;
    }

    currentProjectCache = project;
    uploadedFilesCache = uploadedFiles;

    const hasRevisions = project.data.revisions && project.data.revisions.length > 0;
    const hasUploads = uploadedFilesCache && uploadedFilesCache.length > 0;

    const emptyStateHTML = `
        <div class="revision-content-box">
            <p class="revision-empty-title">No Revisions Yet</p>
            <p class="revision-empty-subtitle">Generate code with AI or save your project to create your first snapshot.</p>
        </div>
    `;
    
    const uploadsHTML = `
        <div class="revision-vault-header" style="margin-top: 24px; margin-bottom: 12px;">
             <h2 class="revision-vault-title" style="color: var(--ink-secondary);">File Uploads (Session)</h2>
        </div>
        <div class="revision-list-container" style="height: auto; max-height: 20vh; min-height: 80px; margin-bottom: 24px;">
            <ul id="uploads-list">
                ${hasUploads ? uploadedFilesCache.map(file => `
                    <li class="revision-list-item" style="cursor: default;">
                        <div class="revision-item-details">
                            <span class="revision-item-desc" style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.2rem;">📄</span>
                                ${file.name}
                            </span>
                            <span class="revision-item-ts">${new Date(file.timestamp).toLocaleString()}</span>
                        </div>
                    </li>
                `).join('') : '<li class="revision-list-item empty">No files uploaded in this session.</li>'}
            </ul>
        </div>
    `;

    const viewerHTML = `
        <div class="revision-vault-header">
             <h2 class="revision-vault-title">Memory Vault Viewer</h2>
             <div class="revision-filters">
                <input type="search" id="revision-search" class="gt-input" placeholder="Search revisions...">
                <div class="filter-btn-group">
                    <button class="gt-button secondary filter-btn active" data-filter="all">All</button>
                    <button class="gt-button secondary filter-btn" data-filter="ai">AI Only</button>
                    <button class="gt-button secondary filter-btn" data-filter="manual">Manual Only</button>
                </div>
             </div>
        </div>
        <div class="revision-list-container">
            <ul id="revision-list"></ul>
        </div>
        <div id="revision-actions" class="revision-actions">
            <button class="gt-button secondary" id="revision-preview-btn">1️⃣ Preview</button>
            <button class="gt-button" id="revision-restore-btn">2️⃣ Restore</button>
        </div>
    `;

    container.innerHTML = `
        <div class="revision-center-overlay">
            <div class="revision-center-panel vault-panel">
                <p class="revision-breadcrumb">GT Pilot > ${project.name}</p>
                <h1 class="revision-title">Revision Center</h1>
                <div class="revision-title-underline"></div>
                
                ${uploadsHTML}
                ${hasRevisions ? viewerHTML : emptyStateHTML}

                <button class="revision-back-btn" id="revision-back-btn">← Back to Editor</button>
            </div>
        </div>
    `;

    if (hasRevisions) {
        handleFilterAndSearch(); // Initial render of the list

        const searchInput = document.getElementById('revision-search');
        const filterButtons = document.querySelectorAll('.filter-btn');
        const revisionList = document.getElementById('revision-list');
        const previewBtn = document.getElementById('revision-preview-btn');
        const restoreBtn = document.getElementById('revision-restore-btn');

        searchInput?.addEventListener('input', handleFilterAndSearch);
        
        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                handleFilterAndSearch();
            });
        });

        revisionList?.addEventListener('click', async (e) => {
            const target = e.target as HTMLElement;
            const listItem = target.closest('.revision-list-item');
            const deleteBtn = target.closest('.revision-item-delete-btn');

            if (deleteBtn) {
                e.stopPropagation();
                const idToDelete = deleteBtn.getAttribute('data-id');
                if (idToDelete && confirm('Are you sure you want to delete this snapshot permanently?')) {
                    const success = await (window as any).deleteRevision(idToDelete);
                    if (success) {
                        currentProjectCache.data.revisions = currentProjectCache.data.revisions.filter((r:any) => r.id !== idToDelete);
                        handleFilterAndSearch();
                    }
                }
                return;
            }

            if (listItem && !listItem.classList.contains('empty')) {
                revisionList.querySelectorAll('.revision-list-item').forEach(li => li.classList.remove('active'));
                listItem.classList.add('active');
                renderRevisionList();
            }
        });
        
        previewBtn?.addEventListener('click', () => {
            const selectedId = revisionList?.querySelector('.active')?.getAttribute('data-id');
            const revision = currentProjectCache.data.revisions.find((r:any) => r.id === selectedId);
            if(revision) {
                showPreviewModal(revision.content);
            }
        });

        restoreBtn?.addEventListener('click', async () => {
            const selectedId = revisionList?.querySelector('.active')?.getAttribute('data-id');
            if (selectedId) {
                const success = await (window as any).restoreRevision(selectedId);
                if (success) {
                    hideRevisionCenter();
                }
            }
        });
    }

    document.getElementById('revision-back-btn')?.addEventListener('click', hideRevisionCenter);
    
    setTimeout(() => {
        container!.querySelector('.revision-center-overlay')?.classList.add('visible');
    }, 10);
}