import express from "express";
import cors from "cors";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
import pool from "./db.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import { notifyUser, notifyAdmin }   from "./emailService.js";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
console.log("DB URL:", process.env.DATABASE_URL);
const client = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});




app.post("/api/auth/google", async (req, res) => {
  try {
    const { token } = req.body;

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.VITE_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const google_id = payload.sub;

    // 🔍 Check if user exists
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE google_id = $1",
      [google_id]
    );
    console.log("Existing user query result:", existingUser.rows);

    if (existingUser.rows.length > 0) {
      return res.json({
        success: true,
        user: existingUser.rows[0],
        message: "User already exists",
      });
    }

    // 🆕 Insert new user
    console.log("Creating new user with data:", payload);
    const newUser = await pool.query(
      `INSERT INTO users (google_id, email, name, picture)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [payload.sub, payload.email, payload.name, payload.picture]
    );

    res.json({
      success: true,
      user: newUser.rows[0],
      message: "New user created",
    });

  } catch (error) {
    console.error(error);
    res.status(401).json({ error: "Invalid token" });
  }
});


// add to cart api
app.post('/api/cart/add', async (req, res) => {
    console.log("Add to cart request body: ", req.body)
  try {
    const { userId, productId, quantity } = req.body

    if (!userId || !productId) {
      return res.status(400).json({ message: 'Missing data' })
    }

    // 🔍 check if already exists
    const existing = await pool.query(
      'SELECT * FROM cart WHERE user_id=$1 AND product_id=$2',
      [userId, productId]
    )

    if (existing.rows.length > 0) {
      // 🔁 update quantity
      await pool.query(
        'UPDATE cart SET quantity = quantity + $1 WHERE user_id=$2 AND product_id=$3',
        [quantity || 1, userId, productId]
      )
    } else {
      // ➕ insert new
      await pool.query(
        'INSERT INTO cart (user_id, product_id, quantity) VALUES ($1,$2,$3)',
        [userId, productId, quantity || 1]
      )
    }

    res.json({ success: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Add to cart failed' })
  }
})

// remove from cart api

app.post('/api/cart/remove', async (req, res) => {
    console.log("Remove from cart request body: ", req.body)
  try {
    const { userId, productId } = req.body

    await pool.query(
      'DELETE FROM cart WHERE user_id=$1 AND product_id=$2',
      [userId, productId]
    )

    res.json({ success: true })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Remove failed' })
  }
})

app.get('/api/cart/:userId', async (req, res) => {
    console.log("Fetch cart for user:", req.params.userId)
  try {
    const { userId } = req.params

    const result = await pool.query(`
        SELECT
        cart.product_id AS id,
        cart.quantity AS quantity,
        products.name AS name,
        products.price AS price,
        products.image AS image
        FROM cart
        JOIN products ON cart.product_id = products.id
        WHERE cart.user_id = $1;

    `, [userId])

    res.json({ success: true, cart: result.rows })


  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Fetch cart failed' })
  }
})


app.post('/api/user/address', async (req, res) => {
  try {
    const { userId, phone, email, address, city, pincode, landmark, fullName } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID required' });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ message: 'Valid email is required' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET phone=$1, email=$2, address=$3, city=$4, pincode=$5, landmark=$6, name=$7
       WHERE google_id=$8
       RETURNING *`,
      [phone, String(email).trim().toLowerCase(), address, city, pincode, landmark, fullName, userId]
    );

    res.json({ success: true, user: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to save address' });
  }
});


app.get('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(
      'SELECT * FROM users WHERE google_id=$1',
      [userId]
    );

    res.json({ success: true, user: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Fetch user failed' });
  }
});



app.post('/api/create-order', async (req, res) => {
  try {
    // actually the front end should send the product id in the cart then the price will be decide by us 
    const { cart, currency = "INR", userId } = req.body;

    let amount = 0;
    for (const item of cart) {
      const productResult = await pool.query(
        'SELECT price FROM products WHERE id=$1',
        [item.id]
      );
      amount += productResult.rows[0].price * item.quantity;
    }

    const options = {
      amount: amount * 100, // 💥 Razorpay works in paise
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Order creation failed" });
  }
});




app.post('/api/verify-payment', async (req, res) => {
  console.log("Verify payment request body: ", req.body)
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      userId,
      cart
    } = req.body

    // =========================
    // ✅ STEP 1: VERIFY SIGNATURE
    // =========================
    const body = razorpay_order_id + "|" + razorpay_payment_id

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex")

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" })
    }

    // =========================
    // ✅ STEP 2: CALCULATE TOTAL FROM DB (SECURE)
    // =========================
    const productIds = cart.map(item => item.id)

    const productResult = await pool.query(
      `SELECT id, price FROM products WHERE id = ANY($1)`,
      [productIds]
    )

    const priceMap = {}
    productResult.rows.forEach(p => {
      priceMap[p.id] = Number(p.price)
    })

    let amount = 0

    for (const item of cart) {
      const price = priceMap[item.id]

      if (!price) {
        return res.status(400).json({ message: "Invalid product in cart" })
      }

      amount += price * item.quantity
    }

    // =========================
    // ✅ STEP 3: GET USER DETAILS FROM DB
    // =========================
    const userResult = await pool.query(
      `SELECT name, email, phone, address, city, pincode, landmark
       FROM users
       WHERE google_id = $1 OR email = $1
       LIMIT 1`,
      [userId]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" })
    }

    const user = userResult.rows[0]

    // =========================
    // ✅ STEP 4: SAVE ORDER
    // =========================
    const insertQuery = `
      INSERT INTO orders (
        user_id,
        items,
        total_amount,
        full_name,
        phone,
        address,
        city,
        pincode,
        landmark,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_status,
        order_status,
        email
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PAID','PLACED',$13
      )
      RETURNING *;
    `

    let values = [
      userId,
      JSON.stringify(cart),
      amount, // ✅ calculated securely
      user.name,
      user.phone,
      user.address,
      user.city,
      user.pincode,
      user.landmark,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user.email
    ]

    const orderResult = await pool.query(insertQuery, values)

    // =========================
    // ✅ STEP 5: CLEAR CART (IMPORTANT)
    // =========================
    await pool.query(
      `DELETE FROM cart WHERE user_id = $1`,
      [userId]
    )
    // =========================
    // ✅ email notification to admin and user
    // =========================

    await notifyUser(user.email, values);
    await notifyAdmin("saltify.in@gmail.com", values);

    // =========================
    // ✅ FINAL RESPONSE
    // =========================
    return res.json({
      success: true,
      orderId: orderResult.rows[0].id
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Verification failed" })
  }
})


app.get("/", (req, res) => {
  res.send("Hello from Saltify Back!");
});




app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

app.listen(5000, () => console.log("Server running"));
