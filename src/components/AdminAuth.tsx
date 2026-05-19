import React, { useEffect, useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ADMIN_EMAIL } from '../config/admin';
import { LogIn, LogOut } from 'lucide-react';

export default function AdminAuth() {
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (user) {
    return (
      <div className="p-4 bg-bg-card rounded border border-border-main text-xs">
        <p className="mb-2 truncate text-slate-300">{user.email}</p>
        <button onClick={handleLogout} className="flex items-center gap-2 text-red-500">
          <LogOut size={16} /> Logout Admin
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleLogin} className="flex items-center gap-2 text-accent p-4">
      <LogIn size={16} /> Login Admin
    </button>
  );
}
