import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import env from "dotenv";



const app = express();
const port = 3000;
const saltRounds = 10;
env.config();
let otp = undefined;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = new pg.Client({
  host: process.env.PG_HOST,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  port: process.env.PG_PORT,
});

db.connect();


// setting up nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "anuj2002kumar@gmail.com",
    pass: "mcxgkrajpnpivfwu",
  },
});




app.get("/", (req, res) => {
  res.render("index.ejs");
});

app.get("/home", (req, res) => {
  res.render("index.ejs");
});





//route for login.ejs
app.get("/login", (req, res) => {
  res.render("login.ejs", { message: "freshLogin" });
});

app.get("/notRegistedRedirect", (req, res) => {
  res.render("login.ejs", { message: "User not found." });
});
app.get("/invalidUserPassRedirect", (req, res) => {
  res.render("login.ejs", { message: "Invalid email or password. Try again" });
});






// routes for register.ejs
app.get("/register", (req, res) => {
  res.render("register.ejs", {
    message: "",
    disabled: true,
  });
});

app.get("/alreadyRegisteredRedirect", (req, res) => {
  res.render("register.ejs", {
    message: "User already registered.",
    disabled: true,
  });
});


// verification routes
app.post("/verifyLogIn", (req, res) => {
  console.log(req.body);
  const { email, password } = req.body;
  try {
    db.query("SELECT * FROM users WHERE email = $1", [email], (err, result) => {
      if (result.rows.length > 0) {
        bcrypt.compare(password, result.rows[0].password, (err, response) => {
          if (response) {
            res.redirect("/home");
          } else {
            res.redirect("/invalidUserPassRedirect");
          }
        });
      } else {
        res.redirect("/notRegistedRedirect");
      }
    });
  } catch (err) {
    console.log(err);
  }
});

app.post("/verifyRegisterUser", async (req, res) => {
  console.log(req.body);
  const { email, password, firstDigit, secondDigit, thirdDigit, fourthDigit } =
    req.body;

  const otpEntered = firstDigit + secondDigit + thirdDigit + fourthDigit;
  console.log("Otp entered", otpEntered);
  console.log("Otp sended", otp);
  if (otpEntered === otp) {
    try {
      bcrypt.hash(password, saltRounds, async(err, hash) => { 
        const result = await db.query(
          "INSERT INTO users (email, password) VALUES ($1, $2)",
          [email, hash]
        );
        res.redirect("/home");
      });
    } catch (err) {
      console.log(err);
    }
  } else {
    res.render("register.ejs", {
      message: "Invalid OTP. Try again.",
      disabled: false,
      emailId: email,
    });
  }
});
app.post("/verifyEmail", async (req, res) => {
  console.log(req.body);
  // verify email is already registered or not
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      req.body.email,
    ]);
    console.log(result.rows);
    if (result.rows.length > 0) {
      res.redirect("/alreadyRegisteredRedirect");
    } else {
      otp = Math.random().toString(36).substring(2, 6).toUpperCase();
      console.log(otp);
      // sending otp using nodemailer
      try {
        const mailOptions = {
          from: '"Team Freshio" <anuj2002kumar@gmail.com>',
          to: req.body.email,
          subject: "Verify your Freshio OTP",
          text: `Your OTP is ${otp}.`,
          html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Freshio - Verify OTP</title>
          </head>
          <body style="font-family: Arial, sans-serif; background-color: #f5f5f5;">
              <!-- Header -->
              <header style="background-color: #f5f5f5; padding: 20px; text-align: center;">
                  <h1 style="color: #0a472e; margin: 0;">Welcome to Freshio!</h1>
              </header>
              <!-- Content -->
              <section style="padding: 20px; color: #0a472e;">
                  <p style="margin-bottom: 10px;">Dear User,</p>
                  <p style="margin-bottom: 10px;">Your OTP for verification is: <strong>${otp}</strong></p>
                  <p>Please use this OTP to complete your registration process.</p>
              </section>
              <!-- Footer -->
              <footer style="background-color: #f5f5f5; padding: 20px; text-align: center;">
                  <p style="margin-bottom: 5px; color: #0a472e;">Freshio Inc.</p>
                  <p style="margin-bottom: 5px; color: #0a472e;">MG Park Street, Bengaluru, India</p>
                  <p style="margin-bottom: 0; color: #0a472e;">Email: anuj2002kumar@gmail.com | Phone: +1 (123) 456-7890</p>
              </footer>
          </body>
          </html>
        `,
        };

        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.log(err);
            res.send("Oops, mail not sent. Try again after some time.");
          } else {
            console.log("Email sent: " + info.response);
            res.render("register.ejs", {
              message: "Enter OTP sent to your email.",
              disabled: false,
              emailId: req.body.email,
            });
          }
        });
      } catch (err) {
        console.log(err);
      }
    }
  } catch (err) {
    console.log("Error fetching data", err);
  }
});




app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
