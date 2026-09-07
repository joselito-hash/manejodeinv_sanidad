import { supabase } from "../supabaseClient.js";

const ROLE_LABELS = {
  administrador: "Administrador",
  sanidad: "Sanidad",
  supervisor: "Supervisor",
  consulta: "Consulta"
};

const ROLE_PERMISSIONS = {
  administrador: {
    addProducts: true,
    editProducts: true,
    registerMovements: true,
    adjustStock: true,
    deactivateProducts: true,
    deleteProducts: true,
    manageUsers: true,
    viewInventoryValue: true
  },
  sanidad: {
    addProducts: true,
    editProducts: false,
    registerMovements: true,
    adjustStock: true,
    deactivateProducts: true,
    deleteProducts: false,
    manageUsers: false,
    viewInventoryValue: false
  },
  supervisor: {
    addProducts: true,
    editProducts: false,
    registerMovements: true,
    adjustStock: true,
    deactivateProducts: true,
    deleteProducts: false,
    manageUsers: false,
    viewInventoryValue: false
  },
  consulta: {
    addProducts: false,
    editProducts: false,
    registerMovements: false,
    adjustStock: false,
    deactivateProducts: false,
    deleteProducts: false,
    manageUsers: false,
    viewInventoryValue: false
  }
};

const NO_PERMISSIONS = Object.freeze({
  addProducts: false,
  editProducts: false,
  registerMovements: false,
  adjustStock: false,
  deactivateProducts: false,
  deleteProducts: false,
  manageUsers: false,
  viewInventoryValue: false
});

let inventory = [];
let movements = [];
let users = [];
let currentUser = null;
let currentProfile = null;
let currentPermissions = NO_PERMISSIONS;
let inventoryState = "loading";
let movementsState = "loading";
let usersState = "idle";
let authRedirecting = false;
let logoutTransitionStarted = false;
const pendingStockOperations = new Set();

const inventoryBody = document.getElementById("inventoryBody");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const statusFilter = document.getElementById("statusFilter");
const totalItems = document.getElementById("totalItems");
const lowStockCount = document.getElementById("lowStockCount");
const outStockCount = document.getElementById("outStockCount");
const inventoryValue = document.getElementById("inventoryValue");
const inventoryValueCard = document.getElementById("inventoryValueCard");
const statsGrid = document.querySelector(".stats-grid");
const resultCount = document.getElementById("resultCount");
const movementList = document.getElementById("movementList");
const alertsList = document.getElementById("alertsList");
const usersNavItem = document.getElementById("usersNavItem");
const usersBody = document.getElementById("usersBody");
const usersResultCount = document.getElementById("usersResultCount");
const userSearchInput = document.getElementById("userSearchInput");
const addUserBtn = document.getElementById("addUserBtn");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");

const modalBackdrop = document.getElementById("modalBackdrop");
const itemForm = document.getElementById("itemForm");
const addItemBtn = document.getElementById("addItemBtn");
const responsiveAddAction = document.getElementById("responsiveAddAction");
const responsiveAddItemBtn = document.getElementById("responsiveAddItemBtn");
const responsiveUserAddAction = document.getElementById("responsiveUserAddAction");
const responsiveAddUserBtn = document.getElementById("responsiveAddUserBtn");
const sidebar = document.querySelector(".sidebar");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const modalTitle = document.getElementById("modalTitle");
const refreshDataBtn = document.getElementById("refreshDataBtn");
const saveItemBtn = document.getElementById("saveItemBtn");
const stockInput = document.getElementById("stock");
const stockEditHelp = document.getElementById("stockEditHelp");
const toast = document.getElementById("toast");

const stockOperationPanel = document.getElementById("stockOperationPanel");
const stockOperationForm = document.getElementById("stockOperationForm");
const stockOperationProductId = document.getElementById("stockOperationProductId");
const stockOperationType = document.getElementById("stockOperationType");
const stockOperationTitle = document.getElementById("stockOperationTitle");
const stockOperationProductName = document.getElementById("stockOperationProductName");
const stockOperationCurrentStock = document.getElementById("stockOperationCurrentStock");
const stockOperationQuantityLabel = document.getElementById("stockOperationQuantityLabel");
const stockOperationQuantity = document.getElementById("stockOperationQuantity");
const stockObservationField = document.getElementById("stockObservationField");
const stockOperationObservation = document.getElementById("stockOperationObservation");
const closeStockOperationBtn = document.getElementById("closeStockOperationBtn");
const cancelStockOperationBtn = document.getElementById("cancelStockOperationBtn");
const saveStockOperationBtn = document.getElementById("saveStockOperationBtn");

const confirmationBackdrop = document.getElementById("confirmationBackdrop");
const confirmationTitle = document.getElementById("confirmationTitle");
const confirmationMessage = document.getElementById("confirmationMessage");
const confirmationCancelBtn = document.getElementById("confirmationCancelBtn");
const confirmationConfirmBtn = document.getElementById("confirmationConfirmBtn");

const currentUserName = document.getElementById("currentUserName");
const currentUserNumber = document.getElementById("currentUserNumber");
const currentUserRole = document.getElementById("currentUserRole");
const logoutBtn = document.getElementById("logoutBtn");
const appBootstrapStatus = document.getElementById("appBootstrapStatus");
const logoutTransition = document.getElementById("logoutTransition");
const logoutPhrase = document.getElementById("logoutPhrase");

