const DB_NAME = 'barsound_db';
const DB_VERSION = 1;
const STORE = 'items';

function openDB() {
    return new Promise((res, rej) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => res(req.result);
        req.onerror  = () => rej(req.error);
    });
}

async function getItem(id) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx    = db.transaction(STORE, 'readonly');
        const store = tx.objectStore(STORE);
        const r     = store.get(Number(id));
        r.onsuccess = () => res(r.result || null);
        r.onerror   = () => rej(r.error);
    });
}

async function putItem(item) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx    = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const r     = store.put(item);
        r.onsuccess = () => res(r.result);
        r.onerror   = () => rej(r.error);
    });
}

async function deleteItem(id) {
    const db = await openDB();
    return new Promise((res, rej) => {
        const tx    = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const r     = store.delete(Number(id));
        r.onsuccess = () => res();
        r.onerror   = () => rej(r.error);
    });
}

const audioPlayers  = {};
let currentAudioTarget = null;
let currentColorTarget = null;
const objectUrlMap = { images: {}, audio: {} };

function saveField(id, field, value) {
    return (async () => {
        const existing = (await getItem(id)) || { id: Number(id) };
        existing[field] = value;
        await putItem(existing);
    })();
}

function saveBlobAndField(id, field, blob) {
    return (async () => {
        const existing = (await getItem(id)) || { id: Number(id) };
        existing[field] = blob;
        await putItem(existing);
    })();
}

function setPreviewImageFromBlob(itemElem, blob) {
    const img = itemElem.querySelector('.preview');
    if (!blob) {
        img.src = '';
        img.style.display = 'none';
        return;
    }
    const id = itemElem.dataset.id;
    if (objectUrlMap.images[id]) URL.revokeObjectURL(objectUrlMap.images[id]);
    const url = URL.createObjectURL(blob);
    objectUrlMap.images[id] = url;
    img.src = url;
    img.style.display = 'block';
    itemElem.querySelector('.placeholder').style.display = 'none';
}

function setAudioFromBlob(itemElem, blob) {
    const id  = itemElem.dataset.id;
    const btn = itemElem.querySelector('.sound-btn');
    if (!blob) {
        if (audioPlayers[id]) {
            try { audioPlayers[id].pause(); } catch {}
            audioPlayers[id] = undefined;
        }
        btn.classList.remove('has-audio');
        return;
    }
    if (objectUrlMap.audio[id]) URL.revokeObjectURL(objectUrlMap.audio[id]);
    const url   = URL.createObjectURL(blob);
    objectUrlMap.audio[id] = url;
    const audio = new Audio(url);
    audio.onended = () => { btn.textContent = 'Play'; };
    audioPlayers[id] = audio;
    btn.classList.add('has-audio');
}

function handleSoundBtn(btn, item) {
    const id     = item.dataset.id;
    const player = audioPlayers[id];
    if (!player) { triggerAudioInput(item); return; }
    if (player.paused) {
        player.currentTime = 0;
        player.play();
        btn.textContent = 'Stop';
    } else {
        player.pause();
        player.currentTime = 0;
        btn.textContent = 'Play';
    }
}

function triggerImageInput(item) {
    const input = document.getElementById('globalImageInput');
    input.dataset.targetId = item.dataset.id;
    input.value = '';
    input.click();
}

document.getElementById('globalImageInput').addEventListener('change', async function (e) {
    const file     = e.target.files[0];
    const targetId = e.target.dataset.targetId;
    if (!file || targetId === undefined) return;
    const targetItem = document.querySelector(`.image-upload-item[data-id="${targetId}"]`);
    if (!targetItem) return;

    const img         = targetItem.querySelector('.preview');
    const placeholder = targetItem.querySelector('.placeholder');
    const reader      = new FileReader();
    reader.onload = (evt) => {
        img.src                  = evt.target.result;
        img.style.display        = 'block';
        placeholder.style.display = 'none';
    };
    reader.readAsDataURL(file);

    try {
        await saveBlobAndField(targetId, 'image', file);
        const rec = await getItem(targetId);
        if (rec && rec.image) setPreviewImageFromBlob(targetItem, rec.image);
    } catch (err) {
        console.error('Failed to save image to IndexedDB', err);
    }
});

function triggerAudioInput(item) {
    currentAudioTarget = item;
    const input = document.getElementById('globalAudioInput');
    input.value = '';
    input.click();
}

document.getElementById('globalAudioInput').addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file || !currentAudioTarget) return;
    const id  = currentAudioTarget.dataset.id;
    const btn = currentAudioTarget.querySelector('.sound-btn');

    if (objectUrlMap.audio[id]) {
        try { URL.revokeObjectURL(objectUrlMap.audio[id]); } catch {}
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlMap.audio[id] = objectUrl;
    const audio = new Audio(objectUrl);
    audio.onended = () => { btn.textContent = 'Play'; };
    audioPlayers[id] = audio;
    btn.classList.add('has-audio');

    try {
        await saveBlobAndField(id, 'audio', file);
        const rec = await getItem(id);
        if (rec && rec.audio) setAudioFromBlob(currentAudioTarget, rec.audio);
    } catch (err) {
        console.error('Failed to save audio to IndexedDB', err);
    } finally {
        currentAudioTarget = null;
    }
});

const grid = document.getElementById('soundboardGrid');

