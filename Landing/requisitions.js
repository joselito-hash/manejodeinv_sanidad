import { downloadRequisitionPdf } from "./requisitionPdf.js";

const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const money = value => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
const number = value => Number(value || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 });
const date = value => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const folio = id => `REQ-${String(id).slice(0, 8).toUpperCase()}`;

export function createRequisitionsUI({ supabase, getInventory, getProfile, showToast, openProduct, onChange, onLoad }) {
  const list = document.getElementById("requisitionsList");
  const dialog = document.createElement("dialog");
  dialog.className = "requisition-dialog";
  dialog.setAttribute("aria-labelledby", "requisitionTitle");
  document.body.append(dialog);
  let records = [];
  let current = null;
  let mode = "detail";
  let quantities = new Map();
  let requestId;
  let busy = false;
  let stale = false;
  let loadVersion = 0;
  let opener = null;
  const isAdmin = () => getProfile()?.rol === "administrador";
  const canRequest = () => ["administrador", "sanidad", "supervisor"].includes(getProfile()?.rol);
  const errorMessage = error => {
    const text = String(error?.message || "");
    const messages = {
      revision_desactualizada: "Otro administrador modificó esta solicitud. Cierra y vuelve a abrirla para revisar los cambios.",
      total_desactualizado: "El precio cambió mientras revisabas la solicitud. Revisa el nuevo total antes de aprobar.",
      precios_pendientes: "Asigna todos los precios y retira los insumos inactivos antes de aprobar.",
      requisicion_ya_aprobada: "Esta requisición ya fue aprobada.",
      producto_no_disponible: "Uno de los insumos ya no está disponible. Revisa la selección.",
      sin_cambios: "Modifica al menos una cantidad para guardar una nueva revisión.",
      usuario_no_autorizado: "Tu perfil no tiene permiso para realizar esta acción."
    };
    return Object.entries(messages).find(([key]) => text.includes(key))?.[1]
      || "No fue posible completar la operación. Tus cantidades siguen en el formulario; puedes reintentar.";
  };
  async function rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw error;
    return data;
  }
  function status(message = "", error = false) {
    const element = dialog.querySelector(".requisition-status");
    if (element) { element.textContent = message; element.classList.toggle("error", error); }
  }
  function setBusy(value) {
    busy = value;
    dialog.querySelectorAll("button, input, textarea").forEach(el => {
      el.disabled = value || el.dataset.locked === "true";
    });
  }
  function header(title, subtitle = "") {
    return `<header class="requisition-header"><div><p class="eyebrow">ABASTECIMIENTO</p>
      <h2 id="requisitionTitle">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ""}</div>
      <button class="icon-btn" type="button" data-action="close" aria-label="Cerrar requisición">×</button></header>`;
  }
  function show() {
    if (!dialog.open) { opener = document.activeElement; dialog.showModal(); }
    document.body.classList.add("requisition-open");
  }
  function close() {
    if (busy) return;
    dialog.close();
    document.body.classList.remove("requisition-open");
    opener?.focus?.({ preventScroll: true });
  }
  function renderList() {
    list.innerHTML = records.length ? records.map(r => `<button class="requisition-list-item" data-requisition="${esc(r.id)}" type="button">
      <span class="requisition-list-copy"><strong>${folio(r.id)}</strong><span>${esc(r.solicitante_nombre)} · ${date(r.created_at)}</span>
      <small>${r.items.length} insumos · Revisión ${r.revision}</small></span>
      <span class="requisition-list-end"><span class="badge ${r.estado === "aprobada" ? "ok" : "low"}">${r.estado === "aprobada" ? "Aprobada" : "Por revisar"}</span>
      ${isAdmin() ? `<strong>${r.total === null ? "Precio pendiente" : money(r.total)}</strong>` : ""}<span class="text-btn">Ver solicitud →</span></span></button>`).join("")
      : '<div class="empty-state">Aún no hay requisiciones. Puedes solicitar insumos desde Alertas.</div>';
  }
  async function load() {
    const version = ++loadVersion;
    try {
      const next = await rpc("listar_requisiciones");
      if (version !== loadVersion) return true;
      records = next || [];
      renderList();
      onLoad?.();
      if (dialog.open && current && !busy) {
        const updated = records.find(r => r.id === current.id);
        if (updated && mode === "detail") { current = updated; renderDetail(); }
        else if (updated && updated.revision !== current.revision) {
          stale = true;
          status("Hay una nueva revisión. Cierra y vuelve a abrir la solicitud para editar la versión actual.", true);
        }
      }
      return true;
    } catch (error) {
      console.error("No fue posible consultar requisiciones.", error);
      if (!records.length) list.innerHTML = '<div class="empty-state error">No fue posible cargar las requisiciones.</div>';
      return false;
    }
  }
  function selectedItems() {
    return [...quantities.entries()].filter(([, amount]) => Number(amount) > 0)
      .map(([id, amount]) => ({ producto_id: id, cantidad: Number(amount) }));
  }
  function updateSelection() {
    const selected = selectedItems();
    dialog.querySelector("#requisitionSelection").textContent = `${selected.length} insumos seleccionados`;
    // No sumar litros, piezas y kilos entre sí. Mostrar solo número de insumos.
    dialog.querySelectorAll("[data-quantity]").forEach(el => el.closest(".requisition-product").classList.toggle("selected", Number(el.value) > 0));
  }
  function catalog() {
    const rank = item => Number(item.stock) <= 0 ? 0 : Number(item.stock) <= Number(item.minStock) ? 1 : 2;
    const items = [...getInventory()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "es"));
    let previousRank = -1;
    return items.map(item => {
      const order = rank(item);
      const heading = order !== previousRank ? `<h3 class="requisition-group">${["01 · Agotados", "02 · Stock bajo", "03 · Otros insumos"][order]}</h3>` : "";
      previousRank = order;
      return `${heading}<label class="requisition-product" data-search="${esc(`${item.name} ${item.code}`.toLowerCase())}">
        <span><strong>${esc(item.name)}</strong><small>${esc(item.code)} · ${number(item.stock)} ${esc(item.unit)} disponibles</small>
        <small>Mínimo: ${number(item.minStock)} ${esc(item.unit)}</small></span>
        <span class="requisition-quantity"><span>Solicitar (${esc(item.unit)})</span>
        <input type="number" inputmode="decimal" min="0" max="1000000" step="0.01" data-quantity="${esc(item.id)}"
          value="${esc(quantities.get(String(item.id)) || "")}" placeholder="0" aria-label="Cantidad de ${esc(item.name)}" /></span></label>`;
    }).join("");
  }
  function renderEditor() {
    const modifying = mode === "edit";
    dialog.innerHTML = header(modifying ? `Modificar ${folio(current.id)}` : "Solicitar requisición",
      modifying ? "Ajusta las cantidades; usa 0 para retirar un insumo. Se notificará cada cambio al solicitante."
        : "Primero lo urgente. Selecciona cuánto necesitas de cada insumo.") +
      `<form id="requisitionForm" class="requisition-form">
        <label class="requisition-search">Buscar insumo<input type="search" id="requisitionSearch" placeholder="Nombre o código" /></label>
        <div class="requisition-catalog">${catalog() || '<p class="empty-state">No hay insumos activos disponibles.</p>'}</div>
        <label class="requisition-reason">${modifying ? "Motivo de los cambios" : "¿Para qué se necesitan los insumos?"}
          <textarea id="requisitionReason" required minlength="3" maxlength="1000" rows="2"
            placeholder="${modifying ? "Explica los cambios al solicitante" : "Ej. Reposición para la limpieza semanal"}"></textarea></label>
        <p class="requisition-status" role="status"></p>
        <footer class="requisition-actions"><span id="requisitionSelection"></span><div>
          <button class="secondary-btn" type="button" data-action="${modifying ? "detail" : "close"}">Cancelar</button>
          <button class="primary-btn" type="submit">${modifying ? "Guardar cambios y PDF" : "Enviar solicitud"}</button></div></footer>
      </form>`;
    updateSelection();
  }
  function openNew() {
    if (!canRequest()) return;
    mode = "create"; current = null; stale = false;
    quantities = new Map(); requestId = crypto.randomUUID();
    renderEditor(); show();
  }
  async function openDetail(id) {
    if (busy) return;
    try {
      current = await rpc("obtener_requisicion", { p_id: id });
      mode = "detail"; stale = false;
      renderDetail(); show();
    } catch (error) { console.error(error); showToast("No fue posible abrir la requisición."); }
  }
  function renderDetail() {
    const r = current;
    const editable = isAdmin() && r.estado === "pendiente";
    const hasPrices = isAdmin() && r.total !== null;
    dialog.innerHTML = header(folio(r.id), `${r.solicitante_nombre} · Colaborador ${r.numero_colaborador}`) +
      `<div class="requisition-detail"><div class="requisition-meta"><span class="badge ${r.estado === "aprobada" ? "ok" : "low"}">
        ${r.estado === "aprobada" ? "Aprobada" : "Pendiente de autorización"}</span><span>Revisión ${r.revision} · ${date(r.updated_at)}</span></div>
        <p class="requisition-purpose">${esc(r.motivo)}</p>
        <div class="requisition-lines">${r.items.map(item => `<article class="requisition-detail-line"><div><strong>${esc(item.nombre)}</strong>
          <small>${esc(item.codigo)}${item.activo === false ? " · Insumo inactivo" : ""}</small>
          ${editable && item.precio_pendiente ? `<button class="price-pending-tag" data-action="price" data-product="${item.producto_id}" type="button">Asignar precio antes de aprobar</button>` : ""}</div>
          <div><strong>${number(item.cantidad)} ${esc(item.unidad)}</strong>
          ${isAdmin() ? `<small>${item.precio_unitario === null ? "Precio pendiente" : `${money(item.precio_unitario)} c/u`}</small>
            <span>${item.precio_unitario === null ? "—" : money(item.cantidad * item.precio_unitario)}</span>` : ""}</div></article>`).join("")}</div>
        ${isAdmin() ? `<div class="requisition-total"><span>Total estimado · MXN</span><strong>${hasPrices ? money(r.total) : "Por calcular"}</strong>
          ${!hasPrices ? '<small>Faltan precios o hay insumos inactivos. Completa la revisión antes de aprobar.</small>' : ""}</div>` : ""}
        ${r.estado === "aprobada" ? `<p class="requisition-approval">Autorizó ${esc(r.aprobador_nombre)} · ${date(r.aprobada_at)}.<br>La aprobación no modifica existencias; registra la entrada cuando recibas los insumos.</p>` : ""}
        <details class="requisition-history"><summary>Historial de la solicitud</summary>
          ${(r.historial || []).map(h => `<article><strong>Revisión ${h.revision} · ${esc(h.actor_nombre)}</strong><small>${date(h.created_at)}</small>
          <p>${esc(h.motivo)}</p>${(h.cambios || []).map(c => `<p>${esc(c.nombre)}: ${number(c.antes)} → ${number(c.despues)} ${esc(c.unidad)}</p>`).join("")}</article>`).join("")}</details>
        <p class="requisition-status" role="status"></p>
        <footer class="requisition-actions"><button class="secondary-btn" type="button" data-action="close">Cerrar</button><div>
          ${isAdmin() ? '<button class="secondary-btn" type="button" data-action="pdf">Descargar PDF</button>' : ""}
          ${editable ? `<button class="secondary-btn" type="button" data-action="edit">Modificar</button>
            <button class="primary-btn" type="button" data-action="approve" ${!hasPrices ? 'disabled data-locked="true"' : ""}>Aprobar y descargar PDF</button>` : ""}</div></footer></div>`;
  }
  async function pdf() {
    try { await downloadRequisitionPdf(current); }
    catch (error) {
      console.error("No fue posible generar el PDF.", error);
      status("La requisición está guardada. No se pudo descargar el PDF; usa Descargar PDF para reintentar.", true);
    }
  }
  async function saveEditor() {
    if (busy || stale) { if (stale) status("Abre la revisión actual antes de guardar.", true); return; }
    const form = dialog.querySelector("form");
    if (!form.reportValidity()) return;
    const reason = dialog.querySelector("#requisitionReason").value.trim();
    const items = selectedItems();
    if (!items.length || items.length > 100) { status("Selecciona entre 1 y 100 insumos.", true); return; }
    if (reason.length < 3) { status("Describe el motivo de la solicitud o de los cambios.", true); return; }
    const modifying = mode === "edit";
    setBusy(true); status(modifying ? "Guardando revisión…" : "Enviando solicitud…");
    try {
      current = modifying ? await rpc("revisar_requisicion", { p_id: current.id, p_revision: current.revision,
        p_accion: "modificar", p_items: items, p_motivo: reason })
        : await rpc("crear_requisicion", { p_id: requestId, p_motivo: reason, p_items: items });
      mode = "detail";
      renderDetail(); setBusy(true);
      showToast(modifying ? "Cambios guardados. El solicitante recibirá el detalle." : "Solicitud enviada a administración.");
      if (modifying) await pdf();
      await Promise.all([load(), onChange()]);
    } catch (error) { console.error(error); status(errorMessage(error), true); }
    finally { setBusy(false); }
  }
  async function approve() {
    if (busy || !isAdmin() || !current || current.estado !== "pendiente") return;
    setBusy(true); status("Autorizando requisición…");
    try {
      current = await rpc("revisar_requisicion", { p_id: current.id, p_revision: current.revision,
        p_accion: "aprobar", p_total_esperado: current.total });
      renderDetail(); setBusy(true);
      showToast("Requisición aprobada. Se notificó al solicitante.");
      await pdf();
      await Promise.all([load(), onChange()]);
    } catch (error) {
      console.error(error); status(errorMessage(error), true);
      // Una respuesta perdida no vuelve a aprobar; la versión se verifica en SQL.
    } finally { setBusy(false); }
  }
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-requisition]");
    if (button) openDetail(button.dataset.requisition);
  });
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("click", event => {
    if (busy) return;
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "close") close();
    if (action === "detail") { mode = "detail"; renderDetail(); }
    if (action === "edit" && isAdmin() && current.estado === "pendiente") {
      mode = "edit"; quantities = new Map(current.items.map(item => [String(item.producto_id), item.cantidad])); renderEditor();
    }
    if (action === "approve") approve();
    if (action === "pdf" && isAdmin()) { setBusy(true); pdf().finally(() => setBusy(false)); }
    if (action === "price" && isAdmin()) {
      const item = getInventory().find(product => String(product.id) === button.dataset.product);
      close();
      if (item) openProduct(item);
      else showToast("Este insumo ya no está disponible.");
    }
  });
  dialog.addEventListener("input", event => {
    if (event.target.matches("[data-quantity]")) {
      quantities.set(event.target.dataset.quantity, event.target.value);
      updateSelection();
    }
    if (event.target.id === "requisitionSearch") {
      const query = event.target.value.trim().toLowerCase();
      dialog.querySelectorAll(".requisition-product").forEach(row => { row.hidden = !row.dataset.search.includes(query); });
      dialog.querySelectorAll(".requisition-group").forEach(heading => { heading.hidden = Boolean(query); });
    }
  });
  dialog.addEventListener("submit", event => { event.preventDefault(); saveEditor(); });
  return { load, openNew, openDetail, getSummary: id => records.find(r => r.id === id) };
}
