import { google } from "googleapis";
import readline from "readline";

// 🔴 PUT YOUR VALUES HERE
const CLIENT_ID = "";
const CLIENT_SECRET = "";
const REDIRECT_URI = "http://localhost:3000"; // must match console

const oAuth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);
http://localhost:3000/?iss=https://accounts.google.com&code=4/0Aci98E_jqmM0MedNhc7tGlh1xiVlcDfBaD0x_O8iwvOWNLVRPn6oKUDYgCk6UyVI4wPkOQ&scope=https://www.googleapis.com/auth/gmail.send
// Step 1: Generate auth URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/gmail.send"],
});

console.log("\n👉 Open this URL in browser:\n");
console.log(authUrl);

// Step 2: Take code input from terminal
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("\nEnter the code from browser: ", async (code) => {
  try {
    const { tokens } = await oAuth2Client.getToken(code);

    console.log("\n✅ TOKENS:\n");
    console.log(tokens);

    console.log("\n🔥 SAVE THIS REFRESH TOKEN:\n");
    console.log(tokens.refresh_token);

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
  rl.close();
});