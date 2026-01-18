// --- ESTADO GLOBAL ---
let inventory = JSON.parse(localStorage.getItem('myClosetInventory')) || [];
let currentSlotCategory = null; 
let tempTags = [];
let currentLookMode = 'separados'; 
let modalItemsCache = []; 
let currentViewerLookId = null; 
let isPickingLookB = false; // MODO DE SELEÇÃO
let draftLookCache = null; // Guarda o look que está sendo montado para comparar

// --- NAVEGAÇÃO ---
function switchScreen(screenId, btn) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    
    if(btn) {
        btn.classList.add('active');
    } else {
        if(screenId === 'screen-closet') document.querySelectorAll('.nav-item')[0].classList.add('active');
        if(screenId === 'screen-viewer') document.querySelectorAll('.nav-item')[1].classList.add('active');
        if(screenId === 'screen-create') document.querySelectorAll('.nav-item')[2].classList.add('active');
        if(screenId === 'screen-add')    document.querySelectorAll('.nav-item')[3].classList.add('active');
    }

    if(screenId === 'screen-closet') renderCloset();
    
    // Se sair da tela de visualização e não estiver escolhendo, reseta comparação
    if(screenId !== 'screen-viewer' && !isPickingLookB) {
        resetComparisonUI();
    }
}

function resetComparisonUI() {
    document.getElementById('comparison-container').classList.remove('comparing');
    document.getElementById('canvas-side-b').style.display = 'none';
    document.querySelector('.btn-compare-toggle').innerText = '🆚 Comparar';
    draftLookCache = null;
}

// --- CONTROLE DE MODO DO LOOK ---
function toggleLookMode() {
    const radios = document.getElementsByName('lookMode');
    radios.forEach(r => { if(r.checked) currentLookMode = r.value; });
    const groupSeparados = document.getElementById('mode-separados');
    const groupUnico = document.getElementById('mode-unico');

    if(currentLookMode === 'separados') {
        groupSeparados.style.display = 'block';
        groupUnico.style.display = 'none';
        clearSlot({stopPropagation:()=>{}}, 'inteiro'); 
    } else {
        groupSeparados.style.display = 'none';
        groupUnico.style.display = 'block';
        clearSlot({stopPropagation:()=>{}}, 'superior');
        clearSlot({stopPropagation:()=>{}}, 'inferior');
    }
}

// --- UPLOAD E IMAGEM ---
function handleImageUpload(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const maxSize = 500; 
            let width = img.width; let height = img.height;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            const preview = document.getElementById('preview-img');
            preview.src = canvas.toDataURL('image/png', 0.8);
            preview.style.display = 'block';
            document.getElementById('upload-placeholder').style.display = 'none';
        }
    }
    reader.readAsDataURL(file);
}

// --- SUBCATEGORIAS ---
function updateSubcategoryDatalist() {
    const mainCat = document.getElementById('new-category').value;
    const datalist = document.getElementById('subcat-options');
    datalist.innerHTML = '';
    const existingSubcats = [...new Set(inventory
        .filter(i => i.category === mainCat && i.subcategory)
        .map(i => i.subcategory))];
    existingSubcats.sort().forEach(sub => {
        const option = document.createElement('option');
        option.value = sub;
        datalist.appendChild(option);
    });
}

// --- SALVAR PEÇA ---
function saveNewItem() {
    const imgSrc = document.getElementById('preview-img').src;
    const category = document.getElementById('new-category').value;
    const subcategory = document.getElementById('new-subcategory').value.trim(); 

    if(!imgSrc || document.getElementById('preview-img').style.display === 'none') { alert("Adicione uma foto!"); return; }
    
    const newItem = { 
        id: Date.now(), image: imgSrc, category: category, 
        subcategory: subcategory, tags: tempTags 
    };
    inventory.push(newItem);
    localStorage.setItem('myClosetInventory', JSON.stringify(inventory));
    
    alert("Peça salva!");
    document.getElementById('preview-img').src = '';
    document.getElementById('preview-img').style.display = 'none';
    document.getElementById('upload-placeholder').style.display = 'flex';
    document.getElementById('new-subcategory').value = ''; 
    tempTags = []; renderTags();
    switchScreen('screen-closet');
}

