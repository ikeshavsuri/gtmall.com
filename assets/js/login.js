const auth = firebase.auth();

function setStatus(msg, color) {
  const el = document.getElementById("status-msg");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = color || "#6b7280";
}

function googleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider)
    .then(result => {
      const user = result.user;
      localStorage.setItem("userUid", user.uid);
      localStorage.setItem("userName", user.displayName || "");
      localStorage.setItem("userEmail", user.email || "");
      window.location.href = "index.html";
    })
    .catch(e => {
      setStatus("Google login failed", "red");
      console.error(e);
    });
}

function signupWithEmail(name, email, pass) {
  auth.createUserWithEmailAndPassword(email, pass)
    .then(async result => {
      const user = result.user;
      await user.updateProfile({ displayName: name });
      await user.sendEmailVerification();
      setStatus("Account created! Check your email to verify.", "green");
    })
    .catch(e => setStatus(e.message, "red"));
}

function loginWithEmail(email, pass) {
  auth.signInWithEmailAndPassword(email, pass)
    .then(async result => {
      const user = result.user;
      if (!user.emailVerified) {
        await user.sendEmailVerification();
        setStatus("Please verify your email; we sent you a link.", "red");
        return;
      }
      localStorage.setItem("userUid", user.uid);
      localStorage.setItem("userName", user.displayName || "");
      localStorage.setItem("userEmail", user.email || "");
      window.location.href = "index.html";
    })
    .catch(e => setStatus("Invalid credentials", "red"));
}

document.addEventListener("DOMContentLoaded", () => {
  const tabLogin   = document.getElementById("tab-login");
  const tabSignup  = document.getElementById("tab-signup");
  const loginPane  = document.getElementById("login-pane");
  const signupPane = document.getElementById("signup-pane");
  const titleLogin = document.getElementById("title-login");
  const subLogin   = document.getElementById("subtitle-login");
  const titleSignup= document.getElementById("title-signup");
  const subSignup  = document.getElementById("subtitle-signup");

  function showLogin() {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    loginPane.style.display = "";
    signupPane.style.display = "none";
    titleLogin.style.display = "";
    subLogin.style.display = "";
    titleSignup.style.display = "none";
    subSignup.style.display = "none";
    setStatus("");
  }
  function showSignup() {
    tabSignup.classList.add("active");
    tabLogin.classList.remove("active");
    signupPane.style.display = "";
    loginPane.style.display = "none";
    titleLogin.style.display = "none";
    subLogin.style.display = "none";
    titleSignup.style.display = "";
    subSignup.style.display = "";
    setStatus("");
  }

  tabLogin.addEventListener("click", showLogin);
  tabSignup.addEventListener("click", showSignup);

  document.getElementById("google-btn").addEventListener("click", () => {
    setStatus("Opening Google login...", "#6b7280");
    googleLogin();
  });

  document.getElementById("login-submit-btn").addEventListener("click", () => {
    const email = document.getElementById("login-email").value.trim();
    const pass  = document.getElementById("login-password").value.trim();
    if (!email || !pass) return setStatus("Enter email and password", "red");
    setStatus("Logging in...");
    loginWithEmail(email, pass);
  });

  document.getElementById("signup-submit-btn").addEventListener("click", () => {
    const name  = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const pass  = document.getElementById("signup-password").value.trim();
    const conf  = document.getElementById("signup-confirm").value.trim();
    if (!name || !email || !pass) return setStatus("Fill all fields", "red");
    if (pass !== conf) return setStatus("Passwords do not match", "red");
    if (pass.length < 6) return setStatus("Password must be at least 6 chars", "red");
    setStatus("Creating account...");
    signupWithEmail(name, email, pass);
  });
});
