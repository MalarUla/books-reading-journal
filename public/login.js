document.addEventListener('DOMContentLoaded', () => {
  const loginContainer = document.getElementById('login-container');
  const landingPage = document.getElementById('landing-page');
  const googleLoginBtn = document.getElementById('google-login');
  const logoutBtn = document.getElementById('logout-btn');

  const showLandingPage = (user) => {
    loginContainer.classList.add('hidden');
    landingPage.classList.remove('hidden');
    console.log("Logged in as:", user.displayName);
  };

  const showLogin = () => {
    loginContainer.classList.remove('hidden');
    landingPage.classList.add('hidden');
  };

  // Handle Google Sign-in
  googleLoginBtn.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await firebase.auth().signInWithPopup(provider);
      const user = result.user;
      showLandingPage(user);
    } catch (error) {
      console.error("Google Sign-in error:", error);
      alert("Sign-in failed. Try again.");
    }
  });

  // Handle logout
  logoutBtn.addEventListener('click', () => {
    firebase.auth().signOut().then(() => {
      showLogin();
    });
  });

  // Auto-login if already signed in
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      showLandingPage(user);
    } else {
      showLogin();
    }
  });
});
