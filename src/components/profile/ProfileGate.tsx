import React from 'react';
import welcomeBanner from '../../assets/WelcomePageBanner.jpg';

export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  avatar?: string;
}

interface ProfileGateProps {
  profiles: Profile[];
  onSelectProfile: (id: string) => void;
  onClose?: () => void;
  canClose?: boolean;
}

const ProfileGate: React.FC<ProfileGateProps> = ({ profiles, onSelectProfile, onClose, canClose = false }) => {
  return (
    <div className="relative min-h-screen text-white overflow-hidden">
      <img
        src={welcomeBanner}
        alt="Welcome"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold">Profiles</h1>
          <p className="text-gray-200 text-sm md:text-base">Who&apos;s watching?</p>
        </div>
          <div className="flex flex-wrap justify-center gap-6 mt-8">
            {profiles.map(profile => (
              <button
                key={profile.id}
                className="flex flex-col items-center bg-black/60 hover:bg-black/80 rounded-lg p-4 transition"
                onClick={() => onSelectProfile(profile.id)}
              >
                <img
                  src={profile.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(profile.name)}
                  alt={profile.name}
                  className="w-20 h-20 rounded-full mb-2 object-cover border-2 border-white"
                />
                <span className="font-semibold">{profile.name}</span>
                <span className="text-xs text-gray-400">Joined: {new Date(profile.createdAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
          {canClose && onClose && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-bold transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
    </div>
  );
};

export default ProfileGate;
