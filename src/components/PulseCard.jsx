import React, { useState } from 'react';

/**
 * PulseCard — A single proactive insight card rendered in the Overview pulse rail.
 *
 * @param {{ card: PulseCard, index: number, onDismiss: (id: string) => void }} props
 */
export default function PulseCard({ card, index, onDismiss }) {
  const [exiting, setExiting] = useState(false);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(card.id), 260);
  };

  const handleAction = () => {
    if (card.action?.target) {
      window.location.hash = card.action.target;
    }
  };

  const typeColor = {
    burn_rate: 'rgba(248, 113, 113, 0.15)',
    vampire: 'rgba(167, 139, 250, 0.15)',
    circle_owe: 'rgba(248, 113, 113, 0.15)',
    circle_owed: 'rgba(74, 222, 128, 0.12)',
    friend_receivable: 'rgba(74, 222, 128, 0.12)',
    spike_warning: 'rgba(251, 146, 60, 0.15)',
    savings_nudge: 'rgba(74, 222, 128, 0.15)',
  };

  const typeBorder = {
    burn_rate: 'rgba(248, 113, 113, 0.4)',
    vampire: 'rgba(167, 139, 250, 0.4)',
    circle_owe: 'rgba(248, 113, 113, 0.4)',
    circle_owed: 'rgba(74, 222, 128, 0.5)',
    friend_receivable: 'rgba(74, 222, 128, 0.5)',
    spike_warning: 'rgba(251, 146, 60, 0.4)',
    savings_nudge: 'rgba(74, 222, 128, 0.5)',
  };

  const renderIcon = (type) => {
    switch (type) {
      case 'burn_rate':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
          </svg>
        );
      case 'vampire':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        );
      case 'circle_owe':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="7" x2="17" y2="17"/>
            <polyline points="17 7 17 17 7 17"/>
          </svg>
        );
      case 'circle_owed':
      case 'friend_receivable':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="7" y1="17" x2="17" y2="7"/>
            <polyline points="7 7 17 7 17 17"/>
          </svg>
        );
      case 'spike_warning':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        );
      case 'savings_nudge':
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          </svg>
        );
    }
  };

  const cardStyle = {
    animationDelay: `${index * 60}ms`,
    animationName: exiting ? 'pulseCardOut' : 'pulseCardIn',
    animationDuration: exiting ? '260ms' : '340ms',
    animationFillMode: 'both',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <div className="pulse-card-item" style={cardStyle}>
      <div
        className="pulse-card-inner"
        style={{ borderColor: typeBorder[card.type] || 'var(--border)' }}
      >
        {/* Icon */}
        <div
          className="pulse-card-icon"
          style={{ background: typeColor[card.type] || 'var(--accent-light)' }}
        >
          {renderIcon(card.type)}
        </div>

        {/* Content */}
        <div className="pulse-card-content">
          <p className="pulse-card-title">{card.title}</p>
          <p className="pulse-card-body">{card.body}</p>

          {card.action && (
            <button
              className="pulse-card-action"
              onClick={handleAction}
              type="button"
            >
              {card.action.label} &rarr;
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button
          className="pulse-card-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
          type="button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
