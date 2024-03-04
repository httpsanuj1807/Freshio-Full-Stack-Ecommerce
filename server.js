import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt";
import env from "dotenv";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();
let otp = undefined;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    session: { maxAge: 1000 * 60 * 60 * 24 },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// calculate cartQuantity Middleware

const calculateCartQuantity = async (req, res, next) => {
  if (req.isAuthenticated()) {
    try {
      const cartQuantityResult = await db.query(
        "SELECT SUM(quantity) AS total_quantity FROM cart WHERE user_id = $1",
        [req.user.user_id]
      );
      const cartQuantity = cartQuantityResult.rows[0].total_quantity || 0;
      req.cartQuantity = cartQuantity;
      next();
    } catch (err) {
      console.log(err);
      res.status(500).send("Error fetching data");
    }
  } else {
    next();
  }
};
app.use(calculateCartQuantity);

const addToCartMiddleware = async (req, res, next) => {
  if (req.isAuthenticated()) {
    try {
      const ifExists = await db.query(
        "SELECT * FROM cart WHERE user_id = $1 AND product_id = $2",
        [req.user.user_id, req.params.productId]
      );
      if (ifExists.rows.length > 0) {
        // updating the quantity
        const result = await db.query(
          "UPDATE cart SET quantity = quantity + 1 WHERE user_id = $1 AND product_id = $2",
          [req.user.user_id, req.params.productId]
        );
      } else {
        // fresh insert
        const result = await db.query(
          "INSERT INTO cart (user_id, product_id,quantity) VALUES ($1, $2,1)",
          [req.user.user_id, req.params.productId]
        );
      }
      next();
    } catch (err) {
      console.log(err);
      res.status(500).send("Error adding to cart");
    }
  } else {
    res.redirect("/login");
  }
}



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

app.get("/", async (req, res) => {
  try {
    const featureProducts = await db.query("SELECT * FROM products LIMIT 4");
    let htmlFeature = ``;
    const featureProductResult = featureProducts.rows;
    featureProductResult.forEach((product) => {
      htmlFeature += ` <div class="div-item">
      <div class="img-div">
       <img class="product-img" src=${product.image}>
       <div class="hidden-features">
           <p><img class="feature-icon" src="images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="images/Homepage/eye.png"></p>
       </div>
      </div>
      <div class="product-text-div">
           <div class="product-name">${product.name}</div>
           <div class="product-price">From £${(product.price / 100).toFixed(
             2
           )}</div>
           <div class="product-status-container">
               <a href="/addToCart/home/${
                 product.id
               }" class="product-status">ADD TO CART &gt;&gt; </a>
           </div>
      </div>
   </div>`;
    });
    const bestProducts = await db.query(
      "SELECT * FROM products ORDER BY rating_stars DESC, rating_count DESC LIMIT 4"
    );
    let htmlBest = ``;
    const bestProductResult = bestProducts.rows;
    bestProductResult.forEach((product) => {
      htmlBest += ` <div class="div-item">
      <div class="img-div">
       <img class="product-img" src=${product.image}>
       <div class="hidden-features">
           <p><img class="feature-icon" src="images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="images/Homepage/eye.png"></p>
       </div>
      </div>
      <div class="product-text-div">
           <div class="product-name">${product.name}</div>
           <div class="product-price">From £${(product.price / 100).toFixed(
             2
           )}</div>
           <div class="product-status-container">
           <a href="/addToCart/home/${
             product.id
           }" class="product-status">ADD TO CART &gt;&gt; </a>
           </div>
      </div>
   </div>`;
    });
    if (req.isAuthenticated()) {
      res.redirect("/home");
    } else {
      res.render("index.ejs", {
        auth: "notAuth",
        activePage: "home",
        htmlBest: htmlBest,
        htmlFeature: htmlFeature,
        wishlistCount: 0,
        cartCount: 0,
      });
    }
  } catch (err) {
    console.log("Error fetching data", err);
    res.status(500).send("Error fetching data");
  }
});

