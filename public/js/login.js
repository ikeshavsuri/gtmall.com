// Firebase config should already be loaded from <script> tag in HTML

const auth = firebase.auth();

// GOOGLE LOGIN
function googleLogin() {
  const provider = new firebase.auth.GoogleAuthProvider();

  auth.signInWithPopup(provider)
    .then((result) => {
      const user = result.user;

      localStorage.setItem("userName", user.displayName);
      localStorage.setItem("userEmail", user.email);

      window.location.href = "index.html";
    })
    .catch((e) => {
      alert("Google login failed");
      console.error(e);
    });
}

// EMAIL SIGNUP
function signupWithEmail(name, email, pass) {
  auth.createUserWithEmailAndPassword(email, pass)
    .then(async (result) => {
      const user = result.user;
      await user.updateProfile({ displayName: name });

      await user.sendEmailVerification();

      alert("Account created! Verify your email before login.");
      window.location.href = "login_signup.html";
    })
    .catch((e) => {
      alert(e.message);
    });
}

// EMAIL LOGIN
function loginWithEmail(email, pass) {
  auth.signInWithEmailAndPassword(email, pass)
    .then(async (result) => {
      const user = result.user;

      if (!user.emailVerified) {
        await user.sendEmailVerification();
        alert("Please verify your email first!");
        return;
      }

      localStorage.setItem("userName", user.displayName);
      localStorage.setItem("userEmail", user.email);

      window.location.href = "index.html";
    })
    .catch((e) => {
      alert("Invalid credentials.");
    });
}
