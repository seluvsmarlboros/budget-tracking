/* Onboarding — single step */
import { State } from './state.js';

export function initOnboarding() {
  const form = document.getElementById('onboard-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    console.log('UniSpend: Onboarding form submitted');
    const name = document.getElementById('onb-name').value.trim();
    const currency = document.getElementById('onb-currency').value;
    const budget = document.getElementById('onb-budget').value;
    const seed = document.getElementById('onb-seed').checked;
    const goal = document.getElementById('onb-goal').value.trim();
    const cutback = document.getElementById('onb-cutback').value;

    console.log('UniSpend: Form details:', { name, currency, budget, seed, goal, cutback });

    if (!name || !budget) {
      console.warn('UniSpend: Missing name or budget. Aborting onboarding.');
      return;
    }

    try {
      State.completeOnboarding({
        name,
        currency,
        weeklyPocketMoney: budget,
        seedData: seed,
        targetGoal: goal,
        cutbackCategory: cutback
      });
      console.log('UniSpend: completeOnboarding executed successfully. Persisted state:', State.data);
    } catch (err) {
      console.error('UniSpend: Error running State.completeOnboarding:', err);
    }

    // Reveal app
    document.getElementById('onboarding').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');

    console.log('UniSpend: Reloading page to apply onboarding changes...');
    // Reload to init all modules cleanly
    location.reload();
  });
}