// --- TAGS ---
document.getElementById('tag-input').addEventListener('keypress', function(e) { if (e.key === 'Enter') addTag(); });
function addTag() {
    const input = document.getElementById('tag-input');
    const val = input.value.trim().toLowerCase();
    if(val && !tempTags.includes(val)) { tempTags.push(val); renderTags(); }
    input.value = '';
}
function renderTags() { document.getElementById('tags-list').innerHTML = tempTags.map(tag => `<span class="tag">#${tag}</span>`).join(''); }


// --- ARMÁRIO ---
let activeFilterCat = 'all'; 

function renderCloset(filterCat = null) {
    if(filterCat) activeFilterCat = filterCat; else filterCat = activeFilterCat;

    const grid = document.getElementById('closet-grid');
    const subfilterArea = document.getElementById('subfilter-area');
    const subfilterLabel = document.getElementById('subfilter-label');
    const subfilterSelect = document.getElementById('subfilter-select');
    const searchTerm = document.getElementById('closet-search').value.toLowerCase(); 

    grid.innerHTML = '';

    // Botões ativos
    document.querySelectorAll('.filter-bar .filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.innerText.toLowerCase().includes(filterCat === 'all' ? 'tudo' : filterCat.substring(0,3))) btn.classList.add('active');
        if(filterCat === 'inteiro' && btn.innerText.includes('Vestido')) btn.classList.add('active');
        if(filterCat === 'looks' && btn.innerText.includes('Looks')) btn.classList.add('active');
    });

    if(isPickingLookB) filterCat = 'looks'; // Força looks se estiver escolhendo

    // --- LOOKS ---
    if(filterCat === 'looks') {
        subfilterArea.style.display = 'flex';
        subfilterLabel.innerText = "Filtrar Looks:";
        
        const savedLooks = JSON.parse(localStorage.getItem('myClosetLooks')) || [];
        const uniqueNames = [...new Set(savedLooks.map(l => l.name).filter(n => n))].sort();
        
        let html = `<option value="all">Ver Todos</option>`;
        uniqueNames.forEach(n => html += `<option value="${n}">${n}</option>`);
        if(subfilterSelect.innerHTML !== html) subfilterSelect.innerHTML = html;
        
        applySubFilter(searchTerm); 
        return;
    }

    // --- ROUPAS ---
    let items = inventory.filter(item => filterCat === 'all' || item.category === filterCat);
    
    if(filterCat !== 'all' && items.length > 0) {
        const subcats = [...new Set(items.map(i => i.subcategory).filter(s => s))].sort();
        if(subcats.length > 0) {
            subfilterArea.style.display = 'flex';
            subfilterLabel.innerText = "Subcategoria:";
            let html = `<option value="all">Todas</option>`;
            subcats.forEach(s => html += `<option value="${s}">${s}</option>`);
            subfilterSelect.innerHTML = html;
        } else { subfilterArea.style.display = 'none'; }
    } else { subfilterArea.style.display = 'none'; }
    
    if(subfilterArea.style.display === 'none') {
        if(searchTerm) {
            items = items.filter(i => 
                (i.tags && i.tags.some(t => t.includes(searchTerm))) || 
                (i.subcategory && i.subcategory.toLowerCase().includes(searchTerm))
            );
        }
        renderItemsGrid(items);
    } else {
        applySubFilter(searchTerm);
    }
}

