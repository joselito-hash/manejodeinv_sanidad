// Carga bajo demanda: el inventario funciona aunque el CDN del PDF no responda.
let pdfLibrary;
export async function createRequisitionPdf(requisition) {
  pdfLibrary ||= import("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm").catch(error => { pdfLibrary = null; throw error; });
  const { PDFDocument, StandardFonts, rgb } = await pdfLibrary;
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const blue = rgb(0.286, 0.412, 0.49), ink = rgb(0.153, 0.2, 0.231), muted = rgb(0.39, 0.44, 0.47);
  const folio = `REQ-${requisition.id.slice(0, 8).toUpperCase()}`;
  const money = value => value === null ? "Pendiente" : new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
  const formatDate = value => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  // Helvetica cubre el alfabeto español. Reemplazar glifos fuera de WinAnsi evita
  // que un emoji en un motivo impida descargar el documento completo.
  const safe = value => Array.from(String(value ?? "").replace(/\s+/g, " ")).map(char => {
    try { regular.encodeText(char); return char; } catch { return "?"; }
  }).join("");
  let page, y;
  let section = "intro";
  const pages = [];
  function newPage() {
    page = doc.addPage([612, 792]); pages.push(page); y = 692;
    page.drawRectangle({ x: 0, y: 724, width: 612, height: 68, color: rgb(0.957, 0.941, 0.91) });
    page.drawText("BIMBO / SANIDAD", { x: 40, y: 753, size: 11, font: bold, color: blue });
    page.drawText(`${folio}  |  Revisión ${requisition.revision}`, { x: 340, y: 753, size: 10, font: bold, color: blue });
    page.drawText("CEDIS Diamante - Acapulco, Guerrero", { x: 40, y: 735, size: 9, font: regular, color: muted });
    if (section === "history") {
      page.drawText("Historial de revisiones (continuación)", { x:40, y, size:12, font:bold, color:blue });
      y -= 28;
    }
  }
  function ensure(height) { if (y - height < 58) newPage(); }
  function wrap(value, width, font = regular, size = 10) {
    const result = []; let line = "";
    for (const word of safe(value).split(" ")) {
      if (font.widthOfTextAtSize(`${line}${line ? " " : ""}${word}`, size) <= width) { line += `${line ? " " : ""}${word}`; continue; }
      if (line) result.push(line); line = "";
      for (const char of word) {
        if (font.widthOfTextAtSize(line + char, size) > width) { result.push(line); line = ""; }
        line += char;
      }
    }
    if (line) result.push(line);
    return result.length ? result : [""];
  }
  function paragraph(value, { size = 10, font = regular, color = ink, gap = 8 } = {}) {
    for (const line of wrap(value, 532, font, size)) {
      ensure(size + 5); page.drawText(line, { x: 40, y, size, font, color }); y -= size + 5;
    }
    y -= gap;
  }
  function tableHeader() {
    ensure(30);
    page.drawRectangle({ x: 40, y: y - 8, width: 532, height: 24, color: blue });
    [["Insumo / código",48],["Cantidad",321],["Precio MXN",395],["Importe MXN",486]].forEach(([text,x]) =>
      page.drawText(text, { x, y, size: 9, font: bold, color: rgb(1,1,1) }));
    y -= 28;
  }
  newPage();
  paragraph("Requisición de insumos", { size: 22, font: bold, color: blue });
  paragraph(requisition.estado === "aprobada" ? "APROBADA" : "BORRADOR - PENDIENTE DE AUTORIZACIÓN", { font: bold });
  paragraph(`Solicitante: ${requisition.solicitante_nombre} | Colaborador ${requisition.numero_colaborador}`);
  paragraph(`Solicitud: ${formatDate(requisition.created_at)} | Revisión: ${formatDate(requisition.updated_at)}`);
  paragraph(`Motivo: ${requisition.motivo}`);
  tableHeader();
  for (const item of requisition.items) {
    const nameLines = wrap(item.nombre, 252, bold);
    const codeLines = wrap(item.codigo, 252, regular, 9);
    const qtyLines = wrap(`${item.cantidad} ${item.unidad}`, 68, regular, 9);
    const priceLines = wrap(money(item.precio_unitario), 82, regular, 9);
    const amountLines = wrap(money(item.precio_unitario === null ? null : Number(item.precio_unitario) * Number(item.cantidad)), 82, regular, 9);
    const height = Math.max((nameLines.length + codeLines.length) * 14, qtyLines.length * 14, priceLines.length * 14, amountLines.length * 14) + 16;
    if (y - height - 7 < 64) { newPage(); tableHeader(); }
    y -= 7;
    nameLines.forEach((line,i) => page.drawText(line, { x:48, y:y-i*14, size:10, font:bold, color:ink }));
    codeLines.forEach((line,i) => page.drawText(line, { x:48, y:y-(nameLines.length+i)*14, size:9, font:regular, color:muted }));
    [[qtyLines,321],[priceLines,395],[amountLines,486]].forEach(([lines,x]) => lines.forEach((line,i) =>
      page.drawText(line, { x, y:y-i*14, size:9, font:regular, color:ink })));
    y -= height;
    page.drawLine({ start:{x:40,y:y+8}, end:{x:572,y:y+8}, thickness:0.5, color:rgb(0.87,0.85,0.8) });
  }
  y -= 8;
  paragraph(`TOTAL ESTIMADO MXN: ${money(requisition.total)}`, { size:14, font:bold, color:blue });
  if (requisition.total === null) paragraph("Total incompleto: hay precios por asignar o insumos inactivos.");
  if (requisition.estado === "aprobada") paragraph(`Autorizó: ${requisition.aprobador_nombre} | ${formatDate(requisition.aprobada_at)}`, { font:bold });
  paragraph("Documento interno de requisición. No acredita recepción de mercancía ni modifica las existencias.", { size:9, color:muted });
  const history = [...(requisition.historial || [])].sort((a,b) => a.revision-b.revision);
  if (history.length) { ensure(52); paragraph("Historial de revisiones", { size:14, font:bold, color:blue }); }
  section = "history";
  for (const entry of history) {
    ensure(48);
    paragraph(`Revisión ${entry.revision} - ${entry.actor_nombre} - ${formatDate(entry.created_at)}`, { font:bold });
    paragraph(entry.motivo);
    for (const change of entry.cambios || []) paragraph(`${change.nombre}: ${change.antes} -> ${change.despues} ${change.unidad}`, { size:9, gap:3 });
  }
  pages.forEach((p,index) => {
    p.drawText(`${folio} / R${requisition.revision}`, { x:40,y:30,size:8,font:regular,color:muted });
    p.drawText(`Página ${index+1} de ${pages.length}`, { x:480,y:30,size:8,font:regular,color:muted });
  });
  doc.setTitle(`${folio} - Requisición de insumos`);
  doc.setAuthor("Inventario de Sanidad");
  return doc.save();
}

export async function downloadRequisitionPdf(requisition) {
  const bytes = await createRequisitionPdf(requisition);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `requisicion-${requisition.id.slice(0,8)}-r${requisition.revision}.pdf`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
