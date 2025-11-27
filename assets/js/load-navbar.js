// assets/js/load-navbar.js

fetch("components/navbar.html")
  .then(res => res.text())
  .then(html => {
    document.getElementById("navbar-container").innerHTML = html;

    // Load navbar JS after navbar is injected
    const script = document.createElement("script");
    script.src = "assets/js/navbar.js";
    document.body.appendChild(script);

    const cartScript = document.createElement("script");
    cartScript.src = "assets/js/cart.js";
    document.body.appendChild(cartScript);
  })
  .catch(err => console.error("Navbar load error:", err));