const userModalBackdrop = document.getElementById("userModalBackdrop");
const userForm = document.getElementById("userForm");
const userModalTitle = document.getElementById("userModalTitle");
const closeUserModalBtn = document.getElementById("closeUserModalBtn");
const cancelUserBtn = document.getElementById("cancelUserBtn");
const saveUserBtn = document.getElementById("saveUserBtn");
const userIdInput = document.getElementById("userId");
const userEmployeeNumberInput = document.getElementById("userEmployeeNumber");
const userFullNameInput = document.getElementById("userFullName");
const userRoleInput = document.getElementById("userRole");
const userPasswordInput = document.getElementById("userPassword");
const userPasswordLabel = document.getElementById("userPasswordLabel");
const userPasswordHelp = document.getElementById("userPasswordHelp");
const userActiveInput = document.getElementById("userActive");

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

function formatNumber(value) {
  return Number(value || 0).toLocaleString("es-MX", {
    maximumFractionDigits: 2
  });
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizePersonName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function mapProduct(row) {
  return {
    id: String(row.id),
    code: row.codigo || "",
    name: row.nombre || "",
    category: row.categoria || "",
    stock: Number(row.existencia || 0),
    minStock: Number(row.stock_minimo || 0),
    unit: row.unidad || "",
    cost: Number(row.costo || 0)
  };
}

function mapMovement(row) {
  const product = Array.isArray(row.productos) ? row.productos[0] : row.productos;
  const type = String(row.tipo || "ajuste").toLowerCase();
  const labels = {
    entrada: "Entrada de inventario",
    salida: "Salida de inventario",
    ajuste: "Ajuste de inventario"
  };
  const typeLabels = {
    entrada: "Entrada",
    salida: "Salida",
    ajuste: "Ajuste"
  };
  const productName = row.producto_nombre || product?.nombre || `Producto ${row.producto_id}`;
  const productUnit = row.producto_unidad || product?.unidad || "";
  const unit = productUnit ? ` ${productUnit}` : "";
  const observation = type === "ajuste" && row.observaciones
    ? ` · ${row.observaciones}`
    : "";
  const movementDetail = type === "ajuste"
    ? `${formatNumber(row.existencia_anterior)}${unit} → ${formatNumber(row.existencia_nueva)}${unit}`
    : `${formatNumber(row.cantidad)}${unit}`;

  return {
    text: labels[type] || "Movimiento de inventario",
    detail: `${productName} · ${movementDetail}${observation}`,
    type: typeLabels[type] || "Movimiento",
    date: row.created_at || new Date(0).toISOString(),
    responsibleName: row.responsable_nombre || "Responsable no disponible",
    responsibleNumber: row.responsable_numero_colaborador || ""
  };
}

function stateRow(message, isError = false) {
  return `
    <tr>
      <td colspan="8" data-label="">
        <div class="empty-state${isError ? " error" : ""}">${escapeHTML(message)}</div>
      </td>
    </tr>
  `;
}

function renderProductActions(item) {
  const id = escapeHTML(item.id);
  const buttons = [];

  if (currentPermissions.registerMovements) {
    buttons.push(`
      <button type="button" class="row-btn movement-action entry" data-action="entry" data-id="${id}" title="Registrar entrada">+ Entrada</button>
      <button type="button" class="row-btn movement-action exit" data-action="exit" data-id="${id}" title="Registrar salida">− Salida</button>
    `);
  }

  if (currentPermissions.adjustStock) {
    buttons.push(`
      <button type="button" class="row-btn" data-action="adjust" data-id="${id}" title="Ajustar existencia">Ajustar</button>
    `);
  }

  if (currentPermissions.editProducts) {
    buttons.push(`
      <button type="button" class="row-btn" data-action="edit" data-id="${id}" title="Editar producto">Editar</button>
    `);
  }

  if (currentPermissions.deactivateProducts) {
    buttons.push(`
      <button type="button" class="row-btn" data-action="deactivate" data-id="${id}" title="Dar de baja">Baja</button>
    `);
  }

  if (currentPermissions.deleteProducts) {
    buttons.push(`
      <button type="button" class="row-btn danger" data-action="delete" data-id="${id}" title="Eliminar definitivamente">Eliminar</button>
    `);
  }

  return buttons.join("");
}

function updateStats() {
  totalItems.textContent = inventory.length;
  lowStockCount.textContent = inventory.filter(item => getStatus(item) === "low").length;
  outStockCount.textContent = inventory.filter(item => getStatus(item) === "out").length;

  if (currentPermissions.viewInventoryValue) {
    const totalValue = inventory.reduce((sum, item) => {
      return sum + (Number(item.stock) * Number(item.cost || 0));
    }, 0);

    inventoryValue.textContent = formatCurrency(totalValue);
  }
}

function renderInventory() {
  updateStats();

  if (inventoryState === "loading") {
    inventoryBody.innerHTML = stateRow("Cargando inventario...");
    resultCount.textContent = "Cargando...";
    renderAlerts();
    return;
  }

  if (inventoryState === "error") {
    inventoryBody.innerHTML = stateRow("No fue posible cargar el inventario.", true);
    resultCount.textContent = "Sin datos";
    renderAlerts();
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedStatus = statusFilter.value;

  const filtered = inventory.filter(item => {
    const searchable = `${item.code} ${item.name} ${item.category}`.toLowerCase();
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
            <td data-label="Existencia">${formatNumber(item.stock)}</td>
            <td data-label="Mínimo">${formatNumber(item.minStock)}</td>
            <td data-label="Unidad">${escapeHTML(item.unit)}</td>
            <td data-label="Estado"><span class="badge ${status}">${getStatusLabel(status)}</span></td>
            <td data-label="Acciones" class="actions-column">
              <div class="row-actions">
                ${renderProductActions(item)}
              </div>
            </td>
          </tr>
        `;
      }).join("")
    : stateRow("No se encontraron registros con los filtros seleccionados.");

  resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? "registro" : "registros"}`;
  renderAlerts();
}

function renderMovements() {
  if (movementsState === "loading") {
    movementList.innerHTML = '<div class="empty-state">Cargando movimientos...</div>';
    return;
  }

  if (movementsState === "error") {
    movementList.innerHTML = '<div class="empty-state error">No fue posible cargar los movimientos.</div>';
    return;
  }

  movementList.innerHTML = movements.length
    ? movements.map(movement => `
        <article class="movement-item">
          <div>
            <strong>${escapeHTML(movement.text)}</strong>
            <span>${escapeHTML(movement.detail)}</span>
            <span class="movement-responsible">
              Responsable: ${escapeHTML(movement.responsibleName)}${movement.responsibleNumber ? ` · Colaborador ${escapeHTML(movement.responsibleNumber)}` : ""}
            </span>
            <time>${new Intl.DateTimeFormat("es-MX", {
              dateStyle: "medium",
              timeStyle: "short"
            }).format(new Date(movement.date))}</time>
          </div>
          <span class="movement-type">${escapeHTML(movement.type)}</span>
        </article>
      `).join("")
    : '<div class="empty-state">Aún no hay movimientos registrados.</div>';
}

function renderAlerts() {
  if (inventoryState === "loading") {
    alertsList.innerHTML = '<div class="empty-state">Cargando inventario...</div>';
    return;
  }

  if (inventoryState === "error") {
    alertsList.innerHTML = '<div class="empty-state error">No fue posible cargar el inventario.</div>';
    return;
  }

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
            <p>${formatNumber(item.stock)} ${escapeHTML(item.unit)} disponibles.</p>
            <strong>Reposición sugerida: ${formatNumber(missing)} ${escapeHTML(item.unit)}</strong>
          </article>
        `;
      }).join("")
    : '<div class="empty-state">No hay alertas activas. El inventario se encuentra dentro de los mínimos establecidos.</div>';
}

function renderUsers() {
  if (!currentPermissions.manageUsers) return;

  if (usersState === "loading") {
    usersBody.innerHTML = `
      <tr><td colspan="5"><div class="empty-state">Cargando usuarios...</div></td></tr>
    `;
    usersResultCount.textContent = "Cargando...";
    return;
  }

  if (usersState === "error") {
    usersBody.innerHTML = `
      <tr><td colspan="5"><div class="empty-state error">No fue posible cargar los usuarios.</div></td></tr>
    `;
    usersResultCount.textContent = "Sin datos";
    return;
  }

  const query = userSearchInput.value.trim().toLowerCase();
  const filteredUsers = users.filter(user => {
    const searchable = `${user.numero_colaborador} ${user.nombre} ${user.rol}`.toLowerCase();
    return searchable.includes(query);
  });

  usersBody.innerHTML = filteredUsers.length
    ? filteredUsers.map(user => {
        const isCurrentUser = user.user_id === currentUser?.id;
        const statusClass = user.activo ? "ok" : "out";
        const statusLabel = user.activo ? "Activo" : "Inactivo";

        return `
          <tr>
            <td data-label="Colaborador">${escapeHTML(user.numero_colaborador)}</td>
            <td data-label="Nombre">
              <div class="user-name-cell">
                <span class="item-name">${escapeHTML(user.nombre)}</span>
                ${isCurrentUser ? '<span class="user-self-label">Tu cuenta</span>' : ""}
              </div>
            </td>
            <td data-label="Rol">${escapeHTML(formatRole(user.rol))}</td>
            <td data-label="Estado"><span class="badge ${statusClass}">${statusLabel}</span></td>
            <td data-label="Acciones">
              <div class="row-actions">
                <button type="button" class="row-btn" data-user-action="edit" data-user-id="${escapeHTML(user.user_id)}">Editar</button>
                ${isCurrentUser ? "" : `
                  <button type="button" class="row-btn danger" data-user-action="delete" data-user-id="${escapeHTML(user.user_id)}">Eliminar</button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join("")
    : '<tr><td colspan="5"><div class="empty-state">No se encontraron usuarios.</div></td></tr>';

  usersResultCount.textContent = `${filteredUsers.length} ${filteredUsers.length === 1 ? "usuario" : "usuarios"}`;
}

async function cargarUsuarios() {
  if (!currentPermissions.manageUsers) return false;

  usersState = "loading";
  renderUsers();

  try {
    const { data, error } = await supabase
      .from("perfiles")
      .select("user_id,numero_colaborador,nombre,rol,activo,created_at")
      .order("nombre", { ascending: true });

    if (error) throw error;

    users = data || [];
    usersState = "ready";
    renderUsers();
    return true;
  } catch (error) {
    console.error("No fue posible cargar los usuarios.", error);
    users = [];
    usersState = "error";
    renderUsers();
    handlePotentialAuthError(error);
    return false;
  }
}

async function invokeUserAdministration(body) {
  const { data, error } = await supabase.functions.invoke("admin-usuarios", { body });

  if (error) throw error;
  if (!data?.ok) {
    const operationError = new Error(data?.error || "operacion_usuarios_fallida");
    operationError.userMessage = data?.message;
    throw operationError;
  }

  return data;
}

function openUserModal(user = null) {
  if (!currentPermissions.manageUsers) return;

  userForm.reset();
  userIdInput.value = user?.user_id || "";
  userModalTitle.textContent = user ? "Editar usuario" : "Nuevo usuario";
  userPasswordLabel.textContent = user ? "Nueva contraseña" : "Contraseña temporal";
  userPasswordHelp.textContent = user
    ? "Déjala vacía para conservar la contraseña actual."
    : "El usuario podrá iniciar sesión con esta contraseña.";
  userPasswordInput.required = !user;
  userActiveInput.checked = user ? user.activo === true : true;

  if (user) {
    userEmployeeNumberInput.value = user.numero_colaborador;
    userFullNameInput.value = user.nombre;
    userRoleInput.value = String(user.rol || "consulta").toLowerCase();
  } else {
    userRoleInput.value = "consulta";
  }

  const editingSelf = user?.user_id === currentUser?.id;
  userRoleInput.disabled = editingSelf;
  userActiveInput.disabled = editingSelf;

  userModalBackdrop.hidden = false;
  setTimeout(() => userEmployeeNumberInput.focus(), 50);
}

function closeUserModal() {
  if (saveUserBtn.disabled) return;
  userModalBackdrop.hidden = true;
}

function setUserSaveBusy(isBusy) {
  saveUserBtn.disabled = isBusy;
  cancelUserBtn.disabled = isBusy;
  closeUserModalBtn.disabled = isBusy;
  saveUserBtn.textContent = isBusy ? "Guardando..." : "Guardar usuario";
}

async function deleteUser(userId) {
  if (!currentPermissions.manageUsers || userId === currentUser?.id) return;

  const user = users.find(item => item.user_id === userId);
  if (!user) return;
  const accepted = await requestConfirmation({
    title: "Eliminar usuario",
    message: `Se eliminará el acceso de ${user.nombre}. Esta acción no se puede deshacer.`,
    confirmLabel: "Eliminar usuario",
    danger: true
  });
  if (!accepted) return;

  try {
    await invokeUserAdministration({ action: "delete", user_id: userId });
    await cargarUsuarios();
    showToast("Usuario eliminado.");
  } catch (error) {
    console.error("No fue posible eliminar el usuario.", error);
    if (!handlePotentialAuthError(error)) {
      showToast(error.userMessage || "No fue posible eliminar el usuario.");
    }
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}

let confirmationResolver = null;
let confirmationReturnFocus = null;

function requestConfirmation({ title, message, confirmLabel = "Confirmar", danger = false }) {
  if (confirmationResolver) confirmationResolver(false);

  clearTimeout(resolveConfirmation.timer);
  confirmationTitle.textContent = title;
  confirmationMessage.textContent = message;
  confirmationConfirmBtn.textContent = confirmLabel;
  confirmationConfirmBtn.classList.toggle("danger", danger);
  confirmationReturnFocus = document.activeElement;
  confirmationBackdrop.hidden = false;

  requestAnimationFrame(() => {
    confirmationBackdrop.classList.add("is-visible");
    confirmationConfirmBtn.focus();
  });

  return new Promise(resolve => {
    confirmationResolver = resolve;
  });
}

function resolveConfirmation(accepted) {
  if (confirmationBackdrop.hidden) return;

  const resolver = confirmationResolver;
  confirmationResolver = null;
  confirmationBackdrop.classList.remove("is-visible");
  resolveConfirmation.timer = setTimeout(() => {
    confirmationBackdrop.hidden = true;
    if (confirmationReturnFocus instanceof HTMLElement) confirmationReturnFocus.focus();
    confirmationReturnFocus = null;
  }, 220);
  resolver?.(accepted);
}

function handlePotentialAuthError(error) {
  const message = String(error?.message || "").toLowerCase();
  const expired = error?.status === 401 || message.includes("jwt") || message.includes("session");

  if (expired) redirectToLogin("Sesión expirada.");
  return expired;
}

async function cargarInventario() {
  inventoryState = "loading";
  renderInventory();

  try {
    const { data, error } = await supabase.rpc("listar_productos_activos");

    if (error) throw error;

    inventory = (data || []).map(mapProduct);
    inventoryState = "ready";
    renderInventory();
    return true;
  } catch (error) {
    console.error("No fue posible cargar productos desde Supabase.", error);
    inventory = [];
    inventoryState = "error";
    renderInventory();
    handlePotentialAuthError(error);
    return false;
  }
}

async function cargarMovimientos() {
  movementsState = "loading";
  renderMovements();

  try {
    const { data, error } = await supabase.rpc("listar_movimientos", {
      p_limite: 100
    });

    if (error) throw error;

    movements = (data || []).map(mapMovement);
    movementsState = "ready";
    renderMovements();
    return true;
  } catch (error) {
    console.error("No fue posible cargar movimientos desde Supabase.", error);
    movements = [];
    movementsState = "error";
    renderMovements();
    handlePotentialAuthError(error);
    return false;
  }
}

async function refreshAllData() {
  const results = await Promise.all([cargarInventario(), cargarMovimientos()]);
  return results.every(Boolean);
}

function openModal(item = null) {
  const allowed = item
    ? currentPermissions.editProducts
    : currentPermissions.addProducts;
  if (!allowed) return;

  itemForm.reset();
  document.getElementById("itemId").value = "";
  modalTitle.textContent = item ? "Editar insumo" : "Nuevo insumo";
  stockInput.disabled = Boolean(item);
  stockEditHelp.hidden = !item;

  if (item) {
    document.getElementById("itemId").value = item.id;
    document.getElementById("code").value = item.code;
    document.getElementById("name").value = item.name;
    document.getElementById("category").value = item.category;
    stockInput.value = item.stock;
    document.getElementById("minStock").value = item.minStock;
    document.getElementById("unit").value = item.unit;
    document.getElementById("cost").value = item.cost;
  }

  modalBackdrop.hidden = false;
  setTimeout(() => document.getElementById("code").focus(), 50);
}

function closeModal() {
  if (saveItemBtn.disabled) return;
  modalBackdrop.hidden = true;
}

function setSaveBusy(isBusy) {
  saveItemBtn.disabled = isBusy;
  cancelBtn.disabled = isBusy;
  closeModalBtn.disabled = isBusy;
  saveItemBtn.textContent = isBusy ? "Guardando..." : "Guardar insumo";
}

function editItem(id) {
  if (!currentPermissions.editProducts) return;
  const item = inventory.find(product => product.id === String(id));
  if (item) openModal(item);
}

async function deactivateItem(id) {
  if (!currentPermissions.deactivateProducts) return;

  const item = inventory.find(product => product.id === String(id));
  if (!item) return;
  const accepted = await requestConfirmation({
    title: "Dar de baja el insumo",
    message: `${item.name} dejará de aparecer en el inventario activo, pero conservará su historial de movimientos.`,
    confirmLabel: "Dar de baja"
  });
  if (!accepted) return;

  try {
    const { error } = await supabase.rpc("dar_de_baja_producto", {
      p_producto_id: item.id
    });
    if (error) throw error;

    await refreshAllData();
    showToast("Insumo dado de baja.");
  } catch (error) {
    console.error("No fue posible dar de baja el producto.", error);
    if (!handlePotentialAuthError(error)) showToast("No fue posible dar de baja el insumo.");
  }
}

async function permanentlyDeleteItem(id) {
  if (!currentPermissions.deleteProducts) return;

  const item = inventory.find(product => product.id === String(id));
  if (!item) return;

  const accepted = await requestConfirmation({
    title: "Eliminar definitivamente",
    message: `Se intentará eliminar ${item.name} de forma permanente. Esta acción no se puede deshacer.`,
    confirmLabel: "Eliminar",
    danger: true
  });
  if (!accepted) return;

  try {
    const { data: deletedProduct, error } = await supabase
      .from("productos")
      .delete()
      .eq("id", item.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!deletedProduct) throw new Error("producto_no_eliminado");

    await refreshAllData();
    showToast("Producto eliminado definitivamente.");
  } catch (error) {
    console.error("No fue posible eliminar físicamente el producto.", error);

    if (String(error?.code || "") === "23503") {
      showToast("No se puede eliminar: el producto tiene movimientos registrados.");
    } else if (!handlePotentialAuthError(error)) {
      showToast("No fue posible eliminar definitivamente el producto.");
    }
  }
}

function openStockOperation(id, type) {
  const isAdjustment = type === "ajuste";
  const allowed = isAdjustment
    ? currentPermissions.adjustStock
    : currentPermissions.registerMovements;
  if (!allowed || pendingStockOperations.has(String(id))) return;

  const item = inventory.find(product => product.id === String(id));
  if (!item) return;

  clearTimeout(closeStockOperation.timer);
  stockOperationForm.reset();
  stockOperationForm.classList.toggle("is-adjustment", isAdjustment);
  stockOperationProductId.value = item.id;
  stockOperationType.value = type;
  stockOperationProductName.textContent = item.name;
  stockOperationCurrentStock.textContent = `Existencia actual: ${formatNumber(item.stock)} ${item.unit}`.trim();

  const titles = {
    entrada: "Registrar entrada",
    salida: "Registrar salida",
    ajuste: "Ajustar existencia"
  };
  stockOperationTitle.textContent = titles[type] || "Registrar movimiento";
  stockOperationQuantityLabel.textContent = isAdjustment ? "Nueva existencia" : "Cantidad";
  stockOperationQuantity.min = isAdjustment ? "0" : "0.01";
  stockOperationQuantity.value = isAdjustment ? String(item.stock) : "1";
  stockObservationField.hidden = !isAdjustment;
  stockOperationObservation.required = isAdjustment;
  stockOperationObservation.disabled = !isAdjustment;
  saveStockOperationBtn.textContent = isAdjustment ? "Guardar ajuste" : titles[type];

  stockOperationPanel.hidden = false;
  requestAnimationFrame(() => {
    stockOperationPanel.classList.add("is-visible");
    stockOperationQuantity.focus();
    stockOperationQuantity.select();
  });
}

function closeStockOperation() {
  if (saveStockOperationBtn.disabled) return;

  stockOperationPanel.classList.remove("is-visible");
  clearTimeout(closeStockOperation.timer);
  closeStockOperation.timer = setTimeout(() => {
    stockOperationPanel.hidden = true;
    stockOperationForm.reset();
  }, 220);
}

function setStockOperationBusy(isBusy, type = stockOperationType.value) {
  stockOperationQuantity.disabled = isBusy;
  stockOperationObservation.disabled = isBusy || type !== "ajuste";
  closeStockOperationBtn.disabled = isBusy;
  cancelStockOperationBtn.disabled = isBusy;
  saveStockOperationBtn.disabled = isBusy;

  if (isBusy) {
    saveStockOperationBtn.textContent = "Registrando...";
  } else {
    saveStockOperationBtn.textContent = type === "ajuste"
      ? "Guardar ajuste"
      : type === "entrada"
        ? "Registrar entrada"
        : "Registrar salida";
  }
}

stockOperationForm.addEventListener("submit", async event => {
  event.preventDefault();

  const id = stockOperationProductId.value;
  const type = stockOperationType.value;
  const isAdjustment = type === "ajuste";
  const allowed = isAdjustment
    ? currentPermissions.adjustStock
    : currentPermissions.registerMovements;
  if (!allowed || pendingStockOperations.has(id)) return;

  const item = inventory.find(product => product.id === id);
  if (!item) {
    showToast("El insumo ya no está disponible.");
    closeStockOperation();
    return;
  }

  const amount = Number(stockOperationQuantity.value);
  if (!Number.isFinite(amount) || (isAdjustment ? amount < 0 : amount <= 0)) {
    showToast(isAdjustment
      ? "Ingresa una existencia válida mayor o igual a cero."
      : "Ingresa una cantidad mayor a cero.");
    return;
  }

  if (type === "salida" && amount > Number(item.stock)) {
    showToast("La salida no puede dejar una existencia negativa.");
    return;
  }

  if (isAdjustment && amount === Number(item.stock)) {
    showToast("La existencia no cambió.");
    return;
  }

  const observation = isAdjustment ? stockOperationObservation.value.trim() : null;
  if (isAdjustment && !observation) {
    showToast("Describe el motivo del ajuste.");
    stockOperationObservation.focus();
    return;
  }

  pendingStockOperations.add(id);
  setStockOperationBusy(true, type);
  let completed = false;

  try {
    const { error } = await supabase.rpc("registrar_movimiento", {
      p_producto_id: id,
      p_tipo: type,
      p_cantidad: amount,
      p_observaciones: observation
    });

    if (error) throw error;

    await refreshAllData();
    completed = true;
    const successMessages = {
      entrada: "Entrada registrada.",
      salida: "Salida registrada.",
      ajuste: "Existencia ajustada correctamente."
    };
    showToast(successMessages[type] || "Movimiento registrado.");
  } catch (error) {
    console.error("No fue posible registrar el movimiento.", error);
    const errorMessage = String(error?.message || "");

    if (errorMessage.includes("existencia_insuficiente")) {
      showToast("La salida no puede dejar una existencia negativa.");
    } else if (!handlePotentialAuthError(error)) {
      showToast(isAdjustment
        ? "No fue posible ajustar la existencia."
        : "No fue posible registrar el movimiento.");
    }
  } finally {
    pendingStockOperations.delete(id);
    setStockOperationBusy(false, type);
  }

  if (completed) closeStockOperation();
});

itemForm.addEventListener("submit", async event => {
  event.preventDefault();

  const id = document.getElementById("itemId").value;
  if (id && !currentPermissions.editProducts) return;
  if (!id && !currentPermissions.addProducts) return;

  const existingItem = id ? inventory.find(item => item.id === id) : null;
  const data = {
    codigo: document.getElementById("code").value.trim(),
    nombre: document.getElementById("name").value.trim(),
    categoria: document.getElementById("category").value,
    stock_minimo: Number(document.getElementById("minStock").value),
    unidad: document.getElementById("unit").value.trim(),
    costo: Number(document.getElementById("cost").value)
  };

  const duplicate = inventory.find(item =>
    item.code.toLowerCase() === data.codigo.toLowerCase() && item.id !== id
  );

  if (duplicate) {
    showToast("Ese código ya está registrado.");
    return;
  }

  if (id && !existingItem) {
    showToast("El insumo ya no está disponible.");
    return;
  }

  setSaveBusy(true);

  try {
    if (id) {
      const { data: updatedProduct, error } = await supabase
        .from("productos")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!updatedProduct) throw new Error("producto_no_actualizado");
    } else {
      const initialStock = Number(stockInput.value);

      if (!Number.isFinite(initialStock) || initialStock < 0) {
        showToast("Ingresa una existencia válida.");
        return;
      }

      const { data: insertedProduct, error } = await supabase
        .from("productos")
        .insert({ ...data, existencia: initialStock, activo: true })
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!insertedProduct) throw new Error("producto_no_insertado");
    }

    await cargarInventario();
    modalBackdrop.hidden = true;
    showToast(id ? "Cambios guardados." : "Insumo agregado.");
  } catch (error) {
    console.error("No fue posible guardar el producto.", error);
    if (!handlePotentialAuthError(error)) showToast("No fue posible guardar el insumo.");
  } finally {
    setSaveBusy(false);
  }
});

userForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentPermissions.manageUsers) return;

  const userId = userIdInput.value;
  const employeeNumber = userEmployeeNumberInput.value.trim();
  const fullName = userFullNameInput.value.trim();
  const password = userPasswordInput.value;

  if (!/^\d{1,20}$/.test(employeeNumber)) {
    showToast("El número de colaborador debe contener únicamente números.");
    return;
  }

  if (!fullName) {
    showToast("Ingresa el nombre completo del usuario.");
    return;
  }

  const editedUser = users.find(user => user.user_id === userId);
  const nameChanged = !editedUser
    || normalizePersonName(editedUser.nombre) !== normalizePersonName(fullName);
  const duplicatePerson = nameChanged
    ? users.find(user => (
        user.user_id !== userId
        && normalizePersonName(user.nombre) === normalizePersonName(fullName)
      ))
    : null;

  if (duplicatePerson) {
    showToast("Ya existe un usuario registrado con ese nombre.");
    return;
  }

  if ((!userId || password) && password.length < 6) {
    showToast("La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  const payload = {
    action: userId ? "update" : "create",
    user_id: userId || undefined,
    numero_colaborador: employeeNumber,
    nombre: fullName,
    rol: userRoleInput.value,
    activo: userActiveInput.checked
  };

  if (password) payload.password = password;
  setUserSaveBusy(true);

  try {
    const result = await invokeUserAdministration(payload);

    if (userId === currentUser?.id && result.profile) {
      currentProfile = { ...currentProfile, ...result.profile };
      renderCurrentUser();
    }

    await cargarUsuarios();
    userModalBackdrop.hidden = true;
    showToast(userId ? "Usuario actualizado." : "Usuario creado.");
  } catch (error) {
    console.error("No fue posible guardar el usuario.", error);
    if (!handlePotentialAuthError(error)) {
      showToast(error.userMessage || "No fue posible guardar el usuario.");
    }
  } finally {
    setUserSaveBusy(false);
  }
});

inventoryBody.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "entry") openStockOperation(id, "entrada");
  if (action === "exit") openStockOperation(id, "salida");
  if (action === "adjust") openStockOperation(id, "ajuste");
  if (action === "edit") editItem(id);
  if (action === "deactivate") deactivateItem(id);
  if (action === "delete") permanentlyDeleteItem(id);
});

usersBody.addEventListener("click", event => {
  const button = event.target.closest("button[data-user-action]");
  if (!button || !currentPermissions.manageUsers) return;

  const user = users.find(item => item.user_id === button.dataset.userId);
  if (button.dataset.userAction === "edit" && user) openUserModal(user);
  if (button.dataset.userAction === "delete") deleteUser(button.dataset.userId);
});

addItemBtn.addEventListener("click", () => openModal());
responsiveAddItemBtn.addEventListener("click", () => openModal());
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
closeStockOperationBtn.addEventListener("click", closeStockOperation);
cancelStockOperationBtn.addEventListener("click", closeStockOperation);
confirmationCancelBtn.addEventListener("click", () => resolveConfirmation(false));
confirmationConfirmBtn.addEventListener("click", () => resolveConfirmation(true));
addUserBtn.addEventListener("click", () => openUserModal());
responsiveAddUserBtn.addEventListener("click", () => openUserModal());
closeUserModalBtn.addEventListener("click", closeUserModal);
cancelUserBtn.addEventListener("click", closeUserModal);
userSearchInput.addEventListener("input", renderUsers);
refreshUsersBtn.addEventListener("click", async () => {
  refreshUsersBtn.disabled = true;
  refreshUsersBtn.textContent = "Actualizando...";
  const success = await cargarUsuarios();
  refreshUsersBtn.disabled = false;
  refreshUsersBtn.textContent = "Actualizar usuarios";
  showToast(success ? "Usuarios actualizados." : "No fue posible actualizar los usuarios.");
});

modalBackdrop.addEventListener("click", event => {
  if (event.target === modalBackdrop) closeModal();
});

userModalBackdrop.addEventListener("click", event => {
  if (event.target === userModalBackdrop) closeUserModal();
});

stockOperationPanel.addEventListener("click", event => {
  if (event.target === stockOperationPanel) closeStockOperation();
});

confirmationBackdrop.addEventListener("click", event => {
  if (event.target === confirmationBackdrop) resolveConfirmation(false);
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
  if (event.key === "Escape" && !userModalBackdrop.hidden) closeUserModal();
  if (event.key === "Escape" && !stockOperationPanel.hidden) closeStockOperation();
  if (event.key === "Escape" && !confirmationBackdrop.hidden) resolveConfirmation(false);
});

searchInput.addEventListener("input", renderInventory);
categoryFilter.addEventListener("change", renderInventory);
statusFilter.addEventListener("change", renderInventory);

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (view === "usuarios" && !currentPermissions.manageUsers) return;

    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    button.classList.add("active");

    document.querySelectorAll(".view").forEach(section => section.classList.remove("active"));
    document.getElementById(`${view}View`).classList.add("active");

    const titles = {
      inventario: "Inventario de sanidad",
      movimientos: "Movimientos de inventario",
      alertas: "Alertas de sanidad",
      usuarios: "Administración de usuarios"
    };

    document.getElementById("pageTitle").textContent = titles[view];
    updateContextualActions(view);
    if (view === "movimientos" && currentUser) cargarMovimientos();
    if (view === "alertas") renderAlerts();
    if (view === "usuarios") cargarUsuarios();
  });
});

refreshDataBtn.addEventListener("click", async () => {
  refreshDataBtn.disabled = true;
  refreshDataBtn.textContent = "Actualizando...";
  const success = await refreshAllData();
  refreshDataBtn.disabled = false;
  refreshDataBtn.textContent = "Actualizar datos";
  showToast(success ? "Datos actualizados." : "No fue posible actualizar todos los datos.");
});

function formatRole(role) {
  return ROLE_LABELS[String(role || "").toLowerCase()] || "Consulta";
}

function updateContextualActions(view) {
  const showProductAdd = currentPermissions.addProducts && view !== "usuarios";
  const showUserAdd = currentPermissions.manageUsers && view === "usuarios";

  addItemBtn.classList.toggle("permission-hidden", !showProductAdd);
  responsiveAddAction.classList.toggle("permission-hidden", !showProductAdd);
  responsiveAddItemBtn.disabled = !showProductAdd;

  addUserBtn.classList.toggle("permission-hidden", !showUserAdd);
  responsiveUserAddAction.classList.toggle("permission-hidden", !showUserAdd);
  responsiveAddUserBtn.disabled = !showUserAdd;
  document.body.classList.toggle("responsive-action-available", showProductAdd || showUserAdd);
  queueResponsiveUiUpdate();
}

function applyPermissions() {
  const role = String(currentProfile?.rol || "").toLowerCase();
  currentPermissions = ROLE_PERMISSIONS[role] || NO_PERMISSIONS;

  const hasProductActions = currentPermissions.editProducts
    || currentPermissions.registerMovements
    || currentPermissions.adjustStock
    || currentPermissions.deactivateProducts
    || currentPermissions.deleteProducts;

  document.body.classList.toggle("role-readonly", !hasProductActions);
  usersNavItem.classList.toggle("permission-hidden", !currentPermissions.manageUsers);
  inventoryValueCard.hidden = !currentPermissions.viewInventoryValue;
  statsGrid.classList.toggle("without-value", !currentPermissions.viewInventoryValue);

  const activeView = document.querySelector(".nav-item.active")?.dataset.view || "inventario";
  updateContextualActions(activeView);
}

function renderCurrentUser() {
  currentUserName.textContent = currentProfile.nombre;
  currentUserNumber.textContent = `Colaborador ${currentProfile.numero_colaborador}`;
  currentUserRole.textContent = formatRole(currentProfile.rol);
}

function revealApplication() {
  document.body.classList.remove("app-auth-pending");
  appBootstrapStatus.classList.add("is-leaving");
  setTimeout(() => {
    appBootstrapStatus.hidden = true;
  }, 520);
  queueResponsiveUiUpdate();
}

function showFatalError(message) {
  appBootstrapStatus.textContent = message;
  appBootstrapStatus.classList.add("error");
  appBootstrapStatus.hidden = false;
}

function redirectToLogin(message = "Sesión expirada.") {
  if (authRedirecting) return;
  authRedirecting = true;
  appBootstrapStatus.textContent = message;
  appBootstrapStatus.classList.remove("error");
  appBootstrapStatus.hidden = false;
  document.body.classList.add("app-auth-pending");
  setTimeout(() => window.location.replace("/"), 350);
}

function getLogoutPhrases(name) {
  const hour = new Date().getHours();
  const timeFarewell = hour < 12
    ? `Que tengas un excelente día, ${name}`
    : hour < 19
      ? `Que tengas una excelente tarde, ${name}`
      : `Que tengas una excelente noche, ${name}`;

  return [
    `Hasta pronto, ${name}`,
    `Fue un gusto verte, ${name}`,
    timeFarewell,
    `Nos vemos pronto, ${name}`
  ];
}

function startLogoutTransition() {
  const name = currentProfile?.nombre?.trim() || "colaborador";
  const phrases = getLogoutPhrases(name);
  logoutPhrase.textContent = phrases[Math.floor(Math.random() * phrases.length)];

  logoutTransition.hidden = false;
  requestAnimationFrame(() => {
    document.body.classList.add("logout-active");
    logoutTransition.classList.add("is-visible");
  });
}

logoutBtn.addEventListener("click", async () => {
  if (logoutTransitionStarted) return;
  logoutTransitionStarted = true;
  authRedirecting = true;
  logoutBtn.disabled = true;
  logoutBtn.textContent = "Cerrando...";
  startLogoutTransition();

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const minimumDisplayTime = new Promise(resolve => {
    setTimeout(resolve, reduceMotion ? 650 : 2100);
  });

  try {
    const [{ error }] = await Promise.all([
      supabase.auth.signOut(),
      minimumDisplayTime
    ]);
    if (error) console.error("Supabase no pudo completar el cierre de sesión.", error);
  } catch (error) {
    console.error("Error de conexión al cerrar sesión.", error);
    await minimumDisplayTime;
  } finally {
    window.location.replace("/");
  }
});

supabase.auth.onAuthStateChange(event => {
  if (event === "SIGNED_OUT" && !authRedirecting) redirectToLogin("Sesión expirada.");
});

async function initializeApplication() {
  appBootstrapStatus.setAttribute("aria-label", "Verificando sesión");

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData?.user;

    if (userError || !user) {
      if (userError && userError.name !== "AuthSessionMissingError") {
        console.error("No fue posible validar la sesión.", userError);
      }
      redirectToLogin("Sesión expirada.");
      return;
    }

    currentUser = user;
    appBootstrapStatus.setAttribute("aria-label", "Validando perfil");

    const { data: profile, error: profileError } = await supabase
      .from("perfiles")
      .select("user_id,numero_colaborador,nombre,rol,activo")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("No fue posible cargar el perfil del usuario.", profileError);
      showFatalError("No fue posible validar el perfil.");
      return;
    }

    if (!profile || profile.activo !== true) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error("No fue posible cerrar la sesión del perfil inválido.", error);
      }
      redirectToLogin("Tu perfil no está activo.");
      return;
    }

    currentProfile = profile;
    renderCurrentUser();
    applyPermissions();
    await refreshAllData();
    revealApplication();
  } catch (error) {
    console.error("No fue posible iniciar la aplicación.", error);
    showFatalError("No fue posible cargar el inventario.");
  }
}

document.getElementById("currentDate").textContent = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric"
}).format(new Date());

const responsiveLayout = window.matchMedia("(max-width: 980px)");
let responsiveUiFrame;

function updateResponsiveUi() {
  responsiveUiFrame = null;

  const setActionVisibility = (action, button, visible) => {
    action.classList.toggle("is-visible", visible);
    action.setAttribute("aria-hidden", String(!visible));
    button.tabIndex = visible ? 0 : -1;
  };

  if (!responsiveLayout.matches) {
    setActionVisibility(responsiveAddAction, responsiveAddItemBtn, false);
    setActionVisibility(responsiveUserAddAction, responsiveAddUserBtn, false);
    document.documentElement.style.removeProperty("--responsive-nav-height");
    return;
  }

  const navHeight = Math.ceil(sidebar.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--responsive-nav-height", `${navHeight}px`);
  const navBottom = sidebar.getBoundingClientRect().bottom;
  const activeView = document.querySelector(".nav-item.active")?.dataset.view || "inventario";
  const isUsersView = activeView === "usuarios";
  const triggerButton = isUsersView ? addUserBtn : addItemBtn;
  const floatingAction = isUsersView ? responsiveUserAddAction : responsiveAddAction;
  const floatingButton = isUsersView ? responsiveAddUserBtn : responsiveAddItemBtn;
  const inactiveAction = isUsersView ? responsiveAddAction : responsiveUserAddAction;
  const inactiveButton = isUsersView ? responsiveAddItemBtn : responsiveAddUserBtn;
  const allowed = isUsersView
    ? currentPermissions.manageUsers
    : currentPermissions.addProducts;

  setActionVisibility(inactiveAction, inactiveButton, false);

  if (!allowed || floatingAction.classList.contains("permission-hidden")) {
    setActionVisibility(floatingAction, floatingButton, false);
    return;
  }

  const triggerBottom = triggerButton.getBoundingClientRect().bottom;
  const alreadyVisible = floatingAction.classList.contains("is-visible");
  const shouldShow = alreadyVisible
    ? triggerBottom <= navBottom + 18
    : triggerBottom <= navBottom - 2;
  setActionVisibility(floatingAction, floatingButton, shouldShow);
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
initializeApplication();
