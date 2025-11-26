// Example products (you can later load from backend)
window.PRODUCTS = [
  { id: 1, name: "Solar Wall Lamp", price: 142, img: "assets/img/product/solarlamp.png" },
  { id: 2, name: "2 in 1 Wireless Vacuum Cleaner", price: 198, img: "assets/img/product/vacuum.png" },
  { id: 3, name: "3D VR Box Virtual Reality Glasses", price: 298, img: "assets/img/product/vr.png" },
  { id: 4, name: "Fire-Boltt Talk 2 Pro Smartwatch", price: 1998, img: "assets/img/product/talk 2 pro.png" }
];

function renderProductsGrid(sortBy) {
  const container = document.getElementById("shopProducts");
  if (!container) return;
  let items = [...window.PRODUCTS];
  if (sortBy === "low") items.sort((a,b)=>a.price-b.price);
  if (sortBy === "high") items.sort((a,b)=>b.price-a.price);
  container.innerHTML = "";
  items.forEach(p => {
    const col = document.createElement("div");
    col.className = "col-md-3";
    col.innerHTML = `
      <div class="card p-2 h-100">
        <img src="${p.img}" alt="${p.name}">
        <div class="card-body">
          <h5>${p.name}</h5>
          <p>₹${p.price}</p>
          <button onclick='addToCart(${JSON.stringify(p)})'>Add to Cart</button>
        </div>
      </div>`;
    container.appendChild(col);
  });
}
