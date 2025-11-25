document.addEventListener("DOMContentLoaded", () => {
  const adminEmail = "ikeshavsuri@gmail.com"; // change this

  const loggedEmail = localStorage.getItem("userEmail");

  if (loggedEmail !== adminEmail) {
    alert("Admin access only.");
    window.location.href = "index.html";
  }
});
