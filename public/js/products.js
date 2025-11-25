// EXAMPLE PRODUCTS
const PRODUCTS = [
  {
    id: 1,
    name: "Solar Wall Lamp",
    price: 142,
    img: "img/product/solarlamp.png"
  },
  {
    id: 2,
    name: "2 in 1 Wireless Vacuum Cleaner",
    price: 198,
    img: "img/product/vacuum.png"
  },
  {
    id: 3,
    name: "3D VR Box Virtual Reality",
    price: 298,
    img: "img/product/vr.png"
  },
  {
    id: 4,
    name: "Fire-Boltt Talk 2 Pro",
    price: 1998,
    img: "img/product/talk 2 pro.png"
  }
];

// LOAD PRODUCTS IN SHOP PAGE
function renderProducts() {
  const container = document.getElementById("shopProducts");
  if (!container) return;

  container.innerHTML = "";

  PRODUCTS.forEach((p) => {
    container.innerHTML += `
      <div class="col-md-3">
        <div class="card p-2">
          <img src="${p.img}">
          <div class="card-body">
            <h5>${p.name}</h5>
            <p>₹${p.price}</p>
            <button onclick='addToCart(${JSON.stringify(p)})'>Add to Cart</button>
          </div>
        </div>
      </div>
    `;
  });
}

document.addEventListener("DOMContentLoaded", renderProducts);
