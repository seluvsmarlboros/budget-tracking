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

  // Map card type → accent color override (for icon background)
  const typeColor = {
    burn_rate: 'rgba(248, 113, 113, 0.15)',     // red tint
    vampire: 'rgba(167, 139, 250, 0.15)',        // purple tint
    friend_receivable: 'rgba(74, 222, 128, 0.12)', // mint tint
    spike_warning: 'rgba(251, 146, 60, 0.15)',   // orange tint
    savings_nudge: 'rgba(74, 222, 128, 0.15)',   // mint tint
  };

  const typeBorder = {
    burn_rate: 'rgba(248, 113, 113, 0.4)',
    vampire: 'rgba(167, 139, 250, 0.4)',
    friend_receivable: 'rgba(74, 222, 128, 0.5)',
    spike_warning: 'rgba(251, 146, 60, 0.4)',
    savings_nudge: 'rgba(74, 222, 128, 0.5)',
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
          <span role="img" aria-label={card.type}>{card.icon}</span>
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
              {card.action.label} →
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
