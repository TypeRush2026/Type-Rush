
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAMnI-2HOh1lbnsZv6WdkBbcasXTuo0ne0",
  authDomain: "typerush-5d69a.firebaseapp.com",
  projectId: "typerush-5d69a",
  storageBucket: "typerush-5d69a.firebasestorage.app",
  messagingSenderId: "660007351754",
  appId: "1:660007351754:web:0fab02c76e11a09aac0b33",
  measurementId: "G-7CDMGWHFBZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// HTML elements
const form = document.getElementById("authForm");
const nameField = document.getElementById("nameField");
const confirmField = document.getElementById("confirmField");
const rememberRow = document.getElementById("rememberRow");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmInput = document.getElementById("confirmPassword");

const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");
const submitBtn = document.getElementById("submitBtn");
const submitText = document.getElementById("submitText");
const formMessage = document.getElementById("formMessage");
const forgotBtn = document.getElementById("forgotBtn");
const togglePassword = document.getElementById("togglePassword");
const switchCopy = document.getElementById("switchCopy");

let currentMode = "login";

document.getElementById("year").textContent =
  new Date().getFullYear();

// Show status messages
function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.classList.toggle("error-message", isError);
}

// Switch between Login and Register
function setMode(mode) {
  currentMode = mode;

  const isRegister = mode === "register";

  nameField.hidden = !isRegister;
  confirmField.hidden = !isRegister;
  rememberRow.hidden = isRegister;
  forgotBtn.hidden = isRegister;

  nameInput.required = isRegister;
  confirmInput.required = isRegister;

  passwordInput.autocomplete = isRegister
    ? "new-password"
    : "current-password";

  formTitle.textContent = isRegister
    ? "Create your account"
    : "Welcome back!";

  formSubtitle.textContent = isRegister
    ? "Join TypeRush and improve your typing."
    : "Enter your details to continue.";

  submitText.textContent = isRegister
    ? "Create Account"
    : "Sign In";

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });

  switchCopy.replaceChildren(
    document.createTextNode(
      isRegister
        ? "Already have an account? "
        : "New to TypeRush? "
    )
  );

  const button = document.createElement("button");
  button.type = "button";
  button.className = "text-button";
  button.dataset.mode = isRegister ? "login" : "register";
  button.textContent = isRegister ? "Login" : "Create an account";

  switchCopy.appendChild(button);

  formMessage.textContent = "";
  formMessage.classList.remove("error-message");
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setMode(tab.dataset.mode);
  });
});

switchCopy.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");

  if (button) {
    setMode(button.dataset.mode);
  }
});

// Show or hide password
togglePassword.addEventListener("click", () => {
  const show = passwordInput.type === "password";

  passwordInput.type = show ? "text" : "password";
  togglePassword.textContent = show ? "Hide" : "Show";
});

// Validate form
function validateForm() {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (currentMode === "register" &&
      nameInput.value.trim().length < 2) {
    showMessage("Please enter a name with at least 2 characters.", true);
    nameInput.focus();
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showMessage("Please enter a valid email address.", true);
    emailInput.focus();
    return false;
  }

  if (password.length < 8) {
    showMessage("Password must contain at least 8 characters.", true);
    passwordInput.focus();
    return false;
  }

  if (currentMode === "register" &&
      password !== confirmInput.value) {
    showMessage("Passwords do not match.", true);
    confirmInput.focus();
    return false;
  }

  return true;
}

// Convert Firebase errors to understandable messages
function friendlyError(error) {
  const messages = {
    "auth/email-already-in-use":
      "This email already has an account. Please log in.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/invalid-credential":
      "Email or password is incorrect.",

    "auth/user-not-found":
      "Account not found. Please create an account first.",

    "auth/wrong-password":
      "Incorrect password. Please try again.",

    "auth/weak-password":
      "Please choose a stronger password.",

    "auth/too-many-requests":
      "Too many attempts. Please wait and try again.",

    "auth/network-request-failed":
      "Network error. Check your internet connection.",

    "auth/operation-not-allowed":
      "Enable Email/Password in Firebase Authentication settings.",

    "auth/invalid-api-key":
      "Firebase API key is invalid. Check your Firebase configuration."
  };

  return messages[error.code] ||
    "Something went wrong: " + (error.code || error.message);
}

// Login and Register
form.addEventListener("submit", async (event) => {
  event.preventDefault();

  formMessage.textContent = "";

  if (!validateForm()) return;

  submitBtn.disabled = true;
  submitText.textContent = "Please wait...";

  try {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (currentMode === "register") {
      // Create Firebase account
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const displayName = nameInput.value.trim();

      await updateProfile(credential.user, {
        displayName: displayName
      });

      // Save user profile to Firestore
      try {
        await setDoc(doc(db, "users", credential.user.uid), {
          displayName: displayName,
          email: email,
          bestWpm: 0,
          createdAt: serverTimestamp()
        });

        showMessage(
          "Account created successfully! Your profile was saved."
        );
      } catch (dbError) {
        console.error("Firestore profile error:", dbError);

        showMessage(
          "Account created, but profile saving failed. Check Firestore security rules.",
          true
        );
      }

    } else {
      // Choose whether to remember the login
      const persistence = document.getElementById("remember").checked
        ? browserLocalPersistence
        : browserSessionPersistence;

      await setPersistence(auth, persistence);

      // Sign in with Firebase
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // මෙතැනදී profile එක save කරන code එකත් සාර්ථකව අවසන් වෙන්න ඕන
window.location.href = "home.html";

      showMessage("Login successful! Welcome back to TypeRush.");
    }

  } catch (error) {
    console.error("Firebase error:", error);
    showMessage(friendlyError(error), true);

  } finally {
    submitBtn.disabled = false;

    submitText.textContent = currentMode === "register"
      ? "Create Account"
      : "Sign In";
  }
});

// Forgot password
forgotBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showMessage("Enter your email address first.", true);
    emailInput.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    showMessage(
      "If an account exists for this email, a password reset email will be sent."
    );

  } catch (error) {
    console.error("Password reset error:", error);
    showMessage(friendlyError(error), true);
  }
});

// Start on Login tab
setMode("login");
