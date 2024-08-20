const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();
const dns = require("dns");
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND);

const sendVerificationEmail = async (email) => {
  try {
    await resend.emails.send({
      from: "2Advanced Studios, LLC <onboarding@resend.dev>",
      to: [email],
      subject: "Verify your email",
      html:
        '<p>Please verify your email by clicking the link below:</p><a href="'+process.env.APP_URL+'/verify?email=' +
        email +
        '">Verify Email</a>',
    });
    console.log("Verification email sent to:", email);
  } catch (err) {
    console.error("Error sending verification email:", err);
  }
};

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});
app.post("/emails", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO emails (email, verified) VALUES ($1, $2) RETURNING *",
      [email, false]
    );
    await sendVerificationEmail(email);
    console.log(result.rows);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

app.post("/emails/resend", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query("SELECT * FROM emails WHERE email = $1", [
      email,
    ]);
    if (result.rows.length > 0) {
      await sendVerificationEmail(email);
      res.json({ message: `Verification email resent to ${email}.` });
    } else {
      res.status(404).json({ message: `Email ${email} not found.` });
    }
  } catch (err) {
    console.error("Error resending verification email:", err.message);
    res.status(500).send("Server Error");
  }
});

app.get("/emails", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM emails");
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
app.get("/emails/:email", async (req, res) => {
  const { email } = req.params;
  try {
    console.log(email);
    const result = await pool.query("SELECT * FROM emails WHERE email = $1", [
      email,
    ]);
    if (result.rows.length > 0) {
      return res.json({ exists: true, user: result.rows[0] });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server Error");
  }
});
app.delete("/emails/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM emails WHERE email = $1 RETURNING *",
      [email]
    );
    console.log(result.rowCount);
    if (result.rowCount > 0) {
      res.json({ message: `Email ${email} has been successfully deleted.` });
    } else {
      res.status(404).json({ message: `Email ${email} not found.` });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});
app.post("/verify", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query(
      "UPDATE emails SET verified = true WHERE email = $1 RETURNING *",
      [email]
    );
    if (result.rowCount > 0) {
      res.json({ message: "Email verified successfully." });
    } else {
      res.status(404).json({ message: "Email not found." });
    }
  } catch (err) {
    console.error("Error verifying email:", err.message);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
