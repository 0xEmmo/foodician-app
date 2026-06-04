'use client';

import { useState } from 'react';
import { useAppStore } from '@/src/store/useAppStore';
import { supabase } from '@/src/lib/supabase';

export default function ProfileSettings() {
  const sessionUser = useAppStore(s => s.sessionUser);
  const setSessionUser = useAppStore(s => s.setSessionUser);
  const [name, setName] = useState(sessionUser?.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const updateName = async () => {
    if (!sessionUser) return;
    const { error } = await supabase
      .from('profiles')
      .update({ name })
      .eq('id', sessionUser.id);
    if (error) setError(error.message);
    else {
      setSessionUser({ ...sessionUser, name });
      setMessage('Name updated successfully');
    }
  };

  const updatePassword = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setError(error.message);
    else setMessage('Password updated. Please log in again next time.');
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Account Settings</h1>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-[#161616] border border-[#262626] rounded-lg px-4 py-2 text-white"
          />
          <button onClick={updateName} className="mt-2 bg-[#E8192C] px-4 py-2 rounded text-white">
            Update Name
          </button>
        </div>
        <hr className="border-[#262626]" />
        <div>
          <label className="block text-sm font-medium mb-1">New Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full bg-[#161616] border border-[#262626] rounded-lg px-4 py-2 text-white"
          />
          <label className="block text-sm font-medium mt-2 mb-1">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full bg-[#161616] border border-[#262626] rounded-lg px-4 py-2 text-white"
          />
          <button onClick={updatePassword} className="mt-2 bg-[#E8192C] px-4 py-2 rounded text-white">
            Change Password
          </button>
        </div>
        {message && <p className="text-green-500">{message}</p>}
        {error && <p className="text-red-500">{error}</p>}
      </div>
    </div>
  );
}