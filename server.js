import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import env from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";





const app = express();
const port = 3000;
const saltRounds = 10;
env.config();
let otp = undefined;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session
  ({
    secret: process.env.SESSION_SECRET,
    resave
    : false,
    saveUninitialized: true,
    session: { maxAge: 1000 * 60 * 60 * 24 },
  })
);

app.use(passport.initialize());
app.use(passport.session());


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



// redirection based on session is active
app.get('/home', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('index.ejs');
  } else {
    res.redirect('/login');
  }
}
);

app.get("/", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/home');
  } else {
    res.redirect('/login');
  }
});







//route for login.ejs
app.get("/login", (req, res) => {
  res.render("login.ejs", { message: "freshLogin" });
});

app.get("/notRegisteredRedirect", (req, res) => {
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
app.post('/verifyLogIn', (req, res) => {
  passport.authenticate('local', (err, user, info) => {
    console.log(user);
    if (err) {
      console.log(err);
    }
    if (!user) {
      if (info.message == "User not found.") {
        res.redirect('/notRegisteredRedirect');
      } else {
        res.redirect('/invalidUserPassRedirect');
      }
    } else {
      req.login(user, (err) => {
        if (err) {
          console.log(err);
        }
        res.redirect('/home');
      });
    }
  })(req, res);
});


app.post("/verifyRegisterUser", async (req, res) => {
  console.log(req.body);
  const { username, password, firstDigit, secondDigit, thirdDigit, fourthDigit } =
    req.body;

  const otpEntered = firstDigit + secondDigit + thirdDigit + fourthDigit;
  console.log("Otp entered", otpEntered);
  console.log("Otp sended", otp);
  if (otpEntered === otp) {
    try {
      bcrypt.hash(password, saltRounds, async(err, hash) => { 
        const result = await db.query(
          "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
          [username, hash]
        );
        const user = result.rows[0];
        req.login(user,(err)=>{
          if(err){
            console.log(err);
          }
          res.redirect('/home');
        });
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
      req.body.username,
    ]);
    if (result.rows.length > 0) {
      res.redirect("/alreadyRegisteredRedirect");
    } else {
      otp = Math.random().toString(36).substring(2, 6).toLowerCase();
      console.log(otp);
      // sending otp using nodemailer
      try {
        const mailOptions = {
          from: '"Team Freshio" <anuj2002kumar@gmail.com>',
          to: req.body.username,
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
              <section style="padding: 20px;  color: #0a472e;">
                  <p style="margin-bottom: 10px;">Dear User,</p>
                  <p style="margin-bottom: 10px;">Your OTP for verification is: <strong>${otp}</strong></p>
                  <p>Please use this OTP to complete your registration process.</p>
              </section>
              <!-- Footer -->
              <footer style="background-color: #f5f5f5; padding: 20px; text-align: center;">
                  <p style="margin-bottom: 1px; color: #0a472e;">Freshio Inc.</p>
                  <p style="margin-bottom: 1px; color: #0a472e;">MG Park Street, Bengaluru, India</p>
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
              emailId: req.body.username,
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

// anshika routes 
app.get("/products", (req, res) => {
  res.render('products.ejs');
});

app.get("/checkout", (req, res) => {
  res.render('checkout.ejs');
});

app.get("/contact", (req, res) => {
  res.render('contact.ejs');
});


// local strategy for passport

passport.use("local", new Strategy(async function(username, password, done) {
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [username]);
    if (result.rows.length > 0) {
      bcrypt.compare(password, result.rows[0].password, (err, response) => {
        if (response) {
          return done(null, result.rows[0]);   // correct password
        } else {
          return done(null, false, { message: "Invalid email or password. Try again" });  // invalid password
        }
      });
    } else {
      return done(null, false, { message: "User not found." });  // user not found in db
    }
  } catch (err) {
    return done(err);
  }
}));



passport.serializeUser((user, cb) => {  
  cb(null, user.email); // Serialize using the user's email
});

passport.deserializeUser((email, cb) => { // Deserialize using the email
  cb(null, email);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
