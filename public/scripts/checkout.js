import {products} from '../data/products.js';
import {cart} from '../data/cart.js';

let cartHTML = "";
cart.forEach((item) => {
    let matchingCartItem;
    products.forEach((product) => {
      if (item.id === product.id) {
        matchingCartItem = product;
      }
    });

    cartHTML += `
        <tr class="cart-item">
            <td style="padding:0;"><div class="delete-btn"><img src="images/Homepage/bin.png"></div></td>
            <td class="table-img"><img src="${matchingCartItem.image}" alt=""></td>
            <td>${matchingCartItem.name}</td>
            <td>£${(matchingCartItem.priceCents / 100).toFixed(2)}</td>
            <td>${item.quantity}</td>
            <td>${((matchingCartItem.priceCents / 100) * item.quantity).toFixed(2)}</td>
        </tr>`;
  });
  document.querySelector(".table-data").innerHTML = cartHTML;

  