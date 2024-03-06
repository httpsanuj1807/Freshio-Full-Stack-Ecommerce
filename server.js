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

// import { fileURLToPath } from 'url';
// import path from 'path';


// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);


const app = express();
const port = 3000;
const saltRounds = 10;
env.config();
let otp = undefined;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use('/static', express.static(path.join(__dirname, 'public')));
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

const calculateCartQuantityAndPaymentPrice = async (req, res, next) => {
  if (req.isAuthenticated()) {
    try {
      const cartResult = await db.query(
        "SELECT * FROM cart WHERE user_id = $1",
        [req.user.user_id]
      );
      let cartQuantity = 0;
      let paymentPrice = 0;
      const productsResult = await db.query("SELECT * FROM products");
      const cartResultData = cartResult.rows;
      const productsResultData = productsResult.rows;
      cartResultData.forEach((cartItem) => {
        productsResultData.forEach((product) => {
          if (cartItem.product_id === product.id) {
            cartQuantity += cartItem.quantity;
            paymentPrice += Number((product.price * cartItem.quantity) / 100);
          }
        });
      });

      req.cartQuantity = cartQuantity;
      req.paymentPrice = paymentPrice.toFixed(2);
      next();
    } catch (err) {
      console.log(err);
      res.status(500).send("Error fetching data");
    }
  } else {
    const payemntPrice = 0;
    req.paymentPrice = payemntPrice.toFixed(2);
    next();
  }
};
app.use(calculateCartQuantityAndPaymentPrice);

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
};

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
           <p><img class="feature-icon" src="/images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/eye.png"></p>
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
           <p><img class="feature-icon" src="/images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/eye.png"></p>
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
        paymentPrice: req.paymentPrice,
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
           <p><img class="feature-icon" src="/images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/eye.png"></p>
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
           <p><img class="feature-icon" src="/images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/eye.png"></p>
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
        paymentPrice: req.paymentPrice,
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
    paymentPrice: req.paymentPrice,
  });
});

app.get("/notRegisteredRedirect", (req, res) => {
  res.render("login.ejs", {
    message: "User not found.",
    auth: "notAuth",
    wishlistCount: 0,
    cartCount: 0,
    paymentPrice: req.paymentPrice,
  });
});
app.get("/invalidUserPassRedirect", (req, res) => {
  res.render("login.ejs", {
    message: "Invalid email or password. Try again",
    auth: "notAuth",
    wishlistCount: 0,
    cartCount: 0,
    paymentPrice: req.paymentPrice,
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
    paymentPrice: req.paymentPrice,
  });
});

app.get("/alreadyRegisteredRedirect", (req, res) => {
  res.render("register.ejs", {
    message: "User already registered.",
    disabled: true,
    auth: "notAuth",
    wishlistCount: 0,
    cartCount: 0,
    paymentPrice: req.paymentPrice,
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
      paymentPrice: req.paymentPrice,
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
              paymentPrice: req.paymentPrice,
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
           <p><img class="feature-icon" src="/images/Homepage/filledheart.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/shuffle.png"></p>
           <p><img class="feature-icon" src="/images/Homepage/eye.png"></p>
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
        paymentPrice: req.paymentPrice,
      });
    } else {
      res.render("products.ejs", {
        auth: "notAuth",
        activePage: "products",
        productHtml: html,
        wishlistCount: 0,
        cartCount: 0,
        paymentPrice: req.paymentPrice,
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
      const orderDataResult = orderData.rows;
      const productsDataResult = productsData.rows;
      orderDataResult.forEach((item) => {
        let matchingItem;
        productsDataResult.forEach((product) => {
          if (item.product_id === product.id) {
            matchingItem = product;
          }
        });
        cartHTML += `
        <tr class="cart-item">
            <td style="padding:0;"><a href="/deleteFromCart/${
              item.product_id
            }"><div class="delete-btn"><img src="/images/Homepage/bin.png"></div></a></td>
            <td class="table-img"><img src="${matchingItem.image}" alt=""></td>
            <td>${matchingItem.name}</td>
            <td>£${(matchingItem.price / 100).toFixed(2)}</td>
            <td>
            <input class="input-item-quantity" name=${
              item.product_id
            } type="number" placeholder="${item.quantity}" value="${
          item.quantity
        }" min="1" max="10">
            </td>
            <td>£${((matchingItem.price * item.quantity) / 100).toFixed(2)}</td>
        </tr>`;
      });
      res.render("cart.ejs", {
        auth: "auth",
        wishlistCount: 0,
        cartCount: req.cartQuantity,
        cartHTML: cartHTML,
        paymentPrice: req.paymentPrice,
      });
    } catch (err) {
      console.log(err);
      res.status(500).send("Error fetching data");
    }
  } else {
    res.render("cart.ejs", {
      auth: "notAuth",
      wishlistCount: 0,
      cartCount: 0,
      paymentPrice: req.paymentPrice,
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
      paymentPrice: req.paymentPrice,
    });
  } else {
    res.render("contact.ejs", {
      auth: "notAuth",
      activePage: "contact",
      wishlistCount: 0,
      cartCount: 0,
      paymentPrice: req.paymentPrice,
    });
  }
});

