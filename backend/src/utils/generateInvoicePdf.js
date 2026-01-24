import PDFDocument from "pdfkit";

export function generateInvoicePdf(order, res) {
  const doc = new PDFDocument({ margin: 40 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename=invoice-${order._id}.pdf`
  );

  doc.pipe(res);

  // -------- Header --------
  doc
    .fontSize(20)
    .text("GT Mall", { align: "center" })
    .moveDown(0.5);

  doc
    .fontSize(12)
    .text("Order Invoice / Shipping Label", { align: "center" })
    .moveDown(1.5);

  // -------- Order Info --------
  doc.fontSize(10);
  doc.text(`Order ID: ${order._id}`);
  doc.text(`Payment ID: ${order.paymentId}`);
  doc.text(`Order Date: ${new Date(order.createdAt).toLocaleString()}`);
  doc.text(`Status: ${order.status}`);
  doc.moveDown();

  // -------- Address --------
  doc.fontSize(12).text("Shipping Address", { underline: true });
  doc.moveDown(0.3);

  doc.fontSize(10);
  doc.text(order.address.name);
  doc.text(order.address.address);
  doc.text(
    `${order.address.city}, ${order.address.state} - ${order.address.pin}`
  );
  doc.text(`Mobile: ${order.address.mobile}`);
  doc.moveDown();

  // -------- Items --------
  doc.fontSize(12).text("Order Items", { underline: true });
  doc.moveDown(0.5);

  order.items.forEach((item, i) => {
    doc
      .fontSize(10)
      .text(
        `${i + 1}. ${item.name} × ${item.quantity}  —  ₹${item.price * item.quantity}`
      );
  });

  doc.moveDown();

  // -------- Total --------
  doc
    .fontSize(12)
    .text(`Total Amount: ₹${order.amount}`, { align: "right" });

  doc.moveDown(2);

  // -------- Footer --------
  doc
    .fontSize(9)
    .text(
      "This is a system generated invoice. No signature required.",
      { align: "center" }
    );

  doc.end();
}
