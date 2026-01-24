import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export async function sendOrderConfirmationEmail(order) {
  const mailOptions = {
    from: `"GT Mall" <${process.env.EMAIL_USER}>`,
    to: order.userEmail,
    subject: "🛒 Order Confirmed - GT Mall",
    html: `
      <h2>Thank you for your order!</h2>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Total Amount:</strong> ₹${order.amount}</p>
      <p><strong>Status:</strong> ${order.status}</p>
      <hr/>
      <h4>Delivery Address</h4>
      <p>
        ${order.address.name}<br/>
        ${order.address.address}<br/>
        ${order.address.city}, ${order.address.state} - ${order.address.pin}<br/>
        Mobile: ${order.address.mobile}
      </p>
      <p>We will notify you once your order is shipped.</p>
      <br/>
      <p>– Team GT Mall</p>
    `
  };

  await transporter.sendMail(mailOptions);
}