function applySubFilter(searchTerm = '') {
    const grid = document.getElementById('closet-grid');
    const val = document.getElementById('subfilter-select').value;
    grid.innerHTML = '';

    if(activeFilterCat === 'looks' || isPickingLookB) {
        const savedLooks = JSON.parse(localStorage.getItem('myClosetLooks')) || [];
        let filtered = val === 'all' ? savedLooks : savedLooks.filter(l => l.name === val);
        
        if(searchTerm) filtered = filtered.filter(l => l.name.toLowerCase().includes(searchTerm));

        if(filtered.length === 0) { grid.innerHTML = '<p class="empty-msg">Nada aqui.</p>'; return; }
        
        filtered.slice().reverse().forEach(look => {
            const div = document.createElement('div');
            div.className = 'look-card';
            div.onclick = (e) => { 
                if(e.target.className !== 'delete-btn') {
                    if(isPickingLookB) finishCompareProcess(look.id); 
                    else openProvador(look.id); 
                }
            };
            
            let minis = '';
            if(look.items.acessorio) minis += `<img src="${look.items.acessorio}" class="look-mini-img">`;
            if(look.mode === 'separados') {
                if(look.items.superior) minis += `<img src="${look.items.superior}" class="look-mini-img">`;
                if(look.items.inferior) minis += `<img src="${look.items.inferior}" class="look-mini-img">`;
            } else {
                if(look.items.inteiro) minis += `<img src="${look.items.inteiro}" class="look-mini-img" style="height:100px; width:100%;">`;
            }
            if(look.items.calcado) minis += `<img src="${look.items.calcado}" class="look-mini-img">`;
            
            // SE ESTIVER ESCOLHENDO PARA COMPARAR, NÃO MOSTRA BOTÃO DE DELETAR (O "X")
            let deleteBtnHtml = isPickingLookB ? '' : `<button class="delete-btn" onclick="deleteLook(${look.id})">×</button>`;

            div.innerHTML = `<div class="look-card-header"><span>${look.name}</span>${deleteBtnHtml}</div><div class="look-composition">${minis}</div>`;
            grid.appendChild(div);
        });

    } else {
        let items = inventory.filter(item => activeFilterCat === 'all' || item.category === activeFilterCat);
        if(val !== 'all') items = items.filter(i => i.subcategory === val);
        
        if(searchTerm) {
            items = items.filter(i => 
                (i.tags && i.tags.some(t => t.includes(searchTerm))) || 
                (i.subcategory && i.subcategory.toLowerCase().includes(searchTerm))
            );
        }
        renderItemsGrid(items);
    }
}

function renderItemsGrid(items) {
    const grid = document.getElementById('closet-grid');
    grid.innerHTML = '';
    if(items.length === 0) { grid.innerHTML = '<p class="empty-msg">Nada aqui.</p>'; return; }
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'closet-item';
        div.innerHTML = `
            <img src="${item.image}">
            ${item.subcategory ? `<span class="subcat-badge">${item.subcategory}</span>` : ''}
            <button class="delete-btn" onclick="deleteItem(${item.id})">×</button>
        `;
        grid.appendChild(div);
    });
}

// --- FUNÇÕES DE DELETAR ---
function deleteItem(id) {
    if(confirm('Deletar peça?')) {
        inventory = inventory.filter(i => i.id !== id);
        localStorage.setItem('myClosetInventory', JSON.stringify(inventory));
        renderCloset(); 
    }
}
function deleteLook(id) {
    if(confirm('Apagar look?')) {
        let savedLooks = JSON.parse(localStorage.getItem('myClosetLooks')) || [];
        savedLooks = savedLooks.filter(l => l.id !== id);
        localStorage.setItem('myClosetLooks', JSON.stringify(savedLooks));
        renderCloset('looks');
    }
}
window.filterCloset = function(cat) { renderCloset(cat); }