// checkout page route

app.get("/checkout", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const orderData = await db.query(
        "SELECT * FROM cart WHERE user_id = $1",
        [req.user.user_id]
      );
      
      const productsData = await db.query("SELECT * FROM products");
      let checkoutHTML = ``;
      let formHTML = ``;
      const formData = await db.query(
        "SELECT * FROM user_info WHERE user_id = $1",
        [req.user.user_id]
      );
      if (formData.rows.length > 0) {
        const formDetails = formData.rows[0];
        formHTML = `
        <h2>Billing Details</h2>
        <div class="user-name">
          <div style="width:48%;" class="flex-down">
            <label for="fName" class="required">First name</label>
            <input autocomplete="on" required maxlength="8" type="text" value=${formDetails.fname} name="fName" id="fName">
          </div>
          <div style="width:48%;" class="flex-down">
            <label for="lName" class="required">Last name</label>
            <input autocomplete="on" max="10" required type="text" value=${formDetails.lname} name="lName" id="lName">
          </div>
        </div>
        <div class="flex-down">
          <label for="company-name">Company Name (optional)</label>
          <input autocomplete="on" type="text" name="companyName" id="company-name">
        </div>
        <div class="flex-down">
          <label for="country-name" class="required">Country / Region</label>
          <select required id="country-name" value=${formDetails.countryname} name="countryName">
            <option value="India">India</option>
            <option value="UAE">United Arab Emirates</option>
            <option value="UK">United Kingdom (UK)</option>
            <option value="France">France</option>
          </select>
        </div>
        <div class="flex-down">
          <label class="required" for="street-address1">Street Address</label>
          <input required autocomplete="on" type="text" placeholder="House number and street name" value=${formDetails.streetaddress1} name="streetAddress1" id="street-address">
          <input required autocomplete="on" type="text" placeholder="Apartment, suite, unit, etc (optional)" value=${formDetails.streetaddress2} name="streetAddress2" id="street-address2">
        </div>
        <div class="flex-down">
          <label for="town" class="required">Town / City</label>
          <input autocomplete="on" required value=${formDetails.town} type="text" name="town" id="town">
        </div>
        <div class="flex-down">
          <label for="postcode" class="required">Postcode</label>
          <input autocomplete="on" value=${formDetails.postcode} required type="text" minlength="6" maxlength="6" name="postcode" id="postcode">
        </div>
        <div class="flex-down">
          <label for="Phone" class="required">Phone</label>
          <input autocomplete="on" value=${formDetails.phone} required type="text" maxlength="10" name="Phone" id="Phone">
        </div>
        <h2 style="padding-top: 15px;">Additional information</h2>
        <div class="flex-down">
          <label for="order-notes">Order notes (optional)</label>
          <textarea style="resize: none;" placeholder="Notes about your order, e.g. special notes for delivery" name="orderNotes" id="order-notes" rows="3" ></textarea>
        </div>
      `
      }else{
        formHTML = `
              <h2>Billing Details</h2>
              <div class="user-name">
                <div style="width:48%;" class="flex-down">
                  <label for="fName" class="required">First name</label>
                  <input autocomplete="on" required maxlength="8" type="text" name="fName" id="fName">
                </div>
                <div style="width:48%;" class="flex-down">
                  <label for="lName" class="required">Last name</label>
                  <input autocomplete="on" max="10" required type="text" name="lName" id="lName">
                </div>
              </div>
              <div class="flex-down">
                <label for="company-name">Company Name (optional)</label>
                <input autocomplete="on" type="text" name="companyName" id="company-name">
              </div>
              <div class="flex-down">
                <label for="country-name" class="required">Country / Region</label>
                <select required id="country-name" name="countryName">
                  <option value="India">India</option>
                  <option value="UAE">United Arab Emirates</option>
                  <option value="UK">United Kingdom (UK)</option>
                  <option value="France">France</option>
                </select>
              </div>
              <div class="flex-down">
                <label class="required for="street-address1">Street Address</label>
                <input required autocomplete="on" type="text" placeholder="House number and street name" name="streetAddress1" id="street-address">
                <input required autocomplete="on" type="text" placeholder="Apartment, suite, unit, etc (optional)" name="streetAddress2" id="street-address2">
              </div>
              <div class="flex-down">
                <label for="town" class="required">Town / City</label>
                <input autocomplete="on" required type="text" name="town" id="town">
              </div>
              <div class="flex-down">
                <label for="postcode" class="required">Postcode</label>
                <input autocomplete="on" required type="text" minlength="6" maxlength="6" name="postcode" id="postcode">
              </div>
              <div class="flex-down">
                <label for="Phone" class="required">Phone</label>
                <input autocomplete="on" required type="text" maxlength="10" name="Phone" id="Phone">
              </div>
              <h2 style="padding-top: 15px;">Additional information</h2>
              <div class="flex-down">
                <label for="order-notes">Order notes (optional)</label>
                <textarea style="resize: none;" placeholder="Notes about your order, e.g. special notes for delivery" name="orderNotes" id="order-notes" rows="3" ></textarea>
              </div>
        `
      }

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
        checkoutHTML += `
        <tr>
            <td style="padding-right:20px;">${matchingItem.name}  x ${
          item.quantity
        }</td>
            <td class="dark">£${subtotal.toFixed(2)}</td>
        </tr>`;
      });
      res.render("checkout.ejs", {
        auth: "auth",
        wishlistCount: 0,
        cartCount: req.cartQuantity,
        checkoutHTML: checkoutHTML,
        formHTML: formHTML,
        paymentPrice: req.paymentPrice,
      });
    } catch (err) {
      console.log(err);
      res.status(500).send("Error fetching data");
    }
  } else {
    res.redirect("/login");
  }
});

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

