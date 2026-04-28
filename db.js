// import pkg from "pg";
// import dotenv from "dotenv";



// dotenv.config();
// const { Pool } = pkg;

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false,
//   },
//   connectionTimeoutMillis: 5000, // 5 seconds timeout
// });

// export default pool;
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: {
    rejectUnauthorized: false,
  },

  connectionTimeoutMillis: 10000, // ✅ increase to 10 sec

  idleTimeoutMillis: 30000, // close idle clients after 30 sec

  max: 5, // ✅ limit connections (important for Neon/Supabase)

  keepAlive: true, // ✅ prevents sudden connection drops
});

// Optional: debug logs (VERY useful)
pool.on("connect", () => {
  console.log("✅ Connected to DB");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected DB error", err);
});

export default pool;