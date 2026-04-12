import { google } from 'googleapis';
import dotenv from "dotenv";

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const EMAIL_USER = process.env.EMAIL_USER;

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

/**
 * Internal Send Function
 */
async function sendEmail(toEmail, subject, htmlContent) {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const message = [
      `From: Saltify <${EMAIL_USER}>`,
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      htmlContent
    ].join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage }
    });

    console.log('✅ Email sent:', result.data.id);
  } catch (error) {
    console.error('❌ Email error:', error);
  }
}

/**
 * 📩 Notify USER
 */
async function notifyUser(userEmail, values) {
  try {
    const [
      userId,
      cart,
      amount,
      name,
      phone,
      address,
      city,
      pincode,
      landmark,
      order_id,
      payment_id
    ] = values;

    const parsedCart = JSON.parse(cart);

    const itemsHtml = parsedCart.map(item => `
      <li>${item.name} × ${item.quantity}</li>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color:#333;">
        <h2>🌿 Thank you for your order, ${name}!</h2>

        <p>Your order has been successfully placed with <strong>Saltify</strong>.</p>

        <h3>🛒 Order Items:</h3>
        <ul>${itemsHtml}</ul>

        <h3>📦 Delivery Details:</h3>
        <p>
          ${address}, ${city} - ${pincode}<br/>
          Landmark: ${landmark}<br/>
          Phone: ${phone}
        </p>

        <h3>💳 Payment:</h3>
        <p>
          Amount: ₹${amount}<br/>
          Payment ID: ${payment_id}
        </p>

        <p>We will notify you once your order is shipped 🚚</p>

        <br/>
        <p>Best Regards,<br/>Team Saltify</p>
      </div>
    `;

    await sendEmail(userEmail, "Order Confirmed", html);

  } catch (err) {
    console.error("❌ notifyUser error:", err);
  }
}

/**
 * 📩 Notify ADMIN
 */
async function notifyAdmin(adminEmail, values) {
  try {
    const [
      userId,
      cart,
      amount,
      name,
      phone,
      address,
      city,
      pincode,
      landmark,
      order_id,
      payment_id
    ] = values;

    const parsedCart = JSON.parse(cart);

    const itemsHtml = parsedCart.map(item => `
      <li>${item.name} × ${item.quantity}</li>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; color:#333;">
        <h2>🚨 New Order Received</h2>

        <p><strong>User ID:</strong> ${userId}</p>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${adminEmail}</p>

        <h3>🛒 Items:</h3>
        <ul>${itemsHtml}</ul>

        <h3>💰 Amount:</h3>
        <p>₹${amount}</p>

        <h3>📦 Address:</h3>
        <p>
          ${address}, ${city} - ${pincode}<br/>
          Landmark: ${landmark}<br/>
          Phone: ${phone}
        </p>

        <h3>💳 Payment Info:</h3>
        <p>
          Order ID: ${order_id}<br/>
          Payment ID: ${payment_id}
        </p>
      </div>
    `;

    await sendEmail(adminEmail, "New Order Alert", html);

  } catch (err) {
    console.error("❌ notifyAdmin error:", err);
  }
}
export { notifyUser, notifyAdmin };