const defaultInventory = [
  { id: 1, code: "SAN-001", name: "Detergente alcalino", category: "Químicos", area: "Almacén de sanidad", stock: 18, minStock: 10, unit: "L", cost: 96.5 },
  { id: 2, code: "SAN-002", name: "Desinfectante grado alimenticio", category: "Químicos", area: "Producción", stock: 7, minStock: 12, unit: "L", cost: 124.0 },
  { id: 3, code: "SAN-003", name: "Jabón para manos", category: "Consumibles", area: "Servicios generales", stock: 24, minStock: 15, unit: "L", cost: 68.0 },
  { id: 4, code: "SAN-004", name: "Guantes de nitrilo", category: "Protección", area: "Sanidad", stock: 0, minStock: 8, unit: "caja", cost: 185.0 },
  { id: 5, code: "SAN-005", name: "Escoba sanitaria", category: "Limpieza", area: "Producción", stock: 9, minStock: 4, unit: "pza", cost: 132.0 },
  { id: 6, code: "SAN-006", name: "Fibra de limpieza", category: "Limpieza", area: "Almacén de sanidad", stock: 14, minStock: 10, unit: "pza", cost: 28.5 },
  { id: 7, code: "SAN-007", name: "Toalla interdoblada", category: "Consumibles", area: "Servicios generales", stock: 11, minStock: 15, unit: "paquete", cost: 54.0 },
  { id: 8, code: "SAN-008", name: "Atomizador industrial", category: "Limpieza", area: "Sanidad", stock: 6, minStock: 5, unit: "pza", cost: 75.0 }
];

const defaultMovements = [
  { text: "Alta de inventario inicial", detail: "Detergente alcalino · 18 L", type: "Entrada", date: new Date().toISOString() },
  { text: "Consumo registrado", detail: "Desinfectante grado alimenticio · 5 L", type: "Salida", date: new Date(Date.now() - 86400000).toISOString() },
  { text: "Ajuste de existencia", detail: "Guantes de nitrilo · stock actualizado a 0 cajas", type: "Ajuste", date: new Date(Date.now() - 172800000).toISOString() }
];

let inventory = JSON.parse(localStorage.getItem("bimboSanidadInventory")) || defaultInventory;
let movements = JSON.parse(localStorage.getItem("bimboSanidadMovements")) || defaultMovements;

const inventoryBody = document.getElementById("inventoryBody");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const statusFilter = document.getElementById("statusFilter");
const totalItems = document.getElementById("totalItems");
const lowStockCount = document.getElementById("lowStockCount");
const outStockCount = document.getElementById("outStockCount");
const inventoryValue = document.getElementById("inventoryValue");
const resultCount = document.getElementById("resultCount");
const movementList = document.getElementById("movementList");
const alertsList = document.getElementById("alertsList");

const modalBackdrop = document.getElementById("modalBackdrop");
const itemForm = document.getElementById("itemForm");
const addItemBtn = document.getElementById("addItemBtn");
const responsiveAddAction = document.getElementById("responsiveAddAction");
const responsiveAddItemBtn = document.getElementById("responsiveAddItemBtn");
const sidebar = document.querySelector(".sidebar");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const modalTitle = document.getElementById("modalTitle");
const resetDataBtn = document.getElementById("resetDataBtn");
const toast = document.getElementById("toast");

function saveData() {
  localStorage.setItem("bimboSanidadInventory", JSON.stringify(inventory));
  localStorage.setItem("bimboSanidadMovements", JSON.stringify(movements));
}

function getStatus(item) {
  if (Number(item.stock) <= 0) return "out";
  if (Number(item.stock) <= Number(item.minStock)) return "low";
  return "ok";
}