app.get("/home", async (req, res) => {
  try {
    const featureProducts = await db.query("SELECT * FROM products LIMIT 4");
    let htmlFeature = ``;
    const featureProductResult = featureProducts.rows;
    featureProductResult.forEach((product) => {
      htmlFeature += ` <div class="div-item">
      <div class="img-div">
       <img class="product-img" src=${product.image}>
       <div class="hidden-features">
           <p><img class="feature-icon" src="images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="images/Homepage/eye.png"></p>
       </div>
      </div>
      <div class="product-text-div">
           <div class="product-name">${product.name}</div>
           <div class="product-price">From £${(product.price / 100).toFixed(
             2
           )}</div>
           <div class="product-status-container">
           <a href="/addToCart/home/${
             product.id
           }" class="product-status">ADD TO CART &gt;&gt; </a>
           </div>
      </div>
   </div>`;
    });
    const bestProducts = await db.query(
      "SELECT * FROM products ORDER BY rating_stars DESC, rating_count DESC LIMIT 4"
    );
    let htmlBest = ``;
    const bestProductResult = bestProducts.rows;
    bestProductResult.forEach((product) => {
      htmlBest += ` <div class="div-item">
      <div class="img-div">
       <img class="product-img" src=${product.image}>
       <div class="hidden-features">
           <p><img class="feature-icon" src="images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="images/Homepage/eye.png"></p>
       </div>
      </div>
      <div class="product-text-div">
           <div class="product-name">${product.name}</div>
           <div class="product-price">From £${(product.price / 100).toFixed(
             2
           )}</div>
           <div class="product-status-container">
           <a href="/addToCart/home/${
             product.id
           }" class="product-status">ADD TO CART &gt;&gt; </a>
           </div>
      </div>
   </div>`;
    });

    if (req.isAuthenticated()) {
      res.render("index.ejs", {
        auth: "auth",
        activePage: "home",
        htmlFeature: htmlFeature,
        htmlBest: htmlBest,
        wishlistCount: 0,
        cartCount: req.cartQuantity,
      });
    } else {
      res.redirect("/login");
    }
  } catch (err) {
    console.log("Error fetching data", err);
    res.status(500).send("Error fetching data");
  }
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/login");
    }
  });
});

//route for login.ejs
app.get("/login", (req, res) => {
  res.render("login.ejs", {
    message: "freshLogin",
    auth: "notAuth",
    wishlistCount: 0,
    cartCount: 0,
  });
});

app.get("/notRegisteredRedirect", (req, res) => {
  res.render("login.ejs", {
    message: "User not found.",
    auth: "notAuth",
    wishlistCount: 0,
    cartCount: 0,
  });
});
app.get("/invalidUserPassRedirect", (req, res) => {
  res.render("login.ejs", {
    message: "Invalid email or password. Try again",
    auth: "notAuth",
    wishlistCount: 0,
    cartCount: 0,
  });
});

// routes for register.ejs
app.get("/register", (req, res) => {
  res.render("register.ejs", {
    message: "",
    disabled: true,
    auth: "notAuth",
    wishlistCount: 0,
    cartCount: 0,
  });
});

app.get("/alreadyRegisteredRedirect", (req, res) => {
  res.render("register.ejs", {
    message: "User already registered.",
    disabled: true,
    auth: "notAuth",
    wishlistCount: 0,
    cartCount: 0,
  });
});

// verification routes
app.post("/verifyLogIn", (req, res) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.log(err);
    }
    if (!user) {
      if (info.message == "User not found.") {
        res.redirect("/notRegisteredRedirect");
      } else {
        res.redirect("/invalidUserPassRedirect");
      }
    } else {
      req.login(user, (err) => {
        if (err) {
          console.log(err);
        }
        res.redirect("/home");
      });
    }
  })(req, res);
});

app.post("/verifyRegisterUser", async (req, res) => {
  const {
    username,
    password,
    firstDigit,
    secondDigit,
    thirdDigit,
    fourthDigit,
  } = req.body;

  const otpEntered = firstDigit + secondDigit + thirdDigit + fourthDigit;
  console.log("Otp entered", otpEntered);
  console.log("Otp sended", otp);
  if (otpEntered === otp) {
    try {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        const result = await db.query(
          "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
          [username, hash]
        );
        const user = result.rows[0];
        req.login(user, (err) => {
          if (err) {
            console.log(err);
          }
          res.redirect("/home");
        });
      });
    } catch (err) {
      console.log(err);
    }
  } else {
    res.render("register.ejs", {
      message: "Invalid OTP. Try again.",
      disabled: false,
      auth: "notAuth",
      emailId: username,
      wishlistCount: 0,
      cartCount: 0,
    });
  }
});
app.post("/verifyEmail", async (req, res) => {
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
              auth: "notAuth",
              wishlistCount: 0,
              cartCount: 0,
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


app.get("/products", async (req, res) => {
  try {
    const productsResult = await db.query("SELECT * FROM products");
    let html = ``;
    const products = productsResult.rows;
    products.forEach((product) => {
      html += `<div class="div-item">
      <div class="img-div">
       <img class="product-img" src="${product.image}">
       <div class="hidden-features">
           <p><img class="feature-icon" src="images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="images/Homepage/eye.png"></p>
       </div>
      </div>
      <div class="product-text-div">
           <div class="product-name">${product.name}</div>
           <div class="product-price">From £${(product.price / 100).toFixed(2)}
           </div>
           <div class="product-status-container">
           <a href="/addToCart/products/${
            product.id
          }" class="product-status">ADD TO CART &gt;&gt; </a>
           </div>
      </div>
   </div>`;
    });

    if (req.isAuthenticated()) {
      res.render("products.ejs", {
        auth: "auth",
        activePage: "products",
        productHtml: html,
        wishlistCount: 0,
        cartCount: req.cartQuantity,
      });
    } else {
      res.render("products.ejs", {
        auth: "notAuth",
        activePage: "products",
        productHtml: html,
        wishlistCount: 0,
        cartCount: 0,
      });
    }
  } catch (err) {
    console.log("Error fetching data", err);
    res.status(500).send("Error fetching data");
  }
});

app.get("/goToCart", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const orderData = await db.query(
        "SELECT * FROM cart WHERE user_id = $1",
        [req.user.user_id]
      );
      const productsData = await db.query("SELECT * FROM products");
      let cartHTML = ``;
      let paymentPrice = 0;
      const orderDataResult = orderData.rows;
      const productsDataResult = productsData.rows;
      orderDataResult.forEach((item) => {
        let matchingItem;
        productsDataResult.forEach((product) => {
          if (item.product_id === product.id) {
            matchingItem = product;
          }
        });
        const subtotal = (matchingItem.price * item.quantity) / 100;
        paymentPrice += subtotal;
        cartHTML += `
        <tr class="cart-item">
            <td style="padding:0;"><a href="/deleteFromCart/${
              item.product_id
            }"><div class="delete-btn"><img src="images/Homepage/bin.png"></div></a></td>
            <td class="table-img"><img src="${matchingItem.image}" alt=""></td>
            <td>${matchingItem.name}</td>
            <td>£${(matchingItem.price / 100).toFixed(2)}</td>
            <td>
            <input class="input-item-quantity" name=${item.product_id} type="number" placeholder="${
                 item.quantity
                 }" value="${item.quantity}" min="1" max="10">
            </td>
            <td>£${((matchingItem.price * item.quantity) / 100).toFixed(2)}</td>
        </tr>`;
      });
      paymentPrice = paymentPrice.toFixed(2);
      res.render("cart.ejs", {
        auth: "auth",
        wishlistCount: 0,
        cartCount: req.cartQuantity,
        cartHTML: cartHTML,
        paymentPrice: paymentPrice,
      });
    } catch (err) {
      console.log(err);
      res.status(500).send("Error fetching data");
    }
  } else {
    let paymentPrice = 0;
    paymentPrice = paymentPrice.toFixed(2);
    res.render("cart.ejs", {
      auth: "notAuth",
      wishlistCount: 0,
      cartCount: 0,
      paymentPrice: paymentPrice,
    });
  }
});