// using url parameter type
app.get("/addToCart/products/:productId", addToCartMiddleware, (req, res) => {
  res.redirect("/products");
});

app.get("/addToCart/home/:productId", addToCartMiddleware, (req, res) => {
  res.redirect("/home");
});
app.get("/addToCart/products/filter/:topic/:productId", addToCartMiddleware, (req, res) => {
  res.redirect(`/filter/topicToSearch/${req.params.topic}`);
});

app.post('/search/product', async (req, res) =>{
  let keyword = req.body.searchProductText;
  keyword = keyword.toLowerCase().trim();
  res.redirect(`/filter/topicToSearch/${keyword}`);
});

app.get("/filter/topicToSearch/:keyword", async (req, res) => {
  const topic = req.params.keyword;
  if(topic === "all"){
    res.redirect("/products");
  }
  try {
    const productsResult = await db.query(
      "SELECT * from products WHERE keyword1 = $1 OR keyword2 = $1 OR keyword3 = $1 OR keyword4 = $1",
      [topic]
    );
    let html = ``;
    const products = productsResult.rows;
    if(products.length === 0){
      html = `No products found.`;
    }
    else{
      products.forEach((product) => {
        html += `<div class="div-item">
          <div class="img-div">
           <img class="product-img" src="/${product.image}">
           <div class="hidden-features">
               <p><img class="feature-icon" src="/images/Homepage/filledheart.png"></p>
               <p><img class="feature-icon" src="/images/Homepage/shuffle.png"></p>
               <p><img class="feature-icon" src="/images/Homepage/eye.png"></p>
           </div>
          </div>
          <div class="product-text-div">
               <div class="product-name">${product.name}</div>
               <div class="product-price">From £${(product.price / 100).toFixed(
                 2
               )}
               </div>
               <div class="product-status-container">
               <a href="/addToCart/products/filter/${topic}/${
                 product.id
               }" class="product-status">ADD TO CART &gt;&gt; </a>
               </div>
          </div>
       </div>`;
      });
    }
    
    
    if (req.isAuthenticated()) {
      res.render("products.ejs", {
        auth: "auth",
        activePage: "products",
        productHtml: html,
        wishlistCount: 0,
        activeTopic: topic,
        cartCount: req.cartQuantity,
        paymentPrice: req.paymentPrice,
      });
    } else {
      res.render("products.ejs", {
        auth: "notAuth",
        activePage: "products",
        productHtml: html,
        wishlistCount: 0,
        cartCount: 0,
        activeTopic: topic,
        paymentPrice: req.paymentPrice,
      });
    }
  } catch (err) {
    console.log("Error fetching data", err);
    res.status(500).send("Error fetching data");
  }
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

app.post("/orderPlaced", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const orderId = Math.floor(Math.random() * 90000000) + 10000000;
      const {
        fName,
        lName,
        companyName,
        countryName,
        streetAddress1,
        streetAddress2,
        town,
        postcode,
        Phone,
      } = req.body;
      const isUserAlready = await db.query(
        "SELECT * FROM user_info WHERE user_id = $1",
        [req.user.user_id]
      );
      if (isUserAlready.rows.length === 0) {
        const result = await db.query(
          "INSERT INTO user_info (user_id, fname, lname, companyname, countryname, streetaddress1, streetaddress2, town, postcode, phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
          [
            req.user.user_id,
            fName,
            lName,
            companyName,
            countryName,
            streetAddress1,
            streetAddress2,
            town,
            postcode,
            Phone,
          ]
        );
      }else{
        const result = await db.query(
          "UPDATE user_info SET fname = $1, lname = $2, companyname = $3, countryname = $4, streetaddress1 = $5, streetaddress2 = $6, town = $7, postcode = $8, phone = $9 WHERE user_id = $10",
          [
            fName,
            lName,
            companyName,
            countryName,
            streetAddress1,
            streetAddress2,
            town,
            postcode,
            Phone,
            req.user.user_id
          ]
        );
      }
      const orderData = await db.query(
        "SELECT * FROM cart WHERE user_id = $1",
        [req.user.user_id]
      );
      const productsData = await db.query("SELECT * FROM products");
      const orderDataResult = orderData.rows;
      const productsDataResult = productsData.rows;
      let orderPageHTML = ``;
      orderDataResult.forEach((item) => {
        let matchingItem;
        productsDataResult.forEach((product) => {
          if (item.product_id === product.id) {
            matchingItem = product;
          }
        });
        const subtotal = ((matchingItem.price * item.quantity) / 100).toFixed(
          2
        );
        try {
          const result = db.query(
            "INSERT INTO orders (order_id,user_id, product_id, quantity, subtotal) VALUES ($1, $2, $3, $4, $5)",
            [
              orderId,
              req.user.user_id,
              matchingItem.id,
              item.quantity,
              subtotal,
            ]
          );
        } catch (errAddingCart) {
          console.log("Error adding to orders", errAddingCart);
        }
        orderPageHTML += `<div class="order-products-info">
        <div class="order-cart-text-content">
          <div><img src=${matchingItem.image} /></div>
          <div style="display: flex; flex-direction:column; justify-content: center;">
            <p>${matchingItem.name}</p>
            <p>Qty: ${item.quantity}</p>
          </div>
        </div>  
        <div  style="display: flex; flex-direction: column; justify-content: center; padding: 0 20px;"><span>£${subtotal}</span></div>
      </div>`;
      });
      await db.query("DELETE FROM cart WHERE user_id = $1", [req.user.user_id]);
      let paymentPriceZero = 0;
      let newTotal = Number(req.paymentPrice) + 3.14 + 14.12;
      paymentPriceZero = paymentPriceZero.toFixed(2);
      res.render("order.ejs", {
        auth: "auth",
        wishlistCount: 0,
        cartCount: 0,
        orderPageHTML: orderPageHTML,
        paymentPrice: paymentPriceZero,
        name: fName,
        orderID: orderId,
        orderDate: new Date().toLocaleDateString(),
        houseNo: streetAddress1,
        streetName: streetAddress2,
        town: town,
        total: newTotal.toFixed(2),
      });
    } catch (err) {
      console.log(err);
      res.status(500).send("Error fetching data");
    }
  } else {
    res.redirect("/login");
  }
});


app.get('/error404', (req, res) => {
  if(req.isAuthenticated()){
    res.render('error404.ejs', {
      auth: "auth",
      wishlistCount: 0,
      cartCount: req.cartQuantity,
      paymentPrice: req.paymentPrice,
    });
  }
  else{
    res.render('error404.ejs', {
      auth: "notAuth",
      wishlistCount: 0,
      cartCount: 0,
      paymentPrice: req.paymentPrice,
    });
  }
});



app.get("/orderPlaced", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/products");
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
