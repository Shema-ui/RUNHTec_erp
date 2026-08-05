import React from 'react';

const LOGO_URL = 'https://horizons-cdn.hostinger.com/2757b26b-44c6-4111-a4b2-af6d71351715/f9d1fad541d7f3b6fd43d5a1326794e7.jpg';

// RUNHTec wordmark / emblem used across auth and portal chrome.
export default function BrandMark({ collapsed = false, className = '', variant = 'default' }) {
  if (collapsed) {
    // Show just the icon/initials when collapsed
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm overflow-hidden">
          <img
            src={LOGO_URL}
            alt="RUNHTec"
            className="h-8 w-8 object-contain"
          />
        </div>
      </div>
    );
  }

  if (variant === 'auth') {
    // Larger logo for auth panel (white bg not needed, logo has white bg already)
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <img
          src={LOGO_URL}
          alt="RUNHTec Contractors Ltd"
          className="h-14 w-auto object-contain bg-white rounded-lg p-1"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm overflow-hidden">
        <img
          src={LOGO_URL}
          alt="RUNHTec"
          className="h-8 w-8 object-contain"
        />
      </div>
      <div className="leading-tight">
        <div className="font-display text-[14px] font-extrabold tracking-tight text-white">
          RUNHTec
        </div>
        <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">
          Business Portal
        </div>
      </div>
    </div>
  );
}