app.get("/contact", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("contact.ejs", {
      auth: "auth",
      activePage: "contact",
      wishlistCount: 0,
      cartCount: req.cartQuantity,
    });
  } else {
    res.render("contact.ejs", {
      auth: "notAuth",
      activePage: "contact",
      wishlistCount: 0,
      cartCount: 0,
    });
  }
}); 

// checkout page route

app.get('/checkout', async(req, res)=>{
  if(req.isAuthenticated()){
    res.render('checkout.ejs', { 
        auth: "auth",
        wishlistCount: 0,
        cartCount: req.cartQuantity,
    })
  }
  else{
    res.redirect('/login');
  }
})

// update cart quantity  

app.post("/updateCart", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      Object.keys(req.body).forEach(async (productId) => {
        const result = await db.query(
          "UPDATE cart SET quantity = $1 WHERE user_id = $2 AND product_id = $3",
          [req.body[productId], req.user.user_id, productId]
        );
      });
      res.redirect("/goToCart");
    } catch (err) {
      console.log(err);
      res.status(500).send("Error updating cart");
    }
  } else {
    res.redirect("/login");
  } 
});

// add to cart routes

app.get("/addToCart/products/:productId", addToCartMiddleware, (req, res) => {
  res.redirect("/products");
});

app.get("/addToCart/home/:productId", addToCartMiddleware, (req, res) => {
  res.redirect("/home");
});


// delete from cart
app.get("/deleteFromCart/:productId", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const result = await db.query(
        "DELETE FROM cart WHERE user_id = $1 AND product_id = $2",
        [req.user.user_id, req.params.productId]
      );
      res.redirect("/goToCart");
    } catch (err) {
      console.log(err);
      res.status(500).send("Error deleting from cart");
    }
  } else {
    res.redirect("/login");
  }
});

// google auth routes

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/home",
  passport.authenticate("google", {
    successRedirect: "/home",
    failureRedirect: "/login",
  })
);

// local strategy for passport

passport.use(
  "local",
  new Strategy(async function (username, password, done) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [
        username,
      ]);
      if (result.rows.length > 0) {
        bcrypt.compare(password, result.rows[0].password, (err, response) => {
          if (response) {
            return done(null, result.rows[0]); // correct password
          } else {
            return done(null, false, {
              message: "Invalid email or password. Try again",
            }); // invalid password
          }
        });
      } else {
        return done(null, false, { message: "User not found." }); // user not found in db
      }
    } catch (err) {
      return done(err);
    }
  })
);

// google strategy

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/home", // to redirect after auth
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo", // the endpoint from where info will be collected. It is fixed, basically a API
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await db.query("SELECT * from users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
            [profile.email, "googleUser"]
          );
          cb(null, newUser.rows[0]); // null is that no error
        } else {
          // user already exists
          cb(null, result.rows[0]);
        }
      } catch (err) {
        cb(err);
      }
    }
  )
);

passport.serializeUser((user, cb) => {
  cb(null, user); // Serialize using the user's email
});

passport.deserializeUser((user, cb) => {
  // Deserialize using the email
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}.`);
});