function getStatusLabel(status) {
  return {
    ok: "Stock suficiente",
    low: "Stock bajo",
    out: "Sin existencia"
  }[status];
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(value);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderInventory() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedStatus = statusFilter.value;

  const filtered = inventory.filter(item => {
    const searchable = `${item.code} ${item.name} ${item.category} ${item.area}`.toLowerCase();
    const matchesSearch = searchable.includes(query);
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesStatus = selectedStatus === "all" || getStatus(item) === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  inventoryBody.innerHTML = filtered.length
    ? filtered.map(item => {
        const status = getStatus(item);
        return `
          <tr>
            <td data-label="Código"><span class="item-code">${escapeHTML(item.code)}</span></td>
            <td data-label="Insumo"><span class="item-name">${escapeHTML(item.name)}</span></td>
            <td data-label="Categoría">${escapeHTML(item.category)}</td>
            <td data-label="Área">${escapeHTML(item.area)}</td>
            <td data-label="Existencia">${Number(item.stock).toLocaleString("es-MX")}</td>
            <td data-label="Mínimo">${Number(item.minStock).toLocaleString("es-MX")}</td>
            <td data-label="Unidad">${escapeHTML(item.unit)}</td>
            <td data-label="Estado"><span class="badge ${status}">${getStatusLabel(status)}</span></td>
            <td data-label="Acciones">
              <div class="row-actions">
                <button class="row-btn" onclick="adjustStock(${item.id}, 1)" title="Entrada">＋</button>
                <button class="row-btn" onclick="adjustStock(${item.id}, -1)" title="Salida">−</button>
                <button class="row-btn" onclick="editItem(${item.id})" title="Editar">Editar</button>
                <button class="row-btn" onclick="deleteItem(${item.id})" title="Eliminar">×</button>
              </div>
            </td>
          </tr>
        `;
      }).join("")
    : `<tr><td colspan="9"><div class="empty-state">No se encontraron registros con los filtros seleccionados.</div></td></tr>`;

  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "registro" : "registros"}`;
  updateStats();
  renderAlerts();
}

function updateStats() {
  totalItems.textContent = inventory.length;
  lowStockCount.textContent = inventory.filter(item => getStatus(item) === "low").length;
  outStockCount.textContent = inventory.filter(item => getStatus(item) === "out").length;

  const totalValue = inventory.reduce((sum, item) => {
    return sum + (Number(item.stock) * Number(item.cost || 0));
  }, 0);

  inventoryValue.textContent = formatCurrency(totalValue);
}

function renderMovements() {
  const sorted = [...movements].sort((a, b) => new Date(b.date) - new Date(a.date));

  movementList.innerHTML = sorted.length
    ? sorted.map(movement => `
        <article class="movement-item">
          <div>
            <strong>${escapeHTML(movement.text)}</strong>
            <span>${escapeHTML(movement.detail)}</span>
            <time>${new Intl.DateTimeFormat("es-MX", {
              dateStyle: "medium",
              timeStyle: "short"
            }).format(new Date(movement.date))}</time>
          </div>
          <span class="movement-type">${escapeHTML(movement.type)}</span>
        </article>
      `).join("")
    : `<div class="empty-state">Aún no hay movimientos registrados.</div>`;
}

function renderAlerts() {
  const alertItems = inventory
    .filter(item => getStatus(item) !== "ok")
    .sort((a, b) => Number(a.stock) - Number(b.stock));

  alertsList.innerHTML = alertItems.length
    ? alertItems.map(item => {
        const status = getStatus(item);
        const missing = Math.max(Number(item.minStock) - Number(item.stock), 0);
        return `
          <article class="alert-card">
            <span class="badge ${status}">${getStatusLabel(status)}</span>
            <h3>${escapeHTML(item.name)}</h3>
            <p>${escapeHTML(item.area)} · ${Number(item.stock)} ${escapeHTML(item.unit)} disponibles.</p>
            <strong>Reposición sugerida: ${missing} ${escapeHTML(item.unit)}</strong>
          </article>
        `;
      }).join("")
    : `<div class="empty-state">No hay alertas activas. El inventario se encuentra dentro de los mínimos establecidos.</div>`;
}

function openModal(item = null) {
  itemForm.reset();
  document.getElementById("itemId").value = "";
  modalTitle.textContent = item ? "Editar insumo" : "Nuevo insumo";

  if (item) {
    document.getElementById("itemId").value = item.id;
    document.getElementById("code").value = item.code;
    document.getElementById("name").value = item.name;
    document.getElementById("category").value = item.category;
    document.getElementById("area").value = item.area;
    document.getElementById("stock").value = item.stock;
    document.getElementById("minStock").value = item.minStock;
    document.getElementById("unit").value = item.unit;
    document.getElementById("cost").value = item.cost;
  }

  modalBackdrop.hidden = false;
  setTimeout(() => document.getElementById("code").focus(), 50);
}

function closeModal() {
  modalBackdrop.hidden = true;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function addMovement(text, detail, type) {
  movements.push({
    text,
    detail,
    type,
    date: new Date().toISOString()
  });
}

function editItem(id) {
  const item = inventory.find(item => item.id === id);
  if (item) openModal(item);
}

function deleteItem(id) {
  const item = inventory.find(item => item.id === id);
  if (!item) return;

  if (!confirm(`¿Eliminar "${item.name}" del inventario?`)) return;

  inventory = inventory.filter(item => item.id !== id);
  addMovement("Insumo eliminado", `${item.name} · ${item.code}`, "Ajuste");
  saveData();
  renderInventory();
  renderMovements();
  showToast("Insumo eliminado.");
}

function adjustStock(id, delta) {
  const item = inventory.find(item => item.id === id);
  if (!item) return;

  const amount = Number(prompt(
    delta > 0
      ? `Cantidad a ingresar de ${item.name}:`
      : `Cantidad a retirar de ${item.name}:`,
    "1"
  ));

  if (!Number.isFinite(amount) || amount <= 0) return;

  const previous = Number(item.stock);
  const next = delta > 0 ? previous + amount : Math.max(previous - amount, 0);
  item.stock = Number(next.toFixed(2));

  addMovement(
    delta > 0 ? "Entrada de inventario" : "Salida de inventario",
    `${item.name} · ${amount} ${item.unit}`,
    delta > 0 ? "Entrada" : "Salida"
  );

  saveData();
  renderInventory();
  renderMovements();
  showToast(delta > 0 ? "Entrada registrada." : "Salida registrada.");
}

itemForm.addEventListener("submit", event => {
  event.preventDefault();

  const id = Number(document.getElementById("itemId").value);
  const data = {
    code: document.getElementById("code").value.trim(),
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value,
    area: document.getElementById("area").value.trim(),
    stock: Number(document.getElementById("stock").value),
    minStock: Number(document.getElementById("minStock").value),
    unit: document.getElementById("unit").value.trim(),
    cost: Number(document.getElementById("cost").value)
  };

  const duplicate = inventory.find(item =>
    item.code.toLowerCase() === data.code.toLowerCase() && item.id !== id
  );

  if (duplicate) {
    showToast("Ese código ya está registrado.");
    return;
  }

  if (id) {
    const index = inventory.findIndex(item => item.id === id);
    if (index !== -1) {
      inventory[index] = { ...inventory[index], ...data };
      addMovement("Insumo actualizado", `${data.name} · ${data.code}`, "Ajuste");
    }
  } else {
    const newItem = {
      id: Date.now(),
      ...data
    };
    inventory.push(newItem);
    addMovement("Nuevo insumo registrado", `${data.name} · ${data.stock} ${data.unit}`, "Entrada");
  }

  saveData();
  renderInventory();
  renderMovements();
  closeModal();
  showToast(id ? "Cambios guardados." : "Insumo agregado.");
});

addItemBtn.addEventListener("click", () => openModal());
responsiveAddItemBtn.addEventListener("click", () => openModal());
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", event => {
  if (event.target === modalBackdrop) closeModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
});

searchInput.addEventListener("input", renderInventory);
categoryFilter.addEventListener("change", renderInventory);
statusFilter.addEventListener("change", renderInventory);

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;

    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");

    document.querySelectorAll(".view").forEach(section => section.classList.remove("active"));
    document.getElementById(`${view}View`).classList.add("active");

    const titles = {
      inventario: "Inventario de sanidad",
      movimientos: "Movimientos de inventario",
      alertas: "Alertas de sanidad"
    };

    document.getElementById("pageTitle").textContent = titles[view];

    if (view === "movimientos") renderMovements();
    if (view === "alertas") renderAlerts();
  });
});

resetDataBtn.addEventListener("click", () => {
  if (!confirm("¿Restaurar los datos de ejemplo? Se perderán los cambios actuales.")) return;

  inventory = structuredClone(defaultInventory);
  movements = structuredClone(defaultMovements);
  saveData();
  renderInventory();
  renderMovements();
  showToast("Datos de ejemplo restaurados.");
});

document.getElementById("currentDate").textContent = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric"
}).format(new Date());

const responsiveLayout = window.matchMedia("(max-width: 980px)");
let responsiveUiFrame;

function updateResponsiveUi() {
  responsiveUiFrame = null;

  if (!responsiveLayout.matches) {
    document.documentElement.style.removeProperty("--responsive-nav-height");
    responsiveAddAction.classList.remove("is-visible");
    responsiveAddAction.setAttribute("aria-hidden", "true");
    responsiveAddItemBtn.tabIndex = -1;
    return;
  }

  const navHeight = Math.ceil(sidebar.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--responsive-nav-height", `${navHeight}px`);

  const originalButtonBottom = addItemBtn.getBoundingClientRect().bottom;
  const navBottom = sidebar.getBoundingClientRect().bottom;
  const shouldShow = originalButtonBottom <= navBottom;

  responsiveAddAction.classList.toggle("is-visible", shouldShow);
  responsiveAddAction.setAttribute("aria-hidden", String(!shouldShow));
  responsiveAddItemBtn.tabIndex = shouldShow ? 0 : -1;
}

function queueResponsiveUiUpdate() {
  if (responsiveUiFrame) return;
  responsiveUiFrame = requestAnimationFrame(updateResponsiveUi);
}

window.addEventListener("scroll", queueResponsiveUiUpdate, { passive: true });
window.addEventListener("resize", queueResponsiveUiUpdate);
responsiveLayout.addEventListener("change", queueResponsiveUiUpdate);

if ("ResizeObserver" in window) {
  new ResizeObserver(queueResponsiveUiUpdate).observe(sidebar);
}

renderInventory();
renderMovements();
updateResponsiveUi();

window.editItem = editItem;
window.deleteItem = deleteItem;
window.adjustStock = adjustStock;