// --- ATELIÊ ---
function openSelector(category) {
    currentSlotCategory = category;
    const modal = document.getElementById('selector-modal');
    const title = document.getElementById('modal-title');
    const input = document.getElementById('modal-search-input');
    modalItemsCache = inventory.filter(i => i.category === category);
    const catNames = {'superior': 'Parte de Cima', 'inferior': 'Parte de Baixo', 'inteiro': 'Vestido', 'calcado': 'Calçado', 'acessorio': 'Acessório'};
    title.innerText = catNames[category] || 'Escolher';
    input.value = '';
    renderModalItems(modalItemsCache);
    modal.style.display = 'flex';
}
function renderModalItems(items) {
    const grid = document.getElementById('modal-grid');
    grid.innerHTML = '';
    if(items.length === 0) { grid.innerHTML = '<p style="text-align:center;">Vazio.</p>'; return; }
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'modal-item';
        div.innerHTML = `<img src="${item.image}"><div class="modal-item-tags">${item.subcategory || ''}</div>`;
        div.onclick = () => selectItemForSlot(item);
        grid.appendChild(div);
    });
}
function filterModalItems() {
    const term = document.getElementById('modal-search-input').value.toLowerCase();
    const filtered = modalItemsCache.filter(item => 
        (item.tags && item.tags.some(tag => tag.includes(term))) ||
        (item.subcategory && item.subcategory.toLowerCase().includes(term))
    );
    renderModalItems(filtered);
}
function closeModal() { document.getElementById('selector-modal').style.display = 'none'; }
function selectItemForSlot(item) {
    const slot = document.querySelector(`.slot[data-category="${currentSlotCategory}"]`);
    const img = slot.querySelector('.slot-img');
    img.src = item.image; img.style.display = 'block';
    slot.classList.add('filled'); closeModal();
}
function clearSlot(e, category) {
    e.stopPropagation();
    const slot = document.querySelector(`.slot[data-category="${category}"]`);
    if(!slot) return;
    const img = slot.querySelector('.slot-img');
    img.src = ''; img.style.display = 'none';
    slot.classList.remove('filled');
}
function resetCanvas() {
    document.querySelectorAll('.slot').forEach(slot => {
        const cat = slot.getAttribute('data-category');
        clearSlot({stopPropagation:()=>{}}, cat);
    });
}
function saveLook() {
    const slotsData = {};
    slotsData.acessorio = getSlotImg('acessorio');
    slotsData.calcado = getSlotImg('calcado');
    if(currentLookMode === 'separados') {
        slotsData.superior = getSlotImg('superior');
        slotsData.inferior = getSlotImg('inferior');
        if(!slotsData.superior || !slotsData.inferior) { alert("Incompleto!"); return; }
    } else {
        slotsData.inteiro = getSlotImg('inteiro');
        if(!slotsData.inteiro) { alert("Incompleto!"); return; }
    }
    const lookName = prompt("Nome do Look:");
    if(lookName === null) return; 
    const newLook = { id: Date.now(), mode: currentLookMode, name: lookName.trim() || "Look", items: slotsData };
    let savedLooks = JSON.parse(localStorage.getItem('myClosetLooks')) || [];
    savedLooks.push(newLook);
    localStorage.setItem('myClosetLooks', JSON.stringify(savedLooks));
    alert("Salvo!");
    resetCanvas();
}
function getSlotImg(cat) {
    const slot = document.querySelector(`.slot[data-category="${cat}"]`);
    if(!slot) return null;
    const img = slot.querySelector('img');
    return (img.style.display !== 'none' && img.src) ? img.src : null;
}

// --- PROVADOR & LÓGICA DE COMPARAÇÃO ---

// Início do processo pelo Provador (Look Salvo A vs Look Salvo B)
function startCompareFromViewer() {
    if(document.getElementById('comparison-container').classList.contains('comparing')) {
        // Se já está comparando, botão serve para cancelar
        resetComparisonUI();
    } else {
        draftLookCache = null; // Não estamos usando rascunho
        initiateLookSelection();
    }
}

// Início do processo pelo Criar (Rascunho vs Look Salvo)
function startCompareFromCreate() {
    // 1. Capturar o look atual do canvas
    const slotsData = {};
    slotsData.acessorio = getSlotImg('acessorio');
    slotsData.calcado = getSlotImg('calcado');
    if(currentLookMode === 'separados') {
        slotsData.superior = getSlotImg('superior');
        slotsData.inferior = getSlotImg('inferior');
    } else {
        slotsData.inteiro = getSlotImg('inteiro');
    }

    // Validação mínima para comparar
    const hasMainItem = currentLookMode === 'separados' 
        ? (slotsData.superior || slotsData.inferior) 
        : slotsData.inteiro;

    if(!hasMainItem) { alert("Adicione roupas para comparar!"); return; }

    // 2. Salvar como Rascunho
    draftLookCache = {
        id: 'draft', name: 'Rascunho Atual', mode: currentLookMode, items: slotsData
    };

    initiateLookSelection();
}

function initiateLookSelection() {
    isPickingLookB = true;
    switchScreen('screen-closet');
    document.getElementById('compare-selection-banner').style.display = 'flex';
    renderCloset('looks');
}

function cancelCompareMode() {
    isPickingLookB = false;
    document.getElementById('compare-selection-banner').style.display = 'none';
    if(draftLookCache) {
        switchScreen('screen-create'); // Volta pro criar
    } else {
        switchScreen('screen-viewer'); // Volta pro provador
    }
}

