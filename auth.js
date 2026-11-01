/* Rust Car Tracker — Signup gate (Firebase Auth: Google + Email + Phone).
   The live location is visible only to signed-in users. */
  const firebaseConfig = {
    apiKey: "AIzaSyCkS_-y9Lql4u0oHEWl7yc2jPZFjpfjdSQ",
    authDomain: "rust-car-tracker.firebaseapp.com",
    projectId: "rust-car-tracker",
    storageBucket: "rust-car-tracker.firebasestorage.app",
    messagingSenderId: "834287739423",
    appId: "1:834287739423:web:1501ce57d393b637feab2a"
  };
  const lockEl = document.getElementById('lockOverlay');
  const errEl = document.getElementById('authErr');
  function authError(msg){ errEl.textContent = msg; errEl.style.display = 'block'; }
  function clearError(){ errEl.style.display = 'none'; }
  function friendly(e){
    switch (e.code) {
      case 'auth/invalid-email': return 'Please enter a valid email address.';
      case 'auth/weak-password': return 'Password is too weak — use at least 6 characters.';
      case 'auth/email-already-in-use': return 'This email already has an account — use "Log in" below the button instead.';
      case 'auth/user-not-found': case 'auth/wrong-password': case 'auth/invalid-credential':
        return 'Email or password is incorrect. Please check and try again.';
      case 'auth/invalid-phone-number': return 'Please enter the phone number with country code, e.g. +92 300 1234567.';
      case 'auth/invalid-verification-code': return 'That code is incorrect — please check the SMS and try again.';
      case 'auth/code-expired': return 'That code has expired — please request a new one.';
      case 'auth/too-many-requests': return 'Too many attempts — please wait a little and try again.';
      case 'auth/operation-not-allowed': return 'This sign-in option is not enabled yet.';
      case 'auth/network-request-failed': return 'Network problem — please check your connection and try again.';
      default: return 'Sign-in failed (' + e.code + '). Please try again.';
    }
  }
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  auth.onAuthStateChanged(user => {
    if (user) {
      lockEl.style.display = 'none';
      const chip = document.getElementById('userChip');
      chip.style.display = 'inline-flex';
      document.getElementById('userName').textContent = user.displayName || user.email || user.phoneNumber || 'Signed in';
      const ph = document.getElementById('userPhoto');
      if (user.photoURL) { ph.src = user.photoURL; ph.style.display = ''; } else { ph.style.display = 'none'; }
    } else {
      lockEl.style.display = 'flex';
      document.getElementById('userChip').style.display = 'none';
    }
  });
  /* Google */
  document.getElementById('googleBtn').addEventListener('click', () => {
    clearError();
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => {
      if (e.code === 'auth/popup-closed-by-user') return;
      authError(friendly(e));
    });
  });
  /* Email — create account / log in */
  let emailMode = 'signup';
  const emailBtn = document.getElementById('emailBtn');
  const emailToggle = document.getElementById('emailToggle');
  emailToggle.addEventListener('click', () => {
    emailMode = emailMode === 'signup' ? 'login' : 'signup';
    emailBtn.textContent = emailMode === 'signup' ? '✉️ Create account with Email' : '✉️ Log in with Email';
    emailToggle.textContent = emailMode === 'signup' ? 'Already have an account? Log in' : 'New here? Create an account';
    clearError();
  });
  emailBtn.addEventListener('click', () => {
    clearError();
    const em = document.getElementById('emailIn').value.trim();
    const pw = document.getElementById('passIn').value;
    if (!em || !pw) { authError('Please enter your email and password.'); return; }
    const p = emailMode === 'signup' ? auth.createUserWithEmailAndPassword(em, pw) : auth.signInWithEmailAndPassword(em, pw);
    p.catch(e => authError(friendly(e)));
  });
  /* Phone — SMS code */
  let confirmResult = null;
  const verifier = new firebase.auth.RecaptchaVerifier('recaptchaBox', { size: 'invisible' });
  document.getElementById('phoneBtn').addEventListener('click', () => {
    clearError();
    const num = document.getElementById('phoneIn').value.replace(/\s+/g, '');
    if (!num) { authError('Please enter your phone number with country code, e.g. +92 300 1234567.'); return; }
    auth.signInWithPhoneNumber(num, verifier).then(cr => {
      confirmResult = cr;
      document.getElementById('codeRow').style.display = 'block';
      authError('Code sent by SMS — enter it below.');
      errEl.style.color = 'var(--lime2)';
    }).catch(e => authError(friendly(e)));
  });
  document.getElementById('verifyBtn').addEventListener('click', () => {
    clearError();
    const code = document.getElementById('codeIn').value.trim();
    if (!confirmResult) { authError('Please tap "Send code by SMS" first.'); return; }
    if (!code) { authError('Please enter the code from the SMS.'); return; }
    confirmResult.confirm(code).catch(e => authError(friendly(e)));
  });
  document.getElementById('signOutBtn').addEventListener('click', () => auth.signOut());
