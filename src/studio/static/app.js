const API = '/api';
const PAGE_SIZE = 50;
let currentCollection = null;
let currentDoc = null;
let currentPage = 0;
let totalDocs = 0;
let searchQuery = '';
let searchTimer = null;

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

async function loadCollections() {
  const { collections } = await api('/collections');
  const list = document.getElementById('collections-list');
  list.innerHTML = '';
  for (const col of collections) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${col.name}</span><span class="count">${col.count}</span>`;
    li.onclick = () => selectCollection(col.name);
    if (col.name === currentCollection) li.classList.add('active');
    list.appendChild(li);
  }
}

async function selectCollection(name) {
  currentCollection = name;
  currentPage = 0;
  searchQuery = '';
  document.getElementById('search-input').value = '';
  document.getElementById('empty-state').classList.add('hidden');
  document.getElementById('collection-view').classList.remove('hidden');
  document.getElementById('collection-name').textContent = name;
  await loadDocuments();
  await loadCollections();
}

async function loadDocuments() {
  if (!currentCollection) return;
  const offset = currentPage * PAGE_SIZE;
  let url = `/data/${currentCollection}?limit=${PAGE_SIZE}&offset=${offset}`;
  if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

  const { data, total } = await api(url);
  totalDocs = total;
  document.getElementById('doc-count').textContent = `${total} documents`;

  const thead = document.getElementById('table-head');
  const tbody = document.getElementById('table-body');

  if (!data || data.length === 0) {
    thead.innerHTML = `<th>${searchQuery ? 'No matching documents' : 'No documents'}</th>`;
    tbody.innerHTML = '';
    updatePagination();
    return;
  }

  // Get all unique keys
  const keys = [...new Set(data.flatMap(d => Object.keys(d)))];
  thead.innerHTML = keys.map(k => `<th>${k}</th>`).join('');

  tbody.innerHTML = data.map(doc => {
    const cells = keys.map(k => {
      let val = doc[k];
      if (val && typeof val === 'object') val = JSON.stringify(val);
      if (typeof val === 'string' && val.length > 50) val = val.slice(0, 50) + '...';
      return `<td>${val ?? ''}</td>`;
    }).join('');
    return `<tr data-id="${doc.id}">${cells}</tr>`;
  }).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.onclick = () => editDocument(data.find(d => d.id === tr.dataset.id));
  });

  updatePagination();
}

function updatePagination() {
  const totalPages = Math.max(1, Math.ceil(totalDocs / PAGE_SIZE));
  const pag = document.getElementById('pagination');

  if (totalPages <= 1) {
    pag.classList.add('hidden');
    return;
  }

  pag.classList.remove('hidden');
  document.getElementById('page-info').textContent = `Page ${currentPage + 1} of ${totalPages}`;
  document.getElementById('btn-prev').disabled = currentPage === 0;
  document.getElementById('btn-next').disabled = currentPage >= totalPages - 1;
}

function editDocument(doc) {
  currentDoc = doc;
  document.getElementById('modal-title').textContent = doc ? `Edit: ${doc.id}` : 'New Document';
  document.getElementById('doc-editor').value = JSON.stringify(doc ?? {}, null, 2);
  document.getElementById('btn-delete').classList.toggle('hidden', !doc);
  document.getElementById('modal').classList.remove('hidden');
}

async function saveDocument() {
  const editor = document.getElementById('doc-editor');
  let data;
  try {
    data = JSON.parse(editor.value);
  } catch (e) {
    alert('Invalid JSON');
    return;
  }

  if (currentDoc) {
    await api(`/data/${currentCollection}/${currentDoc.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  } else {
    await api(`/data/${currentCollection}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  closeModal();
  await loadDocuments();
  await loadCollections();
}

async function deleteDocument() {
  if (!currentDoc || !confirm(`Delete ${currentDoc.id}?`)) return;
  await api(`/data/${currentCollection}/${currentDoc.id}`, { method: 'DELETE' });
  closeModal();
  await loadDocuments();
  await loadCollections();
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  currentDoc = null;
}

// Event listeners
document.getElementById('btn-add').onclick = () => editDocument(null);
document.getElementById('btn-save').onclick = saveDocument;
document.getElementById('btn-delete').onclick = deleteDocument;
document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal').onclick = (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
};

document.getElementById('btn-prev').onclick = () => {
  if (currentPage > 0) { currentPage--; loadDocuments(); }
};
document.getElementById('btn-next').onclick = () => {
  const totalPages = Math.ceil(totalDocs / PAGE_SIZE);
  if (currentPage < totalPages - 1) { currentPage++; loadDocuments(); }
};

document.getElementById('search-input').oninput = (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = e.target.value.trim();
    currentPage = 0;
    loadDocuments();
  }, 250);
};

// Initial load
loadCollections();