function finishCompareProcess(lookId) {
    const savedLooks = JSON.parse(localStorage.getItem('myClosetLooks')) || [];
    const lookB = savedLooks.find(l => l.id === lookId);
    
    // Se não for rascunho, verifica se não é o mesmo look
    if(!draftLookCache && lookId === currentViewerLookId) {
        alert("Escolha um look diferente!"); return;
    }

    isPickingLookB = false;
    document.getElementById('compare-selection-banner').style.display = 'none';

    // Vai para o Provador
    switchScreen('screen-viewer');
    document.getElementById('viewer-empty-state').style.display = 'none';
    document.getElementById('viewer-content').style.display = 'block';

    // Lado A: Rascunho OU Look Salvo Original
    if(draftLookCache) {
        document.getElementById('viewer-title').innerText = "Rascunho vs " + lookB.name;
        document.getElementById('btn-delete-viewer').style.display = 'none'; // Esconde botão de deletar rascunho
        renderLookToCanvas('canvas-side-a', draftLookCache);
    } else {
        // Se veio do provador, currentViewerLookId já está definido
        openProvador(currentViewerLookId); 
        document.getElementById('btn-delete-viewer').style.display = 'block';
    }

    // Lado B: Look Selecionado
    const container = document.getElementById('comparison-container');
    const sideB = document.getElementById('canvas-side-b');
    const btn = document.querySelector('.btn-compare-toggle');

    container.classList.add('comparing');
    sideB.style.display = 'flex';
    document.getElementById('look-b-render').style.display = 'block';
    btn.innerText = "❌ Fechar Comparação";

    renderLookToCanvas('look-b-render', lookB);
}

// Abertura padrão do provador
function openProvador(lookId) {
    const savedLooks = JSON.parse(localStorage.getItem('myClosetLooks')) || [];
    const look = savedLooks.find(l => l.id === lookId);
    if(!look) return;

    currentViewerLookId = look.id;
    draftLookCache = null; // Limpa rascunho
    switchScreen('screen-viewer');

    document.getElementById('viewer-empty-state').style.display = 'none';
    document.getElementById('viewer-content').style.display = 'block';
    document.getElementById('viewer-title').innerText = look.name;
    document.getElementById('btn-delete-viewer').style.display = 'block';

    resetComparisonUI(); // Reseta interface
    renderLookToCanvas('canvas-side-a', look);
}

// LÓGICA VISUAL LIMPA (Sem ícones quebrados)
function renderLookToCanvas(containerId, look) {
    const container = document.getElementById(containerId);
    
    // Só cria a DIV se tiver imagem
    let accHTML = look.items.acessorio ? `<div class="slot slot-side"><img src="${look.items.acessorio}" class="slot-img" style="display:block"></div>` : '';
    let feetHTML = look.items.calcado ? `<div class="slot slot-feet"><img src="${look.items.calcado}" class="slot-img" style="display:block"></div>` : '';
    
    let torsoHTML = '';
    if(look.mode === 'separados') {
        let upperImg = look.items.superior ? `<img src="${look.items.superior}" class="slot-img" style="display:block">` : '';
        let lowerImg = look.items.inferior ? `<img src="${look.items.inferior}" class="slot-img" style="display:block">` : '';
        
        torsoHTML = `
            <div class="mode-group">
                <div class="slot slot-upper">${upperImg}</div>
                <div class="slot slot-lower">${lowerImg}</div>
            </div>`;
    } else {
        let fullImg = look.items.inteiro ? `<img src="${look.items.inteiro}" class="slot-img" style="display:block">` : '';
        torsoHTML = `
            <div class="mode-group">
                <div class="slot slot-fullbody">${fullImg}</div>
            </div>`;
    }

    container.innerHTML = `
        <div class="upper-row">
            ${accHTML}
            <div class="torso-column">${torsoHTML}</div>
        </div>
        ${feetHTML}
    `;
}

function deleteCurrentLookFromViewer() {
    if(confirm('Apagar este look?')) {
        let savedLooks = JSON.parse(localStorage.getItem('myClosetLooks')) || [];
        savedLooks = savedLooks.filter(l => l.id !== currentViewerLookId);
        localStorage.setItem('myClosetLooks', JSON.stringify(savedLooks));
        document.getElementById('viewer-empty-state').style.display = 'block';
        document.getElementById('viewer-content').style.display = 'none';
        alert("Apagado.");
        switchScreen('screen-closet');
    }
}

// Inicializa
renderCloset();
toggleLookMode();