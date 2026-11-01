/* Rust Car Tracker — Signup gate (Firebase Auth: Google + Facebook). The live location is visible only to signed-in users. */
/* ---------- Sign-up gate (Firebase Auth) ----------
     Config is filled in once the Firebase project exists.
     Until then the tracker stays locked with a notice. */
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
  if (firebaseConfig.apiKey) {
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    auth.onAuthStateChanged(user => {
      if (user) {
        lockEl.style.display = 'none';
        const chip = document.getElementById('userChip');
        chip.style.display = 'inline-flex';
        document.getElementById('userName').textContent = user.displayName || user.email || 'Signed in';
        const ph = document.getElementById('userPhoto');
        if (user.photoURL) { ph.src = user.photoURL; ph.style.display = ''; } else { ph.style.display = 'none'; }
      } else {
        lockEl.style.display = 'flex';
        document.getElementById('userChip').style.display = 'none';
      }
    });
    function popup(provider){
      errEl.style.display = 'none';
      auth.signInWithPopup(provider).catch(e => {
        if (e.code === 'auth/popup-closed-by-user') return;
        if (e.code === 'auth/operation-not-allowed') authError('This sign-in option is not available yet — please try Google sign-in.');
        else authError('Sign-in failed (' + e.code + '). Please try again.');
      });
    }
    document.getElementById('googleBtn').addEventListener('click', () => popup(new firebase.auth.GoogleAuthProvider()));
    document.getElementById('fbBtn').addEventListener('click', () => popup(new firebase.auth.FacebookAuthProvider()));
    document.getElementById('signOutBtn').addEventListener('click', () => auth.signOut());
  } else {
    authError('Sign-up is opening very soon — please check back shortly.');
  }