for (let i = 0; i < 6; i++) {
    const item = document.createElement('div');
    item.className = 'image-upload-item';
    item.dataset.id = i;
    item.innerHTML = `
        <p class="label" contenteditable="true" spellcheck="false">Sound ${i + 1}</p>
        <div class="frame">
            <div class="placeholder">Upload image</div>
            <img class="preview" alt="Preview" style="display:none"/>
        </div>
        <button class="sound-btn">Play</button>
    `;

    const frame = item.querySelector('.frame');
    const btn = item.querySelector('.sound-btn');
    const label = item.querySelector('.label');

    frame.addEventListener('click', () => triggerImageInput(item));

    let pressTimer = null;
    let isLongPress = false;

    btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        isLongPress = false;
        pressTimer = setTimeout(() => {
            isLongPress = true;
        }, 400); 
    });

    btn.addEventListener('pointerup', (e) => {
        e.preventDefault();
        clearTimeout(pressTimer);

        if (isLongPress) {
            triggerAudioInput(item); // Change Audio
        } else {
            handleSoundBtn(btn, item); // Play/Stop
        }
    });

    let bgTimer = null;
    item.addEventListener('pointerdown', (e) => {
        if (e.target !== btn && e.target !== label) {
            bgTimer = setTimeout(() => openColorPicker(item), 600);
        }
    });
    item.addEventListener('pointerup', () => clearTimeout(bgTimer));
    item.addEventListener('pointerleave', () => clearTimeout(bgTimer));

    item.addEventListener('contextmenu', e => e.preventDefault());
    btn.addEventListener('contextmenu', e => e.preventDefault());

    label.addEventListener('input', () => {
        saveField(item.dataset.id, 'title', label.textContent.trim());
    });

    grid.appendChild(item);
}

const swatchColors = [
    '#000000','#aaaaaa','#aaa000','#3a1a1a',
    '#2d1b4e','#4a3000','#e74c3c','#e67e22',
    '#2ecc71','#1abc9c','#3498db','#ffffff'
];

const overlay  = document.getElementById('colorPickerOverlay');
const preview  = document.getElementById('colorPreview');
const rSlider  = document.getElementById('rSlider');
const gSlider  = document.getElementById('gSlider');
const bSlider  = document.getElementById('bSlider');
const rVal     = document.getElementById('rVal');
const gVal     = document.getElementById('gVal');
const bVal     = document.getElementById('bVal');
const hexInput = document.getElementById('hexInput');

const swatchContainer = document.getElementById('colorSwatches');
swatchColors.forEach(hex => {
    const s = document.createElement('button');
    s.className        = 'swatch';
    s.style.background = hex;
    s.addEventListener('click', () => {
        setRGB(
            parseInt(hex.slice(1, 3), 16),
            parseInt(hex.slice(3, 5), 16),
            parseInt(hex.slice(5, 7), 16)
        );
    });
    swatchContainer.appendChild(s);
});

function setRGB(r, g, b) {
    rSlider.value = r; gSlider.value = g; bSlider.value = b;
    rVal.textContent = r; gVal.textContent = g; bVal.textContent = b;
    const hex = [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    hexInput.value         = hex;
    preview.style.background = `rgb(${r},${g},${b})`;
}

function syncFromSliders() {
    setRGB(+rSlider.value, +gSlider.value, +bSlider.value);
}
rSlider.addEventListener('input', syncFromSliders);
gSlider.addEventListener('input', syncFromSliders);
bSlider.addEventListener('input', syncFromSliders);

hexInput.addEventListener('input', function () {
    const hex = this.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    this.value = hex;
    if (hex.length === 6) {
        setRGB(
            parseInt(hex.slice(0, 2), 16),
            parseInt(hex.slice(2, 4), 16),
            parseInt(hex.slice(4, 6), 16)
        );
    }
});

function openColorPicker(item) {
    currentColorTarget = item;
    const current = item.style.backgroundColor || 'rgb(26,26,26)';
    const match   = current.match(/\d+/g);
    if (match) setRGB(+match[0], +match[1], +match[2]);
    overlay.classList.remove('hidden');
}

document.getElementById('colorApply').addEventListener('click', async () => {
    if (currentColorTarget) {
        const r     = +rSlider.value, g = +gSlider.value, b = +bSlider.value;
        const color = `rgb(${r},${g},${b})`;
        currentColorTarget.style.backgroundColor = color;
        await saveField(currentColorTarget.dataset.id, 'bgColor', color);
    }
    currentColorTarget = null;
    overlay.classList.add('hidden');
});

document.getElementById('colorCancel').addEventListener('click', () => {
    currentColorTarget = null;
    overlay.classList.add('hidden');
});

overlay.addEventListener('pointerdown', e => {
    if (e.target === overlay) {
        currentColorTarget = null;
        overlay.classList.add('hidden');
    }
});

async function loadExistingFiles() {
    for (let i = 0; i < 6; i++) {
        const itemElem = document.querySelector(`.image-upload-item[data-id="${i}"]`);
        if (!itemElem) continue;
        const rec = await getItem(i);
        if (!rec) continue;
        if (rec.title)   itemElem.querySelector('.label').textContent = rec.title;
        if (rec.bgColor) itemElem.style.backgroundColor = rec.bgColor;
        if (rec.image)   setPreviewImageFromBlob(itemElem, rec.image);
        if (rec.audio)   setAudioFromBlob(itemElem, rec.audio);
    }
}

loadExistingFiles();

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/barsound/sw.js').catch(err => {
        console.warn('SW registration failed:', err);
    });
}
